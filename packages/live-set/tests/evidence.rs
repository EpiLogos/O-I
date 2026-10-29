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
    // O-I #743: the two group tracks ("2-Group", "15-Group") are listed in the set's order too
    assert_eq!(
        s.tracks
            .iter()
            .filter(|t| t.kind == TrackKind::Group)
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

/// A copy of a real set named by LIVE_SET_EVIDENCE (skipped when unset): its Groove Pool and every track's sends read; the first
/// send written and read back; and, where a track holds take lanes, a stretch of its first take comped into the main lane, which
/// then names that take for the stretch, the set read whole again after.
#[test]
fn comps_sends_and_grooves_on_a_copy_of_a_real_set() {
    let Ok(source) = std::env::var("LIVE_SET_EVIDENCE") else {
        return;
    };
    let dir = std::env::temp_dir().join(format!("live-set-evidence-ops-{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    let path = dir.join("copy.als");
    std::fs::copy(&source, &path).unwrap();
    let path = path.to_str().unwrap();
    let root = live_set::open_als(std::path::Path::new(path)).unwrap();
    let in_pool = root
        .find("GroovePool")
        .and_then(|pool| pool.child("Grooves"))
        .map_or(0, |grooves| grooves.children_named("Groove").count());
    let pool = live_set::edit::groove_pool_read(path).unwrap();
    assert_eq!(pool["grooves"].as_array().unwrap().len(), in_pool);
    assert!(pool["amount"].is_number(), "Live 12 keeps a Global Amount");
    eprintln!(
        "evidence: groove pool {} (global {}, range {})",
        pool["grooves"], pool["amount"], pool["amountRange"]
    );
    let set = live_set::api::set_json(path).unwrap();
    let tracks = set["document"]["tracks"].as_array().unwrap().clone();
    let returns = tracks.iter().filter(|t| t["kind"] == "return").count();
    // Every part sends to each return, named by it, in the returns' order.
    for track in tracks
        .iter()
        .filter(|t| t["kind"] == "midi" || t["kind"] == "audio")
    {
        let sends = track["mixer"]["sends"].as_array().map_or(0, Vec::len);
        assert_eq!(sends, returns, "{}: one send per return", track["name"]);
    }
    let mut revision = set["revision"].as_str().unwrap().to_string();
    if let Some((index, track)) = tracks
        .iter()
        .enumerate()
        .find(|(_, t)| t["mixer"]["sends"][0]["on"] == true)
    {
        let max = track["mixer"]["sends"][0]["max"].as_f64().unwrap();
        let wrote = live_set::edit::mixer_write(
            path,
            &revision,
            index,
            "send",
            &serde_json::json!(max / 2.0),
            Some(0),
        )
        .unwrap();
        assert_eq!(
            wrote["mixer"]["sends"][0]["value"].as_f64(),
            Some(max / 2.0)
        );
        eprintln!("evidence: track {index} sends {}", wrote["mixer"]["sends"]);
        revision = wrote["revision"].as_str().unwrap().to_string();
    }
    // The first track holding a take, its first take clip's first beat (or the whole take, when shorter).
    let take = tracks.iter().enumerate().find_map(|(index, t)| {
        t["takeLanes"]
            .as_array()?
            .iter()
            .enumerate()
            .find_map(|(lane, l)| {
                let clip = l["clips"].as_array()?.first()?.clone();
                Some((index, lane, clip))
            })
    });
    if let Some((index, lane, clip)) = take {
        let start = clip["start"].as_f64().unwrap();
        let end = clip["end"].as_f64().unwrap().min(start + 1.0);
        let comped = live_set::edit::take_comp(
            path,
            &revision,
            index,
            lane,
            &serde_json::json!({"start": start, "end": end}),
        )
        .unwrap();
        let stretch = comped["clips"]
            .as_array()
            .unwrap()
            .iter()
            .find(|c| c["start"].as_f64() == Some(start) && c["end"].as_f64() == Some(end))
            .expect("the stretch stands in the main lane");
        assert_eq!(
            stretch["takeId"], clip["takeId"],
            "the main lane names the take"
        );
        let gave = &comped["takeLanes"][lane]["clips"][0]["gave"];
        assert!(gave
            .as_array()
            .unwrap()
            .iter()
            .any(|g| g["start"].as_f64() == Some(start) && g["end"].as_f64() == Some(end)));
        let reread = live_set::api::set_json(path).unwrap();
        assert_eq!(
            reread["document"]["tracks"].as_array().unwrap().len(),
            tracks.len()
        );
        eprintln!(
            "evidence: track {index} lane {lane} comped {start}..{end} from take {}: main lane {} clips",
            clip["takeId"],
            comped["clips"].as_array().unwrap().len()
        );
    }
    std::fs::remove_dir_all(&dir).unwrap();
}

/// O-I #768: a clip Live makes of a constellation, on a copy of the real
/// template (its session slots all empty, its MIDI clips in the arrangement):
/// the new clip takes the document's own shape from an arrangement clip, sits
/// in the part's first slot, reads back whole with its source, and the set's
/// own reader lists it in that slot. Skipped without the evidence tree.
#[test]
fn a_clip_made_on_a_copy_of_the_real_template_reads_back_with_its_source() {
    let Some(root) = template_root() else { return };
    let dir = std::env::temp_dir().join(format!("live-set-evidence-made-{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    let path = dir.join("template.als");
    std::fs::write(&path, live_set::write_gz(&root).unwrap()).unwrap();
    let path = path.to_str().unwrap().to_string();
    let d = SetDocument::of(&root).unwrap();
    let midi = d
        .tracks
        .iter()
        .position(|t| t.kind == TrackKind::Midi && t.session_slots.first() == Some(&None))
        .expect("a MIDI part with an empty first slot");
    let revision = live_set::api::set_json(&path).unwrap()["revision"]
        .as_str()
        .unwrap()
        .to_string();
    let mut set = serde_json::Map::new();
    set.insert("name".into(), serde_json::json!("The lived-in world"));
    let notes = [serde_json::json!({"p": 62, "at": 0, "len": 4, "vel": 100})];
    let made = live_set::edit::clip_create(
        &path,
        &revision,
        midi,
        None,
        4.0,
        Some(&set),
        &notes,
        Some("wiki:anchor:lived-in"),
    )
    .unwrap();
    assert_eq!(made["at"], serde_json::json!({"slot": 0}));
    let back = live_set::edit::clip_json(&path, midi, live_set::edit::ClipAt::Slot(0)).unwrap();
    assert_eq!(back["clip"]["name"], "The lived-in world");
    assert_eq!(back["clip"]["source"], "wiki:anchor:lived-in");
    assert_eq!(back["clip"]["notes"].as_array().unwrap().len(), 1);
    let reread = live_set::open_als(std::path::Path::new(&path)).unwrap();
    let after = SetDocument::of(&reread).unwrap();
    assert_eq!(
        after.tracks[midi].session_slots[0].as_deref(),
        Some("The lived-in world"),
        "the set's own reader lists the clip in its slot"
    );
    std::fs::remove_dir_all(&dir).unwrap();
}
