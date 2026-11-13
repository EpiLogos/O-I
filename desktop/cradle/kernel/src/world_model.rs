//! The World Model (docs/architecture/world-shell.md §9.2, layer 2; O-I #1001; PROGRAMME R35): the owners' present state, held
//! in the kernel as one typed projection, so that no device reads an owner at the point of use.
//!
//! The model is a set of slices. Each names its owner and the watch scopes (`watch::Scope::wire`) its state is read from:
//!
//! | slice       | owner     | read from                                                               | scopes        |
//! |-------------|-----------|-------------------------------------------------------------------------|---------------|
//! | `worlds`    | Central   | the root's disclosure (`world_browse`), and each world's pages (`page`) | root, work    |
//! | `day`       | Central   | today's Day of the root register (`day_read`)                           | root, clock   |
//! | `agents`    | Actuation | the census (census.rs): detection, a start of each, AIKit's detail and  | clock (a day) |
//! |             |           | what each carries (its model, skill set, and its floor's law: Central)  |               |
//! | `sessions`  | AIKit     | the root register's Agent sessions (`agency_read`)                      | aikit, root   |
//! | `models`    | AIKit     | the resolved model catalogue (`model_catalogue`)                        | aikit         |
//! | `factory`   | Factory   | runs, tasks and attempts: the sources in scope (`factory_owner` locate),  | root, work    |
//! |             |           | each one's journeys and runs, each run's reading and attempt field      |               |
//! | `workcells` | Workcell  | the seats and the workcells (`seat_status_read`, `workcell_status_read`)| seats         |
//! | `sky`       | QL        | the dated sky now, as seen from Earth (`nara_identity` transit)         | clock         |
//!
//! A slice is read through the kernel's own ops (`Via`, the kernel's dispatch), so every owner reading still goes the one read
//! path (read_cache.rs) and the model is a projection over it, never a second cache of owner answers. It is loaded once at
//! launch (`start`, on its own thread), and kept: when the change watch says a slice's scopes moved, it is read again; when an
//! op of the kernel's writes to a slice's owner and succeeds, the slice is read again before anyone is answered from it
//! (`written`). A write the owner refused changes nothing, so it leaves the model as it was.
//!
//! Each slice carries a version that moves exactly when its state (or the words of its owner's refusal) changes, and each such
//! move is one change notice (`KernelEvent::ModelChanged`, wire `model_changed`). A slice whose owner cannot be read carries the
//! owner's words beside the last state it held; it is never emptied by a refusal.
//!
//! Devices and views read the model by one op, `model_subscribe(slice)`, and ask again on its change notice.
use crate::{KernelOp, KernelOpOutcome};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::BTreeSet;
use std::sync::{Arc, Condvar, Mutex, OnceLock};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

/// The schema of one slice's answer.
pub const SCHEMA: &str = "oi.world-model-slice/v1";

/// The folder your world keeps its pages in, Central-relative (centralWorlds.ts `YOUR_WORLD_FOLDER`).
pub const YOUR_WORLD_FOLDER: &str = "Control/user/flows";

/// The model's slices.
#[derive(Clone, Copy, Debug, Deserialize, Eq, Hash, Ord, PartialEq, PartialOrd, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Slice {
    Worlds,
    Day,
    Agents,
    Sessions,
    Models,
    Factory,
    Workcells,
    Sky,
}

/// When the clock moves a slice.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Grain {
    /// The clock does not move it.
    None,
    /// A new day does.
    Day,
    /// Each clock notice does, once its reading is this old.
    After(Duration),
}

impl Slice {
    pub const ALL: [Slice; 8] = [
        Slice::Worlds,
        Slice::Day,
        Slice::Agents,
        Slice::Sessions,
        Slice::Models,
        Slice::Factory,
        Slice::Workcells,
        Slice::Sky,
    ];

    /// The wire name.
    pub fn name(self) -> &'static str {
        match self {
            Slice::Worlds => "worlds",
            Slice::Day => "day",
            Slice::Agents => "agents",
            Slice::Sessions => "sessions",
            Slice::Models => "models",
            Slice::Factory => "factory",
            Slice::Workcells => "workcells",
            Slice::Sky => "sky",
        }
    }

    pub fn from_name(name: &str) -> Option<Self> {
        Self::ALL.into_iter().find(|slice| slice.name() == name)
    }

    /// The product that holds this slice's state.
    pub fn owner(self) -> &'static str {
        match self {
            Slice::Worlds | Slice::Day => "Central",
            Slice::Agents => "Actuation",
            Slice::Sessions | Slice::Models => "AIKit",
            Slice::Factory => "Factory",
            Slice::Workcells => "Workcell",
            Slice::Sky => "QL",
        }
    }

    /// The watch scopes its state is read from (`watch::Scope::wire`); `project:<Name>` moves every slice that lists `work`.
    pub fn scopes(self) -> &'static [&'static str] {
        match self {
            Slice::Worlds | Slice::Factory => &["root", "work"],
            Slice::Day => &["root", "clock"],
            // Starting each agent costs a process apiece: the census is read at launch, after a write that changes an agent's
            // standing, and on a new day, never on AIKit's churn.
            Slice::Agents => &["clock"],
            Slice::Models => &["aikit"],
            Slice::Sessions => &["aikit", "root"],
            Slice::Workcells => &["seats"],
            Slice::Sky => &["clock"],
        }
    }

    fn grain(self) -> Grain {
        match self {
            Slice::Day | Slice::Agents => Grain::Day,
            // The sky is asked for at most five minutes old (qlSky.ts `max_age_seconds: 300`).
            Slice::Sky => Grain::After(Duration::from_secs(300)),
            _ => Grain::None,
        }
    }

    /// Whether a change notice naming `scope` moves this slice, read at `read_at` (ms since the epoch), now `now`.
    fn moved_by(self, scope: &str, read_at: Option<u64>, now: u64) -> bool {
        if scope == "clock" {
            return match self.grain() {
                Grain::None => false,
                Grain::Day => read_at.is_none_or(|at| day_of(at) != day_of(now)),
                Grain::After(age) => {
                    read_at.is_none_or(|at| now.saturating_sub(at) >= age.as_millis() as u64)
                }
            };
        }
        scope == "all"
            || self.scopes().contains(&scope)
            || (scope.starts_with("project:") && self.scopes().contains(&"work"))
    }
}

