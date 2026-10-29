//! The set's own acts on its objects (DLW manual §10.9 "Acts and menus",
//! after Live's): a clip pasted into an empty slot (or moved there, a cut), a
//! clip duplicated or deleted, an empty slot's stop button removed or given
//! back, a track renamed, moved, or duplicated, and a row (Live's scene)
//! inserted, renamed, duplicated or deleted. Each is one typed act
//! (`SetAct`), made against the set's revision and written back atomically as
//! every other edit is (`edit::edit`), and answered with what it did in words
//! and the set's new revision.
//!
//! The document's shapes are Live 12's own, read off a real set (the template
//! "Piano and voices mastering", `ableton-live-12.0.25/evidence/sets`): every
//! audio and MIDI track keeps one `ClipSlot` per scene in its
//! `MainSequencer/ClipSlotList` and a bookkeeping copy in
//! `FreezeSequencer/ClipSlotList`, a group track one `GroupTrackSlot` per
//! scene in `Slots`, each list's members numbered from 0; an empty slot is
//! `<ClipSlot Id><LomId/><ClipSlot><Value/></ClipSlot><HasStop/><NeedRefreeze/>`
//! with its stop button standing (`HasStop` true); a scene carries its
//! `Name`, `Annotation`, `Color` (-1: none), its own tempo and signature
//! switched off and its follow action. A clip in a slot carries no `Time`
//! (session-model.md §7: the anchor is present on every arrangement clip,
//! absent on session-slot clips). Pointee ids — every automation, modulation
//! and controller target and `Pointee` — are allocated below `NextPointeeId`
//! and never shared, and a clip's envelope never names a target its track does
//! not hold (session-model.md §4, both enforced by Live's loader).
//!
//! The DLW's own record beside the set (`sources.rs`) names each clip by its
//! track's `Id` and its place, so an act that moves clips moves their rows
//! with them (`sources::remap`); the `.als` is written first, and a record that
//! cannot follow says so in `sourceRefused`.

use crate::edit::{
    self, automation_targets, clip_at, number_text, set_value, track_at, tracks, value_of, ClipAt,
    CLIPS,
};
use crate::xml::Element;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

/// One act on the set's objects, as the kernel's `live_set_act` carries it
/// (`{"kind": "clip_paste", …}`).
/// Tracks are named by their place in the set (`SetDocument`'s order); a clip
/// by `{"slot": scene}` or `{"arrangement": index}`; a row by its scene index.
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum SetAct {
    /// Paste (⌘V on an empty slot): the session clip at `from` on
    /// `from_track` copied into the empty slot `scene` of `track`; with `cut`
    /// it is moved there (Cut, then Paste).
    ClipPaste {
        from_track: usize,
        from: ClipAt,
        track: usize,
        scene: usize,
        #[serde(default)]
        cut: bool,
    },
    /// Duplicate (⌘D): a session clip copied into the slot below (a row
    /// inserted below for it when that slot is held or there is none); an
    /// arrangement clip copied onto the ruler right after itself.
    ClipDuplicate { track: usize, clip: ClipAt },
    /// Delete (⌫): the clip taken out of its slot or off the ruler.
    ClipDelete { track: usize, clip: ClipAt },
    /// Remove stop button (⌘E on an empty slot), or give it back (`on`).
    SlotStopButton {
        track: usize,
        scene: usize,
        on: bool,
    },
    /// Rename (⌘R) a track.
    TrackRename { track: usize, name: String },
    /// Move a track one place left (`by: -1`) or right (`by: 1`).
    TrackMove { track: usize, by: i64 },
    /// Duplicate (⌘D) a track: a copy with its clips and chain, right after it.
    TrackDuplicate { track: usize },
    /// Insert row (⌘I): an empty row below row `after` (at the top with none).
    SceneInsert {
        #[serde(default)]
        after: Option<usize>,
    },
    /// Rename (⌘R) a row.
    SceneRename { scene: usize, name: String },
    /// Duplicate (⌘D) a row: a copy below it, holding a copy of each of its clips.
    SceneDuplicate { scene: usize },
    /// Delete (⌫) a row and every clip in it.
    SceneDelete { scene: usize },
    /// A track's colour, one of Live's 70 (its `Color`, the index the clip
    /// palette counts: packages/live-shell/ui/src/live/livePalette.ts).
    TrackColour { track: usize, colour: u8 },
    /// Group Tracks (⌘G): the tracks — adjacent, in one group or none — put
    /// in a new group standing right before the first of them.
    TracksGroup { tracks: Vec<usize> },
    /// Split (⌘E): an arrangement clip cut in two at the ruler's beat `at`.
    ClipSplit { track: usize, clip: ClipAt, at: f64 },
    /// Consolidate (⌘J): what a MIDI part's arrangement clips play between
    /// the beats `from` and `to` of the ruler, made one clip there.
    ClipsConsolidate { track: usize, from: f64, to: f64 },
}

// ---------------------------------------------------------------------------- the document's lists

/// An empty clip slot as Live 12 writes one (the template's `ClipSlotList`).
fn fresh_slot(id: usize) -> Element {
    let mut slot = Element::new("ClipSlot");
    slot.set_attr("Id", &id.to_string());
    let mut lom = Element::new("LomId");
    lom.set_attr("Value", "0");
    let mut inner = Element::new("ClipSlot");
    inner.children.push(Element::new("Value"));
    let mut stop = Element::new("HasStop");
    stop.set_attr("Value", "true");
    let mut refreeze = Element::new("NeedRefreeze");
    refreeze.set_attr("Value", "true");
    slot.children = vec![lom, inner, stop, refreeze];
    slot
}

/// A group track's slot as Live 12 writes one (the template's `Slots`).
fn fresh_group_slot(id: usize) -> Element {
    let mut slot = Element::new("GroupTrackSlot");
    slot.set_attr("Id", &id.to_string());
    let mut lom = Element::new("LomId");
    lom.set_attr("Value", "0");
    slot.children.push(lom);
    slot
}

/// The three kinds of per-scene list a track keeps.
#[derive(Clone, Copy, PartialEq, Eq)]
enum Slots {
    /// `MainSequencer/ClipSlotList`: the Session grid itself.
    Main,
    /// `FreezeSequencer/ClipSlotList`: its bookkeeping copy.
    Freeze,
    /// A group track's `Slots`.
    Group,
}

fn fresh(kind: Slots, id: usize) -> Element {
    if kind == Slots::Group {
        fresh_group_slot(id)
    } else {
        fresh_slot(id)
    }
}

/// Number a list's members from 0, as Live writes them.
fn renumber(list: &mut Element) {
    for (index, member) in list.children.iter_mut().enumerate() {
        member.set_attr("Id", &index.to_string());
    }
}

/// Give a list at least `count` members (a set written by hand may keep
/// fewer slots than scenes; the reader reads the missing ones as empty).
fn pad(list: &mut Element, kind: Slots, count: usize) {
    while list.children.len() < count {
        let id = list.children.len();
        list.children.push(fresh(kind, id));
    }
}

/// Every per-scene list of every track, with its kind.
fn each_list(root: &mut Element, mut visit: impl FnMut(&mut Element, Slots)) {
    let Some(members) = root
        .find_mut("LiveSet")
        .and_then(|set| set.child_mut("Tracks"))
    else {
        return;
    };
    for track in &mut members.children {
        if track.name == "GroupTrack" {
            if let Some(list) = track.child_mut("Slots") {
                visit(list, Slots::Group);
            }
        }
        // A group's and a return track's own freeze lists stand empty in real sets: only a part keeps slots there.
        if !matches!(track.name.as_str(), "AudioTrack" | "MidiTrack") {
            continue;
        }
        let Some(chain) = track.child_mut("DeviceChain") else {
            continue;
        };
        if let Some(list) = chain
            .child_mut("MainSequencer")
            .and_then(|s| s.child_mut("ClipSlotList"))
        {
            visit(list, Slots::Main);
        }
        if let Some(list) = chain
            .child_mut("FreezeSequencer")
            .and_then(|s| s.child_mut("ClipSlotList"))
        {
            visit(list, Slots::Freeze);
        }
    }
}

pub(crate) fn scene_count(root: &Element) -> usize {
    root.find("LiveSet")
        .and_then(|set| set.child("Scenes"))
        .map_or(0, |scenes| scenes.children.len())
}

/// A part's Session grid, made in Live's shape — one empty slot per scene —
/// where the document keeps none for it (a set written by hand: the reader
/// reads such a part's slots as empty, so the first clip written into one
/// needs the grid to stand in). The grid sits in the part's `MainSequencer`,
/// before its device chain as Live orders them.
pub(crate) fn main_slots(track: &mut Element, scenes: usize) -> Result<&mut Element, String> {
    if !matches!(track.name.as_str(), "AudioTrack" | "MidiTrack") {
        return Err("Only an audio or MIDI part has clip slots".into());
    }
    let chain = track
        .child_mut("DeviceChain")
        .ok_or("the part carries no device chain in the document")?;
    if chain.child("MainSequencer").is_none() {
        let at = chain
            .children
            .iter()
            .position(|c| c.name == "DeviceChain")
            .unwrap_or(chain.children.len());
        chain.children.insert(at, Element::new("MainSequencer"));
    }
    let sequencer = chain.child_mut("MainSequencer").expect("made above");
    if sequencer.child("ClipSlotList").is_none() {
        sequencer.children.push(Element::new("ClipSlotList"));
    }
    let list = sequencer.child_mut("ClipSlotList").expect("made above");
    pad(list, Slots::Main, scenes);
    Ok(list)
}

/// Whether a slot holds a clip.
pub(crate) fn held(slot: &Element) -> bool {
    slot.child("ClipSlot")
        .and_then(|inner| inner.child("Value"))
        .is_some_and(|v| !v.children.is_empty())
}

/// The value a slot keeps its clip in.
fn slot_value(slot: &mut Element) -> Result<&mut Element, String> {
    slot.child_mut("ClipSlot")
        .and_then(|inner| inner.child_mut("Value"))
        .ok_or_else(|| "the slot carries no value in the document".to_string())
}

/// The `Tracks` member a listed track stands at (the set's own order: audio,
/// MIDI and return tracks; the Main track is not a member).
fn member_at(root: &Element, track: usize) -> Result<usize, String> {
    let members = root
        .find("LiveSet")
        .and_then(|set| set.child("Tracks"))
        .ok_or("the document holds no tracks")?;
    let listed: Vec<usize> = members
        .children
        .iter()
        .enumerate()
        .filter(|(_, t)| {
            matches!(
                t.name.as_str(),
                "AudioTrack" | "MidiTrack" | "ReturnTrack" | "GroupTrack"
            )
        })
        .map(|(at, _)| at)
        .collect();
    match listed.get(track) {
        Some(at) => Ok(*at),
        None if track == listed.len() && tracks(root).len() > listed.len() => {
            Err("The Main track keeps Live's own place and name".into())
        }
        None => Err(format!("the set has no track {track}")),
    }
}

fn members_mut(root: &mut Element) -> Result<&mut Vec<Element>, String> {
    root.find_mut("LiveSet")
        .and_then(|set| set.child_mut("Tracks"))
        .map(|tracks| &mut tracks.children)
        .ok_or_else(|| "the document holds no tracks".to_string())
}

fn track_name(track: &Element) -> String {
    track
        .child("Name")
        .and_then(|n| value_of(n, "EffectiveName"))
        .unwrap_or("the track")
        .to_string()
}

fn scene_name(root: &Element, scene: usize) -> String {
    root.find("LiveSet")
        .and_then(|set| set.child("Scenes"))
        .and_then(|scenes| scenes.children.get(scene))
        .and_then(|s| value_of(s, "Name"))
        .filter(|name| !name.is_empty())
        .map_or_else(
            || format!("row {}", scene + 1),
            |name| format!("row {name}"),
        )
}

/// A name as Live keeps one: text of at most 256 characters, no control characters.
fn checked_name(what: &str, name: &str, blank: bool) -> Result<String, String> {
    let ok = name.chars().count() <= 256
        && !name.chars().any(char::is_control)
        && (blank || !name.trim().is_empty());
    if ok {
        Ok(name.to_string())
    } else if blank {
        Err(format!("{what} is text of at most 256 characters"))
    } else {
        Err(format!("{what} is text of 1 to 256 characters"))
    }
}

// ---------------------------------------------------------------------------- a new clip's shape

