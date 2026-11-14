//! Each mode's Set, built in the kernel (docs/architecture/world-shell.md §9.2, layer 4; O-I #1004; PROGRAMME R35): the tracks,
//! clips, rows (stops), takes and the Main track a mode's Session and Arrangement draw (manual §16.2, §16.6), as data in one type for
//! all five modes, built from the World Model's slices (world_model.rs) and from nothing else. This module reads no owner.
//!
//! | mode          | slices it is built from         | what it holds                                                            |
//! |---------------|---------------------------------|--------------------------------------------------------------------------|
//! | `central`     | worlds, day, workcells          | your world and the worlds today's set brings in as tracks, their pages   |
//! |               |                                 | as clips, today's named rows then a row per slot, the Day as the Main    |
//! |               |                                 | track, each project world's Works in                                     |
//! | `factory`     | sessions, factory, workcells    | the Agent sessions as tracks (each SessionSpace a group), Factory's      |
//! |               |                                 | tasks as clips on the session that executes them (else on their Run's     |
//! |               |                                 | track), their attempts as takes, the workcells as return tracks          |
//! | `techne`      | sky                             | the dated sky now, as seen from Earth, as one track                       |
//! | `expressions` | expressions                     | each work as a track (a closed one opens from its file), its Scenes as   |
//! |               |                                 | clips on the rows (Moment n: each work's n-th Scene), their takes, the   |
//! |               |                                 | Studio's values of each open work's Scene, and the playback (O-I #1008)  |
//! | `live`        | none                            | its owner (the open set and its sound engine) is no slice yet (#1010)    |
//!
//! A slice that is unread or refused is never an empty success: the track or row it would make stands with that slice's words as
//! its stated reason (`absent`), and a mode no slice serves says why in the Set's own `absent`.
//!
//! The Set is data. Each act a clip or a track carries is an Action id (`act`, #1002) with the input the Set already knows and the
//! one input the person gives (`takes`); an id in the shell's own namespace (`shell.`) is the shell's setter. An act no single
//! Action carries waits, in words (`waiting`), by the op its menu names. Positions are instants (unix ms); the ruler says how they
//! are laid (`day`: minutes of one UTC day; `clock`: seconds from its origin).
//!
//! The Set is kept the way the model keeps a slice: built when it is first asked for, and built again whenever a slice it reads
//! moves (`slice_moved`, called where the model's change notice is recorded). Its version moves exactly when the Set does, and
//! each move is one notice (`KernelEvent::SetChanged`, wire `set_changed`). Devices and views read it by one op,
//! `set_subscribe(mode)`, and ask again on its notice.
use crate::world_model::Slice;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::{BTreeMap, HashMap};
use std::sync::{Mutex, OnceLock};

/// The schema of one Set's answer.
pub const SCHEMA: &str = "oi.mode-set/v1";

/// The five modes, each with one Set.
#[derive(Clone, Copy, Debug, Deserialize, Eq, Hash, Ord, PartialEq, PartialOrd, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Mode {
    Central,
    Factory,
    Expressions,
    Techne,
    Live,
}

impl Mode {
    pub const ALL: [Mode; 5] = [
        Mode::Central,
        Mode::Factory,
        Mode::Expressions,
        Mode::Techne,
        Mode::Live,
    ];

    /// The wire name.
    pub fn name(self) -> &'static str {
        match self {
            Mode::Central => "central",
            Mode::Factory => "factory",
            Mode::Expressions => "expressions",
            Mode::Techne => "techne",
            Mode::Live => "live",
        }
    }

    pub fn from_name(name: &str) -> Option<Self> {
        Self::ALL.into_iter().find(|mode| mode.name() == name)
    }

    /// The World Model's slices this mode's Set is built from.
    pub fn slices(self) -> &'static [Slice] {
        match self {
            Mode::Central => &[Slice::Worlds, Slice::Day, Slice::Workcells],
            Mode::Factory => &[Slice::Sessions, Slice::Factory, Slice::Workcells],
            Mode::Techne => &[Slice::Sky],
            Mode::Expressions => &[Slice::Expressions],
            Mode::Live => &[],
        }
    }

    /// Whose acts the Set's acts are, in the words a missing act names.
    pub fn owner(self) -> &'static str {
        match self {
            Mode::Central => {
                "Central · its worlds, their pages and today's Day, through the Action registry"
            }
            Mode::Factory => {
                "Factory and AIKit · the Agent sessions, Factory's tasks and their attempts"
            }
            Mode::Expressions => "Expressions · its works, their Scenes and the Studio, in the kernel's expression store",
            Mode::Techne => "Technē · QL's dated sky",
            Mode::Live => "Live · the open set's owner",
        }
    }
}

// ---------------------------------------------------------------------------
// The Set, in one type.
// ---------------------------------------------------------------------------

/// One mode's Set.
#[derive(Clone, Debug, Default, Deserialize, PartialEq, Serialize)]
pub struct ModeSet {
    /// Whose acts these are, in the words a missing act names.
    pub owner: String,
    /// The slices it was built from, each as the model held it.
    pub sources: Vec<Source>,
    /// Why the Set holds nothing of its own: no slice of the World Model serves this mode yet.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub absent: Option<String>,
    /// How the Arrangement lays the Set's instants. Absent: the rows laid end to end.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ruler: Option<Ruler>,
    /// The rows of the Session grid (Live's scenes, the DLW's stops), in order.
    pub rows: Vec<Row>,
    pub tracks: Vec<Track>,
    pub clips: Vec<Clip>,
    /// The takes stacked under the clips (manual §16.6), each on its own take lane in Arrangement view.
    pub takes: Vec<Take>,
    /// The Main track: its name and its chain.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub main: Option<Main>,
    /// The mixer row: which of Live's controls the mode has, and what each does here.
    pub mixer: BTreeMap<String, Control>,
    /// Why a kind of lane under the tracks is absent (`takes`, `automation`, `events`), in the owners' terms.
    pub lanes_absent: BTreeMap<String, String>,
    /// The acts on the Set as a whole (`arm`, the shell's one write arm).
    pub acts: BTreeMap<String, Act>,
    /// What each act no single Action carries waits for, by the op its menu names.
    pub waiting: BTreeMap<String, String>,
    /// The automation lanes under the tracks (manual §16.6): Expressions' the presented Scene's recorded lanes and the generator lanes
    /// that move its values, each on the clip it rides.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub lanes: Vec<Lane>,
    /// The loop brace, in the seconds the clips are laid on (Expressions' loop region, or its whole saved sequence).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub loop_brace: Option<LoopBrace>,
}

/// A stretch in seconds: of a clip's own time (a take inside its Scene), or of the seconds the clips are laid on.
#[derive(Clone, Debug, Default, Deserialize, PartialEq, Serialize)]
pub struct Stretch {
    pub start_s: f64,
    pub end_s: f64,
}

/// The loop brace: where it starts, where it ends (none: the end of what is laid), and whether it is off.
#[derive(Clone, Debug, Default, Deserialize, PartialEq, Serialize)]
pub struct LoopBrace {
    pub start_s: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub end_s: Option<f64>,
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub off: bool,
}

/// A take lane's Activator and Solo, as its owner keeps them on the lane.
#[derive(Clone, Debug, Default, Deserialize, PartialEq, Serialize)]
pub struct LaneSetting {
    pub enabled: bool,
    pub solo: bool,
}

/// One point of an automation lane: at a second of its clip's own time, at 0–1 of its range.
#[derive(Clone, Debug, Default, Deserialize, PartialEq, Serialize)]
pub struct LanePoint {
    pub at: f64,
    pub value: f64,
}

/// An automation lane: the parameter it moves (device and parameter), its points, its range where its owner reads one, what moves it
/// where a generator does, and its acts (`draw`, where it is drawn by hand).
#[derive(Clone, Debug, Default, Deserialize, PartialEq, Serialize)]
pub struct Lane {
    pub id: String,
    pub track: String,
    pub clip: String,
    pub device: String,
    pub parameter: String,
    pub points: Vec<LanePoint>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub range: Option<Stretch>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub modulated_by: Option<String>,
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub acts: BTreeMap<String, Act>,
}

/// One slice the Set was built from.
#[derive(Clone, Debug, Default, Deserialize, PartialEq, Serialize)]
pub struct Source {
    pub slice: String,
    pub owner: String,
    pub version: u64,
    pub state: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// The Arrangement's ruler: `day` lays one UTC day in minutes (`date`); `clock` lays seconds from `origin_unix_ms`.
#[derive(Clone, Debug, Default, Deserialize, PartialEq, Serialize)]
pub struct Ruler {
    pub kind: String,
    pub unit: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub date: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub origin_unix_ms: Option<u64>,
}

#[derive(Clone, Debug, Default, Deserialize, PartialEq, Serialize)]
pub struct Row {
    pub id: String,
    pub name: String,
    /// The row's own acts: Expressions' `launch` plays each work's Scene on the row (Live's scene launch).
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub acts: BTreeMap<String, Act>,
}

#[derive(Clone, Debug, Default, Deserialize, PartialEq, Serialize)]
pub struct Track {
    pub id: String,
    pub name: String,
    /// What is known of the track, and what is not, in words.
    pub kind: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
    /// How deep it sits under a group; 0 at the top.
    #[serde(default, skip_serializing_if = "is_zero")]
    pub depth: u32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub parent: Option<String>,
    /// The Main track's own material.
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub main: bool,
    /// A return track (a workcell): it holds no clips.
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub returns: bool,
    /// No act of the Set reaches it.
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub read_only: bool,
    /// Why what it would hold is not here: the slice that holds it is unread or refused, in its owner's words.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub absent: Option<String>,
    /// The workcell its agents work in (§19.23 Works in).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub works_in: Option<String>,
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub acts: BTreeMap<String, Act>,
    /// Expressions' Studio of the track's work: the values of the field and the settings of the Scene it has selected, each
    /// written by `act` (O-I #1008).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub studio: Option<Studio>,
    /// The track's mixer as its owner keeps it, where the owner keeps one per track (an Expression's Volume, Activator, Solo and Arm).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mix: Option<Mix>,
    /// The track's info text, as its owner keeps it (an Expression's description).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub info: Option<String>,
}

/// One track's mixer as its owner keeps it: each control the owner holds, and nothing it does not.
#[derive(Clone, Debug, Default, Deserialize, PartialEq, Serialize)]
pub struct Mix {
    /// A linear gain: 1 is the level the material was made at, 0 silence (the views say it in dB).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub volume: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub activator: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub solo: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub arm: Option<bool>,
}

/// The Studio a device draws from (manual §20.2): the Scene's values of the field by bind, its device settings by `<kind>:<key>`,
/// and the one Action each control writes with, given the bind (or setting) and the value the person gives.
#[derive(Clone, Debug, Default, Deserialize, PartialEq, Serialize)]
pub struct Studio {
    pub scene_ref: String,
    pub values: BTreeMap<String, Value>,
    pub settings: BTreeMap<String, Value>,
    pub act: Act,
    /// The automated targets (`field.<key>`) a hand holds off their automation, until Re-enable gives them back.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub held: Vec<String>,
}

/// An instant, or a stretch from one instant to another, in unix ms. No end: it runs on (a running clip's open edge).
#[derive(Clone, Debug, Default, Deserialize, PartialEq, Serialize)]
pub struct Span {
    pub start_unix_ms: u64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub end_unix_ms: Option<u64>,
}

#[derive(Clone, Debug, Default, Deserialize, PartialEq, Serialize)]
pub struct Clip {
    pub id: String,
    pub track: String,
    pub row: String,
    pub label: String,
    /// The owner's own ref of what the clip is: a page's file ref, a Factory task's task_ref.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub subject: Option<String>,
    /// How it stands: waiting, running, stopped, recording, stalled or done.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
    /// Its owner's own word for it, verbatim.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub state: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub at: Option<Span>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub note: Option<String>,
    /// Its length in seconds, where the Set lays its clips end to end in seconds rather than on a clock (an Expression's Scene).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub seconds: Option<f64>,
    /// Where it starts inside its own content, in seconds (what Slip moves).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub entry: Option<f64>,
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub acts: BTreeMap<String, Act>,
}

#[derive(Clone, Debug, Default, Deserialize, PartialEq, Serialize)]
pub struct Take {
    pub id: String,
    pub clip: String,
    pub track: String,
    pub name: String,
    /// prepared, running, returned or failed.
    pub state: String,
    /// The take that stands (its Return received).
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub standing: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub at: Option<Span>,
    pub words: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub run: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub unit: Option<String>,
    /// Where it lies inside its clip, in the clip's seconds (an Expression's take, inside its Scene).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub within: Option<Stretch>,
    /// The stretch of it kept into the main lane, in the clip's seconds.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub kept: Option<Stretch>,
    /// Its lane's Activator and Solo, where its owner keeps them on the lane (a Torus take).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub lane: Option<LaneSetting>,
    /// The take's own acts: Factory's lays `choose` on a returned take its Run's Flow can receive.
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub acts: BTreeMap<String, Act>,
}

#[derive(Clone, Debug, Default, Deserialize, PartialEq, Serialize)]
pub struct Main {
    /// The track that is the Main track's own material, when one is.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub track: Option<String>,
    pub name: String,
    pub chain: Vec<String>,
}

/// One control of the mixer row: what it does here, its route, its grain, or why it stands disabled.
#[derive(Clone, Debug, Default, Deserialize, PartialEq, Serialize)]
pub struct Control {
    pub meaning: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub route: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub grain: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub disabled: Option<String>,
}

/// An act: one Action by its registry id with the input the Set knows; `takes` names the one input the person gives (a name, an
/// on/off). An id in the shell's own namespace (`shell.`) is the shell's setter, given that value.
#[derive(Clone, Debug, Default, Deserialize, PartialEq, Serialize)]
pub struct Act {
    pub action: String,
    #[serde(default, skip_serializing_if = "Value::is_null")]
    pub input: Value,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub project: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub takes: Option<String>,
    /// What the act does, in the words its menu shows.
    pub words: String,
    /// What is so once its Action answered, in the words the receipt says.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub done: Option<String>,
}

fn is_zero(value: &u32) -> bool {
    *value == 0
}

fn act(action: &str, input: Value, takes: Option<&str>, words: &str) -> Act {
    Act {
        action: action.to_owned(),
        input,
        project: None,
        takes: takes.map(str::to_owned),
        words: words.to_owned(),
        done: None,
    }
}

/// The act, saying `done` once its Action answered.
fn done(act: Act, done: String) -> Act {
    Act {
        done: Some(done),
        ..act
    }
}

fn control(meaning: &str) -> Control {
    Control {
        meaning: meaning.to_owned(),
        ..Control::default()
    }
}

fn words(pairs: &[(&str, &str)]) -> BTreeMap<String, String> {
    pairs
        .iter()
        .map(|(key, value)| ((*key).to_owned(), (*value).to_owned()))
        .collect()
}

// ---------------------------------------------------------------------------
// Keeping each Set.
// ---------------------------------------------------------------------------

#[derive(Default)]
struct Held {
    version: u64,
    set: Option<ModeSet>,
}

/// The process's Sets, one per mode.
#[derive(Default)]
pub struct Sets {
    held: [Mutex<Held>; 5],
}

impl Sets {
    /// The process's Sets.
    pub fn global() -> &'static Sets {
        static SETS: OnceLock<Sets> = OnceLock::new();
        SETS.get_or_init(Sets::default)
    }

    fn cell(&self, mode: Mode) -> &Mutex<Held> {
        &self.held[Mode::ALL.iter().position(|m| *m == mode).unwrap_or(0)]
    }

    /// The mode's Set built now from the slices' answers as `answer_of` gives them (the model's, without reading: world_model.rs
    /// `held_answer`): its answer, and the version it moved to, if it moved. Built under the mode's own lock, so two builds never
    /// cross and the Set held is always the one built from the later answers.
    pub fn now(&self, mode: Mode, answer_of: &dyn Fn(Slice) -> Value) -> (Value, Option<u64>) {
        let mut held = self.cell(mode).lock().unwrap_or_else(|e| e.into_inner());
        let answers: Vec<Value> = mode
            .slices()
            .iter()
            .map(|slice| answer_of(*slice))
            .collect();
        let set = build(mode, &answers);
        let moved = held.set.as_ref() != Some(&set);
        if moved {
            held.version += 1;
            held.set = Some(set);
        }
        (
            json!({"schema": SCHEMA, "mode": mode.name(), "version": held.version, "set": held.set}),
            moved.then_some(held.version),
        )
    }

    /// A slice moved: every Set that reads it is built again, and each mode whose Set moved is answered with its new version.
    pub fn slice_moved(
        &self,
        slice: Slice,
        answer_of: &dyn Fn(Slice) -> Value,
    ) -> Vec<(Mode, u64)> {
        Mode::ALL
            .into_iter()
            .filter(|mode| mode.slices().contains(&slice))
            .filter_map(|mode| self.now(mode, answer_of).1.map(|version| (mode, version)))
            .collect()
    }
}

// ---------------------------------------------------------------------------
// Building a Set from the slices' answers.
// ---------------------------------------------------------------------------

/// One slice's answer as a Set reads it (`oi.world-model-slice/v1`).
struct Read<'a> {
    owner: &'a str,
    name: &'a str,
    state: &'a str,
    value: Option<&'a Value>,
    error: Option<&'a str>,
}

impl<'a> Read<'a> {
    fn of(answer: &'a Value) -> Self {
        Self {
            owner: answer["owner"].as_str().unwrap_or("its owner"),
            name: answer["slice"].as_str().unwrap_or("slice"),
            state: answer["state"].as_str().unwrap_or("unread"),
            value: Some(&answer["value"]).filter(|value| !value.is_null()),
            error: answer["error"].as_str(),
        }
    }

    /// Why the slice gives nothing: its owner's words, or that it is still being read.
    fn why(&self) -> String {
        match self.error {
            Some(words) => words.to_owned(),
            None => format!("{}'s {} is still being read", self.owner, self.name),
        }
    }

    /// The owner's newer refusal beside the last state held, when the slice is stale.
    fn stale(&self) -> Option<String> {
        (self.state == "stale").then(|| {
            format!(
                "this is {}'s last reading; it now says: {}",
                self.owner,
                self.error.unwrap_or("nothing")
            )
        })
    }
}

/// The mode's Set from its slices' answers, in `Mode::slices` order. Pure.
pub fn build(mode: Mode, answers: &[Value]) -> ModeSet {
    let sources = answers
        .iter()
        .map(|answer| Source {
            slice: answer["slice"].as_str().unwrap_or_default().to_owned(),
            owner: answer["owner"].as_str().unwrap_or_default().to_owned(),
            version: answer["version"].as_u64().unwrap_or(0),
            state: answer["state"].as_str().unwrap_or("unread").to_owned(),
            error: answer["error"].as_str().map(str::to_owned),
        })
        .collect();
    let empty = json!({});
    let read = |at: usize| Read::of(answers.get(at).unwrap_or(&empty));
    let mut set = match mode {
        Mode::Central => central(&read(0), &read(1), &read(2)),
        Mode::Factory => factory(&read(0), &read(1), &read(2)),
        Mode::Techne => techne(&read(0)),
        Mode::Expressions => expressions(&read(0)),
        Mode::Live => ModeSet {
            absent: Some("Live's owner, the open set and its sound engine, is no slice of the World Model yet, so the kernel builds no Set of it: its tracks are the open set's parts, read by the window until O-I #1010.".into()),
            ..ModeSet::default()
        },
    };
    set.owner = mode.owner().to_owned();
    set.sources = sources;
    set
}

// ------------------------------------------------------------------ Central

/// The id of a world's track (centralTrackAdapter.ts `centralWorldTrackId`): its register's wiki space ref.
pub fn central_world_track(world: &str) -> String {
    format!("central:world:{world}")
}

/// The Day's track, the Main track.
pub const CENTRAL_DAY_TRACK: &str = "central:day";

/// Today's set as the Day keeps it (manual §18.1 "The set"; the Day document's `meta.set`, `oi.day-set/v1`).
#[derive(Default)]
struct DaySet {
    tracks: Vec<(String, Option<String>)>,
    rows: Vec<(String, String, Vec<String>)>,
}

