//! O-I #855: a performance is kept whole. What you play on the Torus is
//! recorded as Live records it (DLW §21.1 "Takes and Arrangement lanes":
//! "Record a part and each pass lies as a take lane under its track"; §21.2
//! Transport, "Record | Records what you play into Arrangement view as
//! notes"), and what Live's document cannot hold stands beside the set in
//! the DLW's record (§21.2 Rules: "A recorded performance keeps what it needs
//! to be played on"; "A saved sound … opens with the same sound").

use live_set::acts::{act, SetAct};
use live_set::edit::{clip_json, ClipAt};
use live_set::sources::{keeps_of, record_path, torus_of, SCHEMA, SCHEMA_V1};
use serde_json::{json, Value};

/// A set in Live 12's shape: Keys (a MIDI part, one arrangement clip from
/// beat 0 to 4, an empty take-lane list as Live writes it) and Drums (audio).
const SET: &str = r#"<?xml version="1.0" encoding="UTF-8"?>
<Ableton MajorVersion="5" MinorVersion="12.0_12049">
<LiveSet>
<NextPointeeId Value="2000"/>
<Tracks>
<MidiTrack Id="12">
<Name><EffectiveName Value="Keys"/><UserName Value=""/></Name>
<Color Value="26"/>
<TrackGroupId Value="-1"/>
<DeviceChain>
<MainSequencer>
<ClipSlotList>
<ClipSlot Id="0"><LomId Value="0"/><ClipSlot><Value/></ClipSlot><HasStop Value="true"/><NeedRefreeze Value="true"/></ClipSlot>
</ClipSlotList>
<ClipTimeable><ArrangerAutomation><Events>
<MidiClip Id="0" Time="0"><CurrentStart Value="0"/><CurrentEnd Value="4"/><Loop><LoopStart Value="0"/><LoopEnd Value="4"/><StartRelative Value="0"/><LoopOn Value="false"/><OutMarker Value="4"/><HiddenLoopStart Value="0"/><HiddenLoopEnd Value="4"/></Loop><Name Value="Verse"/><Annotation Value=""/><Color Value="26"/><Disabled Value="false"/><Notes><KeyTracks/><NoteIdGenerator><NextId Value="1"/></NoteIdGenerator></Notes></MidiClip>
</Events></ArrangerAutomation></ClipTimeable>
<Recorder><IsArmed Value="false"/><TakeCounter Value="0"/></Recorder>
</MainSequencer>
<DeviceChain><Devices/></DeviceChain>
</DeviceChain>
<TakeLanes><TakeLanes/><AreTakeLanesFolded Value="true"/></TakeLanes>
</MidiTrack>
<AudioTrack Id="8">
<Name><EffectiveName Value="Drums"/><UserName Value="Drums"/></Name>
<TrackGroupId Value="-1"/>
<DeviceChain>
<MainSequencer><ClipSlotList>
<ClipSlot Id="0"><LomId Value="0"/><ClipSlot><Value/></ClipSlot><HasStop Value="true"/><NeedRefreeze Value="true"/></ClipSlot>
</ClipSlotList></MainSequencer>
<DeviceChain><Devices/></DeviceChain>
</DeviceChain>
</AudioTrack>
</Tracks>
<MainTrack><DeviceChain><Mixer><Tempo><Manual Value="120"/></Tempo></Mixer><DeviceChain><Devices/></DeviceChain></DeviceChain></MainTrack>
<Scenes>
<Scene Id="0"><Name Value=""/><Annotation Value=""/><Color Value="-1"/><Tempo Value="120"/><IsTempoEnabled Value="false"/></Scene>
</Scenes>
</LiveSet>
</Ableton>"#;

struct SetFile(std::path::PathBuf);
impl Drop for SetFile {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}
fn set_file() -> (SetFile, String) {
    use std::sync::atomic::{AtomicUsize, Ordering};
    static NEXT: AtomicUsize = AtomicUsize::new(0);
    let dir = std::env::temp_dir().join(format!(
        "live-set-takes-855-{}-{}",
        std::process::id(),
        NEXT.fetch_add(1, Ordering::SeqCst)
    ));
    std::fs::create_dir_all(&dir).unwrap();
    let path = dir.join("set.als");
    let root = live_set::xml::parse(SET).unwrap();
    std::fs::write(&path, live_set::write_gz(&root).unwrap()).unwrap();
    (SetFile(dir), path.to_str().unwrap().to_string())
}
fn standing(path: &str) -> String {
    live_set::api::set_json(path).unwrap()["revision"]
        .as_str()
        .unwrap()
        .to_string()
}
fn run(path: &str, act_: SetAct) -> Result<Value, String> {
    act(path, &standing(path), &act_)
}
fn track_json(path: &str, index: usize) -> Value {
    live_set::api::set_json(path).unwrap()["document"]["tracks"][index].clone()
}
fn take(notes: Value, keeps: Option<Value>) -> SetAct {
    serde_json::from_value(
        json!({"kind": "take_record", "track": 0, "start": 8, "length": 4, "name": "Take 1",
        "notes": notes, "keeps": keeps}),
    )
    .unwrap()
}

