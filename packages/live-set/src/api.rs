//! The Live set's JSON contract, shared by every reader of a Live document:
//! the in-tree 8787 seam (packages/live-shell re-exports this module), the
//! native host's `live_shell_read`, and the kernel's Live ops
//! (desktop/cradle/kernel/src/live_set_owner.rs). Every response is plain
//! serde_json: the stable contract the shell builds against.

use serde::Serialize;
use std::collections::BTreeMap;

/// Summary and editable document share one read, parse and native-byte revision.
/// Both transports use this operation so a concurrent file change cannot join
/// readings from different generations into one displayed set.
pub fn set_json(path: &str) -> Result<serde_json::Value, String> {
    use sha2::{Digest, Sha256};
    let bytes = std::fs::read(path).map_err(|e| e.to_string())?;
    let root = crate::open_gz(&bytes).map_err(|e| e.to_string())?;
    Ok(serde_json::json!({
        "summary": summary_json(path, &root).ok_or("No LiveSet in native document")?,
        "document": document_json(path, &root).ok_or("No LiveSet in native document")?,
        "revision": format!("sha256:{:x}", Sha256::digest(&bytes)),
    }))
}

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
pub fn summary_json(path: &str, root: &crate::xml::Element) -> Option<SummaryJson> {
    let s = crate::model::SetSummary::of(root)?;
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

#[derive(Serialize)]
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
pub fn document_json(path: &str, root: &crate::xml::Element) -> Option<DocumentJson> {
    let d = crate::model::SetDocument::of(root)?;
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
                            crate::model::ClipKind::Audio => "audio".into(),
                            crate::model::ClipKind::Midi => "midi".into(),
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

fn kind_str(kind: crate::model::TrackKind) -> String {
    match kind {
        crate::model::TrackKind::Audio => "audio".into(),
        crate::model::TrackKind::Midi => "midi".into(),
        crate::model::TrackKind::Return => "return".into(),
        crate::model::TrackKind::Master => "master".into(),
    }
}

// ---------------------------------------------------------------------------
// The M3 device-edit contract — the device panels' seam (integration map
// §C): descriptors from live-dynamics' typed parameter tables, stored
// values from the live-set document, and writes that validate against the
// table's stored extent before the set is rewritten in place.

/// One live-dynamics table row as the device panels' `ParamDescJson` client
/// type reads it (ui/src/panels/devices/api.ts).
#[derive(Serialize)]
pub struct ParamDescJson {
    pub id: String,
    pub ui_name: String,
    pub stored_min: f64,
    pub stored_max: f64,
    pub unit: String,
    pub kind: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub labels: Option<Vec<String>>,
    pub notes: String,
}

fn desc_json(desc: &live_dynamics::params::ParamDesc) -> ParamDescJson {
    use live_dynamics::params::ParamKind;
    let (kind, labels) = match &desc.kind {
        ParamKind::Continuous => ("continuous", None),
        ParamKind::Discrete { labels } => (
            "discrete",
            Some(labels.iter().map(|label| label.to_string()).collect()),
        ),
        ParamKind::Toggle => ("toggle", None),
    };
    ParamDescJson {
        id: desc.id.to_string(),
        ui_name: desc.ui_name.to_string(),
        stored_min: desc.stored_min,
        stored_max: desc.stored_max,
        unit: desc.unit.to_string(),
        kind,
        labels,
        notes: desc.notes.to_string(),
    }
}

/// GET /api/device-descriptors — every live-dynamics parameter table, keyed
/// by document element name (the key the device panels carry as element).
pub fn device_descriptors_json() -> serde_json::Value {
    let mut map = serde_json::Map::new();
    for key in live_dynamics::params::table_keys() {
        if let Some(table) = live_dynamics::params::table(key) {
            let rows: Vec<ParamDescJson> = table.iter().map(desc_json).collect();
            map.insert(
                (*key).to_string(),
                serde_json::to_value(rows).expect("descriptor rows serialize"),
            );
        }
    }
    serde_json::Value::Object(map)
}

/// Track element by the summary's own names: audio/midi/return tracks by
/// `EffectiveName`, the master's `MainTrack` as "Master".
fn find_track<'a>(
    root: &'a crate::xml::Element,
    name: &str,
) -> Option<&'a crate::xml::Element> {
    let live_set = root.find("LiveSet")?;
    if name == "Master" {
        return live_set.find("MainTrack");
    }
    let tracks = live_set.find("Tracks")?;
    tracks.children.iter().find(|track| {
        matches!(
            track.name.as_str(),
            "AudioTrack" | "MidiTrack" | "ReturnTrack"
        ) && track.find("EffectiveName").and_then(|n| n.attr("Value")) == Some(name)
    })
}

