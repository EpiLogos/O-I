//! Owner writes prepared under the kernel lock and run outside it (lane W3,
//! dispatch.rs). Ported from the prepared reads (owner_read.rs
//! `PreparedRead`, agent_prepared.rs): preparation captures what the write
//! needs from kernel state — the World its scope comes from (the retained
//! reading, else the one its burst shares: never a World read under the
//! lock) and the owner clients — and the owner process runs without the lock.
//! What the ordered arm recorded is recorded by `Kernel::finish_owner_write`
//! under the lock, after the owner answered:
//!
//! - a receipt for what the owner did — a NOW write, a Day write, a
//!   receiving act, a Factory Run act (`events.rs` `NowChanged`,
//!   `DayChanged`, `ReceivingChanged`, `FactoryRunChanged`) — and the
//!   temporal field's retained answers retired, so a reader told by the
//!   receipt reads the owner again, never the answer from before the write;
//! - a configuration change's receipt, as the ordered arms recorded it;
//! - an action's or a commission's invalidations: the derived knowledge and
//!   graph readings, and any reading whose ticket predates the write, are
//!   retired (read_cache `invalidate_prefix` withdraws the tickets too), and
//!   a construction save's `FileChanged`.
//!
//! Every write's own revision check stays the owner's: Central CAS-checks its
//! expected revisions, Factory replays an identical request as
//! already-applied. The kernel decides no conflict. A refused or failed write
//! records nothing; an answer that says it changed nothing (`created: false`
//! with no advance, `changed: false`, `already-applied`) records no receipt.
//! The ordered arms in lib.rs `apply` run these same steps under the lock.
use crate::{
    action, agency, agent_prepared::PreparedWorld, central, configuration, credentials,
    events::KernelEvent, factory, files, flow::ReceivingRequest, owner_read, CentralClient, Kernel,
    KernelOp, KernelOpOutcome, KernelOpResult,
};
use serde_json::Value;
use std::path::PathBuf;

/// One owner write, prepared under the kernel lock.
pub struct PreparedWrite {
    client: CentralClient,
    agency: agency::Client,
    world: PreparedWorld,
    op: KernelOp,
}

/// What the finish records once the owner answered. Recorded only when the
/// write answered; never for a refusal.
enum Record {
    Event(Box<KernelEvent>),
    /// The temporal field's retained answers.
    RetireTemporal,
    /// The derived knowledge and graph readings (and their pending tickets).
    RetireDerived,
    /// One directory listing, by name.
    RetireListing(String),
}

/// The owner's answer to a prepared write, awaiting its finish.
pub struct WriteAnswered {
    result: Result<KernelOpResult, String>,
    records: Vec<Record>,
}

/// The owner's name in a receipt.
const CENTRAL: &str = "central";
const FACTORY: &str = "factory";

/// Whether an action carried by `invoke_action` only reads Central: its
/// answer moves nothing, so it retires no reading. The write path asks
/// action.rs `reads_only`, which also knows a Contemplate preflight; the
/// reading test holds Central's side here.
#[cfg(test)]
fn central_reading(action: &str) -> bool {
    crate::read_cache::central_reads(action)
}

/// Whether a prepared write is a reading carried as an action, which moves
/// nothing (every other prepared write may have changed its owner): a
/// Central reading or Preview, or a Contemplate Flow preflight
/// (action.rs `reads_only`).
fn reads_only(client: &CentralClient, op: &KernelOp) -> bool {
    matches!(op, KernelOp::InvokeAction { invocation, .. } if action::reads_only(client, invocation))
}

impl PreparedWrite {
    /// Whether `op` is an owner write with a prepared form.
    pub(crate) fn claims(op: &KernelOp) -> bool {
        match op {
            KernelOp::Receiving { request, .. } => receiving_write(request),
            KernelOp::Central { request, .. } => central_write(request),
            KernelOp::FactoryOwner { request } => !request.is_read(),
            KernelOp::Page { request } => request.is_write(),
            KernelOp::NaraJourney { request } => request.is_write(),
            KernelOp::InvokeAction { invocation, .. } => {
                // The decision actions are the decision form's (decision.rs)
                // and its ordered arm's: they act on kernel-held authority.
                !invocation.action.starts_with("action:decision.")
            }
            KernelOp::CredentialSetup { .. }
            | KernelOp::CredentialRotate { .. }
            | KernelOp::CredentialVerify { .. }
            | KernelOp::CredentialRevoke { .. }
            | KernelOp::ClientInstall { .. }
            | KernelOp::ProductActionRun { .. }
            | KernelOp::ConfigDesiredHold { .. }
            | KernelOp::ConfigDesiredDiscard { .. }
            | KernelOp::ConfigPlan { .. }
            | KernelOp::ConfigPlanReviewed { .. }
            | KernelOp::ConfigReset { .. }
            | KernelOp::ConfigApplyReviewed { .. }
            | KernelOp::ConfigApply { .. }
            | KernelOp::ProfileUsePlan { .. }
            | KernelOp::ProfileUseApply { .. }
            | KernelOp::ProfileCreate { .. }
            | KernelOp::ProfileEdit { .. }
            | KernelOp::InstanceCommission { .. }
            | KernelOp::EncounterProvision { .. }
            | KernelOp::FlowParticipantProvision { .. }
            | KernelOp::HarnessAgentControl { .. }
            | KernelOp::FileOperation { .. }
            | KernelOp::Routine { .. } => true,
            // Lane W3 (T-COVERAGE §1.2): the owner routes that write
            // (owner_routes.rs). A team `read` is a prepared read.
            KernelOp::GatewayTeam { request } => !request.is_read(),
            KernelOp::GatewayWrite { .. }
            | KernelOp::WorkcellWrite { .. }
            | KernelOp::SeatWrite { .. }
            | KernelOp::ActuationWrite { .. }
            | KernelOp::AikitWrite { .. } => true,
            _ => false,
        }
    }

    /// Whether the write is scoped by the World (it then shares its burst's
    /// one reading); the others need none and read none.
    fn needs_world(op: &KernelOp) -> bool {
        match op {
            KernelOp::Receiving { project, .. } => project.is_some(),
            // Factory's unit decisions name Central's root (lane W3).
            KernelOp::FactoryOwner { request } => request.needs_world(),
            // Lane W3: an AIKit route runs from Central's disclosed ground;
            // Workcell and the seat instrument need none.
            KernelOp::GatewayWrite { request } => request.project().is_some(),
            KernelOp::GatewayTeam { request } => request.project.is_some(),
            KernelOp::AikitWrite { request } => request.project().is_some(),
            KernelOp::WorkcellWrite { .. }
            | KernelOp::SeatWrite { .. }
            | KernelOp::ActuationWrite { .. } => false,
            KernelOp::Central { .. }
            | KernelOp::HarnessAgentControl { .. }
            | KernelOp::FileOperation { .. }
            | KernelOp::Page { .. }
            | KernelOp::NaraJourney { .. } => false,
            _ => true,
        }
    }

