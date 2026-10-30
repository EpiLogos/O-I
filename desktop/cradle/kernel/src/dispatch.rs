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
//!
//! The live field is not served under the kernel lock at all (lane Z): its
//! manager has a lock of its own (native_expression.rs `Field`), which a
//! host holds beside the kernel and passes to `dispatch_with`. A Nara op's
//! place — the directory its Project names and the ProjectRef bound there —
//! is resolved by its owners before the lock is taken to prepare it, and its
//! commit's owner half (the saved identity's re-read, a pin's custody, a
//! presence's publication) runs outside the lock too.
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
    /// Waiting to take the lock that serves the op, summed over every take:
    /// the kernel's, or for a `native-field` op the field's own.
    pub lock_wait: Duration,
    /// Holding that lock, summed over every take.
    pub lock_held: Duration,
    /// Executing prepared owner work, without the lock.
    pub owner: Duration,
    /// Which form served the op: `free` (no kernel state), a prepared
    /// form's name, `native-field` (on the field's own lock), or `ordered`
    /// (applied under the kernel lock).
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

/// An executable image's digest (native_expression.rs `Digests`): `hashed`
/// (read whole, how long it took) or `kept` (its standing had not moved).
pub fn trace_digest(path: &std::path::Path, how: &str, bytes: u64, took: Duration) {
    trace_line(|| {
        format!(
            "[digest] {} {how} bytes={bytes} ms={:.1} {}\n",
            unix_ms(),
            millis(took),
            path.display()
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

/// Take `lock`, run `act` under it, and add the wait and the hold to
/// `timing`.
pub(crate) fn timed<M, T>(
    timing: &mut Timing,
    lock: &Mutex<M>,
    unavailable: &str,
    act: impl FnOnce(&mut M) -> T,
) -> Result<T, String> {
    let asked = Instant::now();
    let mut guard = lock.lock().map_err(|_| unavailable.to_owned())?;
    let taken = Instant::now();
    timing.lock_wait += taken - asked;
    let value = act(&mut guard);
    drop(guard);
    timing.lock_held += taken.elapsed();
    Ok(value)
}

/// The kernel lock, taken and timed.
struct Seat<'a> {
    kernel: &'a Mutex<Kernel>,
    timing: Timing,
}

impl Seat<'_> {
    fn hold<T>(&mut self, act: impl FnOnce(&mut Kernel) -> T) -> Result<T, String> {
        timed(
            &mut self.timing,
            self.kernel,
            "kernel lock unavailable",
            act,
        )
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
    /// under the kernel lock. Each form claims only its own ops. A Nara op
    /// is prepared at the `place` its owners resolved outside the lock
    /// (`nara_project`); without one it is resolved here, under it.
    fn prepare_op(
        &mut self,
        op: &KernelOp,
        place: Option<agent_prepared::Place>,
    ) -> Result<Prepared, String> {
        if let Some(p) = self.prepare_nara_epii(op, place.clone())? {
            return Ok(Prepared::Epii(p));
        }
        if let Some(p) = self.prepare_nara_expressive_act(op, place.clone())? {
            return Ok(Prepared::Act(p));
        }
        if let Some(p) = self.prepare_nara_presence(op, place.clone())? {
            return Ok(Prepared::Presence(p));
        }
        if let Some(p) = self.prepare_m3_reception(op, place.clone())? {
            return Ok(Prepared::M3(p));
        }
        if let Some(p) = self.prepare_nara_current(op, place.clone())? {
            return Ok(Prepared::Current(p));
        }
        if let Some(p) = self.prepare_nara_voice(op, place.clone())? {
            return Ok(Prepared::Voice(p));
        }
        if let Some(p) = self.prepare_nara_dialogue(op, place)? {
            return Ok(Prepared::Dialogue(p));
        }
        if let Some(p) = self.prepare_nara_identity(op) {
            return Ok(Prepared::Identity(p));
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
/// prepared ops run their owner work outside it, a field op runs on the
/// field's own lock, every other op is applied in order under the kernel
/// lock. Returns the outcome and where its time went; the host forwards the
/// outcome's receipts. A field op takes the kernel lock only for an instant,
/// to find the field; a host that holds the field calls `dispatch_with`.
pub fn dispatch(kernel: &Mutex<Kernel>, op: KernelOp) -> (Result<KernelOpOutcome, String>, Timing) {
    dispatch_in(kernel, None, op)
}

/// `dispatch` for a host that holds the live field's handle
/// (`Kernel::native_field`) beside its kernel: a field op never takes the
/// kernel lock, so it answers whatever the kernel lock is doing.
pub fn dispatch_with(
    kernel: &Mutex<Kernel>,
    field: &native_expression::Field,
    op: KernelOp,
) -> (Result<KernelOpOutcome, String>, Timing) {
    dispatch_in(kernel, Some(field), op)
}

fn dispatch_in(
    kernel: &Mutex<Kernel>,
    field: Option<&native_expression::Field>,
    op: KernelOp,
) -> (Result<KernelOpOutcome, String>, Timing) {
    let mut seat = Seat {
        kernel,
        timing: Timing::default(),
    };
    let memory_only = reads_kernel_memory_only(&op);
    let (result, scopes) = crate::read_cache::attributed(|| run(&mut seat, field, op));
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
        | KernelOp::Setup { .. }
        // Lane AK: an AIKit SessionSpace delivery (being.rs, its owner
        // re-admits the binding by CAS) and a file shown in Finder.
        | KernelOp::BeingEncounter { .. }
        | KernelOp::SettingsReveal { .. } => true,
        KernelOp::SharedField { request } => !crate::shared_field::is_read(request),
        // A presence's listing and withdrawal: SharedField's own transport,
        // nothing of the kernel's Expression or identity.
        KernelOp::NaraPresence { request, .. } => request.admission().is_none(),
        _ => false,
    }
}

fn run(
    seat: &mut Seat<'_>,
    field: Option<&native_expression::Field>,
    op: KernelOp,
) -> Result<KernelOpOutcome, String> {
    if let KernelOp::NativeExpression { request } = op {
        return run_field(seat, field, request);
    }
    if !is_free(&op) {
        return run_prepared(seat, op);
    }
    seat.timing.form = "free";
    seat.owner(|| free(op))
}

/// A field op on the field's own lock (`native_expression::Field`): an
/// exchange's round trip to `ql-field-host`, a compose's open of it, never
/// under the kernel lock. Without the host's handle, the kernel lock is
/// taken for the instant it takes to find the field.
fn run_field(
    seat: &mut Seat<'_>,
    field: Option<&native_expression::Field>,
    request: native_expression::Request,
) -> Result<KernelOpOutcome, String> {
    seat.timing.form = "native-field";
    let found;
    let field = match field {
        Some(field) => field,
        None => {
            found = seat.hold(|kernel| kernel.native_field())?;
            &found
        }
    };
    let data = field.apply_timed(request, &mut seat.timing)?;
    Ok(KernelOpOutcome {
        read_scopes: None,
        receipts: Vec::new(),
        result: KernelOpResult::NativeExpression { data },
    })
}

/// The Project label of a Nara op whose prepare needs its place (the
/// directory and the ProjectRef bound there); read from the op alone.
fn nara_project(op: &KernelOp) -> Option<&str> {
    match op {
        KernelOp::NaraEpii { project, .. }
        | KernelOp::NaraExpressiveAct { project, .. }
        | KernelOp::M3Reception { project, .. }
        | KernelOp::NaraCurrent { project, .. }
        | KernelOp::NaraVoice { project, .. }
        | KernelOp::NaraDialogue { project, .. } => Some(project),
        KernelOp::NaraPresence { project, request } if request.admission().is_some() => {
            Some(project)
        }
        _ => None,
    }
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
        // A projected Agent's delivery through AIKit's SessionSpace owner,
        // which re-admits the Agent and its binding by CAS (being.rs); and a
        // file of the person's own shown in Finder. Neither reads or records
        // kernel state (lane AK).
        KernelOp::BeingEncounter { request } => Ok(KernelOpOutcome {
            read_scopes: None,
            receipts: Vec::new(),
            result: KernelOpResult::BeingEncounter {
                data: crate::being::apply(request),
            },
        }),
        KernelOp::SettingsReveal { path } => Ok(KernelOpOutcome {
            read_scopes: None,
            receipts: Vec::new(),
            result: KernelOpResult::SettingsRevealed {
                data: crate::system_composition::reveal(&path)?,
            },
        }),
        _ => Err("This operation reads or records kernel state".into()),
    }
}

fn run_prepared(seat: &mut Seat<'_>, op: KernelOp) -> Result<KernelOpOutcome, String> {
    // A Nara op's place is resolved by its owners (Central's World, its
    // project inspection, AIKit's root binding) outside the lock; the lock
    // never guarded those owners' answers, and the prepare that follows
    // captures the kernel's own state in one take, as before.
    let place = match nara_project(&op) {
        Some(project) => {
            let place = seat.hold(|kernel| kernel.prepare_place(project))?;
            Some(seat.owner(|| place.resolve())?)
        }
        None => None,
    };
    let prepared = seat.hold(|kernel| kernel.prepare_op(&op, place))??;
    seat.timing.form = prepared.form();
    match prepared {
        Prepared::Epii(p) => {
            let done = seat.owner(|| p.execute())?;
            commit_nara_epii(seat, done)
        }
        Prepared::Act(p) => {
            let done = seat.owner(|| p.execute())?;
            commit_nara_expressive_act(seat, done)
        }
        Prepared::Presence(p) => {
            let done = seat.owner(|| p.execute())?;
            commit_nara_presence(seat, done, |request| {
                crate::shared_field::call(request).map_err(|error| error.detail())
            })
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

/// An accepted Epii return's commit (lane Z): the saved identity's re-read
/// runs outside the lock; the document, profile and occasion checks and the
/// reviewed focus's application hold it in one take. Identity writes never
/// take the kernel lock (a NaraIdentity save runs wholly outside it), so
/// reading the identity under it bought no atomicity.
fn commit_nara_epii(
    seat: &mut Seat<'_>,
    done: nara_epii::PreparedOutcome,
) -> Result<KernelOpOutcome, String> {
    let done = seat.owner(|| done.confirmed())?;
    seat.hold(|kernel| kernel.finish_nara_epii(done))?
}

/// An expressive act's commit, split the same way.
fn commit_nara_expressive_act(
    seat: &mut Seat<'_>,
    done: nara_expressive_act::PreparedOutcome,
) -> Result<KernelOpOutcome, String> {
    let done = seat.owner(|| done.confirmed())?;
    seat.hold(|kernel| kernel.finish_nara_expressive_act(done))?
}

/// A presence's commit (lane Z): the saved identity's re-read, then the
/// unchanged-Expression and profile check under the lock, then SharedField's
/// publication outside it. The publication had been held under the lock "to
/// serialize it with native Expression changes"; that bought nothing: what
/// is published is fixed at preparation (the safe cues of the captured
/// document, naming its revision), the check shows that document is still
/// the kernel's, and the publication records nothing in the kernel. An
/// Expression change landing during the network call leaves the same
/// outcome either way — the named revision published, the newer one local —
/// and SharedField's other writes, a presence's withdrawal among them,
/// never ran under this lock. `publish` is SharedField's own call.
fn commit_nara_presence(
    seat: &mut Seat<'_>,
    done: nara_presence::Completed,
    publish: impl FnOnce(&serde_json::Value) -> Result<serde_json::Value, String>,
) -> Result<KernelOpOutcome, String> {
    let done = seat.owner(|| done.confirmed())?;
    let admitted = seat.hold(|kernel| kernel.finish_nara_presence(done))??;
    seat.owner(|| admitted.publish(publish))
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
        let mut form = |op: KernelOp| kernel.prepare_op(&op, None).unwrap().form();
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
    /// file stands, and its project inspection while `<gate>.inspect` does:
    /// slow owner reads, by a real child process.
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
if action == "projectcentral.inspect":
    while os.path.exists(gate + ".inspect"):
        time.sleep(0.02)
    ok({"manifest": {"project_id": "project:lane-z"}})
elif action == "projectcentral.source.read":
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
    ok({"schema": "central.world-map/v1", "root": "/tmp",
        "work": {"projects": [{"name": "lane-z", "path": "Work/lane-z"}]}})
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

        fn calls(&self, action: &str) -> usize {
            std::fs::read_to_string(&self.log)
                .map(|text| text.lines().filter(|line| *line == action).count())
                .unwrap_or(0)
        }

        fn identity_reads(&self) -> usize {
            self.calls("projectcentral.source.read")
        }

        /// Runs `commit` while the saved identity's read is held, and asks the
        /// live field's exchange and the state snapshot meanwhile. Both must
        /// be answered before the held read is released: their answers arrive
        /// while the owner process still sleeps, whatever the machine's speed.
        /// The bound only stops a failing run from waiting forever.
        fn answered_while_held<T: Send>(
            &self,
            commit: impl FnOnce(&Mutex<Kernel>) -> T + Send,
        ) -> T {
            self.answered_while(&self.gate, || self.identity_reads() > 0, commit)
        }

        /// `answered_while_held` for any slow step: `gate` holds it, `asked`
        /// says it has begun.
        fn answered_while<T: Send>(
            &self,
            gate: &std::path::Path,
            asked: impl Fn() -> bool,
            commit: impl FnOnce(&Mutex<Kernel>) -> T + Send,
        ) -> T {
            std::fs::write(gate, "").unwrap();
            std::thread::scope(|scope| {
                let committing = scope.spawn(|| commit(&self.kernel));
                let deadline = Instant::now() + Duration::from_secs(60);
                while !asked() {
                    assert!(
                        Instant::now() < deadline,
                        "the commit never reached its held step"
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
                let still_held = gate.exists() && !committing.is_finished();
                std::fs::remove_file(gate).unwrap();
                let (field, state) = probe.unwrap_or_else(|_| {
                    panic!("the field's exchange and the state snapshot waited behind the held owner step")
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

    /// Lane Z (DLW, O-I #706): an accepted Epii return re-read the saved
    /// identity under the kernel lock. It is read outside it now; the
    /// in-memory checks and the focus hold the lock.
    #[test]
    fn an_epii_acceptance_answers_the_field_while_its_identity_is_held() {
        let held = HeldIdentity::new("epii");
        let (document, profile) = held.basis();
        let binding = HeldIdentity::binding();
        let accepted =
            nara_epii::PreparedOutcome::Accept(Box::new(nara_epii::ReviewedEnrichment {
                client: held.client(),
                context_state: Default::default(),
                origin_binding: binding.clone(),
                origin_session_ref: "agent-session:lane-z".into(),
                identity_source_ref: binding.source_ref.clone(),
                identity_revision: binding.expected_revision.clone(),
                expected_revision: document["revision"].as_u64().unwrap(),
                captured_document: document,
                captured_profile: profile,
                expression_ref: HeldIdentity::EXPRESSION.into(),
                proposal_ref: "proposal:lane-z".into(),
                proposed_by: "agent-session:lane-z".into(),
                activity_ref: "agent-session:lane-z#block-1".into(),
                summary: "Lane Z".into(),
                change: crate::expression::Change::Rename {
                    title: "Lane Z".into(),
                },
                method_refs: vec![],
                evidence_refs: vec![],
                provenance: serde_json::json!({}),
            }));
        let (outcome, timing) = held.answered_while_held(|kernel| {
            let mut seat = Seat {
                kernel,
                timing: Timing::default(),
            };
            (commit_nara_epii(&mut seat, accepted), seat.timing)
        });
        // The reviewed change is a rename, which a focus review refuses — after
        // the identity was confirmed, under the lock.
        assert!(outcome.unwrap_err().contains("focus proposal"));
        assert_eq!(held.identity_reads(), 1);
        assert!(timing.lock_held < timing.owner);
    }

    /// The same commit seam for an expressive act's restore.
    #[test]
    fn an_expressive_act_answers_the_field_while_its_identity_is_held() {
        let held = HeldIdentity::new("act");
        let (document, profile) = held.basis();
        let restore = nara_expressive_act::PreparedOutcome::Restore(Box::new(
            nara_expressive_act::PreparedRestore {
                client: held.client(),
                binding: HeldIdentity::binding(),
                expected_revision: document["revision"].as_u64().unwrap(),
                captured_document: document,
                captured_profile: profile,
                agent_session_ref: "agent-session:lane-z".into(),
                act_ref: "oi:nara-act:lane-z".into(),
            },
        ));
        let (outcome, timing) = held.answered_while_held(|kernel| {
            let mut seat = Seat {
                kernel,
                timing: Timing::default(),
            };
            (commit_nara_expressive_act(&mut seat, restore), seat.timing)
        });
        // No checkpoint was ever retained: the restore is refused under the
        // lock, after the identity was confirmed outside it.
        assert!(outcome.unwrap_err().contains("no retained checkpoint"));
        assert_eq!(held.identity_reads(), 1);
        assert!(timing.lock_held < timing.owner);
    }

    /// A presence admission prepared on the held-identity kernel's basis.
    fn presence(held: &HeldIdentity) -> nara_presence::Completed {
        let (document, profile) = held.basis();
        nara_presence::Completed {
            client: held.client(),
            operation: nara_presence::Operation::Publish,
            request: nara_presence::Admission {
                binding: HeldIdentity::binding(),
                expected_expression_revision: document["revision"].as_u64().unwrap(),
                publication: serde_json::from_value(serde_json::json!({
                    "field_ref": "field:lane-z", "world_ref": "world:lane-z",
                    "projection_ref": "projection:lane-z", "presentation_ref": "presentation:lane-z",
                    "projection_revision": 1, "publisher_identity_ref": "human:lane-z",
                    "publisher_participant_ref": "participant:one", "target_ref": "participant:two",
                    "target_identity_ref": "human:two", "consent_ref": "consent:lane-z",
                    "granted_at": "2026-10-29T12:00:00Z", "granted_at_unix_ms": 1}))
                .unwrap(),
            },
            document,
            profile,
            safe_document: serde_json::json!({"schema": "oi.expression/v1"}),
            consent_reading: serde_json::json!({"permitted": true}),
        }
    }

    /// Lane Z: a presence re-read the saved identity under the kernel lock.
    #[test]
    fn a_presence_answers_the_field_while_its_identity_is_held() {
        let held = HeldIdentity::new("presence");
        let completed = presence(&held);
        let (outcome, timing) = held.answered_while_held(|kernel| {
            let mut seat = Seat {
                kernel,
                timing: Timing::default(),
            };
            let published = commit_nara_presence(&mut seat, completed, |request| {
                Ok(serde_json::json!({"published": request["kind"]}))
            });
            (published, seat.timing)
        });
        let outcome = outcome.unwrap();
        assert!(matches!(
            outcome.result,
            KernelOpResult::NaraPresence { ref data }
                if data["published"] == "publish_nara" && data["consent_reading"]["permitted"] == true
        ));
        assert_eq!(held.identity_reads(), 1);
        assert!(timing.lock_held < timing.owner);
    }

    /// SharedField's publication, by a real child process held on a gate:
    /// it had run under the kernel lock "to serialize it with native
    /// Expression changes"; it runs after the admission, outside it.
    #[test]
    fn a_presence_publication_answers_the_field_while_it_is_sent() {
        let held = HeldIdentity::new("publication");
        let completed = presence(&held);
        let gate = held.directory.join("publication-gate");
        let started = held.directory.join("publication-started");
        let publish = |request: &serde_json::Value| -> Result<serde_json::Value, String> {
            let sent = std::process::Command::new("python3")
                .arg("-c")
                .arg(
                    "import json,os,sys,time\n\
                     open(sys.argv[1],'w').close()\n\
                     while os.path.exists(sys.argv[2]): time.sleep(0.02)\n\
                     print(json.dumps({'published': json.loads(sys.argv[3])['kind']}))",
                )
                .arg(&started)
                .arg(&gate)
                .arg(request.to_string())
                .output()
                .map_err(|e| e.to_string())?;
            serde_json::from_slice(&sent.stdout).map_err(|e| e.to_string())
        };
        let outcome = held.answered_while(
            &gate,
            || started.exists(),
            |kernel| {
                let mut seat = Seat {
                    kernel,
                    timing: Timing::default(),
                };
                commit_nara_presence(&mut seat, completed, publish)
            },
        );
        assert!(matches!(
            outcome.unwrap().result,
            KernelOpResult::NaraPresence { ref data } if data["published"] == "publish_nara"
        ));
    }

    /// Lane Z: a Nara op's prepare resolved its place — Central's World, the
    /// named project's inspection — under the kernel lock. Its owners answer
    /// outside it now, before the prepare captures the kernel's state.
    #[test]
    fn a_nara_prepare_answers_the_field_while_its_project_is_inspected() {
        let held = HeldIdentity::new("place");
        let gate = held.gate.with_extension("inspect");
        let op = KernelOp::NaraCurrent {
            project: "lane-z".into(),
            request: nara_current::Request::Read {
                binding: HeldIdentity::binding(),
            },
        };
        let (outcome, timing) = held.answered_while(
            &gate,
            || held.calls("projectcentral.inspect") > 0,
            |kernel| dispatch(kernel, op),
        );
        // The stand-in Expression selects no coordinate: the reading itself
        // is refused, by its owner work, after the prepare.
        assert!(outcome.unwrap_err().contains("coordinate"));
        assert_eq!(held.calls("projectcentral.inspect"), 1);
        assert_eq!(timing.form, "nara-current");
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
                kernel.prepare_op(&op, None).unwrap().form()
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
            // A passage sent to a person (O-I #820): a Contact request the recipient accepts.
            json!({"op": "shared_field", "request": {"kind": "message", "to_participant_ref": "p", "passage": {"text": "t", "from": "f"}}}),
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

    /// Every op the wire carries that a prepared form or the free path
    /// serves, by its wire name. The ordered ops are the census's own
    /// (`an_owner_runs_under_the_lock_only_for_an_ordering_invariant`).
    const SERVED_BY_A_FORM: &str = "
        a2a_exchange actuation_read actuation_write agency_read agent_card agent_definition
        aikit_read aikit_write being_encounter central chat_default_read client_install
        composition_read config_apply config_apply_reviewed config_capabilities_read
        config_desired_discard config_desired_hold config_diff config_plan config_plan_reviewed
        config_receipts config_registry_read config_reset config_resolutions_read
        credential_discover credential_list credential_revoke credential_rotate
        credential_setup credential_verify day_read decide decision_status dictation_probe
        dictation_transcribe encounter encounter_join encounter_provision
        encounter_session_detach encounter_session_settings encounter_session_settings_list
        encounter_task_attempts_list encounter_task_configure encounter_task_copy
        encounter_task_read encounter_task_remove expression_recovery factory_attempt_read
        factory_attempt_task_list_read factory_attempt_task_read factory_build_snapshot
        factory_development_read factory_owner file_bytes file_last_reading file_operation
        file_read file_resolve files_list flow_changed_since flow_participant_provision
        gateway_remotes_read gateway_team gateway_write git_diff_read git_repository_read graph
        ground ground_authority ground_form harness_agent_control harness_agent_read
        harness_auth_describe harness_status inhabitation_read instance_commission
        invoke_action janko_window_read knowledge knowledge_impact live_clip_create
        live_clip_read live_clip_write live_device_descriptors live_device_param_write
        live_device_params_read live_groove_pool_read live_groove_pool_write live_set_act
        live_set_read live_sets_list live_take_comp live_track_mixer_write m3_reception
        material_read model_catalogue model_roster music_modes_read nara_coordinate
        nara_current nara_dialogue nara_elemental nara_epii nara_expressive_act nara_identity
        nara_journey nara_lived_context nara_presence nara_voice native_expression now page
        product_action_run profile_create profile_edit profile_list profile_read
        profile_use_apply profile_use_plan project_browse project_read ql_read receiving
        routine seat_status_read seat_write settings_reveal setup shared_field source_history
        source_returns_read sources_list system_composition_read team_space
        temporal_events_read wiki_projection_read wiki_projection_sources workcell_read
        workcell_status_read workcell_write working_surface_attachment working_surface_read
        world_body_read world_browse world_read world_resolve";

    /// The wire names of every `KernelOp` (lib.rs), as `op_name` spells them.
    fn wire_names() -> Vec<String> {
        let source = include_str!("lib.rs");
        let body = source
            .split_once("pub enum KernelOp {")
            .and_then(|(_, rest)| rest.split_once("\n}\n"))
            .map(|(body, _)| body)
            .expect("lib.rs declares KernelOp");
        body.lines()
            .filter_map(|line| line.strip_prefix("    "))
            .filter(|line| line.starts_with(|c: char| c.is_ascii_uppercase()))
            .map(|line| {
                let variant: String = line.chars().take_while(|c| c.is_alphanumeric()).collect();
                let mut name = String::new();
                for (index, c) in variant.chars().enumerate() {
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
            })
            .collect()
    }

    /// Lane AK: the census of what dispatch applies in order, under the
    /// kernel lock. An ordered arm that runs an owner process there is held
    /// for the ordering invariant it names; every other ordered arm runs
    /// none. The arms that ran an owner under the lock for no invariant now
    /// run it outside: free, or a prepared read or write. And no op of the
    /// wire goes unclassified: each is in the census or served by a form.
    #[test]
    fn an_owner_runs_under_the_lock_only_for_an_ordering_invariant() {
        use serde_json::json;
        let owner = crate::tests::FakeOwner::spawn_counter("dispatch-census");
        let mut kernel = owner.kernel();
        let mut form = |op: &serde_json::Value| -> &'static str {
            let op: KernelOp = serde_json::from_value(op.clone()).unwrap();
            if is_free(&op) {
                "free"
            } else {
                kernel.prepare_op(&op, None).unwrap().form()
            }
        };
        let location =
            json!({"schema": "central.path-ref/v1", "ref": "ref:a", "root": "R", "path": "a.md"});
        let proposal = json!({"sites": ["agent.ui"], "credential_ref": "keychain://c",
            "limits": {"timeout_ms": 1, "max_attempts": 1, "max_total_reserved_microusd": 1,
                "tariff": {"model_version": "m", "source": "s", "max_input_tokens_per_attempt": 1,
                    "max_output_tokens_per_attempt": 1, "input_microusd_per_million_tokens": 1,
                    "output_microusd_per_million_tokens": 1}},
            "episode_budget_microusd": 1, "episode_seconds": 1});

        // Ordered, with an owner process under the lock, each for its invariant.
        let expression = "One Expression's revisions advance in arrival order: an act, an \
            open from its file and a save each answer from, and leave, the revision the store \
            holds, with the Nara readings over it retired in the same step";
        let buffer = "A source buffer's canonical layer moves in arrival order with the person's \
            edits: an open never clobbers a dirty buffer, a save writes the content edited \
            before it and rebases the buffer on the revision the owner answered";
        let held = [
            (
                expression,
                json!({"op": "expression", "request": {"operation": "save",
                "expression_ref": "e", "expected_revision": 1, "location": location,
                "expected_file_revision": "v", "actor": "a", "actor_kind": "human"}}),
            ),
            (
                expression,
                json!({"op": "expression_world", "request": {"operation": "capabilities"}}),
            ),
            (buffer, json!({"op": "source_open", "source_ref": "s"})),
            (buffer, json!({"op": "source_save", "source_ref": "s"})),
            (buffer, json!({"op": "source_reread", "source_ref": "s"})),
            (
                buffer,
                json!({"op": "source_restore", "source_ref": "s", "content": "c",
                "base_revision": "v", "saved_content": "c"}),
            ),
            (buffer, json!({"op": "day_source_open"})),
            (
                "A decision's basis — the renderer observation the kernel holds and the owners' \
              readings beside it — is taken in one hold, so the digest the person confirms \
              names one moment",
                json!({"op": "decision_preflight", "proposal": proposal}),
            ),
            (
                "A decision's basis is taken in one hold (as `decision_preflight`)",
                json!({"op": "invoke_action", "invocation": {"action": "action:decision.preflight", "target_ref": "t"}}),
            ),
            (
                "A hosted World's acts reach their owner in the order they arrived: its owner \
              fences its own generation, never the order of one host's concurrent sends",
                json!({"op": "hosted_native", "source_world_ref": "world:w", "action_ref": "a",
                "request": {"op": "expression", "request": {"operation": "list"}}}),
            ),
        ];
        // Ordered, and no owner process: the kernel's own state, or a file
        // only the kernel keeps.
        let kernel_only = [
            json!({"op": "state"}),
            json!({"op": "protocol_read"}),
            json!({"op": "recording_capability_read"}),
            json!({"op": "decision_read"}),
            json!({"op": "decision_episode_revoke", "authority_ref": "a"}),
            json!({"op": "dictation_read"}),
            json!({"op": "dictation_configure", "stt_url": "u", "expected_revision": 1}),
            json!({"op": "presentation_read"}),
            json!({"op": "presentation_observe", "window_id": "w", "visuals": {}, "arrangement": {}}),
            json!({"op": "theme_import", "theme": {"id": "t", "name": "n", "appearance": "a",
                "preview": {"ground": "g", "ink": "i", "accent": "a", "strip": []}, "variables": {}}}),
            json!({"op": "theme_apply", "appearance": "a"}),
            json!({"op": "theme_revert"}),
            json!({"op": "theme_remove", "id": "t"}),
            json!({"op": "nara_decision_record", "decision": {}}),
            json!({"op": "chat_default_hold", "provider": "p"}),
            json!({"op": "chat_default_discard"}),
            json!({"op": "source_edit", "source_ref": "s", "content": "c"}),
            json!({"op": "surface_open", "surface_id": "s", "kind": "k", "title": "t"}),
            json!({"op": "surface_close", "surface_id": "s"}),
            json!({"op": "surface_focus", "surface_id": "s"}),
        ];
        // Moved out of the lock by lane AK: they ran an owner under it for
        // no invariant.
        let moved = [
            (json!({"op": "world_body_read"}), "owner-read"),
            (
                json!({"op": "file_resolve", "reference": "r"}),
                "owner-read",
            ),
            (
                json!({"op": "ground_form", "request": {"operation": "preview"}}),
                "owner-write",
            ),
            (
                json!({"op": "ground_authority", "request": {"operation": "preview"}}),
                "owner-write",
            ),
            (
                json!({"op": "being_encounter", "request": {"operation": "standing",
                "agent_ref": "a", "target_agency_ref": "t", "source_refs": []}}),
                "free",
            ),
            (json!({"op": "settings_reveal", "path": "~/a"}), "free"),
        ];

        for (invariant, op) in &held {
            assert!(!invariant.trim().is_empty());
            assert_eq!(form(op), "ordered", "held under the lock: {op}");
        }
        for op in &kernel_only {
            assert_eq!(form(op), "ordered", "ordered, kernel state only: {op}");
        }
        for (op, moved_to) in &moved {
            assert_eq!(form(op), *moved_to, "its owner runs outside the lock: {op}");
        }
        assert_eq!(owner.spawns("central.world"), 0, "preparing asked no owner");

        // The census is the whole wire.
        let census: std::collections::BTreeSet<String> = held
            .iter()
            .map(|(_, op)| op)
            .chain(kernel_only.iter())
            .map(|op| op["op"].as_str().unwrap().to_owned())
            .collect();
        let served: std::collections::BTreeSet<&str> =
            SERVED_BY_A_FORM.split_whitespace().collect();
        let names = wire_names();
        assert!(
            names.len() > 150,
            "lib.rs's KernelOp was read: {}",
            names.len()
        );
        let unclassified: Vec<&String> = names
            .iter()
            .filter(|name| !census.contains(*name) && !served.contains(name.as_str()))
            .collect();
        assert!(
            unclassified.is_empty(),
            "an op is in the census or served by a form: {unclassified:?}"
        );
        let stale: Vec<&&str> = served
            .iter()
            .filter(|name| !names.iter().any(|known| known == *name))
            .collect();
        assert!(stale.is_empty(), "no op that left the wire: {stale:?}");
        for (op, _) in &moved {
            assert!(served.contains(op["op"].as_str().unwrap()));
        }
    }
}
