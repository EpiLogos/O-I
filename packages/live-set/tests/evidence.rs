//! Evidence-set tests: the reader against real documents captured from the
//! licensed install (provenance in docs/research/ableton-live-12.0.25/).

use live_set::model::{ClipKind, SetDocument, SetSummary, TrackKind};
use live_set::xml;

const TEMPLATE_XML: &str =
    "../../docs/research/ableton-live-12.0.25/evidence/sets/template-piano-voices-mastering.xml";

/// Parse the real template set, or skip when the evidence tree is absent
/// from this checkout (provenance: docs/research/ableton-live-12.0.25/).
fn template_root() -> Option<xml::Element> {
    let bytes = std::fs::read(TEMPLATE_XML).ok()?;
    let text = String::from_utf8(bytes).unwrap();
    Some(xml::parse(&text).expect("template set parses"))
}

#[test]
fn reads_the_real_template_set() {
    let Some(root) = template_root() else { return };
    let s = SetSummary::of(&root).expect("LiveSet present");
    // the template's recorded facts (session-model evidence)
    assert_eq!(s.tempo_bpm, 131.0);
    assert_eq!(
        s.tracks
            .iter()
            .filter(|t| t.kind == TrackKind::Audio)
            .count(),
        6
    );
    assert_eq!(
        s.tracks
            .iter()
            .filter(|t| t.kind == TrackKind::Midi)
            .count(),
        12
    );
    assert_eq!(
        s.tracks
            .iter()
            .filter(|t| t.kind == TrackKind::Return)
            .count(),
        2
    );
    // the master carries the mastering chain that contaminated v1 renders
    let master = s
        .tracks
        .iter()
        .find(|t| t.kind == TrackKind::Master)
        .unwrap();
    assert!(master.devices.contains(&"Compressor2".to_string()));
    assert!(master.devices.contains(&"Saturator".to_string()));
}

#[test]
fn gzip_round_trip_is_stable() {
    let src = r#"<Ableton MajorVersion="5"><LiveSet><Tracks /></LiveSet></Ableton>"#;
    let tree = xml::parse(src).unwrap();
    let gz = live_set::write_gz(&tree).unwrap();
    let re = live_set::open_gz(&gz).unwrap();
    assert_eq!(xml::serialize(&re), xml::serialize(&tree));
    // deterministic: second write is byte-identical
    let gz2 = live_set::write_gz(&tree).unwrap();
    assert_eq!(gz, gz2);
}

#[test]
fn document_enumerates_template_arrangement_clips() {
    let Some(root) = template_root() else { return };
    let d = SetDocument::of(&root).expect("LiveSet present");
    // the template holds 73 arrangement clips (56 midi + 17 audio); the
    // ~560 comp takes in TakeLanes and the freeze copies must NOT count
    let total: usize = d.tracks.iter().map(|t| t.arrangement_clips.len()).sum();
    let midi = d
        .tracks
        .iter()
        .flat_map(|t| &t.arrangement_clips)
        .filter(|c| c.kind == ClipKind::Midi)
        .count();
    let audio = d
        .tracks
        .iter()
        .flat_map(|t| &t.arrangement_clips)
        .filter(|c| c.kind == ClipKind::Audio)
        .count();
    assert_eq!(total, 73);
    assert_eq!(midi, 56);
    assert_eq!(audio, 17);

    // first clip of '3-LABS': a named LABS midi clip at its real bounds
    let labs = d.tracks.iter().find(|t| t.name == "3-LABS").unwrap();
    let first = &labs.arrangement_clips[0];
    assert_eq!(first.name, "LABS 10");
    assert_eq!(first.kind, ClipKind::Midi);
    assert!((first.start - 13.105149017649017).abs() < 1e-9);
    assert!((first.end - 47.875).abs() < 1e-9);
}

#[test]
fn document_enumerates_template_session_slots() {
    let Some(root) = template_root() else { return };
    let d = SetDocument::of(&root).expect("LiveSet present");
    assert_eq!(d.scene_count, 8);
    // the template's session grid is saved empty: every sequenced track
    // carries 8 slots (one per scene row), all None
    let labs = d.tracks.iter().find(|t| t.name == "3-LABS").unwrap();
    assert_eq!(labs.session_slots.len(), 8);
    assert!(labs.session_slots.iter().all(|s| s.is_none()));
    // return tracks have no MainSequencer grid in the document — the
    // enumeration reflects that with an empty grid
    let reverb = d.tracks.iter().find(|t| t.name == "A-Reverb").unwrap();
    assert_eq!(reverb.kind, TrackKind::Return);
    assert!(reverb.session_slots.is_empty());
    assert!(d
        .tracks
        .iter()
        .filter(|t| t.kind == TrackKind::Midi)
        .all(|t| t.session_slots.len() == 8));
    assert!(d
        .tracks
        .iter()
        .filter(|t| t.kind == TrackKind::Audio)
        .all(|t| t.session_slots.len() == 8));
}