    /// The owner call, outside the kernel lock. Nothing is recorded here.
    pub fn execute(self) -> WriteAnswered {
        let mut records = Vec::new();
        let result = self.write(&mut records);
        // Whatever the owner changed, or may have changed before it failed,
        // moves every reading kept from before: the watcher confirms it later.
        // A Central reading carried as an action changed nothing, so it moves
        // nothing: clearing the read model for it would throw every retained
        // reading away each time a device reads.
        if !reads_only(&self.client, &self.op) {
            crate::read_cache::written();
        }
        WriteAnswered { result, records }
    }

    /// The Central root the World discloses, else this process's directory —
    /// the ordered arms' `world_map(false).ok()` fallback, unchanged.
    fn root_or_cwd(&self) -> Result<PathBuf, String> {
        match self
            .world
            .read()
            .ok()
            .and_then(|world| world["root"].as_str().map(PathBuf::from))
        {
            Some(root) => Ok(root),
            None => std::env::current_dir().map_err(|e| e.to_string()),
        }
    }

    fn write(&self, records: &mut Vec<Record>) -> Result<KernelOpResult, String> {
        Ok(match &self.op {
            KernelOp::Receiving { project, request } => {
                if let Some(project) = project {
                    owner_read::disclosed(&self.world.read()?, project)?;
                }
                // The person's own acts on a document (an authored field, a
                // review, an inclusion, a recovery) carry the person's native
                // authority; a producer's submission never does.
                let client = if receiving_person_act(request) {
                    self.client.for_person()
                } else {
                    self.client.clone()
                };
                let data = client
                    .receiving(project.as_deref(), request)
                    .map_err(|e| e.to_string())?;
                if moved(&data) {
                    records.push(Record::Event(Box::new(KernelEvent::ReceivingChanged {
                        owner: CENTRAL.into(),
                        action: request.action().into(),
                        project: project.clone(),
                        reference: receiving_ref(request, &data, project.as_deref()),
                        revision: owner_revision(&data),
                    })));
                    records.push(Record::RetireTemporal);
                }
                KernelOpResult::ReceivingReading { data }
            }
            KernelOp::Central { project, request } => {
                // Ensuring, making and closing a Day are the person's presses
                // (Open today, Close now): they carry the person's native
                // authority.
                let data =
                    central::operate(&self.client.for_person(), project.as_deref(), request)?;
                if moved(&data) {
                    let (action, requested) = match request {
                        central::Request::EnsureDay { .. } => ("central.day.ensure", None),
                        central::Request::InitialiseDay { day_ref, .. } => {
                            ("central.document.create", Some(day_ref.as_str()))
                        }
                        central::Request::CloseDay { day_ref, .. } => {
                            ("central.day.lifecycle", Some(day_ref.as_str()))
                        }
                        _ => unreachable!("only Central's Day writes are prepared writes"),
                    };
                    records.push(Record::Event(Box::new(KernelEvent::DayChanged {
                        owner: CENTRAL.into(),
                        action: action.into(),
                        project: project.clone(),
                        reference: answer_ref(&data, &["day_ref"])
                            .or(requested.map(str::to_owned))
                            .unwrap_or_else(|| register(project.as_deref())),
                        revision: owner_revision(&data),
                    })));
                    records.push(Record::RetireTemporal);
                }
                KernelOpResult::CentralReading { data }
            }
            KernelOp::FactoryOwner { request } => {
                let world = if request.needs_world() {
                    Some(self.world.read()?)
                } else {
                    None
                };
                let data = factory::owner(request.clone(), world.as_ref()).map_err(|e| {
                    serde_json::to_string(&e)
                        .unwrap_or_else(|_| "factory owner request failed".into())
                })?;
                if moved(&data) {
                    records.push(Record::Event(Box::new(KernelEvent::FactoryRunChanged {
                        owner: FACTORY.into(),
                        action: factory_action(request).into(),
                        reference: factory_ref(request, &data),
                        revision: owner_revision(&data),
                    })));
                    records.push(Record::RetireTemporal);
                }
                KernelOpResult::FactoryDevelopmentReading { data }
            }
            op @ (KernelOp::CredentialSetup { .. }
            | KernelOp::CredentialRotate { .. }
            | KernelOp::CredentialVerify { .. }
            | KernelOp::CredentialRevoke { .. }
            | KernelOp::ClientInstall { .. }) => {
                credentials::apply(&self.root_or_cwd()?, op.clone())?
            }
            KernelOp::ProductActionRun {
                product_id,
                action_ref,
            } => KernelOpResult::ProductActionRan {
                data: crate::system_composition::Client::discover().run_action(
                    &self.root_or_cwd()?,
                    product_id,
                    action_ref,
                )?,
            },
            KernelOp::InvokeAction {
                project,
                invocation,
            } => {
                // Central discloses the scope, exactly as the Knowledge/Graph
                // reads: renderer-supplied paths never become invocation context.
                let world = self.world.read()?;
                let cwd = crate::agent_prepared::location(&world, project.as_deref())?;
                // The person's own presses carry the person's native authority (T-COVERAGE §1.1: closing a NOW, the Day's
                // settings and moves, accepting a returned source, making and keeping an agent — action.rs PERSON_ACTS);
                // every other invocation goes without it. Which acts those are is action.rs's (its test holds the list).
                let client = if action::person_act(&invocation.action) {
                    self.client.for_person()
                } else {
                    self.client.clone()
                };
                let dispatch = action::invoke(&client, &cwd, project.as_deref(), invocation);
                // Whatever the owner answered, the derived readings retire —
                // unless the action only read.
                if !action::reads_only(&self.client, invocation) {
                    records.push(Record::RetireDerived);
                }
                if let action::ActionDispatch::Invoked { data, .. } = &dispatch {
                    if let Some(path) = construction_save(invocation, data) {
                        records.push(Record::RetireListing(files::parent_path(&path)));
                        records.push(Record::Event(Box::new(KernelEvent::FileChanged {
                            summary: if invocation.action == crate::construction::APPLY_FACTS {
                                // A body set (T-WORLDS W3) is the world's body, not a fact of a node.
                                let body = invocation.input.as_ref().is_some_and(|input| {
                                    input["request"]["changes"]
                                        .as_array()
                                        .is_some_and(|changes| {
                                            changes
                                                .iter()
                                                .any(|change| change["change"] == "body_set")
                                        })
                                });
                                if body {
                                    "The native Wiki owner saved your world's body.".into()
                                } else {
                                    "The native Wiki owner saved time and place facts.".into()
                                }
                            } else {
                                "The native Wiki owner saved a constructive whole.".into()
                            },
                            path,
                        })));
                    }
                    if let Some(event) = central_family_receipt(project, invocation, data) {
                        records.push(Record::Event(Box::new(event)));
                        records.push(Record::RetireTemporal);
                    }
                }
                KernelOpResult::ActionDispatched { dispatch }
            }
            KernelOp::InstanceCommission {
                location,
                expected_revision,
                content,
                agent_session_ref,
            } => {
                let outcome = crate::commission::commission(
                    &self.client,
                    location,
                    expected_revision,
                    content,
                    agent_session_ref.as_deref(),
                )
                .map_err(|e| e.to_string())?;
                // The commission landed as a file write: the parent listing
                // it invalidates by name, and the derived readings.
                records.push(Record::RetireListing(files::parent_path(&location.path)));
                records.push(Record::RetireDerived);
                KernelOpResult::InstanceCommissioned { outcome }
            }
            KernelOp::EncounterProvision {
                project,
                preferred_body_ref,
            } => {
                // The same disclosure gate as every project-scoped op: the
                // project must be inside Central's disclosed ground, and the
                // canonical ProjectRef is Central's own, never the caller's.
                let (cwd, project_ref) =
                    owner_read::project_ground(&self.client, &self.world.read()?, project)?;
                KernelOpResult::EncounterProvisioned {
                    data: self.agency.provision(
                        &cwd,
                        &project_ref,
                        preferred_body_ref.as_deref(),
                    )?,
                }
            }
            KernelOp::FlowParticipantProvision {
                project,
                agent_ref,
                flow_ref,
                sender,
                preferred_body_ref,
            } => {
                let (cwd, project_ref) =
                    owner_read::project_ground(&self.client, &self.world.read()?, project)?;
                KernelOpResult::EncounterProvisioned {
                    data: self.agency.provision_flow_participant(
                        &cwd,
                        &project_ref,
                        agent_ref,
                        preferred_body_ref.as_deref(),
                        sender,
                        flow_ref,
                    )?,
                }
            }
            KernelOp::HarnessAgentControl { binding, control } => {
                KernelOpResult::HarnessAgentOutcome {
                    document: self
                        .agency
                        .gateway_agent(None, binding, control.as_cli_verb())?,
                    binding: binding.clone(),
                    control: control.clone(),
                }
            }
            KernelOp::FileOperation { location, request } => {
                let data = files::operate(&self.client, location, request)?;
                // A write changed what a directory contains: the parent
                // listing is the one cached reading it invalidates by name,
                // with the derived readings and the temporal field's answers.
                if matches!(
                    request,
                    files::Request::Write { .. } | files::Request::Restore { .. }
                ) {
                    records.push(Record::RetireListing(files::parent_path(&location.path)));
                    records.push(Record::RetireDerived);
                    records.push(Record::RetireTemporal);
                    // One state change, one event: a write or restore the
                    // owner actually recorded discloses FileChanged; an
                    // unchanged write mutated nothing and emits nothing.
                    let summary = match data["outcome"].as_str() {
                        Some("created") => Some("A file was created through the owner's write."),
                        Some("written") => Some("A file changed through the owner's write."),
                        _ => None,
                    };
                    if let Some(summary) = summary {
                        records.push(Record::Event(Box::new(KernelEvent::FileChanged {
                            path: location.path.clone(),
                            summary: summary.into(),
                        })));
                    }
                }
                KernelOpResult::FileOperation { data }
            }
            // One field of a page written on the revision read (page.rs):
            // the file owner's write, retiring and disclosing as a file
            // write does; an unchanged write emits nothing.
            KernelOp::Page {
                request:
                    crate::page::Request::MutateField {
                        location,
                        expected_revision,
                        field,
                        value,
                    },
            } => {
                let data = crate::page::mutate_field(
                    &self.client,
                    location,
                    expected_revision,
                    field,
                    value,
                )?;
                records.push(Record::RetireListing(files::parent_path(&location.path)));
                records.push(Record::RetireDerived);
                records.push(Record::RetireTemporal);
                if matches!(data["outcome"].as_str(), Some("created" | "written")) {
                    records.push(Record::Event(Box::new(KernelEvent::FileChanged {
                        path: location.path.clone(),
                        summary: format!(
                            "A page's {field} changed through the page owner's write."
                        ),
                    })));
                }
                KernelOpResult::PageReading { data }
            }
            // A page played or stopped (page.rs): its NOW clearing allocated or
            // closed, the lifecycle act carrying the person's native authority
            // (the person pressed Launch or Stop). One NOW change, one event.
            KernelOp::Page {
                request: crate::page::Request::Launch { location },
            } => {
                let data = crate::page::launch(&self.client, &self.client.for_person(), location)?;
                records.push(Record::RetireTemporal);
                records.push(Record::RetireDerived);
                records.push(Record::Event(Box::new(KernelEvent::NowChanged {
                    owner: CENTRAL.into(),
                    action: "central.now.allocate".into(),
                    reference: data["now_ref"].as_str().unwrap_or_default().to_owned(),
                    project: data["allocated"]["project"].as_str().map(str::to_owned),
                    revision: owner_revision(&data["allocated"]),
                })));
                KernelOpResult::PageReading { data }
            }
            KernelOp::Page {
                request: crate::page::Request::Stop { now_ref, project },
            } => {
                let data = crate::page::stop(
                    &self.client,
                    &self.client.for_person(),
                    now_ref,
                    project.as_deref(),
                )?;
                records.push(Record::RetireTemporal);
                records.push(Record::RetireDerived);
                if data["outcome"] == "closed" {
                    records.push(Record::Event(Box::new(KernelEvent::NowChanged {
                        owner: CENTRAL.into(),
                        action: "central.now.lifecycle".into(),
                        reference: now_ref.clone(),
                        project: project.clone(),
                        revision: owner_revision(&data["receipt"]),
                    })));
                }
                KernelOpResult::PageReading { data }
            }
            // A journey opened or acted on (nara_journey.rs): QL's state saved into its Flow page through the page owner's
            // CAS, retiring and disclosing as a page write does; a replay QL reconciled writes nothing and emits nothing.
            KernelOp::NaraJourney { request } => {
                let data = crate::nara_journey::execute(&self.client, request)?;
                let location = request.location();
                records.push(Record::RetireListing(files::parent_path(&location.path)));
                records.push(Record::RetireDerived);
                records.push(Record::RetireTemporal);
                if matches!(
                    data["page"]["outcome"].as_str(),
                    Some("created" | "written")
                ) {
                    records.push(Record::Event(Box::new(KernelEvent::FileChanged {
                        path: location.path.clone(),
                        summary: format!(
                            "A journey's {} was kept in its page.",
                            data["operation"].as_str().unwrap_or("act")
                        ),
                    })));
                }
                KernelOpResult::NaraJourney { data }
            }
            KernelOp::Routine { project, request } => {
                let cwd = crate::agent_prepared::location(&self.world.read()?, project.as_deref())?;
                let data = crate::routine::call(&cwd, request)?;
                // A routine's run or disable is an actual native action
                // response, preserved verbatim (events.rs).
                if let Some(action) = request.mutation() {
                    // The Routine AIKit answered for (`routine::call` checked
                    // it against the one asked, where one was named).
                    let routine_ref = data["routine"].as_str().unwrap_or_default().to_owned();
                    records.push(Record::Event(Box::new(
                        KernelEvent::RoutineActionReturned {
                            action: action.into(),
                            routine_ref,
                            data: data.clone(),
                        },
                    )));
                    records.push(Record::RetireTemporal);
                }
                KernelOpResult::Routine { data }
            }
            // Lane W3: the owner routes that write (owner_routes.rs). Each
            // moves the read model (`execute`); its receipt is recorded only
            // where the owner's answer says something moved.
            KernelOp::GatewayWrite { request } => {
                let (cwd, project_world) =
                    owner_read::route_ground(&self.client, &self.world, request.project())?;
                route_written(
                    records,
                    crate::owner_routes::gateway_write(
                        request,
                        crate::owner_routes::Ground {
                            cwd: cwd.as_deref(),
                            project_world: project_world.as_deref(),
                        },
                    )?,
                )
            }
            KernelOp::GatewayTeam { request } => {
                let (cwd, _) = owner_read::route_ground(
                    &self.client,
                    &self.world,
                    request.project.as_deref(),
                )?;
                route_written(
                    records,
                    crate::owner_routes::gateway_team_write(request, cwd.as_deref())?,
                )
            }
            KernelOp::WorkcellWrite { request } => {
                route_written(records, crate::owner_routes::workcell_write(request)?)
            }
            KernelOp::SeatWrite { request } => {
                route_written(records, crate::owner_routes::seat_write(request)?)
            }
            KernelOp::ActuationWrite { request } => {
                route_written(records, crate::owner_routes::actuation_write(request)?)
            }
            KernelOp::AikitWrite { request } => {
                let (cwd, _) =
                    owner_read::route_ground(&self.client, &self.world, request.project())?;
                route_written(
                    records,
                    crate::owner_routes::aikit_write(request, cwd.as_deref())?,
                )
            }
            op => return configuration_write(&self.root_or_cwd()?, op, records),
        })
    }
}

