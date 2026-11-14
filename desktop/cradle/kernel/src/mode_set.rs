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
//! | `expressions` | none                            | its owner (the native field) is no slice of the World Model yet (#1008)  |
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
            Mode::Expressions | Mode::Live => &[],
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
            Mode::Expressions => "Expressions · the native composition",
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
        Mode::Expressions => ModeSet {
            absent: Some("Expressions' owner, the native field and the Expression it presents, is no slice of the World Model yet, so the kernel builds no Set of it: its tracks are the open work's scenes, read by the window until O-I #1008.".into()),
            ..ModeSet::default()
        },
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
        })
        .collect();
    rows.extend((0..slots).map(|i| Row {
        id: format!("central:slot:{}", i + 1),
        name: format!("{}", named.len() + i + 1),
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
        ("clip.launch", "a task run from its clip: factory.task.run runs a task Factory ran on a session seated in a project of this World; a task of a Run that names no such session has no session to run on"),
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

/// A session Factory ran a task on in a project of this World, which the sessions slice (the root register's SessionSpaces) does not
/// list: its track is laid from Factory's own record of the attempt.
struct Seated {
    space: String,
    session: String,
    harness: Option<String>,
    world: String,
    project: String,
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
                    for record in run["attempts"]["reading"]["attempts"]
                        .as_array()
                        .into_iter()
                        .flatten()
                    {
                        let Some(attempt) = attempt_of(record) else {
                            continue;
                        };
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
                                    seated.entry(id.clone()).or_insert_with(|| Seated {
                                        space: space.clone(),
                                        session: session.clone(),
                                        harness: attempt.harness.clone(),
                                        world,
                                        project,
                                    });
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
    // The sessions Factory ran a task on in a project of this World that the root register does not list: each its own track, laid
    // from Factory's record, its menu's End session ending it (factory.session.end; manual §19.1), and a message dropped on it written
    // as its next task (factory.task.write, its words the instruction; §19.24 "To turn one into work, drag it onto the agent's track").
    for (id, seated) in &seated {
        let harness = seated
            .harness
            .as_deref()
            .map(|harness| harness.trim_start_matches("harness/").to_owned());
        let name = harness.clone().unwrap_or_else(|| {
            let session = seated.session.rsplit('/').next().unwrap_or(&seated.session);
            session.chars().take(16).collect()
        });
        tracks.push(Track {
            id: id.clone(),
            name: name.clone(),
            kind: format!(
                "an Agent session seated in {} · {} · laid from Factory's record of its tasks (its SessionSpace {} is no root register's)",
                seated.project,
                harness.map_or_else(|| "its harness unnamed".to_owned(), |harness| format!("its harness {harness}")),
                seated.space
            ),
            acts: BTreeMap::from([
                (
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
                ),
                (
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
                ),
            ]),
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
            });
        }
        // A task Factory ran on a session runs again from its clip (factory.task.run on its Run, on that session), unless it runs now.
        let mut clip_acts = BTreeMap::new();
        if let Some((last, (_, session))) =
            last.and_then(|last| Some((last, last.session.as_ref()?)))
        {
            if last.state != "running" && !task.state.is_empty() {
                clip_acts.insert(
                    "launch".to_owned(),
                    done(
                        act(
                            "factory.task.run",
                            json!({"state": task.state, "run_ref": task.run, "session": session}),
                            None,
                            "Factory's factory.task.run: the task run on its session under your grant, its log streaming, its end an attempt with its diff",
                        ),
                        format!("Task {} is running on its session.", task.task),
                    ),
                );
            }
        }
        clips.push(Clip {
            id,
            track: task.track.clone(),
            row: format!("batch:{n}"),
            subject: Some(task.task.clone()),
            acts: clip_acts,
            label: unit.unwrap_or_else(|| {
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
            status: last.and_then(|a| match a.state {
                "returned" => Some("done".to_owned()),
                "running" => Some("running".to_owned()),
                "prepared" => Some("waiting".to_owned()),
                _ => None,
            }),
            state: last.map(|a| a.state.to_owned()),
            at: start.map(|start| Span {
                start_unix_ms: start,
                end_unix_ms: if ended {
                    task.attempts.iter().filter_map(|a| a.end).max()
                } else {
                    None
                },
            }),
            note: Some(format!(
                "Factory's task {} in run {} · {} · the latest {}",
                task.task,
                task.run,
                plural(task.attempts.len(), "attempt", "attempts"),
                last.map(take_words).unwrap_or_default()
            )),
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
        let again = on
            .iter()
            .find(|clip| clip.subject.as_deref() == Some("task:a"))
            .unwrap();
        assert_eq!(
            (
                again.acts["launch"].action.as_str(),
                &again.acts["launch"].input
            ),
            (
                "factory.task.run",
                &json!({"state": state, "run_ref": "run:a", "session": "agent-session/atelier-chat-1"})
            )
        );
        assert!(
            on.iter()
                .find(|clip| clip.subject.as_deref() == Some("task:b"))
                .unwrap()
                .acts
                .is_empty(),
            "a running task does not launch again"
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
                Some(format!("The agent is seated on a new track in {project}: its session is open.").as_str())
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
        for mode in [Mode::Expressions, Mode::Live] {
            let set = build(mode, &[]);
            assert!(
                set.absent
                    .as_deref()
                    .is_some_and(|why| why.contains("no slice of the World Model")),
                "{mode:?}"
            );
            assert!(set.tracks.is_empty());
        }
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
