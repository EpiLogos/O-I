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
//! | `live_engine_send {event}` | one note, Torus act, Panic or mixer move, applied at the next block; answers the mixer reading |
//! | `live_engine_torus {lease, track, sha256}` | the Torus its owner handed over (kept by the kernel under the field's lease) sounds on the part |
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
//! Events are refused in the engine's words when the set has nothing they
//! name. A mixer reading is what the engine APPLIED, never what was asked.
//! Audio parts play no clip audio yet: the bridge leaves their sources empty
//! and this host loads no samples — each such part is named in the
//! reading's `warnings`.

#[cfg(feature = "native_shell")]
pub(crate) mod host {
    use live_engine::bridge::bridge_set;
    use live_engine::engine::PartMix;
    use live_engine::{
        engine, EngineCore, EngineEvent, EngineHandle, EnginePlayer, Graph, MixerState, Part,
        TorusAct,
    };
    use live_set::xml::Element;
    use serde::Deserialize;
    use serde_json::{json, Value};
    use std::path::{Path, PathBuf};
    use std::sync::Mutex;

    /// The rate the engine runs and the output opens at (the harness
    /// signals' and the Torus's rate; there is no resampling).
    pub const ENGINE_RATE: u32 = 48_000;

    /// A part as an event names it: `{"track": i}`, `{"return": i}` or
    /// `"main"`.
    #[derive(Debug, Clone, Copy, Deserialize)]
    #[serde(rename_all = "snake_case", deny_unknown_fields)]
    pub enum PartIn {
        Track(usize),
        Return(usize),
        Main,
    }

    impl From<PartIn> for Part {
        fn from(p: PartIn) -> Part {
            match p {
                PartIn::Track(i) => Part::Track(i),
                PartIn::Return(i) => Part::Return(i),
                PartIn::Main => Part::Main,
            }
        }
    }

