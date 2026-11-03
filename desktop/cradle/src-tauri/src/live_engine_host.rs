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
//! | `live_engine_send {event}` | one note, Panic or mixer move, applied at the next block; answers the mixer reading |
//! | `live_engine_mixer` | the mixer as the engine applied it |
//! | `live_engine_export {path}` | Export Audio: what the engine played, rendered offline, as a 32-bit float WAV |
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
    };
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
    /// `note_off`, `panic`, `volume`, `pan`, `send`, `active`, `solo`) and
    /// the fields its kind takes sit beside it. A plain struct, not a
    /// tagged enum: a tagged enum buffers its fields, and the buffered
    /// numbers of this build's serde_json (arbitrary precision, enabled by
    /// a dependency) arrive as maps — "invalid type: map, expected f64".
    #[derive(Debug, Clone, Copy, Deserialize)]
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
            })
        }
    }

    /// The set bridged into the engine's graph at [`ENGINE_RATE`], with the
    /// bridge's warnings and the audio parts that play no clip audio.
    pub fn bridged(path: &Path) -> Result<(Graph, Vec<String>), String> {
        if !path.is_absolute() || path.extension().is_none_or(|e| e != "als") {
            return Err("Choose an absolute native .als document path".into());
        }
        let root = live_set::open_als(path).map_err(|e| format!("{}: {e:?}", path.display()))?;
        let bridged = bridge_set(&root, ENGINE_RATE).ok_or("No LiveSet in native document")?;
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

    /// One open set's engine.
    pub struct Opened {
        pub path: PathBuf,
        pub warnings: Vec<String>,
        pub handle: EngineHandle,
        /// The audio half while it is not playing (taken by `play`).
        pub core: Option<EngineCore>,
        pub player: Option<EnginePlayer>,
    }

    impl Opened {
        pub fn open(path: &Path) -> Result<Opened, String> {
            let (graph, warnings) = bridged(path)?;
            let (core, handle) = engine(graph).map_err(|e| e.to_string())?;
            Ok(Opened {
                path: path.to_path_buf(),
                warnings,
                handle,
                core: Some(core),
                player: None,
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
            })
        }

        pub fn send(&mut self, event: EventIn) -> Result<Value, String> {
            self.handle
                .send(event.event()?)
                .map_err(|e| e.to_string())?;
            Ok(self.reading())
        }

        /// Export Audio: the set bridged again and rendered offline with
        /// every event the engine applied, at the frame it applied it —
        /// the samples the engine played (live-engine
        /// `Graph::render_performance`).
        pub fn export(&mut self, out: &Path) -> Result<Value, String> {
            let performance = self.handle.performance();
            let (graph, _) = bridged(&self.path)?;
            let samples = graph.render_performance(ENGINE_RATE, &performance);
            write_wav_f32(out, &samples, ENGINE_RATE)?;
            Ok(
                json!({"path": out, "frames": performance.frames, "events": performance.events.len(), "complete": performance.complete}),
            )
        }
    }

    /// A 32-bit IEEE float stereo WAV (format tag 3).
    pub fn write_wav_f32(path: &Path, interleaved: &[f32], sample_rate: u32) -> Result<(), String> {
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
        std::fs::write(path, bytes).map_err(|e| format!("{}: {e}", path.display()))
    }

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
                            let fresh = Opened::open(&o.path)?;
                            o.handle = fresh.handle;
                            fresh.core.ok_or("the engine was not made")?
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

        pub fn mixer(&self) -> Result<Value, String> {
            self.with(|o| Ok(o.reading()))
        }

        pub fn export(&self, out: &Path) -> Result<Value, String> {
            if !out.is_absolute() || out.extension().is_none_or(|e| e != "wav") {
                return Err("Export Audio writes to an absolute .wav path".into());
            }
            self.with(|o| o.export(out))
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
            let (graph, _) = bridged(&path).unwrap();
            let frames = played.len() as u64 / 2;
            let rendered = graph.render_performance(ENGINE_RATE, &Performance::silent(frames));
            assert!(
                rendered == played,
                "the host's pull is the engine's render, sample for sample"
            );
            // two parts at once: each alone, summed, is the whole (no part
            // reaches the other)
            let alone = |keep: usize| {
                let (mut g, _) = bridged(&path).unwrap();
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
                let (mut g, _) = bridged(path).unwrap();
                g.tracks[1].active = false;
                g.returns[0].active = false;
                g.master.gain = 1.0;
                g.render_performance(ENGINE_RATE, &Performance::silent(frames))
            };
            let (kw, kd) = (keys_alone(&wet_path), keys_alone(&dry_path));
            let (mut g, _) = bridged(&wet_path).unwrap();
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
            let out = path.with_extension("wav");
            let exported = opened.export(&out).unwrap();
            assert_eq!(exported["events"], 8);
            assert_eq!(exported["complete"], true);
            let wav = live_engine::wav::read_wav_f32(&std::fs::read(&out).unwrap()).unwrap();
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
            assert!(host
                .export(Path::new("/tmp/x.mp3"))
                .unwrap_err()
                .contains(".wav"));
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
        admit_candidate_webview(&webview)?;
        host(&app).open(std::path::Path::new(&path))
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

#[tauri::command]
pub async fn live_engine_export(
    app: tauri::AppHandle,
    webview: tauri::WebviewWindow,
    path: String,
) -> Result<serde_json::Value, String> {
    #[cfg(feature = "native_shell")]
    {
        admit_candidate_webview(&webview)?;
        tauri::async_runtime::spawn_blocking(move || host(&app).export(std::path::Path::new(&path)))
            .await
            .map_err(|e| e.to_string())?
    }
    #[cfg(not(feature = "native_shell"))]
    {
        let _ = (app, webview, path);
        Err(EVERYDAY.into())
    }
}
