//! The one op dispatch both hosts call — the native `kernel_op` command
//! (src-tauri main.rs) and the dev walk-bridge. The kernel holds one lock;
//! no owner process runs while it is held for an op that has a prepared
//! form. Each op is prepared under the lock (what it needs from kernel state
//! is captured), its owner work executes without the lock, and its answer is
//! finished under the lock again (what the ordered arm recorded is recorded,
//! or a reply whose basis moved is retired). Ops without a prepared form are
//! applied in order under the lock. One table of prepared forms replaces the
//! dozen lock-and-prepare steps each host repeated; the forms themselves are
//! the modules' own (`prepare_*`/`finish_*`).
//!
//! `dispatch` also reports where an op's time went — waiting for the lock,
//! holding it, and in owner work outside it — so a host's trace separates
//! queueing from kernel time from owner time.
use crate::{
    agent_prepared, decision, dictation, ground, knowledge_prepared, m3_reception, nara_current,
    nara_dialogue, nara_epii, nara_expressive_act, nara_identity, nara_presence, nara_voice,
    native_expression, owner_read, owner_write, working_surface, world_prepared, Kernel, KernelOp,
    KernelOpOutcome, KernelOpResult,
};
use std::sync::Mutex;
use std::time::{Duration, Instant};

/// Where one op's time went.
#[derive(Clone, Copy, Debug, Default)]
pub struct Timing {
    /// Waiting to take the kernel lock, summed over every take.
    pub lock_wait: Duration,
    /// Holding the kernel lock, summed over every take.
    pub lock_held: Duration,
    /// Executing prepared owner work, without the lock.
    pub owner: Duration,
    /// Which form served the op: `free` (no kernel state), a prepared
    /// form's name, or `ordered` (applied under the lock).
    pub form: &'static str,
}

/// An op's wire name — `KernelOp`'s serde tag (`rename_all = "snake_case"`)
/// — read from its Debug form's leading identifier. Formatting stops at the
/// identifier, so a large payload (a capture, a document) is never written.
pub fn op_name(op: &KernelOp) -> String {
    struct Leading(String);
    impl std::fmt::Write for Leading {
        fn write_str(&mut self, part: &str) -> std::fmt::Result {
            for c in part.chars() {
                if !c.is_alphanumeric() {
                    return Err(std::fmt::Error);
                }
                self.0.push(c);
            }
            Ok(())
        }
    }
    let mut leading = Leading(String::new());
    let _ = std::fmt::write(&mut leading, format_args!("{op:?}"));
    let mut name = String::with_capacity(leading.0.len() + 4);
    for (index, c) in leading.0.chars().enumerate() {
        if c.is_uppercase() {
            if index > 0 {
                name.push('_');
            }
            name.extend(c.to_lowercase());
        } else {
            name.push(c);
        }
    }
    name
}

/// The host's timing trace (lane W3): one line per op, in the dev bridge's
/// own format (walk-bridge.rs — when it was answered, how long it waited for
/// the kernel lock, held it, and spent in owner work outside it), appended to
/// the file `OI_KERNEL_TRACE_FILE` names. A Finder or Dock launch has no
/// stderr; a file the environment names survives it. Without the variable
/// nothing is written. `host` names the writer (`native`).
///
/// Every op traced here is also offered to the always-on slow-op record
/// (slow_ops.rs, lane K1), with or without the variable: one of 250 ms or
/// more appends its line to the kernel's own `slow-ops.jsonl`.
pub fn trace_op(host: &str, name: &str, ok: bool, total: Duration, timing: &Timing) {
    crate::slow_ops::record(host, name, ok, total, timing);
    trace_line(|| {
        format!(
            "[{host}] {} op {name} {} total_ms={:.1} lock_wait_ms={:.1} lock_held_ms={:.1} owner_ms={:.1} form={}\n",
            unix_ms(),
            if ok { "ok" } else { "err" },
            millis(total),
            millis(timing.lock_wait),
            millis(timing.lock_held),
            millis(timing.owner),
            timing.form,
        )
    });
}

/// The event replay's lock wait, as the dev bridge logs it.
pub fn trace_replay(host: &str, lock_wait: Duration) {
    trace_line(|| {
        format!(
            "[{host}] {} event-replay lock_wait_ms={:.1}\n",
            unix_ms(),
            millis(lock_wait)
        )
    });
}

/// One owner reading's fate in the read model: `hit` (served from what was
/// retained), `miss` (the owner was asked) or `joined` (shared the read of
/// an identical ask in flight). The key is cut to its first 160 characters.
pub fn trace_read(key: &str, how: &str) {
    trace_line(|| {
        let mut shown: String = key.chars().take(160).collect();
        shown = shown.replace(char::is_whitespace, "_");
        format!("[read] {} {shown} {how}\n", unix_ms())
    });
}

/// A line about the change watch: its mode, the paths that moved a scope
/// (`<scope> <path>`, a few per announced batch), a notice held back.
pub fn trace_watch(what: &str) {
    trace_line(|| format!("[watch] {} {what}\n", unix_ms()));
}

/// Readings kept across a relaunch (`kept.rs`): taken back, written, refused.
pub fn trace_kept(what: &str) {
    trace_line(|| format!("[kept] {} {what}\n", unix_ms()));
}