/// The Day as the day slice holds it: its civil date and its set, or why it keeps none.
struct Day {
    date: Option<String>,
    set: Option<DaySet>,
    words: String,
}

fn text(value: &Value) -> Option<&str> {
    value
        .as_str()
        .map(str::trim)
        .filter(|text| !text.is_empty())
}

fn day_set_of(payload: &Value) -> DaySet {
    let set = &payload["meta"]["set"];
    if set["schema"] != "oi.day-set/v1" {
        return DaySet::default();
    }
    DaySet {
        tracks: set["tracks"]
            .as_array()
            .into_iter()
            .flatten()
            .filter_map(|track| {
                Some((
                    text(&track["world"])?.to_owned(),
                    text(&track["name"]).map(str::to_owned),
                ))
            })
            .collect(),
        rows: set["rows"]
            .as_array()
            .into_iter()
            .flatten()
            .filter_map(|row| {
                let pages = row["pages"]
                    .as_array()
                    .into_iter()
                    .flatten()
                    .filter_map(|page| text(page).map(str::to_owned))
                    .collect();
                Some((
                    text(&row["id"])?.to_owned(),
                    text(&row["name"])?.to_owned(),
                    pages,
                ))
            })
            .collect(),
    }
}

fn day_of(day: &Read) -> Day {
    let Some(reading) = day.value else {
        return Day {
            date: None,
            set: None,
            words: format!("today's Day is unread: {}", day.why()),
        };
    };
    let date = text(&reading["temporal"]["civil_date"]).map(str::to_owned);
    let on = date.as_deref().unwrap_or("today");
    let document = &reading["document"];
    let made = reading["document_state"] == "ready"
        && document["schema"] == "central.document-reading/v1"
        && document["document"]["kind"] == "day";
    if made {
        Day {
            set: Some(day_set_of(&document["document"]["template_payload"])),
            words: String::new(),
            date,
        }
    } else {
        Day {
            set: None,
            words: format!("today's Day ({on}) has no document yet, so it keeps no set: Central makes it at the Day's turn, from the Day form Setup keeps (central.day.turn)"),
            date,
        }
    }
}

/// One page of a world, as the page owner lists it (kernel/src/page.rs `list_pages`).
struct Page {
    path: String,
    reference: String,
    label: String,
    form: String,
    made: Option<(u32, u32, u32, u32, u32, u32)>,
    name: String,
}

/// When a page was made, from the name its door minted (`<slug>-YYYY-MM-DD-HHMM[-n].html`; centralTrackAdapter.ts `mintedAt`).
fn minted(name: &str) -> Option<(u32, u32, u32, u32, u32, u32)> {
    let lower = name.to_ascii_lowercase();
    let stem = lower.strip_suffix(".html")?;
    let parts: Vec<&str> = stem.rsplit('-').collect();
    let number = |part: &str, len: usize| -> Option<u32> {
        (part.len() == len && part.bytes().all(|b| b.is_ascii_digit()))
            .then(|| part.parse().ok())?
    };
    let at = |offset: usize| -> Option<(u32, u32, u32, u32, u32)> {
        let hm = number(parts.get(offset)?, 4)?;
        let day = number(parts.get(offset + 1)?, 2)?;
        let month = number(parts.get(offset + 2)?, 2)?;
        let year = number(parts.get(offset + 3)?, 4)?;
        Some((year, month, day, hm / 100, hm % 100))
    };
    if let Some((y, m, d, h, mi)) = at(0) {
        return Some((y, m, d, h, mi, 0));
    }
    let n = parts.first().and_then(|n| n.parse::<u32>().ok())?;
    let (y, m, d, h, mi) = at(1)?;
    Some((y, m, d, h, mi, n))
}

fn pages_of(listing: &Value) -> Vec<Page> {
    let mut pages: Vec<Page> = listing["pages"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|row| {
            let path = text(&row["location"]["path"])?.to_owned();
            let name = row["name"].as_str().unwrap_or_default().to_owned();
            let label = text(&row["title"])
                .map(str::to_owned)
                .unwrap_or_else(|| name.trim_end_matches(".html").to_owned());
            Some(Page {
                reference: text(&row["location"]["ref"]).unwrap_or(&path).to_owned(),
                path,
                label,
                form: row["form"].as_str().unwrap_or("page").to_owned(),
                made: minted(&name),
                name,
            })
        })
        .collect();
    pages.sort_by(|a, b| match (a.made, b.made) {
        (Some(x), Some(y)) => x.cmp(&y).then_with(|| a.name.cmp(&b.name)),
        (Some(_), None) => std::cmp::Ordering::Less,
        (None, Some(_)) => std::cmp::Ordering::Greater,
        (None, None) => a.name.cmp(&b.name),
    });
    pages
}

fn plural(count: usize, one: &str, many: &str) -> String {
    format!("{count} {}", if count == 1 { one } else { many })
}

fn form_words(form: &str) -> &'static str {
    match form {
        "flow" => "A Flow",
        "being" => "A Being",
        "thing" => "A Thing",
        _ => "A page",
    }
}

/// One seat of a workcell, as the register lists it: its product, its state and the branch it is on.
struct Seat {
    product: String,
    state: String,
    branch: Option<String>,
}

/// The workcells of the machine's register, each named with its seats, or why the register is unread.
type Register = Result<Vec<(String, Vec<Seat>)>, String>;

/// The workcells of the machine's register (`seat status --json`, central.workcell-status/v1): each name with its seats.
fn register_workcells(cells: &Read) -> Register {
    let Some(value) = cells.value else {
        return Err(cells.why());
    };
    let seats = &value["seats"];
    if seats["state"] != "read" {
        return Err(seats["why"]
            .as_str()
            .unwrap_or("the seat register gave nothing")
            .to_owned());
    }
    Ok(seats["reading"]["workcells"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|cell| {
            let held = cell["seats"]
                .as_array()
                .into_iter()
                .flatten()
                .filter_map(|seat| {
                    Some(Seat {
                        product: text(&seat["product"])?.to_owned(),
                        state: text(&seat["state"])?.to_owned(),
                        branch: text(&seat["live_branch"]).map(str::to_owned),
                    })
                })
                .collect();
            Some((text(&cell["name"])?.to_owned(), held))
        })
        .collect())
}

/// The workcell a track of `project` works in (§19.23 Works in: "A new track takes the workcell that holds its project's seat"): the one workcell whose seat for the
/// project is held, else why none is.
fn works_in(cells: &Register, project: &str) -> Result<String, String> {
    let cells = cells
        .as_ref()
        .map_err(|why| format!("The seat register is unread: {why}"))?;
    if cells.is_empty() {
        return Err("The seat register has not answered (seat status --json).".into());
    }
    let product = project.to_lowercase();
    let holding: Vec<(String, Option<String>)> = cells
        .iter()
        .flat_map(|(cell, seats)| {
            seats
                .iter()
                .filter(|seat| seat.product.to_lowercase() == product && seat.state != "free")
                .map(move |seat| (cell.clone(), seat.branch.clone()))
        })
        .collect();
    match holding.as_slice() {
        [(cell, _)] => Ok(cell.clone()),
        [] => Err(format!("No workcell holds {project}'s seat: every seat for it is free.")),
        many => Err(format!(
            "{} workcells hold {project}'s seat ({}); nothing names the lane this track's agents are on.",
            many.len(),
            many.iter()
                .map(|(cell, branch)| match branch {
                    Some(branch) => format!("{cell} on {branch}"),
                    None => cell.clone(),
                })
                .collect::<Vec<_>>()
                .join(", ")
        )),
    }
}

const WORKS_IN_MEANING: &str =
    "the workcell its agents work in: its gateway, machine, seat and landing (§19.23)";
const WORKS_IN_CHOICE: &str = "Choosing another workcell: no owner operation carries it yet — missing op: a track's workcell held with its session's settings (AIKit encounter-session-settings).";

const ARM_WORDS: &str = "shell.setWriteArm — the shell's one write arm (agent/shellSetterBridge.ts): its receipt names the owner that enforces it";

/// Central's mixer row (manual §18.1 "The mixer row"), each control's meaning in the manual's words.
fn central_mixer() -> BTreeMap<String, Control> {
    let mut mixer = BTreeMap::new();
    mixer.insert("activator".into(), Control {
        disabled: Some("Send to Day: no owner operation carries it yet — missing op: a set track field `sendToDay: boolean` in the Day's set (central/daySet.ts) read by the Day's faces and its close (shell · Central).".into()),
        ..control("Send to Day: on, the work in this world reaches the Day's faces; off, it stays out of the Day. On by default")
    });
    mixer.insert("arm".into(), Control {
        grain: Some("the shell's one write arm: arming one world arms every one".into()),
        ..control("Lets the agent of this world write into its pages directly, each write with a receipt; off, every agent write arrives as a proposal")
    });
    mixer.insert("solo".into(), Control {
        disabled: Some("Solo: no owner operation carries it yet — missing op: the Day's faces and the world instrument reading a soloed world from the set (shell · Central).".into()),
        ..control("Shows only this world in the Day's faces and in the world instrument")
    });
    mixer.insert("input".into(), Control {
        route: Some("the world's folder".into()),
        ..control("Its Folder: a file you add to the folder shows as a clip; a file you change in any editor shows the change on its clip")
    });
    mixer.insert(
        "output".into(),
        Control {
            route: Some("Day".into()),
            ..control("Every world sends its work to the Day, the Main track")
        },
    );
    mixer
}

/// What Central's acts no single Action carries wait for, by the op the menu names.
fn central_waiting() -> BTreeMap<String, String> {
    const PAGE_LAUNCH: &str = "the page owner's launch (kernel/src/page.rs: its NOW clearing allocated and made active), which no single Action carries, and what plays is no slice of the World Model yet (O-I #1005)";
    const PAGE_STOP: &str = "the page owner's stop (each playing page's NOW clearing closed, central.now.lifecycle), and the clearings that play are no slice of the World Model yet (O-I #1005)";
    const PAGE_COPY: &str = "the page owner's duplicate (kernel/src/page.rs: the page read and made again with an identity of its own through its world's door), which no single Action carries yet (O-I #1005)";
    const DAY_SET: &str = "today's set, kept in today's Day document (`meta.set`) and written on the Day's revision (central.document.mutate), which the Set does not compose into one Action yet (O-I #1005)";
    words(&[
        ("clip.launch", PAGE_LAUNCH),
        ("row.launch", PAGE_LAUNCH),
        ("track.stop", PAGE_STOP),
        ("set.stop-all", PAGE_STOP),
        ("clip.insert", "a blank page made in the world through Central's creation door (projectcentral.source.create, or central.files.write in your world) and tied to it, which no single Action carries yet (O-I #1005)"),
        ("clip.duplicate", PAGE_COPY),
        ("clip.paste", PAGE_COPY),
        ("row.duplicate", PAGE_COPY),
        ("clip.delete", "the page owner's trash (kernel/src/page.rs: the page owner's checks, then Central's central.files.trash on the revision read, on the person's authority), which no single Action carries yet (O-I #1005)"),
        ("clip.make", "a page of a constellation dropped on a world: Central's creation door, then the page owner's read of it, which no single Action carries yet (O-I #1005)"),
        ("track.seat", DAY_SET),
        ("track.remove", DAY_SET),
        ("track.move", DAY_SET),
        ("row.insert", DAY_SET),
        ("row.rename", DAY_SET),
        ("row.delete", DAY_SET),
        ("clip.info", "a page's info text: the page owner keeps no note on the page as a whole apart from its notes"),
        ("clip.split", "no owner splits a page"),
        ("clip.consolidate", "no owner joins pages"),
        ("clip.crop", "no owner crops a page"),
        ("slot.stop-button", "a slot's own stop in today's set: the Day keeps rows of pages, not slots"),
        ("slot.record", "a recording path into a world: what the armed agent writes is a page's own write, not a slot's"),
        ("track.duplicate", "a world's copy: Central makes a world through setup, not by copying one"),
        ("track.colour", "a world's own colour: a world wears its body's, which is no slice of the World Model yet"),
        ("tracks.group", "a group of worlds: today's set keeps worlds side by side, none under another"),
        ("track.activator", "Send to Day: a set track field `sendToDay: boolean` in the Day's set that the Day's faces and its close read"),
        ("track.solo", "the Day's faces and the world instrument reading a soloed world from today's set"),
    ])
}

fn central(worlds: &Read, day: &Read, cells: &Read) -> ModeSet {
    let day_reading = day_of(day);
    let stale_worlds = worlds.stale();
    let listed: Vec<&Value> = worlds
        .value
        .and_then(|value| value["worlds"].as_array())
        .map(|worlds| worlds.iter().collect())
        .unwrap_or_default();
    let listing_of = |folder: &str| -> Option<&Value> {
        worlds.value?["pages"]
            .as_array()?
            .iter()
            .find(|entry| entry["folder"] == folder)
    };
    // The worlds today's set holds: yours first, always, then the set's in order. A set world Central does not disclose stands
    // named, empty, with why.
    let default_yours = json!({"ref": "central:wiki:root", "name": "Your world", "kind": "yours",
        "folder": crate::world_model::YOUR_WORLD_FOLDER, "project": null});
    let yours = listed
        .iter()
        .find(|world| world["kind"] == "yours")
        .copied()
        .unwrap_or(&default_yours);
    let mut held: Vec<(Value, Option<String>, bool)> = vec![(yours.clone(), None, true)];
    for (reference, name) in day_reading
        .set
        .as_ref()
        .map(|set| set.tracks.as_slice())
        .unwrap_or_default()
    {
        if held
            .iter()
            .any(|(world, _, _)| world["ref"] == reference.as_str())
        {
            continue;
        }
        match listed.iter().find(|world| world["ref"] == reference.as_str()) {
            Some(world) => held.push(((*world).clone(), name.clone(), true)),
            None => held.push((
                json!({"ref": reference, "name": name.clone().unwrap_or_else(|| reference.clone()), "kind": "project", "folder": "", "project": null}),
                None,
                false,
            )),
        }
    }
    let register = register_workcells(cells);
    let mut tracks = Vec::new();
    let mut pages_by_world: Vec<(String, Vec<Page>)> = Vec::new();
    let mut works_reasons: Vec<String> = Vec::new();
    for (world, named, disclosed) in &held {
        let reference = world["ref"].as_str().unwrap_or_default().to_owned();
        let folder = world["folder"].as_str().unwrap_or_default().to_owned();
        let project = text(&world["project"]).map(str::to_owned);
        let name = named
            .clone()
            .or_else(|| text(&world["name"]).map(str::to_owned))
            .unwrap_or_else(|| reference.clone());
        let id = central_world_track(&reference);
        let mut parts = vec![match &project {
            None if world["kind"] == "yours" => "your world".to_owned(),
            Some(project) => format!("{project}'s world"),
            None => "a world".to_owned(),
        }];
        let mut absent = None;
        let mut pages = Vec::new();
        if !disclosed {
            absent = Some(format!("a world today's set holds that Central no longer discloses ({reference}): its pages cannot be read"));
        } else if worlds.value.is_none() {
            absent = Some(format!("Central's worlds are unread: {}", worlds.why()));
        } else {
            parts.push(format!("its folder {folder}"));
            match listing_of(&folder) {
                Some(entry) if entry["state"] == "read" => {
                    pages = pages_of(&entry["listing"]);
                    parts.push(plural(pages.len(), "page", "pages"));
                    let not_pages = entry["listing"]["not_pages"]
                        .as_array()
                        .map(Vec::len)
                        .unwrap_or(0);
                    if not_pages > 0 {
                        parts.push(format!(
                            "{} in it no page",
                            plural(not_pages, "file", "files")
                        ));
                    }
                    if entry["listing"]["more"] == true {
                        parts.push("more pages than one listing reads".into());
                    }
                }
                Some(entry) => {
                    absent = Some(format!(
                        "its pages are unread: {}",
                        entry["why"]
                            .as_str()
                            .unwrap_or("the page owner gave no reason")
                    ));
                }
                None => {
                    absent = Some(format!(
                        "the World Model's worlds slice lists no pages for {folder}"
                    ))
                }
            }
        }
        if let Some(stale) = &stale_worlds {
            parts.push(stale.clone());
        }
        let mut acts = BTreeMap::new();
        if *disclosed && !folder.is_empty() {
            acts.insert(
                "openFolder".into(),
                done(
                    act(
                        "work.open",
                        json!({"query": folder}),
                        None,
                        "Central's work.open: the world's folder, to the application your computer opens it with",
                    ),
                    format!("{name}'s folder is open in the application your computer opens it with."),
                ),
            );
            acts.insert(
                "revealFolder".into(),
                done(
                    act(
                        "work.reveal",
                        json!({"query": folder}),
                        None,
                        "Central's work.reveal: the world's folder, shown in Finder",
                    ),
                    format!("{name}'s folder is shown in Finder."),
                ),
            );
        }
        if let (true, Some(project), Some(revision)) =
            (*disclosed, &project, text(&world["revision"]))
        {
            acts.insert("renameTrack".into(), Act {
                project: Some(project.clone()),
                done: Some(format!("{project}'s world has its new name.")),
                ..act("central.world.name", json!({"project": project, "expected_revision": revision}), Some("name"),
                    "Central's central.world.name: the world's own name, written against the manifest revision Central disclosed")
            });
        }
        let works = match &project {
            Some(project) if *disclosed => match works_in(&register, project) {
                Ok(cell) => Some(cell),
                Err(why) => {
                    works_reasons.push(why);
                    None
                }
            },
            _ => None,
        };
        tracks.push(Track {
            id,
            name,
            kind: parts.join(" · "),
            absent,
            works_in: works,
            acts,
            ..Track::default()
        });
        pages_by_world.push((reference, pages));
    }

    // The rows: today's named rows, then one row per slot for the pages no named row holds.
    let named: &[(String, String, Vec<String>)] = day_reading
        .set
        .as_ref()
        .map(|set| set.rows.as_slice())
        .unwrap_or_default();
    let in_named: std::collections::HashSet<&str> = named
        .iter()
        .flat_map(|(_, _, pages)| pages.iter().map(String::as_str))
        .collect();
    let loose: Vec<(&str, Vec<&Page>)> = pages_by_world
        .iter()
        .map(|(world, pages)| {
            (
                world.as_str(),
                pages
                    .iter()
                    .filter(|page| !in_named.contains(page.reference.as_str()))
                    .collect(),
            )
        })
        .collect();
    let slots = loose
        .iter()
        .map(|(_, pages)| pages.len())
        .max()
        .unwrap_or(0);
    let mut rows: Vec<Row> = named
        .iter()
        .map(|(id, name, _)| Row {
            id: format!("central:row:{id}"),
            name: name.clone(),
            ..Row::default()
        })
        .collect();
    rows.extend((0..slots).map(|i| Row {
        id: format!("central:slot:{}", i + 1),
        name: format!("{}", named.len() + i + 1),
        ..Row::default()
    }));
    let clip_of = |world: &str, page: &Page, row: String| {
        Clip {
        id: page.path.clone(),
        track: central_world_track(world),
        row,
        label: page.label.clone(),
        subject: Some(page.reference.clone()),
        note: Some(format!("{} · {}", form_words(&page.form), page.path)),
        acts: BTreeMap::from([
            ("openFile".to_owned(), done(act("work.open", json!({"query": page.path}), None,
                "Central's work.open: the page's file, to the application your computer opens it with"),
                format!("{} is open in the application your computer opens it with.", page.label))),
            ("revealFile".to_owned(), done(act("work.reveal", json!({"query": page.path}), None,
                "Central's work.reveal: the page's file, shown in Finder"),
                format!("{} is shown in Finder.", page.label))),
        ]),
        ..Clip::default()
    }
    };
    let mut clips = Vec::new();
    for (id, _, refs) in named {
        for reference in refs {
            if let Some((world, page)) = pages_by_world.iter().find_map(|(world, pages)| {
                pages
                    .iter()
                    .find(|page| &page.reference == reference)
                    .map(|page| (world, page))
            }) {
                clips.push(clip_of(world, page, format!("central:row:{id}")));
            }
        }
    }
    for (world, pages) in &loose {
        for (i, page) in pages.iter().enumerate() {
            clips.push(clip_of(world, page, format!("central:slot:{}", i + 1)));
        }
    }

    // The Day, the Main track, last, as Live keeps it.
    let mut day_parts = vec!["the Day · the Main track".to_owned()];
    match (&day_reading.set, &day_reading.date) {
        (Some(set), Some(date)) => day_parts.push(format!(
            "today, {date}: {}, {}",
            plural(set.tracks.len() + 1, "world", "worlds"),
            plural(set.rows.len(), "named row", "named rows")
        )),
        _ => day_parts.push(day_reading.words.clone()),
    }
    if let Some(stale) = day.stale() {
        day_parts.push(stale);
    }
    day_parts.push(
        "the day's entries and the pages that play are no slice of the World Model yet (O-I #1005)"
            .into(),
    );
    let day_absent = day.value.is_none().then(|| day_reading.words.clone());
    tracks.push(Track {
        id: CENTRAL_DAY_TRACK.into(),
        name: "Day".into(),
        // The Day's colour is the shell's token for it (shell/modeSurface.css `--mode-day`).
        color: Some("var(--mode-day, var(--track-default, var(--bg-3)))".into()),
        kind: day_parts.join(" · "),
        main: true,
        absent: day_absent,
        ..Track::default()
    });

    let mut mixer = central_mixer();
    let unread_works = works_reasons.len() == 1
        || (works_reasons.len() > 1 && works_reasons.windows(2).all(|w| w[0] == w[1]));
    mixer.insert(
        "works".into(),
        Control {
            disabled: Some(if unread_works {
                format!("{WORKS_IN_CHOICE} {}", works_reasons[0])
            } else {
                WORKS_IN_CHOICE.to_owned()
            }),
            ..control(WORKS_IN_MEANING)
        },
    );
    ModeSet {
        ruler: day_reading.date.as_ref().map(|date| Ruler {
            kind: "day".into(),
            unit: format!("minutes (UTC) of {date}"),
            date: Some(date.clone()),
            origin_unix_ms: None,
        }),
        rows,
        tracks,
        clips,
        main: Some(Main {
            track: Some(CENTRAL_DAY_TRACK.into()),
            name: day_reading.date.as_ref().map(|date| format!("Day · {date}")).unwrap_or_else(|| "Day".into()),
            chain: vec!["Day".into(), "Approvals".into()],
        }),
        mixer,
        lanes_absent: words(&[
            ("takes", "A page's revisions are its takes (manual §18.1): Central's file history is no slice of the World Model yet (O-I #1005)."),
            ("automation", "No parameter of a page moves over the day: Central keeps no envelope (manual §18.1 \"A page has no envelopes\")."),
            ("events", "Event lanes are Factory's: a session's messages, files, terminal and pages read."),
        ]),
        acts: BTreeMap::from([("arm".to_owned(), act("shell.setWriteArm", Value::Null, Some("on"), ARM_WORDS))]),
        waiting: central_waiting(),
        ..ModeSet::default()
    }
}