/// The local calendar day of an instant in ms since the epoch.
fn day_of(ms: u64) -> jiff::civil::Date {
    jiff::Timestamp::from_millisecond(ms as i64)
        .map(|at| at.to_zoned(jiff::tz::TimeZone::system()).date())
        .unwrap_or_default()
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|elapsed| elapsed.as_millis() as u64)
        .unwrap_or(0)
}

/// How the model asks the kernel: one op through the kernel's own dispatch (`dispatch::dispatch`), answered with its outcome.
pub type Via<'a> = &'a (dyn Fn(KernelOp) -> Result<KernelOpOutcome, String> + Sync);

/// What the model holds of one slice.
#[derive(Clone, Debug, Default)]
struct Held {
    version: u64,
    value: Option<Value>,
    error: Option<String>,
    read_at: Option<u64>,
    /// Read again before it is answered: an op of the kernel's wrote to its owner since it was read.
    written: bool,
}

#[derive(Default)]
struct Cell {
    held: Mutex<Held>,
    /// Held while the slice is being read, so two readers never read one slice at once: the second takes what the first read.
    reading: Mutex<()>,
}

/// The slices waiting for the model's own thread to read them again.
#[derive(Default)]
struct Queue {
    due: Mutex<BTreeSet<Slice>>,
    ready: Condvar,
}

/// How the model's own reads ask the kernel, and whom it tells of a move.
type Asking = Arc<dyn Fn(KernelOp) -> Result<KernelOpOutcome, String> + Send + Sync>;
type Telling = Arc<dyn Fn(Slice, u64) + Send + Sync>;

/// The process's World Model.
pub struct Model {
    cells: [Cell; 8],
    queue: Queue,
    running: OnceLock<(Asking, Telling)>,
}

impl Model {
    fn new() -> Self {
        Self {
            cells: Default::default(),
            queue: Queue::default(),
            running: OnceLock::new(),
        }
    }

    /// The process's one model.
    pub fn global() -> &'static Model {
        static MODEL: OnceLock<Model> = OnceLock::new();
        MODEL.get_or_init(Model::new)
    }

    fn cell(&self, slice: Slice) -> &Cell {
        &self.cells[Slice::ALL.iter().position(|s| *s == slice).unwrap_or(0)]
    }

    fn held(&self, slice: Slice) -> Held {
        self.cell(slice)
            .held
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .clone()
    }

    /// The slice as the model holds it, reading it first when it has never been read or was written since, or when the caller
    /// asks for it `fresh` (the read before a write): its answer, and the version a read made here moved it to (a change notice
    /// the caller records), if it did.
    pub fn subscribe(&self, slice: Slice, via: Via<'_>, fresh: bool) -> (Value, Option<u64>) {
        let held = self.held(slice);
        if !fresh && held.read_at.is_some() && !held.written {
            return (answer(slice, &held), None);
        }
        let moved = self.read_once(slice, via, !fresh, fresh);
        (answer(slice, &self.held(slice)), moved)
    }

    /// The slice's answer as the model holds it now, without reading it (mode_set.rs builds each mode's Set from these).
    pub fn held_answer(&self, slice: Slice) -> Value {
        answer(slice, &self.held(slice))
    }

    /// The slice's value as the model holds it, read first through the model's own asking when it never was: for a kernel act
    /// that decides from the model (a new conversation opens with the census's first agent that starts; O-I #1003). `None` when
    /// the model has not started (a kernel in a test) or the slice's owner has never answered.
    pub fn value_now(&self, slice: Slice) -> Option<Value> {
        let (asking, telling) = self.running.get()?;
        let via = |op: KernelOp| asking(op);
        let (answer, moved) = self.subscribe(slice, &via, false);
        if let Some(version) = moved {
            telling(slice, version);
        }
        answer
            .get("value")
            .filter(|value| !value.is_null())
            .cloned()
    }

    /// Read the slice again now; the version it moved to, if it moved.
    pub fn read_again(&self, slice: Slice, via: Via<'_>) -> Option<u64> {
        self.read_once(slice, via, false, false)
    }

    /// One read of a slice, under its reading lock. With `only_if_due`, a reader that waited for another's read takes that read
    /// instead of reading again. A slice written since it was read, or asked for `fresh`, is read from its owners past every
    /// reading the kernel holds (read_cache.rs `with_fresh`): a write's effect is never answered from before it.
    fn read_once(&self, slice: Slice, via: Via<'_>, only_if_due: bool, fresh: bool) -> Option<u64> {
        let cell = self.cell(slice);
        let _reading = cell.reading.lock().unwrap_or_else(|e| e.into_inner());
        let started = now_ms();
        if only_if_due {
            let held = cell.held.lock().unwrap_or_else(|e| e.into_inner());
            if held.read_at.is_some() && !held.written {
                return None;
            }
        }
        let written =
            std::mem::take(&mut cell.held.lock().unwrap_or_else(|e| e.into_inner()).written);
        let read = if fresh || written {
            crate::read_cache::with_fresh(|| load(slice, via))
        } else {
            load(slice, via)
        };
        let mut held = cell.held.lock().unwrap_or_else(|e| e.into_inner());
        let moved = take(&mut held, read, started);
        moved.then_some(held.version)
    }

    /// The slices a change notice naming `scopes` moves.
    pub fn moved_by(&self, scopes: &[String]) -> Vec<Slice> {
        let now = now_ms();
        Slice::ALL
            .into_iter()
            .filter(|slice| {
                let read_at = self.held(*slice).read_at;
                scopes
                    .iter()
                    .any(|scope| slice.moved_by(scope, read_at, now))
            })
            .collect()
    }

    /// The change watch said `scopes` moved: the slices they move are read again now, side by side, and each move told, before
    /// this returns. The watch calls it before it tells the host (watch.rs `start_global`), so the shell's `readings_changed`
    /// comes after the model holds what moved, and a view that asks again on it is answered from the moved state.
    pub fn scopes_moved(&self, scopes: &[String]) {
        let Some((asking, telling)) = self.running.get() else {
            return;
        };
        self.read_side_by_side(&self.moved_by(scopes), asking, telling);
    }

    /// Read `slices` again, each on its own thread, telling each move.
    fn read_side_by_side(&self, slices: &[Slice], asking: &Asking, telling: &Telling) {
        std::thread::scope(|scope| {
            for slice in slices {
                scope.spawn(move || {
                    let via = |op| asking(op);
                    if let Some(version) = self.read_again(*slice, &via) {
                        telling(*slice, version);
                    }
                });
            }
        });
    }

    /// An op of the kernel's wrote to the owners of `slices` and succeeded: each is read again before it is next answered, and
    /// on the model's thread, so its change notice goes out though no one asks.
    pub fn written(&self, slices: &[Slice]) {
        for slice in slices {
            self.cell(*slice)
                .held
                .lock()
                .unwrap_or_else(|e| e.into_inner())
                .written = true;
        }
        self.due(slices.to_vec());
    }

    fn due(&self, slices: Vec<Slice>) {
        if slices.is_empty() || self.running.get().is_none() {
            return;
        }
        let mut due = self.queue.due.lock().unwrap_or_else(|e| e.into_inner());
        due.extend(slices);
        self.queue.ready.notify_one();
    }

    /// Start the model's own thread: every slice read once, side by side, at once; then each slice the watch or a write makes
    /// due, read again as it becomes due, side by side. `changed` is told each slice whose version moved, with its version.
    /// Starting twice starts nothing more.
    pub fn start(&'static self, via: Asking, changed: Telling) -> Result<(), String> {
        if self
            .running
            .set((Arc::clone(&via), Arc::clone(&changed)))
            .is_err()
        {
            return Ok(());
        }
        std::thread::Builder::new()
            .name("oi-world-model".into())
            .spawn(move || {
                let read = |slices: &[Slice]| self.read_side_by_side(slices, &via, &changed);
                read(&Slice::ALL);
                loop {
                    let slices: Vec<Slice> = {
                        let mut due = self.queue.due.lock().unwrap_or_else(|e| e.into_inner());
                        while due.is_empty() {
                            due = self
                                .queue
                                .ready
                                .wait(due)
                                .unwrap_or_else(|e| e.into_inner());
                        }
                        std::mem::take(&mut *due).into_iter().collect()
                    };
                    // Notices come in bursts: what moves within a quarter second is read once.
                    std::thread::sleep(Duration::from_millis(250));
                    let mut slices = slices;
                    slices.extend(std::mem::take(
                        &mut *self.queue.due.lock().unwrap_or_else(|e| e.into_inner()),
                    ));
                    slices.sort();
                    slices.dedup();
                    read(&slices);
                }
            })
            .map(|_| ())
            .map_err(|error| format!("the World Model's thread did not start: {error}"))
    }
}

