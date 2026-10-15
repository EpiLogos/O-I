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
    native_expression, owner_read, working_surface, world_prepared, Kernel, KernelOp,
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

fn run(seat: &mut Seat<'_>, op: KernelOp) -> Result<KernelOpOutcome, String> {
    // Owners with no kernel state at all.
    match op {
        KernelOp::ExpressionRecovery { request } => {
            seat.timing.form = "free";
            seat.owner(|| crate::expression_recovery::execute(request))
        }
        KernelOp::NaraCoordinate { request } => {
            seat.timing.form = "free";
            seat.owner(|| crate::nara_coordinate::execute(request))
        }
        KernelOp::WorldResolve { world_id, verify } => {
            seat.timing.form = "free";
            seat.owner(|| {
                crate::world_resolve::execute(crate::world_resolve::Request { world_id, verify })
            })
        }
        op => run_prepared(seat, op),
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
}
