//! JSON API surface for wider agents (astra et al.) to build against.
//! Every response is plain serde_json — the stable contract for M2.

use serde::Serialize;
use std::collections::BTreeMap;

#[derive(Serialize)]
pub struct TrackJson {
    pub kind: String,
    pub name: String,
    pub devices: Vec<String>,
}

#[derive(Serialize)]
pub struct SummaryJson {
    pub path: String,
    pub tempo_bpm: f64,
    pub scene_count: usize,
    pub arrangement_clips: usize,
    pub tracks: Vec<TrackJson>,
}

/// The API contract: a parsed document → the summary astra builds against.
pub fn summary_json(path: &str, root: &live_set::xml::Element) -> Option<SummaryJson> {
    let s = live_set::model::SetSummary::of(root)?;
    Some(SummaryJson {
        path: path.to_string(),
        tempo_bpm: s.tempo_bpm,
        scene_count: s.scene_count,
        arrangement_clips: s.arrangement_clips,
        tracks: s
            .tracks
            .into_iter()
            .map(|t| TrackJson {
                kind: kind_str(t.kind),
                name: t.name,
                devices: t.devices,
            })
            .collect(),
    })
}

#[derive(Serialize, Debug)]
pub struct ParamJson {
    pub id: String,
    /// Stored `Manual` value in device units, as written in the document
    /// (decimal or "true"/"false") — kept lossless rather than coerced.
    pub value: String,
    /// Control-surface mapping bounds, present only on parameters that
    /// carry a MidiControllerRange.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub min: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max: Option<String>,
}

#[derive(Serialize)]
pub struct DeviceJson {
    pub name: String,
    pub params: Vec<ParamJson>,
}

