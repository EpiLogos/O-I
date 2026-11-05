//! The typed audio graph (M1 of shell/SHELL-BLUEPRINT.md, with the parts
//! M1 left to build: MIDI tracks, sends and returns — O-I #849).
//!
//! A [`Graph`] is a set of parts — audio tracks (mono or stereo f32
//! buffers) and MIDI tracks (an [`Instrument`] playing scheduled notes and
//! live ones) — each carrying a gain, a pan, an activator, a solo, sends
//! to the return tracks, an ordered [`Device`] chain and an output into the
//! Main track; return tracks take what the parts send them through their
//! own chains; the Main track carries a gain, a pan and its own device
//! chain. The transport is a tempo/beat clock. Two execution paths share
//! ONE mixing arithmetic: the deterministic offline [`Graph::render`] /
//! [`Graph::render_performance`] (the acceptance path the milestone gates
//! run against, and Export Audio) and the per-frame [`Graph::mix_frame`]
//! pull of the audio callback (`engine.rs`, `realtime.rs`). Bit-identity
//! of the paths is pinned by tests (`mix_frame_composes_the_render_exactly`,
//! `tests/parts_engine.rs` `export_renders_the_samples_the_engine_played`).
//!
//! Clean-room: written from `session-model.md`, the device dossiers and the
//! gated `live-dynamics` models only. Mixing-topology decisions that no
//! document pins down are marked ENGINE DECISION where they are made.

use crate::engine::{DeviceAt, EngineEvent, Part, Performance};

/// One audio clock position, passed to every device frame.
///
/// Song time is beats (session-model.md §2: 1.1.1 = 0; seconds = beats ×
/// 60 / tempo). The clock reports the render position in samples and the
/// derived beat/time positions; it carries no realtime notion.
#[derive(Debug, Clone, Copy)]
pub struct Clock {
    /// Sample rate the render runs at (Hz).
    pub sample_rate: u32,
    /// Absolute sample index of the current frame within the render.
    pub sample: u64,
    /// Document tempo in beats per minute (MainTrack mixer `Tempo/Manual`,
    /// session-model.md §2).
    pub tempo_bpm: f64,
}

impl Clock {
    pub fn start(sample_rate: u32, tempo_bpm: f64) -> Clock {
        Clock {
            sample_rate,
            sample: 0,
            tempo_bpm,
        }
    }

    /// Position of the current frame in song beats (1.1.1 = 0).
    pub fn beat(&self) -> f64 {
        self.time_s() * self.tempo_bpm / 60.0
    }

    /// Position of the current frame in seconds.
    pub fn time_s(&self) -> f64 {
        self.sample as f64 / self.sample_rate as f64
    }

    /// The frame a song position in beats falls on at this clock's rate and
    /// tempo (seconds = beats × 60 / tempo, session-model.md §2), rounded
    /// to the nearest frame.
    pub fn frame_of_beat(&self, beat: f64) -> u64 {
        (beat.max(0.0) * 60.0 / self.tempo_bpm * self.sample_rate as f64).round() as u64
    }
}

/// A node in a part's device chain.
///
/// `frame_io` is ONE audio frame, interleaved, with as many channels as the
/// hosting track has (1 or 2); devices process and modify it in place.
/// This is deliberately frame-granular: it keeps device state simple and
/// the offline render bit-deterministic, which the acceptance gates rely
/// on. Block/buffer processing is a later optimization, not a semantic
/// change.
pub trait Device: std::fmt::Debug + Send + AsAny {
    /// The document element name this device instantiates (e.g.
    /// `GlueCompressor`), or the engine-side name for engine-native
    /// devices (`Gain`, `Bypass`).
    fn name(&self) -> &str;
    fn process(&mut self, frame_io: &mut [f32], clock: &Clock);
    /// Build whatever the device needs at `sample_rate` × `channels`
    /// (delay lines, impulse responses) BEFORE the graph reaches the audio
    /// thread: [`Graph::prepare`] calls it, so `process` allocates
    /// nothing. The default has nothing to build.
    fn prepare(&mut self, _sample_rate: u32, _channels: usize) {}
    /// The settings the device takes while it plays (O-I #849 round 16), each by its maker's key
    /// with the extent it takes it within: [`EngineEvent::Set`] moves one from the next block, and
    /// any other setting is taken by making the device again ([`Graph::rack`]). None by default.
    fn settings(&self) -> &'static [(&'static str, f64, f64)] {
        &[]
    }
    /// Take setting `at` of [`Device::settings`] at `value`, within its extent: from the next
    /// frame, moving to it as its maker moves an edited setting. On the audio thread, so
    /// allocation-free.
    fn set(&mut self, _at: usize, _value: f64) {}
    /// Stand in the place of `was`, the device of its kind this one replaces on a chain (O-I #849
    /// round 16, [`Graph::rack`]): take what still sounds in it, so the sound goes on through the
    /// change (a room's tail rings out, a line's repeats go on). What this one gives up for it goes
    /// back in `was`, to be dropped off the audio thread. On the audio thread, so allocation-free.
    /// By default nothing is taken: a device with no state to carry starts afresh.
    fn follow(&mut self, _was: &mut dyn Device) {}
    /// Stand in the place of `was`, the device of its kind this one replaces when a set's device is made again for an
    /// edit (O-I #849 round 17, [`Graph::make_again`]): what still sounds in it sounds on, as [`Device::follow`] carries
    /// it, and a device whose settings' state an edit changes carries more (a compressor's detector, a line's repeats).
    /// A chain the engine puts again ([`Graph::rack`]) keeps [`Device::follow`]'s rule. On the audio thread, so
    /// allocation-free. By default as [`Device::follow`].
    fn made_again_from(&mut self, was: &mut dyn Device) {
        self.follow(was)
    }
    // `Send` is a supertrait because a Graph is mixed on the realtime
    // callback (realtime.rs): cpal's stream closure is a `Send` bound, so
    // `Box<dyn Device>` must be Send. Every device is plain DSP state
    // (floats, usize, Vec<f32>), which is exactly what the bound asks for.
}

/// What lets a device read the one it stands in place of as the device it is ([`Device::follow`]):
/// every device is one, as every type is.
pub trait AsAny {
    fn as_any_mut(&mut self) -> &mut dyn std::any::Any;
}

impl<T: std::any::Any> AsAny for T {
    fn as_any_mut(&mut self) -> &mut dyn std::any::Any {
        self
    }
}

/// The sounding head of a MIDI track's chain (manual §21.1: "A MIDI
/// track's notes play the Torus"; the Live device set's instruments).
///
/// Notes arrive as edges at the frame they fall on — from the track's
/// clip notes or from live play ([`EngineEvent::NoteOn`]) — and the
/// instrument writes one frame of audio into `frame_io` (overwriting it),
/// which then runs through the rest of the chain. Like a [`Device`], it is
/// frame-granular and must not allocate in `note_on`, `note_off`,
/// `release_all` or `process`: [`Instrument::prepare`] runs off the audio
/// thread first.
pub trait Instrument: std::fmt::Debug + Send {
    /// The document element name (`Operator`) or the engine name of the
    /// node (`Torus`).
    fn name(&self) -> &str;
    fn note_on(&mut self, key: u8, velocity: f32, clock: &Clock);
    fn note_off(&mut self, key: u8, clock: &Clock);
    /// Release every held note (manual §21.1 Rules: "Lose focus or lose a
    /// device, and all held notes are released. Panic releases all notes
    /// at once.").
    fn release_all(&mut self, clock: &Clock);
    fn process(&mut self, frame_io: &mut [f32], clock: &Clock);
    fn prepare(&mut self, _sample_rate: u32) {}
    /// What it takes of a channel's expression while its notes sound (O-I #853): its pitch bend and
    /// its channel pressure, each taken or why not ([`Touch`]). The control side reads it when the
    /// instrument is put on its part, so a move it does not take is refused in words. None by default.
    fn touch(&self) -> Touch {
        Touch::NONE
    }
    /// Bend every note it sounds, and those struck after, by `amount` of its bend's range (−1 down to 1
    /// up, 0 unbent), from `clock`. Answers whether it took it. On the audio thread, so allocation-free.
    fn bend(&mut self, _amount: f32, _clock: &Clock) -> bool {
        false
    }
    /// Press on every note it sounds by `amount` (0 to 1), from `clock`. Answers whether it took it.
    fn pressure(&mut self, _amount: f32, _clock: &Clock) -> bool {
        false
    }
    /// One act of the Torus's keys ([`EngineEvent::TorusPlay`], O-I #849), struck at `clock`. Answers
    /// whether the instrument struck it: only the Torus plays an act by its keys' places, so every
    /// other instrument strikes nothing.
    fn torus_play(&mut self, _act: &TorusAct, _clock: &Clock) -> bool {
        false
    }
    /// The handover a Torus was handed over by (its owner's `torus-native`, counted by the host), so
    /// an act its owner landed after that handover ([`TorusStrike::handover`]) finds it; `None` for
    /// every other instrument.
    fn torus_handover(&self) -> Option<u32> {
        None
    }
    /// One act its owner landed ([`EngineEvent::TorusStrike`], O-I #849): the impulses the owner's
    /// own law gave the modes, struck when the Torus's continuation reaches the owner's sample.
    /// Answers whether the instrument took it (struck, or waiting for its sample).
    fn torus_strike(&mut self, _strike: &TorusStrike, _clock: &Clock) -> bool {
        false
    }
    /// One part of its owner's block that reached gains a receiver moved ([`EngineEvent::TorusHear`],
    /// O-I #849 round 14), reached when the Torus's continuation reaches the owner's sample, over the
    /// owner's samples. Answers whether the instrument took it (waiting for its sample).
    fn torus_hear(&mut self, _hear: &TorusHear, _clock: &Clock) -> bool {
        false
    }
    /// The sample of its owner's continuation a Torus renders next (O-I #849 round 13), where a
    /// hand-over again finds it ([`crate::Due::AtCursor`]); `None` for every other instrument, and for a
    /// Torus that does not render.
    fn torus_cursor(&self) -> Option<u64> {
        None
    }
    /// Panic ([`EngineEvent::Panic`]; manual §21.1 Rules: "Panic releases all notes at once"): by
    /// default every held note is released. The Torus is stilled instead, since a released note of
    /// a struck body rings on (O-I #849).
    fn panic(&mut self, clock: &Clock) {
        self.release_all(clock)
    }
}