// ------------------------------------------------------------------ Factory

/// The palette Factory's session tracks wear by place (the window's track colours, App.tsx `PALETTE`).
const FACTORY_PALETTE: [&str; 6] = [
    "#79b6ce", "#779dcc", "#9885bc", "#8baf9c", "#b096b2", "#6caaa9",
];
/// The fewest batch rows the grid shows (factoryTrackAdapter.ts `FACTORY_MIN_BATCH_ROWS`).
const FACTORY_MIN_ROWS: usize = 4;
/// The Main track's chain (manual §19.1): what works on the whole run.
const FACTORY_MAIN_CHAIN: [&str; 5] = ["Gateways", "Experiment", "Approvals", "Ledger", "Link"];

/// A session's track id (agentRunModel.ts `trackKey`): its SessionSpace and its session; a group's is its space twice.
pub fn session_track(space: &str, session: &str) -> String {
    format!("{space}:{session}")
}

/// A Run's own track, for the tasks no session of the sessions slice executes.
pub fn run_track(run: &str) -> String {
    format!("factory:run:{run}")
}

/// A Factory task's clip: the n-th task on its track (factoryTrackAdapter.ts `factoryTaskRef`, `<track>#task/<n>`), so a selected clip
/// names the session it lies on as the window's bindings read it. Its own task_ref is its `subject`.
pub fn task_clip(track: &str, n: usize) -> String {
    format!("{track}#task/{n}")
}

/// An attempt's take.
pub fn attempt_take(attempt: &str) -> String {
    format!("factory:attempt:{attempt}")
}

/// The workcell's return track (returnTracks.ts `workcellTrackId`).
pub fn workcell_track(name: &str) -> String {
    format!("workcell:{name}")
}

fn instant(value: &Value) -> Option<u64> {
    let at: jiff::Timestamp = value.as_str()?.parse().ok()?;
    u64::try_from(at.as_millisecond()).ok()
}

/// A unit in short words, when its ref says something (factoryTakes.ts `unitWords`): a key, not the opaque identity Factory mints.
fn unit_words(unit: &str) -> Option<String> {
    let tail = unit.rsplit([':', '/']).find(|part| !part.is_empty())?;
    let opaque = tail.len() >= 20
        && tail
            .bytes()
            .all(|b| b.is_ascii_digit() || b.is_ascii_uppercase());
    (!opaque).then(|| tail.to_owned())
}

/// How one attempt stands, in Factory's terms (factoryTakes.ts `takeOf`).
struct Attempt {
    reference: String,
    task: String,
    unit: Option<String>,
    unit_ref: Option<String>,
    execution: Option<String>,
    state: &'static str,
    start: Option<u64>,
    end: Option<u64>,
    receiving: Option<String>,
    summary: Option<String>,
    /// The session it ran on, as Factory's disposition keeps it (`body.sessionSpaceRef`, `body.agentSessionRef`), and the harness.
    session: Option<(String, String)>,
    harness: Option<String>,
}

fn attempt_of(record: &Value) -> Option<Attempt> {
    let reference = text(&record["attemptRef"])?.to_owned();
    let task = text(&record["taskRef"])?.to_owned();
    let returned = record["readableReturn"]
        .as_object()
        .map(|_| &record["readableReturn"]);
    let failed = instant(&record["failureRecordedAt"]).is_some()
        || record["failureEvidenceRefs"]
            .as_array()
            .is_some_and(|refs| !refs.is_empty());
    let state = if returned.is_some() {
        "returned"
    } else if failed {
        "failed"
    } else if text(&record["executionRef"]).is_some() || !record["dispatch"].is_null() {
        "running"
    } else {
        "prepared"
    };
    let unit_ref = text(&record["workflowUnitRef"]).map(str::to_owned);
    Some(Attempt {
        unit: unit_ref.as_deref().and_then(unit_words),
        unit_ref,
        execution: text(&record["executionRef"]).map(str::to_owned),
        start: instant(&record["attemptRecordedAt"]),
        end: if returned.is_some() {
            instant(&record["returnRecordedAt"])
        } else if failed {
            instant(&record["failureRecordedAt"])
        } else {
            None
        },
        receiving: returned
            .and_then(|r| text(&r["receivingRef"]))
            .map(str::to_owned),
        summary: returned
            .and_then(|r| text(&r["summary"]))
            .map(str::to_owned),
        session: text(&record["disposition"]["body"]["sessionSpaceRef"])
            .zip(text(&record["disposition"]["body"]["agentSessionRef"]))
            .map(|(space, session)| (space.to_owned(), session.to_owned())),
        harness: text(&record["disposition"]["body"]["harnessRef"]).map(str::to_owned),
        state,
        reference,
        task,
    })
}

fn take_words(attempt: &Attempt) -> String {
    match attempt.state {
        "prepared" => "prepared, not yet dispatched".into(),
        "running" => "running".into(),
        "failed" => "failed".into(),
        "cancelled" => "stopped: its cancellation accepted".into(),
        _ => match &attempt.receiving {
            Some(receipt) => format!("returned and chosen ({receipt})"),
            None => "returned, not yet chosen".into(),
        },
    }
}

/// Factory's mixer row (manual §19.1), each control's meaning in the manual's words.
fn factory_mixer() -> BTreeMap<String, Control> {
    let mut mixer = BTreeMap::new();
    mixer.insert("activator".into(), Control {
        disabled: Some("Telemetry: no owner operation carries it yet — missing op: the session's own Telemetry on AIKit (encounter-session-settings), whose settings are no slice of the World Model yet (O-I #1006).".into()),
        ..control("Telemetry: on, the session feeds the widgets, the Ledger and other agents; off, it is muted — it keeps working, in silence, and stops sending to the tiles")
    });
    // Solo is what you attend to, the shell's own (§16.1, §16.6): the Set carries it as the `solo` act, and a window that hands its
    // attention lifts this.
    mixer.insert("solo".into(), Control {
        disabled: Some(SOLO_UNHANDED.into()),
        ..control("You attend to the soloed sessions alone: the views, the tiles and the instruments show only them. The others keep running. Off by default.")
    });
    mixer.insert("arm".into(), Control {
        grain: Some("the shell's one write arm: arming one session arms every one".into()),
        ..control("Lets the session's agent write directly, with receipts, where Scope allows; off, every write is a proposal. Arm and press Record to speak a new task onto it")
    });
    mixer.insert("monitor".into(), Control {
        disabled: Some("Watch: no owner operation carries it yet — missing op: shell.setSessionWatch(sessionRef, \"in\" | \"auto\" | \"off\"), a per-session watch the widgets read (shell).".into()),
        ..control("Watch: In streams the session into the widgets always; Auto streams it when it is armed or selected; Off does not stream it")
    });
    mixer.insert("input".into(), Control {
        route: Some("Gateway".into()),
        ..control("The way in: the Gateway at the head of the chain decides what the agent must ask your permission for")
    });
    mixer.insert("output".into(), Control {
        route: Some("Landing".into()),
        ..control("The way out: the landing at the end of the chain — commits, and a request to merge with the checks that tested it")
    });
    mixer
}

/// Solo's press (manual §16.1, §16.6 "Solo changes what you attend to, never what runs"): what you attend to, which the shell holds on the
/// book's world context beside THE selection. No owner is asked, so it is the shell's own act; AIKit's session Solo, a gate on its
/// executor's launches, is never read or written for it.
const SOLO_WORDS: &str = "what you attend to (the book's world context, its Solo): the shell holds it and asks no owner; the views, the tiles and the instruments show only the soloed, and every session keeps running";
/// Solo's words where no attention is handed to the pane.
const SOLO_UNHANDED: &str = "Solo: no owner operation carries it yet — missing op: what you attend to, handed to these tracks: the book's world context holds it (agent/AgentShellContext.tsx soloed, setSolo) (the live shell).";

/// What Factory's acts no single Action carries wait for, by the op the menu names.
fn factory_waiting() -> BTreeMap<String, String> {
    const SESSION_ACT: &str = "an act on the session's own settings or task at AIKit (the encounter's ops), which no Action of the registry carries yet";
    words(&[
        ("clip.launch", "a task run from its clip: factory.task.run runs a task written on a session seated in a project of this World and not yet run; a task that ran and stalled runs again from its track's retry (factory.attempt.retry), and a task of a Run that names no such session has no session to run on"),
        ("row.launch", "a batch row launched: the n-th task of every track at once, which no Action carries"),
        ("track.stop", "a running task's stop: factory.task.stop, on the track whose task is running (it pauses the turn; pressed again it cancels the attempt); this track runs none"),
        ("set.stop-all", "every running task stopped at once: each track's Stop carries factory.task.stop for its own task, and no Action stops them all"),
        ("track.end", "a session ended: factory.session.end, on the track of a session seated in a project of this World; this track is none"),
        ("clip.delete", SESSION_ACT),
        ("clip.paste", SESSION_ACT),
        ("clip.insert", SESSION_ACT),
        ("clip.make", "the session's task of a constellation dropped on it: AIKit's task made on the session (encounter-task-configure), which no Action of the registry carries yet (O-I #1006)"),
        ("track.rename", SESSION_ACT),
        ("track.remove", SESSION_ACT),
        ("track.activator", SESSION_ACT),
        ("track.solo", "what you attend to: the agent shell hands it from the book's world context, and none is handed to this pane"),
        ("clip.duplicate", "a second task on one session: AIKit keeps one task per session, so a copy goes onto another session — Copy the task, then Paste it on a session that holds none"),
        ("clip.info", "a task's info text at AIKit: a task keeps its purpose, which its settings name"),
        ("clip.split", "Factory splitting a task: no op does"),
        ("clip.consolidate", "Factory joining tasks: no op does"),
        ("clip.crop", "Factory cropping a task: no op does"),
        ("slot.stop-button", "a batch row's own stop: Factory's stops are a session's or the harness's"),
        ("slot.record", "a recording path into a session: a task is made by AIKit, not recorded"),
        ("track.duplicate", "AIKit opening a session like another: no encounter op copies a session"),
        ("track.move", "an order of sessions: Factory lays them as AIKit lists them"),
        ("tracks.group", "a SessionSpace made of sessions: a group stands by what its head spawned"),
        ("track.colour", "a session's own colour: the grid wears its palette by place"),
        ("row.insert", "a batch row: the rows are the n-th task of every track, which Factory numbers and keeps no named row of"),
        ("row.rename", "a batch row's name: Factory numbers its batches"),
        ("row.duplicate", "a batch copied: no op copies the n-th task of every track"),
        ("row.delete", "a batch taken out: no op removes the n-th task of every track"),
    ])
}

/// One Factory task, as the Set lays it: its Run, its task_ref, its attempts in Factory's order, and the session that executes it.
struct Task {
    run: String,
    task: String,
    attempts: Vec<Attempt>,
    track: String,
    /// The Factory state that keeps it.
    state: String,
    /// Written on a session Factory started and not yet run: the session it runs on (factory.task.run).
    session: Option<String>,
    /// The person's words it was written from, as Factory's record of the session keeps them.
    words: Option<String>,
    /// Its place among the tasks written on its session, in the order they were written.
    rank: Option<usize>,
    /// Its Run belongs to a Central Flow (the run reading's `flowAssociations`), so a returned attempt's Return has somewhere to be received.
    flowed: bool,
}

/// A task as Factory's record of a session keeps it (`factory session list`): written on the session, run or not.
struct Written {
    run: String,
    words: Option<String>,
    track: String,
    session: String,
    state: String,
    rank: usize,
}

/// The World and the project a Factory state stands in (`<World>/Work/<project>/.factory/<state>`, session.rs `place`).
fn world_project(state: &str) -> Option<(String, String)> {
    let root = std::path::Path::new(state).parent()?.parent()?;
    let work = root.parent()?;
    (work.file_name()? == "Work").then_some(())?;
    Some((
        work.parent()?.to_string_lossy().into_owned(),
        root.file_name()?.to_string_lossy().into_owned(),
    ))
}

/// A session Factory started or ran a task on in a project of this World, which the sessions slice (the root register's SessionSpaces)
/// does not list: its track is laid from Factory's own record of the session (`factory session list`, from its start), else of the
/// attempt.
struct Seated {
    space: String,
    session: String,
    harness: Option<String>,
    /// The agent seated on it, by its census slug, as Factory's record of the session names it.
    agent: Option<String>,
    world: String,
    project: String,
    /// Open: its End session and a message dropped on it stand. An ended session keeps its track only while it holds tasks.
    open: bool,
}