/// An owner route's write (lane W3): its receipt when the owner said
/// something moved, and the temporal field's retained answers retired with
/// it; its reading as the op's result.
fn route_written(
    records: &mut Vec<Record>,
    written: crate::owner_routes::Written,
) -> KernelOpResult {
    if let Some(moved) = written.moved {
        records.push(Record::Event(Box::new(KernelEvent::OwnerChanged {
            owner: moved.owner.into(),
            action: moved.action,
            reference: moved.reference,
            revision: moved.revision,
        })));
        records.push(Record::RetireTemporal);
    }
    written.reading.into()
}

/// The configuration plane's writes, each through the engine's own verb with
/// the World's root as its directory; the ordered arms' receipts, unchanged.
fn configuration_write(
    cwd: &std::path::Path,
    op: &KernelOp,
    records: &mut Vec<Record>,
) -> Result<KernelOpResult, String> {
    let engine = configuration::Client::discover();
    let mut changed = |operation: &str, references: Vec<String>| {
        records.push(Record::Event(Box::new(KernelEvent::ConfigurationChanged {
            operation: operation.into(),
            references,
        })))
    };
    Ok(match op {
        KernelOp::ConfigDesiredHold { request } => {
            let entry = engine.desired_hold(cwd, request)?;
            changed("desired_hold", vec![request.setting_ref.clone()]);
            KernelOpResult::ConfigDesiredHeld { entry }
        }
        KernelOp::ConfigDesiredDiscard { setting_ref, scope } => {
            let document = engine.desired_discard(
                cwd,
                &configuration::ConfigPair {
                    setting_ref: setting_ref.clone(),
                    scope: scope.clone(),
                },
            )?;
            if document["removed"].as_bool() == Some(true) {
                changed("desired_discard", vec![setting_ref.clone()]);
            }
            KernelOpResult::ConfigDesiredDiscarded { document }
        }
        KernelOp::ConfigPlan { requests } => {
            let (plans, errors) = engine.plan(cwd, requests);
            KernelOpResult::ConfigPlanned { plans, errors }
        }
        KernelOp::ConfigPlanReviewed { requests } => {
            let (changeset, plans) = engine.plan_reviewed(cwd, requests)?;
            KernelOpResult::ConfigReviewedPlanned { changeset, plans }
        }
        KernelOp::ConfigReset { setting_ref, scope } => {
            let (changeset, owner_receipts) = engine.reset(cwd, setting_ref, scope)?;
            changed("reset_completed", vec![setting_ref.clone()]);
            KernelOpResult::ConfigApplied {
                changeset,
                owner_receipts,
            }
        }
        KernelOp::ConfigApplyReviewed { changeset, plans } => {
            let (changeset, owner_receipts) = engine.apply_reviewed(cwd, changeset, plans)?;
            changed(
                "reviewed_apply_completed",
                changeset["requested"]
                    .as_array()
                    .into_iter()
                    .flatten()
                    .filter_map(|request| request["setting_ref"].as_str().map(str::to_owned))
                    .collect(),
            );
            KernelOpResult::ConfigApplied {
                changeset,
                owner_receipts,
            }
        }
        KernelOp::ConfigApply { requests } => {
            let (changeset, owner_receipts) = engine.apply(cwd, requests)?;
            changed(
                "apply_completed",
                requests.iter().map(|r| r.setting_ref.clone()).collect(),
            );
            KernelOpResult::ConfigApplied {
                changeset,
                owner_receipts,
            }
        }
        KernelOp::ProfileUsePlan { profile_ref } => KernelOpResult::ProfileUsePlanning {
            plan: engine.profile_use_plan(cwd, profile_ref)?,
        },
        KernelOp::ProfileUseApply { profile_ref } => KernelOpResult::ProfileUsed {
            activation: engine.profile_use_apply(cwd, profile_ref)?,
        },
        KernelOp::ProfileCreate { profile_ref, title } => KernelOpResult::ProfileCreated {
            profile: engine.profile_create(cwd, profile_ref, title.as_deref())?,
        },
        KernelOp::ProfileEdit {
            profile_ref,
            operations,
        } => KernelOpResult::ProfileEdited {
            document: engine.profile_edit(cwd, profile_ref, operations)?,
        },
        _ => return Err("This operation is not a prepared owner write".into()),
    })
}