#[derive(Serialize)]
pub struct ClipJson {
    pub name: String,
    pub kind: String,
    /// Beats (1.1.1 = 0).
    pub start: f64,
    pub end: f64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrackDocumentJson {
    pub kind: String,
    pub name: String,
    pub devices: Vec<DeviceJson>,
    pub arrangement_clips: Vec<ClipJson>,
    /// Scene row → held clip name (null = empty slot). Empty when the
    /// document gives the track no session grid.
    pub session_slots: BTreeMap<String, Option<String>>,
}

/// The deep document behind /api/document — SetSummary's shape opened up:
/// device parameter trees, arrangement clips, session grids.
#[derive(Serialize)]
pub struct DocumentJson {
    pub path: String,
    pub tempo: f64,
    pub tracks: Vec<TrackDocumentJson>,
    pub scenes: usize,
}

/// The API contract: a parsed document → the deep view /api/document serves.
pub fn document_json(path: &str, root: &live_set::xml::Element) -> Option<DocumentJson> {
    let d = live_set::model::SetDocument::of(root)?;
    Some(DocumentJson {
        path: path.to_string(),
        tempo: d.tempo_bpm,
        scenes: d.scene_count,
        tracks: d
            .tracks
            .into_iter()
            .map(|t| TrackDocumentJson {
                kind: kind_str(t.kind),
                name: t.name,
                devices: t
                    .devices
                    .into_iter()
                    .map(|dev| DeviceJson {
                        name: dev.name,
                        params: dev
                            .params
                            .into_iter()
                            .map(|p| ParamJson {
                                id: p.id,
                                value: p.value,
                                min: p.min,
                                max: p.max,
                            })
                            .collect(),
                    })
                    .collect(),
                arrangement_clips: t
                    .arrangement_clips
                    .into_iter()
                    .map(|c| ClipJson {
                        name: c.name,
                        kind: match c.kind {
                            live_set::model::ClipKind::Audio => "audio".into(),
                            live_set::model::ClipKind::Midi => "midi".into(),
                        },
                        start: c.start,
                        end: c.end,
                    })
                    .collect(),
                session_slots: t
                    .session_slots
                    .into_iter()
                    .enumerate()
                    .map(|(scene, clip)| (scene.to_string(), clip))
                    .collect(),
            })
            .collect(),
    })
}

fn kind_str(kind: live_set::model::TrackKind) -> String {
    match kind {
        live_set::model::TrackKind::Audio => "audio".into(),
        live_set::model::TrackKind::Midi => "midi".into(),
        live_set::model::TrackKind::Return => "return".into(),
        live_set::model::TrackKind::Master => "master".into(),
    }
}

// ---------------------------------------------------------------- devices
//
// The device-panel surface (M3 remainder — parameter editing): descriptors
// generated from the live-dynamics parameter tables, the current stored
// values (the deep model's device parameter walk) and the typed write path
// that sets a `Manual` value and writes the set back deterministically.

/// The devices whose parameter tables this shell serves to panels. The
/// tables themselves are generated from the behavior dossiers
/// (`live-dynamics/src/params.rs`); a panel is generated from a table, never
/// hand-coded per parameter.
pub const PANEL_DEVICES: &[&str] = &["GlueCompressor", "Echo", "Reverb", "Wavetable"];

#[derive(Serialize)]
pub struct ParamDescJson {
    pub id: String,
    pub ui_name: String,
    pub stored_min: f64,
    pub stored_max: f64,
    pub unit: String,
    /// "continuous" | "discrete" | "toggle"
    pub kind: String,
    /// Menu labels, indexed `stored_min..=stored_max` — discrete only.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub labels: Option<Vec<String>>,
    pub notes: String,
}

fn desc_json(p: &live_dynamics::params::ParamDesc) -> ParamDescJson {
    use live_dynamics::params::ParamKind;
    let (kind, labels) = match p.kind {
        ParamKind::Continuous => ("continuous", None),
        ParamKind::Toggle => ("toggle", None),
        ParamKind::Discrete { labels } => {
            ("discrete", Some(labels.iter().map(|l| l.to_string()).collect()))
        }
    };
    ParamDescJson {
        id: p.id.to_string(),
        ui_name: p.ui_name.to_string(),
        stored_min: p.stored_min,
        stored_max: p.stored_max,
        unit: p.unit.to_string(),
        kind: kind.to_string(),
        labels,
        notes: p.notes.to_string(),
    }
}

/// `GET /api/device-descriptors` — the parameter tables of the panel
/// devices, keyed by document element name. The single source the UI's
/// generic device panel is generated from.
pub fn device_descriptors_json() -> serde_json::Value {
    let mut map = serde_json::Map::new();
    for name in PANEL_DEVICES {
        if let Some(t) = live_dynamics::params::table(name) {
            let rows: Vec<ParamDescJson> = t.iter().map(desc_json).collect();
            map.insert(
                name.to_string(),
                serde_json::to_value(rows).unwrap_or(serde_json::Value::Null),
            );
        }
    }
    serde_json::Value::Object(map)
}

#[derive(Serialize)]
#[derive(Debug)]
pub struct DeviceParamsJson {
    pub path: String,
    pub track: String,
    pub device: String,
    pub params: Vec<ParamJson>,
}

/// `GET /api/document/device-params?path=&track=&device=` — the current
/// stored values of one device, through the deep model's device parameter
/// walk (`SetDocument`, model.rs §6: direct children carrying `Manual`).
pub fn device_params_json(
    path: &str,
    root: &live_set::xml::Element,
    track: &str,
    device: &str,
) -> Result<DeviceParamsJson, String> {
    let d = live_set::model::SetDocument::of(root).ok_or("no LiveSet in document")?;
    let t = d
        .tracks
        .iter()
        .find(|t| t.name == track)
        .ok_or_else(|| format!("track \"{track}\" not found in set"))?;
    let dev = t
        .devices
        .iter()
        .find(|dev| dev.name == device)
        .ok_or_else(|| format!("device {device} not found on track \"{track}\""))?;
    Ok(DeviceParamsJson {
        path: path.to_string(),
        track: track.to_string(),
        device: dev.name.clone(),
        params: dev
            .params
            .iter()
            .map(|p| ParamJson {
                id: p.id.clone(),
                value: p.value.clone(),
                min: p.min.clone(),
                max: p.max.clone(),
            })
            .collect(),
    })
}

/// A device-parameter write request, address-space of
/// `POST /api/document/device-param`. `track` is the track's effective name
/// ("Master" reaches the MainTrack); the device is addressed by element
/// name (`device_name`, first match on the track) or position
/// (`device_index`, wins when both are given); `value` is a JSON number
/// (toggles also accept a boolean), validated against the device's
/// parameter-table stored range before anything is written.
pub struct DeviceParamWrite<'a> {
    pub track: &'a str,
    pub device_name: Option<&'a str>,
    pub device_index: Option<usize>,
    pub param_id: &'a str,
    pub value: &'a serde_json::Value,
}

#[derive(Serialize, Debug)]
pub struct DeviceParamSetJson {
    pub track: String,
    pub device: String,
    pub param: ParamJson,
}