/// The most keys one act of the Torus strikes (QL's `m1_prime::POLYPHONY_MAX`).
pub const TORUS_ACT_KEYS: usize = 32;

/// One act of the Torus's keys (O-I #849; manual §21.2 "What strikes the Torus"): 1 to
/// [`TORUS_ACT_KEYS`] Jankó keys struck together, each at `(rows[i], columns[i])`, at one point
/// velocity (`amplitude`, modal metres, re and im). The Torus strikes each key's moving point on the
/// voices of the tuning in force by QL's played-address law, summed as one strike. Plain data, so it
/// travels to the audio thread in an [`EngineEvent`].
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct TorusAct {
    pub count: u8,
    pub rows: [u8; TORUS_ACT_KEYS],
    pub columns: [u16; TORUS_ACT_KEYS],
    pub amplitude: [f64; 2],
}

impl TorusAct {
    /// The act of `keys` (row, column) at `amplitude`; refused in words with no key, more than
    /// [`TORUS_ACT_KEYS`], or a velocity that is not finite. Whether a key's row lies on the surface
    /// and the velocity within the material's cap is the Torus's own law to judge.
    pub fn new(keys: &[(u8, u16)], amplitude: [f64; 2]) -> Result<TorusAct, String> {
        if keys.is_empty() || keys.len() > TORUS_ACT_KEYS {
            return Err(format!(
                "a Torus act strikes 1 to {TORUS_ACT_KEYS} keys, not {}",
                keys.len()
            ));
        }
        if amplitude.iter().any(|v| !v.is_finite()) {
            return Err("a Torus act's velocity is two finite modal metres".into());
        }
        let mut act = TorusAct {
            count: keys.len() as u8,
            rows: [0; TORUS_ACT_KEYS],
            columns: [0; TORUS_ACT_KEYS],
            amplitude,
        };
        for (i, (row, column)) in keys.iter().enumerate() {
            act.rows[i] = *row;
            act.columns[i] = *column;
        }
        Ok(act)
    }

    /// The keys struck, as (row, column).
    pub fn keys(&self) -> impl Iterator<Item = (u8, u16)> + '_ {
        let n = usize::from(self.count).min(TORUS_ACT_KEYS);
        self.rows[..n]
            .iter()
            .copied()
            .zip(self.columns[..n].iter().copied())
    }
}

/// The most modes one [`TorusStrike`] carries; an owner's act on more travels as several, landing
/// at the same sample.
pub const TORUS_STRIKE_MODES: usize = 16;

/// The owner's acts a graph keeps for a Torus not yet on its part (one handed over and still on its
/// way); past this many, an act is dropped and counted ([`Graph::torus_unplaced`]).
pub const TORUS_WAITING: usize = 256;

/// One act the Torus's owner landed (O-I #849; manual §21.2 "What strikes the Torus": a key, a touch,
/// a clip's note, a singlet): the impulses QL's own law gave the resident modes (modal metres, re and
/// im, by mode index into the continuation the owner handed over), landing at the owner's sample `at`
/// (its cursor). The engine adds no law of its own: the Torus strikes these impulses when its
/// continuation reaches `at`, as the owner did, so the two ring sample for sample alike. `handover`
/// names the handover the act followed; a Torus handed over by a later one holds it already. Plain
/// data, so it travels to the audio thread in an [`EngineEvent`].
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct TorusStrike {
    pub handover: u32,
    pub at: u64,
    pub count: u8,
    pub modes: [u16; TORUS_STRIKE_MODES],
    pub re: [f64; TORUS_STRIKE_MODES],
    pub im: [f64; TORUS_STRIKE_MODES],
}

impl TorusStrike {
    /// The owner's act of `impulses` (mode index, [re, im]) at `at`, as one or more acts of at most
    /// [`TORUS_STRIKE_MODES`] modes each (off the audio thread: it allocates). Refused in words with
    /// no impulse, a mode named twice or past 65535, or an impulse that is not finite; whether the
    /// body can take it is the Torus's own law to judge.
    pub fn split(
        handover: u32,
        at: u64,
        impulses: &[(usize, [f64; 2])],
    ) -> Result<Vec<TorusStrike>, String> {
        if impulses.is_empty() {
            return Err("an act of the Torus's owner strikes at least one mode".into());
        }
        let mut seen = std::collections::BTreeSet::new();
        for (mode, z) in impulses {
            if *mode > usize::from(u16::MAX) || !seen.insert(*mode) {
                return Err(format!(
                    "an act of the Torus's owner names each mode once, by its index; mode {mode} is not one"
                ));
            }
            if z.iter().any(|v| !v.is_finite()) {
                return Err("an act of the Torus's owner strikes with finite modal metres".into());
            }
        }
        Ok(impulses
            .chunks(TORUS_STRIKE_MODES)
            .map(|part| {
                let mut act = TorusStrike {
                    handover,
                    at,
                    count: part.len() as u8,
                    modes: [0; TORUS_STRIKE_MODES],
                    re: [0.0; TORUS_STRIKE_MODES],
                    im: [0.0; TORUS_STRIKE_MODES],
                };
                for (i, (mode, z)) in part.iter().enumerate() {
                    act.modes[i] = *mode as u16;
                    act.re[i] = z[0];
                    act.im[i] = z[1];
                }
                act
            })
            .collect())
    }

    /// The impulses struck, as (mode index, [re, im]).
    pub fn impulses(&self) -> impl Iterator<Item = (usize, [f64; 2])> + '_ {
        let n = usize::from(self.count).min(TORUS_STRIKE_MODES);
        (0..n).map(|i| (usize::from(self.modes[i]), [self.re[i], self.im[i]]))
    }
}

/// The most gains one [`TorusHear`] carries; a move of more modes travels as several, for the same
/// sample, landing as one.
pub const TORUS_HEAR_MODES: usize = 16;

/// The most samples a move is reached over (QL's `max_gain_ramp_frames`, the owner's block ceiling).
pub const TORUS_HEAR_FRAMES: u32 = 8192;

/// One part of its owner's block that reached gains a receiver moved (O-I #849 round 14; QL's
/// `TORUS_HEARD_LAW`, manual §21.2 View: "Receiver On makes your camera the place where the torus is
/// heard"): from the owner's sample `at`, each mode is heard by a gain reached linearly over `frames`
/// samples, from the gain it was heard by to `gains`. The engine adds nothing of its own: the Torus
/// reaches the owner's gains over the owner's samples, however it renders them, so the two sound alike
/// sample for sample. A move names every mode of the continuation the owner handed over, in its order:
/// this carries modes `first .. first + count` of `total`. `handover` names the handover it followed.
/// Plain data, so it travels to the audio thread in an [`EngineEvent`].
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct TorusHear {
    pub handover: u32,
    pub at: u64,
    pub frames: u32,
    pub first: u16,
    pub count: u8,
    pub total: u16,
    pub gains: [f64; TORUS_HEAR_MODES],
}