/// What a take keeps beyond its notes, as the shell gives it (live/liveTake.ts).
fn keeps() -> Value {
    json!({"schema": "oi.live-take/v1", "keys": [[{"row": 0, "column": 42}], [{"row": 0, "column": 44}]],
        "torus": {"settings": {"tuning": "sky", "polyphony": 16}}, "resumes": "from the Torus's settings as they stood"})
}

#[test]
fn a_recorded_pass_lies_as_a_take_lane_under_its_track_and_in_the_main_lane_with_its_notes() {
    let (_dir, path) = set_file();
    let notes = json!([{"p": 60, "at": 0, "len": 1, "vel": 100}, {"p": 64, "at": 1.5, "len": 0.5, "vel": 64}]);
    let made = run(&path, take(notes, None)).unwrap();
    assert_eq!(made["act"], "take_record");
    assert_eq!(
        made["done"],
        "Recorded Take 1 on Keys at beat 8: 2 notes, in take lane 1."
    );
    assert_eq!(
        made["at"],
        json!({"track": 0, "arrangement": 1, "take": 1, "lane": 0})
    );
    let track = track_json(&path, 0);
    let lanes = track["takeLanes"].as_array().unwrap();
    assert_eq!(lanes.len(), 1, "one pass, one take lane");
    assert_eq!(lanes[0]["name"], "Take 1");
    let clip = &lanes[0]["clips"][0];
    assert_eq!(
        (
            clip["start"].as_f64(),
            clip["end"].as_f64(),
            clip["takeId"].as_f64()
        ),
        (Some(8.0), Some(12.0), Some(1.0))
    );
    assert_eq!(
        clip["gave"],
        json!([{"start": 8.0, "end": 12.0}]),
        "the pass is laid in the main lane, as Live lays the last pass"
    );
    let laid = clip_json(&path, 0, ClipAt::Arrangement(1)).unwrap();
    let played: Vec<(i64, f64, f64, f64)> = laid["clip"]["notes"]
        .as_array()
        .unwrap()
        .iter()
        .map(|n| {
            (
                n["p"].as_i64().unwrap(),
                n["at"].as_f64().unwrap(),
                n["len"].as_f64().unwrap(),
                n["vel"].as_f64().unwrap(),
            )
        })
        .collect();
    assert_eq!(
        played,
        vec![(60, 0.0, 1.0, 100.0), (64, 1.5, 0.5, 64.0)],
        "the notes as played, in the take's own time"
    );
    assert_eq!(laid["clip"]["name"], "Take 1");
    // A second pass is the next take: its own lane and TakeId, laid over the first in the main lane.
    let again = run(
        &path,
        serde_json::from_value(
            json!({"kind": "take_record", "track": 0, "start": 8, "length": 2, "name": "Take 2",
        "notes": [{"p": 67, "at": 0, "len": 1, "vel": 90}]}),
        )
        .unwrap(),
    )
    .unwrap();
    assert_eq!(again["at"]["take"], 2);
    assert_eq!(again["at"]["lane"], 1);
    let lanes = track_json(&path, 0)["takeLanes"]
        .as_array()
        .unwrap()
        .clone();
    assert_eq!(lanes.len(), 2);
    assert_eq!(
        lanes[0]["clips"][0]["gave"],
        json!([{"start": 10.0, "end": 12.0}]),
        "the first take still gives what the second did not cover"
    );
    assert_eq!(
        lanes[1]["clips"][0]["gave"],
        json!([{"start": 8.0, "end": 10.0}])
    );
}