/// The typed write: find the track holder → the device element → the
/// parameter element, validate the value against the live-dynamics table,
/// set the `Manual` child's Value (the document-model convention every
/// device parameter follows — model.rs §6) and report the stored result.
/// The caller writes the tree back (deterministic gzip via `write_gz`).
pub fn set_device_param(
    root: &mut live_set::xml::Element,
    req: &DeviceParamWrite,
) -> Result<DeviceParamSetJson, String> {
    // Resolve, validate and write inside one mutable borrow of the tree.
    let (device_name, param) = {
        let holder = track_holder_mut(root, req.track)?;
        let devices = holder
            .child_mut("DeviceChain")
            .and_then(|dc| dc.child_mut("DeviceChain"))
            .and_then(|dc| dc.child_mut("Devices"))
            .ok_or_else(|| format!("track \"{}\" has no device chain", req.track))?;
        let dev = match (req.device_index, req.device_name) {
            (Some(i), _) => devices.children.get_mut(i).ok_or_else(|| {
                format!("device index {i} out of range on track \"{}\"", req.track)
            })?,
            (None, Some(n)) => devices.children.iter_mut().find(|d| d.name == n).ok_or_else(|| {
                format!("device {n} not found on track \"{}\"", req.track)
            })?,
            (None, None) => return Err("address the device by deviceIndex or deviceName".into()),
        };
        let device_name = dev.name.clone();

        // Type-check first: the shell only writes parameters its table can
        // validate, whatever the document happens to store.
        let stored = validated_stored_value(&device_name, req.param_id, req.value)?;

        let param_el = dev
            .children
            .iter_mut()
            .find(|c| c.name == req.param_id)
            .ok_or_else(|| {
                format!(
                    "parameter \"{}\" is not stored on {} in this document",
                    req.param_id, device_name
                )
            })?;
        let manual = param_el
            .child_mut("Manual")
            .ok_or_else(|| {
                format!(
                    "parameter \"{}\" on {} carries no Manual element",
                    req.param_id, device_name
                )
            })?;
        manual.set_attr("Value", &stored);
        // The response reads the element as it is now stored on disk.
        (device_name, param_json_of(param_el))
    };

    Ok(DeviceParamSetJson {
        track: req.track.to_string(),
        device: device_name,
        param,
    })
}

/// Track holder by effective name: a member of `Tracks` whose
/// EffectiveName matches, or "Master" → the MainTrack (model.rs walk).
fn track_holder_mut<'a>(
    root: &'a mut live_set::xml::Element,
    track: &str,
) -> Result<&'a mut live_set::xml::Element, String> {
    let ls = root
        .child_mut("LiveSet")
        .ok_or_else(|| "no LiveSet in document".to_string())?;
    if track.eq_ignore_ascii_case("Master") {
        return ls
            .child_mut("MainTrack")
            .ok_or_else(|| "no MainTrack in document".to_string());
    }
    let tracks = ls
        .child_mut("Tracks")
        .ok_or_else(|| format!("track \"{track}\" not found in set"))?;
    tracks
        .children
        .iter_mut()
        .find(|tr| {
            matches!(tr.name.as_str(), "AudioTrack" | "MidiTrack" | "ReturnTrack")
                && tr.find("EffectiveName").and_then(|n| n.attr("Value")) == Some(track)
        })
        .ok_or_else(|| format!("track \"{track}\" not found in set"))
}

fn param_json_of(el: &live_set::xml::Element) -> ParamJson {
    let range = el.child("MidiControllerRange");
    ParamJson {
        id: el.name.clone(),
        value: el
            .child("Manual")
            .and_then(|m| m.attr("Value"))
            .unwrap_or_default()
            .to_string(),
        min: range
            .and_then(|r| r.child("Min"))
            .and_then(|m| m.attr("Value"))
            .map(str::to_string),
        max: range
            .and_then(|r| r.child("Max"))
            .and_then(|m| m.attr("Value"))
            .map(str::to_string),
    }
}

