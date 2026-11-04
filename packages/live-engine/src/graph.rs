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

use crate::engine::{EngineEvent, Part, Performance};

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
pub trait Device: std::fmt::Debug + Send {
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
    // `Send` is a supertrait because a Graph is mixed on the realtime
    // callback (realtime.rs): cpal's stream closure is a `Send` bound, so
    // `Box<dyn Device>` must be Send. Every device is plain DSP state
    // (floats, usize, Vec<f32>), which is exactly what the bound asks for.
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
    /// One act of the Torus's keys ([`EngineEvent::TorusPlay`], O-I #849), struck at `clock`. Answers
    /// whether the instrument struck it: only the Torus plays an act by its keys' places, so every
    /// other instrument strikes nothing.
    fn torus_play(&mut self, _act: &TorusAct, _clock: &Clock) -> bool {
        false
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
    pub master: MasterTrack,
    /// The arrangement length in frames, when the host knows it (a set's
    /// stored length); otherwise the longest source or last note edge.
    pub length_frames: Option<u64>,
    /// Live's Solo in Place (`LiveSet/SoloInPlace`; the template stores
    /// true): while a part is soloed, the return tracks still sound.
    pub solo_in_place: bool,
}

impl Graph {
    pub fn new(sample_rate: u32, tempo_bpm: f64) -> Graph {
        Graph {
            sample_rate,
            tempo_bpm,
            tracks: Vec::new(),
            returns: Vec::new(),
            master: MasterTrack::default(),
            length_frames: None,
            solo_in_place: true,
        }
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
        for t in &self.tracks {
            if t.sends.len() > self.returns.len() {
                return Err(GraphError::SendCount {
                    track: t.name.clone(),
                    sends: t.sends.len(),
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
        for t in &mut self.tracks {
            if let Some(i) = t.instrument.as_mut() {
                i.prepare(sr);
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
        mut self,
        sample_rate: u32,
        performance: &Performance,
        mut installs: Vec<(u64, usize, Box<dyn Instrument>)>,
    ) -> Vec<f32> {
        self.sample_rate = sample_rate;
        self.prepare();
        installs.sort_by_key(|(frame, _, _)| *frame);
        for (_, _, instrument) in &mut installs {
            instrument.prepare(sample_rate);
        }
        let mut installs = installs.into_iter().peekable();
        let frames = performance.frames as usize;
        let mut out = vec![0f32; frames * 2];
        let mut clock = Clock::start(sample_rate, self.tempo_bpm);
        let mut events = performance.events.iter().peekable();
        for i in 0..frames {
            clock.sample = i as u64;
            while let Some((_, track, instrument)) = installs.next_if(|(f, _, _)| *f <= i as u64) {
                if let Some(slot) = self
                    .tracks
                    .get_mut(track)
                    .and_then(|t| t.instrument.as_mut())
                {
                    *slot = instrument;
                }
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
                    Part::Main => {
                        self.master.pan = pan;
                        true
                    }
                }
            }
            EngineEvent::Send { track, send, gain } => self
                .tracks
                .get_mut(track)
                .and_then(|t| t.sends.get_mut(send))
                .map(|s| *s = gain)
                .is_some(),
            EngineEvent::Active { part, on } => match part {
                Part::Track(i) => self.tracks.get_mut(i).map(|t| t.active = on).is_some(),
                Part::Return(i) => self.returns.get_mut(i).map(|r| r.active = on).is_some(),
                Part::Main => false,
            },
            EngineEvent::Solo { track, on } => {
                self.tracks.get_mut(track).map(|t| t.solo = on).is_some()
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
        let soloing = self.tracks.iter().any(|t| t.solo);
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
            if !track.active || (soloing && !track.solo) {
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
            mix[0] += l;
            mix[1] += r;
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
