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

/// Where a track's Output sends its sound (`"main"`, `"group"`, or `{"track": n}`, another part, which is refused).
#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum OutputTo {
    Main,
    Group,
    Track(usize),
}

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
    /// A track's Output (Live's Audio To; O-I #857 G18): where its sound goes, of the routings the set itself holds — the Main track,
    /// or the group it stands in, as Group Tracks routes a member ([`tracks_group`]). Another part is refused in words.
    TrackOutput { track: usize, to: OutputTo },
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
    /// A sample made an audio clip (G14; DLW build ruling 2026-11-08: "making an audio clip from one is live-set's act, referencing
    /// the file as Live does"; Live: a sample dropped from the browser on an audio track's slot, or on its lane in Arrangement
    /// view): on audio part `track`, in the empty slot of row `scene` (the part's first empty slot, with neither `scene` nor
    /// `start`), or on its main lane from the ruler's beat `start`, a clip that plays the whole of `file` (a WAV or an AIFF, named
    /// by its whole path) once: [`audio_clip_make`].
    AudioClipMake {
        track: usize,
        file: String,
        #[serde(default)]
        scene: Option<usize>,
        #[serde(default)]
        start: Option<f64>,
    },
    /// Reverse (the Sample tab's; Live 12's manual, Clip View: a new sample file, the clip's own played backwards, whose clip
    /// envelopes stay where they are in time): audio clip `clip` of part `track` plays its sample's frames last first, kept beside
    /// the set under [`REVERSE_DIR`] ([`clip_reverse`]), and plays the same stretch of the sound, backwards: its region and its warp
    /// markers are mirrored about the sample's length (DLW build ruling 2026-11-09, 48e item 1; [`clip_reversed`]). A looped clip
    /// plays its loop from its start marker, and its end marker plays nothing while the loop is on: its loop and start are mirrored,
    /// and its end marker is set to the mirrored loop's end (48f item 1). One start marker serves the looped view and the loop-off
    /// view, so where the end marker is not the loop end, Loop off after Reverse plays from the mirrored start to that end, not the
    /// mirror of what Loop off played before: Reverse does not commute with Loop off there.
    ClipReverse { track: usize, clip: ClipAt },
    /// Quantize on an audio clip (round 48d item 2, LN12; Live 12's manual, Audio Clips: Quantize moves an audio clip's transients
    /// toward the grid, by the Amount set): audio clip `clip` of part `track`, warped, its transients between its start and end
    /// markers moved toward the nearest line of a grid `grid` beats apart, `amount` percent of the way (more than 0, at most 100),
    /// each through a warp marker at its own place in the sample ([`edit::quantize_transients`]). Its transients are found in the
    /// sample the clip plays ([`clip_sample`]).
    ClipQuantize {
        track: usize,
        clip: ClipAt,
        grid: f64,
        amount: f64,
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
///
/// It also carries the settings Clip view writes — launch mode and
/// quantisation, signature, legato, groove, launch velocity, follow actions,
/// scale and Scale On — each in the shape `edit.rs`'s fixture keeps (element
/// names and nesting copied from sets Live wrote), with that clip's values,
/// and in its order; without them Signature, the clip's own mode, Launch and
/// Follow were refused (walk of O-I 857, G6; DLW build ruling 2026-11-07). That
/// Live opens a set holding such a clip is the owner's check: Live is never
/// driven here.
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
    clip.children.push(value("LaunchMode", "0"));
    clip.children.push(value("LaunchQuantisation", "0"));
    let mut signature = Element::new("RemoteableTimeSignature");
    signature.set_attr("Id", "0");
    for (name, v) in [("Numerator", "4"), ("Denominator", "4"), ("Time", "0")] {
        signature.children.push(value(name, v));
    }
    let mut signatures = Element::new("TimeSignatures");
    signatures.children.push(signature);
    let mut time_signature = Element::new("TimeSignature");
    time_signature.children.push(signatures);
    clip.children.push(time_signature);
    let mut envelopes = Element::new("Envelopes");
    envelopes.children.push(Element::new("Envelopes"));
    clip.children.push(envelopes);
    clip.children.push(value("Legato", "false"));
    let mut groove = Element::new("GrooveSettings");
    groove.children.push(value("GrooveId", "-1"));
    clip.children.push(groove);
    clip.children.push(value("Disabled", "false"));
    clip.children.push(value("VelocityAmount", "0"));
    let mut follow = Element::new("FollowAction");
    for (name, v) in [
        ("FollowTime", "4"),
        ("IsLinked", "true"),
        ("LoopIterations", "1"),
        ("FollowActionA", "4"),
        ("FollowActionB", "0"),
        ("FollowChanceA", "100"),
        ("FollowChanceB", "0"),
        ("JumpIndexA", "1"),
        ("JumpIndexB", "1"),
        ("FollowActionEnabled", "false"),
    ] {
        follow.children.push(value(name, v));
    }
    clip.children.push(follow);
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
    let mut scale = Element::new("ScaleInformation");
    scale.children.push(value("RootNote", "0"));
    scale.children.push(value("Name", "Major"));
    clip.children.push(scale);
    clip.children.push(value("IsInKey", "false"));
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

/// A track's `DeviceChain/AudioOutputRouting` set to `(target, upper, lower)`: false where the document carries none.
fn route_output(track: &mut Element, (target, upper, lower): (&str, &str, &str)) -> bool {
    let Some(routing) = track
        .child_mut("DeviceChain")
        .and_then(|dc| dc.child_mut("AudioOutputRouting"))
    else {
        return false;
    };
    for (field, value) in [
        ("Target", target),
        ("UpperDisplayString", upper),
        ("LowerDisplayString", lower),
    ] {
        if let Some(e) = routing.child_mut(field) {
            e.set_attr("Value", value);
        }
    }
    true
}

/// Output (Live's Audio To; O-I #857 G18): the track's sound sent to the Main track, or to the group it stands in, through the
/// routing Group Tracks writes ([`route_output`]). Another part's target is not in live-set's sources, so it is refused in words; so
/// is a group for a track that stands in none, and an Output for a MIDI part whose notes go to another part (its MIDI To).
fn track_output(root: &mut Element, track: usize, to: OutputTo) -> Result<Done, String> {
    let at = member_at(root, track)?;
    let list = members_mut(root)?;
    let named = track_name(&list[at]);
    let group = value_of(&list[at], "TrackGroupId")
        .unwrap_or("-1")
        .to_string();
    let route = match to {
        OutputTo::Main => TO_MAIN,
        OutputTo::Group if group == "-1" => {
            return Err(format!(
                "{named} stands in no group: its Output is Main. Group Tracks (⌘G) puts it in one."
            ))
        }
        OutputTo::Group => TO_GROUP,
        OutputTo::Track(other) => {
            let other = match member_at(root, other) {
                Ok(other_at) => track_name(&members_mut(root)?[other_at]),
                Err(_) => format!("track {}", other + 1),
            };
            return Err(format!(
                "{named} cannot be sent to {other} here: only Main and the part's own group are routings the set itself holds, and \
                 where Live sends a part to another part is not in live-set's sources."
            ));
        }
    };
    let part = &mut members_mut(root)?[at];
    if let Some(notes) = part
        .child("DeviceChain")
        .and_then(|dc| dc.child("MidiOutputRouting"))
        .filter(|r| value_of(r, "Target").is_some_and(|t| t != "MidiOut/None"))
    {
        let upper = value_of(notes, "UpperDisplayString").unwrap_or("another part");
        return Err(format!(
            "The notes of {named} go to {upper} (its MIDI To), so it sends no sound of its own to choose an Output for."
        ));
    }
    if !route_output(part, route) {
        return Err(format!(
            "{named} carries no AudioOutputRouting in the document, so its Output cannot be written."
        ));
    }
    let words = if route == TO_MAIN {
        format!("{named} goes to Main.")
    } else {
        let list = members_mut(root)?;
        let owner = list
            .iter()
            .find(|t| t.attr("Id") == Some(group.as_str()))
            .map_or_else(|| "its group".to_string(), track_name);
        format!("{named} goes to its group, {owner}.")
    };
    Ok(Done {
        words,
        at: Some(json!({"track": track})),
        places: Places::None,
    })
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
        route_output(member, TO_GROUP);
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
        // A sample beyond the set's folder is named by its whole path alone ([`sample_file`]).
        valued(
            "RelativePathType",
            if sample.relative.is_empty() { "0" } else { "1" },
        ),
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

/// The files a sample may be made a clip of ([`SetAct::AudioClipMake`]), by their extension: what the engine plays (live-engine
/// `lay_samples`: "a WAV or an AIFF").
pub const SAMPLE_EXTENSIONS: &[&str] = &["wav", "aif", "aiff"];

/// An IEEE 754 80-bit extended number (an AIFF's sample rate) as an `f64`.
fn extended(b: &[u8]) -> f64 {
    let exponent = (i32::from(b[0] & 0x7f) << 8) | i32::from(b[1]);
    let mantissa = u64::from_be_bytes(b[2..10].try_into().unwrap_or([0; 8]));
    if mantissa == 0 {
        return 0.0;
    }
    let value = mantissa as f64 * 2f64.powi(exponent - 16383 - 63);
    if b[0] & 0x80 != 0 {
        -value
    } else {
        value
    }
}

/// The file `file` a sample is made a clip of, for the set at `set` ([`SetAct::AudioClipMake`]), and its name: named from the set's
/// folder where it stands in it (as [`sample_ref`] names a consolidated sample, `RelativePathType` 1), else by its whole path alone
/// (`RelativePathType` 0 and no relative path: the shape the reverse-engineering harness's own sets name a sample in, and Live opens
/// them, ableton-live-12.0.25 harness/build_sampler_loaded.py; whether Live writes a climbing relative path for such a file is not
/// attested), with its size, Live's `OriginalCrc` of it ([`original_crc`]), its frames and rate, and when it was last written.
/// Refused in words for a file that is not there, and for what is not a WAV or AIFF file the engine plays.
fn sample_file(set: &str, file: &str) -> Result<(Consolidated, String), String> {
    let named = std::path::Path::new(file);
    let name = named
        .file_name()
        .map_or_else(|| file.to_string(), |n| n.to_string_lossy().into_owned());
    // The file in words, quoted: the clip it makes is named `name` itself.
    let said = quoted(&name);
    if !named.is_absolute() {
        return Err(format!(
            "{said} is not named by its whole path, so no clip is made of it"
        ));
    }
    let meta = std::fs::metadata(named)
        .ok()
        .filter(std::fs::Metadata::is_file)
        .ok_or_else(|| format!("{said} is not there to make a clip of"))?;
    let not_sound = || {
        format!("{said} is not a WAV or AIFF file, the sound the engine plays, so no clip is made of it")
    };
    let known = named
        .extension()
        .and_then(|e| e.to_str())
        .is_some_and(|e| SAMPLE_EXTENSIONS.contains(&e.to_ascii_lowercase().as_str()));
    if !known {
        return Err(not_sound());
    }
    if meta.len() > CONSOLIDATED_BYTES_MAX as u64 {
        return Err(format!(
            "{said} weighs more than a sample may here ({} MiB)",
            CONSOLIDATED_BYTES_MAX / (1024 * 1024)
        ));
    }
    let mut opened =
        std::fs::File::open(named).map_err(|e| format!("{said} could not be read: {e}"))?;
    let ((_, rate, frames), head) = sample_head(&mut opened, meta.len(), &said)?;
    if frames == 0 {
        return Err(format!("{said} holds no sound, so no clip is made of it"));
    }
    let folder = std::path::Path::new(set)
        .parent()
        .and_then(|f| f.canonicalize().ok());
    let relative = match (folder, named.canonicalize()) {
        (Some(folder), Ok(whole)) => whole
            .strip_prefix(&folder)
            .ok()
            .map(|r| {
                r.components()
                    .map(|c| c.as_os_str().to_string_lossy().into_owned())
                    .collect::<Vec<_>>()
                    .join("/")
            })
            .unwrap_or_default(),
        _ => String::new(),
    };
    let written = meta
        .modified()
        .ok()
        .and_then(|at| at.duration_since(std::time::UNIX_EPOCH).ok())
        .map_or(0, |at| at.as_secs());
    let sample = Consolidated {
        relative,
        path: file.to_string(),
        bytes: meta.len() as usize,
        crc: original_crc(&head),
        frames,
        rate,
        written,
    };
    Ok((sample, name))
}

/// A sample's channels, rate and frames.
type SampleShape = (u16, u32, u64);

/// How much of a sample file is read for its clip's `OriginalCrc` ([`original_crc`]): its first 16 KiB.
const SAMPLE_HEAD_BYTES: u64 = 16 * 1024;
/// The most chunk headers walked to find a sample's shape, and the most of a `fmt ` or `COMM` body read (an extensible `fmt ` is 40
/// bytes; an AIFF-C `COMM` 22 and its compression's name).
const SAMPLE_CHUNKS_MAX: usize = 512;
const SAMPLE_SHAPE_BODY_MAX: u64 = 512;

/// A sample file's channels, rate and frames, and its first 16 KiB, read from `file` of `len` bytes without reading its sound (DLW
/// build ruling 2026-11-08, 0.5: "the header and the 16 KiB it needs, never the whole file"): each chunk's eight-byte header, seeking
/// past its body, and only the body of its `fmt ` (a WAV's) or `COMM` (an AIFF's) chunk (as [`wav_shape`] reads a WAV's, and [`aiff_comm`] an AIFF's). Refused
/// in words: an RF64 file, which the engine does not read (live-engine `wav::read_audio` reads RIFF and FORM files), so a clip of one
/// would be silent; a sound chunk (`data`, `SSND`) that claims more than the file holds; and what is not a WAV or AIFF file.
fn sample_head<F: std::io::Read + std::io::Seek>(
    file: &mut F,
    len: u64,
    name: &str,
) -> Result<(SampleShape, Vec<u8>), String> {
    use std::io::{Read, SeekFrom};
    let not_sound = || {
        format!("{name} is not a WAV or AIFF file, the sound the engine plays, so no clip is made of it")
    };
    let unread = |e: std::io::Error| format!("{name} could not be read: {e}");
    let mut head = Vec::new();
    file.by_ref()
        .take(SAMPLE_HEAD_BYTES)
        .read_to_end(&mut head)
        .map_err(unread)?;
    if head.len() < 12 {
        return Err(not_sound());
    }
    if &head[..4] == b"RF64" {
        return Err(format!(
            "{name} is an RF64 file, which the engine does not play, so no clip is made of it"
        ));
    }
    let wav = &head[..4] == b"RIFF" && &head[8..12] == b"WAVE";
    let aiff = &head[..4] == b"FORM" && matches!(&head[8..12], b"AIFF" | b"AIFC");
    if !wav && !aiff {
        return Err(not_sound());
    }
    let (shape_id, sound_id): (&[u8; 4], &[u8; 4]) = if wav {
        (b"fmt ", b"data")
    } else {
        (b"COMM", b"SSND")
    };
    let (mut at, mut shape, mut sound) = (12u64, None::<Vec<u8>>, None::<u64>);
    for _ in 0..SAMPLE_CHUNKS_MAX {
        if shape.is_some() && sound.is_some() || at + 8 > len {
            break;
        }
        let mut header = [0u8; 8];
        file.seek(SeekFrom::Start(at)).map_err(unread)?;
        file.read_exact(&mut header).map_err(unread)?;
        let size = [header[4], header[5], header[6], header[7]];
        let size = u64::from(if wav {
            u32::from_le_bytes(size)
        } else {
            u32::from_be_bytes(size)
        });
        let body = at + 8;
        let holds = len - body;
        if &header[..4] == sound_id {
            if size > holds {
                return Err(format!(
                    "{name} says its sound (its {} chunk) is {size} bytes, but the file holds {holds} after it, so no clip is made of it",
                    String::from_utf8_lossy(sound_id)
                ));
            }
            sound = Some(size);
        } else if &header[..4] == shape_id {
            let mut read = vec![0u8; size.min(SAMPLE_SHAPE_BODY_MAX).min(holds) as usize];
            file.read_exact(&mut read).map_err(unread)?;
            shape = Some(read);
        }
        at = body.saturating_add(size).saturating_add(size & 1);
    }
    let (Some(shape), Some(sound)) = (shape, sound) else {
        // The walk stopped at its cap with more chunks standing: said as that, not as a file that is no WAV or AIFF.
        if at + 8 <= len {
            let id = |id: &[u8; 4]| String::from_utf8_lossy(id).trim_end().to_string();
            return Err(format!(
                "{name} has more than {SAMPLE_CHUNKS_MAX} chunks before its {} and {} chunks are found, so no clip is made of it",
                id(shape_id),
                id(sound_id)
            ));
        }
        return Err(not_sound());
    };
    let found = if wav {
        let word = |i: usize| u16::from_le_bytes([shape[i], shape[i + 1]]);
        (shape.len() >= 16)
            .then(|| {
                let rate = u32::from_le_bytes([shape[4], shape[5], shape[6], shape[7]]);
                (word(2), rate, word(12))
            })
            .filter(|(channels, rate, block)| *channels > 0 && *rate > 0 && *block > 0)
            .map(|(channels, rate, block)| (channels, rate, sound / u64::from(block)))
    } else {
        aiff_comm(&shape)
    };
    found.map(|shape| (shape, head)).ok_or_else(not_sound)
}

/// An AIFF's (or AIFF-C's) `COMM` body as its channels, rate (an 80-bit extended number, [`extended`]) and frames; `None` for one
/// too short or with no channels or rate.
fn aiff_comm(body: &[u8]) -> Option<(u16, u32, u64)> {
    if body.len() < 18 {
        return None;
    }
    let channels = u16::from_be_bytes([body[0], body[1]]);
    let frames = u32::from_be_bytes(body[2..6].try_into().ok()?);
    let rate = extended(&body[8..18]);
    (channels > 0 && rate >= 1.0 && rate < f64::from(u32::MAX))
        .then(|| (channels, rate.round() as u32, u64::from(frames)))
}

/// A sample made an audio clip ([`SetAct::AudioClipMake`]) on audio part `track`: in the empty slot of row `scene`, or the part's
/// first empty slot, or on its main lane from the ruler's beat `start` (laid over what stands there, as Consolidate lays its clip).
/// The clip is in Live 12's shape for an audio clip (the template's AudioClip: its place and markers, name, info text, colour,
/// envelopes, switch, warp, fades, pitch, gain, warp markers and `SampleRef`), named after the file, in the part's colour, and plays
/// the whole sample once from its first frame: unwarped (session-model.md §5: "Unwarped playback (`IsWarped=false`) plays the
/// sample at original rate"), its markers in seconds over the whole file, at unity gain and pitch with no fade, with Live's own
/// pair of warp markers at the set's tempo, as long in beats as the file lasts at that tempo. Its `SampleRef` names the file as
/// [`sample_file`] does.
fn audio_clip_make(
    root: &mut Element,
    track: usize,
    scene: Option<usize>,
    start: Option<f64>,
    sample: &Consolidated,
    named: &str,
) -> Result<Done, String> {
    if scene.is_some() && start.is_some() {
        return Err("A clip is made in a slot or on the ruler, not both".into());
    }
    if let Some(start) = start.filter(|s| !(s.is_finite() && *s >= 0.0)) {
        return Err(format!("The ruler has no beat {}", number_text(start)));
    }
    let part = track_at(root, track)?;
    if part.name != "AudioTrack" {
        return Err(format!(
            "Live makes an audio clip on an audio part, and {} is not one",
            track_name(part)
        ));
    }
    let part_name = track_name(part);
    let colour = value_of(part, "Color").map(str::to_string);
    let Some(bpm) = edit::steady_tempo(root).filter(|bpm| *bpm > 0.0) else {
        return Err("The set's tempo moves, so the sample has no one length in beats: an unwarped clip keeps its markers in seconds".into());
    };
    let seconds = sample.frames as f64 / f64::from(sample.rate);
    let beats = seconds * bpm / 60.0;
    let stem = std::path::Path::new(named)
        .file_stem()
        .map_or_else(|| named.to_string(), |s| s.to_string_lossy().into_owned());
    let at = start.unwrap_or(0.0);
    let clip = crafted_audio_clip(&stem, colour.as_deref(), at, beats, bpm, seconds, sample);
    let length = number_text((seconds * 1000.0).round() / 1000.0);
    let sound = format!(
        "{length} second{} of {named}, unwarped, at its own rate",
        if length == "1" { "" } else { "s" }
    );
    if let Some(start) = start {
        let id = track_id(part)?;
        let was = lane_ids(part);
        let target = listed_mut(root, track)?;
        edit::lay_over(
            target,
            "Sample",
            start,
            start + beats,
            Some(bpm),
            vec![clip],
        )?;
        let now = lane_ids(target);
        let new = now.iter().position(|i| !was.contains(i));
        return Ok(Done {
            words: format!(
                "Made {stem} an audio clip on {part_name} from beat {}: {sound}.",
                number_text(start)
            ),
            at: new.map(|j| json!({"track": track, "arrangement": j})),
            places: Places::Lane {
                track: id,
                before: was,
                after: now,
                dropped: None,
                copied: Vec::new(),
            },
        });
    }
    let scenes = scene_count(root);
    let slots = main_slots(edit::track_at_mut(root, track)?, scenes)?;
    let held = |slot: &Element| {
        slot.child("ClipSlot")
            .and_then(|inner| inner.child("Value"))
            .is_none_or(|v| !v.children.is_empty())
    };
    let chosen = match scene {
        Some(scene) => {
            let slot = slots
                .children
                .get(scene)
                .ok_or_else(|| format!("the set has no row {}", scene + 1))?;
            if held(slot) {
                return Err(format!("The slot in row {} already holds a clip", scene + 1));
            }
            scene
        }
        None => slots.children.iter().position(|slot| !held(slot)).ok_or(
            "The part has no empty slot to make the clip in: add a row, or clear a slot, then drop it again",
        )?,
    };
    slots.children[chosen]
        .child_mut("ClipSlot")
        .and_then(|inner| inner.child_mut("Value"))
        .ok_or("the slot carries no value in the document")?
        .children = vec![clip];
    Ok(Done {
        words: format!(
            "Made {stem} an audio clip in row {} of {part_name}: {sound}.",
            chosen + 1
        ),
        at: Some(json!({"track": track, "slot": chosen})),
        places: Places::None,
    })
}

/// The audio clip [`audio_clip_make`] makes, from the beat `at` for `beats` beats.
fn crafted_audio_clip(
    name: &str,
    colour: Option<&str>,
    at: f64,
    beats: f64,
    bpm: f64,
    seconds: f64,
    sample: &Consolidated,
) -> Element {
    let value = |name: &str, v: &str| {
        let mut e = Element::new(name);
        e.set_attr("Value", v);
        e
    };
    let (from, length) = (number_text(at), number_text(seconds));
    let mut clip = Element::new("AudioClip");
    clip.set_attr("Id", "0");
    clip.set_attr("Time", &from);
    clip.children.push(value("LomId", "0"));
    clip.children.push(value("LomIdView", "0"));
    clip.children.push(value("CurrentStart", &from));
    clip.children
        .push(value("CurrentEnd", &number_text(at + beats)));
    let mut looped = Element::new("Loop");
    for (marker, v) in [
        ("LoopStart", "0"),
        ("LoopEnd", length.as_str()),
        ("StartRelative", "0"),
        ("LoopOn", "false"),
        ("OutMarker", length.as_str()),
        ("HiddenLoopStart", "0"),
        ("HiddenLoopEnd", length.as_str()),
    ] {
        looped.children.push(value(marker, v));
    }
    clip.children.push(looped);
    clip.children.push(value("Name", name));
    clip.children.push(value("Annotation", ""));
    clip.children.push(value("Color", colour.unwrap_or("12")));
    // The settings a clip shares with a MIDI clip, in the shape the crafted clip keeps them (G6), in Live's AudioClip order.
    let shared = crafted_clip(colour, beats);
    let take = |name: &str| {
        shared
            .child(name)
            .cloned()
            .expect("the crafted clip carries each shared setting")
    };
    clip.children.push(take("LaunchMode"));
    clip.children.push(take("LaunchQuantisation"));
    clip.children.push(take("TimeSignature"));
    let mut envelopes = Element::new("Envelopes");
    envelopes.children.push(Element::new("Envelopes"));
    clip.children.push(envelopes);
    clip.children.push(take("Legato"));
    clip.children.push(value("Ram", "false"));
    clip.children.push(take("GrooveSettings"));
    clip.children.push(value("Disabled", "false"));
    clip.children.push(take("VelocityAmount"));
    clip.children.push(take("FollowAction"));
    clip.children.push(value("FreezeStart", "0"));
    clip.children.push(value("FreezeEnd", "0"));
    clip.children.push(value("IsWarped", "false"));
    clip.children.push(sample_ref(sample));
    // The Sample tab's elements (walk of O-I 857, G17; DLW build ruling 2026-11-08, item 2), each in the shape and order a set
    // Live wrote keeps them (the evidence template's AudioClip): the warp mode and its engines' settings, Fade (off here: the
    // clip plays its sample as it stands), the fades, pitch and gain.
    let mut onsets = Element::new("Onsets");
    onsets.children = vec![Element::new("UserOnsets"), value("HasUserOnsets", "false")];
    clip.children.push(onsets);
    for (setting, v) in [
        ("WarpMode", "0"),
        ("GranularityTones", "30"),
        ("GranularityTexture", "65"),
        ("FluctuationTexture", "25"),
        ("TransientResolution", "6"),
        ("TransientLoopMode", "2"),
        ("TransientEnvelope", "100"),
        ("ComplexProFormants", "100"),
        ("ComplexProEnvelope", "128"),
        ("Sync", "true"),
        ("HiQ", "true"),
        ("Fade", "false"),
    ] {
        clip.children.push(value(setting, v));
    }
    let mut fades = Element::new("Fades");
    fades.children = [
        ("FadeInLength", "0"),
        ("FadeOutLength", "0"),
        ("ClipFadesAreInitialized", "true"),
        ("CrossfadeInState", "0"),
        ("FadeInCurveSkew", "0"),
        ("FadeInCurveSlope", "0"),
        ("FadeOutCurveSkew", "0"),
        ("FadeOutCurveSlope", "0"),
        ("IsDefaultFadeIn", "true"),
        ("IsDefaultFadeOut", "true"),
    ]
    .into_iter()
    .map(|(fade, v)| value(fade, v))
    .collect();
    clip.children.push(fades);
    clip.children.push(value("PitchCoarse", "0"));
    clip.children.push(value("PitchFine", "0"));
    clip.children.push(value("SampleVolume", "1"));
    let marker = |id: &str, sec: f64, beat: f64| {
        let mut m = Element::new("WarpMarker");
        m.set_attr("Id", id);
        m.set_attr("SecTime", &number_text(sec));
        m.set_attr("BeatTime", &number_text(beat));
        m
    };
    let mut markers = Element::new("WarpMarkers");
    markers.children = vec![
        marker("0", 0.0, 0.0),
        marker("1", 0.03125 * 60.0 / bpm, 0.03125),
    ];
    clip.children.push(markers);
    clip.children
        .push(Element::new("SavedWarpMarkersForStretched"));
    clip.children.push(value("MarkersGenerated", "false"));
    clip.children.push(value("IsSongTempoLeader", "false"));
    clip
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
/// the sample (`path`, `sha256`, `bytes`, `frames`, `rate`); refused for a name that holds another sound. It never writes over a
/// file and never writes outside the set's folder (DLW build ruling 2026-11-09, 48e item 7; Reverse, Crop and Consolidate alike):
/// the folders on the way are walked without following a link ([`walk_kept`]) and the folder it writes in stands inside the set's
/// by its canonical path ([`kept_folder`]); only a name with nothing at it is free, and a file there that cannot be read is refused,
/// never replaced; what stands there is opened without waiting and read no further than the sound ([`read_unwaiting`], 48f item 7),
/// so a pipe or a device there is refused in words; the sample is made at its name only where nothing stands there ([`put_new`]).
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
    walk_kept(folder, kept.dir, kept.refused)?;
    let relative = format!("{}/{} [{}].wav", kept.dir, kept.named, &hex[..16]);
    let file = folder.join(&relative);
    let unreadable = |e: std::io::Error| {
        format!(
            "{relative} beside the set could not be read ({e}), so it is not replaced: {}",
            kept.refused
        )
    };
    let standing = match std::fs::symlink_metadata(&file) {
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => None,
        Err(e) => return Err(unreadable(e)),
        Ok(meta) if meta.file_type().is_symlink() => {
            return Err(format!(
                "{relative} beside the set is a link, so nothing is written through it: {}",
                kept.refused
            ))
        }
        Ok(_) => match read_unwaiting(&file, wav.len() as u64).map_err(unreadable)? {
            Some(held) => Some(held),
            None => {
                return Err(format!(
                    "{relative} beside the set is no regular file (a pipe, a device or a folder), so it is not read and not replaced: {}",
                    kept.refused
                ))
            }
        },
    };
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
        let dir = kept_folder(folder, kept.dir, kept.refused)?;
        let ignore = dir.join(".gitignore");
        if std::fs::symlink_metadata(&ignore)
            .is_err_and(|e| e.kind() == std::io::ErrorKind::NotFound)
        {
            // Another hand's `.gitignore` made meanwhile stands as it is.
            if let Err(why) = put_new(&ignore, kept.ignore.as_bytes(), &relative, kept.refused) {
                if std::fs::symlink_metadata(&ignore).is_err() {
                    return Err(why);
                }
            }
        }
        match put_new(&file, wav, &relative, kept.refused) {
            Ok(()) => written.set(true),
            // The same sound, kept at its name by another hand meanwhile, is the sample.
            Err(_)
                if read_unwaiting(&file, wav.len() as u64)
                    .is_ok_and(|now| now.as_deref() == Some(wav)) => {}
            Err(why) => return Err(why),
        }
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

/// The folders from the set's `folder` down to `dir`, each as it stands, no link followed (48e item 7): a link on the way, or
/// something there that is no folder, is refused in words ending in `refused`; below a folder that is not there yet nothing stands.
fn walk_kept(folder: &std::path::Path, dir: &str, refused: &str) -> Result<(), String> {
    let mut at = folder.to_path_buf();
    let mut shown = Vec::new();
    for part in std::path::Path::new(dir).components() {
        at.push(part);
        shown.push(part.as_os_str().to_string_lossy().into_owned());
        let shown = shown.join("/");
        match std::fs::symlink_metadata(&at) {
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(()),
            Err(e) => {
                return Err(format!(
                    "{shown} beside the set could not be read ({e}): {refused}"
                ))
            }
            Ok(meta) if meta.file_type().is_symlink() => {
                return Err(format!(
                    "{shown} beside the set is a link, so nothing is written through it: {refused}"
                ))
            }
            Ok(meta) if !meta.is_dir() => {
                return Err(format!(
                    "{shown} beside the set is no folder, so the sample has nowhere to be kept: {refused}"
                ))
            }
            Ok(_) => {}
        }
    }
    Ok(())
}

/// The folder a sample is kept in, `dir` from the set's `folder`, made where it is not there yet (48e item 7): walked before and
/// after it is made ([`walk_kept`]), and refused unless it stands inside the set's folder by both canonical paths.
fn kept_folder(
    folder: &std::path::Path,
    dir: &str,
    refused: &str,
) -> Result<std::path::PathBuf, String> {
    walk_kept(folder, dir, refused)?;
    let at = folder.join(dir);
    std::fs::create_dir_all(&at)
        .map_err(|e| format!("The sample's folder beside the set could not be made: {e}"))?;
    walk_kept(folder, dir, refused)?;
    match (std::fs::canonicalize(&at), std::fs::canonicalize(folder)) {
        (Ok(inside), Ok(root)) if inside.starts_with(&root) => Ok(at),
        _ => Err(format!(
            "{dir} does not stand inside the set's folder, so nothing is written there: {refused}"
        )),
    }
}

/// `bytes` made at `target` only where nothing stands there (48e item 7): written whole under a name of its own made with
/// `create_new` and synced, then put in place as New set puts a set ([`put_in_place`]: a hard link, which fails where anything
/// stands; on a volume that keeps no hard links a move that never writes over a file; on one that makes neither, a copy made only
/// where nothing stands), and the staged name taken away. What stands at `target` is named as `relative`'s and never written over.
fn put_new(
    target: &std::path::Path,
    bytes: &[u8],
    relative: &str,
    refused: &str,
) -> Result<(), String> {
    use std::io::Write;
    use std::sync::atomic::{AtomicU64, Ordering};
    static NEXT: AtomicU64 = AtomicU64::new(0);
    let name = target
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_default();
    let staged = target.with_file_name(format!(
        ".{name}.oi-keep-{}-{}",
        std::process::id(),
        NEXT.fetch_add(1, Ordering::SeqCst)
    ));
    let unwritten = |e: std::io::Error| {
        format!(
            "{} could not be written beside the set: {e}",
            target.display()
        )
    };
    let staging = Volume
        .create_new(&staged)
        .map_err(unwritten)
        .and_then(|mut file| {
            file.write_all(bytes)
                .and_then(|()| file.sync_all())
                .map_err(unwritten)
        });
    let stands = || format!("{relative} beside the set holds another sound: {refused}");
    let placed = staging.and_then(|()| put_in_place(&Volume, &staged, target, &stands, "sample"));
    if !matches!(placed, Ok(Placed::Moved)) {
        let _ = std::fs::remove_file(&staged);
    }
    placed.map(|_| ())
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
    let Cropped { named, seconds, .. } = cropped(&root, track, at, span)?;
    let Some((from_seconds, to_seconds)) = seconds else {
        return Err(format!(
            "{named} is a MIDI clip: Crop keeps its notes, and cuts no sample"
        ));
    };
    let file = clip_file(path, original, &named, "crop")?;
    Ok(CropSource {
        file,
        from_seconds,
        to_seconds,
    })
}

/// The file a clip plays: its `RelativePath` from the set's folder where that is a regular file, else its `Path` where that is one
/// (live-engine `lay_samples`' rule, which takes a file by either name only where it is one: DLW build ruling 2026-11-09, 48e item
/// 3); none where it names neither, or neither is a file.
fn played_file(
    set: &str,
    relative: Option<String>,
    whole: Option<String>,
) -> Option<std::path::PathBuf> {
    let folder = std::path::Path::new(set).parent()?;
    relative
        .map(|relative| folder.join(relative))
        .filter(|file| file.is_file())
        .or_else(|| {
            whole
                .map(std::path::PathBuf::from)
                .filter(|file| file.is_file())
        })
}

/// The file clip `clip`, named `named`, of the set at `set` plays ([`played_file`]), or why it plays none, in words that end in what
/// then cannot be done (`verb`: crop, reverse): it names no file; the file it names is not there; or that is no regular file (a pipe,
/// a device or a folder), which is never opened, so nothing waits on it (48e items 3 and 11). The file named is the one the engine
/// tries last: the clip's `Path`, else its `RelativePath` from the set's folder.
fn clip_file(
    set: &str,
    clip: &Element,
    named: &str,
    verb: &str,
) -> Result<std::path::PathBuf, String> {
    let file = clip.child("SampleRef").and_then(|r| r.child("FileRef"));
    let stored = |field: &str| {
        file.and_then(|f| value_of(f, field))
            .filter(|v| !v.is_empty())
            .map(str::to_string)
    };
    let (relative, whole) = (stored("RelativePath"), stored("Path"));
    if let Some(found) = played_file(set, relative.clone(), whole.clone()) {
        return Ok(found);
    }
    let folder = std::path::Path::new(set).parent();
    let Some(tried) = whole
        .map(std::path::PathBuf::from)
        .or_else(|| relative.and_then(|r| folder.map(|f| f.join(r))))
    else {
        return Err(format!(
            "{named} names no sample file: there is no sound to {verb}"
        ));
    };
    let name = tried.file_name().map_or_else(
        || tried.display().to_string(),
        |n| quoted(&n.to_string_lossy()),
    );
    Err(match std::fs::metadata(&tried) {
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            format!("{named} plays {name}, which is not there, so there is no sound to {verb}")
        }
        Err(e) => format!(
            "{named} plays {name}, which could not be read ({e}), so there is no sound to {verb}"
        ),
        Ok(_) => format!("{named} plays {name}, which is no regular file (a pipe, a device or a folder), so it is not read and there is no sound to {verb}"),
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

/// Where a reversed sample is kept, from the set's own folder: the processed folder the template keeps beside Consolidate's.
pub const REVERSE_DIR: &str = "Samples/Processed/Reverse";
/// What keeps the reversed samples out of git, written into [`REVERSE_DIR`] where it holds none yet.
const REVERSE_IGNORE: &str =
    "# Reversed samples, held by their content hash out of git (DLW §10.3)\n*.wav\n";

/// The most of a sample Reverse reads (DLW build ruling 2026-11-09, 48e item 5): 512 MiB, about 46 minutes of stereo 32-bit float
/// at 48 kHz. The file and the reversed WAV are held at once, and nothing else of the sound.
pub const REVERSE_BYTES_MAX: u64 = 512 * 1024 * 1024;

/// The flag that opens a file without waiting (`O_NONBLOCK`): a pipe that took the place of a clip's file between its check and its
/// open is then refused when its open file is asked what it is, never waited on (48e item 3). It changes nothing in reading a
/// regular file.
#[cfg(target_os = "macos")]
const OPEN_NONBLOCK: i32 = 0x0004;
#[cfg(target_os = "linux")]
const OPEN_NONBLOCK: i32 = 0o4000;
#[cfg(all(unix, not(any(target_os = "macos", target_os = "linux"))))]
const OPEN_NONBLOCK: i32 = 0;

/// The sample at `file`, named `name`, read whole for Reverse (48e items 3 and 5): a regular file only, opened once without waiting
/// ([`OPEN_NONBLOCK`]), the open file itself asked what it is, and at most [`REVERSE_BYTES_MAX`]: refused unread where the file says
/// it holds more, and the bound held on the bytes read, not on what the file said.
fn reverse_source(file: &std::path::Path, name: &str) -> Result<Vec<u8>, String> {
    let (act, unmade) = ("Reverse", "nothing was reversed");
    let (handle, meta) = open_sound(file, name, REVERSE_BYTES_MAX, act, unmade)?;
    read_sound(handle, meta.len(), name, REVERSE_BYTES_MAX, act, unmade)
}

/// Reverse ([`SetAct::ClipReverse`]) on audio clip `at` of part `track` of the set at `path`, against its revision, checked before
/// any sample is read (48e item 13): the file the clip already plays ([`clip_file`]: the engine's file, and Crop's; Reverse adds no
/// new source to the set and reads no other, 48e item 4) read whole ([`reverse_source`]) and its frames written last first as a WAV
/// ([`reversed_wav`]), kept beside the set under [`REVERSE_DIR`] by its content ([`keep_sample`]), named after the sample (a
/// reversed file's own hash left off its name), never beside the file it was made from (DLW build ruling 2026-11-09, round 48: "a
/// rendered reversed file in the set's folder, never in the corpus"); the clip then plays it, the same stretch of the sound
/// backwards ([`clip_reversed`]). Refused in words for a MIDI clip, a clip that names no file, one whose file is gone or no regular
/// file, and one whose file is not a WAV or AIFF the engine plays; a refusal leaves no sample behind.
fn clip_reverse(
    path: &str,
    expected_revision: &str,
    track: usize,
    at: ClipAt,
) -> Result<Value, String> {
    let (bytes, root) = edit::open(path)?;
    if edit::revision(&bytes) != expected_revision {
        return Err(edit::CHANGED.into());
    }
    drop(bytes);
    let clip = clip_at(track_at(&root, track)?, at)?;
    let named = value_of(clip, "Name")
        .filter(|n| !n.is_empty())
        .unwrap_or("the clip")
        .to_string();
    if clip.name != "AudioClip" {
        return Err(format!(
            "{named} is a MIDI clip: Reverse in the Sample tab plays a sample backwards, and Pitch and Time's Reverse reverses notes"
        ));
    }
    let source = clip_file(path, clip, &named, "reverse")?;
    let name = source
        .file_name()
        .map_or_else(|| named.clone(), |n| quoted(&n.to_string_lossy()));
    // The file read is let go once its frames are written reversed: the two are held at once, never a third copy.
    let wav = reversed_wav(&reverse_source(&source, &name)?, &name)?;
    // Named after the sample: a file this act kept is named `<stem> [<hash>]`, and its hash is left off.
    let stem = source
        .file_stem()
        .map_or_else(|| named.clone(), |s| s.to_string_lossy().into_owned());
    let stem = match stem.rsplit_once(" [") {
        Some((before, hash))
            if hash.len() == 17
                && hash.ends_with(']')
                && hash[..16].bytes().all(|b| b.is_ascii_hexdigit()) =>
        {
            before.to_string()
        }
        _ => stem,
    }
    .replace(['/', ':', '\\'], "-");
    keep_sample(
        path,
        expected_revision,
        &SetAct::ClipReverse { track, clip: at },
        Kept {
            dir: REVERSE_DIR,
            ignore: REVERSE_IGNORE,
            named: &stem,
            refused: "nothing was reversed",
        },
        &wav,
    )
}

/// The clip Reverse leaves ([`clip_reverse`]): the same clip playing `sample`, the same stretch of the sound backwards (DLW build
/// ruling 2026-11-09, 48e item 1): its region and its warp markers mirrored about the sample's length, its frames over its rate
/// ([`edit::reverse_markers`]). Its envelopes stay where they are in time (Live 12's manual, Clip View, the Sample tab), and an
/// Arrangement clip where it is on the ruler.
fn clip_reversed(
    root: &mut Element,
    track: usize,
    at: ClipAt,
    sample: &Consolidated,
) -> Result<Done, String> {
    let clip = edit::clip_at_mut(edit::track_at_mut(root, track)?, at)?;
    if clip.name != "AudioClip" {
        return Err("Reverse plays an audio clip's sample backwards".into());
    }
    let named = value_of(clip, "Name")
        .filter(|n| !n.is_empty())
        .unwrap_or("the clip")
        .to_string();
    edit::reverse_markers(clip, sample.frames as f64 / f64::from(sample.rate), &named)?;
    set_sample(clip, sample);
    let place = match at {
        ClipAt::Arrangement(j) => json!({"track": track, "arrangement": j}),
        ClipAt::Slot(scene) => json!({"track": track, "slot": scene}),
    };
    Ok(Done {
        words: format!(
            "Reversed {named}: the clip plays its sample backwards, written beside the set as {}.",
            sample.relative
        ),
        at: Some(place),
        places: Places::None,
    })
}

/// A sample's file named in the set's words, quoted as they quote a name (`"gull_take.wav"`, round 54 item 3): a name the person
/// chose, which a reader of the words keeps as written, never read as code or re-lettered to open a sentence.
fn quoted(name: &str) -> String {
    format!("\"{name}\"")
}

/// Whether the engine plays a WAV of format `tag` (an extensible file's by its sub-format) at `bits` (live-engine `read_wav`: integer
/// PCM at 8, 16 or 24 bit, IEEE float at 32), or why not, in the engine's words (DLW build ruling 2026-11-09, 48e item 6).
fn engine_plays(tag: u16, bits: u16) -> Result<(), String> {
    match (tag, bits) {
        (1, 8 | 16 | 24) | (3, 32) => Ok(()),
        (1, 32) => Err("32-bit integer WAV is not read: for 32 bit, only floating point samples are, as Live reads them".into()),
        (1 | 3, bits) => Err(format!(
            "{bits}-bit {} WAV is not read: integer at 8, 16 or 24 bit, or float at 32",
            if tag == 3 { "float" } else { "integer" }
        )),
        (tag, _) => Err(format!(
            "WAV format {tag} is not read: integer PCM or IEEE float"
        )),
    }
}

/// A sound file's format chunk body and sound chunk body, in that order ([`shape_and_sound`]).
type ShapeAndSound<'a> = (&'a [u8], &'a [u8]);

/// A WAV's or AIFF's format chunk and sound chunk (`fmt ` and `data`, or `COMM` and `SSND`), each the first of its kind, found by
/// walking at most [`SAMPLE_CHUNKS_MAX`] chunk headers and keeping none of them (48e item 5, as [`sample_head`] walks a file); each
/// body is cut to what the file holds. `Err` is a walk that stopped at its bound with chunks still standing; `Ok(None)` a file that
/// holds no pair.
fn shape_and_sound(bytes: &[u8], wav: bool) -> Result<Option<ShapeAndSound<'_>>, ()> {
    let (shape_id, sound_id): (&[u8], &[u8]) = if wav {
        (b"fmt ", b"data")
    } else {
        (b"COMM", b"SSND")
    };
    let (mut at, mut shape, mut sound) = (12usize, None, None);
    for _ in 0..SAMPLE_CHUNKS_MAX {
        if shape.is_some() && sound.is_some() || at.saturating_add(8) > bytes.len() {
            break;
        }
        let size = [bytes[at + 4], bytes[at + 5], bytes[at + 6], bytes[at + 7]];
        let size = if wav {
            u32::from_le_bytes(size)
        } else {
            u32::from_be_bytes(size)
        } as usize;
        let body = at + 8;
        let end = body.saturating_add(size).min(bytes.len());
        let id = &bytes[at..at + 4];
        if id == shape_id && shape.is_none() {
            shape = Some(&bytes[body..end]);
        } else if id == sound_id && sound.is_none() {
            sound = Some(&bytes[body..end]);
        }
        at = body.saturating_add(size).saturating_add(size & 1);
    }
    match (shape, sound) {
        (Some(shape), Some(sound)) => Ok(Some((shape, sound))),
        _ if at.saturating_add(8) <= bytes.len() => Err(()),
        _ => Ok(None),
    }
}

/// A WAV's or AIFF's sound as Reverse and the Sample tab read it (48e items 5, 6, 10; round 48d item 2): its shape, its frames'
/// bytes in the file's own order, each frame's size and how many there are.
struct Sound<'a> {
    shape: SoundShape<'a>,
    samples: &'a [u8],
    block: usize,
    frames: usize,
}

/// How a sound's samples are kept: a WAV the engine plays, by its format chunk, its format (an extensible one's by its sub-format)
/// and its depth; or an AIFF, by its channels, rate, depth, each sample's width in bytes, whether it is float and whether it is
/// little-endian already (AIFF-C `sowt`).
enum SoundShape<'a> {
    Wav {
        format: &'a [u8],
        tag: u16,
        bits: u16,
    },
    Aiff {
        channels: u16,
        rate: u32,
        bits: u16,
        width: usize,
        float: bool,
        little: bool,
    },
}

/// A WAV or AIFF file's sound ([`Sound`]), its chunks found within [`SAMPLE_CHUNKS_MAX`] ([`shape_and_sound`]). Refused in words
/// ending "so {unmade}": what is not a WAV or AIFF file; a WAV the engine would not play (its format by tag, an extensible one's by
/// its sub-format, and its depth, in the engine's words, [`engine_plays`]; and frames whose size is not what its channels and bits
/// make); an AIFF-C compressed a way `act` does not read; and a file that holds no sound.
fn sound_of<'a>(bytes: &'a [u8], name: &str, act: &str, unmade: &str) -> Result<Sound<'a>, String> {
    let not_sound =
        || format!("{name} is not a WAV or AIFF file, the sound the engine plays, so {unmade}");
    if bytes.len() < 12 {
        return Err(not_sound());
    }
    let wav = &bytes[..4] == b"RIFF" && &bytes[8..12] == b"WAVE";
    let aiff = &bytes[..4] == b"FORM" && matches!(&bytes[8..12], b"AIFF" | b"AIFC");
    if !wav && !aiff {
        return Err(not_sound());
    }
    let (shape, sound) = match shape_and_sound(bytes, wav) {
        Ok(Some(found)) => found,
        Ok(None) => return Err(not_sound()),
        Err(()) => {
            let (shape, sound) = if wav {
                ("fmt", "data")
            } else {
                ("COMM", "SSND")
            };
            return Err(format!("{name} has more than {SAMPLE_CHUNKS_MAX} chunks before its {shape} and {sound} chunks are found, so {unmade}"));
        }
    };
    let sound = if wav {
        if shape.len() < 16 {
            return Err(not_sound());
        }
        let word = |i: usize| u16::from_le_bytes([shape[i], shape[i + 1]]);
        let (channels, block, bits) = (word(2), word(12), word(14));
        let tag = match word(0) {
            0xFFFE if shape.len() < 26 => return Err(not_sound()),
            0xFFFE => word(24),
            tag => tag,
        };
        let unplayed =
            |why: String| format!("{name} is not a WAV the engine plays ({why}), so {unmade}");
        engine_plays(tag, bits).map_err(unplayed)?;
        if channels == 0 {
            return Err(not_sound());
        }
        let want = usize::from(channels) * usize::from(bits.div_ceil(8));
        if usize::from(block) != want {
            let (s, take) = if channels == 1 {
                ("", "takes")
            } else {
                ("s", "take")
            };
            // The engine reads no block align (live-engine `read_audio`), so the file is not said to be one it does not play (48f item
            // 8); a frame of another size is refused all the same.
            return Err(format!(
                "{name}'s frames are not the size its channels and bits make (each frame is {block} bytes, where {channels} channel{s} of {bits} bits {take} {want}), so {unmade}"
            ));
        }
        Sound {
            shape: SoundShape::Wav {
                format: shape,
                tag,
                bits,
            },
            samples: sound,
            block: want,
            frames: sound.len() / want,
        }
    } else {
        let (channels, rate, frames) = aiff_comm(shape).ok_or_else(not_sound)?;
        let bits = u16::from_be_bytes([shape[6], shape[7]]);
        let compression = if &bytes[8..12] == b"AIFC" && shape.len() >= 22 {
            &shape[18..22]
        } else {
            b"NONE"
        };
        let (float, little) = match compression {
            b"NONE" | b"twos" => (false, false),
            b"sowt" => (false, true),
            b"fl32" | b"FL32" if bits == 32 => (true, false),
            b"fl64" | b"FL64" if bits == 64 => (true, false),
            other => {
                let other = String::from_utf8_lossy(other);
                return Err(format!(
                    "{name} is an AIFF-C file compressed as {other}, which {act} does not read, so {unmade}"
                ));
            }
        };
        let width = usize::from(bits.div_ceil(8));
        if width == 0 || width > 8 || channels == 0 || sound.len() < 8 {
            return Err(not_sound());
        }
        let block = width * usize::from(channels);
        let offset = u32::from_be_bytes([sound[0], sound[1], sound[2], sound[3]]) as usize;
        let samples = sound
            .get(8usize.saturating_add(offset)..)
            .ok_or_else(not_sound)?;
        Sound {
            shape: SoundShape::Aiff {
                channels,
                rate,
                bits,
                width,
                float,
                little,
            },
            samples,
            block,
            frames: (frames as usize).min(samples.len() / block),
        }
    };
    if sound.frames == 0 {
        return Err(format!("{name} holds no sound, so {unmade}"));
    }
    Ok(sound)
}