fn factory(sessions: &Read, field: &Read, cells: &Read) -> ModeSet {
    let mut tracks: Vec<Track> = Vec::new();
    // The Agent sessions (AIKit's SessionSpaces of the root register): each space a group at the top, its sessions beneath it.
    match sessions.value.and_then(|value| value["spaces"].as_array()) {
        Some(spaces) => {
            for space in spaces {
                let Some(space_ref) = text(&space["definition"]["id"]) else {
                    continue;
                };
                let label = text(&space["label"]).map(str::to_owned);
                let members: Vec<(&String, &Value)> = space["agent_sessions"]
                    .as_object()
                    .map(|sessions| sessions.iter().collect())
                    .unwrap_or_default();
                let group = session_track(space_ref, space_ref);
                tracks.push(Track {
                    id: group.clone(),
                    name: label.clone().unwrap_or_else(|| space_ref.to_owned()),
                    kind: format!(
                        "a SessionSpace · {}",
                        plural(members.len(), "session", "sessions")
                    ),
                    ..Track::default()
                });
                for (session, attachment) in members {
                    let purpose = text(&attachment["purpose"]).map(str::to_owned);
                    let agent = text(&attachment["agent_ref"]).map(str::to_owned);
                    let mut parts = vec!["an Agent session".to_owned()];
                    if let Some(agent) = &agent {
                        parts.push(format!("its agent {agent}"));
                    }
                    parts.push("its AIKit task, needle and settings are no slice of the World Model yet (O-I #1006)".into());
                    tracks.push(Track {
                        id: session_track(space_ref, session),
                        name: purpose.unwrap_or_else(|| session.chars().take(12).collect()),
                        kind: parts.join(" · "),
                        depth: 1,
                        parent: Some(group.clone()),
                        ..Track::default()
                    });
                }
            }
        }
        None => tracks.push(Track {
            id: "factory:sessions".into(),
            name: "Agent sessions".into(),
            kind: "the Agent sessions of the root register (AIKit)".into(),
            absent: Some(format!("The Agent sessions are unread: {}", sessions.why())),
            ..Track::default()
        }),
    }
    if let Some(stale) = sessions.stale() {
        for track in tracks.iter_mut() {
            track.kind = format!("{} · {stale}", track.kind);
        }
    }

    // Factory's tasks and their attempts, from each located source's runs.
    let mut tasks: Vec<Task> = Vec::new();
    let mut written: Vec<Written> = Vec::new();
    let mut seated: BTreeMap<String, Seated> = BTreeMap::new();
    let mut run_tracks: Vec<Track> = Vec::new();
    match field.value {
        None => run_tracks.push(Track {
            id: "factory:runs".into(),
            name: "Factory".into(),
            kind: "Factory's runs, tasks and attempts".into(),
            absent: Some(format!("Factory's runs are unread: {}", field.why())),
            ..Track::default()
        }),
        Some(value) => {
            let sources = value["sources"].as_array().cloned().unwrap_or_default();
            if sources.is_empty() {
                let said: Vec<String> = value["located"]["locations"]
                    .as_array()
                    .into_iter()
                    .flatten()
                    .filter_map(|row| row["error"].as_str().map(str::to_owned))
                    .collect();
                run_tracks.push(Track {
                    id: "factory:runs".into(),
                    name: "Factory".into(),
                    kind: "Factory's runs, tasks and attempts".into(),
                    absent: Some(if said.is_empty() {
                        "Factory finds no state in this World: no source in scope keeps one".into()
                    } else {
                        format!("Factory finds no state in this World: {}", said.join("; "))
                    }),
                    ..Track::default()
                });
            }
            for source in &sources {
                let project = text(&source["project"]).map(str::to_owned);
                let state_path = text(&source["state_path"]).unwrap_or_default().to_owned();
                let place = world_project(&state_path);
                // The sessions Factory started in this project (`factory session list`, O-I #1006): each its own track from its start,
                // open with its acts, or ended; each task written on it a clip on that track before it runs.
                for kept in source["sessions"]["reading"]["sessions"]
                    .as_array()
                    .into_iter()
                    .flatten()
                {
                    let (Some(space), Some(session)) =
                        (text(&kept["space"]), text(&kept["session"]))
                    else {
                        continue;
                    };
                    let id = session_track(space, session);
                    let (Some(world), Some(project)) = (
                        text(&kept["world"])
                            .map(str::to_owned)
                            .or_else(|| place.as_ref().map(|(world, _)| world.clone())),
                        text(&kept["project"])
                            .map(str::to_owned)
                            .or_else(|| place.as_ref().map(|(_, project)| project.clone())),
                    ) else {
                        continue;
                    };
                    if !tracks.iter().any(|t| t.id == id) {
                        seated.entry(id.clone()).or_insert_with(|| Seated {
                            space: space.to_owned(),
                            session: session.to_owned(),
                            harness: None,
                            agent: text(&kept["agent"]).map(str::to_owned),
                            world,
                            project,
                            open: kept["state"] == "open",
                        });
                    }
                    for (rank, task) in kept["tasks"].as_array().into_iter().flatten().enumerate() {
                        let Some(run) = text(&task["run_ref"]) else {
                            continue;
                        };
                        written.push(Written {
                            run: run.to_owned(),
                            words: text(&task["task"]).map(str::to_owned),
                            track: id.clone(),
                            session: session.to_owned(),
                            state: state_path.clone(),
                            rank,
                        });
                    }
                }
                if source["journeys"]["state"] == "refused" {
                    run_tracks.push(Track {
                        id: format!(
                            "factory:source:{}",
                            source["project_ref"].as_str().unwrap_or("root")
                        ),
                        name: "Factory".into(),
                        kind: format!(
                            "Factory's state at {}",
                            source["state_path"].as_str().unwrap_or("its state path")
                        ),
                        absent: Some(format!(
                            "Factory did not read its journeys, so its runs are unknown: {}",
                            source["journeys"]["why"]
                                .as_str()
                                .unwrap_or("no reason given")
                        )),
                        ..Track::default()
                    });
                }
                for run in source["runs"].as_array().into_iter().flatten() {
                    let Some(run_ref) = text(&run["run_ref"]) else {
                        continue;
                    };
                    let lifecycle = text(&run["run"]["reading"]["lifecycle"]).map(str::to_owned);
                    let flowed = run["run"]["reading"]["flowAssociations"]
                        .as_array()
                        .is_some_and(|flows| !flows.is_empty());
                    let executions: HashMap<String, String> = run["run"]["reading"]["executions"]
                        .as_array()
                        .into_iter()
                        .flatten()
                        .filter_map(|execution| {
                            let session = text(&execution["agentSessionRef"])?;
                            let space = text(&execution["sessionSpaceRef"])?;
                            Some((
                                text(&execution["executionRef"])?.to_owned(),
                                session_track(space, session),
                            ))
                        })
                        .collect();
                    let mut absent = Vec::new();
                    if run["run"]["state"] == "refused" {
                        absent.push(format!(
                            "Factory did not read this run: {}",
                            run["run"]["why"].as_str().unwrap_or("no reason given")
                        ));
                    }
                    if run["attempts"]["state"] == "refused" {
                        absent.push(format!(
                            "Factory did not read this run's attempts: {}",
                            run["attempts"]["why"].as_str().unwrap_or("no reason given")
                        ));
                    }
                    let mut placed_on_run = false;
                    let legs = &run["attempts"]["reading"]["legs"];
                    for record in run["attempts"]["reading"]["attempts"]
                        .as_array()
                        .into_iter()
                        .flatten()
                    {
                        let Some(mut attempt) = attempt_of(record) else {
                            continue;
                        };
                        // A stopped attempt: the leg of its unit, where it is the unit's current one, says its cancellation was accepted
                        // or its process ended, which its record alone does not.
                        if attempt.state == "running" {
                            let leg = attempt.unit_ref.as_deref().map(|unit| &legs[unit]);
                            let current = text(&record["executionRef"])
                                .or_else(|| text(&record["reservedExecutionRef"]));
                            if leg.is_some_and(|leg| {
                                text(&leg["executionRef"]) == current
                                    && matches!(
                                        leg["status"].as_str(),
                                        Some("cancellation_accepted" | "process_terminated")
                                    )
                            }) {
                                attempt.state = "cancelled";
                            }
                        }
                        // On the session that executes it, as the Run's executions name it; else on the session Factory's own record
                        // of the attempt names (a session Factory ran it on, O-I #1006), laid from that record when the root
                        // register's sessions do not list it.
                        let on = attempt
                            .execution
                            .as_ref()
                            .and_then(|execution| executions.get(execution))
                            .filter(|track| tracks.iter().any(|t| &t.id == *track))
                            .cloned()
                            .or_else(|| {
                                let (space, session) = attempt.session.as_ref()?;
                                let id = session_track(space, session);
                                if !tracks.iter().any(|t| t.id == id) {
                                    let (world, project) = place.clone()?;
                                    let entry =
                                        seated.entry(id.clone()).or_insert_with(|| Seated {
                                            space: space.clone(),
                                            session: session.clone(),
                                            harness: None,
                                            agent: None,
                                            world,
                                            project,
                                            open: true,
                                        });
                                    if entry.harness.is_none() {
                                        entry.harness.clone_from(&attempt.harness);
                                    }
                                }
                                Some(id)
                            });
                        match tasks
                            .iter_mut()
                            .find(|task| task.run == run_ref && task.task == attempt.task)
                        {
                            Some(task) => {
                                if task.track == run_track(run_ref) {
                                    if let Some(on) = on {
                                        task.track = on;
                                    }
                                }
                                task.attempts.push(attempt);
                            }
                            None => {
                                let track = on.unwrap_or_else(|| run_track(run_ref));
                                tasks.push(Task {
                                    run: run_ref.to_owned(),
                                    task: attempt.task.clone(),
                                    attempts: vec![attempt],
                                    track,
                                    state: state_path.clone(),
                                    session: None,
                                    words: None,
                                    rank: None,
                                    flowed,
                                });
                            }
                        }
                    }
                    placed_on_run |= tasks
                        .iter()
                        .any(|task| task.run == run_ref && task.track == run_track(run_ref));
                    if placed_on_run || !absent.is_empty() {
                        let mut parts = vec![format!("a Factory Run ({run_ref})")];
                        if let Some(lifecycle) = &lifecycle {
                            parts.push(lifecycle.clone());
                        }
                        parts.push(match &project {
                            Some(project) => format!("{project}'s Factory state"),
                            None => "your world's Factory state".into(),
                        });
                        if placed_on_run {
                            parts.push(
                                "its tasks name no Agent session of the root register".into(),
                            );
                        }
                        run_tracks.push(Track {
                            id: run_track(run_ref),
                            name: format!(
                                "Run {}",
                                run_ref
                                    .rsplit(':')
                                    .next()
                                    .unwrap_or(run_ref)
                                    .chars()
                                    .take(10)
                                    .collect::<String>()
                            ),
                            kind: parts.join(" · "),
                            absent: (!absent.is_empty()).then(|| absent.join("; ")),
                            ..Track::default()
                        });
                    }
                }
            }
        }
    }
    if let Some(stale) = field.stale() {
        for track in run_tracks.iter_mut() {
            track.kind = format!("{} · {stale}", track.kind);
        }
    }
    // A task written on a session and not yet run is a clip on the session's track before it runs; one that ran keeps the person's
    // words it was written from. The tasks of a session lie in the order they were written.
    for kept in written {
        match tasks.iter_mut().find(|task| task.run == kept.run) {
            Some(task) => {
                task.words = kept.words.or(task.words.take());
                task.rank = Some(kept.rank);
            }
            None => tasks.push(Task {
                task: kept.run.clone(),
                run: kept.run,
                attempts: Vec::new(),
                track: kept.track,
                state: kept.state,
                session: Some(kept.session),
                words: kept.words,
                rank: Some(kept.rank),
                flowed: false,
            }),
        }
    }
    tasks.sort_by_key(|task| task.rank.unwrap_or(usize::MAX));
    // The sessions Factory started or ran a task on in a project of this World that the root register does not list: each its own
    // track, laid from Factory's record. An open one's menu ends it (End session: factory.session.end; manual §19.1), and a message
    // dropped on it is written as its next task (factory.task.write, its words the instruction; §19.24 "To turn one into work, drag it
    // onto the agent's track"). An ended one keeps its track while it holds tasks, and takes neither.
    for (id, seated) in &seated {
        if !seated.open && !tasks.iter().any(|task| &task.track == id) {
            continue;
        }
        let harness = seated
            .harness
            .as_deref()
            .map(|harness| harness.trim_start_matches("harness/").to_owned())
            .or_else(|| seated.agent.clone());
        let name = harness.clone().unwrap_or_else(|| {
            let session = seated.session.rsplit('/').next().unwrap_or(&seated.session);
            session.chars().take(16).collect()
        });
        let mut acts = BTreeMap::new();
        if seated.open {
            acts.insert(
                "endSession".to_owned(),
                done(
                    act(
                        "factory.session.end",
                        json!({"world": seated.world, "project": seated.project, "session": seated.session}),
                        None,
                        "Factory's factory.session.end: the session ended — a running turn stopped, its record closed, its body released",
                    ),
                    format!("{name}'s session has ended: its record is closed."),
                ),
            );
            acts.insert(
                "writeTask".to_owned(),
                done(
                    act(
                        "factory.task.write",
                        json!({"world": seated.world, "project": seated.project, "session": seated.session}),
                        Some("instruction"),
                        "Factory's factory.task.write: the words dropped on the session's track written as its next task, a Run Factory commissions for it",
                    ),
                    format!("A task is written on {name}'s session: run it from its clip."),
                ),
            );
        }
        tracks.push(Track {
            id: id.clone(),
            name: name.clone(),
            kind: format!(
                "an Agent session seated in {} · {} · {} (its SessionSpace {} is no root register's)",
                seated.project,
                harness.map_or_else(|| "its harness unnamed".to_owned(), |harness| format!("its harness {harness}")),
                if seated.open {
                    "open, laid from Factory's record of it"
                } else {
                    "ended: its record is closed, and its tasks stay"
                },
                seated.space
            ),
            acts,
            ..Track::default()
        });
    }
    tracks.extend(run_tracks);
    // A track whose task is running carries its Stop (factory.task.stop): the turn paused, and pressed again the attempt cancelled.
    for task in &tasks {
        let Some(last) = task
            .attempts
            .last()
            .filter(|attempt| attempt.state == "running")
        else {
            continue;
        };
        if task.state.is_empty() {
            continue;
        }
        if let Some(track) = tracks.iter_mut().find(|track| track.id == task.track) {
            track.acts.insert(
                "stopTrack".into(),
                done(
                    act(
                        "factory.task.stop",
                        json!({"state": task.state, "run_ref": task.run, "attempt_ref": last.reference}),
                        None,
                        "Factory's factory.task.stop: the running task paused (AIKit cancels the turn); pressed again, its attempt cancelled",
                    ),
                    format!("{}'s task is stopped: paused, or cancelled when it was paused already.", track.name),
                ),
            );
        }
    }
    // A task whose last attempt failed has stalled, and its track lights a retry (manual §19.1 "When a task on the track stalls, the
    // track lights a retry. Retry starts again from the last good step, on the same basis"): Factory's factory.attempt.retry, a new
    // attempt under the retry grant the failed one consumed, run again on its session. The track's latest stalled task is the one it
    // retries; a cancelled task is not retried (Factory's engine), nor a task on a session that has ended.
    for task in &tasks {
        let Some(unit) = task
            .attempts
            .last()
            .filter(|attempt| attempt.state == "failed")
            .and_then(|attempt| attempt.unit_ref.as_ref())
        else {
            continue;
        };
        if task.state.is_empty() || seated.get(&task.track).is_some_and(|seated| !seated.open) {
            continue;
        }
        if let Some(track) = tracks.iter_mut().find(|track| track.id == task.track) {
            track.acts.insert(
                "retry".into(),
                done(
                    act(
                        "factory.attempt.retry",
                        json!({"state": task.state, "run_ref": task.run, "unit_ref": unit}),
                        None,
                        "Factory's factory.attempt.retry: the stalled task run again on the same basis, a new attempt under the retry grant its failed one consumed",
                    ),
                    format!("{}'s stalled task runs again: a new attempt, its earlier one kept as a take.", track.name),
                ),
            );
        }
    }
    for (index, track) in tracks.iter_mut().enumerate() {
        track.color = Some(FACTORY_PALETTE[index % FACTORY_PALETTE.len()].to_owned());
    }

    // Each task a clip on its track, in the row of its place there; each attempt a take under it.
    let mut ordinal: HashMap<String, usize> = HashMap::new();
    let mut clips = Vec::new();
    let mut takes = Vec::new();
    let mut origin: Option<u64> = None;
    for task in &tasks {
        let n = {
            let count = ordinal.entry(task.track.clone()).or_insert(0);
            *count += 1;
            *count
        };
        let id = task_clip(&task.track, n);
        let last = task.attempts.last();
        let starts: Vec<u64> = task.attempts.iter().filter_map(|a| a.start).collect();
        let ended = task.attempts.iter().all(|a| a.end.is_some());
        let start = starts.iter().min().copied();
        if let Some(start) = start {
            origin = Some(origin.map_or(start, |at| at.min(start)));
        }
        let unit = task.attempts.iter().find_map(|a| a.unit.clone());
        let mut seen: HashMap<String, usize> = HashMap::new();
        for attempt in &task.attempts {
            let k = {
                let count = seen
                    .entry(attempt.unit.clone().unwrap_or_default())
                    .or_insert(0);
                *count += 1;
                *count
            };
            if let Some(start) = attempt.start {
                origin = Some(origin.map_or(start, |at| at.min(start)));
            }
            // A returned take whose Return Central has not received is chosen to stand (manual §19.1 "Choosing a take that stands sends
            // it to review in Approvals"): Factory's factory.attempt.choose, into the Flow its Run belongs to. A Run that belongs to no
            // Flow — a task written on a session's track — has nowhere to receive a Return, so its takes offer no choice: their
            // difference stays in the session's checkout, which Git / landing lands.
            let mut take_acts = BTreeMap::new();
            if attempt.state == "returned"
                && attempt.receiving.is_none()
                && task.flowed
                && !task.state.is_empty()
            {
                take_acts.insert(
                    "choose".to_owned(),
                    done(
                        act(
                            "factory.attempt.choose",
                            json!({"state": task.state, "run_ref": task.run, "attempt_ref": attempt.reference}),
                            None,
                            "Factory's factory.attempt.choose: the take chosen to stand, its Return proposed to Central's receiving field, where Approvals lists it",
                        ),
                        "The take is chosen to stand: its Return waits for you in Approvals.".to_owned(),
                    ),
                );
            }
            takes.push(Take {
                id: attempt_take(&attempt.reference),
                clip: id.clone(),
                track: task.track.clone(),
                name: match &attempt.unit {
                    Some(unit) => format!("{unit} · take {k}"),
                    None => format!("take {k}"),
                },
                state: attempt.state.into(),
                standing: attempt.receiving.is_some(),
                // A prepared attempt has not run: it stands at its instant. A running one is open, to now.
                at: attempt.start.map(|start| Span {
                    start_unix_ms: start,
                    end_unix_ms: if attempt.state == "prepared" {
                        Some(start)
                    } else {
                        attempt.end
                    },
                }),
                words: match &attempt.summary {
                    Some(summary) => format!("{} · {summary}", take_words(attempt)),
                    None => take_words(attempt),
                },
                run: Some(task.run.clone()),
                unit: attempt.unit_ref.clone(),
                acts: take_acts,
                ..Take::default()
            });
        }
        // A task written on a session and not yet run runs from its clip (factory.task.run on its Run, on that session). One that ran
        // does not run again from here: a stalled one runs again from its track's retry, on the same basis.
        let mut clip_acts = BTreeMap::new();
        if let (None, Some(session)) = (last, &task.session) {
            clip_acts.insert(
                "launch".to_owned(),
                done(
                    act(
                        "factory.task.run",
                        json!({"state": task.state, "run_ref": task.run, "session": session}),
                        None,
                        "Factory's factory.task.run: the task run on its session under your grant, its log streaming, its end an attempt with its diff",
                    ),
                    format!("Task {} is running on its session.", task.words.as_deref().unwrap_or(&task.run)),
                ),
            );
        }
        clips.push(Clip {
            id,
            track: task.track.clone(),
            row: format!("batch:{n}"),
            subject: Some(task.task.clone()),
            acts: clip_acts,
            label: task.words.clone().or(unit).unwrap_or_else(|| {
                format!(
                    "Task {}",
                    task.task
                        .rsplit(':')
                        .next()
                        .unwrap_or(&task.task)
                        .chars()
                        .take(10)
                        .collect::<String>()
                )
            }),
            // A stalled task lights its track's retry; one written and not yet run waits for its launch.
            status: match last.map(|a| a.state) {
                Some("returned") => Some("done".to_owned()),
                Some("running") => Some("running".to_owned()),
                Some("prepared") | None => Some("waiting".to_owned()),
                Some("failed") => Some("stalled".to_owned()),
                Some("cancelled") => Some("stopped".to_owned()),
                Some(_) => None,
            },
            state: Some(last.map_or("written", |a| a.state).to_owned()),
            at: start.map(|start| Span {
                start_unix_ms: start,
                end_unix_ms: if ended {
                    task.attempts.iter().filter_map(|a| a.end).max()
                } else {
                    None
                },
            }),
            note: Some(match last {
                Some(last) => format!(
                    "Factory's task {} in run {} · {} · the latest {}",
                    task.task,
                    task.run,
                    plural(task.attempts.len(), "attempt", "attempts"),
                    take_words(last)
                ),
                None => format!(
                    "Factory's task in run {}, written on its session and not yet run: its launch runs it there",
                    task.run
                ),
            }),
            ..Clip::default()
        });
    }
    let row_count = ordinal
        .values()
        .copied()
        .max()
        .map_or(0, |n| n + 1)
        .max(FACTORY_MIN_ROWS);
    let rows = (1..=row_count)
        .map(|n| Row {
            id: format!("batch:{n}"),
            name: n.to_string(),
            ..Row::default()
        })
        .collect();

    // The workcells of the machine's register as return tracks (§19.23), holding no clips and taking none of the Set's acts.
    let register = register_workcells(cells);
    // Seating an agent on a new track (manual §19.1: drag it from the browser onto an empty track): factory.session.start in the
    // project of this World whose workcell seat is held, the agent the census slug the drop names.
    let seats: Vec<(String, String)> = field
        .value
        .and_then(|value| value["located"]["locations"].as_array())
        .into_iter()
        .flatten()
        .filter_map(|row| {
            let root = std::path::Path::new(text(&row["root"])?);
            let work = root.parent()?;
            (work.file_name()? == "Work").then_some(())?;
            Some((
                work.parent()?.to_string_lossy().into_owned(),
                root.file_name()?.to_string_lossy().into_owned(),
            ))
        })
        .filter(|(_, project)| works_in(&register, project).is_ok())
        .collect();
    let mut waiting = factory_waiting();
    let mut acts = BTreeMap::from([
        (
            "arm".to_owned(),
            act("shell.setWriteArm", Value::Null, Some("on"), ARM_WORDS),
        ),
        (
            "solo".to_owned(),
            act("shell.setSolo", Value::Null, Some("on"), SOLO_WORDS),
        ),
    ]);
    let seat_in = |world: &str, project: &str| {
        done(
            act(
                "factory.session.start",
                json!({"world": world, "project": project}),
                Some("agent"),
                &format!("Factory's factory.session.start: the agent seated on a new track in {project}, its session opened in the checkout {project}'s workcell seat holds and its record opened"),
            ),
            format!("The agent is seated on a new track in {project}: its session is open."),
        )
    };
    match seats.as_slice() {
        [(world, project)] => {
            acts.insert("seat".into(), seat_in(world, project));
        }
        [] => {
            waiting.insert("track.seat".into(), "an agent seated on a new track: factory.session.start opens its session in a project's workcell seat, and no project of this World holds one (Workcell's seat join)".into());
        }
        several => {
            // A drop names no project, so the empty track waits; a press that names its project (Setup's Launch, one per agent that
            // starts) runs that project's own seat act, `seat:<project>`.
            for (world, project) in several {
                acts.insert(format!("seat:{project}"), seat_in(world, project));
            }
            let named: Vec<&str> = several
                .iter()
                .map(|(_, project)| project.as_str())
                .collect();
            waiting.insert("track.seat".into(), format!("an agent seated on a new track: factory.session.start opens its session in one project, and several hold a workcell seat ({}), which a drop does not choose between", named.join(", ")));
        }
    }
    let mut mixer = factory_mixer();
    match &register {
        Ok(workcells) => tracks.extend(workcells.iter().map(|(name, _)| Track {
            id: workcell_track(name),
            name: name.clone(),
            kind: "workcell".into(),
            returns: true,
            read_only: true,
            ..Track::default()
        })),
        Err(why) => {
            mixer.insert(
                "works".into(),
                Control {
                    disabled: Some(format!(
                        "{WORKS_IN_CHOICE} The seat register is unread: {why}"
                    )),
                    ..control(WORKS_IN_MEANING)
                },
            );
        }
    }
    mixer.entry("works".into()).or_insert_with(|| Control {
        disabled: Some(WORKS_IN_CHOICE.into()),
        ..control(WORKS_IN_MEANING)
    });

    let mut lanes_absent = words(&[
        ("automation", "The Agent's effort over a run: no owner keeps its moves over time, so no automation lane is read."),
        ("events", "A session's events by their kind (run, return, generation …): the temporal stream is no slice of the World Model yet (O-I #1006)."),
    ]);
    if takes.is_empty() {
        lanes_absent.insert("takes".into(), "No task Factory holds has an attempt yet: Factory records each attempt it dispatches on its task.".into());
    }
    ModeSet {
        ruler: Some(Ruler {
            kind: "clock".into(),
            unit: "seconds".into(),
            date: None,
            origin_unix_ms: origin,
        }),
        rows,
        tracks,
        clips,
        takes,
        main: Some(Main {
            track: None,
            name: "Main".into(),
            chain: FACTORY_MAIN_CHAIN
                .iter()
                .map(|link| (*link).to_owned())
                .collect(),
        }),
        mixer,
        lanes_absent,
        acts,
        waiting,
        ..ModeSet::default()
    }
}

