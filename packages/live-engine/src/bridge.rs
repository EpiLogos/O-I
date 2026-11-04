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

use crate::devices::{
    BypassDevice, CompressorDevice, EchoDevice, EchoParams, GlueDevice, ReverbDevice,
};
use crate::graph::{Clock, Graph, Note, RackDevice, ReturnTrack, Track};
use crate::instruments::OperatorInstrument;
use live_dynamics::glue::GlueParams;
use live_dynamics::reverb::ReverbParams;
use live_set::model::{SetSummary, TrackKind};
use live_set::xml::Element;

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
            ReverbParams {
                decay_ms: 1200.00012,
            },
            1.0,
        ))),
        _ => None,
    }
}

/// The engine's own device for Live's device `class` on an Instrument Rack's chain (O-I #849 round
/// 13: the Torus's effects, as live-set `rack_place` places them), with the settings carried onto it,
/// by Live's document key: Live's Reverb as the gated model ([`ReverbDevice`], at its stored
/// `DecayTime` in ms when carried, the one setting the model takes), convolving by partitions since
/// the part it stands on sounds every sample; Live's Compressor as its model at the corpus's stored
/// values ([`CompressorDevice`]), which takes no setting yet. What it was made from names the class
/// and the settings. Refused in words for a class the engine has no model of, and for a setting its
/// model does not take.
pub fn rack_device(class: &str, carried: &[(&str, f64)]) -> Result<RackDevice, String> {
    let refuse_rest =
        |title: &str, takes: &[&str]| match carried.iter().find(|(id, _)| !takes.contains(id)) {
            Some((id, _)) => Err(format!(
                "the engine's model of Live's {title} does not take its {id} yet"
            )),
            None => Ok(()),
        };
    let device: Box<dyn crate::graph::Device> = match class {
        "Reverb" => {
            refuse_rest("Reverb", &["DecayTime"])?;
            let decay_ms = carried
                .iter()
                .find(|(id, _)| *id == "DecayTime")
                .map_or(1200.00012, |(_, ms)| *ms);
            if !(decay_ms.is_finite() && decay_ms > 0.0) {
                return Err(format!(
                    "Live's Reverb holds a DecayTime above 0 ms, not {decay_ms}"
                ));
            }
            Box::new(ReverbDevice::partitioned(
                live_dynamics::reverb::ReverbParams { decay_ms },
                1.0,
            ))
        }
        "Compressor2" => {
            refuse_rest("Compressor", &[])?;
            Box::new(CompressorDevice::new(live_dynamics::compressor::DEFAULTS))
        }
        "AutoFilter" => return Err("Live's Auto Filter has no model in the engine yet".into()),
        "Delay" => return Err("Live's Delay has no model in the engine yet".into()),
        other => return Err(format!("Live's {other} has no model in the engine yet")),
    };
    let mut made_from = class.to_string();
    for (id, value) in carried {
        made_from.push_str(&format!(" {id}={value}"));
    }
    Ok(RackDevice { made_from, device })
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
                message: "MIDI track: the summary carries no notes or mixer (bridge the document with bridge_set)".into(),
            }),
            TrackKind::Return => warnings.push(BridgeWarning {
                track: info.name.clone(),
                device: String::new(),
                message: "return track: the summary carries no sends (bridge the document with bridge_set)".into(),
            }),
            TrackKind::Group => warnings.push(BridgeWarning {
                track: info.name.clone(),
                device: String::new(),
                message: "group track: not rendered in M1 (its members render on their own; no group bus yet)".into(),
            }),
        }
    }
    BridgeResult { graph, warnings }
}

// ---------------------------------------------------------------- the set

fn manual(param: Option<&Element>) -> Option<&str> {
    param
        .and_then(|p| p.child("Manual"))
        .and_then(|m| m.attr("Value"))
}

fn num(param: Option<&Element>) -> Option<f64> {
    manual(param).and_then(|v| v.parse().ok())
}

fn value_attr(e: Option<&Element>) -> Option<&str> {
    e.and_then(|e| e.attr("Value"))
}

