//! The World Model (docs/architecture/world-shell.md §9.2, layer 2; O-I #1001; PROGRAMME R35): the owners' present state, held
//! in the kernel as one typed projection, so that no device reads an owner at the point of use.
//!
//! The model is a set of slices. Each names its owner and the watch scopes (`watch::Scope::wire`) its state is read from:
//!
//! | slice       | owner     | read from                                                               | scopes        |
//! |-------------|-----------|-------------------------------------------------------------------------|---------------|
//! | `worlds`    | Central   | the root's disclosure (`world_browse`), and each world's pages (`page`) | root, work    |
//! | `day`       | Central   | today's Day of the root register (`day_read`), with the root's ground   | root, clock   |
//! |             |           | (`central` inspect), the Day's settings, and today's moves and field    |               |
//! | `agents`    | Actuation | the census (census.rs): detection, a start of each, AIKit's detail and  | clock (a day) |
//! |             |           | what each carries (its model, skill set, and its floor's law: Central)  |               |
//! | `roster`    | Central   | your world's agent profiles (`agent_definition` roster) and the card of | root          |
//! |             |           | each one you accepted, in its home World and each it ratifies           |               |
//! | `packet`    | AIKit     | the prepared context of each register a conversation can stand in (the  | aikit, root,  |
//! |             |           | root, each project the worlds hold) and of each of its sessions         | work          |
//! |             |           | (`encounter` context read)                                              |               |
//! | `scope`     | Central   | your world's effective sources and authored relations, and the own      | root, aikit,  |
//! |             |           | settings in AIKit of each session of each register (`encounter_session_ | work          |
//! |             |           | settings_list`)                                                         |               |
//! | `sessions`  | AIKit     | the root register's Agent sessions (`agency_read`), and the gateway:    | aikit, root   |
//! |             |           | its ecology, its conversation binding and that binding's harness reading|               |
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
    Packet,
    Scope,
    Roster,
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
    pub const ALL: [Slice; 11] = [
        Slice::Worlds,
        Slice::Day,
        Slice::Agents,
        Slice::Sessions,
        Slice::Models,
        Slice::Factory,
        Slice::Workcells,
        Slice::Sky,
        Slice::Packet,
        Slice::Scope,
        Slice::Roster,
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
            Slice::Packet => "packet",
            Slice::Scope => "scope",
            Slice::Roster => "roster",
        }
    }

    pub fn from_name(name: &str) -> Option<Self> {
        Self::ALL.into_iter().find(|slice| slice.name() == name)
    }

    /// The product that holds this slice's state.
    pub fn owner(self) -> &'static str {
        match self {
            Slice::Worlds | Slice::Day | Slice::Scope | Slice::Roster => "Central",
            Slice::Agents => "Actuation",
            Slice::Sessions | Slice::Models | Slice::Packet => "AIKit",
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
            // Each register's prepared context is AIKit's, kept for its sessions: your world's root and each project's (O-I #1005).
            Slice::Packet => &["aikit", "root", "work"],
            // Your world's sources and relations are the root's; each session's settings are AIKit's, in its own register.
            Slice::Scope => &["root", "aikit", "work"],
            // The profiles and each agent's participation are your world's root register's: AIKit's churn does not move them.
            Slice::Roster => &["root"],
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
    /// The writes ops of the kernel's made to the slice's owners, counted, and how many of them the last read to end had begun
    /// after. A read under way is not counted until it ends, so a subscriber who asks meanwhile waits for it rather than being
    /// answered from before the write, and a write that lands while a read runs leaves the slice due when that read ends.
    writes: u64,
    read_after: u64,
}

impl Held {
    /// Read again before it is answered: an op of the kernel's wrote to its owner after the last read that ended had begun.
    fn written(&self) -> bool {
        self.writes > self.read_after
    }
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
    cells: [Cell; Slice::ALL.len()],
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
        if !fresh && held.read_at.is_some() && !held.written() {
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
        let (written, writes) = {
            let held = cell.held.lock().unwrap_or_else(|e| e.into_inner());
            if only_if_due && held.read_at.is_some() && !held.written() {
                return None;
            }
            (held.written(), held.writes)
        };
        let read = if fresh || written {
            crate::read_cache::with_fresh(|| self.load(slice, via))
        } else {
            self.load(slice, via)
        };
        let mut held = cell.held.lock().unwrap_or_else(|e| e.into_inner());
        // The writes this read began after are read now; one that landed while it ran keeps the slice due.
        held.read_after = held.read_after.max(writes);
        let known = (slice == Slice::Worlds).then(|| projects_held(&held).ok());
        let moved = take(&mut held, read, started);
        let version = held.version;
        let projects_moved = known.is_some_and(|known| known != projects_held(&held).ok());
        drop(held);
        // The projects the worlds hold are the registers the packets and Scope read beside the root: a project come or gone (or the
        // worlds' first read) reads them again.
        if projects_moved {
            self.due(READ_BY_PROJECT.to_vec());
        }
        moved.then_some(version)
    }

    /// The projects the World Model knows: those Central discloses in the root its worlds slice holds (`projects_of`), or why it
    /// knows none yet.
    fn projects(&self) -> Result<Vec<String>, String> {
        projects_held(
            &self
                .cell(Slice::Worlds)
                .held
                .lock()
                .unwrap_or_else(|e| e.into_inner()),
        )
    }