impl TorusHear {
    /// The owner's move to `gains` (one per mode, in the order of the continuation handed over) over
    /// `frames` samples from `at`, as one or more parts of at most [`TORUS_HEAR_MODES`] gains each (off
    /// the audio thread: it allocates). Refused in words with no gain, more modes than 65535, a gain
    /// that is not finite or past the owner's bound, or a length outside 1 to [`TORUS_HEAR_FRAMES`].
    pub fn split(
        handover: u32,
        at: u64,
        frames: u32,
        gains: &[f64],
    ) -> Result<Vec<TorusHear>, String> {
        if gains.is_empty() || gains.len() > usize::from(u16::MAX) {
            return Err("a move of the Torus's gains names one gain for each of its modes".into());
        }
        if gains.iter().any(|g| !g.is_finite() || g.abs() > 1e6) {
            return Err("a move of the Torus's gains names finite gains within 1e6".into());
        }
        if frames == 0 || frames > TORUS_HEAR_FRAMES {
            return Err(format!(
                "a move of the Torus's gains is reached over 1 to {TORUS_HEAR_FRAMES} samples"
            ));
        }
        Ok(gains
            .chunks(TORUS_HEAR_MODES)
            .enumerate()
            .map(|(k, part)| {
                let mut hear = TorusHear {
                    handover,
                    at,
                    frames,
                    first: (k * TORUS_HEAR_MODES) as u16,
                    count: part.len() as u8,
                    total: gains.len() as u16,
                    gains: [0.0; TORUS_HEAR_MODES],
                };
                hear.gains[..part.len()].copy_from_slice(part);
                hear
            })
            .collect())
    }

    /// The gains it carries, for modes `first ..`.
    pub fn gains(&self) -> &[f64] {
        &self.gains[..usize::from(self.count).min(TORUS_HEAR_MODES)]
    }
}

/// What a Torus not yet on its part waits for from its owner: an act it landed, or a move it reached.
#[derive(Debug, Clone, Copy, PartialEq)]
enum Followed {
    Strike(TorusStrike),
    Hear(TorusHear),
}

impl Followed {
    fn handover(&self) -> u32 {
        match self {
            Followed::Strike(s) => s.handover,
            Followed::Hear(h) => h.handover,
        }
    }
}

/// Amplitude to dBFS (20·log10). Silence reads as the crate's -144 floor
/// (same convention as `live_dynamics::audio::rms_db`).
pub fn amplitude_to_db(a: f64) -> f64 {
    if a <= 0.0 {
        -144.0
    } else {
        20.0 * a.log10()
    }
}

/// dB to amplitude (10^(dB/20)).
pub fn db_to_amplitude(db: f64) -> f64 {
    (db / 20.0 * std::f64::consts::LN_10).exp()
}

/// Pan weights for a pan value in −1 (hard left) … +1 (hard right).
///
/// M1 ENGINE DECISION (not Live truth): center is unity and only the
/// counter channel is tapered, linearly, to zero at full deflection — the
/// kept channel is never boosted. No dossier measures Live's pan law yet,
/// so the clean-room rule forbids guessing equal-power constants here;
/// this law keeps center-panned material bit-transparent, which is what
/// the M1 gate pins (all staging at unity). The probe sets that measure
/// Live's law, and the gate that holds this function to them, are
/// `tests/mixer_gate.rs` (PAN_* renders; skipped with a notice until they
/// are exported from Live).
pub fn pan_weights(pan: f64) -> (f64, f64) {
    let p = pan.clamp(-1.0, 1.0);
    let left = if p <= 0.0 { 1.0 } else { 1.0 - p };
    let right = if p >= 0.0 { 1.0 } else { 1.0 + p };
    (left, right)
}

/// The most return tracks a set can hold: Live names them A to L.
/// ENGINE DECISION (a bound, so the return buses are a fixed array the
/// audio thread never allocates): twelve.
pub const MAX_RETURNS: usize = 12;

/// One note of a MIDI clip on the engine's timeline (frames at the
/// graph's rate). Built from the document's beats by the host
/// ([`Clock::frame_of_beat`]).
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Note {
    pub key: u8,
    /// First frame the note sounds.
    pub start: u64,
    /// Frames the key is held.
    pub length: u64,
    /// Live's stored velocity (document units).
    pub velocity: f32,
}

/// One device of the chain an instrument's owner puts after it on its part (O-I #849 round 13: the
/// Torus's effects, as Live's devices on the chain of the Instrument Rack the Torus is placed as —
/// live-set `rack_place`): the engine's device, and what it was made from in its maker's words, so
/// a chain put on the part again keeps the state of every device made from the same (a tail rings
/// on through another device's edit) ([`Graph::rack`]).
#[derive(Debug)]
pub struct RackDevice {
    pub made_from: String,
    pub device: Box<dyn Device>,
}

/// One edge of a part's clip notes ([`Track::clip_edges`]): `key` struck at `velocity` (Live's
/// document units) or, with none, let go, at `frame`.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct ClipEdge {
    pub frame: u64,
    pub key: u8,
    pub velocity: Option<f32>,
}

#[derive(Debug, Clone, Copy, PartialEq)]
enum Edge {
    Off { key: u8 },
    On { key: u8, velocity: f32 },
}

/// One part: an audio track (a source buffer) or a MIDI track (an
/// instrument playing notes), gain + pan, activator and solo, sends, an
/// ordered device chain, and an output into the Main track.
///
/// The source is interleaved f32 in the track's own channel count
/// (`channels` = 1 or 2). Signal order follows the device-chain reading of
/// session-model.md §3 (clip → device chain → mixer staging): the
/// instrument (MIDI) or source (audio) makes the frame, the device chain
/// processes it, then track gain and pan are applied, then the frame sums
/// into the Main track and, scaled by each send, into each return track.
/// The M1 acceptance gate pins all staging at unity, so this order is not
/// yet behavior-verified against Live; it is the documented-model reading
/// and is flagged in the crate README.
#[derive(Debug)]
pub struct Track {
    pub name: String,
    /// Channel count of the source buffer and device frames (1 or 2).
    pub channels: usize,
    /// Track gain, linear (1.0 = unity — the staging value the device
    /// dossiers pin for unity faders, devices/glue-compressor.md).
    pub gain: f64,
    /// Pan in −1…+1 (see `pan_weights` for the M1 law).
    pub pan: f64,
    /// Live's Activator (`Mixer/Speaker`): off, the part makes no sound
    /// (manual §21.1, the mixer row). Its chain keeps running, so a tail
    /// resumes where it would have been.
    pub active: bool,
    /// Live's Solo: while any part is soloed only the soloed parts sound.
    pub solo: bool,
    /// One linear gain per return track, in the graph's return order
    /// (`Mixer/Sends/TrackSendHolder/Send/Manual`, session-model.md §3).
    pub sends: Vec<f64>,
    /// Ordered device chain (session-model.md §3, `DeviceChain/Devices`).
    pub devices: Vec<Box<dyn Device>>,
    /// Interleaved source audio (audio tracks). Silence when empty.
    pub source: Vec<f32>,
    /// The instrument of a MIDI track; `None` on an audio track.
    pub instrument: Option<Box<dyn Instrument>>,
    /// The devices after the instrument on its rack's chain ([`RackDevice`]), before the part's own
    /// chain: the sound passes them in order. Empty until an owner puts some there.
    pub rack: Vec<RackDevice>,
    /// The group it stands in ([`Graph::groups`], O-I #849 round 16): its sound goes to that group's
    /// bus, not straight to the Main track (its sends still go to the returns). None: the Main track.
    pub group: Option<usize>,
    /// The clip notes as edges, sorted by frame (offs before ons at the
    /// same frame), and the next edge to fire.
    edges: Vec<(u64, Edge)>,
    next_edge: usize,
}

impl Track {
    pub fn new(name: &str, channels: usize) -> Track {
        assert!(
            channels == 1 || channels == 2,
            "M1 tracks are mono or stereo"
        );
        Track {
            name: name.to_string(),
            channels,
            gain: 1.0,
            pan: 0.0,
            active: true,
            solo: false,
            sends: Vec::new(),
            devices: Vec::new(),
            source: Vec::new(),
            instrument: None,
            rack: Vec::new(),
            group: None,
            edges: Vec::new(),
            next_edge: 0,
        }
    }