/// An empty MIDI clip in the shape Live's loader took for a clip made by hand
/// (session-model.md §7, "End-to-end load of a crafted MIDI clip: VALIDATED";
/// the shape is the harness's `build_set_midi.py` clip): its place and
/// markers, its name and info text, its colour, its switch, its envelopes and
/// its notes with their generators. It loops over `length` beats, as a new
/// clip does in Live. The shape a clip takes when the set holds no MIDI clip
/// to take it from (`edit::shape_donor`).
pub(crate) fn crafted_clip(colour: Option<&str>, length: f64) -> Element {
    let value = |name: &str, v: &str| {
        let mut e = Element::new(name);
        e.set_attr("Value", v);
        e
    };
    let end = number_text(length);
    let mut clip = Element::new("MidiClip");
    clip.set_attr("Id", "0");
    clip.children.push(value("LomId", "0"));
    clip.children.push(value("LomIdView", "0"));
    clip.children.push(value("CurrentStart", "0"));
    clip.children.push(value("CurrentEnd", &end));
    let mut looped = Element::new("Loop");
    for (name, v) in [
        ("LoopStart", "0"),
        ("LoopEnd", end.as_str()),
        ("StartRelative", "0"),
        ("LoopOn", "true"),
        ("OutMarker", end.as_str()),
        ("HiddenLoopStart", "0"),
        ("HiddenLoopEnd", end.as_str()),
    ] {
        looped.children.push(value(name, v));
    }
    clip.children.push(looped);
    clip.children.push(value("Name", ""));
    clip.children.push(value("Annotation", ""));
    clip.children.push(value("Color", colour.unwrap_or("12")));
    clip.children.push(value("Disabled", "false"));
    let mut envelopes = Element::new("Envelopes");
    envelopes.children.push(Element::new("Envelopes"));
    clip.children.push(envelopes);
    let mut notes = Element::new("Notes");
    notes.children.push(Element::new("KeyTracks"));
    let mut store = Element::new("PerNoteEventStore");
    store.children.push(Element::new("EventLists"));
    notes.children.push(store);
    notes.children.push(Element::new("NoteProbabilityGroups"));
    let mut groups = Element::new("ProbabilityGroupIdGenerator");
    groups.children.push(value("NextId", "0"));
    notes.children.push(groups);
    let mut ids = Element::new("NoteIdGenerator");
    ids.children.push(value("NextId", "1"));
    notes.children.push(ids);
    clip.children.push(notes);
    clip
}

/// A clip as a slot keeps it: no arrangement anchor (session-model.md §7).
fn for_slot(mut clip: Element) -> Element {
    clip.attrs.retain(|(name, _)| name != "Time");
    clip
}

/// Leave behind a clip's envelopes that name a target `track` does not hold
/// (session-model.md §4: no envelope may name a target that is not there);
/// answers how many were left.
fn keep_own_envelopes(clip: &mut Element, track: &Element) -> usize {
    let targets = automation_targets(track);
    let Some(list) = clip
        .child_mut("Envelopes")
        .and_then(|e| e.child_mut("Envelopes"))
    else {
        return 0;
    };
    let before = list.children.len();
    list.children.retain(|env| {
        env.child("EnvelopeTarget")
            .and_then(|t| value_of(t, "PointeeId"))
            .is_some_and(|id| targets.contains_key(id))
    });
    before - list.children.len()
}

// ---------------------------------------------------------------------------- the rows

/// A new row in the set's own shape: the row at `like` (or the first) with
/// its own name, info text, colour, tempo, signature and follow action
/// cleared, as Live makes a new scene; a set with no row gets Live's minimal one.
fn fresh_scene(scenes: &Element, like: usize) -> Element {
    let Some(model) = scenes
        .children
        .get(like)
        .or_else(|| scenes.children.first())
    else {
        let mut scene = Element::new("Scene");
        let mut name = Element::new("Name");
        name.set_attr("Value", "");
        scene.children.push(name);
        return scene;
    };
    let mut scene = model.clone();
    for (name, value) in [
        ("Name", ""),
        ("Annotation", ""),
        ("Color", "-1"),
        ("IsTempoEnabled", "false"),
        ("IsTimeSignatureEnabled", "false"),
    ] {
        if scene.child(name).is_some() {
            let _ = set_value(&mut scene, name, value);
        }
    }
    if let Some(follow) = scene.child_mut("FollowAction") {
        if follow.child("FollowActionEnabled").is_some() {
            let _ = set_value(follow, "FollowActionEnabled", "false");
        }
    }
    scene
}

fn scenes_mut(root: &mut Element) -> Result<&mut Element, String> {
    root.find_mut("LiveSet")
        .and_then(|set| set.child_mut("Scenes"))
        .ok_or_else(|| "the document holds no scenes".to_string())
}

/// Insert an empty row at `at`: the scene, and an empty slot at `at` in
/// every track's lists.
fn insert_row(root: &mut Element, at: usize) -> Result<(), String> {
    let count = scene_count(root);
    if at > count {
        return Err(format!("the set has no row {at}"));
    }
    let scenes = scenes_mut(root)?;
    let scene = fresh_scene(scenes, at.saturating_sub(1));
    scenes.children.insert(at, scene);
    renumber(scenes);
    each_list(root, |list, kind| {
        pad(list, kind, count);
        list.children.insert(at, fresh(kind, at));
        renumber(list);
    });
    Ok(())
}

// ---------------------------------------------------------------------------- the acts

/// What an act did: its words, where it left what it made, and how the clips'
/// places moved (for the DLW's record beside the set).
struct Done {
    words: String,
    at: Option<Value>,
    places: Places,
}

/// How the clips' places move: by session slot, per track `Id`, and by
/// arrangement clip (followed by its `Id` in the lane).
enum Places {
    None,
    /// Every row from `from` moves by `by`; the row named in `dropped` is
    /// gone; `copied` names a row whose clips were copied to another, on
    /// every track or only on the track whose `Id` it names.
    Rows {
        from: usize,
        by: i64,
        dropped: Option<usize>,
        copied: Option<(Option<String>, usize, usize)>,
    },
    /// One clip copied (to another place, perhaps another track) or moved.
    Clip {
        from: (String, ClipAt),
        to: Option<(String, ClipAt)>,
        moved: bool,
    },
    /// An arrangement lane rewritten: the clips' `Id`s before and after.
    Lane {
        track: String,
        before: Vec<String>,
        after: Vec<String>,
        dropped: Option<String>,
        /// Each clip that stands for another (`(was, now)`): a copy, or a piece the other was cut into.
        copied: Vec<(String, String)>,
    },
    /// A track copied whole: its clips' rows copied to the new track's `Id`.
    Track {
        from: String,
        to: String,
    },
}

/// A track's arrangement clips' `Id`s, in the order `ClipAt::Arrangement` counts them.
fn lane_ids(track: &Element) -> Vec<String> {
    edit::main_lane(track)
        .into_iter()
        .enumerate()
        .map(|(at, clip)| {
            clip.attr("Id")
                .map_or_else(|| format!("#{at}"), str::to_string)
        })
        .collect()
}

fn track_id(track: &Element) -> Result<String, String> {
    track
        .attr("Id")
        .map(str::to_string)
        .ok_or_else(|| "the track carries no Id in the document".to_string())
}

/// The slot (outer `ClipSlot`) at `scene` of a part, its grid made where the
/// document keeps none.
fn slot_mut(track: &mut Element, scene: usize, scenes: usize) -> Result<&mut Element, String> {
    if scene >= scenes {
        return Err(format!("the set has no row {}", scene + 1));
    }
    main_slots(track, scenes)?
        .children
        .get_mut(scene)
        .ok_or_else(|| format!("the part has no slot in row {}", scene + 1))
}

fn listed_mut(root: &mut Element, track: usize) -> Result<&mut Element, String> {
    let at = member_at(root, track)?;
    members_mut(root)?
        .get_mut(at)
        .ok_or_else(|| format!("the set has no track {track}"))
}

fn clip_paste(
    root: &mut Element,
    from_track: usize,
    from: ClipAt,
    track: usize,
    scene: usize,
    cut: bool,
) -> Result<Done, String> {
    let ClipAt::Slot(from_scene) = from else {
        return Err(
            "Paste takes a clip copied from a slot: a clip on the ruler is laid on the ruler"
                .into(),
        );
    };
    if cut && from_track == track && from_scene == scene {
        return Err("The clip already stands in this slot".into());
    }
    let scenes = scene_count(root);
    let source = track_at(root, from_track)?;
    let mut clip = for_slot(clip_at(source, from)?.clone());
    let from_id = track_id(source)?;
    let name = value_of(&clip, "Name").unwrap_or("").to_string();
    let target = track_at(root, track)?;
    let fits = match target.name.as_str() {
        "MidiTrack" => clip.name == "MidiClip",
        "AudioTrack" => clip.name == "AudioClip",
        _ => return Err("A clip is pasted onto an audio or MIDI part".into()),
    };
    if !fits {
        return Err(
            "A MIDI clip is pasted onto a MIDI part, and an audio clip onto an audio part".into(),
        );
    }
    let to_id = track_id(target)?;
    let target_name = track_name(target);
    let left = if from_track == track {
        0
    } else {
        keep_own_envelopes(&mut clip, target)
    };
    let slot = slot_mut(listed_mut(root, track)?, scene, scenes)?;
    if held(slot) {
        return Err(format!(
            "The slot in row {} already holds a clip",
            scene + 1
        ));
    }
    slot_value(slot)?.children = vec![clip];
    if cut {
        slot_value(slot_mut(listed_mut(root, from_track)?, from_scene, scenes)?)?
            .children
            .clear();
    }
    let shown = if name.is_empty() {
        "the clip".to_string()
    } else {
        name
    };
    let mut words = format!(
        "{} {shown} into row {} of {target_name}.",
        if cut { "Moved" } else { "Pasted" },
        scene + 1
    );
    if left > 0 {
        words.push_str(&format!(
            " {left} of its envelopes moved devices {target_name} does not hold, so they were left behind."
        ));
    }
    Ok(Done {
        words,
        at: Some(json!({"track": track, "slot": scene})),
        places: Places::Clip {
            from: (from_id, from),
            to: Some((to_id, ClipAt::Slot(scene))),
            moved: cut,
        },
    })
}

fn clip_duplicate(root: &mut Element, track: usize, clip: ClipAt) -> Result<Done, String> {
    let part = track_at(root, track)?;
    let original = clip_at(part, clip)?.clone();
    let id = track_id(part)?;
    let named = value_of(&original, "Name")
        .filter(|n| !n.is_empty())
        .unwrap_or("the clip")
        .to_string();
    match clip {
        ClipAt::Slot(scene) => {
            let scenes = scene_count(root);
            let below = scene + 1;
            let free = below < scenes && {
                let slots = listed_mut(root, track)?;
                !held(slot_mut(slots, below, scenes)?)
            };
            if !free {
                insert_row(root, below)?;
            }
            let scenes = scene_count(root);
            let slot = slot_mut(listed_mut(root, track)?, below, scenes)?;
            slot_value(slot)?.children = vec![original];
            let places = if free {
                Places::Clip {
                    from: (id.clone(), clip),
                    to: Some((id, ClipAt::Slot(below))),
                    moved: false,
                }
            } else {
                Places::Rows {
                    from: below,
                    by: 1,
                    dropped: None,
                    copied: Some((Some(id), scene, below)),
                }
            };
            Ok(Done {
                words: if free {
                    format!("Duplicated {named} into row {}.", below + 1)
                } else {
                    format!(
                        "Duplicated {named} into a new row {} inserted below it.",
                        below + 1
                    )
                },
                at: Some(json!({"track": track, "slot": below})),
                places,
            })
        }
        ClipAt::Arrangement(_) => {
            let (start, end) = (
                edit::num(&original, "CurrentStart")
                    .ok_or("the clip carries no place in the document")?,
                edit::num(&original, "CurrentEnd")
                    .ok_or("the clip carries no place in the document")?,
            );
            if end <= start {
                return Err("The clip has no length on the ruler to duplicate".into());
            }
            let tempo = edit::steady_tempo(root);
            let mut copy = original.clone();
            let length = end - start;
            set_value(&mut copy, "CurrentStart", &number_text(end))?;
            set_value(&mut copy, "CurrentEnd", &number_text(end + length))?;
            copy.set_attr("Time", &number_text(end));
            let holder = if original.name == "MidiClip" {
                "ClipTimeable"
            } else {
                "Sample"
            };
            let before = lane_ids(part);
            let original_id = original.attr("Id").unwrap_or("").to_string();
            let target = listed_mut(root, track)?;
            edit::lay_over(target, holder, end, end + length, tempo, vec![copy])?;
            let after = lane_ids(target);
            let made = after
                .iter()
                .find(|id| !before.contains(id))
                .cloned()
                .unwrap_or_default();
            let at = after.iter().position(|a| *a == made);
            Ok(Done {
                words: format!("Duplicated {named} onto the ruler right after it."),
                at: at.map(|j| json!({"track": track, "arrangement": j})),
                places: Places::Lane {
                    track: id,
                    before,
                    after,
                    dropped: None,
                    copied: vec![(original_id, made)],
                },
            })
        }
    }
}