/// A WAV or AIFF file's frames, last first, as a WAV file the engine plays: a WAV keeps its own format; an AIFF's samples are written
/// as a WAV keeps them (little-endian, an 8-bit sample unsigned), integer PCM or IEEE float (AIFF-C `NONE`, `twos`, `sowt`, `fl32`,
/// `fl64`). Its sound is found as the Sample tab finds it ([`sound_of`], its chunks within [`SAMPLE_CHUNKS_MAX`]) and the WAV is
/// written into one buffer of its exact size, the frames straight into it (48e item 5). Refused in words: what [`sound_of`] refuses
/// (what is not a WAV or AIFF file; a WAV the engine would not play, 48e item 6; an AIFF-C compressed any other way; a file that
/// holds no sound, 48e item 10); an AIFF it would write as a WAV the engine does not play; and an AIFF above 768 kHz, or whose frames
/// a WAV cannot say (48e item 9).
fn reversed_wav(bytes: &[u8], name: &str) -> Result<Vec<u8>, String> {
    let sound = sound_of(bytes, name, "Reverse", "nothing was reversed")?;
    // The format chunk the reversed file keeps; for an AIFF, each sample's width and whether it is little-endian already.
    let mut made = [0u8; 16];
    let (format, aiff_width, little): (&[u8], usize, bool) = match sound.shape {
        SoundShape::Wav { format, .. } => (format, 0, true),
        SoundShape::Aiff {
            channels,
            rate,
            bits,
            width,
            float,
            little,
        } => {
            engine_plays(if float { 3 } else { 1 }, width as u16 * 8).map_err(|why| {
                format!("{name} would be reversed into a WAV the engine does not play ({why}), so nothing was reversed")
            })?;
            if rate > 768_000 {
                return Err(format!("{name} keeps {rate} samples a second, more than the 768000 Reverse writes, so nothing was reversed"));
            }
            let too_wide = || {
                format!("{name}'s frames ({channels} channels of {bits} bits) are wider than a WAV says, so nothing was reversed")
            };
            let byte_rate =
                u32::try_from(u64::from(rate) * sound.block as u64).map_err(|_| too_wide())?;
            let block_align = u16::try_from(sound.block).map_err(|_| too_wide())?;
            made[..2].copy_from_slice(&(if float { 3u16 } else { 1u16 }).to_le_bytes());
            made[2..4].copy_from_slice(&channels.to_le_bytes());
            made[4..8].copy_from_slice(&rate.to_le_bytes());
            made[8..12].copy_from_slice(&byte_rate.to_le_bytes());
            made[12..14].copy_from_slice(&block_align.to_le_bytes());
            made[14..16].copy_from_slice(&(width as u16 * 8).to_le_bytes());
            (&made[..], width, little)
        }
    };
    let (samples, block) = (sound.samples, sound.block);
    let data = sound.frames * block;
    let (format_pad, data_pad) = (format.len() & 1, data & 1);
    let whole = 12 + 8 + format.len() + format_pad + 8 + data + data_pad;
    let (Ok(riff), Ok(format_size), Ok(data_size)) = (
        u32::try_from(whole - 8),
        u32::try_from(format.len()),
        u32::try_from(data),
    ) else {
        return Err(format!(
            "{name} reversed is longer than a WAV holds, so nothing was reversed"
        ));
    };
    let mut out = Vec::with_capacity(whole);
    out.extend_from_slice(b"RIFF");
    out.extend_from_slice(&riff.to_le_bytes());
    out.extend_from_slice(b"WAVEfmt ");
    out.extend_from_slice(&format_size.to_le_bytes());
    out.extend_from_slice(format);
    out.extend(std::iter::repeat_n(0u8, format_pad));
    out.extend_from_slice(b"data");
    out.extend_from_slice(&data_size.to_le_bytes());
    for frame in samples[..data].chunks_exact(block).rev() {
        if aiff_width == 0 {
            out.extend_from_slice(frame);
            continue;
        }
        for sample in frame.chunks_exact(aiff_width) {
            let at = out.len();
            if little {
                out.extend_from_slice(sample);
            } else {
                out.extend(sample.iter().rev());
            }
            if aiff_width == 1 {
                out[at] ^= 0x80;
            }
        }
    }
    out.extend(std::iter::repeat_n(0u8, data_pad));
    Ok(out)
}

// ---------------------------------------------------------------------------- the sample's sound (round 48d item 2)

/// How many stretches the Sample tab's waveform is drawn in ([`SampleReading::wave`]).
pub(crate) const WAVE_BINS: usize = 512;
/// The most of a sample read to draw it and find its transients; a heavier file is refused in words.
const SAMPLE_READ_MAX: u64 = 256 * 1024 * 1024;
/// How many samples' readings are remembered ([`clip_sample`]).
const SAMPLES_KEPT: usize = 16;

/// What the Sample tab draws of the sound an audio clip plays (round 48d item 2; Live 12's manual, Audio Clips: the sample's
/// waveform, and the transients Live finds in it on analysis): its length in seconds, its transients in seconds of it
/// ([`transients`]), and its waveform, the peak of each of [`WAVE_BINS`] stretches of it, 0 to 1.
#[derive(Clone, Debug, PartialEq)]
pub(crate) struct SampleReading {
    pub seconds: f64,
    pub transients: Vec<f64>,
    pub wave: Vec<f64>,
}

/// A sample by its file, its length and its time of change.
type SampleKey = (std::path::PathBuf, u64, Option<std::time::SystemTime>);
/// What a sample's bytes made, read whole: its reading, or the words that refused it (not a WAV or AIFF the engine plays).
type SampleMade = Result<std::sync::Arc<SampleReading>, String>;
/// Samples as they were made from their bytes, by [`SampleKey`], the latest last ([`remembered`]).
type SampleCache = std::sync::Mutex<Vec<(SampleKey, SampleMade)>>;
/// The samples read last: a file is read again once its length or its time of change moves.
static SAMPLES: SampleCache = std::sync::Mutex::new(Vec::new());

/// How a sample's one value is read from its bytes, over full scale ([`sample_sound`]).
type SampleRead = Box<dyn Fn(&[u8]) -> f32>;

/// A sample's sound, from a WAV or AIFF file's bytes ([`sound_of`]: what the engine plays, within its chunk bound): its frames
/// mixed to one channel, then its length, its transients ([`transients`]) and its waveform ([`waveform`]). A WAV is read as the
/// engine reads it (integer PCM at 8, 16 or 24 bit, IEEE float at 32); an AIFF as the engine reads one (integer at 1 to 32 bit,
/// big-endian or, AIFF-C `sowt`, little-endian; float at 32 or 64); anything else is refused in words.
fn sample_sound(bytes: &[u8], name: &str) -> Result<SampleReading, String> {
    let unmade = "its transients are not shown";
    let sound = sound_of(bytes, name, "the Sample tab", unmade)?;
    let (rate, channels, sample): (u32, usize, SampleRead) = match sound.shape {
        SoundShape::Wav { format, tag, bits } => {
            let rate = u32::from_le_bytes([format[4], format[5], format[6], format[7]]);
            let channels = usize::from(u16::from_le_bytes([format[2], format[3]]));
            let read: SampleRead = match (tag, bits) {
                (1, 8) => Box::new(|b| (f32::from(b[0]) - 128.0) / 128.0),
                (1, 16) => Box::new(|b| f32::from(i16::from_le_bytes([b[0], b[1]])) / 32_768.0),
                (1, _) => Box::new(|b| {
                    (i32::from_le_bytes([0, b[0], b[1], b[2]]) >> 8) as f32 / 8_388_608.0
                }),
                _ => Box::new(|b| f32::from_le_bytes([b[0], b[1], b[2], b[3]])),
            };
            (rate, channels, read)
        }
        SoundShape::Aiff {
            channels,
            rate,
            bits,
            width,
            float,
            little,
        } => {
            if !float && width > 4 {
                return Err(format!("{name} is not an AIFF the engine plays ({bits}-bit AIFF is not read: integer at 1 to 32 bit), so {unmade}"));
            }
            let read: SampleRead = match (float, width) {
                (true, 4) => Box::new(|b| f32::from_be_bytes([b[0], b[1], b[2], b[3]])),
                (true, _) => Box::new(|b| {
                    f64::from_be_bytes([b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7]]) as f32
                }),
                // Each sample left-justified in the bytes that hold it, as AIFF keeps it, read over a 32-bit word's full scale.
                (false, _) => Box::new(move |b| {
                    let mut word = [0u8; 4];
                    for (k, byte) in b.iter().enumerate() {
                        word[if little { width - 1 - k } else { k }] = *byte;
                    }
                    (f64::from(i32::from_be_bytes(word)) / 2_147_483_648.0) as f32
                }),
            };
            (rate, usize::from(channels), read)
        }
    };
    if rate == 0 || channels == 0 {
        return Err(format!(
            "{name} is not a WAV or AIFF file, the sound the engine plays, so {unmade}"
        ));
    }
    let width = sound.block / channels;
    let mono: Vec<f32> = sound.samples[..sound.frames * sound.block]
        .chunks_exact(sound.block)
        .map(|frame| frame.chunks_exact(width).map(&sample).sum::<f32>() / channels as f32)
        .collect();
    Ok(SampleReading {
        seconds: mono.len() as f64 / f64::from(rate),
        transients: transients(rate, &mono),
        wave: waveform(&mono),
    })
}

/// The sample at `file`, named `name`, opened for `act` to read (48e items 3 and 5): once, without waiting ([`OPEN_NONBLOCK`]), the
/// open file itself asked what it is, and refused unread where it is no regular file or says it holds more than `most`. Refusals end
/// "so {unmade}". Answers the open file and what it says of itself.
fn open_sound(
    file: &std::path::Path,
    name: &str,
    most: u64,
    act: &str,
    unmade: &str,
) -> Result<(std::fs::File, std::fs::Metadata), String> {
    let (handle, meta) = open_unwaiting(file)
        .map_err(|e| format!("{name} could not be read: {e}"))?
        .ok_or_else(|| {
            format!("{name} is no regular file (a pipe, a device or a folder), so it is not read and {unmade}")
        })?;
    if meta.len() > most {
        return Err(heavy(name, most, act, unmade));
    }
    Ok((handle, meta))
}

/// `file` opened for reading once, without waiting ([`OPEN_NONBLOCK`]: a pipe at the name answers at once), and the open file itself
/// asked what it is (48e item 3): `None` where it is no regular file (a pipe, a device or a folder), which is never read. The one way
/// a sample ([`open_sound`]) and what stands at a kept sample's name ([`read_unwaiting`], 48f item 7) are opened.
fn open_unwaiting(
    file: &std::path::Path,
) -> std::io::Result<Option<(std::fs::File, std::fs::Metadata)>> {
    let mut open = std::fs::OpenOptions::new();
    open.read(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        open.custom_flags(OPEN_NONBLOCK);
    }
    let handle = open.open(file)?;
    let meta = handle.metadata()?;
    Ok(meta.is_file().then_some((handle, meta)))
}

/// What stands at `file`, opened as [`open_unwaiting`] opens it, and read no further than one byte past `most`: enough to tell a
/// sound of `most` bytes from another, never waiting and never whole (48f item 7). `None` where it is no regular file.
fn read_unwaiting(file: &std::path::Path, most: u64) -> std::io::Result<Option<Vec<u8>>> {
    use std::io::Read;
    let Some((handle, meta)) = open_unwaiting(file)? else {
        return Ok(None);
    };
    let mut bytes = Vec::with_capacity(meta.len().min(most + 1) as usize);
    handle.take(most + 1).read_to_end(&mut bytes)?;
    Ok(Some(bytes))
}

/// The words for a sample heavier than `act` reads.
fn heavy(name: &str, most: u64, act: &str, unmade: &str) -> String {
    format!(
        "{name} weighs more than {act} reads ({} MiB), so {unmade}",
        most / (1024 * 1024)
    )
}

/// An open sample ([`open_sound`]) read whole, at most `most` bytes: the bound held on the bytes read, not on what the file said.
fn read_sound(
    handle: std::fs::File,
    len: u64,
    name: &str,
    most: u64,
    act: &str,
    unmade: &str,
) -> Result<Vec<u8>, String> {
    use std::io::Read;
    let mut bytes = Vec::with_capacity(len.min(most) as usize);
    handle
        .take(most + 1)
        .read_to_end(&mut bytes)
        .map_err(|e| format!("{name} could not be read: {e}"))?;
    if bytes.len() as u64 > most {
        return Err(heavy(name, most, act, unmade));
    }
    Ok(bytes)
}

/// The sound audio clip `clip` of the set at `set` plays ([`clip_file`]: a regular file only, as the engine plays it), read for the
/// Sample tab ([`sample_sound`]) or as it was made last ([`remembered`]), while the open file's length and time of change stand. Refused in words
/// for a clip that names no file, a file that is not there, is no regular file or cannot be read, one heavier than
/// [`SAMPLE_READ_MAX`], and what is not a WAV or AIFF the engine plays.
pub(crate) fn clip_sample(
    set: &str,
    clip: &Element,
) -> Result<std::sync::Arc<SampleReading>, String> {
    let (act, unmade) = ("the Sample tab", "its transients are not shown");
    let named = value_of(clip, "Name")
        .filter(|n| !n.is_empty())
        .unwrap_or("the clip");
    let source = clip_file(set, clip, named, "show")?;
    let name = source.file_name().map_or_else(
        || source.to_string_lossy().into_owned(),
        |n| quoted(&n.to_string_lossy()),
    );
    let (handle, meta) = open_sound(&source, &name, SAMPLE_READ_MAX, act, unmade)?;
    let len = meta.len();
    let key: SampleKey = (source, len, meta.modified().ok());
    remembered(
        &SAMPLES,
        key,
        || read_sound(handle, len, &name, SAMPLE_READ_MAX, act, unmade),
        |bytes| sample_sound(bytes, &name),
    )
}

/// The sample at `key` as `kept` holds it, or read whole (`read`), made (`make`) and kept there, the latest last and at most
/// [`SAMPLES_KEPT`]. What its bytes make is kept, a reading or the words that refuse it alike (DLW build ruling 2026-11-09, 48g item
/// 4), so a sample the engine does not play is not read whole again, under the write gate, to be refused again while its key stands;
/// a read that fails is not kept, as the file may answer the next.
fn remembered(
    kept: &SampleCache,
    key: SampleKey,
    read: impl FnOnce() -> Result<Vec<u8>, String>,
    make: impl FnOnce(&[u8]) -> Result<SampleReading, String>,
) -> SampleMade {
    let lock = || {
        kept.lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
    };
    {
        let mut rows = lock();
        if let Some(at) = rows.iter().position(|(k, _)| *k == key) {
            let row = rows.remove(at);
            let made = row.1.clone();
            rows.push(row);
            return made;
        }
    }
    let made = make(&read()?).map(std::sync::Arc::new);
    let mut rows = lock();
    rows.retain(|(k, _)| k.0 != key.0);
    rows.push((key, made.clone()));
    if rows.len() > SAMPLES_KEPT {
        let _oldest = rows.remove(0);
    }
    made
}

/// A sample's transients, in seconds of it, to the microsecond (Live 12's manual, Audio Clips: the places Live's analysis finds the
/// sound begin anew): each ten milliseconds whose energy stands above −48 dB of full scale and four times the ten before at least,
/// fifty milliseconds at least after the last transient, placed at the first frame there that reaches half the peak of those ten
/// milliseconds and the ten after.
fn transients(rate: u32, mono: &[f32]) -> Vec<f64> {
    let per_second = f64::from(rate);
    let window = ((per_second * 0.010).round() as usize).max(1);
    let gap = (per_second * 0.050).round() as usize;
    let floor = 10f64.powf(-4.8);
    let energy: Vec<f64> = mono
        .chunks(window)
        .map(|w| w.iter().map(|x| f64::from(*x).powi(2)).sum::<f64>() / w.len() as f64)
        .collect();
    let mut found = Vec::new();
    let mut last: Option<usize> = None;
    for (k, e) in energy.iter().enumerate() {
        let before = if k == 0 { 0.0 } else { energy[k - 1] };
        if !(*e >= floor && *e >= 4.0 * before) {
            continue;
        }
        let from = k * window;
        let stretch = &mono[from..(from + 2 * window).min(mono.len())];
        let peak = stretch.iter().fold(0f32, |m, x| m.max(x.abs()));
        let at = from
            + stretch
                .iter()
                .position(|x| x.abs() >= 0.5 * peak)
                .unwrap_or(0);
        if last.is_some_and(|l| at < l + gap) {
            continue;
        }
        found.push((at as f64 / per_second * 1e6).round() / 1e6);
        last = Some(at);
    }
    found
}

/// A sample's waveform: the peak of each of [`WAVE_BINS`] even stretches of it (fewer for a sample of fewer frames), 0 to 1, to
/// a thousandth.
fn waveform(mono: &[f32]) -> Vec<f64> {
    let bins = WAVE_BINS.min(mono.len());
    (0..bins)
        .map(|i| {
            let stretch = &mono[i * mono.len() / bins..(i + 1) * mono.len() / bins];
            let peak = stretch.iter().fold(0f32, |m, x| m.max(x.abs())).min(1.0);
            (f64::from(peak) * 1000.0).round() / 1000.0
        })
        .collect()
}

/// Quantize's sample ([`SetAct::ClipQuantize`]): the grid and the amount within their ranges, then audio clip `at` of part `track`
/// of the set at `path`, warped, and the transients of the sample it plays ([`clip_sample`]). Refused in words for a grid or an
/// amount out of range, a MIDI clip, an unwarped clip, and a sound that cannot be read.
fn quantize_source(
    path: &str,
    track: usize,
    at: ClipAt,
    grid: f64,
    amount: f64,
) -> Result<std::sync::Arc<SampleReading>, String> {
    if !(grid.is_finite() && grid > 0.0 && grid <= 64.0) {
        return Err("The grid is a length in beats, more than 0 and at most 64".into());
    }
    if !(amount.is_finite() && amount > 0.0 && amount <= 100.0) {
        return Err(
            "Amount is how far each transient moves toward the grid: more than 0 % and at most 100 %"
                .into(),
        );
    }
    let (_, root) = edit::open(path)?;
    let clip = clip_at(track_at(&root, track)?, at)?;
    let named = value_of(clip, "Name")
        .filter(|n| !n.is_empty())
        .unwrap_or("the clip");
    if clip.name != "AudioClip" {
        return Err(format!(
            "{named} is a MIDI clip: it has notes, not transients, and Quantize here moves an audio clip's transients"
        ));
    }
    if edit::flag(clip, "IsWarped") == Some(false) {
        return Err(format!(
            "{named} is unwarped: Quantize moves its transients through warp markers, so turn its Warp on first"
        ));
    }
    clip_sample(path, clip)
}

/// A grid in Live's words: a note value ("1/16"), its triplet ("1/8T"), or else its length in beats.
fn grid_name(beats: f64) -> String {
    let whole =
        |n: f64| n >= 1.0 && (n - n.round()).abs() < 1e-9 && (n.round() as u64).is_power_of_two();
    let (straight, triplet) = (4.0 / beats, 4.0 / (beats * 1.5));
    if whole(straight) {
        format!("1/{}", straight.round() as u64)
    } else if whole(triplet) {
        format!("1/{}T", triplet.round() as u64)
    } else {
        format!("{}-beat", number_text(beats))
    }
}