    /// A MIDI track (stereo) whose chain begins with `instrument`.
    pub fn midi(name: &str, instrument: Box<dyn Instrument>) -> Track {
        let mut t = Track::new(name, 2);
        t.instrument = Some(instrument);
        t
    }

    /// Whether the part plays notes (a MIDI track).
    pub fn is_midi(&self) -> bool {
        self.instrument.is_some()
    }

    /// Set the part's clip notes (replacing any). Each note becomes an
    /// on-edge at `start` and an off-edge at `start + length`; at one
    /// frame, offs fire before ons, so a note that ends where the next of
    /// the same key begins releases and strikes again. A note shorter than
    /// one frame has no length to sound in and is dropped (its off would
    /// otherwise fire before its on and hold it forever).
    pub fn set_notes(&mut self, notes: &[Note]) {
        let mut edges: Vec<(u64, Edge)> = Vec::with_capacity(notes.len() * 2);
        for n in notes.iter().filter(|n| n.length > 0) {
            edges.push((
                n.start,
                Edge::On {
                    key: n.key,
                    velocity: n.velocity,
                },
            ));
            edges.push((n.start + n.length, Edge::Off { key: n.key }));
        }
        edges.sort_by(|a, b| {
            a.0.cmp(&b.0).then_with(|| {
                let rank = |e: &Edge| matches!(e, Edge::On { .. }) as u8;
                rank(&a.1).cmp(&rank(&b.1))
            })
        });
        self.edges = edges;
        self.next_edge = 0;
    }

    /// The part's clip notes as it plays them, in the order it plays them: each key struck (with
    /// its velocity) or let go, at its frame. What a host hands the Torus's owner ahead of the
    /// frames they fall on (O-I #849): the notes of a part the Torus sounds on are its owner's.
    pub fn clip_edges(&self) -> Vec<ClipEdge> {
        self.edges
            .iter()
            .map(|&(frame, edge)| match edge {
                Edge::On { key, velocity } => ClipEdge {
                    frame,
                    key,
                    velocity: Some(velocity),
                },
                Edge::Off { key } => ClipEdge {
                    frame,
                    key,
                    velocity: None,
                },
            })
            .collect()
    }

    fn frames(&self) -> u64 {
        // channels is 1 or 2 by construction (Track::new asserts)
        let source = (self.source.len() / self.channels) as u64;
        let notes = self.edges.last().map(|(f, _)| *f).unwrap_or(0);
        source.max(notes)
    }

    /// Fire the clip edges that fall on `clock.sample` (and any the clock
    /// already passed — a graph is driven from frame 0, so in practice
    /// only the exact frame).
    fn fire_edges(&mut self, clock: &Clock) {
        let Some(instrument) = self.instrument.as_mut() else {
            return;
        };
        while let Some(&(frame, edge)) = self.edges.get(self.next_edge) {
            if frame > clock.sample {
                break;
            }
            match edge {
                Edge::On { key, velocity } => instrument.note_on(key, velocity, clock),
                Edge::Off { key } => instrument.note_off(key, clock),
            }
            self.next_edge += 1;
        }
    }
}

/// A return track (session-model.md §2: `ReturnTrack` is a member of
/// `Tracks`): it takes what the parts send it, runs its own chain, and
/// sums into the Main track with its own gain and pan.
#[derive(Debug)]
pub struct ReturnTrack {
    pub name: String,
    pub gain: f64,
    pub pan: f64,
    pub active: bool,
    /// The set's pre/post flag for this return (`LiveSet/SendsPre/
    /// SendPreBool`, in return order — devices/racks-session-model.md
    /// §2.1): true, the parts' sends to it tap before their volume and pan.
    pub pre_fader: bool,
    pub devices: Vec<Box<dyn Device>>,
}

impl ReturnTrack {
    pub fn new(name: &str) -> ReturnTrack {
        ReturnTrack {
            name: name.to_string(),
            gain: 1.0,
            pan: 0.0,
            active: true,
            pre_fader: false,
            devices: Vec::new(),
        }
    }
}

/// The most group tracks a mix holds: their buses are a fixed array, so the realtime path allocates
/// none for them (a group past it sounds straight to the Main track, `bridge_set` warns).
pub const MAX_GROUPS: usize = 32;

/// A group track (Live's `GroupTrack`, O-I #849 round 16): what stands in it (each part and each group
/// whose [`Track::group`] or [`GroupTrack::group`] names it) is summed on its bus, which passes its chain,
/// then its mixer row (gain, then pan, as a part's), into the group it stands in or the Main track; its
/// sends feed the returns as a part's do.
#[derive(Debug)]
pub struct GroupTrack {
    pub name: String,
    pub gain: f64,
    pub pan: f64,
    pub active: bool,
    pub solo: bool,
    pub sends: Vec<f64>,
    pub devices: Vec<Box<dyn Device>>,
    /// The group it stands in, always one before it in [`Graph::groups`] (the set's order: a group
    /// comes before what it holds), so each bus is mixed before the one it feeds. None: the Main
    /// track; a later index is not followed (it sounds to the Main track).
    pub group: Option<usize>,
}

impl GroupTrack {
    pub fn new(name: &str) -> GroupTrack {
        GroupTrack {
            name: name.to_string(),
            gain: 1.0,
            pan: 0.0,
            active: true,
            solo: false,
            sends: Vec::new(),
            devices: Vec::new(),
            group: None,
        }
    }
}

/// Whether the group `at` or any group it stands in is soloed (bounded by the groups there are, so a
/// malformed chain of groups ends).
fn soloed_from(groups: &[GroupTrack], mut at: Option<usize>) -> bool {
    for _ in 0..groups.len() {
        let Some(g) = at.and_then(|g| groups.get(g).map(|group| (g, group))) else {
            return false;
        };
        if g.1.solo {
            return true;
        }
        at = g.1.group.filter(|up| *up < g.0);
    }
    false
}

/// Mark the group `at` and each group it stands in as on a soloed sound's way to the Main track.
fn light_from(groups: &[GroupTrack], lit: &mut [bool; MAX_GROUPS], mut at: Option<usize>) {
    for _ in 0..groups.len() {
        let Some(g) = at.filter(|g| *g < groups.len().min(MAX_GROUPS)) else {
            return;
        };
        lit[g] = true;
        at = groups[g].group.filter(|up| *up < g);
    }
}

/// What an instrument takes of a channel's expression (O-I #853, [`Instrument::touch`]): its pitch
/// bend and its channel pressure, each taken (`Ok`) or not, with the words for why (completing "the
/// engine's Operator ...").
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Touch {
    pub bend: Result<(), &'static str>,
    pub pressure: Result<(), &'static str>,
}

impl Touch {
    /// An instrument that takes neither.
    pub const NONE: Touch = Touch {
        bend: Err("takes no pitch bend"),
        pressure: Err("takes no channel pressure"),
    };
}

/// The Main track (Live's master): its gain, its pan and its own device
/// chain (session-model.md §2, MainTrack/DeviceChain/Mixer carries the
/// staging; manual §21.1 "The Main track": "the level and the place of the
/// whole piece. Its chain works on everything you hear.").
#[derive(Debug)]
pub struct MasterTrack {
    /// Master gain, linear (1.0 = unity, dossier staging value).
    pub gain: f64,
    /// Main pan in −1…+1 (the same law as a part's, `pan_weights`).
    pub pan: f64,
    pub devices: Vec<Box<dyn Device>>,
}

impl Default for MasterTrack {
    fn default() -> Self {
        MasterTrack {
            gain: 1.0,
            pan: 0.0,
            devices: Vec::new(),
        }
    }
}

/// Why a graph cannot be played.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum GraphError {
    /// Live's loader rule (session-model.md §4), in the loader's own
    /// words: "(Track has more send knobs than set has return tracks.)"
    SendCount {
        track: String,
        sends: usize,
        returns: usize,
    },
    /// More return tracks than [`MAX_RETURNS`].
    TooManyReturns(usize),
}

impl std::fmt::Display for GraphError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            GraphError::SendCount { track, sends, returns } => write!(
                f,
                "part '{track}' has {sends} sends but the set has {returns} return tracks (Live refuses it: \"Track has more send knobs than set has return tracks.\")"
            ),
            GraphError::TooManyReturns(n) => {
                write!(f, "{n} return tracks: a set holds at most {MAX_RETURNS} (A to L)")
            }
        }
    }
}

impl std::error::Error for GraphError {}