fn find_track_mut<'a>(
    root: &'a mut crate::xml::Element,
    name: &str,
) -> Option<&'a mut crate::xml::Element> {
    let master = name == "Master";
    let live_set = root.find_mut("LiveSet")?;
    if master {
        return live_set.child_mut("MainTrack");
    }
    let tracks = live_set.child_mut("Tracks")?;
    tracks.children.iter_mut().find(|track| {
        matches!(
            track.name.as_str(),
            "AudioTrack" | "MidiTrack" | "ReturnTrack"
        ) && track.find("EffectiveName").and_then(|n| n.attr("Value")) == Some(name)
    })
}

/// The first device of a track's chain carrying the element name
/// (`DeviceChain/DeviceChain/Devices` — the summary's own walk).
fn find_device<'a>(
    track: &'a crate::xml::Element,
    device: &str,
) -> Option<&'a crate::xml::Element> {
    track
        .child("DeviceChain")?
        .child("DeviceChain")?
        .child("Devices")?
        .children
        .iter()
        .find(|d| d.name == device)
}

fn find_device_mut<'a>(
    track: &'a mut crate::xml::Element,
    device: &str,
) -> Option<&'a mut crate::xml::Element> {
    track
        .child_mut("DeviceChain")?
        .child_mut("DeviceChain")?
        .child_mut("Devices")?
        .children
        .iter_mut()
        .find(|d| d.name == device)
}

/// Resolve a table id — an XML path like `SideChain/OnOff` or
/// `Bands.0/ParameterA/Freq` (band elements literally carry the dot) —
/// inside a device element.
fn resolve_path<'a>(
    device: &'a crate::xml::Element,
    path: &str,
) -> Option<&'a crate::xml::Element> {
    let mut node = device;
    for segment in path.split('/') {
        node = node.child(segment)?;
    }
    Some(node)
}

fn resolve_path_mut<'a>(
    device: &'a mut crate::xml::Element,
    path: &str,
) -> Option<&'a mut crate::xml::Element> {
    let mut node = device;
    for segment in path.split('/') {
        node = node.child_mut(segment)?;
    }
    Some(node)
}