    fn load(&self, slice: Slice, via: Via<'_>) -> Result<Value, String> {
        match slice {
            Slice::Worlds => worlds(via),
            Slice::Day => day(via),
            Slice::Agents => crate::census::read(via),
            Slice::Sessions => sessions(via),
            Slice::Models => payload(ask(via, json!({"op": "model_catalogue"}))?),
            Slice::Factory => factory(via),
            Slice::Workcells => workcells(via),
            Slice::Sky => sky(via),
            Slice::Packet => packet(via, self.projects()),
            Slice::Scope => scope(via, self.projects()),
            Slice::Roster => roster(via),
        }
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
                .writes += 1;
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
            .map_err(|error| format!("the World Model's thread did not start: {error}"))?;
        // The Day's turn (O-I #1005; manual §18.2 "The Day opens by itself and the close runs by itself"): once the instant
        // Central keeps for today's Day to turn has passed (its reading's `bounds`), the Day slice is read again, and that read
        // is Central's turn (central.rs `day`). Nobody presses anything for it.
        std::thread::Builder::new()
            .name("oi-day-turn".into())
            .spawn(move || loop {
                let held = self.held(Slice::Day);
                let turns_at = held
                    .value
                    .as_ref()
                    .and_then(|day| day["bounds"]["turns_at_unix_seconds"].as_u64())
                    .map(|at| (at + 1) * 1000);
                let now = now_ms();
                let wait = match turns_at {
                    Some(at) if at <= now => {
                        if held.read_at.is_none_or(|read| read < at) {
                            self.written(&[Slice::Day]);
                        }
                        DAY_TURN_LOOK
                    }
                    Some(at) => Duration::from_millis(at - now).min(DAY_TURN_LOOK),
                    None => DAY_TURN_LOOK,
                };
                std::thread::sleep(wait);
            })
            .map(|_| ())
            .map_err(|error| format!("the World Model's Day-turn thread did not start: {error}"))
    }
}

/// How often the Day-turn thread looks again at the instant today's Day turns, at most (a read moves it).
const DAY_TURN_LOOK: Duration = Duration::from_secs(60);

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
/// applied or reset (its model defaults and Skill Sets), an adoption of skills and a render of the floor or a law adopted
/// (action.rs `owner_slices`).
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
        | "encounter_session_drag_out" => {
            // A session's prepared context and its place in the root register are AIKit's: the packet and the scope read them.
            vec![
                Slice::Sessions,
                Slice::Models,
                Slice::Factory,
                Slice::Packet,
                Slice::Scope,
            ]
        }
        // An agent's definition is your world's roster (O-I #1005); it starts no agent, so the census is not read again for it.
        "agent_definition" => vec![
            Slice::Sessions,
            Slice::Models,
            Slice::Factory,
            Slice::Roster,
        ],
        // A session's own settings in AIKit written (its Wait, On no answer): Scope reads them. A read of them moves nothing.
        "encounter_session_settings" => match op {
            KernelOp::EncounterSessionSettings {
                request: Some(_), ..
            } => vec![Slice::Scope],
            _ => Vec::new(),
        },
        // A skill root adopted, or a Procedure applied or undone, moves the skills an agent carries (census.rs); a capture or a
        // wiki write does not, and is never a reason to start every agent again.
        "aikit_write" => {
            use crate::owner_routes::AikitWrite;
            // A capture lands in the packet it was made for.
            let mut slices = vec![Slice::Sessions, Slice::Models, Slice::Factory, Slice::Packet];
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
        | "config_reset"
        | "profile_use_apply" => {
            vec![Slice::Agents, Slice::Models, Slice::Sessions]
        }
        "workcell_write" => vec![Slice::Workcells],
        // A gateway binding's ingress rule, and a gateway this window starts or stops, are AIKit's gateway, which the sessions slice
        // carries (its ecology names the rules and the bindings).
        "harness_ingress_rule" | "gateway_service" => vec![Slice::Sessions],
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
                | "encounter_session_settings"
                | "harness_ingress_rule"
                | "gateway_service"
        )
}

// ---------------------------------------------------------------------------
// Reading each slice.
// ---------------------------------------------------------------------------

/// The slices that read a register of each project the World Model knows beside your world's root (O-I #1005).
const READ_BY_PROJECT: [Slice; 2] = [Slice::Packet, Slice::Scope];

/// The projects Central discloses in the root the held worlds carry (`projects_of`), or why the World Model knows none: its worlds
/// not read yet, or refused before they were ever read.
fn projects_held(worlds: &Held) -> Result<Vec<String>, String> {
    match (&worlds.value, &worlds.error) {
        (Some(worlds), _) => Ok(projects_of(&worlds["root"])),
        (None, Some(why)) => Err(format!(
            "the World Model holds none of your world's projects: Central's worlds were refused ({why})"
        )),
        (None, None) => Err("the World Model has not read your world's projects yet".to_owned()),
    }
}

/// The registers beside your world's root a conversation can stand in: each project Central discloses in its root (`work.projects`),
/// each once, in Central's order (agent/worldScope.ts `projectsOf`, the registers the shell's agency reads).
pub fn projects_of(root: &Value) -> Vec<String> {
    let mut names: Vec<String> = Vec::new();
    for project in root["work"]["projects"].as_array().into_iter().flatten() {
        if let Some(name) = project["name"].as_str().filter(|name| !name.is_empty()) {
            if !names.iter().any(|known| known == name) {
                names.push(name.to_owned());
            }
        }
    }
    names
}

/// One owner's reading Action, asked by the kernel's one act path (`act`, O-I #1002): its data, or the owner's words why it gave
/// none. A reading moves nothing, so asking it marks no slice written.
fn act(via: Via<'_>, action: &str, input: Value) -> Result<Value, String> {
    let outcome = ask(via, json!({"op": "act", "action": action, "input": input}))?;
    let value = serde_json::to_value(&outcome.result).map_err(|error| error.to_string())?;
    let dispatch = &value["dispatch"];
    if dispatch["state"] == "invoked" {
        return Ok(dispatch["data"].clone());
    }
    Err(dispatch["message"]
        .as_str()
        .or(dispatch["detail"].as_str())
        .map(str::to_owned)
        .unwrap_or_else(|| format!("{action} answered {dispatch}")))
}

/// How many owner reads of one slice run at once: each is an owner process.
const SIDE_BY_SIDE: usize = 8;

/// `read` of each key, side by side, a few at a time: each its own part, by its key, in the keys' order.
fn each_part<K: Sync>(
    keys: &[K],
    name: impl Fn(&K) -> String,
    read: impl Fn(&K) -> Result<Value, String> + Sync,
) -> serde_json::Map<String, Value> {
    let mut parts = serde_json::Map::new();
    for chunk in keys.chunks(SIDE_BY_SIDE) {
        let read = &read;
        let answers: Vec<Value> = std::thread::scope(|scope| {
            let reads: Vec<_> = chunk
                .iter()
                .map(|key| scope.spawn(crate::read_cache::carried(move || part(read(key)))))
                .collect();
            reads
                .into_iter()
                .map(|read| {
                    read.join()
                        .unwrap_or_else(|_| part(Err("this read stopped before it answered".into())))
                })
                .collect()
        });
        for (key, answer) in chunk.iter().zip(answers) {
            parts.insert(name(key), answer);
        }
    }
    parts
}