#[test]
fn a_take_lane_stands_in_lives_own_shape() {
    let (_dir, path) = set_file();
    run(
        &path,
        take(json!([{"p": 60, "at": 0, "len": 1, "vel": 100}]), None),
    )
    .unwrap();
    let root = live_set::open_als(std::path::Path::new(&path)).unwrap();
    let track = root
        .find("LiveSet")
        .unwrap()
        .child("Tracks")
        .unwrap()
        .children
        .iter()
        .find(|t| t.name == "MidiTrack")
        .unwrap();
    let lanes = track.child("TakeLanes").unwrap();
    assert!(
        lanes.child("AreTakeLanesFolded").is_some(),
        "Live's own list is kept"
    );
    let lane = lanes
        .child("TakeLanes")
        .unwrap()
        .children
        .iter()
        .find(|l| l.name == "TakeLane")
        .unwrap();
    assert_eq!(lane.attr("Id"), Some("0"));
    let names: Vec<&str> = lane.children.iter().map(|c| c.name.as_str()).collect();
    assert_eq!(
        names,
        vec![
            "Height",
            "IsContentSelectedInDocument",
            "ClipAutomation",
            "Name",
            "Annotation",
            "Audition"
        ]
    );
    let automation: Vec<&str> = lane
        .child("ClipAutomation")
        .unwrap()
        .children
        .iter()
        .map(|c| c.name.as_str())
        .collect();
    assert_eq!(automation, vec!["Events", "AutomationTransformViewState"]);
    let clip = lane
        .child("ClipAutomation")
        .unwrap()
        .child("Events")
        .unwrap()
        .children
        .first()
        .unwrap();
    assert_eq!(clip.name, "MidiClip");
    assert_eq!(clip.attr("Time"), Some("8"));
    let value = |el: &live_set::xml::Element, name: &str| {
        el.child(name)
            .and_then(|c| c.attr("Value"))
            .map(str::to_string)
    };
    assert_eq!(value(clip, "TakeId").as_deref(), Some("1"));
    assert_eq!(
        value(clip.child("Loop").unwrap(), "LoopOn").as_deref(),
        Some("false"),
        "a recorded pass does not loop"
    );
}

#[test]
fn what_a_take_keeps_stands_beside_the_set_by_its_take_id_and_comes_back_with_its_clip() {
    let (_dir, path) = set_file();
    let made = run(&path, take(json!([{"p": 60, "at": 0, "len": 1, "vel": 100}, {"p": 64, "at": 1, "len": 1, "vel": 100}]), Some(keeps()))).unwrap();
    assert!(made.get("keepsRefused").is_none(), "{made}");
    assert_eq!(
        keeps_of(std::path::Path::new(&path), "12", 1).unwrap(),
        Some(keeps())
    );
    let laid = clip_json(&path, 0, ClipAt::Arrangement(1)).unwrap();
    assert_eq!(
        laid["clip"]["take"],
        json!({"id": 1, "keeps": keeps()}),
        "the main lane's stretch carries its take and what it keeps"
    );
    let verse = clip_json(&path, 0, ClipAt::Arrangement(0)).unwrap();
    assert_eq!(
        verse["clip"]["take"],
        Value::Null,
        "a clip no take gave keeps nothing"
    );
    let record: Value = serde_json::from_str(
        &std::fs::read_to_string(record_path(std::path::Path::new(&path))).unwrap(),
    )
    .unwrap();
    assert_eq!(record["schema"], SCHEMA);
    assert_eq!(
        record["takes"],
        json!([{"track": "12", "take": 1, "keeps": keeps()}])
    );
}

#[test]
fn a_part_keeps_its_torus_beside_the_set_and_the_set_reads_it_back_without_the_document_changing() {
    let (_dir, path) = set_file();
    let before = standing(&path);
    let torus = json!({"schema": "oi.live-torus/v1", "settings": {"tuning": "sky", "polyphony": 12}, "determinants": {"lens12": 3}});
    let kept = run(
        &path,
        serde_json::from_value(json!({"kind": "torus_keep", "track": 0, "torus": torus})).unwrap(),
    )
    .unwrap();
    assert_eq!(kept["done"], "Keys keeps the Torus as it stands.");
    assert_eq!(
        kept["revision"], before,
        "the .als is not written: Live's document has no place for the Torus"
    );
    assert_eq!(standing(&path), before);
    assert_eq!(
        track_json(&path, 0)["torus"],
        torus,
        "the set's reading carries the part's Torus"
    );
    assert_eq!(
        track_json(&path, 1)["torus"],
        Value::Null,
        "a part that keeps none reads none"
    );
    assert_eq!(
        torus_of(std::path::Path::new(&path), "12").unwrap(),
        Some(torus.clone())
    );
    let next =
        json!({"schema": "oi.live-torus/v1", "settings": {"tuning": "logic", "polyphony": 12}});
    run(
        &path,
        serde_json::from_value(json!({"kind": "torus_keep", "track": 0, "torus": next})).unwrap(),
    )
    .unwrap();
    assert_eq!(
        track_json(&path, 0)["torus"],
        next,
        "one Torus a part: kept again, it is replaced"
    );
    let cleared = run(
        &path,
        serde_json::from_value(json!({"kind": "torus_keep", "track": 0, "torus": null})).unwrap(),
    )
    .unwrap();
    assert_eq!(cleared["done"], "Keys keeps no Torus.");
    assert_eq!(track_json(&path, 0)["torus"], Value::Null);
}