fn clip_delete(root: &mut Element, track: usize, clip: ClipAt) -> Result<Done, String> {
    let part = track_at(root, track)?;
    let found = clip_at(part, clip)?;
    let named = value_of(found, "Name")
        .filter(|n| !n.is_empty())
        .unwrap_or("the clip")
        .to_string();
    let id = track_id(part)?;
    let original_id = found.attr("Id").unwrap_or("").to_string();
    let before = lane_ids(part);
    let scenes = scene_count(root);
    let target = listed_mut(root, track)?;
    match clip {
        ClipAt::Slot(scene) => {
            slot_value(slot_mut(target, scene, scenes)?)?
                .children
                .clear();
            Ok(Done {
                words: format!("Deleted {named} from row {}.", scene + 1),
                at: None,
                places: Places::Clip {
                    from: (id, clip),
                    to: None,
                    moved: true,
                },
            })
        }
        ClipAt::Arrangement(j) => {
            let sequencer = target
                .child_mut("DeviceChain")
                .and_then(|dc| dc.child_mut("MainSequencer"))
                .ok_or("the track has no sequencer: it holds no clips")?;
            let mut seen = 0;
            let mut removed = false;
            for holder in ["Sample", "ClipTimeable"] {
                let Some(events) = sequencer
                    .child_mut(holder)
                    .and_then(|h| h.child_mut("ArrangerAutomation"))
                    .and_then(|a| a.child_mut("Events"))
                else {
                    continue;
                };
                let mut place = None;
                for (at, clip) in events.children.iter().enumerate() {
                    if !CLIPS.contains(&clip.name.as_str()) {
                        continue;
                    }
                    if seen == j {
                        place = Some(at);
                    }
                    seen += 1;
                }
                if let Some(at) = place {
                    events.children.remove(at);
                    removed = true;
                    break;
                }
            }
            if !removed {
                return Err(format!("the track has no arrangement clip {j}"));
            }
            let after = lane_ids(target);
            Ok(Done {
                words: format!("Deleted {named} from the ruler."),
                at: None,
                places: Places::Lane {
                    track: id,
                    before,
                    after,
                    dropped: Some(original_id),
                    copied: Vec::new(),
                },
            })
        }
    }
}

fn slot_stop_button(
    root: &mut Element,
    track: usize,
    scene: usize,
    on: bool,
) -> Result<Done, String> {
    let scenes = scene_count(root);
    let named = track_name(track_at(root, track)?);
    let slot = slot_mut(listed_mut(root, track)?, scene, scenes)?;
    if held(slot) {
        return Err(format!(
            "The slot in row {} holds a clip: a clip stops with its own track's stop",
            scene + 1
        ));
    }
    let word = if on { "true" } else { "false" };
    match slot.child_mut("HasStop") {
        Some(stop) => stop.set_attr("Value", word),
        None => {
            let mut stop = Element::new("HasStop");
            stop.set_attr("Value", word);
            slot.children.push(stop);
        }
    }
    Ok(Done {
        words: if on {
            format!("Gave back the stop button in row {} of {named}.", scene + 1)
        } else {
            format!("Removed the stop button in row {} of {named}: launching the row leaves {named} playing.", scene + 1)
        },
        at: Some(json!({"track": track, "slot": scene})),
        places: Places::None,
    })
}

fn track_rename(root: &mut Element, track: usize, name: &str) -> Result<Done, String> {
    let name = checked_name("A track's name", name, false)?;
    let part = listed_mut(root, track)?;
    let was = track_name(part);
    let holder = part
        .child_mut("Name")
        .ok_or("the track carries no name in the document")?;
    for field in ["EffectiveName", "UserName"] {
        match holder.child_mut(field) {
            Some(e) => e.set_attr("Value", &name),
            None => {
                let mut e = Element::new(field);
                e.set_attr("Value", &name);
                holder.children.push(e);
            }
        }
    }
    Ok(Done {
        words: format!("Renamed {was} to {name}."),
        at: Some(json!({"track": track})),
        places: Places::None,
    })
}

fn track_move(root: &mut Element, track: usize, by: i64) -> Result<Done, String> {
    if by != -1 && by != 1 {
        return Err("A track moves one place: left (-1) or right (1)".into());
    }
    let at = member_at(root, track)?;
    let named = track_name(track_at(root, track)?);
    let neighbour = if by < 0 {
        track
            .checked_sub(1)
            .ok_or_else(|| format!("{named} is already the first track"))?
    } else {
        track + 1
    };
    let other =
        member_at(root, neighbour).map_err(|_| format!("{named} is already the last track"))?;
    let members = root
        .find("LiveSet")
        .and_then(|set| set.child("Tracks"))
        .ok_or("the document holds no tracks")?;
    let (one, two) = (&members.children[at], &members.children[other]);
    if one.name == "GroupTrack" || two.name == "GroupTrack" {
        return Err("A group moves with its members, and a track goes into or out of a group by Group Tracks: moving past a group's head is not carried yet".into());
    }
    if one.name == "ReturnTrack" || two.name == "ReturnTrack" {
        return Err("A return track's place orders every part's sends: moving one past another, or a part among them, is not carried yet".into());
    }
    let group = |t: &Element| value_of(t, "TrackGroupId").unwrap_or("-1").to_string();
    let (low, high) = (at.min(other), at.max(other));
    if group(one) != group(two)
        || members.children[low + 1..high]
            .iter()
            .any(|t| t.name == "GroupTrack")
    {
        return Err("Moving a track into or out of a group is Group's act".into());
    }
    members_mut(root)?.swap(at, other);
    Ok(Done {
        words: format!("Moved {named} {}.", if by < 0 { "left" } else { "right" }),
        at: Some(json!({"track": neighbour})),
        places: Places::None,
    })
}

/// The pointee ids a track's copy must take afresh: every element Live
/// allocates one for (session-model.md §4; the template's tracks hold them on
/// `AutomationTarget`, `ModulationTarget`, `…ModulationTarget`,
/// `ControllerTargets.N` and `Pointee`).
fn is_pointee(element: &Element) -> bool {
    // An envelope's `EnvelopeTarget` names a pointee (its `PointeeId`); it carries no id of its own.
    element.attr("Id").is_some()
        && (element.name == "Pointee"
            || element.name.ends_with("Target")
            || element.name.starts_with("ControllerTargets."))
}

fn highest_pointee(element: &Element) -> u64 {
    let own = if is_pointee(element) {
        element
            .attr("Id")
            .and_then(|id| id.parse().ok())
            .unwrap_or(0)
    } else {
        0
    };
    element
        .children
        .iter()
        .map(highest_pointee)
        .fold(own, u64::max)
}

fn reallocate(
    element: &mut Element,
    next: &mut u64,
    map: &mut std::collections::HashMap<String, String>,
) {
    if is_pointee(element) {
        if let Some(old) = element.attr("Id").map(str::to_string) {
            let new = next.to_string();
            *next += 1;
            element.set_attr("Id", &new);
            map.insert(old, new);
        }
    }
    for child in &mut element.children {
        reallocate(child, next, map);
    }
}

fn repoint(element: &mut Element, map: &std::collections::HashMap<String, String>) {
    if element.name == "PointeeId" {
        if let Some(new) = element.attr("Value").and_then(|old| map.get(old)).cloned() {
            element.set_attr("Value", &new);
        }
    }
    for child in &mut element.children {
        repoint(child, map);
    }
}

fn track_duplicate(root: &mut Element, track: usize) -> Result<Done, String> {
    let at = member_at(root, track)?;
    let members = root
        .find("LiveSet")
        .and_then(|set| set.child("Tracks"))
        .ok_or("the document holds no tracks")?;
    let original = &members.children[at];
    if original.name == "ReturnTrack" {
        return Err(
            "Duplicating a return track gives every part another send: not carried yet".into(),
        );
    }
    if original.name == "GroupTrack" {
        return Err("Duplicating a group copies its members with it: not carried yet".into());
    }
    let mut copy = original.clone();
    let from = track_id(original)?;
    let named = track_name(original);
    let new_id = members
        .children
        .iter()
        .filter_map(|t| t.attr("Id")?.parse::<u64>().ok())
        .max()
        .map_or(0, |id| id + 1)
        .to_string();
    copy.set_attr("Id", &new_id);
    let set = root
        .find("LiveSet")
        .ok_or("the document holds no LiveSet")?;
    let declared = set
        .child("NextPointeeId")
        .and_then(|n| n.attr("Value"))
        .and_then(|v| v.parse::<u64>().ok());
    let mut next = declared.unwrap_or(0).max(highest_pointee(set) + 1);
    let mut map = std::collections::HashMap::new();
    reallocate(&mut copy, &mut next, &mut map);
    repoint(&mut copy, &map);
    members_mut(root)?.insert(at + 1, copy);
    if declared.is_some() {
        if let Some(counter) = root
            .find_mut("LiveSet")
            .and_then(|set| set.child_mut("NextPointeeId"))
        {
            counter.set_attr("Value", &next.to_string());
        }
    }
    Ok(Done {
        words: format!("Duplicated {named}: its copy stands right after it."),
        at: Some(json!({"track": track + 1})),
        places: Places::Track { from, to: new_id },
    })
}

fn scene_insert(root: &mut Element, after: Option<usize>) -> Result<Done, String> {
    let at = after.map_or(0, |a| a + 1);
    insert_row(root, at)?;
    Ok(Done {
        words: format!("Inserted an empty row {}.", at + 1),
        at: Some(json!({"scene": at})),
        places: Places::Rows {
            from: at,
            by: 1,
            dropped: None,
            copied: None,
        },
    })
}

fn scene_rename(root: &mut Element, scene: usize, name: &str) -> Result<Done, String> {
    let name = checked_name("A row's name", name, true)?;
    let was = scene_name(root, scene);
    let row = scenes_mut(root)?
        .children
        .get_mut(scene)
        .ok_or_else(|| format!("the set has no row {}", scene + 1))?;
    match row.child_mut("Name") {
        Some(e) => e.set_attr("Value", &name),
        None => {
            let mut e = Element::new("Name");
            e.set_attr("Value", &name);
            row.children.insert(0, e);
        }
    }
    Ok(Done {
        words: if name.is_empty() {
            format!("Cleared the name of {was}.")
        } else {
            format!("Renamed {was} to {name}.")
        },
        at: Some(json!({"scene": scene})),
        places: Places::None,
    })
}

fn scene_duplicate(root: &mut Element, scene: usize) -> Result<Done, String> {
    let count = scene_count(root);
    if scene >= count {
        return Err(format!("the set has no row {}", scene + 1));
    }
    let named = scene_name(root, scene);
    let scenes = scenes_mut(root)?;
    let copy = scenes.children[scene].clone();
    scenes.children.insert(scene + 1, copy);
    renumber(scenes);
    each_list(root, |list, kind| {
        pad(list, kind, count);
        let slot = if kind == Slots::Main {
            list.children[scene].clone()
        } else {
            fresh(kind, scene + 1)
        };
        list.children.insert(scene + 1, slot);
        renumber(list);
    });
    Ok(Done {
        words: format!(
            "Duplicated {named} with its clips: the copy is row {}.",
            scene + 2
        ),
        at: Some(json!({"scene": scene + 1})),
        places: Places::Rows {
            from: scene + 1,
            by: 1,
            dropped: None,
            copied: Some((None, scene, scene + 1)),
        },
    })
}

fn scene_delete(root: &mut Element, scene: usize) -> Result<Done, String> {
    let count = scene_count(root);
    if scene >= count {
        return Err(format!("the set has no row {}", scene + 1));
    }
    if count == 1 {
        return Err("A set keeps at least one row".into());
    }
    let named = scene_name(root, scene);
    let scenes = scenes_mut(root)?;
    scenes.children.remove(scene);
    renumber(scenes);
    each_list(root, |list, kind| {
        pad(list, kind, count);
        list.children.remove(scene);
        renumber(list);
    });
    Ok(Done {
        words: format!("Deleted {named} and every clip in it."),
        at: None,
        places: Places::Rows {
            from: scene + 1,
            by: -1,
            dropped: Some(scene),
            copied: None,
        },
    })
}

fn track_colour(root: &mut Element, track: usize, colour: u8) -> Result<Done, String> {
    if usize::from(colour) >= LIVE_COLOURS {
        return Err("A track's colour is one of Live's 70 (0 to 69)".into());
    }
    let part = listed_mut(root, track)?;
    let named = track_name(part);
    match part.child_mut("Color") {
        Some(c) => c.set_attr("Value", &colour.to_string()),
        None => {
            let mut c = Element::new("Color");
            c.set_attr("Value", &colour.to_string());
            let at = part
                .children
                .iter()
                .position(|c| c.name == "Name")
                .map_or(part.children.len(), |at| at + 1);
            part.children.insert(at, c);
        }
    }
    Ok(Done {
        words: format!("Coloured {named}."),
        at: Some(json!({"track": track})),
        places: Places::None,
    })
}

/// Live's 70 colours (the clip and track palette, livePalette.ts).
const LIVE_COLOURS: usize = 70;

/// The children a group track keeps, in Live's order (the template's
/// `GroupTrack Id="17"`, template-piano-voices-mastering.xml:913-1038): a
/// part's own children that a group has none of (its sequencer, its playing
/// slot, its MIDI settings) are not among them.
const GROUP_CHILDREN: &[&str] = &[
    "LomId",
    "LomIdView",
    "IsContentSelectedInDocument",
    "PreferredContentViewMode",
    "TrackDelay",
    "Name",
    "Color",
    "AutomationEnvelopes",
    "TrackGroupId",
    "TrackUnfolded",
    "DevicesListWrapper",
    "ClipSlotsListWrapper",
    "ViewData",
    "TakeLanes",
    "LinkedTrackGroupId",
    "Slots",
    "Freeze",
    "NeedArrangerRefreeze",
    "DeviceChain",
];