/// Take one read into what is held: whether its version moved. The value moves it when it differs; a refusal moves it when its
/// words differ from the last, and keeps the last value.
fn take(held: &mut Held, read: Result<Value, String>, read_at: u64) -> bool {
    let first = held.read_at.is_none();
    held.read_at = Some(read_at);
    let moved = match read {
        Ok(value) => {
            let moved = held.value.as_ref() != Some(&value) || held.error.is_some();
            held.value = Some(value);
            held.error = None;
            moved
        }
        Err(words) => {
            let moved = held.error.as_deref() != Some(words.as_str());
            held.error = Some(words);
            moved
        }
    };
    if moved || first {
        held.version += 1;
    }
    moved || first
}

/// One slice's answer, as `model_subscribe` gives it.
fn answer(slice: Slice, held: &Held) -> Value {
    let state = match (&held.value, &held.error, held.read_at) {
        (_, _, None) => "unread",
        (Some(_), None, _) => "read",
        (None, Some(_), _) => "refused",
        (Some(_), Some(_), _) => "stale",
        (None, None, _) => "unread",
    };
    json!({
        "schema": SCHEMA,
        "slice": slice.name(),
        "owner": slice.owner(),
        "scopes": slice.scopes(),
        "version": held.version,
        "state": state,
        "value": held.value,
        "error": held.error,
        "read_at_unix_ms": held.read_at,
    })
}

// ---------------------------------------------------------------------------
// Which slices an op writes to.
// ---------------------------------------------------------------------------

/// The slices whose owners an op writes to when it succeeds; empty for an op that only reads. The census is moved only by what
/// changes an agent's standing or what it carries: an Actuation write, a client install, a credential, AIKit's configuration
/// (its model defaults), an adoption of skills and a render of the floor or a law adopted (action.rs `owner_slices`).
pub fn written_by(op: &KernelOp) -> Vec<Slice> {
    let name = crate::dispatch::op_name(op);
    let central = vec![Slice::Worlds, Slice::Day];
    match name.as_str() {
        "page"
        | "setup"
        | "ground_form"
        | "ground_authority"
        | "ground"
        | "ground_music"
        | "now"
        | "source_save"
        | "source_restore"
        | "instance_commission" => central,
        "central" | "day_source_open" => central,
        // An Action moves the slices its owner holds (action.rs `owner_slices`); one whose owner no prefix names may move any.
        "invoke_action" => match op {
            KernelOp::InvokeAction { invocation, .. } => {
                crate::action::owner_slices(&invocation.action).unwrap_or_else(|| {
                    let mut slices = central;
                    slices.extend([Slice::Sessions, Slice::Factory, Slice::Workcells]);
                    slices
                })
            }
            _ => Vec::new(),
        },
        "product_action_run" => {
            let mut slices = central;
            slices.extend([Slice::Sessions, Slice::Factory, Slice::Workcells]);
            slices
        }
        "factory_owner" => vec![Slice::Factory, Slice::Sessions],
        "encounter"
        | "encounter_provision"
        | "encounter_task_configure"
        | "encounter_task_remove"
        | "encounter_task_copy"
        | "encounter_session_detach"
        | "encounter_session_bench"
        | "encounter_session_attach"
        | "encounter_session_group"
        | "encounter_session_hot_swap"
        | "encounter_session_drag_out"
        | "agent_definition" => {
            vec![Slice::Sessions, Slice::Models, Slice::Factory]
        }
        // A skill root adopted, or a Procedure applied or undone, moves the skills an agent carries (census.rs); a capture or a
        // wiki write does not, and is never a reason to start every agent again.
        "aikit_write" => {
            use crate::owner_routes::AikitWrite;
            let mut slices = vec![Slice::Sessions, Slice::Models, Slice::Factory];
            if let KernelOp::AikitWrite {
                request:
                    AikitWrite::Adopt { .. }
                    | AikitWrite::ProcedureRun { .. }
                    | AikitWrite::ProcedureUndo { .. },
            } = op
            {
                slices.push(Slice::Agents);
            }
            slices
        }
        "client_install"
        | "credential_setup"
        | "credential_rotate"
        | "credential_revoke"
        | "actuation_write"
        | "config_apply"
        | "config_apply_reviewed"
        | "profile_use_apply" => {
            vec![Slice::Agents, Slice::Models, Slice::Sessions]
        }
        "workcell_write" => vec![Slice::Workcells],
        _ => Vec::new(),
    }
}

