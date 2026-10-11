//! Document → graph bridging: a `live_set` summary becomes a renderable
//! [`Graph`].
//!
//! KNOWN devices instantiate their documented models at the factory-preset
//! stored values (`GlueCompressor` → `devices::GlueDevice`,
//! `devices/glue-compressor.md`; `Echo` → `devices::EchoDevice`,
//! `devices/echo.md`; `Reverb` → `devices::ReverbDevice`,
//! `evidence`-pinned default state per the dossier — the stored values are
//! cited at their construction below); UNKNOWN device element names
//! instantiate `BypassDevice` and produce a warning. Sources are not
//! loaded here: the host fills `Track::source` (arrangement clip playback
//! is M5 warp territory). Parameter editing from document states is not
//! bridged yet (the summary carries element names only) — M3 backlog.

use crate::devices::{BypassDevice, EchoDevice, EchoParams, GlueDevice, ReverbDevice};
use crate::graph::{Graph, Track};
use live_dynamics::glue::GlueParams;
use live_dynamics::reverb::ReverbParams;
use live_set::model::{SetSummary, TrackKind};

/// One device the bridge could not model.
#[derive(Debug, Clone, PartialEq)]
pub struct BridgeWarning {
    pub track: String,
    /// Document element name of the device.
    pub device: String,
    pub message: String,
}

/// The bridged graph plus everything the bridge wants on record.
#[derive(Debug)]
pub struct BridgeResult {
    pub graph: Graph,
    pub warnings: Vec<BridgeWarning>,
}

/// The KNOWN devices of the engine: each instantiated at its
/// factory-preset stored values, cited from the measuring document.
fn known_device(element_name: &str) -> Option<Box<dyn crate::graph::Device>> {
    match element_name {
        // devices/glue-compressor.md, "Preset stored values (unpinned)":
        // Threshold −40, Range 3, Makeup 0 (ballistics pins live in the
        // device's smoother defaults).
        "GlueCompressor" => Some(Box::new(GlueDevice::new(GlueParams {
            threshold_db: -40.0,
            range: 3.0,
            ratio: 1.0,
            makeup_db: 0.0,
        }))),
        // devices/echo.md E1 stored state (factory preset "Time Travel
        // Echo", evidence/devices/Echo/preset-time-travel.xml): Delay_Time
        // 0.1249999925 (stored unit = seconds; the synced-division mapping
        // is not modeled — backlog), Feedback 0.5, DryWet 0.5873016119.
        "Echo" => Some(Box::new(EchoDevice::new(EchoParams {
            delay_time_s: 0.1249999925,
            feedback: 0.5,
            dry_wet: 0.5873016119,
        }))),
        // Reverb default-preset stored state (evidence/devices/Reverb/
        // default.xml Manual: DecayTime 1200.00012 ms; the state carries
        // no global DryWet element — the direct level is MixDirect 0.55,
        // folded into the model's fitted constants — so the engine mix is
        // the model response, 1.0).
        "Reverb" => Some(Box::new(ReverbDevice::new(
            ReverbParams { decay_ms: 1200.00012 },
            1.0,
        ))),
        _ => None,
    }
}

/// Bridge a summarized document into a graph at `sample_rate`.
///
/// Audio tracks become stereo engine tracks with empty sources (the host
/// fills them); MIDI and return tracks are recorded as warnings (M1
/// renders audio tracks only); the master's device chain lands on the
/// master. Track order is preserved — it is the document's mix order.
pub fn bridge(summary: &SetSummary, sample_rate: u32) -> BridgeResult {
    let mut graph = Graph::new(sample_rate, summary.tempo_bpm);
    let mut warnings = Vec::new();
    for info in &summary.tracks {
        match info.kind {
            TrackKind::Master => {
                for d in &info.devices {
                    if let Some(dev) = known_device(d) {
                        graph.master.devices.push(dev);
                    } else {
                        graph.master.devices.push(Box::new(BypassDevice));
                        warnings.push(BridgeWarning {
                            track: info.name.clone(),
                            device: d.clone(),
                            message: "unknown device on master: bypassed".into(),
                        });
                    }
                }
            }
            TrackKind::Audio => {
                let mut track = Track::new(&info.name, 2);
                for d in &info.devices {
                    if let Some(dev) = known_device(d) {
                        track.devices.push(dev);
                    } else {
                        track.devices.push(Box::new(BypassDevice));
                        warnings.push(BridgeWarning {
                            track: info.name.clone(),
                            device: d.clone(),
                            message: "unknown device: bypassed".into(),
                        });
                    }
                }
                graph.tracks.push(track);
            }
            TrackKind::Midi => warnings.push(BridgeWarning {
                track: info.name.clone(),
                device: String::new(),
                message: "MIDI track: not rendered in M1 (no instrument voices yet)".into(),
            }),
            TrackKind::Return => warnings.push(BridgeWarning {
                track: info.name.clone(),
                device: String::new(),
                message: "return track: not rendered in M1 (no send bus yet)".into(),
            }),
        }
    }
    BridgeResult { graph, warnings }
}