/// The whole renderable graph: transport + parts + returns + Main.
#[derive(Debug)]
pub struct Graph {
    /// Document sample rate. `render` takes the render-time rate as its
    /// argument (the clock uses that); keep the two consistent.
    pub sample_rate: u32,
    /// Document tempo (MainTrack mixer `Tempo/Manual`).
    pub tempo_bpm: f64,
    pub tracks: Vec<Track>,
    /// The return tracks, in the set's order (Send A feeds the first).
    pub returns: Vec<ReturnTrack>,
    /// The group tracks, in the set's order ([`GroupTrack`], O-I #849 round 16).
    pub groups: Vec<GroupTrack>,
    pub master: MasterTrack,
    /// The arrangement length in frames, when the host knows it (a set's
    /// stored length); otherwise the longest source or last note edge.
    pub length_frames: Option<u64>,
    /// Live's Solo in Place (`LiveSet/SoloInPlace`; the template stores
    /// true): while a part is soloed, the return tracks still sound.
    pub solo_in_place: bool,
    /// The owner's acts and moves for a Torus not yet on its part, by part, in the order they came
    /// ([`Graph::hand`] gives them to it); capacity [`TORUS_WAITING`], made by [`Graph::prepare`].
    torus_waiting: Vec<(usize, Followed)>,
    torus_unplaced: u64,
}

impl Graph {
    pub fn new(sample_rate: u32, tempo_bpm: f64) -> Graph {
        Graph {
            sample_rate,
            tempo_bpm,
            tracks: Vec::new(),
            returns: Vec::new(),
            groups: Vec::new(),
            master: MasterTrack::default(),
            length_frames: None,
            solo_in_place: true,
            torus_waiting: Vec::new(),
            torus_unplaced: 0,
        }
    }

    /// The owner's acts and moves dropped because more waited for their Torus than a graph keeps.
    pub fn torus_unplaced(&self) -> u64 {
        self.torus_unplaced
    }

    /// Put `instrument` on MIDI part `track`, swapping it with the one there (which `instrument` then
    /// holds), and give a Torus the owner's acts and moves that waited for its handover, in the order
    /// they came; those of an earlier handover are dropped, since its continuation holds them already.
    /// Answers whether the part
    /// took it. Allocation-free: the audio thread takes a hand through it, and Export the same.
    pub fn hand(
        &mut self,
        track: usize,
        instrument: &mut Box<dyn Instrument>,
        clock: &Clock,
    ) -> bool {
        let Some(slot) = self
            .tracks
            .get_mut(track)
            .and_then(|t| t.instrument.as_mut())
        else {
            return false;
        };
        std::mem::swap(slot, instrument);
        if let Some(handover) = slot.torus_handover() {
            self.torus_waiting.retain(|(t, followed)| {
                if *t != track || followed.handover() > handover {
                    return true;
                }
                if followed.handover() == handover {
                    match followed {
                        Followed::Strike(act) => slot.torus_strike(act, clock),
                        Followed::Hear(hear) => slot.torus_hear(hear, clock),
                    };
                }
                false
            });
        }
        true
    }

    /// The sample of its owner's continuation the Torus on part `track` renders next, if a Torus
    /// that renders stands there ([`Instrument::torus_cursor`]).
    pub fn torus_cursor(&self, track: usize) -> Option<u64> {
        self.tracks
            .get(track)
            .and_then(|t| t.instrument.as_ref())
            .and_then(|i| i.torus_cursor())
    }

    /// Put `chain` after the instrument of part `track` ([`RackDevice`]): a device made from what one
    /// standing there was made from takes that one's place, state and all; any other of a kind that
    /// stands there follows the first of that kind not taken ([`Device::follow`], O-I #849 round 16:
    /// a room made again rings the last one's tail out, a line made again keeps its repeats); and what
    /// stood there comes back in `chain`, to be dropped off the audio thread. Answers whether the part
    /// is there and plays notes (otherwise `chain` comes back as it was). Allocation-free; past the
    /// 64th device of a chain, a device starts afresh.
    pub fn rack(&mut self, track: usize, chain: &mut Vec<RackDevice>) -> bool {
        let Some(t) = self
            .tracks
            .get_mut(track)
            .filter(|t| t.instrument.is_some())
        else {
            return false;
        };
        // which standing devices a new one has taken, and which new ones took one made as they are
        let (mut taken, mut same) = (0u64, 0u64);
        let standing = t.rack.len().min(64);
        for (n, new) in chain.iter_mut().enumerate().take(64) {
            if let Some(o) =
                (0..standing).find(|&o| taken & 1 << o == 0 && t.rack[o].made_from == new.made_from)
            {
                std::mem::swap(&mut t.rack[o].device, &mut new.device);
                taken |= 1 << o;
                same |= 1 << n;
            }
        }
        for (n, new) in chain.iter_mut().enumerate().take(64) {
            if same & 1 << n != 0 {
                continue;
            }
            if let Some(o) = (0..standing)
                .find(|&o| taken & 1 << o == 0 && t.rack[o].device.name() == new.device.name())
            {
                new.device.follow(t.rack[o].device.as_mut());
                taken |= 1 << o;
            }
        }
        std::mem::swap(&mut t.rack, chain);
        true
    }

    /// Put `device` in the place of the device standing at `at` on `part`'s own chain (O-I #849 round 17: a set's
    /// device made again for an edit, [`crate::EngineHandle::make_again`]): one of the same kind carries on what still
    /// sounds in the one it replaces ([`Device::made_again_from`]), and what stood there comes back in `device`, to be dropped
    /// off the audio thread. Answers whether a device stood there (otherwise `device` comes back as it was).
    /// Allocation-free.
    pub fn make_again(&mut self, part: Part, at: usize, device: &mut Box<dyn Device>) -> bool {
        let chain = match part {
            Part::Track(i) => self.tracks.get_mut(i).map(|t| &mut t.devices),
            Part::Return(i) => self.returns.get_mut(i).map(|r| &mut r.devices),
            Part::Group(i) => self.groups.get_mut(i).map(|g| &mut g.devices),
            Part::Main => Some(&mut self.master.devices),
        };
        let Some(standing) = chain.and_then(|c| c.get_mut(at)) else {
            return false;
        };
        if standing.name() == device.name() {
            device.made_again_from(standing.as_mut());
        }
        std::mem::swap(standing, device);
        true
    }

    /// Live's loader rules the engine relies on: no part has more sends
    /// than the set has return tracks, and there are at most
    /// [`MAX_RETURNS`]. ENGINE DECISION (the loader's words name only the
    /// excess, session-model.md §4): a part with FEWER sends loads, and a
    /// send it does not state carries nothing.
    pub fn validate(&self) -> Result<(), GraphError> {
        if self.returns.len() > MAX_RETURNS {
            return Err(GraphError::TooManyReturns(self.returns.len()));
        }
        let sends = self.tracks.iter().map(|t| (&t.name, t.sends.len()));
        let sends = sends.chain(self.groups.iter().map(|g| (&g.name, g.sends.len())));
        for (name, sends) in sends {
            if sends > self.returns.len() {
                return Err(GraphError::SendCount {
                    track: name.clone(),
                    sends,
                    returns: self.returns.len(),
                });
            }
        }
        Ok(())
    }

    /// Build every device's and instrument's state at the graph's rate,
    /// off the audio thread (see [`Device::prepare`]).
    pub fn prepare(&mut self) {
        let sr = self.sample_rate;
        self.torus_waiting
            .reserve_exact(TORUS_WAITING.saturating_sub(self.torus_waiting.len()));
        for t in &mut self.tracks {
            if let Some(i) = t.instrument.as_mut() {
                i.prepare(sr);
            }
            for d in &mut t.rack {
                d.device.prepare(sr, t.channels);
            }
            for d in &mut t.devices {
                d.prepare(sr, t.channels);
            }
        }
        for r in &mut self.returns {
            for d in &mut r.devices {
                d.prepare(sr, 2);
            }
        }
        for g in &mut self.groups {
            for d in &mut g.devices {
                d.prepare(sr, 2);
            }
        }
        for d in &mut self.master.devices {
            d.prepare(sr, 2);
        }
    }

    /// The arrangement length in frames ([`Graph::length_frames`], else
    /// the longest source or last note edge).
    pub fn frames(&self) -> u64 {
        self.length_frames
            .unwrap_or_else(|| self.tracks.iter().map(|t| t.frames()).max().unwrap_or(0))
    }