fn param_json(id: &str, value: &str, range: Option<&crate::xml::Element>) -> ParamJson {
    ParamJson {
        id: id.to_string(),
        value: value.to_string(),
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

/// GET /api/document/device-params — one device's stored values on one
/// track, table-driven: only the live-dynamics rows, exactly as the
/// document stores them. A row the set does not carry is omitted, so the
/// panel renders its honest "not stored in this document" state.
pub fn device_params_json(
    path: &str,
    track_name: &str,
    device: &str,
) -> Result<serde_json::Value, String> {
    let table = live_dynamics::params::table(device)
        .ok_or_else(|| format!("no parameter table for device element \"{device}\""))?;
    let bytes = std::fs::read(path).map_err(|e| e.to_string())?;
    let root = crate::open_gz(&bytes).map_err(|e| e.to_string())?;
    let track = find_track(&root, track_name)
        .ok_or_else(|| format!("no track named \"{track_name}\" in the document"))?;
    let element = find_device(track, device)
        .ok_or_else(|| format!("no {device} device on track \"{track_name}\""))?;
    let mut params = Vec::new();
    for desc in table {
        let Some(param) = resolve_path(element, desc.id) else {
            continue;
        };
        let Some(manual) = param.child("Manual") else {
            continue;
        };
        params.push(param_json(
            desc.id,
            manual.attr("Value").unwrap_or_default(),
            param.child("MidiControllerRange"),
        ));
    }
    Ok(serde_json::json!({ "params": params }))
}

/// POST /api/document/device-param — validate one stored parameter against
/// the table's stored extent and write the set back (gzip .als in place):
/// the document's own `Manual` value under the device element, resolved by
/// the table id. The response carries the persisted reading.
pub fn device_param_set(
    path: &str,
    track_name: &str,
    device: &str,
    param_id: &str,
    value: &serde_json::Value,
) -> Result<serde_json::Value, String> {
    use live_dynamics::params::ParamKind;
    let table = live_dynamics::params::table(device)
        .ok_or_else(|| format!("no parameter table for device element \"{device}\""))?;
    let desc = table
        .iter()
        .find(|row| row.id == param_id)
        .ok_or_else(|| format!("{device} has no stored parameter \"{param_id}\""))?;
    let stored = match desc.kind {
        ParamKind::Toggle => match value.as_bool() {
            Some(true) => "true".to_string(),
            Some(false) => "false".to_string(),
            None => {
                return Err(format!(
                    "\"{param_id}\" is a toggle — value must be true or false"
                ))
            }
        },
        ParamKind::Discrete { .. } => {
            let v = value.as_f64().ok_or_else(|| {
                format!("\"{param_id}\" is a discrete menu — value must be a stored index")
            })?;
            if v.is_finite() && v.fract() == 0.0 && (desc.stored_min..=desc.stored_max).contains(&v)
            {
                format!("{}", v as i64)
            } else {
                return Err(out_of_range(desc, v));
            }
        }
        ParamKind::Continuous => {
            let v = value
                .as_f64()
                .ok_or_else(|| format!("\"{param_id}\" is continuous — value must be a number"))?;
            if v.is_finite() && (desc.stored_min..=desc.stored_max).contains(&v) {
                format!("{v}")
            } else {
                return Err(out_of_range(desc, v));
            }
        }
    };
    let bytes = std::fs::read(path).map_err(|e| e.to_string())?;
    let mut root = crate::open_gz(&bytes).map_err(|e| e.to_string())?;
    {
        let track = find_track_mut(&mut root, track_name)
            .ok_or_else(|| format!("no track named \"{track_name}\" in the document"))?;
        let element = find_device_mut(track, device)
            .ok_or_else(|| format!("no {device} device on track \"{track_name}\""))?;
        let param = resolve_path_mut(element, param_id).ok_or_else(|| {
            format!("the set carries no \"{param_id}\" element under {device} on \"{track_name}\"")
        })?;
        let manual = param
            .child_mut("Manual")
            .ok_or_else(|| format!("\"{param_id}\" carries no Manual value in the document"))?;
        manual.set_attr("Value", &stored);
    }
    let out = crate::write_gz(&root).map_err(|e| e.to_string())?;
    replace_file_atomically(std::path::Path::new(path), &out)?;
    // The persisted reading, from the set's own element (range unchanged).
    let range = find_track(&root, track_name)
        .and_then(|track| find_device(track, device))
        .and_then(|element| resolve_path(element, param_id))
        .and_then(|param| param.child("MidiControllerRange"));
    Ok(serde_json::json!({
        "param": serde_json::to_value(param_json(param_id, &stored, range)).expect("param serializes"),
    }))
}

/// Replace the user's set without ever leaving it half-written: the new bytes go
/// to a sibling file in the same directory (same filesystem, same permissions),
/// are flushed to disk, and are renamed over the set; the directory is flushed
/// after. A crash or kill leaves either the old set or the new one, never a
/// truncated file. A symlinked set is written at its target, so the link stays.
/// Extended attributes (Finder tags, quarantine) are not carried to the new file.
fn replace_file_atomically(path: &std::path::Path, bytes: &[u8]) -> Result<(), String> {
    use std::io::Write;
    let target = std::fs::canonicalize(path).map_err(|e| e.to_string())?;
    let dir = target
        .parent()
        .ok_or_else(|| "the set has no parent directory".to_string())?;
    let name = target
        .file_name()
        .ok_or_else(|| "the set has no file name".to_string())?
        .to_string_lossy()
        .into_owned();
    let metadata = std::fs::metadata(&target).map_err(|e| e.to_string())?;
    // The replace keeps what the old in-place write kept: a read-only set is refused, not swapped for a writable copy,
    // and a hard-linked set is refused rather than silently split from its other names.
    if metadata.permissions().readonly() {
        return Err("the set is read-only; it is not written".into());
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::MetadataExt;
        if metadata.nlink() > 1 {
            return Err(
                "the set has other hard links; replacing it would split them, so it is not written"
                    .into(),
            );
        }
    }
    let permissions = metadata.permissions();
    let staged = dir.join(format!(".{name}.oi-write-{}", std::process::id()));
    let result = (|| -> std::io::Result<()> {
        let mut file = std::fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&staged)?;
        file.write_all(bytes)?;
        file.sync_all()?;
        std::fs::set_permissions(&staged, permissions)?;
        std::fs::rename(&staged, &target)
    })();
    if let Err(error) = result {
        let _ = std::fs::remove_file(&staged);
        return Err(format!("the set could not be written safely: {error}"));
    }
    // The set is replaced; flushing the directory makes the rename durable. A flush failure does not unwrite it.
    let _ = std::fs::File::open(dir).and_then(|dir| dir.sync_all());
    Ok(())
}

fn out_of_range(desc: &live_dynamics::params::ParamDesc, value: f64) -> String {
    if desc.unit.is_empty() {
        format!(
            "value {value} out of range for {} (stored {}..={})",
            desc.id, desc.stored_min, desc.stored_max
        )
    } else {
        format!(
            "value {value} out of range for {} (stored {}..={} {})",
            desc.id, desc.stored_min, desc.stored_max, desc.unit
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn set_json_reads_one_native_gzip_revision() {
        let directory = std::env::temp_dir()
            .join(format!("set-api-{}", std::process::id()));
        std::fs::create_dir_all(&directory).unwrap();
        let path = directory.join("native.als");
        let root = crate::xml::parse(
            r#"<Ableton><LiveSet><MainTrack><DeviceChain><Mixer><Tempo><Manual Value="131" /></Tempo></Mixer></DeviceChain></MainTrack><Tracks /><Scenes><Scene /></Scenes></LiveSet></Ableton>"#,
        ).unwrap();
        let bytes = crate::write_gz(&root).unwrap();
        std::fs::write(&path, &bytes).unwrap();
        let reading = set_json(path.to_str().unwrap()).unwrap();
        use sha2::{Digest, Sha256};
        assert_eq!(reading["revision"], format!("sha256:{:x}", Sha256::digest(&bytes)));
        assert_eq!(reading["summary"]["tempo_bpm"], 131.0);
        assert_eq!(reading["document"]["tempo"], 131.0);
        assert_eq!(reading["summary"]["scene_count"], reading["document"]["scenes"]);
        assert_eq!(reading["summary"]["path"], reading["document"]["path"]);
        std::fs::write(&path, b"invalid native gzip").unwrap();
        assert!(set_json(path.to_str().unwrap()).is_err());
        std::fs::remove_file(&path).unwrap();
        assert!(set_json(path.to_str().unwrap()).is_err());
        std::fs::remove_dir(&directory).unwrap();
    }

    #[test]
    fn summary_json_shape() {
        let doc = crate::xml::parse(
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
        let doc = crate::xml::parse(
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