#[test]
fn an_audio_part_a_stale_set_or_a_keep_that_is_no_object_is_refused_in_words() {
    let (_dir, path) = set_file();
    let audio = run(
        &path,
        serde_json::from_value(
            json!({"kind": "torus_keep", "track": 1, "torus": {"settings": {}}}),
        )
        .unwrap(),
    )
    .unwrap_err();
    assert!(audio.contains("MIDI part"), "{audio}");
    let stale = act(
        &path,
        "sha256:0",
        &serde_json::from_value(
            json!({"kind": "torus_keep", "track": 0, "torus": {"settings": {}}}),
        )
        .unwrap(),
    )
    .unwrap_err();
    assert!(stale.contains("changed since it was read"), "{stale}");
    let shapeless = run(
        &path,
        serde_json::from_value(json!({"kind": "torus_keep", "track": 0, "torus": [1, 2]})).unwrap(),
    )
    .unwrap_err();
    assert!(shapeless.contains("one object"), "{shapeless}");
    let heavy = json!({"pad": "x".repeat(300 * 1024)});
    let refused = run(
        &path,
        serde_json::from_value(json!({"kind": "torus_keep", "track": 0, "torus": heavy})).unwrap(),
    )
    .unwrap_err();
    assert!(refused.contains("256 KiB"), "{refused}");
    for (body, words) in [
        (
            json!({"kind": "take_record", "track": 1, "start": 0, "length": 4, "name": "Take 1", "notes": []}),
            "MIDI part",
        ),
        (
            json!({"kind": "take_record", "track": 0, "start": 0, "length": 0, "name": "Take 1", "notes": []}),
            "more than 0",
        ),
        (
            json!({"kind": "take_record", "track": 0, "start": -1, "length": 4, "name": "Take 1", "notes": []}),
            "from beat 0",
        ),
        (
            json!({"kind": "take_record", "track": 0, "start": 0, "length": 4, "name": " ", "notes": []}),
            "name",
        ),
        (
            json!({"kind": "take_record", "track": 0, "start": 0, "length": 4, "name": "Take 1", "notes": [{"p": 60, "at": 5, "len": 1}]}),
            "within the take",
        ),
        (
            json!({"kind": "take_record", "track": 0, "start": 0, "length": 4, "name": "Take 1", "notes": [], "keeps": "keys"}),
            "one object",
        ),
    ] {
        let refused = run(&path, serde_json::from_value(body.clone()).unwrap()).unwrap_err();
        assert!(refused.contains(words), "{body}: {refused}");
    }
    assert_eq!(
        track_json(&path, 0)["takeLanes"],
        json!([]),
        "nothing refused was laid"
    );
}

#[test]
fn a_record_of_the_first_schema_keeps_its_clips_sources_and_is_written_as_the_second() {
    let (_dir, path) = set_file();
    let set = std::path::Path::new(&path);
    std::fs::write(
        record_path(set),
        serde_json::to_string(&json!({"schema": SCHEMA_V1, "set": "set.als",
        "clips": [{"track": "12", "at": {"arrangement": 0}, "source": "wiki:node:central"}]}))
        .unwrap(),
    )
    .unwrap();
    assert_eq!(
        clip_json(&path, 0, ClipAt::Arrangement(0)).unwrap()["clip"]["source"],
        "wiki:node:central",
        "a v1 record reads"
    );
    assert_eq!(track_json(&path, 0)["torus"], Value::Null, "with no parts");
    run(
        &path,
        serde_json::from_value(
            json!({"kind": "torus_keep", "track": 0, "torus": {"settings": {"tuning": "maqam"}}}),
        )
        .unwrap(),
    )
    .unwrap();
    let record: Value =
        serde_json::from_str(&std::fs::read_to_string(record_path(set)).unwrap()).unwrap();
    assert_eq!(record["schema"], SCHEMA, "written as the second schema");
    assert_eq!(
        record["clips"],
        json!([{"track": "12", "at": {"arrangement": 0}, "source": "wiki:node:central"}]),
        "the sources it held are kept"
    );
    assert_eq!(
        record["parts"],
        json!([{"track": "12", "torus": {"settings": {"tuning": "maqam"}}}])
    );
    std::fs::write(
        record_path(set),
        "{\"schema\":\"oi.dlw-set/v9\",\"clips\":[]}",
    )
    .unwrap();
    let refused = run(
        &path,
        serde_json::from_value(
            json!({"kind": "torus_keep", "track": 0, "torus": {"settings": {}}}),
        )
        .unwrap(),
    )
    .unwrap_err();
    assert!(
        refused.contains(SCHEMA),
        "a record of another schema is refused, never read as empty: {refused}"
    );
}