fn beats(e: &Element, name: &str) -> Option<f64> {
    value_attr(e.child(name)).and_then(|v| v.parse().ok())
}

/// A track's device list: `DeviceChain/DeviceChain/Devices` (session-model.md
/// §3), else the first `Devices` below it (the summary's reading).
fn devices_of(track: &Element) -> Vec<&Element> {
    track
        .child("DeviceChain")
        .and_then(|d| d.child("DeviceChain"))
        .and_then(|d| d.child("Devices"))
        .or_else(|| track.find("Devices"))
        .map(|ds| ds.children.iter().collect())
        .unwrap_or_default()
}

/// The mixer row as the document keeps it (session-model.md §3:
/// `DeviceChain/Mixer` — Volume, Pan, Speaker, SoloSink, Sends): (gain,
/// pan, active, solo, sends). Volume and sends are linear gains as stored;
/// absent values read as Live's defaults (unity, centre, on, unsoloed).
fn mixer_row(track: &Element) -> (f64, f64, bool, bool, Vec<f64>) {
    let mixer = track.child("DeviceChain").and_then(|d| d.child("Mixer"));
    let Some(m) = mixer else {
        return (1.0, 0.0, true, false, Vec::new());
    };
    let gain = num(m.child("Volume")).unwrap_or(1.0);
    let pan = num(m.child("Pan")).unwrap_or(0.0);
    let active = manual(m.child("Speaker"))
        .map(|v| v != "false")
        .unwrap_or(true);
    let solo = value_attr(m.child("SoloSink")) == Some("true");
    let sends = m
        .child("Sends")
        .map(|s| {
            s.children_named("TrackSendHolder")
                .map(|h| num(h.child("Send")).unwrap_or(0.0))
                .collect()
        })
        .unwrap_or_default();
    (gain, pan, active, solo, sends)
}

/// The arrangement MIDI notes of a track
/// (`MainSequencer/ClipTimeable/ArrangerAutomation/Events/MidiClip`,
/// session-model.md §7), on `clock`'s timeline. A clip anchors at its
/// `Time` attribute (absent: arrangement 0 — session-model.md §7, FA
/// probes) and covers `CurrentEnd − CurrentStart` beats; a note's clip
/// time is its `Time`. ENGINE DECISION (the loop semantics no dossier
/// measures yet): an unlooped clip plays the notes in `[LoopStart,
/// LoopStart + span)`; a looped clip repeats `[LoopStart, LoopEnd)` from
/// `StartRelative` until the span ends. Notes are cut at the clip's end;
/// disabled notes and disabled clips are skipped.
pub fn arrangement_notes(track: &Element, clock: &Clock) -> Vec<Note> {
    let mut notes = Vec::new();
    let Some(events) = track
        .child("DeviceChain")
        .and_then(|d| d.child("MainSequencer"))
        .and_then(|s| s.child("ClipTimeable"))
        .and_then(|c| c.child("ArrangerAutomation"))
        .and_then(|a| a.child("Events"))
    else {
        return notes;
    };
    for clip in events.children_named("MidiClip") {
        if value_attr(clip.child("Disabled")) == Some("true") {
            continue;
        }
        let anchor = clip
            .attr("Time")
            .and_then(|v| v.parse::<f64>().ok())
            .unwrap_or(0.0);
        let span =
            beats(clip, "CurrentEnd").unwrap_or(0.0) - beats(clip, "CurrentStart").unwrap_or(0.0);
        let lp = clip.child("Loop");
        let at = |name: &str| lp.and_then(|l| beats(l, name)).unwrap_or(0.0);
        let (loop_start, loop_end, start_rel) =
            (at("LoopStart"), at("LoopEnd"), at("StartRelative"));
        let looped = lp.and_then(|l| value_attr(l.child("LoopOn"))) == Some("true");
        let Some(key_tracks) = clip.child("Notes").and_then(|n| n.child("KeyTracks")) else {
            continue;
        };
        for kt in &key_tracks.children {
            let Some(key) = value_attr(kt.child("MidiKey")).and_then(|v| v.parse::<u8>().ok())
            else {
                continue;
            };
            let Some(list) = kt.child("Notes") else {
                continue;
            };
            for ev in list.children_named("MidiNoteEvent") {
                if ev.attr("IsEnabled") == Some("false") {
                    continue;
                }
                let get = |n: &str| ev.attr(n).and_then(|v| v.parse::<f64>().ok());
                let (Some(t), Some(dur)) = (get("Time"), get("Duration")) else {
                    continue;
                };
                let velocity = get("Velocity").unwrap_or(100.0) as f32;
                let mut push = |rel: f64, len: f64| {
                    if rel < 0.0 || rel >= span || len <= 0.0 {
                        return;
                    }
                    let len = len.min(span - rel);
                    let start = clock.frame_of_beat(anchor + rel);
                    let end = clock.frame_of_beat(anchor + rel + len);
                    notes.push(Note {
                        key,
                        start,
                        length: end.saturating_sub(start),
                        velocity,
                    });
                };
                if looped {
                    let l = loop_end - loop_start;
                    if l <= 0.0 || t < loop_start || t >= loop_end {
                        continue;
                    }
                    let first = (t - loop_start - start_rel).rem_euclid(l);
                    let mut rel = first;
                    while rel < span {
                        push(rel, dur.min(loop_end - t));
                        rel += l;
                    }
                } else {
                    push(t - loop_start, dur);
                }
            }
        }
    }
    notes.sort_by_key(|n| (n.start, n.key));
    notes
}

