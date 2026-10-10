//! JSON API surface for wider agents (astra et al.) to build against.
//! Every response is plain serde_json — the stable contract for M2.

use serde::Serialize;
use std::collections::BTreeMap;

/// Summary and editable document share one read, parse and native-byte revision.
/// Both transports use this operation so a concurrent file change cannot join
/// readings from different generations into one displayed set.
pub fn set_json(path: &str) -> Result<serde_json::Value, String> {
    use sha2::{Digest, Sha256};
    let bytes = std::fs::read(path).map_err(|e| e.to_string())?;
    let root = live_set::open_gz(&bytes).map_err(|e| e.to_string())?;
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn set_json_reads_one_native_gzip_revision() {
        let directory = std::env::temp_dir()
            .join(format!("set-api-{}", std::process::id()));
        std::fs::create_dir_all(&directory).unwrap();
        let path = directory.join("native.als");
        let root = live_set::xml::parse(
            r#"<Ableton><LiveSet><MainTrack><DeviceChain><Mixer><Tempo><Manual Value="131" /></Tempo></Mixer></DeviceChain></MainTrack><Tracks /><Scenes><Scene /></Scenes></LiveSet></Ableton>"#,
        ).unwrap();
        let bytes = live_set::write_gz(&root).unwrap();
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