/// The receiving field's writes; its reads (list, read, document) are
/// prepared reads (owner_read.rs).
fn receiving_write(request: &ReceivingRequest) -> bool {
    !matches!(
        request,
        ReceivingRequest::List { .. }
            | ReceivingRequest::Read { .. }
            | ReceivingRequest::Document { .. }
    )
}

/// The receiving acts that are the person's own (Central refuses them from any
/// other author): an authored field or metadata edit, a review, an inclusion,
/// a recovery.
/// A submission is a producer's and never carries the person's authority.
fn receiving_person_act(request: &ReceivingRequest) -> bool {
    matches!(
        request,
        ReceivingRequest::MutateField { .. }
            | ReceivingRequest::MutateMeta { .. }
            | ReceivingRequest::Review { .. }
            | ReceivingRequest::Include { .. }
            | ReceivingRequest::Recover { .. }
    )
}

/// Central's Day writes; its other requests are prepared reads.
pub(crate) fn central_write(request: &central::Request) -> bool {
    matches!(
        request,
        central::Request::EnsureDay { .. }
            | central::Request::InitialiseDay { .. }
            | central::Request::CloseDay { .. }
    )
}

/// Central's own NOW, Day and receiving writes — the actions its registry
/// marks mutating (Central `continuous_work`, `projectcentral_now`) — named
/// one by one: an action not named here records no receipt, so a read (or a
/// write added later) is never reported as a change.
const NOW_WRITES: &[&str] = &[
    "central.now.allocate",
    "central.now.workcell-root",
    "central.now.lifecycle",
    "central.now.obligations",
    "central.now.thoughts.append",
    "central.now.learnings.distill",
    "projectcentral.now.init",
    "projectcentral.now.return",
    "projectcentral.now.update",
    "projectcentral.now.rollover",
    "projectcentral.now.promote",
];
const DAY_WRITES: &[&str] = &["central.day.ensure", "central.day.lifecycle"];
const RECEIVING_WRITES: &[&str] = &[
    "central.receiving.submit",
    "central.receiving.review",
    "central.receiving.include",
    "central.receiving.recover",
    "central.document.mutate",
];

