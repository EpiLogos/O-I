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
    /// Insert MIDI Track (⌘⇧T): an empty MIDI part right after track `after`
    /// (after the last part, before the returns, with none), in a group where
    /// it stands after one of the group's members.
    TrackInsert {
        #[serde(default)]
        after: Option<usize>,
    },
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
    /// The transport's Quantize (O-I #849 round 22, DLW build ruling 2026-11-05: "the transport sets the set's global
    /// quantization through live-set's own act"): `LiveSet/GlobalQuantisation`, the launch quantize of every clip set to Global,
    /// one of Live's words for it (`edit::QUANTIZE` after its Global: none, the bars, the note values).
    GlobalQuantize { quantize: String },
    /// Crop (⇧⌘J; Live's Crop Clip, the Live Object Model's `Clip.crop`, lom/LOM-INVENTORY.md): the clip keeps only its loop,
    /// or its start to its end where it does not loop — and, in Arrangement view with a stretch of the ruler selected over it
    /// (`from`–`to`, in beats), only that stretch first (DLW build ruling 2026-11-05: "the clip keeps only its loop or
    /// selection"). An audio clip keeps it as a new sample beside the set ([`crop_audio`]).
    ClipCrop {
        track: usize,
        clip: ClipAt,
        #[serde(default)]
        from: Option<f64>,
        #[serde(default)]
        to: Option<f64>,
    },
    /// A recorded pass (O-I #855; DLW §21.1 "Record a part and each pass lies
    /// as a take lane under its track"): the notes played (`{p, at, len,
    /// vel}`, each `at` a beat of the take's own time) made one MIDI clip of
    /// `length` beats from the ruler's beat `start`, in a new take lane of the
    /// part and laid in its main lane there, both carrying the set's next
    /// `TakeId`. What the take keeps beyond its notes (`keeps`, the shell's
    /// own: live/liveTake.ts) stands beside the set by that `TakeId`. With
    /// `scene`, the pass was recorded into that row's empty slot of an armed
    /// part (O-I #743; Live: "an armed track's empty slots are record
    /// buttons"): the clip stands in the slot, in the shape Insert MIDI Clip
    /// lays there (`edit::clip_create`), with no take lane — a take lane is
    /// the Arrangement's (session-model.md §7: session clips live in
    /// `MainSequencer/ClipSlotList`) — and carries the next `TakeId` (a clip
    /// field, session-model.md §5) so what it keeps stands by it as any
    /// take's; `start` is then the clip's own beat 0.
    TakeRecord {
        track: usize,
        start: f64,
        length: f64,
        name: String,
        notes: Vec<Value>,
        #[serde(default)]
        keeps: Option<Value>,
        #[serde(default)]
        scene: Option<usize>,
    },
    /// The part's Torus as it stands, kept beside the set (none: it keeps
    /// none). Live's document has no place for it, so the `.als` is not
    /// written and the set's revision stands.
    TorusKeep { track: usize, torus: Option<Value> },
    /// A kept rack placed on a MIDI part with nothing on its chain (O-I #852; DLW §21.2 "Drag it onto a part to play it"): Live's
    /// Instrument Rack under the rack's name, its one chain, its macros by name and where each stands (0 to 1, as the rack keeps
    /// it), and its variations, each a value for every macro. What a macro turns is not written: Live 12 keeps a macro's mapping in
    /// a form no document here holds (racks-session-model.md §1.7), so the macros stand mapped to nothing. Its chain's devices
    /// stand on the rack's one chain as Live's own (O-I #852 round 10), each with the settings carried onto it.
    RackPlace {
        track: usize,
        name: String,
        macros: Vec<PlacedMacro>,
        variations: Vec<PlacedVariation>,
        chain: Vec<PlacedDevice>,
    },
}

/// One macro of a placed rack: its name, and where it stands, 0 to 1.
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct PlacedMacro {
    pub name: String,
    pub value: f64,
}

/// One variation of a placed rack: its name, and a value for every macro, in macro order.
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct PlacedVariation {
    pub name: String,
    pub values: Vec<f64>,
}

/// One device of a placed rack's chain: Live's device by the class a set stores it under (the keys of live-dynamics
/// `params::table`), and the settings carried onto it.
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct PlacedDevice {
    pub device: String,
    pub parameters: Vec<PlacedParameter>,
}