/// Where one host's trace goes: the file `OI_KERNEL_TRACE_FILE` named when
/// the first line was written, opened once for appending.
fn trace_line(line: impl FnOnce() -> String) {
    use std::io::Write;
    static TRACE: std::sync::OnceLock<Option<Mutex<std::fs::File>>> = std::sync::OnceLock::new();
    let file = TRACE.get_or_init(|| {
        let path = std::env::var_os("OI_KERNEL_TRACE_FILE").filter(|path| !path.is_empty())?;
        std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(path)
            .ok()
            .map(Mutex::new)
    });
    if let Some(file) = file {
        if let Ok(mut file) = file.lock() {
            let _ = file.write_all(line().as_bytes());
        }
    }
}

fn unix_ms() -> u128 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|elapsed| elapsed.as_millis())
        .unwrap_or(0)
}

fn millis(duration: Duration) -> f64 {
    duration.as_secs_f64() * 1000.0
}

/// The kernel lock, taken and timed.
struct Seat<'a> {
    kernel: &'a Mutex<Kernel>,
    timing: Timing,
}

impl Seat<'_> {
    fn hold<T>(&mut self, act: impl FnOnce(&mut Kernel) -> T) -> Result<T, String> {
        let asked = Instant::now();
        let mut kernel = self
            .kernel
            .lock()
            .map_err(|_| "kernel lock unavailable".to_owned())?;
        let taken = Instant::now();
        self.timing.lock_wait += taken - asked;
        let value = act(&mut kernel);
        drop(kernel);
        self.timing.lock_held += taken.elapsed();
        Ok(value)
    }
    fn owner<T>(&mut self, work: impl FnOnce() -> T) -> T {
        let started = Instant::now();
        let value = work();
        self.timing.owner += started.elapsed();
        value
    }
}

/// One op prepared under the kernel lock, by the first form that claims it.
enum Prepared {
    Epii(nara_epii::Prepared),
    Act(nara_expressive_act::Prepared),
    Presence(nara_presence::Prepared),
    M3(m3_reception::Prepared),
    Current(nara_current::Prepared),
    Voice(nara_voice::Prepared),
    Dialogue(nara_dialogue::Prepared),
    Identity(nara_identity::Prepared),
    Compose(native_expression::PreparedCompose),
    Read(owner_read::PreparedRead),
    Files(owner_read::PreparedFiles),
    Agent(agent_prepared::PreparedAgent),
    Navigation(world_prepared::PreparedNavigation),
    Ground(ground::Prepared),
    Dictation(dictation::Prepared),
    Knowledge(knowledge_prepared::Prepared),
    Working(working_surface::PreparedRead),
    Decision(decision::PreparedDecision, bool),
    Write(owner_write::PreparedWrite),
    /// No prepared form: applied in order under the lock.
    Ordered,
}

impl Prepared {
    fn form(&self) -> &'static str {
        match self {
            Self::Epii(_) => "nara-epii",
            Self::Act(_) => "nara-expressive-act",
            Self::Presence(_) => "nara-presence",
            Self::M3(_) => "m3-reception",
            Self::Current(_) => "nara-current",
            Self::Voice(_) => "nara-voice",
            Self::Dialogue(_) => "nara-dialogue",
            Self::Identity(_) => "nara-identity",
            Self::Compose(_) => "native-compose",
            Self::Read(_) => "owner-read",
            Self::Files(_) => "files",
            Self::Agent(_) => "agent",
            Self::Navigation(_) => "navigation",
            Self::Ground(_) => "ground",
            Self::Dictation(_) => "dictation",
            Self::Knowledge(_) => "knowledge",
            Self::Working(_) => "working-surface",
            Self::Decision(..) => "decision",
            Self::Write(_) => "owner-write",
            Self::Ordered => "ordered",
        }
    }
}

impl Kernel {
    /// The prepared-op table: the first form that claims `op` prepares it,
    /// under the kernel lock. Each form claims only its own ops.
    fn prepare_op(&mut self, op: &KernelOp) -> Result<Prepared, String> {
        if let Some(p) = self.prepare_nara_epii(op)? {
            return Ok(Prepared::Epii(p));
        }
        if let Some(p) = self.prepare_nara_expressive_act(op)? {
            return Ok(Prepared::Act(p));
        }
        if let Some(p) = self.prepare_nara_presence(op)? {
            return Ok(Prepared::Presence(p));
        }
        if let Some(p) = self.prepare_m3_reception(op)? {
            return Ok(Prepared::M3(p));
        }
        if let Some(p) = self.prepare_nara_current(op)? {
            return Ok(Prepared::Current(p));
        }
        if let Some(p) = self.prepare_nara_voice(op)? {
            return Ok(Prepared::Voice(p));
        }
        if let Some(p) = self.prepare_nara_dialogue(op)? {
            return Ok(Prepared::Dialogue(p));
        }
        if let Some(p) = self.prepare_nara_identity(op) {
            return Ok(Prepared::Identity(p));
        }
        // Composing may provision QL's dated sky for tens of seconds: run it
        // outside the lock; only the single-owner open is serialised.
        if let Some(p) = self.prepare_native_compose(op)? {
            return Ok(Prepared::Compose(p));
        }
        if let Some(p) = self.prepare_owner_read(op) {
            return Ok(Prepared::Read(p));
        }
        // A file listing or reading runs its owner call outside the lock and
        // records its answer (the file's registration) under it.
        if let Some(p) = self.prepare_files_read(op) {
            return Ok(Prepared::Files(p));
        }
        if let Some(p) = self.prepare_agent_read(op)? {
            return Ok(Prepared::Agent(p));
        }
        if let Some(p) = self.prepare_navigation(op)? {
            return Ok(Prepared::Navigation(p));
        }
        if let Some(p) = self.prepare_ground(op) {
            return Ok(Prepared::Ground(p));
        }
        if let Some(p) = self.prepare_dictation(op)? {
            return Ok(Prepared::Dictation(p));
        }
        if let Some(p) = self.prepare_knowledge(op)? {
            return Ok(Prepared::Knowledge(p));
        }
        // An owner write runs outside the lock; what it recorded — its
        // receipt, its invalidations — is recorded under it (lane W3).
        if let Some(p) = self.prepare_owner_write(op) {
            return Ok(Prepared::Write(p));
        }
        match op {
            KernelOp::WorkingSurfaceRead {
                project,
                agent_session,
                binding,
            } => {
                return self
                    .prepare_working_surface_read(
                        project,
                        agent_session.clone(),
                        binding.clone(),
                        false,
                    )
                    .map(Prepared::Working)
            }
            KernelOp::WorkingSurfaceAttachment {
                project,
                agent_session,
                binding,
            } => {
                return self
                    .prepare_working_surface_read(
                        project,
                        agent_session.clone(),
                        Some(binding.clone()),
                        true,
                    )
                    .map(Prepared::Working)
            }
            _ => {}
        }
        if let Some(p) = self.prepare_decision(op)? {
            return Ok(Prepared::Decision(
                p,
                matches!(op, KernelOp::InvokeAction { .. }),
            ));
        }
        Ok(Prepared::Ordered)
    }
}