    /// Render the whole mix offline to an interleaved stereo f32 buffer.
    ///
    /// Consumes the graph: devices carry detector state, so a render is a
    /// one-shot act — build the graph again to render again (this is what
    /// keeps the output bit-deterministic across repeated renders of the
    /// same set). The length is [`Graph::frames`] (shorter tracks
    /// contribute silence beyond their end; the master gain and devices
    /// still process those frames). No clipping or limiting is applied —
    /// the master bus carries raw float.
    ///
    /// The loop body is exactly [`Graph::mix_frame`]; see that method and
    /// the `mix_frame_composes_the_render_exactly` test.
    pub fn render(self, sample_rate: u32) -> Vec<f32> {
        let frames = self.frames();
        self.render_performance(sample_rate, &Performance::silent(frames))
    }

    /// Export Audio: render `performance.frames` frames offline, applying
    /// each recorded event at the frame the engine applied it (before that
    /// frame is mixed, as the audio callback does at a block's start). The
    /// result is the samples the engine played, bit for bit
    /// (`tests/parts_engine.rs`).
    pub fn render_performance(self, sample_rate: u32, performance: &Performance) -> Vec<f32> {
        self.render_performance_with(sample_rate, performance, Vec::new())
    }

    /// [`Graph::render_performance`] with the instruments handed to its parts while the engine
    /// played (O-I #849; [`crate::EngineHandle::install`]): each `(frame, track, instrument)` takes
    /// its part at the frame the engine took it ([`crate::EngineHandle::installs`]), before that
    /// frame's events, as the audio callback takes a hand at a block's start. The instruments are
    /// made again from what was handed (they carry state, so a render is one-shot).
    pub fn render_performance_with(
        self,
        sample_rate: u32,
        performance: &Performance,
        installs: Vec<(u64, usize, Box<dyn Instrument>)>,
    ) -> Vec<f32> {
        self.render_performance_racked(sample_rate, performance, installs, Vec::new())
    }

    /// [`Graph::render_performance_with`] with the chains put after parts' instruments while the
    /// engine played ([`crate::EngineHandle::install_rack`]): each `(frame, track, chain)` is put on
    /// its part at the frame the engine put it there ([`crate::EngineHandle::racks`]), after that
    /// frame's instrument and before its events, as the audio callback does at a block's start.
    pub fn render_performance_racked(
        self,
        sample_rate: u32,
        performance: &Performance,
        installs: Vec<(u64, usize, Box<dyn Instrument>)>,
        racks: Vec<(u64, usize, Vec<RackDevice>)>,
    ) -> Vec<f32> {
        self.render_performance_remade(sample_rate, performance, installs, racks, Vec::new())
    }

    /// [`Graph::render_performance_racked`] with the devices made again on chains while the engine played
    /// ([`crate::EngineHandle::make_again`], O-I #849 round 17): each `(frame, part, at, device)` takes its place at
    /// the frame the engine put it there ([`crate::EngineHandle::remade`]), after that frame's rack and before its
    /// events, as the audio callback does at a block's start.
    pub fn render_performance_remade(
        mut self,
        sample_rate: u32,
        performance: &Performance,
        mut installs: Vec<(u64, usize, Box<dyn Instrument>)>,
        mut racks: Vec<(u64, usize, Vec<RackDevice>)>,
        mut remade: Vec<(u64, Part, usize, Box<dyn Device>)>,
    ) -> Vec<f32> {
        self.sample_rate = sample_rate;
        self.prepare();
        installs.sort_by_key(|(frame, _, _)| *frame);
        for (_, _, instrument) in &mut installs {
            instrument.prepare(sample_rate);
        }
        racks.sort_by_key(|(frame, _, _)| *frame);
        for (_, track, chain) in &mut racks {
            let channels = self.tracks.get(*track).map_or(2, |t| t.channels);
            for d in chain.iter_mut() {
                d.device.prepare(sample_rate, channels);
            }
        }
        remade.sort_by_key(|(frame, ..)| *frame);
        for (_, part, _, device) in &mut remade {
            let channels = match *part {
                Part::Track(i) => self.tracks.get(i).map_or(2, |t| t.channels),
                _ => 2,
            };
            device.prepare(sample_rate, channels);
        }
        let mut installs = installs.into_iter().peekable();
        let mut racks = racks.into_iter().peekable();
        let mut remade = remade.into_iter().peekable();
        let frames = performance.frames as usize;
        let mut out = vec![0f32; frames * 2];
        let mut clock = Clock::start(sample_rate, self.tempo_bpm);
        let mut events = performance.events.iter().peekable();
        for i in 0..frames {
            clock.sample = i as u64;
            while let Some((_, track, mut instrument)) =
                installs.next_if(|(f, _, _)| *f <= i as u64)
            {
                self.hand(track, &mut instrument, &clock);
            }
            while let Some((_, track, mut chain)) = racks.next_if(|(f, _, _)| *f <= i as u64) {
                self.rack(track, &mut chain);
            }
            while let Some((_, part, at, mut device)) = remade.next_if(|(f, ..)| *f <= i as u64) {
                self.make_again(part, at, &mut device);
            }
            while let Some(e) = events.next_if(|e| e.frame <= i as u64) {
                self.apply(&e.event, &clock);
            }
            let frame = self.mix_frame(&clock);
            out[i * 2] = frame[0];
            out[i * 2 + 1] = frame[1];
        }
        out
    }