/// One setting carried onto a placed device: its document key, and its stored value (a switch 0 for off, 1 for on).
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct PlacedParameter {
    pub id: String,
    pub value: f64,
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

/// Live's own mixer for a new part: 0 dB, centre, on, and every send off (the
/// template's `Send` `Manual`, -70 dB).
const SEND_OFF: &str = "0.0003162277571";

/// A MIDI part made empty as Live makes a new one from the set's own MIDI
/// track (its routings and mixer shape, as many sends as the set has returns):
/// every slot and the ruler emptied, no take lane, no envelope, no device, the
/// mixer at Live's own, in no linked group, and named as Live names a new MIDI
/// track ("N-MIDI" with an empty `UserName`).
fn emptied_part(donor: &Element, id: &str, name: &str, scenes: usize) -> Result<Element, String> {
    let mut part = donor.clone();
    part.set_attr("Id", id);
    let holder = part
        .child_mut("Name")
        .ok_or("the set's MIDI track carries no Name in the document")?;
    for (field, value) in [
        ("EffectiveName", name),
        ("UserName", ""),
        ("MemorizedFirstClipName", ""),
    ] {
        match holder.child_mut(field) {
            Some(e) => e.set_attr("Value", value),
            None if field != "MemorizedFirstClipName" => {
                holder.children.push(value_element(field, value))
            }
            None => {}
        }
    }
    if let Some(linked) = part.child_mut("LinkedTrackGroupId") {
        linked.set_attr("Value", "-1");
    }
    if let Some(list) = part
        .child_mut("AutomationEnvelopes")
        .and_then(|a| a.child_mut("Envelopes"))
    {
        list.children.clear();
    }
    if let Some(lanes) = part
        .child_mut("TakeLanes")
        .and_then(|t| t.child_mut("TakeLanes"))
    {
        lanes.children.clear();
    }
    let chain = part
        .child_mut("DeviceChain")
        .ok_or("the set's MIDI track carries no device chain in the document")?;
    for sequencer in ["MainSequencer", "FreezeSequencer"] {
        let Some(sequencer) = chain.child_mut(sequencer) else {
            continue;
        };
        if let Some(list) = sequencer.child_mut("ClipSlotList") {
            for slot in &mut list.children {
                if let Ok(value) = slot_value(slot) {
                    value.children.clear();
                }
            }
        }
        if let Some(events) = sequencer
            .child_mut("ClipTimeable")
            .and_then(|t| t.child_mut("ArrangerAutomation"))
            .and_then(|a| a.child_mut("Events"))
        {
            events.children.clear();
        }
    }
    if let Some(devices) = chain
        .child_mut("DeviceChain")
        .and_then(|dc| dc.child_mut("Devices"))
    {
        devices.children.clear();
    }
    if let Some(mixer) = chain.child_mut("Mixer") {
        for (parameter, value) in [("Volume", "1"), ("Pan", "0"), ("Speaker", "true")] {
            if let Some(manual) = mixer
                .child_mut(parameter)
                .and_then(|p| p.child_mut("Manual"))
            {
                manual.set_attr("Value", value);
            }
        }
        if let Some(sends) = mixer.child_mut("Sends") {
            for holder in &mut sends.children {
                if let Some(manual) = holder.child_mut("Send").and_then(|s| s.child_mut("Manual")) {
                    manual.set_attr("Value", SEND_OFF);
                }
            }
        }
    }
    main_slots(&mut part, scenes)?;
    Ok(part)
}

/// Whether the `Tracks` member stands in the group headed by `head` (its own
/// group, or a group within it).
fn within(members: &[Element], member: &Element, head: &str) -> bool {
    let group_of = |t: &Element| value_of(t, "TrackGroupId").unwrap_or("-1").to_string();
    let mut group = group_of(member);
    let mut steps = 0;
    while group != "-1" && steps < members.len() {
        if group == head {
            return true;
        }
        group = members
            .iter()
            .find(|t| t.name == "GroupTrack" && t.attr("Id") == Some(group.as_str()))
            .map_or_else(|| "-1".to_string(), group_of);
        steps += 1;
    }
    false
}

fn track_insert(root: &mut Element, after: Option<usize>) -> Result<Done, String> {
    let scenes = scene_count(root);
    let members = root
        .find("LiveSet")
        .and_then(|set| set.child("Tracks"))
        .ok_or("the document holds no tracks")?;
    let listed = |t: &Element| {
        matches!(
            t.name.as_str(),
            "AudioTrack" | "MidiTrack" | "ReturnTrack" | "GroupTrack"
        )
    };
    // Where it stands (the `Tracks` member it goes before), the group it stands in, and the track it follows.
    let (at, group, follows) = match after {
        Some(track) => {
            let at = member_at(root, track)?;
            let before = &members.children[at];
            let named = track_name(before);
            match before.name.as_str() {
                "ReturnTrack" => {
                    return Err(format!("{named} is a return track: a new part stands among the parts, before the returns"))
                }
                // A group's members follow its head: a part inserted after the group stands after them, in the group's own group.
                "GroupTrack" => {
                    let head = track_id(before)?;
                    let end = (at + 1..members.children.len())
                        .take_while(|&j| within(&members.children, &members.children[j], &head))
                        .last()
                        .unwrap_or(at);
                    (end + 1, value_of(before, "TrackGroupId").unwrap_or("-1").to_string(), named)
                }
                _ => (at + 1, value_of(before, "TrackGroupId").unwrap_or("-1").to_string(), named),
            }
        }
        None => {
            let last = members
                .children
                .iter()
                .rposition(|t| listed(t) && t.name != "ReturnTrack");
            match last {
                Some(last) => (
                    last + 1,
                    "-1".to_string(),
                    track_name(&members.children[last]),
                ),
                None => (0, "-1".to_string(), String::new()),
            }
        }
    };
    let donor = after
        .and_then(|track| member_at(root, track).ok())
        .map(|m| &members.children[m])
        .filter(|t| t.name == "MidiTrack")
        .or_else(|| members.children.iter().find(|t| t.name == "MidiTrack"))
        .ok_or("The set holds no MIDI part to make a new one in Live's own shape from: Live's Insert MIDI Track (⌘⇧T) makes one")?;
    let track = members.children[..at].iter().filter(|t| listed(t)).count();
    let name = format!("{}-MIDI", track + 1);
    let new_id = members
        .children
        .iter()
        .filter_map(|t| t.attr("Id")?.parse::<u64>().ok())
        .max()
        .map_or(0, |id| id + 1)
        .to_string();
    let mut part = emptied_part(donor, &new_id, &name, scenes)?;
    match part.child_mut("TrackGroupId") {
        Some(g) => g.set_attr("Value", &group),
        None if group != "-1" => {
            return Err("the set's MIDI track carries no TrackGroupId in the document".into())
        }
        None => {}
    }
    let set = root
        .find("LiveSet")
        .ok_or("the document holds no LiveSet")?;
    let declared = set
        .child("NextPointeeId")
        .and_then(|n| n.attr("Value"))
        .and_then(|v| v.parse::<u64>().ok());
    let mut next = declared.unwrap_or(0).max(highest_pointee(set) + 1);
    let mut map = std::collections::HashMap::new();
    reallocate(&mut part, &mut next, &mut map);
    repoint(&mut part, &map);
    members_mut(root)?.insert(at, part);
    if declared.is_some() {
        if let Some(counter) = root
            .find_mut("LiveSet")
            .and_then(|set| set.child_mut("NextPointeeId"))
        {
            counter.set_attr("Value", &next.to_string());
        }
    }
    let words = if follows.is_empty() {
        format!("Inserted {name}, an empty MIDI part, first in the set.")
    } else {
        format!("Inserted {name}, an empty MIDI part, right after {follows}.")
    };
    Ok(Done {
        words,
        at: Some(json!({"track": track})),
        places: Places::None,
    })
}

// ---------------------------------------------------------------------------- a rack placed on a part

/// The most macros Live's rack holds (racks-session-model.md §1.7: `MacroControls.0–15`).
const RACK_MACROS: usize = 16;
/// The most variations a kept rack holds (the kernel's `kept.rs` MAX_VARIATIONS), each one of Live's macro snapshots.
const RACK_VARIATIONS: usize = 128;

/// A pointee-carrying target as a device writes one, its Id allocated when the rack is placed.
const TARGET: &str = r#"<LockEnvelope Value="0" />"#;

/// A parameter Live writes as a TimeableFloat: its value, its controller range, its automation and modulation targets.
fn timeable(tag: &str, manual: &str, min: &str, max: &str) -> String {
    format!(
        r#"<{tag}><LomId Value="0" /><Manual Value="{manual}" /><MidiControllerRange><Min Value="{min}" /><Max Value="{max}" /></MidiControllerRange><AutomationTarget Id="0">{TARGET}</AutomationTarget><ModulationTarget Id="0">{TARGET}</ModulationTarget></{tag}>"#
    )
}

/// A switch Live writes as a TimeableBool (a device's On, a chain's Speaker), on.
fn switch(tag: &str) -> String {
    toggle(tag, true)
}

/// A switch Live writes as a TimeableBool, standing on or off.
fn toggle(tag: &str, on: bool) -> String {
    format!(
        r#"<{tag}><LomId Value="0" /><Manual Value="{on}" /><AutomationTarget Id="0">{TARGET}</AutomationTarget><MidiCCOnOffThresholds><Min Value="64" /><Max Value="127" /></MidiCCOnOffThresholds></{tag}>"#
    )
}

/// Every device's boilerplate (session-model.md §6), for a device made here, not loaded from a preset: Live's default preset of
/// its kind, no source, no name of its own.
fn boilerplate(device: &str, show_preset_name: bool) -> String {
    format!(
        concat!(
            r#"<LomId Value="0" /><LomIdView Value="0" /><IsExpanded Value="true" />{on}<ModulationSourceCount Value="0" />"#,
            r#"<ParametersListWrapper LomId="0" /><Pointee Id="0" /><LastSelectedTimeableIndex Value="0" />"#,
            r#"<LastSelectedClipEnvelopeIndex Value="0" /><LastPresetRef><Value><AbletonDefaultPresetRef Id="0"><FileRef>"#,
            r#"<RelativePathType Value="0" /><RelativePath Value="" /><Path Value="" /><Type Value="2" /><LivePackName Value="" />"#,
            r#"<LivePackId Value="" /><OriginalFileSize Value="0" /><OriginalCrc Value="0" /></FileRef><DeviceId Name="{device}" />"#,
            r#"</AbletonDefaultPresetRef></Value></LastPresetRef><LockedScripts /><IsFolded Value="false" />"#,
            r#"<ShouldShowPresetName Value="{show}" /><UserName Value="" /><Annotation Value="" /><SourceContext><Value /></SourceContext>"#,
            r#"<OverwriteProtectionNumber Value="3073" />"#
        ),
        on = switch("On"),
        device = device,
        show = show_preset_name
    )
}

/// The rack's one chain as Live writes an empty one in an Instrument Rack (racks-session-model.md §1.3, §2.2): its name, no
/// device, the whole selector zone and key and velocity range, its own mixer at 0 dB, centre, on, with no rack return to send to.
fn rack_chain() -> String {
    format!(
        concat!(
            r#"<InstrumentBranch Id="0"><LomId Value="0" /><Name><EffectiveName Value="" /><UserName Value="" />"#,
            r#"<Annotation Value="" /><MemorizedFirstClipName Value="" /></Name><IsSelected Value="true" /><DeviceChain>"#,
            r#"<MidiToAudioDeviceChain Id="0"><Devices /><SignalModulations /></MidiToAudioDeviceChain></DeviceChain>"#,
            r#"<BranchSelectorRange><Min Value="0" /><Max Value="0" /><CrossfadeMin Value="0" /><CrossfadeMax Value="0" />"#,
            r#"</BranchSelectorRange><IsSoloed Value="false" /><SessionViewBranchWidth Value="55" />"#,
            r#"<IsHighlightedInSessionView Value="false" /><SourceContext><Value /></SourceContext><Color Value="0" />"#,
            r#"<AutoColored Value="true" /><AutoColorScheme Value="0" /><SoloActivatedInSessionMixer Value="false" />"#,
            r#"<DevicesListWrapper LomId="0" /><MixerDevice>{mixer}{speaker}{volume}{panorama}<SendInfos /><RoutingHelper>"#,
            r#"<Routable><Target Value="AudioOut/None" /><UpperDisplayString Value="No Output" /><LowerDisplayString Value="" />"#,
            r#"<MpeSettings><ZoneType Value="0" /><FirstNoteChannel Value="1" /><LastNoteChannel Value="15" /></MpeSettings>"#,
            r#"</Routable><TargetEnum Value="0" /></RoutingHelper><SendsListWrapper LomId="0" /></MixerDevice><ZoneSettings>"#,
            r#"<KeyRange><Min Value="0" /><Max Value="127" /><CrossfadeMin Value="0" /><CrossfadeMax Value="127" /></KeyRange>"#,
            r#"<VelocityRange><Min Value="1" /><Max Value="127" /><CrossfadeMin Value="1" /><CrossfadeMax Value="127" />"#,
            r#"</VelocityRange></ZoneSettings></InstrumentBranch>"#
        ),
        mixer = boilerplate("AudioBranchMixerDevice", false),
        speaker = switch("Speaker"),
        volume = timeable("Volume", "1", SEND_OFF, "1.99526238"),
        panorama = timeable("Panorama", "0", "-1", "1"),
    )
}

/// The most devices a placed rack's chain holds (the kernel's `kept.rs` MAX_RACK_DEVICES).
const RACK_DEVICES: usize = 64;

/// The instruments among the classes the corpus gives a surface (devices/COVERAGE.md: Drift, Wavetable, Operator): a rack's chain
/// here holds note devices and audio effects, and the Torus is its instrument.
const INSTRUMENTS: [&str; 4] = ["Drift", "Wavetable", "InstrumentVector", "Operator"];

/// A device's name as Live shows it (devices/COVERAGE.md), by the class a set stores it under.
fn live_title(class: &str) -> &str {
    match class {
        "GlueCompressor" => "Glue Compressor",
        "Eq8" => "EQ Eight",
        "AutoFilter" => "Auto Filter",
        "AutoPan" => "Auto Pan",
        "DrumBuss" => "Drum Buss",
        "Chorus2" => "Chorus-Ensemble",
        "Hybrid" => "Hybrid Reverb",
        "MultibandDynamics" => "Multiband Dynamics",
        "StereoGain" => "Utility",
        "Compressor2" => "Compressor",
        "Redux2" => "Redux",
        "FilterDelay" => "Filter Delay",
        "BeatRepeat" => "Beat Repeat",
        "ChannelEq" => "Channel EQ",
        "FilterEQ3" => "EQ Three",
        "GrainDelay" => "Grain Delay",
        "PhaserNew" => "Phaser-Flanger",
        other => other,
    }
}

/// A device of a rack's chain as a set stores it (session-model.md §6; §4: a device in a set's list carries its Id and allocated
/// pointees): Live's boilerplate under its class, then each setting carried onto it, in the order of the corpus's surface
/// (live-dynamics `params::table`), in Live's parameter pattern with the surface's controller range; its On as Live writes it. A
/// setting not carried is not written, and stands at Live's own when the set loads. What the corpus does not give is refused in
/// words, by name: a class with no surface, an instrument, a setting outside the surface or its range, a menu, a setting inside
/// another element, a switch off 0 and 1, a setting given twice.
fn chain_device(id: usize, placed: &PlacedDevice) -> Result<Element, String> {
    let class = placed.device.as_str();
    let table = live_dynamics::params::table(class).ok_or_else(|| {
        format!(
            "Live's {class} has no parameter surface in the corpus (live-dynamics params), so it is not placed"
        )
    })?;
    let title = live_title(class);
    if INSTRUMENTS.contains(&class) {
        return Err(format!(
            "Live's {title} is an instrument, and a rack's chain here holds note devices and audio effects, the Torus its instrument"
        ));
    }
    let mut on = true;
    let mut given = std::collections::BTreeMap::new();
    for parameter in &placed.parameters {
        if given
            .insert(parameter.id.as_str(), parameter.value)
            .is_some()
        {
            return Err(format!("Live's {title} is given {} twice", parameter.id));
        }
        let switch_of = |value: f64| {
            if value == 0.0 || value == 1.0 {
                Ok(value == 1.0)
            } else {
                Err(format!(
                    "Live's {title} is on or off: {} stands 0 or 1, not {}",
                    parameter.id,
                    number_text(value)
                ))
            }
        };
        if parameter.id == "On" {
            on = switch_of(parameter.value)?;
            continue;
        }
        let desc = table
            .iter()
            .find(|desc| desc.id == parameter.id)
            .ok_or_else(|| {
                format!(
                    "Live's {title} has no setting {} in the corpus's surface",
                    parameter.id
                )
            })?;
        if let Some((parent, _)) = desc.id.split_once('/') {
            return Err(format!(
                "Live's {title} keeps {} inside {parent}, and an element's inner shape is not written here yet",
                desc.id
            ));
        }
        match desc.kind {
            live_dynamics::params::ParamKind::Discrete { .. } => {
                return Err(format!(
                    "Live's {title} keeps {} as a menu, and a menu's stored shape is not written here yet",
                    desc.id
                ))
            }
            live_dynamics::params::ParamKind::Toggle => {
                switch_of(parameter.value)?;
            }
            live_dynamics::params::ParamKind::Continuous => {
                let value = parameter.value;
                if !value.is_finite() || value < desc.stored_min || value > desc.stored_max {
                    return Err(format!(
                        "Live's {title} holds {} between {} and {}, not {}",
                        desc.id,
                        number_text(desc.stored_min),
                        number_text(desc.stored_max),
                        number_text(value)
                    ));
                }
            }
        }
    }
    let settings: String = table
        .iter()
        .filter_map(|desc| {
            given.get(desc.id).map(|value| match desc.kind {
                live_dynamics::params::ParamKind::Toggle => toggle(desc.id, *value == 1.0),
                _ => timeable(
                    desc.id,
                    &number_text(*value),
                    &number_text(desc.stored_min),
                    &number_text(desc.stored_max),
                ),
            })
        })
        .collect();
    let xml = format!(
        r#"<{class} Id="{id}">{boilerplate}{settings}</{class}>"#,
        boilerplate = boilerplate(class, true)
    );
    let mut device = crate::xml::parse(&xml)
        .map_err(|why| format!("Live's {title}'s shape did not read: {why}"))?;
    device
        .child_mut("On")
        .and_then(|o| o.child_mut("Manual"))
        .ok_or_else(|| format!("Live's {title} carries no On"))?
        .set_attr("Value", if on { "true" } else { "false" });
    Ok(device)
}

/// A share of a macro's travel (0 to 1, as a kept rack holds it) on Live's macro scale, 0 to 127.
fn macro_value(share: f64) -> String {
    number_text(share * 127.0)
}

/// Live 12's Instrument Rack as it writes a new one (racks-session-model.md §1.2; the order of Quick Start Beat's Instrument
/// Racks): the device's boilerplate under the rack's name, its one chain named after it, sixteen macros (the rack's by name and
/// value, the rest Live's own "Macro N" at 0) with their defaults, annotations and colours, the chain selector, and each variation
/// a macro snapshot with a value for every macro (none for the rest). Every pointee stands at 0, for the set to allocate.
fn instrument_rack(
    name: &str,
    macros: &[PlacedMacro],
    variations: &[PlacedVariation],
    chain: &[PlacedDevice],
) -> Result<Element, String> {
    let devices = chain
        .iter()
        .enumerate()
        .map(|(id, placed)| chain_device(id, placed))
        .collect::<Result<Vec<_>, _>>()?;
    let family = |each: &dyn Fn(usize) -> String| (0..RACK_MACROS).map(each).collect::<String>();
    let value_of_macro = |i: usize| {
        macros
            .get(i)
            .map_or_else(|| "0".to_string(), |m| macro_value(m.value))
    };
    let snapshots: String = variations
        .iter()
        .enumerate()
        .map(|(id, variation)| {
            let value = |i: usize| variation.values.get(i).map_or_else(|| "-1".to_string(), |v| macro_value(*v));
            format!(
                r#"<MacroSnapshot Id="{id}"><AutogeneratedNameIndex Value="0" /><SnapshotName Value="" />{}{}</MacroSnapshot>"#,
                family(&|i| format!(r#"<MacroValues.{i} Value="{}" />"#, value(i))),
                family(&|i| format!(r#"<MacroHasValue.{i} Value="{}" />"#, i < variation.values.len())),
            )
        })
        .collect();
    let shown = if macros.len() > 8 { 16 } else { 8 };
    let xml = format!(
        concat!(
            r#"<InstrumentGroupDevice Id="0">{boilerplate}<Branches>{chain}</Branches><IsBranchesListVisible Value="false" />"#,
            r#"<IsReturnBranchesListVisible Value="false" /><IsRangesEditorVisible Value="false" />"#,
            r#"<AreDevicesVisible Value="true" /><NumVisibleMacroControls Value="{shown}" />{controls}{names}{defaults}"#,
            r#"{annotations}{generic}<AreMacroControlsVisible Value="true" /><IsAutoSelectEnabled Value="false" />{selector}"#,
            r#"<ChainSelectorRelativePosition Value="-1073741824" /><ViewsToRestoreWhenUnfolding Value="0" /><ReturnBranches />"#,
            r#"<BranchesSplitterProportion Value="0.5" /><ShowBranchesInSessionMixer Value="false" />{colours}"#,
            r#"<LockId Value="0" /><LockSeal Value="0" /><ChainsListWrapper LomId="0" /><ReturnChainsListWrapper LomId="0" />"#,
            r#"<MacroVariations><MacroSnapshots>{snapshots}</MacroSnapshots></MacroVariations>{randomized}{snapshotted}"#,
            r#"<AreMacroVariationsControlsVisible Value="{varied}" /><ChainSelectorFilterMidiCtrl Value="false" />"#,
            r#"<RangeTypeIndex Value="1" /><ShowsZonesInsteadOfNoteNames Value="false" /></InstrumentGroupDevice>"#
        ),
        boilerplate = boilerplate("InstrumentGroupDevice", true),
        chain = rack_chain(),
        shown = shown,
        controls = family(&|i| timeable(
            &format!("MacroControls.{i}"),
            &value_of_macro(i),
            "0",
            "127"
        )),
        names = family(&|i| format!(r#"<MacroDisplayNames.{i} Value="" />"#)),
        defaults = family(&|i| format!(r#"<MacroDefaults.{i} Value="{}" />"#, value_of_macro(i))),
        annotations = family(&|i| format!(r#"<MacroAnnotations.{i} Value="" />"#)),
        generic = family(&|i| format!(r#"<ForceDisplayGenericValue.{i} Value="false" />"#)),
        selector = timeable("ChainSelector", "0", "0", "127"),
        colours = family(&|i| format!(r#"<MacroColor.{i} Value="-1" />"#)),
        snapshots = snapshots,
        randomized = family(&|i| format!(r#"<ExcludeMacroFromRandomization.{i} Value="false" />"#)),
        snapshotted = family(&|i| format!(r#"<ExcludeMacroFromSnapshots.{i} Value="false" />"#)),
        varied = !variations.is_empty(),
    );
    let mut rack =
        crate::xml::parse(&xml).map_err(|why| format!("the rack's shape did not read: {why}"))?;
    // The names are the person's own text: set as values, so the writer escapes them.
    rack.child_mut("UserName")
        .ok_or("the rack carries no UserName")?
        .set_attr("Value", name);
    for i in 0..RACK_MACROS {
        let named = macros
            .get(i)
            .map_or_else(|| format!("Macro {}", i + 1), |m| m.name.clone());
        rack.child_mut(&format!("MacroDisplayNames.{i}"))
            .ok_or("the rack carries no macro name")?
            .set_attr("Value", &named);
    }
    let chain = rack
        .child_mut("Branches")
        .and_then(|b| b.child_mut("InstrumentBranch"))
        .and_then(|c| c.child_mut("Name"))
        .ok_or("the rack carries no chain")?;
    for field in ["EffectiveName", "UserName"] {
        chain
            .child_mut(field)
            .ok_or("the chain carries no name")?
            .set_attr("Value", name);
    }
    let held = rack
        .child_mut("MacroVariations")
        .and_then(|v| v.child_mut("MacroSnapshots"))
        .ok_or("the rack carries no variations")?;
    for (snapshot, variation) in held.children.iter_mut().zip(variations) {
        snapshot
            .child_mut("SnapshotName")
            .ok_or("a variation carries no name")?
            .set_attr("Value", &variation.name);
    }
    rack.child_mut("Branches")
        .and_then(|b| b.child_mut("InstrumentBranch"))
        .and_then(|c| c.child_mut("DeviceChain"))
        .and_then(|d| d.child_mut("MidiToAudioDeviceChain"))
        .and_then(|d| d.child_mut("Devices"))
        .ok_or("the rack's chain carries no device list")?
        .children
        .extend(devices);
    Ok(rack)
}

fn rack_place(
    root: &mut Element,
    track: usize,
    name: &str,
    macros: &[PlacedMacro],
    variations: &[PlacedVariation],
    chain: &[PlacedDevice],
) -> Result<Done, String> {
    let name = checked_name("A rack's name", name, false)?;
    if macros.len() > RACK_MACROS || variations.len() > RACK_VARIATIONS {
        return Err(format!(
            "Live's rack holds at most {RACK_MACROS} macros, and a kept rack at most {RACK_VARIATIONS} variations"
        ));
    }
    if chain.len() > RACK_DEVICES {
        return Err(format!(
            "A rack's chain holds at most {RACK_DEVICES} devices"
        ));
    }
    let share = |v: f64| v.is_finite() && (0.0..=1.0).contains(&v);
    for item in macros {
        checked_name("A macro's name", &item.name, false)?;
        if !share(item.value) {
            return Err(format!("Macro {} stands between 0 and 1", item.name));
        }
    }
    for variation in variations {
        checked_name("A variation's name", &variation.name, false)?;
        if variation.values.len() != macros.len() {
            return Err(format!(
                "Variation {} holds {} values for {} macros: a variation holds a value for every macro",
                variation.name,
                variation.values.len(),
                macros.len()
            ));
        }
        if !variation.values.iter().all(|v| share(*v)) {
            return Err(format!(
                "Variation {}'s macros stand between 0 and 1",
                variation.name
            ));
        }
    }
    let part = track_at(root, track)?;
    let part_name = track_name(part);
    if part.name != "MidiTrack" {
        return Err(format!(
            "An Instrument Rack plays the notes of a MIDI part, and {part_name} is not one"
        ));
    }
    let held = part
        .child("DeviceChain")
        .and_then(|c| c.child("DeviceChain"))
        .and_then(|c| c.child("Devices"))
        .ok_or_else(|| format!("The part {part_name} carries no device chain in the document"))?;
    if !held.children.is_empty() {
        return Err(format!(
            "A rack is placed on a part with nothing on its chain, as Insert MIDI Track makes one, and {part_name} holds a device already"
        ));
    }
    let mut rack = instrument_rack(&name, macros, variations, chain)?;
    let set = root
        .find("LiveSet")
        .ok_or("the document holds no LiveSet")?;
    let declared = set
        .child("NextPointeeId")
        .and_then(|n| n.attr("Value"))
        .and_then(|v| v.parse::<u64>().ok());
    let mut next = declared.unwrap_or(0).max(highest_pointee(set) + 1);
    let mut map = std::collections::HashMap::new();
    reallocate(&mut rack, &mut next, &mut map);
    edit::track_at_mut(root, track)?
        .child_mut("DeviceChain")
        .and_then(|c| c.child_mut("DeviceChain"))
        .and_then(|c| c.child_mut("Devices"))
        .ok_or_else(|| format!("The part {part_name} carries no device chain in the document"))?
        .children
        .push(rack);
    if declared.is_some() {
        if let Some(counter) = root
            .find_mut("LiveSet")
            .and_then(|set| set.child_mut("NextPointeeId"))
        {
            counter.set_attr("Value", &next.to_string());
        }
    }
    let count = |n: usize, one: &str| match n {
        0 => format!("no {one}s"),
        1 => format!("1 {one}"),
        n => format!("{n} {one}s"),
    };
    let titles: Vec<&str> = chain.iter().map(|d| live_title(&d.device)).collect();
    let holding = match titles.as_slice() {
        [] => String::new(),
        [one] => format!(", its chain holding Live's {one}"),
        [rest @ .., last] => format!(", its chain holding Live's {} and {last}", rest.join(", ")),
    };
    Ok(Done {
        words: format!(
            "Placed {name} on {part_name}: an Instrument Rack with {} and {}{holding}.",
            count(macros.len(), "macro"),
            count(variations.len(), "variation")
        ),
        at: Some(json!({"track": track})),
        places: Places::None,
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

/// The transport's Quantize set to `word` ([`SetAct::GlobalQuantize`]): `LiveSet/GlobalQuantisation`'s `Value`, Live's index
/// of it among the set's own (`edit::QUANTIZE` without its leading Global, as model.rs reads it). Refused in words for Global (a
/// clip's, never the set's), a word Live does not name, and a set that keeps no `GlobalQuantisation` to set.
fn global_quantize(root: &mut Element, word: &str) -> Result<Done, String> {
    let own = &edit::QUANTIZE[1..];
    let index = own
        .iter()
        .position(|w| w.eq_ignore_ascii_case(word.trim()))
        .ok_or_else(|| format!("The set's Quantize takes one of {}", own.join(", ")))?;
    let quantisation = root
        .find_mut("LiveSet")
        .and_then(|ls| ls.child_mut("GlobalQuantisation"))
        .ok_or("The set keeps no transport Quantize to set")?;
    let was = quantisation
        .attr("Value")
        .and_then(|v| v.parse::<usize>().ok())
        .and_then(|v| own.get(v))
        .copied();
    quantisation.set_attr("Value", &index.to_string());
    let now = own[index];
    Ok(Done {
        words: match was {
            Some(w) if w == now => format!("The set's Quantize stays {now}."),
            Some(w) => format!("Set the set's Quantize from {w} to {now}."),
            None => format!("Set the set's Quantize to {now}."),
        },
        at: Some(json!({"quantize": now})),
        places: Places::None,
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

fn clips_consolidate(
    root: &mut Element,
    track: usize,
    from: f64,
    to: f64,
    sample: Option<&Consolidated>,
) -> Result<Done, String> {
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
    match (part.name.as_str(), sample) {
        ("MidiTrack", None) => {}
        ("MidiTrack", Some(_)) => {
            return Err(format!(
                "{} is a MIDI part: its clips are joined as notes, and a sample is an audio part's",
                track_name(part)
            ))
        }
        ("AudioTrack", Some(sample)) => return audio_consolidate(root, track, from, to, sample),
        ("AudioTrack", None) => {
            return Err("Consolidating audio clips writes a new sample of what they play: the engine renders it (live_engine_consolidate), and the set keeps it beside itself".into())
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

/// Where Live keeps a consolidated sample, from the set's own folder (the template's consolidated clips: their `RelativePath`
/// `Samples/Processed/Consolidate/<name> [<when>].aif`).
pub const CONSOLIDATE_DIR: &str = "Samples/Processed/Consolidate";
/// What keeps the consolidated samples out of git, written into [`CONSOLIDATE_DIR`] where it holds none yet.
const CONSOLIDATE_IGNORE: &str =
    "# Consolidated samples, held by their content hash out of git (DLW §10.3)\n*.wav\n";
/// The longest a consolidated sample may weigh: an hour of stereo 32-bit float at 48 kHz, with room.
pub const CONSOLIDATED_BYTES_MAX: usize = 1536 * 1024 * 1024;

/// A sample consolidated from an audio part's clips, kept beside the set: where (from the set's folder, and whole), how many
/// bytes, its frames and rate, and when it was written (seconds since 1970).
pub(crate) struct Consolidated {
    relative: String,
    path: String,
    bytes: usize,
    crc: u16,
    frames: u64,
    rate: u32,
    written: u64,
}

/// Live's `OriginalCrc` of a sample file: CRC-16/UMTS (polynomial 0x8005, from 0, neither reflected nor inverted) over its first
/// 16 KiB, the whole of a shorter file. Decoded from the documents: each `OriginalCrc` the template "Piano and voices mastering"
/// keeps beside a sample on this machine is that sum of the file it names (evidence/sets/template-piano-voices-mastering.xml:228252,
/// `Samples/Imported/piano2.mp3`, 33450; the other two imported takes and the Consolidate renders alike); no other 16-bit sum of
/// a prefix, a suffix or the whole file matches them all.
pub fn original_crc(bytes: &[u8]) -> u16 {
    let mut crc: u16 = 0;
    for byte in bytes.iter().take(16 * 1024) {
        crc ^= u16::from(*byte) << 8;
        for _ in 0..8 {
            crc = if crc & 0x8000 != 0 {
                (crc << 1) ^ 0x8005
            } else {
                crc << 1
            };
        }
    }
    crc
}

/// A WAV file's channels, rate and frames, read from its `fmt ` and `data` chunks; refused in words for what is not one.
fn wav_shape(wav: &[u8]) -> Result<(u16, u32, u64), String> {
    let refused = || "What the engine rendered is not a WAV file".to_string();
    if wav.len() < 12 || &wav[..4] != b"RIFF" || &wav[8..12] != b"WAVE" {
        return Err(refused());
    }
    let (mut at, mut format, mut data) = (12usize, None, None);
    while at + 8 <= wav.len() {
        let size =
            u32::from_le_bytes([wav[at + 4], wav[at + 5], wav[at + 6], wav[at + 7]]) as usize;
        let body = at + 8;
        let end = body
            .checked_add(size)
            .filter(|end| *end <= wav.len())
            .ok_or_else(refused)?;
        match &wav[at..at + 4] {
            b"fmt " if size >= 16 => {
                let word = |i: usize| u16::from_le_bytes([wav[body + i], wav[body + i + 1]]);
                let rate = u32::from_le_bytes([
                    wav[body + 4],
                    wav[body + 5],
                    wav[body + 6],
                    wav[body + 7],
                ]);
                format = Some((word(2), rate, word(12)));
            }
            b"data" => data = Some(size),
            _ => {}
        }
        at = end + (size & 1);
    }
    let ((channels, rate, block), Some(data)) = (format.ok_or_else(refused)?, data) else {
        return Err(refused());
    };
    if channels == 0 || rate == 0 || block == 0 {
        return Err(refused());
    }
    Ok((channels, rate, (data / usize::from(block)) as u64))
}

/// The `SampleRef` of a sample kept beside the set, in the template's shape: the `FileRef` by its path from the set's folder
/// (`RelativePathType` 1, the type the corpus keeps for a path from the document's folder, evidence/sets/rack-chunky-shine.xml:2904
/// and template-piano-voices-mastering.xml:237230; Live's own project type is not attested) and whole, `Type` 2, its size and
/// Live's `OriginalCrc` of it ([`original_crc`]), then `LastModDate`, `SourceContext`, `SampleUsageHint`, `DefaultDuration`
/// (frames) and `DefaultSampleRate`.
fn sample_ref(sample: &Consolidated) -> Element {
    let valued = |name: &str, value: &str| {
        let mut e = Element::new(name);
        e.set_attr("Value", value);
        e
    };
    let mut file = Element::new("FileRef");
    file.children = vec![
        valued("RelativePathType", "1"),
        valued("RelativePath", &sample.relative),
        valued("Path", &sample.path),
        valued("Type", "2"),
        valued("LivePackName", ""),
        valued("LivePackId", ""),
        valued("OriginalFileSize", &sample.bytes.to_string()),
        valued("OriginalCrc", &sample.crc.to_string()),
    ];
    let mut reference = Element::new("SampleRef");
    reference.children = vec![
        file,
        valued("LastModDate", &sample.written.to_string()),
        Element::new("SourceContext"),
        valued("SampleUsageHint", "0"),
        valued("DefaultDuration", &sample.frames.to_string()),
        valued("DefaultSampleRate", &sample.rate.to_string()),
    ];
    reference
}

/// An audio clip made to play `sample` ([`sample_ref`]), in place of the `SampleRef` it carried.
fn set_sample(clip: &mut Element, sample: &Consolidated) {
    let reference = sample_ref(sample);
    match clip.children.iter_mut().find(|c| c.name == "SampleRef") {
        Some(standing) => *standing = reference,
        None => clip.children.push(reference),
    }
}

/// Consolidate on an audio part (O-I #743; manual §10.9 "In Arrangement view, Split (⌘E), Consolidate (⌘J)"): the clips of
/// part `track` across beats `from`–`to` give way to one AudioClip there (as `lay_over` lays any clip over others) that plays
/// `sample`, what they played in the stretch as the engine rendered them alone (live-engine `render_clips_alone`). The clip is
/// the first clip's own, made to play the whole sample once from its first frame: unwarped (session-model.md §5: "Unwarped
/// playback (`IsWarped=false`) plays the sample at original rate"), its markers in seconds (`marker_scale`), at unity gain and
/// pitch, with no fade and no clip envelope (what those did is in the sample), and Live's own pair of warp markers at the set's
/// tempo. Its `SampleRef` is in the template's shape ([`sample_ref`]).
fn audio_consolidate(
    root: &mut Element,
    track: usize,
    from: f64,
    to: f64,
    sample: &Consolidated,
) -> Result<Done, String> {
    let part = track_at(root, track)?;
    let lane: Vec<Element> = edit::main_lane(part)
        .into_iter()
        .filter(|clip| clip.name == "AudioClip")
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
            "No audio clip lies between beat {} and beat {} on this part",
            number_text(from),
            number_text(to)
        ));
    };
    let Some(bpm) = edit::steady_tempo(root).filter(|bpm| *bpm > 0.0) else {
        return Err("The set's tempo moves, so a sample of the stretch has no one length in beats: an unwarped clip keeps its markers in seconds".into());
    };
    let seconds = sample.frames as f64 / f64::from(sample.rate);
    let stretch = (to - from) * 60.0 / bpm;
    if (sample.frames as f64 - stretch * f64::from(sample.rate)).abs() > 1.0 {
        return Err(format!(
            "The sample runs {} seconds, and the stretch {} seconds at the set's tempo: it is not a sample of the stretch",
            number_text((seconds * 1000.0).round() / 1000.0),
            number_text((stretch * 1000.0).round() / 1000.0)
        ));
    }
    let id = track_id(part)?;
    let mut made = first.clone();
    made.set_attr("Time", &number_text(from));
    set_value(&mut made, "CurrentStart", &number_text(from))?;
    set_value(&mut made, "CurrentEnd", &number_text(to))?;
    let length = number_text(seconds);
    let lp = made
        .child_mut("Loop")
        .ok_or("the clip carries no loop markers in the document")?;
    for (marker, value) in [
        ("LoopStart", "0"),
        ("LoopEnd", length.as_str()),
        ("StartRelative", "0"),
        ("LoopOn", "false"),
        ("OutMarker", length.as_str()),
        ("HiddenLoopStart", "0"),
        ("HiddenLoopEnd", length.as_str()),
    ] {
        if let Some(element) = lp.child_mut(marker) {
            element.set_attr("Value", value);
        }
    }
    for (child, value) in [
        ("IsWarped", "false"),
        ("SampleVolume", "1"),
        ("PitchCoarse", "0"),
        ("PitchFine", "0"),
        ("Disabled", "false"),
    ] {
        if let Some(element) = made.child_mut(child) {
            element.set_attr("Value", value);
        }
    }
    if let Some(fades) = made.child_mut("Fades") {
        for fade in ["FadeInLength", "FadeOutLength"] {
            if let Some(element) = fades.child_mut(fade) {
                element.set_attr("Value", "0");
            }
        }
    }
    if let Some(envelopes) = made
        .child_mut("Envelopes")
        .and_then(|e| e.child_mut("Envelopes"))
    {
        envelopes.children.clear();
    }
    if let Some(markers) = made.child_mut("WarpMarkers") {
        let marker = |id: &str, sec: f64, beat: f64| {
            let mut m = Element::new("WarpMarker");
            m.set_attr("Id", id);
            m.set_attr("SecTime", &number_text(sec));
            m.set_attr("BeatTime", &number_text(beat));
            m
        };
        markers.children = vec![
            marker("0", 0.0, 0.0),
            marker("1", 0.03125 * 60.0 / bpm, 0.03125),
        ];
    }
    set_sample(&mut made, sample);
    let was = lane_ids(part);
    let target = listed_mut(root, track)?;
    edit::lay_over(target, "Sample", from, to, Some(bpm), vec![made])?;
    let now = lane_ids(target);
    let new = now.iter().position(|i| !was.contains(i));
    Ok(Done {
        words: format!(
            "Consolidated {} audio clip{} between beat {} and beat {} into one, {} second{} of sound written beside the set as {}.",
            lane.len(),
            if lane.len() == 1 { "" } else { "s" },
            number_text(from),
            number_text(to),
            number_text((seconds * 1000.0).round() / 1000.0),
            if seconds == 1.0 { "" } else { "s" },
            sample.relative
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

/// Consolidate on audio part `track` of the set at `path` (see [`audio_consolidate`]), against its revision: `wav`, what its
/// clips play across beats `from`–`to` rendered alone by the engine, a WAV file's bytes, is kept beside the set under
/// [`CONSOLIDATE_DIR`] by its content (`<first clip's name> [<its sha256's first 16 hex>].wav`: the same render is one file, and
/// a [`CONSOLIDATE_IGNORE`] keeps them out of git, DLW §10.3 "large media is held by its content hash, out of git"), then the
/// clip that plays it laid. Answered as any act, with the sample (`path`, `sha256`, `bytes`, `frames`, `rate`); refused in words,
/// with no sample left behind, for a render that is not a WAV of the stretch, a part that is not an audio part, a stretch with no
/// clip, and a set that changed since it was read.
pub fn consolidate_audio(
    path: &str,
    expected_revision: &str,
    track: usize,
    from: f64,
    to: f64,
    wav: &[u8],
) -> Result<Value, String> {
    if !(from.is_finite() && to.is_finite() && to > from) {
        return Err("Consolidate takes a stretch of the ruler: its end after its start".into());
    }
    if wav.len() > CONSOLIDATED_BYTES_MAX {
        return Err(format!(
            "A consolidated sample is at most {} MiB",
            CONSOLIDATED_BYTES_MAX / (1024 * 1024)
        ));
    }
    wav_shape(wav)?;
    let (_, root) = edit::open(path)?;
    let part = track_at(&root, track)?;
    let named = edit::main_lane(part)
        .into_iter()
        .filter(|clip| clip.name == "AudioClip")
        .find(|clip| {
            edit::num(clip, "CurrentEnd").unwrap_or(0.0) > from
                && edit::num(clip, "CurrentStart").unwrap_or(0.0) < to
        })
        .and_then(|clip| value_of(clip, "Name"))
        .filter(|name| !name.is_empty())
        .unwrap_or("Consolidated")
        .replace(['/', ':', '\\'], "-");
    keep_sample(
        path,
        expected_revision,
        &SetAct::ClipsConsolidate { track, from, to },
        Kept {
            dir: CONSOLIDATE_DIR,
            ignore: CONSOLIDATE_IGNORE,
            named: &named,
            refused: "nothing was consolidated",
        },
        wav,
    )
}

/// Where a sample an act keeps beside the set goes ([`keep_sample`]): its folder from the set's, the `.gitignore` written there,
/// the file's name before its hash, and the words a refusal ends in.
struct Kept<'a> {
    dir: &'a str,
    ignore: &'a str,
    named: &'a str,
    refused: &'a str,
}

/// Keep `wav`, a WAV file's bytes, beside the set at `path` under `kept.dir` by its content (`<name> [<its sha256's first 16
/// hex>].wav`: the same sound is one file, and `kept.ignore` keeps them out of git, DLW §10.3 "large media is held by its content
/// hash, out of git"), and make `act` with it against the set's revision: the sample is written once the act is made in the
/// document, and the document once the sample is written, so a refusal on either side leaves neither. Answered as the act, with
/// the sample (`path`, `sha256`, `bytes`, `frames`, `rate`); refused for a name that holds another sound.
fn keep_sample(
    path: &str,
    expected_revision: &str,
    act: &SetAct,
    kept: Kept,
    wav: &[u8],
) -> Result<Value, String> {
    use sha2::{Digest, Sha256};
    let (_channels, rate, frames) = wav_shape(wav)?;
    let hex: String = Sha256::digest(wav)
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect();
    let set = std::path::Path::new(path);
    let folder = set.parent().ok_or("the set has no parent directory")?;
    let relative = format!("{}/{} [{}].wav", kept.dir, kept.named, &hex[..16]);
    let file = folder.join(&relative);
    let standing = std::fs::read(&file).ok();
    if standing.as_deref().is_some_and(|standing| standing != wav) {
        return Err(format!(
            "{relative} beside the set holds another sound: {}",
            kept.refused
        ));
    }
    let sample = Consolidated {
        relative: relative.clone(),
        path: file.to_string_lossy().into_owned(),
        bytes: wav.len(),
        crc: original_crc(wav),
        frames,
        rate,
        written: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map_or(0, |d| d.as_secs()),
    };
    let written = std::cell::Cell::new(false);
    let answered = acted(path, expected_revision, act, Some(&sample), &|| {
        if standing.is_some() {
            return Ok(());
        }
        let dir = folder.join(kept.dir);
        std::fs::create_dir_all(&dir)
            .map_err(|e| format!("The sample's folder beside the set could not be made: {e}"))?;
        let ignore = dir.join(".gitignore");
        if !ignore.exists() {
            staged_write(&ignore, kept.ignore.as_bytes())?;
        }
        staged_write(&file, wav)?;
        written.set(true);
        Ok(())
    });
    match answered {
        Ok(mut answer) => {
            answer["sample"] = json!({"path": relative, "sha256": format!("sha256:{hex}"), "bytes": wav.len(), "frames": frames, "rate": rate});
            Ok(answer)
        }
        Err(why) => {
            if written.get() {
                let _ = std::fs::remove_file(&file);
            }
            Err(why)
        }
    }
}

/// Where Live keeps a cropped sample, from the set's own folder: beside [`CONSOLIDATE_DIR`] in Live's processed folders (the
/// template keeps `Samples/Processed/Consolidate` and `Samples/Processed/Reverse`; no set here holds a crop, so the folder is
/// named as those are).
pub const CROP_DIR: &str = "Samples/Processed/Crop";
/// What keeps the cropped samples out of git, written into [`CROP_DIR`] where it holds none yet.
const CROP_IGNORE: &str =
    "# Cropped samples, held by their content hash out of git (DLW §10.3)\n*.wav\n";

/// The ruler's stretch an act names by `from` and `to`: both or neither.
pub fn span_of(from: Option<f64>, to: Option<f64>) -> Result<Option<(f64, f64)>, String> {
    match (from, to) {
        (None, None) => Ok(None),
        (Some(from), Some(to)) if from.is_finite() && to.is_finite() && to > from => {
            Ok(Some((from, to)))
        }
        _ => Err("A selection is a stretch of the ruler: its start, and its end after it".into()),
    }
}

/// An audio clip's warp markers (`SecTime`, `BeatTime`), in order along the file, each a step further on both.
fn warp_points(clip: &Element) -> Vec<(f64, f64)> {
    let mut points: Vec<(f64, f64)> = clip
        .child("WarpMarkers")
        .map(|m| {
            m.children
                .iter()
                .filter_map(|w| {
                    let at = |name: &str| w.attr(name).and_then(|v| v.parse::<f64>().ok());
                    Some((at("SecTime")?, at("BeatTime")?))
                })
                .collect()
        })
        .unwrap_or_default();
    points.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap_or(std::cmp::Ordering::Equal));
    points.dedup_by(|b, a| b.0 <= a.0 || b.1 <= a.1);
    points
}

/// Where `x` falls along `points` (each `(x, y)`, rising on both), read off the straight line between the two markers it lies
/// between — before the first or past the last, the line of the nearest two runs on (devices/warp-probe.md: a segment's tempo is
/// the ratio of its two markers).
fn along(points: &[(f64, f64)], x: f64) -> f64 {
    let at = points
        .windows(2)
        .position(|w| x < w[1].0)
        .unwrap_or(points.len().saturating_sub(2));
    let (a, b) = (points[at], points[at + 1]);
    a.1 + (x - a.0) * (b.1 - a.1) / (b.0 - a.0)
}

/// A clip as Crop leaves it, and for an audio clip the stretch of its sample it keeps, in seconds of the file (`from`, `to`).
struct Cropped {
    clip: Element,
    named: String,
    looped: bool,
    beats: f64,
    seconds: Option<(f64, f64)>,
}

/// Crop's clip ([`SetAct::ClipCrop`]), made from clip `at` of part `track` and not yet laid: with `span`, first cut to the
/// stretch of the ruler it shares with it (`edit::crop`, as Split cuts), then cropped to its region (`edit::crop_to_region`: its
/// loop, else its start to its end; its notes, markers and clip envelopes held to it). An audio clip's region is a stretch of its
/// sample: its markers' own seconds unwarped, else read off its warp markers, which are moved with it — those inside the region
/// kept, one at each end where the region cuts between two, so the cropped sample keeps its tempo.
fn cropped(
    root: &Element,
    track: usize,
    at: ClipAt,
    span: Option<(f64, f64)>,
) -> Result<Cropped, String> {
    let part = track_at(root, track)?;
    let mut clip = clip_at(part, at)?.clone();
    let named = value_of(&clip, "Name")
        .filter(|n| !n.is_empty())
        .unwrap_or("the clip")
        .to_string();
    let scale = edit::marker_scale(&clip, edit::steady_tempo(root))?;
    if let Some((from, to)) = span {
        if matches!(at, ClipAt::Slot(_)) {
            return Err(
                "A clip is cropped to a selection in Arrangement view, where it lies on the ruler"
                    .into(),
            );
        }
        let (start, end) = (
            edit::num(&clip, "CurrentStart").ok_or("the clip carries no place in the document")?,
            edit::num(&clip, "CurrentEnd").ok_or("the clip carries no place in the document")?,
        );
        let (from, to) = (from.max(start), to.min(end));
        if to <= from {
            return Err(format!(
                "The selection holds none of {named}: select a stretch of the ruler over it, between beat {} and beat {}",
                number_text(start),
                number_text(end)
            ));
        }
        edit::crop(&mut clip, from, to, scale)?;
    }
    let looped = clip.child("Loop").and_then(|lp| edit::flag(lp, "LoopOn")) == Some(true);
    let audio = clip.name == "AudioClip";
    let warped = audio && edit::flag(&clip, "IsWarped") != Some(false);
    let points = warp_points(&clip);
    let (from, length) = edit::crop_to_region(&mut clip, scale)?;
    let seconds = if !audio {
        None
    } else if warped {
        if points.len() < 2 {
            return Err(format!(
                "{named} is warped and holds fewer than two warp markers: nothing says which stretch of its sample its beats play"
            ));
        }
        let flipped: Vec<(f64, f64)> = points.iter().map(|(s, b)| (*b, *s)).collect();
        Some((along(&flipped, from), along(&flipped, from + length)))
    } else {
        Some((from, from + length))
    };
    if let Some((s0, s1)) = seconds {
        if points.len() >= 2 {
            let (b0, b1) = (along(&points, s0), along(&points, s1));
            let mut moved = vec![(0.0, 0.0)];
            moved.extend(
                points
                    .iter()
                    .filter(|(s, _)| *s > s0 && *s < s1)
                    .map(|(s, b)| (s - s0, b - b0)),
            );
            moved.push((s1 - s0, b1 - b0));
            if let Some(markers) = clip.child_mut("WarpMarkers") {
                markers.children = moved
                    .iter()
                    .enumerate()
                    .map(|(id, (sec, beat))| {
                        let mut m = Element::new("WarpMarker");
                        m.set_attr("Id", &id.to_string());
                        m.set_attr("SecTime", &number_text(*sec));
                        m.set_attr("BeatTime", &number_text(*beat));
                        m
                    })
                    .collect();
            }
        }
    }
    Ok(Cropped {
        clip,
        named,
        looped,
        beats: length / scale,
        seconds,
    })
}

/// Crop (⇧⌘J, see [`SetAct::ClipCrop`]) on clip `at` of part `track`, in place: a MIDI clip as [`cropped`] makes it; an audio
/// clip only with `sample`, the stretch of its sample it keeps as the host cut it ([`crop_audio`]), which it then plays.
fn clip_crop(
    root: &mut Element,
    track: usize,
    at: ClipAt,
    span: Option<(f64, f64)>,
    sample: Option<&Consolidated>,
) -> Result<Done, String> {
    let Cropped {
        mut clip,
        named,
        looped,
        beats,
        seconds,
    } = cropped(root, track, at, span)?;
    let kept = match (seconds, sample) {
        (None, None) => {
            let notes = edit::notes_json(&clip).len();
            format!(", {notes} note{} kept", if notes == 1 { "" } else { "s" })
        }
        (None, Some(_)) => {
            return Err(format!(
                "{named} is a MIDI clip: it is cropped as notes, and a sample is an audio clip's"
            ))
        }
        (Some(_), None) => {
            return Err("Cropping an audio clip writes a new sample of what it keeps: the host cuts it from the clip's own (live_engine_crop), and the set keeps it beside itself".into())
        }
        (Some((s0, s1)), Some(sample)) => {
            let want = (s1 - s0) * f64::from(sample.rate);
            if (sample.frames as f64 - want).abs() > 1.0 {
                return Err(format!(
                    "The sample runs {} frames, and the stretch {named} keeps {} frames of its own: it is not a cut of the clip",
                    sample.frames,
                    number_text(want.round())
                ));
            }
            set_sample(&mut clip, sample);
            format!(
                ", {} second{} of sound written beside the set as {}",
                number_text(((s1 - s0) * 1000.0).round() / 1000.0),
                if s1 - s0 == 1.0 { "" } else { "s" },
                sample.relative
            )
        }
    };
    let what = match (span, looped) {
        (_, true) => "its loop",
        (Some(_), false) => "the selection",
        (None, false) => "its start and end",
    };
    let part = edit::track_at_mut(root, track)?;
    *edit::clip_at_mut(part, at)? = clip;
    let place = match at {
        ClipAt::Arrangement(j) => json!({"track": track, "arrangement": j}),
        ClipAt::Slot(scene) => json!({"track": track, "slot": scene}),
    };
    Ok(Done {
        words: format!(
            "Cropped {named} to {what}: {} beat{}{kept}.",
            number_text(beats),
            if beats == 1.0 { "" } else { "s" }
        ),
        at: Some(place),
        places: Places::None,
    })
}

/// What Crop cuts from an audio clip's sample ([`crop_source`]): the file the clip plays (its `RelativePath` from the set's
/// folder where one is there, else its `Path`: live-engine `lay_samples`' rule) and the stretch of it, in seconds.
#[derive(Debug, Clone, PartialEq)]
pub struct CropSource {
    pub file: std::path::PathBuf,
    pub from_seconds: f64,
    pub to_seconds: f64,
}

/// Where the host cuts Crop's sample from, for clip `at` of audio part `track` of the set at `path`, cropped to `span` of the
/// ruler or to its region ([`cropped`]); refused in words for a MIDI clip and for one that names no sample file.
pub fn crop_source(
    path: &str,
    track: usize,
    at: ClipAt,
    span: Option<(f64, f64)>,
) -> Result<CropSource, String> {
    let (_, root) = edit::open(path)?;
    let original = clip_at(track_at(&root, track)?, at)?;
    let file = original.child("SampleRef").and_then(|r| r.child("FileRef"));
    let stored = |field: &str| {
        file.and_then(|f| value_of(f, field))
            .filter(|v| !v.is_empty())
            .map(str::to_string)
    };
    let Cropped { named, seconds, .. } = cropped(&root, track, at, span)?;
    let Some((from_seconds, to_seconds)) = seconds else {
        return Err(format!(
            "{named} is a MIDI clip: Crop keeps its notes, and cuts no sample"
        ));
    };
    let folder = std::path::Path::new(path)
        .parent()
        .ok_or("the set has no parent directory")?;
    let beside = stored("RelativePath")
        .map(|relative| folder.join(relative))
        .filter(|file| file.is_file());
    let file = beside
        .or_else(|| stored("Path").map(std::path::PathBuf::from))
        .ok_or_else(|| format!("{named} names no sample file: there is no sound to crop"))?;
    Ok(CropSource {
        file,
        from_seconds,
        to_seconds,
    })
}

/// Crop on audio clip `at` of part `track` of the set at `path` ([`SetAct::ClipCrop`], to `span` of the ruler or its region),
/// against its revision: `wav`, the stretch of its sample the host cut ([`crop_source`]), a WAV file's bytes, is kept beside the
/// set under [`CROP_DIR`] by its content (`<clip's name> [<its sha256's first 16 hex>].wav`, as Consolidate keeps one), and the
/// clip cropped to play it. Answered as any act, with the sample; refused in words, with no sample left behind, for a cut that is
/// not one of the clip's stretch, a clip that is not an audio clip, and a set that changed since it was read.
pub fn crop_audio(
    path: &str,
    expected_revision: &str,
    track: usize,
    at: ClipAt,
    span: Option<(f64, f64)>,
    wav: &[u8],
) -> Result<Value, String> {
    if wav.len() > CONSOLIDATED_BYTES_MAX {
        return Err(format!(
            "A cropped sample is at most {} MiB",
            CONSOLIDATED_BYTES_MAX / (1024 * 1024)
        ));
    }
    let (_, root) = edit::open(path)?;
    let named = value_of(clip_at(track_at(&root, track)?, at)?, "Name")
        .filter(|name| !name.is_empty())
        .unwrap_or("Cropped")
        .replace(['/', ':', '\\'], "-");
    keep_sample(
        path,
        expected_revision,
        &SetAct::ClipCrop {
            track,
            clip: at,
            from: span.map(|s| s.0),
            to: span.map(|s| s.1),
        },
        Kept {
            dir: CROP_DIR,
            ignore: CROP_IGNORE,
            named: &named,
            refused: "nothing was cropped",
        },
        wav,
    )
}

/// Write `bytes` to `path` through a file beside it, renamed into place.
fn staged_write(path: &std::path::Path, bytes: &[u8]) -> Result<(), String> {
    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_default();
    let staged = path.with_file_name(format!(".{name}.{}.tmp", std::process::id()));
    std::fs::write(&staged, bytes)
        .and_then(|()| std::fs::rename(&staged, path))
        .map_err(|e| {
            let _ = std::fs::remove_file(&staged);
            format!(
                "{} could not be written beside the set: {e}",
                path.display()
            )
        })
}

/// The set's next `TakeId`: one past the highest any clip of the set carries
/// (Live numbers takes across the whole set: the template's takes run 1–21
/// over its parts, while each part's `Recorder/TakeCounter` stays 0 or 1, so
/// the counter is left as it stands).
fn next_take_id(root: &Element) -> u64 {
    fn walk(element: &Element, most: &mut u64) {
        if CLIPS.contains(&element.name.as_str()) {
            if let Some(id) = edit::num(element, "TakeId") {
                if id.fract() == 0.0 && id >= 0.0 {
                    *most = (*most).max(id as u64);
                }
            }
        }
        for child in &element.children {
            walk(child, most);
        }
    }
    let mut most = 0;
    walk(root, &mut most);
    most + 1
}

/// A take lane as Live 12 writes one (the template "Piano and voices
/// mastering": `Height` 51, not selected, the clip in `ClipAutomation/Events`
/// beside its transform state, then the lane's `Name`, `Annotation` and
/// `Audition`).
fn fresh_take_lane(id: usize, name: &str, clip: Element) -> Element {
    let mut lane = Element::new("TakeLane");
    lane.set_attr("Id", &id.to_string());
    let mut events = Element::new("Events");
    events.children.push(clip);
    let mut transform = Element::new("AutomationTransformViewState");
    transform.children = vec![
        value_element("IsTransformPending", "false"),
        Element::new("TimeAndValueTransforms"),
    ];
    let mut automation = Element::new("ClipAutomation");
    automation.children = vec![events, transform];
    lane.children = vec![
        value_element("Height", "51"),
        value_element("IsContentSelectedInDocument", "false"),
        automation,
        value_element("Name", name),
        value_element("Annotation", ""),
        value_element("Audition", "false"),
    ];
    lane
}

/// The take lanes of a part, their list made in Live's shape where the
/// document keeps none.
fn take_lanes_mut(track: &mut Element) -> &mut Element {
    if track.child("TakeLanes").is_none() {
        let mut outer = Element::new("TakeLanes");
        outer.children = vec![
            Element::new("TakeLanes"),
            value_element("AreTakeLanesFolded", "true"),
        ];
        track.children.push(outer);
    }
    let outer = track.child_mut("TakeLanes").expect("made above");
    if outer.child("TakeLanes").is_none() {
        outer.children.insert(0, Element::new("TakeLanes"));
    }
    outer.child_mut("TakeLanes").expect("made above")
}

/// The most points one lane of a note's MPE holds.
const MPE_POINTS_MAX: usize = 4096;

/// A take's note's own expression (O-I #853; DLW §21.1 Clip view, the MPE tab: "Pressure from the playing surface records
/// here"): its pressure lane (0 to 1) and its bend lane (−1 to 1 of its range), each points [beat from the note's start, amount]
/// in time within the note; none when it carries none. Live's own per-note event lists have no clean-room shape yet
/// (session-model.md §7 attests only the empty `<PerNoteEventStore><EventLists /></PerNoteEventStore>`), so the set keeps them
/// in the DLW's record beside it, by the note's NoteId, with what the take keeps (sources.rs `takes`).
fn note_mpe(note: &Value) -> Result<Option<serde_json::Map<String, Value>>, String> {
    let Some(mpe) = note.get("mpe").filter(|m| !m.is_null()) else {
        return Ok(None);
    };
    let lanes = mpe
        .as_object()
        .filter(|m| m.keys().all(|k| k == "pressure" || k == "bend"))
        .ok_or("A note's MPE lanes are its pressure and its bend")?;
    let len = note.get("len").and_then(Value::as_f64).unwrap_or(0.0);
    let mut kept = serde_json::Map::new();
    for (lane, low) in [("pressure", 0.0), ("bend", -1.0)] {
        let Some(points) = lanes.get(lane) else {
            continue;
        };
        let ordered =
            || format!("A note's {lane} lane runs in time, at most {MPE_POINTS_MAX} points");
        let points = points
            .as_array()
            .filter(|p| p.len() <= MPE_POINTS_MAX)
            .ok_or_else(ordered)?;
        let mut last = f64::NEG_INFINITY;
        let mut out = Vec::with_capacity(points.len());
        for point in points {
            let pair = point
                .as_array()
                .filter(|p| p.len() == 2)
                .and_then(|p| Some((p[0].as_f64()?, p[1].as_f64()?)));
            let Some((beat, amount)) =
                pair.filter(|(b, a)| *b >= 0.0 && *b <= len + 1e-9 && (low..=1.0).contains(a))
            else {
                return Err(format!(
                    "Each point of a note's {lane} lane is a beat within the note and an amount from {} to 1",
                    number_text(low)
                ));
            };
            if beat < last {
                return Err(ordered());
            }
            last = beat;
            out.push(json!([beat, amount]));
        }
        kept.insert(lane.into(), Value::Array(out));
    }
    Ok((!kept.is_empty()).then_some(kept))
}

/// Lay a take: its clip in a take lane and over the main lane, its notes each named by its NoteId (the clip is new, so its
/// notes' order), and each note's MPE as the record keeps it ([`note_mpe`]: `{id, p, pressure?, bend?}`, none for a note with
/// none).
fn take_record(
    root: &mut Element,
    track: usize,
    start: f64,
    length: f64,
    name: &str,
    notes: &[Value],
    scene: Option<usize>,
) -> Result<(Done, u64, Vec<Value>), String> {
    if !(start.is_finite() && start >= 0.0) {
        return Err("A take lies on the ruler from beat 0".into());
    }
    if !(length.is_finite() && length > 0.0 && length <= edit::MADE_LENGTH_MAX) {
        return Err(format!(
            "A take's length is more than 0 and at most {} beats",
            number_text(edit::MADE_LENGTH_MAX)
        ));
    }
    if name.trim().is_empty() || name.chars().count() > 256 || name.chars().any(char::is_control) {
        return Err("A take's name is one line of at most 256 characters".into());
    }
    for note in notes {
        let at = note.get("at").and_then(Value::as_f64).unwrap_or(f64::NAN);
        let len = note.get("len").and_then(Value::as_f64).unwrap_or(0.0);
        if !(at >= 0.0 && at < length && at + len <= length + 1e-9) {
            return Err("Each note of a take lies within the take".into());
        }
    }
    let mut mpe = Vec::new();
    let mut named = Vec::with_capacity(notes.len());
    for (i, note) in notes.iter().enumerate() {
        let lanes = note_mpe(note)?;
        let mut note = note.clone();
        if let Some(fields) = note.as_object_mut() {
            fields.remove("mpe");
            fields.insert("id".into(), json!(i + 1));
        }
        if let Some(mut lanes) = lanes {
            lanes.insert("id".into(), json!(i + 1));
            lanes.insert("p".into(), note["p"].clone());
            mpe.push(Value::Object(lanes));
        }
        named.push(note);
    }
    let part = track_at(root, track)?;
    if part.name != "MidiTrack" {
        return Err("Live records notes on a MIDI part, and this track is not one".into());
    }
    let id = track_id(part)?;
    let part_name = track_name(part);
    let colour = value_of(part, "Color").map(str::to_string);
    let reference = root.clone();
    // The set's own shape where it holds a MIDI clip that carries a new clip's settings; else the shape Live's loader took for a
    // clip made by hand (crafted_clip), as Consolidate takes it.
    let mut made = edit::shape_donor(&reference, track)
        .and_then(|donor| edit::blank_clip(&reference, &donor, colour.as_deref(), length).ok())
        .unwrap_or_else(|| crafted_clip(colour.as_deref(), length));
    edit::apply_notes(&mut made, &named)?;
    let take = next_take_id(&reference);
    if let Some(scene) = scene {
        return slot_take(root, track, scene, made, take, name, notes.len())
            .map(|done| (done, take, mpe));
    }
    set_value(&mut made, "CurrentStart", &number_text(start))?;
    set_value(&mut made, "CurrentEnd", &number_text(start + length))?;
    made.set_attr("Time", &number_text(start));
    if made.child("Name").is_some() {
        set_value(&mut made, "Name", name)?;
    }
    // A recorded pass plays once: Live's own takes carry LoopOn false.
    if let Some(looped) = made.child_mut("Loop") {
        set_value(looped, "LoopOn", "false")?;
    }
    take_id_of(&mut made, take);
    let tempo = edit::steady_tempo(root);
    let was = lane_ids(part);
    let target = listed_mut(root, track)?;
    let lanes = take_lanes_mut(target);
    let lane = lanes
        .children
        .iter()
        .filter(|l| l.name == "TakeLane")
        .count();
    let lane_id = lanes
        .children
        .iter()
        .filter(|l| l.name == "TakeLane")
        .filter_map(|l| l.attr("Id")?.parse::<usize>().ok())
        .max()
        .map_or(0, |id| id + 1);
    let mut taken = made.clone();
    taken.set_attr("Id", "0");
    lanes.children.push(fresh_take_lane(lane_id, name, taken));
    edit::lay_over(
        target,
        "ClipTimeable",
        start,
        start + length,
        tempo,
        vec![made],
    )?;
    let now = lane_ids(target);
    let laid = now.iter().position(|i| !was.contains(i));
    Ok((
        Done {
            words: format!(
                "Recorded {name} on {part_name} at beat {}: {} note{}, in take lane {}.",
                number_text(start),
                notes.len(),
                if notes.len() == 1 { "" } else { "s" },
                lane + 1
            ),
            at: laid.map(|j| json!({"track": track, "arrangement": j, "take": take, "lane": lane})),
            places: Places::Lane {
                track: id,
                before: was,
                after: now,
                dropped: None,
                copied: Vec::new(),
            },
        },
        take,
        mpe,
    ))
}

/// The clip a take made carries the take's `TakeId`.
fn take_id_of(made: &mut Element, take: u64) {
    match made.child_mut("TakeId") {
        Some(field) => field.set_attr("Value", &take.to_string()),
        None => made
            .children
            .push(value_element("TakeId", &take.to_string())),
    }
}

/// A pass recorded into the empty slot in row `scene` of an armed MIDI part (O-I #743; Live: an armed track's empty slots are record
/// buttons, so the part's `Recorder/IsArmed` must stand true): the take's clip `made` (Insert MIDI Clip's shape) stands in the slot
/// under its name, carrying `take`, with no `Time` — a session-slot clip carries none (session-model.md §7: the anchoring attribute is
/// "absent on session-slot clips") — and its loop off, as Live's own takes carry it, the one loop state a recorded pass is attested in
/// (take lanes, `take_record`). Nothing else of the part moves.
fn slot_take(
    root: &mut Element,
    track: usize,
    scene: usize,
    mut made: Element,
    take: u64,
    name: &str,
    notes: usize,
) -> Result<Done, String> {
    let scenes = scene_count(root);
    let part = track_at(root, track)?;
    let part_name = track_name(part);
    let armed = part
        .child("DeviceChain")
        .and_then(|chain| chain.child("MainSequencer"))
        .and_then(|sequencer| sequencer.child("Recorder"))
        .and_then(|recorder| edit::flag(recorder, "IsArmed"))
        == Some(true);
    if !armed {
        return Err(format!(
            "{part_name} is not armed: Live records into a slot of an armed part, so arm it first"
        ));
    }
    if made.child("Name").is_some() {
        set_value(&mut made, "Name", name)?;
    }
    made.attrs.retain(|(attr, _)| attr != "Time");
    if let Some(looped) = made.child_mut("Loop") {
        set_value(looped, "LoopOn", "false")?;
    }
    take_id_of(&mut made, take);
    let slot = slot_mut(listed_mut(root, track)?, scene, scenes)?;
    if held(slot) {
        return Err(format!(
            "The slot in row {} of {part_name} holds a clip: Live records into an empty slot",
            scene + 1
        ));
    }
    slot_value(slot)?.children = vec![made];
    Ok(Done {
        words: format!(
            "Recorded {name} on {part_name} into the slot in row {}: {notes} note{}.",
            scene + 1,
            if notes == 1 { "" } else { "s" }
        ),
        at: Some(json!({"track": track, "slot": scene, "take": take})),
        places: Places::None,
    })
}

/// Keep the part's Torus beside the set (none: it keeps none). The set is
/// read, never written: its revision must stand as the person read it.
fn torus_keep(
    path: &str,
    expected_revision: &str,
    track: usize,
    torus: Option<&Value>,
) -> Result<Value, String> {
    let (bytes, root) = edit::open(path)?;
    let standing = edit::revision(&bytes);
    if standing != expected_revision {
        return Err("The set changed since it was read (Live may have saved it): read it again and make the change on what stands".into());
    }
    let part = track_at(&root, track)?;
    if part.name != "MidiTrack" {
        return Err("The Torus plays a MIDI part, and this track is not one".into());
    }
    let id = track_id(part)?;
    crate::sources::set_torus(std::path::Path::new(path), &id, torus)?;
    let name = track_name(part);
    let words = match torus {
        Some(_) => format!("{name} keeps the Torus as it stands."),
        None => format!("{name} keeps no Torus."),
    };
    Ok(json!({"act": "torus_keep", "done": words, "at": {"track": track}, "revision": standing}))
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
    acted(path, expected_revision, act, None, &|| Ok(()))
}

/// [`act`], with an audio part's consolidated sample where the act is its Consolidate (`consolidate_audio`), and `before` run
/// once the act is made and before the document is written (a refusal from it leaves the document as it stood).
fn acted(
    path: &str,
    expected_revision: &str,
    act: &SetAct,
    sample: Option<&Consolidated>,
    before: &dyn Fn() -> Result<(), String>,
) -> Result<Value, String> {
    if let SetAct::TorusKeep { track, torus } = act {
        return torus_keep(path, expected_revision, *track, torus.as_ref());
    }
    if let SetAct::TakeRecord {
        keeps: Some(keeps), ..
    } = act
    {
        crate::sources::checked_take_keeps(keeps)?;
    }
    let mut take = None;
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
            SetAct::TrackInsert { after } => track_insert(root, *after)?,
            SetAct::SceneInsert { after } => scene_insert(root, *after)?,
            SetAct::SceneRename { scene, name } => scene_rename(root, *scene, name)?,
            SetAct::GlobalQuantize { quantize } => global_quantize(root, quantize)?,
            SetAct::SceneDuplicate { scene } => scene_duplicate(root, *scene)?,
            SetAct::SceneDelete { scene } => scene_delete(root, *scene)?,
            SetAct::TrackColour { track, colour } => track_colour(root, *track, *colour)?,
            SetAct::TracksGroup { tracks } => tracks_group(root, tracks)?,
            SetAct::ClipSplit { track, clip, at } => clip_split(root, *track, *clip, *at)?,
            SetAct::ClipsConsolidate { track, from, to } => {
                clips_consolidate(root, *track, *from, *to, sample)?
            }
            SetAct::ClipCrop {
                track,
                clip,
                from,
                to,
            } => clip_crop(root, *track, *clip, span_of(*from, *to)?, sample)?,
            SetAct::TakeRecord {
                track,
                start,
                length,
                name,
                notes,
                scene,
                ..
            } => {
                let (done, id, mpe) =
                    take_record(root, *track, *start, *length, name, notes, *scene)?;
                take = Some((*track, id, mpe));
                done
            }
            SetAct::RackPlace {
                track,
                name,
                macros,
                variations,
                chain,
            } => rack_place(root, *track, name, macros, variations, chain)?,
            SetAct::TorusKeep { .. } => unreachable!("kept above, the set unwritten"),
        });
        before()
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
    // What the take keeps beyond its notes, and its notes' MPE by their NoteIds (O-I #853), beside the set.
    let kept = match (act, take) {
        (SetAct::TakeRecord { keeps, .. }, Some((track, id, mpe)))
            if keeps.is_some() || !mpe.is_empty() =>
        {
            let mut kept = keeps.clone().unwrap_or_else(|| json!({}));
            if !mpe.is_empty() {
                kept["mpe"] = Value::Array(mpe);
            }
            Some((track, id, kept))
        }
        _ => None,
    };
    if let Some((track, id, keeps)) = kept {
        let kept = crate::edit::track_at(&_root, track)
            .and_then(track_id)
            .and_then(|track| {
                crate::sources::set_keeps(std::path::Path::new(path), &track, id, &keeps)
            });
        if let Err(why) = kept {
            answer["keepsRefused"] = json!(format!(
                "The take was recorded, but what it keeps beside its notes was not kept: {why}"
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

    #[test]
    fn the_transport_sets_the_sets_quantize_through_its_own_act_and_refuses_what_live_does_not_name(
    ) {
        let with = TIDE.replace("<LiveSet>", r#"<LiveSet><GlobalQuantisation Value="4" />"#);
        let (_dir, path) = set_file(&with);
        assert_eq!(reread(&path).1.global_quantize.as_deref(), Some("1 bar"));
        let set = run(
            &path,
            SetAct::GlobalQuantize {
                quantize: "1/16".into(),
            },
        )
        .unwrap();
        assert_eq!(set["act"], "global_quantize");
        assert_eq!(set["done"], "Set the set's Quantize from 1 bar to 1/16.");
        assert_eq!(set["at"], json!({"quantize": "1/16"}));
        let (root, document) = reread(&path);
        assert_eq!(document.global_quantize.as_deref(), Some("1/16"));
        assert_eq!(
            root.find("GlobalQuantisation")
                .and_then(|q| q.attr("Value")),
            Some("11"),
            "Live's index among the set's own words"
        );
        run(
            &path,
            SetAct::GlobalQuantize {
                quantize: "None".into(),
            },
        )
        .unwrap();
        assert_eq!(reread(&path).1.global_quantize.as_deref(), Some("none"));
        for word in ["global", "3 bars", ""] {
            let before = standing(&path);
            let refused = run(
                &path,
                SetAct::GlobalQuantize {
                    quantize: word.into(),
                },
            )
            .unwrap_err();
            assert!(
                refused.starts_with("The set's Quantize takes one of none, 8 bars"),
                "{word}: {refused}"
            );
            assert_eq!(standing(&path), before, "{word}: the set stands as it was");
        }
        let (_bare, bare) = set_file(TIDE);
        assert_eq!(
            run(
                &bare,
                SetAct::GlobalQuantize {
                    quantize: "1 bar".into()
                }
            )
            .unwrap_err(),
            "The set keeps no transport Quantize to set"
        );
        let carried: SetAct =
            serde_json::from_value(json!({"kind": "global_quantize", "quantize": "2 bars"}))
                .unwrap();
        assert_eq!(
            carried,
            SetAct::GlobalQuantize {
                quantize: "2 bars".into()
            }
        );
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

    // O-I #743, Record into a slot: a take's clip made in its part's own shape stands at Time 0, as an arrangement clip does (edit.rs
    // blank_clip); laid in a slot it carries no Time (session-model.md §7: the anchoring attribute is "absent on session-slot clips"),
    // and its loop is off, as Live's own takes carry it.
    #[test]
    fn a_take_laid_in_a_slot_carries_no_time_though_the_shape_it_was_made_in_did() {
        let armed = SET.replacen(
            "</ClipSlotList>",
            r#"</ClipSlotList><Recorder><IsArmed Value="true"/></Recorder>"#,
            1,
        );
        let mut root = crate::xml::parse(&armed).unwrap();
        let mut made = crafted_clip(None, 4.0);
        made.set_attr("Time", "0");
        let done = slot_take(&mut root, 0, 1, made, 9, "Take 9", 1).unwrap();
        assert!(
            done.words.contains("into the slot in row 2"),
            "{}",
            done.words
        );
        let scenes = scene_count(&root);
        let slot = slot_mut(listed_mut(&mut root, 0).unwrap(), 1, scenes).unwrap();
        let clip = &slot_value(slot).unwrap().children[0];
        assert_eq!(
            clip.attr("Time"),
            None,
            "a session-slot clip carries no Time"
        );
        assert_eq!(
            clip.child("Loop")
                .and_then(|looped| value_of(looped, "LoopOn")),
            Some("false"),
            "its loop off, as Live's takes"
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

    /// Insert MIDI Track (⌘⇧T; O-I #852, DLW §21.2 "Drag it onto a part to play it"): a new empty MIDI part, in Live 12's own shape
    /// as this set writes a MIDI track, its every slot empty, no clip on its ruler, no take lane, no device and no envelope, its
    /// mixer at Live's own (0 dB, centre, on, every send off), named as Live names one by its place ("2-MIDI").
    #[test]
    fn a_midi_part_is_inserted_empty_in_lives_own_shape() {
        let (_dir, path) = set_file(SET);
        let inserted = run(&path, SetAct::TrackInsert { after: Some(0) }).unwrap();
        assert_eq!(
            inserted["done"],
            "Inserted 2-MIDI, an empty MIDI part, right after Keys."
        );
        assert_eq!(inserted["at"], json!({"track": 1}));
        let (root, document) = reread(&path);
        let names: Vec<&str> = document.tracks.iter().map(|t| t.name.as_str()).collect();
        assert_eq!(
            names,
            vec!["Keys", "2-MIDI", "Group", "Bass", "Drums", "A-Reverb", "Master"]
        );
        let part = &document.tracks[1];
        assert_eq!(part.kind, document.tracks[0].kind, "a MIDI part");
        assert_eq!(
            part.session_slots,
            vec![None, None],
            "a slot for every row, each empty"
        );
        assert!(part.arrangement_clips.is_empty() && part.devices.is_empty());
        let made = crate::edit::track_at(&root, 1).unwrap();
        assert_eq!(made.attr("Id"), Some("18"), "the set's next track Id");
        assert_eq!(
            made.child("TrackGroupId").and_then(|g| g.attr("Value")),
            Some("-1")
        );
        assert!(made.find("AutomationEnvelope").is_none() && made.find("ClipEnvelope").is_none());
        let volume = made
            .find("Mixer")
            .and_then(|m| m.child("Volume"))
            .and_then(|v| v.child("Manual"))
            .unwrap();
        assert_eq!(volume.attr("Value"), Some("1"));
        // Its pointees are its own, allocated past the set's: nothing of Keys is pointed at from it.
        let counter = root
            .find("LiveSet")
            .unwrap()
            .child("NextPointeeId")
            .unwrap()
            .attr("Value")
            .unwrap()
            .parse::<u64>()
            .unwrap();
        assert!(counter > 2000, "{counter}");
        // Keys is as it was.
        assert_eq!(slots(&document, 0)[0].as_deref(), Some("Riff"));
        // After a group's member it stands in that group; with none named it stands after the last part, before the returns.
        run(&path, SetAct::TrackInsert { after: Some(3) }).unwrap();
        let (root, document) = reread(&path);
        assert_eq!(document.tracks[4].name, "5-MIDI");
        assert_eq!(
            crate::edit::track_at(&root, 4)
                .unwrap()
                .child("TrackGroupId")
                .and_then(|g| g.attr("Value")),
            Some("17")
        );
        let appended = run(&path, SetAct::TrackInsert { after: None }).unwrap();
        assert_eq!(appended["at"], json!({"track": 6}));
        let (_, document) = reread(&path);
        let names: Vec<&str> = document.tracks.iter().map(|t| t.name.as_str()).collect();
        assert_eq!(
            names,
            vec![
                "Keys", "2-MIDI", "Group", "Bass", "5-MIDI", "Drums", "7-MIDI", "A-Reverb",
                "Master"
            ]
        );
        // Refused in words: after a return track, or after no track of the set.
        assert!(run(&path, SetAct::TrackInsert { after: Some(7) })
            .unwrap_err()
            .contains("return track"));
        assert!(run(&path, SetAct::TrackInsert { after: Some(40) })
            .unwrap_err()
            .contains("no track"));
        // A set with no MIDI part has no shape of Live's own to make one from here, and says so.
        let (_dir, audio) = set_file(
            &SET.replace("<MidiTrack Id=\"12\">", "<AudioTrack Id=\"12\">")
                .replace("</MidiTrack>\n<GroupTrack", "</AudioTrack>\n<GroupTrack")
                .replace("<MidiTrack Id=\"13\">", "<AudioTrack Id=\"13\">")
                .replace(
                    "</MidiTrack>\n<AudioTrack Id=\"8\">",
                    "</AudioTrack>\n<AudioTrack Id=\"8\">",
                ),
        );
        assert!(run(&audio, SetAct::TrackInsert { after: None })
            .unwrap_err()
            .contains("MIDI part"));
        // The wire names it as the shell sends it.
        let wire: SetAct =
            serde_json::from_value(json!({"kind": "track_insert", "after": 0})).unwrap();
        assert_eq!(wire, SetAct::TrackInsert { after: Some(0) });
        let wire: SetAct = serde_json::from_value(json!({"kind": "track_insert"})).unwrap();
        assert_eq!(wire, SetAct::TrackInsert { after: None });
    }

    /// A rack placed on a part (O-I #852; DLW §21.2 "Drag it onto a part to play it"): Live 12's Instrument Rack as Quick Start
    /// Beat's racks stand (racks-session-model.md §1.2 the chassis, §1.3 the chain, §1.7 the macros and their snapshots): the
    /// device's boilerplate, one chain named after the rack with its own mixer and zones and no device on it, the rack's macros by
    /// name and value (Live's 0 to 127) and the rest Live's own "Macro N" at 0, each variation a snapshot with a value for every
    /// macro it names and none for the rest, and every pointee its own, allocated past the set's.
    #[test]
    fn a_rack_stands_on_a_part_as_lives_instrument_rack_with_its_macros_and_variations() {
        fn gather(element: &Element, ids: &mut Vec<u64>) {
            if is_pointee(element) {
                ids.push(element.attr("Id").unwrap().parse().unwrap());
            }
            for child in &element.children {
                gather(child, ids);
            }
        }
        let counter = |root: &Element| {
            root.find("LiveSet")
                .and_then(|set| set.child("NextPointeeId"))
                .and_then(|n| n.attr("Value"))
                .and_then(|v| v.parse::<u64>().ok())
                .unwrap()
        };
        let value = |e: &Element, child: &str| {
            e.child(child)
                .and_then(|c| c.attr("Value"))
                .map(str::to_string)
        };
        let (_dir, path) = set_file(SET);
        run(&path, SetAct::TrackInsert { after: Some(0) }).unwrap();
        let before = counter(&reread(&path).0);
        // The wire names it as the shell sends it.
        let wire: SetAct = serde_json::from_value(json!({"kind": "rack_place", "track": 1, "name": "Warm rack",
            "macros": [{"name": "Bloom", "value": 0.5}, {"name": "Air", "value": 1.0}],
            "variations": [{"name": "Open", "values": [1.0, 0.25]}, {"name": "Closed", "values": [0.0, 0.0]}], "chain": []}))
        .unwrap();
        let placed = run(&path, wire).unwrap();
        assert_eq!(placed["act"], "rack_place");
        assert_eq!(
            placed["done"],
            "Placed Warm rack on 2-MIDI: an Instrument Rack with 2 macros and 2 variations."
        );
        assert_eq!(placed["at"], json!({"track": 1}));
        let (root, document) = reread(&path);
        let names: Vec<&str> = document.tracks[1]
            .devices
            .iter()
            .map(|d| d.name.as_str())
            .collect();
        assert_eq!(
            names,
            vec!["InstrumentGroupDevice"],
            "the part's one device"
        );
        let rack = crate::edit::track_at(&root, 1)
            .unwrap()
            .child("DeviceChain")
            .and_then(|c| c.child("DeviceChain"))
            .and_then(|c| c.child("Devices"))
            .and_then(|d| d.child("InstrumentGroupDevice"))
            .unwrap();
        assert_eq!(
            rack.attr("Id"),
            Some("0"),
            "a device list's member carries its Id"
        );
        assert_eq!(value(rack, "UserName").as_deref(), Some("Warm rack"));
        // Live's own chassis, in Live's order, with each family of sixteen numbered 0 to 15.
        let chassis: Vec<&str> = rack
            .children
            .iter()
            .map(|c| c.name.as_str())
            .filter(|n| !n.contains('.'))
            .collect();
        assert_eq!(
            chassis,
            vec![
                "LomId",
                "LomIdView",
                "IsExpanded",
                "On",
                "ModulationSourceCount",
                "ParametersListWrapper",
                "Pointee",
                "LastSelectedTimeableIndex",
                "LastSelectedClipEnvelopeIndex",
                "LastPresetRef",
                "LockedScripts",
                "IsFolded",
                "ShouldShowPresetName",
                "UserName",
                "Annotation",
                "SourceContext",
                "OverwriteProtectionNumber",
                "Branches",
                "IsBranchesListVisible",
                "IsReturnBranchesListVisible",
                "IsRangesEditorVisible",
                "AreDevicesVisible",
                "NumVisibleMacroControls",
                "AreMacroControlsVisible",
                "IsAutoSelectEnabled",
                "ChainSelector",
                "ChainSelectorRelativePosition",
                "ViewsToRestoreWhenUnfolding",
                "ReturnBranches",
                "BranchesSplitterProportion",
                "ShowBranchesInSessionMixer",
                "LockId",
                "LockSeal",
                "ChainsListWrapper",
                "ReturnChainsListWrapper",
                "MacroVariations",
                "AreMacroVariationsControlsVisible",
                "ChainSelectorFilterMidiCtrl",
                "RangeTypeIndex",
                "ShowsZonesInsteadOfNoteNames"
            ]
        );
        for family in [
            "MacroControls",
            "MacroDisplayNames",
            "MacroDefaults",
            "MacroAnnotations",
            "ForceDisplayGenericValue",
            "MacroColor",
            "ExcludeMacroFromRandomization",
            "ExcludeMacroFromSnapshots",
        ] {
            let held: Vec<String> = rack
                .children
                .iter()
                .filter_map(|c| {
                    c.name
                        .strip_prefix(&format!("{family}."))
                        .map(str::to_string)
                })
                .collect();
            assert_eq!(
                held,
                (0..16).map(|i| i.to_string()).collect::<Vec<_>>(),
                "{family}"
            );
        }
        let manual = |i: usize| {
            rack.child(&format!("MacroControls.{i}"))
                .and_then(|m| m.child("Manual"))
                .and_then(|m| m.attr("Value"))
                .map(str::to_string)
        };
        assert_eq!(
            [manual(0), manual(1), manual(2)],
            [Some("63.5".into()), Some("127".into()), Some("0".into())],
            "a macro stands where it was kept, on Live's 0 to 127"
        );
        assert_eq!(
            [
                "MacroDisplayNames.0",
                "MacroDisplayNames.1",
                "MacroDisplayNames.2",
                "MacroDefaults.0",
                "NumVisibleMacroControls"
            ]
            .map(|child| value(rack, child)),
            [
                Some("Bloom".into()),
                Some("Air".into()),
                Some("Macro 3".into()),
                Some("63.5".into()),
                Some("8".into())
            ]
        );
        assert_eq!(
            rack.child("LastPresetRef")
                .and_then(|p| p.find("DeviceId"))
                .and_then(|d| d.attr("Name")),
            Some("InstrumentGroupDevice"),
            "a rack made here, not a preset's"
        );
        // One chain, named after the rack: no device on it, its own mixer and its zones.
        let branches = rack.child("Branches").unwrap();
        assert_eq!(list_ids(branches), vec!["0"]);
        let chain = &branches.children[0];
        assert_eq!(chain.name, "InstrumentBranch");
        assert_eq!(
            chain
                .child("Name")
                .and_then(|n| n.child("EffectiveName"))
                .and_then(|e| e.attr("Value")),
            Some("Warm rack")
        );
        let devices = chain
            .child("DeviceChain")
            .and_then(|d| d.child("MidiToAudioDeviceChain"))
            .and_then(|d| d.child("Devices"))
            .unwrap();
        assert!(devices.children.is_empty(), "the chain holds no device");
        let mixer = chain.child("MixerDevice").unwrap();
        assert_eq!(
            mixer
                .child("Volume")
                .and_then(|v| v.child("Manual"))
                .and_then(|m| m.attr("Value")),
            Some("1")
        );
        assert!(chain
            .child("ZoneSettings")
            .and_then(|z| z.child("KeyRange"))
            .is_some());
        // Each variation is a snapshot: a value for every macro it names, none for the rest.
        let snapshots = rack
            .child("MacroVariations")
            .and_then(|v| v.child("MacroSnapshots"))
            .unwrap();
        assert_eq!(list_ids(snapshots), vec!["0", "1"]);
        let open = &snapshots.children[0];
        assert_eq!(
            [
                "SnapshotName",
                "MacroValues.0",
                "MacroValues.1",
                "MacroValues.2",
                "MacroHasValue.1",
                "MacroHasValue.2"
            ]
            .map(|child| value(open, child)),
            [
                Some("Open".into()),
                Some("127".into()),
                Some("31.75".into()),
                Some("-1".into()),
                Some("true".into()),
                Some("false".into())
            ]
        );
        assert_eq!(
            value(&snapshots.children[1], "SnapshotName").as_deref(),
            Some("Closed")
        );
        assert_eq!(
            value(rack, "AreMacroVariationsControlsVisible").as_deref(),
            Some("true")
        );
        // Every pointee its own, past the set's, and the set's counter past them all.
        let mut held = Vec::new();
        gather(rack, &mut held);
        assert!(
            held.len() > 40 && held.iter().all(|id| *id >= before),
            "{held:?}"
        );
        let mut all = Vec::new();
        gather(root.find("LiveSet").unwrap(), &mut all);
        let distinct: std::collections::BTreeSet<&u64> = all.iter().collect();
        assert_eq!(distinct.len(), all.len(), "no pointee is shared");
        assert!(counter(&root) > *held.iter().max().unwrap());
        // Nine macros show sixteen; a rack with no variation keeps no snapshot.
        let nine: Vec<PlacedMacro> = (0..9)
            .map(|i| PlacedMacro {
                name: format!("M{i}"),
                value: 0.0,
            })
            .collect();
        let bass = run(
            &path,
            SetAct::RackPlace {
                track: 3,
                name: "Low".into(),
                macros: nine.clone(),
                variations: vec![],
                chain: vec![],
            },
        )
        .unwrap();
        assert_eq!(
            bass["done"],
            "Placed Low on Bass: an Instrument Rack with 9 macros and no variations."
        );
        let (root, _) = reread(&path);
        let low = crate::edit::track_at(&root, 3)
            .unwrap()
            .find("InstrumentGroupDevice")
            .unwrap();
        assert_eq!(value(low, "NumVisibleMacroControls").as_deref(), Some("16"));
        assert!(low
            .child("MacroVariations")
            .and_then(|v| v.child("MacroSnapshots"))
            .unwrap()
            .children
            .is_empty());
        assert_eq!(
            value(low, "AreMacroVariationsControlsVisible").as_deref(),
            Some("false")
        );
        // Refused in words, the set unwritten: a part that holds a device, a track that is no MIDI part, more than Live's sixteen
        // macros, a variation without a value for every macro, a value off 0 to 1, and a nameless rack.
        let standing_now = standing(&path);
        let refused = |act: SetAct| run(&path, act).unwrap_err();
        let one = vec![PlacedMacro {
            name: "Bloom".into(),
            value: 0.5,
        }];
        let place = |track: usize,
                     name: &str,
                     macros: Vec<PlacedMacro>,
                     variations: Vec<PlacedVariation>| SetAct::RackPlace {
            track,
            name: name.into(),
            macros,
            variations,
            chain: vec![],
        };
        assert!(refused(place(1, "Again", one.clone(), vec![])).contains("holds a device already"));
        assert!(refused(place(4, "Warm rack", one.clone(), vec![])).contains("MIDI part"));
        let seventeen: Vec<PlacedMacro> = (0..17)
            .map(|i| PlacedMacro {
                name: format!("M{i}"),
                value: 0.0,
            })
            .collect();
        assert!(refused(place(1, "Warm rack", seventeen, vec![])).contains("at most 16 macros"));
        let short = vec![PlacedVariation {
            name: "Open".into(),
            values: vec![],
        }];
        assert!(
            refused(place(1, "Warm rack", one.clone(), short)).contains("a value for every macro")
        );
        let high = vec![PlacedMacro {
            name: "Bloom".into(),
            value: 1.5,
        }];
        assert!(refused(place(1, "Warm rack", high, vec![])).contains("between 0 and 1"));
        assert!(refused(place(1, " ", one.clone(), vec![])).contains("A rack's name"));
        assert!(refused(place(40, "Warm rack", one, vec![])).contains("no track"));
        assert_eq!(standing(&path), standing_now, "nothing refused is written");
    }

    /// O-I #852 round 10: a placed rack's chain holds Live's own devices, each as a set stores it (session-model.md §6): the device's
    /// boilerplate under its class, then each setting carried onto it in Live's parameter pattern, its controller range the corpus's
    /// surface (live-dynamics params), its switch as Live writes On; what is not carried is not written. Every pointee is allocated
    /// past the set's, and a device or setting the corpus does not give is refused in words, by name, with the set unwritten.
    #[test]
    fn a_racks_chain_stands_on_it_as_lives_own_devices_with_the_settings_carried() {
        fn gather(element: &Element, ids: &mut Vec<u64>) {
            if is_pointee(element) {
                ids.push(element.attr("Id").unwrap().parse().unwrap());
            }
            for child in &element.children {
                gather(child, ids);
            }
        }
        let value = |e: &Element, path: &[&str]| {
            let mut at = e;
            for step in path {
                at = at.child(step)?;
            }
            at.attr("Value").map(str::to_string)
        };
        let (_dir, path) = set_file(SET);
        run(&path, SetAct::TrackInsert { after: Some(0) }).unwrap();
        let wire: SetAct = serde_json::from_value(json!({"kind": "rack_place", "track": 1, "name": "Warm rack",
            "macros": [], "variations": [], "chain": [
                {"device": "Reverb", "parameters": [{"id": "DecayTime", "value": 2400.0}, {"id": "On", "value": 1.0}, {"id": "PreDelay", "value": 20.0}]},
                {"device": "Compressor2", "parameters": [{"id": "On", "value": 0.0}]}]}))
        .unwrap();
        let placed = run(&path, wire).unwrap();
        assert_eq!(
            placed["done"],
            "Placed Warm rack on 2-MIDI: an Instrument Rack with no macros and no variations, its chain holding Live's Reverb and Compressor."
        );
        let (root, _) = reread(&path);
        let devices = crate::edit::track_at(&root, 1)
            .unwrap()
            .find("InstrumentGroupDevice")
            .and_then(|r| r.child("Branches"))
            .and_then(|b| b.child("InstrumentBranch"))
            .and_then(|c| c.child("DeviceChain"))
            .and_then(|d| d.child("MidiToAudioDeviceChain"))
            .and_then(|d| d.child("Devices"))
            .unwrap();
        assert_eq!(
            list_ids(devices),
            vec!["0", "1"],
            "each device a list member with its Id"
        );
        let classes: Vec<&str> = devices.children.iter().map(|d| d.name.as_str()).collect();
        assert_eq!(
            classes,
            vec!["Reverb", "Compressor2"],
            "in the chain's order"
        );
        let reverb = &devices.children[0];
        let children: Vec<&str> = reverb.children.iter().map(|c| c.name.as_str()).collect();
        assert_eq!(
            children,
            vec![
                "LomId",
                "LomIdView",
                "IsExpanded",
                "On",
                "ModulationSourceCount",
                "ParametersListWrapper",
                "Pointee",
                "LastSelectedTimeableIndex",
                "LastSelectedClipEnvelopeIndex",
                "LastPresetRef",
                "LockedScripts",
                "IsFolded",
                "ShouldShowPresetName",
                "UserName",
                "Annotation",
                "SourceContext",
                "OverwriteProtectionNumber",
                "PreDelay",
                "DecayTime"
            ],
            "the boilerplate, then what is carried, in the surface's order"
        );
        assert_eq!(
            reverb
                .child("LastPresetRef")
                .and_then(|p| p.find("DeviceId"))
                .and_then(|d| d.attr("Name")),
            Some("Reverb")
        );
        assert_eq!(value(reverb, &["On", "Manual"]).as_deref(), Some("true"));
        assert_eq!(
            value(&devices.children[1], &["On", "Manual"]).as_deref(),
            Some("false"),
            "a device kept off stands off"
        );
        for (parameter, manual, min, max) in [
            ("DecayTime", "2400", "199.999985", "60000.0039"),
            ("PreDelay", "20", "0.5", "249.999969"),
        ] {
            assert_eq!(
                [
                    value(reverb, &[parameter, "Manual"]),
                    value(reverb, &[parameter, "MidiControllerRange", "Min"]),
                    value(reverb, &[parameter, "MidiControllerRange", "Max"])
                ],
                [Some(manual.into()), Some(min.into()), Some(max.into())],
                "{parameter}"
            );
            let held = reverb.child(parameter).unwrap();
            assert!(
                held.child("AutomationTarget").is_some()
                    && held.child("ModulationTarget").is_some()
            );
        }
        // Every pointee of the chain its own, allocated with the rack's.
        let mut all = Vec::new();
        gather(root.find("LiveSet").unwrap(), &mut all);
        let distinct: std::collections::BTreeSet<&u64> = all.iter().collect();
        assert_eq!(distinct.len(), all.len(), "no pointee is shared");
        let mut chain = Vec::new();
        gather(devices, &mut chain);
        assert!(
            chain.len() >= 6 && chain.iter().all(|id| *id > 0),
            "{chain:?}"
        );
        // Refused in words, by name, the set unwritten.
        run(&path, SetAct::TrackInsert { after: Some(1) }).unwrap();
        let standing_now = standing(&path);
        let one = |device: &str, id: &str, value: f64| PlacedDevice {
            device: device.into(),
            parameters: vec![PlacedParameter {
                id: id.into(),
                value,
            }],
        };
        let refused = |chain: Vec<PlacedDevice>| {
            run(
                &path,
                SetAct::RackPlace {
                    track: 2,
                    name: "Cold rack".into(),
                    macros: vec![],
                    variations: vec![],
                    chain,
                },
            )
            .unwrap_err()
        };
        for (chain, words) in [
            (
                vec![one("MidiScale", "On", 1.0)],
                "Live's MidiScale has no parameter surface in the corpus",
            ),
            (
                vec![one("Operator", "On", 1.0)],
                "Live's Operator is an instrument",
            ),
            (
                vec![one("Reverb", "RoomSize", 1.0)],
                "Live's Reverb has no setting RoomSize in the corpus's surface",
            ),
            (
                vec![one("Reverb", "DecayTime", 70000.0)],
                "Live's Reverb holds DecayTime between 199.999985 and 60000.0039, not 70000",
            ),
            (
                vec![one("AutoFilter", "FilterType", 1.0)],
                "Live's Auto Filter keeps FilterType as a menu",
            ),
            (
                vec![one("Compressor2", "SideChain/OnOff", 1.0)],
                "Live's Compressor keeps SideChain/OnOff inside SideChain",
            ),
            (vec![one("Reverb", "On", 0.5)], "Live's Reverb is on or off"),
            (
                vec![PlacedDevice {
                    device: "Reverb".into(),
                    parameters: vec![
                        PlacedParameter {
                            id: "PreDelay".into(),
                            value: 1.0,
                        },
                        PlacedParameter {
                            id: "PreDelay".into(),
                            value: 2.0,
                        },
                    ],
                }],
                "Live's Reverb is given PreDelay twice",
            ),
            (
                (0..65).map(|_| one("Reverb", "On", 1.0)).collect(),
                "A rack's chain holds at most 64 devices",
            ),
        ] {
            let why = refused(chain);
            assert!(why.contains(words), "{why}");
        }
        assert_eq!(standing(&path), standing_now, "nothing refused is written");
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

    /// An audio part in Live 12's shape (the template's AudioClip: its loop markers in seconds while unwarped, its fades, warp
    /// markers and SampleRef), two clips on its lane at 120 BPM: Room 0–4 and Answer 4–8.
    const AUDIO_LANE: &str = r#"<?xml version="1.0" encoding="UTF-8"?>
<Ableton MajorVersion="5" MinorVersion="12.0_12049"><LiveSet><Tracks>
<AudioTrack Id="8"><Name><EffectiveName Value="Vox"/><UserName Value=""/></Name><Color Value="26"/><TrackGroupId Value="-1"/>
<DeviceChain><MainSequencer><ClipSlotList/><Sample><ArrangerAutomation><Events>
<AudioClip Id="0" Time="0"><CurrentStart Value="0"/><CurrentEnd Value="4"/><Loop><LoopStart Value="0"/><LoopEnd Value="2"/><StartRelative Value="0"/><LoopOn Value="false"/><OutMarker Value="2"/><HiddenLoopStart Value="0"/><HiddenLoopEnd Value="2"/></Loop><Name Value="Room"/><Annotation Value=""/><Color Value="3"/><Envelopes><Envelopes><ClipEnvelope Id="0"><EnvelopeTarget><PointeeId Value="1500"/></EnvelopeTarget><Automation><Events/></Automation></ClipEnvelope></Envelopes></Envelopes><Disabled Value="false"/><IsWarped Value="false"/><Fades><FadeInLength Value="0.01"/><FadeOutLength Value="0"/></Fades><PitchCoarse Value="0"/><PitchFine Value="0"/><SampleVolume Value="0.5"/><WarpMarkers><WarpMarker Id="0" SecTime="0" BeatTime="0"/><WarpMarker Id="1" SecTime="0.015625" BeatTime="0.03125"/></WarpMarkers><TakeId Value="1"/><SampleRef><FileRef><RelativePathType Value="1"/><RelativePath Value="room.wav"/><Path Value=""/><Type Value="2"/><LivePackName Value=""/><LivePackId Value=""/><OriginalFileSize Value="0"/><OriginalCrc Value="0"/></FileRef><LastModDate Value="0"/><SourceContext/><SampleUsageHint Value="0"/><DefaultDuration Value="96000"/><DefaultSampleRate Value="48000"/></SampleRef></AudioClip>
<AudioClip Id="1" Time="4"><CurrentStart Value="4"/><CurrentEnd Value="8"/><Loop><LoopStart Value="1"/><LoopEnd Value="3"/><StartRelative Value="0"/><LoopOn Value="false"/><OutMarker Value="3"/><HiddenLoopStart Value="1"/><HiddenLoopEnd Value="3"/></Loop><Name Value="Answer"/><Annotation Value=""/><Color Value="4"/><Envelopes><Envelopes/></Envelopes><Disabled Value="false"/><IsWarped Value="false"/><Fades><FadeInLength Value="0"/><FadeOutLength Value="0"/></Fades><PitchCoarse Value="0"/><PitchFine Value="0"/><SampleVolume Value="1"/><WarpMarkers><WarpMarker Id="0" SecTime="0" BeatTime="0"/><WarpMarker Id="1" SecTime="0.015625" BeatTime="0.03125"/></WarpMarkers><TakeId Value="2"/><SampleRef><FileRef><RelativePathType Value="1"/><RelativePath Value="answer.wav"/><Path Value=""/><Type Value="2"/><LivePackName Value=""/><LivePackId Value=""/><OriginalFileSize Value="0"/><OriginalCrc Value="0"/></FileRef><LastModDate Value="0"/><SourceContext/><SampleUsageHint Value="0"/><DefaultDuration Value="144000"/><DefaultSampleRate Value="48000"/></SampleRef></AudioClip>
</Events></ArrangerAutomation></Sample></MainSequencer><DeviceChain><Devices/></DeviceChain></DeviceChain></AudioTrack>
</Tracks><MainTrack><DeviceChain><Mixer><Tempo><Manual Value="120"/></Tempo></Mixer></DeviceChain></MainTrack><Scenes><Scene Id="0"><Name Value=""/></Scene></Scenes></LiveSet></Ableton>"#;

    /// A 32-bit float WAV of `frames` stereo frames at `rate`, frame `i` at `i / frames` on the left and its negative on the right.
    fn float_wav(frames: usize, rate: u32) -> Vec<u8> {
        let mut data = Vec::with_capacity(frames * 8);
        for i in 0..frames {
            let v = i as f32 / frames as f32;
            data.extend_from_slice(&v.to_le_bytes());
            data.extend_from_slice(&(-v).to_le_bytes());
        }
        let mut out = b"RIFF".to_vec();
        out.extend_from_slice(&(36 + data.len() as u32).to_le_bytes());
        out.extend_from_slice(b"WAVEfmt ");
        out.extend_from_slice(&16u32.to_le_bytes());
        out.extend_from_slice(&3u16.to_le_bytes());
        out.extend_from_slice(&2u16.to_le_bytes());
        out.extend_from_slice(&rate.to_le_bytes());
        out.extend_from_slice(&(rate * 8).to_le_bytes());
        out.extend_from_slice(&8u16.to_le_bytes());
        out.extend_from_slice(&32u16.to_le_bytes());
        out.extend_from_slice(b"data");
        out.extend_from_slice(&(data.len() as u32).to_le_bytes());
        out.extend_from_slice(&data);
        out
    }

    // O-I #743: Consolidate on an audio part (manual §10.9 "In Arrangement view, Split (⌘E), Consolidate (⌘J)"): what its clips play in
    // the stretch, rendered alone by the engine, kept beside the set where Live keeps a consolidated sample, and one AudioClip laid
    // over the stretch that plays it, its SampleRef in the shape session-model.md §5 and the template attest.
    #[test]
    fn consolidate_writes_one_sample_of_what_an_audio_part_plays_beside_the_set_and_lays_the_clip_that_plays_it(
    ) {
        let (dir, path) = set_file(AUDIO_LANE);
        let wav = float_wav(144_000, 48_000);
        let made = consolidate_audio(&path, &standing(&path), 0, 1.0, 7.0, &wav).unwrap();
        let sha: String = {
            use sha2::{Digest, Sha256};
            Sha256::digest(&wav)
                .iter()
                .map(|b| format!("{b:02x}"))
                .collect()
        };
        let relative = format!("Samples/Processed/Consolidate/Room [{}].wav", &sha[..16]);
        assert_eq!(
            made["done"],
            json!(format!("Consolidated 2 audio clips between beat 1 and beat 7 into one, 3 seconds of sound written beside the set as {relative}."))
        );
        assert_eq!(made["at"], json!({"track": 0, "arrangement": 1}));
        assert_eq!(
            made["sample"],
            json!({"path": relative, "sha256": format!("sha256:{sha}"), "bytes": wav.len(), "frames": 144_000, "rate": 48_000})
        );
        assert_eq!(
            std::fs::read(dir.0.join(&relative)).unwrap(),
            wav,
            "the sample is kept beside the set as rendered"
        );
        assert_eq!(
            std::fs::read_to_string(dir.0.join("Samples/Processed/Consolidate/.gitignore"))
                .unwrap(),
            "# Consolidated samples, held by their content hash out of git (DLW §10.3)\n*.wav\n"
        );
        assert_eq!(
            lane_of(&path),
            vec![
                ("Room".into(), 0.0, 1.0),
                ("Room".into(), 1.0, 7.0),
                ("Answer".into(), 7.0, 8.0)
            ],
            "the clips under the stretch give way to it, as a MIDI part's do"
        );
        let (root, _) = reread(&path);
        let lane = crate::edit::main_lane(crate::edit::track_at(&root, 0).unwrap());
        let clip = lane[1];
        assert_eq!(
            (clip.name.as_str(), clip.attr("Time")),
            ("AudioClip", Some("1"))
        );
        let lp = clip.child("Loop").unwrap();
        let markers: Vec<_> = [
            "LoopStart",
            "LoopEnd",
            "StartRelative",
            "LoopOn",
            "OutMarker",
            "HiddenLoopStart",
            "HiddenLoopEnd",
        ]
        .iter()
        .map(|m| value_of(lp, m).unwrap())
        .collect();
        assert_eq!(
            markers,
            ["0", "3", "0", "false", "3", "0", "3"],
            "unwarped, its markers in seconds: the whole sample, once"
        );
        for (child, want) in [
            ("IsWarped", "false"),
            ("SampleVolume", "1"),
            ("PitchCoarse", "0"),
            ("PitchFine", "0"),
            ("Disabled", "false"),
            ("Name", "Room"),
        ] {
            assert_eq!(value_of(clip, child), Some(want), "{child}");
        }
        let fades = clip.child("Fades").unwrap();
        assert_eq!(
            (
                value_of(fades, "FadeInLength"),
                value_of(fades, "FadeOutLength")
            ),
            (Some("0"), Some("0")),
            "what the clips' fades did is in the sample"
        );
        assert!(
            clip.child("Envelopes")
                .unwrap()
                .child("Envelopes")
                .unwrap()
                .children
                .is_empty(),
            "nor does a clip envelope of the clips move it"
        );
        let warp: Vec<_> = clip
            .child("WarpMarkers")
            .unwrap()
            .children
            .iter()
            .map(|m| {
                (
                    m.attr("Id").unwrap(),
                    m.attr("SecTime").unwrap(),
                    m.attr("BeatTime").unwrap(),
                )
            })
            .collect();
        assert_eq!(
            warp,
            [("0", "0", "0"), ("1", "0.015625", "0.03125")],
            "Live's own pair at the set's tempo"
        );
        let sample = clip.child("SampleRef").unwrap();
        let file = sample.child("FileRef").unwrap();
        let folder = std::path::Path::new(&path).parent().unwrap();
        let stored: Vec<_> = [
            "RelativePathType",
            "RelativePath",
            "Path",
            "Type",
            "LivePackName",
            "LivePackId",
            "OriginalFileSize",
            "OriginalCrc",
        ]
        .iter()
        .map(|f| value_of(file, f).unwrap().to_string())
        .collect();
        assert_eq!(
            stored,
            [
                "1".to_string(),
                relative.clone(),
                folder.join(&relative).to_string_lossy().into_owned(),
                "2".into(),
                String::new(),
                String::new(),
                wav.len().to_string(),
                // Live's OriginalCrc of the file (CRC-16/UMTS over its first 16 KiB), reckoned apart from the code under test.
                "44560".into()
            ]
        );
        assert_eq!(
            sample
                .children
                .iter()
                .map(|c| c.name.as_str())
                .collect::<Vec<_>>(),
            [
                "FileRef",
                "LastModDate",
                "SourceContext",
                "SampleUsageHint",
                "DefaultDuration",
                "DefaultSampleRate"
            ]
        );
        assert_eq!(
            (
                value_of(sample, "DefaultDuration"),
                value_of(sample, "DefaultSampleRate")
            ),
            (Some("144000"), Some("48000"))
        );
        assert!(
            crate::edit::num(sample, "LastModDate").unwrap() > 1.7e9,
            "the sample's own time, in seconds"
        );
        // The same render consolidated again keeps the one file; what is not a sample of the stretch is refused, and nothing written.
        let again = consolidate_audio(&path, &standing(&path), 0, 1.0, 7.0, &wav).unwrap();
        assert_eq!(again["sample"]["path"], json!(relative));
        let kept = std::fs::read_dir(dir.0.join("Samples/Processed/Consolidate"))
            .unwrap()
            .count();
        assert_eq!(kept, 2, "the sample and its .gitignore");
        for (bytes, from, to, words) in [
            (b"not a wav".to_vec(), 1.0, 7.0, "is not a WAV file"),
            (
                float_wav(96_000, 48_000),
                1.0,
                7.0,
                "runs 2 seconds, and the stretch 3 seconds at the set's tempo",
            ),
            (
                wav.clone(),
                20.0,
                26.0,
                "No audio clip lies between beat 20 and beat 26",
            ),
            (wav.clone(), 1.0, 1.0, "end after its start"),
        ] {
            let refused =
                consolidate_audio(&path, &standing(&path), 0, from, to, &bytes).unwrap_err();
            assert!(refused.contains(words), "{refused}");
        }
        assert_eq!(
            std::fs::read_dir(dir.0.join("Samples/Processed/Consolidate"))
                .unwrap()
                .count(),
            2,
            "a refused one writes no sample"
        );
        let mut other = wav.clone();
        let last = other.len() - 1;
        other[last] ^= 1;
        let stale = consolidate_audio(&path, "sha256:stale", 0, 1.0, 7.0, &other).unwrap_err();
        assert!(stale.contains("changed since it was read"), "{stale}");
        assert_eq!(
            std::fs::read_dir(dir.0.join("Samples/Processed/Consolidate"))
                .unwrap()
                .count(),
            2,
            "nor does one on a set that changed"
        );
        // A file of the render's own name beside the set that holds another sound is not written over, and nothing is consolidated.
        std::fs::write(dir.0.join(&relative), b"another sound").unwrap();
        let before = standing(&path);
        let held = consolidate_audio(&path, &before, 0, 1.0, 7.0, &wav).unwrap_err();
        assert!(
            held.contains("beside the set holds another sound: nothing was consolidated"),
            "{held}"
        );
        assert_eq!(
            std::fs::read(dir.0.join(&relative)).unwrap(),
            b"another sound",
            "the file beside the set stands as it was"
        );
        assert_eq!(standing(&path), before, "and the set as it was");
        let (_midi_dir, midi) = set_file(LANE);
        let refused = consolidate_audio(&midi, &standing(&midi), 0, 1.0, 7.0, &wav).unwrap_err();
        assert!(refused.contains("is a MIDI part"), "{refused}");
        // The act without a render still says where an audio part's consolidate is made.
        let refused = run(
            &path,
            SetAct::ClipsConsolidate {
                track: 0,
                from: 1.0,
                to: 7.0,
            },
        )
        .unwrap_err();
        assert!(refused.contains("the engine renders it"), "{refused}");
    }

    // Live's OriginalCrc (CRC-16/UMTS over a file's first 16 KiB): the catalogue's check value, and only the first 16 KiB count.
    #[test]
    fn original_crc_is_crc_16_umts_over_a_files_first_16_kib() {
        assert_eq!(
            original_crc(b"123456789"),
            0xFEE8,
            "CRC-16/UMTS's check value"
        );
        assert_eq!(original_crc(b""), 0);
        let mut long = vec![7u8; 20_000];
        let whole = original_crc(&long);
        long[16_384] = 8;
        assert_eq!(
            original_crc(&long),
            whole,
            "a byte past 16 KiB does not count"
        );
        long[16_383] = 8;
        assert_ne!(
            original_crc(&long),
            whole,
            "the last byte of the first 16 KiB does"
        );
    }

    /// A MIDI part and an audio part at 120 BPM for Crop. Verse (0–8) loops 2–6, its start 1 into the loop and its end at 8, with a
    /// note before the loop, two in it (the second running past its end) and one at its end, and a clip envelope with Live's first
    /// event and three more (one before the loop, one in it, one past it). Chorus (10–14) does not loop: it starts at 1 and ends at
    /// 5, its hidden loop 0–2. On the audio part, Room (0–2) unwarped, playing 0.5–1.5 seconds of room.wav, and Swing (4–8) warped,
    /// looping beats 2–6 over three warp markers (4 beats in the first 2 seconds, 3 in the next one).
    const CROP_SET: &str = r#"<?xml version="1.0" encoding="UTF-8"?>
<Ableton MajorVersion="5" MinorVersion="12.0_12049"><LiveSet><Tracks>
<MidiTrack Id="12"><Name><EffectiveName Value="Keys"/><UserName Value=""/></Name><Color Value="26"/><TrackGroupId Value="-1"/>
<DeviceChain><MainSequencer><ClipSlotList>
<ClipSlot Id="0"><LomId Value="0"/><ClipSlot><Value><MidiClip Id="0"><CurrentStart Value="0"/><CurrentEnd Value="4"/><Loop><LoopStart Value="1"/><LoopEnd Value="3"/><StartRelative Value="0"/><LoopOn Value="false"/><OutMarker Value="3"/><HiddenLoopStart Value="0"/><HiddenLoopEnd Value="4"/></Loop><Name Value="Riff"/><Notes><KeyTracks><KeyTrack Id="0"><Notes><MidiNoteEvent Time="0" Duration="1" Velocity="100" OffVelocity="64" IsEnabled="true" NoteId="1"/><MidiNoteEvent Time="2" Duration="1" Velocity="100" OffVelocity="64" IsEnabled="true" NoteId="2"/></Notes><MidiKey Value="60"/></KeyTrack></KeyTracks><NoteIdGenerator><NextId Value="3"/></NoteIdGenerator></Notes></MidiClip></Value></ClipSlot><HasStop Value="true"/><NeedRefreeze Value="true"/></ClipSlot>
</ClipSlotList>
<ClipTimeable><ArrangerAutomation><Events>
<MidiClip Id="0" Time="0"><CurrentStart Value="0"/><CurrentEnd Value="8"/><Loop><LoopStart Value="2"/><LoopEnd Value="6"/><StartRelative Value="1"/><LoopOn Value="true"/><OutMarker Value="8"/><HiddenLoopStart Value="0"/><HiddenLoopEnd Value="8"/></Loop><Name Value="Verse"/><Envelopes><Envelopes><ClipEnvelope Id="0"><EnvelopeTarget><PointeeId Value="1500"/></EnvelopeTarget><Automation><Events><FloatEvent Id="0" Time="-63072000" Value="0"/><FloatEvent Id="1" Time="1" Value="0.2"/><FloatEvent Id="2" Time="3" Value="0.6"/><FloatEvent Id="3" Time="7" Value="1"/></Events></Automation></ClipEnvelope></Envelopes></Envelopes><Notes><KeyTracks><KeyTrack Id="0"><Notes><MidiNoteEvent Time="0" Duration="1" Velocity="100" OffVelocity="64" IsEnabled="true" NoteId="1"/><MidiNoteEvent Time="2" Duration="1" Velocity="90" OffVelocity="64" IsEnabled="true" NoteId="2"/><MidiNoteEvent Time="5.5" Duration="1" Velocity="80" OffVelocity="64" IsEnabled="true" NoteId="3"/><MidiNoteEvent Time="6" Duration="1" Velocity="70" OffVelocity="64" IsEnabled="true" NoteId="4"/></Notes><MidiKey Value="60"/></KeyTrack></KeyTracks><NoteIdGenerator><NextId Value="5"/></NoteIdGenerator></Notes></MidiClip>
<MidiClip Id="1" Time="10"><CurrentStart Value="10"/><CurrentEnd Value="14"/><Loop><LoopStart Value="1"/><LoopEnd Value="5"/><StartRelative Value="0"/><LoopOn Value="false"/><OutMarker Value="5"/><HiddenLoopStart Value="0"/><HiddenLoopEnd Value="2"/></Loop><Name Value="Chorus"/><Notes><KeyTracks><KeyTrack Id="0"><Notes><MidiNoteEvent Time="1" Duration="1" Velocity="100" OffVelocity="64" IsEnabled="true" NoteId="1"/><MidiNoteEvent Time="3" Duration="1" Velocity="100" OffVelocity="64" IsEnabled="true" NoteId="2"/><MidiNoteEvent Time="4.5" Duration="1" Velocity="100" OffVelocity="64" IsEnabled="true" NoteId="3"/></Notes><MidiKey Value="62"/></KeyTrack></KeyTracks><NoteIdGenerator><NextId Value="4"/></NoteIdGenerator></Notes></MidiClip>
</Events></ArrangerAutomation></ClipTimeable></MainSequencer><DeviceChain><Devices/></DeviceChain></DeviceChain></MidiTrack>
<AudioTrack Id="8"><Name><EffectiveName Value="Vox"/><UserName Value=""/></Name><Color Value="26"/><TrackGroupId Value="-1"/>
<DeviceChain><MainSequencer><ClipSlotList/><Sample><ArrangerAutomation><Events>
<AudioClip Id="0" Time="0"><CurrentStart Value="0"/><CurrentEnd Value="2"/><Loop><LoopStart Value="0.5"/><LoopEnd Value="1.5"/><StartRelative Value="0"/><LoopOn Value="false"/><OutMarker Value="1.5"/><HiddenLoopStart Value="0"/><HiddenLoopEnd Value="2"/></Loop><Name Value="Room"/><Envelopes><Envelopes/></Envelopes><Disabled Value="false"/><IsWarped Value="false"/><Fades><FadeInLength Value="0.01"/><FadeOutLength Value="0"/></Fades><SampleVolume Value="0.5"/><WarpMarkers><WarpMarker Id="0" SecTime="0" BeatTime="0"/><WarpMarker Id="1" SecTime="0.015625" BeatTime="0.03125"/></WarpMarkers><SampleRef><FileRef><RelativePathType Value="1"/><RelativePath Value="room.wav"/><Path Value="/nowhere/room.wav"/><Type Value="2"/><LivePackName Value=""/><LivePackId Value=""/><OriginalFileSize Value="0"/><OriginalCrc Value="0"/></FileRef><LastModDate Value="0"/><SourceContext/><SampleUsageHint Value="0"/><DefaultDuration Value="96000"/><DefaultSampleRate Value="48000"/></SampleRef></AudioClip>
<AudioClip Id="1" Time="4"><CurrentStart Value="4"/><CurrentEnd Value="8"/><Loop><LoopStart Value="2"/><LoopEnd Value="6"/><StartRelative Value="0"/><LoopOn Value="true"/><OutMarker Value="6"/><HiddenLoopStart Value="0"/><HiddenLoopEnd Value="7"/></Loop><Name Value="Swing"/><Envelopes><Envelopes/></Envelopes><Disabled Value="false"/><IsWarped Value="true"/><SampleVolume Value="1"/><WarpMarkers><WarpMarker Id="0" SecTime="0" BeatTime="0"/><WarpMarker Id="1" SecTime="2" BeatTime="4"/><WarpMarker Id="2" SecTime="3" BeatTime="7"/></WarpMarkers><SampleRef><FileRef><RelativePathType Value="1"/><RelativePath Value="swing.wav"/><Path Value=""/><Type Value="2"/><LivePackName Value=""/><LivePackId Value=""/><OriginalFileSize Value="0"/><OriginalCrc Value="0"/></FileRef><LastModDate Value="0"/><SourceContext/><SampleUsageHint Value="0"/><DefaultDuration Value="144000"/><DefaultSampleRate Value="48000"/></SampleRef></AudioClip>
</Events></ArrangerAutomation></Sample></MainSequencer><DeviceChain><Devices/></DeviceChain></DeviceChain></AudioTrack>
</Tracks><MainTrack><DeviceChain><Mixer><Tempo><Manual Value="120"/></Tempo></Mixer></DeviceChain></MainTrack><Scenes><Scene Id="0"><Name Value=""/></Scene></Scenes></LiveSet></Ableton>"#;

    fn loop_of(clip: &Element) -> Vec<String> {
        let lp = clip.child("Loop").unwrap();
        [
            "LoopStart",
            "LoopEnd",
            "StartRelative",
            "LoopOn",
            "OutMarker",
            "HiddenLoopStart",
            "HiddenLoopEnd",
        ]
        .iter()
        .map(|m| value_of(lp, m).unwrap().to_string())
        .collect()
    }
    fn notes_of(clip: &Element) -> Vec<(i64, f64, f64)> {
        crate::edit::notes_json(clip)
            .iter()
            .map(|n| {
                (
                    n["id"].as_i64().unwrap(),
                    n["at"].as_f64().unwrap(),
                    n["len"].as_f64().unwrap(),
                )
            })
            .collect()
    }
    fn arranged(path: &str, track: usize, j: usize) -> Element {
        let (root, _) = reread(path);
        crate::edit::clip_at(
            crate::edit::track_at(&root, track).unwrap(),
            ClipAt::Arrangement(j),
        )
        .unwrap()
        .clone()
    }
    fn crop(track: usize, clip: ClipAt, span: Option<(f64, f64)>) -> SetAct {
        SetAct::ClipCrop {
            track,
            clip,
            from: span.map(|s| s.0),
            to: span.map(|s| s.1),
        }
    }

    // DLW build ruling 2026-11-05 (Crop, ⇧⌘J; Live's Crop Clip, `Clip.crop`): a looped MIDI clip keeps only its loop — its markers
    // from 0, its start kept in the loop, its notes in the loop by their ids (one cut at the loop's end), and its clip envelope held
    // to the loop, the value it starts and ends at kept — standing where it stood on the ruler.
    #[test]
    fn crop_keeps_only_a_looped_midi_clips_loop_its_notes_and_envelope_held_to_it() {
        let (_dir, path) = set_file(CROP_SET);
        let done = run(&path, crop(0, ClipAt::Arrangement(0), None)).unwrap();
        assert_eq!(done["act"], json!("clip_crop"));
        assert_eq!(
            done["done"],
            json!("Cropped Verse to its loop: 4 beats, 2 notes kept.")
        );
        assert_eq!(done["at"], json!({"track": 0, "arrangement": 0}));
        let clip = arranged(&path, 0, 0);
        assert_eq!(loop_of(&clip), ["0", "4", "1", "true", "4", "0", "4"]);
        assert_eq!(
            (
                value_of(&clip, "CurrentStart"),
                value_of(&clip, "CurrentEnd"),
                clip.attr("Time")
            ),
            (Some("0"), Some("8"), Some("0")),
            "its place on the ruler stands"
        );
        assert_eq!(notes_of(&clip), [(2, 0.0, 1.0), (3, 3.5, 0.5)]);
        let events: Vec<(String, String, String, String)> = clip
            .find("ClipEnvelope")
            .unwrap()
            .find("Events")
            .unwrap()
            .children
            .iter()
            .map(|e| {
                (
                    e.name.clone(),
                    e.attr("Id").unwrap().to_string(),
                    e.attr("Time").unwrap().to_string(),
                    e.attr("Value").unwrap().to_string(),
                )
            })
            .collect();
        let event = |id: &str, time: &str, value: &str| {
            (
                "FloatEvent".to_string(),
                id.to_string(),
                time.to_string(),
                value.to_string(),
            )
        };
        assert_eq!(
            events,
            [
                event("0", "-63072000", "0"),
                event("4", "0", "0.4"),
                event("2", "1", "0.6"),
                event("5", "4", "0.9"),
            ],
            "Live's first event stands; the line from 0.2 at beat -1 to 0.6 at 1 starts at 0.4, and from 0.6 at 1 to 1 at 5 ends at 0.9"
        );
    }

    // An unlooped clip keeps its start to its end; with a selection of the ruler over it, only the selection (cut there as Split
    // cuts), its hidden loop brace held within what it keeps.
    #[test]
    fn crop_keeps_an_unlooped_clips_start_to_end_or_the_selection_over_it() {
        let (_dir, path) = set_file(CROP_SET);
        let done = run(&path, crop(0, ClipAt::Arrangement(1), None)).unwrap();
        assert_eq!(
            done["done"],
            json!("Cropped Chorus to its start and end: 4 beats, 3 notes kept.")
        );
        let clip = arranged(&path, 0, 1);
        assert_eq!(loop_of(&clip), ["0", "4", "0", "false", "4", "0", "1"]);
        assert_eq!(
            notes_of(&clip),
            [(1, 0.0, 1.0), (2, 2.0, 1.0), (3, 3.5, 0.5)]
        );
        let (_dir, path) = set_file(CROP_SET);
        let done = run(&path, crop(0, ClipAt::Arrangement(1), Some((11.0, 13.0)))).unwrap();
        assert_eq!(
            done["done"],
            json!("Cropped Chorus to the selection: 2 beats, 1 note kept.")
        );
        let clip = arranged(&path, 0, 1);
        assert_eq!(
            loop_of(&clip),
            ["0", "2", "0", "false", "2", "0", "2"],
            "a hidden brace left with nothing of its own covers what the clip keeps"
        );
        assert_eq!(
            (
                value_of(&clip, "CurrentStart"),
                value_of(&clip, "CurrentEnd"),
                clip.attr("Time")
            ),
            (Some("11"), Some("13"), Some("11"))
        );
        assert_eq!(
            notes_of(&clip),
            [(2, 1.0, 1.0)],
            "the note at beat 12 of the ruler stays there"
        );
        // A session clip is cropped too, with no selection: it has no ruler.
        let done = run(&path, crop(0, ClipAt::Slot(0), None)).unwrap();
        assert_eq!(
            done["done"],
            json!("Cropped Riff to its start and end: 2 beats, 1 note kept.")
        );
        assert_eq!(done["at"], json!({"track": 0, "slot": 0}));
        for (act, words) in [
            (
                crop(0, ClipAt::Slot(0), Some((0.0, 1.0))),
                "cropped to a selection in Arrangement view",
            ),
            (
                crop(0, ClipAt::Arrangement(1), Some((20.0, 22.0))),
                "The selection holds none of Chorus: select a stretch of the ruler over it, between beat 11 and beat 13",
            ),
            (
                SetAct::ClipCrop {
                    track: 0,
                    clip: ClipAt::Arrangement(1),
                    from: Some(11.0),
                    to: None,
                },
                "A selection is a stretch of the ruler",
            ),
        ] {
            let before = standing(&path);
            let refused = run(&path, act).unwrap_err();
            assert!(refused.contains(words), "{refused}");
            assert_eq!(standing(&path), before);
        }
    }

    // An audio clip's crop is a new sample: the act alone is refused with where it is made, the host is told which stretch of
    // which file to cut, and the cut is kept beside the set as Consolidate keeps one, the clip made to play it.
    #[test]
    fn crop_cuts_an_audio_clips_stretch_of_its_sample_and_the_clip_plays_the_cut_kept_beside_the_set(
    ) {
        let (dir, path) = set_file(CROP_SET);
        let before = standing(&path);
        let refused = run(&path, crop(1, ClipAt::Arrangement(0), None)).unwrap_err();
        assert!(refused.contains("(live_engine_crop)"), "{refused}");
        assert_eq!(standing(&path), before);
        assert_eq!(
            crop_source(&path, 1, ClipAt::Arrangement(0), None).unwrap(),
            CropSource {
                file: "/nowhere/room.wav".into(),
                from_seconds: 0.5,
                to_seconds: 1.5
            },
            "no room.wav beside the set: the file where the set stored it"
        );
        std::fs::write(dir.0.join("room.wav"), b"the room").unwrap();
        assert_eq!(
            crop_source(&path, 1, ClipAt::Arrangement(0), None)
                .unwrap()
                .file,
            dir.0.join("room.wav"),
            "beside the set first, as the engine reads it"
        );
        let midi = crop_source(&path, 0, ClipAt::Arrangement(0), None).unwrap_err();
        assert!(midi.contains("is a MIDI clip"), "{midi}");
        let short = float_wav(47_000, 48_000);
        let refused =
            crop_audio(&path, &before, 1, ClipAt::Arrangement(0), None, &short).unwrap_err();
        assert!(refused.contains("it is not a cut of the clip"), "{refused}");
        assert!(
            !dir.0.join(CROP_DIR).exists(),
            "a refused cut leaves no sample behind"
        );
        let wav = float_wav(48_000, 48_000);
        let done = crop_audio(&path, &before, 1, ClipAt::Arrangement(0), None, &wav).unwrap();
        let sha: String = {
            use sha2::{Digest, Sha256};
            Sha256::digest(&wav)
                .iter()
                .map(|b| format!("{b:02x}"))
                .collect()
        };
        let relative = format!("Samples/Processed/Crop/Room [{}].wav", &sha[..16]);
        assert_eq!(
            done["done"],
            json!(format!("Cropped Room to its start and end: 2 beats, 1 second of sound written beside the set as {relative}."))
        );
        assert_eq!(std::fs::read(dir.0.join(&relative)).unwrap(), wav);
        assert_eq!(
            std::fs::read_to_string(dir.0.join("Samples/Processed/Crop/.gitignore")).unwrap(),
            "# Cropped samples, held by their content hash out of git (DLW §10.3)\n*.wav\n"
        );
        let clip = arranged(&path, 1, 0);
        assert_eq!(
            loop_of(&clip),
            ["0", "1", "0", "false", "1", "0", "1"],
            "its markers in seconds of the cut"
        );
        let file = clip.find("FileRef").unwrap();
        assert_eq!(
            [
                "RelativePathType",
                "RelativePath",
                "OriginalFileSize",
                "OriginalCrc"
            ]
            .map(|f| value_of(file, f).unwrap().to_string()),
            [
                "1".to_string(),
                relative.clone(),
                wav.len().to_string(),
                "36499".into()
            ]
        );
        assert_eq!(
            value_of(clip.child("SampleRef").unwrap(), "DefaultDuration"),
            Some("48000")
        );
        let warp: Vec<(String, String)> = clip
            .child("WarpMarkers")
            .unwrap()
            .children
            .iter()
            .map(|m| {
                (
                    m.attr("SecTime").unwrap().to_string(),
                    m.attr("BeatTime").unwrap().to_string(),
                )
            })
            .collect();
        assert_eq!(
            warp,
            [("0".to_string(), "0".to_string()), ("1".into(), "2".into())],
            "its warp markers moved with it"
        );
        let nowhere = crop_source(&path, 1, ClipAt::Arrangement(1), None).unwrap_err();
        assert_eq!(
            nowhere,
            "Swing names no sample file: there is no sound to crop"
        );
        std::fs::write(dir.0.join("swing.wav"), b"the swing").unwrap();
        let swing = crop_source(&path, 1, ClipAt::Arrangement(1), None).unwrap();
        assert_eq!(
            (swing.from_seconds, (swing.to_seconds * 1e9).round() / 1e9),
            (1.0, 2.666_666_667),
            "a warped clip's beats 2–6 read off its warp markers: 1 second in, 2 more beats at 180 BPM past the second marker"
        );
        let cut = float_wav(80_000, 48_000);
        let done = crop_audio(
            &path,
            &standing(&path),
            1,
            ClipAt::Arrangement(1),
            None,
            &cut,
        )
        .unwrap();
        assert!(
            done["done"]
                .as_str()
                .unwrap()
                .starts_with("Cropped Swing to its loop: 4 beats, 1.667 seconds of sound"),
            "{}",
            done["done"]
        );
        let clip = arranged(&path, 1, 1);
        assert_eq!(loop_of(&clip), ["0", "4", "0", "true", "4", "0", "4"]);
        let warp: Vec<(f64, f64)> = clip
            .child("WarpMarkers")
            .unwrap()
            .children
            .iter()
            .map(|m| {
                let at = |n: &str| (m.attr(n).unwrap().parse::<f64>().unwrap() * 1e6).round() / 1e6;
                (at("SecTime"), at("BeatTime"))
            })
            .collect();
        assert_eq!(
            warp,
            [(0.0, 0.0), (1.0, 2.0), (1.666_667, 4.0)],
            "the marker inside the loop kept, one at each end: the cut keeps the clip's tempo"
        );
        let midi = crop_audio(
            &path,
            &standing(&path),
            0,
            ClipAt::Arrangement(0),
            None,
            &cut,
        )
        .unwrap_err();
        assert!(
            midi.contains("is a MIDI clip: it is cropped as notes"),
            "{midi}"
        );
    }
}