/// The receipt an invoked Central action earns, when it is one of Central's
/// NOW, Day or receiving writes and the owner's answer says something moved.
/// A Day document created through `central.document.create` (kind `day`) is
/// a Day write.
fn central_family_receipt(
    project: &Option<String>,
    invocation: &action::ActionInvocation,
    data: &Value,
) -> Option<KernelEvent> {
    let name = invocation.action.as_str();
    let input = invocation.input.as_ref();
    let project = input
        .and_then(|input| input["project"].as_str())
        .map(str::to_owned)
        .or_else(|| project.clone());
    let requested = |keys: &[&str]| {
        keys.iter()
            .find_map(|key| input.and_then(|input| input[*key].as_str()))
            .map(str::to_owned)
    };
    if !moved(data) {
        return None;
    }
    let revision = owner_revision(data);
    let reference = |keys: &[&str]| {
        answer_ref(data, keys)
            .or_else(|| requested(keys))
            .unwrap_or_else(|| invocation.target_ref.clone())
    };
    if NOW_WRITES.contains(&name) {
        return Some(KernelEvent::NowChanged {
            owner: CENTRAL.into(),
            action: name.into(),
            reference: reference(&["now_ref"]),
            project,
            revision,
        });
    }
    let day_document = name == "central.document.create"
        && input.and_then(|input| input["kind"].as_str()) == Some("day");
    if DAY_WRITES.contains(&name) || day_document {
        return Some(KernelEvent::DayChanged {
            owner: CENTRAL.into(),
            action: name.into(),
            reference: reference(&["day_ref"]),
            project,
            revision,
        });
    }
    if RECEIVING_WRITES.contains(&name) {
        return Some(KernelEvent::ReceivingChanged {
            owner: CENTRAL.into(),
            action: name.into(),
            reference: reference(&["return_ref", "source_ref"]),
            project,
            revision,
        });
    }
    None
}

/// The path a construction save wrote, when the Wiki owner says it saved.
fn construction_save(invocation: &action::ActionInvocation, data: &Value) -> Option<String> {
    if !matches!(
        invocation.action.as_str(),
        crate::construction::APPLY | crate::construction::APPLY_FACTS
    ) || data["persisted"] != true
        || data["state"] != "saved"
    {
        return None;
    }
    data["native_file"]["location"]["path"]
        .as_str()
        .or_else(|| {
            invocation
                .input
                .as_ref()
                .and_then(|i| i["location"]["path"].as_str())
        })
        .map(str::to_owned)
}

/// The owner's answer says it changed nothing: an idempotent allocation or
/// append (`created: false`, and no Day advance), `changed`/`mutated` false,
/// or an identical request replayed as already applied.
fn moved(data: &Value) -> bool {
    let unchanged = (data["created"] == false && data["today_advanced"] != true)
        || data["changed"] == false
        || data["mutated"] == false
        || ["outcome", "status", "state", "result"].iter().any(|key| {
            matches!(
                data[*key].as_str(),
                Some("already-applied" | "already_applied" | "unchanged")
            )
        });
    !unchanged
}

/// The revision the owner gave for what it wrote, when it gave one.
fn owner_revision(data: &Value) -> Option<String> {
    data["revision"]
        .as_str()
        .or_else(|| data["revision"]["revision"].as_str())
        .filter(|revision| !revision.trim().is_empty())
        .map(str::to_owned)
}

/// The first ref the owner's answer names under one of `keys`.
fn answer_ref(data: &Value, keys: &[&str]) -> Option<String> {
    keys.iter()
        .find_map(|key| data[*key].as_str())
        .filter(|reference| !reference.trim().is_empty())
        .map(str::to_owned)
}

/// The register a write moved, when nothing narrower is named: the root
/// (`control:root`) or the Project by its name.
fn register(project: Option<&str>) -> String {
    match project {
        Some(project) => format!("project:{project}"),
        None => "control:root".into(),
    }
}

/// The ref a receiving act moved: the Return the owner (else the request)
/// names, the document a field edit changed, else the receiving register.
fn receiving_ref(request: &ReceivingRequest, data: &Value, project: Option<&str>) -> String {
    let requested = match request {
        ReceivingRequest::Review { return_ref, .. }
        | ReceivingRequest::Include { return_ref, .. }
        | ReceivingRequest::Recover { return_ref, .. } => Some(return_ref.clone()),
        ReceivingRequest::MutateField { source_ref, .. }
        | ReceivingRequest::MutateMeta { source_ref, .. } => Some(source_ref.clone()),
        _ => None,
    };
    answer_ref(data, &["return_ref"])
        .or(requested)
        .unwrap_or_else(|| register(project))
}

/// Factory's own verb for a write, as the owner names it.
fn factory_action(request: &factory::OwnerRequest) -> &'static str {
    match request {
        factory::OwnerRequest::ActionInvoke { .. } => "action invoke",
        factory::OwnerRequest::Recognise { .. } => "development mutate",
        factory::OwnerRequest::DevelopmentCommission { .. } => "development commission",
        factory::OwnerRequest::RunClose { .. } => "run close",
        factory::OwnerRequest::AttemptReceiving { .. } => "attempt receiving",
        factory::OwnerRequest::AttemptRetry { .. } => "attempt action retry",
        factory::OwnerRequest::AttemptDecisionSubmit { .. } => "attempt decision submit",
        factory::OwnerRequest::CustodyAssign { .. } => "development custody assign",
        factory::OwnerRequest::CustodyUpdate { .. } => "development custody update",
        factory::OwnerRequest::PadsWrite { .. } => "development pads-write",
        factory::OwnerRequest::PadsRun { .. } => "development pads-run",
        factory::OwnerRequest::PadsRecord { .. } => "development pads-record",
        _ => "factory",
    }
}

/// The Run a Factory write moved: the one the request names, else the one
/// the owner's receipt names, else the Journey, else the state it wrote.
fn factory_ref(request: &factory::OwnerRequest, data: &Value) -> String {
    use factory::OwnerRequest;
    match request {
        OwnerRequest::ActionInvoke { run_ref, .. }
        | OwnerRequest::RunClose { run_ref, .. }
        | OwnerRequest::AttemptReceiving { run_ref, .. }
        | OwnerRequest::AttemptRetry { run_ref, .. } => run_ref.clone(),
        OwnerRequest::Recognise {
            journey_ref,
            state_path,
            ..
        } => answer_ref(data, &["run_ref", "runRef"])
            .unwrap_or_else(|| non_empty_or(journey_ref, state_path)),
        OwnerRequest::DevelopmentCommission { state_path, .. } => {
            answer_ref(data, &["run_ref", "runRef", "journey_ref", "journeyRef"])
                .unwrap_or_else(|| state_path.display().to_string())
        }
        // A pad's bank or record moved: the run its answer names, else the
        // project's bank.
        OwnerRequest::PadsWrite { project_ref, .. } => format!("{project_ref}#pads"),
        OwnerRequest::PadsRun { .. } | OwnerRequest::PadsRecord { .. } => {
            answer_ref(data, &["run_ref"])
                .or_else(|| data["run"]["run_ref"].as_str().map(str::to_owned))
                .or_else(|| answer_ref(data, &["project_ref"]))
                .unwrap_or_else(|| FACTORY.into())
        }
        // A custody record moved: the custody the owner's receipt names.
        OwnerRequest::CustodyAssign { state_path, .. }
        | OwnerRequest::CustodyUpdate { state_path, .. } => data["custody"]["custody_ref"]
            .as_str()
            .filter(|reference| !reference.trim().is_empty())
            .map(str::to_owned)
            .unwrap_or_else(|| state_path.display().to_string()),
        _ => answer_ref(data, &["run_ref", "runRef"]).unwrap_or_else(|| FACTORY.into()),
    }
}