/// Quantize on audio clip `at` of part `track` ([`SetAct::ClipQuantize`]): `sample`'s transients moved toward the grid by the
/// amount, through its warp markers ([`edit::quantize_transients`]). Answered in words: how many moved, stood on the grid already,
/// or could not move; refused where none lies between the clip's start and end markers, or none moves, and the set is not written.
fn clip_quantize(
    root: &mut Element,
    track: usize,
    at: ClipAt,
    grid: f64,
    amount: f64,
    sample: &SampleReading,
) -> Result<Done, String> {
    let clip = edit::clip_at_mut(edit::track_at_mut(root, track)?, at)?;
    let named = value_of(clip, "Name")
        .filter(|n| !n.is_empty())
        .unwrap_or("the clip")
        .to_string();
    let done = edit::quantize_transients(clip, grid, amount, &sample.transients)?;
    let noun = |n: usize| if n == 1 { "transient" } else { "transients" };
    let named_grid = grid_name(grid);
    if done.seen == 0 {
        return Err(format!(
            "{named} has no transient between its start and end markers, so nothing was quantized"
        ));
    }
    if done.moved == 0 {
        return Err(if done.kept == 0 {
            format!(
                "{named}'s {} {} {} on the {named_grid} grid already, so nothing was quantized",
                done.seen,
                noun(done.seen),
                if done.seen == 1 { "stands" } else { "stand" }
            )
        } else {
            format!("{named}'s transients would each reach the warp marker beside them, so nothing was quantized")
        });
    }
    let mut words = format!(
        "Quantized {named}: {} {} moved toward the {named_grid} grid by {} %",
        done.moved,
        noun(done.moved),
        number_text(amount)
    );
    if done.on_grid > 0 {
        words += &format!(", {} already on it", done.on_grid);
    }
    if done.kept > 0 {
        words += &format!(
            ", {} not moved, as {} would reach the warp marker beside it",
            done.kept,
            if done.kept == 1 { "it" } else { "each" }
        );
    }
    words.push('.');
    let place = match at {
        ClipAt::Arrangement(j) => json!({"track": track, "arrangement": j}),
        ClipAt::Slot(scene) => json!({"track": track, "slot": scene}),
    };
    Ok(Done {
        words,
        at: Some(place),
        places: Places::None,
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

/// The blank set's scenes (DLW build ruling 2026-11-08, LV01: "four empty scenes"), and so its parts' slots.
const BLANK_SCENES: usize = 4;
/// How many MIDI controllers a MIDI part's sequencer keeps a target for (`MidiControllers`, `ControllerTargets.0` to `.130`).
const MIDI_CONTROLLER_TARGETS: usize = 131;

/// One element as Live writes a value: `<name Value="value" />`.
fn blank_value(name: &str, value: &str) -> String {
    format!(r#"<{name} Value="{value}" />"#)
}

/// A routing as Live writes one: its target, the two words that name it, and its MPE zone (none, channels 1 to 15).
fn blank_routing(tag: &str, target: &str, upper: &str, lower: &str) -> String {
    format!(
        concat!(
            r#"<{tag}><Target Value="{target}" /><UpperDisplayString Value="{upper}" /><LowerDisplayString Value="{lower}" />"#,
            r#"<MpeSettings><ZoneType Value="0" /><FirstNoteChannel Value="1" /><LastNoteChannel Value="15" /></MpeSettings></{tag}>"#
        ),
        tag = tag,
        target = target,
        upper = upper,
        lower = lower
    )
}

/// What a track's own devices (its mixer and its sequencers) begin with as Live writes them: the device boilerplate with no preset
/// of its own (an empty `LastPresetRef`, where [`boilerplate`] names the default preset of a device made from the browser).
fn blank_device_head() -> String {
    format!(
        concat!(
            r#"<LomId Value="0" /><LomIdView Value="0" /><IsExpanded Value="true" />{on}<ModulationSourceCount Value="0" />"#,
            r#"<ParametersListWrapper LomId="0" /><Pointee Id="0" /><LastSelectedTimeableIndex Value="0" />"#,
            r#"<LastSelectedClipEnvelopeIndex Value="0" /><LastPresetRef><Value /></LastPresetRef><LockedScripts />"#,
            r#"<IsFolded Value="false" /><ShouldShowPresetName Value="false" /><UserName Value="" /><Annotation Value="" />"#,
            r#"<SourceContext><Value /></SourceContext>"#
        ),
        on = switch("On")
    )
}

/// A track's mixer as Live writes it: its boilerplate, one send per return (each at its floor, on or off for the track), its
/// Speaker, solo, pan (and the split-stereo pair), volume at unity and crossfade; the Main track's also its tempo (at `bpm`), time
/// signature (4/4, Live's 201), groove amount, crossfader and the tempo lane's view.
fn blank_mixer(sends: &[bool], main_at: Option<&str>) -> String {
    let sends: String = sends
        .iter()
        .enumerate()
        .map(|(i, on)| {
            format!(
                r#"<TrackSendHolder Id="{i}">{}<EnabledByUser Value="{on}" /></TrackSendHolder>"#,
                timeable("Send", SEND_OFF, SEND_OFF, "1")
            )
        })
        .collect();
    let main = main_at.map_or_else(String::new, |bpm| {
        format!(
            concat!(
                "{tempo}",
                r#"<TimeSignature><LomId Value="0" /><Manual Value="201" /><AutomationTarget Id="0">{target}</AutomationTarget></TimeSignature>"#,
                "{groove}{fade}",
                r#"<TempoAutomationViewBottom Value="60" /><TempoAutomationViewTop Value="200" />"#
            ),
            tempo = timeable("Tempo", bpm, "60", "200"),
            target = TARGET,
            groove = timeable("GlobalGrooveAmount", "100", "0", "131.25"),
            fade = timeable("CrossFade", "0", "-1", "1"),
        )
    });
    format!(
        concat!(
            "<Mixer>{head}<Sends>{sends}</Sends>{speaker}",
            r#"<SoloSink Value="false" /><PanMode Value="0" />"#,
            "{pan}{left}{right}{volume}",
            r#"<ViewStateSesstionTrackWidth Value="93" /><CrossFadeState><LomId Value="0" /><Manual Value="1" />"#,
            r#"<AutomationTarget Id="0">{target}</AutomationTarget></CrossFadeState><SendsListWrapper LomId="0" />"#,
            "{main}</Mixer>"
        ),
        head = blank_device_head(),
        sends = sends,
        speaker = switch("Speaker"),
        pan = timeable("Pan", "0", "-1", "1"),
        left = timeable("SplitStereoPanL", "-1", "-1", "1"),
        right = timeable("SplitStereoPanR", "1", "-1", "1"),
        volume = timeable("Volume", "1", SEND_OFF, "1.99526238"),
        target = TARGET,
        main = main,
    )
}

/// `count` empty clip slots as Live writes them.
fn blank_slots(count: usize) -> String {
    (0..count)
        .map(|i| {
            format!(
                r#"<ClipSlot Id="{i}"><LomId Value="0" /><ClipSlot><Value /></ClipSlot><HasStop Value="true" /><NeedRefreeze Value="true" /></ClipSlot>"#
            )
        })
        .collect()
}

/// An empty arrangement lane (a sequencer's `ClipTimeable`, or `Sample`).
fn blank_lane(tag: &str) -> String {
    format!(
        concat!(
            r#"<{tag}><ArrangerAutomation><Events /><AutomationTransformViewState><IsTransformPending Value="false" />"#,
            r#"<TimeAndValueTransforms /></AutomationTransformViewState></ArrangerAutomation></{tag}>"#
        ),
        tag = tag
    )
}

/// A recorder, not armed, with no take recorded.
const BLANK_RECORDER: &str =
    r#"<Recorder><IsArmed Value="false" /><TakeCounter Value="0" /></Recorder>"#;

/// An audio sequencer's body as Live writes it (a part's freeze sequencer, the Main track's): its boilerplate, `slots` empty slots,
/// monitoring Auto, an empty lane, the sample's modulation targets, the views' scroll positions and its recorder.
fn blank_audio_sequencer(slots: usize) -> String {
    let targets: String = [
        "Volume",
        "Transposition",
        "TransientEnvelope",
        "GrainSize",
        "Flux",
        "SampleOffset",
        "ComplexProFormants",
        "ComplexProEnvelope",
    ]
    .iter()
    .map(|t| format!(r#"<{t}ModulationTarget Id="0">{TARGET}</{t}ModulationTarget>"#))
    .collect();
    format!(
        concat!(
            "{head}<ClipSlotList>{slots}</ClipSlotList>",
            r#"<MonitoringEnum Value="1" /><KeepRecordMonitoringLatency Value="true" />"#,
            "{lane}{targets}",
            r#"<PitchViewScrollPosition Value="-1073741824" /><SampleOffsetModulationScrollPosition Value="-1073741824" />"#,
            "{recorder}"
        ),
        head = blank_device_head(),
        slots = blank_slots(slots),
        lane = blank_lane("Sample"),
        targets = targets,
        recorder = BLANK_RECORDER,
    )
}

/// A MIDI part's main sequencer as Live writes it: its boilerplate, `slots` empty slots, monitoring Auto, an empty lane, its
/// recorder and a target for each MIDI controller.
fn blank_midi_sequencer(slots: usize) -> String {
    let controllers: String = (0..MIDI_CONTROLLER_TARGETS)
        .map(|i| format!(r#"<ControllerTargets.{i} Id="0">{TARGET}</ControllerTargets.{i}>"#))
        .collect();
    format!(
        concat!(
            "<MainSequencer>{head}<ClipSlotList>{slots}</ClipSlotList>",
            r#"<MonitoringEnum Value="1" /><KeepRecordMonitoringLatency Value="true" />"#,
            "{lane}{recorder}<MidiControllers>{controllers}</MidiControllers></MainSequencer>"
        ),
        head = blank_device_head(),
        slots = blank_slots(slots),
        lane = blank_lane("ClipTimeable"),
        recorder = BLANK_RECORDER,
        controllers = controllers,
    )
}

/// What every track begins with as Live writes it, through `LinkedTrackGroupId`: its ids, view, delay, name, colour, envelopes
/// (none), group (none), fold, its device and slot lists, view data and take lanes (none).
fn blank_track_head(name: &str, colour: &str, unfolded: bool) -> String {
    format!(
        concat!(
            r#"<LomId Value="0" /><LomIdView Value="0" /><IsContentSelectedInDocument Value="false" />"#,
            r#"<PreferredContentViewMode Value="0" /><TrackDelay><Value Value="0" /><IsValueSampleBased Value="false" /></TrackDelay>"#,
            r#"<Name><EffectiveName Value="{name}" /><UserName Value="" /><Annotation Value="" /><MemorizedFirstClipName Value="" />"#,
            r#"</Name><Color Value="{colour}" /><AutomationEnvelopes><Envelopes /></AutomationEnvelopes><TrackGroupId Value="-1" />"#,
            r#"<TrackUnfolded Value="{unfolded}" /><DevicesListWrapper LomId="0" /><ClipSlotsListWrapper LomId="0" />"#,
            r#"<ViewData Value="{{}}" /><TakeLanes><TakeLanes /><AreTakeLanesFolded Value="true" /></TakeLanes>"#,
            r#"<LinkedTrackGroupId Value="-1" />"#
        ),
        name = name,
        colour = colour,
        unfolded = unfolded
    )
}

/// What every track's device chain begins with as Live writes it: its automation lane (one, showing nothing chosen), the clip
/// envelope chooser, and its four routings (audio and MIDI in, from all of them, its sound out to `out`, MIDI out to none).
fn blank_chain_head(lane_height: &str, out: (&str, &str, &str)) -> String {
    format!(
        concat!(
            r#"<AutomationLanes><AutomationLanes><AutomationLane Id="0"><SelectedDevice Value="0" /><SelectedEnvelope Value="0" />"#,
            r#"<IsContentSelectedInDocument Value="false" /><LaneHeight Value="{height}" /></AutomationLane></AutomationLanes>"#,
            r#"<AreAdditionalAutomationLanesFolded Value="false" /></AutomationLanes><ClipEnvelopeChooserViewState>"#,
            r#"<SelectedDevice Value="0" /><SelectedEnvelope Value="0" /><PreferModulationVisible Value="false" />"#,
            r#"</ClipEnvelopeChooserViewState>{audio_in}{midi_in}{audio_out}{midi_out}"#
        ),
        height = lane_height,
        audio_in = blank_routing("AudioInputRouting", "AudioIn/External/S0", "Ext. In", "1/2"),
        midi_in = blank_routing(
            "MidiInputRouting",
            "MidiIn/External.All/-1",
            "All Ins",
            "All Channels"
        ),
        audio_out = blank_routing("AudioOutputRouting", out.0, out.1, out.2),
        midi_out = blank_routing("MidiOutputRouting", "MidiOut/None", "None", ""),
    )
}

/// An empty device list, as a track's inner chain holds one.
const BLANK_DEVICES: &str = "<DeviceChain><Devices /><SignalModulations /></DeviceChain>";
/// Where a track's sound goes: the Main track; and where the Main track's (and the cue's) goes: the first outputs.
const TO_MAIN: (&str, &str, &str) = ("AudioOut/Main", "Main", "");
const TO_OUTPUTS: (&str, &str, &str) = ("AudioOut/External/S0", "Ext. Out", "1/2");
/// Where a group's member's sound goes: its group (Group Tracks, [`tracks_group`]).
const TO_GROUP: (&str, &str, &str) = ("AudioOut/GroupTrack", "Group", "");

/// The blank set's document (DLW build ruling 2026-11-08, LV01; 0.10: "Take every element a set Live wrote keeps ... not a
/// hand-reduced XML"): one MIDI part, `1-MIDI`, with its mixer (on, not soloed, volume at unity, pan centred), its send to the
/// return (at its floor, on for the part), its recorder (not armed, monitoring Auto), MIDI from all inputs and its sound to the Main
/// track; one return, `A-Return`, its own send off; the Main track at 120 BPM in 4/4 with its own Volume and Pan; the cue track;
/// four empty scenes; and the set's own transport, grid, scale, views and note tools at a new set's values. It is written from the
/// document `packages/live-set/blank-set.md` (DLW build ruling 2026-11-09, 46c item 1; 47c item 7): every element and attribute its
/// table names a set Live 12.0.25 writes keeping is here, in Live's order and nesting — the tracks' (`LomId`, `DevicesListWrapper`, `TakeLanes`,
/// `Freeze` and the rest), their chains', mixers' and sequencers', and the set's, the view state the table marks as Live's own
/// included — and nothing the table does not name; where the blank set's value is not the one Live wrote, the table says so and
/// why. `the_blank_set_keeps_every_element_a_set_live_wrote_keeps` reads that table. Each target and pointee is numbered once below
/// `NextPointeeId` ([`new_set`]). The root names no `Creator`: Live did not write this set. That Live opens it is the owner's check
/// (walk #857): Live is never driven here.
fn blank_set() -> String {
    let scenes: String = (0..BLANK_SCENES)
        .map(|i| {
            format!(
                concat!(
                    r#"<Scene Id="{i}"><FollowAction><FollowTime Value="4" /><IsLinked Value="true" /><LoopIterations Value="1" />"#,
                    r#"<FollowActionA Value="4" /><FollowActionB Value="0" /><FollowChanceA Value="100" /><FollowChanceB Value="0" />"#,
                    r#"<JumpIndexA Value="0" /><JumpIndexB Value="0" /><FollowActionEnabled Value="false" /></FollowAction>"#,
                    r#"<Name Value="" /><Annotation Value="" /><Color Value="-1" /><Tempo Value="120" /><IsTempoEnabled Value="false" />"#,
                    r#"<TimeSignatureId Value="201" /><IsTimeSignatureEnabled Value="false" /><LomId Value="0" />"#,
                    r#"<ClipSlotsListWrapper LomId="0" /></Scene>"#
                ),
                i = i
            )
        })
        .collect();
    let midi = format!(
        concat!(
            r#"<MidiTrack Id="12">{head}<SavedPlayingSlot Value="-1" /><SavedPlayingOffset Value="0" /><Freeze Value="false" />"#,
            r#"<VelocityDetail Value="0" /><NeedArrangerRefreeze Value="true" /><PostProcessFreezeClips Value="0" />"#,
            "<DeviceChain>{chain}{mixer}{sequencer}<FreezeSequencer>{freeze}</FreezeSequencer>{devices}</DeviceChain>",
            r#"<ReWireDeviceMidiTargetId Value="0" /><PitchbendRange Value="96" /><IsTuned Value="true" />"#,
            r#"<ControllerLayoutRemoteable Value="0" /><ControllerLayoutCustomization><PitchClassSource Value="0" />"#,
            r#"<OctaveSource Value="2" /><KeyNoteTarget Value="60" /><StepSize Value="1" /><OctaveEvery Value="12" />"#,
            r#"<AllowedKeys Value="0" /><FillerKeysMapTo Value="0" /></ControllerLayoutCustomization></MidiTrack>"#
        ),
        head = blank_track_head("1-MIDI", "10", true),
        chain = blank_chain_head("68", TO_MAIN),
        mixer = blank_mixer(&[true], None),
        sequencer = blank_midi_sequencer(BLANK_SCENES),
        freeze = blank_audio_sequencer(BLANK_SCENES),
        devices = BLANK_DEVICES,
    );
    let ret = format!(
        r#"<ReturnTrack Id="2">{head}<DeviceChain>{chain}{mixer}{devices}<FreezeSequencer>{freeze}</FreezeSequencer></DeviceChain></ReturnTrack>"#,
        head = blank_track_head("A-Return", "22", false),
        chain = blank_chain_head("85", TO_MAIN),
        mixer = blank_mixer(&[false], None),
        devices = BLANK_DEVICES,
        freeze = blank_audio_sequencer(0),
    );
    let main = format!(
        concat!(
            "<MainTrack>{head}<DeviceChain>{chain}{mixer}",
            r#"<FreezeSequencer><AudioSequencer Id="0">{freeze}</AudioSequencer></FreezeSequencer>{devices}</DeviceChain></MainTrack>"#
        ),
        head = blank_track_head("Main", "8", true),
        chain = blank_chain_head("85", TO_OUTPUTS),
        mixer = blank_mixer(&[], Some("120")),
        freeze = blank_audio_sequencer(0),
        devices = BLANK_DEVICES,
    );
    let cue = format!(
        "<PreHearTrack>{head}<DeviceChain>{chain}{mixer}{devices}</DeviceChain></PreHearTrack>",
        head = blank_track_head("Master", "-1", false),
        chain = blank_chain_head("85", TO_OUTPUTS),
        mixer = blank_mixer(&[], None),
        devices = BLANK_DEVICES,
    );
    let lanes = |models: &[(&str, &str, bool)]| -> String {
        models
            .iter()
            .enumerate()
            .map(|(i, (kind, size, minimized))| {
                format!(
                    r#"<MidiEditorLaneModel Id="{i}"><Type Value="{kind}" /><Size Value="{size}" /><IsMinimized Value="{minimized}" /></MidiEditorLaneModel>"#
                )
            })
            .collect()
    };
    let views: String = [
        ("MixerInArrangement", "0"),
        ("ArrangerMixerIO", "1"),
        ("ArrangerMixerSends", "1"),
        ("ArrangerMixerReturns", "1"),
        ("ArrangerMixerVolume", "1"),
        ("ArrangerMixerTrackOptions", "0"),
        ("ArrangerMixerCrossFade", "0"),
        ("ArrangerMixerTrackPerformanceImpactMeter", "0"),
        ("MixerInSession", "1"),
        ("SessionIO", "1"),
        ("SessionSends", "1"),
        ("SessionReturns", "1"),
        ("SessionVolume", "1"),
        ("SessionTrackOptions", "0"),
        ("SessionCrossFade", "0"),
        ("SessionTrackPerformanceImpactMeter", "0"),
        ("SessionShowOverView", "0"),
        ("ArrangerIO", "1"),
        ("ArrangerReturns", "1"),
        ("ArrangerVolume", "1"),
        ("ArrangerTrackOptions", "0"),
        ("ArrangerShowOverView", "1"),
    ]
    .iter()
    .map(|(name, value)| blank_value(name, value))
    .collect();
    let valued = |pairs: &[(&str, &str)]| -> String {
        pairs
            .iter()
            .map(|(name, value)| blank_value(name, value))
            .collect()
    };
    let breakpoint = |i: usize, time: &str, active: bool| {
        format!(
            concat!(
                r#"<Breakpoint Id="{i}"><Value Value="0.5" /><Time Value="{time}" /><Control1X Value="0.5" /><Control1Y Value="0.5" />"#,
                r#"<Control2X Value="0.5" /><Control2Y Value="0.5" /><IsActive Value="{active}" /></Breakpoint>"#
            ),
            i = i,
            time = time,
            active = active
        )
    };
    let shape_levels: String = (0..=20)
        .map(|i| {
            format!(
                r#"<RemoteableFloat Id="{i}" Value="{}" />"#,
                number_text(f64::from(i) / 20.0)
            )
        })
        .collect();
    let algorithms = format!(
        concat!(
            r#"<NoteAlgorithms><ArpeggiateAlgorithm Id="0">{arpeggiate}</ArpeggiateAlgorithm><SpanAlgorithm Id="1">{span}</SpanAlgorithm>"#,
            r#"<ConnectAlgorithm Id="2">{connect}</ConnectAlgorithm><OrnamentAlgorithm Id="3">{ornament}</OrnamentAlgorithm>"#,
            r#"<RecombineAlgorithm Id="4">{recombine}</RecombineAlgorithm><QuantizeAlgorithm Id="5">{quantize}</QuantizeAlgorithm>"#,
            r#"<StrumAlgorithm Id="6">{strum}</StrumAlgorithm><TimeWarpAlgorithm Id="7"><Breakpoints>{breakpoints}</Breakpoints>"#,
            r#"{warp}</TimeWarpAlgorithm><RhythmAlgorithm Id="8">{rhythm}</RhythmAlgorithm><StacksAlgorithm Id="9"><Sequence>"#,
            r#"<Chord Id="0">{chord}</Chord></Sequence></StacksAlgorithm><ShapeAlgorithm Id="10"><ShapeLevels>{levels}</ShapeLevels>"#,
            r#"{shape}</ShapeAlgorithm><SeedAlgorithm Id="11">{seed}</SeedAlgorithm></NoteAlgorithms>"#
        ),
        arpeggiate = valued(&[
            ("Rate", "10"),
            ("Steps", "2"),
            ("Distance", "12"),
            ("Gate", "1"),
            ("Style", "0")
        ]),
        span = valued(&[
            ("Mode", "1"),
            ("ChordThreshold", "10"),
            ("LengthVariation", "0"),
            ("LengthOffset", "0"),
            ("FixedLength", "0")
        ]),
        connect = valued(&[
            ("Tie", "0"),
            ("Density", "1"),
            ("Spread", "0"),
            ("Rate", "0")
        ]),
        ornament = valued(&[
            ("FlamEnabled", "true"),
            ("FlamPosition", "-0.200000003"),
            ("FlamVelocity", "0.5"),
            ("GraceNotesEnabled", "false"),
            ("GraceNotesChance", "1"),
            ("GraceNotesVelocity", "0.5"),
            ("GraceNotesPosition", "-0.200000003"),
            ("GraceNotesAmount", "3"),
            ("GraceNotesPitch", "1"),
        ]),
        recombine = valued(&[
            ("PermutePitches", "true"),
            ("PermuteDurations", "true"),
            ("PermuteVelocities", "true"),
            ("Shuffle", "false"),
            ("Mirror", "false"),
            ("RotateAmount", "0"),
        ]),
        quantize = valued(&[
            ("Reference", "0"),
            ("TripletReference", "false"),
            ("QuantizeNoteStarts", "true"),
            ("QuantizeNoteEnds", "false"),
            ("Amount", "100"),
        ]),
        strum = valued(&[
            ("ChordThreshold", "0"),
            ("StrumLow", "0"),
            ("StrumHigh", "0"),
            ("TensionAmount", "0")
        ]),
        breakpoints = [
            breakpoint(0, "0", true),
            breakpoint(1, "0.5", false),
            breakpoint(2, "1", true)
        ]
        .concat(),
        warp = valued(&[
            ("StretchNoteEnd", "true"),
            ("PreserveTimeRange", "true"),
            ("Quantize", "false")
        ]),
        rhythm = valued(&[
            ("Density", "4"),
            ("Repetitions", "1"),
            ("Pattern", "14"),
            ("PatternLength", "8"),
            ("Pitch", "36"),
            ("Velocity", "100"),
            ("Accent", "127"),
            ("Period", "4"),
            ("Offset", "0"),
            ("Shift", "0"),
            ("StepDuration", "7"),
            ("Split", "0"),
        ]),
        chord = valued(&[
            ("RootDegree", "0"),
            ("Octave", "3"),
            ("RootPitch", "60"),
            ("Inversion", "0"),
            ("RuleNumber", "0"),
            ("Duration", "1"),
            ("Offset", "0"),
        ]),
        levels = shape_levels,
        shape = valued(&[
            ("ShapePresets", "2"),
            ("Rate", "0"),
            ("Tie", "0"),
            ("Density", "1"),
            ("MinPitch", "60"),
            ("MaxPitch", "84"),
            ("PitchVariation", "0"),
        ]),
        seed = valued(&[
            ("NotesDensity", "0.5"),
            ("MinPitch", "60"),
            ("MaxPitch", "84"),
            ("MinDuration", "-6"),
            ("MaxDuration", "-3"),
            ("MinVelocity", "30"),
            ("MaxVelocity", "100"),
            ("VerticalLimit", "4"),
        ]),
    );
    format!(
        concat!(
            r#"<?xml version="1.0" encoding="UTF-8"?>"#,
            "\n",
            r#"<Ableton MajorVersion="5" MinorVersion="12.0_12049" SchemaChangeCount="12"><LiveSet>"#,
            r#"<NextPointeeId Value="0" /><OverwriteProtectionNumber Value="3072" /><LomId Value="0" /><LomIdView Value="0" />"#,
            "<Tracks>{midi}{ret}</Tracks>{main}{cue}",
            r#"<SendsPre><SendPreBool Id="0" Value="false" /></SendsPre><Scenes>{scenes}</Scenes>"#,
            r#"<Transport><PhaseNudgeTempo Value="10" /><LoopOn Value="false" /><LoopStart Value="0" /><LoopLength Value="16" />"#,
            r#"<LoopIsSongStart Value="false" /><CurrentTime Value="0" /><PunchIn Value="false" /><PunchOut Value="false" />"#,
            r#"<MetronomeTickDuration Value="0" /><DrawMode Value="false" /></Transport><SessionScrollPos X="0" Y="0" />"#,
            r#"<SignalModulations /><GlobalQuantisation Value="4" /><AutoQuantisation Value="0" /><Grid><FixedNumerator Value="1" />"#,
            r#"<FixedDenominator Value="16" /><GridIntervalPixel Value="20" /><Ntoles Value="2" /><SnapToGrid Value="true" />"#,
            r#"<Fixed Value="false" /></Grid><ScaleInformation><RootNote Value="0" /><Name Value="Major" /></ScaleInformation>"#,
            r#"<InKey Value="false" /><SmpteFormat Value="0" /><TimeSelection><AnchorTime Value="0" /><OtherTime Value="0" />"#,
            r#"</TimeSelection><SequencerNavigator><BeatTimeHelper><CurrentZoom Value="1" /></BeatTimeHelper>"#,
            r#"<ScrollerPos X="0" Y="0" /><ClientSize X="0" Y="0" /></SequencerNavigator><IsContentSplitterOpen Value="true" />"#,
            r#"<IsExpressionSplitterOpen Value="true" /><ExpressionLanes>{expression}</ExpressionLanes><ContentLanes>{content}"#,
            r#"</ContentLanes><ViewStateFxSlotCount Value="4" /><ViewStateSessionMixerHeight Value="120" />"#,
            r#"<ViewStateArrangerMixerVolumeSectionHeight Value="120" /><ShouldSceneTempoAndTimeSignatureBeVisible Value="false" />"#,
            r#"<WaveformVerticalZoomFactor Value="1" /><IsWaveformVerticalZoomActive Value="true" /><Locators><Locators />"#,
            r#"</Locators><DetailClipKeyMidis /><TracksListWrapper LomId="0" /><VisibleTracksListWrapper LomId="0" />"#,
            r#"<ReturnTracksListWrapper LomId="0" /><ScenesListWrapper LomId="0" /><CuePointsListWrapper LomId="0" />"#,
            r#"<ChooserBar Value="0" /><Annotation Value="" /><SoloOrPflSavedValue Value="true" /><SoloInPlace Value="true" />"#,
            r#"<CrossfadeCurve Value="2" /><LatencyCompensation Value="2" /><HighlightedTrackIndex Value="0" />"#,
            r#"<GroovePool><LomId Value="0" /><Grooves /></GroovePool><AutomationMode Value="false" />"#,
            r#"<SnapAutomationToGrid Value="true" /><ArrangementOverdub Value="false" /><ColorSequenceIndex Value="0" />"#,
            r#"<AutoColorPickerForPlayerAndGroupTracks><NextColorIndex Value="11" /></AutoColorPickerForPlayerAndGroupTracks>"#,
            r#"<AutoColorPickerForReturnAndMainTracks><NextColorIndex Value="0" /></AutoColorPickerForReturnAndMainTracks>"#,
            r#"<ViewData Value="{{}}" /><ResetNonautomatedMidiControllersOnClipStarts Value="true" /><MidiFoldIn Value="false" />"#,
            r#"<MidiFoldMode Value="0" /><MultiClipFocusMode Value="false" /><MultiClipLoopBarHeight Value="0" />"#,
            r#"<MidiPrelisten Value="false" /><LinkedTrackGroups /><NoteSpellingPreference Value="0" />"#,
            r#"<AccidentalSpellingPreference Value="3" /><PreferFlatRootNote Value="false" /><UseWarperLegacyHiQMode Value="false" />"#,
            r#"<VideoWindowRect Top="-2147483648" Left="-2147483648" Bottom="-2147483648" Right="-2147483648" />"#,
            r#"<ShowVideoWindow Value="true" /><TuningSystems /><TrackHeaderWidth Value="93" />"#,
            r#"<ViewStateMainWindowClipDetailOpen Value="false" /><ViewStateMainWindowHiddenOtherDocViewTypeClipDetailOpen Value="false" />"#,
            r#"<ViewStateMainWindowHiddenOtherDocViewTypeDeviceDetailOpen Value="true" /><ViewStateMainWindowDeviceDetailOpen Value="true" />"#,
            r#"<ViewStateSecondWindowClipDetailOpen Value="false" /><ViewStateSecondWindowDeviceDetailOpen Value="false" />"#,
            "<ViewStates>{views}</ViewStates>{algorithms}</LiveSet></Ableton>"
        ),
        midi = midi,
        ret = ret,
        main = main,
        cue = cue,
        scenes = scenes,
        expression = lanes(&[
            ("0", "41", false),
            ("1", "41", false),
            ("2", "41", true),
            ("3", "41", true)
        ]),
        content = lanes(&[("4", "41", false), ("5", "25", true)]),
        views = views,
        algorithms = algorithms,
    )
}

/// Make a new set at `path` (DLW build ruling 2026-11-08, LV01: "live-set gains a new-set act that writes a minimal set"): the blank
/// set ([`blank_set`]). `path` names a `.als` in a folder that stands. A set that stands there is never written over: the set is written
/// under a name of its own, made only where nothing stands and synced to its volume, read back by its own reader, and linked into
/// place. On a volume that keeps no hard links it is moved into place in one step that never writes over a set: by link or by move,
/// the set reaches its name whole. On a volume that makes no such move either (FAT, exFAT, SMB) no step both puts a set at its name
/// and never writes over one, so the set is made at its name, only where nothing stands there, and filled there from the staged set
/// (round 48's review, item 11; DLW build ruling 2026-11-09, 0C item 11): while it is filled, a reader of that name finds it partial,
/// and a process stopped part way leaves it partial there; a copy that fails is taken away. Answers `{path, revision, tracks}`. Where a
/// set is kept is the caller's (the kernel's `live_set_new`: the Music folder or one of Live's places).
pub fn new_set(path: &str) -> Result<Value, String> {
    new_set_in(path, &Volume)
}

/// What New set does in the folder it keeps a set in, one call each (DLW build ruling 2026-11-09, 47c item 2): [`Volume`] is the
/// machine's own; a test stands in for a volume that keeps no hard links, or makes no exclusive move.
trait SetFolder {
    /// `path` made and opened for writing only where nothing stands at it (`create_new`, O_CREAT|O_EXCL).
    fn create_new(&self, path: &std::path::Path) -> std::io::Result<Box<dyn NewFile + '_>>;
    fn hard_link(&self, from: &std::path::Path, to: &std::path::Path) -> std::io::Result<()>;
    /// `from` moved to `to` in one step, only where nothing stands at `to` ([`rename_no_replace`]).
    fn rename_no_replace(
        &self,
        from: &std::path::Path,
        to: &std::path::Path,
    ) -> std::io::Result<()>;
    fn open(&self, path: &std::path::Path) -> std::io::Result<Box<dyn std::io::Read + '_>>;
    fn remove_file(&self, path: &std::path::Path) -> std::io::Result<()>;
}

/// A file New set made: written, then synced to its volume.
trait NewFile: std::io::Write {
    fn sync_all(&self) -> std::io::Result<()>;
}

impl NewFile for std::fs::File {
    fn sync_all(&self) -> std::io::Result<()> {
        std::fs::File::sync_all(self)
    }
}

/// The machine's own folders.
struct Volume;

impl SetFolder for Volume {
    fn create_new(&self, path: &std::path::Path) -> std::io::Result<Box<dyn NewFile + '_>> {
        let file = std::fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(path)?;
        Ok(Box::new(file))
    }
    fn hard_link(&self, from: &std::path::Path, to: &std::path::Path) -> std::io::Result<()> {
        std::fs::hard_link(from, to)
    }
    fn rename_no_replace(
        &self,
        from: &std::path::Path,
        to: &std::path::Path,
    ) -> std::io::Result<()> {
        rename_no_replace(from, to)
    }
    fn open(&self, path: &std::path::Path) -> std::io::Result<Box<dyn std::io::Read + '_>> {
        Ok(Box::new(std::fs::File::open(path)?))
    }
    fn remove_file(&self, path: &std::path::Path) -> std::io::Result<()> {
        std::fs::remove_file(path)
    }
}

/// [`new_set`] in `folder`'s volume.
fn new_set_in(path: &str, fs: &dyn SetFolder) -> Result<Value, String> {
    use std::io::Write;
    let target = std::path::Path::new(path);
    if target.extension().and_then(|e| e.to_str()) != Some("als") {
        return Err(format!(
            "A new set is a Live set file (.als), and {path} is not one"
        ));
    }
    let (Some(folder), Some(name)) = (target.parent(), target.file_name()) else {
        return Err(format!("{path} names no file in a folder"));
    };
    if !std::fs::symlink_metadata(folder).is_ok_and(|m| m.is_dir()) {
        return Err(format!(
            "{} is no folder: the new set has nowhere to be kept",
            folder.display()
        ));
    }
    let stands = || format!("A set stands there already ({path}): a new set never writes over one");
    if std::fs::symlink_metadata(target).is_ok() {
        return Err(stands());
    }
    let mut root = crate::xml::parse(&blank_set())
        .map_err(|e| format!("The blank set does not parse: {}", e.0))?;
    if let Some(set) = root.find_mut("LiveSet") {
        let (mut next, mut map) = (1, std::collections::HashMap::new());
        reallocate(set, &mut next, &mut map);
        if let Some(n) = set.child_mut("NextPointeeId") {
            n.set_attr("Value", &next.to_string());
        }
    }
    let bytes =
        crate::write_gz(&root).map_err(|e| format!("The blank set could not be written: {e}"))?;
    let staged = folder.join(format!(
        ".{}.oi-new-{}",
        name.to_string_lossy(),
        std::process::id()
    ));
    let written = |e: std::io::Error| format!("The new set could not be written: {e}");
    // Something at the staged name is a set being made there already (another New set of this name), or one left by a New set that
    // stopped: it is named, and neither written over nor taken away (round 48's review, item 10; DLW build ruling 2026-11-09, 0C item
    // 10).
    let being_made = |e: std::io::Error| {
        if e.kind() != std::io::ErrorKind::AlreadyExists {
            return written(e);
        }
        let stands = staged.file_name().unwrap_or_default().to_string_lossy();
        // The staged file is hidden (its name starts with a dot), so its folder is named too (0D item 10).
        let folder = folder.display();
        format!("A set is being made at {path} already ({stands} stands in {folder}), so this one is not made: if no New set is running, that file is left from one that stopped, and taking it away lets a set be made here")
    };
    // Staged under a name of its own, made only where nothing stands there (what stands there is not ours, and stays), written whole
    // and synced to its volume before it is linked (47c item 2).
    let staging = {
        let mut file = fs.create_new(&staged).map_err(being_made)?;
        file.write_all(&bytes)
            .and_then(|()| file.sync_all())
            .map_err(written)
    };
    let kept = staging
        .and_then(|()| {
            crate::api::set_json(&staged.to_string_lossy())
                .map(|_| ())
                .map_err(|e| format!("The new set does not read back ({e}): no set was made"))
        })
        .and_then(|()| put_in_place(fs, &staged, target, &stands, "set"));
    // Moved into place, the staged name holds nothing of ours; otherwise what was staged is taken away.
    if !matches!(kept, Ok(Placed::Moved)) {
        let _ = fs.remove_file(&staged);
    }
    kept?;
    Ok(
        json!({"path": path, "revision": crate::edit::revision(&bytes), "tracks": tracks(&root).len() - 1}),
    )
}

/// How the staged set reached its name: linked or copied (the staged name still holds it), or moved (it holds nothing now).
enum Placed {
    Linked,
    Moved,
    Copied,
}

/// The staged set, whole and read back, put at `target`, never over a set: linked; on a volume that keeps no hard links (DLW build
/// ruling 2026-11-09, 46c item 9) moved in one step that never writes over a set; and on one that makes no such move either (FAT,
/// exFAT, SMB; 47c item 2) copied to `target`, made only where nothing stands there and synced. That copy is filled at the set's name
/// (0C item 11): a copy that fails is taken away, and one a stopped process leaves part way stays partial at the name. `what` names
/// what is put: a set, or a sample an act keeps beside one ([`put_new`], 48e item 7).
fn put_in_place(
    fs: &dyn SetFolder,
    staged: &std::path::Path,
    target: &std::path::Path,
    stands: &dyn Fn() -> String,
    what: &str,
) -> Result<Placed, String> {
    let kept = |e: std::io::Error| match e.kind() {
        std::io::ErrorKind::AlreadyExists => stands(),
        _ => format!("The new {what} could not be kept: {e}"),
    };
    match fs.hard_link(staged, target) {
        Ok(()) => return Ok(Placed::Linked),
        Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => return Err(stands()),
        Err(e) if !link_unsupported(&e) => {
            return Err(format!(
                "The new {what} could not be linked into place ({e}), so no {what} was made"
            ))
        }
        Err(_) => {}
    }
    match fs.rename_no_replace(staged, target) {
        Ok(()) => return Ok(Placed::Moved),
        Err(e) if !exclusive_move_unsupported(&e) => return Err(kept(e)),
        Err(_) => {}
    }
    // The staged set opened first, so a set that cannot be read leaves nothing at the name.
    let mut from = fs.open(staged).map_err(kept)?;
    let mut copy = fs.create_new(target).map_err(kept)?;
    let copied = std::io::copy(&mut from, &mut copy).and_then(|_| copy.sync_all());
    drop(copy);
    copied.map(|()| Placed::Copied).map_err(|e| {
        // The copy at the set's name is ours (made where nothing stood): taken away, whole or not.
        let _ = fs.remove_file(target);
        format!("The new {what} could not be copied into place ({e}), so no {what} was made")
    })
}

/// Whether a move that never writes over a set failed because the volume makes none: the one failure the copy answers (47c item 2).
/// macOS `renamex_np` answers ENOTSUP where the volume does not support `RENAME_EXCL` (EOPNOTSUPP too); Linux `renameat2` answers
/// EINVAL where it does not support `RENAME_NOREPLACE` (EOPNOTSUPP too). Any other failure is said in words.
fn exclusive_move_unsupported(e: &std::io::Error) -> bool {
    #[cfg(target_os = "macos")]
    const UNSUPPORTED: &[i32] = &[45, 102];
    #[cfg(target_os = "linux")]
    const UNSUPPORTED: &[i32] = &[22, 95];
    #[cfg(not(any(target_os = "macos", target_os = "linux")))]
    const UNSUPPORTED: &[i32] = &[];
    e.kind() == std::io::ErrorKind::Unsupported
        || e.raw_os_error().is_some_and(|n| UNSUPPORTED.contains(&n))
}

/// Whether a hard link failed because the folder's volume keeps none, or the link would cross volumes: the one failure the staged
/// copy's move answers (DLW build ruling 2026-11-09, 46c item 9). Any other failure is said in words.
fn link_unsupported(e: &std::io::Error) -> bool {
    // EXDEV, and a volume's "not supported": ENOTSUP and EOPNOTSUPP on macOS; EOPNOTSUPP and EPERM on Linux, whose link(2) says EPERM
    // where "the filesystem containing oldpath and newpath does not support the creation of hard links" (the staged copy is ours).
    #[cfg(target_os = "macos")]
    const UNSUPPORTED: &[i32] = &[18, 45, 102];
    #[cfg(target_os = "linux")]
    const UNSUPPORTED: &[i32] = &[18, 95, 1];
    #[cfg(not(any(target_os = "macos", target_os = "linux")))]
    const UNSUPPORTED: &[i32] = &[];
    e.kind() == std::io::ErrorKind::Unsupported
        || e.raw_os_error().is_some_and(|n| UNSUPPORTED.contains(&n))
}

/// `from` moved to `to` in one step, only if nothing stands at `to` (macOS `renamex_np` with `RENAME_EXCL`, Linux `renameat2` with
/// `RENAME_NOREPLACE`): the move into place a volume that keeps no hard links still makes without writing over a set. A set that
/// stands at `to` is an `AlreadyExists` error.
#[cfg(any(target_os = "macos", target_os = "linux"))]
fn rename_no_replace(from: &std::path::Path, to: &std::path::Path) -> std::io::Result<()> {
    use std::ffi::{c_char, c_int, c_uint, CString};
    use std::os::unix::ffi::OsStrExt;
    let c = |p: &std::path::Path| {
        CString::new(p.as_os_str().as_bytes()).map_err(|_| {
            std::io::Error::new(std::io::ErrorKind::InvalidInput, "a path holds a NUL byte")
        })
    };
    let (from, to) = (c(from)?, c(to)?);
    #[cfg(target_os = "macos")]
    let done = {
        extern "C" {
            fn renamex_np(from: *const c_char, to: *const c_char, flags: c_uint) -> c_int;
        }
        const RENAME_EXCL: c_uint = 0x0000_0004;
        // SAFETY: both are NUL-terminated paths that live across the call; renamex_np only reads them.
        unsafe { renamex_np(from.as_ptr(), to.as_ptr(), RENAME_EXCL) }
    };
    #[cfg(target_os = "linux")]
    let done = {
        extern "C" {
            fn renameat2(
                olddirfd: c_int,
                oldpath: *const c_char,
                newdirfd: c_int,
                newpath: *const c_char,
                flags: c_uint,
            ) -> c_int;
        }
        const AT_FDCWD: c_int = -100;
        const RENAME_NOREPLACE: c_uint = 1;
        // SAFETY: both are NUL-terminated paths that live across the call; renameat2 only reads them.
        unsafe {
            renameat2(
                AT_FDCWD,
                from.as_ptr(),
                AT_FDCWD,
                to.as_ptr(),
                RENAME_NOREPLACE,
            )
        }
    };
    if done == 0 {
        Ok(())
    } else {
        Err(std::io::Error::last_os_error())
    }
}

/// Where no move that never writes over a set is known, none is made, and the set is copied to its name instead ([`put_in_place`]).
#[cfg(not(any(target_os = "macos", target_os = "linux")))]
fn rename_no_replace(_: &std::path::Path, _: &std::path::Path) -> std::io::Result<()> {
    Err(std::io::Error::new(
        std::io::ErrorKind::Unsupported,
        "this system has no move that never writes over a set",
    ))
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
    // Reverse writes its sample first ([`clip_reverse`]), which makes the act again with it.
    if let (SetAct::ClipReverse { track, clip }, None) = (act, sample) {
        return clip_reverse(path, expected_revision, *track, *clip);
    }
    if let SetAct::TakeRecord {
        keeps: Some(keeps), ..
    } = act
    {
        crate::sources::checked_take_keeps(keeps)?;
    }
    // The transients Quantize moves, found in the clip's sample before the set is written (round 48d item 2).
    let heard = match act {
        SetAct::ClipQuantize {
            track,
            clip,
            grid,
            amount,
        } => Some(quantize_source(path, *track, *clip, *grid, *amount)?),
        _ => None,
    };
    // The file a sample is made a clip of, read before the set is (G14).
    let made_sample = match act {
        SetAct::AudioClipMake { file, .. } => Some(sample_file(path, file)?),
        _ => None,
    };
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
            SetAct::TrackOutput { track, to } => track_output(root, *track, *to)?,
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
            SetAct::AudioClipMake {
                track,
                scene,
                start,
                ..
            } => {
                let (sample, named) = made_sample.as_ref().ok_or("the sample was not read")?;
                audio_clip_make(root, *track, *scene, *start, sample, named)?
            }
            SetAct::ClipReverse { track, clip } => clip_reversed(
                root,
                *track,
                *clip,
                sample.ok_or("the reversed sample was not written")?,
            )?,
            SetAct::ClipQuantize {
                track,
                clip,
                grid,
                amount,
            } => clip_quantize(
                root,
                *track,
                *clip,
                *grid,
                *amount,
                heard.as_deref().ok_or("the clip's sample was not read")?,
            )?,
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
<Ableton MajorVersion="5" MinorVersion="12.0_12025" SchemaChangeCount="3" Creator="O:I starting worlds"><LiveSet><Tracks><AudioTrack Id="10"><Name><EffectiveName Value="Estuary" /><UserName Value="Estuary" /></Name><DeviceChain><DeviceChain><Devices /></DeviceChain></DeviceChain></AudioTrack><AudioTrack Id="11"><Name><EffectiveName Value="Market hall" /><UserName Value="Market hall" /></Name><DeviceChain><DeviceChain><Devices /></DeviceChain></DeviceChain></AudioTrack><MidiTrack Id="12"><Name><EffectiveName Value="Tide pad" /><UserName Value="Tide pad" /></Name><DeviceChain><DeviceChain><Devices /></DeviceChain></DeviceChain></MidiTrack></Tracks><MainTrack><DeviceChain><Mixer><Tempo><Manual Value="92" /></Tempo></Mixer><DeviceChain><Devices /></DeviceChain></DeviceChain></MainTrack><Scenes><Scene Id="0"><Name Value="" /></Scene><Scene Id="1"><Name Value="" /></Scene><Scene Id="2"><Name Value="" /></Scene><Scene Id="3"><Name Value="" /></Scene></Scenes></LiveSet></Ableton>"#;

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

    /// A hand-written set names no Live build as its creator: Live did not write it (DLW build ruling 2026-11-09, as 47c item 7).
    #[test]
    fn the_hand_written_tide_sketch_names_no_live_build_as_its_creator() {
        let root = crate::xml::parse(TIDE).unwrap();
        let creator = root.attr("Creator");
        assert!(
            creator.is_none_or(|c| !c.contains("Ableton") && !c.contains("Live")),
            "the Tide Sketch fixture names {creator:?} as its creator"
        );
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
            // 0E item 7 (review 9): a Shift range across a group's head (the head and the part beside it) is refused in these words.
            (
                vec![0, 1],
                "Putting a group in a new group is not carried yet: group its tracks",
            ),
            (vec![0, 3], "side by side"),
            (vec![2, 3], "different groups"),
            (vec![], "one track or more"),
        ] {
            let refused = run(&path, SetAct::TracksGroup { tracks }).unwrap_err();
            assert!(refused.contains(words), "{refused}");
            if words.len() > 40 {
                assert_eq!(refused, words, "the words whole");
            }
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

    // O-I #857 G18 (round 47 item 3): Output writes Main, or the group the part stands in, through the routing Group Tracks writes;
    // another part is refused in words.
    #[test]
    fn output_sends_a_part_to_main_or_its_group_and_refuses_another_part() {
        let (_dir, path) = set_file(SET);
        for (track, to, words) in [
            (3, OutputTo::Group, "Drums stands in no group"),
            (3, OutputTo::Track(0), "Drums cannot be sent to Keys here"),
            (2, OutputTo::Main, "Bass carries no AudioOutputRouting"),
        ] {
            let refused = run(&path, SetAct::TrackOutput { track, to }).unwrap_err();
            assert!(refused.contains(words), "{refused}");
        }
        run(&path, SetAct::TracksGroup { tracks: vec![3] }).unwrap();
        let output = |path: &str| {
            let (root, _) = reread(path);
            let drums = crate::edit::track_at(&root, 4).unwrap();
            let out = drums
                .child("DeviceChain")
                .unwrap()
                .child("AudioOutputRouting")
                .unwrap();
            (
                value_of(out, "Target").map(str::to_string),
                value_of(out, "UpperDisplayString").map(str::to_string),
                crate::edit::mixer_json(drums, &[])["output"].clone(),
            )
        };
        let main = run(
            &path,
            SetAct::TrackOutput {
                track: 4,
                to: OutputTo::Main,
            },
        )
        .unwrap();
        assert_eq!(main["done"], "Drums goes to Main.");
        assert_eq!(
            output(&path),
            (
                Some("AudioOut/Main".into()),
                Some("Main".into()),
                json!("Main")
            )
        );
        let group = run(
            &path,
            SetAct::TrackOutput {
                track: 4,
                to: OutputTo::Group,
            },
        )
        .unwrap();
        assert_eq!(group["done"], "Drums goes to its group, 4-Group.");
        assert_eq!(
            output(&path),
            (
                Some("AudioOut/GroupTrack".into()),
                Some("Group".into()),
                json!("Group")
            )
        );
        // A MIDI part whose notes go to another part has no Output of its own to write.
        let routed = SET.replacen(
            "<DeviceChain>\n<Mixer><Volume><Manual Value=\"1\"/><AutomationTarget Id=\"1500\">",
            "<DeviceChain>\n<MidiOutputRouting><Target Value=\"MidiOut/Track.13/TrackIn\"/><UpperDisplayString Value=\"Bass\"/><LowerDisplayString Value=\"Track In\"/></MidiOutputRouting><AudioOutputRouting><Target Value=\"AudioOut/Main\"/><UpperDisplayString Value=\"Main\"/><LowerDisplayString Value=\"\"/></AudioOutputRouting>\n<Mixer><Volume><Manual Value=\"1\"/><AutomationTarget Id=\"1500\">",
            1,
        );
        assert_ne!(routed, SET);
        let (_routed_dir, routed_path) = set_file(&routed);
        let refused = run(
            &routed_path,
            SetAct::TrackOutput {
                track: 0,
                to: OutputTo::Main,
            },
        )
        .unwrap_err();
        assert!(
            refused.contains("The notes of Keys go to Bass (its MIDI To)"),
            "{refused}"
        );
        // The act as the shell sends it (desktop/cradle/src/kernel/types.ts LiveSetAct `track_output`).
        for (sent, act) in [
            (
                json!({"kind": "track_output", "track": 4, "to": "main"}),
                SetAct::TrackOutput {
                    track: 4,
                    to: OutputTo::Main,
                },
            ),
            (
                json!({"kind": "track_output", "track": 4, "to": "group"}),
                SetAct::TrackOutput {
                    track: 4,
                    to: OutputTo::Group,
                },
            ),
            (
                json!({"kind": "track_output", "track": 4, "to": {"track": 0}}),
                SetAct::TrackOutput {
                    track: 4,
                    to: OutputTo::Track(0),
                },
            ),
        ] {
            assert_eq!(serde_json::from_value::<SetAct>(sent).unwrap(), act);
        }
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
        // A file the clip names is cut only where it is one, as the engine plays it (48e item 3): no room.wav beside the set, and
        // none where the set stored it.
        assert_eq!(
            crop_source(&path, 1, ClipAt::Arrangement(0), None).unwrap_err(),
            "Room plays \"room.wav\", which is not there, so there is no sound to crop"
        );
        std::fs::write(dir.0.join("room.wav"), b"the room").unwrap();
        assert_eq!(
            crop_source(&path, 1, ClipAt::Arrangement(0), None).unwrap(),
            CropSource {
                file: dir.0.join("room.wav"),
                from_seconds: 0.5,
                to_seconds: 1.5
            },
            "the stretch of the file beside the set"
        );
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
            "Swing plays \"swing.wav\", which is not there, so there is no sound to crop"
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

    /// The blank set (DLW build ruling 2026-11-08, LV01): `new_set` writes a minimal set in the shape this owner's fixtures keep —
    /// one MIDI part with its mixer, its send to the return, its recorder and its output to Main, the Main track, and one return —
    /// that the set's own reader reads and its acts take at once (a mixer write, an arm, a clip made in a slot), and never writes
    /// over a set that stands.
    #[test]
    fn a_new_set_is_one_midi_part_the_main_track_and_a_return_ready_to_play() {
        let (dir, _) = set_file(SET);
        let path = dir.0.join("Sketch Project").join("Sketch.als");
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        let path = path.to_str().unwrap().to_string();
        let made = new_set(&path).unwrap();
        assert_eq!(made["path"], path.as_str());
        let reading = crate::api::set_json(&path).unwrap();
        assert_eq!(made["revision"], reading["revision"]);
        let tracks = reading["document"]["tracks"].as_array().unwrap();
        let names: Vec<(&str, &str)> = tracks
            .iter()
            .map(|t| (t["kind"].as_str().unwrap(), t["name"].as_str().unwrap()))
            .collect();
        // the Main track last, as the owner lists every set's (its reader's name for it)
        assert_eq!(
            names,
            [
                ("midi", "1-MIDI"),
                ("return", "A-Return"),
                ("master", "Master")
            ]
        );
        let part = &tracks[0]["mixer"];
        assert_eq!(part["volume"], 1.0);
        assert_eq!(part["pan"], 0.0);
        assert_eq!(part["activator"], true);
        assert_eq!(part["solo"], false);
        assert_eq!(part["arm"], false);
        assert_eq!(part["monitor"], "auto");
        assert_eq!(part["sends"][0]["name"], "A-Return");
        assert_eq!(part["sends"][0]["on"], true);
        assert_eq!(part["output"], "Main");
        assert_eq!(
            tracks[1]["mixer"]["sends"][0]["on"], false,
            "a return's own send is off"
        );
        assert_eq!(reading["summary"]["tempo_bpm"], 120.0);
        assert_eq!(reading["summary"]["scene_count"], 4);
        // Its acts take it at once: Pan, Arm, a send, and a clip made in the part's first slot.
        let revision = made["revision"].as_str().unwrap().to_string();
        let panned =
            crate::edit::mixer_write(&path, &revision, 0, "pan", &json!(-0.5), None).unwrap();
        let armed = crate::edit::mixer_write(
            &path,
            panned["revision"].as_str().unwrap(),
            0,
            "arm",
            &json!(true),
            None,
        )
        .unwrap();
        let sent = crate::edit::mixer_write(
            &path,
            armed["revision"].as_str().unwrap(),
            0,
            "send",
            &json!(0.5),
            Some(0),
        )
        .unwrap();
        let clip = crate::edit::clip_create(
            &path,
            sent["revision"].as_str().unwrap(),
            0,
            Some(0),
            4.0,
            None,
            &[json!({"p": 60, "at": 0.0, "len": 1.0, "vel": 100})],
            None,
        )
        .unwrap();
        assert!(clip["revision"].is_string(), "{clip}");
        // The Main track stands after the tracks, as the owner lists it: its Volume and Pan are written as a part's.
        let main = crate::edit::mixer_write(
            &path,
            clip["revision"].as_str().unwrap(),
            2,
            "pan",
            &json!(0.25),
            None,
        )
        .unwrap();
        assert_eq!(main["mixer"]["pan"], 0.25);
        assert_eq!(
            main["mixer"].get("arm"),
            None,
            "the Main track records nothing"
        );
        // A set that stands is never written over, and a place that is no folder is refused; nothing half-made is left.
        let before = std::fs::read(&path).unwrap();
        let again = new_set(&path).unwrap_err();
        assert!(again.contains("stands there already"), "{again}");
        assert_eq!(std::fs::read(&path).unwrap(), before);
        let nowhere = dir.0.join("No Project").join("Gone.als");
        assert!(new_set(nowhere.to_str().unwrap())
            .unwrap_err()
            .contains("no folder"));
        let left: Vec<String> = std::fs::read_dir(dir.0.join("Sketch Project"))
            .unwrap()
            .map(|e| e.unwrap().file_name().to_string_lossy().into_owned())
            .collect();
        assert_eq!(left, ["Sketch.als"]);
        assert!(new_set(&dir.0.join("x.txt").to_string_lossy())
            .unwrap_err()
            .contains(".als"));
    }

    /// The names of `e`'s children in order, each run of one name (a list's members, a numbered family's) once.
    fn child_names(e: &Element) -> Vec<String> {
        let mut names: Vec<String> = Vec::new();
        for child in &e.children {
            let name = match child.name.rsplit_once('.') {
                Some((family, n)) if n.chars().all(|c| c.is_ascii_digit()) => format!("{family}.N"),
                _ => child.name.clone(),
            };
            if names.last() != Some(&name) {
                names.push(name);
            }
        }
        names
    }

    /// An element path's children's names ([`child_names`]) and the attributes its elements hold, each once, in the order met.
    type Shape = std::collections::BTreeMap<String, (Vec<String>, Vec<String>)>;

    /// An element's attributes as blank-set.md writes them, in the order written: a `Value` as the value alone, any other as
    /// `Name=value` (47c item 7: every attribute, so `Id`, `LomId`, `X`/`Y` and a window rect's `Top`/`Left`/`Bottom`/`Right` too).
    fn attributes(e: &Element) -> Vec<String> {
        e.attrs
            .iter()
            .map(|(name, value)| {
                if name == "Value" {
                    value.clone()
                } else {
                    format!("{name}={value}")
                }
            })
            .collect()
    }

    /// Every element's path under `e` with its children's names and its attributes ([`attributes`]), not looking into what a
    /// set holds rather than is (devices, envelopes, events, grooves, locators, a slot's clip, take lanes, a list of tracks):
    /// blank-set.md's reading.
    fn shape_of(e: &Element, at: &str, out: &mut Shape) {
        let held = [
            "Devices",
            "Envelopes",
            "Events",
            "Grooves",
            "Value",
            "Tracks",
        ];
        let path = format!("{at}/{}", child_names_key(&e.name));
        let entry = out.entry(path.clone()).or_default();
        for attribute in attributes(e) {
            if !entry.1.contains(&attribute) {
                entry.1.push(attribute);
            }
        }
        if held.contains(&e.name.as_str())
            || at.ends_with("/Locators") && e.name == "Locators"
            || at.ends_with("/TakeLanes") && e.name == "TakeLanes"
        {
            return;
        }
        for name in child_names(e) {
            if !entry.0.contains(&name) {
                entry.0.push(name);
            }
        }
        for child in &e.children {
            shape_of(child, &path, out);
        }
    }

    /// The documented sections of a set: the document's root, with its own attributes only, then its first MIDI track, its first
    /// return and the set itself (its Main and cue tracks within).
    fn documented_shape(root: &Element) -> Shape {
        let set = root.child("LiveSet").unwrap();
        let tracks = set.child("Tracks").unwrap();
        let first = |name: &str| tracks.children.iter().find(|t| t.name == name).unwrap();
        let mut out = Shape::new();
        out.insert(
            format!("/{}", root.name),
            (child_names(root), attributes(root)),
        );
        for e in [first("MidiTrack"), first("ReturnTrack"), set] {
            shape_of(e, "", &mut out);
        }
        out
    }

    /// blank-set.md's table (DLW build ruling 2026-11-09, 46c item 1): each element path with its children in Live's order, the
    /// values the set Live wrote holds there, and the blank set's (`=` where they are Live's).
    fn blank_set_table() -> (Shape, Shape) {
        let cell = |text: &str| -> Vec<String> {
            let text = text.trim();
            if text.is_empty() {
                return Vec::new();
            }
            text.split(" · ")
                .map(|v| {
                    let v = v.trim().trim_matches('`');
                    if v == "\"\"" {
                        String::new()
                    } else {
                        v.to_string()
                    }
                })
                .collect()
        };
        let (mut live, mut blank) = (Shape::new(), Shape::new());
        for row in include_str!("../blank-set.md")
            .lines()
            .filter(|l| l.starts_with("| `/"))
        {
            let cells: Vec<&str> = row.trim_matches('|').split(" | ").collect();
            assert_eq!(cells.len(), 6, "a row of six cells: {row}");
            let path = cells[0].trim().trim_matches('`').to_string();
            let children: Vec<String> = cells[1]
                .split(',')
                .map(str::trim)
                .filter(|c| !c.is_empty())
                .map(str::to_string)
                .collect();
            let lived = cell(cells[2]);
            let blanked = if cells[3].trim() == "=" {
                lived.clone()
            } else {
                cell(cells[3])
            };
            assert!(
                live.insert(path.clone(), (children.clone(), lived))
                    .is_none(),
                "{path} once"
            );
            blank.insert(path, (children, blanked));
        }
        (live, blank)
    }

    fn child_names_key(name: &str) -> String {
        match name.rsplit_once('.') {
            Some((family, n)) if n.chars().all(|c| c.is_ascii_digit()) => format!("{family}.N"),
            _ => name.to_string(),
        }
    }

    // DLW build ruling 2026-11-08, 0.10 ("Take every element a set Live wrote keeps ... not a hand-reduced XML"), written through
    // the document (DLW build ruling 2026-11-09, 46c item 1): the blank set keeps every element and value blank-set.md's table names,
    // in Live's order and nesting, and nothing it does not. Where the evidence set stands (it is not redistributed, so CI has it not),
    // the table is also checked against it: every element, child order and value Live wrote.
    #[test]
    fn the_blank_set_keeps_every_element_a_set_live_wrote_keeps() {
        let (dir, _) = set_file(SET);
        let path = dir.0.join("Blank.als");
        new_set(path.to_str().unwrap()).unwrap();
        let root = crate::open_als(&path).unwrap();
        let set = root.find("LiveSet").unwrap();
        let (live_table, blank_table) = blank_set_table();
        // The document names the version (Live 12.0.25) and carries no string of the evidence's that names its build (47c item 7).
        let document = include_str!("../blank-set.md");
        for build in ["Creator=", "Revision=", "2627c43"] {
            assert!(
                !document.contains(build),
                "blank-set.md carries the evidence's {build}"
            );
        }
        assert!(
            blank_table.len() > 1000,
            "the table is read whole: {} rows",
            blank_table.len()
        );
        let made = documented_shape(&root);
        let paths = |s: &Shape| s.keys().cloned().collect::<Vec<_>>();
        let (missing, extra): (Vec<_>, Vec<_>) = (
            paths(&blank_table)
                .into_iter()
                .filter(|p| !made.contains_key(p))
                .collect(),
            paths(&made)
                .into_iter()
                .filter(|p| !blank_table.contains_key(p))
                .collect(),
        );
        assert!(missing.is_empty() && extra.is_empty(), "elements the table names and the set lacks: {missing:?}; elements the set has and the table names not: {extra:?}");
        for (at, (children, values)) in &blank_table {
            assert_eq!(&made[at].0, children, "{at}: its children, in Live's order");
            assert_eq!(&made[at].1, values, "{at}: its attributes");
        }
        // Each target and pointee numbered once, below NextPointeeId.
        let mut ids = Vec::new();
        fn pointees(e: &Element, ids: &mut Vec<u64>) {
            if is_pointee(e) {
                ids.push(e.attr("Id").unwrap().parse().unwrap());
            }
            e.children.iter().for_each(|c| pointees(c, ids));
        }
        pointees(set, &mut ids);
        let next: u64 = set
            .child("NextPointeeId")
            .and_then(|n| n.attr("Value"))
            .unwrap()
            .parse()
            .unwrap();
        let mut unique = ids.clone();
        unique.sort_unstable();
        unique.dedup();
        assert_eq!(unique.len(), ids.len(), "each target once");
        assert!(
            ids.iter().all(|id| *id > 0 && *id < next),
            "below NextPointeeId {next}"
        );
        // The table against a set Live wrote, where it stands.
        let evidence = std::env::var("OI_EVIDENCE_SETS").map_or_else(
            |_| {
                std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                    .join("../../docs/research/ableton-live-12.0.25/evidence/sets")
            },
            std::path::PathBuf::from,
        );
        let Ok(text) =
            std::fs::read_to_string(evidence.join("template-piano-voices-mastering.xml"))
        else {
            eprintln!(
                "the evidence set is not here ({}): the table is not checked against it",
                evidence.display()
            );
            return;
        };
        // The evidence's root also names the Live that wrote it, by name and build; the document carries neither (47c item 7).
        let mut live = crate::xml::parse(&text).unwrap();
        live.attrs
            .retain(|(name, _)| name != "Creator" && name != "Revision");
        assert_eq!(
            documented_shape(&live),
            live_table,
            "blank-set.md documents the set Live wrote: every element, child order and attribute"
        );
    }

    /// A folder New set keeps a set in, standing in for a volume (47c item 2): each call is the machine's own, recorded as `op set` or
    /// `op staged`, unless `on` answers it first (`on(op, path)`, the path the call is for: a link's or a move's the set's name).
    struct Scripted<'a> {
        calls: std::cell::RefCell<Vec<String>>,
        on: &'a dyn Fn(&str, &std::path::Path) -> Option<std::io::Result<()>>,
    }

    impl<'a> Scripted<'a> {
        fn new(on: &'a dyn Fn(&str, &std::path::Path) -> Option<std::io::Result<()>>) -> Self {
            Scripted {
                calls: std::cell::RefCell::new(Vec::new()),
                on,
            }
        }
        fn call(&self, op: &str, path: &std::path::Path) -> Option<std::io::Result<()>> {
            let which = if path.file_name().unwrap().to_string_lossy().starts_with('.') {
                "staged"
            } else {
                "set"
            };
            self.calls.borrow_mut().push(format!("{op} {which}"));
            (self.on)(op, path)
        }
        fn calls(&self) -> Vec<String> {
            self.calls.borrow().clone()
        }
    }

    /// A file the scripted folder made: its first write and its sync recorded, and answered by `on` where it says.
    struct ScriptedFile<'a> {
        file: std::fs::File,
        at: std::path::PathBuf,
        wrote: bool,
        folder: &'a Scripted<'a>,
    }

    impl std::io::Write for ScriptedFile<'_> {
        fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
            if !self.wrote {
                self.wrote = true;
                if let Some(Err(e)) = self.folder.call("write", &self.at) {
                    return Err(e);
                }
            }
            self.file.write(buf)
        }
        fn flush(&mut self) -> std::io::Result<()> {
            self.file.flush()
        }
    }

    impl NewFile for ScriptedFile<'_> {
        fn sync_all(&self) -> std::io::Result<()> {
            match self.folder.call("sync", &self.at) {
                Some(Err(e)) => Err(e),
                _ => self.file.sync_all(),
            }
        }
    }

    impl SetFolder for Scripted<'_> {
        fn create_new(&self, path: &std::path::Path) -> std::io::Result<Box<dyn NewFile + '_>> {
            if let Some(Err(e)) = self.call("create_new", path) {
                return Err(e);
            }
            let file = std::fs::OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(path)?;
            Ok(Box::new(ScriptedFile {
                file,
                at: path.to_path_buf(),
                wrote: false,
                folder: self,
            }))
        }
        fn hard_link(&self, from: &std::path::Path, to: &std::path::Path) -> std::io::Result<()> {
            match self.call("hard_link", to) {
                Some(answer) => answer,
                None => std::fs::hard_link(from, to),
            }
        }
        fn rename_no_replace(
            &self,
            from: &std::path::Path,
            to: &std::path::Path,
        ) -> std::io::Result<()> {
            match self.call("rename_no_replace", to) {
                Some(answer) => answer,
                None => rename_no_replace(from, to),
            }
        }
        fn open(&self, path: &std::path::Path) -> std::io::Result<Box<dyn std::io::Read + '_>> {
            if let Some(Err(e)) = self.call("open", path) {
                return Err(e);
            }
            Ok(Box::new(std::fs::File::open(path)?))
        }
        fn remove_file(&self, path: &std::path::Path) -> std::io::Result<()> {
            match self.call("remove_file", path) {
                Some(answer) => answer,
                None => std::fs::remove_file(path),
            }
        }
    }

    /// The name New set stages `target` under.
    fn staged_of(target: &std::path::Path) -> std::path::PathBuf {
        target.with_file_name(format!(
            ".{}.oi-new-{}",
            target.file_name().unwrap().to_string_lossy(),
            std::process::id()
        ))
    }

    /// A volume that keeps no hard links: `link(2)` answers "not supported".
    fn no_links() -> std::io::Error {
        std::io::Error::new(
            std::io::ErrorKind::Unsupported,
            "this volume keeps no hard links",
        )
    }

    /// A volume that makes no move that never writes over a set: `renamex_np`'s ENOTSUP on macOS, `renameat2`'s EINVAL on Linux.
    fn no_exclusive_move() -> std::io::Error {
        std::io::Error::from_raw_os_error(if cfg!(target_os = "macos") { 45 } else { 22 })
    }

    // 0.10: where the folder takes no hard link (a volume that keeps none), the new set is moved into place, never over a set
    // that stands there (46c item 9: the staged set's move, rename_no_replace). Named for the move it takes (round 48's review, item
    // 11; DLW build ruling 2026-11-09, 0C item 11): the copy has its own test below.
    #[test]
    fn a_new_set_is_moved_into_place_where_no_link_can_be_made() {
        let (dir, _) = set_file(SET);
        let path = dir.0.join("Moved.als");
        let unlinked = |op: &str, _: &std::path::Path| (op == "hard_link").then(|| Err(no_links()));
        let made = new_set_in(path.to_str().unwrap(), &Scripted::new(&unlinked)).unwrap();
        let reading = crate::api::set_json(path.to_str().unwrap()).unwrap();
        assert_eq!(
            made["revision"], reading["revision"],
            "the set moved is the set made, whole"
        );
        let left: Vec<String> = std::fs::read_dir(&dir.0)
            .unwrap()
            .map(|e| e.unwrap().file_name().to_string_lossy().into_owned())
            .filter(|n| n.contains("Moved"))
            .collect();
        assert_eq!(left, ["Moved.als"], "nothing staged is left");
        // A set that comes to stand there while the set is moved is never written over.
        let late = dir.0.join("Late.als");
        let arrives = |op: &str, target: &std::path::Path| {
            (op == "hard_link").then(|| {
                std::fs::write(target, b"the person's own set")?;
                Err(no_links())
            })
        };
        let refused = new_set_in(late.to_str().unwrap(), &Scripted::new(&arrives)).unwrap_err();
        assert!(refused.contains("stands there already"), "{refused}");
        assert_eq!(std::fs::read(&late).unwrap(), b"the person's own set");
    }

    // DLW build ruling 2026-11-09, 46c item 9: only a volume that keeps no hard links (or a link across volumes) moves the staged copy
    // into place; any other failure to link is refused in words. A staged copy that fails leaves nothing at the set's name.
    #[test]
    fn a_new_set_reaches_its_name_whole_or_not_at_all() {
        use std::io::{Error, ErrorKind};
        use std::path::Path;
        let (dir, _) = set_file(SET);
        let kept = dir.0.join("Kept.als");
        let names = || {
            let mut names: Vec<String> = std::fs::read_dir(&dir.0)
                .unwrap()
                .map(|e| e.unwrap().file_name().to_string_lossy().into_owned())
                .filter(|n| n.contains("Kept"))
                .collect();
            names.sort();
            names
        };
        let denied = |op: &str, _: &Path| {
            (op == "hard_link").then(|| {
                Err(Error::new(
                    ErrorKind::PermissionDenied,
                    "the folder is locked",
                ))
            })
        };
        assert_eq!(
            new_set_in(kept.to_str().unwrap(), &Scripted::new(&denied)).unwrap_err(),
            "The new set could not be linked into place (the folder is locked), so no set was made"
        );
        assert!(
            names().is_empty(),
            "nothing at its name, nothing staged: {:?}",
            names()
        );
        // The staged copy fails (here it is taken away before its move): nothing is written at the set's name.
        let lost = |op: &str, target: &Path| {
            (op == "hard_link").then(|| {
                std::fs::remove_file(staged_of(target))?;
                Err(no_links())
            })
        };
        let refused = new_set_in(kept.to_str().unwrap(), &Scripted::new(&lost)).unwrap_err();
        assert!(
            refused.starts_with("The new set could not be kept: "),
            "{refused}"
        );
        assert!(names().is_empty(), "nothing at its name: {:?}", names());
        // A link across volumes (EXDEV) is the other failure the move answers: the set is made, whole.
        let crossed =
            |op: &str, _: &Path| (op == "hard_link").then(|| Err(Error::from_raw_os_error(18)));
        let made = new_set_in(kept.to_str().unwrap(), &Scripted::new(&crossed)).unwrap();
        assert_eq!(names(), ["Kept.als"], "nothing staged is left");
        assert_eq!(
            made["revision"],
            crate::api::set_json(kept.to_str().unwrap()).unwrap()["revision"]
        );
    }

    // DLW build ruling 2026-11-09, 47c item 2 (fresh review of O-I #939, item 2): the ruled path on every volume, each call pinned. The
    // set is staged with create_new and synced before it is linked, or moved into place where the volume keeps no hard links. Nothing
    // is ever written over a set. A volume that makes neither has its own test below.
    #[test]
    fn a_new_set_takes_the_ruled_path_on_every_volume() {
        use std::io::Error;
        use std::path::Path;
        let (dir, _) = set_file(SET);
        let names = |stem: &str| {
            let mut names: Vec<String> = std::fs::read_dir(&dir.0)
                .unwrap()
                .map(|e| e.unwrap().file_name().to_string_lossy().into_owned())
                .filter(|n| n.contains(stem))
                .collect();
            names.sort();
            names
        };
        let whole = |set: &Path, made: &Value| {
            assert_eq!(
                made["revision"],
                crate::api::set_json(set.to_str().unwrap()).unwrap()["revision"],
                "the set at its name is the set made, whole"
            );
        };
        let staging = ["create_new staged", "write staged", "sync staged"];
        let path = |calls: &[&str]| -> Vec<String> {
            staging.iter().chain(calls).map(|c| c.to_string()).collect()
        };

        // A volume that keeps hard links: staged with create_new, synced, then linked; the staged name taken away.
        let set = dir.0.join("Linked.als");
        let folder = Scripted::new(&|_, _| None);
        let made = new_set_in(set.to_str().unwrap(), &folder).unwrap();
        assert_eq!(
            folder.calls(),
            path(&["hard_link set", "remove_file staged"])
        );
        whole(&set, &made);
        assert_eq!(names("Linked"), ["Linked.als"]);

        // No hard links: moved into place in one step; the staged name then holds nothing, and nothing is removed.
        let set = dir.0.join("Moved.als");
        let on = |op: &str, _: &Path| (op == "hard_link").then(|| Err(no_links()));
        let folder = Scripted::new(&on);
        let made = new_set_in(set.to_str().unwrap(), &folder).unwrap();
        assert_eq!(
            folder.calls(),
            path(&["hard_link set", "rename_no_replace set"])
        );
        whole(&set, &made);
        assert_eq!(names("Moved"), ["Moved.als"]);

        // The staged set's sync fails: nothing is linked, and the staged set is taken away.
        let set = dir.0.join("Full.als");
        let on =
            |op: &str, _: &Path| (op == "sync").then(|| Err(Error::other("the volume is full")));
        let folder = Scripted::new(&on);
        assert_eq!(
            new_set_in(set.to_str().unwrap(), &folder).unwrap_err(),
            "The new set could not be written: the volume is full"
        );
        assert_eq!(folder.calls(), path(&["remove_file staged"]));
        assert!(names("Full").is_empty(), "{:?}", names("Full"));

        // Something stands at the staged name already: it is not ours, so it is neither written over nor taken away, and the words
        // say a set is being made there already and name what stands (round 48's review, item 10; DLW build ruling 2026-11-09, 0C
        // item 10), never the volume's own "File exists".
        let set = dir.0.join("Taken.als");
        std::fs::write(staged_of(&set), b"not ours").unwrap();
        let folder = Scripted::new(&|_, _| None);
        let refused = new_set_in(set.to_str().unwrap(), &folder).unwrap_err();
        assert_eq!(
            refused,
            format!(
                "A set is being made at {} already ({} stands in {}), so this one is not made: if no New set is running, that file is left from one that stopped, and taking it away lets a set be made here",
                set.display(),
                staged_of(&set).file_name().unwrap().to_string_lossy(),
                set.parent().unwrap().display()
            )
        );
        assert_eq!(folder.calls(), ["create_new staged"]);
        assert_eq!(std::fs::read(staged_of(&set)).unwrap(), b"not ours");
        assert!(!set.exists());
    }

    // Round 48's review, item 11 (DLW build ruling 2026-11-09, 0C item 11): a volume that makes neither a hard link nor an exclusive move
    // (FAT, exFAT, SMB). The set cannot be moved into place there without the chance of writing over one, so it is made at its name
    // with create_new — only where nothing stands — and filled there from the staged set, synced, and the staged set taken away. A copy
    // that fails is taken away; while it runs, the set at its name is not whole yet.
    #[test]
    fn a_new_set_is_filled_at_its_name_where_the_volume_makes_neither_link_nor_exclusive_move() {
        use std::io::Error;
        use std::path::Path;
        let (dir, _) = set_file(SET);
        let names = |stem: &str| {
            let mut names: Vec<String> = std::fs::read_dir(&dir.0)
                .unwrap()
                .map(|e| e.unwrap().file_name().to_string_lossy().into_owned())
                .filter(|n| n.contains(stem))
                .collect();
            names.sort();
            names
        };
        let whole = |set: &Path, made: &Value| {
            assert_eq!(
                made["revision"],
                crate::api::set_json(set.to_str().unwrap()).unwrap()["revision"],
                "the set at its name is the set made, whole"
            );
        };
        let staging = ["create_new staged", "write staged", "sync staged"];
        let path = |calls: &[&str]| -> Vec<String> {
            staging.iter().chain(calls).map(|c| c.to_string()).collect()
        };

        // Neither a hard link nor an exclusive move (FAT, exFAT, SMB): copied to its name with create_new and synced, then the staged
        // set taken away.
        let set = dir.0.join("Copied.als");
        let on = |op: &str, _: &Path| match op {
            "hard_link" => Some(Err(no_links())),
            "rename_no_replace" => Some(Err(no_exclusive_move())),
            _ => None,
        };
        let folder = Scripted::new(&on);
        let made = new_set_in(set.to_str().unwrap(), &folder).unwrap();
        assert_eq!(
            folder.calls(),
            path(&[
                "hard_link set",
                "rename_no_replace set",
                "open staged",
                "create_new set",
                "write set",
                "sync set",
                "remove_file staged"
            ])
        );
        whole(&set, &made);
        assert_eq!(names("Copied"), ["Copied.als"], "nothing staged is left");

        // A set comes to stand at the name before the copy: create_new refuses it, and the person's set is never written over.
        let set = dir.0.join("Arrived.als");
        let on = |op: &str, at: &Path| match op {
            "hard_link" => Some(Err(no_links())),
            "rename_no_replace" => Some(Err(no_exclusive_move())),
            "create_new" if !at.file_name().unwrap().to_string_lossy().starts_with('.') => {
                std::fs::write(at, b"the person's own set").unwrap();
                None
            }
            _ => None,
        };
        let folder = Scripted::new(&on);
        let refused = new_set_in(set.to_str().unwrap(), &folder).unwrap_err();
        assert!(refused.contains("stands there already"), "{refused}");
        assert_eq!(std::fs::read(&set).unwrap(), b"the person's own set");
        assert_eq!(folder.calls().last().unwrap(), "remove_file staged");
        assert_eq!(names("Arrived"), ["Arrived.als"], "nothing staged is left");

        // The copy fails part way, or its sync does: what was copied is taken away, and nothing is left at the name.
        for (stem, fails) in [("Cut", "write"), ("Unsynced", "sync")] {
            let set = dir.0.join(format!("{stem}.als"));
            let on = |op: &str, at: &Path| match op {
                "hard_link" => Some(Err(no_links())),
                "rename_no_replace" => Some(Err(no_exclusive_move())),
                _ if op == fails && !at.file_name().unwrap().to_string_lossy().starts_with('.') => {
                    Some(Err(Error::other("the volume went away")))
                }
                _ => None,
            };
            let folder = Scripted::new(&on);
            assert_eq!(
                new_set_in(set.to_str().unwrap(), &folder).unwrap_err(),
                "The new set could not be copied into place (the volume went away), so no set was made"
            );
            let calls = folder.calls();
            assert_eq!(
                &calls[calls.len() - 2..],
                ["remove_file set", "remove_file staged"]
            );
            assert!(names(stem).is_empty(), "{stem}: {:?}", names(stem));
        }
    }

    /// A 16-bit mono AIFF of `frames` silent frames at `rate` (its `COMM` rate an 80-bit extended number, as AIFF keeps it).
    fn aiff(frames: u32, rate: u32) -> Vec<u8> {
        let exponent = 16383 + 31 - rate.leading_zeros() as u16;
        let mantissa = u64::from(rate) << (rate.leading_zeros() + 32);
        let mut comm = 1u16.to_be_bytes().to_vec();
        comm.extend_from_slice(&frames.to_be_bytes());
        comm.extend_from_slice(&16u16.to_be_bytes());
        comm.extend_from_slice(&exponent.to_be_bytes());
        comm.extend_from_slice(&mantissa.to_be_bytes());
        let data = vec![0u8; frames as usize * 2];
        let mut body = b"AIFFCOMM".to_vec();
        body.extend_from_slice(&18u32.to_be_bytes());
        body.extend_from_slice(&comm);
        body.extend_from_slice(b"SSND");
        body.extend_from_slice(&(8 + data.len() as u32).to_be_bytes());
        body.extend_from_slice(&[0; 8]);
        body.extend_from_slice(&data);
        let mut out = b"FORM".to_vec();
        out.extend_from_slice(&(body.len() as u32).to_be_bytes());
        out.extend_from_slice(&body);
        out
    }

    /// The value of child `name` of `e`.
    fn valued<'a>(e: &'a Element, name: &str) -> &'a str {
        e.child(name).and_then(|c| c.attr("Value")).unwrap_or("")
    }

    // G14 (DLW build ruling 2026-11-08, item 6: "making an audio clip from one is live-set's act, referencing the file as Live
    // does"; Live: a sample dropped from the browser on an audio track's slot, or on its lane): the clip plays the whole file once,
    // unwarped, its markers in seconds, and names a file in the set's folder by its path from there, any other by its whole path.
    #[test]
    fn a_sample_is_made_an_audio_clip_that_names_its_file_as_live_does() {
        let (dir, path) = set_file(TIDE);
        let beside = dir.0.join("Samples/Imported/gull.wav");
        std::fs::create_dir_all(beside.parent().unwrap()).unwrap();
        let wav = float_wav(96_000, 48_000);
        std::fs::write(&beside, &wav).unwrap();
        let file = beside.to_string_lossy().into_owned();
        let made = run(
            &path,
            SetAct::AudioClipMake {
                track: 0,
                file: file.clone(),
                scene: None,
                start: None,
            },
        )
        .unwrap();
        assert_eq!(made["act"], "audio_clip_make");
        assert_eq!(made["at"], json!({"track": 0, "slot": 0}));
        assert_eq!(
            made["done"],
            "Made gull an audio clip in row 1 of Estuary: 2 seconds of gull.wav, unwarped, at its own rate."
        );
        let (root, document) = reread(&path);
        assert_eq!(slots(&document, 0)[0].as_deref(), Some("gull"));
        let part = crate::edit::track_at(&root, 0).unwrap();
        let clip = clip_at(part, ClipAt::Slot(0)).unwrap();
        assert_eq!(clip.name, "AudioClip");
        let beats = number_text(2.0 * 92.0 / 60.0);
        assert_eq!(
            (
                valued(clip, "CurrentStart"),
                valued(clip, "CurrentEnd"),
                valued(clip, "IsWarped")
            ),
            ("0", beats.as_str(), "false"),
            "it lasts its two seconds at the set's 92 BPM, unwarped"
        );
        let lp = clip.child("Loop").unwrap();
        assert_eq!(
            ["LoopStart", "LoopEnd", "LoopOn", "OutMarker"].map(|m| valued(lp, m)),
            ["0", "2", "false", "2"],
            "an unwarped clip keeps its markers in seconds, over the whole file"
        );
        let reference = clip.child("SampleRef").unwrap();
        let file_ref = reference.child("FileRef").unwrap();
        assert_eq!(
            [
                "RelativePathType",
                "RelativePath",
                "Path",
                "Type",
                "OriginalFileSize",
                "OriginalCrc"
            ]
            .map(|f| valued(file_ref, f).to_string()),
            [
                "1".into(),
                "Samples/Imported/gull.wav".into(),
                file.clone(),
                "2".into(),
                wav.len().to_string(),
                original_crc(&wav).to_string()
            ],
            "a file in the set's folder is named from it, and whole"
        );
        assert_eq!(
            (
                valued(reference, "DefaultDuration"),
                valued(reference, "DefaultSampleRate")
            ),
            ("96000", "48000")
        );
        // A file elsewhere (the Music folder), an AIFF, laid on the ruler from beat 4: named by its whole path alone.
        let (music, _) = set_file(TIDE);
        let tide = music.0.join("Audio/low tide.aif");
        std::fs::create_dir_all(tide.parent().unwrap()).unwrap();
        std::fs::write(&tide, aiff(66_150, 44_100)).unwrap();
        let (_lane, lane) = set_file(AUDIO_LANE);
        let laid = run(
            &lane,
            SetAct::AudioClipMake {
                track: 0,
                file: tide.to_string_lossy().into_owned(),
                scene: None,
                start: Some(8.0),
            },
        )
        .unwrap();
        assert_eq!(laid["at"], json!({"track": 0, "arrangement": 2}));
        assert_eq!(
            laid["done"],
            "Made low tide an audio clip on Vox from beat 8: 1.5 seconds of low tide.aif, unwarped, at its own rate."
        );
        let (root, _) = reread(&lane);
        let clip = clip_at(
            crate::edit::track_at(&root, 0).unwrap(),
            ClipAt::Arrangement(2),
        )
        .unwrap();
        assert_eq!(
            (
                clip.attr("Time"),
                valued(clip, "CurrentStart"),
                valued(clip, "CurrentEnd")
            ),
            (Some("8"), "8", "11"),
            "1.5 seconds at 120 BPM: three beats from beat 8"
        );
        let file_ref = clip
            .child("SampleRef")
            .and_then(|r| r.child("FileRef"))
            .unwrap();
        assert_eq!(
            ["RelativePathType", "RelativePath", "Path"].map(|f| valued(file_ref, f).to_string()),
            [
                "0".into(),
                String::new(),
                tide.to_string_lossy().into_owned()
            ],
            "a file outside the set's folder is named by its whole path alone"
        );
        assert_eq!(
            valued(clip.child("SampleRef").unwrap(), "DefaultSampleRate"),
            "44100"
        );
        // Refused in words: a MIDI part, a held slot, what is not a WAV or AIFF, a file that is not there, a slot and a beat at once.
        let refused = |track: usize, file: &str, scene: Option<usize>, start: Option<f64>| {
            run(
                &path,
                SetAct::AudioClipMake {
                    track,
                    file: file.into(),
                    scene,
                    start,
                },
            )
            .unwrap_err()
        };
        assert_eq!(
            refused(2, &file, None, None),
            "Live makes an audio clip on an audio part, and Tide pad is not one"
        );
        assert_eq!(
            refused(0, &file, Some(0), None),
            "The slot in row 1 already holds a clip"
        );
        let text = dir.0.join("notes.txt");
        std::fs::write(&text, "a field note").unwrap();
        assert_eq!(
            refused(0, &text.to_string_lossy(), None, None),
            "\"notes.txt\" is not a WAV or AIFF file, the sound the engine plays, so no clip is made of it"
        );
        assert_eq!(
            refused(0, &dir.0.join("gone.wav").to_string_lossy(), None, None),
            "\"gone.wav\" is not there to make a clip of"
        );
        assert_eq!(
            refused(0, &file, Some(1), Some(0.0)),
            "A clip is made in a slot or on the ruler, not both"
        );
        assert_eq!(
            slots(&reread(&path).1, 0)[1],
            None,
            "nothing was made by a refusal"
        );
    }

    // DLW build ruling 2026-11-08, 0.5 ("sample_file reads the header and the 16 KiB it needs, never the whole file"): a sample's
    // shape comes from its chunk headers and its fmt or COMM body, and Live's OriginalCrc from its first 16 KiB; a sound chunk that
    // claims more than the file holds is refused in words that say so, and an RF64 file in words that name RF64.
    /// Walk of O-I 857, G17 (DLW build ruling 2026-11-08, item 2): the Sample tab. A made clip carries the tab's elements in
    /// the shape and order a set Live wrote keeps an AudioClip's; the reading says whether the clip is warped and in what its
    /// markers and fades read (seconds of the sample, unwarped); live-set writes Warp and its mode, Gain, Transpose, Detune, a
    /// Session clip's Fade and an Arrangement clip's fades, each read back, and refuses in words what Live's own values do not hold.
    #[test]
    fn the_sample_tab_reads_and_writes_warp_gain_pitch_and_fades_as_live_keeps_them() {
        use crate::edit::{clip_json, clip_write};
        let pick =
            |c: &Value, keys: &[&str]| Value::Array(keys.iter().map(|k| c[*k].clone()).collect());
        let near = |v: &Value, want: f64| (v.as_f64().unwrap() - want).abs() < 1e-9;
        let write = |path: &str, at: ClipAt, set: Value| {
            let standing = crate::edit::revision(&std::fs::read(path).unwrap());
            clip_write(
                path,
                &standing,
                0,
                at,
                Some(set.as_object().unwrap()),
                None,
                None,
            )
            .map(|v| v["clip"].clone())
        };
        // A Session clip: gull.wav, two seconds, made in row 1 of Estuary at the set's 92 BPM.
        let (dir, path) = set_file(TIDE);
        let gull = dir.0.join("Samples/Imported/gull.wav");
        std::fs::create_dir_all(gull.parent().unwrap()).unwrap();
        std::fs::write(&gull, float_wav(96_000, 48_000)).unwrap();
        let file = gull.to_string_lossy().into_owned();
        run(
            &path,
            SetAct::AudioClipMake {
                track: 0,
                file,
                scene: None,
                start: None,
            },
        )
        .unwrap();
        let (root, _) = reread(&path);
        let clip = clip_at(crate::edit::track_at(&root, 0).unwrap(), ClipAt::Slot(0)).unwrap();
        // The order a set Live wrote keeps an AudioClip's elements in (the evidence template's), its view state (ScrollerTime-
        // Preserver, TimeSelection, Grid) and a take's TakeId left out, as the crafted MIDI clip leaves them (G6).
        const LIVE_ORDER: [&str; 43] = [
            "LomId",
            "LomIdView",
            "CurrentStart",
            "CurrentEnd",
            "Loop",
            "Name",
            "Annotation",
            "Color",
            "LaunchMode",
            "LaunchQuantisation",
            "TimeSignature",
            "Envelopes",
            "Legato",
            "Ram",
            "GrooveSettings",
            "Disabled",
            "VelocityAmount",
            "FollowAction",
            "FreezeStart",
            "FreezeEnd",
            "IsWarped",
            "SampleRef",
            "Onsets",
            "WarpMode",
            "GranularityTones",
            "GranularityTexture",
            "FluctuationTexture",
            "TransientResolution",
            "TransientLoopMode",
            "TransientEnvelope",
            "ComplexProFormants",
            "ComplexProEnvelope",
            "Sync",
            "HiQ",
            "Fade",
            "Fades",
            "PitchCoarse",
            "PitchFine",
            "SampleVolume",
            "WarpMarkers",
            "SavedWarpMarkersForStretched",
            "MarkersGenerated",
            "IsSongTempoLeader",
        ];
        let order = LIVE_ORDER.to_vec();
        const FADES: [&str; 10] = [
            "FadeInLength",
            "FadeOutLength",
            "ClipFadesAreInitialized",
            "CrossfadeInState",
            "FadeInCurveSkew",
            "FadeInCurveSlope",
            "FadeOutCurveSkew",
            "FadeOutCurveSlope",
            "IsDefaultFadeIn",
            "IsDefaultFadeOut",
        ];
        let names = |e: &Element| {
            e.children
                .iter()
                .map(|c| c.name.clone())
                .collect::<Vec<_>>()
        };
        assert_eq!(
            names(clip),
            order,
            "the made clip's elements, in Live's order"
        );
        assert_eq!(
            names(clip.child("Fades").unwrap()),
            FADES,
            "its fades, in Live's order"
        );
        // Where the evidence set stands (local only), that order is the one Live wrote.
        let evidence = std::env::var("OI_EVIDENCE_SETS").map_or_else(
            |_| {
                std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                    .join("../../docs/research/ableton-live-12.0.25/evidence/sets")
            },
            std::path::PathBuf::from,
        );
        match std::fs::read_to_string(evidence.join("template-piano-voices-mastering.xml")) {
            Ok(text) => {
                let live = crate::xml::parse(&text).unwrap();
                fn first<'a>(e: &'a Element, name: &str) -> Option<&'a Element> {
                    if e.name == name {
                        return Some(e);
                    }
                    e.children.iter().find_map(|c| first(c, name))
                }
                let theirs = first(&live, "AudioClip").expect("the template holds audio clips");
                let kept: Vec<String> = names(theirs)
                    .into_iter()
                    .filter(|n| order.contains(&n.as_str()))
                    .collect();
                assert_eq!(kept, order, "the order a set Live wrote keeps");
                assert_eq!(names(theirs.child("Fades").unwrap()), FADES);
            }
            Err(_) => eprintln!(
                "the evidence set is not here ({}): Live's own order is not checked",
                evidence.display()
            ),
        }
        // The reading: unwarped, its markers in seconds over the whole file, at Live's defaults.
        let slot = ClipAt::Slot(0);
        let c = clip_json(&path, 0, slot).unwrap()["clip"].clone();
        assert_eq!(
            pick(
                &c,
                &[
                    "warp",
                    "units",
                    "warpMode",
                    "gain",
                    "transpose",
                    "detune",
                    "fade",
                    "fadeIn",
                    "fadeOut",
                    "start",
                    "end"
                ]
            ),
            json!([false, "seconds", "beats", 1.0, 0.0, 0.0, false, 0.0, 0.0, 0.0, 2.0])
        );
        assert_eq!(
            write(&path, slot, json!({"loop": true})).unwrap_err(),
            "An unwarped clip does not loop: turn its Warp on first"
        );
        assert_eq!(
            write(&path, slot, json!({"start": -1})).unwrap_err(),
            "start is a place in seconds of the sample, from 0: the clip is unwarped"
        );
        // Warp on: the markers carried through the clip's warp markers into beats (two seconds at 92 BPM); then it loops.
        let c = write(&path, slot, json!({"warp": true, "loop": true})).unwrap();
        assert_eq!(
            pick(&c, &["warp", "units", "loop"]),
            json!([true, "beats", true])
        );
        assert!(near(&c["end"], 2.0 * 92.0 / 60.0), "{}", c["end"]);
        assert_eq!(
            write(&path, slot, json!({"warp": false})).unwrap_err(),
            "A looped clip stays warped: an unwarped clip does not loop, so turn its loop off first"
        );
        let c = write(&path, slot, json!({"loop": false, "warp": false})).unwrap();
        assert_eq!(
            pick(&c, &["warp", "units", "loop"]),
            json!([false, "seconds", false])
        );
        assert!(
            near(&c["end"], 2.0) && near(&c["start"], 0.0),
            "back in seconds: {} to {}",
            c["start"],
            c["end"]
        );
        // Its mode, gain, pitch and Fade, each as Live keeps it.
        let c = write(
            &path,
            slot,
            json!({"warpMode": "complexpro", "gain": 0.5, "transpose": -12, "detune": 25, "fade": true}),
        )
        .unwrap();
        assert_eq!(
            pick(&c, &["warpMode", "gain", "transpose", "detune", "fade"]),
            json!(["complexpro", 0.5, -12.0, 25.0, true])
        );
        let (root, _) = reread(&path);
        let clip = clip_at(crate::edit::track_at(&root, 0).unwrap(), slot).unwrap();
        assert_eq!(
            [
                "WarpMode",
                "SampleVolume",
                "PitchCoarse",
                "PitchFine",
                "Fade"
            ]
            .map(|n| valued(clip, n)),
            ["6", "0.5", "-12", "25", "true"],
            "Complex Pro is Live's mode 6"
        );
        // 47c item 8: Live 12's manual states no top for a clip's Gain, so a gain above the most a set Live wrote is seen to keep
        // (1.41746271, +3.03 dB) is written and read back, not refused.
        let c = write(&path, slot, json!({"gain": 2})).unwrap();
        assert_eq!(c["gain"], json!(2.0), "read back");
        let (root, _) = reread(&path);
        let clip = clip_at(crate::edit::track_at(&root, 0).unwrap(), slot).unwrap();
        assert_eq!(valued(clip, "SampleVolume"), "2");
        for (set, words) in [
            (
                json!({"warpMode": "rex"}),
                "Warp mode takes one of beats, tones, texture, repitch, complex, complexpro",
            ),
            (
                json!({"gain": -0.5}),
                "Gain is the clip's level as Live keeps it, a linear gain from 0 (silent) up",
            ),
            // Round 48 item 0C-2 (review finding 2): the engine plays a clip's gain as a 32-bit number, so a gain past its most is
            // refused in those words, never written to play as no number.
            (
                json!({"gain": 1e39}),
                "A gain of 1e39 is louder than the engine can play: it plays a clip's gain as a 32-bit number, at most 3.4028234663852886e38",
            ),
            // 0D item 10 (review 11): the bound is the 32-bit number's own most, so a gain past it by less than its rounding is
            // refused in the same words, which name the edge exactly.
            (
                json!({"gain": 3.40282355e38}),
                "A gain of 3.40282355e38 is louder than the engine can play: it plays a clip's gain as a 32-bit number, at most 3.4028234663852886e38",
            ),
            (
                json!({"transpose": 49}),
                "Transpose, in semitones, is a whole number from -48 to 48",
            ),
            (
                json!({"detune": 50}),
                "Detune, in cents, is a whole number from -50 to 49",
            ),
            (
                json!({"fadeIn": 0.1}),
                "Fade in is an Arrangement clip's: a Session clip's fades are its Fade switch",
            ),
        ] {
            assert_eq!(write(&path, slot, set).unwrap_err(), words);
        }
        // 0E item 8 (review 10): the words name the bound the check uses. The most they name, read back from them, is written and read
        // back; the 32-bit most as it prints (3.4028235e38) is past it, so it is refused.
        let refused = write(&path, slot, json!({"gain": 1e39})).unwrap_err();
        let most: f64 = refused.rsplit("at most ").next().unwrap().parse().unwrap();
        let c = write(&path, slot, json!({"gain": most})).unwrap();
        assert_eq!(
            c["gain"],
            json!(most),
            "the most the words name is written and read back"
        );
        assert!(write(&path, slot, json!({"gain": 3.4028235e38})).is_err());
        // A MIDI clip plays no sample.
        let (_midi, midi) = set_file(SET);
        assert_eq!(
            write(&midi, slot, json!({"warp": true})).unwrap_err(),
            "A MIDI clip plays no sample: Warp is an audio clip's setting"
        );
        // An Arrangement clip: low tide.aif, a second and a half, laid from beat 8 at 120 BPM. Its fades are its own, in seconds
        // while it is unwarped; Fade is a Session clip's switch.
        let (music, _) = set_file(TIDE);
        let tide = music.0.join("Audio/low tide.aif");
        std::fs::create_dir_all(tide.parent().unwrap()).unwrap();
        std::fs::write(&tide, aiff(66_150, 44_100)).unwrap();
        let (_lane, lane) = set_file(AUDIO_LANE);
        let file = tide.to_string_lossy().into_owned();
        run(
            &lane,
            SetAct::AudioClipMake {
                track: 0,
                file,
                scene: None,
                start: Some(8.0),
            },
        )
        .unwrap();
        let laid = ClipAt::Arrangement(2);
        assert_eq!(
            write(&lane, laid, json!({"fade": false})).unwrap_err(),
            "Fade is a Session clip's switch: an Arrangement clip's fades are its fade in and fade out"
        );
        let c = write(&lane, laid, json!({"fadeIn": 0.25, "fadeOut": 0.5})).unwrap();
        assert_eq!(
            pick(&c, &["units", "fadeIn", "fadeOut"]),
            json!(["seconds", 0.25, 0.5])
        );
        let (root, _) = reread(&lane);
        let fades = clip_at(crate::edit::track_at(&root, 0).unwrap(), laid)
            .unwrap()
            .child("Fades")
            .unwrap();
        assert_eq!(
            [
                "FadeInLength",
                "FadeOutLength",
                "IsDefaultFadeIn",
                "IsDefaultFadeOut"
            ]
            .map(|n| valued(fades, n)),
            ["0.25", "0.5", "false", "false"]
        );
        assert_eq!(
            write(&lane, laid, json!({"fadeIn": 1.25})).unwrap_err(),
            "Fade in and the other fade together last 1.75 seconds, and the clip only 1.5: a fade lies within its clip"
        );
        // Warped, its markers and fades are in beats: a quarter second is half a beat at 120 BPM.
        let c = write(&lane, laid, json!({"warp": true})).unwrap();
        assert_eq!(
            pick(&c, &["units", "start", "end", "fadeIn", "fadeOut"]),
            json!(["beats", 0.0, 3.0, 0.5, 1.0])
        );
    }

    // Round 48d item 1 (DLW build ruling 2026-11-09, round 48: "the rest of the Sample tab: BPM, /2, ×2, Reverse, RAM, HiQ. Each
    // goes through live-set's own writes and is read back"): RAM and HiQ are the clip's own switches (session-model.md §5: `Ram`,
    // `HiQ`), and its BPM the tempo its warp markers keep its sample at (Live 12's manual, Audio Clips, Tempo and Warping: the BPM
    // field, with ×2 and ÷2 for a guess off by a factor of two). A new BPM moves every warp marker's beat about the first, so the
    // clip's markers and fades, in beats while it is warped, are carried with them: it plays the same stretch of its sample.
    #[test]
    fn the_sample_tab_keeps_ram_hiq_and_its_bpm_through_the_warp_markers() {
        use crate::edit::{clip_json, clip_write};
        let near = |v: &Value, want: f64| (v.as_f64().unwrap() - want).abs() < 1e-6;
        let write = |path: &str, set: Value| {
            let standing = crate::edit::revision(&std::fs::read(path).unwrap());
            clip_write(
                path,
                &standing,
                0,
                ClipAt::Slot(0),
                Some(set.as_object().unwrap()),
                None,
                None,
            )
            .map(|v| v["clip"].clone())
        };
        // gull.wav, two seconds, made in row 1 of Estuary at the set's 92 BPM.
        let (dir, path) = set_file(TIDE);
        let gull = dir.0.join("Samples/Imported/gull.wav");
        std::fs::create_dir_all(gull.parent().unwrap()).unwrap();
        std::fs::write(&gull, float_wav(96_000, 48_000)).unwrap();
        run(
            &path,
            SetAct::AudioClipMake {
                track: 0,
                file: gull.to_string_lossy().into_owned(),
                scene: None,
                start: None,
            },
        )
        .unwrap();
        let c = clip_json(&path, 0, ClipAt::Slot(0)).unwrap()["clip"].clone();
        assert_eq!(
            [&c["ram"], &c["hiq"]],
            [&json!(false), &json!(true)],
            "as the clip is made: streamed, at high quality"
        );
        assert!(
            near(&c["bpm"], 92.0),
            "its warp markers keep it at the set's tempo: {}",
            c["bpm"]
        );
        // RAM and HiQ, written and read back.
        let c = write(&path, json!({"ram": true, "hiq": false})).unwrap();
        assert_eq!([&c["ram"], &c["hiq"]], [&json!(true), &json!(false)]);
        let (root, _) = reread(&path);
        let clip = clip_at(crate::edit::track_at(&root, 0).unwrap(), ClipAt::Slot(0)).unwrap();
        assert_eq!(["Ram", "HiQ"].map(|n| valued(clip, n)), ["true", "false"]);
        // Warped, then ×2: the sample's tempo doubles, so its two seconds span twice the beats, and the clip's end goes with them.
        let c = write(&path, json!({"warp": true, "fade": true})).unwrap();
        assert!(near(&c["end"], 2.0 * 92.0 / 60.0), "{}", c["end"]);
        let c = write(&path, json!({"bpm": 184})).unwrap();
        assert!(near(&c["bpm"], 184.0), "read back: {}", c["bpm"]);
        assert!(
            near(&c["end"], 2.0 * 184.0 / 60.0),
            "the clip still plays its two seconds: {}",
            c["end"]
        );
        let (root, _) = reread(&path);
        let clip = clip_at(crate::edit::track_at(&root, 0).unwrap(), ClipAt::Slot(0)).unwrap();
        let beats: Vec<f64> = clip
            .child("WarpMarkers")
            .unwrap()
            .children
            .iter()
            .map(|m| m.attr("BeatTime").unwrap().parse().unwrap())
            .collect();
        // The made clip's second warp marker stands a 32nd of a beat on; at twice the tempo, a 16th.
        assert!(
            beats[0] == 0.0 && (beats[1] - 0.0625).abs() < 1e-9,
            "each marker's beat moved about the first: {beats:?}"
        );
        // ÷2 takes it back.
        let c = write(&path, json!({"bpm": 92})).unwrap();
        assert!(
            near(&c["bpm"], 92.0) && near(&c["end"], 2.0 * 92.0 / 60.0),
            "{} {}",
            c["bpm"],
            c["end"]
        );
        // Unwarped, its markers are seconds of the sample and stay; only the warp markers' beats move.
        let c = write(&path, json!({"warp": false})).unwrap();
        let c2 = write(&path, json!({"bpm": 46})).unwrap();
        assert!(
            near(&c2["bpm"], 46.0) && c2["end"] == c["end"] && c2["units"] == json!("seconds"),
            "{c2}"
        );
        for (set, words) in [
            (
                json!({"bpm": 0}),
                "BPM is the tempo of the clip's sample, in beats a minute, from 20 to 999",
            ),
            (json!({"ram": "yes"}), "RAM is on or off (true or false)"),
            (json!({"hiq": 1}), "HiQ is on or off (true or false)"),
        ] {
            assert_eq!(write(&path, set).unwrap_err(), words);
        }
        // Warp markers that keep more than one tempo give no one BPM: none is read, and none is set.
        let mut root = crate::open_als(std::path::Path::new(&path)).unwrap();
        let clip = crate::edit::clip_at_mut(
            crate::edit::track_at_mut(&mut root, 0).unwrap(),
            ClipAt::Slot(0),
        )
        .unwrap();
        let mut third = Element::new("WarpMarker");
        for (k, v) in [("Id", "2"), ("SecTime", "1"), ("BeatTime", "3")] {
            third.set_attr(k, v);
        }
        clip.child_mut("WarpMarkers").unwrap().children.push(third);
        std::fs::write(&path, crate::write_gz(&root).unwrap()).unwrap();
        let c = clip_json(&path, 0, ClipAt::Slot(0)).unwrap()["clip"].clone();
        assert_eq!(c["bpm"], Value::Null, "two tempi, so no one BPM");
        assert_eq!(
            write(&path, json!({"bpm": 120})).unwrap_err(),
            "The clip's warp markers keep its sample at more than one tempo, so it has no one BPM to set"
        );
        // A MIDI clip plays no sample.
        let (_midi, midi) = set_file(SET);
        for (set, words) in [
            (
                json!({"ram": true}),
                "A MIDI clip plays no sample: RAM is an audio clip's setting",
            ),
            (
                json!({"hiq": true}),
                "A MIDI clip plays no sample: HiQ is an audio clip's setting",
            ),
            (
                json!({"bpm": 120}),
                "A MIDI clip plays no sample: BPM is an audio clip's setting",
            ),
        ] {
            assert_eq!(write(&midi, set).unwrap_err(), words);
        }
    }

    // Round 48d item 1: Reverse (Live 12's manual, Clip View, the Sample tab: a new sample file, the clip's played backwards; the clip
    // envelopes stay where they are in time; 48e item 1: the clip plays the same frames, last first). The new file is written into
    // the set's own folder, never beside the sample it was made from (DLW build ruling 2026-11-09, round 48: "a rendered reversed
    // file in the set's folder, never in the corpus"), held by its content as Crop's are, and the clip plays it.
    #[test]
    fn reverse_writes_the_sample_backwards_into_the_sets_folder_never_beside_its_source() {
        let (dir, path) = set_file(TIDE);
        let (corpus, _) = set_file(TIDE);
        let source = corpus.0.join("gull.wav");
        let forward = float_wav(6, 48_000);
        std::fs::write(&source, &forward).unwrap();
        run(
            &path,
            SetAct::AudioClipMake {
                track: 0,
                file: source.to_string_lossy().into_owned(),
                scene: None,
                start: None,
            },
        )
        .unwrap();
        let listing = |d: &std::path::Path| {
            let mut names: Vec<String> = std::fs::read_dir(d)
                .unwrap()
                .map(|e| e.unwrap().file_name().to_string_lossy().into_owned())
                .collect();
            names.sort();
            names
        };
        let beside = listing(&corpus.0);
        let before = played(&path, 0, ClipAt::Slot(0));
        let answer = run(
            &path,
            SetAct::ClipReverse {
                track: 0,
                clip: ClipAt::Slot(0),
            },
        )
        .unwrap();
        let relative = answer["sample"]["path"].as_str().unwrap().to_string();
        assert!(
            relative.starts_with("Samples/Processed/Reverse/gull [") && relative.ends_with("].wav"),
            "{relative}"
        );
        assert_eq!(answer["done"], json!(format!("Reversed gull: the clip plays its sample backwards, written beside the set as {relative}.")));
        assert_eq!(
            listing(&corpus.0),
            beside,
            "nothing is written beside the source"
        );
        // The frames, last first; the format as it was.
        let written = std::fs::read(dir.0.join(&relative)).unwrap();
        let frames = |wav: &[u8]| {
            wav[wav.len() - 48..]
                .chunks(8)
                .map(<[u8]>::to_vec)
                .collect::<Vec<_>>()
        };
        let mut back = frames(&forward);
        back.reverse();
        assert_eq!(frames(&written), back);
        assert_eq!(&written[..44 - 8], &forward[..44 - 8], "the same format");
        let (root, _) = reread(&path);
        let clip = clip_at(crate::edit::track_at(&root, 0).unwrap(), ClipAt::Slot(0)).unwrap();
        let file = clip.child("SampleRef").unwrap().child("FileRef").unwrap();
        assert_eq!(
            valued(file, "RelativePath"),
            relative,
            "the clip plays the reversed file"
        );
        let mut backwards = before;
        backwards.reverse();
        assert_eq!(
            played(&path, 0, ClipAt::Slot(0)),
            backwards,
            "it plays the frames it played, last first (48e item 1)"
        );
        // Reversed again: the forward sound, a file of its own, named after the sample and not after the reversed file.
        let again = run(
            &path,
            SetAct::ClipReverse {
                track: 0,
                clip: ClipAt::Slot(0),
            },
        )
        .unwrap();
        let twice = again["sample"]["path"].as_str().unwrap();
        assert!(
            twice.starts_with("Samples/Processed/Reverse/gull [") && twice != relative,
            "{twice}"
        );
        assert_eq!(
            frames(&std::fs::read(dir.0.join(twice)).unwrap()),
            frames(&forward)
        );
        // An AIFF's frames are written as a WAV's: big-endian samples turned little-endian, last first.
        let mut tide = aiff(3, 44_100);
        let n = tide.len();
        tide[n - 6..].copy_from_slice(&[0x01, 0x02, 0x03, 0x04, 0x05, 0x06]);
        let low = corpus.0.join("low tide.aif");
        std::fs::write(&low, &tide).unwrap();
        run(
            &path,
            SetAct::AudioClipMake {
                track: 1,
                file: low.to_string_lossy().into_owned(),
                scene: None,
                start: None,
            },
        )
        .unwrap();
        let answer = run(
            &path,
            SetAct::ClipReverse {
                track: 1,
                clip: ClipAt::Slot(0),
            },
        )
        .unwrap();
        let wav = std::fs::read(dir.0.join(answer["sample"]["path"].as_str().unwrap())).unwrap();
        assert_eq!(wav_shape(&wav).unwrap(), (1, 44_100, 3));
        assert_eq!(&wav[wav.len() - 6..], &[0x06, 0x05, 0x04, 0x03, 0x02, 0x01]);
        // A stale revision leaves no file behind; a MIDI clip has no sample to reverse.
        let reversed = listing(&dir.0.join("Samples/Processed/Reverse"));
        let stale = super::act(
            &path,
            "sha256:stale",
            &SetAct::ClipReverse {
                track: 0,
                clip: ClipAt::Slot(0),
            },
        );
        assert!(stale.is_err());
        assert_eq!(listing(&dir.0.join("Samples/Processed/Reverse")), reversed);
        let (_midi, midi) = set_file(SET);
        assert_eq!(
            run(&midi, SetAct::ClipReverse { track: 0, clip: ClipAt::Slot(0) }).unwrap_err(),
            "Riff is a MIDI clip: Reverse in the Sample tab plays a sample backwards, and Pitch and Time's Reverse reverses notes"
        );
    }

    /// A 16-bit integer WAV of `channels` channels at `rate`, its samples as given, interleaved.
    fn pcm16(rate: u32, channels: u16, samples: &[i16]) -> Vec<u8> {
        let block = 2 * channels;
        let data: Vec<u8> = samples.iter().flat_map(|s| s.to_le_bytes()).collect();
        wav_of(&fmt16(1, channels, rate, block, 16), &[], &data)
    }

    /// A 16-byte `fmt ` body: its format tag, channels, rate, block align and bits.
    fn fmt16(tag: u16, channels: u16, rate: u32, block: u16, bits: u16) -> Vec<u8> {
        let mut fmt = tag.to_le_bytes().to_vec();
        fmt.extend_from_slice(&channels.to_le_bytes());
        fmt.extend_from_slice(&rate.to_le_bytes());
        fmt.extend_from_slice(&(rate * u32::from(block)).to_le_bytes());
        fmt.extend_from_slice(&block.to_le_bytes());
        fmt.extend_from_slice(&bits.to_le_bytes());
        fmt
    }

    /// A WAV of `fmt` and `data`, with the chunks `before` between them, each padded to an even length.
    fn wav_of(fmt: &[u8], before: &[(&[u8; 4], Vec<u8>)], data: &[u8]) -> Vec<u8> {
        let mut body = b"WAVE".to_vec();
        let mut chunk = |id: &[u8], bytes: &[u8]| {
            body.extend_from_slice(id);
            body.extend_from_slice(&(bytes.len() as u32).to_le_bytes());
            body.extend_from_slice(bytes);
            if bytes.len() & 1 == 1 {
                body.push(0);
            }
        };
        chunk(b"fmt ", fmt);
        for (id, bytes) in before {
            chunk(*id, bytes);
        }
        chunk(b"data", data);
        let mut out = b"RIFF".to_vec();
        out.extend_from_slice(&(body.len() as u32).to_le_bytes());
        out.extend_from_slice(&body);
        out
    }

    /// An AIFF of `channels` channels of `bits`-bit samples at `rate` (its `COMM` rate an 80-bit extended number), its sound as given.
    fn aiff_of(channels: u16, bits: u16, rate: u32, sound: &[u8]) -> Vec<u8> {
        let width = usize::from(bits.div_ceil(8));
        let frames = (sound.len() / (width * usize::from(channels))) as u32;
        let exponent = 16383 + 31 - rate.leading_zeros() as u16;
        let mantissa = u64::from(rate) << (rate.leading_zeros() + 32);
        let mut comm = channels.to_be_bytes().to_vec();
        comm.extend_from_slice(&frames.to_be_bytes());
        comm.extend_from_slice(&bits.to_be_bytes());
        comm.extend_from_slice(&exponent.to_be_bytes());
        comm.extend_from_slice(&mantissa.to_be_bytes());
        let mut body = b"AIFFCOMM".to_vec();
        body.extend_from_slice(&18u32.to_be_bytes());
        body.extend_from_slice(&comm);
        body.extend_from_slice(b"SSND");
        body.extend_from_slice(&(8 + sound.len() as u32).to_be_bytes());
        body.extend_from_slice(&[0; 8]);
        body.extend_from_slice(sound);
        if sound.len() & 1 == 1 {
            body.push(0);
        }
        let mut out = b"FORM".to_vec();
        out.extend_from_slice(&(body.len() as u32).to_be_bytes());
        out.extend_from_slice(&body);
        out
    }

    /// Change clip `at` of part `track` of the set at `path` in the document, as a set another hand wrote would hold it.
    fn with_clip(path: &str, track: usize, at: ClipAt, change: impl FnOnce(&mut Element)) {
        let mut root = crate::open_als(std::path::Path::new(path)).unwrap();
        change(
            crate::edit::clip_at_mut(crate::edit::track_at_mut(&mut root, track).unwrap(), at)
                .unwrap(),
        );
        std::fs::write(path, crate::write_gz(&root).unwrap()).unwrap();
    }

    /// Set the clip's loop markers (`Loop`'s children by name) and its warp markers, `(seconds, beats)`.
    fn put_markers(clip: &mut Element, markers: &[(&str, f64)], warp: &[(f64, f64)]) {
        let lp = clip.child_mut("Loop").unwrap();
        for (name, v) in markers {
            crate::edit::set_value(lp, name, &number_text(*v)).unwrap();
        }
        if !warp.is_empty() {
            let list = clip.child_mut("WarpMarkers").unwrap();
            list.children.retain(|m| m.name != "WarpMarker");
            for (i, (sec, beat)) in warp.iter().enumerate() {
                let mut m = Element::new("WarpMarker");
                m.set_attr("Id", &i.to_string());
                m.set_attr("SecTime", &number_text(*sec));
                m.set_attr("BeatTime", &number_text(*beat));
                list.children.push(m);
            }
        }
    }

    /// The clip's warp markers, `(seconds, beats)`, in the document's order.
    fn warp_of(clip: &Element) -> Vec<(f64, f64)> {
        clip.child("WarpMarkers")
            .unwrap()
            .children
            .iter()
            .filter(|m| m.name == "WarpMarker")
            .map(|m| {
                (
                    m.attr("SecTime").unwrap().parse().unwrap(),
                    m.attr("BeatTime").unwrap().parse().unwrap(),
                )
            })
            .collect()
    }

    /// A beat of a warped clip as seconds of its sample, along its warp markers (and on past the first or last pair at their slope).
    fn second_of(clip: &Element, beat: f64) -> f64 {
        let mut pairs = warp_of(clip);
        pairs.sort_by(|a, b| a.0.total_cmp(&b.0));
        let i = (0..pairs.len() - 1)
            .find(|&i| beat <= pairs[i + 1].1)
            .unwrap_or(pairs.len() - 2);
        let ((s0, b0), (s1, b1)) = (pairs[i], pairs[i + 1]);
        s0 + (beat - b0) * (s1 - s0) / (b1 - b0)
    }

    /// The frames clip `at` of part `track` plays of the sample it names, each frame's bytes, once through in the order it plays them:
    /// from its start to its end, or once round its loop; its markers taken to seconds of the sample through its warp markers where it
    /// is warped. The sample is a WAV of the shape these tests write and Reverse keeps (`fmt ` at 12, `data` at 36).
    fn played(path: &str, track: usize, at: ClipAt) -> Vec<Vec<u8>> {
        let (root, _) = reread(path);
        let clip = clip_at(crate::edit::track_at(&root, track).unwrap(), at).unwrap();
        let file = clip.child("SampleRef").unwrap().child("FileRef").unwrap();
        let folder = std::path::Path::new(path).parent().unwrap();
        let named = |field: &str| Some(valued(file, field)).filter(|v| !v.is_empty());
        let sample = named("RelativePath")
            .map(|r| folder.join(r))
            .filter(|f| f.is_file())
            .or_else(|| named("Path").map(std::path::PathBuf::from))
            .unwrap();
        let wav = std::fs::read(sample).unwrap();
        assert_eq!(&wav[36..40], b"data");
        let rate = f64::from(u32::from_le_bytes(wav[24..28].try_into().unwrap()));
        let block = usize::from(u16::from_le_bytes([wav[32], wav[33]]));
        let size = u32::from_le_bytes(wav[40..44].try_into().unwrap()) as usize;
        let frames: Vec<Vec<u8>> = wav[44..44 + size]
            .chunks_exact(block)
            .map(<[u8]>::to_vec)
            .collect();
        let m = crate::edit::markers(clip);
        let get = |key: &str| m[key].as_f64().unwrap();
        let (from, to) = if m["loop"] == json!(true) {
            (get("position"), get("position") + get("length"))
        } else {
            (get("start"), get("end"))
        };
        let warped = valued(clip, "IsWarped") == "true";
        let frame = |x: f64| {
            let seconds = if warped { second_of(clip, x) } else { x };
            (seconds * rate).round() as usize
        };
        frames[frame(from)..frame(to)].to_vec()
    }

    // 48e item 1 (DLW build ruling 2026-11-09, on #944's review, H1): Reverse plays the same sound backwards, never another stretch of
    // it. The clip's region is mirrored about the sample's length (its seconds while it is unwarped; its beats once warped, through
    // its warp markers, which pin the same moments of the sound and are mirrored too), so the frames it plays are the frames it
    // played, last first: a trimmed Session clip, a warped clip whose warp markers keep two tempi, an Arrangement clip, and a looped
    // clip, whose start is mirrored about its loop and stays on the same moment of the sound.
    #[test]
    fn reverse_plays_the_same_stretch_of_the_sound_backwards() {
        use crate::edit::clip_write;
        let backwards = |mut frames: Vec<Vec<u8>>| {
            frames.reverse();
            frames
        };
        let reverse = |path: &str, track: usize, at: ClipAt| {
            run(path, SetAct::ClipReverse { track, clip: at }).unwrap()
        };
        // Three seconds at 8 Hz: frame i holds i.
        let sound: Vec<i16> = (0..24).collect();
        let (dir, path) = set_file(TIDE);
        let tone = dir.0.join("tone.wav");
        std::fs::write(&tone, pcm16(8, 1, &sound)).unwrap();
        for (track, scene) in [(0, 0), (1, 0), (0, 1)] {
            run(
                &path,
                SetAct::AudioClipMake {
                    track,
                    file: tone.to_string_lossy().into_owned(),
                    scene: Some(scene),
                    start: None,
                },
            )
            .unwrap();
        }
        // A trimmed Session clip, unwarped: seconds 1 to 2.5 of the sample, frames 8 to 19.
        clip_write(
            &path,
            &standing(&path),
            0,
            ClipAt::Slot(0),
            Some(json!({"start": 1, "end": 2.5}).as_object().unwrap()),
            None,
            None,
        )
        .unwrap();
        let before = played(&path, 0, ClipAt::Slot(0));
        assert_eq!(before.len(), 12);
        reverse(&path, 0, ClipAt::Slot(0));
        assert_eq!(
            played(&path, 0, ClipAt::Slot(0)),
            backwards(before),
            "a trimmed clip plays its own stretch, backwards"
        );
        // A warped clip whose warp markers keep two tempi (two beats a second, then half a beat), playing beats 0.5 to 2.5.
        with_clip(&path, 1, ClipAt::Slot(0), |clip| {
            crate::edit::set_value(clip, "IsWarped", "true").unwrap();
            put_markers(
                clip,
                &[
                    ("LoopStart", 0.5),
                    ("LoopEnd", 2.5),
                    ("OutMarker", 2.5),
                    ("HiddenLoopStart", 0.5),
                    ("HiddenLoopEnd", 2.0),
                ],
                &[(0.0, 0.0), (1.0, 2.0), (3.0, 3.0)],
            );
        });
        let before = played(&path, 1, ClipAt::Slot(0));
        assert_eq!(before.len(), 14, "frames 2 to 15");
        reverse(&path, 1, ClipAt::Slot(0));
        assert_eq!(played(&path, 1, ClipAt::Slot(0)), backwards(before));
        let (root, _) = reread(&path);
        let clip = clip_at(crate::edit::track_at(&root, 1).unwrap(), ClipAt::Slot(0)).unwrap();
        assert_eq!(
            warp_of(clip),
            [(0.0, 0.0), (2.0, 1.0), (3.0, 3.0)],
            "each warp marker pins the same moment of the sound: (D − seconds, B − beat), in order"
        );
        assert_eq!(
            loop_of(clip)[5..],
            ["1", "2.5"].map(String::from),
            "its hidden loop, beats 0.5 to 2 of three, is mirrored too: 1 to 2.5"
        );
        // A looped clip, warped evenly (two beats a second): its loop is beats 1 to 5, and it starts a beat into it.
        with_clip(&path, 0, ClipAt::Slot(1), |clip| {
            crate::edit::set_value(clip, "IsWarped", "true").unwrap();
            put_markers(
                clip,
                &[
                    ("LoopStart", 1.0),
                    ("LoopEnd", 5.0),
                    ("StartRelative", 1.0),
                    ("OutMarker", 5.0),
                    ("HiddenLoopStart", 1.0),
                    ("HiddenLoopEnd", 5.0),
                ],
                &[(0.0, 0.0), (3.0, 6.0)],
            );
            crate::edit::set_value(clip.child_mut("Loop").unwrap(), "LoopOn", "true").unwrap();
        });
        let before = played(&path, 0, ClipAt::Slot(1));
        assert_eq!(before.len(), 16, "frames 4 to 19, round the loop");
        reverse(&path, 0, ClipAt::Slot(1));
        assert_eq!(played(&path, 0, ClipAt::Slot(1)), backwards(before));
        let looped = |path: &str| {
            let (root, _) = reread(path);
            let clip = clip_at(crate::edit::track_at(&root, 0).unwrap(), ClipAt::Slot(1)).unwrap();
            loop_of(clip)
        };
        // Its start, a beat into the loop of four, is mirrored about the loop: three beats in, the same moment of the sound.
        assert_eq!(
            looped(&path),
            ["1", "5", "3", "true", "5", "1", "5"].map(String::from),
            "LoopStart, LoopEnd, StartRelative, LoopOn, OutMarker, HiddenLoopStart, HiddenLoopEnd"
        );
        // Reversed again, it is as it was.
        reverse(&path, 0, ClipAt::Slot(1));
        assert_eq!(
            looped(&path)[..5],
            ["1", "5", "1", "true", "5"].map(String::from)
        );
        // An Arrangement clip, unwarped: Answer plays seconds 1 to 3 of its sample on the ruler from beat 4 to 8, and stays there.
        let (lane, lane_path) = set_file(AUDIO_LANE);
        std::fs::write(lane.0.join("answer.wav"), pcm16(8, 1, &sound)).unwrap();
        let before = played(&lane_path, 0, ClipAt::Arrangement(1));
        assert_eq!(before.len(), 16, "frames 8 to 23");
        reverse(&lane_path, 0, ClipAt::Arrangement(1));
        assert_eq!(
            played(&lane_path, 0, ClipAt::Arrangement(1)),
            backwards(before)
        );
        let answer = arranged(&lane_path, 0, 1);
        assert_eq!(
            [
                valued(&answer, "CurrentStart"),
                valued(&answer, "CurrentEnd")
            ],
            ["4", "8"],
            "on the ruler where it was"
        );
    }

    // 48e items 2, 8, 11 and 14 (DLW build ruling 2026-11-09, on #944's review, M1, L1, L4, L7): a clip's BPM is 20 to 999, the range
    // the shell shows; a write computes every value it carries first and refuses in words, before writing anything, unless every beat
    // is finite, in order and within a million; an Arrangement clip's span goes with its markers, and never over the clip that
    // follows it; its fades and its start go with them, about its first warp marker wherever that stands; and warp markers that
    // repeat a time are named as that. After every refusal the clip still takes a BPM and Warp off.
    #[test]
    fn a_clips_bpm_keeps_to_its_range_and_never_breaks_the_clip() {
        use crate::edit::clip_write;
        let write = |path: &str, at: ClipAt, set: Value| {
            clip_write(
                path,
                &standing(path),
                0,
                at,
                Some(set.as_object().unwrap()),
                None,
                None,
            )
            .map(|v| v["clip"].clone())
        };
        let near = |v: f64, want: f64| (v - want).abs() < 1e-9 * want.abs().max(1.0);
        let (dir, path) = set_file(TIDE);
        let gull = dir.0.join("gull.wav");
        std::fs::write(&gull, float_wav(96_000, 48_000)).unwrap();
        run(
            &path,
            SetAct::AudioClipMake {
                track: 0,
                file: gull.to_string_lossy().into_owned(),
                scene: None,
                start: None,
            },
        )
        .unwrap();
        write(&path, ClipAt::Slot(0), json!({"warp": true})).unwrap();
        let range = "BPM is the tempo of the clip's sample, in beats a minute, from 20 to 999";
        for bpm in [5e-324, 1e-300, 1e300, 0.0, 19.99, 999.01, -92.0] {
            let was = standing(&path);
            assert_eq!(
                write(&path, ClipAt::Slot(0), json!({ "bpm": bpm })).unwrap_err(),
                range,
                "{bpm}"
            );
            assert_eq!(standing(&path), was, "{bpm}: nothing is written");
            let c = write(&path, ClipAt::Slot(0), json!({"bpm": 92})).unwrap();
            assert!(
                near(c["bpm"].as_f64().unwrap(), 92.0),
                "{bpm}: {}",
                c["bpm"]
            );
            write(&path, ClipAt::Slot(0), json!({"warp": false})).unwrap();
            write(&path, ClipAt::Slot(0), json!({"warp": true})).unwrap();
        }
        // In range, but carrying the clip's markers more than a million beats out: refused before anything is written.
        with_clip(&path, 0, ClipAt::Slot(0), |clip| {
            put_markers(
                clip,
                &[
                    ("LoopEnd", 1000.0),
                    ("OutMarker", 1000.0),
                    ("HiddenLoopEnd", 1000.0),
                ],
                &[(0.0, 0.0), (100.0, 1.0)],
            );
        });
        let was = standing(&path);
        assert_eq!(
            write(&path, ClipAt::Slot(0), json!({"bpm": 999})).unwrap_err(),
            "At 999 BPM the clip's markers would reach more than a million beats from its sample's start, so its BPM is not set"
        );
        assert_eq!(standing(&path), was);
        // In range, but two warp markers a millionth of a millionth of a second apart would stand at one beat.
        with_clip(&path, 0, ClipAt::Slot(0), |clip| {
            crate::edit::set_value(clip, "IsWarped", "false").unwrap();
            put_markers(clip, &[], &[(0.0, 900_000.0), (1e-12, 900_001.0)]);
        });
        let was = standing(&path);
        assert_eq!(
            write(&path, ClipAt::Slot(0), json!({"bpm": 20})).unwrap_err(),
            "At 20 BPM two of the clip's markers would stand at the same beat, so its BPM is not set"
        );
        assert_eq!(standing(&path), was);
        // The markers move about the first warp marker, wherever it stands (here at beat 1): at twice the tempo, beat 3 is beat 5.
        with_clip(&path, 0, ClipAt::Slot(0), |clip| {
            put_markers(clip, &[], &[(0.5, 1.0), (1.5, 3.0)]);
        });
        write(&path, ClipAt::Slot(0), json!({"bpm": 240})).unwrap();
        let (root, _) = reread(&path);
        let clip = clip_at(crate::edit::track_at(&root, 0).unwrap(), ClipAt::Slot(0)).unwrap();
        assert_eq!(warp_of(clip), [(0.5, 1.0), (1.5, 5.0)]);
        // Warp markers that repeat a time are named as that, for BPM and for Warp.
        for (warp, why) in [
            (
                [(0.0, 0.0), (1.0, 2.0), (1.0, 3.0)],
                "The clip keeps two warp markers at 1 s of its sample",
            ),
            (
                [(0.0, 0.0), (1.0, 2.0), (2.0, 2.0)],
                "The clip keeps two warp markers at beat 2",
            ),
        ] {
            with_clip(&path, 0, ClipAt::Slot(0), |clip| {
                put_markers(clip, &[], &warp)
            });
            assert_eq!(
                write(&path, ClipAt::Slot(0), json!({"bpm": 120})).unwrap_err(),
                format!("{why}, so its sample has no tempo to set")
            );
            assert_eq!(
                write(&path, ClipAt::Slot(0), json!({"warp": true})).unwrap_err(),
                format!(
                    "{why}, so its markers have no place in both seconds and beats of its sample"
                )
            );
        }
        // An Arrangement clip's span goes with its markers, never over the next clip: Room 0–4 and Answer 4–8, warped at 120 BPM.
        let (_lane, lane) = set_file(AUDIO_LANE);
        for j in [0, 1] {
            write(&lane, ClipAt::Arrangement(j), json!({"warp": true})).unwrap();
        }
        let was = standing(&lane);
        assert_eq!(
            write(&lane, ClipAt::Arrangement(0), json!({"bpm": 240})).unwrap_err(),
            "At 240 BPM Room would end at beat 8, past the start of Answer, the next clip on its part, at beat 4: its BPM is not set"
        );
        assert_eq!(standing(&lane), was);
        // ÷2: Room spans half the beats, its fade in too (0.01 s, 0.02 beats at 120 BPM, 0.01 at 60).
        let c = write(&lane, ClipAt::Arrangement(0), json!({"bpm": 60})).unwrap();
        assert!(near(c["bpm"].as_f64().unwrap(), 60.0));
        let room = arranged(&lane, 0, 0);
        assert_eq!(valued(&room, "CurrentEnd"), "2");
        let fade: f64 = valued(room.child("Fades").unwrap(), "FadeInLength")
            .parse()
            .unwrap();
        assert!(near(fade, 0.01), "{fade}");
        // Answer is the part's last clip: looped, starting a beat into its loop, at twice the tempo its span, loop and start double.
        write(&lane, ClipAt::Arrangement(1), json!({"loop": true})).unwrap();
        let c = write(&lane, ClipAt::Arrangement(1), json!({"start": 3})).unwrap();
        assert_eq!(c["start"], json!(3.0));
        write(&lane, ClipAt::Arrangement(1), json!({"bpm": 240})).unwrap();
        let answer = arranged(&lane, 0, 1);
        assert_eq!(valued(&answer, "CurrentEnd"), "12");
        assert_eq!(
            loop_of(&answer)[..3],
            ["4", "12", "2"].map(String::from),
            "LoopStart, LoopEnd, StartRelative"
        );
    }

    // 48e item 3 (DLW build ruling 2026-11-09, on #944's review, M2): Reverse asks the file it opened what it is, so a pipe that
    // stands at the name when it is opened (one put there after the clip's file was found) is refused unread and never waited on,
    // and so is a device; a regular file is read whole.
    #[test]
    fn reverse_source_asks_the_open_file_what_it_is_and_never_waits() {
        let (dir, _) = set_file(TIDE);
        let pipe = dir.0.join("pipe");
        assert!(std::process::Command::new("/usr/bin/mkfifo")
            .arg(&pipe)
            .status()
            .unwrap()
            .success());
        let (tx, rx) = std::sync::mpsc::channel();
        let at = pipe.clone();
        std::thread::spawn(move || {
            let _ = tx.send(reverse_source(&at, "pipe"));
        });
        // A guard only: an open that waits on the pipe is let go by opening it for writing, so the test ends.
        let read = match rx.recv_timeout(std::time::Duration::from_secs(30)) {
            Ok(read) => read,
            Err(_) => {
                let _ = std::fs::OpenOptions::new().write(true).open(&pipe);
                panic!("Reverse waited on the pipe it opened");
            }
        };
        assert_eq!(
            read.unwrap_err(),
            "pipe is no regular file (a pipe, a device or a folder), so it is not read and nothing was reversed"
        );
        assert_eq!(
            reverse_source(std::path::Path::new("/dev/null"), "null").unwrap_err(),
            "null is no regular file (a pipe, a device or a folder), so it is not read and nothing was reversed"
        );
        let a = dir.0.join("a.wav");
        let bytes = pcm16(8, 1, &[1, 2, 3, 4]);
        std::fs::write(&a, &bytes).unwrap();
        assert_eq!(reverse_source(&a, "a.wav").unwrap(), bytes);
    }

    /// The one opener Reverse and the Sample tab read a sample through (round 48d item 2, on 48e items 3 and 5): a file that says it
    /// holds more than its reader takes is refused once opened, before a byte of it is read; and the read stops one byte past the
    /// bound, so a file that holds more than it said is refused alike.
    #[test]
    fn a_sample_heavier_than_its_reader_takes_is_refused_before_it_is_read() {
        let (dir, _) = set_file(TIDE);
        let big = dir.0.join("big.wav");
        let most: u64 = 1024 * 1024;
        std::fs::File::create(&big)
            .unwrap()
            .set_len(most + 1)
            .unwrap();
        let (act, unmade) = ("the Sample tab", "its transients are not shown");
        let heavy =
            "big.wav weighs more than the Sample tab reads (1 MiB), so its transients are not shown";
        assert_eq!(
            open_sound(&big, "big.wav", most, act, unmade).unwrap_err(),
            heavy
        );
        let (handle, _) = open_sound(&big, "big.wav", most + 1, act, unmade).unwrap();
        assert_eq!(
            read_sound(handle, 0, "big.wav", most, act, unmade).unwrap_err(),
            heavy
        );
        let (handle, meta) = open_sound(&big, "big.wav", most + 1, act, unmade).unwrap();
        assert_eq!(
            read_sound(handle, meta.len(), "big.wav", most + 1, act, unmade)
                .unwrap()
                .len() as u64,
            most + 1
        );
    }

    // 48f item 1 (DLW build ruling 2026-11-09, on 48e's delta review, F1; its probes PA and PE): a looped clip's end marker plays
    // nothing while its loop is on, so Reverse sets it to the mirrored loop's end, D − LoopStart; the loop and the start, what the clip
    // plays, are the same sound backwards. Loop off then plays from the start marker to that end, which is no mirror of what Loop off
    // played before: a clip has one start marker for both views, and the start its loop needs is not the start that mirror needs. So
    // Reverse does not commute with Loop off where the end marker is not the loop end.
    #[test]
    fn a_looped_clips_end_marker_goes_to_its_mirrored_loops_end() {
        use crate::edit::clip_write;
        let write = |path: &str, scene: usize, set: Value| {
            clip_write(
                path,
                &standing(path),
                0,
                ClipAt::Slot(scene),
                Some(set.as_object().unwrap()),
                None,
                None,
            )
            .unwrap();
        };
        let reverse = |path: &str, scene: usize| {
            run(
                path,
                SetAct::ClipReverse {
                    track: 0,
                    clip: ClipAt::Slot(scene),
                },
            )
            .unwrap();
        };
        let read = |path: &str, scene: usize| {
            let (root, _) = reread(path);
            let clip = clip_at(
                crate::edit::track_at(&root, 0).unwrap(),
                ClipAt::Slot(scene),
            )
            .unwrap();
            crate::edit::markers(clip)
        };
        let span = |path: &str, scene: usize| {
            let m = read(path, scene);
            [m["start"].as_f64().unwrap(), m["end"].as_f64().unwrap()]
        };
        // Twelve seconds at 8 Hz, frame i holding i, warped a beat a second: looped from 1 to 5, starting at 2, its end marker at 9.
        let sound: Vec<i16> = (0..96).collect();
        let (dir, path) = set_file(TIDE);
        let tone = dir.0.join("tone.wav");
        std::fs::write(&tone, pcm16(8, 1, &sound)).unwrap();
        for scene in [0, 1] {
            run(
                &path,
                SetAct::AudioClipMake {
                    track: 0,
                    file: tone.to_string_lossy().into_owned(),
                    scene: Some(scene),
                    start: None,
                },
            )
            .unwrap();
            with_clip(&path, 0, ClipAt::Slot(scene), |clip| {
                crate::edit::set_value(clip, "IsWarped", "true").unwrap();
                put_markers(
                    clip,
                    &[
                        ("LoopStart", 1.0),
                        ("LoopEnd", 5.0),
                        ("StartRelative", 1.0),
                        ("OutMarker", 9.0),
                        ("HiddenLoopStart", 1.0),
                        ("HiddenLoopEnd", 5.0),
                    ],
                    &[(0.0, 0.0), (12.0, 12.0)],
                );
                crate::edit::set_value(clip.child_mut("Loop").unwrap(), "LoopOn", "true").unwrap();
            });
        }
        assert_eq!(
            read(&path, 0),
            json!({"loop": true, "start": 2.0, "end": 9.0, "position": 1.0, "length": 4.0})
        );
        // PA: reversed, the loop is 7 to 11 and the start 10, the same sound backwards; the end is the mirrored loop's end, 11.
        let mut before = played(&path, 0, ClipAt::Slot(0));
        reverse(&path, 0);
        before.reverse();
        assert_eq!(
            played(&path, 0, ClipAt::Slot(0)),
            before,
            "round its loop, the clip plays the same sound backwards"
        );
        assert_eq!(
            read(&path, 0),
            json!({"loop": true, "start": 10.0, "end": 11.0, "position": 7.0, "length": 4.0})
        );
        // PE: Loop off then plays from 10 to 11. Loop off first plays 2 to 9, and Reverse then plays 3 to 10, its mirror: the two
        // orders differ while the end marker is not the loop end.
        write(&path, 0, json!({"loop": false}));
        assert_eq!(span(&path, 0), [10.0, 11.0], "Reverse, then Loop off");
        write(&path, 1, json!({"loop": false}));
        assert_eq!(span(&path, 1), [2.0, 9.0]);
        reverse(&path, 1);
        assert_eq!(span(&path, 1), [3.0, 10.0], "Loop off, then Reverse");
    }

    // 48f item 4 (DLW build ruling 2026-11-09, on 48e's delta review, F4; its probe PH): an Arrangement clip may end exactly where the
    // next clip on its part begins. Room 0–4 and Answer 4–8, warped at 120 BPM: Room takes 120 again, 60, then 120, ending at beat 4
    // where Answer begins; 121 would carry its end past Answer's start, and is refused in words with nothing written.
    #[test]
    fn an_arrangement_clip_may_end_where_the_next_begins() {
        use crate::edit::clip_write;
        let write = |path: &str, at: ClipAt, set: Value| {
            clip_write(
                path,
                &standing(path),
                0,
                at,
                Some(set.as_object().unwrap()),
                None,
                None,
            )
            .map(|v| v["clip"].clone())
        };
        let (_lane, lane) = set_file(AUDIO_LANE);
        for j in [0, 1] {
            write(&lane, ClipAt::Arrangement(j), json!({"warp": true})).unwrap();
        }
        for (bpm, end) in [(120, "4"), (60, "2"), (120, "4")] {
            write(&lane, ClipAt::Arrangement(0), json!({ "bpm": bpm })).unwrap();
            assert_eq!(
                valued(&arranged(&lane, 0, 0), "CurrentEnd"),
                end,
                "{bpm} BPM"
            );
        }
        let was = standing(&lane);
        assert_eq!(
            write(&lane, ClipAt::Arrangement(0), json!({"bpm": 121})).unwrap_err(),
            format!(
                "At 121 BPM Room would end at beat {}, past the start of Answer, the next clip on its part, at beat 4: its BPM is not set",
                number_text(4.0 * (121.0 / 120.0))
            )
        );
        assert_eq!(standing(&lane), was);
    }

    // 48f item 5 (DLW build ruling 2026-11-09, on 48e's delta review, F5; its probes PB, PC and PG): each way Reverse's markers go
    // (`edit::reverse_markers`). A region past the end of its sample is refused in words, the set as it was and no sample left; a place
    // a billionth of the sample's length before its start is its start, and one further out is refused, never clamped; a warped clip
    // with no pair of warp markers is refused; mirrored warp markers that would not stand are refused; where every warp marker falls
    // past the sample's end, the reversed one gains a marker at its first frame and its last on the same line; B, the beats the warp
    // markers give the sample, is its first frame's beat and its last's together, so a sample that starts at beat 4 still does; and an
    // unwarped clip's warp markers are mirrored too, so it plays the same sound backwards once Warp is on.
    #[test]
    fn reverse_mirrors_each_marker_or_refuses_in_words() {
        let fresh = |seconds: usize, warp: bool, markers: &[(&str, f64)], pairs: &[(f64, f64)]| {
            let sound: Vec<i16> = (0..(seconds * 8) as i16).collect();
            let (dir, path) = set_file(TIDE);
            let gull = dir.0.join("gull.wav");
            std::fs::write(&gull, pcm16(8, 1, &sound)).unwrap();
            run(
                &path,
                SetAct::AudioClipMake {
                    track: 0,
                    file: gull.to_string_lossy().into_owned(),
                    scene: Some(0),
                    start: None,
                },
            )
            .unwrap();
            with_clip(&path, 0, ClipAt::Slot(0), |clip| {
                crate::edit::set_value(clip, "IsWarped", if warp { "true" } else { "false" })
                    .unwrap();
                put_markers(clip, markers, pairs);
            });
            (dir, path)
        };
        let reverse = |path: &str| {
            run(
                path,
                SetAct::ClipReverse {
                    track: 0,
                    clip: ClipAt::Slot(0),
                },
            )
        };
        let clip_of = |path: &str| {
            let (root, _) = reread(path);
            clip_at(crate::edit::track_at(&root, 0).unwrap(), ClipAt::Slot(0))
                .unwrap()
                .clone()
        };
        let kept = |dir: &SetFile| {
            std::fs::read_dir(dir.0.join(REVERSE_DIR))
                .map(|list| list.count())
                .unwrap_or(0)
        };
        let refused = |why: &str| {
            format!("Gull {why}, so its markers have no place in the reversed sample: nothing was reversed")
        };
        // PB: an unwarped clip whose region ends at 3.5 s of a 3 s sample.
        let past = [("LoopStart", 0.0), ("LoopEnd", 3.5), ("OutMarker", 3.5)];
        let (dir, path) = fresh(3, false, &past, &[]);
        let was = standing(&path);
        assert_eq!(
            reverse(&path).unwrap_err(),
            refused("plays past the end of its sample")
        );
        assert_eq!(standing(&path), was, "the set is as it was");
        assert_eq!(kept(&dir), 0, "no sample is left");
        // PC: a hair past the end, 1e-10 s, is the end; 1e-8 s is past it (the slack is a billionth of the sample's length).
        let hair = [
            ("LoopStart", 0.0),
            ("LoopEnd", 3.0 + 1e-10),
            ("OutMarker", 3.0 + 1e-10),
        ];
        let (_hair, path) = fresh(3, false, &hair, &[]);
        reverse(&path).unwrap();
        assert_eq!(loop_of(&clip_of(&path))[..2], ["0", "3"].map(String::from));
        let more = [
            ("LoopStart", 0.0),
            ("LoopEnd", 3.0 + 1e-8),
            ("OutMarker", 3.0 + 1e-8),
        ];
        let (more_dir, path) = fresh(3, false, &more, &[]);
        let was = standing(&path);
        assert_eq!(
            reverse(&path).unwrap_err(),
            refused("plays past the end of its sample")
        );
        assert_eq!(standing(&path), was);
        assert_eq!(kept(&more_dir), 0);
        // A warped clip with one warp marker has no beats for its sample.
        let (one_dir, path) = fresh(3, true, &[], &[(0.0, 0.0)]);
        let was = standing(&path);
        assert_eq!(
            reverse(&path).unwrap_err(),
            refused("is warped and carries no pair of warp markers")
        );
        assert_eq!(standing(&path), was);
        assert_eq!(kept(&one_dir), 0);
        // Warp markers mirrored past a million beats: 125 000 beats a second over 12 s gives the sample 1.5 million beats, and its
        // region, 600 000 to 1 000 000, mirrors to 500 000 to 900 000, but its warp markers to 1 375 000 and 1 500 000.
        let far = [
            ("LoopStart", 600_000.0),
            ("LoopEnd", 1_000_000.0),
            ("OutMarker", 1_000_000.0),
            ("HiddenLoopStart", 600_000.0),
            ("HiddenLoopEnd", 1_000_000.0),
        ];
        let (far_dir, path) = fresh(12, true, &far, &[(0.0, 0.0), (1.0, 125_000.0)]);
        let was = standing(&path);
        assert_eq!(
            reverse(&path).unwrap_err(),
            refused("keeps warp markers that would stand out of order or past a million beats")
        );
        assert_eq!(standing(&path), was);
        assert_eq!(kept(&far_dir), 0);
        // Every warp marker past the end of a 12 s sample (13 s at beat 26, 20 s at beat 40): the reversed sample is pinned at its
        // first frame and its last on their line, and the clip plays beats 0 to 8, seconds 0 to 4, backwards.
        let start = [
            ("LoopStart", 0.0),
            ("LoopEnd", 8.0),
            ("OutMarker", 8.0),
            ("HiddenLoopStart", 0.0),
            ("HiddenLoopEnd", 8.0),
        ];
        let (_beyond, path) = fresh(12, true, &start, &[(13.0, 26.0), (20.0, 40.0)]);
        let mut before = played(&path, 0, ClipAt::Slot(0));
        assert_eq!(before.len(), 32);
        reverse(&path).unwrap();
        before.reverse();
        assert_eq!(played(&path, 0, ClipAt::Slot(0)), before);
        let clip = clip_of(&path);
        assert_eq!(warp_of(&clip), [(0.0, 0.0), (12.0, 24.0)]);
        assert_eq!(loop_of(&clip)[..2], ["16", "24"].map(String::from));
        // A sample that starts at beat 4 (warp markers (0 s, 4), (12 s, 16)) spans beats 4 to 16 reversed too: B is 4 + 16, so the
        // loop, beats 6 to 10, goes to 10 to 14, and the markers are their own mirror.
        let four = [
            ("LoopStart", 6.0),
            ("LoopEnd", 10.0),
            ("OutMarker", 10.0),
            ("HiddenLoopStart", 6.0),
            ("HiddenLoopEnd", 10.0),
        ];
        let (_four, path) = fresh(12, true, &four, &[(0.0, 4.0), (12.0, 16.0)]);
        let mut before = played(&path, 0, ClipAt::Slot(0));
        reverse(&path).unwrap();
        before.reverse();
        assert_eq!(played(&path, 0, ClipAt::Slot(0)), before);
        let clip = clip_of(&path);
        assert_eq!(warp_of(&clip), [(0.0, 4.0), (12.0, 16.0)]);
        assert_eq!(loop_of(&clip)[..2], ["10", "14"].map(String::from));
        // An unwarped clip keeps warp markers of two tempi (2 beats a second, then 1): they are mirrored about 12 s and 16 beats.
        let whole = [("LoopStart", 0.0), ("LoopEnd", 12.0), ("OutMarker", 12.0)];
        let (_flat, path) = fresh(12, false, &whole, &[(0.0, 0.0), (4.0, 8.0), (12.0, 16.0)]);
        reverse(&path).unwrap();
        assert_eq!(
            warp_of(&clip_of(&path)),
            [(0.0, 0.0), (8.0, 8.0), (12.0, 16.0)]
        );
    }

    // 48f item 6 (DLW build ruling 2026-11-09, on 48e's delta review, F6): a BPM write checks every warp marker it carries, not only
    // the region (an unwarped clip carries its warp markers alone: 9 beats a second to 999 BPM would put one at 1 665 000 beats), and
    // keeps the loop in order where the new tempo would bring its start and end to one beat (LoopStart 3 and the next number after it,
    // carried from 960 BPM to 20, both 0.0625).
    #[test]
    fn a_bpm_write_checks_every_marker_it_carries_and_the_loops_order() {
        use crate::edit::clip_write;
        let write = |path: &str, set: Value| {
            clip_write(
                path,
                &standing(path),
                0,
                ClipAt::Slot(0),
                Some(set.as_object().unwrap()),
                None,
                None,
            )
        };
        let (dir, path) = set_file(TIDE);
        let gull = dir.0.join("gull.wav");
        std::fs::write(&gull, float_wav(96_000, 48_000)).unwrap();
        run(
            &path,
            SetAct::AudioClipMake {
                track: 0,
                file: gull.to_string_lossy().into_owned(),
                scene: None,
                start: None,
            },
        )
        .unwrap();
        with_clip(&path, 0, ClipAt::Slot(0), |clip| {
            crate::edit::set_value(clip, "IsWarped", "false").unwrap();
            put_markers(clip, &[], &[(0.0, 0.0), (100_000.0, 900_000.0)]);
        });
        let was = standing(&path);
        assert_eq!(
            write(&path, json!({"bpm": 999})).unwrap_err(),
            "At 999 BPM the clip's markers would reach more than a million beats from its sample's start, so its BPM is not set"
        );
        assert_eq!(standing(&path), was);
        let next = f64::from_bits(3.0f64.to_bits() + 1);
        assert_eq!(
            (3.0 * (20.0 / 960.0)),
            (next * (20.0 / 960.0)),
            "the two collapse"
        );
        with_clip(&path, 0, ClipAt::Slot(0), |clip| {
            crate::edit::set_value(clip, "IsWarped", "true").unwrap();
            put_markers(
                clip,
                &[
                    ("LoopStart", 3.0),
                    ("LoopEnd", next),
                    ("OutMarker", next),
                    ("HiddenLoopStart", 0.0),
                    ("HiddenLoopEnd", 16.0),
                ],
                &[(0.0, 0.0), (1.0, 16.0)],
            );
        });
        let was = standing(&path);
        assert_eq!(
            write(&path, json!({"bpm": 20})).unwrap_err(),
            "At 20 BPM two of the clip's markers would stand at the same beat, so its BPM is not set"
        );
        assert_eq!(standing(&path), was);
    }

    // 48f item 6 (DLW build ruling 2026-11-09, on 48e's delta review, F6): what a set or a kept sample is staged under is made only
    // where nothing stands there, on the machine's own volume ([`Volume`], whose `create_new` New set, Reverse, Crop and Consolidate
    // all stage through). New set's staged name is fixed, so it is met there; a kept sample's carries a count of its own.
    #[test]
    fn the_machines_volume_stages_only_where_nothing_stands() {
        let (dir, _) = set_file(TIDE);
        let set = dir.0.join("Taken.als");
        std::fs::write(staged_of(&set), b"not ours").unwrap();
        let refused = new_set(set.to_str().unwrap()).unwrap_err();
        assert!(
            refused.starts_with(&format!(
                "A set is being made at {} already (",
                set.display()
            )),
            "{refused}"
        );
        assert_eq!(std::fs::read(staged_of(&set)).unwrap(), b"not ours");
        assert!(!set.exists());
    }

    // 48f item 6 (DLW build ruling 2026-11-09, on 48e's delta review, F6): a kept sample's folder is walked before it is made, so a
    // link on the way is refused before any folder is made through it, never after.
    #[test]
    fn a_kept_folder_is_walked_before_it_is_made() {
        let (dir, _) = set_file(TIDE);
        let set = dir.0.join("Set");
        let elsewhere = dir.0.join("Elsewhere");
        std::fs::create_dir_all(&set).unwrap();
        std::fs::create_dir_all(&elsewhere).unwrap();
        std::os::unix::fs::symlink(&elsewhere, set.join("Samples")).unwrap();
        assert_eq!(
            kept_folder(&set, REVERSE_DIR, "nothing was reversed").unwrap_err(),
            "Samples beside the set is a link, so nothing is written through it: nothing was reversed"
        );
        assert_eq!(
            std::fs::read_dir(&elsewhere).unwrap().count(),
            0,
            "no folder is made where the link leads"
        );
    }

    // 48f item 7 (DLW build ruling 2026-11-09, on 48e's delta review, F7; its probe PF): what stands at a kept sample's name is opened as
    // Reverse opens a sample, once and without waiting, the open file asked what it is, and read no further than the sound: a pipe at
    // the reversed sound's name is refused in words, never waited on, and stays.
    #[test]
    fn a_kept_sample_never_waits_on_what_stands_at_its_name() {
        use sha2::{Digest, Sha256};
        use std::os::unix::fs::FileTypeExt;
        let (dir, path) = set_file(TIDE);
        let forward = pcm16(8, 1, &[1, 2, 3, 4]);
        let gull = dir.0.join("gull.wav");
        std::fs::write(&gull, &forward).unwrap();
        run(
            &path,
            SetAct::AudioClipMake {
                track: 0,
                file: gull.to_string_lossy().into_owned(),
                scene: None,
                start: None,
            },
        )
        .unwrap();
        let reversed = super::reversed_wav(&forward, "gull.wav").unwrap();
        let hash: String = Sha256::digest(&reversed)
            .iter()
            .map(|b| format!("{b:02x}"))
            .collect();
        let named = format!("{REVERSE_DIR}/gull [{}].wav", &hash[..16]);
        let pipe = dir.0.join(&named);
        std::fs::create_dir_all(pipe.parent().unwrap()).unwrap();
        assert!(std::process::Command::new("/usr/bin/mkfifo")
            .arg(&pipe)
            .status()
            .unwrap()
            .success());
        let (tx, rx) = std::sync::mpsc::channel();
        let set = path.clone();
        std::thread::spawn(move || {
            let _ = tx.send(run(
                &set,
                SetAct::ClipReverse {
                    track: 0,
                    clip: ClipAt::Slot(0),
                },
            ));
        });
        // A guard only: a read that waits on the pipe is let go by opening it for writing, so the test ends.
        let answered = match rx.recv_timeout(std::time::Duration::from_secs(30)) {
            Ok(answered) => answered,
            Err(_) => {
                let _ = std::fs::OpenOptions::new().write(true).open(&pipe);
                panic!("Reverse waited on the pipe at its kept sample's name");
            }
        };
        assert_eq!(
            answered.unwrap_err(),
            format!("{named} beside the set is no regular file (a pipe, a device or a folder), so it is not read and not replaced: nothing was reversed")
        );
        assert!(std::fs::symlink_metadata(&pipe)
            .unwrap()
            .file_type()
            .is_fifo());
        // What stands at the name is read no further than one byte past the sound: enough to tell it from another.
        let ten = dir.0.join("ten.bin");
        std::fs::write(&ten, b"0123456789").unwrap();
        assert_eq!(read_unwaiting(&ten, 3).unwrap().unwrap(), b"0123");
        assert_eq!(read_unwaiting(&ten, 10).unwrap().unwrap(), b"0123456789");
    }

    // 48e item 7 (DLW build ruling 2026-11-09, on #944's review, M6): a kept sample is made only where nothing stands at its name;
    // what stands there is named and never written over, and the staged name it was written under is taken away either way.
    #[test]
    fn a_kept_sample_is_put_only_where_nothing_stands() {
        let (dir, _) = set_file(TIDE);
        let staged = |d: &std::path::Path| {
            std::fs::read_dir(d)
                .unwrap()
                .filter(|e| {
                    e.as_ref()
                        .unwrap()
                        .file_name()
                        .to_string_lossy()
                        .contains(".oi-keep-")
                })
                .count()
        };
        let stands = dir.0.join("x.wav");
        std::fs::write(&stands, b"another sound").unwrap();
        assert_eq!(
            put_new(&stands, b"a sound", "x.wav", "nothing was kept").unwrap_err(),
            "x.wav beside the set holds another sound: nothing was kept"
        );
        assert_eq!(std::fs::read(&stands).unwrap(), b"another sound");
        assert_eq!(staged(&dir.0), 0, "no staged copy is left behind");
        let new = dir.0.join("y.wav");
        put_new(&new, b"a sound", "y.wav", "nothing was kept").unwrap();
        assert_eq!(std::fs::read(&new).unwrap(), b"a sound");
        assert_eq!(staged(&dir.0), 0, "no staged copy is left behind");
    }

    // 48e item 7 (DLW build ruling 2026-11-09, on #944's review, M6): the folder a sample is kept in stands inside the set's folder by
    // both canonical paths. In the product its names are fixed (Samples/Processed/…), so only a folder swapped for a link between the
    // walk and the check meets this refusal; here a folder that climbs out of the set's folder, standing already, meets it.
    #[test]
    fn a_kept_folder_outside_the_sets_folder_is_refused() {
        let (dir, _) = set_file(TIDE);
        let set = dir.0.join("Set");
        std::fs::create_dir_all(&set).unwrap();
        std::fs::create_dir_all(dir.0.join("Beside")).unwrap();
        assert_eq!(
            kept_folder(&set, "../Beside", "nothing was reversed").unwrap_err(),
            "../Beside does not stand inside the set's folder, so nothing is written there: nothing was reversed"
        );
        assert_eq!(
            kept_folder(&set, "Samples/Processed/Reverse", "nothing was reversed").unwrap(),
            set.join("Samples/Processed/Reverse")
        );
    }

    // 48e items 3, 11 and 13 (DLW build ruling 2026-11-09, on #944's review, M2, L4, L6): Reverse reads the file the clip plays as the
    // engine does (its RelativePath from the set's folder where that is a file, else its Path, where that is one), only a regular
    // file, and never waits on one: a pipe, a device and a folder are refused in words; a file that is gone is said to be gone; and a
    // set that changed since it was read is refused before any sample is read.
    #[test]
    fn reverse_reads_only_a_regular_file_the_clip_plays_and_never_waits_on_one() {
        let (dir, path) = set_file(TIDE);
        let a = dir.0.join("a.wav");
        std::fs::write(&a, pcm16(8, 1, &[1, 2, 3, 4])).unwrap();
        let b = dir.0.join("b.wav");
        std::fs::write(&b, pcm16(8, 1, &[9, 9, 9, 9])).unwrap();
        run(
            &path,
            SetAct::AudioClipMake {
                track: 0,
                file: a.to_string_lossy().into_owned(),
                scene: None,
                start: None,
            },
        )
        .unwrap();
        let names = |relative: &str, whole: &str| {
            with_clip(&path, 0, ClipAt::Slot(0), |clip| {
                let file = clip
                    .child_mut("SampleRef")
                    .unwrap()
                    .child_mut("FileRef")
                    .unwrap();
                crate::edit::set_value(file, "RelativePath", relative).unwrap();
                crate::edit::set_value(file, "Path", whole).unwrap();
            })
        };
        // Its RelativePath first, as the engine plays it, though its Path names another file.
        names("a.wav", &b.to_string_lossy());
        let answer = run(
            &path,
            SetAct::ClipReverse {
                track: 0,
                clip: ClipAt::Slot(0),
            },
        )
        .unwrap();
        let wav = std::fs::read(dir.0.join(answer["sample"]["path"].as_str().unwrap())).unwrap();
        assert_eq!(&wav[44..], &[4, 0, 3, 0, 2, 0, 1, 0]);
        let reverse = || {
            let (p, act) = (
                path.clone(),
                SetAct::ClipReverse {
                    track: 0,
                    clip: ClipAt::Slot(0),
                },
            );
            let (tx, rx) = std::sync::mpsc::channel();
            std::thread::spawn(move || {
                let _ = tx.send(run(&p, act));
            });
            // A guard only: a read that waits on a pipe would hold the set's write gate; it is opened for writing so the test ends.
            match rx.recv_timeout(std::time::Duration::from_secs(30)) {
                Ok(answer) => answer,
                Err(_) => {
                    let _ = std::fs::OpenOptions::new()
                        .write(true)
                        .open(dir.0.join("pipe"));
                    panic!("Reverse waited on the file it was to read");
                }
            }
        };
        // A file that is gone.
        names("gone.wav", "");
        assert_eq!(
            reverse().unwrap_err(),
            "a plays \"gone.wav\", which is not there, so there is no sound to reverse"
        );
        // A pipe, a device and a folder are no regular file: none is read, and nothing waits.
        let pipe = dir.0.join("pipe");
        assert!(std::process::Command::new("/usr/bin/mkfifo")
            .arg(&pipe)
            .status()
            .unwrap()
            .success());
        for (named, shown) in [
            (pipe.to_string_lossy().into_owned(), "pipe"),
            ("/dev/null".to_string(), "null"),
            (
                dir.0.to_string_lossy().into_owned(),
                dir.0.file_name().unwrap().to_str().unwrap(),
            ),
        ] {
            names("", &named);
            assert_eq!(
                reverse().unwrap_err(),
                format!("a plays \"{shown}\", which is no regular file (a pipe, a device or a folder), so it is not read and there is no sound to reverse")
            );
        }
        // A set that changed since it was read is refused before the sample is read: here, before its file is found gone.
        names("gone.wav", "");
        assert_eq!(
            super::act(&path, "sha256:stale", &SetAct::ClipReverse { track: 0, clip: ClipAt::Slot(0) }).unwrap_err(),
            "The set changed since it was read (Live may have saved it): read it again and make the change on what stands"
        );
    }

    // 48e items 5, 6, 9, 10 and 14 (DLW build ruling 2026-11-09, on #944's review, M4, M5, L2, L3, L7): Reverse refuses what the
    // engine would not play, in the engine's words: a WAV whose format is neither integer PCM nor IEEE float (by its tag, or an
    // extensible one's sub-format), whose depth the engine does not read, or whose frames are not the size its channels and bits
    // make; an AIFF it would write as such a WAV, or at a rate above 768 kHz; and a file that holds no sound. It finds the chunks it
    // needs within 512, as a sample's head is read, writes the reversed WAV into one buffer of its exact size, pads an odd sound,
    // turns an AIFF's 8-bit samples unsigned as a WAV keeps them, and reads no file past its bound.
    #[test]
    fn reverse_refuses_what_the_engine_would_not_play_and_keeps_its_bounds() {
        let refused = |wav: &[u8], why: &str| {
            assert_eq!(
                super::reversed_wav(wav, "x.wav").unwrap_err(),
                format!("x.wav is not a WAV the engine plays ({why}), so nothing was reversed")
            )
        };
        refused(
            &wav_of(&fmt16(2, 1, 8000, 8, 4), &[], &[0; 16]),
            "WAV format 2 is not read: integer PCM or IEEE float",
        );
        refused(
            &wav_of(&fmt16(1, 1, 8000, 4, 32), &[], &[0; 16]),
            "32-bit integer WAV is not read: for 32 bit, only floating point samples are, as Live reads them",
        );
        refused(
            &wav_of(&fmt16(3, 1, 8000, 8, 64), &[], &[0; 16]),
            "64-bit float WAV is not read: integer at 8, 16 or 24 bit, or float at 32",
        );
        // The engine reads no block align, so a wrong one is said as what it is, not as a WAV the engine does not play (48f item 8).
        let misframed = |wav: &[u8], why: &str| {
            assert_eq!(
                super::reversed_wav(wav, "x.wav").unwrap_err(),
                format!("x.wav's frames are not the size its channels and bits make ({why}), so nothing was reversed")
            )
        };
        misframed(
            &wav_of(&fmt16(1, 2, 8000, 2, 16), &[], &[1, 0, 2, 0, 3, 0, 4, 0]),
            "each frame is 2 bytes, where 2 channels of 16 bits take 4",
        );
        misframed(
            &wav_of(&fmt16(1, 1, 8000, 0, 16), &[], &[1, 0, 2, 0]),
            "each frame is 0 bytes, where 1 channel of 16 bits takes 2",
        );
        // An extensible WAV is read by its sub-format: PCM is reversed, its own format kept; ADPCM is not.
        let extensible = |sub: u16| {
            let mut fmt = fmt16(0xFFFE, 1, 8000, 2, 16);
            fmt.extend_from_slice(&22u16.to_le_bytes());
            fmt.extend_from_slice(&16u16.to_le_bytes());
            fmt.extend_from_slice(&4u32.to_le_bytes());
            fmt.extend_from_slice(&sub.to_le_bytes());
            fmt.extend_from_slice(&[0, 0, 0, 0, 0x10, 0, 0x80, 0, 0, 0xAA, 0, 0x38, 0x9B, 0x71]);
            wav_of(&fmt, &[], &[1, 0, 2, 0, 3, 0])
        };
        let pcm = super::reversed_wav(&extensible(1), "x.wav").unwrap();
        assert_eq!(&pcm[12..20], b"fmt \x28\0\0\0", "its own 40-byte format");
        assert_eq!(&pcm[pcm.len() - 6..], &[3, 0, 2, 0, 1, 0]);
        assert_eq!(pcm.capacity(), pcm.len(), "one buffer, of its exact size");
        refused(
            &extensible(2),
            "WAV format 2 is not read: integer PCM or IEEE float",
        );
        // No frames: no sound.
        assert_eq!(
            super::reversed_wav(&wav_of(&fmt16(1, 1, 8000, 2, 16), &[], &[]), "x.wav").unwrap_err(),
            "x.wav holds no sound, so nothing was reversed"
        );
        // An odd sound is padded, and the RIFF size counts the pad.
        let odd = super::reversed_wav(&wav_of(&fmt16(1, 1, 8000, 1, 8), &[], &[1, 2, 3]), "x.wav")
            .unwrap();
        assert_eq!(&odd[odd.len() - 4..], &[3, 2, 1, 0]);
        assert_eq!(
            u32::from_le_bytes(odd[4..8].try_into().unwrap()) as usize,
            odd.len() - 8
        );
        assert_eq!(u32::from_le_bytes(odd[40..44].try_into().unwrap()), 3);
        // Past 512 chunks the walk stops, as a sample's head is read.
        let empty: Vec<(&[u8; 4], Vec<u8>)> = (0..600).map(|_| (b"junk", Vec::new())).collect();
        let mut late = b"RIFF\0\0\0\0WAVE".to_vec();
        for (id, _) in &empty {
            late.extend_from_slice(*id);
            late.extend_from_slice(&0u32.to_le_bytes());
        }
        late.extend_from_slice(&wav_of(&fmt16(1, 1, 8000, 2, 16), &[], &[1, 0])[12..]);
        assert_eq!(
            super::reversed_wav(&late, "x.wav").unwrap_err(),
            "x.wav has more than 512 chunks before its fmt and data chunks are found, so nothing was reversed"
        );
        // An AIFF's 8-bit samples (signed) are written as a WAV keeps them (unsigned), last first.
        let eight =
            super::reversed_wav(&aiff_of(1, 8, 8000, &[0x80, 0x00, 0x7F]), "x.aif").unwrap();
        assert_eq!(&eight[20..36], &fmt16(1, 1, 8000, 1, 8)[..]);
        assert_eq!(&eight[44..], &[0xFF, 0x80, 0x00, 0]);
        // An AIFF it would write as a WAV the engine does not play, or above 768 kHz (3 GHz here), is refused, never a panic.
        assert_eq!(
            super::reversed_wav(&aiff_of(1, 32, 8000, &[0; 8]), "x.aif").unwrap_err(),
            "x.aif would be reversed into a WAV the engine does not play (32-bit integer WAV is not read: for 32 bit, only floating point samples are, as Live reads them), so nothing was reversed"
        );
        for rate in [768_001, 3_000_000_000] {
            assert_eq!(
                super::reversed_wav(&aiff_of(2, 16, rate, &[0; 8]), "x.aif").unwrap_err(),
                format!("x.aif keeps {rate} samples a second, more than the 768000 Reverse writes, so nothing was reversed")
            );
        }
        // A file past Reverse's bound (512 MiB) is refused unread: here one that holds a byte more, with nothing written in it.
        let (dir, path) = set_file(TIDE);
        let a = dir.0.join("a.wav");
        std::fs::write(&a, pcm16(8, 1, &[1, 2, 3, 4])).unwrap();
        run(
            &path,
            SetAct::AudioClipMake {
                track: 0,
                file: a.to_string_lossy().into_owned(),
                scene: None,
                start: None,
            },
        )
        .unwrap();
        std::fs::File::options()
            .write(true)
            .open(&a)
            .unwrap()
            .set_len(512 * 1024 * 1024 + 1)
            .unwrap();
        assert_eq!(
            run(
                &path,
                SetAct::ClipReverse {
                    track: 0,
                    clip: ClipAt::Slot(0)
                }
            )
            .unwrap_err(),
            "\"a.wav\" weighs more than Reverse reads (512 MiB), so nothing was reversed"
        );
    }

    // 48e items 7 and 14 (DLW build ruling 2026-11-09, on #944's review, M6, L7): a sample an act keeps beside the set (Reverse's,
    // Crop's, Consolidate's) never writes over a file and never writes outside the set's folder. A file at its name that cannot be
    // read is refused, never replaced; a link on the way to its folder is refused, and nothing is written through it. A reversed
    // file is named after the sample, its own hash left off.
    #[test]
    fn a_kept_sample_never_writes_over_a_file_nor_through_a_link() {
        use sha2::{Digest, Sha256};
        use std::os::unix::fs::PermissionsExt;
        let (dir, path) = set_file(TIDE);
        let forward = pcm16(8, 1, &[1, 2, 3, 4]);
        let gull = dir.0.join("gull.wav");
        std::fs::write(&gull, &forward).unwrap();
        run(
            &path,
            SetAct::AudioClipMake {
                track: 0,
                file: gull.to_string_lossy().into_owned(),
                scene: None,
                start: None,
            },
        )
        .unwrap();
        let hash = |wav: &[u8]| -> String {
            Sha256::digest(wav)
                .iter()
                .map(|b| format!("{b:02x}"))
                .collect::<String>()[..16]
                .to_string()
        };
        // Named after the sample: gull [<its hash>].wav, then, reversed again, gull [<the next hash>].wav (never two hashes).
        let reversed = super::reversed_wav(&forward, "gull.wav").unwrap();
        let reverse = || {
            run(
                &path,
                SetAct::ClipReverse {
                    track: 0,
                    clip: ClipAt::Slot(0),
                },
            )
        };
        let first = reverse().unwrap()["sample"]["path"]
            .as_str()
            .unwrap()
            .to_string();
        assert_eq!(
            first,
            format!("Samples/Processed/Reverse/gull [{}].wav", hash(&reversed))
        );
        let again = reverse().unwrap()["sample"]["path"]
            .as_str()
            .unwrap()
            .to_string();
        assert_eq!(
            again,
            format!("Samples/Processed/Reverse/gull [{}].wav", hash(&forward))
        );
        // Back on gull.wav: a file at the reversed sound's name that cannot be read stands, unread and unreplaced.
        with_clip(&path, 0, ClipAt::Slot(0), |clip| {
            let file = clip
                .child_mut("SampleRef")
                .unwrap()
                .child_mut("FileRef")
                .unwrap();
            crate::edit::set_value(file, "RelativePath", "gull.wav").unwrap();
        });
        let kept = dir.0.join(&first);
        std::fs::write(&kept, b"another sound").unwrap();
        std::fs::set_permissions(&kept, std::fs::Permissions::from_mode(0o000)).unwrap();
        let refused = reverse().unwrap_err();
        std::fs::set_permissions(&kept, std::fs::Permissions::from_mode(0o644)).unwrap();
        assert_eq!(std::fs::read(&kept).unwrap(), b"another sound");
        assert!(
            refused.starts_with(&format!("{first} beside the set could not be read ("))
                && refused.ends_with("), so it is not replaced: nothing was reversed"),
            "{refused}"
        );
        // A link at the reversed sound's name: nothing is read or written through it.
        let target = dir.0.join("target.wav");
        std::fs::write(&target, b"another sound").unwrap();
        std::fs::remove_file(&kept).unwrap();
        std::os::unix::fs::symlink(&target, &kept).unwrap();
        assert_eq!(
            reverse().unwrap_err(),
            format!("{first} beside the set is a link, so nothing is written through it: nothing was reversed")
        );
        assert_eq!(std::fs::read(&target).unwrap(), b"another sound");
        // A linked Samples folder: nothing is written through it, by Reverse or by Crop.
        let (elsewhere, _) = set_file(TIDE);
        std::fs::remove_dir_all(dir.0.join("Samples")).unwrap();
        std::os::unix::fs::symlink(&elsewhere.0, dir.0.join("Samples")).unwrap();
        let listing = |d: &std::path::Path| {
            let mut names: Vec<String> = std::fs::read_dir(d)
                .unwrap()
                .map(|e| e.unwrap().file_name().to_string_lossy().into_owned())
                .collect();
            names.sort();
            names
        };
        let there = listing(&elsewhere.0);
        assert_eq!(
            reverse().unwrap_err(),
            "Samples beside the set is a link, so nothing is written through it: nothing was reversed"
        );
        assert_eq!(
            crop_audio(&path, &standing(&path), 0, ClipAt::Slot(0), None, &forward).unwrap_err(),
            "Samples beside the set is a link, so nothing is written through it: nothing was cropped"
        );
        assert_eq!(
            listing(&elsewhere.0),
            there,
            "nothing was written where the link leads"
        );
    }

    #[test]
    fn a_sample_is_read_by_its_header_and_first_16_kib_never_whole() {
        struct Counting<R> {
            inner: R,
            read: usize,
        }
        impl<R: std::io::Read> std::io::Read for Counting<R> {
            fn read(&mut self, buf: &mut [u8]) -> std::io::Result<usize> {
                let n = self.inner.read(buf)?;
                self.read += n;
                Ok(n)
            }
        }
        impl<R: std::io::Seek> std::io::Seek for Counting<R> {
            fn seek(&mut self, to: std::io::SeekFrom) -> std::io::Result<u64> {
                self.inner.seek(to)
            }
        }
        let counted = |bytes: &[u8]| {
            let mut file = Counting {
                inner: std::io::Cursor::new(bytes.to_vec()),
                read: 0,
            };
            let read = sample_head(&mut file, bytes.len() as u64, "gull.wav");
            (read, file.read)
        };
        // A two-second stereo float WAV (768 000 bytes of sound) with a LIST chunk after its sound, as recorders write one.
        let mut wav = float_wav(96_000, 48_000);
        wav.extend_from_slice(b"LIST");
        wav.extend_from_slice(&4u32.to_le_bytes());
        wav.extend_from_slice(b"INFO");
        let riff = (wav.len() - 8) as u32;
        wav[4..8].copy_from_slice(&riff.to_le_bytes());
        let (read, bytes_read) = counted(&wav);
        let (shape, head) = read.unwrap();
        assert_eq!(shape, (2, 48_000, 96_000));
        assert_eq!(
            head,
            wav[..16 * 1024],
            "the first 16 KiB, which OriginalCrc sums"
        );
        assert!(
            bytes_read <= 16 * 1024 + 1024,
            "{bytes_read} of the file's {} bytes were read",
            wav.len()
        );
        // An AIFF alike: its COMM, then past its SSND unread.
        let tide = aiff(441_000, 44_100);
        let (read, bytes_read) = counted(&tide);
        assert_eq!(read.unwrap().0, (1, 44_100, 441_000));
        assert!(
            bytes_read <= 16 * 1024 + 1024,
            "{bytes_read} bytes were read"
        );
        // Refused in words through the act: a data chunk that claims more than the file holds, and an RF64 file.
        let (dir, path) = set_file(TIDE);
        let refused = |file: &std::path::Path| {
            run(
                &path,
                SetAct::AudioClipMake {
                    track: 0,
                    file: file.to_string_lossy().into_owned(),
                    scene: None,
                    start: None,
                },
            )
            .unwrap_err()
        };
        let over = dir.0.join("over.wav");
        let whole = float_wav(1_000, 48_000);
        std::fs::write(&over, &whole[..whole.len() - 400]).unwrap();
        assert_eq!(
            refused(&over),
            "\"over.wav\" says its sound (its data chunk) is 8000 bytes, but the file holds 7600 after it, so no clip is made of it"
        );
        let mut long = b"RF64".to_vec();
        long.extend_from_slice(&u32::MAX.to_le_bytes());
        long.extend_from_slice(b"WAVEds64");
        long.extend_from_slice(&28u32.to_le_bytes());
        long.extend_from_slice(&[0; 28]);
        long.extend_from_slice(&whole[12..]);
        let rf64 = dir.0.join("long.wav");
        std::fs::write(&rf64, &long).unwrap();
        assert_eq!(
            refused(&rf64),
            "\"long.wav\" is an RF64 file, which the engine does not play, so no clip is made of it"
        );
        assert!(
            slots(&reread(&path).1, 0).iter().all(Option::is_none),
            "nothing was made by a refusal"
        );
    }
    // DLW build ruling 2026-11-09, 46c item 10: the chunk walk's edges, each with a counting reader. An odd chunk is padded to an even
    // length; an empty chunk is stepped past (eight bytes, never in place); a `fmt ` that claims more than its shape is read for 512
    // bytes at most; and the walk reads 512 chunk headers at most, then says so.
    #[test]
    fn the_chunk_walk_pads_odd_chunks_steps_past_empty_ones_bounds_a_huge_fmt_and_stops_at_512_chunks(
    ) {
        struct Counting<R> {
            inner: R,
            read: usize,
            headers: usize,
        }
        impl<R: std::io::Read> std::io::Read for Counting<R> {
            fn read(&mut self, buf: &mut [u8]) -> std::io::Result<usize> {
                let n = self.inner.read(buf)?;
                self.read += n;
                Ok(n)
            }
        }
        impl<R: std::io::Seek> std::io::Seek for Counting<R> {
            // The walk seeks to each chunk header it reads, and nowhere else.
            fn seek(&mut self, to: std::io::SeekFrom) -> std::io::Result<u64> {
                self.headers += 1;
                self.inner.seek(to)
            }
        }
        let counted = |bytes: &[u8]| {
            let mut file = Counting {
                inner: std::io::Cursor::new(bytes.to_vec()),
                read: 0,
                headers: 0,
            };
            let read =
                sample_head(&mut file, bytes.len() as u64, "gull.wav").map(|(shape, _)| shape);
            (read, file.read, file.headers)
        };
        let chunk = |id: &[u8; 4], body: &[u8]| {
            let mut out = id.to_vec();
            out.extend_from_slice(&(body.len() as u32).to_le_bytes());
            out.extend_from_slice(body);
            if body.len() % 2 == 1 {
                out.push(0);
            }
            out
        };
        // A WAV of `before` chunks, then its own (fmt and data, as float_wav writes them), the RIFF size made whole.
        let wav = |before: &[Vec<u8>], own: &[u8]| {
            let mut out = b"RIFF\0\0\0\0WAVE".to_vec();
            for c in before {
                out.extend_from_slice(c);
            }
            out.extend_from_slice(own);
            let riff = (out.len() - 8) as u32;
            out[4..8].copy_from_slice(&riff.to_le_bytes());
            out
        };
        let whole = float_wav(1_000, 48_000);
        let own = &whole[12..];
        let shape = || Ok::<SampleShape, String>((2, 48_000, 1_000));
        // Odd: a three-byte chunk and its pad byte; the next header is read after the pad, not inside it.
        let odd = wav(&[chunk(b"junk", b"odd"), chunk(b"bext", &[7; 5])], own);
        assert_eq!(odd.len(), whole.len() + (8 + 4) + (8 + 6));
        assert_eq!(
            counted(&odd).0,
            shape(),
            "odd chunks are padded to an even length"
        );
        // Empty: 300 chunks of no body are stepped past, eight bytes each, and the sound is still found.
        let empty: Vec<Vec<u8>> = (0..300).map(|_| chunk(b"junk", b"")).collect();
        let (read, _, headers) = counted(&wav(&empty, own));
        assert_eq!(
            (read, headers),
            (shape(), 302),
            "each empty chunk is one header, never read twice"
        );
        // Nothing but empty chunks: the walk ends at its cap and says so, having read 512 headers and no more.
        let only: Vec<Vec<u8>> = (0..2_000).map(|_| chunk(b"junk", b"")).collect();
        let (read, bytes_read, headers) = counted(&wav(&only, b""));
        assert_eq!(
            read,
            Err("gull.wav has more than 512 chunks before its fmt and data chunks are found, so no clip is made of it".into())
        );
        assert_eq!(headers, 512);
        assert!(
            bytes_read <= 16 * 1024 + 512 * 8,
            "{bytes_read} bytes were read"
        );
        // A huge fmt: one that claims 4000 bytes (its shape in the first 16) is read for 512, then stepped past to the sound; one
        // that claims more than the file holds is read for what the file holds, at most 512, and the walk ends at the file's end.
        let mut fmt = whole[20..36].to_vec();
        fmt.resize(4_000, 0);
        let mut big = chunk(b"fmt ", &fmt);
        big.extend_from_slice(&whole[36..]);
        let big = wav(&[], &big);
        let (read, bytes_read, _) = counted(&big);
        assert_eq!(read, shape());
        let head = |file: &[u8]| file.len().min(16 * 1024);
        assert!(
            bytes_read <= head(&big) + 2 * 8 + 512,
            "the fmt body was read for 512 bytes at most: {bytes_read}"
        );
        let mut huge = b"fmt ".to_vec();
        huge.extend_from_slice(&0xFFFF_FFF0u32.to_le_bytes());
        huge.extend_from_slice(&whole[20..]);
        let huge = wav(&[], &huge);
        let (read, bytes_read, _) = counted(&huge);
        assert_eq!(
            read,
            Err("gull.wav is not a WAV or AIFF file, the sound the engine plays, so no clip is made of it".into())
        );
        assert!(
            bytes_read <= head(&huge) + 8 + 512,
            "{bytes_read} bytes were read"
        );
        // The cap, at its edge: 510 chunks before fmt and data walk 512 headers and find the sound; 511 do not.
        let at: Vec<Vec<u8>> = (0..510).map(|_| chunk(b"junk", b"")).collect();
        assert_eq!(
            counted(&wav(&at, own)).0,
            shape(),
            "fmt and data are the 511th and 512th chunks"
        );
        let over: Vec<Vec<u8>> = (0..511).map(|_| chunk(b"junk", b"")).collect();
        assert_eq!(
            counted(&wav(&over, own)).0,
            Err("gull.wav has more than 512 chunks before its fmt and data chunks are found, so no clip is made of it".into())
        );
    }

    // Round 48d item 2 (DLW build ruling 2026-11-09, round 48; LN12, LN13): an audio clip's transients, its warp markers and
    // Quantize on its transients. Live 12's manual, Audio Clips: Live finds a sample's transients on analysis and shows them as
    // markers over its waveform; a warp marker pins a point of the sample to a beat, and dragging it moves where that point lands in
    // time; Quantize on an audio clip moves its transients toward the grid, by the Amount set, through warp markers.

    /// A 16-bit mono WAV of `seconds` at `rate`, silent but for a click at each of `at` (seconds): a 1 kHz tone from its peak,
    /// dying away over a few milliseconds.
    fn click_frames(seconds: f64, rate: u32, at: &[f64]) -> Vec<i16> {
        let frames = (seconds * f64::from(rate)) as usize;
        let mut sound = vec![0i16; frames];
        for &t in at {
            let from = (t * f64::from(rate)).round() as usize;
            for i in 0..(rate as usize / 100) {
                if let Some(s) = sound.get_mut(from + i) {
                    let x = 0.8
                        * (2.0 * std::f64::consts::PI * 1000.0 * i as f64 / f64::from(rate)).cos()
                        * (-(i as f64) / (f64::from(rate) * 0.003)).exp();
                    *s = (x * 32767.0) as i16;
                }
            }
        }
        sound
    }
    /// A plain WAV of format `format` (1 integer, 3 float), its `fmt ` chunk then its `data`.
    fn pcm_wav(format: u16, channels: u16, rate: u32, bits: u16, data: &[u8]) -> Vec<u8> {
        let block = channels * bits / 8;
        let mut out = b"RIFF".to_vec();
        out.extend_from_slice(&(36 + data.len() as u32).to_le_bytes());
        out.extend_from_slice(b"WAVEfmt ");
        out.extend_from_slice(&16u32.to_le_bytes());
        out.extend_from_slice(&format.to_le_bytes());
        out.extend_from_slice(&channels.to_le_bytes());
        out.extend_from_slice(&rate.to_le_bytes());
        out.extend_from_slice(&(rate * u32::from(block)).to_le_bytes());
        out.extend_from_slice(&block.to_le_bytes());
        out.extend_from_slice(&bits.to_le_bytes());
        out.extend_from_slice(b"data");
        out.extend_from_slice(&(data.len() as u32).to_le_bytes());
        out.extend_from_slice(data);
        out
    }
    fn click_wav(seconds: f64, rate: u32, at: &[f64]) -> Vec<u8> {
        let data: Vec<u8> = click_frames(seconds, rate, at)
            .iter()
            .flat_map(|s| s.to_le_bytes())
            .collect();
        pcm_wav(1, 1, rate, 16, &data)
    }
    /// Seconds at 92 BPM, the beats Tide's own tempo puts them on.
    fn at_92(beats: &[f64]) -> Vec<f64> {
        beats.iter().map(|b| b * 60.0 / 92.0).collect()
    }

    #[test]
    fn a_samples_transients_are_found_alike_in_every_encoding_the_engine_plays() {
        let at = [0.25, 0.5, 1.2, 1.25];
        let frames = click_frames(2.0, 48_000, &at);
        let pcm16: Vec<u8> = frames.iter().flat_map(|s| s.to_le_bytes()).collect();
        let pcm24: Vec<u8> = frames
            .iter()
            .flat_map(|s| {
                let v = i32::from(*s) << 8;
                [v as u8, (v >> 8) as u8, (v >> 16) as u8]
            })
            .collect();
        let float: Vec<u8> = frames
            .iter()
            .flat_map(|s| (f32::from(*s) / 32768.0).to_le_bytes())
            .collect();
        // Stereo: the click on the left only, the right silent.
        let stereo: Vec<u8> = frames
            .iter()
            .flat_map(|s| [s.to_le_bytes(), 0i16.to_le_bytes()].concat())
            .collect();
        let mut aif = aiff(frames.len() as u32, 48_000);
        let n = aif.len();
        let big: Vec<u8> = frames.iter().flat_map(|s| s.to_be_bytes()).collect();
        aif[n - big.len()..].copy_from_slice(&big);
        let near = |found: &[f64]| {
            found.len() == at.len() && found.iter().zip(at).all(|(f, t)| (f - t).abs() < 0.000_5)
        };
        for (name, bytes) in [
            ("16-bit", pcm_wav(1, 1, 48_000, 16, &pcm16)),
            ("24-bit", pcm_wav(1, 1, 48_000, 24, &pcm24)),
            ("float", pcm_wav(3, 1, 48_000, 32, &float)),
            ("stereo", pcm_wav(1, 2, 48_000, 16, &stereo)),
            ("AIFF", aif.clone()),
        ] {
            let read = sample_sound(&bytes, name).unwrap();
            assert!(near(&read.transients), "{name}: {:?}", read.transients);
            assert!(
                (read.seconds - 2.0).abs() < 1e-9,
                "{name}: {}",
                read.seconds
            );
            assert_eq!(read.wave.len(), WAVE_BINS, "{name}");
            assert!(
                read.wave.iter().all(|p| (0.0..=1.0).contains(p)),
                "{name}: each bin is a peak, 0 to 1"
            );
            // The bin a click falls in peaks; a silent stretch is flat.
            let bin = |t: f64| (t / 2.0 * WAVE_BINS as f64) as usize;
            assert!(
                read.wave[bin(0.25)] > 0.3,
                "{name}: {}",
                read.wave[bin(0.25)]
            );
            assert_eq!(read.wave[bin(1.0)], 0.0, "{name}");
        }
        // Silence has no transient; what is not a WAV or AIFF is refused in words.
        assert!(
            sample_sound(&pcm_wav(1, 1, 48_000, 16, &[0; 9600]), "hush.wav")
                .unwrap()
                .transients
                .is_empty()
        );
        assert_eq!(
            sample_sound(b"not a sound at all", "notes.txt").unwrap_err(),
            "notes.txt is not a WAV or AIFF file, the sound the engine plays, so its transients are not shown"
        );
    }

    #[test]
    fn an_audio_clips_reading_carries_its_transients_waveform_and_warp_markers() {
        use crate::edit::clip_json;
        let (dir, path) = set_file(TIDE);
        let gull = dir.0.join("Samples/Imported/gull.wav");
        std::fs::create_dir_all(gull.parent().unwrap()).unwrap();
        let clicks = at_92(&[1.1, 2.05, 3.0, 3.6]);
        std::fs::write(&gull, click_wav(4.0, 48_000, &clicks)).unwrap();
        run(
            &path,
            SetAct::AudioClipMake {
                track: 0,
                file: gull.to_string_lossy().into_owned(),
                scene: None,
                start: None,
            },
        )
        .unwrap();
        let c = clip_json(&path, 0, ClipAt::Slot(0)).unwrap()["clip"].clone();
        let found: Vec<f64> = c["transients"]
            .as_array()
            .unwrap_or_else(|| panic!("no transients: {c}"))
            .iter()
            .map(|t| t.as_f64().unwrap())
            .collect();
        assert_eq!(found.len(), 4, "{found:?}");
        assert!(
            found
                .iter()
                .zip(&clicks)
                .all(|(f, t)| (f - t).abs() < 0.000_5),
            "{found:?}"
        );
        assert_eq!(c["sampleSeconds"], json!(4.0));
        assert_eq!(c["wave"].as_array().map(Vec::len), Some(WAVE_BINS));
        assert_eq!(
            c["warpMarkers"],
            json!([[0.0, 0.0], [0.03125 * 60.0 / 92.0, 0.03125]]),
            "the pair a made clip carries, at the set's tempo"
        );
        // Read again from what is remembered of it, and anew once the file changes (its length the same, its time another).
        let again = clip_json(&path, 0, ClipAt::Slot(0)).unwrap()["clip"].clone();
        assert_eq!(again["transients"], c["transients"]);
        std::fs::write(&gull, click_wav(4.0, 48_000, &[2.0])).unwrap();
        std::fs::File::options()
            .write(true)
            .open(&gull)
            .unwrap()
            .set_modified(
                std::time::SystemTime::UNIX_EPOCH + std::time::Duration::from_secs(1_000_000),
            )
            .unwrap();
        let changed = clip_json(&path, 0, ClipAt::Slot(0)).unwrap()["clip"].clone();
        assert_eq!(
            changed["transients"].as_array().map(Vec::len),
            Some(1),
            "{}",
            changed["transients"]
        );
        // A file that is no sound is refused in words that quote its name (round 54 item 3).
        std::fs::write(&gull, "a field note").unwrap();
        let unread = clip_json(&path, 0, ClipAt::Slot(0)).unwrap()["clip"].clone();
        assert_eq!(
            unread["sampleRefused"],
            "\"gull.wav\" is not a WAV or AIFF file, the sound the engine plays, so its transients are not shown"
        );
        // A pipe at its name is no regular file: the reading never opens it, so nothing waits on it (48e item 3, as Reverse reads).
        std::fs::remove_file(&gull).unwrap();
        assert!(std::process::Command::new("/usr/bin/mkfifo")
            .arg(&gull)
            .status()
            .unwrap()
            .success());
        let (tx, rx) = std::sync::mpsc::channel();
        let p = path.clone();
        std::thread::spawn(move || {
            let _ = tx.send(clip_json(&p, 0, ClipAt::Slot(0)));
        });
        // A guard only: a reading that waits on the pipe is let go by opening it for writing, so the test ends.
        let piped = match rx.recv_timeout(std::time::Duration::from_secs(30)) {
            Ok(answer) => answer.unwrap()["clip"].clone(),
            Err(_) => {
                let _ = std::fs::OpenOptions::new().write(true).open(&gull);
                panic!("the clip's reading waited on the pipe it plays");
            }
        };
        assert_eq!(piped["transients"], Value::Null);
        assert_eq!(
            piped["sampleRefused"],
            "gull plays \"gull.wav\", which is no regular file (a pipe, a device or a folder), so it is not read and there is no sound to show"
        );
        // A clip whose file is gone still reads, and says why it shows no transients (48e item 11's words).
        std::fs::remove_file(&gull).unwrap();
        let gone = clip_json(&path, 0, ClipAt::Slot(0)).unwrap()["clip"].clone();
        assert_eq!(gone["transients"], Value::Null);
        assert_eq!(
            gone["sampleRefused"],
            "gull plays \"gull.wav\", which is not there, so there is no sound to show"
        );
        assert_eq!(gone["name"], "gull");
    }

    /// DLW build ruling 2026-11-09, 48g item 4 (#948's review, finding 4): what a sample's bytes make is kept by its key, the
    /// refusal of a file the engine does not play as a reading is, so it is not read whole again while its key stands; a read that
    /// fails is not kept.
    #[test]
    fn a_samples_refusal_is_kept_by_its_key_as_its_reading_is() {
        let kept: SampleCache = std::sync::Mutex::new(Vec::new());
        let reads = std::cell::Cell::new(0);
        let key =
            |len: u64| -> SampleKey { (std::path::PathBuf::from("/nowhere/tern.mp3"), len, None) };
        let read = || {
            reads.set(reads.get() + 1);
            Ok(vec![0u8; 4])
        };
        let fails = || {
            reads.set(reads.get() + 1);
            Err("tern.mp3 could not be read".to_string())
        };
        let refuse = |_: &[u8]| Err("tern.mp3 is no WAV or AIFF".to_string());
        let sound = |_: &[u8]| {
            Ok(SampleReading {
                seconds: 1.0,
                transients: vec![0.5],
                wave: vec![],
            })
        };
        for _ in 0..3 {
            assert_eq!(
                remembered(&kept, key(4), read, refuse),
                Err("tern.mp3 is no WAV or AIFF".to_string())
            );
        }
        assert_eq!(reads.get(), 1, "refused once, read whole once");
        // Another length is another key: read anew, and its reading kept the same way.
        assert_eq!(
            remembered(&kept, key(5), read, sound).unwrap().transients,
            [0.5]
        );
        assert_eq!(
            remembered(&kept, key(5), read, refuse).unwrap().transients,
            [0.5]
        );
        assert_eq!(reads.get(), 2);
        // A read that fails is not kept: the next asks the file again.
        assert!(remembered(&kept, key(6), fails, sound).is_err());
        assert!(remembered(&kept, key(6), read, sound).is_ok());
        assert_eq!(reads.get(), 4);
    }

    #[test]
    fn quantize_moves_an_audio_clips_transients_toward_the_grid_by_its_amount() {
        use crate::edit::{clip_json, clip_write};
        let (dir, path) = set_file(TIDE);
        let gull = dir.0.join("Samples/Imported/gull.wav");
        std::fs::create_dir_all(gull.parent().unwrap()).unwrap();
        let clicks = at_92(&[1.1, 2.05, 3.0, 3.6]);
        std::fs::write(&gull, click_wav(4.0, 48_000, &clicks)).unwrap();
        run(
            &path,
            SetAct::AudioClipMake {
                track: 0,
                file: gull.to_string_lossy().into_owned(),
                scene: None,
                start: None,
            },
        )
        .unwrap();
        let quantize = |grid: f64, amount: f64| {
            run(
                &path,
                SetAct::ClipQuantize {
                    track: 0,
                    clip: ClipAt::Slot(0),
                    grid,
                    amount,
                },
            )
        };
        // Unwarped, its transients have no beats to move to.
        assert_eq!(
            quantize(0.25, 100.0).unwrap_err(),
            "gull is unwarped: Quantize moves its transients through warp markers, so turn its Warp on first"
        );
        let standing = crate::edit::revision(&std::fs::read(&path).unwrap());
        clip_write(
            &path,
            &standing,
            0,
            ClipAt::Slot(0),
            Some(json!({"warp": true}).as_object().unwrap()),
            None,
            None,
        )
        .unwrap();
        let beats = || -> Vec<(f64, f64)> {
            clip_json(&path, 0, ClipAt::Slot(0)).unwrap()["clip"]["warpMarkers"]
                .as_array()
                .unwrap()
                .iter()
                .map(|p| (p[0].as_f64().unwrap(), p[1].as_f64().unwrap()))
                .collect()
        };
        let on = |pairs: &[(f64, f64)], want: &[f64]| {
            pairs.len() == want.len()
                && pairs
                    .iter()
                    .zip(want)
                    .all(|((_, b), w)| (b - w).abs() < 1e-5)
        };
        // Half way to the 1/16 grid: each transient off it gains a warp marker at its own place in the sample, half way to the
        // nearest sixteenth; the one on it (found to the frame, within a ten-thousandth of a beat) a marker that keeps it there while
        // the stretches beside it move.
        let answer = quantize(0.25, 50.0).unwrap();
        assert_eq!(
            answer["done"],
            "Quantized gull: 3 transients moved toward the 1/16 grid by 50 %, 1 already on it."
        );
        assert_eq!(answer["act"], "clip_quantize");
        let pairs = beats();
        assert!(
            on(&pairs, &[0.0, 0.03125, 1.05, 2.025, 3.0, 3.55]),
            "{pairs:?}"
        );
        assert!(
            pairs[2..]
                .iter()
                .zip(&clicks)
                .all(|((sec, _), click)| (sec - click).abs() < 0.000_5),
            "each marker pins its transient's own place in the sample: {pairs:?}"
        );
        // All the way: the markers already at the transients move on to the grid.
        quantize(0.25, 100.0).unwrap();
        assert!(
            on(&beats(), &[0.0, 0.03125, 1.0, 2.0, 3.0, 3.5]),
            "{:?}",
            beats()
        );
        // The 1/8 grid in triplets, a third of a beat: 1, 2 and 3 stand on it, and 3.5 is nearest three and two thirds.
        let answer = quantize(1.0 / 3.0, 100.0).unwrap();
        assert_eq!(
            answer["done"],
            "Quantized gull: 1 transient moved toward the 1/8T grid by 100 %, 3 already on it."
        );
        assert!(
            on(&beats(), &[0.0, 0.03125, 1.0, 2.0, 3.0, 11.0 / 3.0]),
            "{:?}",
            beats()
        );
        // On the grid already: nothing moves, and the set is not written.
        let before = std::fs::read(&path).unwrap();
        assert_eq!(
            quantize(1.0 / 3.0, 100.0).unwrap_err(),
            "gull's 4 transients stand on the 1/8T grid already, so nothing was quantized"
        );
        assert_eq!(std::fs::read(&path).unwrap(), before);
        // The grid and the amount, within their ranges.
        assert_eq!(
            quantize(0.0, 50.0).unwrap_err(),
            "The grid is a length in beats, more than 0 and at most 64"
        );
        assert_eq!(
            quantize(0.25, 0.0).unwrap_err(),
            "Amount is how far each transient moves toward the grid: more than 0 % and at most 100 %"
        );
        assert_eq!(
            quantize(0.25, 120.0).unwrap_err(),
            "Amount is how far each transient moves toward the grid: more than 0 % and at most 100 %"
        );
        // The grid's bound is 64 beats: the first number above it is refused, and 64 itself passes it (48g item 3).
        let grid = "The grid is a length in beats, more than 0 and at most 64";
        let before = std::fs::read(&path).unwrap();
        assert_eq!(quantize(64.0 + 1e-9, 100.0).unwrap_err(), grid);
        assert_eq!(std::fs::read(&path).unwrap(), before);
        let at_64 = quantize(64.0, 100.0);
        assert_ne!(
            at_64.as_ref().err().map(String::as_str),
            Some(grid),
            "{at_64:?}"
        );
        // A MIDI clip has notes, not transients.
        let (_midi, midi) = set_file(SET);
        assert_eq!(
            run(
                &midi,
                SetAct::ClipQuantize {
                    track: 0,
                    clip: ClipAt::Slot(0),
                    grid: 0.25,
                    amount: 100.0
                }
            )
            .unwrap_err(),
            "Riff is a MIDI clip: it has notes, not transients, and Quantize here moves an audio clip's transients"
        );
    }

    #[test]
    fn a_transient_quantize_would_carry_onto_its_neighbour_stays_where_it_stands() {
        use crate::edit::{clip_json, clip_write};
        let (dir, path) = set_file(TIDE);
        let tern = dir.0.join("tern.wav");
        // 1.1 and 1.25 are both nearest beat 1: the first moves onto it, the second would land on it too.
        std::fs::write(&tern, click_wav(3.0, 48_000, &at_92(&[1.1, 1.25, 2.6]))).unwrap();
        run(
            &path,
            SetAct::AudioClipMake {
                track: 0,
                file: tern.to_string_lossy().into_owned(),
                scene: None,
                start: None,
            },
        )
        .unwrap();
        let standing = crate::edit::revision(&std::fs::read(&path).unwrap());
        clip_write(
            &path,
            &standing,
            0,
            ClipAt::Slot(0),
            Some(json!({"warp": true}).as_object().unwrap()),
            None,
            None,
        )
        .unwrap();
        let answer = run(
            &path,
            SetAct::ClipQuantize {
                track: 0,
                clip: ClipAt::Slot(0),
                grid: 1.0,
                amount: 100.0,
            },
        )
        .unwrap();
        assert_eq!(
            answer["done"],
            "Quantized tern: 2 transients moved toward the 1/4 grid by 100 %, 1 not moved, as it would reach the warp marker beside it."
        );
        let c = clip_json(&path, 0, ClipAt::Slot(0)).unwrap()["clip"].clone();
        let beats: Vec<f64> = c["warpMarkers"]
            .as_array()
            .unwrap()
            .iter()
            .map(|p| p[1].as_f64().unwrap())
            .collect();
        assert!(
            beats.len() == 4
                && [0.0, 0.03125, 1.0, 3.0]
                    .iter()
                    .zip(&beats)
                    .all(|(w, b)| (w - b).abs() < 1e-6),
            "{beats:?}"
        );
        // A sample with no transient in the clip is refused in words.
        let hush = dir.0.join("hush.wav");
        std::fs::write(&hush, click_wav(1.0, 48_000, &[])).unwrap();
        run(
            &path,
            SetAct::AudioClipMake {
                track: 1,
                file: hush.to_string_lossy().into_owned(),
                scene: None,
                start: None,
            },
        )
        .unwrap();
        let standing = crate::edit::revision(&std::fs::read(&path).unwrap());
        clip_write(
            &path,
            &standing,
            1,
            ClipAt::Slot(0),
            Some(json!({"warp": true}).as_object().unwrap()),
            None,
            None,
        )
        .unwrap();
        assert_eq!(
            run(
                &path,
                SetAct::ClipQuantize {
                    track: 1,
                    clip: ClipAt::Slot(0),
                    grid: 0.25,
                    amount: 100.0
                }
            )
            .unwrap_err(),
            "hush has no transient between its start and end markers, so nothing was quantized"
        );
    }

    /// DLW build ruling 2026-11-09 (48e's M1 rule, kept for 48d item 2's writes): a warp marker write, by the clip's setting or by
    /// Quantize, computes every marker first and is refused before anything is written unless each stands within a million seconds
    /// and beats of the sample's start, in order; the clip then still takes a write.
    #[test]
    fn warp_marker_writes_keep_every_marker_within_a_million_beats_and_in_order() {
        use crate::edit::{clip_json, clip_write};
        let (dir, path) = set_file(TIDE);
        let gull = dir.0.join("gull.wav");
        std::fs::write(&gull, click_wav(4.0, 48_000, &[3.6])).unwrap();
        run(
            &path,
            SetAct::AudioClipMake {
                track: 0,
                file: gull.to_string_lossy().into_owned(),
                scene: None,
                start: None,
            },
        )
        .unwrap();
        let revision = || crate::edit::revision(&std::fs::read(&path).unwrap());
        let write = |set: Value| {
            clip_write(
                &path,
                &revision(),
                0,
                ClipAt::Slot(0),
                Some(set.as_object().unwrap()),
                None,
                None,
            )
            .map(|v| v["clip"].clone())
        };
        write(json!({"warp": true})).unwrap();
        let far = "A warp marker stands within a million seconds and beats of its sample's start";
        for markers in [
            json!([[0.0, 0.0], [1.0, 2.0e6]]),
            json!([[0.0, 0.0], [1.0, 1.0e300]]),
            json!([[0.0, 0.0], [2.0e6, 3.0]]),
        ] {
            let before = revision();
            assert_eq!(
                write(json!({"warpMarkers": markers})).unwrap_err(),
                far,
                "{markers}"
            );
            assert_eq!(revision(), before, "nothing is written: {markers}");
        }
        // At most 65536 markers (48g item 2): one more is refused, and nothing is written.
        let many = Value::Array(
            (0..65_537)
                .map(|i| json!([f64::from(i) * 0.01, f64::from(i) * 0.02]))
                .collect(),
        );
        let before = revision();
        assert_eq!(
            write(json!({"warpMarkers": many})).unwrap_err(),
            "A clip holds at most 65536 warp markers here"
        );
        assert_eq!(revision(), before, "nothing is written");
        // One beat a second, ending a beat short of a million; the clip's start and end markers about its click at 3.6 s, which
        // stands at beat 999999.6. On a grid of 6 beats its nearest line is 1000002, past a million: Quantize is refused, and the
        // set is not written.
        let near = json!([[0.0, 999_996.0], [3.0, 999_999.0]]);
        let c =
            write(json!({"warpMarkers": near, "end": 1_000_000.0, "start": 999_996.0})).unwrap();
        assert_eq!(c["warpMarkers"], near);
        let before = revision();
        assert_eq!(
            run(
                &path,
                SetAct::ClipQuantize {
                    track: 0,
                    clip: ClipAt::Slot(0),
                    grid: 6.0,
                    amount: 100.0
                }
            )
            .unwrap_err(),
            format!("{far}, so nothing was quantized")
        );
        assert_eq!(revision(), before, "Quantize wrote nothing");
        assert_eq!(
            clip_json(&path, 0, ClipAt::Slot(0)).unwrap()["clip"]["warpMarkers"],
            near
        );
        // Within the bound, the same clip is quantized, and still takes a marker write.
        let answer = run(
            &path,
            SetAct::ClipQuantize {
                track: 0,
                clip: ClipAt::Slot(0),
                grid: 0.5,
                amount: 100.0,
            },
        )
        .unwrap();
        assert!(answer["done"]
            .as_str()
            .is_some_and(|w| w.starts_with("Quantized gull: 1 transient moved")));
        let moved = json!([[0.0, 0.0], [0.5, 1.0], [2.0, 3.5]]);
        assert_eq!(
            write(json!({"warpMarkers": moved})).unwrap()["warpMarkers"],
            moved
        );
    }

    /// DLW build ruling 2026-11-09, 48g item 1 (#948's review, finding 1): Warp on or off carries the clip's markers through its warp
    /// markers, and markers M1 admits at an extreme slope carried them to 6e306 seconds. Every carried value is computed first; the
    /// switch is refused in words, and nothing is written, unless each is within a million seconds or beats of the sample's start and
    /// the loop's end still after its start.
    #[test]
    fn warp_on_or_off_carries_no_marker_a_million_away_and_writes_nothing_then() {
        use crate::edit::{clip_json, clip_write};
        let (dir, path) = set_file(TIDE);
        let gull = dir.0.join("gull.wav");
        std::fs::write(&gull, click_wav(4.0, 48_000, &[3.6])).unwrap();
        run(
            &path,
            SetAct::AudioClipMake {
                track: 0,
                file: gull.to_string_lossy().into_owned(),
                scene: None,
                start: None,
            },
        )
        .unwrap();
        let write = |set: Value| {
            let standing = crate::edit::revision(&std::fs::read(&path).unwrap());
            clip_write(
                &path,
                &standing,
                0,
                ClipAt::Slot(0),
                Some(set.as_object().unwrap()),
                None,
                None,
            )
            .map(|v| v["clip"].clone())
        };
        let refused = |set: Value, words: &str| {
            let before = std::fs::read(&path).unwrap();
            assert_eq!(write(set.clone()).unwrap_err(), words, "{set}");
            assert_eq!(
                std::fs::read(&path).unwrap(),
                before,
                "the set is byte-identical: {set}"
            );
        };
        // Markers of a plain slope, half a second a beat, carry the end marker at 6.13 beats to 3.07 seconds and back.
        write(json!({"warp": true, "warpMarkers": [[0.0, 0.0], [1.0, 2.0]]})).unwrap();
        let end = write(json!({"warp": false})).unwrap()["end"]
            .as_f64()
            .unwrap();
        assert!((end - 4.0 * 92.0 / 60.0 / 2.0).abs() < 1e-9, "{end}");
        write(json!({"warp": true})).unwrap();
        // The reviewer's probe: a million seconds over 1e-300 of a beat, so Warp off would carry the end marker to 6e306 seconds.
        write(json!({"warpMarkers": [[0.0, 0.0], [1.0e6, 1.0e-300]]})).unwrap();
        refused(
            json!({"warp": false}),
            "Its warp markers would carry the clip's markers more than a million seconds from its sample's start, so the clip stays warped",
        );
        // A million beats over the least second there is: the end marker would come to the start's own second.
        write(json!({"warpMarkers": [[0.0, 0.0], [5e-324, 1.0e6]]})).unwrap();
        refused(
            json!({"warp": false}),
            "Its warp markers would carry the clip's loop end onto its start, so the clip stays warped",
        );
        // The other way: a million beats over 1e-300 of a second, then Warp off (its markers come to some 6e-306 seconds) and the
        // end marker at 2 seconds. Warp on would carry it to 2e306 beats.
        write(json!({"warpMarkers": [[0.0, 0.0], [1.0e-300, 1.0e6]]})).unwrap();
        write(json!({"warp": false})).unwrap();
        write(json!({"end": 2.0})).unwrap();
        refused(
            json!({"warp": true}),
            "Its warp markers would carry the clip's markers more than a million beats from its sample's start, so the clip stays unwarped",
        );
        assert_eq!(
            clip_json(&path, 0, ClipAt::Slot(0)).unwrap()["clip"]["end"],
            json!(2.0)
        );
    }

    #[test]
    fn an_audio_clips_warp_markers_are_written_and_read_back() {
        use crate::edit::{clip_json, clip_write};
        let (dir, path) = set_file(TIDE);
        let gull = dir.0.join("gull.wav");
        std::fs::write(&gull, click_wav(2.0, 48_000, &[0.5])).unwrap();
        run(
            &path,
            SetAct::AudioClipMake {
                track: 0,
                file: gull.to_string_lossy().into_owned(),
                scene: None,
                start: None,
            },
        )
        .unwrap();
        let write = |path: &str, set: Value| {
            let standing = crate::edit::revision(&std::fs::read(path).unwrap());
            clip_write(
                path,
                &standing,
                0,
                ClipAt::Slot(0),
                Some(set.as_object().unwrap()),
                None,
                None,
            )
            .map(|v| v["clip"].clone())
        };
        let moved = json!([[0.0, 0.0], [0.5, 1.0], [2.0, 3.5]]);
        assert_eq!(
            write(&path, json!({"warpMarkers": moved})).unwrap_err(),
            "gull is unwarped, so its warp markers stand: turn its Warp on to move them"
        );
        let c = write(&path, json!({"warp": true, "warpMarkers": moved})).unwrap();
        assert_eq!(c["warpMarkers"], moved);
        assert_eq!(
            c["bpm"],
            Value::Null,
            "two segments at two tempi: no one BPM"
        );
        assert_eq!(
            clip_json(&path, 0, ClipAt::Slot(0)).unwrap()["clip"]["warpMarkers"],
            moved
        );
        for (markers, words) in [
            (
                json!([[0.0, 0.0]]),
                "Warp markers are two at least, each [seconds of the sample, beat]",
            ),
            (
                json!([[0.0, 0.0], [1.0, "two"]]),
                "Warp markers are two at least, each [seconds of the sample, beat]",
            ),
            (
                json!([[-1.0, 0.0], [1.0, 2.0]]),
                "A warp marker pins a place in the sample, from 0 seconds",
            ),
            (
                json!([[0.0, 0.0], [1.0, 2.0], [0.5, 3.0]]),
                "Each warp marker stands later than the one before it, in the sample and in beats",
            ),
            (
                json!([[0.0, 0.0], [1.0, 2.0], [1.5, 2.0]]),
                "Each warp marker stands later than the one before it, in the sample and in beats",
            ),
            // Two at one second, their beats rising: no stretch of the sample plays them (48g item 3).
            (
                json!([[0.0, 0.0], [1.0, 1.0], [1.0, 2.0]]),
                "Each warp marker stands later than the one before it, in the sample and in beats",
            ),
        ] {
            assert_eq!(
                write(&path, json!({"warpMarkers": markers})).unwrap_err(),
                words
            );
        }
        let (_midi, midi) = set_file(SET);
        assert_eq!(
            write(&midi, json!({"warpMarkers": moved})).unwrap_err(),
            "A MIDI clip plays no sample: Warp markers is an audio clip's setting"
        );
    }
}