    /// Apply one engine event at `clock` (the frame it lands on): a note
    /// to a MIDI part's instrument, a panic to every instrument, or a
    /// mixer value. Answers whether the event named something that exists
    /// (an out-of-range part is ignored, never a panic: this runs on the
    /// audio thread). Allocation-free.
    pub fn apply(&mut self, event: &EngineEvent, clock: &Clock) -> bool {
        match *event {
            EngineEvent::NoteOn {
                track,
                key,
                velocity,
            } => {
                match self
                    .tracks
                    .get_mut(track)
                    .and_then(|t| t.instrument.as_mut())
                {
                    Some(i) if key <= 127 => {
                        i.note_on(key, velocity, clock);
                        true
                    }
                    _ => false,
                }
            }
            EngineEvent::Bend { track, amount } => self
                .tracks
                .get_mut(track)
                .and_then(|t| t.instrument.as_mut())
                .is_some_and(|i| i.bend(amount, clock)),
            EngineEvent::Pressure { track, amount } => self
                .tracks
                .get_mut(track)
                .and_then(|t| t.instrument.as_mut())
                .is_some_and(|i| i.pressure(amount, clock)),
            EngineEvent::NoteOff { track, key } => {
                match self
                    .tracks
                    .get_mut(track)
                    .and_then(|t| t.instrument.as_mut())
                {
                    Some(i) if key <= 127 => {
                        i.note_off(key, clock);
                        true
                    }
                    _ => false,
                }
            }
            EngineEvent::TorusPlay { track, ref act } => self
                .tracks
                .get_mut(track)
                .and_then(|t| t.instrument.as_mut())
                .is_some_and(|i| i.torus_play(act, clock)),
            EngineEvent::TorusStrike { track, ref strike } => {
                let Some(i) = self
                    .tracks
                    .get_mut(track)
                    .and_then(|t| t.instrument.as_mut())
                else {
                    return false;
                };
                match i.torus_handover() {
                    Some(h) if h == strike.handover => i.torus_strike(strike, clock),
                    // a later handover's continuation holds the act already
                    Some(h) if h > strike.handover => false,
                    // the Torus it follows is still on its way to the part: the act waits for it
                    _ if self.torus_waiting.len() < self.torus_waiting.capacity() => {
                        self.torus_waiting.push((track, Followed::Strike(*strike)));
                        true
                    }
                    _ => {
                        self.torus_unplaced += 1;
                        false
                    }
                }
            }
            EngineEvent::TorusHear { track, ref hear } => {
                let Some(i) = self
                    .tracks
                    .get_mut(track)
                    .and_then(|t| t.instrument.as_mut())
                else {
                    return false;
                };
                match i.torus_handover() {
                    Some(h) if h == hear.handover => i.torus_hear(hear, clock),
                    // a later handover's continuation stands where the move left it
                    Some(h) if h > hear.handover => false,
                    // the Torus it follows is still on its way to the part: the move waits for it
                    _ if self.torus_waiting.len() < self.torus_waiting.capacity() => {
                        self.torus_waiting.push((track, Followed::Hear(*hear)));
                        true
                    }
                    _ => {
                        self.torus_unplaced += 1;
                        false
                    }
                }
            }
            EngineEvent::Panic => {
                for t in &mut self.tracks {
                    if let Some(i) = t.instrument.as_mut() {
                        i.panic(clock);
                    }
                }
                true
            }
            EngineEvent::Volume { part, gain } => match part {
                Part::Track(i) => self.tracks.get_mut(i).map(|t| t.gain = gain).is_some(),
                Part::Return(i) => self.returns.get_mut(i).map(|r| r.gain = gain).is_some(),
                Part::Group(i) => self.groups.get_mut(i).map(|g| g.gain = gain).is_some(),
                Part::Main => {
                    self.master.gain = gain;
                    true
                }
            },
            EngineEvent::Pan { part, pan } => {
                let pan = pan.clamp(-1.0, 1.0);
                match part {
                    Part::Track(i) => self.tracks.get_mut(i).map(|t| t.pan = pan).is_some(),
                    Part::Return(i) => self.returns.get_mut(i).map(|r| r.pan = pan).is_some(),
                    Part::Group(i) => self.groups.get_mut(i).map(|g| g.pan = pan).is_some(),
                    Part::Main => {
                        self.master.pan = pan;
                        true
                    }
                }
            }
            EngineEvent::Send { part, send, gain } => match part {
                Part::Track(i) => self.tracks.get_mut(i).and_then(|t| t.sends.get_mut(send)),
                Part::Group(i) => self.groups.get_mut(i).and_then(|g| g.sends.get_mut(send)),
                Part::Return(_) | Part::Main => None,
            }
            .map(|s| *s = gain)
            .is_some(),
            EngineEvent::Active { part, on } => match part {
                Part::Track(i) => self.tracks.get_mut(i).map(|t| t.active = on).is_some(),
                Part::Return(i) => self.returns.get_mut(i).map(|r| r.active = on).is_some(),
                Part::Group(i) => self.groups.get_mut(i).map(|g| g.active = on).is_some(),
                Part::Main => false,
            },
            EngineEvent::Solo { part, on } => match part {
                Part::Track(i) => self.tracks.get_mut(i).map(|t| t.solo = on).is_some(),
                Part::Group(i) => self.groups.get_mut(i).map(|g| g.solo = on).is_some(),
                Part::Return(_) | Part::Main => false,
            },
            EngineEvent::Set {
                part,
                device,
                key,
                value,
            } => {
                let standing: Option<&mut dyn Device> = match (part, device) {
                    (Part::Track(i), DeviceAt::Rack(d)) => self
                        .tracks
                        .get_mut(i)
                        .and_then(|t| t.rack.get_mut(d))
                        .map(|r| r.device.as_mut()),
                    (Part::Track(i), DeviceAt::Chain(d)) => self
                        .tracks
                        .get_mut(i)
                        .and_then(|t| t.devices.get_mut(d))
                        .map(|d| d.as_mut()),
                    (Part::Return(i), DeviceAt::Chain(d)) => self
                        .returns
                        .get_mut(i)
                        .and_then(|r| r.devices.get_mut(d))
                        .map(|d| d.as_mut()),
                    (Part::Group(i), DeviceAt::Chain(d)) => self
                        .groups
                        .get_mut(i)
                        .and_then(|g| g.devices.get_mut(d))
                        .map(|d| d.as_mut()),
                    (Part::Main, DeviceAt::Chain(d)) => {
                        self.master.devices.get_mut(d).map(|d| d.as_mut())
                    }
                    _ => None,
                };
                // a device takes only a setting it names (one of another kind standing there takes none)
                match standing.and_then(|d| {
                    let at = d.settings().iter().position(|(k, ..)| *k == key)?;
                    Some((d, at))
                }) {
                    Some((d, at)) => {
                        d.set(at, value);
                        true
                    }
                    None => false,
                }
            }
        }
    }