fn non_empty_or(reference: &str, state_path: &std::path::Path) -> String {
    if reference.trim().is_empty() {
        state_path.display().to_string()
    } else {
        reference.to_owned()
    }
}

impl Kernel {
    /// An owner write, prepared under the kernel lock: the World its scope
    /// comes from (held, else its burst's shared reading) and the owner
    /// clients. Every other op is not a prepared write.
    pub fn prepare_owner_write(&mut self, op: &KernelOp) -> Option<PreparedWrite> {
        if !PreparedWrite::claims(op) {
            return None;
        }
        let world = if PreparedWrite::needs_world(op) {
            self.prepare_world_reading()
        } else {
            PreparedWorld::held_only(self.client.clone(), None)
        };
        Some(PreparedWrite {
            client: self.client.clone(),
            agency: self.agency.clone(),
            world,
            op: op.clone(),
        })
    }

    /// Record what a prepared write's owner did, under the kernel lock. A
    /// refused write records nothing.
    pub fn finish_owner_write(&mut self, done: WriteAnswered) -> Result<KernelOpOutcome, String> {
        let result = done.result?;
        let mut receipts = Vec::new();
        for record in done.records {
            match record {
                Record::Event(event) => receipts.push(self.log.record(*event)),
                Record::RetireTemporal => {
                    crate::temporal_sources::retire_answers(&self.temporal_reads)
                }
                Record::RetireDerived => {
                    self.reads.invalidate_prefix("knowledge:");
                    self.reads.invalidate_prefix("graph:");
                    self.graph_reads.invalidate();
                }
                Record::RetireListing(parent) => self.reads.invalidate(&format!("dir:{parent}")),
            }
        }
        Ok(KernelOpOutcome {
            read_scopes: None,
            receipts,
            result,
        })
    }
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;
    use crate::dispatch::dispatch;
    use std::sync::{Arc, Mutex};
    use std::time::{Duration, Instant};

    /// The person's own receiving acts carry the person's authority; a
    /// producer's submission and every read never do.
    #[test]
    fn only_the_person_s_own_receiving_acts_carry_the_person_s_authority() {
        let request = |value: serde_json::Value| -> ReceivingRequest {
            serde_json::from_value(value).unwrap()
        };
        assert!(receiving_person_act(&request(
            serde_json::json!({"MutateField": {"source_ref": "s", "document_id": "d",
            "expected_revision": "r", "request_id": "q", "field_id": "original:meta", "value": {}}})
        )));
        assert!(receiving_person_act(&request(
            serde_json::json!({"Review": {"return_ref": "return:one",
            "expected_return_revision": "v", "disposition": "accepted"}})
        )));
        assert!(!receiving_person_act(&request(
            serde_json::json!({"Submit": {"producer_key": "p", "occurred_at_unix_seconds": 1}})
        )));
        assert!(!receiving_person_act(&request(
            serde_json::json!({"Document": {"source_ref": "s", "document_id": "d"}})
        )));
    }

    /// A Central stand-in for owner writes: logs each action as it starts,
    /// holds every write while its gate file exists, then answers the shape
    /// the action's owner gives (or its refusal).
    const FAKE_CENTRAL: &str = r#"#!/usr/bin/env python3
import json, os, sys, time
log, gate = sys.argv[1], sys.argv[2]
args = sys.argv[3:]
i = args.index("action")
action = args[i + 2]
with open(log, "a") as handle:
    handle.write(action + "\n")
def ok(data):
    print(json.dumps({"ok": True, "action": action, "data": data}))
if action == "central.world":
    ok({"schema": "central.world-map/v1", "root": "/tmp", "work": {"projects": []}})
    sys.exit(0)
if action == "action.list":
    # Central's catalogue (`ctrl --json action list`, 21 Oct 2026): two of its rows, as it classes them.
    ok({"actions": [{"id": "machine.account", "mutation_class": "read-only"},
                    {"id": "machine.apply", "mutation_class": "locally-mutating"}]})
    sys.exit(0)
while os.path.exists(gate):
    time.sleep(0.02)
if action == "central.receiving.submit":
    ok({"return_ref": "return:one", "revision": "rev-return-1"})
elif action == "central.receiving.review":
    print(json.dumps({"ok": False, "status": "conflict", "action": action,
                      "error": {"message": "The Return revision moved"}}))
    sys.exit(1)
elif action == "central.now.allocate":
    ok({"created": False, "now_ref": "central:now:held"})
elif action == "central.day.ensure":
    ok({"day_ref": "central:day:2026-10-16", "created": True, "today_advanced": True,
        "revision": {"revision": "rev-day-1"}})
elif action == "projectcentral.now.return":
    ok({"handoff": {"id": "h1"}, "source": "ProjectCentral/agents/now/x.json", "revision": "rev-now-1"})
elif action == "central.day.read":
    day = json.loads(args[i + 3])["day_ref"]
    ok({"day_ref": day, "temporal": {"day_ref": day, "lifecycle": "closed" if day.endswith("-closed") else "open"}})
elif action == "central.day.lifecycle":
    given = json.loads(args[i + 3])
    ok({"day_ref": given["day_ref"], "temporal": {"lifecycle": given["lifecycle"]},
        "revision": {"revision": "rev-day-" + given["lifecycle"] + "-" + given["expected_revision"] + "-" + given["expected_relations_revision"]}})
else:
    ok({})
"#;

    struct FakeCentral {
        executable: std::path::PathBuf,
        script: std::path::PathBuf,
        log: std::path::PathBuf,
        gate: std::path::PathBuf,
    }

    impl FakeCentral {
        fn new(test: &str) -> Self {
            use std::os::unix::fs::PermissionsExt;
            let stem = std::env::temp_dir()
                .join(format!("oi-cradle-{}-central-{test}", std::process::id()));
            let script = stem.with_extension("py");
            let executable = stem.with_extension("sh");
            let log = stem.with_extension("log");
            let gate = stem.with_extension("gate");
            std::fs::write(&script, FAKE_CENTRAL).unwrap();
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
            let _ = std::fs::remove_file(&log);
            let _ = std::fs::remove_file(&gate);
            Self {
                executable,
                script,
                log,
                gate,
            }
        }
        fn kernel(&self) -> Kernel {
            Kernel::new(CentralClient::with(
                self.executable.clone(),
                None,
                "test".into(),
            ))
        }
        fn calls(&self, action: &str) -> usize {
            std::fs::read_to_string(&self.log)
                .map(|text| text.lines().filter(|line| *line == action).count())
                .unwrap_or(0)
        }
        fn await_call(&self, action: &str) {
            let deadline = Instant::now() + Duration::from_secs(20);
            while self.calls(action) == 0 {
                assert!(Instant::now() < deadline, "{action} was never asked");
                std::thread::sleep(Duration::from_millis(10));
            }
        }
    }