/// Whether an op's success moved its owner's state: it said so in a receipt, or it is an op that only writes.
/// The slices an op of the kernel's writes to, held from before it runs until its answer (dispatch.rs): when the owner took the
/// write they are read again before anyone is answered from them; when the owner refused it the model is left as it was.
pub struct Writing {
    slices: Vec<Slice>,
    name: String,
}

impl Writing {
    pub fn of(op: &KernelOp) -> Self {
        let slices = written_by(op);
        let name = if slices.is_empty() {
            String::new()
        } else {
            crate::dispatch::op_name(op)
        };
        Self { slices, name }
    }

    /// Mark the slices on `model` by the op's answer. Returns whether any were marked.
    pub fn settle(&self, model: &Model, result: &Result<KernelOpOutcome, String>) -> bool {
        let Ok(outcome) = result else {
            return false;
        };
        if self.slices.is_empty() || !wrote(&self.name, outcome) {
            return false;
        }
        model.written(&self.slices);
        true
    }
}

pub fn wrote(op_name: &str, outcome: &KernelOpOutcome) -> bool {
    if op_name == "invoke_action" {
        // An Action moved its owner when the owner took it and it was not a reading; a refusal leaves the model as it was.
        return !outcome.receipts.is_empty()
            || matches!(
                &outcome.result,
                crate::KernelOpResult::ActionDispatched {
                    dispatch: crate::action::ActionDispatch::Invoked { .. },
                    reads_only: false,
                }
            );
    }
    !outcome.receipts.is_empty()
        || matches!(
            op_name,
            "product_action_run"
                | "workcell_write"
                | "actuation_write"
                | "aikit_write"
                | "client_install"
                | "encounter_provision"
        )
}

// ---------------------------------------------------------------------------
// Reading each slice.
// ---------------------------------------------------------------------------

fn load(slice: Slice, via: Via<'_>) -> Result<Value, String> {
    match slice {
        Slice::Worlds => worlds(via),
        Slice::Day => payload(ask(via, json!({"op": "day_read"}))?),
        Slice::Agents => crate::census::read(via),
        Slice::Sessions => payload(ask(via, json!({"op": "agency_read", "project": ""}))?),
        Slice::Models => payload(ask(via, json!({"op": "model_catalogue"}))?),
        Slice::Factory => factory(via),
        Slice::Workcells => workcells(via),
        Slice::Sky => sky(via),
    }
}

fn ask(via: Via<'_>, op: Value) -> Result<KernelOpOutcome, String> {
    let name = op["op"].as_str().unwrap_or("?").to_owned();
    let op: KernelOp = serde_json::from_value(op).map_err(|error| {
        format!("the World Model asked an op the kernel does not take ({name}): {error}")
    })?;
    via(op)
}

/// An outcome's payload: its `data` when that is all it carries, else every field but the result's name.
fn payload(outcome: KernelOpOutcome) -> Result<Value, String> {
    let mut value = serde_json::to_value(&outcome.result).map_err(|error| error.to_string())?;
    let Some(object) = value.as_object_mut() else {
        return Ok(value);
    };
    object.remove("result");
    if object.len() == 1 {
        if let Some(data) = object.remove("data") {
            return Ok(data);
        }
    }
    Ok(value)
}

/// Central's root disclosure and its worlds: yours first, then each project whose ProjectCentral keeps a human ground and a wiki
/// (centralWorlds.ts `worldsOf`), each with its pages. The kernel answers before its first browse has finished (no root, no
/// error): it is asked again, fresh, a few times apart, and only then read as the absence it is.
fn worlds(via: Via<'_>) -> Result<Value, String> {
    let mut root = None;
    for attempt in 0..6 {
        // A read asked afresh (a write's own, or the read before one) browses afresh from the first.
        let fresh = attempt > 0 || crate::read_cache::fresh_asked();
        let outcome = ask(via, json!({"op": "world_browse", "fresh": fresh}))?;
        let value = serde_json::to_value(&outcome.result).map_err(|error| error.to_string())?;
        if value["result"] != "world_read" {
            return Err(format!(
                "Central's world browse answered {}",
                value["result"]
            ));
        }
        let navigator = &value["snapshot"]["navigator"];
        if navigator["root"].is_object() {
            root = Some(navigator["root"].clone());
            break;
        }
        if let Some(error) = navigator["error"].as_str() {
            return Err(error.to_owned());
        }
        std::thread::sleep(Duration::from_millis(400));
    }
    let root = root.ok_or("Central returned no root disclosure")?;
    let worlds = worlds_of(&root);
    let pages: Vec<Value> = worlds
        .iter()
        .map(|world| {
            let folder = world["folder"].as_str().unwrap_or_default();
            match ask(via, json!({"op": "page", "request": {"operation": "list", "path": folder}})).and_then(payload) {
                Ok(listing) => json!({"folder": folder, "state": "read", "listing": listing}),
                // A folder the owner says does not exist holds no pages yet.
                Err(why) if why.contains("No such file or directory") => json!({"folder": folder, "state": "read", "listing":
                    {"schema": "oi.page-list/v1", "path": folder, "pages": [], "not_pages": [], "more": false}}),
                Err(why) => json!({"folder": folder, "state": "refused", "why": why}),
            }
        })
        .collect();
    Ok(json!({"root": root, "worlds": worlds, "pages": pages}))
}