#[test]
fn a_takes_notes_keep_their_mpe_beside_the_set_and_read_back_on_the_clips_notes() {
    // O-I #853 (DLW §21.1 Clip view, the MPE tab: "Pressure from the playing surface records here"; §21.2 Rules: "A recorded
    // performance keeps what it needs to be played on: the notes with their expression"). Live's own per-note event lists have
    // no clean-room shape yet (session-model.md §7 attests only the empty `<PerNoteEventStore><EventLists /></PerNoteEventStore>`),
    // so the set keeps each note's lanes in the DLW's record, by the note's own NoteId, and reads them back on that note.
    let (_dir, path) = set_file();
    let notes = json!([
        {"p": 60, "at": 0, "len": 1, "vel": 100, "mpe": {"pressure": [[0, 0.2], [0.5, 0.7]], "bend": [[0.5, -0.25]]}},
        {"p": 64, "at": 1.5, "len": 0.5, "vel": 64}
    ]);
    run(&path, take(notes, Some(keeps()))).unwrap();
    let laid = clip_json(&path, 0, ClipAt::Arrangement(1)).unwrap();
    let read = laid["clip"]["notes"].as_array().unwrap();
    assert_eq!(
        read[0]["mpe"],
        json!({"pressure": [[0.0, 0.2], [0.5, 0.7]], "bend": [[0.5, -0.25]]}),
        "the note reads back with its lanes"
    );
    assert!(read[1].get("mpe").is_none(), "an untouched note has none");
    let kept = keeps_of(std::path::Path::new(&path), "12", 1)
        .unwrap()
        .unwrap();
    assert_eq!(kept["schema"], "oi.live-take/v1", "the shell's keeps stand");
    assert_eq!(
        kept["mpe"],
        json!([{"id": read[0]["id"], "p": 60, "pressure": [[0.0, 0.2], [0.5, 0.7]], "bend": [[0.5, -0.25]]}]),
        "kept by the note's NoteId"
    );
    // A take with no keeps of the shell's still keeps its notes' MPE.
    let again = run(
        &path,
        serde_json::from_value(
            json!({"kind": "take_record", "track": 0, "start": 12, "length": 1, "name": "Take 2",
            "notes": [{"p": 67, "at": 0, "len": 1, "mpe": {"pressure": [[0.25, 1]]}}]}),
        )
        .unwrap(),
    )
    .unwrap();
    let j = again["at"]["arrangement"].as_u64().unwrap() as usize;
    let laid = clip_json(&path, 0, ClipAt::Arrangement(j)).unwrap();
    assert_eq!(
        laid["clip"]["notes"][0]["mpe"],
        json!({"pressure": [[0.25, 1.0]]})
    );
    // Lanes the note cannot hold are refused in words, and nothing is laid.
    for (mpe, why) in [
        (json!({"slide": [[0, 0.5]]}), "A note's MPE lanes are its pressure and its bend"),
        (json!({"pressure": [[2, 0.5]]}), "Each point of a note's pressure lane is a beat within the note and an amount from 0 to 1"),
        (json!({"pressure": [[0, 1.5]]}), "Each point of a note's pressure lane is a beat within the note and an amount from 0 to 1"),
        (json!({"bend": [[0, -2]]}), "Each point of a note's bend lane is a beat within the note and an amount from -1 to 1"),
        (json!({"bend": [[0.5, 0], [0.25, 0]]}), "A note's bend lane runs in time, at most 4096 points"),
        (json!({"bend": "up"}), "A note's bend lane runs in time, at most 4096 points"),
    ] {
        let refused = run(
            &path,
            serde_json::from_value(json!({"kind": "take_record", "track": 0, "start": 16, "length": 1, "name": "Take 3",
                "notes": [{"p": 60, "at": 0, "len": 1, "mpe": mpe}]}))
            .unwrap(),
        );
        assert_eq!(refused, Err(why.to_string()), "{mpe}");
    }
}