/// A register as AIKit's agency lists it (`agency_read`; "" is your world's root register): whether it lists any space (a register
/// no space stands in holds no conversation), and the agent sessions its spaces hold (`spaces[].agent_sessions`; agencySources.ts
/// `agencyRowsOf`), each once.
fn agency_of(via: Via<'_>, project: &str) -> Result<(bool, Vec<String>), String> {
    let agency = payload(ask(via, json!({"op": "agency_read", "project": project}))?)?;
    let spaces = agency["spaces"].as_array().map(Vec::as_slice).unwrap_or_default();
    let mut sessions: Vec<String> = spaces
        .iter()
        .filter_map(|space| space["agent_sessions"].as_object())
        .flat_map(|sessions| sessions.keys().cloned())
        .collect();
    sessions.sort();
    sessions.dedup();
    Ok((!spaces.is_empty(), sessions))
}

/// The agent sessions of your world's root register (`agency_of`).
fn root_sessions(via: Via<'_>) -> Result<Vec<String>, String> {
    agency_of(via, "").map(|(_, sessions)| sessions)
}

/// Why a project's register holds no packet: AIKit lists no space in it, so no conversation stands in it.
fn no_space(project: &str) -> String {
    format!("AIKit's agency lists no space in {project}'s register, so no conversation stands in it: the World Model reads no packet of it.")
}

/// Each part of `projects`, read side by side (`each_part`), by project; or why the World Model knows none.
fn by_project(
    projects: Result<Vec<String>, String>,
    read: impl Fn(&String) -> Result<Value, String> + Sync,
) -> Value {
    part(projects.map(|projects| Value::Object(each_part(&projects, String::clone, read))))
}

/// Today's Day of the root register (`day_read`: Central's turn and its reading of the Day, its page and its receipts), and beside
/// it what the Day device reads of Central (O-I #1005), each its own part: the root's ground (`central` inspect: the civil-time
/// policy, the Day's pointer, the register's NOW and the change horizon), the Day's settings (central.day.settings.read), and
/// today's moves and field (central.day.moves.read, central.day.field.read). Today's Day refused (a ground with no civil-time policy
/// yet) leaves the other parts, and says why in Central's words (`refused`); only when the ground refuses too is the slice refused.
fn day(via: Via<'_>) -> Result<Value, String> {
    let read = ask(via, json!({"op": "day_read"})).and_then(payload);
    let ground = ask(
        via,
        json!({"op": "central", "project": null, "request": {"kind": "inspect"}}),
    )
    .and_then(payload);
    let mut day = match (read, &ground) {
        (Ok(day @ Value::Object(_)), _) => day,
        (Ok(other), _) => json!({"refused": format!("Central's reading of today's Day is no object: {other}")}),
        (Err(day_why), Err(ground_why)) => return Err(format!("{day_why}; {ground_why}")),
        (Err(why), Ok(_)) => json!({"refused": why}),
    };
    let today = day["day_ref"].as_str().map(str::to_owned);
    let settings = act(via, "central.day.settings.read", json!({"project": null}));
    let of_today = |action: &str| match &today {
        Some(day_ref) => act(via, action, json!({"project": null, "day_ref": day_ref})),
        None => Err("Central's reading of today's Day names no day_ref".to_owned()),
    };
    let (moves, field) = (
        of_today("central.day.moves.read"),
        of_today("central.day.field.read"),
    );
    if let Some(object) = day.as_object_mut() {
        object.insert("ground".to_owned(), part(ground));
        object.insert("settings".to_owned(), part(settings));
        object.insert("moves".to_owned(), part(moves));
        object.insert("field".to_owned(), part(field));
    }
    Ok(day)
}

/// Your world's roster of agents (O-I #1005; manual §18.15, "The roster is yours"): Central's agent profiles of the root register
/// (`agent_definition` roster, central.agent-profile-roster/v1), and the card (`agent_card`, oi.human-agent-card/v1) of each agent
/// you accepted, in its home World and in each World it ratifies, by agent and then by World (`home`), each its own part. The
/// Agent's Identity page reads it here. The census (the agents slice) is not read again for it: a profile written starts no agent.
fn roster(via: Via<'_>) -> Result<Value, String> {
    let roster = payload(ask(
        via,
        json!({"op": "agent_definition", "project": null, "request": {"action": "roster"}}),
    )?)?;
    let cards = cards(via, &roster);
    Ok(json!({"roster": roster, "cards": cards}))
}

/// The card of each agent the roster says you accepted, in its home World and in each World it ratifies (`ratified_world_refs`),
/// by agent, then by World.
fn cards(via: Via<'_>, roster: &Value) -> serde_json::Map<String, Value> {
    let asked: Vec<(String, Option<String>)> = roster["profiles"]
        .as_array()
        .into_iter()
        .flatten()
        .filter(|entry| entry["accepted"] == true)
        .filter_map(|entry| {
            let profile = &entry["profile"];
            let agent = profile["agent_ref"].as_str()?.to_owned();
            let worlds: Vec<Option<String>> = std::iter::once(None)
                .chain(
                    profile["ratified_world_refs"]
                        .as_array()
                        .into_iter()
                        .flatten()
                        .filter_map(|world| world.as_str().map(|world| Some(world.to_owned()))),
                )
                .collect();
            Some(worlds.into_iter().map(move |world| (agent.clone(), world)))
        })
        .flatten()
        .collect();
    let read = each_part(
        &asked,
        |(agent, world)| format!("{agent}\n{}", world.as_deref().unwrap_or("home")),
        |(agent, world)| {
            ask(
                via,
                json!({"op": "agent_card", "agent_ref": agent, "world_ref": world}),
            )
            .and_then(payload)
        },
    );
    let mut cards = serde_json::Map::new();
    for (key, card) in read {
        let (agent, world) = key.split_once('\n').unwrap_or((key.as_str(), "home"));
        let by_world = cards
            .entry(agent.to_owned())
            .or_insert_with(|| json!({}));
        if let Some(by_world) = by_world.as_object_mut() {
            by_world.insert(world.to_owned(), card);
        }
    }
    cards
}