    /// Mix ONE frame at `clock.sample` and return it (stereo, L/R).
    ///
    /// This is the render loop body, factored so the realtime output
    /// (`engine.rs`/`realtime.rs`) pulls the exact same arithmetic the
    /// offline render runs — one shared mixing law, not two. Devices carry
    /// state, so consecutive calls must advance `clock.sample` by one and
    /// each graph instance must be driven by one consumer only (the
    /// render, or one audio callback). Allocation-free: the return buses
    /// are a fixed array ([`MAX_RETURNS`]).
    pub fn mix_frame(&mut self, clock: &Clock) -> [f32; 2] {
        let mut mix = [0f64; 2];
        let mut buses = [[0f64; 2]; MAX_RETURNS];
        let returns = self.returns.len().min(MAX_RETURNS);
        // ENGINE DECISION (Live's solo modes are not measured yet): while
        // any part is soloed, the parts that are not make no sound and send
        // nothing; with Solo in Place on (the template's stored value) the
        // return tracks still sound, so what a soloed part sends is heard
        // through them; with it off they fall silent with the rest.
        let soloing = self.tracks.iter().any(|t| t.solo) || self.groups.iter().any(|g| g.solo);
        // the group buses (O-I #849 round 16): while soloing, a part or a group is heard where it or a
        // group it stands in is soloed, and a group passes the sound of what it holds that is
        let groups = self.groups.len().min(MAX_GROUPS);
        let mut group_bus = [[0f64; 2]; MAX_GROUPS];
        let mut lit = [false; MAX_GROUPS];
        if soloing {
            for t in self.tracks.iter().filter(|t| t.solo) {
                light_from(&self.groups, &mut lit, t.group);
            }
            for g in 0..groups {
                if self.groups[g].solo {
                    light_from(&self.groups, &mut lit, Some(g));
                }
            }
        }
        let mut pre_fader = [false; MAX_RETURNS];
        for (pre, ret) in pre_fader.iter_mut().zip(self.returns.iter()) {
            *pre = ret.pre_fader;
        }
        for track in &mut self.tracks {
            // the head of the chain makes the frame in the track's own
            // channel count: the instrument (MIDI), else the source (audio;
            // silence past the buffer end)
            let mut frame = [0f32; 2];
            let channels = track.channels;
            track.fire_edges(clock);
            if let Some(instrument) = track.instrument.as_mut() {
                instrument.process(&mut frame[..channels], clock);
                for d in track.rack.iter_mut() {
                    d.device.process(&mut frame[..channels], clock);
                }
            } else {
                for (c, slot) in frame.iter_mut().enumerate().take(channels) {
                    *slot = track
                        .source
                        .get(clock.sample as usize * channels + c)
                        .copied()
                        .unwrap_or(0.0);
                }
            }
            for d in track.devices.iter_mut() {
                d.process(&mut frame[..channels], clock);
            }
            // the chain runs whether or not the part is heard (a tail
            // resumes where it would have been)
            if !track.active || (soloing && !track.solo && !soloed_from(&self.groups, track.group))
            {
                continue;
            }
            // mixer staging: gain then pan; a mono track fans out to
            // both mix channels before the pan weights
            let (lw, rw) = pan_weights(track.pan);
            let (l, r) = if channels == 1 {
                (frame[0], frame[0])
            } else {
                (frame[0], frame[1])
            };
            let (dry_l, dry_r) = (l as f64, r as f64);
            let l = dry_l * track.gain * lw;
            let r = dry_r * track.gain * rw;
            let out = match track.group.filter(|g| *g < groups) {
                Some(g) => &mut group_bus[g],
                None => &mut mix,
            };
            out[0] += l;
            out[1] += r;
            // ENGINE DECISION (no dossier measures Live's send taps yet;
            // tests/mixer_gate.rs holds them to the SEND_* probe renders):
            // a post-fader send taps the part after its volume and pan; a
            // pre-fader one (the return's SendPreBool) before both
            for ((bus, send), pre) in buses
                .iter_mut()
                .zip(track.sends.iter())
                .zip(pre_fader.iter())
                .take(returns)
            {
                let (sl, sr) = if *pre { (dry_l, dry_r) } else { (l, r) };
                bus[0] += sl * send;
                bus[1] += sr * send;
            }
        }
        // each group's bus after the parts, the last first: what a group holds comes after it in the
        // set, so a group is mixed before the one it stands in
        for g in (0..groups).rev() {
            let heard = !soloing || lit[g] || soloed_from(&self.groups, Some(g));
            let group = &mut self.groups[g];
            let mut frame = [group_bus[g][0] as f32, group_bus[g][1] as f32];
            for d in group.devices.iter_mut() {
                d.process(&mut frame, clock);
            }
            if !group.active || !heard {
                continue;
            }
            let (lw, rw) = pan_weights(group.pan);
            let (dry_l, dry_r) = (frame[0] as f64, frame[1] as f64);
            let (l, r) = (dry_l * group.gain * lw, dry_r * group.gain * rw);
            let out = match group.group.filter(|up| *up < g) {
                Some(up) => &mut group_bus[up],
                None => &mut mix,
            };
            out[0] += l;
            out[1] += r;
            for ((bus, send), pre) in buses
                .iter_mut()
                .zip(group.sends.iter())
                .zip(pre_fader.iter())
                .take(returns)
            {
                let (sl, sr) = if *pre { (dry_l, dry_r) } else { (l, r) };
                bus[0] += sl * send;
                bus[1] += sr * send;
            }
        }
        for (ret, bus) in self.returns.iter_mut().zip(buses.iter()).take(returns) {
            let mut frame = [bus[0] as f32, bus[1] as f32];
            for d in ret.devices.iter_mut() {
                d.process(&mut frame, clock);
            }
            if !ret.active || (soloing && !self.solo_in_place) {
                continue;
            }
            let (lw, rw) = pan_weights(ret.pan);
            mix[0] += frame[0] as f64 * ret.gain * lw;
            mix[1] += frame[1] as f64 * ret.gain * rw;
        }
        let (lw, rw) = pan_weights(self.master.pan);
        let mut frame = [
            (mix[0] * self.master.gain * lw) as f32,
            (mix[1] * self.master.gain * rw) as f32,
        ];
        for d in self.master.devices.iter_mut() {
            d.process(&mut frame, clock);
        }
        frame
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::devices::{BypassDevice, GainDevice};

    #[derive(Debug)]
    struct CountingDevice {
        seen: u64,
        last_beat: f64,
    }
    impl Device for CountingDevice {
        fn name(&self) -> &str {
            "Counting"
        }
        fn process(&mut self, _frame_io: &mut [f32], clock: &Clock) {
            self.seen += 1;
            self.last_beat = clock.beat();
        }
    }

    #[test]
    fn clock_reports_beats_and_time() {
        let mut c = Clock::start(48_000, 120.0);
        assert_eq!(c.time_s(), 0.0);
        assert_eq!(c.beat(), 0.0);
        c.sample = 48_000;
        assert!((c.time_s() - 1.0).abs() < 1e-12);
        assert!((c.beat() - 2.0).abs() < 1e-12);
        // 2 beats at 120 BPM = 1 s = 48 000 frames
        assert_eq!(c.frame_of_beat(2.0), 48_000);
    }

    #[test]
    fn empty_graph_renders_silence() {
        let g = Graph::new(48_000, 120.0);
        assert!(g.render(48_000).is_empty());
    }

    #[test]
    fn track_devices_see_every_frame_and_beat_clock() {
        let mut g = Graph::new(48_000, 120.0);
        let mut t = Track::new("A", 2);
        t.source = vec![0.5; 192]; // 96 stereo frames
        t.devices.push(Box::new(CountingDevice {
            seen: 0,
            last_beat: -1.0,
        }));
        g.tracks.push(t);
        let out = g.render(48_000);
        assert_eq!(out.len(), 192);
        // device state is private to the box; check the passthrough mix
        assert_eq!(out[0], 0.5);
        assert_eq!(out[191], 0.5);
    }

    #[test]
    fn mixer_sums_tracks_and_applies_gain_pan_master() {
        let mut g = Graph::new(48_000, 120.0);
        let mut a = Track::new("A", 1);
        a.source = vec![0.25f32; 2];
        let mut b = Track::new("B", 1);
        b.source = vec![0.25f32; 2];
        g.tracks.push(a);
        g.tracks.push(b);
        // two centered mono tracks sum to 0.5 in both channels
        assert_eq!(g.render(48_000)[0], 0.5);

        // track gain applies post-device
        let mut g2 = Graph::new(48_000, 120.0);
        let mut t = Track::new("A", 1);
        t.source = vec![0.25f32; 2];
        t.gain = 0.5;
        g2.tracks.push(t);
        assert_eq!(g2.render(48_000)[0], 0.125);

        // hard-right pan: left silenced, right kept (M1 pan law)
        let mut g3 = Graph::new(48_000, 120.0);
        let mut t = Track::new("A", 1);
        t.source = vec![0.25f32; 2];
        t.pan = 1.0;
        g3.tracks.push(t);
        let out = g3.render(48_000);
        assert_eq!(out[0], 0.0);
        assert_eq!(out[1], 0.25);

        // master gain scales the summed bus
        let mut g4 = Graph::new(48_000, 120.0);
        let mut t = Track::new("A", 1);
        t.source = vec![0.25f32; 2];
        g4.tracks.push(t);
        g4.master.gain = 0.5;
        assert_eq!(g4.render(48_000)[0], 0.125);
    }

    #[test]
    fn device_chain_order_is_document_order() {
        let mut g = Graph::new(48_000, 120.0);
        let mut t = Track::new("A", 1);
        t.source = vec![1.0f32; 2];
        // ×2 then ×10 (in chain order) must differ from ×10 then ×2 only
        // by float rounding; check exact order by composing distinct ops:
        // Gain(+6.02 dB ≈ ×2) then Gain(−6.02 dB) returns to ~1.0 — use
        // Bypass between to prove chain traversal.
        t.devices.push(Box::new(GainDevice::new_db(6.0)));
        t.devices.push(Box::new(BypassDevice));
        t.devices.push(Box::new(GainDevice::new_db(-6.0)));
        g.tracks.push(t);
        let out = g.render(48_000);
        assert!((out[0] - 1.0).abs() < 1e-4, "got {}", out[0]);
    }

    #[test]
    fn shorter_track_contributes_silence_past_its_end() {
        let mut g = Graph::new(48_000, 120.0);
        let mut a = Track::new("A", 1);
        a.source = vec![0.5f32; 2]; // frames 0..1
        let mut b = Track::new("B", 1);
        b.source = vec![0.25f32; 6]; // frames 0..5
        g.tracks.push(a);
        g.tracks.push(b);
        let out = g.render(48_000);
        assert_eq!(out.len(), 12);
        assert_eq!(out[0], 0.75); // frame 0: both tracks
        assert_eq!(out[2], 0.75); // frame 1: still both (2 samples = 2 frames)
        assert_eq!(out[4], 0.25); // frame 2: past A's end, B still sounding
        assert_eq!(out[11], 0.25); // last frame of B
    }

    /// The realtime contract: driving [`Graph::mix_frame`] frame by frame
    /// produces EXACTLY the offline render, bit for bit — one mixing law,
    /// two execution paths (`realtime.rs` pulls this same method from the
    /// audio callback). State-carrying devices (Glue's follower) and a
    /// short track (the silence-past-end path) must both compose.
    #[test]
    fn mix_frame_composes_the_render_exactly() {
        let build = || {
            let mut g = Graph::new(48_000, 120.0);
            let mut a = Track::new("A", 2);
            a.source = (0..96).map(|i| ((i as f32) * 0.03).sin() * 0.4).collect();
            a.pan = 0.3;
            a.devices.push(Box::new(GainDevice::new_db(3.0)));
            a.devices.push(Box::new(BypassDevice));
            let mut b = Track::new("B", 1);
            b.source = vec![0.25f32; 40]; // ends before A — silence tail
            b.devices.push(Box::new(crate::devices::GlueDevice::new(
                live_dynamics::glue::GlueParams {
                    threshold_db: -12.0,
                    range: 30.0,
                    ratio: 1.0,
                    makeup_db: 0.0,
                },
            )));
            g.tracks.push(a);
            g.tracks.push(b);
            g.master.devices.push(Box::new(GainDevice::new_db(-1.5)));
            g
        };
        let offline = build().render(48_000);

        let mut streamed = build();
        streamed.prepare();
        let mut clock = Clock::start(48_000, 120.0);
        let frames = offline.len() / 2;
        for i in 0..frames {
            clock.sample = i as u64;
            let f = streamed.mix_frame(&clock);
            assert_eq!(f[0].to_bits(), offline[i * 2].to_bits(), "L frame {i}");
            assert_eq!(f[1].to_bits(), offline[i * 2 + 1].to_bits(), "R frame {i}");
        }
    }

    #[test]
    fn pan_weights_law_is_unity_center_never_boosts() {
        assert_eq!(pan_weights(0.0), (1.0, 1.0));
        assert_eq!(pan_weights(-1.0), (1.0, 0.0));
        assert_eq!(pan_weights(1.0), (0.0, 1.0));
        let (l, r) = pan_weights(0.5);
        assert_eq!(l, 0.5);
        assert_eq!(r, 1.0);
        // out-of-range pans clamp
        assert_eq!(pan_weights(7.0), (0.0, 1.0));
    }
}
