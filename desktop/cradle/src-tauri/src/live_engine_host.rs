//! The desktop's audio path for Live (O-I #849; manual §21.1 Rules: "Every
//! part sounds in one engine, from the first device of its chain to the Main
//! track. What Export Audio renders is what you heard, sample for sample.").
//!
//! The candidate hosts `live-engine` here: a set document is bridged into
//! the engine's graph (its parts with their chains and mixer rows, MIDI
//! parts with their instruments and notes, the return tracks, the Main
//! track), the engine's audio half plays on the default output, and its
//! control half answers the owner operations the UI calls:
//!
//! | command | what it does |
//! | --- | --- |
//! | `live_engine_open {path}` | bridge the set and make its engine (nothing sounds yet); answers the mixer reading |
//! | `live_engine_play` | the engine plays on the default output from where it stands |
//! | `live_engine_stop` | the output stops; the engine and what it played are kept |
//! | `live_engine_send {event}` | one note, Torus act, Panic or mixer move, applied at the next block, or a set's device made again from what the set now stores (`device`: an edit of it followed); answers the mixer reading |
//! | `live_engine_torus {lease, track, sha256, notes?, effects?}` | the Torus its owner handed over (kept by the kernel under the field's lease) sounds on the part, which follows that owner from then on, through its effects |
//! | `live_engine_torus_effects {effects}` | the Torus's effects as the frame now holds them, and its level before them, on the part following its owner |
//! | `live_engine_mixer` | the mixer as the engine applied it |
//! | `live_engine_export` | Export Audio: what the engine played, rendered offline, as a 32-bit float WAV, into the file the person chooses in the host's own save dialog |
//!
//! The renderer never names where Export Audio's file goes: the host asks the
//! person (a native save dialog; File › Export Audio… opens the same one),
//! a cancelled dialog is refused in words, and the file is written by the
//! kernel's Live owner (`live_set_owner.rs` `Kernel::live_audio_export`),
//! which records its receipt — this host writes no file. The render is of
//! the set as the engine bridged it at Play, so a mixer write made while it
//! played (the set's own, followed into the engine) is heard where it was
//! applied and nowhere earlier.
//!
//! The Torus (O-I #849, with QL's K8 node: the `k8` feature): its owner
//! hands it over (QL's `torus-native`), the kernel keeps the document under
//! the field's lease and relays the page only its digest, and
//! `live_engine_torus` puts the node made from it on a MIDI part
//! (torus_native.rs). The node continues the owner's field from the sample
//! it stood at; a `torus_play` event strikes its keys by the owner's
//! played-address law; Panic stills it; Export Audio makes it again from the
//! same document at the frame the engine took it. A new engine (Play after
//! Stop) holds no Torus until the owner hands it over again.
//!
//! The part follows the Torus's owner (round 12): the kernel tells the host
//! every act the owner lands — a key, a touch, a singlet, a named strike — and
//! every hand-over (`native_expression.rs` `TorusTap`), and the host strikes
//! each act on the part's Torus at the owner's own sample with the impulse the
//! owner's law gave each mode (no pitch or place of the host's own), and puts
//! each later hand-over on the part in the last one's place (a setting landed,
//! a restore, a body chosen). A form's body is handed over with no key law,
//! and its owner's words for why stand in the reading.
//!
//! The part's notes are its owner's (round 13): the Torus on the part strikes
//! no note of its own. The host hands the owner each clip note of the part
//! ahead of the engine, as the key the shell's pitch→key law gives it (`notes`,
//! O-I #853) at the owner's sample the note's frame falls on, with its velocity
//! over 127, and each MIDI note sent to the part at once; the shell plays them
//! on the owner through the frame (`oi:live-engine-torus-notes`), and the
//! owner's act strikes the part back through the tap. So the owner, the
//! picture and the engine hold one ringing, and a hand-over again keeps it.
//!
//! The Torus's effects stand on its part (round 13): the frame's chain, in its
//! order, each effect as Live's device of its kind on the chain of the rack
//! the Torus is placed as (the shell's `rackChainInLive`, live-set
//! `rack_place`: Filter as Auto Filter, Dynamics as Compressor, Delay as
//! Delay, Reverb as Reverb), with the settings the corpus pins carried, each
//! the engine's own device (live-engine `rack_device`) after the Torus and
//! before the part's own chain. Where the engine has no model of Live's
//! device the effect does not sound in it, and its words say so; an edit
//! moves the chain, and every device made as before keeps its tail.
//!
//! Events are refused in the engine's words when the set has nothing they
//! name. A mixer reading is what the engine APPLIED, never what was asked.
//! An audio part plays its arrangement clips on the engine's sample-playback
//! source (DLW build ruling 2026-11-05: "a decoded buffer laid at its clip's
//! beats, unwarped first"): the host lays each clip's sample from beside the
//! set when it opens it (live-engine `lay_samples`), and Export Audio renders
//! the samples laid then. A clip it does not play — warped, its sample
//! nowhere or unread, or at another rate — is named in the reading's
//! `warnings`.

#[cfg(feature = "native_shell")]
pub(crate) mod host {
    use live_engine::bridge::bridge_set;
    use live_engine::engine::PartMix;
    use live_engine::{
        engine, rack_device, BlockStamp, ClipEdge, DeviceAt, Due, EngineCore, EngineEvent,
        EngineHandle, EnginePlayer, Graph, MixerState, Part, RackDevice, TorusAct,
    };
    use live_set::xml::Element;
    use oi_cradle_kernel::native_expression::TorusTap;
    use serde::Deserialize;
    use serde_json::{json, Value};
    use std::collections::BTreeMap;
    use std::path::{Path, PathBuf};
    use std::sync::{Arc, Mutex};

    /// The rate the engine runs and the output opens at (the harness
    /// signals' and the Torus's rate; there is no resampling).
    pub const ENGINE_RATE: u32 = 48_000;