/// AIKit's prepared context (O-I #1005; manual §18.3, exactly what the agent reads from you), each its own part, in each register a
/// conversation can stand in: your world's root register's own (`register`) and each of its sessions' (`sessions`, by session),
/// read side by side; and the same of each project the World Model knows (`projects`, by project, each read in its own register),
/// where AIKit lists a space. The Packet reads the one its conversation holds.
fn packet(via: Via<'_>, projects: Result<Vec<String>, String>) -> Result<Value, String> {
    let context = |project: &str, session: Option<&str>| {
        ask(
            via,
            json!({"op": "encounter", "project": project, "request": {"action": "context", "agent_session": session,
                "request": {"operation": "read"}}}),
        )
        .and_then(payload)
    };
    let sessions = root_sessions(via)?;
    let by_session = each_part(&sessions, String::clone, |session| {
        context("", Some(session))
    });
    let projects = by_project(projects, |project| {
        let (spaced, sessions) = agency_of(via, project)?;
        if !spaced {
            return Ok(json!({"register": part(Err(no_space(project))), "sessions": {}}));
        }
        let by_session: serde_json::Map<String, Value> = sessions
            .iter()
            .map(|session| (session.clone(), part(context(project, Some(session)))))
            .collect();
        Ok(json!({"register": part(context(project, None)), "sessions": by_session}))
    });
    Ok(json!({"register": part(context("", None)), "sessions": by_session, "projects": projects}))
}

/// What Scope reads of your world (O-I #1005; manual §19.12), each its own part: its effective sources and its authored relations
/// as Central resolves them (central.world.effective-sources, central.world-relations.read), each root session's own settings in
/// AIKit (its Wait and On no answer), by session, and each project's sessions' (`projects`, by project, each read in its own register).
fn scope(via: Via<'_>, projects: Result<Vec<String>, String>) -> Result<Value, String> {
    let effective = act(
        via,
        "central.world.effective-sources",
        json!({"scope": "root", "world_ref": "control:root"}),
    );
    let relations = act(
        via,
        "central.world-relations.read",
        json!({"scope": "root", "ref": "control:root"}),
    );
    let settings = root_sessions(via).and_then(|sessions| settings_of(via, "", &sessions));
    let projects = by_project(projects, |project| {
        let (_, sessions) = agency_of(via, project)?;
        settings_of(via, project, &sessions)
    });
    Ok(json!({"effective": part(effective), "relations": part(relations), "settings": part(settings), "projects": projects}))
}