    impl Drop for FakeCentral {
        fn drop(&mut self) {
            for path in [&self.executable, &self.script, &self.log, &self.gate] {
                let _ = std::fs::remove_file(path);
            }
        }
    }

    fn op(value: serde_json::Value) -> KernelOp {
        serde_json::from_value(value).unwrap()
    }

    /// The B0 finding: a receiving act held the kernel lock for its whole
    /// owner call (a 60 s stub held it 60.4 s). Now, while the owner holds
    /// the write, an ordered op is answered at once; the write's finish
    /// records the owner's receipt.
    #[test]
    fn a_receiving_act_holds_no_kernel_lock_while_central_answers() {
        let central = FakeCentral::new("receiving-unlocked");
        let kernel = Arc::new(Mutex::new(central.kernel()));
        std::fs::write(&central.gate, "").unwrap();
        let writing = {
            let kernel = Arc::clone(&kernel);
            std::thread::spawn(move || {
                dispatch(
                    &kernel,
                    op(serde_json::json!({"op": "receiving", "project": null,
                        "request": {"Submit": {"producer_key": "p", "occurred_at_unix_seconds": 1}}})),
                )
            })
        };
        central.await_call("central.receiving.submit");
        let asked = Instant::now();
        let (state, timing) = dispatch(&kernel, KernelOp::State);
        assert!(state.is_ok());
        assert!(
            asked.elapsed() < Duration::from_secs(1) && timing.lock_wait < Duration::from_secs(1),
            "an ordered op waited {:?} behind the receiving act",
            timing.lock_wait
        );
        std::fs::remove_file(&central.gate).unwrap();
        let (written, timing) = writing.join().unwrap();
        let written = written.unwrap();
        assert_eq!(timing.form, "owner-write");
        assert!(timing.lock_held < Duration::from_millis(500));
        let receipt = serde_json::to_value(&written.receipts).unwrap();
        assert_eq!(receipt[0]["event"], "receiving_changed");
        assert_eq!(receipt[0]["owner"], "central");
        assert_eq!(receipt[0]["action"], "central.receiving.submit");
        assert_eq!(receipt[0]["ref"], "return:one");
        assert_eq!(receipt[0]["revision"], "rev-return-1");
        assert!(receipt[0].get("project").is_none(), "the root register");
        // The receipt is on the log the shell replays.
        let replay = kernel.lock().unwrap().event_log().replay(None, 1, 16);
        assert_eq!(replay.receipts.len(), 1);
        assert_eq!(replay.receipts[0].envelope.event.tag(), "receiving_changed");
    }

    /// A NOW write through an owner Action: its receipt names the NOW, and
    /// the temporal field's retained answer is retired with every read in
    /// flight, so the reader the receipt tells reads the owner again.
    #[test]
    fn a_now_write_records_its_receipt_and_retires_the_temporal_answer() {
        let central = FakeCentral::new("now-write");
        let kernel = Mutex::new(central.kernel());
        let ticket = {
            let held = kernel.lock().unwrap();
            let mut cache = held.temporal_reads.lock().unwrap();
            cache.put(
                "temporal-events:{}".into(),
                serde_json::json!({"events": []}),
            );
            cache.begin("temporal-events:in-flight".into())
        };
        let (written, timing) = dispatch(
            &kernel,
            op(serde_json::json!({"op": "invoke_action",
                "invocation": {"action": "projectcentral.now.return", "target_ref": "row:1",
                               "input": {"project": "lived", "now_ref": "central:now:lived:1",
                                         "kind": "handoff"}}})),
        );
        let written = written.unwrap();
        assert_eq!(timing.form, "owner-write");
        assert!(matches!(
            written.result,
            KernelOpResult::ActionDispatched {
                dispatch: action::ActionDispatch::Invoked { .. }
            }
        ));
        let receipt = serde_json::to_value(&written.receipts).unwrap();
        assert_eq!(receipt.as_array().unwrap().len(), 1);
        // The receipt the shell's own test reads is this one, byte for byte
        // in meaning (packages/live-shell/ui/tests/owner-write-receipts.test.mjs).
        let fixture: serde_json::Value = serde_json::from_str(
            &std::fs::read_to_string(concat!(
                env!("CARGO_MANIFEST_DIR"),
                "/../../../packages/live-shell/ui/tests/fixtures/kernel-receipts/now-changed.json"
            ))
            .unwrap(),
        )
        .unwrap();
        assert_eq!(receipt[0], fixture);
        let held = kernel.lock().unwrap();
        let mut cache = held.temporal_reads.lock().unwrap();
        assert_eq!(
            cache.get("temporal-events:{}", Duration::from_secs(60)),
            None
        );
        assert!(
            !cache.finish("temporal-events:in-flight", ticket),
            "a temporal read begun before the write is never retained"
        );
    }

    /// A Day ensured through Central's route records the Day it moved, with
    /// the owner's revision.
    #[test]
    fn an_ensured_day_records_the_day_it_moved() {
        let central = FakeCentral::new("day-ensure");
        let kernel = Mutex::new(central.kernel());
        let (written, timing) = dispatch(
            &kernel,
            op(serde_json::json!({"op": "central", "project": null,
                "request": {"kind": "ensure-day", "expected_time_policy_revision": "tp-1"}})),
        );
        let written = written.unwrap();
        assert_eq!(timing.form, "owner-write");
        let receipt = serde_json::to_value(&written.receipts).unwrap();
        assert_eq!(receipt[0]["event"], "day_changed");
        assert_eq!(receipt[0]["action"], "central.day.ensure");
        assert_eq!(receipt[0]["ref"], "central:day:2026-10-16");
        assert_eq!(receipt[0]["revision"], "rev-day-1");
    }

    /// Close now closes the Day on both of its revisions and records the Day
    /// it moved; a Day already closed is refused before Central is asked to
    /// close it again.
    #[test]
    fn a_closed_day_records_the_day_and_a_second_close_is_refused() {
        let central = FakeCentral::new("day-close");
        let kernel = Mutex::new(central.kernel());
        let close = |day: &str| {
            op(serde_json::json!({"op": "central", "project": null,
                "request": {"kind": "close-day", "day_ref": day, "expected_revision": "rev-day-1",
                    "expected_relations_revision": "rel-1"}}))
        };
        let (written, timing) = dispatch(&kernel, close("central:day:2026-10-18"));
        let written = written.unwrap();
        assert_eq!(timing.form, "owner-write");
        let receipt = serde_json::to_value(&written.receipts).unwrap();
        assert_eq!(receipt[0]["event"], "day_changed");
        assert_eq!(receipt[0]["action"], "central.day.lifecycle");
        assert_eq!(receipt[0]["ref"], "central:day:2026-10-18");
        assert_eq!(receipt[0]["revision"], "rev-day-closed-rev-day-1-rel-1");
        let (refused, _) = dispatch(&kernel, close("central:day:2026-10-17-closed"));
        assert!(format!("{:?}", refused.unwrap_err()).contains("closed already"));
        let log = std::fs::read_to_string(&central.log).unwrap();
        assert_eq!(log.matches("central.day.lifecycle").count(), 1, "{log}");
    }