    /// How the Torus its owner handed over takes its part (O-I #849 round 13). Either way a hand still on its
    /// way gives way to it, and is kept nowhere: it never sounded.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub enum Takes {
        /// When it is due.
        Instead(Due),
        /// When the part's Torus reaches the sample this one continues from: a hand-over again of the
        /// owner the part follows. The part runs behind its
        /// owner (the frame renders ahead of what it plays), so one taken at once would jump the part
        /// on by the samples between.
        Continuing,
    }

    /// The longest the frame names until it plays the sample the Torus was handed over at.
    pub const HEARD_IN_MS_MAX: f64 = 10_000.0;

    /// The engine's frame heard `ms` from now ([`frame_heard_at`] its last block's stamp, now).
    pub fn frame_heard_in(handle: &EngineHandle, ms: f64) -> Result<Due, String> {
        frame_heard_at(
            handle.block_stamp(),
            handle.now_ns(),
            handle.latency().output_latency_ns,
            ms,
        )
    }

    /// The engine's frame heard `ms` after `now_ns` (round 14): the frame it mixes at `now_ns` — its
    /// last block's first frame, on by the time since that block was pulled at its rate, never past
    /// the block's end, the frames it has rendered — on by `ms` at its rate, less the device's output
    /// latency (callback to playback), so it is right within a block. Refused in words for a time that
    /// is not one from now within [`HEARD_IN_MS_MAX`].
    pub fn frame_heard_at(
        stamp: BlockStamp,
        now_ns: u64,
        latency_ns: u64,
        ms: f64,
    ) -> Result<Due, String> {
        if !(ms.is_finite() && (0.0..=HEARD_IN_MS_MAX).contains(&ms)) {
            return Err(format!(
                "The frame names when it plays the Torus it handed over as a time from now, within {HEARD_IN_MS_MAX} ms, not {ms}"
            ));
        }
        let rate = f64::from(ENGINE_RATE);
        let frames = |ns: f64| (ns / 1e9 * rate).round() as u64;
        let mixing =
            stamp.frame + frames(now_ns.saturating_sub(stamp.at_ns) as f64).min(stamp.frames);
        let ahead = (ms / 1000.0 * rate).round() as u64;
        Ok(Due::AtFrame(
            mixing + ahead.saturating_sub(frames(latency_ns as f64)),
        ))
    }

    /// How long from `now_ms` until `heard_at_ms`, when the frame names its sound of the sample it handed the
    /// Torus over at as heard (both ms since the Unix epoch: the machine's wall clock the page and the host
    /// share, so the time its answer took to reach the host is not counted twice). At once (0) for a time
    /// already past; refused in words for one not within [`HEARD_IN_MS_MAX`] of now.
    pub fn heard_in_ms(heard_at_ms: f64, now_ms: f64) -> Result<f64, String> {
        let ms = heard_at_ms - now_ms;
        if !(ms.is_finite() && ms.abs() <= HEARD_IN_MS_MAX) {
            return Err(format!(
                "The frame names when it plays the Torus it handed over as a time within {HEARD_IN_MS_MAX} ms of now, not {ms} ms from it"
            ));
        }
        Ok(ms.max(0.0))
    }

    /// A part as an event names it: `{"track": i}`, `{"return": i}`,
    /// `{"group": i}` (O-I #849 round 16) or `"main"`.
    #[derive(Debug, Clone, Copy, Deserialize)]
    #[serde(rename_all = "snake_case", deny_unknown_fields)]
    pub enum PartIn {
        Track(usize),
        Return(usize),
        Group(usize),
        Main,
    }

    impl From<PartIn> for Part {
        fn from(p: PartIn) -> Part {
            match p {
                PartIn::Track(i) => Part::Track(i),
                PartIn::Return(i) => Part::Return(i),
                PartIn::Group(i) => Part::Group(i),
                PartIn::Main => Part::Main,
            }
        }
    }

    /// One engine event as the UI sends it: `kind` names it (`note_on`,
    /// `note_off`, `panic`, `volume`, `pan`, `send`, `active`, `solo`,
    /// `torus_play`, `bend`, `pressure`, and `device`: a set's device made
    /// again, [`Opened::make_again`]) and the fields its kind takes sit beside it. A plain
    /// struct, not a tagged enum: a tagged enum buffers its fields, and the
    /// buffered numbers of this build's serde_json (arbitrary precision,
    /// enabled by a dependency) arrive as maps — "invalid type: map,
    /// expected f64".
    #[derive(Debug, Clone, Deserialize)]
    #[serde(deny_unknown_fields)]
    pub struct EventIn {
        kind: EventKind,
        track: Option<usize>,
        key: Option<u8>,
        velocity: Option<f32>,
        part: Option<PartIn>,
        gain: Option<f64>,
        pan: Option<f64>,
        send: Option<usize>,
        on: Option<bool>,
        /// A Torus act's keys, as its owner's `torus-play` names them (O-I #849).
        keys: Option<Vec<KeyIn>>,
        /// A Torus act's velocity: two modal metres, as its owner's `torus-play` takes it.
        amplitude: Option<[f64; 2]>,
        /// A pitch bend's share of its range (−1 to 1) or a channel pressure (0 to 1), O-I #853.
        amount: Option<f32>,
        /// A device made again (O-I #849 round 17): the track the set's owner names it on ("Master" the Main
        /// track), and its element name.
        track_name: Option<String>,
        device: Option<String>,
        /// Its place on that track's chain, the instrument counted, as the set's owner writes it (DLW build ruling
        /// 2026-11-05: the second of two devices of one name is itself); absent, the first of that name.
        at: Option<usize>,
    }

    /// One of the Torus's keys: its row on the surface and its column.
    #[derive(Debug, Clone, Copy, Deserialize)]
    #[serde(deny_unknown_fields)]
    pub struct KeyIn {
        row: u8,
        column: u16,
    }

    /// The key (row, column) each MIDI note 0–127 strikes on a Torus part, by the shell's pitch→key law
    /// (O-I #853 `keyForNote`), or none where the law gives the note no key.
    pub type Notes = [Option<(u8, u16)>; 128];

    /// A Torus part's notes as the shell sends them: for each of the 128 MIDI notes, a key or null.
    pub fn notes(table: &Value) -> Result<Notes, String> {
        let table: Vec<Option<KeyIn>> = serde_json::from_value(table.clone()).map_err(|e| {
            format!("A Torus part's notes are a key or null for each MIDI note: {e}")
        })?;
        if table.len() != 128 {
            return Err(format!(
                "A Torus part's notes name a key or none for each of the 128 MIDI notes, not {}",
                table.len()
            ));
        }
        let mut notes = [None; 128];
        for (note, key) in notes.iter_mut().zip(table) {
            *note = key.map(|k| (k.row, k.column));
        }
        Ok(notes)
    }

    #[derive(Debug, Clone, Copy, Deserialize, serde::Serialize)]
    #[serde(rename_all = "snake_case")]
    enum EventKind {
        NoteOn,
        NoteOff,
        Panic,
        Volume,
        Pan,
        Send,
        Active,
        Solo,
        TorusPlay,
        Bend,
        Pressure,
        Device,
    }

    impl EventIn {
        /// The engine event, or the field its kind lacks.
        pub fn event(self) -> Result<EngineEvent, String> {
            fn need<T>(v: Option<T>, kind: &str, field: &str) -> Result<T, String> {
                v.ok_or_else(|| format!("a {kind} event names its {field}"))
            }
            // a send or a solo names a part by its `track`, or a part or a group as its `part` (O-I #849 round 17)
            fn sender(
                track: Option<usize>,
                part: Option<PartIn>,
                kind: &str,
            ) -> Result<Part, String> {
                match (track, part) {
                    (Some(track), None) => Ok(Part::Track(track)),
                    (None, Some(part)) => Ok(part.into()),
                    _ => Err(format!(
                        "a {kind} event names its track, or a part or a group as its part: one of them"
                    )),
                }
            }
            let Self {
                kind,
                track,
                key,
                velocity,
                part,
                gain,
                pan,
                send,
                on,
                keys,
                amplitude,
                amount,
                ..
            } = self;
            let name = serde_json::to_value(kind)
                .ok()
                .and_then(|v| v.as_str().map(str::to_owned))
                .unwrap_or_default();
            Ok(match kind {
                EventKind::NoteOn => EngineEvent::NoteOn {
                    track: need(track, &name, "track")?,
                    key: need(key, &name, "key")?,
                    velocity: need(velocity, &name, "velocity")?,
                },
                EventKind::NoteOff => EngineEvent::NoteOff {
                    track: need(track, &name, "track")?,
                    key: need(key, &name, "key")?,
                },
                EventKind::Panic => EngineEvent::Panic,
                EventKind::Bend => EngineEvent::Bend {
                    track: need(track, &name, "track")?,
                    amount: need(amount, &name, "amount")?,
                },
                EventKind::Pressure => EngineEvent::Pressure {
                    track: need(track, &name, "track")?,
                    amount: need(amount, &name, "amount")?,
                },
                EventKind::Volume => EngineEvent::Volume {
                    part: need(part, &name, "part")?.into(),
                    gain: need(gain, &name, "gain")?,
                },
                EventKind::Pan => EngineEvent::Pan {
                    part: need(part, &name, "part")?.into(),
                    pan: need(pan, &name, "pan")?,
                },
                EventKind::Send => EngineEvent::Send {
                    part: sender(track, part, &name)?,
                    send: need(send, &name, "send")?,
                    gain: need(gain, &name, "gain")?,
                },
                EventKind::Active => EngineEvent::Active {
                    part: need(part, &name, "part")?.into(),
                    on: need(on, &name, "on")?,
                },
                EventKind::Solo => EngineEvent::Solo {
                    part: sender(track, part, &name)?,
                    on: need(on, &name, "on")?,
                },
                EventKind::Device => return Err(
                    "a device event makes a set's device again from the set: it is no engine event"
                        .into(),
                ),
                EventKind::TorusPlay => {
                    let keys: Vec<(u8, u16)> = need(keys, &name, "keys")?
                        .iter()
                        .map(|key| (key.row, key.column))
                        .collect();
                    EngineEvent::TorusPlay {
                        track: need(track, &name, "track")?,
                        act: TorusAct::new(&keys, need(amplitude, &name, "amplitude")?)?,
                    }
                }
            })
        }
    }

    /// The set document at `path`, as the set's owner reads it.
    pub fn set_document(path: &Path) -> Result<Element, String> {
        if !path.is_absolute() || path.extension().is_none_or(|e| e != "als") {
            return Err("Choose an absolute native .als document path".into());
        }
        live_set::open_als(path).map_err(|e| format!("{}: {e:?}", path.display()))
    }

    /// The bridge's warnings in the reading's words.
    fn said(warnings: &[live_engine::BridgeWarning]) -> Vec<String> {
        warnings
            .iter()
            .map(|w| {
                if w.device.is_empty() {
                    format!("{}: {}", w.track, w.message)
                } else {
                    format!("{} · {}: {}", w.track, w.device, w.message)
                }
            })
            .collect()
    }

    /// The set bridged into the engine's graph at [`ENGINE_RATE`], with the bridge's warnings, its audio
    /// clips not laid (the host lays them: [`laid`]).
    pub fn bridged_only(root: &Element) -> Result<live_engine::BridgeResult, String> {
        bridge_set(root, ENGINE_RATE).ok_or_else(|| "No LiveSet in native document".to_string())
    }

    /// The samples the set's audio clips want, laid on `graph`'s parts from beside the set at `set`
    /// (live-engine `lay_samples`), with the words for each clip it does not play.
    pub fn laid(
        graph: &mut Graph,
        samples: &[live_engine::bridge::ClipSample],
        set: &Path,
    ) -> Vec<String> {
        said(&live_engine::bridge::lay_samples(graph, samples, set))
    }

    /// The set at `set` bridged into the engine's graph at [`ENGINE_RATE`], its audio clips laid from
    /// their samples ([`laid`]), with the bridge's warnings and the words for each clip it does not play:
    /// the set as the host opens it, for the tests that render it whole.
    #[cfg(test)]
    pub fn bridged(root: &Element, set: &Path) -> Result<(Graph, Vec<String>), String> {
        let mut bridged = bridged_only(root)?;
        let mut warnings = said(&bridged.warnings);
        warnings.extend(laid(&mut bridged.graph, &bridged.samples, set));
        Ok((bridged.graph, warnings))
    }

    fn part_json(p: &PartMix) -> Value {
        json!({"name": p.name, "gain": p.gain, "pan": p.pan, "active": p.active, "solo": p.solo, "sends": p.sends, "midi": p.midi})
    }

    pub fn mixer_json(m: &MixerState) -> Value {
        json!({
            "tracks": m.tracks.iter().map(part_json).collect::<Vec<_>>(),
            "returns": m.returns.iter().map(part_json).collect::<Vec<_>>(),
            "groups": m.groups.iter().map(part_json).collect::<Vec<_>>(),
            "main": part_json(&m.main),
        })
    }

    /// The words the Torus is refused in by a host built without QL's K8 node.
    #[cfg(not(feature = "k8"))]
    pub const WITHOUT_K8: &str = "The Torus sounds in the one engine through QL's K8 node, and this host was built without QL's K8 node (its k8 feature)";

    /// A Torus handed over to one of the set's parts (O-I #849): the part, the digest its owner
    /// handed it over by and the sample it stood at, the host's count of the hand-over (the owner's acts
    /// that follow it are struck on it alone), the key each MIDI note strikes on it, the owner's words
    /// for a body handed over with no key law, and what it was made from, for Export Audio.
    #[cfg_attr(not(feature = "k8"), allow(dead_code))]
    pub struct TorusOnPart {
        pub track: usize,
        pub sha256: String,
        pub at_samples_elapsed: u64,
        pub handover: u32,
        pub keys_refused: Option<String>,
        #[cfg(feature = "k8")]
        pub handed: crate::torus_native::Handed,
        /// What its node could not do as asked, as the audio thread counts it.
        #[cfg(feature = "k8")]
        pub counts: std::sync::Arc<live_engine::K8Counts>,
    }

    /// The part that follows the Torus's owner: the owner's lease, the part, the hand-over it holds
    /// (by digest and the host's count) and its notes.
    #[derive(Debug, Clone)]
    pub struct Bound {
        pub lease: String,
        pub track: usize,
        pub sha256: String,
        pub handover: u32,
        pub notes: Option<Notes>,
    }

    /// The engine following the Torus's owner (round 12): the part bound to it, the owner's acts struck on
    /// it, the owner's moves of the gains it is heard by reached on it (round 14), those the host could not
    /// strike or reach (with the last refusal's words) and the hand-overs taken again.
    #[derive(Debug, Default)]
    pub struct Following {
        pub bound: Option<Bound>,
        pub struck: u64,
        pub heard: u64,
        pub missed: u64,
        pub handed_again: u64,
        pub refusal: Option<String>,
        pub relay: Relay,
    }

    /// How far ahead of the engine the bound part's clip notes are handed to the Torus's owner (frames):
    /// a note must reach the owner before its cursor passes the note's sample, and the owner's cursor
    /// leads the engine's by the time the hand-over took (the engine continues from where the owner stood).
    pub const TORUS_LOOKAHEAD: u64 = ENGINE_RATE as u64 / 2;
    /// One act due on the Torus's owner: the owner's sample it lands at (None: at once), its strength
    /// (velocity over 127) and its keys (row, column).
    type DueAct = (Option<u64>, f64, Vec<(u8, u16)>);
    /// The most keys one owner act strikes (the frame's Jankó strike, STAGE_JANKO_KEYS_MAX).
    pub const TORUS_RELAY_KEYS: usize = 32;
    /// The event the bound part's due notes reach the shell by, which plays each on the Torus's owner
    /// through the frame (its Jankó strike at the act's sample, its release).
    pub const TORUS_NOTES_EVENT: &str = "oi:live-engine-torus-notes";
    /// How often the host looks for the bound part's due notes when its owner tells it nothing.
    pub const TORUS_RELAY_TICK: std::time::Duration = std::time::Duration::from_millis(10);

    /// The bound part's notes handed to the Torus's owner (round 13): a note on a part the Torus sounds
    /// on is its owner's to play, so the host hands it over as its key at the note's own sample, ahead
    /// of it ([`TORUS_LOOKAHEAD`]), and the owner's act strikes it back through the kernel's tap, as
    /// every act of the owner's does. A MIDI note sent to the part is handed over at once.
    #[derive(Debug, Default)]
    pub struct Relay {
        /// The next clip edge of the bound part to hand out: its strikes ahead, its releases as the
        /// engine reaches them.
        pub next_on: usize,
        pub next_off: usize,
        /// Each MIDI key the owner holds by a strike handed out here, by count: only those are let go.
        pub held: BTreeMap<u8, u16>,
        /// MIDI notes sent to the part (a velocity strikes, none lets go), handed over at once.
        pub now: Vec<(u8, Option<f32>)>,
        /// Notes handed to the owner; those with no key by the pitch law (or no strength), and clip
        /// notes before the part took the Torus.
        pub handed: u64,
        pub unkeyed: u64,
        pub before: u64,
    }

    /// The Torus's effects as Live's devices (the shell's rackChainInLive TORUS_EFFECT_IN_LIVE, O-I #852
    /// round 10): the frame's effect, the class a set stores Live's device of its kind under, Live's
    /// title for it, and the manual's title for the effect.
    pub const TORUS_EFFECT_IN_LIVE: [(&str, &str, &str, &str); 4] = [
        ("filter", "AutoFilter", "Auto Filter", "Filter"),
        ("dynamics", "Compressor2", "Compressor", "Dynamics"),
        ("delay", "Delay", "Delay", "Delay"),
        ("reverb", "Reverb", "Reverb", "Reverb"),
    ];
    /// The Torus's Filter's types (effectsLaw.ts `FILTER_TYPES`) as the engine's model of Live's Auto
    /// Filter sounds them.
    pub const TORUS_FILTER_TYPES: [(&str, live_engine::FilterKind); 4] = [
        ("lowpass", live_engine::FilterKind::Lowpass),
        ("highpass", live_engine::FilterKind::Highpass),
        ("bandpass", live_engine::FilterKind::Bandpass),
        ("notch", live_engine::FilterKind::Notch),
    ];
    /// The Torus's Delay's note lengths in beats (effectsLaw.ts `DELAY_DIVISIONS`), and the longest time
    /// its frame's line holds (presentationEffects.ts `MAX_DELAY`).
    pub const TORUS_DELAY_DIVISIONS: [(&str, f64); 6] = [
        ("1/32", 0.125),
        ("1/16", 0.25),
        ("1/8", 0.5),
        ("1/4", 1.0),
        ("1/2", 2.0),
        ("1", 4.0),
    ];
    pub const TORUS_DELAY_MAX_S: f64 = 6.0;
    /// How many of its Attack's times Live's Compressor takes to come within a quarter dB of a held
    /// level, ln(1/(1 − 10^(−1/80))): it reads the level through a one-pole of its Attack (live-dynamics
    /// `CompressorModel`), where the frame's compressor (the browser's DynamicsCompressorNode) brings its
    /// gain within a quarter dB of where it goes in its attack. So Live's Attack is the frame's over
    /// this: an engine decision, measured against the frame (O-I #849 round 14).
    pub const TORUS_ATTACK_SETTLES: f64 = 3.562_350_828_929_603;

    /// What one chain on a part's rack was made from, device by device (what live-engine `rack_device`
    /// makes it from: Live's class and the settings carried, by Live's key, or the frame's name for one
    /// of the Torus's effects and its settings, by the frame's key), so Export Audio makes it again.
    pub type RackMade = Vec<(&'static str, Vec<(&'static str, f64)>)>;

    /// The frame's effects (effectsLaw.ts `EffectsState`: the chain, and each effect's parameters) as
    /// the chain after the Torus on its part: each effect on the frame's chain in order, on, as Live's
    /// device of its kind with the frame's settings carried by Live's keys (the reading's `carried`, as
    /// a set stores Live's device: the shell's rackChainInLive writes the same), and the engine's own
    /// device for it (live-engine `rack_device`, O-I #849 rounds 14 and 15):
    /// - the Filter as Auto Filter's model, from its type, cutoff, resonance and drive as Auto Filter's
    ///   FilterType, Cutoff, Resonance and Drive;
    /// - the Delay as Delay's model, from its time (a synced one's note length at its tempo, as its
    ///   frame's delaySeconds), feedback, tone and mix as Delay's DelayLine_TimeL, Feedback,
    ///   Filter_Frequency and DryWet;
    /// - the Dynamics as its frame's own compressor, from the frame's settings (`dynamics`); Live's
    ///   Compressor carries its threshold (as a level), ratio, attack (over
    ///   [`TORUS_ATTACK_SETTLES`]), release and makeup, and a hard knee, as Threshold, Ratio, Attack,
    ///   Release, Gain and Knee;
    /// - the Reverb as its frame's own room, from the frame's settings (`reverb`); Live's Reverb
    ///   carries its Decay and pre-delay as DecayTime and PreDelay, in ms.
    ///
    /// A setting over or under what Live's device holds stands at its nearer edge, and where the engine
    /// sounds it through Live's model, so it sounds there, in words. An effect off passes the sound as
    /// it came, so it stands nowhere. The frame's level, where its effects carry it (`level`, the frame's
    /// presentation gain 0 to 4: O-I #743 round 20), stands first, before them, as in the frame
    /// (controller.ts `stage`: the effects "stand after the level"), as live-engine's `level`; while the
    /// frame's Sound is off (`muted`, round 21) that level is 0, and with Sound on and no level named, 1.
    /// With it, how the engine stands each effect, in words where it does not sound as the frame's.
    /// Refused in words for what is not the frame's effects, for a level outside the frame's, and for a
    /// sound neither on nor off.
    pub fn torus_chain(effects: &Value) -> Result<(RackMade, Value), String> {
        const NOT: &str = "The Torus's effects are its chain and each effect's settings, as the frame reports them (effectsLaw.ts)";
        let chain = effects.get("chain").and_then(Value::as_array).ok_or(NOT)?;
        let mut made: RackMade = Vec::new();
        let mut reading = Vec::new();
        // a chain naming an effect twice is refused as that, whatever its settings
        for (at, effect) in chain.iter().enumerate() {
            let effect = effect.as_str().ok_or(NOT)?;
            if chain[..at].iter().any(|e| e.as_str() == Some(effect)) {
                return Err(format!("{NOT}: {effect} stands on the chain twice"));
            }
        }
        let level = match effects.get("level") {
            None => None,
            Some(level) => Some(level.as_f64().filter(|v| (0.0..=4.0).contains(v)).ok_or_else(
                || format!("{NOT}: its level is the frame's presentation gain, 0 to 4, not {level}"),
            )?),
        };
        // the frame's Sound off (`muted`, round 21): the Torus heard at no level, its own again when it is on
        let muted = match effects.get("muted") {
            None => None,
            Some(muted) => Some(
                muted
                    .as_bool()
                    .ok_or_else(|| format!("{NOT}: its sound is on or off, not {muted}"))?,
            ),
        };
        if level.is_some() || muted.is_some() {
            let heard = if muted == Some(true) {
                0.0
            } else {
                level.unwrap_or(1.0)
            };
            made.push(("level", vec![("level", heard)]));
        }
        for effect in chain {
            let effect = effect.as_str().ok_or(NOT)?;
            let settings = effects
                .get(effect)
                .filter(|v| v.is_object())
                .ok_or_else(|| {
                    format!("{NOT}: the chain holds {effect}, and no settings of it are given")
                })?;
            let on = settings
                .get("on")
                .and_then(Value::as_bool)
                .ok_or_else(|| format!("{NOT}: {effect} is on or off"))?;
            if effect == "resonator" {
                reading.push(json!({"effect": effect, "device": null, "on": on, "sounds": false,
                    "words": if on { Value::from("The Resonator bank stays off the engine's chain: the corpus gives Live's Resonators no parameter surface yet, so it does not sound in the engine") } else { Value::Null }}));
                continue;
            }
            let &(_, class, title, manual) = TORUS_EFFECT_IN_LIVE
                .iter()
                .find(|(name, ..)| *name == effect)
                .ok_or_else(|| format!("{NOT}: the Torus has no effect {effect}"))?;
            if !on {
                reading
                    .push(json!({"effect": effect, "device": class, "on": false, "sounds": false}));
                continue;
            }
            let mut carried: Vec<(&'static str, f64)> = Vec::new();
            // what the engine sounds it from, where that is not Live's keys: the frame's own effect, by its keys
            let mut sounded: Option<(&'static str, Vec<(&'static str, f64)>)> = None;
            let mut words = Vec::new();
            let number = |key: &str| {
                settings
                    .get(key)
                    .and_then(Value::as_f64)
                    .ok_or_else(|| format!("{NOT}: the {key} of its {manual} is a number"))
            };
            // a setting Live's device holds only within its extent stands at its nearer edge, in words
            let within = |id: &str, value: f64, said: &str, unit: &str, shown: fn(f64) -> f64| {
                let (min, max) = live_engine::live_holds(class, id).unwrap_or((value, value));
                let edge = value.clamp(min, max);
                let (side, at) = if value < min {
                    ("under", min)
                } else {
                    ("over", max)
                };
                // to a tenth, or to three figures under one
                let shown = |x: f64| {
                    let x = shown(x);
                    let places = if x.abs() >= 1.0 || x == 0.0 {
                        1
                    } else {
                        2 - x.abs().log10().floor() as i32
                    };
                    (x * 10f64.powi(places)).round() / 10f64.powi(places)
                };
                (edge, (edge != value).then(|| format!("its {said} of {} {unit} is {side} the {} {unit} Live's {title} holds, and stands there", shown(value), shown(at))))
            };
            if effect == "filter" {
                let kind = settings.get("type").and_then(Value::as_str);
                let kind = TORUS_FILTER_TYPES
                    .iter()
                    .find(|(name, _)| Some(*name) == kind)
                    .map(|(_, k)| *k)
                    .ok_or_else(|| {
                        format!(
                            "{NOT}: Filter's type is one of {}",
                            TORUS_FILTER_TYPES.map(|(n, _)| n).join(", ")
                        )
                    })?;
                let stored = live_engine::AUTO_FILTER_TYPES
                    .iter()
                    .find(|(k, _)| *k == kind)
                    .map_or(0.0, |(_, s)| *s);
                let hz = number("cutoff")?;
                let (cutoff, said) = within(
                    "Cutoff",
                    live_engine::auto_filter_cutoff(hz),
                    "cutoff",
                    "Hz",
                    live_engine::auto_filter_hz,
                );
                words.extend(said);
                let (resonance, drive, mix) =
                    (number("resonance")?, number("drive")?, number("mix")?);
                carried.extend([
                    ("FilterType", stored),
                    ("Cutoff", cutoff),
                    ("Resonance", resonance / 100.0),
                    ("Drive", drive),
                ]);
                if mix != 100.0 {
                    words.push(format!("its mix of {mix} % stands at full: the corpus's surface of Live's Auto Filter keeps no dry/wet"));
                }
            }
            if effect == "dynamics" {
                let (threshold, ratio, attack) =
                    (number("threshold")?, number("ratio")?, number("attack")?);
                let (release, makeup) = (number("release")?, number("makeup")?);
                // the engine sounds the frame's compressor, so Live's edge is the set's alone
                let (live_attack, _) = within(
                    "Attack",
                    attack / TORUS_ATTACK_SETTLES,
                    "attack",
                    "ms",
                    |ms| ms * TORUS_ATTACK_SETTLES,
                );
                carried.extend([
                    ("Threshold", 10f64.powf(threshold / 20.0)),
                    ("Ratio", ratio),
                    ("Attack", live_attack),
                    ("Release", release),
                    ("Gain", makeup),
                    ("Knee", 0.0),
                ]);
                sounded = Some((
                    "dynamics",
                    vec![
                        ("threshold", threshold),
                        ("ratio", ratio),
                        ("attack", attack),
                        ("release", release),
                        ("makeup", makeup),
                    ],
                ));
            }
            if effect == "delay" {
                let sync = settings
                    .get("sync")
                    .and_then(Value::as_bool)
                    .ok_or_else(|| format!("{NOT}: Delay's sync is on or off"))?;
                let time = if sync {
                    let division = settings.get("division").and_then(Value::as_str);
                    let beats = TORUS_DELAY_DIVISIONS
                        .iter()
                        .find(|(name, _)| Some(*name) == division)
                        .map(|(_, b)| *b)
                        .ok_or_else(|| {
                            format!(
                                "{NOT}: Delay's division is one of {}",
                                TORUS_DELAY_DIVISIONS.map(|(n, _)| n).join(", ")
                            )
                        })?;
                    60.0 / number("tempo")? * beats
                } else {
                    number("time")? / 1000.0
                };
                let (time, said) = within(
                    "DelayLine_TimeL",
                    time.min(TORUS_DELAY_MAX_S),
                    "time",
                    "s",
                    |s| s,
                );
                words.extend(said);
                // the frame's 95 % is the most Live's Delay holds: 0.95 as its document's float keeps it
                let feedback = number("feedback")? / 100.0;
                let (_, most) = live_engine::live_holds("Delay", "Feedback").unwrap_or((0.0, 1.0));
                let feedback = if feedback > most && feedback as f32 <= most as f32 {
                    most
                } else {
                    feedback
                };
                carried.extend([
                    ("DelayLine_TimeL", time),
                    ("Feedback", feedback),
                    ("Filter_Frequency", number("tone")?),
                    ("DryWet", number("mix")? / 100.0),
                ]);
            }
            if effect == "reverb" {
                let decay = settings
                    .get("decay")
                    .and_then(Value::as_f64)
                    .ok_or_else(|| format!("{NOT}: Reverb's Decay is a number of seconds"))?;
                let (size, damping) = (number("size")?, number("damping")?);
                let (predelay, mix) = (number("predelay")?, number("mix")?);
                // the engine sounds the frame's room, so Live's edges are the set's alone
                let (decay_ms, _) = within(
                    "DecayTime",
                    (decay * 1e9).round() / 1e6,
                    "decay",
                    "ms",
                    |ms| ms,
                );
                let (predelay_ms, _) = within("PreDelay", predelay, "pre-delay", "ms", |ms| ms);
                carried.extend([("DecayTime", decay_ms), ("PreDelay", predelay_ms)]);
                sounded = Some((
                    "reverb",
                    vec![
                        ("size", size),
                        ("decay", decay),
                        ("damping", damping),
                        ("predelay", predelay),
                        ("mix", mix),
                    ],
                ));
            }
            let (maker, from) = sounded.unwrap_or((class, carried.clone()));
            match rack_device(maker, &from) {
                Ok(_) => {
                    reading.push(json!({"effect": effect, "device": class, "on": true, "sounds": true,
                        "carried": carried.iter().map(|(id, v)| (id.to_string(), json!(v))).collect::<serde_json::Map<_, _>>(),
                        "words": if words.is_empty() { Value::Null } else { Value::from(format!("Live's {title} in the engine: {}.", words.join("; "))) }}));
                    made.push((maker, from));
                }
                Err(why) => reading.push(
                    json!({"effect": effect, "device": class, "on": true, "sounds": false,
                    "words": format!("{why}, so the Torus's {manual} does not sound in it")}),
                ),
            }
        }
        Ok((made, Value::Array(reading)))
    }

    /// The engine's devices of a chain made as `made` says (live-engine `rack_device`).
    pub fn rack_of(made: &RackMade) -> Result<Vec<RackDevice>, String> {
        made.iter()
            .map(|(class, carried)| rack_device(class, carried))
            .collect()
    }

    /// The Torus's effects on the part it sounds on, as the engine stands them: the part, the chain
    /// made of them, how it stands each, and the refusal of the last that could not be put there.
    #[derive(Debug, Default)]
    pub struct TorusEffects {
        pub track: Option<usize>,
        pub made: RackMade,
        pub reading: Value,
        pub refusal: Option<String>,
    }

    /// An owner's act as the kernel tells it: the impulse its law gave each mode, by `mode_ref`.
    pub type Impulses = Vec<(String, [f64; 2])>;

    /// An owner's move as the kernel tells it: the gain each voice is heard by, by `mode_ref`.
    pub type Gains = Vec<(String, f64)>;
    /// The notes an owner voiced under Logic (the kernel's `TorusTap::Voiced`): each note's id, and its voices by the mode
    /// each is like, its frequency and its impulse.
    pub type Voiced = oi_cradle_kernel::native_expression::VoicedNotes;

    /// The parts the engine carries `notes` its owner voiced at `at` in (O-I #850 round 24; live-engine `TorusVoice`): each
    /// voice's mode by the index `mode` finds for the reference its owner named (the continuation it handed over), each note
    /// its eight voices. Refused in words for a mode the Torus does not have or a note that is not eight voices; nothing is
    /// sent then, since a part that voiced the rest would ring notes its owner's field does not.
    #[cfg(any(feature = "k8", test))]
    pub fn voiced_parts(
        mode: impl Fn(&str) -> Option<usize>,
        handover: u32,
        at: u64,
        notes: &Voiced,
        made_way: &[u64],
    ) -> Result<Vec<live_engine::TorusVoice>, String> {
        let notes = notes
            .iter()
            .map(|(id, voices)| {
                if voices.len() != live_engine::TORUS_NOTE_VOICES {
                    return Err(format!(
                        "A note the Torus's owner voiced has {} voices, and a note voices {}: the notes were not voiced",
                        voices.len(),
                        live_engine::TORUS_NOTE_VOICES
                    ));
                }
                let mut eight = [(0, 0.0, [0.0; 2]); live_engine::TORUS_NOTE_VOICES];
                for (slot, (reference, hz, z)) in eight.iter_mut().zip(voices) {
                    let like = mode(reference).ok_or_else(|| {
                        format!("The Torus handed over has no mode {reference}: the notes were not voiced")
                    })?;
                    *slot = (like, *hz, *z);
                }
                Ok((*id, eight))
            })
            .collect::<Result<Vec<_>, String>>()?;
        live_engine::TorusVoice::split(handover, at, &notes, made_way)
    }

    /// What the Torus's owner did that its part follows: an act it landed at a sample, or a move of the
    /// gains it is heard by that it reached over `frames` samples from one.
    #[derive(Debug, Clone, PartialEq)]
    pub enum Told {
        Struck(u64, Impulses),
        Heard(u64, u32, Gains),
        Voiced(u64, Voiced, Vec<u64>),
    }

    /// The most acts and moves the host keeps of an owner's last hand-over before a part is bound to it;
    /// more are counted as missed.
    pub const SINCE_ACTS: usize = 1024;

    /// What the Torus's owner told the host since it last handed the Torus over (the kernel's tap): its
    /// lease, the digest, and the acts it landed and the moves it reached since, in the order it did.
    #[derive(Debug)]
    pub struct Since {
        pub lease: String,
        pub sha256: String,
        pub acts: Vec<Told>,
        pub dropped: u64,
    }

    /// The host's side of the kernel's tap: the owner's last hand-over and the acts since.
    #[derive(Debug, Default)]
    pub struct Follow {
        pub since: Option<Since>,
    }

    /// One open set's engine.
    pub struct Opened {
        pub path: PathBuf,
        /// The set as the engine bridged it: what Export Audio renders again.
        pub document: Element,
        pub warnings: Vec<String>,
        pub handle: EngineHandle,
        /// The audio half while it is not playing (taken by `play`).
        pub core: Option<EngineCore>,
        pub player: Option<EnginePlayer>,
        /// Every Torus handed over to a part and taken or on its way, in the order handed: a hand the
        /// engine never took gave way to the next ([`EngineHandle::install_latest`]) and is not kept, so
        /// the n-th is the engine's n-th install.
        pub toruses: Vec<TorusOnPart>,
        /// The host's count of hand-overs (never reset, so an act tagged for one never reaches another).
        #[cfg_attr(not(feature = "k8"), allow(dead_code))]
        pub handovers: u32,
        pub following: Following,
        /// Each part's clip notes as the engine plays them ([`live_engine::Track::clip_edges`]).
        pub clips: Vec<Vec<ClipEdge>>,
        /// The Torus's effects on its part, and every chain put on a part's rack and taken or on its
        /// way, in the order put (the n-th is the engine's n-th: one that gave way is not kept).
        pub effects: TorusEffects,
        /// Each part's samples as the engine was handed them when the set opened ([`laid`]): what Export
        /// Audio lays again (the files beside the set may have changed since), and the words for each clip
        /// not laid, which the reading's warnings keep when they are read again from the set.
        pub samples: Vec<Vec<live_engine::LaidSample>>,
        pub samples_said: Vec<String>,
        /// Every part's samples laid again while the set plays (O-I #849 round 21, [`Opened::lay_again`]): the engine's
        /// count they were laid at, the part, and the samples, laid in their order: what Export Audio lays there again.
        pub relaid: Vec<(u64, usize, Vec<live_engine::LaidSample>)>,
        pub racked: Vec<(usize, RackMade)>,
        /// Every set's device made again on a chain (O-I #849 round 17, [`Opened::make_again`]): the engine's count it was
        /// made at, its part, its place, and the element it was made from.
        pub made_again: Vec<(u64, Part, usize, Element)>,
        /// The room made again while one stands, waiting for the edits to pause ([`ROOM_PAUSE`]): its
        /// count among such edits, the part and the frame's effects to put then.
        pub room_waiting: Option<(u64, usize, Value)>,
        pub room_edits: u64,
        /// Every take frozen on a part while the set plays, and every Unfreeze (O-I #849 round 22, [`Opened::freeze`]):
        /// the engine's count it was frozen at, the part, and the takes (none: let go), in their order: what Export
        /// Audio freezes there again.
        pub refrozen: Vec<(u64, usize, Vec<live_engine::LaidSample>)>,
        /// The registry of the takes frozen on parts ([`FrozenTake`]), the latest last.
        pub frozen: Vec<FrozenTake>,
        /// Every take played beside a part's Torus while the set plays, and every one let go (O-I #855 round 25,
        /// [`Opened::take_play`]): the engine's count it was played at, the part, and the take (none: let go), in their order:
        /// what Export Audio plays there again.
        pub beside: Vec<(u64, usize, Vec<live_engine::LaidSample>)>,
        /// The take played beside a part's Torus last, as the reading names it; None while none was, or it was let go.
        pub take_played: Option<Value>,
    }

    /// A take frozen on a part (O-I #849 round 22; DLW build ruling 2026-11-05: "A rendered take is a frozen take", as
    /// Live's Freeze Track does): the engine's count it was frozen at, the set's track it plays on (the set owner's
    /// index), its name, the engine frame it sounds from and how many it sounds for, and whether it was let go
    /// (Unfreeze) before its end.
    #[derive(Debug, Clone, PartialEq)]
    pub struct FrozenTake {
        pub id: u64,
        pub track: usize,
        pub name: String,
        pub at: u64,
        pub frames: u64,
        pub unfrozen: bool,
    }

    /// Why a take is not frozen while no Torus the engine follows has sounded: the owner's samples it lands at fall
    /// at no frame of the engine's yet.
    pub const FREEZE_UNANCHORED: &str = "The engine follows no Torus it has taken yet, so a frozen take has no frame to sound from: play the set in the engine, then launch the row again";

    /// How long the frame's edits pause before its room is made again (presentationEffects.ts
    /// `ROOM_PAUSE_MS`, O-I #849 round 17): the engine makes its room again as the frame does, once
    /// they have paused that long, the first at once.
    pub const ROOM_PAUSE: std::time::Duration = std::time::Duration::from_millis(60);

    /// The settings that make a room (`size`, `decay`, `damping` of the made Reverb), where a chain has one.
    fn room_of(made: &RackMade) -> Option<[f64; 3]> {
        let (_, from) = made.iter().find(|(class, _)| *class == "reverb")?;
        let at = |key: &str| from.iter().find(|(k, _)| *k == key).map(|(_, v)| *v);
        Some([at("size")?, at("decay")?, at("damping")?])
    }

    impl Opened {
        pub fn open(path: &Path) -> Result<Opened, String> {
            let document = set_document(path)?;
            let mut bridged = bridged_only(&document)?;
            let samples_said = laid(&mut bridged.graph, &bridged.samples, path);
            let graph = bridged.graph;
            let mut warnings = said(&bridged.warnings);
            warnings.extend(samples_said.iter().cloned());
            let clips = graph.tracks.iter().map(|t| t.clip_edges()).collect();
            let samples = graph.tracks.iter().map(|t| t.samples().to_vec()).collect();
            let (core, handle) = engine(graph).map_err(|e| e.to_string())?;
            Ok(Opened {
                path: path.to_path_buf(),
                document,
                warnings,
                handle,
                core: Some(core),
                player: None,
                toruses: Vec::new(),
                handovers: 0,
                following: Following::default(),
                clips,
                effects: TorusEffects::default(),
                samples,
                samples_said,
                relaid: Vec::new(),
                refrozen: Vec::new(),
                frozen: Vec::new(),
                beside: Vec::new(),
                take_played: None,
                racked: Vec::new(),
                made_again: Vec::new(),
                room_waiting: None,
                room_edits: 0,
            })
        }

        pub fn reading(&mut self) -> Value {
            self.handle.collect();
            json!({
                "path": self.path,
                "sample_rate": ENGINE_RATE,
                "position": self.handle.position(),
                "playing": self.player.is_some(),
                "warnings": self.warnings,
                "mixer": mixer_json(self.handle.mixer()),
                "toruses": self.torus_reading(),
                // the owner's acts for a Torus that no part's Torus took
                "torus_unplaced": self.handle.torus_unplaced(),
                "torus_follow": self.follow_reading(),
                "torus_effects": self.effects_reading(),
                "latency": self.latency_reading(),
                "frozen": self.frozen_reading(),
                "take_played": self.take_played,
            })
        }

        /// The takes frozen on parts (O-I #849 round 22): each by its track, its name, the frames it sounds over, and
        /// whether it sounds now, is still to sound, has ended, or was let go.
        pub fn frozen_reading(&mut self) -> Value {
            self.handle.collect();
            let position = self.handle.position();
            let taken: Vec<u64> = self.handle.relaid().iter().map(|&(_, id)| id).collect();
            Value::Array(
                self.frozen
                    .iter()
                    .map(|f| {
                        let standing = if f.unfrozen {
                            "unfrozen"
                        } else if !taken.contains(&f.id) || position < f.at {
                            "waiting"
                        } else if position < f.at + f.frames {
                            "sounding"
                        } else {
                            "ended"
                        };
                        json!({"track": f.track, "name": f.name, "at": f.at, "frames": f.frames, "standing": standing})
                    })
                    .collect(),
            )
        }

        /// The engine's own legs of key-to-sound (O-I #853 round 18), for the page to join with its own
        /// (jankoInput.ts keyToSound): the device block it last filled, the most a key waits for one at the
        /// engine's rate, the longest any event waited, and the device's output latency (callback to playback).
        /// With them, each of the latest strikes' pair on the host (O-I #849 round 22; DLW build ruling 2026-11-05:
        /// "a host-side timestamp pair per strike reported through the engine's own readout"; live-engine
        /// `StrikeTime`): the part, the frame it sounds at, when the host sent it to the engine and when the engine
        /// mixed that frame, in ms on the host's wall clock (since the epoch, the clock MIDI notes are stamped on as
        /// the host receives them), and the span between; the device plays it its output latency later. And each
        /// strike's key-to-sound as the engine measured it (DLW build ruling 2026-11-06): the frame it reached the engine,
        /// the frame its part first sounded (null: it sounded nothing within its wait), and the span between in frames, ms
        /// and the engine's blocks.
        fn latency_reading(&self) -> Value {
            let latency = self.handle.latency();
            let ms = |ns: u64| ns as f64 / 1e6;
            // the engine's time against the wall clock, read together
            let engine_now = self.handle.now_ns() as f64;
            let wall_now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map_or(0.0, |d| d.as_secs_f64() * 1000.0);
            let wall = |ns: u64| wall_now - (engine_now - ns as f64) / 1e6;
            let block = latency.block_frames.max(1) as f64;
            let strikes: Vec<Value> = latency
                .strikes
                .iter()
                .map(|s| {
                    // the engine's own key-to-sound (DLW build ruling 2026-11-06): reached to first sounded, in frames,
                    // ms and blocks; none for a strike its part did not sound
                    let to_sound = s.sounded_frame.map(|sounded| {
                        let frames = sounded.saturating_sub(s.reached_frame);
                        json!({"frames": frames, "ms": frames as f64 * 1000.0 / f64::from(ENGINE_RATE),
                            "blocks": frames as f64 / block})
                    });
                    json!({
                        "track": s.track,
                        "frame": s.frame,
                        "sent_at_ms": wall(s.sent_ns),
                        "sounds_at_ms": wall(s.sounds_ns),
                        "ms": ms(s.sounds_ns.saturating_sub(s.sent_ns)),
                        "reached_frame": s.reached_frame,
                        "sounded_frame": s.sounded_frame,
                        "to_sound": to_sound,
                    })
                })
                .collect();
            json!({
                "block_frames": latency.block_frames,
                "block_ms": latency.block_frames as f64 * 1000.0 / f64::from(ENGINE_RATE),
                "longest_wait_ms": ms(latency.longest_wait_ns),
                "output_latency_ms": ms(latency.output_latency_ns),
                "strikes": strikes,
            })
        }

        /// The Torus's effects on its part: the part, each effect on the frame's chain as the engine
        /// stands it, the frame's level it hears before them (0 while the frame's Sound is off; none where
        /// the frame sent neither), the frame
        /// the engine put the chain there from, and the last refusal.
        fn effects_reading(&self) -> Value {
            let e = &self.effects;
            if e.track.is_none() && e.refusal.is_none() {
                return Value::Null;
            }
            let racks = self.handle.racks();
            json!({
                "track": e.track,
                "chain": e.reading,
                "level": e.made.iter().find(|(class, _)| *class == "level").map(|(_, from)| from[0].1),
                "sounding_from_frame": (racks.len() == self.racked.len()).then(|| racks.last().map(|(frame, _)| *frame)).flatten(),
                "refusal": e.refusal,
                "room_waiting": self.room_waiting.is_some(),
            })
        }

        /// The Torus's effects as the frame holds them (`effects`, [`torus_chain`]) put on part `track`
        /// after its Torus: a chain made as the one standing there is not put again; one that differs only
        /// in settings its devices take while they play moves them in place (O-I #849 round 16:
        /// [`Opened::moves_in_place`], heard from the next block); otherwise it is put there, each device
        /// made as before keeping its state and each made again following the one it replaces (a room's
        /// tail rings out, a line's repeats go on: live-engine `Graph::rack`). Refused in words (and the
        /// refusal kept in the reading) for what is not the frame's effects, and for a part other than the
        /// one they stand on.
        pub fn put_effects(&mut self, track: usize, effects: &Value) -> Result<(), String> {
            let put = (|| {
                if let Some(was) = self.effects.track.filter(|was| *was != track) {
                    return Err(format!("The Torus's effects stand on part {was}: a part takes them when the Torus sounds on it from Play"));
                }
                let (made, reading) = torus_chain(effects)?;
                if self.effects.track == Some(track) && self.effects.made == made {
                    self.effects.reading = reading;
                    return Ok(());
                }
                // the same devices in the same order, moved only in settings each takes while it plays: each
                // moves there, heard from the next block with the part sounding on, and nothing is made again
                if let Some(moves) = self.moves_in_place(track, &made) {
                    for (at, key, value) in moves {
                        self.handle
                            .set(Part::Track(track), DeviceAt::Rack(at), key, value)
                            .map_err(|e| e.to_string())?;
                    }
                    self.effects = TorusEffects {
                        track: Some(track),
                        made,
                        reading,
                        refusal: None,
                    };
                    return Ok(());
                }
                let superseded = self
                    .handle
                    .install_rack(track, rack_of(&made)?)
                    .map_err(|e| e.to_string())?;
                if superseded {
                    self.racked.pop();
                }
                self.racked.push((track, made.clone()));
                self.effects = TorusEffects {
                    track: Some(track),
                    made,
                    reading,
                    refusal: None,
                };
                Ok(())
            })();
            if let Err(words) = &put {
                self.effects.refusal = Some(words.clone());
            }
            put
        }

        /// The Torus's effects put as the frame makes its room (O-I #849 round 17, presentationEffects.ts
        /// `#roomFor`): where a room stands on the part and these make another, what else they move is put at
        /// once, the room standing, and the room itself waits for the edits to pause ([`ROOM_PAUSE`]); each
        /// such edit takes the last one's place. Answers the edit's count while its room waits, which
        /// [`Opened::put_waiting_room`] puts once they have paused. Refused in words as [`Opened::put_effects`].
        pub fn put_effects_paced(
            &mut self,
            track: usize,
            effects: &Value,
        ) -> Result<Option<u64>, String> {
            let Ok((made, _)) = torus_chain(effects) else {
                // refused, in its words, as any put is
                return self.put_effects(track, effects).map(|()| None);
            };
            let standing = (self.effects.track == Some(track))
                .then(|| room_of(&self.effects.made))
                .flatten();
            let (Some(stood), Some(room)) = (standing, room_of(&made)) else {
                self.room_waiting = None;
                return self.put_effects(track, effects).map(|()| None);
            };
            if stood == room {
                self.room_waiting = None;
                return self.put_effects(track, effects).map(|()| None);
            }
            let mut now = effects.clone();
            for (key, value) in ["size", "decay", "damping"].into_iter().zip(stood) {
                now["reverb"][key] = json!(value);
            }
            self.put_effects(track, &now)?;
            self.room_edits += 1;
            self.room_waiting = Some((self.room_edits, track, effects.clone()));
            Ok(Some(self.room_edits))
        }

        /// The room waiting since edit `edit` ([`Opened::put_effects_paced`]), put now that the edits have
        /// paused: nothing when a later edit took its place. Refused in words as [`Opened::put_effects`].
        pub fn put_waiting_room(&mut self, edit: u64) -> Result<(), String> {
            match self.room_waiting.take() {
                Some((waiting, track, effects)) if waiting == edit => {
                    self.put_effects(track, &effects)
                }
                later => {
                    self.room_waiting = later;
                    Ok(())
                }
            }
        }

        /// The settings that move the Torus's effects standing on part `track` to `made` in place (O-I #849
        /// round 16): each (device, key, value) where the same devices stand in the same order and every
        /// setting that differs is one its device takes while it plays ([`live_engine::Device::settings`]).
        /// None where a device must be made again for it (another device, another order, a setting that
        /// makes the device, its room or its kind), and while the last chain put there is still on its way
        /// (what would be moved is not there yet).
        fn moves_in_place(
            &mut self,
            track: usize,
            made: &RackMade,
        ) -> Option<Vec<(usize, &'static str, f64)>> {
            if self.effects.track != Some(track) {
                return None;
            }
            self.handle.collect();
            if self.handle.racks().len() != self.racked.len() {
                return None;
            }
            let was = &self.effects.made;
            let standing = &self.handle.mixer().tracks.get(track)?.rack;
            if was.len() != made.len() || standing.len() != made.len() {
                return None;
            }
            let mut moves = Vec::new();
            for (at, ((class_was, from_was), (class, from))) in was.iter().zip(made).enumerate() {
                if class_was != class || from_was.len() != from.len() {
                    return None;
                }
                for ((key_was, value_was), (key, value)) in from_was.iter().zip(from) {
                    if key_was != key {
                        return None;
                    }
                    if value_was != value {
                        let (key, ..) = standing[at].settings.iter().find(|(k, ..)| k == key)?;
                        moves.push((at, *key, *value));
                    }
                }
            }
            Some(moves)
        }

        /// The part following the Torus's owner, if one is: the lease, the part, the hand-over it holds,
        /// whether MIDI notes strike its keys, and the owner's acts struck, missed and handed over again.
        fn follow_reading(&self) -> Value {
            let f = &self.following;
            match &f.bound {
                None => Value::Null,
                Some(b) => json!({
                    "lease": b.lease,
                    "track": b.track,
                    "sha256": b.sha256,
                    "handover": b.handover,
                    "notes": b.notes.is_some(),
                    "struck": f.struck,
                    "heard": f.heard,
                    "missed": f.missed,
                    "handed_again": f.handed_again,
                    "refusal": f.refusal,
                    "notes_to_owner": {
                        "handed": f.relay.handed,
                        "unkeyed": f.relay.unkeyed,
                        "before_torus": f.relay.before,
                    },
                }),
            }
        }

        /// The Torus each part holds (the last handed over to it): its digest, the owner's sample it
        /// stood at, and the engine frame it sounds from once the engine has taken it.
        fn torus_reading(&self) -> Value {
            let taken = self.handle.installs();
            Value::Array(
                self.toruses
                    .iter()
                    .enumerate()
                    .filter(|(i, t)| {
                        !self.toruses[i + 1..]
                            .iter()
                            .any(|later| later.track == t.track)
                    })
                    .map(|(i, t)| {
                        // what its node could not do as asked: owner's acts after their sample,
                        // notes and acts that struck nothing, frames it could not render
                        #[cfg(feature = "k8")]
                        let counts = {
                            use std::sync::atomic::Ordering::Relaxed;
                            json!({"late": t.counts.late.load(Relaxed), "refused": t.counts.refused.load(Relaxed),
                                "unrendered": t.counts.unrendered.load(Relaxed)})
                        };
                        #[cfg(not(feature = "k8"))]
                        let counts = Value::Null;
                        json!({
                            "track": t.track,
                            "sha256": t.sha256,
                            "at_samples_elapsed": t.at_samples_elapsed.to_string(),
                            "handover": t.handover,
                            "keys_refused": t.keys_refused,
                            "sounding_from_frame": taken.get(i).map(|(frame, _)| *frame),
                            "counts": counts,
                        })
                    })
                    .collect(),
            )
        }

        pub fn send(&mut self, event: EventIn) -> Result<Value, String> {
            if let EventKind::Device = event.kind {
                let (Some(track), Some(device)) = (&event.track_name, &event.device) else {
                    return Err("a device event names its track_name and its device".into());
                };
                self.make_again(track, device, event.at)?;
                return Ok(self.reading());
            }
            let event = event.event()?;
            // A MIDI note on the part the Torus's owner is followed on is the owner's to play: it is
            // handed over at once (torus_notes) and sounds as the owner's act.
            let note = match event {
                EngineEvent::NoteOn {
                    track,
                    key,
                    velocity,
                } => Some((track, key, Some(velocity))),
                EngineEvent::NoteOff { track, key } => Some((track, key, None)),
                _ => None,
            };
            if let Some((track, key, velocity)) = note {
                if self
                    .following
                    .bound
                    .as_ref()
                    .is_some_and(|b| b.track == track)
                {
                    self.following.relay.now.push((key, velocity));
                    return Ok(self.reading());
                }
            }
            if let EngineEvent::TorusPlay { track, .. } = event {
                let part = self.handle.mixer().tracks.get(track);
                if let Some(part) = part.filter(|_| !self.toruses.iter().any(|t| t.track == track))
                {
                    return Err(format!(
                        "{} holds no Torus: its owner's Torus is handed over to it first",
                        part.name
                    ));
                }
            }
            self.handle.send(event).map_err(|e| e.to_string())?;
            Ok(self.reading())
        }

        /// The set's device `device` on its track `track` made again in the engine from what the set now stores (O-I #849
        /// round 17: a setting of it the frame wrote through the set's owner, followed while the set plays): the set read
        /// again, the device the owner writes (at its place `at` on the chain of the first track of that name, "Master"
        /// the Main track; the first of its name when no place is named, DLW build ruling 2026-11-05) made as Play makes
        /// it (live-engine `bridge::set_device`) and put in its place from the next block, one of
        /// the same kind sounding on from where the last stood (`EngineHandle::make_again`); kept to make again for Export
        /// Audio, and the reading's warnings read again from the set. Refused in words for a track or a device the set
        /// does not have, and for a part's instrument (made when the set is played).
        pub fn make_again(
            &mut self,
            track: &str,
            device: &str,
            at: Option<usize>,
        ) -> Result<(), String> {
            let document = set_document(&self.path)?;
            let made = live_engine::bridge::set_device(&document, track, device, at)?;
            let id = self
                .handle
                .make_again(made.part, made.at, made.device)
                .map_err(|e| e.to_string())?;
            self.made_again.push((id, made.part, made.at, made.element));
            self.warnings = said(&bridged_only(&document)?.warnings);
            self.warnings.extend(self.samples_said.iter().cloned());
            Ok(())
        }

        /// Each audio part's samples laid again in the engine from the set as it now stands (O-I #849 round 21: a clip's
        /// sample its owner kept anew while the set plays, Consolidate's or Crop's, which the engine never had open): the
        /// set read again and its audio clips laid from beside it ([`laid`]), and each part whose samples are not those the
        /// engine plays handed them (`EngineHandle::lay`), sounding from the next block from the same place in each clip
        /// and kept to lay again for Export Audio; the reading's warnings read again from the set. Answers the names of
        /// the parts laid again. Refused in words while the set's parts are not those the engine opened (a part added,
        /// removed or moved: Play opens it again as it stands).
        pub fn lay_again(&mut self) -> Result<Vec<String>, String> {
            let document = set_document(&self.path)?;
            let mut bridged = bridged_only(&document)?;
            let samples_said = laid(&mut bridged.graph, &bridged.samples, &self.path);
            let opened: Vec<(&str, bool)> = self
                .handle
                .mixer()
                .tracks
                .iter()
                .map(|p| (p.name.as_str(), p.midi))
                .collect();
            let standing: Vec<(&str, bool)> = bridged
                .graph
                .tracks
                .iter()
                .map(|t| (t.name.as_str(), t.is_midi()))
                .collect();
            if standing != opened {
                return Err("The set's parts are not those the engine opened: Stop, then Play, to hear it as it now stands".into());
            }
            let mut moved = Vec::new();
            for (part, track) in bridged.graph.tracks.iter().enumerate() {
                if track.is_midi() {
                    continue;
                }
                let standing = self
                    .relaid
                    .iter()
                    .rev()
                    .find(|(_, p, _)| *p == part)
                    .map_or(&self.samples[part], |(.., samples)| samples);
                if standing.as_slice() == track.samples() {
                    continue;
                }
                let id = self
                    .handle
                    .lay(part, track.samples().to_vec())
                    .map_err(|e| e.to_string())?;
                self.relaid.push((id, part, track.samples().to_vec()));
                moved.push(track.name.clone());
            }
            self.samples_said = samples_said;
            self.warnings = said(&bridged.warnings);
            self.warnings.extend(self.samples_said.iter().cloned());
            Ok(moved)
        }

        /// The notes due on the part following the Torus's owner, as the owner's acts to play
        /// (`ql.torus-play` by the frame's Jankó strike and release), or None when none are due: each
        /// clip note the engine reaches within [`TORUS_LOOKAHEAD`] as its key by the pitch→key law the
        /// part was bound with, at the owner's sample its frame falls on (the hand-over's sample plus
        /// the frames since the engine took it) with its velocity over 127, keys at one frame and
        /// strength one act; each clip release the engine has reached, of a key handed out; and each
        /// MIDI note sent to the part, at once. Each is handed out once. Nothing before the engine
        /// took the hand-over is handed out (the part did not hold the Torus then).
        pub fn torus_notes(&mut self) -> Option<Value> {
            let bound = self.following.bound.clone()?;
            // the engine frame the part took the hand-over it holds at, and the owner's sample it stood
            // at: a clip note waits for it (a MIDI note sent to the part does not)
            let anchor = self.torus_anchor();
            let position = self.handle.position();
            let edges: &[ClipEdge] = match anchor {
                Some(_) => self.clips.get(bound.track).map_or(&[], Vec::as_slice),
                None => &[],
            };
            let (taken, stood) = anchor.unwrap_or_default();
            let key = |note: u8| {
                bound
                    .notes
                    .and_then(|notes| notes.get(usize::from(note)).copied().flatten())
            };
            let strength = |velocity: f32| {
                let amplitude = f64::from(velocity) / 127.0;
                (amplitude > 0.0 && amplitude <= 1.0).then_some(amplitude)
            };
            let relay = &mut self.following.relay;
            let mut acts: Vec<DueAct> = Vec::new();
            let mut releases: Vec<(u8, u16)> = Vec::new();
            let mut strike = |relay: &mut Relay, at: Option<u64>, note: u8, velocity: f32| {
                let (Some(k), Some(amplitude)) = (key(note), strength(velocity)) else {
                    relay.unkeyed += 1;
                    return;
                };
                relay.handed += 1;
                *relay.held.entry(note).or_default() += 1;
                match acts.last_mut() {
                    Some((then, a, keys))
                        if *then == at
                            && a.to_bits() == amplitude.to_bits()
                            && keys.len() < TORUS_RELAY_KEYS =>
                    {
                        if !keys.contains(&k) {
                            keys.push(k);
                        }
                    }
                    _ => acts.push((at, amplitude, vec![k])),
                }
            };
            let mut release = |relay: &mut Relay, note: u8| {
                let Some(held) = relay.held.get_mut(&note).filter(|h| **h > 0) else {
                    return;
                };
                *held -= 1;
                if let Some(k) = key(note) {
                    if !releases.contains(&k) {
                        releases.push(k);
                    }
                }
            };
            for (note, velocity) in std::mem::take(&mut relay.now) {
                match velocity {
                    Some(velocity) => strike(relay, None, note, velocity),
                    None => release(relay, note),
                }
            }
            while let Some(edge) = edges.get(relay.next_on) {
                if edge.frame >= position + TORUS_LOOKAHEAD {
                    break;
                }
                relay.next_on += 1;
                let Some(velocity) = edge.velocity else {
                    continue;
                };
                if edge.frame < taken {
                    relay.before += 1;
                    continue;
                }
                strike(
                    relay,
                    Some(stood + (edge.frame - taken)),
                    edge.key,
                    velocity,
                );
            }
            while let Some(edge) = edges.get(relay.next_off) {
                if edge.frame > position || relay.next_off >= relay.next_on {
                    break;
                }
                relay.next_off += 1;
                if edge.velocity.is_none() && edge.frame >= taken {
                    release(relay, edge.key);
                }
            }
            if acts.is_empty() && releases.is_empty() {
                return None;
            }
            let keys = |keys: &[(u8, u16)]| {
                keys.iter()
                    .map(|(row, column)| json!({"row": row, "column": column}))
                    .collect::<Vec<_>>()
            };
            Some(json!({
                "lease": bound.lease,
                "track": bound.track,
                "acts": acts.iter().map(|(at, amplitude, k)| {
                    let mut act = json!({"keys": keys(k), "amplitude": amplitude});
                    if let Some(at) = at {
                        act["at_samples_elapsed"] = json!(at.to_string());
                    }
                    act
                }).collect::<Vec<_>>(),
                "releases": keys(&releases),
            }))
        }

        /// Hand the Torus its owner handed over (`ql.torus-native/v1`, as the kernel kept it under its
        /// digest `sha256`) to the set's part `track` (O-I #849) as the host's next hand-over (its count
        /// answered), with the key each MIDI note strikes: the node continues the owner's field from the
        /// sample it stood at, takes the part as `takes` says ([`Takes`]) and sounds through the part's
        /// chain and mixer row to Main; the owner's acts after it wait for it. Refused in words for a
        /// document that is not one, a part that plays no notes, or a host without QL's K8 node.
        pub fn hand_torus(
            &mut self,
            track: usize,
            sha256: &str,
            document: &Value,
            takes: Takes,
        ) -> Result<u32, String> {
            #[cfg(feature = "k8")]
            {
                let handed = crate::torus_native::read(document)?;
                let handover = self.handovers + 1;
                let node = handed.node_handed(ENGINE_RATE, handover)?;
                let counts = node.counts();
                let node = Box::new(node);
                let due = match takes {
                    Takes::Instead(due) => due,
                    Takes::Continuing => Due::AtCursor(handed.at_samples_elapsed),
                };
                let superseded = self
                    .handle
                    .install_latest_due(track, node, due)
                    .map_err(|e| e.to_string())?;
                if superseded {
                    self.toruses.pop();
                }
                self.handovers = handover;
                self.toruses.push(TorusOnPart {
                    track,
                    sha256: sha256.to_owned(),
                    at_samples_elapsed: handed.at_samples_elapsed,
                    handover,
                    keys_refused: handed.keys_refused.clone(),
                    handed,
                    counts,
                });
                Ok(handover)
            }
            #[cfg(not(feature = "k8"))]
            {
                let _ = (track, sha256, document, takes);
                Err(WITHOUT_K8.into())
            }
        }

        /// One act the Torus's owner landed, struck on the part's Torus of the hand-over it follows, at the
        /// owner's sample: the impulse the owner's law gave each mode, by the modes that Torus was handed
        /// over with — nothing of the host's own. Refused in words for a mode it does not have.
        pub fn strike_owner(
            &mut self,
            track: usize,
            handover: u32,
            at: u64,
            impulses: &[(String, [f64; 2])],
        ) -> Result<(), String> {
            #[cfg(feature = "k8")]
            {
                let torus = self
                    .toruses
                    .iter()
                    .rev()
                    .find(|t| t.track == track && t.handover == handover)
                    .ok_or("The Torus this act follows gave way before the engine took it")?;
                let modes = impulses
                    .iter()
                    .map(|(reference, z)| {
                        torus.handed.mode(reference).map(|m| (m, *z)).ok_or_else(|| {
                            format!("The Torus handed over has no mode {reference}: the act was not struck")
                        })
                    })
                    .collect::<Result<Vec<_>, String>>()?;
                for strike in live_engine::TorusStrike::split(handover, at, &modes)? {
                    self.handle
                        .send(EngineEvent::TorusStrike { track, strike })
                        .map_err(|e| e.to_string())?;
                }
                Ok(())
            }
            #[cfg(not(feature = "k8"))]
            {
                let _ = (track, handover, at, impulses);
                Err(WITHOUT_K8.into())
            }
        }

        /// One move of the gains the Torus's owner is heard by, reached on the part's Torus of the hand-over
        /// it follows from the owner's sample over the owner's samples: the gain the owner reached for each
        /// mode, in the order of the modes that Torus was handed over with. Refused in words for a mode it
        /// does not have, one named twice, or one the move does not name.
        pub fn hear_owner(
            &mut self,
            track: usize,
            handover: u32,
            at: u64,
            frames: u32,
            gains: &[(String, f64)],
        ) -> Result<(), String> {
            #[cfg(feature = "k8")]
            {
                let torus = self
                    .toruses
                    .iter()
                    .rev()
                    .find(|t| t.track == track && t.handover == handover)
                    .ok_or("The Torus this move follows gave way before the engine took it")?;
                let modes = &torus.handed.continuation.input.modes;
                let mut by_mode: Vec<Option<f64>> = vec![None; modes.len()];
                for (reference, gain) in gains {
                    let slot = torus
                        .handed
                        .mode(reference)
                        .and_then(|m| by_mode.get_mut(m))
                        .ok_or_else(|| {
                            format!("The Torus handed over has no mode {reference}: the move was not reached")
                        })?;
                    if slot.replace(*gain).is_some() {
                        return Err(format!(
                            "The owner's move names mode {reference} twice: the move was not reached"
                        ));
                    }
                }
                let gains = by_mode
                    .iter()
                    .zip(modes)
                    .map(|(gain, mode)| {
                        gain.ok_or_else(|| {
                            format!(
                                "The owner's move names no gain for mode {}: the move was not reached",
                                mode.reference
                            )
                        })
                    })
                    .collect::<Result<Vec<f64>, String>>()?;
                for hear in live_engine::TorusHear::split(handover, at, frames, &gains)? {
                    self.handle
                        .send(EngineEvent::TorusHear { track, hear })
                        .map_err(|e| e.to_string())?;
                }
                Ok(())
            }
            #[cfg(not(feature = "k8"))]
            {
                let _ = (track, handover, at, frames, gains);
                Err(WITHOUT_K8.into())
            }
        }

        fn follow_act(&mut self, bound: &Bound, at: u64, impulses: &[(String, [f64; 2])]) {
            match self.strike_owner(bound.track, bound.handover, at, impulses) {
                Ok(()) => self.following.struck += 1,
                Err(words) => {
                    self.following.missed += 1;
                    self.following.refusal = Some(words);
                }
            }
        }

        /// The notes its owner voiced under Logic, voiced on the part's Torus of the hand-over it follows at the owner's
        /// sample (O-I #850 round 24): counted as an act struck, or missed with its words.
        fn follow_voice(&mut self, bound: &Bound, at: u64, notes: &Voiced, made_way: &[u64]) {
            match self.voice_owner(bound.track, bound.handover, at, notes, made_way) {
                Ok(()) => self.following.struck += 1,
                Err(words) => {
                    self.following.missed += 1;
                    self.following.refusal = Some(words);
                }
            }
        }

        /// The notes its owner voiced, sent to the part's Torus of the hand-over they follow ([`voiced_parts`]).
        pub fn voice_owner(
            &mut self,
            track: usize,
            handover: u32,
            at: u64,
            notes: &Voiced,
            made_way: &[u64],
        ) -> Result<(), String> {
            #[cfg(feature = "k8")]
            {
                let torus = self
                    .toruses
                    .iter()
                    .rev()
                    .find(|t| t.track == track && t.handover == handover)
                    .ok_or("The Torus these notes follow gave way before the engine took it")?;
                let parts = voiced_parts(|r| torus.handed.mode(r), handover, at, notes, made_way)?;
                for voice in parts {
                    self.handle
                        .send(EngineEvent::TorusVoice { track, voice })
                        .map_err(|e| e.to_string())?;
                }
                Ok(())
            }
            #[cfg(not(feature = "k8"))]
            {
                let _ = (track, handover, at, notes, made_way);
                Err(WITHOUT_K8.into())
            }
        }

        fn follow_move(&mut self, bound: &Bound, at: u64, frames: u32, gains: &[(String, f64)]) {
            match self.hear_owner(bound.track, bound.handover, at, frames, gains) {
                Ok(()) => self.following.heard += 1,
                Err(words) => {
                    self.following.missed += 1;
                    self.following.refusal = Some(words);
                }
            }
        }

        fn follow(&mut self, bound: &Bound, told: &Told) {
            match told {
                Told::Struck(at, impulses) => self.follow_act(bound, *at, impulses),
                Told::Heard(at, frames, gains) => self.follow_move(bound, *at, *frames, gains),
                Told::Voiced(at, notes, made_way) => self.follow_voice(bound, *at, notes, made_way),
            }
        }

        /// Export Audio's render: the set as the engine bridged it, rendered
        /// offline with every event the engine applied, at the frame it
        /// applied it — the samples the engine played (live-engine
        /// `Graph::render_performance`) — as a WAV file's bytes, with what
        /// it holds. The set as the file now stands is not read: a write
        /// made while it played reached the engine as an event.
        pub fn render_wav(&mut self) -> Result<(Vec<u8>, Value), String> {
            let performance = self.handle.performance();
            let graph = self.graph_as_opened()?;
            // Each device made again on a chain, made again from what it was made from, at the frame the engine put it there.
            let remade = self
                .handle
                .remade()
                .iter()
                .map(|&(frame, id)| {
                    let (_, part, at, element) = self
                        .made_again
                        .iter()
                        .find(|(made, ..)| *made == id)
                        .ok_or("a device the engine made again is not kept")?;
                    Ok((
                        frame,
                        *part,
                        *at,
                        live_engine::bridge::set_device_made(element),
                    ))
                })
                .collect::<Result<Vec<_>, String>>()?;
            // Each part's samples laid again, laid again at the frame the engine laid them there; each take frozen on a
            // part, and each Unfreeze, frozen there again at its frame (they share the engine's count).
            let mut relaid = Vec::new();
            let mut refrozen = Vec::new();
            let mut beside = Vec::new();
            for &(frame, id) in self.handle.relaid() {
                if let Some((_, part, samples)) = self.relaid.iter().find(|(laid, ..)| *laid == id)
                {
                    relaid.push((frame, *part, samples.clone()));
                } else if let Some((_, part, takes)) = self.refrozen.iter().find(|(f, ..)| *f == id)
                {
                    refrozen.push((frame, *part, takes.clone()));
                } else if let Some((_, part, takes)) = self.beside.iter().find(|(b, ..)| *b == id) {
                    // each take played beside a part's Torus, and each let go, played there again at its frame
                    beside.push((frame, *part, takes.clone()));
                } else {
                    return Err("samples the engine laid again are not kept".into());
                }
            }
            // Each Torus made again from what was handed over, at the frame the engine took it.
            // Each chain put on a part's rack made again, at the frame the engine put it there.
            let racks = self
                .handle
                .racks()
                .iter()
                .zip(&self.racked)
                .map(|(&(frame, track), (_, made))| Ok((frame, track, rack_of(made)?)))
                .collect::<Result<Vec<_>, String>>()?;
            #[cfg(feature = "k8")]
            let samples = {
                let toruses = self
                    .handle
                    .installs()
                    .iter()
                    .zip(&self.toruses)
                    .map(|(&(frame, track), torus)| {
                        let node: Box<dyn live_engine::Instrument> =
                            Box::new(torus.handed.node_handed(ENGINE_RATE, torus.handover)?);
                        Ok((frame, track, node))
                    })
                    .collect::<Result<Vec<_>, String>>()?;
                graph.render_performance_beside(
                    ENGINE_RATE,
                    &performance,
                    toruses,
                    racks,
                    remade,
                    relaid,
                    refrozen,
                    beside,
                )
            };
            #[cfg(not(feature = "k8"))]
            let samples = graph.render_performance_beside(
                ENGINE_RATE,
                &performance,
                Vec::new(),
                racks,
                remade,
                relaid,
                refrozen,
                beside,
            );
            Ok((
                wav_f32(&samples, ENGINE_RATE),
                json!({"frames": performance.frames, "events": performance.events.len(), "complete": performance.complete}),
            ))
        }
    }

    /// What names a take's sound sent to be rendered through its part ([`take_render_of`]).
    pub const TAKE_RENDER_SCHEMA: &str = "oi.take-render/v1";

    /// How a take's export rings its effects out past its end (O-I #743 round 20, item 3) — ENGINE DECISION: while a
    /// frame stands above −96 dBFS, the floor of a 16-bit file; ended once none has for 5 s, longer than the frame's
    /// longest Delay between repeats (4 s unsynced, effectsLaw.ts `time`; a synced whole note at 48 bpm and above),
    /// so a silence between repeats does not end it; at the most 30 s past the end, more than the frame's longest
    /// room (22 s, devices.rs `ROOM_MAX_S`), a tail still sounding there cut, and said to be.
    pub const TAKE_RING_OUT: live_engine::RingOut = live_engine::RingOut {
        floor: 1.584_893_2e-5,
        hold: 5 * ENGINE_RATE as u64,
        most: 30 * ENGINE_RATE as u64,
    };

    /// A take's sound sent to be rendered through its part (O-I #855): the set it is a take of and its track it was
    /// played on (the set owner's index), the rate its owner rendered it at, its sound (one channel), and the Torus's
    /// effects as the frame held them at each frame from the take's start, the first at its start.
    #[derive(Debug, PartialEq)]
    pub struct TakeRender {
        pub path: PathBuf,
        pub track: usize,
        pub rate: u32,
        pub pcm: Vec<f32>,
        pub effects: Vec<(u64, Value)>,
        /// To freeze it (O-I #849 round 22, [`Opened::freeze`]): the owner's sample it lands at, and its name.
        pub landed: Option<u64>,
        pub name: Option<String>,
    }

    /// A take's sound as the frame sends it (`oi.take-render/v1`): four bytes, little-endian, the length of a JSON
    /// head `{schema, path, track, rate, effects: [{frame, effects}]}` — and, for a take frozen on its part, `landed` (the
    /// owner's sample it lands at, as a decimal string) and `name` — the head, then the sound as IEEE-754 binary32
    /// little-endian samples, one channel. Refused in words for anything else.
    pub fn take_render_of(body: &[u8]) -> Result<TakeRender, String> {
        const NOT: &str = "A take is rendered through its part from its sound as the frame sends it (oi.take-render/v1): a head, then its samples";
        let n = body
            .get(..4)
            .map(|b| u32::from_le_bytes([b[0], b[1], b[2], b[3]]) as usize)
            .ok_or(NOT)?;
        let head: Value = body
            .get(4..4 + n)
            .and_then(|h| serde_json::from_slice(h).ok())
            .ok_or(NOT)?;
        let pcm = &body[4 + n..];
        if head["schema"] != TAKE_RENDER_SCHEMA || !pcm.len().is_multiple_of(4) {
            return Err(NOT.into());
        }
        let count = |v: &Value| v.as_u64();
        let (Some(path), Some(track), Some(rate)) = (
            head["path"].as_str(),
            count(&head["track"]),
            count(&head["rate"]),
        ) else {
            return Err(NOT.into());
        };
        let effects = head["effects"]
            .as_array()
            .ok_or(NOT)?
            .iter()
            .map(|e| Ok((count(&e["frame"]).ok_or(NOT)?, e["effects"].clone())))
            .collect::<Result<Vec<_>, String>>()?;
        let landed = match &head["landed"] {
            Value::Null => None,
            v => Some(v.as_str().and_then(|t| t.parse::<u64>().ok()).ok_or(NOT)?),
        };
        let name = match &head["name"] {
            Value::Null => None,
            v => Some(v.as_str().ok_or(NOT)?.to_string()),
        };
        Ok(TakeRender {
            landed,
            name,
            path: PathBuf::from(path),
            track: track as usize,
            rate: u32::try_from(rate).map_err(|_| NOT)?,
            pcm: pcm
                .as_chunks::<4>()
                .0
                .iter()
                .map(|c| f32::from_le_bytes(*c))
                .collect(),
            effects,
        })
    }

    /// What names a sealed take's sound sent to be played beside its part's Torus, or let go ([`take_play_of`]).
    pub const TAKE_PLAY_SCHEMA: &str = "oi.take-play/v1";

    /// A sealed take's sound sent to be played beside its part's Torus while its scene plays (O-I #855 round 25; DLW build
    /// ruling 2026-11-05: "native candidate: through the engine as a take player on the Torus part, mixed beside the live
    /// Torus"), or the take played there let go.
    #[derive(Debug, PartialEq)]
    pub enum TakePlay {
        /// Play `pcm` (one channel at `rate`: the take's sound as its owner rendered it, verified against its seal by the
        /// frame) beside the Torus on the set's track `track`, from its frame `from`, heard at `heard_at_ms` (ms since the
        /// Unix epoch, the machine's wall clock the page and the host share): where the frame plays it from then.
        Play {
            path: PathBuf,
            track: usize,
            rate: u32,
            from: u64,
            heard_at_ms: f64,
            name: String,
            pcm: Vec<f32>,
        },
        /// Let the take played beside the Torus on the set's track `track` go, from the engine's next block.
        Stop { path: PathBuf, track: usize },
    }

    /// A take's sound as the frame sends it to play (`oi.take-play/v1`), in [`take_render_of`]'s framing: four bytes,
    /// little-endian, the length of a JSON head `{schema, path, track, rate, from, heard_at_ms, name}` (`from` the take's frame,
    /// as a decimal string), the head, then the sound as IEEE-754 binary32 little-endian samples, one channel; or the head
    /// `{schema, path, track, stop: true}` alone, to let it go. Refused in words for anything else.
    pub fn take_play_of(body: &[u8]) -> Result<TakePlay, String> {
        const NOT: &str = "A take is played beside its part's Torus from its sound as the frame sends it (oi.take-play/v1): a head, then its samples";
        let n = body
            .get(..4)
            .map(|b| u32::from_le_bytes([b[0], b[1], b[2], b[3]]) as usize)
            .ok_or(NOT)?;
        let head: Value = body
            .get(4..4 + n)
            .and_then(|h| serde_json::from_slice(h).ok())
            .ok_or(NOT)?;
        let pcm = &body[4 + n..];
        if head["schema"] != TAKE_PLAY_SCHEMA || !pcm.len().is_multiple_of(4) {
            return Err(NOT.into());
        }
        let (Some(path), Some(track)) = (head["path"].as_str(), head["track"].as_u64()) else {
            return Err(NOT.into());
        };
        let (path, track) = (PathBuf::from(path), track as usize);
        if head["stop"] == Value::Bool(true) {
            return if pcm.is_empty() {
                Ok(TakePlay::Stop { path, track })
            } else {
                Err(NOT.into())
            };
        }
        let (Some(rate), Some(from), Some(heard_at_ms), Some(name)) = (
            head["rate"].as_u64().and_then(|r| u32::try_from(r).ok()),
            head["from"].as_str().and_then(|f| f.parse::<u64>().ok()),
            head["heard_at_ms"].as_f64(),
            head["name"].as_str(),
        ) else {
            return Err(NOT.into());
        };
        if pcm.is_empty() {
            return Err(NOT.into());
        }
        Ok(TakePlay::Play {
            path,
            track,
            rate,
            from,
            heard_at_ms,
            name: name.to_string(),
            pcm: pcm
                .as_chunks::<4>()
                .0
                .iter()
                .map(|c| f32::from_le_bytes(*c))
                .collect(),
        })
    }

    impl Opened {
        /// A sealed take played beside its part's Torus, or let go (O-I #855 round 25; DLW build ruling 2026-11-05: "native
        /// candidate: through the engine as a take player on the Torus part, mixed beside the live Torus", "The take is source
        /// material and plays through the part's current chain"): its sound, as its owner rendered it, added to what the part's
        /// Torus makes from the engine frame heard when the frame names it heard ([`frame_heard_in`]) — from its frame `from`,
        /// on by the time between then and now when that is already past, so it sounds on where the frame has it — through the
        /// Torus's effects as they stand and the part's own chain, volume, pan and sends ([`EngineHandle::play_beside`]); it
        /// gives way to the take played there before. Let go, the part's Torus alone from the next block. Answered with the
        /// take played, as the reading names it. Refused in words for another set than the one open, another rate than the
        /// engine's, a track that is no MIDI part, a take that has ended by the time it is heard, and a time not near now.
        pub fn take_play(&mut self, take: &TakePlay, now_ms: f64) -> Result<Value, String> {
            let (path, track) = match take {
                TakePlay::Play { path, track, .. } | TakePlay::Stop { path, track } => {
                    (path, *track)
                }
            };
            if *path != self.path {
                return Err(format!(
                    "The engine has another set open ({}): a take plays beside the Torus of the set it lies under",
                    self.path.display()
                ));
            }
            let part = self.part_of(track)?;
            let TakePlay::Play {
                rate,
                from,
                heard_at_ms,
                name,
                pcm,
                ..
            } = take
            else {
                let id = self
                    .handle
                    .play_beside(part, Vec::new())
                    .map_err(|e| format!("The engine did not let the take go: {e}"))?;
                self.beside.push((id, part, Vec::new()));
                self.take_played = None;
                return Ok(Value::Null);
            };
            if *rate != ENGINE_RATE {
                return Err(format!(
                    "The take was rendered at {rate} Hz and the engine runs at {ENGINE_RATE} Hz: it does not resample"
                ));
            }
            let Due::AtFrame(at) =
                frame_heard_in(&self.handle, heard_in_ms(*heard_at_ms, now_ms)?)?
            else {
                return Err("The engine names no frame the take is heard at".into());
            };
            let late =
                ((now_ms - heard_at_ms).max(0.0) / 1000.0 * f64::from(ENGINE_RATE)).round() as u64;
            let from = from.saturating_add(late);
            let frames = (pcm.len() as u64)
                .checked_sub(from)
                .filter(|f| *f > 0)
                .ok_or_else(|| {
                    format!(
                        "{name} has ended by the time it is heard: nothing of it is left to play"
                    )
                })?;
            let laid = live_engine::LaidSample {
                at,
                from,
                frames,
                gain: 1.0,
                channels: 1,
                pcm: pcm.as_slice().into(),
            };
            let id = self
                .handle
                .play_beside(part, vec![laid.clone()])
                .map_err(|e| format!("The engine did not play {name}: {e}"))?;
            self.beside.push((id, part, vec![laid]));
            let played =
                json!({"track": track, "name": name, "at": at, "from": from, "frames": frames});
            self.take_played = Some(played.clone());
            Ok(played)
        }

        /// The part the set's track `index` is in the engine (`index` the set owner's: its parts, returns and
        /// groups in order, then the Main track), counted among its parts; refused in words for one that is
        /// not a part.
        pub fn part_of(&self, index: usize) -> Result<usize, String> {
            let tracks: Vec<&Element> = self
                .document
                .find("LiveSet")
                .and_then(|ls| ls.child("Tracks"))
                .map(|t| {
                    t.children
                        .iter()
                        .filter(|t| {
                            matches!(
                                t.name.as_str(),
                                "AudioTrack" | "MidiTrack" | "ReturnTrack" | "GroupTrack"
                            )
                        })
                        .collect()
                })
                .unwrap_or_default();
            let is_part = |t: &Element| matches!(t.name.as_str(), "AudioTrack" | "MidiTrack");
            match tracks.get(index) {
                Some(t) if is_part(t) => Ok(tracks[..index].iter().filter(|t| is_part(t)).count()),
                _ => Err(format!(
                    "The set's track {index} is no part of the set's: a take is played on a part"
                )),
            }
        }

        /// Export Audio of a take through its part (O-I #855; DLW build ruling 2026-11-05: the sample-playback
        /// source "unblocks #855's export through the part's effects"; manual §21.2, "What Export Audio renders is
        /// what you heard, sample for sample"): the take's sound as the Torus's owner rendered it laid where the
        /// Torus stands on its part (live-engine `SampleInstrument`), through the part's rack — the Torus's effects
        /// as the frame held them, each put at its frame as the engine puts them while it plays (`torus_chain`,
        /// live-engine `Graph::rack`) — its own chain and its volume and pan, as the set opened in the engine;
        /// the part alone, as its own track renders: not its sends, its group, the returns or the Main track.
        /// Its effects ring out past the take's end ([`TAKE_RING_OUT`], live-engine `Graph::render_ringing_out`), as
        /// they rang on while it played. Answered as a 32-bit float stereo WAV of the take's frames and its tail, with
        /// what it holds: the take's frames, the tail's, and whether the tail was cut at the most. Refused in words for
        /// another set than the one open, another rate than the engine's, a track that is no MIDI part, and
        /// effects that are not the frame's.
        pub fn render_take_wav(&self, take: &TakeRender) -> Result<(Vec<u8>, Value), String> {
            let (graph, racks, stood, frames, name) = self.take_graph(take, false)?;
            let rung = graph.render_ringing_out(
                ENGINE_RATE,
                &live_engine::Performance::silent(frames),
                Vec::new(),
                racks,
                Vec::new(),
                TAKE_RING_OUT,
            );
            Ok((
                wav_f32(&rung.samples, ENGINE_RATE),
                json!({"frames": frames, "part": name, "effects": stood, "tail": rung.tail, "cut": rung.cut}),
            ))
        }

        /// A take's part alone, as [`Opened::render_take_wav`] and [`Opened::freeze`] render it: the set as it opened in the
        /// engine, the take's sound laid where the Torus stands on its part and the Torus's effects put at their frames, the
        /// other parts, the returns and the groups silent and the Main track at unity with none of its devices; with
        /// `chain_only`, the part's own volume and pan at unity and centre too, so what it renders is the part's chain alone,
        /// as Live's Freeze renders a track (its mixer stays live). Answered with the racks, the effects as they stood, the
        /// take's frames and the part's name. Refused in words as [`Opened::render_take_wav`] says.
        #[allow(clippy::type_complexity)]
        fn take_graph(
            &self,
            take: &TakeRender,
            chain_only: bool,
        ) -> Result<
            (
                Graph,
                Vec<(u64, usize, Vec<RackDevice>)>,
                Vec<Value>,
                u64,
                String,
            ),
            String,
        > {
            if take.path != self.path {
                return Err(format!(
                    "The engine has another set open ({}): a take renders through its part in the set it is a take of",
                    self.path.display()
                ));
            }
            if take.rate != ENGINE_RATE {
                return Err(format!(
                    "The take was rendered at {} Hz and the engine runs at {ENGINE_RATE} Hz: it does not resample",
                    take.rate
                ));
            }
            let part = self.part_of(take.track)?;
            let mut graph = self.graph_as_opened()?;
            if !graph.tracks[part].is_midi() {
                return Err(format!(
                    "'{}' is an audio part: a take of the Torus is played on a MIDI part",
                    graph.tracks[part].name
                ));
            }
            let mut racks = Vec::new();
            let mut stood = Vec::new();
            for (frame, effects) in &take.effects {
                let (made, reading) = torus_chain(effects)?;
                racks.push((*frame, part, rack_of(&made)?));
                stood.push(json!({"frame": frame, "effects": reading}));
            }
            let frames = take.pcm.len() as u64;
            let sample = live_engine::LaidSample {
                at: 0,
                from: 0,
                frames,
                gain: 1.0,
                channels: 1,
                pcm: take.pcm.as_slice().into(),
            };
            for (i, t) in graph.tracks.iter_mut().enumerate() {
                if i == part {
                    t.instrument = Some(Box::new(live_engine::SampleInstrument {
                        sample: sample.clone(),
                    }));
                    (t.group, t.solo, t.active) = (None, false, true);
                    if chain_only {
                        (t.gain, t.pan) = (1.0, 0.0);
                    }
                } else {
                    (t.active, t.solo) = (false, false);
                }
            }
            for g in graph.groups.iter_mut() {
                g.solo = false;
            }
            for r in graph.returns.iter_mut() {
                r.active = false;
            }
            (graph.master.gain, graph.master.pan) = (1.0, 0.0);
            graph.master.devices.clear();
            let name = graph.tracks[part].name.clone();
            Ok((graph, racks, stood, frames, name))
        }

        /// Freeze a take of a row on its part (O-I #849 round 22; DLW build ruling 2026-11-05: "a true Torus per row
        /// player, through the engine, as Live's Freeze Track does"): one Torus rings at a time, so a row's take that does
        /// not hold it is rendered — its sound as the Torus's owner rendered it, through the Torus's effects as they moved
        /// and the part's own chain ([`Opened::take_graph`], its chain alone: "Effects moves are rendered into the take, as
        /// Freeze renders the whole chain") — and laid on its part from the engine frame its landing sample falls on, the
        /// part playing it in place of its chain until it ends and through its own volume, pan and sends
        /// ([`EngineHandle::freeze`]); then the part's chain is heard again, "as a clip returns at its end". The frame of
        /// the owner's sample is the Torus the engine follows: the frame it took the hand-over at, on by the owner's
        /// samples since the sample it stood at. A take frozen on the part before gives way to it. Answered with the
        /// registry's reading. Refused in words for a take with no landing, one that lands before the Torus the engine
        /// follows, while it follows none it has taken, and as [`Opened::render_take_wav`] refuses.
        pub fn freeze(&mut self, take: &TakeRender) -> Result<Value, String> {
            let landed = take
                .landed
                .ok_or("A take is frozen on its part from the owner's sample it lands at, and this one names none")?;
            let (graph, racks, _, frames, _) = self.take_graph(take, true)?;
            let rendered = graph.render_performance_remade(
                ENGINE_RATE,
                &live_engine::Performance::silent(frames),
                Vec::new(),
                racks,
                Vec::new(),
            );
            let part = self.part_of(take.track)?;
            let (taken, stood) = self.torus_anchor().ok_or(FREEZE_UNANCHORED)?;
            let at = taken
                + landed.checked_sub(stood).ok_or(
                    "The take lands before the Torus the engine follows stood, so it cannot be frozen there",
                )?;
            let name = take.name.clone().unwrap_or_else(|| "The take".into());
            let takes = vec![live_engine::LaidSample {
                at,
                from: 0,
                frames,
                gain: 1.0,
                channels: 2,
                pcm: rendered.into(),
            }];
            let id = self
                .handle
                .freeze(part, takes.clone())
                .map_err(|e| format!("The engine did not freeze {name}: {e}"))?;
            self.refrozen.push((id, part, takes));
            for f in self.frozen.iter_mut().filter(|f| f.track == take.track) {
                f.unfrozen = true;
            }
            self.frozen.push(FrozenTake {
                id,
                track: take.track,
                name,
                at,
                frames,
                unfrozen: false,
            });
            Ok(self.frozen_reading())
        }

        /// Unfreeze (O-I #849 round 22; DLW build ruling 2026-11-05: Unfreeze "returns the part to its live Torus"): the
        /// takes frozen on the set's track `track` are let go from the engine's next block, and the part's chain is heard
        /// from there. Answered with the registry's reading. Refused in words for a track that is no part.
        pub fn unfreeze(&mut self, track: usize) -> Result<Value, String> {
            let part = self.part_of(track)?;
            let id = self
                .handle
                .freeze(part, Vec::new())
                .map_err(|e| format!("The engine did not let the frozen take go: {e}"))?;
            self.refrozen.push((id, part, Vec::new()));
            for f in self.frozen.iter_mut().filter(|f| f.track == track) {
                f.unfrozen = true;
            }
            Ok(self.frozen_reading())
        }

        /// The engine frame the part following the Torus's owner took the hand-over it holds at, and the owner's sample
        /// that hand-over stood at; None while it follows none, or the engine has not taken it.
        pub fn torus_anchor(&mut self) -> Option<(u64, u64)> {
            let bound = self.following.bound.clone()?;
            self.handle.collect();
            self.toruses
                .iter()
                .rposition(|t| t.handover == bound.handover)
                .and_then(|index| {
                    let &(taken, _) = self.handle.installs().get(index)?;
                    Some((taken, self.toruses[index].at_samples_elapsed))
                })
        }

        /// The set as the engine was handed it when it opened: bridged again from the document, each part's
        /// samples laid again as they were laid then (never read again from beside the set).
        pub fn graph_as_opened(&self) -> Result<Graph, String> {
            let mut graph = bridged_only(&self.document)?.graph;
            for (track, samples) in graph.tracks.iter_mut().zip(&self.samples) {
                track.set_samples(samples.clone())?;
            }
            Ok(graph)
        }
    }

    /// A 32-bit IEEE float stereo WAV (format tag 3), as bytes.
    pub fn wav_f32(interleaved: &[f32], sample_rate: u32) -> Vec<u8> {
        wav_f32_of(interleaved, sample_rate, 2)
    }

    /// A 32-bit IEEE float WAV (format tag 3) of `channels` interleaved channels, as bytes.
    pub fn wav_f32_of(interleaved: &[f32], sample_rate: u32, channels: u16) -> Vec<u8> {
        let data = (interleaved.len() * 4) as u32;
        let block = 4 * channels;
        let mut bytes = Vec::with_capacity(44 + data as usize);
        bytes.extend_from_slice(b"RIFF");
        bytes.extend_from_slice(&(36 + data).to_le_bytes());
        bytes.extend_from_slice(b"WAVEfmt ");
        bytes.extend_from_slice(&16u32.to_le_bytes());
        bytes.extend_from_slice(&3u16.to_le_bytes());
        bytes.extend_from_slice(&channels.to_le_bytes());
        bytes.extend_from_slice(&sample_rate.to_le_bytes());
        bytes.extend_from_slice(&(sample_rate * u32::from(block)).to_le_bytes());
        bytes.extend_from_slice(&block.to_le_bytes());
        bytes.extend_from_slice(&32u16.to_le_bytes());
        bytes.extend_from_slice(b"data");
        bytes.extend_from_slice(&data.to_le_bytes());
        for s in interleaved {
            bytes.extend_from_slice(&s.to_le_bytes());
        }
        bytes
    }

    /// The words Export Audio refuses in when the person closes the save
    /// dialog without choosing a file.
    pub const EXPORT_CANCELLED: &str =
        "Export Audio was cancelled: no file was chosen, so nothing was written.";

    /// Consolidate on an audio part (O-I #743): the set at `path` as its owner reads it now, the audio part `track`'s clips
    /// across beats `from`–`to` rendered alone at [`ENGINE_RATE`] (live-engine `render_clips_alone`: none of the part's
    /// chain or row), handed to `keep` as a 32-bit float WAV's bytes (the kernel's Live owner keeps it beside the set and
    /// lays the clip that plays it: `live_audio_consolidate`); its answer carries, in `unplayed`, the words for each clip of
    /// the stretch the engine did not play. The engine need not hold the set.
    pub fn consolidate(
        path: &Path,
        track: usize,
        from: f64,
        to: f64,
        keep: impl FnOnce(&[u8]) -> Result<Value, String>,
    ) -> Result<Value, String> {
        let root = set_document(path)?;
        let alone =
            live_engine::bridge::render_clips_alone(&root, path, track, from, to, ENGINE_RATE)?;
        let mut kept = keep(&wav_f32(&alone.pcm, ENGINE_RATE))?;
        if let Value::Object(fields) = &mut kept {
            fields.insert("unplayed".into(), json!(said(&alone.warnings)));
        }
        Ok(kept)
    }

    /// Crop on an audio clip (DLW build ruling 2026-11-05: "an audio clip's sample is cut to a new file beside the set, the way
    /// Consolidate keeps one"): the stretch of the clip's sample its owner names (live-set `crop_source`: its loop or its start
    /// to its end, or the selection's), cut by the engine from the file the clip plays (live-engine `cut_sample`: a WAV or an
    /// AIFF, at the file's own rate and with its own channels, silence where the stretch runs past the file), handed to `keep` as a 32-bit
    /// float WAV's bytes (the kernel's Live owner keeps it beside the set and crops the clip to play it: `live_audio_crop`).
    /// The engine need not hold the set; the host writes no file.
    pub fn crop(
        path: &Path,
        track: usize,
        clip: live_set::edit::ClipAt,
        span: Option<(f64, f64)>,
        keep: impl FnOnce(&[u8]) -> Result<Value, String>,
    ) -> Result<Value, String> {
        let source = live_set::acts::crop_source(&path.to_string_lossy(), track, clip, span)?;
        let cut =
            live_engine::bridge::cut_sample(&source.file, source.from_seconds, source.to_seconds)?;
        let channels = u16::try_from(cut.channels)
            .map_err(|_| "The clip's sample has more channels than a WAV holds".to_string())?;
        keep(&wav_f32_of(&cut.samples, cut.sample_rate, channels))
    }

    /// The host's state: at most one open set, and what the Torus's owner told it. The follow lock is
    /// taken before the set's, and the kernel's field lock is taken only under them, never around them.
    #[derive(Default)]
    pub struct LiveEngineHost(pub Arc<Mutex<Option<Opened>>>, pub Mutex<Follow>);

    impl LiveEngineHost {
        fn with<T>(&self, act: impl FnOnce(&mut Opened) -> Result<T, String>) -> Result<T, String> {
            let mut open = self
                .0
                .lock()
                .map_err(|_| "the engine host is poisoned".to_string())?;
            let opened = open
                .as_mut()
                .ok_or("No set is open in the engine: live_engine_open {path} first")?;
            act(opened)
        }

        /// `live_engine_open`: the kernel admits the set (`admit`: the
        /// Live owner's `live_engine_admits`, a set it can read and has read)
        /// before the host reads a byte of it; refused, the engine keeps
        /// what it had open.
        pub fn open_admitted(
            &self,
            path: &Path,
            admit: impl FnOnce(&str) -> Result<(), String>,
        ) -> Result<Value, String> {
            admit(&path.to_string_lossy())?;
            self.open(path)
        }

        /// After the set's owner kept a clip's sample anew beside the set at `path` (Consolidate's or Crop's, O-I #849 round
        /// 21): the engine holding that set lays its parts' samples again from the set as it now stands
        /// ([`Opened::lay_again`]), answered as the parts laid again, or the words it was refused in; None while the engine
        /// holds no such set. A stopped engine is handed them too, and never takes them: Play opens the set again as it
        /// stands.
        pub fn lay_again(&self, path: &Path) -> Result<Option<Value>, String> {
            let mut open = self
                .0
                .lock()
                .map_err(|_| "the engine host is poisoned".to_string())?;
            let Some(o) = open.as_mut().filter(|o| o.path == path) else {
                return Ok(None);
            };
            Ok(Some(match o.lay_again() {
                Ok(parts) => json!({"laid": parts}),
                Err(words) => json!({"refused": words}),
            }))
        }

        /// The answer of an owner's act that kept a clip's sample anew beside the set at `path`, with what the engine
        /// did of it as `engine` ([`LiveEngineHost::lay_again`]); the answer as it was while the engine holds no such set.
        pub fn kept_and_laid(&self, path: &Path, mut kept: Value) -> Result<Value, String> {
            if let (Some(engine), Value::Object(fields)) = (self.lay_again(path)?, &mut kept) {
                fields.insert("engine".into(), engine);
            }
            Ok(kept)
        }

        pub fn open(&self, path: &Path) -> Result<Value, String> {
            let mut opened = Opened::open(path)?;
            let reading = opened.reading();
            // the previous set's output stops as its engine drops
            *self
                .0
                .lock()
                .map_err(|_| "the engine host is poisoned".to_string())? = Some(opened);
            Ok(reading)
        }

        pub fn play(&self) -> Result<Value, String> {
            self.with(|o| {
                if o.player.is_none() {
                    let core = match o.core.take() {
                        Some(core) => core,
                        // stopped: the engine went with its output; play the
                        // set again from its start
                        None => {
                            let Opened {
                                document,
                                warnings,
                                handle,
                                core,
                                clips,
                                samples,
                                samples_said,
                                ..
                            } = Opened::open(&o.path)?;
                            (o.document, o.warnings, o.handle, o.clips) =
                                (document, warnings, handle, clips);
                            // the new engine was handed the samples beside the set now: Export lays those
                            (o.samples, o.samples_said) = (samples, samples_said);
                            // a new engine holds no Torus, follows no owner and holds none of its
                            // effects: the owner hands it over again, its effects with it
                            o.toruses.clear();
                            o.following = Following::default();
                            o.effects = TorusEffects::default();
                            o.racked.clear();
                            o.made_again.clear();
                            o.relaid.clear();
                            // a new engine holds no frozen take: the row launched again freezes it again
                            o.refrozen.clear();
                            o.frozen.clear();
                            // nor a take played beside the Torus: the frame plays it again as its scene plays on
                            o.beside.clear();
                            o.take_played = None;
                            core.ok_or("the engine was not made")?
                        }
                    };
                    o.player = Some(EnginePlayer::start(core).map_err(|e| e.to_string())?);
                }
                Ok(o.reading())
            })
        }

        pub fn stop(&self) -> Result<Value, String> {
            self.with(|o| {
                o.player = None;
                // the stopped engine strikes nothing more: its part follows the owner no longer
                o.following.bound = None;
                Ok(o.reading())
            })
        }

        pub fn send(&self, event: EventIn) -> Result<Value, String> {
            self.with(|o| o.send(event))
        }

        pub fn mixer(&self) -> Result<Value, String> {
            self.with(|o| Ok(o.reading()))
        }

        /// The notes due on the part following the Torus's owner, as its owner's acts
        /// ([`Opened::torus_notes`]), or None.
        pub fn torus_notes(&self) -> Option<Value> {
            self.0.lock().ok()?.as_mut()?.torus_notes()
        }

        /// `live_engine_torus`: the part `track` takes the Torus its owner under `lease` handed over by
        /// `sha256` (`document`, as the kernel kept it) and follows that owner from then on — every act it
        /// lands struck at its sample, every later hand-over taken in the last one's place. The owner may
        /// have handed it over again since the page was told the digest: then the part takes that one
        /// (`kept` answers the kernel's latest). The acts landed since the hand-over the part takes are
        /// struck first. A hand the engine has not taken yet gives way to this one. `heard_in_ms`: how
        /// long from now until the frame would have played the sample its owner handed the Torus over at
        /// (round 13): the part takes it at the engine's frame heard then ([`frame_heard_in`]), so the
        /// part sounds on from where the frame stops, in step with its picture; without it, at once.
        #[allow(clippy::too_many_arguments)]
        pub fn bind_torus(
            &self,
            lease: &str,
            track: usize,
            sha256: &str,
            document: &Value,
            notes: Option<Notes>,
            effects: Option<&Value>,
            heard_in_ms: Option<f64>,
            kept: impl Fn(&str, &str) -> Result<Value, String>,
        ) -> Result<Value, String> {
            let follow = self
                .1
                .lock()
                .map_err(|_| "the engine host is poisoned".to_string())?;
            self.with(|o| {
                let since = follow.since.as_ref().filter(|s| s.lease == lease);
                let later = since
                    .filter(|s| s.sha256 != sha256)
                    .and_then(|s| Some((s.sha256.as_str(), kept(lease, &s.sha256).ok()?)));
                let (sha256, document) = match &later {
                    Some((sha256, document)) => (*sha256, document),
                    None => (sha256, document),
                };
                let due = match heard_in_ms {
                    Some(ms) => frame_heard_in(&o.handle, ms)?,
                    None => Due::Now,
                };
                let handover = o.hand_torus(track, sha256, document, Takes::Instead(due))?;
                let bound = Bound {
                    lease: lease.to_owned(),
                    track,
                    sha256: sha256.to_owned(),
                    handover,
                    notes,
                };
                o.following = Following {
                    bound: Some(bound.clone()),
                    ..Following::default()
                };
                if let Some(since) = since.filter(|s| s.sha256 == sha256) {
                    o.following.missed += since.dropped;
                    for told in &since.acts {
                        o.follow(&bound, told);
                    }
                }
                // its effects go with it: one that cannot be put there leaves the Torus sounding,
                // and its words stand in the reading
                if let Some(effects) = effects {
                    let _ = o.put_effects(track, effects);
                }
                Ok(o.reading())
            })
        }

        /// `live_engine_torus_effects`: the Torus's effects as the frame now holds them, put on the part
        /// following its owner, its room made again once the edits pause as the frame's is
        /// ([`Opened::put_effects_paced`], [`ROOM_PAUSE`]: the reading says a room waits). Refused in
        /// words while no part follows it.
        pub fn torus_effects(&self, effects: &Value) -> Result<Value, String> {
            let (reading, waiting) = self.with(|o| {
                let track = o.following.bound.as_ref().map(|b| b.track).ok_or(
                    "No part sounds the Torus here: Play hands it over, and its effects go with it",
                )?;
                let waiting = o.put_effects_paced(track, effects)?;
                Ok((o.reading(), waiting))
            })?;
            if let Some(edit) = waiting {
                let open = Arc::clone(&self.0);
                std::thread::spawn(move || {
                    std::thread::sleep(ROOM_PAUSE);
                    if let Ok(mut open) = open.lock() {
                        if let Some(o) = open.as_mut() {
                            // a refusal stands in the reading (put_effects keeps it)
                            let _ = o.put_waiting_room(edit);
                        }
                    }
                });
            }
            Ok(reading)
        }

        /// What the Torus's owner told the host (the kernel's tap), followed into the engine: a hand-over
        /// is taken by the bound part in the last one's place (`kept` answers the document by its digest);
        /// an act is struck on the bound part when it follows the hand-over that part holds, and is kept
        /// for a part bound later. Nothing is answered: what could not be struck stands in the reading.
        pub fn tapped(&self, told: TorusTap, kept: impl Fn(&str, &str) -> Result<Value, String>) {
            let (Ok(mut follow), Ok(mut open)) = (self.1.lock(), self.0.lock()) else {
                return;
            };
            match told {
                TorusTap::HandedOver { lease, sha256 } => {
                    follow.since = Some(Since {
                        lease: lease.clone(),
                        sha256: sha256.clone(),
                        acts: Vec::new(),
                        dropped: 0,
                    });
                    let Some(o) = open.as_mut() else { return };
                    let Some(bound) = o
                        .following
                        .bound
                        .clone()
                        .filter(|b| b.lease == lease && b.sha256 != sha256)
                    else {
                        return;
                    };
                    let taken = kept(&lease, &sha256).and_then(|document| {
                        o.hand_torus(bound.track, &sha256, &document, Takes::Continuing)
                    });
                    match taken {
                        Ok(handover) => {
                            o.following.handed_again += 1;
                            o.following.bound = Some(Bound {
                                sha256,
                                handover,
                                ..bound
                            });
                        }
                        Err(words) => o.following.refusal = Some(words),
                    }
                }
                TorusTap::Struck {
                    lease,
                    at_samples_elapsed,
                    impulses,
                } => Self::told(
                    &mut follow,
                    &mut open,
                    &lease,
                    Told::Struck(at_samples_elapsed, impulses),
                ),
                TorusTap::Heard {
                    lease,
                    at_samples_elapsed,
                    frames,
                    gains,
                } => Self::told(
                    &mut follow,
                    &mut open,
                    &lease,
                    Told::Heard(at_samples_elapsed, frames, gains),
                ),
                TorusTap::Voiced {
                    lease,
                    at_samples_elapsed,
                    notes,
                    made_way,
                } => Self::told(
                    &mut follow,
                    &mut open,
                    &lease,
                    Told::Voiced(at_samples_elapsed, notes, made_way),
                ),
            }
        }

        /// An act or a move of the owner under `lease`: followed on the bound part when it follows the
        /// hand-over that part holds, and kept for a part bound later.
        fn told(follow: &mut Follow, open: &mut Option<Opened>, lease: &str, told: Told) {
            let Some(since) = follow.since.as_mut().filter(|s| s.lease == lease) else {
                return;
            };
            if let Some(o) = open.as_mut() {
                if let Some(bound) = o
                    .following
                    .bound
                    .clone()
                    .filter(|b| b.lease == lease && b.sha256 == since.sha256)
                {
                    o.follow(&bound, &told);
                }
            }
            if since.acts.len() < SINCE_ACTS {
                since.acts.push(told);
            } else {
                since.dropped += 1;
            }
        }

        /// Export Audio of a take through its part ([`Opened::render_take_wav`]), from its sound as the frame
        /// sends it ([`take_render_of`]): the WAV's bytes, for the frame to save. Refused in words when no set is
        /// open in the engine.
        pub fn render_take(&self, body: &[u8]) -> Result<Vec<u8>, String> {
            let take = take_render_of(body)?;
            self.with(|o| o.render_take_wav(&take)).map(|(wav, _)| wav)
        }

        /// A row's take frozen on its part ([`Opened::freeze`], O-I #849 round 22), from its sound as the frame sends it
        /// ([`take_render_of`], with the owner's sample it lands at and its name): the registry of frozen takes as it now
        /// stands. Refused in words when no set is open in the engine.
        pub fn freeze(&self, body: &[u8]) -> Result<Value, String> {
            let take = take_render_of(body)?;
            self.with(|o| o.freeze(&take))
        }

        /// Unfreeze on the set's track `track` ([`Opened::unfreeze`]): the registry as it now stands.
        pub fn unfreeze(&self, track: usize) -> Result<Value, String> {
            self.with(|o| o.unfreeze(track))
        }

        /// A sealed take played beside its part's Torus, or let go ([`Opened::take_play`], O-I #855 round 25), from its sound
        /// as the frame sends it ([`take_play_of`]), heard when the frame names: the take played. Refused in words when no set
        /// is open in the engine.
        pub fn take_play(&self, body: &[u8]) -> Result<Value, String> {
            let take = take_play_of(body)?;
            let now_ms = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map_err(|e| e.to_string())?
                .as_secs_f64()
                * 1000.0;
            self.with(|o| o.take_play(&take, now_ms))
        }

        /// Export Audio: `choose` asks the person where the file goes (the
        /// host's save dialog, given the file name it suggests: the set's,
        /// as a .wav) and `write` is the owner that writes it (the kernel's
        /// Live owner: the set's path, the chosen file, the WAV's bytes).
        /// Refused before the dialog when no set is open; a cancelled
        /// dialog is refused in [`EXPORT_CANCELLED`]'s words; neither
        /// renders or writes anything. The dialog is never asked while the
        /// engine's state is held.
        pub fn export_chosen(
            &self,
            choose: impl FnOnce(&str) -> Option<PathBuf>,
            write: impl FnOnce(&Path, &Path, &[u8]) -> Result<Value, String>,
        ) -> Result<Value, String> {
            let set = self.with(|o| Ok(o.path.clone()))?;
            let suggested = format!(
                "{}.wav",
                set.file_stem()
                    .map(|s| s.to_string_lossy())
                    .unwrap_or_default()
            );
            let chosen = choose(&suggested).ok_or(EXPORT_CANCELLED)?;
            if !chosen.is_absolute()
                || chosen
                    .extension()
                    .is_none_or(|e| !e.eq_ignore_ascii_case("wav"))
            {
                return Err("Export Audio writes a .wav file: choose a name ending in .wav".into());
            }
            let (wav, rendered) = self.with(|o| {
                if o.path != set {
                    return Err(
                        "Another set opened in the engine while the file was chosen: export again"
                            .into(),
                    );
                }
                o.render_wav()
            })?;
            let mut written = write(&set, &chosen, &wav)?;
            if let (Value::Object(fields), Value::Object(more)) = (&mut written, rendered) {
                fields.extend(more);
            }
            Ok(written)
        }
    }

    #[cfg(test)]
    mod tests {
        use super::*;
        use live_engine::Performance;

        /// A set of two MIDI parts playing Operator — Keys with Echo on its
        /// chain and a send to the return, Bass panned with a Glue — a return
        /// track with Echo, and the Main track: written as Live keeps a set
        /// (gzipped XML), into the test's own temporary folder.
        const SET: &str = r#"<?xml version="1.0" encoding="UTF-8"?>
<Ableton MajorVersion="5"><LiveSet>
  <Tracks>
    <MidiTrack Id="1"><Name><EffectiveName Value="Keys" /></Name>
      <DeviceChain>
        <Mixer><Sends><TrackSendHolder Id="0"><Send><Manual Value="0.5" /></Send></TrackSendHolder></Sends>
          <Speaker><Manual Value="true" /></Speaker><Pan><Manual Value="0" /></Pan><Volume><Manual Value="1" /></Volume><SoloSink Value="false" /></Mixer>
        <MainSequencer><ClipTimeable><ArrangerAutomation><Events>
          <MidiClip Id="2" Time="0"><CurrentStart Value="0" /><CurrentEnd Value="2" />
            <Loop><LoopStart Value="0" /><LoopEnd Value="2" /><StartRelative Value="0" /><LoopOn Value="false" /></Loop>
            <Notes><KeyTracks><KeyTrack Id="3"><MidiKey Value="69" /><Notes>
              <MidiNoteEvent Time="0" Duration="0.25" Velocity="100" IsEnabled="true" />
            </Notes></KeyTrack></KeyTracks></Notes>
          </MidiClip>
        </Events></ArrangerAutomation></ClipTimeable></MainSequencer>
        <DeviceChain><Devices><Operator Id="4" /><Echo Id="5" /></Devices></DeviceChain>
      </DeviceChain>
    </MidiTrack>
    <MidiTrack Id="6"><Name><EffectiveName Value="Bass" /></Name>
      <DeviceChain>
        <Mixer><Sends><TrackSendHolder Id="0"><Send><Manual Value="0.0003162277571" /></Send></TrackSendHolder></Sends>
          <Pan><Manual Value="-0.5" /></Pan><Volume><Manual Value="0.5" /></Volume></Mixer>
        <MainSequencer><ClipTimeable><ArrangerAutomation><Events>
          <MidiClip Id="7" Time="0"><CurrentStart Value="0" /><CurrentEnd Value="2" />
            <Loop><LoopStart Value="0" /><LoopEnd Value="2" /><StartRelative Value="0" /><LoopOn Value="false" /></Loop>
            <Notes><KeyTracks><KeyTrack Id="8"><MidiKey Value="45" /><Notes>
              <MidiNoteEvent Time="0.5" Duration="0.5" Velocity="100" IsEnabled="true" />
            </Notes></KeyTrack></KeyTracks></Notes>
          </MidiClip>
        </Events></ArrangerAutomation></ClipTimeable></MainSequencer>
        <DeviceChain><Devices><Operator Id="9" /><GlueCompressor Id="10" /></Devices></DeviceChain>
      </DeviceChain>
    </MidiTrack>
    <ReturnTrack Id="11"><Name><EffectiveName Value="A-Echo" /></Name>
      <DeviceChain><Mixer><Volume><Manual Value="0.7" /></Volume></Mixer>
        <DeviceChain><Devices><Echo Id="12" /></Devices></DeviceChain></DeviceChain>
    </ReturnTrack>
  </Tracks>
  <SendsPre><SendPreBool Id="0" Value="false" /></SendsPre>
  <MainTrack><DeviceChain><Mixer><Tempo><Manual Value="120" /></Tempo><Volume><Manual Value="0.9" /></Volume></Mixer>
    <DeviceChain><Devices /></DeviceChain></DeviceChain></MainTrack>
</LiveSet></Ableton>"#;

        fn write_set(name: &str, xml: &str) -> PathBuf {
            let dir = std::env::temp_dir()
                .join(format!("oi-live-engine-host-{}-{name}", std::process::id()));
            std::fs::create_dir_all(&dir).unwrap();
            let path = dir.join(format!("{name}.als"));
            let root = live_set::xml::parse(xml).unwrap();
            std::fs::write(&path, live_set::write_gz(&root).unwrap()).unwrap();
            path
        }

        fn pull(core: &mut EngineCore, blocks: &[usize]) -> Vec<f32> {
            let mut played = Vec::new();
            for n in blocks {
                let mut out = vec![0f32; n * 2];
                core.pull_block(&mut out);
                played.extend_from_slice(&out);
            }
            played
        }

        const BLOCKS: [usize; 8] = [256, 256, 512, 128, 1024, 2048, 4096, 8192];

        /// The frame's effects as effectsLaw.ts opens them (EFFECT_LAW's initial values), with `chain`.
        fn effects(chain: &[&str]) -> Value {
            json!({"chain": chain,
                "filter": {"on": true, "type": "lowpass", "cutoff": 8000, "resonance": 20, "drive": 0, "mix": 100},
                "dynamics": {"on": true, "threshold": -12, "ratio": 4, "attack": 1, "release": 100, "makeup": 2},
                "delay": {"on": true, "sync": true, "division": "1/8", "time": 250, "feedback": 35, "tone": 6000, "mix": 25, "tempo": 120},
                "reverb": {"on": true, "size": 50, "decay": 2.4, "damping": 40, "predelay": 20, "mix": 22},
                "resonator": {"on": true, "division": 300, "root": 0, "decay": 1, "tilt": 0, "span": 2, "mix": 50, "gain": 0}})
        }

        /// A take's sound as the frame sends it (`oi.take-render/v1`): `head`, then `pcm`.
        fn take_body(head: &Value, pcm: &[f32]) -> Vec<u8> {
            let head = serde_json::to_vec(head).unwrap();
            let mut body = (head.len() as u32).to_le_bytes().to_vec();
            body.extend_from_slice(&head);
            body.extend(pcm.iter().flat_map(|x| x.to_le_bytes()));
            body
        }

        /// A set of one MIDI part (Keys: Operator, then Echo on its own chain, at 0.8) and an audio part, no returns,
        /// the Main track at unity: what plays is Keys' own track.
        const ONE_PART_SET: &str = r#"<?xml version="1.0" encoding="UTF-8"?>
<Ableton MajorVersion="5"><LiveSet>
  <Tracks>
    <MidiTrack Id="1"><Name><EffectiveName Value="Keys" /></Name>
      <DeviceChain>
        <Mixer><Volume><Manual Value="0.8" /></Volume></Mixer>
        <MainSequencer><ClipTimeable><ArrangerAutomation><Events>
          <MidiClip Id="2" Time="0"><CurrentStart Value="0" /><CurrentEnd Value="2" />
            <Loop><LoopStart Value="0" /><LoopEnd Value="2" /><StartRelative Value="0" /><LoopOn Value="false" /></Loop>
            <Notes><KeyTracks><KeyTrack Id="3"><MidiKey Value="69" /><Notes>
              <MidiNoteEvent Time="0" Duration="0.25" Velocity="100" IsEnabled="true" />
              <MidiNoteEvent Time="0.5" Duration="0.25" Velocity="90" IsEnabled="true" />
            </Notes></KeyTrack></KeyTracks></Notes>
          </MidiClip>
        </Events></ArrangerAutomation></ClipTimeable></MainSequencer>
        <DeviceChain><Devices><Operator Id="4" /><Echo Id="5" /></Devices></DeviceChain>
      </DeviceChain>
    </MidiTrack>
    <AudioTrack Id="6"><Name><EffectiveName Value="Vox" /></Name><DeviceChain><Mixer /></DeviceChain></AudioTrack>
  </Tracks>
  <MainTrack><DeviceChain><Mixer><Tempo><Manual Value="120" /></Tempo><Volume><Manual Value="1" /></Volume></Mixer>
    <DeviceChain><Devices /></DeviceChain></DeviceChain></MainTrack>
</LiveSet></Ableton>"#;

        /// O-I #849 round 22 (DLW build ruling 2026-11-05: "a true Torus per row player, through the engine, as Live's Freeze
        /// Track does"): a row's take that does not hold the Torus is frozen on its own part — its sound through the Torus's
        /// effects and the part's chain alone (the part's mixer at unity: what Export of the take renders with the part's
        /// volume at unity and its pan at centre) — from the engine frame its landing falls on (the frame the Torus the
        /// engine follows was taken at, on by the owner's samples since it stood), in place of the part's chain until it
        /// ends, through the part's own volume and pan; the registry says it waits, sounds and ends, and Export Audio is
        /// what was played. Unfreeze lets it go. While the engine follows no Torus it has taken, it is refused in words.
        #[cfg(not(feature = "k8"))]
        #[test]
        fn a_rows_take_is_frozen_on_its_part_from_its_landing_until_it_ends_and_exports_as_played()
        {
            // the part the Torus is taken on keeps no note here, so the stand-in for its node changes nothing Export
            // makes again without it (a host without K8 makes no Torus again)
            let set = SET.replace(
                r#"<MidiNoteEvent Time="0" Duration="0.25" Velocity="100" IsEnabled="true" />"#,
                "",
            );
            let path = write_set("freeze", &set);
            let mut o = Opened::open(&path).unwrap();
            let mut core = o.core.take().unwrap();
            let burst: Vec<f32> = (0..4_800)
                .map(|i| (std::f32::consts::TAU * 330.0 * i as f32 / 48_000.0).sin() * 0.5)
                .collect();
            let head = json!({"schema": TAKE_RENDER_SCHEMA, "path": path, "track": 1, "rate": ENGINE_RATE,
                "effects": [{"frame": 0, "effects": effects(&["delay"])}], "landed": (4_800u64 + 12_000).to_string(), "name": "Bass take"});
            let take = take_render_of(&take_body(&head, &burst)).unwrap();
            assert_eq!(
                (take.landed, take.name.as_deref()),
                (Some(16_800), Some("Bass take"))
            );
            assert_eq!(
                o.freeze(&take),
                Err(FREEZE_UNANCHORED.to_string()),
                "no Torus followed yet"
            );
            pull(&mut core, &[128; 50]);
            o.handle
                .install(0, Box::new(live_engine::SilentInstrument))
                .unwrap();
            o.toruses.push(TorusOnPart {
                track: 0,
                sha256: "sha256:t".into(),
                at_samples_elapsed: 4_800,
                handover: 1,
                keys_refused: None,
            });
            o.following.bound = Some(Bound {
                lease: "lease:t".into(),
                track: 0,
                sha256: "sha256:t".into(),
                handover: 1,
                notes: None,
            });
            assert_eq!(
                o.freeze(&take),
                Err(FREEZE_UNANCHORED.to_string()),
                "nor while the engine has not taken it"
            );
            let mut played = pull(&mut core, &[128]);
            o.handle.collect();
            assert_eq!(o.handle.installs(), &[(6_400, 0)]);
            let at = 6_400 + 12_000;
            assert_eq!(
                o.freeze(&take).unwrap(),
                json!([{"track": 1, "name": "Bass take", "at": at, "frames": 4_800, "standing": "waiting"}])
            );
            // what is frozen is the take's part alone through its chain, at unity and centre: the take's export with the
            // part's volume at unity and its pan at centre, to the take's end
            let centred = write_set(
                "freeze-centred",
                &set.replace(
                    r#"<Pan><Manual Value="-0.5" /></Pan><Volume><Manual Value="0.5" /></Volume>"#,
                    r#"<Pan><Manual Value="0" /></Pan><Volume><Manual Value="1" /></Volume>"#,
                ),
            );
            let unity = Opened::open(&centred).unwrap();
            let mut as_unity = take_render_of(&take_body(&head, &burst)).unwrap();
            as_unity.path = centred.clone();
            let wav = live_engine::wav::read_wav_f32(&unity.render_take_wav(&as_unity).unwrap().0)
                .unwrap()
                .samples;
            let frozen = &o.refrozen[0].2[0];
            assert_eq!((frozen.at, frozen.frames, frozen.channels), (at, 4_800, 2));
            assert!(
                frozen
                    .pcm
                    .iter()
                    .zip(&wav[..2 * 4_800])
                    .all(|(a, b)| a.to_bits() == b.to_bits())
                    && frozen.pcm.len() == 2 * 4_800,
                "the part's chain alone, as Freeze renders it"
            );
            played.extend(pull(&mut core, &[128; 50]));
            assert_eq!(o.frozen_reading()[0]["standing"], "waiting");
            played.extend(pull(&mut core, &[128; 45]));
            assert_eq!(o.frozen_reading()[0]["standing"], "sounding");
            played.extend(pull(&mut core, &[128; 50]));
            assert_eq!(
                o.frozen_reading()[0]["standing"],
                "ended",
                "past its end, the part's chain again"
            );
            let (bytes, _) = o.render_wav().unwrap();
            let exported = live_engine::wav::read_wav_f32(&bytes).unwrap().samples;
            assert!(
                exported[2 * 6_400..]
                    .iter()
                    .zip(&played)
                    .all(|(e, p)| e.to_bits() == p.to_bits()),
                "Export Audio freezes it where the engine did: what was played"
            );
            assert_eq!(
                o.unfreeze(1).unwrap()[0]["standing"],
                "unfrozen",
                "Unfreeze lets it go"
            );
            assert_eq!(
                o.refrozen
                    .last()
                    .map(|(_, part, takes)| (*part, takes.len())),
                Some((1, 0))
            );
            assert!(
                o.unfreeze(5).unwrap_err().contains("no part"),
                "a track that is no part"
            );
            for set in [&path, &centred] {
                let _ = std::fs::remove_dir_all(set.parent().unwrap());
            }
        }

        /// O-I #855 round 25 (DLW build ruling 2026-11-05: "native candidate: through the engine as a take player on the Torus
        /// part, mixed beside the live Torus"): a sealed take's sound the frame sends is played beside its part's Torus from the
        /// engine frame heard when the frame names it heard, from the take's frame it names — on by the time already past when
        /// the frame names a time gone — through the part's chain; Export Audio plays it there again, so it is what was played;
        /// let go, the part sounds alone from the next block. What cannot be played is refused in words.
        #[test]
        fn a_sealed_take_is_played_beside_its_parts_torus_from_when_the_frame_hears_it_and_exports_as_played(
        ) {
            let path = write_set("take-play", ONE_PART_SET);
            let mut o = Opened::open(&path).unwrap();
            let mut core = o.core.take().unwrap();
            let burst: Vec<f32> = (0..9_600)
                .map(|i| (std::f32::consts::TAU * 220.0 * i as f32 / 48_000.0).sin() * 0.25)
                .collect();
            let play = |track: usize, rate: u32, from: &str, heard_at_ms: f64| {
                take_body(
                    &json!({"schema": TAKE_PLAY_SCHEMA, "path": path, "track": track, "rate": rate, "from": from,
                        "heard_at_ms": heard_at_ms, "name": "Take 1"}),
                    &burst,
                )
            };
            // the machine's wall clock the page and the host share: any time will do, as both name it
            let now = 1.7e12;
            let mut played = pull(&mut core, &[256]);
            let take = take_play_of(&play(0, ENGINE_RATE, "100", now)).unwrap();
            let reading = o.take_play(&take, now).unwrap();
            let at = reading["at"].as_u64().unwrap();
            assert!(
                at <= 256,
                "heard now: the frame the engine mixes now ({at})"
            );
            assert_eq!(
                reading,
                json!({"track": 0, "name": "Take 1", "at": at, "from": 100, "frames": 9_500})
            );
            // named heard 20 ms ago: it plays on from where the frame has it now
            let late = take_play_of(&play(0, ENGINE_RATE, "100", now - 20.0)).unwrap();
            let reading = o.take_play(&late, now).unwrap();
            assert_eq!(
                (reading["from"].as_u64(), reading["frames"].as_u64()),
                (Some(1_060), Some(8_540))
            );
            played.extend(pull(&mut core, &[256; 30]));
            o.handle.collect();
            assert_eq!(o.reading()["take_played"]["name"], "Take 1");
            let stop = take_play_of(&take_body(
                &json!({"schema": TAKE_PLAY_SCHEMA, "path": path, "track": 0, "stop": true}),
                &[],
            ))
            .unwrap();
            assert_eq!(
                stop,
                TakePlay::Stop {
                    path: path.clone(),
                    track: 0
                }
            );
            assert_eq!(o.take_play(&stop, now).unwrap(), Value::Null);
            assert_eq!(o.reading()["take_played"], Value::Null, "let go");
            played.extend(pull(&mut core, &[256; 10]));
            let (bytes, _) = o.render_wav().unwrap();
            let exported = live_engine::wav::read_wav_f32(&bytes).unwrap().samples;
            assert!(
                exported.len() == played.len()
                    && exported
                        .iter()
                        .zip(&played)
                        .all(|(e, p)| e.to_bits() == p.to_bits()),
                "Export Audio plays the take where the engine did: what was played"
            );
            let beside = std::mem::take(&mut o.beside);
            let (bytes, _) = o.render_wav().unwrap_or_default();
            assert!(
                bytes.is_empty()
                    || live_engine::wav::read_wav_f32(&bytes).unwrap().samples != played,
                "without it, Export would not render what was played"
            );
            o.beside = beside;
            let mut words = |body: Vec<u8>| o_words(&mut o, body, now);
            fn o_words(o: &mut Opened, body: Vec<u8>, now: f64) -> String {
                take_play_of(&body)
                    .and_then(|t| o.take_play(&t, now))
                    .unwrap_err()
            }
            assert!(words(play(1, ENGINE_RATE, "0", now)).contains(
                "'Vox' is an audio part: a take is played beside the instrument of a MIDI part"
            ));
            assert!(words(play(0, 44_100, "0", now)).contains("does not resample"));
            assert_eq!(
                words(play(0, ENGINE_RATE, "9600", now)),
                "Take 1 has ended by the time it is heard: nothing of it is left to play"
            );
            assert!(words(play(0, ENGINE_RATE, "0", now - 60_000.0)).contains("within"));
            assert!(words(b"no head".to_vec()).contains("oi.take-play/v1"));
            let elsewhere = take_body(
                &json!({"schema": TAKE_PLAY_SCHEMA, "path": "/elsewhere/Other.als", "track": 0, "rate": ENGINE_RATE, "from": "0",
                    "heard_at_ms": now, "name": "Take 1"}),
                &burst,
            );
            assert!(words(elsewhere).contains("The engine has another set open"));
            let _ = std::fs::remove_dir_all(path.parent().unwrap());
        }

        /// O-I #743 round 20, item 3, the engine gaps: a take's Export Audio rings its effects out past the take's end — the
        /// Torus's Delay and Reverb and the part's own Echo — as long as anything of them stands above −96 dBFS, and says how
        /// many frames it rang for and that it was not cut. To the take's end it is the export of the take alone; what
        /// follows its tail is silence under that floor (the same take, with as much silence again after it, renders the
        /// tail bit for bit and nothing above the floor after it).
        #[test]
        fn a_takes_export_rings_its_effects_out_past_its_end_and_says_how_long() {
            let path = write_set("take-tail", ONE_PART_SET);
            let o = Opened::open(&path).unwrap();
            let burst: Vec<f32> = (0..4_800)
                .map(|i| (std::f32::consts::TAU * 440.0 * i as f32 / 48_000.0).sin() * 0.5)
                .collect();
            let head = json!({"schema": TAKE_RENDER_SCHEMA, "path": path, "track": 0, "rate": ENGINE_RATE,
                "effects": [{"frame": 0, "effects": effects(&["delay", "reverb"])}]});
            let take = take_render_of(&take_body(&head, &burst)).unwrap();
            let (bytes, said) = o.render_take_wav(&take).unwrap();
            let exported = live_engine::wav::read_wav_f32(&bytes).unwrap().samples;
            let tail = said["tail"].as_u64().unwrap() as usize;
            assert!(
                tail > ENGINE_RATE as usize / 2,
                "it rings past the take's end: {tail} frames"
            );
            assert_eq!(
                (said["frames"].as_u64(), said["cut"].as_bool()),
                (Some(4_800), Some(false))
            );
            assert_eq!(exported.len(), 2 * (4_800 + tail));
            let floor = 10f32.powf(-96.0 / 20.0);
            assert!(
                exported[exported.len() - 2..]
                    .iter()
                    .any(|v| v.abs() > floor),
                "it ends on the last frame heard"
            );
            let mut padded = burst.clone();
            padded.resize(4_800 + tail + 5 * ENGINE_RATE as usize, 0.0);
            let longer = take_render_of(&take_body(&head, &padded)).unwrap();
            let (bytes, said) = o.render_take_wav(&longer).unwrap();
            let on = live_engine::wav::read_wav_f32(&bytes).unwrap().samples;
            assert_eq!(
                said["tail"].as_u64(),
                Some(0),
                "nothing heard past its own end"
            );
            assert!(
                on[..exported.len()]
                    .iter()
                    .zip(&exported)
                    .all(|(a, b)| a.to_bits() == b.to_bits()),
                "the tail as the take with silence after it renders it"
            );
            assert!(
                on[exported.len()..].iter().all(|v| v.abs() <= floor),
                "and nothing above the floor after it"
            );
        }

        /// O-I #855, Export Audio of a take through its part (DLW build ruling 2026-11-05): the take's sound as its owner
        /// rendered it, sent as the frame sends it, renders through its part's rack (the Torus's effects, put at the frame
        /// the engine put them), its chain and its row as the engine played the part, bit for bit; another rate, an audio
        /// part, a track that is no part and a body that is not one are refused in words.
        #[test]
        fn a_take_renders_through_its_parts_effects_as_the_engine_played_the_part() {
            let path = write_set("take-render", ONE_PART_SET);
            let mut o = Opened::open(&path).unwrap();
            let mut core = o.core.take().unwrap();
            let mut played = pull(&mut core, &[512, 256]);
            o.put_effects(0, &effects(&["filter", "delay"])).unwrap();
            played.extend(pull(&mut core, &[1_024, 4_096, 2_048, 8_192, 8_192]));
            o.handle.collect();
            assert_eq!(o.handle.racks(), &[(768, 0)]);
            let frames = played.len() / 2;
            // the take's sound: the part's instrument alone, as its owner renders it
            let mut alone = bridged_only(&o.document).unwrap().graph;
            alone.tracks[0].devices.clear();
            alone.tracks[0].gain = 1.0;
            let pcm: Vec<f32> = alone
                .render_performance(ENGINE_RATE, &Performance::silent(frames as u64))
                .chunks(2)
                .map(|f| f[0])
                .collect();
            let head = json!({"schema": TAKE_RENDER_SCHEMA, "path": path, "track": 0, "rate": ENGINE_RATE,
                "effects": [{"frame": 768, "effects": effects(&["filter", "delay"])}]});
            let take = take_render_of(&take_body(&head, &pcm)).unwrap();
            let (bytes, said) = o.render_take_wav(&take).unwrap();
            let exported = live_engine::wav::read_wav_f32(&bytes).unwrap().samples;
            // REPLACES (O-I #743 round 20, item 3): the export was the take's frames alone; its effects now ring out past
            // its end (`a_takes_export_rings_its_effects_out_past_its_end_and_says_how_long`), so the take's own frames are
            // compared, and the tail is the frames past them
            let tail = said["tail"].as_u64().unwrap() as usize;
            assert_eq!(exported.len(), played.len() + 2 * tail);
            assert!(
                exported[..played.len()]
                    .iter()
                    .zip(&played)
                    .all(|(e, p)| e.to_bits() == p.to_bits()),
                "the take renders through its part's effects as the engine played the part"
            );
            assert_eq!(
                (said["frames"].as_u64(), said["part"].as_str()),
                (Some(frames as u64), Some("Keys"))
            );
            assert_eq!(said["effects"][0]["effects"][0]["device"], "AutoFilter");
            let without = take_render_of(&take_body(&json!({"schema": TAKE_RENDER_SCHEMA, "path": path, "track": 0, "rate": ENGINE_RATE, "effects": []}), &pcm)).unwrap();
            assert_ne!(
                o.render_take_wav(&without).unwrap().0,
                bytes,
                "the Torus's effects are heard"
            );
            // refused in words
            let refused = |head: Value| {
                take_render_of(&take_body(&head, &pcm))
                    .and_then(|t| o.render_take_wav(&t).map(|_| ()))
                    .unwrap_err()
            };
            let words = refused(
                json!({"schema": TAKE_RENDER_SCHEMA, "path": path, "track": 0, "rate": 44_100, "effects": []}),
            );
            assert!(
                words.contains("44100 Hz") && words.contains("does not resample"),
                "{words}"
            );
            let words = refused(
                json!({"schema": TAKE_RENDER_SCHEMA, "path": path, "track": 1, "rate": ENGINE_RATE, "effects": []}),
            );
            assert!(words.contains("'Vox' is an audio part"), "{words}");
            let words = refused(
                json!({"schema": TAKE_RENDER_SCHEMA, "path": path, "track": 2, "rate": ENGINE_RATE, "effects": []}),
            );
            assert!(words.contains("track 2 is no part"), "{words}");
            let words = refused(
                json!({"schema": "x", "path": path, "track": 0, "rate": ENGINE_RATE, "effects": []}),
            );
            assert!(words.contains("oi.take-render/v1"), "{words}");
            let words = refused(
                json!({"schema": TAKE_RENDER_SCHEMA, "path": path, "track": 0, "rate": ENGINE_RATE, "effects": [{"frame": 0, "effects": {"chain": 3}}]}),
            );
            assert!(words.contains("effectsLaw.ts"), "{words}");
            let words = refused(
                json!({"schema": TAKE_RENDER_SCHEMA, "path": "/elsewhere/Other.als", "track": 0, "rate": ENGINE_RATE, "effects": []}),
            );
            assert!(words.contains("another set open"), "{words}");
            let words = refused(
                json!({"schema": TAKE_RENDER_SCHEMA, "track": 0, "rate": ENGINE_RATE, "effects": []}),
            );
            assert!(
                words.contains("oi.take-render/v1"),
                "a head that names no set: {words}"
            );
            let host = LiveEngineHost::default();
            assert!(host
                .render_take(&take_body(&head, &pcm))
                .unwrap_err()
                .contains("No set is open"));
            let _ = std::fs::remove_dir_all(path.parent().unwrap());
        }

        /// O-I #849 round 17: the room is made again as the frame makes its own (presentationEffects.ts `#roomFor`): the
        /// first at once; one made again while a room stands waits for the edits to pause, each edit taking the last one's
        /// place and what else it moves put at once, the room standing; once they pause the last edit's room is put, from
        /// the block that takes it; an edit back to the standing room waits for nothing and lets the waiting one go.
        #[test]
        fn a_room_made_again_waits_for_the_edits_to_pause_as_the_frames_does() {
            let path = write_set("room-pause", SET);
            let mut o = Opened::open(&path).unwrap();
            let mut core = o.core.take().unwrap();
            pull(&mut core, &[256]);
            assert_eq!(
                o.put_effects_paced(0, &effects(&["reverb"])).unwrap(),
                None,
                "the first room at once"
            );
            pull(&mut core, &[256]);
            let mut edited = effects(&["reverb"]);
            edited["reverb"]["decay"] = json!(1.2);
            let first = o.put_effects_paced(0, &edited).unwrap();
            assert!(first.is_some(), "a room made again waits");
            edited["reverb"]["decay"] = json!(3.0);
            edited["reverb"]["mix"] = json!(40);
            let second = o.put_effects_paced(0, &edited).unwrap();
            assert!(second > first, "the next edit takes its place");
            pull(&mut core, &[256]);
            o.handle.collect();
            assert_eq!(o.reading()["torus_effects"]["room_waiting"], true);
            assert_eq!(
                o.handle.racks(),
                &[(256, 0)],
                "no room made while the edits go on"
            );
            assert_eq!(room_of(&o.effects.made), Some([50.0, 2.4, 40.0]));
            let mix = |o: &Opened| {
                o.effects.made[0]
                    .1
                    .iter()
                    .find(|(k, _)| *k == "mix")
                    .map(|(_, v)| *v)
            };
            assert_eq!(
                mix(&o),
                Some(40.0),
                "the mix moved at once, the room standing"
            );
            o.put_waiting_room(first.unwrap()).unwrap();
            assert_eq!(
                room_of(&o.effects.made),
                Some([50.0, 2.4, 40.0]),
                "a later edit took its place"
            );
            o.put_waiting_room(second.unwrap()).unwrap();
            pull(&mut core, &[256]);
            o.handle.collect();
            assert_eq!(o.handle.racks(), &[(256, 0), (768, 0)]);
            assert_eq!(room_of(&o.effects.made), Some([50.0, 3.0, 40.0]));
            assert_eq!(o.reading()["torus_effects"]["room_waiting"], false);
            edited["reverb"]["decay"] = json!(1.0);
            let waiting = o.put_effects_paced(0, &edited).unwrap().unwrap();
            edited["reverb"]["decay"] = json!(3.0);
            assert_eq!(o.put_effects_paced(0, &edited).unwrap(), None);
            o.put_waiting_room(waiting).unwrap();
            assert_eq!(
                room_of(&o.effects.made),
                Some([50.0, 3.0, 40.0]),
                "an edit back to the standing room let the waiting one go"
            );
            // through the host, the room waiting is put once the edits have paused
            let host = LiveEngineHost::default();
            o.following.bound = Some(Bound {
                lease: "lease".into(),
                track: 0,
                sha256: "sha".into(),
                handover: 1,
                notes: None,
            });
            *host.0.lock().unwrap() = Some(o);
            edited["reverb"]["decay"] = json!(0.8);
            let reading = host.torus_effects(&edited).unwrap();
            assert_eq!(reading["torus_effects"]["room_waiting"], true);
            let paused = std::time::Instant::now();
            while host
                .0
                .lock()
                .unwrap()
                .as_ref()
                .unwrap()
                .room_waiting
                .is_some()
            {
                assert!(
                    paused.elapsed() < std::time::Duration::from_secs(10),
                    "the waiting room was never put"
                );
                std::thread::sleep(std::time::Duration::from_millis(5));
            }
            assert!(
                paused.elapsed() >= ROOM_PAUSE,
                "put once the edits paused, not before"
            );
            let o = host.0.lock().unwrap().take().unwrap();
            assert_eq!(room_of(&o.effects.made), Some([50.0, 0.8, 40.0]));
            std::fs::remove_dir_all(path.parent().unwrap()).unwrap();
        }

        /// The Torus's effects stand after it on its part (rounds 13 to 15): the frame's chain in its
        /// order, each effect as Live's device of its kind, with the frame's settings carried by Live's
        /// keys, and the engine's own (Auto Filter and Delay built to the Torus's effects from Live's keys,
        /// Dynamics and Reverb the frame's own, from the frame's settings); what Live's device does not hold
        /// stands at its edge, in words where the engine sounds it so; an effect off stands nowhere; an edit
        /// that moves nothing the chain is made from puts nothing again; Export renders the part through
        /// each chain from the frame the engine put it there, as it was played.
        #[test]
        fn the_torus_effects_stand_after_it_as_the_engines_own_devices_or_in_words() {
            let (made, reading) = torus_chain(&effects(&[
                "filter",
                "dynamics",
                "delay",
                "reverb",
                "resonator",
            ]))
            .unwrap();
            let cutoff = live_engine::auto_filter_cutoff(8000.0);
            assert!((live_engine::auto_filter_hz(cutoff) - 8000.0).abs() < 1e-9);
            // Live's Compressor's one-pole comes within a quarter dB of a held level in this many times
            let settles = -(1.0 - 10f64.powf(-0.25 / 20.0)).ln();
            assert!((TORUS_ATTACK_SETTLES - settles).abs() < 1e-12);
            assert!(
                (10f64.powf(-0.25 / 20.0) - (1.0 - (-TORUS_ATTACK_SETTLES).exp())).abs() < 1e-12
            );
            let dynamics: (&str, Vec<(&str, f64)>) = (
                "dynamics",
                vec![
                    ("threshold", -12.0),
                    ("ratio", 4.0),
                    ("attack", 1.0),
                    ("release", 100.0),
                    ("makeup", 2.0),
                ],
            );
            let reverb: (&str, Vec<(&str, f64)>) = (
                "reverb",
                vec![
                    ("size", 50.0),
                    ("decay", 2.4),
                    ("damping", 40.0),
                    ("predelay", 20.0),
                    ("mix", 22.0),
                ],
            );
            assert_eq!(
                made,
                vec![
                    (
                        "AutoFilter",
                        vec![
                            ("FilterType", 0.0),
                            ("Cutoff", cutoff),
                            ("Resonance", 0.2),
                            ("Drive", 0.0)
                        ]
                    ),
                    dynamics.clone(),
                    (
                        "Delay",
                        vec![
                            ("DelayLine_TimeL", 0.25),
                            ("Feedback", 0.35),
                            ("Filter_Frequency", 6000.0),
                            ("DryWet", 0.25)
                        ]
                    ),
                    reverb.clone()
                ]
            );
            for n in 0..4 {
                assert_eq!(reading[n]["sounds"], true, "{}", reading[n]);
                assert_eq!(reading[n]["words"], Value::Null, "{}", reading[n]);
            }
            assert_eq!(reading[0]["carried"]["Cutoff"], json!(cutoff));
            // a set's Live's Compressor and Reverb carry the frame's settings by Live's keys
            assert_eq!(
                reading[1]["carried"],
                json!({"Threshold": 10f64.powf(-0.6), "Ratio": 4.0, "Attack": 1.0 / TORUS_ATTACK_SETTLES,
                    "Release": 100.0, "Gain": 2.0, "Knee": 0.0})
            );
            assert_eq!(reading[2]["carried"]["DelayLine_TimeL"], json!(0.25));
            assert_eq!(
                reading[3]["carried"],
                json!({"DecayTime": 2400.0, "PreDelay": 20.0})
            );
            assert!(reading[4]["words"].as_str().unwrap().contains("Resonator"));
            // what Live's device does not hold stands at its nearer edge, and what it keeps no setting
            // for stands at its own, in words; an unsynced Delay's time is its own
            let mut edged = effects(&["filter", "delay"]);
            edged["filter"]["type"] = json!("notch");
            edged["filter"]["cutoff"] = json!(20000);
            edged["filter"]["mix"] = json!(60);
            edged["delay"]["division"] = json!("1");
            edged["delay"]["tempo"] = json!(40);
            let (made, reading) = torus_chain(&edged).unwrap();
            assert_eq!(made[0].1[..2], [("FilterType", 4.0), ("Cutoff", 135.0)]);
            assert_eq!(made[1].1[0], ("DelayLine_TimeL", 5.0));
            assert_eq!(
                reading[0]["words"],
                "Live's Auto Filter in the engine: its cutoff of 20000 Hz is over the 19912.1 Hz Live's Auto Filter holds, and stands there; its mix of 60 % stands at full: the corpus's surface of Live's Auto Filter keeps no dry/wet."
            );
            assert_eq!(
                reading[1]["words"],
                "Live's Delay in the engine: its time of 6 s is over the 5 s Live's Delay holds, and stands there."
            );
            edged["filter"]["cutoff"] = json!(20);
            edged["delay"]["sync"] = json!(false);
            edged["delay"]["time"] = json!(4000);
            let (made, reading) = torus_chain(&edged).unwrap();
            assert_eq!(made[0].1[1], ("Cutoff", 20.0));
            assert!(reading[0]["words"]
                .as_str()
                .unwrap()
                .contains("its cutoff of 20 Hz is under the 26 Hz"));
            assert_eq!(made[1].1[0], ("DelayLine_TimeL", 4.0));
            assert_eq!(reading[1]["words"], Value::Null);
            // Live's Compressor carries the frame's attack over the law, one quicker than it holds at its floor;
            // the engine sounds the frame's own, so nothing is said
            let mut quick = effects(&["dynamics"]);
            quick["dynamics"]["attack"] = json!(30);
            let (made, reading) = torus_chain(&quick).unwrap();
            assert_eq!(made[0].1[2], ("attack", 30.0));
            assert_eq!(
                reading[0]["carried"]["Attack"],
                json!(30.0 / TORUS_ATTACK_SETTLES)
            );
            assert_eq!(reading[0]["words"], Value::Null);
            quick["dynamics"]["attack"] = json!(0.02);
            let (made, reading) = torus_chain(&quick).unwrap();
            let (floor, _) = live_engine::live_holds("Compressor2", "Attack").unwrap();
            assert_eq!(made[0].1[2], ("attack", 0.02));
            assert_eq!(reading[0]["carried"]["Attack"], json!(floor));
            assert_eq!(reading[0]["words"], Value::Null);
            // so does Live's Reverb a pre-delay under what it holds
            let mut dry = effects(&["reverb"]);
            dry["reverb"]["predelay"] = json!(0);
            let (made, reading) = torus_chain(&dry).unwrap();
            assert_eq!(made[0].1[3], ("predelay", 0.0));
            let (least, _) = live_engine::live_holds("Reverb", "PreDelay").unwrap();
            assert_eq!(reading[0]["carried"]["PreDelay"], json!(least));
            assert_eq!(reading[0]["words"], Value::Null);
            // in the frame's order; an effect off stands nowhere
            let mut off = effects(&["reverb", "dynamics"]);
            assert_eq!(torus_chain(&off).unwrap().0, vec![reverb, dynamics.clone()]);
            off["reverb"]["on"] = json!(false);
            assert_eq!(torus_chain(&off).unwrap().0, vec![dynamics]);
            for (bad, words) in [
                (json!({}), "chain"),
                (
                    json!({"chain": ["chorus"], "chorus": {"on": true}}),
                    "no effect chorus",
                ),
                (
                    json!({"chain": ["reverb", "reverb"], "reverb": {"on": true, "decay": 1.0}}),
                    "twice",
                ),
                (json!({"chain": ["reverb"]}), "no settings"),
                (
                    json!({"chain": ["filter"], "filter": {"on": true, "type": "comb"}}),
                    "type is one of lowpass, highpass, bandpass, notch",
                ),
                (
                    json!({"chain": ["dynamics"], "dynamics": {"on": true}}),
                    "the threshold of its Dynamics is a number",
                ),
                (
                    json!({"chain": ["delay"], "delay": {"on": true, "sync": true, "division": "1/3"}}),
                    "division is one of 1/32",
                ),
            ] {
                let refused = torus_chain(&bad).unwrap_err();
                assert!(refused.contains(words), "{refused}");
            }
            // on the part: from the block that takes it, the part sounds through it
            let path = write_set("torus-effects", SET);
            let mut o = Opened::open(&path).unwrap();
            let mut core = o.core.take().unwrap();
            let mut played = pull(&mut core, &[256, 256]);
            o.put_effects(0, &effects(&["reverb"])).unwrap();
            played.extend(pull(&mut core, &[256; 30]));
            // an edit of an effect off the chain moves nothing
            let mut edited = effects(&["reverb"]);
            edited["delay"]["feedback"] = json!(80);
            o.put_effects(0, &edited).unwrap();
            assert_eq!(
                o.racked.len(),
                1,
                "a chain made as the one standing is not put again"
            );
            // the room's Decay moves it: the reverb is made again
            edited["reverb"]["decay"] = json!(1.2);
            o.put_effects(0, &edited).unwrap();
            played.extend(pull(&mut core, &[256; 10]));
            let reading = o.reading();
            assert_eq!(reading["torus_effects"]["track"], 0);
            assert_eq!(
                reading["torus_effects"]["chain"][0]["carried"],
                json!({"DecayTime": 1200.0, "PreDelay": 20.0})
            );
            assert_eq!(
                reading["torus_effects"]["sounding_from_frame"],
                512 + 256 * 30
            );
            assert_eq!(o.handle.racks(), &[(512, 0), (512 + 256 * 30, 0)]);
            // another part is refused, in words the reading keeps
            let refused = o.put_effects(1, &edited).unwrap_err();
            assert!(refused.contains("stand on part 0"), "{refused}");
            assert_eq!(o.reading()["torus_effects"]["refusal"], refused);
            // Export renders the part through each chain from where the engine put it
            let (bytes, _) = o.render_wav().unwrap();
            let wav = live_engine::wav::read_wav_f32(&bytes).unwrap();
            assert_eq!(wav.samples.len(), played.len());
            for (n, (e, p)) in wav.samples.iter().zip(&played).enumerate() {
                assert_eq!(
                    e.to_bits(),
                    p.to_bits(),
                    "sample {n}: Export is what was played"
                );
            }
            // and the chain is heard: the set alone renders otherwise
            let graph = o.graph_as_opened().unwrap();
            assert_ne!(
                graph.render_performance(ENGINE_RATE, &o.handle.performance()),
                played,
                "the Torus's effects are heard on its part"
            );
        }

        /// O-I #849 round 16: an edit of the Torus's effects that moves only settings their devices take
        /// while they play moves them in place: nothing is put again (so the room rings on and the
        /// lines keep their repeats), each setting is heard from the next block, and Export renders it as
        /// played. One that moves what makes a device (the Filter's kind) puts the chain again. The
        /// frame's 95 % feedback stands at the most Live's Delay holds, and sounds.
        #[test]
        fn a_torus_effect_moved_while_it_plays_moves_in_place_and_exports_as_played() {
            let chain = ["dynamics", "filter", "delay", "reverb"];
            let mut most = effects(&["delay"]);
            most["delay"]["feedback"] = json!(95);
            let (made, reading) = torus_chain(&most).unwrap();
            let (_, edge) = live_engine::live_holds("Delay", "Feedback").unwrap();
            assert_eq!(made[0].1[1], ("Feedback", edge));
            assert_eq!(reading[0]["sounds"], true, "{}", reading[0]);
            assert_eq!(reading[0]["words"], Value::Null, "{}", reading[0]);
            let path = write_set("torus-effects-moved", SET);
            let mut o = Opened::open(&path).unwrap();
            let mut core = o.core.take().unwrap();
            let mut played = pull(&mut core, &[256, 256]);
            o.put_effects(0, &effects(&chain)).unwrap();
            played.extend(pull(&mut core, &[256; 20]));
            let mut edited = effects(&chain);
            edited["dynamics"]["threshold"] = json!(-30);
            edited["filter"]["cutoff"] = json!(2000);
            edited["delay"]["feedback"] = json!(95);
            edited["delay"]["mix"] = json!(50);
            edited["reverb"]["predelay"] = json!(80);
            edited["reverb"]["mix"] = json!(60);
            o.put_effects(0, &edited).unwrap();
            played.extend(pull(&mut core, &[256; 20]));
            o.handle.collect();
            assert_eq!(o.racked.len(), 1, "nothing was put again");
            assert_eq!(o.handle.racks(), &[(512, 0)]);
            let moved: Vec<(&str, f64, u64)> = o
                .handle
                .performance()
                .events
                .iter()
                .filter_map(|e| match e.event {
                    EngineEvent::Set { key, value, .. } => Some((key, value, e.frame)),
                    _ => None,
                })
                .collect();
            let at = 512 + 256 * 20;
            assert_eq!(
                moved,
                vec![
                    ("threshold", -30.0, at),
                    ("Cutoff", live_engine::auto_filter_cutoff(2000.0), at),
                    ("Feedback", edge, at),
                    ("DryWet", 0.5, at),
                    ("predelay", 80.0, at),
                    ("mix", 60.0, at),
                ],
                "each setting moved, at the next block"
            );
            let reading = o.reading();
            assert_eq!(
                reading["torus_effects"]["chain"][3]["carried"],
                json!({"DecayTime": 2400.0, "PreDelay": 80.0})
            );
            assert_eq!(reading["torus_effects"]["sounding_from_frame"], 512);
            // the Filter's kind makes the filter: the chain is put again, its devices following
            edited["filter"]["type"] = json!("highpass");
            o.put_effects(0, &edited).unwrap();
            played.extend(pull(&mut core, &[256; 10]));
            o.handle.collect();
            assert_eq!(o.handle.racks(), &[(512, 0), (at + 256 * 20, 0)]);
            let (bytes, _) = o.render_wav().unwrap();
            let wav = live_engine::wav::read_wav_f32(&bytes).unwrap();
            assert_eq!(wav.samples.len(), played.len());
            for (n, (e, p)) in wav.samples.iter().zip(&played).enumerate() {
                assert_eq!(
                    e.to_bits(),
                    p.to_bits(),
                    "sample {n}: Export is what was played"
                );
            }
        }

        /// DLW build ruling 2026-11-05, round 21 item 3: the frame's Sound off reaches the engine. The effects the frame
        /// reports carry it (`muted`, the frame's Sound on and off) and the engine hears the Torus through the level that
        /// stands first on its chain at 0 while it is off, at the frame's level again when it is on (1 where the frame names
        /// none); a turn of it moves that level in place, from the next block, and Export renders it as played. Anything but on
        /// or off is refused in words.
        #[test]
        fn the_frames_sound_off_silences_the_toruss_part_through_its_level_in_place() {
            let mut with = effects(&["delay"]);
            with["level"] = json!(2);
            with["muted"] = json!(true);
            let (made, _) = torus_chain(&with).unwrap();
            assert_eq!(made[0], ("level", vec![("level", 0.0)]), "off: silent");
            with["muted"] = json!(false);
            assert_eq!(
                torus_chain(&with).unwrap().0[0],
                ("level", vec![("level", 2.0)])
            );
            let mut bare = effects(&["delay"]);
            bare["muted"] = json!(false);
            assert_eq!(
                torus_chain(&bare).unwrap().0[0],
                ("level", vec![("level", 1.0)]),
                "on with no level named: unity"
            );
            bare["muted"] = json!(true);
            assert_eq!(
                torus_chain(&bare).unwrap().0[0],
                ("level", vec![("level", 0.0)])
            );
            bare["muted"] = json!("off");
            let words = torus_chain(&bare).unwrap_err();
            assert!(words.contains("its sound is on or off"), "{words}");
            let path = write_set("torus-muted", SET);
            let mut o = Opened::open(&path).unwrap();
            let mut core = o.core.take().unwrap();
            let mut played = pull(&mut core, &[256, 256]);
            let mut chain = effects(&["filter", "delay"]);
            chain["level"] = json!(1.5);
            chain["muted"] = json!(false);
            o.put_effects(0, &chain).unwrap();
            played.extend(pull(&mut core, &[256; 20]));
            chain["muted"] = json!(true);
            o.put_effects(0, &chain).unwrap();
            played.extend(pull(&mut core, &[256; 20]));
            chain["muted"] = json!(false);
            o.put_effects(0, &chain).unwrap();
            played.extend(pull(&mut core, &[256; 4]));
            o.handle.collect();
            assert_eq!(o.racked.len(), 1, "nothing was put again");
            let moved: Vec<(&str, f64, u64)> = o
                .handle
                .performance()
                .events
                .iter()
                .filter_map(|e| match e.event {
                    EngineEvent::Set { key, value, .. } => Some((key, value, e.frame)),
                    _ => None,
                })
                .collect();
            assert_eq!(
                moved,
                vec![
                    ("level", 0.0, 512 + 256 * 20),
                    ("level", 1.5, 512 + 256 * 40)
                ],
                "off, then on again, each at the next block"
            );
            assert_eq!(o.reading()["torus_effects"]["level"], 1.5);
            let (bytes, _) = o.render_wav().unwrap();
            let wav = live_engine::wav::read_wav_f32(&bytes).unwrap();
            assert_eq!(wav.samples.len(), played.len());
            assert!(
                wav.samples
                    .iter()
                    .zip(&played)
                    .all(|(a, b)| a.to_bits() == b.to_bits()),
                "Export renders the turns as played"
            );
            let _ = std::fs::remove_dir_all(path.parent().unwrap());
        }

        /// O-I #743 round 20, item 3, the engine gaps: the engine hears the frame's level. The effects the frame reports carry
        /// it (`level`, the frame's presentation gain 0 to 4) and it stands first on the Torus's chain, before the effects, as
        /// in the frame (controller.ts `stage`); moved while it plays it moves in place, heard from the next block, and Export
        /// renders it as played; the engine's reading says the level it hears. One outside the frame's 0 to 4 is refused in
        /// words; effects that carry none put no level, as before.
        #[test]
        fn the_frames_level_stands_before_the_toruss_effects_and_moves_in_place() {
            let mut with = effects(&["delay"]);
            with["level"] = json!(2);
            let (made, reading) = torus_chain(&with).unwrap();
            assert_eq!(made[0], ("level", vec![("level", 2.0)]));
            assert_eq!(made[1].0, "Delay");
            assert_eq!(
                reading.as_array().unwrap().len(),
                1,
                "the chain's reading is its effects'"
            );
            let (made, _) = torus_chain(&effects(&["delay"])).unwrap();
            assert_eq!(made.len(), 1, "no level carried, none put");
            with["level"] = json!(5);
            let words = torus_chain(&with).unwrap_err();
            assert!(words.contains("0 to 4"), "{words}");
            let path = write_set("torus-level", SET);
            let mut o = Opened::open(&path).unwrap();
            let mut core = o.core.take().unwrap();
            let mut played = pull(&mut core, &[256, 256]);
            let mut chain = effects(&["filter", "delay"]);
            chain["level"] = json!(1);
            o.put_effects(0, &chain).unwrap();
            played.extend(pull(&mut core, &[256; 20]));
            chain["level"] = json!(2.5);
            o.put_effects(0, &chain).unwrap();
            played.extend(pull(&mut core, &[256; 20]));
            o.handle.collect();
            assert_eq!(o.racked.len(), 1, "nothing was put again");
            let moved: Vec<(&str, f64, u64)> = o
                .handle
                .performance()
                .events
                .iter()
                .filter_map(|e| match e.event {
                    EngineEvent::Set { key, value, .. } => Some((key, value, e.frame)),
                    _ => None,
                })
                .collect();
            assert_eq!(
                moved,
                vec![("level", 2.5, 512 + 256 * 20)],
                "the level moved, at the next block"
            );
            assert_eq!(o.reading()["torus_effects"]["level"], 2.5);
            let (bytes, _) = o.render_wav().unwrap();
            let wav = live_engine::wav::read_wav_f32(&bytes).unwrap();
            assert_eq!(wav.samples.len(), played.len());
            assert!(
                wav.samples
                    .iter()
                    .zip(&played)
                    .all(|(e, p)| e.to_bits() == p.to_bits()),
                "Export is what was played"
            );
        }

        #[test]
        fn the_host_plays_the_sets_two_parts_with_their_chains_returns_and_main() {
            let path = write_set("two-parts", SET);
            let mut opened = Opened::open(&path).unwrap();
            assert!(opened.warnings.is_empty(), "{:?}", opened.warnings);
            let reading = opened.reading();
            assert_eq!(reading["mixer"]["tracks"][1]["pan"], -0.5);
            assert_eq!(reading["mixer"]["returns"][0]["gain"], 0.7);
            let mut core = opened.core.take().unwrap();
            let played = pull(&mut core, &BLOCKS);
            // what the host plays is the engine's render of the document
            let (graph, _) = bridged(&set_document(&path).unwrap(), &path).unwrap();
            let frames = played.len() as u64 / 2;
            let rendered = graph.render_performance(ENGINE_RATE, &Performance::silent(frames));
            assert!(
                rendered == played,
                "the host's pull is the engine's render, sample for sample"
            );
            // two parts at once: each alone, summed, is the whole (no part
            // reaches the other)
            let alone = |keep: usize| {
                let (mut g, _) = bridged(&set_document(&path).unwrap(), &path).unwrap();
                g.tracks[1 - keep].active = false;
                g.render_performance(ENGINE_RATE, &Performance::silent(frames))
            };
            let (keys, bass) = (alone(0), alone(1));
            assert!(
                keys.iter().any(|v| *v != 0.0) && bass.iter().any(|v| *v != 0.0),
                "both parts sound"
            );
            for (n, (p, (k, b))) in played.iter().zip(keys.iter().zip(&bass)).enumerate() {
                assert!((p - (k + b)).abs() < 1e-6, "sample {n}: {p} vs {k} + {b}");
            }
            // Bass is panned left: its right channel is the lighter one
            let (l, r): (f64, f64) = bass.chunks(2).fold((0.0, 0.0), |(l, r), f| {
                (l + (f[0] as f64).powi(2), r + (f[1] as f64).powi(2))
            });
            assert!(l > r * 2.0, "Bass panned left: L {l} R {r}");
        }

        /// A set of one audio part ("Vox", at half volume) with an unwarped clip of `Samples/Recorded/vox.wav` at beat
        /// 0.25 for 0.1 beats from 0.02 s into its sample, and a warped clip after it.
        const AUDIO_SET: &str = r#"<?xml version="1.0" encoding="UTF-8"?>
<Ableton MajorVersion="5"><LiveSet>
  <Tracks>
    <AudioTrack Id="1"><Name><EffectiveName Value="Vox" /></Name>
      <DeviceChain><Mixer><Volume><Manual Value="0.5" /></Volume></Mixer>
        <MainSequencer><Sample><ArrangerAutomation><Events>
          <AudioClip Id="2" Time="0.25"><CurrentStart Value="0.25" /><CurrentEnd Value="0.35" />
            <Loop><LoopStart Value="0.02" /><LoopEnd Value="0.07" /><StartRelative Value="0" /><LoopOn Value="false" /></Loop>
            <Name Value="Vox" /><IsWarped Value="false" /><SampleVolume Value="1" />
            <SampleRef><FileRef><RelativePathType Value="3" /><RelativePath Value="Samples/Recorded/vox.wav" /><Path Value="" /></FileRef></SampleRef>
          </AudioClip>
          <AudioClip Id="3" Time="1"><CurrentStart Value="1" /><CurrentEnd Value="2" />
            <Name Value="Stretched" /><IsWarped Value="true" />
            <SampleRef><FileRef><RelativePath Value="Samples/Recorded/vox.wav" /></FileRef></SampleRef>
          </AudioClip>
        </Events></ArrangerAutomation></Sample></MainSequencer>
        <DeviceChain><Devices /></DeviceChain>
      </DeviceChain>
    </AudioTrack>
  </Tracks>
  <MainTrack><DeviceChain><Mixer><Tempo><Manual Value="120" /></Tempo><Volume><Manual Value="1" /></Volume></Mixer>
    <DeviceChain><Devices /></DeviceChain></DeviceChain></MainTrack>
</LiveSet></Ableton>"#;

        /// Consolidate on an audio part (O-I #743): the host renders the part's clips alone across the stretch, from
        /// the set as it stands and with no engine open, and hands the kernel's owner that render as a WAV; what it did
        /// not play of the stretch's clips comes back in the answer's words.
        #[test]
        fn consolidate_hands_the_owner_the_parts_clips_rendered_alone_as_a_wav() {
            let path = write_set("consolidate", AUDIO_SET);
            let folder = path.parent().unwrap().join("Samples/Recorded");
            std::fs::create_dir_all(&folder).unwrap();
            let sample: Vec<f32> = (0..2 * 4_800)
                .map(|i| ((i % 480) as f32 / 480.0 - 0.5) * 0.4)
                .collect();
            std::fs::write(folder.join("vox.wav"), wav_f32(&sample, ENGINE_RATE)).unwrap();
            let mut handed = Vec::new();
            let answer = consolidate(&path, 0, 0.0, 2.0, |wav| {
                handed = wav.to_vec();
                Ok(json!({"done": "kept"}))
            })
            .unwrap();
            assert_eq!(answer["unplayed"], json!(["Vox: its clip 'Stretched' is warped, and the engine plays unwarped clips first: it is silent"]));
            let wav = live_engine::wav::read_wav(&handed).unwrap();
            assert_eq!(
                (wav.channels, wav.sample_rate, wav.samples.len()),
                (2, ENGINE_RATE, 2 * 48_000),
                "two beats at 120 BPM"
            );
            // Vox from its start marker (0.02 s in) at beat 0.25, at its clip gain: the part's half volume is not in it.
            assert_eq!(wav.samples[2 * 6_000].to_bits(), sample[2 * 960].to_bits());
            assert_eq!(wav.samples[2 * 8_400], 0.0, "and silence after its clip");
            let refused =
                consolidate(&path, 0, 4.0, 6.0, |_| unreachable!("nothing to keep")).unwrap_err();
            assert!(
                refused.contains("No clip of Vox sounds between beat 4 and beat 6"),
                "{refused}"
            );
            let _ = std::fs::remove_dir_all(path.parent().unwrap());
        }

        /// Crop on an audio clip (DLW build ruling 2026-11-05): the host cuts the stretch of the clip's sample its owner
        /// names from the file beside the set, at the file's own rate and channels, silence past its end, and hands the
        /// kernel's owner the cut as a WAV; a clip with no sound to cut is refused in its owner's words.
        #[test]
        fn crop_hands_the_owner_the_clips_stretch_of_its_sample_cut_from_the_file() {
            let path = write_set("crop", AUDIO_SET);
            let folder = path.parent().unwrap().join("Samples/Recorded");
            std::fs::create_dir_all(&folder).unwrap();
            let sample: Vec<f32> = (0..2 * 4_800).map(|i| i as f32 / 9_600.0).collect();
            std::fs::write(folder.join("vox.wav"), wav_f32(&sample, ENGINE_RATE)).unwrap();
            let at = live_set::edit::ClipAt::Arrangement(0);
            let mut handed = Vec::new();
            let answer = crop(&path, 0, at, None, |wav| {
                handed = wav.to_vec();
                Ok(json!({"done": "kept"}))
            })
            .unwrap();
            assert_eq!(answer, json!({"done": "kept"}));
            let wav = live_engine::wav::read_wav(&handed).unwrap();
            assert_eq!(
                (wav.channels, wav.sample_rate, wav.samples.len()),
                (2, ENGINE_RATE, 2 * 2_400),
                "Vox's 0.02–0.07 seconds"
            );
            assert_eq!(
                wav.samples[0].to_bits(),
                sample[2 * 960].to_bits(),
                "from its start marker"
            );
            assert_eq!(
                wav.samples[2 * 2_400 - 1].to_bits(),
                sample[2 * 3_360 - 1].to_bits(),
                "to its end"
            );
            // A mono file shorter than the stretch: one channel, and silence where the file runs out.
            let mono: Vec<f32> = (0..2_000).map(|i| (i + 1) as f32).collect();
            std::fs::write(folder.join("vox.wav"), wav_f32_of(&mono, ENGINE_RATE, 1)).unwrap();
            let mut handed = Vec::new();
            crop(&path, 0, at, None, |wav| {
                handed = wav.to_vec();
                Ok(json!({}))
            })
            .unwrap();
            let wav = live_engine::wav::read_wav(&handed).unwrap();
            assert_eq!((wav.channels, wav.samples.len()), (1, 2_400));
            assert_eq!(wav.samples[0], 961.0);
            assert_eq!(wav.samples[1_039], 2_000.0, "the file's last frame");
            assert_eq!(wav.samples[1_040], 0.0, "and silence after it");
            let refused = crop(
                &path,
                0,
                live_set::edit::ClipAt::Arrangement(1),
                None,
                |_| unreachable!("nothing to keep"),
            )
            .unwrap_err();
            assert!(refused.contains("loop markers"), "{refused}");
            let _ = std::fs::remove_dir_all(path.parent().unwrap());
        }

        /// O-I #849 round 21: a clip's sample its owner kept anew while the set plays (here Crop's, over a selection of
        /// Vox) is laid in the engine from the next block, from the set as it now stands: what the cut keeps sounds as it
        /// did, the rest of the clip falls silent where the cropped clip now ends, and Export Audio renders what was
        /// played. The engine holding another set is handed nothing; while the set's parts are not those it opened, it
        /// is refused in words.
        #[test]
        fn a_sample_kept_anew_while_the_set_plays_is_laid_from_the_next_block_and_exports_as_played(
        ) {
            use sha2::Digest;
            let path = write_set("lay-again", AUDIO_SET);
            let folder = path.parent().unwrap().join("Samples/Recorded");
            std::fs::create_dir_all(&folder).unwrap();
            let sample: Vec<f32> = (0..2 * 4_800).map(|i| i as f32 / 9_600.0 + 0.125).collect();
            std::fs::write(folder.join("vox.wav"), wav_f32(&sample, ENGINE_RATE)).unwrap();
            let still = {
                let (g, _) = bridged(&set_document(&path).unwrap(), &path).unwrap();
                g.render_performance(ENGINE_RATE, &Performance::silent(3 * 4_096))
            };
            let host = LiveEngineHost::default();
            host.open(&path).unwrap();
            let mut core = host
                .0
                .lock()
                .unwrap()
                .as_mut()
                .unwrap()
                .core
                .take()
                .unwrap();
            let mut played = pull(&mut core, &[4_096]);
            let revision = format!(
                "sha256:{:x}",
                sha2::Sha256::digest(std::fs::read(&path).unwrap())
            );
            let (at, span) = (live_set::edit::ClipAt::Arrangement(0), Some((0.25, 0.3)));
            let kept = crop(&path, 0, at, span, |wav| {
                live_set::acts::crop_audio(&path.to_string_lossy(), &revision, 0, at, span, wav)
            })
            .unwrap();
            assert_eq!(
                host.kept_and_laid(&path, kept).unwrap()["engine"],
                json!({"laid": ["Vox"]})
            );
            played.extend(pull(&mut core, &[4_096, 4_096]));
            // Vox at beat 0.25 (frame 6 000) for 0.1 beats; cropped to 0.05, it ends at frame 7 200
            assert!(
                played[..2 * 7_200]
                    .iter()
                    .zip(&still)
                    .all(|(p, s)| p.to_bits() == s.to_bits()),
                "what the cut keeps sounds as it did"
            );
            assert!(
                still[2 * 7_200..2 * 8_400].iter().all(|v| *v != 0.0)
                    && played[2 * 7_200..2 * 8_400].iter().all(|v| *v == 0.0),
                "the rest of the clip falls silent where the cropped clip now ends"
            );
            let (bytes, _) = host
                .0
                .lock()
                .unwrap()
                .as_mut()
                .unwrap()
                .render_wav()
                .unwrap();
            let wav = live_engine::wav::read_wav_f32(&bytes).unwrap();
            assert!(
                wav.samples == played,
                "Export Audio is what the engine played"
            );
            let other = write_set("lay-again-other", AUDIO_SET);
            assert_eq!(
                host.lay_again(&other).unwrap(),
                None,
                "the engine holds another set"
            );
            let renamed = live_set::xml::parse(&AUDIO_SET.replace("\"Vox\"", "\"Voice\"")).unwrap();
            std::fs::write(&path, live_set::write_gz(&renamed).unwrap()).unwrap();
            assert_eq!(
                host.lay_again(&path).unwrap(),
                Some(
                    json!({"refused": "The set's parts are not those the engine opened: Stop, then Play, to hear it as it now stands"})
                )
            );
            for set in [&path, &other] {
                let _ = std::fs::remove_dir_all(set.parent().unwrap());
            }
        }

        /// Item 5 on the sample-playback source (DLW build ruling 2026-11-05): the host lays an audio part's unwarped
        /// clip from its sample beside the set, so the part plays it at its clip's frame, from its start marker, through
        /// its row; a warped clip is named silent in the reading's warnings; and Export Audio renders what was played,
        /// bit for bit, though the file beside the set changed after the set opened.
        #[test]
        fn an_audio_parts_clip_plays_its_sample_from_beside_the_set_and_exports_as_played() {
            let path = write_set("audio-clip", AUDIO_SET);
            let folder = path.parent().unwrap().join("Samples/Recorded");
            std::fs::create_dir_all(&folder).unwrap();
            let sample: Vec<f32> = (0..2 * 4_800)
                .map(|i| ((i % 480) as f32 / 480.0 - 0.5) * 0.4)
                .collect();
            std::fs::write(folder.join("vox.wav"), wav_f32(&sample, ENGINE_RATE)).unwrap();
            let mut opened = Opened::open(&path).unwrap();
            assert_eq!(
                opened.warnings,
                ["Vox: its clip 'Stretched' is warped, and the engine plays unwarped clips first: it is silent"]
            );
            assert_eq!(opened.reading()["warnings"][0], opened.warnings[0].as_str());
            let mut core = opened.core.take().unwrap();
            let played = pull(&mut core, &[1_024, 4_096, 512, 3_000]);
            for (f, frame) in played.chunks(2).enumerate() {
                for (c, got) in frame.iter().enumerate() {
                    let want = if (6_000..8_400).contains(&f) {
                        (sample[(960 + f - 6_000) * 2 + c] as f64 * 0.5) as f32
                    } else {
                        0.0
                    };
                    assert_eq!(got.to_bits(), want.to_bits(), "frame {f} side {c}");
                }
            }
            std::fs::write(
                folder.join("vox.wav"),
                wav_f32(&vec![0.9; 9_600], ENGINE_RATE),
            )
            .unwrap();
            let (bytes, _) = opened.render_wav().unwrap();
            let exported = live_engine::wav::read_wav_f32(&bytes).unwrap().samples;
            assert_eq!(exported.len(), played.len());
            assert!(
                exported
                    .iter()
                    .zip(&played)
                    .all(|(e, p)| e.to_bits() == p.to_bits()),
                "Export is what was played"
            );
            let _ = std::fs::remove_dir_all(path.parent().unwrap());
        }

        #[test]
        fn a_gated_device_on_a_chain_changes_what_the_host_plays() {
            // the same set without the Echo on Keys' chain
            let dry_set = SET.replace(
                r#"<Operator Id="4" /><Echo Id="5" />"#,
                r#"<Operator Id="4" />"#,
            );
            let (wet_path, dry_path) = (write_set("wet", SET), write_set("dry", &dry_set));
            let mut wet = Opened::open(&wet_path).unwrap();
            let mut dry = Opened::open(&dry_path).unwrap();
            let (w, d) = (
                pull(wet.core.as_mut().unwrap(), &BLOCKS),
                pull(dry.core.as_mut().unwrap(), &BLOCKS),
            );
            assert_eq!(w.len(), d.len());
            let diff = w.iter().zip(&d).filter(|(a, b)| a != b).count();
            assert!(
                diff > 10_000,
                "the Echo on Keys' chain changes what the host plays ({diff} samples differ)"
            );
            // and what changed is the device: Keys alone (Bass and the
            // return off, Main at unity), its wet chain is the bridged Echo
            // applied to its dry chain, sample for sample
            let frames = w.len() as u64 / 2;
            let keys_alone = |path: &Path| {
                let (mut g, _) = bridged(&set_document(path).unwrap(), path).unwrap();
                g.tracks[1].active = false;
                g.returns[0].active = false;
                g.master.gain = 1.0;
                g.render_performance(ENGINE_RATE, &Performance::silent(frames))
            };
            let (kw, kd) = (keys_alone(&wet_path), keys_alone(&dry_path));
            let (mut g, _) = bridged(&set_document(&wet_path).unwrap(), &wet_path).unwrap();
            let mut echo = g.tracks[0].devices.remove(0);
            assert_eq!(echo.name(), "Echo");
            echo.prepare(ENGINE_RATE, 2);
            let mut clock = live_engine::Clock::start(ENGINE_RATE, 120.0);
            for n in 0..frames as usize {
                clock.sample = n as u64;
                let mut f = [kd[n * 2], kd[n * 2 + 1]];
                echo.process(&mut f, &clock);
                assert!(
                    f[0] == kw[n * 2] && f[1] == kw[n * 2 + 1],
                    "frame {n}: {f:?} vs {:?}",
                    &kw[n * 2..n * 2 + 2]
                );
            }
        }

        /// O-I #853: a MIDI part's pitch bend, as the shell sends what the host decoded, reaches its
        /// Operator from the next block and Export renders it as played; a channel pressure the engine's
        /// Operator does not take is refused in its words.
        #[test]
        fn a_parts_pitch_bend_reaches_its_operator_and_a_pressure_it_does_not_take_is_refused() {
            let path = write_set("bend", SET);
            let mut opened = Opened::open(&path).unwrap();
            let mut core = opened.core.take().unwrap();
            let event = |json: &str| {
                serde_json::from_str::<EventIn>(json).unwrap_or_else(|e| panic!("{json}: {e}"))
            };
            opened
                .send(event(
                    r#"{"kind":"note_on","track":1,"key":57,"velocity":100}"#,
                ))
                .unwrap();
            let mut played = pull(&mut core, &[512, 512]);
            opened
                .send(event(r#"{"kind":"bend","track":1,"amount":-0.5}"#))
                .unwrap();
            played.extend(pull(&mut core, &[512, 4096]));
            let refused = opened
                .send(event(r#"{"kind":"pressure","track":1,"amount":0.5}"#))
                .unwrap_err();
            assert!(
                refused.contains("plays the engine's Operator, which takes no channel pressure"),
                "{refused}"
            );
            let lacking = event(r#"{"kind":"bend","track":1}"#).event().unwrap_err();
            assert_eq!(lacking, "a bend event names its amount");
            let (bytes, exported) = opened.render_wav().unwrap();
            assert_eq!(exported["events"], 2);
            let wav = live_engine::wav::read_wav_f32(&bytes).unwrap();
            assert_eq!(wav.samples.len(), played.len());
            assert!(
                wav.samples
                    .iter()
                    .zip(&played)
                    .all(|(e, p)| e.to_bits() == p.to_bits()),
                "Export is what was played"
            );
            let unbent = {
                let mut o = Opened::open(&path).unwrap();
                let mut core = o.core.take().unwrap();
                o.send(event(
                    r#"{"kind":"note_on","track":1,"key":57,"velocity":100}"#,
                ))
                .unwrap();
                pull(&mut core, &[512, 512, 512, 4096])
            };
            let at = 2 * 1024;
            assert_eq!(played[..at], unbent[..at]);
            assert_ne!(
                played[at..],
                unbent[at..],
                "the bend is heard from the next block"
            );
        }

        /// [`SET`] with a group track, Bus (a send of 0.25 to the return), that Keys stands in.
        fn grouped() -> String {
            SET.replace(
                r#"<MidiTrack Id="1"><Name><EffectiveName Value="Keys" /></Name>"#,
                r#"<GroupTrack Id="20"><Name><EffectiveName Value="Bus" /></Name>
      <DeviceChain><Mixer><Sends><TrackSendHolder Id="0"><Send><Manual Value="0.25" /></Send></TrackSendHolder></Sends>
        <Volume><Manual Value="1" /></Volume></Mixer><DeviceChain><Devices /></DeviceChain></DeviceChain>
    </GroupTrack>
    <MidiTrack Id="1"><Name><EffectiveName Value="Keys" /></Name><TrackGroupId Value="20" />"#,
            )
        }

        /// O-I #849 round 17: a group's solo and its sends follow while it plays, named as the group's part; a send or a
        /// solo naming both a track and a part, or a return's, is refused in words.
        #[test]
        fn a_groups_solo_and_sends_follow_while_it_plays() {
            let path = write_set("group-follow", &grouped());
            let mut opened = Opened::open(&path).unwrap();
            let mut core = opened.core.take().unwrap();
            let event = |json: &str| {
                serde_json::from_str::<EventIn>(json).unwrap_or_else(|e| panic!("{json}: {e}"))
            };
            assert_eq!(opened.reading()["mixer"]["groups"][0]["sends"][0], 0.25);
            opened
                .send(event(r#"{"kind":"solo","part":{"group":0},"on":true}"#))
                .unwrap();
            opened
                .send(event(
                    r#"{"kind":"send","part":{"group":0},"send":0,"gain":0.125}"#,
                ))
                .unwrap();
            pull(&mut core, &[512]);
            let applied = opened.reading();
            assert_eq!(applied["mixer"]["groups"][0]["solo"], true, "{applied}");
            assert_eq!(applied["mixer"]["groups"][0]["sends"][0], 0.125);
            let both = opened
                .send(event(
                    r#"{"kind":"solo","track":0,"part":{"group":0},"on":true}"#,
                ))
                .unwrap_err();
            assert!(
                both.contains("names its track, or a part or a group as its part"),
                "{both}"
            );
            let ret = opened
                .send(event(
                    r#"{"kind":"send","part":{"return":0},"send":0,"gain":0.5}"#,
                ))
                .unwrap_err();
            assert!(ret.contains("return 0 has no solo and no sends"), "{ret}");
            std::fs::remove_dir_all(path.parent().unwrap()).unwrap();
        }

        /// O-I #849 round 17: a device's setting the set's owner wrote while the set plays is followed: the device is
        /// made again from what the set now stores and heard from the next block, what it does not take named in the
        /// reading's warnings, and Export Audio renders what was played. A part's instrument, a device the set does not
        /// have, and a device event that names neither, are refused in words.
        #[test]
        fn a_sets_device_edited_while_it_plays_is_made_again_in_the_engine_and_exports_as_played() {
            let xml = SET.replace(
                r#"<GlueCompressor Id="10" />"#,
                r#"<GlueCompressor Id="10"><Threshold><LomId Value="0" /><Manual Value="-40" /></Threshold>
                  <Range><LomId Value="0" /><Manual Value="30" /></Range></GlueCompressor>"#,
            );
            let path = write_set("device-follow", &xml);
            let still_path = write_set("device-still", &xml);
            let event = |json: &str| {
                serde_json::from_str::<EventIn>(json).unwrap_or_else(|e| panic!("{json}: {e}"))
            };
            let mut opened = Opened::open(&path).unwrap();
            let mut core = opened.core.take().unwrap();
            let mut still = Opened::open(&still_path).unwrap();
            let mut still_core = still.core.take().unwrap();
            let blocks = [512, 4096, 4096];
            let mut played = pull(&mut core, &blocks);
            let heard = pull(&mut still_core, &blocks);
            // the owner writes the Bass Glue's threshold, as the frame's device face does (kernel live_device_param_write)
            live_set::api::device_param_set(
                path.to_str().unwrap(),
                "Bass",
                "GlueCompressor",
                None,
                "Threshold",
                &json!(-12.0),
            )
            .unwrap();
            let device = r#"{"kind":"device","track_name":"Bass","device":"GlueCompressor"}"#;
            opened.send(event(device)).unwrap();
            let after = [512, 8192, 8192];
            let moved = pull(&mut core, &after);
            let unmoved = pull(&mut still_core, &after);
            played.extend_from_slice(&moved);
            assert_eq!(
                played[..heard.len()],
                heard[..],
                "before its block, nothing changed"
            );
            assert_ne!(
                moved, unmoved,
                "the Glue made at the threshold written is heard"
            );
            let reading = opened.reading();
            assert!(reading["warnings"].is_array(), "{reading}");
            // made at a value its model does not take, the words say so
            let stray = xml.replace(
                r#"<Manual Value="-40" /></Threshold>"#,
                r#"<Manual Value="10" /></Threshold>"#,
            );
            std::fs::write(
                &path,
                live_set::write_gz(&live_set::xml::parse(&stray).unwrap()).unwrap(),
            )
            .unwrap();
            opened.send(event(device)).unwrap();
            played.extend(pull(&mut core, &[4096]));
            let warned = opened.reading()["warnings"].to_string();
            assert!(
                warned.contains("Bass · GlueCompressor: Live's GlueCompressor holds its Threshold within -40 to 0, and the set stores 10: the engine keeps its own"),
                "{warned}"
            );
            opened.handle.collect();
            assert_eq!(opened.handle.remade().len(), 2, "each edit made it again");
            let (bytes, exported) = opened.render_wav().unwrap();
            assert_eq!(exported["complete"], true);
            let wav = live_engine::wav::read_wav_f32(&bytes).unwrap();
            assert_eq!(wav.samples.len(), played.len());
            for (n, (e, p)) in wav.samples.iter().zip(&played).enumerate() {
                assert_eq!(
                    e.to_bits(),
                    p.to_bits(),
                    "sample {n}: Export Audio is what the host played"
                );
            }
            for (json, words) in [
                (
                    r#"{"kind":"device","track_name":"Keys","device":"Operator"}"#,
                    "the Operator on 'Keys' is its instrument, which the engine makes when the set is played: the edit is heard from the next Play",
                ),
                (
                    r#"{"kind":"device","track_name":"Pads","device":"Echo"}"#,
                    "the set has no track named 'Pads'",
                ),
                (
                    r#"{"kind":"device","track_name":"Bass"}"#,
                    "a device event names its track_name and its device",
                ),
            ] {
                assert_eq!(opened.send(event(json)).unwrap_err(), words, "{json}");
            }
            for p in [path, still_path] {
                std::fs::remove_dir_all(p.parent().unwrap()).unwrap();
            }
        }

        /// DLW build ruling 2026-11-05 (O-I #849): the second of two Glues on one chain, written by the set's owner at its
        /// place and followed by a device event naming that place, is made again itself; the first sounds on as it was.
        #[test]
        fn the_second_of_two_glues_edited_while_it_plays_is_made_again_at_its_own_place() {
            let glue = |id: u32| {
                format!(
                    r#"<GlueCompressor Id="{id}"><Threshold><LomId Value="0" /><Manual Value="-40" /></Threshold>
                  <Range><LomId Value="0" /><Manual Value="30" /></Range></GlueCompressor>"#
                )
            };
            let xml = SET.replace(
                r#"<GlueCompressor Id="10" />"#,
                &format!("{}{}", glue(10), glue(12)),
            );
            let path = write_set("two-glues", &xml);
            let mut opened = Opened::open(&path).unwrap();
            let mut core = opened.core.take().unwrap();
            pull(&mut core, &[512, 4096]);
            live_set::api::device_param_set(
                path.to_str().unwrap(),
                "Bass",
                "GlueCompressor",
                Some(2),
                "Threshold",
                &json!(-12.0),
            )
            .unwrap();
            let event = r#"{"kind":"device","track_name":"Bass","device":"GlueCompressor","at":2}"#;
            opened
                .send(serde_json::from_str::<EventIn>(event).unwrap())
                .unwrap();
            pull(&mut core, &[512]);
            let (_, _, at, element) = opened.made_again.last().unwrap();
            assert_eq!(
                (*at, element.attr("Id")),
                (1, Some("12")),
                "the second Glue, past the instrument"
            );
            let threshold = element
                .find("Threshold")
                .and_then(|t| t.child("Manual"))
                .and_then(|m| m.attr("Value"));
            assert_eq!(threshold, Some("-12"), "made from what was written to it");
            let refused = opened
                .send(
                    serde_json::from_str::<EventIn>(
                        r#"{"kind":"device","track_name":"Bass","device":"GlueCompressor","at":0}"#,
                    )
                    .unwrap(),
                )
                .unwrap_err();
            assert_eq!(
                refused,
                "the device at place 0 on 'Bass' is an Operator, not a GlueCompressor"
            );
            std::fs::remove_dir_all(path.parent().unwrap()).unwrap();
        }

        #[test]
        fn events_move_the_mixer_and_export_renders_what_was_played() {
            let path = write_set("events", SET);
            let mut opened = Opened::open(&path).unwrap();
            let mut core = opened.core.take().unwrap();
            let mut played = pull(&mut core, &[512]);
            let event = |json: &str| {
                serde_json::from_str::<EventIn>(json).unwrap_or_else(|e| panic!("{json}: {e}"))
            };
            opened
                .send(event(r#"{"kind":"volume","part":{"track":0},"gain":0.25}"#))
                .unwrap();
            opened
                .send(event(r#"{"kind":"pan","part":"main","pan":0.3}"#))
                .unwrap();
            opened
                .send(event(r#"{"kind":"send","track":1,"send":0,"gain":0.8}"#))
                .unwrap();
            opened
                .send(event(
                    r#"{"kind":"note_on","track":1,"key":52,"velocity":100}"#,
                ))
                .unwrap();
            let asked = opened.reading();
            assert_eq!(
                asked["mixer"]["tracks"][0]["gain"], 1.0,
                "asked is not applied"
            );
            played.extend(pull(&mut core, &[300, 4096, 700]));
            opened
                .send(event(r#"{"kind":"active","part":{"return":0},"on":false}"#))
                .unwrap();
            opened
                .send(event(r#"{"kind":"solo","track":1,"on":true}"#))
                .unwrap();
            opened
                .send(event(r#"{"kind":"active","part":{"track":0},"on":false}"#))
                .unwrap();
            opened.send(event(r#"{"kind":"panic"}"#)).unwrap();
            played.extend(pull(&mut core, &[2048, 8192]));
            let applied = opened.reading();
            assert_eq!(applied["mixer"]["tracks"][0]["gain"], 0.25);
            assert_eq!(applied["mixer"]["main"]["pan"], 0.3);
            assert_eq!(applied["mixer"]["tracks"][1]["sends"][0], 0.8);
            assert_eq!(applied["mixer"]["returns"][0]["active"], false);
            assert_eq!(applied["mixer"]["tracks"][1]["solo"], true);
            assert_eq!(applied["mixer"]["tracks"][0]["active"], false);
            // refused in the engine's words
            let refused = opened
                .send(event(r#"{"kind":"send","track":0,"send":4,"gain":0.5}"#))
                .unwrap_err();
            assert!(refused.contains("no send 4"), "{refused}");
            let (bytes, exported) = opened.render_wav().unwrap();
            assert_eq!(exported["events"], 8);
            assert_eq!(exported["complete"], true);
            let wav = live_engine::wav::read_wav_f32(&bytes).unwrap();
            assert_eq!((wav.sample_rate, wav.channels), (ENGINE_RATE, 2));
            assert_eq!(wav.samples.len(), played.len());
            for (n, (e, p)) in wav.samples.iter().zip(&played).enumerate() {
                assert_eq!(
                    e.to_bits(),
                    p.to_bits(),
                    "sample {n}: Export Audio is what the host played"
                );
            }
        }

        /// Export Audio renders the set as the engine bridged it at Play: a
        /// write the set's owner made while it played (here, Keys' volume in
        /// the file) reached the engine as an event, and the file as it now
        /// stands is not what was heard.
        #[test]
        fn export_renders_the_set_as_the_engine_bridged_it_not_the_file_as_it_now_stands() {
            let path = write_set("bridged", SET);
            let mut opened = Opened::open(&path).unwrap();
            let mut core = opened.core.take().unwrap();
            let played = pull(&mut core, &[4096, 4096]);
            let quieter = SET.replacen(
                r#"<Volume><Manual Value="1" /></Volume>"#,
                r#"<Volume><Manual Value="0.1" /></Volume>"#,
                1,
            );
            assert_ne!(quieter, SET);
            let root = live_set::xml::parse(&quieter).unwrap();
            std::fs::write(&path, live_set::write_gz(&root).unwrap()).unwrap();
            let (bytes, _) = opened.render_wav().unwrap();
            let wav = live_engine::wav::read_wav_f32(&bytes).unwrap();
            assert_eq!(wav.samples.len(), played.len());
            assert!(
                wav.samples == played,
                "Export Audio is what the engine played, not the file as it now stands"
            );
        }

        /// The engine opens only a set the kernel admits (O-I #849): asked
        /// first, a refusal is the kernel's words, nothing is read, and the
        /// set the engine had open stays open.
        #[test]
        fn the_engine_opens_only_a_set_the_kernel_admits() {
            let host = LiveEngineHost::default();
            let path = write_set("admitted", SET);
            let mut asked = Vec::new();
            host.open_admitted(&path, |set| {
                asked.push(set.to_owned());
                Ok(())
            })
            .unwrap();
            assert_eq!(asked, vec![path.to_string_lossy().into_owned()]);
            let other = write_set("not-admitted", SET);
            let refused = host
                .open_admitted(&other, |_| {
                    Err("The engine did not open the set: not read".into())
                })
                .unwrap_err();
            assert_eq!(refused, "The engine did not open the set: not read");
            let reading = host.with(|o| Ok(o.reading())).unwrap();
            assert_eq!(
                reading["path"],
                path.to_string_lossy().as_ref(),
                "the set it had open stays open"
            );
            let gone = Path::new("/no/such/folder/never.als");
            let refused = host
                .open_admitted(gone, |_| Err("The engine did not open the set: no".into()))
                .unwrap_err();
            assert!(
                refused.ends_with(": no"),
                "the kernel answers before the host reads the file: {refused}"
            );
            let source = include_str!("live_engine_host.rs");
            let command = source.split("pub fn live_engine_open(").nth(1).unwrap();
            let command = &command[..command.find("\n}\n").unwrap()];
            assert!(
                command.contains(".live_engine_admits(set)") && command.contains("open_admitted("),
                "the command asks the kernel's Live owner"
            );
        }

        /// The page names no path for Export Audio: the command takes the
        /// app and its webview, nothing else.
        #[test]
        fn the_page_names_no_path_for_export_audio() {
            let source = include_str!("live_engine_host.rs");
            // the needle is built, so this test's own text is not found
            let declared = concat!("pub async fn live_engine", "_export(\n");
            let signature = source
                .split(declared)
                .nth(1)
                .and_then(|rest| rest.split(')').next())
                .expect("the command is declared");
            assert!(
                signature.contains("webview: tauri::WebviewWindow"),
                "{signature}"
            );
            assert!(
                !signature.contains("path") && !signature.contains("String"),
                "live_engine_export takes no path from the page: ({signature})"
            );
        }

        /// Export Audio asks the person where the file goes (the set's name,
        /// as a .wav, suggested) and hands the owner the set, the chosen file
        /// and the render; refused before the dialog with no set open, in
        /// words when the dialog is cancelled, and for a file that is not a
        /// .wav — none of which renders or writes anything.
        #[test]
        fn export_asks_the_person_then_the_owner_writes_what_was_played() {
            let host = LiveEngineHost::default();
            let never = |_: &str| -> Option<PathBuf> { panic!("no dialog without a set") };
            let unwritten = |_: &Path, _: &Path, _: &[u8]| -> Result<Value, String> {
                panic!("nothing is written")
            };
            let refused = host.export_chosen(never, unwritten).unwrap_err();
            assert!(refused.contains("No set is open"), "{refused}");
            let path = write_set("export", SET);
            host.open(&path).unwrap();
            let mut suggested = String::new();
            let cancelled = host
                .export_chosen(
                    |name| {
                        suggested = name.to_owned();
                        None
                    },
                    unwritten,
                )
                .unwrap_err();
            assert_eq!(suggested, "export.wav");
            assert_eq!(cancelled, EXPORT_CANCELLED);
            assert_eq!(
                cancelled,
                "Export Audio was cancelled: no file was chosen, so nothing was written."
            );
            let not_wav = host
                .export_chosen(|_| Some(PathBuf::from("/Users/me/Song.aiff")), unwritten)
                .unwrap_err();
            assert!(not_wav.contains("ending in .wav"), "{not_wav}");
            let chosen = path.with_file_name("Chosen.wav");
            let mut handed = None;
            let written = host
                .export_chosen(
                    |_| Some(chosen.clone()),
                    |set, to, wav| {
                        handed = Some((set.to_path_buf(), to.to_path_buf(), wav.to_vec()));
                        Ok(json!({"path": to, "bytes": wav.len()}))
                    },
                )
                .unwrap();
            let (set, to, wav) = handed.expect("the owner was handed the render");
            assert_eq!((set, to), (path.clone(), chosen.clone()));
            assert_eq!(
                written["frames"], 0,
                "nothing has played yet: an empty render"
            );
            assert_eq!(written["bytes"], wav.len());
            let audio = live_engine::wav::read_wav_f32(&wav).unwrap();
            assert_eq!((audio.sample_rate, audio.channels), (ENGINE_RATE, 2));
            assert!(!chosen.exists(), "the host writes no file: its owner does");
        }

        /// A Torus act is an event on a part (O-I #849): it names its part, its keys and its velocity,
        /// and a part holds no Torus until its owner's Torus is handed over to it.
        #[test]
        fn a_torus_act_names_its_keys_and_sounds_only_on_a_part_the_torus_was_handed_over_to() {
            let path = write_set("torus-act", SET);
            let mut opened = Opened::open(&path).unwrap();
            let event = |json: &str| {
                serde_json::from_str::<EventIn>(json).unwrap_or_else(|e| panic!("{json}: {e}"))
            };
            let refused = opened
                .send(event(
                    r#"{"kind":"torus_play","track":0,"amplitude":[0.3,0]}"#,
                ))
                .unwrap_err();
            assert!(
                refused.contains("a torus_play event names its keys"),
                "{refused}"
            );
            let many = format!(
                r#"{{"kind":"torus_play","track":0,"keys":[{}],"amplitude":[0.3,0]}}"#,
                vec![r#"{"row":0,"column":0}"#; 33].join(",")
            );
            let refused = opened.send(event(&many)).unwrap_err();
            assert!(refused.contains("1 to 32 keys"), "{refused}");
            let refused = opened
                .send(event(
                    r#"{"kind":"torus_play","track":0,"keys":[{"row":2,"column":3}],"amplitude":[0.3,0]}"#,
                ))
                .unwrap_err();
            assert!(refused.contains("Keys holds no Torus"), "{refused}");
            assert_eq!(opened.reading()["toruses"], json!([]));
        }

        #[cfg(not(feature = "k8"))]
        #[test]
        fn a_host_built_without_qls_k8_node_refuses_the_torus_in_words() {
            let path = write_set("torus-unbuilt", SET);
            let mut opened = Opened::open(&path).unwrap();
            let refused = opened
                .hand_torus(0, "sha256:none", &json!({}), Takes::Instead(Due::Now))
                .unwrap_err();
            assert!(refused.contains("built without QL's K8 node"), "{refused}");
            let voiced = opened.voice_owner(0, 1, 0, &Vec::new(), &[]).unwrap_err();
            assert!(voiced.contains("built without QL's K8 node"), "{voiced}");
        }

        /// O-I #850 round 24 (DLW build ruling 2026-11-05: the frame→engine tap under Logic): the notes the owner voiced travel
        /// to the engine as the parts of one act at its sample, each voice by the index of the mode it is like in the Torus
        /// handed over, each note its eight voices; a mode the Torus does not have, or a note that is not eight voices, is
        /// refused in words and nothing travels.
        #[test]
        fn the_notes_its_owner_voiced_travel_by_the_modes_of_the_torus_handed_over() {
            let modes = ["scene:logic/0", "scene:logic/1"];
            let mode = |r: &str| modes.iter().position(|m| *m == r);
            let note = |id: u64, like: &str| {
                let voices = (0..8)
                    .map(|k| {
                        (
                            like.to_owned(),
                            300.0 + f64::from(k),
                            [0.01, -0.002 * f64::from(k)],
                        )
                    })
                    .collect::<Vec<_>>();
                (id, voices)
            };
            let parts = voiced_parts(
                mode,
                3,
                960,
                &vec![note(7, "scene:logic/1"), note(9, "scene:logic/0")],
                &[2],
            )
            .unwrap();
            assert_eq!(parts.len(), 2, "a part for each note");
            assert!(parts
                .iter()
                .all(|p| (p.handover, p.at, p.parts) == (3, 960, 2)));
            let seven = parts[0].note.unwrap();
            assert_eq!(
                (
                    seven.id,
                    seven.like,
                    seven.frequency_hz[7],
                    seven.re[7],
                    seven.im[7]
                ),
                (7, [1; 8], 307.0, 0.01, -0.002 * 7.0),
                "each voice by its mode's index, its frequency and its impulse"
            );
            assert_eq!(parts[1].note.map(|n| (n.id, n.like)), Some((9, [0; 8])));
            assert_eq!(parts[0].made_way(), &[2]);
            assert_eq!(
                voiced_parts(mode, 3, 960, &vec![note(7, "scene:sky/0")], &[]).unwrap_err(),
                "The Torus handed over has no mode scene:sky/0: the notes were not voiced"
            );
            let mut seven_voices = note(7, "scene:logic/0");
            seven_voices.1.pop();
            assert_eq!(
                voiced_parts(mode, 3, 960, &vec![seven_voices], &[]).unwrap_err(),
                "A note the Torus's owner voiced has 7 voices, and a note voices 8: the notes were not voiced"
            );
        }

        /// O-I #850 round 24: the kernel's tap of notes voiced under Logic reaches the part that follows its owner, as an act struck
        /// does: followed on the bound part of the hand-over it follows (here no Torus stands on the part, so it is missed, in
        /// words), and kept with the acts since that hand-over for a part bound later.
        #[test]
        fn the_notes_its_owner_voiced_are_followed_on_the_bound_part_and_kept_since_the_hand_over()
        {
            let path = write_set("voiced", SET);
            let mut o = Opened::open(&path).unwrap();
            o.following.bound = Some(Bound {
                lease: "lease:v".into(),
                track: 0,
                sha256: "sha256:v".into(),
                handover: 1,
                notes: None,
            });
            let host = LiveEngineHost::default();
            *host.0.lock().unwrap() = Some(o);
            let kept = |_: &str, _: &str| -> Result<Value, String> {
                panic!("the hand-over it follows is the bound part's own")
            };
            host.tapped(
                TorusTap::HandedOver {
                    lease: "lease:v".into(),
                    sha256: "sha256:v".into(),
                },
                kept,
            );
            let notes: Voiced =
                vec![(7, vec![("scene:logic/0".to_owned(), 440.0, [0.01, 0.0]); 8])];
            host.tapped(
                TorusTap::Voiced {
                    lease: "lease:v".into(),
                    at_samples_elapsed: 960,
                    notes: notes.clone(),
                    made_way: vec![3],
                },
                kept,
            );
            {
                let open = host.0.lock().unwrap();
                let following = &open.as_ref().unwrap().following;
                assert_eq!(
                    (following.struck, following.missed),
                    (0, 1),
                    "followed on the bound part: no Torus stands there to voice"
                );
                assert!(following.refusal.is_some(), "missed in words");
            }
            let follow = host.1.lock().unwrap();
            assert_eq!(
                follow.since.as_ref().unwrap().acts,
                vec![Told::Voiced(960, notes, vec![3])],
                "kept since the hand-over"
            );
            drop(follow);
            std::fs::remove_dir_all(path.parent().unwrap()).unwrap();
        }

        /// The engine's own legs of key-to-sound (O-I #853 round 18), in the reading for the page to join
        /// with its own (jankoInput.ts keyToSound): the device block it last filled and how long a key at
        /// worst waits for one at the engine's rate, the longest any event waited, and the device's output
        /// latency (callback to playback) as the stream reports it.
        #[test]
        fn the_reading_names_the_engines_legs_of_key_to_sound() {
            let path = write_set("key-to-sound", SET);
            let mut opened = Opened::open(&path).unwrap();
            let mut core = opened.core.take().unwrap();
            let mut block = vec![0.0f32; 2 * 480];
            core.pull_block(&mut block);
            core.report_output_latency(25_000_000);
            let latency = opened.reading()["latency"].clone();
            // REPLACES the round-18 form without `strikes` (O-I #849 round 22 adds each strike's times; none struck yet).
            assert_eq!(
                latency,
                json!({"block_frames": 480, "block_ms": 10.0, "longest_wait_ms": 0.0, "output_latency_ms": 25.0, "strikes": []}),
                "a key waits at worst one block at 48 kHz, then the device's output"
            );
            // O-I #849 round 22 (DLW build ruling 2026-11-05: "a host-side timestamp pair per strike reported through the
            // engine's own readout"): each strike's pair on the host's wall clock (ms since the epoch, the clock the MIDI
            // notes' receipt is stamped on): when the host sent it to the engine, and when the engine mixed its first frame.
            let wall = || {
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_secs_f64()
                    * 1000.0
            };
            let before = wall();
            opened
                .send(
                    serde_json::from_str::<EventIn>(
                        r#"{"kind":"note_on","track":1,"key":57,"velocity":100}"#,
                    )
                    .unwrap(),
                )
                .unwrap();
            core.pull_block(&mut block);
            let strikes = opened.reading()["latency"]["strikes"].clone();
            let after = wall();
            let strikes = strikes.as_array().expect("the strikes, oldest first");
            assert_eq!(strikes.len(), 1, "{strikes:?}");
            let strike = &strikes[0];
            assert_eq!(strike["track"], 1);
            assert_eq!(
                strike["frame"], 480,
                "a note sounds at the first frame of the block that took it"
            );
            let sent = strike["sent_at_ms"].as_f64().unwrap();
            let sounds = strike["sounds_at_ms"].as_f64().unwrap();
            // the engine's time and the wall clock are read a moment apart: within a millisecond
            assert!(
                sent >= before - 1.0 && sent <= sounds && sounds <= after + 1.0,
                "{before} <= {sent} <= {sounds} <= {after}"
            );
            assert!(
                (strike["ms"].as_f64().unwrap() - (sounds - sent)).abs() < 1e-3,
                "the pair's span, sent to sounding: {strike}"
            );
            // DLW build ruling 2026-11-06 ("The engine measures it itself, so a walk reads a number"): the frame the note
            // reached the engine, the frame its part first sounded, and the span between in frames, ms and the engine's blocks.
            let reached = strike["reached_frame"]
                .as_u64()
                .expect("the frame it reached the engine");
            let sounded = strike["sounded_frame"]
                .as_u64()
                .expect("the frame its part first sounded");
            assert!(reached <= 480 && sounded >= 480, "{strike}");
            let frames = sounded - reached;
            assert_eq!(
                strike["to_sound"],
                json!({"frames": frames, "ms": frames as f64 * 1000.0 / 48000.0, "blocks": frames as f64 / 480.0}),
                "{strike}"
            );
        }

        /// The frame names when it will play the sample its owner handed the Torus over at, as a time
        /// from now (round 13): the part takes the Torus at the engine's frame heard then — past the
        /// frames it has mixed by that time at its rate, less the device's output latency — and at once
        /// when that frame is already playing. A time that is not one from now is refused in words.
        #[test]
        fn the_torus_is_taken_at_the_engines_frame_heard_when_the_frame_plays_its_hand_over() {
            let path = write_set("torus-heard", SET);
            let mut opened = Opened::open(&path).unwrap();
            let mut core = opened.core.take().unwrap();
            let mut block = vec![0.0f32; 2 * 512];
            assert_eq!(opened.handle.block_stamp(), BlockStamp::default());
            core.pull_block(&mut block);
            assert_eq!(opened.handle.position(), 512);
            // each block is stamped with when it was pulled (round 14), so the frame heard is right
            // within a block: the block's first frame as it is pulled, on by the time since, never past
            // what it rendered
            let stamp = opened.handle.block_stamp();
            assert_eq!((stamp.frame, stamp.frames), (0, 512));
            assert!(stamp.at_ns <= opened.handle.now_ns());
            let at = |since_ms: f64, ms: f64, latency_ns: u64| {
                frame_heard_at(stamp, stamp.at_ns + (since_ms * 1e6) as u64, latency_ns, ms)
            };
            assert_eq!(at(0.0, 100.0, 0), Ok(Due::AtFrame(4800)));
            assert_eq!(at(5.0, 100.0, 0), Ok(Due::AtFrame(240 + 4800)));
            assert_eq!(at(50.0, 100.0, 0), Ok(Due::AtFrame(512 + 4800)));
            assert_eq!(
                at(5.0, 100.0, 25_000_000),
                Ok(Due::AtFrame(240 + 4800 - 1200))
            );
            assert_eq!(at(5.0, 10.0, 25_000_000), Ok(Due::AtFrame(240)));
            assert_eq!(at(5.0, 0.0, 0), Ok(Due::AtFrame(240)));
            let heard = |ms| frame_heard_in(&opened.handle, ms);
            let Ok(Due::AtFrame(now)) = heard(100.0) else {
                panic!("a frame")
            };
            assert!((4800..=512 + 4800).contains(&now), "{now}");
            core.report_output_latency(25_000_000);
            let Ok(Due::AtFrame(later)) = heard(100.0) else {
                panic!("a frame")
            };
            assert!((now - 1200..=512 + 4800 - 1200).contains(&later), "{later}");
            let mut half = vec![0.0f32; 2 * 256];
            core.pull_block(&mut half);
            let next = opened.handle.block_stamp();
            assert_eq!((next.frame, next.frames), (512, 256));
            assert!(next.at_ns >= stamp.at_ns);
            for ms in [-1.0, f64::NAN, f64::INFINITY, HEARD_IN_MS_MAX + 1.0] {
                let refused = heard(ms).unwrap_err();
                assert!(refused.contains("as a time from now"), "{refused}");
            }
            // the frame names it in the machine's wall clock; past is at once
            let now = 1_793_750_400_000.0;
            assert_eq!(heard_in_ms(now + 52.5, now), Ok(52.5));
            assert_eq!(heard_in_ms(now - 3.0, now), Ok(0.0));
            for at in [
                now + HEARD_IN_MS_MAX + 1.0,
                now - HEARD_IN_MS_MAX - 1.0,
                f64::NAN,
                0.0,
            ] {
                let refused = heard_in_ms(at, now).unwrap_err();
                assert!(refused.contains("within 10000 ms of now"), "{refused}");
            }
        }

        /// A part whose clip strikes a chord, then two notes of one frame (one with no key by the pitch law).
        #[cfg(not(feature = "k8"))]
        const CLIPPED: &str = r#"<?xml version="1.0" encoding="UTF-8"?>
<Ableton MajorVersion="5"><LiveSet>
  <Tracks>
    <MidiTrack Id="1"><Name><EffectiveName Value="Torus" /></Name>
      <DeviceChain>
        <Mixer><Sends /><Speaker><Manual Value="true" /></Speaker><Pan><Manual Value="0" /></Pan><Volume><Manual Value="1" /></Volume><SoloSink Value="false" /></Mixer>
        <MainSequencer><ClipTimeable><ArrangerAutomation><Events>
          <MidiClip Id="2" Time="0"><CurrentStart Value="0" /><CurrentEnd Value="2" />
            <Loop><LoopStart Value="0" /><LoopEnd Value="2" /><StartRelative Value="0" /><LoopOn Value="false" /></Loop>
            <Notes><KeyTracks>
              <KeyTrack Id="3"><MidiKey Value="60" /><Notes><MidiNoteEvent Time="0.25" Duration="0.125" Velocity="100" IsEnabled="true" /></Notes></KeyTrack>
              <KeyTrack Id="4"><MidiKey Value="62" /><Notes><MidiNoteEvent Time="0.25" Duration="0.125" Velocity="100" IsEnabled="true" /></Notes></KeyTrack>
              <KeyTrack Id="5"><MidiKey Value="64" /><Notes><MidiNoteEvent Time="0.5" Duration="0.125" Velocity="64" IsEnabled="true" /></Notes></KeyTrack>
              <KeyTrack Id="6"><MidiKey Value="61" /><Notes><MidiNoteEvent Time="0.5" Duration="0.125" Velocity="100" IsEnabled="true" /></Notes></KeyTrack>
            </KeyTracks></Notes>
          </MidiClip>
        </Events></ArrangerAutomation></ClipTimeable></MainSequencer>
        <DeviceChain><Devices /></DeviceChain>
      </DeviceChain>
    </MidiTrack>
  </Tracks>
  <MainTrack><DeviceChain><Mixer><Tempo><Manual Value="120" /></Tempo><Volume><Manual Value="1" /></Volume><Pan><Manual Value="0" /></Pan></Mixer>
    <DeviceChain><Devices /></DeviceChain></DeviceChain></MainTrack>
</LiveSet></Ableton>"#;

        /// The notes of the part following the Torus's owner are handed to the owner (round 13): each clip
        /// note the engine reaches within the lookahead, as its key by the pitch→key law the part was bound
        /// with, at the owner's sample its frame falls on (the hand-over's sample plus the frames since the
        /// engine took it), keys of one frame and strength as one act; each release the engine reaches of a
        /// key handed out; a MIDI note sent to the part at once, and never to the engine. Each once.
        #[cfg(not(feature = "k8"))]
        #[test]
        fn the_bound_parts_notes_are_handed_to_the_owner_at_their_samples() {
            let path = write_set("torus-notes", CLIPPED);
            let mut o = Opened::open(&path).unwrap();
            let mut core = o.core.take().unwrap();
            // at 120 bpm a beat is 24000 frames: the chord at 6000, the pair at 12000, each 3000 long
            assert_eq!(o.clips[0].len(), 8, "{:?}", o.clips[0]);
            // the engine plays past the chord before the part takes the Torus (a stand-in for its node)
            pull(&mut core, &[128; 50]);
            o.handle
                .install(0, Box::new(live_engine::SilentInstrument))
                .unwrap();
            o.toruses.push(TorusOnPart {
                track: 0,
                sha256: "sha256:t".into(),
                at_samples_elapsed: 4800,
                handover: 1,
                keys_refused: None,
            });
            let mut notes = [None; 128];
            notes[60] = Some((2u8, 3u16));
            notes[62] = Some((2, 4));
            notes[64] = Some((3, 1));
            o.following.bound = Some(Bound {
                lease: "lease:t".into(),
                track: 0,
                sha256: "sha256:t".into(),
                handover: 1,
                notes: Some(notes),
            });
            assert_eq!(
                o.torus_notes(),
                None,
                "nothing until the engine takes the hand"
            );
            pull(&mut core, &[128]);
            o.handle.collect();
            assert_eq!(o.handle.installs(), &[(6400, 0)]);
            let due = o.torus_notes().expect("the pair is within the lookahead");
            assert_eq!(
                due,
                json!({"lease":"lease:t","track":0,"releases":[],"acts":[
                    {"keys":[{"row":3,"column":1}],"amplitude":64.0 / 127.0,"at_samples_elapsed":(4800 + 12000 - 6400).to_string()}]}),
                "the chord fell before the part took the Torus; 61 has no key"
            );
            assert_eq!(o.torus_notes(), None, "each note once");
            let note = |kind: &str, velocity: &str| {
                serde_json::from_str::<EventIn>(&format!(
                    r#"{{"kind":"{kind}","track":0,"key":64{velocity}}}"#
                ))
                .unwrap()
            };
            o.send(note("note_on", r#","velocity":127"#)).unwrap();
            let due = o.torus_notes().unwrap();
            assert_eq!(
                due["acts"],
                json!([{"keys":[{"row":3,"column":1}],"amplitude":1.0}]),
                "a MIDI note on the part is handed over at once"
            );
            assert_eq!(
                o.handle.performance().events.len(),
                0,
                "and never reaches the engine"
            );
            // the engine reaches the chord's release (never handed out) and the pair's
            pull(&mut core, &[128; 70]);
            let due = o.torus_notes().unwrap();
            assert_eq!(due["acts"], json!([]));
            assert_eq!(due["releases"], json!([{"row":3,"column":1}]));
            o.send(note("note_off", "")).unwrap();
            assert_eq!(
                o.torus_notes().unwrap()["releases"],
                json!([{"row":3,"column":1}])
            );
            o.send(note("note_off", "")).unwrap();
            assert_eq!(
                o.torus_notes(),
                None,
                "a key the owner no longer holds is not let go"
            );
            let reading = o.reading();
            assert_eq!(
                reading["torus_follow"]["notes_to_owner"],
                json!({"handed": 2, "unkeyed": 1, "before_torus": 2}),
                "{reading}"
            );
        }

        #[test]
        fn the_host_refuses_what_is_not_a_set_or_not_open() {
            let host = LiveEngineHost::default();
            assert!(host.mixer().unwrap_err().contains("live_engine_open"));
            assert!(host
                .open(Path::new("relative.als"))
                .unwrap_err()
                .contains("absolute"));
            let path = write_set("refusals", SET);
            host.open(&path).unwrap();
            assert!(serde_json::from_str::<EventIn>(
                r#"{"kind":"volume","part":{"bus":0},"gain":1}"#
            )
            .is_err());
            assert!(serde_json::from_str::<EventIn>(
                r#"{"kind":"volume","part":"main","gain":1,"fader":2}"#
            )
            .is_err());
            let lacking = serde_json::from_str::<EventIn>(r#"{"kind":"volume","gain":1}"#)
                .unwrap()
                .event()
                .unwrap_err();
            assert_eq!(lacking, "a volume event names its part");
            // a group track is the engine's bus (O-I #849 round 16): the set has none, so a move of one is refused
            let group = serde_json::from_str::<EventIn>(
                r#"{"kind":"volume","part":{"group":0},"gain":0.5}"#,
            )
            .unwrap()
            .event()
            .unwrap();
            assert!(matches!(
                group,
                EngineEvent::Volume {
                    part: Part::Group(0),
                    gain: 0.5
                }
            ));
            let refused = host
                .send(
                    serde_json::from_str::<EventIn>(
                        r#"{"kind":"active","part":{"group":0},"on":false}"#,
                    )
                    .unwrap(),
                )
                .unwrap_err();
            assert!(
                refused.contains("the set has no group 0 (it has 0)"),
                "{refused}"
            );
        }
    }
}

#[cfg(feature = "native_shell")]
use crate::native_shell::admit_candidate_webview;
#[cfg(feature = "native_shell")]
use host::{EventIn, LiveEngineHost};

#[cfg(not(feature = "native_shell"))]
const EVERYDAY: &str =
    "The Live engine is the shell candidate's: this native host was built without it";

#[cfg(feature = "native_shell")]
fn host(app: &tauri::AppHandle) -> tauri::State<'_, LiveEngineHost> {
    use tauri::Manager;
    app.state::<LiveEngineHost>()
}

/// The engine follows the Torus's owner (O-I #849 round 12): the kernel tells the host every act the
/// owner lands and every hand-over (`Field::set_torus_tap`), and a thread of the host's own strikes each
/// act on the part bound to that owner and puts each hand-over on it (`LiveEngineHost::tapped`). The same
/// thread hands the owner the bound part's notes (round 13): each tick it emits the notes due
/// ([`host::TORUS_NOTES_EVENT`], `LiveEngineHost::torus_notes`) to the shell, which plays them on the
/// owner through the frame; the owner's acts come back by the tap. Called once, when the kernel's field
/// is made; the frame is answered as it always is.
pub(crate) fn follow_torus(
    app: &tauri::AppHandle,
    field: &oi_cradle_kernel::native_expression::Field,
) {
    #[cfg(feature = "native_shell")]
    {
        let (tap, tapped) = std::sync::mpsc::channel();
        if let Err(error) = field.set_torus_tap(tap) {
            eprintln!("The engine cannot follow the Torus's owner: {error}");
            return;
        }
        let (app, field) = (app.clone(), field.clone());
        let followed = std::thread::Builder::new()
            .name("torus-follow".into())
            .spawn(move || loop {
                use std::sync::mpsc::RecvTimeoutError;
                use tauri::Emitter;
                match tapped.recv_timeout(host::TORUS_RELAY_TICK) {
                    Ok(told) => {
                        host(&app).tapped(told, |lease, sha256| field.torus_native(lease, sha256))
                    }
                    Err(RecvTimeoutError::Timeout) => {}
                    Err(RecvTimeoutError::Disconnected) => break,
                }
                // the bound part's notes due on its owner go to the shell, which plays them through the frame
                if let Some(due) = host(&app).torus_notes() {
                    let _ = app.emit(host::TORUS_NOTES_EVENT, due);
                }
            });
        if let Err(error) = followed {
            eprintln!("The engine cannot follow the Torus's owner: {error}");
        }
    }
    #[cfg(not(feature = "native_shell"))]
    let _ = (app, field);
}

/// Install the engine host's state (the candidate build).
pub(crate) fn manage(app: &tauri::AppHandle) {
    #[cfg(feature = "native_shell")]
    {
        use tauri::Manager;
        app.manage(LiveEngineHost::default());
    }
    #[cfg(not(feature = "native_shell"))]
    let _ = app;
}

#[tauri::command]
pub fn live_engine_open(
    app: tauri::AppHandle,
    webview: tauri::WebviewWindow,
    path: String,
) -> Result<serde_json::Value, String> {
    #[cfg(feature = "native_shell")]
    {
        use tauri::Manager;
        admit_candidate_webview(&webview)?;
        // the kernel's Live owner admits the set first: one it can read and has read (live_set_owner.rs live_engine_admits)
        host(&app).open_admitted(std::path::Path::new(&path), |set| {
            app.state::<crate::KernelHost>()
                .0
                .lock()
                .map_err(|_| "kernel lock unavailable".to_owned())?
                .live_engine_admits(set)
        })
    }
    #[cfg(not(feature = "native_shell"))]
    {
        let _ = (app, webview, path);
        Err(EVERYDAY.into())
    }
}

#[tauri::command]
pub fn live_engine_play(
    app: tauri::AppHandle,
    webview: tauri::WebviewWindow,
) -> Result<serde_json::Value, String> {
    #[cfg(feature = "native_shell")]
    {
        admit_candidate_webview(&webview)?;
        host(&app).play()
    }
    #[cfg(not(feature = "native_shell"))]
    {
        let _ = (app, webview);
        Err(EVERYDAY.into())
    }
}

#[tauri::command]
pub fn live_engine_stop(
    app: tauri::AppHandle,
    webview: tauri::WebviewWindow,
) -> Result<serde_json::Value, String> {
    #[cfg(feature = "native_shell")]
    {
        admit_candidate_webview(&webview)?;
        host(&app).stop()
    }
    #[cfg(not(feature = "native_shell"))]
    {
        let _ = (app, webview);
        Err(EVERYDAY.into())
    }
}

#[tauri::command]
pub fn live_engine_send(
    app: tauri::AppHandle,
    webview: tauri::WebviewWindow,
    event: serde_json::Value,
) -> Result<serde_json::Value, String> {
    #[cfg(feature = "native_shell")]
    {
        admit_candidate_webview(&webview)?;
        let event: EventIn =
            serde_json::from_value(event).map_err(|e| format!("not an engine event: {e}"))?;
        host(&app).send(event)
    }
    #[cfg(not(feature = "native_shell"))]
    {
        let _ = (app, webview, event);
        Err(EVERYDAY.into())
    }
}

/// The Torus its owner handed over sounds on the set's part `track` (O-I #849): the kernel kept the
/// document under the field's lease (`Field::torus_native`), and the page names only its digest. The
/// part follows that owner from then on (`follow_torus`); `notes` gives the key each MIDI note strikes
/// on it, by the shell's pitch→key law (O-I #853): 128 entries, a key or null; `effects`, the frame's
/// effects to stand after it (round 13); `heard_at_ms`, when the frame's sound of the sample it was handed
/// over at is heard, in the machine's wall clock (round 13: the part takes it at the engine's frame heard
/// then, [`host::heard_in_ms`], so it sounds on from where the frame stops). Its arguments are the page's
/// fields, one each.
#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub fn live_engine_torus(
    app: tauri::AppHandle,
    webview: tauri::WebviewWindow,
    lease: String,
    track: usize,
    sha256: String,
    notes: Option<serde_json::Value>,
    effects: Option<serde_json::Value>,
    heard_at_ms: Option<f64>,
) -> Result<serde_json::Value, String> {
    #[cfg(feature = "native_shell")]
    {
        use tauri::Manager;
        admit_candidate_webview(&webview)?;
        let notes = notes.as_ref().map(host::notes).transpose()?;
        let now_ms = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map_err(|e| format!("the machine's clock stands before the Unix epoch: {e}"))?
            .as_secs_f64()
            * 1000.0;
        let heard_in_ms = heard_at_ms
            .map(|at| host::heard_in_ms(at, now_ms))
            .transpose()?;
        let field = &app.state::<crate::KernelHost>().1;
        let handed = field.torus_native(&lease, &sha256)?;
        host(&app).bind_torus(
            &lease,
            track,
            &sha256,
            &handed,
            notes,
            effects.as_ref(),
            heard_in_ms,
            |lease, sha256| field.torus_native(lease, sha256),
        )
    }
    #[cfg(not(feature = "native_shell"))]
    {
        let _ = (
            app,
            webview,
            lease,
            track,
            sha256,
            notes,
            effects,
            heard_at_ms,
        );
        Err(EVERYDAY.into())
    }
}

/// The Torus's effects as the frame now holds them (effectsLaw.ts `EffectsState`, as the frame reports
/// them), on the part following its owner (round 13): each effect as Live's device of its kind, the
/// engine's own, after the Torus; refused in words while no part follows it.
#[tauri::command]
pub fn live_engine_torus_effects(
    app: tauri::AppHandle,
    webview: tauri::WebviewWindow,
    effects: serde_json::Value,
) -> Result<serde_json::Value, String> {
    #[cfg(feature = "native_shell")]
    {
        admit_candidate_webview(&webview)?;
        host(&app).torus_effects(&effects)
    }
    #[cfg(not(feature = "native_shell"))]
    {
        let _ = (app, webview, effects);
        Err(EVERYDAY.into())
    }
}

#[tauri::command]
pub fn live_engine_mixer(
    app: tauri::AppHandle,
    webview: tauri::WebviewWindow,
) -> Result<serde_json::Value, String> {
    #[cfg(feature = "native_shell")]
    {
        admit_candidate_webview(&webview)?;
        host(&app).mixer()
    }
    #[cfg(not(feature = "native_shell"))]
    {
        let _ = (app, webview);
        Err(EVERYDAY.into())
    }
}

/// A row's take frozen on its part (O-I #849 round 22, `LiveEngineHost::freeze`): the take's sound as the frame sends it,
/// raw (`oi.take-render/v1` with the owner's sample it lands at and its name), rendered through the Torus's effects and the
/// part's chain and played by the engine on the part from the frame it lands at until it ends; answered with the takes
/// frozen on the set's parts.
#[tauri::command]
pub fn live_engine_freeze(
    app: tauri::AppHandle,
    webview: tauri::WebviewWindow,
    request: tauri::ipc::Request<'_>,
) -> Result<serde_json::Value, String> {
    #[cfg(feature = "native_shell")]
    {
        admit_candidate_webview(&webview)?;
        let tauri::ipc::InvokeBody::Raw(body) = request.body() else {
            return Err(
                "A take is frozen on its part from its sound sent as bytes (oi.take-render/v1)"
                    .into(),
            );
        };
        host(&app).freeze(body)
    }
    #[cfg(not(feature = "native_shell"))]
    {
        let _ = (app, webview, request);
        Err(EVERYDAY.into())
    }
}

/// A sealed take played beside its part's Torus while its scene plays, or let go (O-I #855 round 25, `LiveEngineHost::take_play`):
/// the take's sound as the frame sends it, raw (`oi.take-play/v1`: verified by the frame against the take's seal, from the frame
/// it plays from, heard when the frame names it), added to what the part's Torus makes in the engine, through the Torus's
/// effects and the part's chain; answered with the take played.
#[tauri::command]
pub fn live_engine_take_play(
    app: tauri::AppHandle,
    webview: tauri::WebviewWindow,
    request: tauri::ipc::Request<'_>,
) -> Result<serde_json::Value, String> {
    #[cfg(feature = "native_shell")]
    {
        admit_candidate_webview(&webview)?;
        let tauri::ipc::InvokeBody::Raw(body) = request.body() else {
            return Err(
                "A take is played beside its part's Torus from its sound sent as bytes (oi.take-play/v1)"
                    .into(),
            );
        };
        host(&app).take_play(body)
    }
    #[cfg(not(feature = "native_shell"))]
    {
        let _ = (app, webview, request);
        Err(EVERYDAY.into())
    }
}

/// Unfreeze (O-I #849 round 22, `LiveEngineHost::unfreeze`): the takes frozen on the set's track `track` let go, the part's
/// chain heard again from the engine's next block; answered with the takes frozen on the set's parts.
#[tauri::command]
pub fn live_engine_unfreeze(
    app: tauri::AppHandle,
    webview: tauri::WebviewWindow,
    track: usize,
) -> Result<serde_json::Value, String> {
    #[cfg(feature = "native_shell")]
    {
        admit_candidate_webview(&webview)?;
        host(&app).unfreeze(track)
    }
    #[cfg(not(feature = "native_shell"))]
    {
        let _ = (app, webview, track);
        Err(EVERYDAY.into())
    }
}

/// Export Audio of a take through its part (O-I #855, `LiveEngineHost::render_take`): the take's sound as the
/// frame sends it, raw (`oi.take-render/v1`), rendered through its part's effects in the set open in the engine,
/// answered raw as the WAV's bytes, which the frame saves.
#[tauri::command]
pub fn live_engine_render_take(
    app: tauri::AppHandle,
    webview: tauri::WebviewWindow,
    request: tauri::ipc::Request<'_>,
) -> Result<tauri::ipc::Response, String> {
    #[cfg(feature = "native_shell")]
    {
        admit_candidate_webview(&webview)?;
        let tauri::ipc::InvokeBody::Raw(body) = request.body() else {
            return Err("A take is rendered through its part from its sound sent as bytes (oi.take-render/v1)".into());
        };
        Ok(tauri::ipc::Response::new(host(&app).render_take(body)?))
    }
    #[cfg(not(feature = "native_shell"))]
    {
        let _ = (app, webview, request);
        Err(EVERYDAY.into())
    }
}

/// Consolidate on an audio part (O-I #743): the host renders the part's clips
/// alone across the stretch and the kernel's Live owner keeps the render beside
/// the set as the clip that plays it, against the set's revision, its receipt
/// sent on the kernel's event topic.
#[tauri::command]
pub async fn live_engine_consolidate(
    app: tauri::AppHandle,
    webview: tauri::WebviewWindow,
    path: String,
    expected_revision: String,
    track: usize,
    from: f64,
    to: f64,
) -> Result<serde_json::Value, String> {
    #[cfg(feature = "native_shell")]
    {
        use tauri::{Emitter, Manager};
        admit_candidate_webview(&webview)?;
        tauri::async_runtime::spawn_blocking(move || {
            let set = std::path::Path::new(&path);
            let kept = host::consolidate(set, track, from, to, |wav| {
                let kernel = app.state::<crate::KernelHost>();
                let (receipt, reading) = kernel
                    .0
                    .lock()
                    .map_err(|_| "kernel lock unavailable".to_owned())?
                    .live_audio_consolidate(&path, &expected_revision, track, from, to, wav)?;
                let _ = app.emit(oi_cradle_kernel::events::KERNEL_EVENT_TOPIC, &receipt);
                Ok(reading)
            })?;
            // the engine playing the set lays the consolidated sample from the next block
            host(&app).kept_and_laid(set, kept)
        })
        .await
        .map_err(|e| e.to_string())?
    }
    #[cfg(not(feature = "native_shell"))]
    {
        let _ = (app, webview, path, expected_revision, track, from, to);
        Err(EVERYDAY.into())
    }
}

/// Crop on an audio clip (DLW build ruling 2026-11-05): the host cuts the
/// stretch of the clip's sample it keeps and the kernel's Live owner keeps the
/// cut beside the set as the sample the cropped clip plays, against the set's
/// revision, its receipt sent on the kernel's event topic.
#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn live_engine_crop(
    app: tauri::AppHandle,
    webview: tauri::WebviewWindow,
    path: String,
    expected_revision: String,
    track: usize,
    clip: serde_json::Value,
    from: Option<f64>,
    to: Option<f64>,
) -> Result<serde_json::Value, String> {
    #[cfg(feature = "native_shell")]
    {
        use tauri::{Emitter, Manager};
        admit_candidate_webview(&webview)?;
        let at = live_set::edit::ClipAt::of(&clip)?;
        let span = live_set::acts::span_of(from, to)?;
        tauri::async_runtime::spawn_blocking(move || {
            let set = std::path::Path::new(&path);
            let kept = host::crop(set, track, at, span, |wav| {
                let kernel = app.state::<crate::KernelHost>();
                let (receipt, reading) = kernel
                    .0
                    .lock()
                    .map_err(|_| "kernel lock unavailable".to_owned())?
                    .live_audio_crop(&path, &expected_revision, track, at, span, wav)?;
                let _ = app.emit(oi_cradle_kernel::events::KERNEL_EVENT_TOPIC, &receipt);
                Ok(reading)
            })?;
            // the engine playing the set lays the cropped sample from the next block
            host(&app).kept_and_laid(set, kept)
        })
        .await
        .map_err(|e| e.to_string())?
    }
    #[cfg(not(feature = "native_shell"))]
    {
        let _ = (app, webview, path, expected_revision, track, clip, from, to);
        Err(EVERYDAY.into())
    }
}

/// Export Audio: the host asks the person where the file goes in its own
/// save dialog and the kernel's Live owner writes it, its receipt sent on the
/// kernel's event topic. The page names no path.
#[tauri::command]
pub async fn live_engine_export(
    app: tauri::AppHandle,
    webview: tauri::WebviewWindow,
) -> Result<serde_json::Value, String> {
    #[cfg(feature = "native_shell")]
    {
        admit_candidate_webview(&webview)?;
        tauri::async_runtime::spawn_blocking(move || export_through_dialog(&app))
            .await
            .map_err(|e| e.to_string())?
    }
    #[cfg(not(feature = "native_shell"))]
    {
        let _ = (app, webview);
        Err(EVERYDAY.into())
    }
}

/// The save dialog, titled for Export Audio with the set's name as a .wav,
/// and the kernel's Live owner writing what the engine rendered.
#[cfg(feature = "native_shell")]
fn export_through_dialog(app: &tauri::AppHandle) -> Result<serde_json::Value, String> {
    use tauri::{Emitter, Manager};
    use tauri_plugin_dialog::DialogExt;
    host(app).export_chosen(
        |suggested| {
            app.dialog()
                .file()
                .set_title("Export Audio")
                .add_filter("WAV audio", &["wav"])
                .set_file_name(suggested)
                .blocking_save_file()
                .and_then(|file| file.into_path().ok())
        },
        |set, chosen, wav| {
            let kernel = app.state::<crate::KernelHost>();
            let (receipt, reading) = kernel
                .0
                .lock()
                .map_err(|_| "kernel lock unavailable".to_owned())?
                .live_audio_export(&set.to_string_lossy(), chosen, wav)?;
            let _ = app.emit(oi_cradle_kernel::events::KERNEL_EVENT_TOPIC, &receipt);
            Ok(reading)
        },
    )
}

/// File › Export Audio… (menus.rs): the same dialog and owner as the
/// command. A refusal other than a cancelled dialog stands in a native
/// message in its own words; a cancelled one is the person's own choice.
pub(crate) fn export_from_menu(app: &tauri::AppHandle) {
    #[cfg(feature = "native_shell")]
    {
        use tauri_plugin_dialog::DialogExt;
        let app = app.clone();
        // The save dialog blocks; menu events arrive on the main thread.
        std::thread::spawn(move || {
            if let Err(error) = export_through_dialog(&app) {
                if error != host::EXPORT_CANCELLED {
                    app.dialog()
                        .message(error)
                        .title("Export Audio did not write")
                        .blocking_show();
                }
            }
        });
    }
    #[cfg(not(feature = "native_shell"))]
    {
        use tauri_plugin_dialog::DialogExt;
        app.dialog()
            .message(EVERYDAY)
            .title("Export Audio did not write")
            .show(|_| {});
    }
}