/// Each of a register's sessions' own settings in AIKit (`encounter_session_settings_list`: one owner read for the register, which
/// the kernel keeps while AIKit's home and the register stand), by session; a session AIKit refused says so in its part.
fn settings_of(via: Via<'_>, project: &str, sessions: &[String]) -> Result<Value, String> {
    if sessions.is_empty() {
        return Ok(json!({}));
    }
    let listed = payload(ask(
        via,
        json!({"op": "encounter_session_settings_list", "project": project, "agent_sessions": sessions}),
    )?)?;
    let readings = listed["readings"].as_array().map(Vec::as_slice).unwrap_or_default();
    let by_session = sessions
        .iter()
        .map(|session| {
            let read = match readings.iter().find(|reading| reading["agent_session"] == session.as_str()) {
                Some(reading) => match reading["refused"].as_str() {
                    Some(why) => Err(why.to_owned()),
                    None => Ok(reading.clone()),
                },
                None => Err(format!("AIKit's settings list holds no reading of {session}")),
            };
            (session.clone(), part(read))
        })
        .collect();
    Ok(Value::Object(by_session))
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

/// One located Factory source: its journeys, each of its runs with its tasks and attempts, and the sessions Factory started in
/// it, open or ended, each with the tasks written on it (`factory session list`, O-I #1006).
fn factory_source(via: Via<'_>, project: &Value, state_path: &str, project_ref: &str) -> Value {
    let reading = ask(
        via,
        json!({"op": "factory_development_read", "state_path": state_path, "read": "project", "subject": project_ref}),
    )
    .and_then(payload);
    let sessions = ask(
        via,
        json!({"op": "factory_owner", "request": {"kind": "session-list", "state_path": state_path}}),
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
        "journeys": part(reading), "runs": runs, "sessions": part(sessions),
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

/// The root register's Agent sessions (`agency_read`), with AIKit's gateway beside them as its own part (`gateway`), so a gateway
/// that does not answer leaves the sessions as they were read. The Factory chain's Gateway, Agent and Scope read the gateway here
/// (O-I #1006), never the owner.
fn sessions(via: Via<'_>) -> Result<Value, String> {
    let mut agency = payload(ask(via, json!({"op": "agency_read", "project": ""}))?)?;
    if let Some(object) = agency.as_object_mut() {
        object.insert("gateway".to_owned(), part(gateway(via)));
    }
    Ok(agency)
}

/// AIKit's gateway: its ecology (`aikit gateway ecology`), the conversation binding the harness controls address (the first
/// conversation surface's `binding_ref` it names), and that binding's harness reading (`aikit gateway agent --binding B sessions`,
/// the kernel's `harness_agent_read`) as its own part. A gateway that names no conversation leaves the binding null and says so.
fn gateway(via: Via<'_>) -> Result<Value, String> {
    let read = payload(ask(
        via,
        json!({"op": "aikit_read", "request": {"kind": "gateway-ecology"}}),
    )?)?;
    let ecology = read.get("data").cloned().unwrap_or(read);
    let Some(binding) = conversation_binding(&ecology) else {
        return Ok(
            json!({"ecology": ecology, "binding": null, "agent": part(Err(
                "AIKit's gateway names no conversation binding (`aikit gateway ecology`): no harness control has a binding to address.".to_owned(),
            ))}),
        );
    };
    let agent = ask(via, json!({"op": "harness_agent_read", "binding": binding}))
        .and_then(payload)
        .map(|reading| reading.get("document").cloned().unwrap_or(reading));
    Ok(json!({"ecology": ecology, "binding": binding, "agent": part(agent)}))
}

/// The binding the shell's harness controls address: the first conversation surface's `binding_ref` in AIKit's gateway ecology
/// (`{type: "ecology", ecology: {agencies[].sessions[].surfaces[].binding_ref}}`). Client status names harnesses, never a binding.
fn conversation_binding(ecology: &Value) -> Option<String> {
    if ecology["type"] != "ecology" {
        return None;
    }
    ecology["ecology"]["agencies"]
        .as_array()?
        .iter()
        .flat_map(|agency| agency["sessions"].as_array().into_iter().flatten())
        .flat_map(|session| session["surfaces"].as_array().into_iter().flatten())
        .find_map(|surface| {
            surface["binding_ref"]
                .as_str()
                .filter(|binding| !binding.is_empty())
                .map(str::to_owned)
        })
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
    fn the_sessions_slice_carries_the_gateway_its_binding_and_that_bindings_harness_reading() {
        use crate::KernelOpResult::{AgencyReading, HarnessAgentReading, OwnerRouteReading};
        let ecology =
            |agencies: Value| json!({"type": "ecology", "ecology": {"agencies": agencies}});
        let named = ecology(
            json!([{"sessions": [{"surfaces": [{"kind": "tui"}, {"binding_ref": "gateway-binding/lanea"}]}]}]),
        );
        let read = |gateway: Result<Value, String>, agent: Result<Value, String>| {
            let asked = Mutex::new(Vec::new());
            let via = |op: KernelOp| -> Result<KernelOpOutcome, String> {
                let body = serde_json::to_value(&op).expect("an op serialises");
                asked
                    .lock()
                    .unwrap()
                    .push(body["op"].as_str().unwrap_or_default().to_owned());
                let result = match body["op"].as_str().unwrap_or_default() {
                    "agency_read" => AgencyReading {
                        project_ref: "project:root".into(),
                        spaces: json!([]),
                        harness_disclosure: json!({}),
                        observed_at_unix_ms: 1,
                    },
                    "aikit_read" if body["request"]["kind"] == "gateway-ecology" => {
                        OwnerRouteReading {
                            route: "aikit gateway ecology".into(),
                            data: gateway.clone()?,
                            warnings: Vec::new(),
                        }
                    }
                    "harness_agent_read" => HarnessAgentReading {
                        binding: body["binding"].as_str().unwrap_or_default().to_owned(),
                        document: agent.clone()?,
                    },
                    other => panic!("the sessions slice asked {other}"),
                };
                Ok(KernelOpOutcome {
                    receipts: Vec::new(),
                    read_scopes: None,
                    result,
                })
            };
            let value = sessions(&via).expect("the agency reads");
            (value, asked.into_inner().unwrap())
        };

        let (value, asked) = read(
            Ok(named.clone()),
            Ok(json!({"model": "gpt-5", "approvals": "ask"})),
        );
        assert_eq!(
            value["spaces"],
            json!([]),
            "the agency reading stands as it was read"
        );
        assert_eq!(value["gateway"]["state"], "read");
        assert_eq!(
            value["gateway"]["reading"]["binding"], "gateway-binding/lanea",
            "the first conversation surface's binding"
        );
        assert_eq!(
            value["gateway"]["reading"]["ecology"], named,
            "the ecology is carried whole: Scope's Calls and the Frames read it"
        );
        assert_eq!(
            value["gateway"]["reading"]["agent"],
            json!({"state": "read", "reading": {"model": "gpt-5", "approvals": "ask"}})
        );
        assert_eq!(asked, ["agency_read", "aikit_read", "harness_agent_read"]);

        let (value, asked) = read(
            Ok(ecology(
                json!([{"sessions": [{"surfaces": [{"kind": "tui"}]}]}]),
            )),
            Ok(json!({})),
        );
        assert_eq!(
            value["gateway"]["reading"]["binding"],
            Value::Null,
            "a gateway that holds no conversation names no binding"
        );
        assert!(value["gateway"]["reading"]["agent"]["why"]
            .as_str()
            .unwrap()
            .contains("names no conversation binding"));
        assert!(
            !asked.contains(&"harness_agent_read".to_owned()),
            "no binding is read when none is named"
        );
        assert_eq!(
            conversation_binding(
                &json!({"type": "client-status", "harnesses": [{"binding_ref": "x"}]})
            ),
            None,
            "client status names harnesses, never a binding"
        );

        let (value, _) = read(Err("aikit: no gateway is configured".into()), Ok(json!({})));
        assert_eq!(
            value["gateway"],
            json!({"state": "refused", "why": "aikit: no gateway is configured"}),
            "a gateway refusal leaves the sessions"
        );
        assert_eq!(value["project_ref"], "project:root");

        let (value, _) = read(
            Ok(named),
            Err("the gateway at its socket did not answer".into()),
        );
        assert_eq!(
            value["gateway"]["state"], "read",
            "the binding's reading refused is that part's alone"
        );
        assert_eq!(
            value["gateway"]["reading"]["agent"],
            json!({"state": "refused", "why": "the gateway at its socket did not answer"})
        );
    }

    #[test]
    fn the_day_packet_scope_and_roster_carry_what_centrals_chain_reads_each_its_own_part() {
        use crate::action::ActionDispatch;
        use crate::KernelOpResult::{
            ActionDispatched, AgencyReading, AgentCardReading, AgentDefinitionReading,
            CentralReading, DayReading, EncounterReading, EncounterSessionSettingsListReading,
        };
        let asked = Mutex::new(Vec::<Value>::new());
        let via = |op: KernelOp| -> Result<KernelOpOutcome, String> {
            let body = serde_json::to_value(&op).expect("an op serialises");
            asked.lock().unwrap().push(body.clone());
            let action = body["action"].as_str().unwrap_or_default().to_owned();
            let result = match body["op"].as_str().unwrap_or_default() {
                "day_read" => DayReading {
                    data: json!({"day_ref": "day:1", "temporal": {"civil_date": "2026-11-14"}}),
                },
                "central" => CentralReading {
                    data: json!({"time": {"state": "ready"}}),
                },
                "act" => ActionDispatched {
                    dispatch: if action == "central.day.field.read" {
                        ActionDispatch::OwnerRefused {
                            owner_operation: action.clone(),
                            message: "the Day's settings name no field source".into(),
                        }
                    } else {
                        ActionDispatch::Invoked {
                            owner_operation: action.clone(),
                            data: json!({"action": action, "input": body["input"]}),
                        }
                    },
                    reads_only: true,
                },
                "agency_read" => AgencyReading {
                    project_ref: "project:root".into(),
                    spaces: json!([{"definition": {"id": "space/a"},
                        "agent_sessions": {"agent-session/b": {}, "agent-session/a": {}}}]),
                    harness_disclosure: json!({}),
                    observed_at_unix_ms: 1,
                },
                "encounter" => EncounterReading {
                    data: json!({"scope": {"agent_session": body["request"]["agent_session"]}, "items": []}),
                },
                "encounter_session_settings_list" => EncounterSessionSettingsListReading {
                    data: json!({"schema": "aikit.encounter-session-settings-list/v1", "readings": body["agent_sessions"]
                        .as_array().unwrap().iter().map(|session| if session == "agent-session/b" {
                            json!({"agent_session": session, "refused": "AIKit keeps no settings for agent-session/b"})
                        } else {
                            json!({"agent_session": session, "wait_seconds": 900})
                        }).collect::<Vec<_>>()}),
                },
                "agent_definition" => AgentDefinitionReading {
                    data: json!({"schema": "central.agent-profile-roster/v1", "profiles": [
                        {"accepted": true, "profile": {"agent_ref": "agent:fizz", "ratified_world_refs": ["project:QL"]}},
                        {"accepted": false, "profile": {"agent_ref": "agent:proposed"}}]}),
                },
                "agent_card" => AgentCardReading {
                    data: json!({"agent": body["agent_ref"], "world": body["world_ref"]}),
                },
                other => panic!("Central's chain asked {other}"),
            };
            Ok(KernelOpOutcome {
                receipts: Vec::new(),
                read_scopes: None,
                result,
            })
        };

        let day = day(&via).expect("today's Day reads");
        assert_eq!(day["day_ref"], "day:1", "the Day's reading stands as Central gave it");
        assert_eq!(
            day["ground"],
            json!({"state": "read", "reading": {"time": {"state": "ready"}}})
        );
        assert_eq!(
            day["settings"]["reading"],
            json!({"action": "central.day.settings.read", "input": {"project": null}}),
            "the Day's settings are the root register's"
        );
        assert_eq!(
            day["moves"]["reading"]["input"],
            json!({"project": null, "day_ref": "day:1"}),
            "today's moves are today's Day's"
        );
        assert_eq!(
            day["field"],
            json!({"state": "refused", "why": "the Day's settings name no field source"}),
            "one part refused is that part's alone"
        );
        assert!(
            asked
                .lock()
                .unwrap()
                .iter()
                .any(|op| op["op"] == "central" && op["request"]["kind"] == "inspect"),
            "the root's ground is Central's inspect"
        );

        let packet = packet(&via, Ok(Vec::new())).expect("the packet reads");
        assert_eq!(
            packet["register"]["reading"]["scope"]["agent_session"],
            Value::Null,
            "the root register's own prepared context"
        );
        let sessions: Vec<&String> = packet["sessions"].as_object().unwrap().keys().collect();
        assert_eq!(sessions, ["agent-session/a", "agent-session/b"]);
        assert_eq!(
            packet["sessions"]["agent-session/b"]["reading"]["scope"]["agent_session"],
            "agent-session/b"
        );

        let scope = scope(&via, Ok(Vec::new())).expect("scope reads");
        assert_eq!(
            scope["effective"]["reading"],
            json!({"action": "central.world.effective-sources",
                "input": {"scope": "root", "world_ref": "control:root"}})
        );
        assert_eq!(
            scope["relations"]["reading"]["action"],
            "central.world-relations.read"
        );
        assert_eq!(
            scope["settings"]["reading"]["agent-session/a"],
            json!({"state": "read", "reading": {"agent_session": "agent-session/a", "wait_seconds": 900}})
        );
        assert_eq!(
            asked
                .lock()
                .unwrap()
                .iter()
                .filter(|op| op["op"] == "encounter_session_settings_list")
                .map(|op| op["agent_sessions"].clone())
                .collect::<Vec<_>>(),
            [json!(["agent-session/a", "agent-session/b"])],
            "the register's sessions' settings are one owner read"
        );
        assert_eq!(
            scope["settings"]["reading"]["agent-session/b"],
            json!({"state": "refused", "why": "AIKit keeps no settings for agent-session/b"}),
            "a session AIKit keeps no settings for says so beside the others"
        );

        let roster = roster(&via).expect("the roster reads");
        assert_eq!(roster["roster"]["profiles"].as_array().unwrap().len(), 2);
        assert_eq!(
            roster["cards"]["agent:fizz"]["home"],
            json!({"state": "read", "reading": {"agent": "agent:fizz", "world": null}}),
            "the card in its home World"
        );
        assert_eq!(
            roster["cards"]["agent:fizz"]["project:QL"]["reading"]["world"],
            "project:QL",
            "and in each World it ratifies"
        );
        assert!(
            roster["cards"].get("agent:proposed").is_none(),
            "an agent you have not accepted has no card read"
        );
    }

    #[test]
    fn a_project_conversations_packet_and_settings_are_read_in_its_register() {
        use crate::KernelOpResult::{
            ActionDispatched, AgencyReading, EncounterReading, EncounterSessionSettingsListReading,
        };
        let asked = Mutex::new(Vec::<Value>::new());
        let via = |op: KernelOp| -> Result<KernelOpOutcome, String> {
            let body = serde_json::to_value(&op).expect("an op serialises");
            asked.lock().unwrap().push(body.clone());
            let project = body["project"].as_str().unwrap_or_default().to_owned();
            let result = match body["op"].as_str().unwrap_or_default() {
                "agency_read" => AgencyReading {
                    project_ref: format!("project:{project}"),
                    spaces: match project.as_str() {
                        "" => json!([{"agent_sessions": {"agent-session/root": {}}}]),
                        "O-I" => json!([{"agent_sessions": {"agent-session/o-i": {}}}]),
                        "Bare" => json!([]),
                        _ => return Err("Project is outside Central's disclosed ground".into()),
                    },
                    harness_disclosure: json!({}),
                    observed_at_unix_ms: 1,
                },
                "encounter" => EncounterReading {
                    data: json!({"scope": {"project": project, "agent_session": body["request"]["agent_session"]}, "items": []}),
                },
                "encounter_session_settings_list" => EncounterSessionSettingsListReading {
                    data: json!({"readings": body["agent_sessions"].as_array().unwrap().iter()
                        .map(|session| json!({"agent_session": session, "revision": format!("{project}:rev")})).collect::<Vec<_>>()}),
                },
                "act" => ActionDispatched {
                    dispatch: crate::action::ActionDispatch::Invoked {
                        owner_operation: body["action"].as_str().unwrap_or_default().into(),
                        data: json!({}),
                    },
                    reads_only: true,
                },
                other => panic!("the packet and Scope asked {other}"),
            };
            Ok(KernelOpOutcome {
                receipts: Vec::new(),
                read_scopes: None,
                result,
            })
        };
        let known = || Ok(vec!["O-I".to_owned(), "Bare".to_owned(), "Gone".to_owned()]);

        let read = packet(&via, known()).expect("the packet reads");
        let o_i = &read["projects"]["reading"]["O-I"]["reading"];
        assert_eq!(
            o_i["sessions"]["agent-session/o-i"]["reading"]["scope"],
            json!({"project": "O-I", "agent_session": "agent-session/o-i"}),
            "a project conversation's packet, read in its own register"
        );
        assert_eq!(
            o_i["register"]["reading"]["scope"],
            json!({"project": "O-I", "agent_session": null}),
            "and the project's register's own"
        );
        assert_eq!(
            read["projects"]["reading"]["Bare"]["reading"],
            json!({"register": {"state": "refused", "why": no_space("Bare")}, "sessions": {}}),
            "a register AIKit lists no space in holds no conversation, and its packet is not read"
        );
        assert_eq!(
            read["projects"]["reading"]["Gone"],
            json!({"state": "refused", "why": "Project is outside Central's disclosed ground"}),
            "a register AIKit's agency refused says so beside the others"
        );
        assert_eq!(
            read["sessions"]["agent-session/root"]["reading"]["scope"]["project"],
            "",
            "the root register's stand as they did"
        );
        assert!(
            !asked
                .lock()
                .unwrap()
                .iter()
                .any(|op| op["op"] == "encounter" && op["project"] == "Bare"),
            "nothing is read in a register no conversation can stand in"
        );

        let scope = scope(&via, known()).expect("scope reads");
        assert_eq!(
            scope["projects"]["reading"]["O-I"]["reading"]["agent-session/o-i"],
            json!({"state": "read", "reading": {"agent_session": "agent-session/o-i", "revision": "O-I:rev"}}),
            "a project session's settings, read in its own register"
        );
        assert_eq!(
            scope["projects"]["reading"]["Bare"]["reading"],
            json!({}),
            "no session, no settings read"
        );
        assert_eq!(
            scope["settings"]["reading"]["agent-session/root"]["reading"]["revision"],
            ":rev",
            "the root register's sessions' settings stand as they did"
        );

        let unknown = packet(&via, Err("the World Model has not read your world's projects yet".into()))
            .expect("the root register's packet reads without the projects");
        assert_eq!(
            unknown["projects"],
            json!({"state": "refused", "why": "the World Model has not read your world's projects yet"})
        );
        assert!(unknown["register"]["reading"].is_object());
    }

    #[test]
    fn the_projects_are_those_centrals_root_discloses_each_once_and_unknown_until_the_worlds_are_read() {
        let root = json!({"work": {"projects": [{"name": "O-I"}, {"name": ""}, {"name": "QL"}, {"name": "O-I"}, {"path": "x"}]}});
        assert_eq!(projects_of(&root), ["O-I", "QL"]);
        let mut worlds = Held::default();
        assert_eq!(
            projects_held(&worlds),
            Err("the World Model has not read your world's projects yet".to_owned())
        );
        take(&mut worlds, Err("the map is unreadable".into()), 1);
        assert!(projects_held(&worlds)
            .unwrap_err()
            .contains("Central's worlds were refused (the map is unreadable)"));
        take(&mut worlds, Ok(json!({"root": root, "worlds": [], "pages": []})), 2);
        assert_eq!(projects_held(&worlds), Ok(vec!["O-I".to_owned(), "QL".to_owned()]));
        take(&mut worlds, Err("Central refused".into()), 3);
        assert_eq!(
            projects_held(&worlds),
            Ok(vec!["O-I".to_owned(), "QL".to_owned()]),
            "a refusal keeps the projects last read"
        );
    }

    #[test]
    fn todays_day_refused_keeps_the_ground_beside_it_and_both_refused_refuse_the_slice() {
        use crate::KernelOpResult::{ActionDispatched, CentralReading};
        let ground_answers = std::sync::atomic::AtomicBool::new(true);
        let via = |op: KernelOp| -> Result<KernelOpOutcome, String> {
            let body = serde_json::to_value(&op).expect("an op serialises");
            let result = match body["op"].as_str().unwrap_or_default() {
                "day_read" => return Err("Central keeps no civil-time policy for this ground".into()),
                "central" if ground_answers.load(std::sync::atomic::Ordering::SeqCst) => CentralReading {
                    data: json!({"time": {"state": "unavailable"}}),
                },
                "central" => return Err("Central's ground is unreadable".into()),
                "act" => ActionDispatched {
                    dispatch: crate::action::ActionDispatch::Invoked {
                        owner_operation: "central.day.settings.read".into(),
                        data: json!({"revision": "absent"}),
                    },
                    reads_only: true,
                },
                other => panic!("the Day asked {other}"),
            };
            Ok(KernelOpOutcome {
                receipts: Vec::new(),
                read_scopes: None,
                result,
            })
        };
        let held = day(&via).expect("the ground answers, so the slice holds it");
        assert_eq!(
            held["refused"],
            "Central keeps no civil-time policy for this ground"
        );
        assert_eq!(held["ground"]["state"], "read", "the ground stands beside the refusal");
        assert_eq!(held["settings"]["state"], "read");
        assert_eq!(
            held["moves"]["why"],
            "Central's reading of today's Day names no day_ref"
        );
        ground_answers.store(false, std::sync::atomic::Ordering::SeqCst);
        let refused = day(&via).expect_err("neither answers");
        assert!(refused.contains("civil-time policy") && refused.contains("unreadable"), "{refused}");
    }

    #[test]
    fn a_profile_written_moves_the_roster_and_starts_no_agent_again() {
        let op: KernelOp = serde_json::from_value(
            json!({"op": "agent_definition", "project": null, "request": {"action": "roster"}}),
        )
        .unwrap();
        let moved = written_by(&op);
        assert!(moved.contains(&Slice::Roster), "{moved:?}");
        assert!(!moved.contains(&Slice::Agents), "the census is not read again for a profile: {moved:?}");
        // A session's settings written move Scope, which reads them; read, they move nothing.
        let settings = |request: Value| -> KernelOp {
            serde_json::from_value(json!({"op": "encounter_session_settings", "project": "",
                "agent_session": "agent-session/a", "request": request}))
            .unwrap()
        };
        assert_eq!(written_by(&settings(json!({"track": {"wait": 60}}))), vec![Slice::Scope]);
        assert!(written_by(&settings(Value::Null)).is_empty(), "a read of the settings");
    }

    #[test]
    fn the_factory_slice_carries_each_located_sources_runs_with_their_tasks_and_attempts() {
        use crate::KernelOpResult::{FactoryAttemptReading, FactoryDevelopmentReading};
        let asked = Mutex::new(Vec::new());
        let via = |op: KernelOp| -> Result<KernelOpOutcome, String> {
            let body = serde_json::to_value(&op).expect("an op serialises");
            asked.lock().unwrap().push(body.clone());
            let result = match body["op"].as_str().unwrap_or_default() {
                "factory_owner" if body["request"]["kind"] == "session-list" => {
                    FactoryDevelopmentReading {
                        data: json!({"contract": "factory.session-list/v1", "sessions": [
                            {"contract": "factory.session/v1", "state": "open", "session": "agent-session/s1", "tasks": []},
                        ]}),
                    }
                }
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
        assert_eq!(
            source["sessions"]["reading"]["sessions"][0]["session"], "agent-session/s1",
            "the sessions Factory started in the source are carried, open before any task ran"
        );
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
            1 + 1 + 1 + 2 * 2,
            "one discovery, one project, its sessions, a run reading and an attempt field per run"
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
        assert_eq!(
            moved("root"),
            ["worlds", "day", "sessions", "factory", "packet", "scope", "roster"]
        );
        assert_eq!(
            moved("project:O-I"),
            ["worlds", "factory", "packet", "scope"],
            "a project's change moves the packets and Scope, which read its register"
        );
        assert_eq!(moved("seats"), ["workcells"]);
        assert_eq!(
            moved("aikit"),
            ["sessions", "models", "packet", "scope"],
            "AIKit's churn never starts the agents again, nor reads your roster's cards"
        );
        assert_eq!(moved("all").len(), 11);
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
    fn a_gateway_started_or_stopped_here_moves_the_sessions_slice_that_carries_it() {
        let service: KernelOp =
            serde_json::from_value(json!({"op": "gateway_service", "on": true}))
                .expect("a gateway_service op");
        assert_eq!(written_by(&service), vec![Slice::Sessions]);
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
    fn a_reset_of_aikit_configuration_moves_the_census_as_its_apply_does() {
        // Settings' Reset clears what the census carries (a model default, the default Skill Sets), as Apply sets it.
        let reset: KernelOp = serde_json::from_value(json!({"op": "config_reset",
            "setting_ref": "ai-kit:models:models.default", "scope": {"scope_kind": "machine"}}))
        .expect("a config_reset op");
        assert!(written_by(&reset).contains(&Slice::Agents));
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
    fn a_subscriber_who_asks_while_a_written_slice_is_read_again_waits_for_that_read() {
        // The model's own thread reads a written slice again (`read_again`), and that read can be slow (a world's pages ask
        // Central for its effective sources). A subscriber who asks while it runs is answered from after the write, never
        // from the reading the write retired: the foundation gate's act 1 was once answered the worlds slice's version 1,
        // without the page it had just saved, while that read was still running (O-I ticket 1005, 14 Nov 2026).
        let model = Model::new();
        let asked = std::sync::atomic::AtomicU64::new(0);
        let started = std::sync::Barrier::new(2);
        let release = std::sync::Barrier::new(2);
        let via = |_op: KernelOp| -> Result<KernelOpOutcome, String> {
            let n = asked.fetch_add(1, std::sync::atomic::Ordering::SeqCst) + 1;
            if n == 2 {
                started.wait();
                release.wait();
            }
            Ok(KernelOpOutcome {
                receipts: Vec::new(),
                read_scopes: None,
                result: crate::KernelOpResult::ModelCatalogueReading {
                    data: json!({"n": n}),
                },
            })
        };
        let (first, _) = model.subscribe(Slice::Models, &via, false);
        assert_eq!(first["value"], json!({"n": 1}));
        model.written(&[Slice::Models]);
        std::thread::scope(|scope| {
            let again = scope.spawn(|| model.read_again(Slice::Models, &via));
            started.wait();
            let asker = scope.spawn(|| model.subscribe(Slice::Models, &via, false));
            // Time enough for the subscriber to be answered, if it were answered from what is held.
            std::thread::sleep(Duration::from_millis(200));
            release.wait();
            let (answer, _) = asker.join().expect("the subscriber is answered");
            assert_eq!(again.join().expect("the read again ends"), Some(2));
            assert_eq!(
                answer["value"],
                json!({"n": 2}),
                "answered from the read the write started, not from before the write"
            );
        });
        assert_eq!(
            asked.load(std::sync::atomic::Ordering::SeqCst),
            2,
            "the subscriber took that read and asked the owner nothing itself"
        );
        // A write that lands while a read is under way leaves the slice due: that read may have been answered before it.
        model.written(&[Slice::Models]);
        let during = std::sync::atomic::AtomicBool::new(false);
        let via_during = |op: KernelOp| -> Result<KernelOpOutcome, String> {
            if !during.swap(true, std::sync::atomic::Ordering::SeqCst) {
                model.written(&[Slice::Models]);
            }
            via(op)
        };
        assert_eq!(model.read_again(Slice::Models, &via_during), Some(3));
        let (after, moved) = model.subscribe(Slice::Models, &via, false);
        assert_eq!(
            after["value"],
            json!({"n": 4}),
            "read again: a write came during the last read"
        );
        assert_eq!(moved, Some(4));
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