fn value_element(name: &str, value: &str) -> Element {
    let mut e = Element::new(name);
    e.set_attr("Value", value);
    e
}

/// A new group track in Live's shape, made from the first of its members as
/// the template's group stands beside its members: the member's own mixer and
/// routings (so the group goes where the members went, with as many sends as
/// the set has returns), with what a group has none of taken away, its device
/// chain emptied, its envelopes and take lanes cleared, one `GroupTrackSlot`
/// per row in `Slots`, an empty freeze grid, unfolded, and named as Live
/// names a new group ("N-Group", the template's `EffectiveName`
/// `2-Group` with an empty `UserName`).
fn group_of(member: &Element, id: &str, name: &str, scenes: usize) -> Element {
    let mut group = member.clone();
    group.name = "GroupTrack".into();
    group.set_attr("Id", id);
    group
        .children
        .retain(|c| GROUP_CHILDREN.contains(&c.name.as_str()));
    let set = |group: &mut Element, name: &str, value: &str| match group.child_mut(name) {
        Some(e) => e.set_attr("Value", value),
        None => group.children.push(value_element(name, value)),
    };
    set(&mut group, "TrackUnfolded", "true");
    if let Some(holder) = group.child_mut("Name") {
        for (field, value) in [("EffectiveName", name), ("UserName", "")] {
            match holder.child_mut(field) {
                Some(e) => e.set_attr("Value", value),
                None => holder.children.push(value_element(field, value)),
            }
        }
    } else {
        let mut holder = Element::new("Name");
        holder.children.push(value_element("EffectiveName", name));
        holder.children.push(value_element("UserName", ""));
        group.children.insert(0, holder);
    }
    if let Some(list) = group
        .child_mut("AutomationEnvelopes")
        .and_then(|a| a.child_mut("Envelopes"))
    {
        list.children.clear();
    }
    if let Some(lanes) = group
        .child_mut("TakeLanes")
        .and_then(|t| t.child_mut("TakeLanes"))
    {
        lanes.children.clear();
    }
    let mut slots = Element::new("Slots");
    slots.children = (0..scenes).map(fresh_group_slot).collect();
    let at = group
        .children
        .iter()
        .position(|c| c.name == "LinkedTrackGroupId")
        .map(|at| at + 1)
        .or_else(|| group.children.iter().position(|c| c.name == "DeviceChain"))
        .unwrap_or(group.children.len());
    group.children.insert(at, slots);
    if let Some(chain) = group.child_mut("DeviceChain") {
        chain.children.retain(|c| c.name != "MainSequencer");
        if let Some(devices) = chain
            .child_mut("DeviceChain")
            .and_then(|dc| dc.child_mut("Devices"))
        {
            devices.children.clear();
        }
        if let Some(list) = chain
            .child_mut("FreezeSequencer")
            .and_then(|f| f.child_mut("ClipSlotList"))
        {
            list.children.clear();
        }
    }
    group
}

fn tracks_group(root: &mut Element, tracks: &[usize]) -> Result<Done, String> {
    let mut chosen: Vec<usize> = tracks.to_vec();
    chosen.sort_unstable();
    chosen.dedup();
    if chosen.is_empty() {
        return Err("Group Tracks takes one track or more".into());
    }
    let mut members = Vec::with_capacity(chosen.len());
    for &track in &chosen {
        members.push(member_at(root, track)?);
    }
    let scenes = scene_count(root);
    let list = root
        .find("LiveSet")
        .and_then(|set| set.child("Tracks"))
        .ok_or("the document holds no tracks")?;
    let parent = value_of(&list.children[members[0]], "TrackGroupId")
        .unwrap_or("-1")
        .to_string();
    for (k, &at) in members.iter().enumerate() {
        let member = &list.children[at];
        match member.name.as_str() {
            "ReturnTrack" => return Err("A return track stands in no group".into()),
            "GroupTrack" => {
                return Err(
                    "Putting a group in a new group is not carried yet: group its tracks".into(),
                )
            }
            _ => {}
        }
        if k > 0 && at != members[k - 1] + 1 {
            return Err("Group Tracks takes tracks that stand side by side".into());
        }
        if value_of(member, "TrackGroupId").unwrap_or("-1") != parent {
            return Err("The tracks stand in different groups: group them within one".into());
        }
    }
    let id = list
        .children
        .iter()
        .filter_map(|t| t.attr("Id")?.parse::<u64>().ok())
        .max()
        .map_or(0, |id| id + 1)
        .to_string();
    let name = format!("{}-Group", chosen[0] + 1);
    let mut group = group_of(&list.children[members[0]], &id, &name, scenes);
    let set = root
        .find("LiveSet")
        .ok_or("the document holds no LiveSet")?;
    let declared = set
        .child("NextPointeeId")
        .and_then(|n| n.attr("Value"))
        .and_then(|v| v.parse::<u64>().ok());
    let mut next = declared.unwrap_or(0).max(highest_pointee(set) + 1);
    let mut map = std::collections::HashMap::new();
    reallocate(&mut group, &mut next, &mut map);
    let names: Vec<String> = members
        .iter()
        .map(|&at| track_name(&list.children[at]))
        .collect();
    let all = members_mut(root)?;
    for &at in &members {
        let member = &mut all[at];
        match member.child_mut("TrackGroupId") {
            Some(e) => e.set_attr("Value", &id),
            None => {
                let at = member
                    .children
                    .iter()
                    .position(|c| {
                        c.name == "AutomationEnvelopes" || c.name == "Color" || c.name == "Name"
                    })
                    .map_or(member.children.len(), |at| at + 1);
                member
                    .children
                    .insert(at, value_element("TrackGroupId", &id));
            }
        }
        // A member's sound goes to its group (the template's members: template-piano-voices-mastering.xml:7371-7374).
        if let Some(routing) = member
            .child_mut("DeviceChain")
            .and_then(|dc| dc.child_mut("AudioOutputRouting"))
        {
            for (field, value) in [
                ("Target", "AudioOut/GroupTrack"),
                ("UpperDisplayString", "Group"),
                ("LowerDisplayString", ""),
            ] {
                if let Some(e) = routing.child_mut(field) {
                    e.set_attr("Value", value);
                }
            }
        }
    }
    let first = members[0];
    all.insert(
        first,
        std::mem::replace(&mut group, Element::new("GroupTrack")),
    );
    if declared.is_some() {
        if let Some(counter) = root
            .find_mut("LiveSet")
            .and_then(|set| set.child_mut("NextPointeeId"))
        {
            counter.set_attr("Value", &next.to_string());
        }
    }
    Ok(Done {
        words: format!("Grouped {} in {name}.", names.join(", ")),
        at: Some(json!({"track": chosen[0]})),
        places: Places::None,
    })
}

fn clip_split(root: &mut Element, track: usize, clip: ClipAt, at: f64) -> Result<Done, String> {
    if matches!(clip, ClipAt::Slot(_)) {
        return Err("A clip is split in Arrangement view, where it lies on the ruler".into());
    }
    let part = track_at(root, track)?;
    let original = clip_at(part, clip)?.clone();
    let id = track_id(part)?;
    let (start, end) = (
        edit::num(&original, "CurrentStart").ok_or("the clip carries no place in the document")?,
        edit::num(&original, "CurrentEnd").ok_or("the clip carries no place in the document")?,
    );
    if !(at.is_finite() && at > start && at < end) {
        return Err(format!(
            "Split cuts a clip inside it: put the insert marker between beat {} and beat {}",
            number_text(start),
            number_text(end)
        ));
    }
    let named = value_of(&original, "Name")
        .filter(|n| !n.is_empty())
        .unwrap_or("the clip")
        .to_string();
    let tempo = edit::steady_tempo(root);
    let scale = edit::marker_scale(&original, tempo)?;
    let (mut before, mut after) = (original.clone(), original.clone());
    edit::crop(&mut before, start, at, scale)?;
    edit::crop(&mut after, at, end, scale)?;
    let holder = if original.name == "MidiClip" {
        "ClipTimeable"
    } else {
        "Sample"
    };
    let was = lane_ids(part);
    let original_id = original.attr("Id").unwrap_or("").to_string();
    let target = listed_mut(root, track)?;
    edit::lay_over(target, holder, start, end, tempo, vec![before, after])?;
    let now = lane_ids(target);
    let made: Vec<String> = now.iter().filter(|i| !was.contains(i)).cloned().collect();
    let first = made.first().and_then(|m| now.iter().position(|a| a == m));
    Ok(Done {
        words: format!("Split {named} at beat {}.", number_text(at)),
        at: first.map(|j| json!({"track": track, "arrangement": j})),
        places: Places::Lane {
            track: id,
            before: was,
            after: now,
            dropped: Some(original_id.clone()),
            copied: made.into_iter().map(|m| (original_id.clone(), m)).collect(),
        },
    })
}

/// The notes a MIDI clip on the ruler plays between the beats `from` and `to`,
/// in Live's order as the clip player ports it (packages/live-shell/ui/src/
/// live/clipPlayer.ts, "the order"): loop off, from its start marker to its
/// end, once; loop on, from its start marker to the loop's end, then the loop
/// again and again — until the clip's own end on the ruler. Each note keeps
/// its pitch, velocity, chance and switch, placed at its beat on the ruler
/// less `from`, and is cut where the clip ends or the stretch does.
fn played_notes(clip: &Element, from: f64, to: f64) -> Vec<Value> {
    let (Some(start), Some(end)) = (
        edit::num(clip, "CurrentStart"),
        edit::num(clip, "CurrentEnd"),
    ) else {
        return Vec::new();
    };
    let marks = edit::markers(clip);
    let get = |k: &str| marks.get(k).and_then(Value::as_f64).unwrap_or(0.0);
    let (first_from, first_to, looped) = if marks.get("loop") == Some(&json!(true)) {
        (
            get("start"),
            get("position") + get("length"),
            Some((get("position"), get("position") + get("length"))),
        )
    } else {
        (get("start"), get("end"), None)
    };
    let notes = edit::notes_json(clip);
    let (window_from, window_to) = (from.max(start), to.min(end));
    let mut out = Vec::new();
    let mut lay = |pass_from: f64, pass_to: f64, ruler: f64| {
        for note in &notes {
            let t = note["at"].as_f64().unwrap_or(0.0);
            if t < pass_from || t >= pass_to {
                continue;
            }
            let beat = ruler + (t - pass_from);
            if beat < window_from || beat >= window_to {
                continue;
            }
            let len = note["len"].as_f64().unwrap_or(0.0).min(window_to - beat);
            let mut placed = note.clone();
            placed["at"] = json!(beat - from);
            placed["len"] = json!(len);
            if let Value::Object(fields) = &mut placed {
                fields.remove("id");
            }
            out.push(placed);
        }
    };
    let mut ruler = start;
    if first_to > first_from {
        lay(first_from, first_to, ruler);
        ruler += first_to - first_from;
    }
    if let Some((loop_from, loop_to)) = looped {
        let span = loop_to - loop_from;
        while span > 0.0 && ruler < window_to {
            lay(loop_from, loop_to, ruler);
            ruler += span;
        }
    }
    out
}

fn clips_consolidate(root: &mut Element, track: usize, from: f64, to: f64) -> Result<Done, String> {
    if !(from.is_finite() && to.is_finite() && to > from) {
        return Err("Consolidate takes a stretch of the ruler: its end after its start".into());
    }
    if to - from > edit::MADE_LENGTH_MAX {
        return Err(format!(
            "A consolidated clip is at most {} beats long",
            number_text(edit::MADE_LENGTH_MAX)
        ));
    }
    let part = track_at(root, track)?;
    match part.name.as_str() {
        "MidiTrack" => {}
        "AudioTrack" => {
            return Err("Consolidating audio clips writes a new sample of what plays: a render of the part, which nothing here carries".into())
        }
        _ => return Err("Consolidate joins the clips of an audio or MIDI part".into()),
    }
    let lane: Vec<Element> = edit::main_lane(part)
        .into_iter()
        .filter(|clip| clip.name == "MidiClip")
        .filter(|clip| {
            let (s, e) = (
                edit::num(clip, "CurrentStart").unwrap_or(0.0),
                edit::num(clip, "CurrentEnd").unwrap_or(0.0),
            );
            e > from && s < to
        })
        .cloned()
        .collect();
    let Some(first) = lane.first() else {
        return Err(format!(
            "No clip lies between beat {} and beat {} on this part",
            number_text(from),
            number_text(to)
        ));
    };
    let mut notes = Vec::new();
    for clip in &lane {
        // A switched-off clip plays nothing (its `Disabled`), so it gives nothing.
        if edit::flag(clip, "Disabled") == Some(true) {
            continue;
        }
        notes.extend(played_notes(clip, from, to));
    }
    let id = track_id(part)?;
    let colour = value_of(part, "Color").map(str::to_string);
    let reference = root.clone();
    // The first clip's own shape, as a new clip takes it (edit.rs blank_clip); a clip that carries none of a new clip's settings
    // (one made by hand) gives the shape Live's loader took for such a clip (crafted_clip).
    let mut made = edit::blank_clip(&reference, first, colour.as_deref(), to - from)
        .unwrap_or_else(|_| crafted_clip(colour.as_deref(), to - from));
    if let Some(name) = value_of(first, "Name") {
        set_value(&mut made, "Name", name)?;
    }
    edit::apply_notes(&mut made, &notes)?;
    set_value(&mut made, "CurrentStart", &number_text(from))?;
    set_value(&mut made, "CurrentEnd", &number_text(to))?;
    made.set_attr("Time", &number_text(from));
    let tempo = edit::steady_tempo(root);
    let was = lane_ids(part);
    let target = listed_mut(root, track)?;
    edit::lay_over(target, "ClipTimeable", from, to, tempo, vec![made])?;
    let now = lane_ids(target);
    let new = now.iter().position(|i| !was.contains(i));
    Ok(Done {
        words: format!(
            "Consolidated {} clip{} between beat {} and beat {} into one, {} note{}.",
            lane.len(),
            if lane.len() == 1 { "" } else { "s" },
            number_text(from),
            number_text(to),
            notes.len(),
            if notes.len() == 1 { "" } else { "s" }
        ),
        at: new.map(|j| json!({"track": track, "arrangement": j})),
        places: Places::Lane {
            track: id,
            before: was,
            after: now,
            dropped: None,
            copied: Vec::new(),
        },
    })
}

