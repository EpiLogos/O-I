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
    let result = run(&mut seat, op);
    (result, seat.timing)
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
            receipts: Vec::new(),
            result: KernelOpResult::SharedFieldReading {
                data: crate::shared_field::reading(&request)?,
            },
        }),
        // An A2A exchange waits on the other agent's reply through Node's
        // owner floor; it reads and records nothing of the kernel's.
        KernelOp::A2aExchange { request } => Ok(KernelOpOutcome {
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
            seat.hold(|kernel| kernel.finish_m3_reception(done))?
        }
        Prepared::Current(p) => {
            let done = seat.owner(|| p.execute())?;
            seat.hold(|kernel| kernel.finish_nara_current(done))?
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
        assert!(matches!(
            outcome.unwrap().result,
            KernelOpResult::WorldRead { .. }
        ));
        assert_eq!(timing.form, "navigation");
        assert!(timing.lock_held < timing.owner);
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