    /// One engine event as the UI sends it: `kind` names it (`note_on`,
    /// `note_off`, `panic`, `volume`, `pan`, `send`, `active`, `solo`,
    /// `torus_play`) and the fields its kind takes sit beside it. A plain
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
    }

    /// One of the Torus's keys: its row on the surface and its column.
    #[derive(Debug, Clone, Copy, Deserialize)]
    #[serde(deny_unknown_fields)]
    pub struct KeyIn {
        row: u8,
        column: u16,
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
    }

    impl EventIn {
        /// The engine event, or the field its kind lacks.
        pub fn event(self) -> Result<EngineEvent, String> {
            fn need<T>(v: Option<T>, kind: &str, field: &str) -> Result<T, String> {
                v.ok_or_else(|| format!("a {kind} event names its {field}"))
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
                EventKind::Volume => EngineEvent::Volume {
                    part: need(part, &name, "part")?.into(),
                    gain: need(gain, &name, "gain")?,
                },
                EventKind::Pan => EngineEvent::Pan {
                    part: need(part, &name, "part")?.into(),
                    pan: need(pan, &name, "pan")?,
                },
                EventKind::Send => EngineEvent::Send {
                    track: need(track, &name, "track")?,
                    send: need(send, &name, "send")?,
                    gain: need(gain, &name, "gain")?,
                },
                EventKind::Active => EngineEvent::Active {
                    part: need(part, &name, "part")?.into(),
                    on: need(on, &name, "on")?,
                },
                EventKind::Solo => EngineEvent::Solo {
                    track: need(track, &name, "track")?,
                    on: need(on, &name, "on")?,
                },
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

    /// The set bridged into the engine's graph at [`ENGINE_RATE`], with the
    /// bridge's warnings and the audio parts that play no clip audio.
    pub fn bridged(root: &Element) -> Result<(Graph, Vec<String>), String> {
        let bridged = bridge_set(root, ENGINE_RATE).ok_or("No LiveSet in native document")?;
        let mut warnings: Vec<String> = bridged
            .warnings
            .iter()
            .map(|w| {
                if w.device.is_empty() {
                    format!("{}: {}", w.track, w.message)
                } else {
                    format!("{} · {}: {}", w.track, w.device, w.message)
                }
            })
            .collect();
        for t in bridged.graph.tracks.iter().filter(|t| !t.is_midi()) {
            warnings.push(format!(
                "{}: an audio part plays no clip audio yet (the host loads no samples)",
                t.name
            ));
        }
        Ok((bridged.graph, warnings))
    }

    fn part_json(p: &PartMix) -> Value {
        json!({"name": p.name, "gain": p.gain, "pan": p.pan, "active": p.active, "solo": p.solo, "sends": p.sends, "midi": p.midi})
    }

    pub fn mixer_json(m: &MixerState) -> Value {
        json!({
            "tracks": m.tracks.iter().map(part_json).collect::<Vec<_>>(),
            "returns": m.returns.iter().map(part_json).collect::<Vec<_>>(),
            "main": part_json(&m.main),
        })
    }

    /// The words the Torus is refused in by a host built without QL's K8 node.
    #[cfg(not(feature = "k8"))]
    pub const WITHOUT_K8: &str = "The Torus sounds in the one engine through QL's K8 node, and this host was built without QL's K8 node (its k8 feature)";

    /// A Torus handed over to one of the set's parts (O-I #849): the part, the digest its owner
    /// handed it over by and the sample it stood at, and what it was made from, for Export Audio.
    #[cfg_attr(not(feature = "k8"), allow(dead_code))]
    pub struct TorusOnPart {
        pub track: usize,
        pub sha256: String,
        pub at_samples_elapsed: u64,
        #[cfg(feature = "k8")]
        pub handed: crate::torus_native::Handed,
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
        /// Every Torus handed over to a part, in the order handed: the engine takes each before the
        /// next is handed ([`EngineHandle::install`]), so the n-th is the engine's n-th install.
        pub toruses: Vec<TorusOnPart>,
    }

    impl Opened {
        pub fn open(path: &Path) -> Result<Opened, String> {
            let document = set_document(path)?;
            let (graph, warnings) = bridged(&document)?;
            let (core, handle) = engine(graph).map_err(|e| e.to_string())?;
            Ok(Opened {
                path: path.to_path_buf(),
                document,
                warnings,
                handle,
                core: Some(core),
                player: None,
                toruses: Vec::new(),
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
            })
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
                        json!({
                            "track": t.track,
                            "sha256": t.sha256,
                            "at_samples_elapsed": t.at_samples_elapsed.to_string(),
                            "sounding_from_frame": taken.get(i).map(|(frame, _)| *frame),
                        })
                    })
                    .collect(),
            )
        }

        pub fn send(&mut self, event: EventIn) -> Result<Value, String> {
            let event = event.event()?;
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

        /// Hand the Torus its owner handed over (`ql.torus-native/v1`, as the kernel kept it under its
        /// digest `sha256`) to the set's part `track` (O-I #849): the node continues the owner's field
        /// from the sample it stood at, takes the part at the engine's next block and sounds through
        /// the part's chain and mixer row to Main. Refused in words for a document that is not one, a
        /// part that plays no notes, a Torus still on its way, or a host without QL's K8 node.
        pub fn install_torus(
            &mut self,
            track: usize,
            sha256: &str,
            document: &Value,
        ) -> Result<Value, String> {
            #[cfg(feature = "k8")]
            {
                let handed = crate::torus_native::read(document)?;
                let node = handed.node(ENGINE_RATE)?;
                self.handle
                    .install(track, node)
                    .map_err(|e| e.to_string())?;
                self.toruses.push(TorusOnPart {
                    track,
                    sha256: sha256.to_owned(),
                    at_samples_elapsed: handed.at_samples_elapsed,
                    handed,
                });
                Ok(self.reading())
            }
            #[cfg(not(feature = "k8"))]
            {
                let _ = (track, sha256, document);
                Err(WITHOUT_K8.into())
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
            let (graph, _) = bridged(&self.document)?;
            // Each Torus made again from what was handed over, at the frame the engine took it.
            #[cfg(feature = "k8")]
            let samples = {
                let toruses = self
                    .handle
                    .installs()
                    .iter()
                    .zip(&self.toruses)
                    .map(|(&(frame, track), torus)| {
                        Ok((frame, track, torus.handed.node(ENGINE_RATE)?))
                    })
                    .collect::<Result<Vec<_>, String>>()?;
                graph.render_performance_with(ENGINE_RATE, &performance, toruses)
            };
            #[cfg(not(feature = "k8"))]
            let samples = graph.render_performance(ENGINE_RATE, &performance);
            Ok((
                wav_f32(&samples, ENGINE_RATE),
                json!({"frames": performance.frames, "events": performance.events.len(), "complete": performance.complete}),
            ))
        }
    }

    /// A 32-bit IEEE float stereo WAV (format tag 3), as bytes.
    pub fn wav_f32(interleaved: &[f32], sample_rate: u32) -> Vec<u8> {
        let data = (interleaved.len() * 4) as u32;
        let mut bytes = Vec::with_capacity(44 + data as usize);
        bytes.extend_from_slice(b"RIFF");
        bytes.extend_from_slice(&(36 + data).to_le_bytes());
        bytes.extend_from_slice(b"WAVEfmt ");
        bytes.extend_from_slice(&16u32.to_le_bytes());
        bytes.extend_from_slice(&3u16.to_le_bytes());
        bytes.extend_from_slice(&2u16.to_le_bytes());
        bytes.extend_from_slice(&sample_rate.to_le_bytes());
        bytes.extend_from_slice(&(sample_rate * 8).to_le_bytes());
        bytes.extend_from_slice(&8u16.to_le_bytes());
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

    /// The host's state: at most one open set.
    #[derive(Default)]
    pub struct LiveEngineHost(pub Mutex<Option<Opened>>);

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
                                ..
                            } = Opened::open(&o.path)?;
                            (o.document, o.warnings, o.handle) = (document, warnings, handle);
                            // a new engine holds no Torus: the owner hands it over again
                            o.toruses.clear();
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
                Ok(o.reading())
            })
        }

        pub fn send(&self, event: EventIn) -> Result<Value, String> {
            self.with(|o| o.send(event))
        }

        pub fn install_torus(
            &self,
            track: usize,
            sha256: &str,
            document: &Value,
        ) -> Result<Value, String> {
            self.with(|o| o.install_torus(track, sha256, document))
        }

        pub fn mixer(&self) -> Result<Value, String> {
            self.with(|o| Ok(o.reading()))
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
            let (graph, _) = bridged(&set_document(&path).unwrap()).unwrap();
            let frames = played.len() as u64 / 2;
            let rendered = graph.render_performance(ENGINE_RATE, &Performance::silent(frames));
            assert!(
                rendered == played,
                "the host's pull is the engine's render, sample for sample"
            );
            // two parts at once: each alone, summed, is the whole (no part
            // reaches the other)
            let alone = |keep: usize| {
                let (mut g, _) = bridged(&set_document(&path).unwrap()).unwrap();
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
                let (mut g, _) = bridged(&set_document(path).unwrap()).unwrap();
                g.tracks[1].active = false;
                g.returns[0].active = false;
                g.master.gain = 1.0;
                g.render_performance(ENGINE_RATE, &Performance::silent(frames))
            };
            let (kw, kd) = (keys_alone(&wet_path), keys_alone(&dry_path));
            let (mut g, _) = bridged(&set_document(&wet_path).unwrap()).unwrap();
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
                .install_torus(0, "sha256:none", &json!({}))
                .unwrap_err();
            assert!(refused.contains("built without QL's K8 node"), "{refused}");
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
/// document under the field's lease (`Field::torus_native`), and the page names only its digest.
#[tauri::command]
pub fn live_engine_torus(
    app: tauri::AppHandle,
    webview: tauri::WebviewWindow,
    lease: String,
    track: usize,
    sha256: String,
) -> Result<serde_json::Value, String> {
    #[cfg(feature = "native_shell")]
    {
        use tauri::Manager;
        admit_candidate_webview(&webview)?;
        let handed = app
            .state::<crate::KernelHost>()
            .1
            .torus_native(&lease, &sha256)?;
        host(&app).install_torus(track, &sha256, &handed)
    }
    #[cfg(not(feature = "native_shell"))]
    {
        let _ = (app, webview, lease, track, sha256);
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