/// Dispatch one op against the host's kernel: free ops run without the lock,
/// prepared ops run their owner work outside it, every other op is applied in
/// order under it. Returns the outcome and where its time went; the host
/// forwards the outcome's receipts.
pub fn dispatch(kernel: &Mutex<Kernel>, op: KernelOp) -> (Result<KernelOpOutcome, String>, Timing) {
    let mut seat = Seat {
        kernel,
        timing: Timing::default(),
    };
    let memory_only = reads_kernel_memory_only(&op);
    let (result, scopes) = crate::read_cache::attributed(|| run(&mut seat, op));
    let result = result.map(|mut outcome| {
        // An op that read nothing through the model is attributed only when
        // it is known to read the kernel's own memory; any other stays
        // unscoped.
        if outcome.read_scopes.is_none() {
            outcome.read_scopes = scopes.or(memory_only.then(Vec::new));
        }
        outcome
    });
    (result, seat.timing)
}

/// Ops that answer from the kernel's own memory and ask no owner. (The
/// kernel's state snapshot is not one: it carries the retained World, and
/// stays unscoped.)
fn reads_kernel_memory_only(op: &KernelOp) -> bool {
    matches!(
        op,
        KernelOp::ProtocolRead | KernelOp::RecordingCapabilityRead
    )
}

/// Whether an op touches no kernel state at all: it runs entirely outside
/// the lock (`run`'s free arms).
pub(crate) fn is_free(op: &KernelOp) -> bool {
    match op {
        KernelOp::ExpressionRecovery { .. }
        | KernelOp::NaraCoordinate { .. }
        | KernelOp::WorldResolve { .. }
        | KernelOp::A2aExchange { .. }
        | KernelOp::Setup { .. } => true,
        KernelOp::SharedField { request } => !crate::shared_field::is_read(request),
        // A presence's listing and withdrawal: SharedField's own transport,
        // nothing of the kernel's Expression or identity.
        KernelOp::NaraPresence { request, .. } => request.admission().is_none(),
        _ => false,
    }
}

fn run(seat: &mut Seat<'_>, op: KernelOp) -> Result<KernelOpOutcome, String> {
    if !is_free(&op) {
        return run_prepared(seat, op);
    }
    seat.timing.form = "free";
    seat.owner(|| free(op))
}

/// The owners with no kernel state at all (`is_free`), run without the lock.
fn free(op: KernelOp) -> Result<KernelOpOutcome, String> {
    match op {
        KernelOp::ExpressionRecovery { request } => crate::expression_recovery::execute(request),
        KernelOp::NaraCoordinate { request } => crate::nara_coordinate::execute(request),
        KernelOp::WorldResolve { world_id, verify } => {
            crate::world_resolve::execute(crate::world_resolve::Request { world_id, verify })
        }
        // A SharedField write (a publish, a contribution, presence, a lease
        // release, an observation's stop): the client's own registry and
        // credential, never kernel state, and nothing recorded (lane W3).
        KernelOp::SharedField { request } => Ok(KernelOpOutcome {
            read_scopes: None,
            receipts: Vec::new(),
            result: KernelOpResult::SharedFieldReading {
                data: crate::shared_field::reading(&request)?,
            },
        }),
        KernelOp::NaraPresence { request, .. } => Ok(KernelOpOutcome {
            read_scopes: None,
            receipts: Vec::new(),
            result: KernelOpResult::NaraPresenceConsent {
                data: crate::nara_presence::consent(&request)?,
            },
        }),
        // An A2A exchange waits on the other agent's reply through Node's
        // owner floor; it reads and records nothing of the kernel's.
        KernelOp::A2aExchange { request } => Ok(KernelOpOutcome {
            read_scopes: None,
            receipts: Vec::new(),
            result: KernelOpResult::A2aExchangeDifference {
                data: crate::shared_field::a2a_exchange(&request)?,
            },
        }),
        // First installation runs before Central's root is known: its
        // directory is this process's own, never the World's.
        KernelOp::Setup { request } => {
            let cwd = std::env::current_dir().map_err(|e| e.to_string())?;
            Ok(KernelOpOutcome {
                read_scopes: None,
                receipts: Vec::new(),
                result: KernelOpResult::SetupReading {
                    data: crate::setup::Client::discover().request(&cwd, &request)?,
                },
            })
        }
        _ => Err("This operation reads or records kernel state".into()),
    }
}