#[test]
fn document_enumerates_template_device_parameters() {
    let Some(root) = template_root() else { return };
    let d = SetDocument::of(&root).expect("LiveSet present");
    // the master carries the mastering chain (contaminated v1 renders —
    // see the summary test above); deep view: Compressor2's parameter tree
    let master = d
        .tracks
        .iter()
        .find(|t| t.kind == TrackKind::Master)
        .unwrap();
    let names: Vec<&str> = master.devices.iter().map(|dev| dev.name.as_str()).collect();
    assert_eq!(
        names,
        vec![
            "StereoGain",
            "StereoGain",
            "Chorus2",
            "Eq8",
            "Eq8",
            "AutoPan",
            "Saturator",
            "Compressor2"
        ]
    );
    let comp = master
        .devices
        .iter()
        .find(|dev| dev.name == "Compressor2")
        .unwrap();
    assert_eq!(comp.params.len(), 17);
    let threshold = comp.params.iter().find(|p| p.id == "Threshold").unwrap();
    assert_eq!(threshold.value, "0.08451672643");
    assert_eq!(threshold.min.as_deref(), Some("0.0003162277571"));
    assert_eq!(threshold.max.as_deref(), Some("1.99526238"));
    // parameters without a MidiControllerRange carry no bounds
    let on = comp.params.iter().find(|p| p.id == "On").unwrap();
    assert_eq!(on.value, "true");
    assert_eq!(on.min, None);
    assert_eq!(on.max, None);
    let knee = comp.params.iter().find(|p| p.id == "Knee").unwrap();
    assert_eq!(knee.min.as_deref(), Some("0"));
    assert_eq!(knee.max.as_deref(), Some("18"));
    // every listed device exposes at least its On parameter
    assert!(master.devices.iter().all(|dev| !dev.params.is_empty()));
}

/// A copy of a real set named by LIVE_SET_EVIDENCE (skipped when unset): every track's mixer row, take lanes and automation
/// read; the first session clip read whole, renamed and its loop toggled through the edit ops, and the rest of the reading
/// unchanged.
#[test]
fn edits_a_copy_of_a_real_set() {
    let Ok(source) = std::env::var("LIVE_SET_EVIDENCE") else {
        return;
    };
    let dir = std::env::temp_dir().join(format!("live-set-evidence-{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    let path = dir.join("copy.als");
    std::fs::copy(&source, &path).unwrap();
    let path = path.to_str().unwrap();
    let set = live_set::api::set_json(path).unwrap();
    let tracks = set["document"]["tracks"].as_array().unwrap();
    for track in tracks {
        assert!(
            track.get("mixer").is_some()
                && track.get("takeLanes").is_some()
                && track.get("automation").is_some()
        );
    }
    // The first session clip, else the first arrangement clip.
    let session = tracks.iter().enumerate().find_map(|(i, t)| {
        t["sessionSlots"].as_object().and_then(|slots| {
            slots
                .iter()
                .find(|(_, v)| !v.is_null())
                .map(|(s, _)| (i, live_set::edit::ClipAt::Slot(s.parse().unwrap())))
        })
    });
    let arrangement = || {
        tracks.iter().enumerate().find_map(|(i, t)| {
            (!t["arrangementClips"].as_array()?.is_empty())
                .then_some((i, live_set::edit::ClipAt::Arrangement(0)))
        })
    };
    let (index, at) = session.or_else(arrangement).expect("a clip");
    let scene = format!("{at:?}");
    let before = live_set::edit::clip_json(path, index, at).unwrap();
    let rev = before["revision"].as_str().unwrap();
    let looped = before["clip"]["loop"].as_bool().unwrap();
    let set_change = serde_json::json!({"name": "Probe", "loop": !looped});
    let after =
        live_set::edit::clip_write(path, rev, index, at, set_change.as_object(), None, None)
            .unwrap();
    assert_eq!(after["clip"]["name"], "Probe");
    assert_eq!(after["clip"]["loop"], serde_json::json!(!looped));
    for key in [
        "start", "end", "position", "length", "launch", "quantize", "followA", "mode", "notes",
    ] {
        assert_eq!(after["clip"][key], before["clip"][key], "{key} stands");
    }
    // The notes written back as read stand exactly as they were.
    if let Some(notes) = after["clip"]["notes"].as_array().filter(|n| !n.is_empty()) {
        let rev = after["revision"].as_str().unwrap();
        let again =
            live_set::edit::clip_write(path, rev, index, at, None, Some(notes), None).unwrap();
        assert_eq!(
            again["clip"]["notes"], after["clip"]["notes"],
            "a notes round-trip changes nothing"
        );
    }
    let reread = live_set::api::set_json(path).unwrap();
    assert_eq!(
        reread["document"]["tracks"].as_array().unwrap().len(),
        tracks.len()
    );
    eprintln!(
        "evidence: track {index} clip {scene}: {} notes; mixer {}; {} take lanes; {} envelopes",
        after["clip"]["notes"].as_array().map(Vec::len).unwrap_or(0),
        tracks[index]["mixer"],
        tracks[index]["takeLanes"].as_array().unwrap().len(),
        tracks[index]["automation"].as_array().unwrap().len()
    );
    std::fs::remove_dir_all(&dir).unwrap();
}