    /// A receipt reports what the owner did: an idempotent answer that says
    /// it created nothing, and a refusal, record nothing.
    #[test]
    fn an_unchanged_or_refused_write_records_nothing() {
        let central = FakeCentral::new("unchanged");
        let kernel = Mutex::new(central.kernel());
        let (allocated, _) = dispatch(
            &kernel,
            op(serde_json::json!({"op": "invoke_action",
                "invocation": {"action": "central.now.allocate", "target_ref": "task:1"}})),
        );
        assert!(allocated.unwrap().receipts.is_empty());
        let (reviewed, timing) = dispatch(
            &kernel,
            op(serde_json::json!({"op": "receiving", "project": null,
                "request": {"Review": {"return_ref": "return:one", "expected_return_revision": "v",
                                       "disposition": "accepted"}}})),
        );
        assert_eq!(timing.form, "owner-write");
        assert!(reviewed.unwrap_err().contains("The Return revision moved"));
        assert!(kernel.lock().unwrap().event_log().since(1).is_empty());
    }

    /// The ordered path (a host that applies in order) runs the same steps.
    #[test]
    fn the_ordered_arm_runs_the_prepared_write_steps() {
        let central = FakeCentral::new("ordered-arm");
        let mut kernel = central.kernel();
        let written = kernel
            .apply(op(serde_json::json!({"op": "receiving", "project": null,
                "request": {"Submit": {"producer_key": "p", "occurred_at_unix_seconds": 1}}})))
            .unwrap();
        assert_eq!(written.receipts.len(), 1);
        assert_eq!(
            written.receipts[0].envelope.event.tag(),
            "receiving_changed"
        );
    }

    /// A Central reading carried as an action (a device's Day moves, its git
    /// census, a world's effective sources) retires nothing: the derived
    /// readings it would throw away stay; a write through the same op still
    /// retires them.
    #[test]
    fn a_reading_carried_as_an_action_retires_nothing_and_a_write_still_does() {
        for action in [
            "central.day.settings.read",
            "central.day.moves.read",
            "central.git.census",
            "central.wiki.read",
            "control.search",
            "central.temporal.source-history",
            "central.world.effective-sources",
            "projectcentral.adopt.preview",
            "projectcentral.migrate.preview",
        ] {
            assert!(central_reading(action), "{action} only reads");
        }
        // A Contemplate Flow press without its preflight record is the
        // preflight, a reading; with the record it executes.
        let contemplate = |input: Option<serde_json::Value>| action::ActionInvocation {
            action: action::AIKIT_ACTION_CONTEMPLATE_FLOW.into(),
            target_ref: "flow:w3".into(),
            input,
        };
        let nobody = CentralClient::with("/nonexistent/ctrl".into(), None, "test".into());
        assert!(action::reads_only(&nobody, &contemplate(None)));
        assert!(action::reads_only(
            &nobody,
            &contemplate(Some(serde_json::json!({"horizon": {}})))
        ));
        assert!(action::reads_only(
            &nobody,
            &contemplate(Some(serde_json::json!({"execute": null})))
        ));
        assert!(!action::reads_only(
            &nobody,
            &contemplate(Some(serde_json::json!({"execute": {"preflight_ref": "p"}})))
        ));
        for action in [
            "central.world-relations.save",
            "central.day.settings.write",
            "projectcentral.now.return",
            "central.files.write",
            "projectcentral.adopt",
            "projectcentral.migrate",
        ] {
            assert!(!central_reading(action), "{action} may write");
        }
        let central = FakeCentral::new("reading-action");
        let kernel = Mutex::new(central.kernel());
        let probe = || {
            kernel
                .lock()
                .unwrap()
                .reads
                .get("knowledge:probe", Duration::from_secs(600))
        };
        kernel
            .lock()
            .unwrap()
            .reads
            .put("knowledge:probe".into(), serde_json::json!({"kept": true}));
        for action in ["central.day.moves.read", "central.temporal.source-history"] {
            let (read, timing) = dispatch(
                &kernel,
                op(serde_json::json!({"op": "invoke_action",
                    "invocation": {"action": action, "target_ref": format!("central:action:{action}"),
                                   "input": {}}})),
            );
            assert_eq!(timing.form, "owner-write");
            assert!(read.unwrap().receipts.is_empty());
            assert_eq!(
                probe(),
                Some(serde_json::json!({"kept": true})),
                "{action}: a reading retires nothing"
            );
        }
        let (written, _) = dispatch(
            &kernel,
            op(serde_json::json!({"op": "invoke_action",
                "invocation": {"action": "central.files.write", "target_ref": "row:1", "input": {}}})),
        );
        written.unwrap();
        assert_eq!(probe(), None, "a write retires the derived readings");
    }

    /// Central's own `mutation_class` decides (action.rs `CentralClient::reads`): `machine.account`, which no suffix of the
    /// kernel's names as a reading, keeps the derived readings; `machine.apply` still retires them. The catalogue is read
    /// once for the owner.
    #[test]
    fn centrals_own_mutation_class_decides_whether_an_action_retires_the_readings() {
        let central = FakeCentral::new("mutation-class");
        assert!(
            !crate::read_cache::central_reads("machine.account"),
            "no suffix of the kernel's names it: only Central's word classes it"
        );
        let kernel = Mutex::new(central.kernel());
        let probe = || {
            kernel
                .lock()
                .unwrap()
                .reads
                .get("knowledge:probe", Duration::from_secs(600))
        };
        kernel
            .lock()
            .unwrap()
            .reads
            .put("knowledge:probe".into(), serde_json::json!({"kept": true}));
        let invoke = |action: &str| {
            op(serde_json::json!({"op": "invoke_action",
                "invocation": {"action": action, "target_ref": format!("central:action:{action}"), "input": {}}}))
        };
        let (read, _) = dispatch(&kernel, invoke("machine.account"));
        read.unwrap();
        assert_eq!(
            probe(),
            Some(serde_json::json!({"kept": true})),
            "a read-only action keeps the readings"
        );
        let (written, _) = dispatch(&kernel, invoke("machine.apply"));
        written.unwrap();
        assert_eq!(probe(), None, "a mutating action retires them");
        assert_eq!(
            central.calls("action.list"),
            1,
            "the catalogue is read once"
        );
    }

    #[test]
    fn an_owner_answer_that_changed_nothing_is_not_a_move() {
        use serde_json::json;
        assert!(moved(&json!({})));
        assert!(moved(&json!({"created": true})));
        assert!(moved(&json!({"created": false, "today_advanced": true})));
        assert!(!moved(&json!({"created": false})));
        assert!(!moved(&json!({"changed": false})));
        assert!(!moved(&json!({"outcome": "already-applied"})));
        assert_eq!(
            owner_revision(&json!({"revision": {"revision": "r"}})).as_deref(),
            Some("r")
        );
        assert_eq!(owner_revision(&json!({"revision": ""})), None);
    }
}