fn run_prepared(seat: &mut Seat<'_>, op: KernelOp) -> Result<KernelOpOutcome, String> {
    let prepared = seat.hold(|kernel| kernel.prepare_op(&op))??;
    seat.timing.form = prepared.form();
    match prepared {
        Prepared::Epii(p) => {
            let done = seat.owner(|| p.execute())?;
            seat.hold(|kernel| kernel.finish_nara_epii(done))?
        }
        Prepared::Act(p) => {
            let done = seat.owner(|| p.execute())?;
            seat.hold(|kernel| kernel.finish_nara_expressive_act(done))?
        }
        Prepared::Presence(p) => {
            let done = seat.owner(|| p.execute())?;
            seat.hold(|kernel| kernel.finish_nara_presence(done))?
        }
        Prepared::M3(p) => {
            let done = seat.owner(|| p.execute())?;
            commit_m3_reception(seat, done)
        }
        Prepared::Current(p) => {
            let done = seat.owner(|| p.execute())?;
            commit_nara_current(seat, done)
        }
        Prepared::Voice(p) => seat.owner(|| p.execute()),
        Prepared::Dialogue(p) => seat.owner(|| p.execute()),
        Prepared::Identity(p) => seat.owner(|| p.execute()),
        Prepared::Compose(p) => {
            let done = seat.owner(|| p.execute())?;
            seat.hold(|kernel| kernel.finish_native_compose(done))?
        }
        Prepared::Read(p) => seat.owner(|| p.execute()),
        Prepared::Files(p) => {
            let done = seat.owner(|| p.execute());
            seat.hold(|kernel| kernel.finish_files_read(done))?
        }
        Prepared::Agent(p) => {
            let done = seat.owner(|| p.execute());
            seat.hold(|kernel| kernel.finish_agent_read(done))?
        }
        Prepared::Navigation(p) => {
            let done = seat.owner(|| p.execute());
            seat.hold(|kernel| kernel.finish_navigation(done))?
        }
        Prepared::Ground(p) => {
            let done = seat.owner(|| p.execute());
            seat.hold(|kernel| kernel.finish_ground(done))?
        }
        Prepared::Dictation(p) => seat.owner(|| p.execute()),
        Prepared::Knowledge(p) => {
            let done = seat.owner(|| p.execute())?;
            seat.hold(|kernel| kernel.finish_knowledge(done))?
        }
        Prepared::Working(p) => Ok(KernelOpOutcome {
            read_scopes: None,
            receipts: vec![],
            result: KernelOpResult::WorkingSurfaceReading {
                document: seat.owner(|| p.execute())?,
            },
        }),
        Prepared::Decision(p, as_action) => {
            let receipt = seat.owner(|| p.execute())?;
            seat.hold(|kernel| kernel.finish_decision(receipt, as_action))?
        }
        Prepared::Write(p) => {
            let done = seat.owner(|| p.execute());
            seat.hold(|kernel| kernel.finish_owner_write(done))?
        }
        Prepared::Ordered => seat.hold(|kernel| kernel.apply(op))?,
    }
}

/// A personal current's commit. Its owner half — the saved identity's
/// re-read and a new pin's custody (which re-qualifies the QL owner through
/// `oi where` and the image's digest, then writes and syncs the checkpoint)
/// — runs without the lock; only the in-memory basis check and the
/// admission hold it. Held across both, the lock kept the live field's
/// exchange waiting past its acknowledgement ceiling (lane V).
fn commit_nara_current(
    seat: &mut Seat<'_>,
    done: nara_current::Completed,
) -> Result<KernelOpOutcome, String> {
    let done = seat.owner(|| done.confirmed())?;
    seat.hold(|kernel| kernel.finish_nara_current(done))?
}