/// Validate a JSON value against the parameter table's stored range and
/// produce the stored string exactly as the document model writes it:
/// "true"/"false" for toggles, an integer for menu indices, the shortest
/// round-trip decimal for continuous values.
fn validated_stored_value(
    device: &str,
    param_id: &str,
    value: &serde_json::Value,
) -> Result<String, String> {
    let table = live_dynamics::params::table(device).ok_or_else(|| {
        format!(
            "no parameter table for device {device} — the shell only writes parameters it can type-check"
        )
    })?;
    let desc = table
        .iter()
        .find(|p| p.id == param_id)
        .ok_or_else(|| format!("parameter \"{param_id}\" has no entry in the {device} parameter table"))?;

    use live_dynamics::params::ParamKind;
    match desc.kind {
        ParamKind::Toggle => match value {
            serde_json::Value::Bool(b) => Ok(b.to_string()),
            serde_json::Value::Number(n) => match n.as_f64() {
                Some(0.0) => Ok("false".into()),
                Some(1.0) => Ok("true".into()),
                _ => Err(format!("toggle {param_id} takes 0/1 or true/false")),
            },
            _ => Err(format!("toggle {param_id} takes true/false")),
        },
        ParamKind::Discrete { .. } => {
            let n = value
                .as_f64()
                .ok_or_else(|| format!("{param_id} is a discrete menu — the stored index is a number"))?;
            if n.fract() != 0.0 {
                return Err(format!(
                    "{param_id} is a discrete menu — value must be a stored index ({min}..{max})",
                    min = desc.stored_min,
                    max = desc.stored_max
                ));
            }
            in_range(desc, n, param_id)?;
            Ok(format!("{}", n as i64))
        }
        ParamKind::Continuous => {
            let n = value
                .as_f64()
                .ok_or_else(|| format!("{param_id} takes a number in stored units"))?;
            in_range(desc, n, param_id)?;
            Ok(format!("{n}"))
        }
    }
}