/// The worlds in Central's disclosure of its root (centralWorlds.ts `worldsOf`, which this replaces).
pub fn worlds_of(root: &Value) -> Vec<Value> {
    let yours = json!({
        "ref": root["control"]["agent_wiki"]["wiki"]["space_ref"].as_str().unwrap_or("central:wiki:root"),
        "name": "Your world",
        "kind": "yours",
        "folder": YOUR_WORLD_FOLDER,
        "project": null,
    });
    let mut worlds = vec![yours];
    for project in root["work"]["projects"].as_array().into_iter().flatten() {
        let ground = &project["projectcentral"];
        let (Some(reference), Some(folder)) = (
            ground["agent_wiki"]["wiki"]["space_ref"].as_str(),
            ground["user"]["path"].as_str(),
        ) else {
            continue;
        };
        if ground["user"]["exists"] != true {
            continue;
        }
        let name = project["world_name"]
            .as_str()
            .map(str::trim)
            .filter(|name| !name.is_empty())
            .or_else(|| project["name"].as_str())
            .unwrap_or_default();
        let mut world = json!({"ref": reference, "name": name, "kind": "project", "folder": folder, "project": project["name"]});
        if let Some(revision) = project["manifest_revision"].as_str() {
            world["revision"] = revision.into();
        }
        worlds.push(world);
    }
    worlds
}

/// Factory's runs, tasks and attempts in scope: Factory's own discovery over Central's root and every Work project; for each
/// source it located, the project's journeys and their runs (`development project`); and for each run its reading (`development
/// run`: its lifecycle, agencies and executions) and its attempt field (`attempt read`: each task's legs, attempts and
/// verifications). Each part stands on its own: a run Factory will not read says why beside the others. The runs of a source are
/// read side by side.
fn factory(via: Via<'_>) -> Result<Value, String> {
    let located = payload(ask(
        via,
        json!({"op": "factory_owner", "request": {"kind": "locate", "all": true}}),
    )?)?;
    let sources: Vec<Value> = located["locations"]
        .as_array()
        .into_iter()
        .flatten()
        .filter(|row| row["state"] == "located")
        .filter_map(|row| {
            let location = &row["location"];
            Some(factory_source(
                via,
                &row["project"],
                location["statePath"].as_str()?,
                location["projectRef"].as_str()?,
            ))
        })
        .collect();
    Ok(json!({"located": located, "sources": sources}))
}

/// One located Factory source: its journeys, and each of its runs with its tasks and attempts.
fn factory_source(via: Via<'_>, project: &Value, state_path: &str, project_ref: &str) -> Value {
    let reading = ask(
        via,
        json!({"op": "factory_development_read", "state_path": state_path, "read": "project", "subject": project_ref}),
    )
    .and_then(payload);
    let run_refs = reading.as_ref().map(run_refs_of).unwrap_or_default();
    let runs: Vec<Value> = std::thread::scope(|scope| {
        let reads: Vec<_> = run_refs
            .iter()
            .map(|run_ref| {
                // Carried: the run's reads are this read's, and a refresh asked of it is asked of them too.
                scope.spawn(crate::read_cache::carried(move || {
                    let run = ask(
                        via,
                        json!({"op": "factory_development_read", "state_path": state_path, "read": "run", "subject": run_ref}),
                    )
                    .and_then(payload);
                    let attempts = ask(
                        via,
                        json!({"op": "factory_attempt_read", "state_path": state_path, "run_ref": run_ref}),
                    )
                    .and_then(payload);
                    json!({"run_ref": run_ref, "run": part(run), "attempts": part(attempts)})
                }))
            })
            .collect();
        reads
            .into_iter()
            .zip(&run_refs)
            .map(|(read, run_ref)| {
                read.join().unwrap_or_else(|_| {
                    let why =
                        Err("the read of this run stopped before Factory answered".to_owned());
                    json!({"run_ref": run_ref, "run": part(why.clone()), "attempts": part(why)})
                })
            })
            .collect()
    });
    json!({
        "project": project, "state_path": state_path, "project_ref": project_ref,
        "journeys": part(reading), "runs": runs,
    })
}

/// The runs a project's journeys name, each once, in the order Factory gives them.
fn run_refs_of(project: &Value) -> Vec<String> {
    let mut runs: Vec<String> = Vec::new();
    for journey in project["journeys"].as_array().into_iter().flatten() {
        let named = journey.get("runRefs").or_else(|| journey.get("run_refs"));
        for run in named.and_then(Value::as_array).into_iter().flatten() {
            if let Some(run) = run.as_str() {
                if !runs.iter().any(|seen| seen == run) {
                    runs.push(run.to_owned());
                }
            }
        }
    }
    runs
}

/// One owner's part of a slice: what it read, or why not, in its words.
fn part(read: Result<Value, String>) -> Value {
    match read {
        Ok(value) => json!({"state": "read", "reading": value}),
        Err(why) => json!({"state": "refused", "why": why}),
    }
}

/// The seats and the workcells, each its own reading: one unreadable leaves the other.
fn workcells(via: Via<'_>) -> Result<Value, String> {
    let seats = ask(via, json!({"op": "seat_status_read"})).and_then(payload);
    let workcells = ask(via, json!({"op": "workcell_status_read"})).and_then(payload);
    if let (Err(seat_why), Err(workcell_why)) = (&seats, &workcells) {
        return Err(format!("{seat_why}; {workcell_why}"));
    }
    Ok(json!({"seats": part(seats), "workcells": part(workcells)}))
}