/// A device element on a chain: a known model at its factory values, else
/// a bypass and a warning.
fn chain_device(
    el: &Element,
    track: &str,
    warnings: &mut Vec<BridgeWarning>,
) -> Box<dyn crate::graph::Device> {
    known_device(&el.name).unwrap_or_else(|| {
        warnings.push(BridgeWarning {
            track: track.to_string(),
            device: el.name.clone(),
            message: "unknown device: bypassed".into(),
        });
        Box::new(BypassDevice)
    })
}

/// Bridge a parsed set document (`<Ableton>`) into a graph at
/// `sample_rate`: every part with its mixer row (volume, pan, activator,
/// solo, sends), MIDI parts with their instrument and arrangement notes,
/// the return tracks, and the Main track's volume, pan and chain.
///
/// A MIDI part's first `Operator` is its instrument (the gated default
/// patch — the bridge reads device element names, not stored parameter
/// states, as for the effects); a MIDI part with no instrument the engine
/// models stays silent, with a warning. Audio parts keep empty sources
/// (the host fills them). Group tracks are warnings: their members route
/// to the Main track (ENGINE DECISION — there is no group bus yet).
pub fn bridge_set(root: &Element, sample_rate: u32) -> Option<BridgeResult> {
    let ls = root.find("LiveSet")?;
    let tempo_bpm = num(ls.child("MainTrack").and_then(|m| m.find("Tempo"))).unwrap_or(120.0);
    let mut graph = Graph::new(sample_rate, tempo_bpm);
    let clock = Clock::start(sample_rate, tempo_bpm);
    let mut warnings = Vec::new();
    if let Some(tracks) = ls.child("Tracks") {
        for tr in &tracks.children {
            let name = tr
                .find("EffectiveName")
                .and_then(|n| n.attr("Value"))
                .unwrap_or("")
                .to_string();
            let (gain, pan, active, solo, sends) = mixer_row(tr);
            match tr.name.as_str() {
                "AudioTrack" | "MidiTrack" => {
                    let midi = tr.name == "MidiTrack";
                    let mut track = Track::new(&name, 2);
                    let mut instrument_seen = false;
                    for d in devices_of(tr) {
                        if midi && !instrument_seen && d.name == "Operator" {
                            track.instrument =
                                Some(Box::new(OperatorInstrument::default_patch(sample_rate)));
                            instrument_seen = true;
                        } else {
                            track.devices.push(chain_device(d, &name, &mut warnings));
                        }
                    }
                    if midi {
                        if track.instrument.is_none() {
                            warnings.push(BridgeWarning {
                                track: name.clone(),
                                device: String::new(),
                                message: "MIDI part with no instrument the engine models: it plays its notes silently".into(),
                            });
                            track.instrument = Some(Box::new(crate::instruments::SilentInstrument));
                        }
                        track.set_notes(&arrangement_notes(tr, &clock));
                    }
                    track.gain = gain;
                    track.pan = pan;
                    track.active = active;
                    track.solo = solo;
                    track.sends = sends;
                    graph.tracks.push(track);
                }
                "ReturnTrack" => {
                    let mut ret = ReturnTrack::new(&name);
                    for d in devices_of(tr) {
                        ret.devices.push(chain_device(d, &name, &mut warnings));
                    }
                    ret.gain = gain;
                    ret.pan = pan;
                    ret.active = active;
                    graph.returns.push(ret);
                }
                "GroupTrack" => warnings.push(BridgeWarning {
                    track: name,
                    device: String::new(),
                    message: "group track: its members route to the Main track (no group bus yet)"
                        .into(),
                }),
                _ => {}
            }
        }
    }
    // the per-return pre/post flags, in return order (devices/
    // racks-session-model.md §2.1: `SendsPre/SendPreBool Id=N Value=bool`)
    if let Some(pre) = ls.child("SendsPre") {
        for (ret, flag) in graph
            .returns
            .iter_mut()
            .zip(pre.children_named("SendPreBool"))
        {
            ret.pre_fader = flag.attr("Value") == Some("true");
        }
    }
    graph.solo_in_place = value_attr(ls.child("SoloInPlace")) != Some("false");
    if let Some(mt) = ls.child("MainTrack") {
        let (gain, pan, _, _, _) = mixer_row(mt);
        graph.master.gain = gain;
        graph.master.pan = pan;
        for d in devices_of(mt) {
            let dev = chain_device(d, "Main", &mut warnings);
            graph.master.devices.push(dev);
        }
    }
    Some(BridgeResult { graph, warnings })
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

    /// Live's devices on a rack's chain as the engine's own (O-I #849 round 13): Reverb at a carried
    /// DecayTime and Compressor at the corpus's values; Auto Filter and Delay have no model yet, and a
    /// setting a model does not take is refused, each in words.
    #[test]
    fn a_rack_chains_live_devices_are_the_engines_own_or_refused_in_words() {
        let reverb = rack_device("Reverb", &[("DecayTime", 2400.0)]).unwrap();
        assert_eq!(reverb.device.name(), "Reverb");
        assert_eq!(reverb.made_from, "Reverb DecayTime=2400");
        assert_eq!(rack_device("Reverb", &[]).unwrap().made_from, "Reverb");
        let compressor = rack_device("Compressor2", &[]).unwrap();
        assert_eq!(compressor.device.name(), "Compressor2");
        for (class, words) in [
            (
                "AutoFilter",
                "Live's Auto Filter has no model in the engine yet",
            ),
            ("Delay", "Live's Delay has no model in the engine yet"),
        ] {
            assert_eq!(rack_device(class, &[]).unwrap_err(), words);
        }
        assert_eq!(
            rack_device("Reverb", &[("PreDelay", 20.0)]).unwrap_err(),
            "the engine's model of Live's Reverb does not take its PreDelay yet"
        );
        assert!(rack_device("Reverb", &[("DecayTime", 0.0)]).is_err());
        // the reverb rings what it is given, every sample, in real time: a dense second renders
        let mut r = rack_device("Reverb", &[("DecayTime", 600.0)]).unwrap();
        r.device.prepare(48_000, 2);
        let clock = Clock::start(48_000, 120.0);
        let started = std::time::Instant::now();
        let mut heard = 0f32;
        for n in 0..48_000 {
            let mut frame = [((n % 97) as f32 / 97.0) - 0.5; 2];
            r.device.process(&mut frame, &clock);
            heard = heard.max(frame[0].abs());
        }
        assert!(heard > 0.0);
        assert!(
            started.elapsed() < std::time::Duration::from_secs(20),
            "{:?}",
            started.elapsed()
        );
    }
}