fn in_range(
    desc: &live_dynamics::params::ParamDesc,
    n: f64,
    param_id: &str,
) -> Result<(), String> {
    // 1e-9 slack: table extents are stored as truncated decimals
    // (e.g. 249.999969 for a 250 ms menu end) — float-representation noise
    // at the 9th digit is not an out-of-range write.
    const SLACK: f64 = 1e-9;
    if n < desc.stored_min - SLACK || n > desc.stored_max + SLACK {
        return Err(format!(
            "value {n} out of range for {param_id} (stored {min}..{max}{unit})",
            min = desc.stored_min,
            max = desc.stored_max,
            unit = if desc.unit.is_empty() {
                String::new()
            } else {
                format!(" {}", desc.unit)
            }
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn glue_fixture() -> live_set::xml::Element {
        live_set::xml::parse(
            r#"<Ableton><LiveSet>
            <MainTrack><DeviceChain><Mixer><Tempo><Manual Value="120" /></Tempo></Mixer>
            <DeviceChain><Devices /></DeviceChain></DeviceChain></MainTrack>
            <Tracks><AudioTrack><Name><EffectiveName Value="STIM" /></Name>
            <DeviceChain><DeviceChain><Devices>
              <GlueCompressor Id="2">
                <On><Manual Value="true" /></On>
                <Threshold><Manual Value="-12" />
                  <MidiControllerRange><Min Value="-40" /><Max Value="0" /></MidiControllerRange>
                </Threshold>
                <Range><Manual Value="30" />
                  <MidiControllerRange><Min Value="0" /><Max Value="70" /></MidiControllerRange>
                </Range>
                <Ratio><Manual Value="1" /></Ratio>
                <Attack><Manual Value="2" /></Attack>
                <PeakClipIn><Manual Value="true" /></PeakClipIn>
              </GlueCompressor>
            </Devices></DeviceChain></DeviceChain>
            </AudioTrack></Tracks><Scenes><Scene /></Scenes></LiveSet></Ableton>"#,
        )
        .unwrap()
    }

    fn write(root: &mut live_set::xml::Element, param: &str, value: serde_json::Value) -> Result<DeviceParamSetJson, String> {
        let req = DeviceParamWrite {
            track: "STIM",
            device_name: Some("GlueCompressor"),
            device_index: None,
            param_id: param,
            value: &value,
        };
        set_device_param(root, &req)
    }

    #[test]
    fn set_writes_manual_value_and_reports_stored_param() {
        let mut root = glue_fixture();
        let res = write(&mut root, "Threshold", serde_json::json!(-24.5)).unwrap();
        assert_eq!(res.track, "STIM");
        assert_eq!(res.device, "GlueCompressor");
        assert_eq!(res.param.id, "Threshold");
        assert_eq!(res.param.value, "-24.5");
        assert_eq!(res.param.min.as_deref(), Some("-40"));
        assert_eq!(res.param.max.as_deref(), Some("0"));
        assert_eq!(
            root.find("Threshold").unwrap().child("Manual").unwrap().attr("Value"),
            Some("-24.5")
        );

        // integer-valued continuous writes store as integers (Live's form)
        let res = write(&mut root, "Range", serde_json::json!(45.0)).unwrap();
        assert_eq!(res.param.value, "45");
    }

    #[test]
    fn set_validates_toggle_discrete_and_range() {
        let mut root = glue_fixture();

        // toggle: bool in → "true"/"false" stored
        let res = write(&mut root, "PeakClipIn", serde_json::json!(false)).unwrap();
        assert_eq!(res.param.value, "false");
        // numeric 0/1 accepted too
        assert_eq!(
            write(&mut root, "PeakClipIn", serde_json::json!(0)).unwrap().param.value,
            "false"
        );
        // numeric 0.5 → rejected
        assert!(write(&mut root, "PeakClipIn", serde_json::json!(0.5))
            .unwrap_err()
            .contains("0/1 or true/false"));

        // discrete: integer index in → bare integer stored; fraction rejected
        assert_eq!(
            write(&mut root, "Ratio", serde_json::json!(2)).unwrap().param.value,
            "2"
        );
        assert!(write(&mut root, "Ratio", serde_json::json!(1.5))
            .unwrap_err()
            .contains("stored index"));
        // index outside the menu extent rejected
        assert!(write(&mut root, "Ratio", serde_json::json!(3))
            .unwrap_err()
            .contains("out of range"));

        // continuous: out-of-range rejected with units in the message
        let err = write(&mut root, "Threshold", serde_json::json!(5.0)).unwrap_err();
        assert!(err.contains("out of range for Threshold"), "{err}");
        assert!(err.contains("-40..0 dB"), "{err}");
        // string where a number belongs → rejected
        assert!(write(&mut root, "Threshold", serde_json::json!("quiet"))
            .unwrap_err()
            .contains("takes a number"));

        // rejected writes leave the document untouched
        assert_eq!(
            root.find("Threshold").unwrap().child("Manual").unwrap().attr("Value"),
            Some("-12")
        );
    }

    #[test]
    fn set_reports_unknown_track_device_and_parameter() {
        let mut root = glue_fixture();
        let one = serde_json::json!(1.0);
        let mk = |track: &'static str, device: Option<&'static str>, param: &'static str| DeviceParamWrite {
            track,
            device_name: device,
            device_index: None,
            param_id: param,
            value: &one,
        };

        let err = set_device_param(&mut root, &mk("NOPE", Some("GlueCompressor"), "Threshold"))
            .unwrap_err();
        assert!(err.contains("track \"NOPE\" not found"), "{err}");

        // "Master" reaches the MainTrack; it has no devices here
        let err = set_device_param(&mut root, &mk("Master", Some("GlueCompressor"), "Threshold"))
            .unwrap_err();
        assert!(err.contains("device GlueCompressor not found on track \"Master\""), "{err}");

        let err = set_device_param(&mut root, &mk("STIM", Some("Echo"), "Feedback")).unwrap_err();
        assert!(err.contains("device Echo not found on track \"STIM\""), "{err}");

        // a parameter the document doesn't store is refused, not invented
        let err = set_device_param(&mut root, &mk("STIM", Some("GlueCompressor"), "Release"))
            .unwrap_err();
        assert!(
            err.contains("parameter \"Release\" is not stored on GlueCompressor"),
            "{err}"
        );

        // a device with no parameter table is refused outright
        let mut doc = live_set::xml::parse(
            r#"<Ableton><LiveSet><Tracks><AudioTrack><Name><EffectiveName Value="X" /></Name>
            <DeviceChain><DeviceChain><Devices><MysteryBox Id="1"><Level><Manual Value="1" /></Level></MysteryBox>
            </Devices></DeviceChain></DeviceChain></AudioTrack></Tracks></LiveSet></Ableton>"#,
        )
        .unwrap();
        let req = DeviceParamWrite {
            track: "X",
            device_name: Some("MysteryBox"),
            device_index: None,
            param_id: "Level",
            value: &serde_json::json!(0.5),
        };
        let err = set_device_param(&mut doc, &req).unwrap_err();
        assert!(err.contains("no parameter table for device MysteryBox"), "{err}");
    }

    #[test]
    fn device_index_addressing_wins_over_name() {
        let mut doc = live_set::xml::parse(
            r#"<Ableton><LiveSet>
            <MainTrack><DeviceChain><DeviceChain><Devices>
              <GlueCompressor Id="1"><Threshold><Manual Value="-12" /></Threshold></GlueCompressor>
              <GlueCompressor Id="2"><Threshold><Manual Value="-30" /></Threshold></GlueCompressor>
            </Devices></DeviceChain></DeviceChain></MainTrack>
            <Tracks /></LiveSet></Ableton>"#,
        )
        .unwrap();
        let req = DeviceParamWrite {
            track: "Master",
            device_name: Some("GlueCompressor"),
            device_index: Some(1),
            param_id: "Threshold",
            value: &serde_json::json!(-20.0),
        };
        let res = set_device_param(&mut doc, &req).unwrap();
        assert_eq!(res.param.value, "-20");
        let devs = doc.find("Devices").unwrap();
        assert_eq!(
            devs.children[0].find("Threshold").unwrap().child("Manual").unwrap().attr("Value"),
            Some("-12"),
            "index addressing must leave the first device alone"
        );
        assert_eq!(
            devs.children[1].find("Threshold").unwrap().child("Manual").unwrap().attr("Value"),
            Some("-20")
        );
    }

    #[test]
    fn device_params_json_walks_the_deep_model() {
        let root = glue_fixture();
        let j = device_params_json("/tmp/g.als", &root, "STIM", "GlueCompressor").unwrap();
        assert_eq!(j.path, "/tmp/g.als");
        assert_eq!(j.track, "STIM");
        assert_eq!(j.device, "GlueCompressor");
        assert_eq!(j.params.len(), 6);
        assert_eq!(j.params[0].id, "On");
        assert_eq!(j.params[1].id, "Threshold");
        assert_eq!(j.params[1].value, "-12");

        assert!(device_params_json("/tmp/g.als", &root, "NOPE", "GlueCompressor")
            .unwrap_err()
            .contains("not found in set"));
        assert!(device_params_json("/tmp/g.als", &root, "STIM", "Echo")
            .unwrap_err()
            .contains("device Echo not found"));
    }

    #[test]
    fn descriptors_serve_the_three_panel_tables() {
        let j = device_descriptors_json();
        let glue = j["GlueCompressor"].as_array().expect("glue table");
        assert_eq!(glue.len(), 8);
        assert_eq!(j["Echo"].as_array().unwrap().len(), 14);
        assert_eq!(j["Reverb"].as_array().unwrap().len(), 11);

        let threshold = glue.iter().find(|p| p["id"] == "Threshold").unwrap();
        assert_eq!(threshold["kind"], "continuous");
        assert_eq!(threshold["ui_name"], "Threshold");
        assert_eq!(threshold["stored_min"], -40.0);
        assert_eq!(threshold["stored_max"], 0.0);
        assert_eq!(threshold["unit"], "dB");
        assert!(threshold.get("labels").is_none(), "continuous carries no labels");
        assert!(!threshold["notes"].as_str().unwrap().is_empty());

        let attack = glue.iter().find(|p| p["id"] == "Attack").unwrap();
        assert_eq!(attack["kind"], "discrete");
        let labels = attack["labels"].as_array().unwrap();
        assert_eq!(labels.len(), 7);
        assert_eq!(labels[0], "0.082");
        assert_eq!(attack["unit"], "ms");

        let clip = glue.iter().find(|p| p["id"] == "PeakClipIn").unwrap();
        assert_eq!(clip["kind"], "toggle");
        let text = serde_json::to_string(&j).unwrap();
        assert!(text.contains("\"stored_min\""));
        assert!(!text.contains("\"storedMin\""), "snake_case contract");
    }

    #[test]
    fn summary_json_shape() {
        let doc = live_set::xml::parse(
            r#"<Ableton><LiveSet>
            <MainTrack><DeviceChain><Mixer><Tempo><Manual Value="131" /></Tempo></Mixer></DeviceChain></MainTrack>
            <Tracks><AudioTrack><Name><EffectiveName Value="STIM" /></Name>
            <DeviceChain><DeviceChain><Devices><GlueCompressor Id="2" /></Devices></DeviceChain></DeviceChain>
            </AudioTrack></Tracks><Scenes><Scene /></Scenes></LiveSet></Ableton>"#,
        )
        .unwrap();
        let j = summary_json("/tmp/x.als", &doc).unwrap();
        assert_eq!(j.tempo_bpm, 131.0);
        assert_eq!(j.tracks[0].kind, "audio");
        assert_eq!(j.tracks[0].devices, vec!["GlueCompressor"]);
        let text = serde_json::to_string(&j).unwrap();
        assert!(text.contains("\"scene_count\":1"));
    }

    #[test]
    fn document_json_shape() {
        let doc = live_set::xml::parse(
            r#"<Ableton><LiveSet>
            <MainTrack><DeviceChain><Mixer><Tempo><Manual Value="131" /></Tempo></Mixer>
            <DeviceChain><Devices>
              <Compressor2 Id="90">
                <Threshold><Manual Value="-12.5" />
                  <MidiControllerRange><Min Value="-40" /><Max Value="0" /></MidiControllerRange>
                </Threshold>
                <On><Manual Value="true" /></On>
              </Compressor2>
            </Devices></DeviceChain></DeviceChain></MainTrack>
            <Tracks><AudioTrack><Name><EffectiveName Value="STIM" /></Name>
            <DeviceChain>
              <MainSequencer>
                <ClipSlotList>
                  <ClipSlot Id="0"><ClipSlot><Value /></ClipSlot></ClipSlot>
                  <ClipSlot Id="1"><ClipSlot><Value>
                    <AudioClip Id="5" Time="0"><Name Value="take1" />
                      <CurrentStart Value="2" /><CurrentEnd Value="9.5" />
                    </AudioClip>
                  </Value></ClipSlot></ClipSlot>
                </ClipSlotList>
                <Sample><ArrangerAutomation><Events>
                  <AudioClip Id="5" Time="0"><Name Value="bed" />
                    <CurrentStart Value="0" /><CurrentEnd Value="384" />
                  </AudioClip>
                </Events></ArrangerAutomation></Sample>
              </MainSequencer>
              <DeviceChain><Devices><GlueCompressor Id="2" /></Devices></DeviceChain>
            </DeviceChain>
            </AudioTrack></Tracks><Scenes><Scene /><Scene /></Scenes></LiveSet></Ableton>"#,
        )
        .unwrap();
        let j = document_json("/tmp/x.als", &doc).unwrap();
        assert_eq!(j.tempo, 131.0);
        assert_eq!(j.scenes, 2);
        assert_eq!(j.tracks.len(), 2);

        let stim = &j.tracks[0];
        assert_eq!(stim.kind, "audio");
        // deep devices: the empty GlueCompressor has no Manual parameters
        assert!(stim.devices[0].params.is_empty());
        assert_eq!(stim.arrangement_clips.len(), 1);
        assert_eq!(stim.arrangement_clips[0].name, "bed");
        assert_eq!(stim.arrangement_clips[0].kind, "audio");
        assert_eq!(stim.arrangement_clips[0].start, 0.0);
        assert_eq!(stim.arrangement_clips[0].end, 384.0);
        // session grid is a scene-index map with null for empty slots
        assert_eq!(
            stim.session_slots.get("1").map(|s| s.as_deref()),
            Some(Some("take1"))
        );
        assert_eq!(stim.session_slots.get("0").map(|s| s.is_none()), Some(true));

        // master carries the parameter tree; absent range is omitted from JSON
        let master = &j.tracks[1];
        assert_eq!(master.kind, "master");
        let comp = &master.devices[0];
        assert_eq!(comp.name, "Compressor2");
        let threshold = &comp.params[0];
        assert_eq!(threshold.id, "Threshold");
        assert_eq!(threshold.value, "-12.5");
        assert_eq!(threshold.min.as_deref(), Some("-40"));
        assert_eq!(threshold.max.as_deref(), Some("0"));
        assert_eq!(comp.params[1].id, "On");
        assert_eq!(comp.params[1].min, None);

        let text = serde_json::to_string(&j).unwrap();
        // the deep endpoint's camelCase field names, per the /api/document shape
        assert!(text.contains("\"arrangementClips\""));
        assert!(text.contains("\"sessionSlots\""));
        assert!(text.contains("\"tempo\":131.0"));
        assert!(text.contains("\"scenes\":2"));
        // min/max only appear when the parameter carries a range
        assert!(text.contains("\"min\":\"-40\""));
        assert!(text.contains("\"id\":\"On\",\"value\":\"true\"}"));
    }
}