/// The dated sky now, as seen from Earth: QL's transit for this instant (qlSky.ts `skyRequestAt`, the shared sky).
fn sky(via: Via<'_>) -> Result<Value, String> {
    let epoch = jiff::Timestamp::now()
        .strftime("%Y-%m-%dT%H:%M:%SZ")
        .to_string();
    let request = json!({
        "schema": "ql.sky-request/v1", "epoch": epoch, "timezone": "UTC", "mode": "current",
        "perspective": "Apparent Geocentric", "zodiac": "Tropical", "ayanamsha": null, "observer": null,
        "max_age_seconds": 300, "backend_policy": "allow-moshier",
    });
    payload(ask(
        via,
        json!({"op": "nara_identity", "request": {"operation": "transit", "request": request}}),
    )?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_version_moves_exactly_when_the_state_or_the_refusal_changes() {
        let mut held = Held::default();
        assert!(
            take(&mut held, Ok(json!({"a": 1})), 1),
            "the first read is a change"
        );
        assert_eq!(held.version, 1);
        assert!(
            !take(&mut held, Ok(json!({"a": 1})), 2),
            "the same state is no change"
        );
        assert_eq!(held.version, 1);
        assert!(take(&mut held, Err("Central refused".into()), 3));
        assert_eq!(
            held.value,
            Some(json!({"a": 1})),
            "a refusal keeps the last state"
        );
        assert_eq!(answer(Slice::Worlds, &held)["state"], "stale");
        assert!(
            !take(&mut held, Err("Central refused".into()), 4),
            "the same words are no change"
        );
        assert!(
            take(&mut held, Ok(json!({"a": 1})), 5),
            "the owner answering again is a change"
        );
        assert_eq!(answer(Slice::Worlds, &held)["state"], "read");
        assert_eq!(held.version, 3);
    }

    /// A fake kernel whose world browse gives `answers` in turn (the last one again once they run out), and whose page owner
    /// lists every world's folder but a project's, which it says does not exist. The count is of browses.
    fn browsing(
        answers: Vec<(Option<Value>, Option<&'static str>)>,
    ) -> (
        impl Fn(KernelOp) -> Result<KernelOpOutcome, String> + Sync,
        Arc<std::sync::atomic::AtomicUsize>,
    ) {
        let browsed = Arc::new(std::sync::atomic::AtomicUsize::new(0));
        let count = Arc::clone(&browsed);
        let via = move |op: KernelOp| -> Result<KernelOpOutcome, String> {
            let body = serde_json::to_value(&op).expect("an op serialises");
            let result = match body["op"].as_str().unwrap_or_default() {
                "world_browse" => {
                    let n = count.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
                    let (root, error) = answers[n.min(answers.len() - 1)].clone();
                    crate::KernelOpResult::WorldRead {
                        snapshot: crate::KernelSnapshot {
                            focus: crate::focus::GlobalFocus::unfocused(),
                            surfaces: Default::default(),
                            buffers: Default::default(),
                            navigator: crate::world::NavigatorReading {
                                root,
                                project: None,
                                sources: None,
                                project_ref: None,
                                error: error.map(str::to_owned),
                            },
                        },
                    }
                }
                "page" if body["request"]["path"] == "Work/O-I/ProjectCentral/user" => {
                    return Err("No such file or directory (os error 2)".into())
                }
                "page" => crate::KernelOpResult::PageReading {
                    data: json!({"schema": "oi.page-list/v1", "path": body["request"]["path"], "pages": [], "not_pages": [], "more": false}),
                },
                other => panic!("the worlds slice asked {other}"),
            };
            Ok(KernelOpOutcome {
                receipts: Vec::new(),
                read_scopes: None,
                result,
            })
        };
        (via, browsed)
    }

    #[test]
    fn the_worlds_wait_for_centrals_first_browse_and_a_refusal_is_said_at_once() {
        let root = json!({
            "control": {"agent_wiki": {"wiki": {"space_ref": "central:wiki:root"}}},
            "work": {"projects": [{"name": "O-I", "projectcentral": {
                "user": {"exists": true, "path": "Work/O-I/ProjectCentral/user"},
                "agent_wiki": {"wiki": {"space_ref": "central:wiki:project:O-I"}},
            }}]},
        });
        let (late, browsed) = browsing(vec![(None, None), (None, None), (Some(root), None)]);
        let read = worlds(&late).expect("read once the root is disclosed");
        assert_eq!(
            browsed.load(std::sync::atomic::Ordering::SeqCst),
            3,
            "asked until the root was disclosed"
        );
        let refs: Vec<&str> = read["worlds"]
            .as_array()
            .expect("worlds")
            .iter()
            .map(|world| world["ref"].as_str().unwrap_or_default())
            .collect();
        assert_eq!(refs, ["central:wiki:root", "central:wiki:project:O-I"]);
        assert_eq!(
            read["pages"][1],
            json!({"folder": "Work/O-I/ProjectCentral/user", "state": "read", "listing":
                {"schema": "oi.page-list/v1", "path": "Work/O-I/ProjectCentral/user", "pages": [], "not_pages": [], "more": false}}),
            "a folder the owner says does not exist holds no pages yet"
        );

        let (refused, browsed) = browsing(vec![(None, Some("the map is unreadable"))]);
        assert_eq!(worlds(&refused), Err("the map is unreadable".to_owned()));
        assert_eq!(
            browsed.load(std::sync::atomic::Ordering::SeqCst),
            1,
            "a refusal is not asked again"
        );

        let (never, browsed) = browsing(vec![(None, None)]);
        assert_eq!(
            worlds(&never),
            Err("Central returned no root disclosure".to_owned())
        );
        assert_eq!(browsed.load(std::sync::atomic::Ordering::SeqCst), 6);
    }

    #[test]
    fn the_factory_slice_carries_each_located_sources_runs_with_their_tasks_and_attempts() {
        use crate::KernelOpResult::{FactoryAttemptReading, FactoryDevelopmentReading};
        let asked = Mutex::new(Vec::new());
        let via = |op: KernelOp| -> Result<KernelOpOutcome, String> {
            let body = serde_json::to_value(&op).expect("an op serialises");
            asked.lock().unwrap().push(body.clone());
            let result = match body["op"].as_str().unwrap_or_default() {
                "factory_owner" => FactoryDevelopmentReading {
                    data: json!({"contract": "oi.factory-source-discovery/v1", "locations": [
                        {"project": null, "root": "/c", "state": "located",
                         "location": {"statePath": "/c/.factory/development-state.json", "projectRef": "project:root", "runCount": 2}},
                        {"project": "O-I", "root": "/c/Work/O-I", "state": "absent", "error": "no .factory under /c/Work/O-I"},
                    ]}),
                },
                "factory_development_read" if body["read"] == "project" => {
                    FactoryDevelopmentReading {
                        data: json!({"projectRef": "project:root", "journeys": [
                            {"journeyRef": "journey:1", "runRefs": ["run:a", "run:b"]},
                            {"journeyRef": "journey:2", "runRefs": ["run:b"]},
                        ]}),
                    }
                }
                "factory_development_read" => FactoryDevelopmentReading {
                    data: json!({"runRef": body["subject"], "lifecycle": "active"}),
                },
                "factory_attempt_read" if body["run_ref"] == "run:b" => {
                    return Err("Factory: run:b keeps no attempt field".into())
                }
                "factory_attempt_read" => FactoryAttemptReading {
                    data: json!({"contract": "factory.attempt-reading/v1", "runRef": body["run_ref"]}),
                },
                other => panic!("the Factory slice asked {other}"),
            };
            Ok(KernelOpOutcome {
                receipts: Vec::new(),
                read_scopes: None,
                result,
            })
        };
        let value = factory(&via).expect("the slice reads");
        assert_eq!(
            value["located"]["locations"].as_array().map(Vec::len),
            Some(2),
            "Factory's discovery is carried whole"
        );
        let sources = value["sources"].as_array().expect("sources");
        assert_eq!(sources.len(), 1, "only a located source has runs");
        let source = &sources[0];
        assert_eq!(source["state_path"], "/c/.factory/development-state.json");
        assert_eq!(source["journeys"]["state"], "read");
        let runs: Vec<&str> = source["runs"]
            .as_array()
            .expect("runs")
            .iter()
            .map(|run| run["run_ref"].as_str().unwrap_or_default())
            .collect();
        assert_eq!(
            runs,
            ["run:a", "run:b"],
            "each run once, in Factory's order"
        );
        assert_eq!(source["runs"][0]["run"]["reading"]["lifecycle"], "active");
        assert_eq!(source["runs"][0]["attempts"]["state"], "read");
        assert_eq!(source["runs"][1]["run"]["state"], "read");
        assert_eq!(
            source["runs"][1]["attempts"],
            json!({"state": "refused", "why": "Factory: run:b keeps no attempt field"}),
            "a run Factory will not read says why, beside the others"
        );
        assert_eq!(
            asked.lock().unwrap().len(),
            1 + 1 + 2 * 2,
            "one discovery, one project, a run reading and an attempt field per run"
        );
    }

    #[test]
    fn a_refusal_before_any_state_is_read_as_refused_with_the_owners_words() {
        let mut held = Held::default();
        take(&mut held, Err("Factory found no state".into()), 1);
        let answer = answer(Slice::Factory, &held);
        assert_eq!(answer["state"], "refused");
        assert_eq!(answer["error"], "Factory found no state");
        assert_eq!(answer["owner"], "Factory");
        assert_eq!(answer["value"], Value::Null);
    }

    #[test]
    fn scopes_move_the_slices_that_read_from_them() {
        let now = now_ms();
        let moved = |scope: &str| -> Vec<&str> {
            Slice::ALL
                .into_iter()
                .filter(|slice| slice.moved_by(scope, Some(now), now))
                .map(Slice::name)
                .collect()
        };
        assert_eq!(moved("root"), ["worlds", "day", "sessions", "factory"]);
        assert_eq!(moved("project:O-I"), ["worlds", "factory"]);
        assert_eq!(moved("seats"), ["workcells"]);
        assert_eq!(
            moved("aikit"),
            ["sessions", "models"],
            "AIKit's churn never starts the agents again"
        );
        assert_eq!(moved("all").len(), 8);
        assert!(
            moved("clock").is_empty(),
            "a minute moves neither today's Day, the census, nor a sky read just now"
        );
        assert!(
            Slice::Agents.moved_by("clock", Some(now - 86_400_000), now),
            "a new day reads the census again"
        );
        let yesterday = now - 86_400_000;
        assert!(Slice::Day.moved_by("clock", Some(yesterday), now));
        assert!(Slice::Sky.moved_by("clock", Some(now - 301_000), now));
    }

    #[test]
    fn your_world_comes_first_and_a_project_without_a_ground_is_no_world() {
        let root = json!({"control": {"agent_wiki": {"wiki": {"space_ref": "central:wiki:root"}}}, "work": {"projects": [
            {"name": "O-I", "world_name": " Field ", "manifest_revision": "r1", "projectcentral": {"agent_wiki": {"wiki": {"space_ref": "central:wiki:o-i"}},
             "user": {"exists": true, "path": "Work/O-I/ProjectCentral/user"}}},
            {"name": "Bare", "projectcentral": {"agent_wiki": {"wiki": {"space_ref": "central:wiki:bare"}}, "user": {"exists": false, "path": "x"}}},
            {"name": "NoWiki", "projectcentral": {"user": {"exists": true, "path": "y"}}}
        ]}});
        let worlds = worlds_of(&root);
        assert_eq!(worlds.len(), 2);
        assert_eq!(worlds[0]["folder"], YOUR_WORLD_FOLDER);
        assert_eq!(worlds[1]["name"], "Field");
        assert_eq!(worlds[1]["revision"], "r1");
        assert_eq!(worlds[1]["project"], "O-I");
    }

    #[test]
    fn a_read_only_op_writes_to_no_slice_and_a_write_names_its_owners() {
        assert!(written_by(&KernelOp::ModelCatalogue).is_empty());
        assert!(written_by(&KernelOp::WorldBrowse { fresh: None }).is_empty());
        assert_eq!(written_by(&KernelOp::SeatStatusRead), Vec::<Slice>::new());
    }

    #[test]
    fn an_adoption_of_skills_moves_the_census_and_a_capture_does_not() {
        let write = |request: Value| -> KernelOp {
            serde_json::from_value(json!({"op": "aikit_write", "request": request}))
                .expect("an aikit_write op")
        };
        let adopt =
            write(json!({"kind": "adopt", "root": "/x/.claude/skills", "expect_digest": "d"}));
        let capture = write(json!({"kind": "capture", "title": "t", "body": "b"}));
        assert!(written_by(&adopt).contains(&Slice::Agents));
        assert!(!written_by(&capture).contains(&Slice::Agents));
        assert!(written_by(&capture).contains(&Slice::Sessions));
    }

    #[test]
    fn a_subscriber_is_answered_from_what_is_held_and_a_write_is_read_before_it_is_answered() {
        let model = Model::new();
        let asked = std::sync::atomic::AtomicU64::new(0);
        let via = |_op: KernelOp| -> Result<KernelOpOutcome, String> {
            let n = asked.fetch_add(1, std::sync::atomic::Ordering::SeqCst) + 1;
            Ok(KernelOpOutcome {
                receipts: Vec::new(),
                read_scopes: None,
                result: crate::KernelOpResult::ModelCatalogueReading {
                    data: json!({"n": n}),
                },
            })
        };
        let (first, moved) = model.subscribe(Slice::Models, &via, false);
        assert_eq!(first["value"], json!({"n": 1}));
        assert_eq!(moved, Some(1));
        let (again, moved) = model.subscribe(Slice::Models, &via, false);
        assert_eq!(again["value"], json!({"n": 1}), "held, not read again");
        assert_eq!(moved, None);
        model.written(&[Slice::Models]);
        let (after, moved) = model.subscribe(Slice::Models, &via, false);
        assert_eq!(
            after["value"],
            json!({"n": 2}),
            "read again after a write, before it is answered"
        );
        assert_eq!(moved, Some(2));
        assert_eq!(asked.load(std::sync::atomic::Ordering::SeqCst), 2);
    }

    #[test]
    fn a_fresh_subscription_and_a_written_slice_are_read_past_every_held_reading() {
        let model = Model::new();
        let reads = Mutex::new(Vec::new());
        let via = |_op: KernelOp| -> Result<KernelOpOutcome, String> {
            let mut reads = reads.lock().unwrap();
            reads.push(crate::read_cache::fresh_asked());
            Ok(KernelOpOutcome {
                receipts: Vec::new(),
                read_scopes: None,
                result: crate::KernelOpResult::ModelCatalogueReading {
                    data: json!({"n": reads.len()}),
                },
            })
        };
        model.subscribe(Slice::Models, &via, false);
        model.subscribe(Slice::Models, &via, false);
        let (fresh, moved) = model.subscribe(Slice::Models, &via, true);
        assert_eq!(
            fresh["value"],
            json!({"n": 2}),
            "asked fresh, it is read though it is held"
        );
        assert_eq!(moved, Some(2));
        model.written(&[Slice::Models]);
        model.subscribe(Slice::Models, &via, false);
        assert_eq!(
            *reads.lock().unwrap(),
            [false, true, true],
            "the first read may be held; the fresh one and the one after a write go to the owner"
        );
    }

    #[test]
    fn a_write_the_owner_refused_leaves_the_model_as_it_was_and_one_it_took_is_read_again() {
        let model = Model::new();
        let asked = std::sync::atomic::AtomicU64::new(0);
        let via = |_op: KernelOp| -> Result<KernelOpOutcome, String> {
            let n = asked.fetch_add(1, std::sync::atomic::Ordering::SeqCst) + 1;
            Ok(KernelOpOutcome {
                receipts: Vec::new(),
                read_scopes: None,
                result: crate::KernelOpResult::ModelCatalogueReading {
                    data: json!({"n": n}),
                },
            })
        };
        let (first, _) = model.subscribe(Slice::Workcells, &via, false);
        // A seat join is the seat instrument's Action through the registry (O-I #1002).
        let write = Writing::of(
            &serde_json::from_value::<KernelOp>(json!({"op": "invoke_action", "invocation": {
                "action": "workcell.seat.join", "target_ref": "workcell.seat.join",
                "input": {"workcell": "env-2", "product": "o-i", "actor": "agent:test"}}}))
            .expect("a seat join"),
        );
        assert!(
            !write.settle(&model, &Err("Workcell refused: env-2 is held".into())),
            "a refusal marks nothing"
        );
        let (after_refusal, moved) = model.subscribe(Slice::Workcells, &via, false);
        assert_eq!(after_refusal["value"], first["value"]);
        assert_eq!(after_refusal["version"], first["version"]);
        assert_eq!(moved, None, "and tells no change");
        assert_eq!(
            asked.load(std::sync::atomic::Ordering::SeqCst),
            2,
            "nothing read again: one read of the slice asks for the seats and the workcells"
        );
        let taken: Result<KernelOpOutcome, String> = Ok(KernelOpOutcome {
            receipts: Vec::new(),
            read_scopes: None,
            result: crate::KernelOpResult::ActionDispatched {
                dispatch: crate::action::ActionDispatch::Invoked {
                    owner_operation: "workcell.seat.join".into(),
                    data: json!({"outcome": "joined"}),
                },
                reads_only: false,
            },
        });
        assert!(
            write.settle(&model, &taken),
            "a seat join the instrument took marks its slice"
        );
        let (after_write, moved) = model.subscribe(Slice::Workcells, &via, false);
        assert_ne!(
            after_write["value"], first["value"],
            "read again before it is answered"
        );
        assert_eq!(asked.load(std::sync::atomic::Ordering::SeqCst), 4);
        assert_eq!(moved, Some(2));
        assert!(
            !Writing::of(&KernelOp::ModelCatalogue).settle(&model, &taken),
            "a read marks nothing"
        );
    }
}