#[cfg(test)]
mod tests {
    use super::*;
    use live_set::xml;

    fn summary_of(xml_src: &str) -> SetSummary {
        let tree = xml::parse(xml_src).unwrap();
        SetSummary::of(&tree).unwrap()
    }

    #[test]
    fn bridges_known_unknown_and_warns() {
        let s = summary_of(
            r#"<Ableton MajorVersion="5"><LiveSet>
          <MainTrack><DeviceChain><DeviceChain><Devices>
            <GlueCompressor Id="9" />
          </Devices></DeviceChain></DeviceChain></MainTrack>
          <Tracks>
            <AudioTrack Id="8"><Name><EffectiveName Value="STIM" /></Name>
              <DeviceChain><DeviceChain><Devices>
                <GlueCompressor Id="1" />
                <VinylWarble Id="2" />
              </Devices></DeviceChain></DeviceChain>
            </AudioTrack>
            <MidiTrack Id="9"><Name><EffectiveName Value="SYNTH" /></Name></MidiTrack>
            <ReturnTrack Id="10"><Name><EffectiveName Value="Reverb" /></Name></ReturnTrack>
          </Tracks>
        </LiveSet></Ableton>"#,
        );
        let r = bridge(&s, 48_000);
        assert_eq!(r.graph.tempo_bpm, 120.0);
        assert_eq!(r.graph.tracks.len(), 1);
        let t = &r.graph.tracks[0];
        assert_eq!(t.name, "STIM");
        assert_eq!(t.devices.len(), 2);
        assert_eq!(t.devices[0].name(), "GlueCompressor");
        assert_eq!(t.devices[1].name(), "Bypass");
        assert_eq!(r.graph.master.devices.len(), 1);
        assert_eq!(r.graph.master.devices[0].name(), "GlueCompressor");
        // warnings: unknown device on STIM, MIDI track, return track
        assert_eq!(r.warnings.len(), 3, "{:?}", r.warnings);
        assert_eq!(r.warnings[0].device, "VinylWarble");
        assert!(r.warnings[1].message.contains("MIDI"));
        assert!(r.warnings[2].message.contains("return"));
    }

    #[test]
    fn bridged_graph_renders_silence_from_empty_sources() {
        let s = summary_of(
            r#"<Ableton MajorVersion="5"><LiveSet>
          <Tracks><AudioTrack Id="8"><Name><EffectiveName Value="A" /></Name></AudioTrack></Tracks>
        </LiveSet></Ableton>"#,
        );
        let r = bridge(&s, 48_000);
        assert!(r.warnings.is_empty(), "{:?}", r.warnings);
        assert!(r.graph.render(48_000).is_empty());
    }

    #[test]
    fn bridges_echo_and_reverb_as_known_devices() {
        let s = summary_of(
            r#"<Ableton MajorVersion="5"><LiveSet>
          <Tracks><AudioTrack Id="8"><Name><EffectiveName Value="A" /></Name>
            <DeviceChain><DeviceChain><Devices>
              <Echo Id="1" />
              <Reverb Id="2" />
            </Devices></DeviceChain></DeviceChain>
          </AudioTrack></Tracks>
        </LiveSet></Ableton>"#,
        );
        let mut r = bridge(&s, 48_000);
        assert!(r.warnings.is_empty(), "{:?}", r.warnings);
        let t = &mut r.graph.tracks[0];
        assert_eq!(t.devices.len(), 2);
        assert_eq!(t.devices[0].name(), "Echo");
        assert_eq!(t.devices[1].name(), "Reverb");
        // both render without panicking (unknown devices bypass, these
        // must actually process — 0.2 s so the first echo hop lands)
        t.source = vec![0.0; 9_600];
        t.source[200] = 1.0;
        t.source[201] = 1.0;
        let out = r.graph.render(48_000);
        assert!(out.iter().any(|v| *v != 0.0));
    }
}