/// Where each kept clip's record row goes after the act: none (gone), one
/// (moved or kept) or two (copied).
fn new_places(places: &Places, track: &str, at: ClipAt) -> Vec<(String, ClipAt)> {
    let same = vec![(track.to_string(), at)];
    match places {
        Places::None => same,
        Places::Rows {
            from,
            by,
            dropped,
            copied,
        } => {
            let ClipAt::Slot(scene) = at else {
                return same;
            };
            if Some(scene) == *dropped {
                return Vec::new();
            }
            let moved = if scene >= *from {
                usize::try_from(scene as i64 + by).ok()
            } else {
                Some(scene)
            };
            let mut out: Vec<(String, ClipAt)> = moved
                .map(|s| (track.to_string(), ClipAt::Slot(s)))
                .into_iter()
                .collect();
            if let Some((only, source, target)) = copied {
                if scene == *source && only.as_deref().is_none_or(|only| only == track) {
                    out.push((track.to_string(), ClipAt::Slot(*target)));
                }
            }
            out
        }
        Places::Clip { from, to, moved } => {
            if (track, at) != (from.0.as_str(), from.1) {
                return same;
            }
            let mut out = if *moved { Vec::new() } else { same };
            out.extend(to.clone());
            out
        }
        Places::Lane {
            track: lane,
            before,
            after,
            dropped,
            copied,
        } => {
            let ClipAt::Arrangement(j) = at else {
                return same;
            };
            if track != lane {
                return same;
            }
            let Some(id) = before.get(j) else {
                return same;
            };
            let mut out: Vec<(String, ClipAt)> = if Some(id) == dropped.as_ref() {
                Vec::new()
            } else {
                after
                    .iter()
                    .position(|a| a == id)
                    .map(|k| (track.to_string(), ClipAt::Arrangement(k)))
                    .into_iter()
                    .collect()
            };
            for (source, made) in copied {
                if source == id {
                    if let Some(k) = after.iter().position(|a| a == made) {
                        out.push((track.to_string(), ClipAt::Arrangement(k)));
                    }
                }
            }
            out
        }
        Places::Track { from, to } => {
            let mut out = same;
            if track == from {
                out.push((to.clone(), at));
            }
            out
        }
    }
}