/// An M3 reception's commit, split the same way.
fn commit_m3_reception(
    seat: &mut Seat<'_>,
    done: m3_reception::Completed,
) -> Result<KernelOpOutcome, String> {
    let done = seat.owner(|| done.confirmed())?;
    seat.hold(|kernel| kernel.finish_m3_reception(done))?
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;

    /// Each named owner read is claimed by its prepared form (prepared only:
    /// no owner is asked here); an op with none is applied in order.
    #[test]
    fn the_named_owner_reads_are_prepared_and_the_rest_are_ordered() {
        let owner = crate::tests::FakeOwner::spawn_counter("dispatch-forms");
        let mut kernel = owner.kernel();
        let mut form = |op: KernelOp| kernel.prepare_op(&op).unwrap().form();
        assert_eq!(
            form(KernelOp::Central {
                project: None,
                request: crate::central::Request::Inspect,
            }),
            "owner-read"
        );
        assert_eq!(form(KernelOp::WorkcellStatusRead), "owner-read");
        assert_eq!(form(KernelOp::DayRead { day_ref: None }), "owner-read");
        assert_eq!(
            form(KernelOp::Now {
                project: None,
                request: crate::flow::NowRequest::List {
                    participant_refs: None
                },
            }),
            "owner-read"
        );
        assert_eq!(form(KernelOp::ModelRoster { project: None }), "agent");
        assert_eq!(
            form(KernelOp::HarnessAgentRead {
                binding: "binding:x".into()
            }),
            "agent"
        );
        assert_eq!(form(KernelOp::WorldRead), "navigation");
        assert_eq!(
            form(KernelOp::AgencyRead {
                project: String::new()
            }),
            "agent"
        );
        assert_eq!(
            form(KernelOp::EncounterTaskRead {
                project: String::new(),
                agent_session: "agent-session/x".into(),
            }),
            "agent"
        );
        assert_eq!(
            form(KernelOp::Ground {
                request: crate::ground::Request::Status
            }),
            "ground"
        );
        // Lane K2: the owner reads lane K left under the lock.
        assert_eq!(form(KernelOp::HarnessStatus), "agent");
        assert_eq!(form(KernelOp::ModelCatalogue), "agent");
        assert_eq!(form(KernelOp::ConfigReceipts), "owner-read");
        assert_eq!(form(KernelOp::ChatDefaultRead), "owner-read");
        // Lane K1: the seat instrument, Central's source returns and AIKit's
        // declared remotes.
        assert_eq!(form(KernelOp::SeatStatusRead), "owner-read");
        assert_eq!(
            form(KernelOp::SourceReturnsRead {
                project: None,
                limit: None,
                before: None,
            }),
            "owner-read"
        );
        assert_eq!(form(KernelOp::GatewayRemotesRead), "owner-read");
        assert_eq!(
            form(KernelOp::FileBytes {
                location: crate::files::Location {
                    schema: "central.path-ref/v1".into(),
                    ref_id: "ref:a".into(),
                    root: "R".into(),
                    path: "a".into(),
                }
            }),
            "files"
        );
        assert_eq!(form(KernelOp::SourcesList { project: None }), "files");
        // A source not open keeps the ordered arm's refusal.
        assert_eq!(
            form(KernelOp::SourceHistory {
                source_ref: "source:unopened".into()
            }),
            "ordered"
        );
        assert_eq!(form(KernelOp::State), "ordered");
        // The dispatch itself: a navigation served by its owner outside the
        // lock, holding it only to prepare and finish.
        let kernel = Mutex::new(owner.kernel());
        let (outcome, timing) = dispatch(&kernel, KernelOp::WorldRead);
        let outcome = outcome.unwrap();
        assert!(matches!(outcome.result, KernelOpResult::WorldRead { .. }));
        // The World counts Control and every project (no seat, nothing of
        // AIKit's), and the outcome says so.
        assert_eq!(
            outcome.read_scopes,
            Some(vec!["root".to_owned(), "work".to_owned()])
        );
        // A register reading depends on the root; a repeat answered from the
        // model says the same.
        let now = || {
            dispatch(
                &kernel,
                KernelOp::Now {
                    project: None,
                    request: crate::flow::NowRequest::List {
                        participant_refs: None,
                    },
                },
            )
            .0
            .unwrap()
            .read_scopes
        };
        assert_eq!(now(), Some(vec!["root".to_owned()]));
        assert_eq!(now(), Some(vec!["root".to_owned()]));
        // An op that reads only the kernel's own memory reads no scope.
        let (protocol, _) = dispatch(&kernel, KernelOp::ProtocolRead);
        assert_eq!(protocol.unwrap().read_scopes, Some(Vec::new()));
        // The state snapshot carries the retained World: not attributable.
        let (state, _) = dispatch(&kernel, KernelOp::State);
        assert_eq!(state.unwrap().read_scopes, None);
        assert_eq!(timing.form, "navigation");
        assert!(timing.lock_held < timing.owner);
    }

    /// A Central stand-in whose saved-identity read is held while the gate
    /// file stands: a slow owner read, by a real child process.
    const HELD_IDENTITY_OWNER: &str = r#"#!/usr/bin/env python3
import hashlib, json, os, sys, time
log, gate = sys.argv[1], sys.argv[2]
args = sys.argv[3:]
i = args.index("action")
action = args[i + 2]
with open(log, "a") as handle:
    handle.write(action + "\n")
def ok(data):
    print(json.dumps({"ok": True, "action": action, "data": data}))
if action == "projectcentral.source.read":
    while os.path.exists(gate):
        time.sleep(0.02)
    request = json.loads(args[i + 3])
    person = "person:lane-v"
    profile = json.dumps({"schema": "ql.nara-identity-profile/v1", "person_ref": person, "nara_ref": "nara:lane-v"})
    path = "Control/self/nara/identities/" + hashlib.sha256(person.encode()).hexdigest() + ".json"
    ok({"schema": "central.project-world-source-reading/v1", "world_ref": "control:root",
        "source": {"ref": request["source_ref"], "path": path, "exists": True},
        "revision": {"revision": "rev-identity-1", "byte_len": len(profile)},
        "content": profile, "content_encoding": "utf-8",
        "automatic_agent_or_model_invocation": False})
elif action == "central.world":
    ok({"schema": "central.world-map/v1", "root": "/tmp", "work": {"projects": []}})
else:
    ok({})
"#;

    /// One kernel over the held-identity owner, holding an Expression with
    /// one adopted coordinate profile (all in the kernel's own memory).
    struct HeldIdentity {
        directory: std::path::PathBuf,
        log: std::path::PathBuf,
        gate: std::path::PathBuf,
        kernel: Mutex<Kernel>,
    }

    impl HeldIdentity {
        const EXPRESSION: &'static str = "expression:lane-v";

        fn new(test: &str) -> Self {
            use std::os::unix::fs::PermissionsExt;
            let directory = std::env::temp_dir().join(format!(
                "oi-cradle-{}-held-identity-{test}",
                std::process::id()
            ));
            std::fs::create_dir_all(&directory).unwrap();
            let script = directory.join("central.py");
            let executable = directory.join("central.sh");
            let log = directory.join("calls.log");
            let gate = directory.join("gate");
            std::fs::write(&script, HELD_IDENTITY_OWNER).unwrap();
            std::fs::write(
                &executable,
                format!(
                    "#!/bin/sh\nexec python3 {} {} {} \"$@\"\n",
                    script.display(),
                    log.display(),
                    gate.display()
                ),
            )
            .unwrap();
            std::fs::set_permissions(&executable, std::fs::Permissions::from_mode(0o755)).unwrap();
            crate::test_stub::settle_stub(&executable);
            let mut kernel = Kernel::new(crate::flow::CentralClient::with(
                executable,
                None,
                "test".into(),
            ));
            let mut expression = |request: serde_json::Value| {
                kernel
                    .apply(KernelOp::Expression {
                        request: serde_json::from_value(request).unwrap(),
                    })
                    .unwrap();
            };
            expression(
                serde_json::json!({"operation": "profile_define", "actor": "agent:lane-v", "profile": {
                "profile_ref": "profile:epi-coordinate-lane-v", "revision": 1, "title": "Lane V coordinate",
                "parent_profile_refs": [], "accepted_binding_kinds": ["engine_composition"],
                "accepted_native_owners": ["ql"], "material_defaults": {}, "formation_vocabulary": [],
                "target_rules": {}, "provenance": [{"ref": "material:lane-v", "revision": "v1", "availability": "available"}]}}),
            );
            expression(
                serde_json::json!({"operation": "create", "expression_ref": Self::EXPRESSION,
                "title": "Lane V", "actor": "agent:lane-v"}),
            );
            expression(
                serde_json::json!({"operation": "edit", "expression_ref": Self::EXPRESSION,
                "expected_revision": 1, "actor": "agent:lane-v", "changes": [{"change": "profile_adopt",
                "adoption": {"profile_ref": "profile:epi-coordinate-lane-v", "revision": 1, "overridden_parameters": {}}}]}),
            );
            Self {
                directory,
                log,
                gate,
                kernel: Mutex::new(kernel),
            }
        }

        fn binding() -> crate::nara_dialogue::Request {
            serde_json::from_value(serde_json::json!({"operation": "context", "role": "nara",
                "source_ref": "central:source:lane-v", "expected_revision": "rev-identity-1",
                "person_ref": "person:lane-v", "nara_ref": "nara:lane-v", "expression_ref": Self::EXPRESSION}))
            .unwrap()
        }

        /// The document and adopted profile the reading was prepared on.
        fn basis(&self) -> (serde_json::Value, crate::nara_dialogue::ProfileBasis) {
            let mut kernel = self.kernel.lock().unwrap();
            let document = kernel.nara_current_document(Self::EXPRESSION).unwrap();
            let profile = kernel.nara_expression_profile(&document).unwrap();
            (document, profile)
        }

        fn client(&self) -> crate::flow::CentralClient {
            self.kernel.lock().unwrap().client.clone()
        }

        fn identity_reads(&self) -> usize {
            std::fs::read_to_string(&self.log)
                .map(|text| {
                    text.lines()
                        .filter(|line| *line == "projectcentral.source.read")
                        .count()
                })
                .unwrap_or(0)
        }

        /// Runs `commit` while the saved identity's read is held, and asks the
        /// live field's ordered exchange and the state snapshot meanwhile. Both
        /// must be answered before the held read is released: their answers
        /// arrive while the owner process still sleeps, whatever the machine's
        /// speed. The bound only stops a failing run from waiting forever.
        fn answered_while_held<T: Send>(
            &self,
            commit: impl FnOnce(&Mutex<Kernel>) -> T + Send,
        ) -> T {
            std::fs::write(&self.gate, "").unwrap();
            std::thread::scope(|scope| {
                let committing = scope.spawn(|| commit(&self.kernel));
                let deadline = Instant::now() + Duration::from_secs(60);
                while self.identity_reads() == 0 {
                    assert!(
                        Instant::now() < deadline,
                        "the commit never asked for the saved identity"
                    );
                    std::thread::sleep(Duration::from_millis(10));
                }
                let (answered, received) = std::sync::mpsc::channel();
                scope.spawn(move || {
                    let field = dispatch(
                        &self.kernel,
                        KernelOp::NativeExpression {
                            request: crate::native_expression::Request::Exchange {
                                lease: "lease:lane-v".into(),
                                request: serde_json::json!({}),
                            },
                        },
                    )
                    .0;
                    let state = dispatch(&self.kernel, KernelOp::State).0;
                    let _ = answered.send((field, state));
                });
                let probe = received.recv_timeout(Duration::from_secs(30));
                let still_held = self.gate.exists() && !committing.is_finished();
                std::fs::remove_file(&self.gate).unwrap();
                let (field, state) = probe.unwrap_or_else(|_| {
                    panic!("the field's exchange and the state snapshot waited behind the held identity read")
                });
                assert!(
                    still_held,
                    "the probes were answered only after the held read ended"
                );
                // No field is open: the exchange is answered with its refusal.
                assert!(field.unwrap_err().contains("no active owner"));
                assert!(state.is_ok());
                committing.join().unwrap()
            })
        }
    }

    impl Drop for HeldIdentity {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.directory);
        }
    }

    /// Lane V (DLW, O-I #706): lane T measured `nara_current` holding the
    /// kernel lock 3.6–8.0 s while committing a pinned reading — past the live
    /// field's 5 s acknowledgement ceiling, so the field stopped answering.
    /// The commit's owner half (the saved identity, a pin's custody) now runs
    /// outside the lock; only the in-memory basis check and the admission
    /// hold it.
    #[test]
    fn a_personal_current_commit_answers_the_field_while_its_owner_is_held() {
        let held = HeldIdentity::new("current");
        let (document, profile) = held.basis();
        let completed = nara_current::Completed {
            client: held.client(),
            project: "project:lane-v".into(),
            binding: HeldIdentity::binding(),
            document,
            profile,
            agent_session_ref: "agent-session:lane-v".into(),
            candidate: None,
            expected_current: None,
            data: serde_json::json!({"schema": "oi.nara-personal-current-context/v1", "status": "absent"}),
        };
        let (outcome, timing) = held.answered_while_held(|kernel| {
            let mut seat = Seat {
                kernel,
                timing: Timing::default(),
            };
            (commit_nara_current(&mut seat, completed), seat.timing)
        });
        let outcome = outcome.unwrap();
        assert!(matches!(
            outcome.result,
            KernelOpResult::NaraCurrent { ref data } if data["status"] == "absent"
        ));
        assert_eq!(held.identity_reads(), 1);
        assert!(timing.lock_held < timing.owner);
    }

    /// The same commit seam for an M3 reception (it confirms the same saved
    /// identity and writes the recomposed current's custody).
    #[test]
    fn an_m3_reception_commit_answers_the_field_while_its_owner_is_held() {
        let held = HeldIdentity::new("m3");
        let (document, profile) = held.basis();
        let completed = m3_reception::Completed {
            client: held.client(),
            project: "project:lane-v".into(),
            binding: HeldIdentity::binding(),
            document,
            profile,
            current_context: serde_json::Value::Null,
            expected_revision: None,
            candidate: None,
            current_candidate: None,
            agent_session_ref: "agent-session:lane-v".into(),
            data: serde_json::json!({"schema": "oi.m3-reception-context/v1", "status": "absent"}),
        };
        let (outcome, timing) = held.answered_while_held(|kernel| {
            let mut seat = Seat {
                kernel,
                timing: Timing::default(),
            };
            (commit_m3_reception(&mut seat, completed), seat.timing)
        });
        let outcome = outcome.unwrap();
        assert!(matches!(
            outcome.result,
            KernelOpResult::M3Reception { ref data } if data["status"] == "absent"
        ));
        assert_eq!(held.identity_reads(), 1);
        assert!(timing.lock_held < timing.owner);
    }

    /// The scopes ride the wire beside the result when the kernel could
    /// attribute the op, and are absent when it could not.
    #[test]
    fn an_outcomes_read_scopes_are_on_the_wire_only_when_attributed() {
        let outcome = |read_scopes: Option<Vec<String>>| KernelOpOutcome {
            read_scopes,
            receipts: Vec::new(),
            result: KernelOpResult::SetupReading {
                data: serde_json::json!({}),
            },
        };
        let scoped =
            serde_json::to_value(outcome(Some(vec!["root".into(), "project:O-I".into()]))).unwrap();
        assert_eq!(
            scoped["read_scopes"],
            serde_json::json!(["root", "project:O-I"])
        );
        assert_eq!(scoped["result"], "setup_reading");
        let empty = serde_json::to_value(outcome(Some(Vec::new()))).unwrap();
        assert_eq!(empty["read_scopes"], serde_json::json!([]));
        let unscoped = serde_json::to_value(outcome(None)).unwrap();
        assert!(unscoped.get("read_scopes").is_none());
        let back: KernelOpOutcome = serde_json::from_value(scoped).unwrap();
        assert_eq!(back.read_scopes.unwrap().len(), 2);
    }

    /// The trace names an op by its wire tag, exactly as serde spells it.
    #[test]
    fn an_op_is_named_by_its_wire_tag() {
        for op in [
            serde_json::json!({"op": "a2a_exchange", "request": {}}),
            serde_json::json!({"op": "state"}),
            serde_json::json!({"op": "temporal_events_read", "query": {"window": {"window": "all"}}}),
            serde_json::json!({"op": "invoke_action", "invocation": {"action": "a", "target_ref": "t"}}),
        ] {
            let parsed: KernelOp = serde_json::from_value(op.clone()).unwrap();
            assert_eq!(op_name(&parsed), op["op"].as_str().unwrap());
        }
    }

    /// Lane W3: every owner write the B0 investigator found applied under
    /// the lock is free (it touches no kernel state) or prepared (its owner
    /// runs outside the lock; its finish records what the owner did). None is
    /// ordered. Preparing asks no owner.
    #[test]
    fn no_owner_write_is_applied_under_the_lock() {
        use serde_json::json;
        let owner = crate::tests::FakeOwner::spawn_counter("dispatch-writes");
        let mut kernel = owner.kernel();
        let mut form = |op: serde_json::Value| -> (String, &'static str) {
            let name = op["op"].as_str().unwrap().to_owned();
            let op: KernelOp = serde_json::from_value(op).unwrap();
            let form = if is_free(&op) {
                "free"
            } else {
                kernel.prepare_op(&op).unwrap().form()
            };
            (name, form)
        };
        let scope = json!({"scope_kind": "machine"});
        let request = json!({"setting_ref": "oi:setting", "scope": scope});
        let location =
            json!({"schema": "central.path-ref/v1", "ref": "ref:a", "root": "R", "path": "a.md"});
        let table = [
            // Receiving acts (lib.rs Receiving → flow.rs receiving).
            json!({"op": "receiving", "project": null, "request": {"Submit": {"producer_key": "p", "occurred_at_unix_seconds": 1}}}),
            json!({"op": "receiving", "project": null, "request": {"Review": {"return_ref": "r", "expected_return_revision": "v", "disposition": "accepted"}}}),
            json!({"op": "receiving", "project": null, "request": {"Include": {"return_ref": "r", "expected_return_revision": "v"}}}),
            json!({"op": "receiving", "project": null, "request": {"Recover": {"return_ref": "r", "expected_return_revision": "v"}}}),
            json!({"op": "receiving", "project": null, "request": {"MutateField": {"source_ref": "s", "document_id": "d", "expected_revision": "v", "request_id": "q", "field_id": "f", "value": 1}}}),
            // SharedField writes, an observation's stop, an A2A exchange.
            json!({"op": "shared_field", "request": {"kind": "publish"}}),
            json!({"op": "shared_field", "request": {"kind": "observe-stop", "observer_ref": "o"}}),
            json!({"op": "a2a_exchange", "request": {}}),
            // Factory acts.
            json!({"op": "factory_owner", "request": {"kind": "action-invoke", "state_path": "/s.json", "project_ref": "p", "run_ref": "run:1", "request": {}}}),
            json!({"op": "factory_owner", "request": {"kind": "recognise", "state_path": "/s.json", "journey_ref": "j", "subject_ref": "s"}}),
            json!({"op": "factory_owner", "request": {"kind": "development-commission", "state_path": "/s.json", "request": {}}}),
            json!({"op": "factory_owner", "request": {"kind": "run-close", "state_path": "/s.json", "run_ref": "run:1", "recognition_ref": "r"}}),
            // Credentials and a client install.
            json!({"op": "credential_setup", "credential": "c"}),
            json!({"op": "credential_rotate", "credential": "c"}),
            json!({"op": "credential_verify", "credential": "c"}),
            json!({"op": "credential_revoke", "credential": "c"}),
            json!({"op": "client_install", "client": "c"}),
            // A product action, first installation.
            json!({"op": "product_action_run", "product_id": "p", "action_ref": "a"}),
            json!({"op": "setup", "request": {}}),
            // The configuration plane's writes.
            json!({"op": "config_desired_hold", "request": request}),
            json!({"op": "config_desired_discard", "setting_ref": "oi:setting", "scope": scope}),
            json!({"op": "config_plan", "requests": [request]}),
            json!({"op": "config_plan_reviewed", "requests": [request]}),
            json!({"op": "config_reset", "setting_ref": "oi:setting", "scope": scope}),
            json!({"op": "config_apply_reviewed", "changeset": {}, "plans": []}),
            json!({"op": "config_apply", "requests": [request]}),
            json!({"op": "profile_use_plan", "profile_ref": "p"}),
            json!({"op": "profile_use_apply", "profile_ref": "p"}),
            json!({"op": "profile_create", "profile_ref": "p"}),
            json!({"op": "profile_edit", "profile_ref": "p", "operations": []}),
            // An owner Action (a NOW return), a commission, provisioning, a
            // harness control.
            json!({"op": "invoke_action", "invocation": {"action": "projectcentral.now.return", "target_ref": "t"}}),
            json!({"op": "instance_commission", "location": location, "expected_revision": "v", "content": "c"}),
            json!({"op": "encounter_provision", "project": "p"}),
            json!({"op": "flow_participant_provision", "project": "p", "agent_ref": "a", "flow_ref": "f", "sender": "s"}),
            json!({"op": "harness_agent_control", "binding": "b", "control": "stop"}),
            // Beside the table (lane W3): a file write and a routine's act.
            json!({"op": "file_operation", "location": location, "request": {"action": "write", "expected_revision": "v", "content": "c"}}),
            json!({"op": "routine", "request": {"action": "run_now", "routine_ref": "routine:r"}}),
            // Central's Day writes.
            json!({"op": "central", "project": null, "request": {"kind": "ensure-day", "expected_time_policy_revision": "v"}}),
            json!({"op": "central", "project": null, "request": {"kind": "initialise-day", "day_ref": "d", "document_id": "x", "expected_revision": "v", "expected_policy_revision": "v", "form": location, "expected_form_revision": "v"}}),
            json!({"op": "central", "project": null, "request": {"kind": "close-day", "day_ref": "d", "expected_revision": "v", "expected_relations_revision": "v"}}),
        ];
        let ordered: Vec<String> = table
            .into_iter()
            .map(&mut form)
            .filter(|(_, form)| *form == "ordered")
            .map(|(name, _)| name)
            .collect();
        assert!(ordered.is_empty(), "applied under the lock: {ordered:?}");
        // The reads beside them keep their forms; a decision Action keeps the
        // decision form's ordered arm.
        assert_eq!(
            form(json!({"op": "receiving", "project": null, "request": {"List": {}}})).1,
            "owner-read"
        );
        assert_eq!(
            form(json!({"op": "central", "project": null, "request": {"kind": "inspect"}})).1,
            "owner-read"
        );
        assert_eq!(
            form(json!({"op": "shared_field", "request": {"kind": "snapshot"}})).1,
            "owner-read"
        );
        assert_eq!(
            form(json!({"op": "invoke_action", "invocation": {"action": "action:decision.preflight", "target_ref": "t"}})).1,
            "ordered"
        );
        assert_eq!(
            form(json!({"op": "invoke_action", "invocation": {"action": "projectcentral.now.return", "target_ref": "t"}})).1,
            "owner-write"
        );
        assert_eq!(owner.spawns("central.world"), 0, "preparing asked no owner");
    }
}