// ------------------------------------------------------------------ Expressions

/// The id of the n-th row of Expressions' grid, from 1: a stop, each open Expression's n-th Scene (manual §20.1, The Main track: "each
/// row is a moment across several Expressions").
pub fn expression_row(n: usize) -> String {
    format!("expressions:stop:{n}")
}

/// The track that says why the works home, or a file of it, gives no work.
pub const EXPRESSIONS_HOME_TRACK: &str = "expressions:home";

/// Expressions' Main track (manual §20.1, The Main track): its Volume is every Expression's level together.
pub const EXPRESSIONS_MAIN_TRACK: &str = "expressions:main";

/// Expressions' mixer row (manual §20.1, The mixer row): Volume, the Activator, Solo and Arm are each one Expression's, written by
/// one Action on its track; Monitor is none.
fn expressions_mixer() -> BTreeMap<String, Control> {
    let mut mixer = BTreeMap::new();
    mixer.insert(
        "volume".into(),
        Control {
            grain: Some(
                "from silence (0) to +6 dB (2); 1 is the level the Expression was made at".into(),
            ),
            ..control("The level of the Expression's sound (expressions.mix.set, its level)")
        },
    );
    mixer.insert("activator".into(), control("The Expression plays, or it does not: off, its Scenes do not launch and its track is dimmed (expressions.mix.set, active)"));
    mixer.insert("solo".into(), control("Lets you hear only this Expression's sound: another's Solo silences the ones not soloed, and nothing stops (expressions.mix.set, solo)"));
    mixer.insert("arm".into(), control("Arms the Expression for a take: with Arm on, Play records the Studio as a take of the Scene it launches (expressions.arm)"));
    mixer.insert("monitor".into(), Control {
        disabled: Some("None in Expressions (manual §20.1): an Expression's sound goes to the Main track as its field plays it.".into()),
        ..control("Monitor")
    });
    mixer
}

/// What Expressions' acts no single Action carries wait for, by the op the menu names.
fn expressions_waiting() -> BTreeMap<String, String> {
    words(&[
        ("clip.edit", "a Scene's Clip and Launch panels — its name, length, transition, colour, Quantize and follow action — are the field's own editor's, which writes them on the presented Scene; no Action of the registry carries them yet — missing op: expressions.scene.edit {rename, pacing, clip} (Expressions)"),
        ("take.audition", "a take heard in place of its main lane is the field's hearing, not a write: the field auditions the presented Scene's Torus lanes from its own take lane controls"),
    ])
}

fn expressions_lanes_absent() -> BTreeMap<String, String> {
    words(&[
        ("automation", "The Scene each Expression has selected holds no recorded lane and no generator lane: a kept take lays its moves on one."),
        ("events", "Expressions keeps no events beside its Scenes and their takes."),
    ])
}

/// A number of seconds as the Set says it.
fn seconds(value: &Value) -> String {
    let seconds = value.as_f64().unwrap_or(0.0);
    let rounded = (seconds * 10.0).round() / 10.0;
    format!("{rounded} s")
}

/// One take of a Scene as the Set lays it (the store's reading: expression.rs `work_reading`, expression_studio.rs `take_summary`).
fn expression_take(
    work: &str,
    scene_ref: &str,
    take: &Value,
    recording: Option<&Value>,
) -> Option<Take> {
    let take_ref = text(&take["take_ref"])?;
    let running = take["state"] == "running";
    let kept = take["kept"].is_object();
    let lane = take["lane"].as_u64().unwrap_or(0);
    let (name, mut words) = if take["kind"] == "torus" {
        (
            format!("Torus take {}", lane + 1),
            format!(
                "a take of the Torus, {} from {} of its performance",
                seconds(&take["seconds"]),
                seconds(&take["start_s"])
            ),
        )
    } else {
        let binds = take["binds"].as_array().map_or(0, Vec::len);
        (
            format!("Take {lane}"),
            format!(
                "a take of the Studio on lane {lane}: {}, {} over {}",
                plural(binds, "value", "values"),
                plural(
                    take["points"].as_u64().unwrap_or(0) as usize,
                    "point",
                    "points"
                ),
                seconds(&take["seconds"])
            ),
        )
    };
    if running {
        words.push_str(" · recording now");
    }
    if kept {
        words.push_str(&format!(
            " · kept from {} to {} into the main lane",
            seconds(&take["kept"]["from_s"]),
            seconds(&take["kept"]["to_s"])
        ));
    }
    let mut acts = BTreeMap::new();
    let take_input = json!({"expression_ref": work, "scene_ref": scene_ref, "take_ref": take_ref});
    if !running && !kept {
        acts.insert(
            "choose".to_owned(),
            done(
                act(
                    "expressions.take.keep",
                    take_input.clone(),
                    Some("*"),
                    "Expressions' expressions.take.keep: the take kept, whole or the stretch chosen (from_s, to_s), into its Scene's main lane",
                ),
                format!("{name} is kept into the main lane."),
            ),
        );
    }
    if kept {
        acts.insert(
            "unchoose".to_owned(),
            done(
                act(
                    "expressions.take.unkeep",
                    take_input,
                    Some("*"),
                    "Expressions' expressions.take.unkeep: the kept take taken back out of its Scene's main lane",
                ),
                format!("{name} is taken back out of the main lane."),
            ),
        );
    }
    let torus = take["kind"] == "torus";
    let lane_ref = text(&take["lane_ref"]);
    if let (true, Some(lane_ref)) = (torus, lane_ref) {
        acts.insert(
            "lane".to_owned(),
            act(
                "expressions.take.lane",
                json!({"expression_ref": work, "scene_ref": scene_ref, "lane_ref": lane_ref}),
                Some("*"),
                "Expressions' expressions.take.lane: the take lane's Activator and Solo, kept on its lane in the Scene's performance",
            ),
        );
    }
    let start = take["start_s"].as_f64().unwrap_or(0.0);
    let length = take["seconds"].as_f64().unwrap_or(0.0);
    Some(Take {
        id: take_ref.to_owned(),
        clip: scene_ref.to_owned(),
        track: work.to_owned(),
        name,
        state: if running { "running" } else { "returned" }.into(),
        standing: kept,
        at: recording
            .filter(|_| running)
            .and_then(|recording| recording["started_at_unix_ms"].as_u64())
            .map(|start| Span {
                start_unix_ms: start,
                end_unix_ms: None,
            }),
        words,
        within: Some(Stretch {
            start_s: start,
            end_s: start + length,
        }),
        kept: take["kept"].is_object().then(|| Stretch {
            start_s: take["kept"]["from_s"].as_f64().unwrap_or(start),
            end_s: take["kept"]["to_s"].as_f64().unwrap_or(start + length),
        }),
        lane: torus.then(|| LaneSetting {
            enabled: take["enabled"] != false,
            solo: take["solo"] == true,
        }),
        acts,
        ..Take::default()
    })
}

/// Expressions' Set (manual §20.1): each work of the expression store a track, the open ones holding their Scenes as clips on the
/// rows (a row is a stop: each open work's n-th Scene) with the takes under them and the Studio of the Scene each has selected, the
/// closed ones (the works home's) each opened from its file; every act is an `expressions.*` Action.
fn expressions(store: &Read) -> ModeSet {
    let mixer = expressions_mixer();
    let lanes_absent = expressions_lanes_absent();
    let waiting = expressions_waiting();
    let Some(value) = store.value else {
        return ModeSet {
            tracks: vec![Track {
                id: "expressions:works".into(),
                name: "Expressions".into(),
                kind: "the works of the expression store: the open ones, then the works home's"
                    .into(),
                absent: Some(format!("The Expressions are unread: {}", store.why())),
                ..Track::default()
            }],
            mixer,
            lanes_absent,
            waiting,
            ..ModeSet::default()
        };
    };
    let playback = &value["playback"];
    let by_work = |list: &'static str| -> BTreeMap<String, Value> {
        playback[list]
            .as_array()
            .into_iter()
            .flatten()
            .filter_map(|entry| Some((text(&entry["expression_ref"])?.to_owned(), entry.clone())))
            .collect()
    };
    let launched = by_work("launched");
    let recordings = by_work("recordings");
    let armed: std::collections::BTreeSet<&str> = playback["armed"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(Value::as_str)
        .collect();
    let mut tracks: Vec<Track> = Vec::new();
    let mut clips: Vec<Clip> = Vec::new();
    let mut takes: Vec<Take> = Vec::new();
    let mut lanes: Vec<Lane> = Vec::new();
    // The work the field presents: the open work touched last, which the reading lists first.
    let mut presented: Option<Value> = None;
    // Each stop's launches: every open work's n-th Scene that holds material, on a work whose Activator is on.
    let mut stops: Vec<Vec<Value>> = Vec::new();
    for work in value["works"].as_array().into_iter().flatten() {
        let Some(reference) = text(&work["expression_ref"]) else {
            continue;
        };
        let title = text(&work["title"]).unwrap_or(reference).to_owned();
        let color = text(&work["colour"]).map(str::to_owned);
        let location = &work["location"];
        let path = text(&location["path"]);
        if work["open"] != true {
            let mut acts = BTreeMap::new();
            if location.is_object() {
                acts.insert("open".to_owned(), done(
                    act("expressions.open", json!({"location": location, "expected_file_revision": work["file_revision"]}), None,
                        "Expressions' expressions.open: the Expression opened from its file, as its file holds it"),
                    format!("{title} is open: its Scenes are on its track."),
                ));
                acts.insert("delete".to_owned(), done(
                    act("expressions.delete", json!({"expression_ref": reference, "location": location,
                        "expected_file_revision": work["file_revision"]}), None,
                        "Expressions' expressions.delete: the Expression's file taken to Central's trash, from where its history brings it back"),
                    format!("{title} is in Central's trash."),
                ));
            }
            tracks.push(Track {
                id: reference.to_owned(),
                name: title,
                kind: match path {
                    Some(path) => format!(
                        "an Expression, closed · its file {path} · open it to play its Scenes"
                    ),
                    None => "an Expression, closed".into(),
                },
                color,
                acts,
                ..Track::default()
            });
            continue;
        }
        let active = work["mix"]["active"] != false;
        let solo = work["mix"]["solo"] == true;
        let level = work["mix"]["level"].as_f64().unwrap_or(1.0);
        let playing = launched.get(reference);
        let recording = recordings.get(reference);
        let scenes = work["scenes"].as_array().map(Vec::as_slice).unwrap_or(&[]);
        let mut kind = vec![format!(
            "an Expression · {}",
            plural(scenes.len(), "Scene", "Scenes")
        )];
        kind.push(match path {
            Some(path) => format!("its file {path}"),
            None => "not saved to a file yet".into(),
        });
        if work["dirty"] == true {
            kind.push("changed since it was saved".into());
        }
        if let Some(playing) = playing {
            let scene = scenes
                .iter()
                .find(|scene| scene["scene_ref"] == playing["scene_ref"]);
            let named = scene
                .and_then(|scene| text(&scene["title"]))
                .unwrap_or("a Scene");
            kind.push(if playing["saved"] == true {
                format!("plays the saved version of {named}")
            } else {
                format!("plays {named}")
            });
        }
        if let Some(recording) = recording {
            kind.push(format!(
                "records {}",
                text(&recording["take_ref"]).unwrap_or("a take")
            ));
        } else if armed.contains(reference) {
            kind.push("armed: Play records a take".into());
        }
        if !active {
            kind.push("its Activator is off: its Scenes do not launch".into());
        }
        let work_input = json!({"expression_ref": reference});
        let mix_act = |key: &str, words: &str| {
            act(
                "expressions.mix.set",
                json!({"expression_ref": reference, "key": key}),
                Some("value"),
                words,
            )
        };
        let mut acts = BTreeMap::from([
            ("arm".to_owned(), act("expressions.arm", work_input.clone(), Some("on"),
                "Expressions' expressions.arm: armed, Play records the Studio as a take; disarmed, the take it records is closed and laid on its Scene")),
            ("activator".to_owned(), mix_act("active", "Expressions' expressions.mix.set: the Activator, on or off")),
            ("solo".to_owned(), mix_act("solo", "Expressions' expressions.mix.set: Solo, on or off")),
            ("volume".to_owned(), mix_act("level", "Expressions' expressions.mix.set: the Expression's level, from silence (0) to +6 dB (2)")),
            ("save".to_owned(), done(
                act("expressions.save", work_input.clone(), None, "Expressions' expressions.save: the Expression saved to its file, or into the works home when it has none"),
                format!("{title} is saved."),
            )),
            ("duplicate".to_owned(), done(
                act("expressions.duplicate", work_input.clone(), None, "Expressions' expressions.duplicate: a copy under a fresh ref and a title the works do not use yet, saved into the works home"),
                format!("A copy of {title} is open and saved."),
            )),
            ("delete".to_owned(), done(
                act("expressions.delete", work_input.clone(), None, "Expressions' expressions.delete: the Expression's file taken to Central's trash, from where its history brings it back"),
                format!("{title} is in Central's trash."),
            )),
            ("renameTrack".to_owned(), act("expressions.scene.edit", json!({"expression_ref": reference, "operation": "expression-title"}), Some("title"),
                "Expressions' expressions.scene.edit · expression-title: the Expression's title")),
            ("colourTrack".to_owned(), act("expressions.scene.edit", json!({"expression_ref": reference, "operation": "colour"}), Some("colour"),
                "Expressions' expressions.scene.edit · colour: the Expression's colour, kept in its document")),
            ("trackInfo".to_owned(), act("expressions.scene.edit", json!({"expression_ref": reference, "operation": "expression-description"}), Some("description"),
                "Expressions' expressions.scene.edit · expression-description: the Expression's description, its track's info text")),
            ("insertClip".to_owned(), done(
                act("expressions.scene.edit", json!({"expression_ref": reference, "operation": "add"}), None,
                    "Expressions' expressions.scene.edit · add: a blank Scene after the one the Expression has selected"),
                "A blank Scene is added after the selected one.".into(),
            )),
        ]);
        let held: Vec<String> = playback["held"][reference]
            .as_array()
            .into_iter()
            .flatten()
            .filter_map(|target| target.as_str().map(str::to_owned))
            .collect();
        if !held.is_empty() {
            kind.push(format!(
                "{} held off {} automation by hand",
                plural(held.len(), "value", "values"),
                if held.len() == 1 { "its" } else { "their" }
            ));
            acts.insert("reenable".to_owned(), done(
                act("expressions.studio.reenable", work_input.clone(), Some("target"),
                    "Expressions' expressions.studio.reenable: the values held off their automation by hand given back to it"),
                "Every held value went back to its automation.".into(),
            ));
        }
        if playing.is_some() || recording.is_some() {
            acts.insert("stopTrack".to_owned(), done(
                act("expressions.scene.stop", work_input.clone(), None, "Expressions' expressions.scene.stop: the Expression stopped; a take it records is closed and laid on its Scene"),
                format!("{title} stopped."),
            ));
        }
        let studio = work["studio"].as_object().and_then(|studio| {
            let scene_ref = studio.get("scene_ref").and_then(Value::as_str)?;
            let map = |key: &str| -> BTreeMap<String, Value> {
                studio
                    .get(key)
                    .and_then(Value::as_object)
                    .map(|map| map.iter().map(|(key, value)| (key.clone(), value.clone())).collect())
                    .unwrap_or_default()
            };
            Some(Studio {
                scene_ref: scene_ref.to_owned(),
                values: map("values"),
                settings: map("settings"),
                act: act(
                    "expressions.studio.set",
                    json!({"expression_ref": reference, "scene_ref": scene_ref}),
                    Some("value"),
                    "Expressions' expressions.studio.set: a value of the field (bind) or a device setting (setting) written into the Scene by the law the devices write with, and recorded on the take while the Expression records",
                ),
                held: held.clone(),
            })
        });
        for (index, scene) in scenes.iter().enumerate() {
            let Some(scene_ref) = text(&scene["scene_ref"]) else {
                continue;
            };
            let label = text(&scene["title"]).unwrap_or(scene_ref).to_owned();
            let material = scene["material"]["available"] == true;
            let here = playing.filter(|playing| playing["scene_ref"] == scene_ref);
            let records = recording.is_some_and(|recording| recording["scene_ref"] == scene_ref);
            let scene_input = json!({"expression_ref": reference, "scene_ref": scene_ref});
            let mut acts = BTreeMap::new();
            if material {
                if active {
                    acts.insert("launch".to_owned(), done(
                        act("expressions.scene.launch", json!({"launches": [scene_input]}), None,
                            "Expressions' expressions.scene.launch: the Scene plays, landing on its Quantize; an armed Expression records a take from where it lands"),
                        format!("{label} is launched."),
                    ));
                    if scene["saved"] != "never" {
                        acts.insert("playSaved".to_owned(), done(
                            act("expressions.scene.launch", json!({"launches": [scene_input], "saved": true}), None,
                                "Expressions' expressions.scene.launch: the Scene's saved version plays, landing on its Quantize"),
                            format!("The saved version of {label} is launched."),
                        ));
                    }
                    if stops.len() <= index {
                        stops.resize(index + 1, Vec::new());
                    }
                    stops[index].push(scene_input.clone());
                }
                acts.insert("save".to_owned(), done(
                    act("expressions.scene.save", scene_input.clone(), None,
                        "Expressions' expressions.scene.save: what the Scene holds kept as its saved version, and the Expression saved to its file"),
                    format!("{label} is saved."),
                ));
                if recording.is_none() {
                    acts.insert("capture".to_owned(), done(
                        act("expressions.scene.capture", scene_input.clone(), None,
                            "Expressions' expressions.scene.capture: the Scene kept as it stands as its saved version, and the next Scene started from it, after it"),
                        format!("{label} is kept, and the next Scene starts from it."),
                    ));
                }
            }
            acts.insert("duplicateClip".to_owned(), done(
                act("expressions.scene.edit", json!({"expression_ref": reference, "operation": "duplicate", "scene_ref": scene_ref}), None,
                    "Expressions' expressions.scene.edit · duplicate: a copy of the Scene, after it"),
                format!("A copy of {label} is after it."),
            ));
            acts.insert("deleteClip".to_owned(), done(
                act("expressions.scene.edit", json!({"expression_ref": reference, "operation": "remove", "scene_ref": scene_ref}), None,
                    "Expressions' expressions.scene.edit · remove: the Scene taken out of its Expression"),
                format!("{label} is taken out of {title}."),
            ));
            // The Arrangement's cuts (manual §16.6's table): each takes what the ruler gives (`*`), in the Scene's own seconds.
            for (key, operation, words) in [
                ("moveClip", "move", "move: the Scene laid where it is dropped — Insert shifts the Scenes after it, Overwrite replaces the one there"),
                ("trimClip", "trim", "trim: an edge of the Scene moved; the start edge moves its entry with it"),
                ("rollClip", "roll", "roll: the seam after the Scene moved; it grows by what the next one loses"),
                ("slipClip", "slip", "slip: where the Scene starts inside its own content"),
                ("slideClip", "slide", "slide: the Scene moved between its fixed neighbours"),
                ("splitClip", "split", "split: the Scene cut in two at the point given"),
            ] {
                acts.insert(key.to_owned(), act("expressions.scene.edit",
                    json!({"expression_ref": reference, "operation": operation, "scene_ref": scene_ref}), Some("*"),
                    &format!("Expressions' expressions.scene.edit · {words}")));
            }
            let note = if material {
                format!(
                    "{} · lands on {}",
                    seconds(&scene["duration"]),
                    text(&scene["quantize"]).unwrap_or("1 bar")
                )
            } else {
                text(&scene["material"]["reason"])
                    .unwrap_or("This Scene holds no material of the field yet.")
                    .to_owned()
            };
            clips.push(Clip {
                id: scene_ref.to_owned(),
                track: reference.to_owned(),
                row: expression_row(index + 1),
                label,
                subject: Some(scene_ref.to_owned()),
                // A launch the Quantize holds has not landed: its `at` starts where it lands, which the shell reads against its clock.
                status: if records {
                    Some("recording".into())
                } else {
                    here.map(|_| "running".into())
                },
                state: text(&scene["saved"]).map(str::to_owned),
                at: here
                    .and_then(|playing| playing["lands_at_unix_ms"].as_u64())
                    .map(|start| Span {
                        start_unix_ms: start,
                        end_unix_ms: None,
                    }),
                note: Some(note),
                seconds: scene["duration"].as_f64(),
                entry: Some(scene["entry"].as_f64().unwrap_or(0.0)),
                acts,
            });
            for take in scene["takes"].as_array().into_iter().flatten() {
                takes.extend(expression_take(reference, scene_ref, take, recording));
            }
        }
        // The selected Scene's automation lanes, on its clip: a recorded lane is drawn by hand where its value's range is read.
        if let Some(selected) = text(&work["selected_scene_ref"]) {
            for lane in work["lanes"].as_array().into_iter().flatten() {
                let Some(id) = text(&lane["id"]) else {
                    continue;
                };
                let range = lane["range"]["min"]
                    .as_f64()
                    .zip(lane["range"]["max"].as_f64())
                    .map(|(min, max)| Stretch {
                        start_s: min,
                        end_s: max,
                    });
                let mut acts = BTreeMap::new();
                if lane["drawable"] == true {
                    acts.insert("draw".to_owned(), done(
                        act("expressions.lane.draw", json!({"expression_ref": reference, "scene_ref": selected, "track_id": id}), Some("points"),
                            "Expressions' expressions.lane.draw: the Scene's recorded lane drawn by hand, over the stretch drawn"),
                        "The lane is drawn.".into(),
                    ));
                }
                lanes.push(Lane {
                    id: format!("{selected}#lane/{id}"),
                    track: reference.to_owned(),
                    clip: selected.to_owned(),
                    device: text(&lane["device"]).unwrap_or("Scene").to_owned(),
                    parameter: text(&lane["parameter"]).unwrap_or(id).to_owned(),
                    points: lane["points"]
                        .as_array()
                        .into_iter()
                        .flatten()
                        .map(|point| LanePoint {
                            at: point["at"].as_f64().unwrap_or(0.0),
                            value: point["value"].as_f64().unwrap_or(0.0),
                        })
                        .collect(),
                    range,
                    modulated_by: text(&lane["modulated_by"]).map(str::to_owned),
                    acts,
                });
            }
        }
        if presented.is_none() {
            presented = Some(work.clone());
        }
        tracks.push(Track {
            id: reference.to_owned(),
            name: title,
            kind: kind.join(" · "),
            color,
            info: text(&work["description"]).map(str::to_owned),
            acts,
            studio,
            mix: Some(Mix {
                volume: Some(level),
                activator: Some(active),
                solo: Some(solo),
                arm: Some(armed.contains(reference)),
            }),
            ..Track::default()
        });
    }
    // The works home: why it, or a file of it, gives no work.
    let home = &value["home"];
    let unreadable: Vec<String> = value["unreadable"]
        .as_array()
        .into_iter()
        .flatten()
        .map(|file| {
            format!(
                "{} ({})",
                text(&file["name"]).unwrap_or("a file"),
                text(&file["error"]).unwrap_or("it does not read")
            )
        })
        .collect();
    if home["state"] == "unavailable" || !unreadable.is_empty() {
        let folder = text(&home["path"]).unwrap_or("the works home");
        tracks.push(Track {
            id: EXPRESSIONS_HOME_TRACK.into(),
            name: "Works home".into(),
            kind: if unreadable.is_empty() {
                format!("the works home, {folder}")
            } else {
                format!(
                    "the works home, {folder} · {} that give no work: {}",
                    plural(unreadable.len(), "file", "files"),
                    unreadable.join("; ")
                )
            },
            read_only: true,
            absent: (home["state"] == "unavailable").then(|| {
                format!(
                    "The works home is unread: {}",
                    text(&home["error"]).unwrap_or("Central gave no reason")
                )
            }),
            ..Track::default()
        });
    }
    if let Some(stale) = store.stale() {
        for track in tracks.iter_mut() {
            track.kind = format!("{} · {stale}", track.kind);
        }
    }
    let mut rows: Vec<Row> = stops
        .iter()
        .enumerate()
        .map(|(index, launches)| Row {
            id: expression_row(index + 1),
            name: (index + 1).to_string(),
            acts: if launches.is_empty() {
                BTreeMap::new()
            } else {
                BTreeMap::from([("launch".to_owned(), done(
                    act("expressions.scene.launch", json!({"launches": launches}), None,
                        "Expressions' expressions.scene.launch: the stop launched, the Scene in its row playing on every Expression in it"),
                    format!("Stop {} is launched.", index + 1),
                ))])
            },
        })
        .collect();
    // A row is every open work's n-th Scene, even one no Scene of which launches.
    let deepest = clips
        .iter()
        .filter_map(|clip| {
            clip.row
                .strip_prefix("expressions:stop:")?
                .parse::<usize>()
                .ok()
        })
        .max()
        .unwrap_or(0);
    rows.extend((rows.len() + 1..=deepest).map(|n| Row {
        id: expression_row(n),
        name: n.to_string(),
        ..Row::default()
    }));
    let mut acts = BTreeMap::from([
        ("new".to_owned(), done(
            act("expressions.new", json!({}), Some("title"), "Expressions' expressions.new: an Expression of one blank Scene, the field's own, saved into the works home"),
            "The new Expression is open and saved.".into(),
        )),
        ("stopAll".to_owned(), done(
            act("expressions.scene.stop", json!({}), None, "Expressions' expressions.scene.stop: every Expression stopped (Stop All); the takes they record are closed and laid on their Scenes"),
            "Every Expression stopped.".into(),
        )),
    ]);
    // The presented work's loop brace and its saved sequence; and the Main track, whose Volume is every Expression's level together.
    let mut loop_brace = None;
    if let Some(work) = &presented {
        let reference = text(&work["expression_ref"]).unwrap_or_default();
        let region = &work["loop_region"];
        loop_brace = match (region["from"].as_f64(), region["to"].as_f64()) {
            (Some(from), Some(to)) => Some(LoopBrace {
                start_s: from,
                end_s: Some(to),
                off: work["loop"] == false,
            }),
            _ if work["loop"] == true => Some(LoopBrace {
                start_s: 0.0,
                end_s: None,
                off: false,
            }),
            _ => None,
        };
        acts.insert("setLoop".to_owned(), act("expressions.scene.edit", json!({"expression_ref": reference, "operation": "loop-edge"}), Some("*"),
            "Expressions' expressions.scene.edit · loop-edge: one end of the loop brace, in the sequence's seconds"));
        let first = work["scenes"].as_array().and_then(|scenes| scenes.first());
        if let Some(scene) = first
            .filter(|scene| scene["saved"] != "never" && scene["material"]["available"] == true)
        {
            acts.insert("backToArrangement".to_owned(), done(
                act("expressions.scene.launch", json!({"launches": [{"expression_ref": reference, "scene_ref": scene["scene_ref"]}], "saved": true}), None,
                    "Expressions' expressions.scene.launch, saved: the saved sequence plays again from its first Scene's saved version"),
                "The saved sequence plays again.".into(),
            ));
        }
        tracks.push(Track {
            id: EXPRESSIONS_MAIN_TRACK.into(),
            name: "Main".into(),
            kind: "the Main track: its Stops, and the sound of every Expression together".into(),
            main: true,
            mix: Some(Mix { volume: Some(work["main_level"].as_f64().unwrap_or(1.0)), ..Mix::default() }),
            acts: BTreeMap::from([("volume".to_owned(), act("expressions.mix.set", json!({"expression_ref": reference, "key": "main"}), Some("value"),
                "Expressions' expressions.mix.set · main: every Expression's level together, on the Main track"))]),
            ..Track::default()
        });
    }
    let mut lanes_absent = lanes_absent;
    if !lanes.is_empty() {
        lanes_absent.remove("automation");
    }
    if !takes.is_empty() {
        lanes_absent.remove("takes");
    }
    ModeSet {
        rows,
        tracks,
        clips,
        takes,
        main: Some(Main {
            track: None,
            name: "Main".into(),
            chain: vec!["Stops".into(), "Sound".into()],
        }),
        mixer,
        lanes_absent,
        acts,
        waiting,
        lanes,
        loop_brace,
        ..ModeSet::default()
    }
}