/// Make one act on the set at `path`, against `expected_revision`; answer
/// `{act, done, at, revision}` (`at`: where it left what it made), with
/// `sourceRefused` when the DLW's record beside the set could not follow.
pub fn act(path: &str, expected_revision: &str, act: &SetAct) -> Result<Value, String> {
    let mut done = None;
    let (_root, revision) = edit::edit(path, expected_revision, |root| {
        done = Some(match act {
            SetAct::ClipPaste {
                from_track,
                from,
                track,
                scene,
                cut,
            } => clip_paste(root, *from_track, *from, *track, *scene, *cut)?,
            SetAct::ClipDuplicate { track, clip } => clip_duplicate(root, *track, *clip)?,
            SetAct::ClipDelete { track, clip } => clip_delete(root, *track, *clip)?,
            SetAct::SlotStopButton { track, scene, on } => {
                slot_stop_button(root, *track, *scene, *on)?
            }
            SetAct::TrackRename { track, name } => track_rename(root, *track, name)?,
            SetAct::TrackMove { track, by } => track_move(root, *track, *by)?,
            SetAct::TrackDuplicate { track } => track_duplicate(root, *track)?,
            SetAct::SceneInsert { after } => scene_insert(root, *after)?,
            SetAct::SceneRename { scene, name } => scene_rename(root, *scene, name)?,
            SetAct::SceneDuplicate { scene } => scene_duplicate(root, *scene)?,
            SetAct::SceneDelete { scene } => scene_delete(root, *scene)?,
            SetAct::TrackColour { track, colour } => track_colour(root, *track, *colour)?,
            SetAct::TracksGroup { tracks } => tracks_group(root, tracks)?,
            SetAct::ClipSplit { track, clip, at } => clip_split(root, *track, *clip, *at)?,
            SetAct::ClipsConsolidate { track, from, to } => {
                clips_consolidate(root, *track, *from, *to)?
            }
        });
        Ok(())
    })?;
    let done = done.ok_or("the act was not made")?;
    let name = serde_json::to_value(act)
        .ok()
        .and_then(|v| v.get("kind").cloned())
        .unwrap_or(Value::Null);
    let mut answer = json!({"act": name, "done": done.words, "at": done.at, "revision": revision});
    if !matches!(done.places, Places::None) {
        let kept = crate::sources::remap(std::path::Path::new(path), |track, at| {
            new_places(&done.places, track, at)
        });
        if let Err(why) = kept {
            answer["sourceRefused"] = json!(format!(
                "The act was made, but the clips' sources beside the set did not follow: {why}"
            ));
        }
    }
    Ok(answer)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::SetDocument;

    /// A set in Live 12's own shape (element names, nesting and list numbering as the template "Piano and voices mastering"
    /// keeps them): Keys (MIDI, a session clip with a clip envelope on its own volume, two arrangement clips), a group holding
    /// Bass (MIDI), Drums (audio, a clip in row 2), a return track, and two rows, the first with a name, colour and tempo.
    const SET: &str = r#"<?xml version="1.0" encoding="UTF-8"?>
<Ableton MajorVersion="5" MinorVersion="12.0_12049">
<LiveSet>
<NextPointeeId Value="2000"/>
<Tracks>
<MidiTrack Id="12">
<Name><EffectiveName Value="Keys"/><UserName Value=""/></Name>
<Color Value="26"/>
<TrackGroupId Value="-1"/>
<AutomationEnvelopes><Envelopes><AutomationEnvelope Id="0"><EnvelopeTarget><PointeeId Value="1501"/></EnvelopeTarget><Automation><Events/></Automation></AutomationEnvelope></Envelopes></AutomationEnvelopes>
<DeviceChain>
<Mixer><Volume><Manual Value="1"/><AutomationTarget Id="1500"><LockEnvelope Value="0"/></AutomationTarget><ModulationTarget Id="1503"><LockEnvelope Value="0"/></ModulationTarget></Volume></Mixer>
<MainSequencer>
<ClipSlotList>
<ClipSlot Id="0"><LomId Value="0"/><ClipSlot><Value><MidiClip Id="0">
<CurrentStart Value="0"/><CurrentEnd Value="4"/>
<Loop><LoopStart Value="0"/><LoopEnd Value="4"/><StartRelative Value="0"/><LoopOn Value="true"/><OutMarker Value="4"/><HiddenLoopStart Value="0"/><HiddenLoopEnd Value="4"/></Loop>
<Name Value="Riff"/><Annotation Value=""/><Color Value="14"/><Disabled Value="false"/>
<Envelopes><Envelopes><ClipEnvelope Id="0"><EnvelopeTarget><PointeeId Value="1500"/></EnvelopeTarget><Automation><Events><FloatEvent Id="0" Time="0" Value="0.5"/></Events></Automation></ClipEnvelope></Envelopes></Envelopes>
<Notes><KeyTracks><KeyTrack Id="0"><Notes><MidiNoteEvent Time="0" Duration="1" Velocity="100" OffVelocity="64" IsEnabled="true" NoteId="1"/></Notes><MidiKey Value="60"/></KeyTrack></KeyTracks><NoteIdGenerator><NextId Value="2"/></NoteIdGenerator></Notes>
</MidiClip></Value></ClipSlot><HasStop Value="true"/><NeedRefreeze Value="true"/></ClipSlot>
<ClipSlot Id="1"><LomId Value="0"/><ClipSlot><Value/></ClipSlot><HasStop Value="true"/><NeedRefreeze Value="true"/></ClipSlot>
</ClipSlotList>
<ClipTimeable><ArrangerAutomation><Events>
<MidiClip Id="0" Time="0"><CurrentStart Value="0"/><CurrentEnd Value="4"/><Loop><LoopStart Value="0"/><LoopEnd Value="4"/><StartRelative Value="0"/><LoopOn Value="false"/><OutMarker Value="4"/><HiddenLoopStart Value="0"/><HiddenLoopEnd Value="4"/></Loop><Name Value="Verse"/><Notes><KeyTracks/></Notes></MidiClip>
<MidiClip Id="1" Time="6"><CurrentStart Value="6"/><CurrentEnd Value="10"/><Loop><LoopStart Value="0"/><LoopEnd Value="4"/><StartRelative Value="0"/><LoopOn Value="false"/><OutMarker Value="4"/><HiddenLoopStart Value="0"/><HiddenLoopEnd Value="4"/></Loop><Name Value="Chorus"/><Notes><KeyTracks/></Notes></MidiClip>
</Events></ArrangerAutomation></ClipTimeable>
</MainSequencer>
<FreezeSequencer><ClipSlotList>
<ClipSlot Id="0"><LomId Value="0"/><ClipSlot><Value/></ClipSlot><HasStop Value="true"/><NeedRefreeze Value="true"/></ClipSlot>
<ClipSlot Id="1"><LomId Value="0"/><ClipSlot><Value/></ClipSlot><HasStop Value="true"/><NeedRefreeze Value="true"/></ClipSlot>
</ClipSlotList></FreezeSequencer>
<DeviceChain><Devices><FilterEQ3 Id="1"><GainLo><Manual Value="1"/><AutomationTarget Id="1501"/><ModulationTarget Id="1502"/></GainLo></FilterEQ3></Devices></DeviceChain>
</DeviceChain>
</MidiTrack>
<GroupTrack Id="17">
<Name><EffectiveName Value="Group"/><UserName Value=""/></Name>
<TrackGroupId Value="-1"/>
<Slots><GroupTrackSlot Id="0"><LomId Value="0"/></GroupTrackSlot><GroupTrackSlot Id="1"><LomId Value="0"/></GroupTrackSlot></Slots>
<DeviceChain><FreezeSequencer><ClipSlotList/></FreezeSequencer></DeviceChain>
</GroupTrack>
<MidiTrack Id="13">
<Name><EffectiveName Value="Bass"/><UserName Value="Bass"/></Name>
<TrackGroupId Value="17"/>
<DeviceChain>
<Mixer><Volume><Manual Value="1"/><AutomationTarget Id="1600"/></Volume></Mixer>
<MainSequencer><ClipSlotList>
<ClipSlot Id="0"><LomId Value="0"/><ClipSlot><Value/></ClipSlot><HasStop Value="true"/><NeedRefreeze Value="true"/></ClipSlot>
<ClipSlot Id="1"><LomId Value="0"/><ClipSlot><Value/></ClipSlot><HasStop Value="true"/><NeedRefreeze Value="true"/></ClipSlot>
</ClipSlotList></MainSequencer>
<FreezeSequencer><ClipSlotList>
<ClipSlot Id="0"><LomId Value="0"/><ClipSlot><Value/></ClipSlot><HasStop Value="true"/><NeedRefreeze Value="true"/></ClipSlot>
<ClipSlot Id="1"><LomId Value="0"/><ClipSlot><Value/></ClipSlot><HasStop Value="true"/><NeedRefreeze Value="true"/></ClipSlot>
</ClipSlotList></FreezeSequencer>
<DeviceChain><Devices/></DeviceChain>
</DeviceChain>
</MidiTrack>
<AudioTrack Id="8">
<Name><EffectiveName Value="Drums"/><UserName Value="Drums"/></Name>
<TrackGroupId Value="-1"/>
<DeviceChain>
<AudioOutputRouting><Target Value="AudioOut/Main"/><UpperDisplayString Value="Main"/><LowerDisplayString Value=""/></AudioOutputRouting>
<Mixer><Volume><Manual Value="1"/><AutomationTarget Id="1700"/></Volume></Mixer>
<MainSequencer><ClipSlotList>
<ClipSlot Id="0"><LomId Value="0"/><ClipSlot><Value/></ClipSlot><HasStop Value="true"/><NeedRefreeze Value="true"/></ClipSlot>
<ClipSlot Id="1"><LomId Value="0"/><ClipSlot><Value><AudioClip Id="0"><CurrentStart Value="0"/><CurrentEnd Value="4"/><Name Value="Break"/></AudioClip></Value></ClipSlot><HasStop Value="true"/><NeedRefreeze Value="true"/></ClipSlot>
</ClipSlotList></MainSequencer>
<DeviceChain><Devices/></DeviceChain>
</DeviceChain>
</AudioTrack>
<ReturnTrack Id="2">
<Name><EffectiveName Value="A-Reverb"/><UserName Value=""/></Name>
<TrackGroupId Value="-1"/>
<DeviceChain><FreezeSequencer><ClipSlotList/></FreezeSequencer><DeviceChain><Devices/></DeviceChain></DeviceChain>
</ReturnTrack>
</Tracks>
<MainTrack><DeviceChain><Mixer><Tempo><Manual Value="120"/></Tempo></Mixer><DeviceChain><Devices/></DeviceChain></DeviceChain></MainTrack>
<Scenes>
<Scene Id="0"><FollowAction><FollowTime Value="4"/><FollowActionEnabled Value="true"/></FollowAction><Name Value="Intro"/><Annotation Value="the opening"/><Color Value="5"/><Tempo Value="96"/><IsTempoEnabled Value="true"/><TimeSignatureId Value="201"/><IsTimeSignatureEnabled Value="false"/><LomId Value="0"/><ClipSlotsListWrapper LomId="0"/></Scene>
<Scene Id="1"><FollowAction><FollowTime Value="4"/><FollowActionEnabled Value="false"/></FollowAction><Name Value=""/><Annotation Value=""/><Color Value="-1"/><Tempo Value="120"/><IsTempoEnabled Value="false"/><TimeSignatureId Value="201"/><IsTimeSignatureEnabled Value="false"/><LomId Value="0"/><ClipSlotsListWrapper LomId="0"/></Scene>
</Scenes>
</LiveSet>
</Ableton>"#;

    /// The starting world's Tide Sketch (packages/live-shell/starting-worlds.py `ableton_set`): parts with no grid in the
    /// document, no MIDI clip anywhere, four rows.
    const TIDE: &str = r#"<?xml version="1.0" encoding="UTF-8"?>
<Ableton MajorVersion="5" MinorVersion="12.0_12025" SchemaChangeCount="3" Creator="Ableton Live 12.0.25"><LiveSet><Tracks><AudioTrack Id="10"><Name><EffectiveName Value="Estuary" /><UserName Value="Estuary" /></Name><DeviceChain><DeviceChain><Devices /></DeviceChain></DeviceChain></AudioTrack><AudioTrack Id="11"><Name><EffectiveName Value="Market hall" /><UserName Value="Market hall" /></Name><DeviceChain><DeviceChain><Devices /></DeviceChain></DeviceChain></AudioTrack><MidiTrack Id="12"><Name><EffectiveName Value="Tide pad" /><UserName Value="Tide pad" /></Name><DeviceChain><DeviceChain><Devices /></DeviceChain></DeviceChain></MidiTrack></Tracks><MainTrack><DeviceChain><Mixer><Tempo><Manual Value="92" /></Tempo></Mixer><DeviceChain><Devices /></DeviceChain></DeviceChain></MainTrack><Scenes><Scene Id="0"><Name Value="" /></Scene><Scene Id="1"><Name Value="" /></Scene><Scene Id="2"><Name Value="" /></Scene><Scene Id="3"><Name Value="" /></Scene></Scenes></LiveSet></Ableton>"#;

    struct SetFile(std::path::PathBuf);
    impl Drop for SetFile {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }
    fn set_file(xml: &str) -> (SetFile, String) {
        use std::sync::atomic::{AtomicUsize, Ordering};
        static NEXT: AtomicUsize = AtomicUsize::new(0);
        let dir = std::env::temp_dir().join(format!(
            "live-set-acts-{}-{}",
            std::process::id(),
            NEXT.fetch_add(1, Ordering::SeqCst)
        ));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("set.als");
        let root = crate::xml::parse(xml).unwrap();
        std::fs::write(&path, crate::write_gz(&root).unwrap()).unwrap();
        (SetFile(dir), path.to_str().unwrap().to_string())
    }
    fn standing(path: &str) -> String {
        crate::edit::revision(&std::fs::read(path).unwrap())
    }
    fn run(path: &str, act: SetAct) -> Result<Value, String> {
        super::act(path, &standing(path), &act)
    }
    fn reread(path: &str) -> (Element, SetDocument) {
        let root = crate::open_als(std::path::Path::new(path)).unwrap();
        let document = SetDocument::of(&root).unwrap();
        (root, document)
    }
    fn slots(document: &SetDocument, track: usize) -> Vec<Option<String>> {
        document.tracks[track].session_slots.clone()
    }
    fn list_ids(list: &Element) -> Vec<String> {
        list.children
            .iter()
            .map(|c| c.attr("Id").unwrap_or("").to_string())
            .collect()
    }
    fn lists(root: &Element) -> Vec<(String, usize, Vec<String>)> {
        let mut out = Vec::new();
        for track in &root
            .find("LiveSet")
            .unwrap()
            .child("Tracks")
            .unwrap()
            .children
        {
            let id = track.attr("Id").unwrap().to_string();
            if let Some(list) = track.child("Slots") {
                out.push((format!("{id}/slots"), list.children.len(), list_ids(list)));
            }
            for (name, path) in [("main", "MainSequencer"), ("freeze", "FreezeSequencer")] {
                if let Some(list) = track
                    .child("DeviceChain")
                    .and_then(|dc| dc.child(path))
                    .and_then(|s| s.child("ClipSlotList"))
                {
                    out.push((format!("{id}/{name}"), list.children.len(), list_ids(list)));
                }
            }
        }
        out
    }

    #[test]
    fn an_act_names_its_kind_on_the_wire_and_refuses_a_moved_set() {
        let wire: SetAct = serde_json::from_value(
            json!({"kind": "clip_paste", "from_track": 0, "from": {"slot": 0}, "track": 1, "scene": 1}),
        )
        .unwrap();
        assert_eq!(
            wire,
            SetAct::ClipPaste {
                from_track: 0,
                from: ClipAt::Slot(0),
                track: 1,
                scene: 1,
                cut: false
            }
        );
        let wire: SetAct =
            serde_json::from_value(json!({"kind": "scene_insert", "after": 0})).unwrap();
        assert_eq!(wire, SetAct::SceneInsert { after: Some(0) });
        assert!(
            serde_json::from_value::<SetAct>(json!({"kind": "track_group", "track": 0})).is_err()
        );
        let (_dir, path) = set_file(SET);
        let refused =
            super::act(&path, "sha256:stale", &SetAct::SceneDelete { scene: 1 }).unwrap_err();
        assert!(refused.contains("changed since it was read"), "{refused}");
    }

    #[test]
    fn paste_copies_a_session_clip_into_an_empty_slot_and_cut_moves_it() {
        let (_dir, path) = set_file(SET);
        // Keys' Riff into Bass's row 2: its envelope on Keys' own volume is left behind (Bass holds no such target).
        let pasted = run(
            &path,
            SetAct::ClipPaste {
                from_track: 0,
                from: ClipAt::Slot(0),
                track: 2,
                scene: 1,
                cut: false,
            },
        )
        .unwrap();
        assert_eq!(pasted["act"], "clip_paste");
        assert_eq!(pasted["at"], json!({"track": 2, "slot": 1}));
        assert!(
            pasted["done"]
                .as_str()
                .unwrap()
                .contains("Pasted Riff into row 2 of Bass"),
            "{pasted}"
        );
        assert!(
            pasted["done"].as_str().unwrap().contains("left behind"),
            "{pasted}"
        );
        let (root, document) = reread(&path);
        assert_eq!(
            slots(&document, 0)[0].as_deref(),
            Some("Riff"),
            "a copy leaves the original"
        );
        assert_eq!(slots(&document, 2)[1].as_deref(), Some("Riff"));
        let copy = crate::edit::clip_at(crate::edit::track_at(&root, 2).unwrap(), ClipAt::Slot(1))
            .unwrap();
        assert!(
            copy.attr("Time").is_none(),
            "a slot's clip carries no arrangement anchor"
        );
        assert_eq!(
            copy.child("Envelopes")
                .unwrap()
                .child("Envelopes")
                .unwrap()
                .children
                .len(),
            0
        );
        // Within its own track the envelope stays; cut moves.
        let moved = run(
            &path,
            SetAct::ClipPaste {
                from_track: 0,
                from: ClipAt::Slot(0),
                track: 0,
                scene: 1,
                cut: true,
            },
        )
        .unwrap();
        assert!(moved["done"].as_str().unwrap().starts_with("Moved Riff"));
        let (root, document) = reread(&path);
        assert_eq!(slots(&document, 0), vec![None, Some("Riff".into())]);
        let kept = crate::edit::clip_at(crate::edit::track_at(&root, 0).unwrap(), ClipAt::Slot(1))
            .unwrap();
        assert_eq!(
            kept.child("Envelopes")
                .unwrap()
                .child("Envelopes")
                .unwrap()
                .children
                .len(),
            1
        );
        // Refusals, in words, writing nothing.
        let before = standing(&path);
        for (act, words) in [
            (
                SetAct::ClipPaste {
                    from_track: 0,
                    from: ClipAt::Slot(1),
                    track: 3,
                    scene: 0,
                    cut: false,
                },
                "MIDI clip is pasted onto a MIDI part",
            ),
            (
                SetAct::ClipPaste {
                    from_track: 0,
                    from: ClipAt::Slot(1),
                    track: 2,
                    scene: 1,
                    cut: false,
                },
                "already holds a clip",
            ),
            (
                SetAct::ClipPaste {
                    from_track: 0,
                    from: ClipAt::Slot(0),
                    track: 2,
                    scene: 0,
                    cut: false,
                },
                "holds no clip",
            ),
            (
                SetAct::ClipPaste {
                    from_track: 0,
                    from: ClipAt::Arrangement(0),
                    track: 2,
                    scene: 0,
                    cut: false,
                },
                "copied from a slot",
            ),
            (
                SetAct::ClipPaste {
                    from_track: 0,
                    from: ClipAt::Slot(1),
                    track: 4,
                    scene: 0,
                    cut: false,
                },
                "audio or MIDI part",
            ),
        ] {
            let refused = run(&path, act).unwrap_err();
            assert!(refused.contains(words), "{refused}");
        }
        assert_eq!(standing(&path), before, "a refusal writes nothing");
    }

    #[test]
    fn insert_paste_and_the_stop_button_work_on_a_set_whose_parts_keep_no_grid() {
        let (_dir, path) = set_file(TIDE);
        // Insert clip: an empty one-bar MIDI clip in Tide pad's row 1, in the shape Live's loader took for a clip made by hand.
        let made =
            crate::edit::clip_create(&path, &standing(&path), 2, Some(0), 4.0, None, &[], None)
                .unwrap();
        assert_eq!(made["at"], json!({"slot": 0}));
        assert_eq!(made["clip"]["notes"], json!([]));
        assert_eq!(made["clip"]["loop"], true);
        assert_eq!(made["clip"]["length"], 4.0);
        let (root, document) = reread(&path);
        assert_eq!(
            slots(&document, 2),
            vec![Some(String::new()), None, None, None],
            "the grid stands, one slot per row"
        );
        assert_eq!(
            lists(&root),
            vec![(
                "12/main".to_string(),
                4,
                vec!["0".into(), "1".into(), "2".into(), "3".into()]
            )]
        );
        // An audio part takes no MIDI clip.
        let refused =
            crate::edit::clip_create(&path, &standing(&path), 0, Some(0), 4.0, None, &[], None)
                .unwrap_err();
        assert!(refused.contains("MIDI part"), "{refused}");
        // Paste it into row 3.
        run(
            &path,
            SetAct::ClipPaste {
                from_track: 2,
                from: ClipAt::Slot(0),
                track: 2,
                scene: 2,
                cut: false,
            },
        )
        .unwrap();
        let (_, document) = reread(&path);
        assert_eq!(
            slots(&document, 2),
            vec![Some(String::new()), None, Some(String::new()), None]
        );
        // Remove Estuary's stop button in row 2, read it back, and give it back.
        let removed = run(
            &path,
            SetAct::SlotStopButton {
                track: 0,
                scene: 1,
                on: false,
            },
        )
        .unwrap();
        assert!(removed["done"]
            .as_str()
            .unwrap()
            .contains("Removed the stop button in row 2 of Estuary"));
        let (root, _) = reread(&path);
        assert_eq!(
            crate::edit::stopless_slots(crate::edit::track_at(&root, 0).unwrap()),
            vec![1]
        );
        let extra = crate::edit::tracks_extra_json(&root);
        assert_eq!(extra[0]["stoplessSlots"], json!([1]));
        assert_eq!(extra[1]["stoplessSlots"], json!([]));
        run(
            &path,
            SetAct::SlotStopButton {
                track: 0,
                scene: 1,
                on: true,
            },
        )
        .unwrap();
        let (root, _) = reread(&path);
        assert!(crate::edit::stopless_slots(crate::edit::track_at(&root, 0).unwrap()).is_empty());
        let refused = run(
            &path,
            SetAct::SlotStopButton {
                track: 2,
                scene: 0,
                on: false,
            },
        )
        .unwrap_err();
        assert!(refused.contains("holds a clip"), "{refused}");
    }

    #[test]
    fn duplicate_puts_a_session_copy_below_or_a_new_row_for_it_and_lays_an_arrangement_copy_after_it(
    ) {
        let (_dir, path) = set_file(SET);
        // Row 2 of Keys is free: the copy stands there.
        let below = run(
            &path,
            SetAct::ClipDuplicate {
                track: 0,
                clip: ClipAt::Slot(0),
            },
        )
        .unwrap();
        assert_eq!(below["at"], json!({"track": 0, "slot": 1}));
        let (_, document) = reread(&path);
        assert_eq!(
            slots(&document, 0),
            vec![Some("Riff".into()), Some("Riff".into())]
        );
        assert_eq!(document.scene_count, 2);
        // Now held: a row is inserted below for the copy, in every list.
        let inserted = run(
            &path,
            SetAct::ClipDuplicate {
                track: 0,
                clip: ClipAt::Slot(0),
            },
        )
        .unwrap();
        assert!(
            inserted["done"].as_str().unwrap().contains("new row 2"),
            "{inserted}"
        );
        let (root, document) = reread(&path);
        assert_eq!(document.scene_count, 3);
        assert_eq!(
            slots(&document, 0),
            vec![
                Some("Riff".into()),
                Some("Riff".into()),
                Some("Riff".into())
            ]
        );
        assert_eq!(
            slots(&document, 3),
            vec![None, None, Some("Break".into())],
            "Drums' clip moved down with its row"
        );
        for (list, len, ids) in lists(&root) {
            if list.starts_with("17/") && list.ends_with("freeze") || list.starts_with("2/") {
                assert_eq!(
                    len, 0,
                    "{list}: a group's and a return's freeze lists stay empty"
                );
            } else {
                assert_eq!(
                    (len, ids),
                    (3, vec!["0".to_string(), "1".into(), "2".into()]),
                    "{list}"
                );
            }
        }
        // The arrangement: Verse (0–4) copied to 4–8, cutting Chorus (6–10) to 8–10.
        let laid = run(
            &path,
            SetAct::ClipDuplicate {
                track: 0,
                clip: ClipAt::Arrangement(0),
            },
        )
        .unwrap();
        assert_eq!(laid["at"], json!({"track": 0, "arrangement": 1}));
        let (_, document) = reread(&path);
        let lane: Vec<(String, f64, f64)> = document.tracks[0]
            .arrangement_clips
            .iter()
            .map(|c| (c.name.clone(), c.start, c.end))
            .collect();
        assert_eq!(
            lane,
            vec![
                ("Verse".into(), 0.0, 4.0),
                ("Verse".into(), 4.0, 8.0),
                ("Chorus".into(), 8.0, 10.0)
            ]
        );
    }

    #[test]
    fn delete_takes_a_clip_out_of_its_slot_or_off_the_ruler() {
        let (_dir, path) = set_file(SET);
        let gone = run(
            &path,
            SetAct::ClipDelete {
                track: 3,
                clip: ClipAt::Slot(1),
            },
        )
        .unwrap();
        assert_eq!(gone["done"], "Deleted Break from row 2.");
        let (_, document) = reread(&path);
        assert_eq!(slots(&document, 3), vec![None, None]);
        run(
            &path,
            SetAct::ClipDelete {
                track: 0,
                clip: ClipAt::Arrangement(0),
            },
        )
        .unwrap();
        let (_, document) = reread(&path);
        assert_eq!(document.tracks[0].arrangement_clips.len(), 1);
        assert_eq!(document.tracks[0].arrangement_clips[0].name, "Chorus");
        let refused = run(
            &path,
            SetAct::ClipDelete {
                track: 3,
                clip: ClipAt::Slot(1),
            },
        )
        .unwrap_err();
        assert!(refused.contains("holds no clip"), "{refused}");
    }

    #[test]
    fn a_track_is_renamed_moved_within_its_group_and_duplicated_with_fresh_pointees() {
        let (_dir, path) = set_file(SET);
        let renamed = run(
            &path,
            SetAct::TrackRename {
                track: 0,
                name: "Rhodes".into(),
            },
        )
        .unwrap();
        assert_eq!(renamed["done"], "Renamed Keys to Rhodes.");
        let (root, document) = reread(&path);
        assert_eq!(document.tracks[0].name, "Rhodes");
        let name = crate::edit::track_at(&root, 0)
            .unwrap()
            .child("Name")
            .unwrap();
        assert_eq!(value_of(name, "UserName"), Some("Rhodes"));
        for (act, words) in [
            (
                SetAct::TrackRename {
                    track: 0,
                    name: "  ".into(),
                },
                "1 to 256 characters",
            ),
            (
                SetAct::TrackRename {
                    track: 5,
                    name: "Main".into(),
                },
                "Main track",
            ),
            (
                SetAct::TrackMove { track: 0, by: -1 },
                "already the first track",
            ),
            (
                SetAct::TrackMove { track: 2, by: 1 },
                "into or out of a group",
            ),
            (SetAct::TrackMove { track: 0, by: 1 }, "group"),
            (SetAct::TrackMove { track: 1, by: -1 }, "group"),
            (SetAct::TrackMove { track: 3, by: 1 }, "return track"),
            (SetAct::TrackMove { track: 0, by: 2 }, "one place"),
            (SetAct::TrackDuplicate { track: 4 }, "return track"),
            (SetAct::TrackDuplicate { track: 1 }, "group"),
        ] {
            let refused = run(&path, act).unwrap_err();
            assert!(refused.contains(words), "{refused}");
        }
        // Drums moves left past nothing of a group? Bass sits in the group, Drums does not: refused; the group's own order holds.
        assert!(run(&path, SetAct::TrackMove { track: 3, by: -1 })
            .unwrap_err()
            .contains("group"));
        // Duplicate Keys: a copy right after it, a new track Id, every pointee fresh and its envelopes following them.
        let copied = run(&path, SetAct::TrackDuplicate { track: 0 }).unwrap();
        assert_eq!(copied["at"], json!({"track": 1}));
        let (root, document) = reread(&path);
        let names: Vec<&str> = document.tracks.iter().map(|t| t.name.as_str()).collect();
        assert_eq!(
            names,
            vec!["Rhodes", "Rhodes", "Group", "Bass", "Drums", "A-Reverb", "Master"]
        );
        assert_eq!(
            slots(&document, 1)[0].as_deref(),
            Some("Riff"),
            "the copy holds the track's clips"
        );
        let copy = crate::edit::track_at(&root, 1).unwrap();
        assert_eq!(copy.attr("Id"), Some("18"));
        let mut ids = Vec::new();
        fn gather(e: &Element, out: &mut Vec<String>) {
            if is_pointee(e) {
                out.push(e.attr("Id").unwrap().to_string());
            }
            for c in &e.children {
                gather(c, out);
            }
        }
        gather(copy, &mut ids);
        assert_eq!(
            ids,
            vec!["2000", "2001", "2002", "2003"],
            "allocated from NextPointeeId in document order"
        );
        let counter = root
            .find("LiveSet")
            .unwrap()
            .child("NextPointeeId")
            .unwrap();
        assert_eq!(counter.attr("Value"), Some("2004"));
        let track_env = copy
            .child("AutomationEnvelopes")
            .unwrap()
            .find("PointeeId")
            .unwrap();
        assert_eq!(
            track_env.attr("Value"),
            Some("2002"),
            "the track's envelope names the copy's own EQ gain"
        );
        let clip = crate::edit::clip_at(copy, ClipAt::Slot(0)).unwrap();
        assert_eq!(
            clip.find("PointeeId").unwrap().attr("Value"),
            Some("2000"),
            "the clip's envelope names the copy's own volume"
        );
        // Move the copy right, onto the original's place, and back: a plain swap.
        run(
            &path,
            SetAct::TrackRename {
                track: 1,
                name: "Rhodes 2".into(),
            },
        )
        .unwrap();
        run(&path, SetAct::TrackMove { track: 1, by: -1 }).unwrap();
        let (_, document) = reread(&path);
        assert_eq!(document.tracks[0].name, "Rhodes 2");
        assert_eq!(document.tracks[1].name, "Rhodes");
    }

    #[test]
    fn rows_are_inserted_renamed_duplicated_and_deleted_with_every_tracks_slots() {
        let (_dir, path) = set_file(SET);
        let inserted = run(&path, SetAct::SceneInsert { after: Some(0) }).unwrap();
        assert_eq!(inserted["done"], "Inserted an empty row 2.");
        let (root, document) = reread(&path);
        assert_eq!(document.scene_count, 3);
        assert_eq!(slots(&document, 3), vec![None, None, Some("Break".into())]);
        let fresh = &root.find("Scenes").unwrap().children[1];
        assert_eq!(fresh.attr("Id"), Some("1"));
        for (name, value) in [
            ("Name", ""),
            ("Annotation", ""),
            ("Color", "-1"),
            ("IsTempoEnabled", "false"),
        ] {
            assert_eq!(
                value_of(fresh, name),
                Some(value),
                "{name}: a new row keeps nothing of its own"
            );
        }
        assert_eq!(
            value_of(fresh.child("FollowAction").unwrap(), "FollowActionEnabled"),
            Some("false")
        );
        let renamed = run(
            &path,
            SetAct::SceneRename {
                scene: 1,
                name: "Bridge".into(),
            },
        )
        .unwrap();
        assert_eq!(renamed["done"], "Renamed row 2 to Bridge.");
        let reading = crate::api::set_json(&path).unwrap();
        assert_eq!(
            reading["document"]["sceneNames"],
            json!(["Intro", "Bridge", ""]),
            "the set's reading names each row"
        );
        run(
            &path,
            SetAct::SceneRename {
                scene: 1,
                name: String::new(),
            },
        )
        .unwrap();
        run(
            &path,
            SetAct::SceneRename {
                scene: 1,
                name: "Bridge".into(),
            },
        )
        .unwrap();
        let duplicated = run(&path, SetAct::SceneDuplicate { scene: 2 }).unwrap();
        assert_eq!(duplicated["at"], json!({"scene": 3}));
        let (root, document) = reread(&path);
        assert_eq!(document.scene_count, 4);
        assert_eq!(
            slots(&document, 3),
            vec![None, None, Some("Break".into()), Some("Break".into())]
        );
        let freeze = lists(&root)
            .into_iter()
            .find(|(l, _, _)| l == "12/freeze")
            .unwrap();
        assert_eq!(freeze.1, 4);
        let deleted = run(&path, SetAct::SceneDelete { scene: 0 }).unwrap();
        assert_eq!(deleted["done"], "Deleted row Intro and every clip in it.");
        let (root, document) = reread(&path);
        assert_eq!(document.scene_count, 3);
        assert_eq!(
            slots(&document, 0),
            vec![None, None, None],
            "Riff went with its row"
        );
        for (list, len, ids) in lists(&root) {
            if !(list.starts_with("17/") && list.ends_with("freeze") || list.starts_with("2/")) {
                assert_eq!(
                    (len, ids),
                    (3, vec!["0".to_string(), "1".into(), "2".into()]),
                    "{list}"
                );
            }
        }
        for _ in 0..2 {
            run(&path, SetAct::SceneDelete { scene: 0 }).unwrap();
        }
        let refused = run(&path, SetAct::SceneDelete { scene: 0 }).unwrap_err();
        assert!(refused.contains("at least one row"), "{refused}");
        let refused = run(
            &path,
            SetAct::SceneRename {
                scene: 0,
                name: "a\u{7}".into(),
            },
        )
        .unwrap_err();
        assert!(refused.contains("256 characters"), "{refused}");
    }

    #[test]
    fn the_clips_sources_beside_the_set_follow_their_clips() {
        let (_dir, path) = set_file(SET);
        let set = std::path::Path::new(&path);
        crate::sources::set_source(set, "12", ClipAt::Slot(0), Some("wiki:anchor:riff")).unwrap();
        crate::sources::set_source(
            set,
            "12",
            ClipAt::Arrangement(1),
            Some("wiki:anchor:chorus"),
        )
        .unwrap();
        // A row inserted above: Riff's row moves down, its source with it.
        run(&path, SetAct::SceneInsert { after: None }).unwrap();
        assert_eq!(
            crate::sources::source_of(set, "12", ClipAt::Slot(1))
                .unwrap()
                .as_deref(),
            Some("wiki:anchor:riff")
        );
        assert_eq!(
            crate::sources::source_of(set, "12", ClipAt::Slot(0)).unwrap(),
            None
        );
        // Pasted onto Bass: the copy keeps it; the track copy keeps it under its new Id.
        run(
            &path,
            SetAct::ClipPaste {
                from_track: 0,
                from: ClipAt::Slot(1),
                track: 2,
                scene: 0,
                cut: false,
            },
        )
        .unwrap();
        assert_eq!(
            crate::sources::source_of(set, "13", ClipAt::Slot(0))
                .unwrap()
                .as_deref(),
            Some("wiki:anchor:riff")
        );
        run(&path, SetAct::TrackDuplicate { track: 0 }).unwrap();
        assert_eq!(
            crate::sources::source_of(set, "18", ClipAt::Slot(1))
                .unwrap()
                .as_deref(),
            Some("wiki:anchor:riff")
        );
        // The arrangement: deleting Verse moves Chorus to index 0, its source with it.
        run(
            &path,
            SetAct::ClipDelete {
                track: 0,
                clip: ClipAt::Arrangement(0),
            },
        )
        .unwrap();
        assert_eq!(
            crate::sources::source_of(set, "12", ClipAt::Arrangement(0))
                .unwrap()
                .as_deref(),
            Some("wiki:anchor:chorus")
        );
        // Deleted with its row: gone.
        run(&path, SetAct::SceneDelete { scene: 1 }).unwrap();
        assert_eq!(
            crate::sources::source_of(set, "12", ClipAt::Slot(1)).unwrap(),
            None
        );
        assert_eq!(
            crate::sources::source_of(set, "12", ClipAt::Slot(0)).unwrap(),
            None
        );
    }

    /// A MIDI part whose arrangement holds a looped clip (0–4, its loop 0–2) and an unlooped one (4–8, its markers 1–5), each with notes.
    const LANE: &str = r#"<?xml version="1.0" encoding="UTF-8"?>
<Ableton MajorVersion="5" MinorVersion="12.0_12049"><LiveSet><Tracks>
<MidiTrack Id="12"><Name><EffectiveName Value="Keys"/><UserName Value=""/></Name><Color Value="26"/><TrackGroupId Value="-1"/>
<DeviceChain><MainSequencer><ClipSlotList/><ClipTimeable><ArrangerAutomation><Events>
<MidiClip Id="0" Time="0"><CurrentStart Value="0"/><CurrentEnd Value="4"/><Loop><LoopStart Value="0"/><LoopEnd Value="2"/><StartRelative Value="0"/><LoopOn Value="true"/><OutMarker Value="2"/><HiddenLoopStart Value="0"/><HiddenLoopEnd Value="2"/></Loop><Name Value="Pulse"/><Annotation Value=""/><Color Value="3"/><Disabled Value="false"/><Envelopes><Envelopes/></Envelopes>
<Notes><KeyTracks><KeyTrack Id="0"><Notes><MidiNoteEvent Time="0" Duration="0.5" Velocity="100" OffVelocity="64" IsEnabled="true" NoteId="1"/></Notes><MidiKey Value="60"/></KeyTrack></KeyTracks><NoteIdGenerator><NextId Value="2"/></NoteIdGenerator></Notes></MidiClip>
<MidiClip Id="1" Time="4"><CurrentStart Value="4"/><CurrentEnd Value="8"/><Loop><LoopStart Value="1"/><LoopEnd Value="5"/><StartRelative Value="0"/><LoopOn Value="false"/><OutMarker Value="5"/><HiddenLoopStart Value="1"/><HiddenLoopEnd Value="5"/></Loop><Name Value="Answer"/><Annotation Value=""/><Color Value="4"/><Disabled Value="false"/><Envelopes><Envelopes/></Envelopes>
<Notes><KeyTracks><KeyTrack Id="0"><Notes><MidiNoteEvent Time="1" Duration="1" Velocity="90" OffVelocity="64" IsEnabled="true" NoteId="1"/><MidiNoteEvent Time="4.5" Duration="1" Velocity="80" OffVelocity="64" IsEnabled="true" NoteId="2"/></Notes><MidiKey Value="64"/></KeyTrack></KeyTracks><NoteIdGenerator><NextId Value="3"/></NoteIdGenerator></Notes></MidiClip>
</Events></ArrangerAutomation></ClipTimeable></MainSequencer><DeviceChain><Devices/></DeviceChain></DeviceChain></MidiTrack>
</Tracks><MainTrack><DeviceChain><Mixer><Tempo><Manual Value="120"/></Tempo></Mixer></DeviceChain></MainTrack><Scenes><Scene Id="0"><Name Value=""/></Scene></Scenes></LiveSet></Ableton>"#;

    fn lane_of(path: &str) -> Vec<(String, f64, f64)> {
        let (_, document) = reread(path);
        document.tracks[0]
            .arrangement_clips
            .iter()
            .map(|c| (c.name.clone(), c.start, c.end))
            .collect()
    }

    #[test]
    fn groups_are_listed_in_the_sets_order_with_their_members_ids() {
        let (_dir, path) = set_file(SET);
        let (root, document) = reread(&path);
        let kinds: Vec<(&str, crate::model::TrackKind)> = document
            .tracks
            .iter()
            .map(|t| (t.name.as_str(), t.kind))
            .collect();
        use crate::model::TrackKind::*;
        assert_eq!(
            kinds,
            vec![
                ("Keys", Midi),
                ("Group", Group),
                ("Bass", Midi),
                ("Drums", Audio),
                ("A-Reverb", Return),
                ("Master", Master)
            ]
        );
        let extra = crate::edit::tracks_extra_json(&root);
        assert_eq!(
            (extra[1]["trackId"].clone(), extra[1]["groupId"].clone()),
            (json!("17"), json!(-1))
        );
        assert_eq!(
            (extra[2]["trackId"].clone(), extra[2]["groupId"].clone()),
            (json!("13"), json!(17))
        );
        assert_eq!(extra[0]["colourIndex"], json!(26.0));
        assert_eq!(
            crate::api::set_json(&path).unwrap()["summary"]["tracks"][1]["kind"],
            "group"
        );
    }

    #[test]
    fn a_track_takes_one_of_lives_seventy_colours() {
        let (_dir, path) = set_file(TIDE);
        let coloured = run(
            &path,
            SetAct::TrackColour {
                track: 0,
                colour: 9,
            },
        )
        .unwrap();
        assert_eq!(coloured["done"], "Coloured Estuary.");
        let (root, _) = reread(&path);
        assert_eq!(
            crate::edit::tracks_extra_json(&root)[0]["colourIndex"],
            json!(9.0),
            "made where the track carried none"
        );
        assert!(run(
            &path,
            SetAct::TrackColour {
                track: 0,
                colour: 70
            }
        )
        .unwrap_err()
        .contains("Live's 70"));
    }

    #[test]
    fn group_tracks_puts_side_by_side_tracks_in_a_new_group_in_lives_shape() {
        let (_dir, path) = set_file(SET);
        for (tracks, words) in [
            (vec![4], "return track"),
            (vec![1], "group in a new group"),
            (vec![0, 3], "side by side"),
            (vec![2, 3], "different groups"),
            (vec![], "one track or more"),
        ] {
            let refused = run(&path, SetAct::TracksGroup { tracks }).unwrap_err();
            assert!(refused.contains(words), "{refused}");
        }
        let grouped = run(&path, SetAct::TracksGroup { tracks: vec![3] }).unwrap();
        assert_eq!(grouped["done"], "Grouped Drums in 4-Group.");
        let (root, document) = reread(&path);
        let names: Vec<&str> = document.tracks.iter().map(|t| t.name.as_str()).collect();
        assert_eq!(
            names,
            vec!["Keys", "Group", "Bass", "4-Group", "Drums", "A-Reverb", "Master"]
        );
        let group = crate::edit::track_at(&root, 3).unwrap();
        assert_eq!(
            (group.name.as_str(), group.attr("Id")),
            ("GroupTrack", Some("18"))
        );
        let order: Vec<&str> = group.children.iter().map(|c| c.name.as_str()).collect();
        assert!(
            order.iter().all(|c| GROUP_CHILDREN.contains(c)),
            "only a group's own children: {order:?}"
        );
        assert_eq!(value_of(group, "TrackUnfolded"), Some("true"));
        assert_eq!(
            group.child("Slots").unwrap().children.len(),
            2,
            "one GroupTrackSlot per row"
        );
        assert!(group
            .child("DeviceChain")
            .unwrap()
            .child("MainSequencer")
            .is_none());
        assert_eq!(
            group.find("AutomationTarget").unwrap().attr("Id"),
            Some("2000"),
            "its own pointees, allocated from NextPointeeId"
        );
        let drums = crate::edit::track_at(&root, 4).unwrap();
        assert_eq!(value_of(drums, "TrackGroupId"), Some("18"));
        let out = drums
            .child("DeviceChain")
            .unwrap()
            .child("AudioOutputRouting")
            .unwrap();
        assert_eq!(
            (value_of(out, "Target"), value_of(out, "UpperDisplayString")),
            (Some("AudioOut/GroupTrack"), Some("Group"))
        );
        assert_eq!(
            crate::edit::tracks_extra_json(&root)[4]["groupId"],
            json!(18)
        );
    }

    #[test]
    fn split_cuts_an_arrangement_clip_at_the_marker() {
        let (_dir, path) = set_file(SET);
        for (act, words) in [
            (
                SetAct::ClipSplit {
                    track: 0,
                    clip: ClipAt::Slot(0),
                    at: 1.0,
                },
                "Arrangement view",
            ),
            (
                SetAct::ClipSplit {
                    track: 0,
                    clip: ClipAt::Arrangement(0),
                    at: 4.0,
                },
                "inside it",
            ),
        ] {
            let refused = run(&path, act).unwrap_err();
            assert!(refused.contains(words), "{refused}");
        }
        let split = run(
            &path,
            SetAct::ClipSplit {
                track: 0,
                clip: ClipAt::Arrangement(0),
                at: 1.0,
            },
        )
        .unwrap();
        assert_eq!(split["done"], "Split Verse at beat 1.");
        let (root, document) = reread(&path);
        let lane: Vec<(String, f64, f64)> = document.tracks[0]
            .arrangement_clips
            .iter()
            .map(|c| (c.name.clone(), c.start, c.end))
            .collect();
        assert_eq!(
            lane,
            vec![
                ("Verse".into(), 0.0, 1.0),
                ("Verse".into(), 1.0, 4.0),
                ("Chorus".into(), 6.0, 10.0)
            ]
        );
        let second = crate::edit::clip_at(
            crate::edit::track_at(&root, 0).unwrap(),
            ClipAt::Arrangement(1),
        )
        .unwrap();
        let lp = second.child("Loop").unwrap();
        assert_eq!(
            (value_of(lp, "LoopStart"), value_of(lp, "LoopEnd")),
            (Some("1"), Some("4")),
            "its material stays where it stood"
        );
        assert_eq!(second.attr("Time"), Some("1"));
    }

    #[test]
    fn consolidate_makes_one_clip_of_what_a_midi_part_plays_in_the_stretch() {
        let (_dir, path) = set_file(LANE);
        let made = run(
            &path,
            SetAct::ClipsConsolidate {
                track: 0,
                from: 1.0,
                to: 7.0,
            },
        )
        .unwrap();
        assert_eq!(
            made["done"],
            "Consolidated 2 clips between beat 1 and beat 7 into one, 2 notes."
        );
        assert_eq!(made["at"], json!({"track": 0, "arrangement": 1}));
        assert_eq!(
            lane_of(&path),
            vec![
                ("Pulse".into(), 0.0, 1.0),
                ("Pulse".into(), 1.0, 7.0),
                ("Answer".into(), 7.0, 8.0)
            ],
            "the clips under the stretch give way to it, as the comp lays a take"
        );
        // Pulse loops 0–2 from beat 0: its note sounds at 0 and 2; Answer plays its markers 1–5 from beat 4: its notes at 4 and 7.5.
        let reading = crate::edit::clip_json(&path, 0, ClipAt::Arrangement(1)).unwrap();
        let notes: Vec<(i64, f64, f64)> = reading["clip"]["notes"]
            .as_array()
            .unwrap()
            .iter()
            .map(|n| {
                (
                    n["p"].as_i64().unwrap(),
                    n["at"].as_f64().unwrap(),
                    n["len"].as_f64().unwrap(),
                )
            })
            .collect();
        assert_eq!(notes, vec![(60, 1.0, 0.5), (64, 3.0, 1.0)]);
        for (act, words) in [
            (
                SetAct::ClipsConsolidate {
                    track: 0,
                    from: 20.0,
                    to: 24.0,
                },
                "No clip lies",
            ),
            (
                SetAct::ClipsConsolidate {
                    track: 0,
                    from: 4.0,
                    to: 4.0,
                },
                "end after its start",
            ),
        ] {
            let refused = run(&path, act).unwrap_err();
            assert!(refused.contains(words), "{refused}");
        }
        let (_audio_dir, audio) = set_file(SET);
        let refused = run(
            &audio,
            SetAct::ClipsConsolidate {
                track: 3,
                from: 0.0,
                to: 4.0,
            },
        )
        .unwrap_err();
        assert!(
            refused.contains("render"),
            "an audio part's consolidate waits for a render: {refused}"
        );
    }
}