// ------------------------------------------------------------------ Technē

fn techne(sky: &Read) -> ModeSet {
    let mut kind = vec!["the dated sky now, as seen from Earth (QL's transit)".to_owned()];
    if let Some(epoch) = sky
        .value
        .and_then(|value| text(&value["epoch"]).or_else(|| text(&value["request"]["epoch"])))
    {
        kind.push(format!("at {epoch}"));
    }
    if let Some(stale) = sky.stale() {
        kind.push(stale);
    }
    kind.push(
        "the readings, their walks and the runs are no slice of the World Model yet (O-I #1009)"
            .into(),
    );
    ModeSet {
        tracks: vec![Track {
            id: "techne:sky".into(),
            name: "Sky".into(),
            kind: kind.join(" · "),
            read_only: true,
            absent: sky.value.is_none().then(|| format!("The sky is unread: {}", sky.why())),
            ..Track::default()
        }],
        lanes_absent: words(&[
            ("takes", "Technē's takes are its walks' recordings, which are no slice of the World Model yet (O-I #1009)."),
            ("automation", "No parameter of the sky is recorded over time here."),
            ("events", "Technē's events are the World cut's readings, which are no slice of the World Model yet (O-I #1009)."),
        ]),
        ..ModeSet::default()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn answer(slice: Slice, state: &str, value: Value, error: Option<&str>) -> Value {
        json!({"schema": crate::world_model::SCHEMA, "slice": slice.name(), "owner": slice.owner(), "scopes": slice.scopes(),
            "version": 1, "state": state, "value": value, "error": error, "read_at_unix_ms": 1})
    }

    fn unread(slice: Slice) -> Value {
        json!({"schema": crate::world_model::SCHEMA, "slice": slice.name(), "owner": slice.owner(), "scopes": slice.scopes(),
            "version": 0, "state": "unread", "value": null, "error": null, "read_at_unix_ms": null})
    }

    fn page(path: &str, title: &str, form: &str) -> Value {
        let name = path.rsplit('/').next().unwrap_or(path);
        json!({"location": {"schema": "central.path-ref/v1", "ref": format!("central:path:/c:{path}"), "root": "/c", "path": path},
            "name": name, "form": form, "title": title, "revision": "r1", "world": null})
    }

    fn worlds(pages_yours: Vec<Value>, project_pages: Result<Vec<Value>, &str>) -> Value {
        let project = match project_pages {
            Ok(pages) => {
                json!({"folder": "Work/O-I/ProjectCentral/user", "state": "read", "listing":
                {"schema": "oi.page-list/v1", "path": "Work/O-I/ProjectCentral/user", "pages": pages, "not_pages": [], "more": false}})
            }
            Err(why) => {
                json!({"folder": "Work/O-I/ProjectCentral/user", "state": "refused", "why": why})
            }
        };
        answer(
            Slice::Worlds,
            "read",
            json!({"root": {}, "worlds": [
                {"ref": "central:wiki:root", "name": "Your world", "kind": "yours", "folder": "Control/user/flows", "project": null},
                {"ref": "central:wiki:project:O-I", "name": "O-I", "kind": "project", "folder": "Work/O-I/ProjectCentral/user", "project": "O-I", "revision": "m7"},
            ], "pages": [
                {"folder": "Control/user/flows", "state": "read", "listing":
                    {"schema": "oi.page-list/v1", "path": "Control/user/flows", "pages": pages_yours, "not_pages": [], "more": false}},
                project,
            ]}),
            None,
        )
    }

    fn day(set: Option<Value>) -> Value {
        let document = match &set {
            Some(set) => {
                json!({"schema": "central.document-reading/v1", "document_id": "document:d", "source": {"ref": "s"},
                "revision": {"revision": "r"}, "document": {"document_id": "document:d", "kind": "day", "fields": [],
                "template_payload": {"meta": {"set": set}}}})
            }
            None => Value::Null,
        };
        answer(
            Slice::Day,
            "read",
            json!({"schema": "central.day-reading/v1", "day_ref": "day:1", "temporal": {"civil_date": "2026-11-13"},
            "document_state": if set.is_some() { "ready" } else { "uninitialised" }, "document": document,
            "automatic_agent_or_model_invocation": false}),
            None,
        )
    }

    fn seats(workcells: Value) -> Value {
        answer(
            Slice::Workcells,
            "read",
            json!({"seats": {"state": "read", "reading": {"schema": "central.workcell-status/v1", "workcells": workcells}},
            "workcells": {"state": "refused", "why": "no workcell instrument"}}),
            None,
        )
    }

    #[test]
    fn central_lays_your_world_first_then_the_days_worlds_their_pages_as_clips_and_the_day_last() {
        let set = build(
            Mode::Central,
            &[
                worlds(
                    vec![
                        page(
                            "Control/user/flows/second-2026-11-13-1010.html",
                            "Second",
                            "flow",
                        ),
                        page("Control/user/flows/first-2026-11-13-0900.html", "", "being"),
                    ],
                    Ok(vec![page(
                        "Work/O-I/ProjectCentral/user/plan.html",
                        "Plan",
                        "thing",
                    )]),
                ),
                day(Some(
                    json!({"schema": "oi.day-set/v1", "tracks": [{"world": "central:wiki:project:O-I", "name": "The shell"}, {"world": "central:wiki:project:Gone"}],
                "rows": [{"id": "morning", "name": "Morning", "pages": ["central:path:/c:Work/O-I/ProjectCentral/user/plan.html"]}]}),
                )),
                seats(
                    json!([{"name": "env-2", "seats": [{"product": "o-i", "state": "held", "live_branch": "dlw/foundation"}]}]),
                ),
            ],
        );
        let ids: Vec<&str> = set.tracks.iter().map(|track| track.id.as_str()).collect();
        assert_eq!(
            ids,
            [
                "central:world:central:wiki:root",
                "central:world:central:wiki:project:O-I",
                "central:world:central:wiki:project:Gone",
                "central:day"
            ]
        );
        assert_eq!(
            set.tracks[1].name, "The shell",
            "the set's own name for the track stands"
        );
        assert_eq!(
            set.tracks[1].works_in.as_deref(),
            Some("env-2"),
            "a project world works in the workcell holding its seat"
        );
        assert!(
            set.tracks[2]
                .absent
                .as_deref()
                .is_some_and(|why| why.contains("no longer discloses")),
            "a world Central no longer discloses stands named, with why"
        );
        assert!(set.tracks[3].main, "the Day is the Main track, last");
        let rows: Vec<&str> = set.rows.iter().map(|row| row.id.as_str()).collect();
        assert_eq!(
            rows,
            ["central:row:morning", "central:slot:1", "central:slot:2"],
            "the named rows, then a row per slot"
        );
        let clip = |id: &str| {
            set.clips
                .iter()
                .find(|clip| clip.id == id)
                .unwrap_or_else(|| panic!("no clip {id}"))
        };
        assert_eq!(
            clip("Work/O-I/ProjectCentral/user/plan.html").row,
            "central:row:morning"
        );
        assert_eq!(
            clip("Control/user/flows/first-2026-11-13-0900.html").row,
            "central:slot:1",
            "your world's pages in the order made"
        );
        assert_eq!(
            clip("Control/user/flows/first-2026-11-13-0900.html").label,
            "first-2026-11-13-0900",
            "a page with no title shows its name"
        );
        assert_eq!(
            clip("Control/user/flows/second-2026-11-13-1010.html").row,
            "central:slot:2"
        );
        assert_eq!(
            clip("Control/user/flows/second-2026-11-13-1010.html").track,
            "central:world:central:wiki:root"
        );
        assert_eq!(
            clip("Control/user/flows/second-2026-11-13-1010.html").acts["openFile"].action,
            "work.open"
        );
        let rename = &set.tracks[1].acts["renameTrack"];
        assert_eq!(
            (
                rename.action.as_str(),
                rename.takes.as_deref(),
                rename.project.as_deref()
            ),
            ("central.world.name", Some("name"), Some("O-I"))
        );
        assert_eq!(
            rename.input["expected_revision"], "m7",
            "a world's name is written against the manifest revision Central disclosed"
        );
        assert!(
            !set.tracks[0].acts.contains_key("renameTrack"),
            "your world is no project's: Central names a project's world"
        );
        assert_eq!(set.acts["arm"].action, "shell.setWriteArm");
        assert_eq!(
            set.ruler.as_ref().and_then(|ruler| ruler.date.as_deref()),
            Some("2026-11-13")
        );
        assert_eq!(
            set.main.as_ref().map(|main| main.name.as_str()),
            Some("Day · 2026-11-13")
        );
        assert!(
            set.waiting.contains_key("clip.launch") && set.waiting.contains_key("clip.delete"),
            "what no single Action carries waits, in words"
        );
    }

    #[test]
    fn a_slice_unread_or_refused_is_its_tracks_stated_reason_never_an_empty_success() {
        let set = build(
            Mode::Central,
            &[
                answer(
                    Slice::Worlds,
                    "refused",
                    Value::Null,
                    Some("Central's map is unreadable"),
                ),
                answer(
                    Slice::Day,
                    "refused",
                    Value::Null,
                    Some("The native today pointer is stale"),
                ),
                unread(Slice::Workcells),
            ],
        );
        assert_eq!(set.tracks.len(), 2, "your world and the Day stand");
        assert_eq!(
            set.tracks[0].absent.as_deref(),
            Some("Central's worlds are unread: Central's map is unreadable")
        );
        assert!(set.tracks[1]
            .absent
            .as_deref()
            .is_some_and(|why| why.contains("The native today pointer is stale")));
        assert!(set.clips.is_empty() && set.rows.is_empty());
        assert_eq!(
            set.sources
                .iter()
                .map(|source| source.state.as_str())
                .collect::<Vec<_>>(),
            ["refused", "refused", "unread"]
        );

        let projects_refused = build(
            Mode::Central,
            &[
                worlds(vec![], Err("Permission denied")),
                day(Some(
                    json!({"schema": "oi.day-set/v1", "tracks": [{"world": "central:wiki:project:O-I"}], "rows": []}),
                )),
                unread(Slice::Workcells),
            ],
        );
        assert_eq!(
            projects_refused.tracks[1].absent.as_deref(),
            Some("its pages are unread: Permission denied")
        );
        assert!(projects_refused.mixer["works"]
            .disabled
            .as_deref()
            .is_some_and(|why| why.contains("The seat register is unread")));

        let no_document = build(
            Mode::Central,
            &[
                worlds(vec![], Ok(vec![])),
                day(None),
                unread(Slice::Workcells),
            ],
        );
        assert_eq!(
            no_document.tracks.len(),
            2,
            "a Day with no document keeps no set: only your world and the Day"
        );
        assert!(no_document.tracks[1].kind.contains("has no document yet"));
    }

    fn agency(spaces: Value) -> Value {
        answer(
            Slice::Sessions,
            "read",
            json!({"project_ref": "project:root", "spaces": spaces, "harness_disclosure": {}, "observed_at_unix_ms": 1}),
            None,
        )
    }

    fn field(sources: Value, locations: Value) -> Value {
        answer(
            Slice::Factory,
            "read",
            json!({"located": {"locations": locations}, "sources": sources}),
            None,
        )
    }

    #[test]
    fn factory_lays_sessions_as_tracks_tasks_on_the_session_that_runs_them_and_attempts_as_takes() {
        let spaces = json!([{"definition": {"id": "space:a"}, "label": "Chat", "agent_sessions": {"session:1": {"purpose": "Answer", "agent_ref": "agent:x"}}}]);
        let run = json!({"run_ref": "run:01", "run": {"state": "read", "reading": {"lifecycle": "active", "executions": [
            {"executionRef": "exec:1", "agentSessionRef": "session:1", "sessionSpaceRef": "space:a"}]}},
        "attempts": {"state": "read", "reading": {"attempts": [
            {"attemptRef": "attempt:1", "taskRef": "task:t", "workflowUnitRef": "workflow-unit:inspect-source", "executionRef": "exec:1",
             "attemptRecordedAt": "2026-11-13T10:00:00Z", "failureRecordedAt": "2026-11-13T10:05:00Z", "failureEvidenceRefs": ["e"]},
            {"attemptRef": "attempt:2", "taskRef": "task:t", "workflowUnitRef": "workflow-unit:inspect-source", "executionRef": "exec:1",
             "attemptRecordedAt": "2026-11-13T10:10:00Z", "returnRecordedAt": "2026-11-13T10:20:00Z",
             "readableReturn": {"summary": "Done", "receivingRef": "return:9"}},
            {"attemptRef": "attempt:3", "taskRef": "task:u", "workflowUnitRef": "workflow-unit:3C73CMWMP7956ZN0XFWD5FMFYW",
             "attemptRecordedAt": "2026-11-13T09:00:00Z"},
        ]}}});
        let set = build(
            Mode::Factory,
            &[
                agency(spaces),
                field(
                    json!([{"project": null, "state_path": "/c/.factory/s.json", "project_ref": "project:root", "journeys": {"state": "read"}, "runs": [run]}]),
                    json!([]),
                ),
                seats(json!([{"name": "env-1", "seats": []}])),
            ],
        );
        let ids: Vec<&str> = set.tracks.iter().map(|track| track.id.as_str()).collect();
        assert_eq!(
            ids,
            [
                "space:a:space:a",
                "space:a:session:1",
                "factory:run:run:01",
                "workcell:env-1"
            ]
        );
        assert_eq!(set.tracks[1].parent.as_deref(), Some("space:a:space:a"));
        assert!(set.tracks[3].returns && set.tracks[3].read_only);
        let task = set
            .clips
            .iter()
            .find(|clip| clip.id == "space:a:session:1#task/1")
            .expect("the task is a clip");
        assert_eq!(
            task.track, "space:a:session:1",
            "a task lies on the session that executes it"
        );
        assert_eq!(
            task.subject.as_deref(),
            Some("task:t"),
            "its subject is Factory's task_ref"
        );
        let at = |text: &str| {
            u64::try_from(text.parse::<jiff::Timestamp>().unwrap().as_millisecond()).unwrap()
        };
        assert_eq!(
            (
                task.row.as_str(),
                task.label.as_str(),
                task.status.as_deref()
            ),
            ("batch:1", "inspect-source", Some("done"))
        );
        assert_eq!(
            task.at
                .as_ref()
                .map(|span| (span.start_unix_ms, span.end_unix_ms)),
            Some((at("2026-11-13T10:00:00Z"), Some(at("2026-11-13T10:20:00Z")))),
            "a task spans its first attempt's start to its last attempt's end"
        );
        let other = set
            .clips
            .iter()
            .find(|clip| clip.id == "factory:run:run:01#task/1")
            .expect("the other task");
        assert_eq!(
            other.track, "factory:run:run:01",
            "a task no session executes lies on its Run's track"
        );
        assert_eq!(
            (
                other.label.as_str(),
                other.status.as_deref(),
                other.at.as_ref().and_then(|span| span.end_unix_ms)
            ),
            ("Task u", Some("waiting"), None)
        );
        let names: Vec<(&str, &str, bool)> = set
            .takes
            .iter()
            .map(|take| (take.name.as_str(), take.state.as_str(), take.standing))
            .collect();
        assert_eq!(
            names,
            [
                ("inspect-source · take 1", "failed", false),
                ("inspect-source · take 2", "returned", true),
                ("take 1", "prepared", false)
            ]
        );
        assert_eq!(
            set.takes[1].clip, task.id,
            "each take lies under its task's clip"
        );
        let spans: Vec<Option<(u64, Option<u64>)>> = set
            .takes
            .iter()
            .map(|take| {
                take.at
                    .as_ref()
                    .map(|span| (span.start_unix_ms, span.end_unix_ms))
            })
            .collect();
        assert_eq!(
            spans,
            [
                Some((at("2026-11-13T10:00:00Z"), Some(at("2026-11-13T10:05:00Z")))),
                Some((at("2026-11-13T10:10:00Z"), Some(at("2026-11-13T10:20:00Z")))),
                Some((at("2026-11-13T09:00:00Z"), Some(at("2026-11-13T09:00:00Z")))),
            ],
            "a take runs from admission to its Return or failure; a prepared one has not run, so it stands at its instant"
        );
        assert_eq!(
            set.ruler.as_ref().and_then(|ruler| ruler.origin_unix_ms),
            Some(at("2026-11-13T09:00:00Z")),
            "the ruler starts at the earliest instant"
        );
        assert_eq!(set.rows.len(), 4, "never fewer than four batch rows");
        assert!(!set.lanes_absent.contains_key("takes"));
        assert_eq!(
            set.acts.get("solo").map(|act| act.action.as_str()),
            Some("shell.setSolo"),
            "Solo is what you attend to: the shell's own act, no owner's"
        );
        assert!(
            set.mixer["solo"]
                .disabled
                .as_deref()
                .is_some_and(|words| words.contains("what you attend to")),
            "where no attention is handed, Solo says what it waits for"
        );
    }

    #[test]
    fn a_returned_take_its_runs_flow_can_receive_is_chosen_by_factorys_choose_and_no_other_take_is()
    {
        let attempts = json!({"state": "read", "reading": {"attempts": [
            {"attemptRef": "attempt:1", "taskRef": "task:t", "workflowUnitRef": "workflow-unit:build",
             "attemptRecordedAt": "2026-11-13T10:00:00Z", "returnRecordedAt": "2026-11-13T10:05:00Z", "readableReturn": {"summary": "First"}},
            {"attemptRef": "attempt:2", "taskRef": "task:t", "workflowUnitRef": "workflow-unit:build",
             "attemptRecordedAt": "2026-11-13T10:10:00Z", "returnRecordedAt": "2026-11-13T10:20:00Z",
             "readableReturn": {"summary": "Second", "receivingRef": "receiving:9"}},
            {"attemptRef": "attempt:3", "taskRef": "task:t", "workflowUnitRef": "workflow-unit:build",
             "attemptRecordedAt": "2026-11-13T10:30:00Z", "failureRecordedAt": "2026-11-13T10:35:00Z", "failureEvidenceRefs": ["e"]},
        ]}});
        let flowed = json!({"run_ref": "run:flowed", "run": {"state": "read", "reading": {"lifecycle": "active",
            "flowAssociations": [{"runRef": "run:flowed", "flow": {"documentId": "doc:flow"}}]}}, "attempts": attempts});
        let alone = json!({"run_ref": "run:alone", "run": {"state": "read", "reading": {"lifecycle": "active"}},
            "attempts": {"state": "read", "reading": {"attempts": [
                {"attemptRef": "attempt:9", "taskRef": "task:s", "workflowUnitRef": "workflow-unit:task",
                 "attemptRecordedAt": "2026-11-13T11:00:00Z", "returnRecordedAt": "2026-11-13T11:05:00Z", "readableReturn": {"summary": "Mine"}}]}}});
        let set = build(
            Mode::Factory,
            &[
                agency(json!([])),
                field(
                    json!([{"project": null, "state_path": "/c/.factory/s.json", "project_ref": "project:root", "journeys": {"state": "read"},
                        "runs": [flowed, alone]}]),
                    json!([]),
                ),
                seats(json!([])),
            ],
        );
        let chosen: Vec<(&str, Option<&Act>)> = set
            .takes
            .iter()
            .map(|take| (take.id.as_str(), take.acts.get("choose")))
            .collect();
        assert_eq!(chosen.len(), 4);
        let choose = chosen[0]
            .1
            .expect("a returned take its Run's Flow has not received is chosen");
        assert_eq!(choose.action, "factory.attempt.choose");
        assert_eq!(
            choose.input,
            json!({"state": "/c/.factory/s.json", "run_ref": "run:flowed", "attempt_ref": "attempt:1"})
        );
        assert!(choose
            .done
            .as_deref()
            .is_some_and(|done| done.contains("Approvals")));
        assert!(
            chosen[1..].iter().all(|(_, act)| act.is_none()),
            "a take Central received already, a failed one, and a take of a Run that belongs to no Flow offer no choice: {chosen:?}"
        );
    }

    #[test]
    fn a_session_factory_ran_a_task_on_is_its_track_with_its_end_stop_and_run_and_the_set_seats_an_agent(
    ) {
        let state = "/w/Central/Work/atelier/.factory/development-state.json";
        let body = json!({"sessionSpaceRef": "session-space/atelier-chat-1", "agentSessionRef": "agent-session/atelier-chat-1",
            "harnessRef": "harness/codex"});
        let run = |run: &str, task: &str, attempt: Value| {
            json!({"run_ref": run, "run": {"state": "read", "reading": {"executions": []}},
            "attempts": {"state": "read", "reading": {"attempts": [attempt.as_object().unwrap().clone().into_iter()
                .chain([("taskRef".to_owned(), json!(task)), ("disposition".to_owned(), json!({"body": body}))]).collect::<serde_json::Map<_, _>>()]}}})
        };
        let returned = run(
            "run:a",
            "task:a",
            json!({"attemptRef": "attempt:a", "workflowUnitRef": "workflow-unit:a",
            "attemptRecordedAt": "2026-11-14T10:00:00Z", "returnRecordedAt": "2026-11-14T10:01:00Z", "readableReturn": {"summary": "Done"}}),
        );
        let running = run(
            "run:b",
            "task:b",
            json!({"attemptRef": "attempt:b", "workflowUnitRef": "workflow-unit:b",
            "attemptRecordedAt": "2026-11-14T10:02:00Z", "executionRef": "execution:b"}),
        );
        let located = json!([{"project": "atelier", "root": "/w/Central/Work/atelier", "state": "located"},
            {"project": null, "root": "/w/Central", "state": "absent"}]);
        let held = json!([{"name": "env-1", "seats": [{"product": "atelier", "state": "held", "live_branch": "atelier-work"}]}]);
        let set = build(
            Mode::Factory,
            &[
                agency(json!([])),
                field(
                    json!([{"project": "atelier", "state_path": state, "project_ref": "project:atelier",
                    "journeys": {"state": "read"}, "runs": [returned, running]}]),
                    located.clone(),
                ),
                seats(held),
            ],
        );
        let track = "session-space/atelier-chat-1:agent-session/atelier-chat-1";
        let seated = set
            .tracks
            .iter()
            .find(|t| t.id == track)
            .expect("the session is a track, laid from Factory's record");
        assert_eq!(seated.name, "codex");
        let end = &seated.acts["endSession"];
        assert_eq!(
            (end.action.as_str(), &end.input),
            (
                "factory.session.end",
                &json!({"world": "/w/Central", "project": "atelier", "session": "agent-session/atelier-chat-1"})
            )
        );
        let write = &seated.acts["writeTask"];
        assert_eq!(
            (write.action.as_str(), &write.input, write.takes.as_deref()),
            (
                "factory.task.write",
                &json!({"world": "/w/Central", "project": "atelier", "session": "agent-session/atelier-chat-1"}),
                Some("instruction")
            ),
            "a message dropped on the track is written as its next task"
        );
        let stop = &seated.acts["stopTrack"];
        assert_eq!(
            (stop.action.as_str(), &stop.input),
            (
                "factory.task.stop",
                &json!({"state": state, "run_ref": "run:b", "attempt_ref": "attempt:b"})
            ),
            "its running task's Stop"
        );
        let on: Vec<&Clip> = set
            .clips
            .iter()
            .filter(|clip| clip.track == track)
            .collect();
        assert_eq!(on.len(), 2, "both tasks lie on the session that ran them");
        assert!(
            on.iter().all(|clip| !clip.acts.contains_key("launch")),
            "a task that ran does not run again from its clip: a stalled one runs again from its track's retry"
        );
        assert!(
            !seated.acts.contains_key("retry"),
            "no task on the track has stalled"
        );
        let seat = &set.acts["seat"];
        assert_eq!(
            (seat.action.as_str(), &seat.input, seat.takes.as_deref()),
            (
                "factory.session.start",
                &json!({"world": "/w/Central", "project": "atelier"}),
                Some("agent")
            )
        );

        let free = build(
            Mode::Factory,
            &[
                agency(json!([])),
                field(json!([]), located),
                seats(
                    json!([{"name": "env-1", "seats": [{"product": "atelier", "state": "free"}]}]),
                ),
            ],
        );
        assert!(!free.acts.contains_key("seat"));
        assert!(
            free.waiting["track.seat"].contains("no project of this World holds one"),
            "{}",
            free.waiting["track.seat"]
        );
    }

    #[test]
    fn a_session_factory_started_is_a_track_from_its_start_its_written_task_launches_and_a_stalled_one_lights_its_retry(
    ) {
        let state = "/w/Central/Work/atelier/.factory/development-state.json";
        let body = json!({"sessionSpaceRef": "session-space/atelier-chat-2", "agentSessionRef": "agent-session/atelier-chat-2",
            "harnessRef": "harness/codex"});
        let run = |run: &str, unit: &str, attempt: Value, status: &str| {
            let mut record = attempt.as_object().unwrap().clone();
            record.insert("taskRef".into(), json!(format!("task:{run}")));
            record.insert("workflowUnitRef".into(), json!(unit));
            record.insert("disposition".into(), json!({"body": body}));
            json!({"run_ref": run, "run": {"state": "read", "reading": {"executions": []}},
                "attempts": {"state": "read", "reading": {"attempts": [record],
                "legs": {unit: {"executionRef": attempt["executionRef"], "status": status}}}}})
        };
        let failed = run(
            "run:f",
            "workflow-unit:f",
            json!({"attemptRef": "attempt:f", "executionRef": "execution:f", "attemptRecordedAt": "2026-11-14T10:00:00Z",
                "failureRecordedAt": "2026-11-14T10:01:00Z", "failureEvidenceRefs": ["aikit-delivery:d"]}),
            "failed",
        );
        let cancelled = run(
            "run:x",
            "workflow-unit:x",
            json!({"attemptRef": "attempt:x", "executionRef": "execution:x", "attemptRecordedAt": "2026-11-14T10:02:00Z"}),
            "cancellation_accepted",
        );
        let session = |n: u32, agent: &str, state: &str, tasks: Value| {
            json!({"contract": "factory.session/v1", "state": state, "session": format!("agent-session/atelier-chat-{n}"),
                "space": format!("session-space/atelier-chat-{n}"), "agent": agent, "world": "/w/Central", "project": "atelier",
                "tasks": tasks})
        };
        let sessions = json!({"state": "read", "reading": {"contract": "factory.session-list/v1", "sessions": [
            session(2, "codex", "open", json!([
                {"run_ref": "run:w", "unit_ref": "workflow-unit:w", "task": "Write the notes"},
                {"run_ref": "run:f", "unit_ref": "workflow-unit:f", "task": "Check the notes"},
                {"run_ref": "run:x", "unit_ref": "workflow-unit:x", "task": "Summarise them"},
            ])),
            session(3, "claude-code", "open", json!([])),
            session(4, "codex", "ended", json!([])),
        ]}});
        let located =
            json!([{"project": "atelier", "root": "/w/Central/Work/atelier", "state": "located"}]);
        let held = json!([{"name": "env-1", "seats": [{"product": "atelier", "state": "held", "live_branch": "atelier-work"}]}]);
        let set = build(
            Mode::Factory,
            &[
                agency(json!([])),
                field(
                    json!([{"project": "atelier", "state_path": state, "project_ref": "project:atelier",
                    "journeys": {"state": "read"}, "runs": [failed, cancelled], "sessions": sessions}]),
                    located,
                ),
                seats(held),
            ],
        );
        let track_of =
            |n: u32| format!("session-space/atelier-chat-{n}:agent-session/atelier-chat-{n}");
        let busy = set
            .tracks
            .iter()
            .find(|t| t.id == track_of(2))
            .expect("the session is a track, laid from Factory's record of it");
        assert_eq!(busy.name, "codex");
        assert!(busy.acts.contains_key("endSession") && busy.acts.contains_key("writeTask"));
        assert!(
            !busy.acts.contains_key("stopTrack"),
            "a cancelled task runs no more, so there is nothing to stop"
        );
        let retry = &busy.acts["retry"];
        assert_eq!(
            (retry.action.as_str(), &retry.input),
            (
                "factory.attempt.retry",
                &json!({"state": state, "run_ref": "run:f", "unit_ref": "workflow-unit:f"})
            ),
            "the stalled task's track lights its retry"
        );
        let on: Vec<&Clip> = set
            .clips
            .iter()
            .filter(|clip| clip.track == track_of(2))
            .collect();
        let laid: Vec<(&str, &str, Option<&str>, Option<&str>)> = on
            .iter()
            .map(|clip| {
                (
                    clip.row.as_str(),
                    clip.label.as_str(),
                    clip.status.as_deref(),
                    clip.state.as_deref(),
                )
            })
            .collect();
        assert_eq!(
            laid,
            [
                ("batch:1", "Write the notes", Some("waiting"), Some("written")),
                ("batch:2", "Check the notes", Some("stalled"), Some("failed")),
                ("batch:3", "Summarise them", Some("stopped"), Some("cancelled")),
            ],
            "the tasks lie in the order they were written, each named by the words it was written from"
        );
        let launch = &on[0].acts["launch"];
        assert_eq!(
            (launch.action.as_str(), &launch.input),
            (
                "factory.task.run",
                &json!({"state": state, "run_ref": "run:w", "session": "agent-session/atelier-chat-2"})
            ),
            "a task written and not yet run runs from its clip"
        );
        assert!(on[1..].iter().all(|clip| clip.acts.is_empty()));
        let fresh = set
            .tracks
            .iter()
            .find(|t| t.id == track_of(3))
            .expect("a session with no task yet is a track from its start");
        assert_eq!(fresh.name, "claude-code");
        assert_eq!(
            fresh.acts.keys().map(String::as_str).collect::<Vec<_>>(),
            ["endSession", "writeTask"]
        );
        assert!(
            !set.tracks.iter().any(|t| t.id == track_of(4)),
            "an ended session that holds no task keeps no track"
        );
    }

    #[test]
    fn where_several_projects_hold_a_seat_each_has_its_own_seat_act_and_the_empty_track_waits() {
        let located = json!([{"project": "atelier", "root": "/w/Central/Work/atelier", "state": "located"},
            {"project": "kiln", "root": "/w/Central/Work/kiln", "state": "located"}]);
        let held = json!([{"name": "env-1", "seats": [{"product": "atelier", "state": "held", "live_branch": "atelier-work"},
            {"product": "kiln", "state": "held", "live_branch": "kiln-work"}]}]);
        let set = build(
            Mode::Factory,
            &[agency(json!([])), field(json!([]), located), seats(held)],
        );
        assert!(
            !set.acts.contains_key("seat"),
            "a drop names no project, so the empty track seats none"
        );
        assert!(
            set.waiting["track.seat"].contains("several hold a workcell seat (atelier, kiln)"),
            "{}",
            set.waiting["track.seat"]
        );
        for project in ["atelier", "kiln"] {
            let seat = &set.acts[&format!("seat:{project}")];
            assert_eq!(
                (seat.action.as_str(), &seat.input, seat.takes.as_deref()),
                (
                    "factory.session.start",
                    &json!({"world": "/w/Central", "project": project}),
                    Some("agent")
                ),
                "{project}'s own seat act"
            );
            assert_eq!(
                seat.done.as_deref(),
                Some(
                    format!(
                        "The agent is seated on a new track in {project}: its session is open."
                    )
                    .as_str()
                )
            );
        }
    }

    #[test]
    fn factory_says_why_it_holds_no_task_in_factorys_own_words() {
        let set = build(
            Mode::Factory,
            &[
                answer(
                    Slice::Sessions,
                    "refused",
                    Value::Null,
                    Some("AIKit is not installed"),
                ),
                field(
                    json!([]),
                    json!([{"project": null, "state": "absent", "error": "no .factory under /c"}]),
                ),
                unread(Slice::Workcells),
            ],
        );
        assert_eq!(
            set.tracks[0].absent.as_deref(),
            Some("The Agent sessions are unread: AIKit is not installed")
        );
        assert_eq!(
            set.tracks[1].absent.as_deref(),
            Some("Factory finds no state in this World: no .factory under /c")
        );
        assert!(set.clips.is_empty() && set.takes.is_empty());
        assert!(set.lanes_absent.contains_key("takes"));

        let journeys_refused = build(
            Mode::Factory,
            &[
                agency(json!([])),
                field(
                    json!([{"project": "O-I", "state_path": "/c/Work/O-I/.factory/s.json", "project_ref": "project:o-i",
                "journeys": {"state": "refused", "why": "the state file is locked"}, "runs": []}]),
                    json!([]),
                ),
                unread(Slice::Workcells),
            ],
        );
        assert_eq!(
            journeys_refused.tracks.iter().find(|track| track.id == "factory:source:project:o-i").and_then(|track| track.absent.as_deref()),
            Some("Factory did not read its journeys, so its runs are unknown: the state file is locked")
        );
    }

    #[test]
    fn a_mode_no_slice_serves_says_why_and_technes_holds_the_sky() {
        let live = build(Mode::Live, &[]);
        assert!(live
            .absent
            .as_deref()
            .is_some_and(|why| why.contains("no slice of the World Model")));
        assert!(live.tracks.is_empty());
        let sky = build(
            Mode::Techne,
            &[answer(
                Slice::Sky,
                "read",
                json!({"epoch": "2026-11-13T10:00:00Z"}),
                None,
            )],
        );
        assert_eq!(sky.tracks[0].id, "techne:sky");
        assert!(sky.tracks[0].kind.contains("at 2026-11-13T10:00:00Z"));
        let unread_sky = build(Mode::Techne, &[unread(Slice::Sky)]);
        assert!(unread_sky.tracks[0].absent.is_some());
    }

    /// The expression store's reading (expression.rs `reading`): one open work of two Scenes, the first launched and recording on an
    /// armed work, the second holding a returned take; one closed work in the works home.
    fn store(active: bool) -> Value {
        let location = |path: &str| json!({"schema": "central.path-ref/v1", "ref": format!("central:path:/c:{path}"), "root": "/c", "path": path});
        answer(
            Slice::Expressions,
            "read",
            json!({"schema": "oi.expression-reading/v1", "home": {"path": "Control/user/flows", "state": "listed"}, "unreadable": [],
                "works": [
                    {"expression_ref": "expression:authored-a", "title": "Dawn", "revision": 7, "open": true, "dirty": true,
                     "location": location("Control/user/flows/dawn-a.expression.json"), "file_revision": "f1",
                     "mix": {"active": active, "solo": false, "level": 0.5}, "selected_scene_ref": "expression:authored-a:scene:main",
                     "scenes": [
                        {"scene_ref": "expression:authored-a:scene:main", "title": "Opening", "index": 0, "duration": 12, "quantize": "1 bar",
                         "saved": "changed", "material": {"available": true},
                         "takes": [{"take_ref": "expression:authored-a:scene:main:take:1", "kind": "studio", "lane": 1, "start_s": 0.0,
                            "seconds": 0.0, "binds": ["field.params.timeScale"], "points": 2, "state": "running", "kept": null}]},
                        {"scene_ref": "expression:authored-a:scene:two", "title": "Turn", "index": 1, "duration": 8, "quantize": "1/4",
                         "saved": "never", "material": {"available": true},
                         "takes": [{"take_ref": "expression:authored-a:scene:two:take:1", "kind": "studio", "lane": 1, "start_s": 0.0,
                            "seconds": 4.5, "binds": ["field.params.timeScale", "field.params.turbulence"], "points": 6, "state": "returned",
                            "kept": null}]}],
                     "studio": {"scene_ref": "expression:authored-a:scene:main", "values": {"field.params.timeScale": 1.25},
                        "settings": {"field-setting:law": "drift"}}},
                    {"expression_ref": "expression:authored-b", "title": "Dusk", "revision": 2, "open": false, "dirty": false,
                     "location": location("Control/user/flows/dusk-b.expression.json"), "file_revision": "f9"}],
                "playback": {"state": "recording", "epoch": 3,
                    "launched": [{"expression_ref": "expression:authored-a", "scene_ref": "expression:authored-a:scene:main",
                        "launched_at_unix_ms": 1000, "lands_at_unix_ms": 2500, "saved": false}],
                    "armed": ["expression:authored-a"],
                    "recordings": [{"expression_ref": "expression:authored-a", "scene_ref": "expression:authored-a:scene:main",
                        "take_ref": "expression:authored-a:scene:main:take:1", "started_at_unix_ms": 2500, "at_s": 1.0}]}}),
            None,
        )
    }

    #[test]
    fn expressions_set_lays_each_work_its_scenes_and_takes_and_the_studio_each_act_an_expressions_action(
    ) {
        let set = build(Mode::Expressions, &[store(true)]);
        assert!(set.absent.is_none());
        let dawn = &set.tracks[0];
        assert_eq!(
            (dawn.id.as_str(), dawn.name.as_str()),
            ("expression:authored-a", "Dawn")
        );
        assert!(
            dawn.kind.contains("plays Opening")
                && dawn
                    .kind
                    .contains("records expression:authored-a:scene:main:take:1"),
            "{}",
            dawn.kind
        );
        assert_eq!(
            dawn.mix,
            Some(Mix {
                volume: Some(0.5),
                activator: Some(true),
                solo: Some(false),
                arm: Some(true)
            })
        );
        assert_eq!(
            dawn.acts["stopTrack"].input,
            json!({"expression_ref": "expression:authored-a"})
        );
        assert_eq!(dawn.acts["arm"].takes.as_deref(), Some("on"));
        assert_eq!(
            dawn.acts["volume"].input,
            json!({"expression_ref": "expression:authored-a", "key": "level"})
        );
        let studio = dawn.studio.as_ref().expect("the open work's Studio");
        assert_eq!(studio.scene_ref, "expression:authored-a:scene:main");
        assert_eq!(studio.values["field.params.timeScale"], json!(1.25));
        assert_eq!(studio.act.action, "expressions.studio.set");
        assert_eq!(
            studio.act.input,
            json!({"expression_ref": "expression:authored-a", "scene_ref": "expression:authored-a:scene:main"})
        );
        // The closed work opens from its file.
        let dusk = &set.tracks[1];
        assert_eq!(dusk.acts["open"].action, "expressions.open");
        assert_eq!(
            dusk.acts["open"].input["location"]["path"],
            "Control/user/flows/dusk-b.expression.json"
        );
        assert!(dusk.studio.is_none() && dusk.mix.is_none());
        // The Scenes are clips on the stops; the launched one plays from where it lands, and records.
        let rows: Vec<&str> = set.rows.iter().map(|row| row.id.as_str()).collect();
        assert_eq!(rows, ["expressions:stop:1", "expressions:stop:2"]);
        assert_eq!(
            set.rows[0].acts["launch"].input,
            json!({"launches": [{"expression_ref": "expression:authored-a", "scene_ref": "expression:authored-a:scene:main"}]})
        );
        let opening = &set.clips[0];
        assert_eq!(
            (
                opening.row.as_str(),
                opening.status.as_deref(),
                opening.state.as_deref()
            ),
            ("expressions:stop:1", Some("recording"), Some("changed"))
        );
        assert_eq!(
            opening.at,
            Some(Span {
                start_unix_ms: 2500,
                end_unix_ms: None
            })
        );
        assert!(
            !opening.acts.contains_key("capture"),
            "no Capture while the work records"
        );
        let turn = &set.clips[1];
        assert_eq!(
            (turn.status.as_deref(), turn.state.as_deref()),
            (None, Some("never"))
        );
        assert!(
            turn.acts.contains_key("launch") && !turn.acts.contains_key("playSaved"),
            "a Scene never saved has no saved version to play"
        );
        // The takes: the running one reaches now from where it started, and only the returned one is kept.
        let running = set
            .takes
            .iter()
            .find(|take| take.state == "running")
            .expect("the running take");
        assert_eq!(
            running.at,
            Some(Span {
                start_unix_ms: 2500,
                end_unix_ms: None
            })
        );
        assert!(running.acts.is_empty());
        let returned = set
            .takes
            .iter()
            .find(|take| take.state == "returned")
            .expect("the returned take");
        assert_eq!(
            (returned.clip.as_str(), returned.name.as_str()),
            ("expression:authored-a:scene:two", "Take 1")
        );
        assert_eq!(returned.acts["choose"].action, "expressions.take.keep");
        assert_eq!(
            returned.acts["choose"].input["take_ref"],
            "expression:authored-a:scene:two:take:1"
        );
        assert_eq!(set.acts["new"].takes.as_deref(), Some("title"));
        assert_eq!(set.acts["stopAll"].input, json!({}));
        // Every act is one of Expressions' Actions.
        let all = set
            .acts
            .values()
            .chain(set.rows.iter().flat_map(|row| row.acts.values()))
            .chain(set.tracks.iter().flat_map(|track| {
                track
                    .acts
                    .values()
                    .chain(track.studio.iter().map(|studio| &studio.act))
            }))
            .chain(set.clips.iter().flat_map(|clip| clip.acts.values()))
            .chain(set.takes.iter().flat_map(|take| take.acts.values()));
        for act in all {
            assert!(
                crate::expression_actions::holds(&act.action),
                "{} is an Action of Expressions",
                act.action
            );
        }
        assert_eq!(
            set.main.as_ref().map(|main| main.chain.clone()),
            Some(vec!["Stops".to_owned(), "Sound".to_owned()])
        );
        assert!(set.mixer["monitor"].disabled.is_some());
        let roundtrip: ModeSet = serde_json::from_value(serde_json::to_value(&set).unwrap())
            .expect("the Set round-trips");
        assert_eq!(roundtrip, set);
    }

    #[test]
    fn the_presented_work_lays_its_cuts_lanes_loop_holds_and_main_track_each_an_expressions_action()
    {
        let mut value = store(true);
        {
            let reading = &mut value["value"];
            let work = &mut reading["works"][0];
            work["description"] = json!("Morning light");
            work["main_level"] = json!(0.8);
            work["loop"] = json!(false);
            work["loop_region"] = json!({"from": 2.0, "to": 10.0});
            work["scenes"][0]["entry"] = json!(1.5);
            work["lanes"] = json!([
                {"id": "track:1", "device": "Field", "parameter": "Time scale", "drawable": true,
                 "range": {"min": 0.1, "max": 4.0}, "points": [{"at": 0.0, "value": 0.25}, {"at": 6.0, "value": 0.75}]},
                {"id": "gen:1", "device": "Generator", "parameter": "Turbulence", "drawable": false,
                 "modulated_by": "sine · 0.5 Hz · automation", "points": []}]);
            reading["playback"]["held"] =
                json!({"expression:authored-a": ["field.params.timeScale"]});
        }
        let set = build(Mode::Expressions, &[value]);
        let dawn = &set.tracks[0];
        assert_eq!(dawn.info.as_deref(), Some("Morning light"));
        let edit = |act: &Act, operation: &str, takes: Option<&str>| {
            assert_eq!(act.action, "expressions.scene.edit");
            assert_eq!(act.input["operation"], operation);
            assert_eq!(act.takes.as_deref(), takes);
        };
        edit(&dawn.acts["renameTrack"], "expression-title", Some("title"));
        edit(&dawn.acts["colourTrack"], "colour", Some("colour"));
        edit(
            &dawn.acts["trackInfo"],
            "expression-description",
            Some("description"),
        );
        edit(&dawn.acts["insertClip"], "add", None);
        // A value held off its automation by hand: the Studio says which, and the track gives it back.
        assert_eq!(
            dawn.studio.as_ref().map(|s| s.held.clone()),
            Some(vec!["field.params.timeScale".to_owned()])
        );
        assert_eq!(dawn.acts["reenable"].action, "expressions.studio.reenable");
        assert_eq!(dawn.acts["reenable"].takes.as_deref(), Some("target"));
        assert!(
            dawn.kind
                .contains("1 value held off its automation by hand"),
            "{}",
            dawn.kind
        );
        // Each Scene lays its length and entry, and every cut of the Arrangement is the one Action, taking what the ruler gives.
        let opening = &set.clips[0];
        assert_eq!((opening.seconds, opening.entry), (Some(12.0), Some(1.5)));
        for (key, operation) in [
            ("moveClip", "move"),
            ("trimClip", "trim"),
            ("rollClip", "roll"),
            ("slipClip", "slip"),
            ("slideClip", "slide"),
            ("splitClip", "split"),
        ] {
            edit(&opening.acts[key], operation, Some("*"));
            assert_eq!(
                opening.acts[key].input["scene_ref"],
                "expression:authored-a:scene:main"
            );
        }
        edit(&opening.acts["duplicateClip"], "duplicate", None);
        edit(&opening.acts["deleteClip"], "remove", None);
        // The selected Scene's lanes: the recorded one is drawn by hand within its range, the generator's is read.
        assert_eq!(set.lanes.len(), 2);
        let drawn = &set.lanes[0];
        assert_eq!(drawn.id, "expression:authored-a:scene:main#lane/track:1");
        assert_eq!(
            (drawn.track.as_str(), drawn.clip.as_str()),
            ("expression:authored-a", "expression:authored-a:scene:main")
        );
        assert_eq!(
            drawn.range,
            Some(Stretch {
                start_s: 0.1,
                end_s: 4.0
            })
        );
        assert_eq!(
            drawn.points[1],
            LanePoint {
                at: 6.0,
                value: 0.75
            }
        );
        assert_eq!(drawn.acts["draw"].action, "expressions.lane.draw");
        assert_eq!(drawn.acts["draw"].input["track_id"], "track:1");
        assert_eq!(drawn.acts["draw"].takes.as_deref(), Some("points"));
        assert!(
            set.lanes[1].acts.is_empty()
                && set.lanes[1].modulated_by.as_deref() == Some("sine · 0.5 Hz · automation")
        );
        assert!(!set.lanes_absent.contains_key("automation"));
        // The presented work's loop brace, off and still where it was set; its ends move by the one Action.
        assert_eq!(
            set.loop_brace,
            Some(LoopBrace {
                start_s: 2.0,
                end_s: Some(10.0),
                off: true
            })
        );
        edit(&set.acts["setLoop"], "loop-edge", Some("*"));
        assert_eq!(set.acts["backToArrangement"].input["saved"], true);
        // The Main track: every Expression's level together.
        let main = set
            .tracks
            .iter()
            .find(|track| track.main)
            .expect("the Main track");
        assert_eq!(main.id, EXPRESSIONS_MAIN_TRACK);
        assert_eq!(main.mix.as_ref().and_then(|mix| mix.volume), Some(0.8));
        assert_eq!(
            main.acts["volume"].input,
            json!({"expression_ref": "expression:authored-a", "key": "main"})
        );
        for act in set
            .acts
            .values()
            .chain(set.lanes.iter().flat_map(|lane| lane.acts.values()))
            .chain(set.tracks.iter().flat_map(|track| track.acts.values()))
            .chain(set.clips.iter().flat_map(|clip| clip.acts.values()))
        {
            assert!(
                crate::expression_actions::holds(&act.action),
                "{} is an Action of Expressions",
                act.action
            );
        }
        let roundtrip: ModeSet = serde_json::from_value(serde_json::to_value(&set).unwrap())
            .expect("the Set round-trips");
        assert_eq!(roundtrip, set);
    }

    #[test]
    fn an_expression_whose_activator_is_off_launches_nothing_and_an_unread_store_says_why() {
        let set = build(Mode::Expressions, &[store(false)]);
        assert!(set
            .clips
            .iter()
            .all(|clip| !clip.acts.contains_key("launch")));
        assert_eq!(set.rows.len(), 2, "the stops stand, with nothing to launch");
        assert!(set.rows.iter().all(|row| row.acts.is_empty()));
        assert!(set.tracks[0].kind.contains("its Activator is off"));
        let unread = build(Mode::Expressions, &[unread(Slice::Expressions)]);
        assert_eq!(unread.tracks.len(), 1);
        assert!(unread.tracks[0]
            .absent
            .as_deref()
            .is_some_and(|why| why.starts_with("The Expressions are unread")));
    }

    #[test]
    fn a_sets_version_moves_exactly_when_the_set_does() {
        let sets = Sets::default();
        let held = Mutex::new(vec![unread(Slice::Sky)]);
        let answer_of = |_: Slice| held.lock().unwrap()[0].clone();
        let (first, moved) = sets.now(Mode::Techne, &answer_of);
        assert_eq!(
            (first["version"].as_u64(), moved),
            (Some(1), Some(1)),
            "the first build is a move"
        );
        assert_eq!(first["schema"], SCHEMA);
        assert_eq!(first["mode"], "techne");
        assert_eq!(
            sets.now(Mode::Techne, &answer_of).1,
            None,
            "built again from the same answers, it does not move"
        );
        assert!(
            sets.slice_moved(Slice::Worlds, &answer_of)
                .iter()
                .all(|(mode, _)| *mode == Mode::Central),
            "a slice moves only the Sets that read it"
        );
        held.lock().unwrap()[0] = answer(Slice::Sky, "read", json!({"epoch": "e"}), None);
        assert_eq!(
            sets.slice_moved(Slice::Sky, &answer_of),
            [(Mode::Techne, 2)],
            "the slice it reads moved it"
        );
        let roundtrip: ModeSet =
            serde_json::from_value(sets.now(Mode::Techne, &answer_of).0["set"].clone())
                .expect("the Set round-trips");
        assert_eq!(roundtrip.tracks[0].id, "techne:sky");
    }

    /// Advertised is enforced: `set_subscribe` and its `set_changed` notice take exactly the five modes.
    #[test]
    fn set_subscribe_and_its_notice_take_exactly_the_five_modes() {
        for mode in Mode::ALL {
            let op: crate::KernelOp =
                serde_json::from_value(json!({"op": "set_subscribe", "mode": mode.name()}))
                    .expect("a mode is subscribed to");
            assert!(
                matches!(op, crate::KernelOp::SetSubscribe { mode: subscribed, fresh: false } if subscribed == mode)
            );
            let notice = crate::events::KernelEvent::SetChanged {
                mode: mode.name().into(),
                version: 1,
            };
            assert!(notice.validate().is_ok());
        }
        assert!(serde_json::from_value::<crate::KernelOp>(
            json!({"op": "set_subscribe", "mode": "base"})
        )
        .is_err());
        assert!(crate::events::KernelEvent::SetChanged {
            mode: "base".into(),
            version: 1
        }
        .validate()
        .is_err());
        assert!(crate::events::KernelEvent::SetChanged {
            mode: "central".into(),
            version: 0
        }
        .validate()
        .is_err());
    }

    #[test]
    fn every_mode_has_a_wire_name_and_its_slices() {
        for mode in Mode::ALL {
            assert_eq!(Mode::from_name(mode.name()), Some(mode));
            assert_eq!(serde_json::to_value(mode).unwrap(), json!(mode.name()));
        }
        assert_eq!(Mode::from_name("base"), None);
        assert_eq!(
            Mode::Central.slices(),
            [Slice::Worlds, Slice::Day, Slice::Workcells]
        );
        assert_eq!(
            minted("note-2026-11-13-0905-2.html"),
            Some((2026, 11, 13, 9, 5, 2))
        );
        assert_eq!(minted("plan.html"), None);
        assert_eq!(
            unit_words("workflow-unit:inspect-source").as_deref(),
            Some("inspect-source")
        );
        assert_eq!(unit_words("workflow-unit:3C73CMWMP7956ZN0XFWD5FMFYW"), None);
    }
}
