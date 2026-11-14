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
    action, agency, agent_prepared::PreparedWorld, configuration, credentials, events::KernelEvent,
    factory, files, owner_read, CentralClient, Kernel, KernelOp, KernelOpOutcome, KernelOpResult,
};
use serde_json::Value;
use std::path::PathBuf;

/// One owner write, prepared under the kernel lock.
pub struct PreparedWrite {
    client: CentralClient,
    agency: agency::Client,
    /// The agent reads' retained scopes: a conversation's place resolves as its reads resolve it (agent_prepared.rs `place_of`).
    reads: std::sync::Arc<std::sync::Mutex<crate::read_cache::OwnerReadCache>>,
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
        || matches!(
            op,
            KernelOp::GroundForm {
                request: crate::ground_form::Request::Preview
            } | KernelOp::GroundMusic {
                request: crate::ground_music::Request::Preview,
                ..
            } | KernelOp::GroundAuthority {
                request: crate::ground_authority::Request::Preview
            }
        )
}

impl PreparedWrite {
    /// Where a conversation this write provisions is held: the root World's root, or a named Project's place
    /// (agent_prepared.rs `place_of`, as the conversation's reads resolve it).
    fn place(&self, project: &str) -> Result<crate::agent_prepared::Place, String> {
        crate::agent_prepared::place_of(
            &self.client,
            &self.agency,
            &self.reads,
            &self.world.read()?,
            project,
        )
    }

    /// Whether `op` is an owner write with a prepared form.
    pub(crate) fn claims(op: &KernelOp) -> bool {
        match op {
            KernelOp::FactoryOwner { request, .. } => !request.is_read(),
            KernelOp::Page { request, .. } => request.is_write(),
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
            | KernelOp::AgentConversation { .. }
            | KernelOp::HarnessIngressRule { .. }
            | KernelOp::Routine { .. } => true,
            // Lane W3 (T-COVERAGE §1.2): the owner routes that write
            // (owner_routes.rs). A team `read` is a prepared read.
            KernelOp::GatewayTeam { request } => !request.is_read(),
            KernelOp::GatewayService { .. }
            | KernelOp::WorkcellWrite { .. }
            | KernelOp::ActuationWrite { .. }
            | KernelOp::AikitWrite { .. } => true,
            // Lane AK: a new world's Day form and the person's key, kept by
            // Central against the digest the person accepted (ground_form.rs,
            // ground_authority.rs); a preview changes nothing.
            // Round 47 item 1: the world's Music folder registered as a scope of Central's file map, on the map's revision.
            KernelOp::GroundForm { .. }
            | KernelOp::GroundMusic { .. }
            | KernelOp::GroundAuthority { .. } => true,
            _ => false,
        }
    }

    /// Whether the write is scoped by the World (it then shares its burst's
    /// one reading); the others need none and read none.
    fn needs_world(op: &KernelOp) -> bool {
        match op {
            // Factory's unit decisions name Central's root (lane W3).
            KernelOp::FactoryOwner { request, .. } => request.needs_world(),
            // Lane W3: an AIKit route runs from Central's disclosed ground;
            // Workcell and the seat instrument need none.
            KernelOp::GatewayTeam { request } => request.project.is_some(),
            KernelOp::AikitWrite { request } => request.project().is_some(),
            KernelOp::WorkcellWrite { .. }
            | KernelOp::GatewayService { .. }
            | KernelOp::ActuationWrite { .. }
            | KernelOp::GroundForm { .. }
            | KernelOp::GroundMusic { .. }
            | KernelOp::GroundAuthority { .. } => false,
            KernelOp::Central { .. }
            | KernelOp::HarnessIngressRule { .. }
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
            KernelOp::FactoryOwner { request, channel } => {
                // Factory's acts that present the person's authority (a Run's close, a Return received, a unit retried, stopped or
                // launched, a pad, a preset, a rack's macros, a hold, a plan, a task offered at a star: `OwnerRequest::person_act`)
                // run on the person's token by the shell window's channel alone, by flow.rs's rule (O-I #747 round 896 item 4): one
                // that came by a wire is refused in words, as Factory's refusals read (nothing ran), before Factory is asked or
                // anything is read. Every other Factory request takes no one's token.
                let person = match request.person_act() {
                    Some(act) => self
                        .client
                        .factory_person(&act, *channel)
                        .map_err(|words| {
                            serde_json::to_string(&crate::material::Error {
                                kind: "owner-refused-or-failed".into(),
                                message: words,
                                operation_may_have_run: false,
                            })
                            .unwrap_or_else(|_| "factory owner request refused".into())
                        })?,
                    None => None,
                };
                let world = if request.needs_world() {
                    Some(self.world.read()?)
                } else {
                    None
                };
                let data =
                    factory::owner(request.clone(), world.as_ref(), person).map_err(|e| {
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
                channel,
            } => {
                // The person's own presses carry the person's native authority (T-COVERAGE §1.1: closing a NOW, the Day's settings and
                // moves, accepting a returned source, making and keeping an agent — action.rs PERSON_ACTS, its test holding the list),
                // and only by the shell's human-press channel (O-I #747 round 895, DLW build ruling 2026-11-09, an addition to 0b.2): a
                // person act that came by a wire is refused in words before anything is read or asked, and every other Action goes on
                // no one's token. The rule is flow.rs's `CentralClient::for_act` (by what the invocation carries, `for_invocation`),
                // which expression.rs keeps too.
                let client = self.client.for_invocation(invocation, *channel)?;
                // A page saved or restored through Central is the desktop person's act, so the save names them when it names no
                // other actor, as every desktop save did (files.rs `operate`): attribution, not authority.
                let attributed = files::attributed(invocation);
                let invocation = attributed.as_ref().unwrap_or(invocation);
                // Central discloses the scope, exactly as the Knowledge/Graph
                // reads: renderer-supplied paths never become invocation context.
                let mut placed = None;
                let cwd = if action::registry_action(&invocation.action) && project.is_none() {
                    // Another owner's Action in the root register runs where the World is, else here: it needs nothing of Central's
                    // but the place, so a Central that cannot disclose its World does not stop a seat or a session.
                    self.root_or_cwd()?
                } else if let Some(name) = project
                    .as_deref()
                    .filter(|_| action::registry_action(&invocation.action))
                    .filter(|_| action::registry_takes(&invocation.action, "project_world"))
                    .filter(|_| {
                        invocation
                            .input
                            .as_ref()
                            .is_none_or(|input| input["project_world"].is_null())
                    })
                {
                    // An Action that takes a Project World (AIKit's send, `--project-world`) names the project's canonical one,
                    // as Central binds it, when the input names none: `project:<ProjectRef>` (owner_read.rs `project_ground`).
                    let (cwd, project_ref) =
                        owner_read::project_ground(&self.client, &self.world.read()?, name)?;
                    let mut input = invocation
                        .input
                        .clone()
                        .unwrap_or_else(|| Value::Object(Default::default()));
                    input["project_world"] = Value::String(format!("project:{project_ref}"));
                    placed = Some(action::ActionInvocation {
                        input: Some(input),
                        ..invocation.clone()
                    });
                    cwd
                } else {
                    let world = self.world.read()?;
                    crate::agent_prepared::location(&world, project.as_deref())?
                };
                let invocation = placed.as_ref().unwrap_or(invocation);
                let mut dispatch = action::invoke(&client, &cwd, project.as_deref(), invocation);
                // A save or restore Central answered for another file, or with an outcome it does not name, is refused here, once,
                // as the kernel's own `operate` refuses it: the window reads what it is given (files.rs `unsound_mutation`).
                if let action::ActionDispatch::Invoked {
                    owner_operation,
                    data,
                } = &dispatch
                {
                    if let Some(words) = files::unsound_mutation(invocation, data) {
                        dispatch = action::ActionDispatch::OwnerRefused {
                            owner_operation: owner_operation.clone(),
                            message: words.into(),
                        };
                    }
                }
                // Whatever the owner answered, the derived readings retire —
                // unless the action only read. The outcome says which, so the
                // window's held answers follow this word (kernel/bridge.ts).
                let reads_only = action::reads_only(&self.client, invocation);
                if !reads_only {
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
                    // A page written or restored: its directory's listing is the one cached reading it moves by name, with the
                    // temporal field's answers, and the change is disclosed once — an unchanged write mutated nothing and emits nothing.
                    if let Some((path, summary)) = files::mutation(invocation, data) {
                        records.push(Record::RetireListing(files::parent_path(&path)));
                        records.push(Record::RetireTemporal);
                        records.push(Record::Event(Box::new(KernelEvent::FileChanged {
                            path,
                            summary: summary.into(),
                        })));
                    }
                    if let Some(event) = central_family_receipt(project, invocation, data) {
                        records.push(Record::Event(Box::new(event)));
                        records.push(Record::RetireTemporal);
                    }
                    // Another owner's Action through the registry (action.rs `invoke_registry`) that it took as a write and that moved
                    // something: its receipt names the owner, the Action and what it moved, so every reader asks that owner again.
                    let answer = registry_answer(data);
                    if !reads_only
                        && action::registry_action(&invocation.action)
                        && moved(answer)
                        && answer["replayed"] != true
                    {
                        let owner = invocation.action.split('.').next().unwrap_or_default();
                        records.push(Record::Event(Box::new(KernelEvent::OwnerChanged {
                            owner: owner.to_owned(),
                            action: invocation.action.clone(),
                            reference: registry_subject(invocation, answer),
                            revision: owner_revision(answer),
                        })));
                        records.push(Record::RetireTemporal);
                    }
                }
                KernelOpResult::ActionDispatched {
                    dispatch,
                    reads_only,
                }
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
                agent,
                agent_ref,
                preferred_body_ref,
            } => {
                // The same disclosure gate as every project-scoped op: a named
                // project must be inside Central's disclosed ground, and the
                // canonical ProjectRef is the owners', never the caller's. The
                // root World (no project named) converses at its root (O-I #1003).
                let place = self.place(project)?;
                // The agent is the census's (census.rs `agent_for`, from the World Model's agents): the one named when a person
                // can talk to it, else the first such. A mode that needs one acting body names its body instead.
                let body = preferred_body_ref
                    .as_deref()
                    .map(str::trim)
                    .filter(|body| !body.is_empty());
                let agent = match body {
                    Some(_) => None,
                    None => Some(crate::census::agent_for(
                        crate::world_model::Model::global()
                            .value_now(crate::world_model::Slice::Agents)
                            .as_ref(),
                        agent.as_deref(),
                    )?),
                };
                KernelOpResult::EncounterProvisioned {
                    data: self.agency.provision(
                        &place.cwd,
                        &place.project_ref,
                        agent.as_deref(),
                        agent_ref
                            .as_deref()
                            .map(str::trim)
                            .filter(|r| !r.is_empty()),
                        body,
                    )?,
                }
            }
            KernelOp::AgentConversation {
                project,
                agent_ref,
                agent,
            } => {
                // The root World, or a named Project inside Central's ground: the same place every provision converses in.
                let place = self.place(project)?;
                // The harness is the census's (census.rs `agent_for`): the one named when you can talk to it, else the first such.
                let agent = crate::census::agent_for(
                    crate::world_model::Model::global()
                        .value_now(crate::world_model::Slice::Agents)
                        .as_ref(),
                    agent.as_deref(),
                )?;
                KernelOpResult::EncounterProvisioned {
                    data: self.agency.provision_agent_conversation(
                        &place.cwd,
                        &place.project_ref,
                        agent_ref,
                        &agent,
                    )?,
                }
            }
            KernelOp::GroundForm { request } => KernelOpResult::GroundFormReading {
                data: crate::ground_form::operate(&self.client, request)?,
            },
            KernelOp::GroundMusic { request, channel } => {
                let home = std::env::var_os("HOME")
                    .filter(|home| !home.is_empty())
                    .ok_or(
                    "The person's home is not named (HOME), so their Music folder cannot be found",
                )?;
                // A Keep registers the person's folder, which Central takes only on their grant (round 54's Central follow-up): its
                // register runs on their token by the shell window's press, and by a wire the Keep is refused in words before Central is
                // asked. Every read, a Preview's and the Keep's own, goes on no one's token (round 54b item 9).
                KernelOpResult::GroundMusicReading {
                    data: crate::ground_music::on_client(
                        &self.client,
                        std::path::Path::new(&home),
                        request,
                        *channel,
                    )?,
                }
            }
            KernelOp::GroundAuthority { request } => KernelOpResult::GroundAuthorityReading {
                data: crate::ground_authority::operate(&self.client, request)?,
            },
            KernelOp::HarnessIngressRule {
                binding,
                kind,
                decision,
            } => KernelOpResult::HarnessIngressOutcome {
                document: self
                    .agency
                    .gateway_ingress(binding, kind, decision.as_deref())?,
                binding: binding.clone(),
            },
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
                ..
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
                request: request @ crate::page::Request::Launch { location },
                channel,
            } => {
                let person = self.client.for_person_act(page_act(request), *channel)?;
                let data = crate::page::launch(&self.client.without_person(), &person, location)?;
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
                request: request @ crate::page::Request::Stop { now_ref, project },
                channel,
            } => {
                let person = self.client.for_person_act(page_act(request), *channel)?;
                let data = crate::page::stop(
                    &self.client.without_person(),
                    &person,
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
            // A page's copy (page.rs `duplicate`): made through its world's door, so
            // the world's listing retires and the copy is disclosed as a new file.
            KernelOp::Page {
                request: crate::page::Request::Duplicate { location, into },
                ..
            } => {
                let data = crate::page::duplicate(&self.client, location, into.as_ref())?;
                let made = data["location"]["path"]
                    .as_str()
                    .unwrap_or_default()
                    .to_owned();
                records.push(Record::RetireListing(files::parent_path(&made)));
                records.push(Record::RetireDerived);
                records.push(Record::RetireTemporal);
                records.push(Record::Event(Box::new(KernelEvent::FileChanged {
                    path: made,
                    summary: "A page was copied through the page owner.".into(),
                })));
                KernelOpResult::PageReading { data }
            }
            // A page leaving its world (page.rs `trash`): Central's trash on the
            // revision read, the person's act (the person pressed Delete).
            KernelOp::Page {
                request:
                    request @ crate::page::Request::Trash {
                        location,
                        expected_revision,
                    },
                channel,
            } => {
                let person = self.client.for_person_act(page_act(request), *channel)?;
                let data = crate::page::trash(
                    &self.client.without_person(),
                    &person,
                    location,
                    expected_revision,
                )?;
                records.push(Record::RetireListing(files::parent_path(&location.path)));
                records.push(Record::RetireDerived);
                records.push(Record::RetireTemporal);
                records.push(Record::Event(Box::new(KernelEvent::FileChanged {
                    path: location.path.clone(),
                    summary: "A page left its world for Central's trash.".into(),
                })));
                KernelOpResult::PageReading { data }
            }
            // A passage quoted at the end of another document (page.rs `append_quote`; O-I #820): the
            // document read now and written on that revision, retiring and disclosing as a page write does.
            KernelOp::Page {
                request: crate::page::Request::AppendQuote { location, quote },
                ..
            } => {
                let data = crate::page::append_quote(&self.client, location, quote)?;
                records.push(Record::RetireListing(files::parent_path(&location.path)));
                records.push(Record::RetireDerived);
                records.push(Record::RetireTemporal);
                if matches!(data["outcome"].as_str(), Some("created" | "written")) {
                    records.push(Record::Event(Box::new(KernelEvent::FileChanged {
                        path: location.path.clone(),
                        summary: "A passage was quoted at the end of the document.".into(),
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
            KernelOp::GatewayService { on } => {
                route_written(records, crate::owner_routes::gateway_service_write(*on)?)
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

/// A page's person act by name, for the words its refusal says (`page::person_act`); every page op that reaches one is one.
fn page_act(request: &crate::page::Request) -> &'static str {
    crate::page::person_act(request).unwrap_or("A page's act")
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

/// A registry owner's own answer: AIKit's inside its envelope (`{ok: true, data}`), every other owner's as it came.
fn registry_answer(data: &Value) -> &Value {
    if data["ok"] == true && data["data"].is_object() {
        &data["data"]
    } else {
        data
    }
}

/// The refs a registry Action's subject is named by, in the owners' own spelling: Factory's run, attempt and request, AIKit's
/// Communique, custody, delivery and session, Workcell's place.
const SUBJECT_KEYS: [&str; 10] = [
    "attempt_ref",
    "run_ref",
    "request_ref",
    "communique_ref",
    "custody_ref",
    "delivery_ref",
    "session_ref",
    "binding_ref",
    "place_ref",
    "return_ref",
];

/// What a registry Action moved: the ref its owner's answer names (at its top, in the Communique it kept, or the Run a commission's
/// receipt names, `commission.runRef`), else the one its input named, else the seat it joined or released
/// (`workcell:<workcell>/<product>`), else the Action itself.
fn registry_subject(invocation: &action::ActionInvocation, answer: &Value) -> String {
    let input = invocation.input.as_ref().unwrap_or(&Value::Null);
    answer_ref(answer, &SUBJECT_KEYS)
        .or_else(|| answer_ref(&answer["communique"], &["communique_ref"]))
        .or_else(|| answer_ref(&answer["commission"], &["runRef", "journeyRef"]))
        .or_else(|| answer_ref(input, &SUBJECT_KEYS))
        .or_else(|| {
            let seat = |value: &Value| {
                Some(format!(
                    "workcell:{}/{}",
                    value["workcell"].as_str()?,
                    value["product"].as_str()?
                ))
            };
            seat(answer).or_else(|| seat(input))
        })
        .unwrap_or_else(|| invocation.target_ref.clone())
}

/// The first ref the owner's answer names under one of `keys`.
fn answer_ref(data: &Value, keys: &[&str]) -> Option<String> {
    keys.iter()
        .find_map(|key| data[*key].as_str())
        .filter(|reference| !reference.trim().is_empty())
        .map(str::to_owned)
}

/// Factory's own verb for a write, as the owner names it.
fn factory_action(request: &factory::OwnerRequest) -> &'static str {
    match request {
        factory::OwnerRequest::ActionInvoke { .. } => "action invoke",
        factory::OwnerRequest::Recognise { .. } => "development mutate",
        factory::OwnerRequest::RunClose { .. } => "run close",
        factory::OwnerRequest::AttemptReceiving { .. } => "attempt receiving",
        factory::OwnerRequest::AttemptRetry { .. } => "attempt action retry",
        factory::OwnerRequest::AttemptRequestCancellation { .. } => {
            "attempt action request-cancellation"
        }
        factory::OwnerRequest::AttemptLaunch { .. } => "attempt launch",
        factory::OwnerRequest::AttemptDecisionSubmit { .. } => "attempt decision submit",
        factory::OwnerRequest::CustodyAssign { .. } => "development custody assign",
        factory::OwnerRequest::CustodyUpdate { .. } => "development custody update",
        factory::OwnerRequest::CustodyHold { .. } => "development custody hold",
        factory::OwnerRequest::PadsWrite { .. } => "development pads-write",
        factory::OwnerRequest::PadsPresetSave { .. } => "development pads-preset-save",
        factory::OwnerRequest::PadsPresetRecall { .. } => "development pads-preset-recall",
        factory::OwnerRequest::PadsRun { .. } => "development pads-run",
        factory::OwnerRequest::PadsRecord { .. } => "development pads-record",
        factory::OwnerRequest::RackMacrosWrite { .. } => "development rack-macros-write",
        factory::OwnerRequest::WaveAct { .. } => "development wave act",
        factory::OwnerRequest::TaskOfferAct { verb, .. } => factory::task_offer_verb(verb)
            .map(|(action, _, _)| action)
            .unwrap_or("factory"),
        factory::OwnerRequest::WorkflowEdit { .. } => "workflow edit",
        factory::OwnerRequest::WorkflowExport { .. } => "workflow export",
        factory::OwnerRequest::WorkflowRemake { .. } => "workflow remake",
        factory::OwnerRequest::WorkflowPerform { .. } => "workflow perform",
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
        | OwnerRequest::AttemptRetry { run_ref, .. }
        | OwnerRequest::AttemptRequestCancellation { run_ref, .. }
        | OwnerRequest::AttemptLaunch { run_ref, .. } => run_ref.clone(),
        OwnerRequest::Recognise {
            journey_ref,
            state_path,
            ..
        } => answer_ref(data, &["run_ref", "runRef"])
            .unwrap_or_else(|| non_empty_or(journey_ref, state_path)),
        // A pad's bank or record moved: the run its answer names, else the
        // project's bank.
        OwnerRequest::PadsWrite { project_ref, .. }
        | OwnerRequest::PadsPresetRecall { project_ref, .. } => format!("{project_ref}#pads"),
        // A preset moved: the presets stand beside every project's bank.
        OwnerRequest::PadsPresetSave { .. } => "factory#pads-presets".into(),
        OwnerRequest::PadsRun { .. } | OwnerRequest::PadsRecord { .. } => {
            answer_ref(data, &["run_ref"])
                .or_else(|| data["run"]["run_ref"].as_str().map(str::to_owned))
                .or_else(|| answer_ref(data, &["project_ref"]))
                .unwrap_or_else(|| FACTORY.into())
        }
        // A rack's macros moved: the rack of that project's session space.
        OwnerRequest::RackMacrosWrite {
            project_ref,
            space_ref,
            ..
        } => format!("{project_ref}#rack-macros:{space_ref}"),
        // An offer at a star moved: the offer the owner's answer names, else
        // the one the request names, else the state it wrote.
        OwnerRequest::TaskOfferAct {
            state_path,
            request,
            ..
        } => data["offer"]["offer_ref"]
            .as_str()
            .or_else(|| data["offer_ref"].as_str())
            .or_else(|| request["offer_ref"].as_str())
            .filter(|reference| !reference.trim().is_empty())
            .map(str::to_owned)
            .unwrap_or_else(|| state_path.display().to_string()),
        // A custody record moved: the custody the owner's receipt names.
        OwnerRequest::CustodyAssign { state_path, .. }
        | OwnerRequest::CustodyUpdate { state_path, .. }
        | OwnerRequest::CustodyHold { state_path, .. } => data["custody"]["custody_ref"]
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
        // An invocation the kernel refuses is never prepared as a write, whoever calls (0G item 2): the one check (action.rs
        // `op_refusal`) guards the one function that runs an owner write, as it guards `dispatch`, `apply` and the read path.
        if crate::action::op_refusal(op).is_some() || !PreparedWrite::claims(op) {
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
            reads: std::sync::Arc::clone(&self.agent_reads),
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

    /// 0D item 1, 0E item 1 and 0F (DLW build ruling 2026-11-09): a scope enters Central's file map only by Setup's Ground step, on
    /// the person's acceptance (GroundMusic, on the kernel's own client). Through `dispatch`, the path the hosts take (`kernel_op`,
    /// the walk bridge), a register by invocation is refused in words before any client runs, whatever its `kind`: a project's, an
    /// external one, a folder's in any spelling, an empty kind, one that is no string and none at all. So on the read path, the write
    /// path, `apply`, a hosted op, and an invocation that comes in no op (an Expression's disclosed Action). No token is handed to it.
    /// Another Central Action still reaches the client, so the stub is seen to run. 0G item 1: the stub answers Central's catalogue
    /// with the register classed a reading, and the read path still takes no register. Its own check is a second line: the read path
    /// takes no invocation at all (an invoked reading is a prepared write, owner_write.rs), a reading Central classes so included, so
    /// taking the check out cannot be seen here; a change that has the read path take one fails on that reading first. 0G item 2: the
    /// write path, `prepare_owner_write`, called directly, prepares no write of the register, while it prepares one of another
    /// Central Action.
    #[test]
    fn a_wire_never_registers_a_scope_and_no_client_runs_for_it() {
        use std::os::unix::fs::PermissionsExt;
        let home = std::env::temp_dir().join(format!("oi-wire-folder-{}", std::process::id()));
        std::fs::create_dir_all(&home).unwrap();
        // A ctrl that leaves a mark wherever it is run. It answers Central's catalogue with the register classed a reading (0G item 1),
        // so only the read path's own check keeps it from reading the register for its class; it refuses everything else.
        let ran = home.join("ran");
        let ctrl = home.join("ctrl");
        std::fs::write(
            &ctrl,
            format!(
                "#!/bin/sh\necho \"$@\" >> {}\ncase \"$*\" in *'action run action.list'*) echo '{}'; exit 0;; esac\nexit 1\n",
                ran.display(),
                serde_json::json!({"ok": true, "action": "action.list", "data": {"actions": [
                    {"id": "central.file-map.scope-register", "mutation_class": "read-only"},
                    {"id": "central.file-map.inspect", "mutation_class": "read-only"},
                    {"id": "central.file-map.refresh", "mutation_class": "locally-mutating"}]}})
            ),
        )
        .unwrap();
        std::fs::set_permissions(&ctrl, std::fs::Permissions::from_mode(0o755)).unwrap();
        crate::test_stub::settle_stub(&ctrl);
        let client = crate::flow::CentralClient::with(ctrl, None, "test".into());
        let kernel = Mutex::new(crate::Kernel::new(client.clone()));
        let words = "A scope is registered only by Setup's Ground step; this act is not taken over the wire.";
        let invocation = |kind: Option<serde_json::Value>| {
            let mut input = serde_json::json!({"project": null, "name": "Music", "path": home.join("Music").to_string_lossy(),
                "allow_external": true});
            if let Some(kind) = kind {
                input["kind"] = kind;
            }
            crate::action::ActionInvocation {
                action: "central.file-map.scope-register".into(),
                target_ref: "central:file-map".into(),
                input: Some(input),
            }
        };
        let invoke = |kind: Option<serde_json::Value>| crate::KernelOp::InvokeAction {
            project: None,
            invocation: invocation(kind),
            channel: crate::flow::Channel::Wire,
        };
        let kinds = [
            Some(serde_json::json!("project")),
            Some(serde_json::json!("external")),
            Some(serde_json::json!("folder")),
            Some(serde_json::json!("Folder")),
            Some(serde_json::json!(" folder")),
            Some(serde_json::json!("FOLDER\n")),
            Some(serde_json::json!("")),
            Some(serde_json::json!(7)),
            Some(serde_json::Value::Null),
            None,
        ];
        let no_client = |case: &str| {
            assert!(
                !ran.exists(),
                "{case}: no client ran: {:?}",
                std::fs::read_to_string(&ran)
            )
        };
        for kind in &kinds {
            let (answer, timing) = dispatch(&kernel, invoke(kind.clone()));
            assert_eq!(answer.map(|_| ()).unwrap_err(), words, "{kind:?}");
            assert_eq!(timing.form, "", "{kind:?}: no form served it");
            no_client(&format!("{kind:?}"));
        }
        // A hosted op carrying the register, for another World: applied in order, and refused the same.
        let hosted = crate::KernelOp::HostedNative {
            source_world_ref: "world:elsewhere".into(),
            request: Box::new(invoke(Some(serde_json::json!("project")))),
        };
        assert_eq!(dispatch(&kernel, hosted).0.map(|_| ()).unwrap_err(), words);
        // `apply` and the read path, called directly.
        {
            let mut held = kernel.lock().unwrap();
            assert!(
                held.prepare_owner_read(&invoke(Some(serde_json::json!("project"))))
                    .is_none(),
                "the read path takes no scope register"
            );
            // 0G item 1: nor any invocation, a reading Central's catalogue classes so included.
            let reading = crate::KernelOp::InvokeAction {
                project: None,
                invocation: crate::action::ActionInvocation {
                    action: "central.file-map.inspect".into(),
                    target_ref: "central:file-map".into(),
                    input: Some(serde_json::json!({"project": null})),
                },
                channel: crate::flow::Channel::Wire,
            };
            assert!(
                held.prepare_owner_read(&reading).is_none(),
                "the read path takes no invocation at all"
            );
            // 0G item 2: the one function that prepares an owner write, called directly, prepares no register.
            assert!(
                held.prepare_owner_write(&invoke(Some(serde_json::json!("project"))))
                    .is_none(),
                "the write path prepares no scope register"
            );
            assert_eq!(
                held.apply(invoke(Some(serde_json::json!("external"))))
                    .map(|_| ())
                    .unwrap_err(),
                words
            );
        }
        // An invocation that comes in no op (an Expression's disclosed Action, a trigger): `invoke` itself refuses it.
        match crate::action::invoke(
            &client,
            std::path::Path::new(""),
            None,
            &invocation(Some(serde_json::json!("project"))),
        ) {
            crate::action::ActionDispatch::UnsupportedAction { owner, detail } => {
                assert_eq!((owner.as_str(), detail.as_str()), ("central", words))
            }
            other => panic!("the invocation was not refused: {other:?}"),
        }
        no_client("apply, the read path, invoke");
        assert!(
            !crate::action::person_act("central.file-map.scope-register"),
            "the register carries no person's token"
        );
        // Another Central Action goes to Central as before (here a ctrl that refuses): the refusal is the register's alone.
        let refresh = crate::KernelOp::InvokeAction {
            project: None,
            invocation: crate::action::ActionInvocation {
                action: "central.file-map.refresh".into(),
                target_ref: "central:file-map".into(),
                input: Some(serde_json::json!({"project": null})),
            },
            channel: crate::flow::Channel::Wire,
        };
        assert!(
            kernel
                .lock()
                .unwrap()
                .prepare_owner_write(&refresh)
                .is_some(),
            "the write path prepares another Central Action"
        );
        let _ = dispatch(&kernel, refresh);
        assert!(ran.exists(), "another Action reaches the client");
        let _ = std::fs::remove_dir_all(&home);
    }

    /// 0G item 4 (DLW build ruling 2026-11-09, on #943's 0F review): a move of the ground (`central.file-map.move-plan`, `move-apply`,
    /// `move-rollback`) can bring a project-shaped folder into Work, where Central counts it a scope by its place. A trigger's press
    /// runs any Action a scene's body discloses (expression.rs `Request::Trigger`), so the moves are the person's presses (action.rs
    /// PERSON_ACTS), gated by the press as every person act is (flow.rs `for_act`). Through `dispatch`, a move that came by any wire
    /// is refused in words before Central is asked, so no token goes; the same move by the host's press command
    /// (`crate::person_press`) reaches Central once, on the person's token. Since round 54's Central follow-up so does each of the file
    /// map's acts that writes the person's ground or what they have adopted (`register`, `link`, `pool`, `adopt-db`, `record-adopt`),
    /// which Central admits on the person's grant alone. The scope register is refused before any client runs, by the press as by a wire.
    #[test]
    fn a_move_of_the_ground_is_the_person_s_press_and_by_a_wire_is_refused_in_words() {
        let central = FakeCentral::new("file-map-moves");
        let kernel = Mutex::new(Kernel::new(
            CentralClient::with(central.executable.clone(), None, "test".into())
                .with_person_token("person-token"),
        ));
        let invoke = |action: &str| {
            op(serde_json::json!({"op": "invoke_action",
                "invocation": {"action": action, "target_ref": "central:file-map", "input": {"project": null}}}))
        };
        let asked = |action: &str| -> Vec<String> {
            std::fs::read_to_string(central.log.with_extension("token"))
                .unwrap_or_default()
                .lines()
                .filter(|line| line.split(' ').next() == Some(action))
                .map(str::to_owned)
                .collect()
        };
        for action in [
            "central.file-map.move-plan",
            "central.file-map.move-apply",
            "central.file-map.move-rollback",
            "central.file-map.register",
            "central.file-map.link",
            "central.file-map.pool",
            "central.file-map.adopt-db",
            "central.file-map.record-adopt",
        ] {
            // Through `dispatch` first, so an act taken out of the person's presses turns this red at the gate it names (0G's review,
            // finding 4), and its place in the list is asserted after.
            let (refused, _) = dispatch(&kernel, invoke(action));
            let words = refused.expect_err("a move by a wire is refused");
            assert!(
                words.starts_with(action)
                    && words.contains("nothing was run and no token went with it"),
                "{action} is refused in words: {words}"
            );
            assert_eq!(central.calls(action), 0, "{action}: Central is not asked");
            dispatch(&kernel, crate::person_press(invoke(action)).unwrap())
                .0
                .unwrap();
            assert_eq!(
                asked(action),
                [format!("{action} person-token")],
                "{action}: the press runs it once, on the person's token"
            );
            assert!(action::person_act(action), "{action} is the person's press");
        }
        // A refresh writes Central's own index alone: it reaches Central as before, on no one's token, however it came.
        let refresh = "central.file-map.refresh";
        assert!(
            !action::person_act(refresh),
            "{refresh} carries no person's authority"
        );
        dispatch(&kernel, invoke(refresh)).0.unwrap();
        dispatch(&kernel, crate::person_press(invoke(refresh)).unwrap())
            .0
            .unwrap();
        assert_eq!(
            asked(refresh),
            [format!("{refresh} -"), format!("{refresh} -")],
            "{refresh} reaches Central as before, on no one's token"
        );
        let register = "central.file-map.scope-register";
        for sent in [
            invoke(register),
            crate::person_press(invoke(register)).unwrap(),
        ] {
            assert_eq!(
                dispatch(&kernel, sent).0.map(|_| ()).unwrap_err(),
                action::WIRE_SCOPE_REFUSAL
            );
        }
        assert_eq!(central.calls(register), 0, "the register reaches no client");
    }

    /// Round 54's Central follow-up (DLW build ruling 2026-11-09): Central registers a scope only on the person's grant, so Setup's Keep
    /// of the world's Music folder carries the person's token by the shell window's press (`crate::person_press`) and is refused in words
    /// by a wire before Central is asked. Its Preview is a read, on no one's token, however it came, and never comes by the press. Since
    /// round 54b item 9 the Keep's own reads go on no one's token too; that its register alone carries the person's is
    /// `setup_s_keep_registers_on_the_person_s_token_and_reads_on_no_one_s`, in a world whose Music folder stands.
    #[test]
    fn setup_s_keep_of_the_music_folder_runs_on_the_person_s_token_by_their_press_alone() {
        let central = FakeCentral::new("ground-music-keep");
        let kernel = Mutex::new(Kernel::new(
            CentralClient::with(central.executable.clone(), None, "test".into())
                .with_person_token("person-token"),
        ));
        let keep = || {
            op(
                serde_json::json!({"op": "ground_music", "request": {"operation": "keep",
                "acceptance_ref": "dlw-setup-ground-accept:1", "expected_digest": "d1"}}),
            )
        };
        let preview =
            || op(serde_json::json!({"op": "ground_music", "request": {"operation": "preview"}}));
        // The calls the Keep and the Preview make of Central (ground_music.rs: its disclosure of the register, the map's inspect, the
        // register), each with the token that went with it; the kernel's own reads around an op are not theirs.
        let log =
            || std::fs::read_to_string(central.log.with_extension("token")).unwrap_or_default();
        let tokens = || -> Vec<String> {
            log()
                .lines()
                .filter(|line| {
                    line.starts_with("action.describe ") || line.starts_with("central.file-map.")
                })
                .map(|line| line.rsplit(' ').next().unwrap_or_default().to_owned())
                .collect()
        };
        let words = dispatch(&kernel, keep()).0.map(|_| ()).unwrap_err();
        assert!(
            words.starts_with(crate::ground_music::KEEP_ACT)
                && words.contains("nothing was run and no token went with it"),
            "a Keep by a wire is refused in words: {words}"
        );
        assert!(tokens().is_empty(), "Central is not asked: {:?}", tokens());
        // By the press, the Keep's reads (the register's disclosure, the map's inspect) carry no token: only its register carries the
        // person's (round 54b item 9), and this stub's Central keeps no folder scope, so the Keep reads and registers nothing.
        let _ = dispatch(&kernel, crate::person_press(keep()).unwrap());
        let pressed = tokens();
        assert!(
            !pressed.is_empty() && pressed.iter().all(|token| token == "-"),
            "{pressed:?} in {}",
            log()
        );
        // A Preview reads on no one's token, and the press does not take it.
        let _ = dispatch(&kernel, preview());
        let read = tokens()[pressed.len()..].to_vec();
        assert!(
            !read.is_empty() && read.iter().all(|token| token == "-"),
            "{read:?} in {}",
            log()
        );
        assert!(crate::person_press(preview()).is_err());
    }

    /// Round 54b item 9 (DLW build ruling 2026-11-09): Setup's Keep reads on no one's token, as its Preview does, and only its register
    /// of the folder carries the person's, by their press. Through `ground_music::on_client`, which the kernel's `GroundMusic` runs, in a
    /// world of its own whose Music folder stands, on a stub Central that keeps folder scopes.
    #[test]
    fn setup_s_keep_registers_on_the_person_s_token_and_reads_on_no_one_s() {
        let central = FakeCentral::new("ground-music-register");
        let client = CentralClient::with(central.executable.clone(), None, "test".into())
            .with_person_token("person-token");
        let home = std::env::temp_dir().join(format!(
            "oi-cradle-{}-ground-music-register",
            std::process::id()
        ));
        let _ = std::fs::remove_dir_all(&home);
        std::fs::create_dir_all(home.join(crate::ground_music::NAME)).unwrap();
        let press = crate::flow::Channel::PersonPress;
        let preview = crate::ground_music::on_client(
            &client,
            &home,
            &crate::ground_music::Request::Preview,
            press,
        );
        let keep = preview
            .as_ref()
            .ok()
            .map(|read| crate::ground_music::Request::Keep {
                acceptance_ref: "dlw-setup-ground-accept:1".into(),
                expected_digest: read["digest"].as_str().unwrap_or_default().into(),
            });
        let kept = keep.map(|keep| crate::ground_music::on_client(&client, &home, &keep, press));
        let _ = std::fs::remove_dir_all(&home);
        let log = std::fs::read_to_string(central.log.with_extension("token")).unwrap_or_default();
        assert_eq!(preview.unwrap()["state"], "absent", "{log}");
        let kept = kept.unwrap().unwrap();
        assert_eq!(kept["kept"], true, "{kept}");
        let calls: Vec<&str> = log
            .lines()
            .filter(|line| {
                line.starts_with("action.describe ") || line.starts_with("central.file-map.")
            })
            .collect();
        assert_eq!(
            calls,
            [
                // The Preview: the register's disclosure and the map.
                "action.describe -",
                "central.file-map.inspect -",
                // The Keep: its own read of both, the register, and the read back.
                "action.describe -",
                "central.file-map.inspect -",
                "central.file-map.scope-register person-token",
                "action.describe -",
                "central.file-map.inspect -",
            ],
            "{log}"
        );
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
# Whose token came with each call: the person's, or none ("-").
with open(os.path.splitext(log)[0] + ".token", "a") as handle:
    handle.write(action + " " + os.environ.get("CENTRAL_NATIVE_TOKEN", "-") + "\n")
def ok(data):
    print(json.dumps({"ok": True, "action": action, "data": data}))
if action == "central.world":
    ok({"schema": "central.world-map/v1", "root": "/tmp", "work": {"projects": []}})
    sys.exit(0)
if action == "action.list":
    # Central's catalogue (`ctrl --json action list`, 21 Oct 2026; the reconciles' class, O-I #756; a world's collections,
    # ctrl/src/collections.rs): six of its rows, as it classes them.
    ok({"actions": [{"id": "machine.account", "mutation_class": "read-only"},
                    {"id": "machine.apply", "mutation_class": "locally-mutating"},
                    {"id": "projectcentral.source.read", "mutation_class": "derived-reconciling"},
                    {"id": "projectcentral.source.transfer.resolve", "mutation_class": "locally-mutating"},
                    {"id": "central.collections.read", "mutation_class": "read-only"},
                    {"id": "central.collections.show", "mutation_class": "locally-mutating"}]})
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
elif action == "action.describe" and json.loads(args[i + 3]).get("action") == "central.file-map.scope-register":
    # The register's disclosure by a Central that keeps folder scopes (ground_music.rs `keeps_folder_scopes`).
    ok({"inputs": [{"name": "kind", "choices": ["project", "folder"]}]})
elif action == "central.file-map.scope-register":
    with open(os.path.splitext(log)[0] + ".scope", "w") as handle:
        handle.write(json.loads(args[i + 3])["path"])
    ok({"world_ref": "folder:Music"})
elif action == "central.file-map.inspect":
    # The root map: no scope until a register was taken, then the folder it registered.
    scope = os.path.splitext(log)[0] + ".scope"
    if os.path.exists(scope):
        ok({"result": {"revision": "r2", "scopes": [{"path": open(scope).read(), "world_ref": "folder:Music"}]}})
    else:
        ok({"result": {"revision": "r1", "scopes": []}})
elif action == "central.day.lifecycle":
    given = json.loads(args[i + 3])
    if given["lifecycle"] == "closed" and given["day_ref"].endswith("-closed"):
        # Central refuses a Day closed already (temporal.rs change_lifecycle, EpiLogos/Central#360).
        print(json.dumps({"ok": False, "status": "conflict", "action": action,
                          "error": {"message": "The Day is closed already; a closed Day is not closed again"}}))
        sys.exit(1)
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
            let _ = std::fs::remove_file(log.with_extension("token"));
            let _ = std::fs::remove_file(log.with_extension("scope"));
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
            let _ = std::fs::remove_file(self.log.with_extension("token"));
            let _ = std::fs::remove_file(self.log.with_extension("scope"));
        }
    }

    fn op(value: serde_json::Value) -> KernelOp {
        serde_json::from_value(value).unwrap()
    }

    /// A registry Action's receipt names what it moved (O-I #1007 reads the subject into the Day): the Run a commission's receipt
    /// names, the Communique a send kept, an attempt the answer names, the seat a join took.
    #[test]
    fn a_registry_act_names_what_it_moved() {
        let invocation = |action: &str, input: serde_json::Value| action::ActionInvocation {
            action: action.into(),
            target_ref: action.into(),
            input: Some(input),
        };
        use serde_json::json;
        assert_eq!(
            registry_subject(
                &invocation(
                    "factory.development.commission",
                    json!({"state": "/s.json", "request": {}})
                ),
                &json!({"contract": "factory.commission-receipt/v1", "status": "applied",
                    "commission": {"projectRef": "project:demo", "journeyRef": "journey:3", "runRef": "run:7"}})
            ),
            "run:7"
        );
        assert_eq!(
            registry_subject(
                &invocation("aikit.gateway.send", json!({"to": "@anima", "body": "b"})),
                &json!({"communique": {"communique_ref": "communique:1"}})
            ),
            "communique:1"
        );
        assert_eq!(
            registry_subject(
                &invocation("factory.attempt.action", json!({})),
                &json!({"attempt_ref": "attempt:2"})
            ),
            "attempt:2"
        );
        assert_eq!(
            registry_subject(
                &invocation(
                    "workcell.seat.join",
                    json!({"workcell": "env-1", "product": "o-i"})
                ),
                &json!({})
            ),
            "workcell:env-1/o-i"
        );
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
                    op(
                        serde_json::json!({"op": "act", "action": "central.receiving.submit",
                        "input": {"producer_key": "p", "occurred_at_unix_seconds": 1}}),
                    ),
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
                dispatch: action::ActionDispatch::Invoked { .. },
                ..
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

    /// A Day ensured through Central's own Action (`act central.day.ensure`, O-I #1002) records the Day it moved, with the owner's
    /// revision.
    #[test]
    fn an_ensured_day_records_the_day_it_moved() {
        let central = FakeCentral::new("day-ensure");
        let kernel = Mutex::new(central.kernel());
        let (written, timing) = dispatch(
            &kernel,
            crate::person_press(op(
                serde_json::json!({"op": "act", "action": "central.day.ensure",
                "input": {"expected_time_policy_revision": "tp-1"}}),
            ))
            .unwrap(),
        );
        let written = written.unwrap();
        assert_eq!(timing.form, "owner-write");
        let receipt = serde_json::to_value(&written.receipts).unwrap();
        assert_eq!(receipt[0]["event"], "day_changed");
        assert_eq!(receipt[0]["action"], "central.day.ensure");
        assert_eq!(receipt[0]["ref"], "central:day:2026-10-16");
        assert_eq!(receipt[0]["revision"], "rev-day-1");
    }

    /// Close now closes the Day through Central's own Action (`act central.day.lifecycle`, O-I #1002) on both of its revisions and
    /// records the Day it moved; a Day already closed is Central's to refuse (EpiLogos/Central#360), and its refusal records nothing.
    #[test]
    fn a_closed_day_records_the_day_and_a_second_close_is_refused() {
        let central = FakeCentral::new("day-close");
        let kernel = Mutex::new(central.kernel());
        let close = |day: &str| {
            crate::person_press(op(
                serde_json::json!({"op": "act", "action": "central.day.lifecycle",
                "input": {"day_ref": day, "expected_revision": "rev-day-1",
                    "expected_relations_revision": "rel-1", "lifecycle": "closed"}}),
            ))
            .unwrap()
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
        let refused = refused.unwrap();
        assert!(
            refused.receipts.is_empty(),
            "a refused close records nothing"
        );
        assert!(
            matches!(&refused.result, KernelOpResult::ActionDispatched {
                dispatch: action::ActionDispatch::OwnerRefused { message, .. }, ..
            } if message.contains("closed already")),
            "Central refuses a Day closed already, in its words: {:?}",
            refused.result
        );
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
            crate::person_press(op(serde_json::json!({"op": "act", "action": "central.receiving.review",
                "input": {"return_ref": "return:one", "expected_return_revision": "v", "disposition": "accepted"}})))
            .unwrap(),
        );
        assert_eq!(timing.form, "owner-write");
        let reviewed = reviewed.unwrap();
        assert!(reviewed.receipts.is_empty());
        assert!(
            matches!(&reviewed.result, KernelOpResult::ActionDispatched {
                dispatch: action::ActionDispatch::OwnerRefused { message, .. }, ..
            } if message.contains("The Return revision moved")),
            "{:?}",
            reviewed.result
        );
        assert!(kernel.lock().unwrap().event_log().since(1).is_empty());
    }

    /// The ordered path (a host that applies in order) runs the same steps.
    #[test]
    fn the_ordered_arm_runs_the_prepared_write_steps() {
        let central = FakeCentral::new("ordered-arm");
        let mut kernel = central.kernel();
        let written = kernel
            .apply(op(
                serde_json::json!({"op": "act", "action": "central.receiving.submit",
                "input": {"producer_key": "p", "occurred_at_unix_seconds": 1}}),
            ))
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
    /// kernel's names as a reading, keeps the derived readings, and so does `projectcentral.source.read`, a reconcile of
    /// Central's derived state (`derived-reconciling`, O-I #756); `machine.apply` still retires them, and so does
    /// `projectcentral.source.transfer.resolve`, which the kernel's `.resolve` suffix would call a reading. The catalogue is
    /// read once for the owner.
    #[test]
    fn centrals_own_mutation_class_decides_whether_an_action_retires_the_readings() {
        let central = FakeCentral::new("mutation-class");
        assert!(
            !crate::read_cache::central_reads("machine.account"),
            "no suffix of the kernel's names it: only Central's word classes it"
        );
        assert!(
            crate::read_cache::central_reads("projectcentral.source.transfer.resolve"),
            "the suffix rule calls it a reading: only Central's word classes it a write"
        );
        let kernel = Mutex::new(central.kernel());
        let probe = || {
            kernel
                .lock()
                .unwrap()
                .reads
                .get("knowledge:probe", Duration::from_secs(600))
        };
        let keep = || {
            kernel
                .lock()
                .unwrap()
                .reads
                .put("knowledge:probe".into(), serde_json::json!({"kept": true}))
        };
        keep();
        let invoke = |action: &str| {
            op(serde_json::json!({"op": "invoke_action",
                "invocation": {"action": action, "target_ref": format!("central:action:{action}"), "input": {}}}))
        };
        for (action, class) in [
            ("machine.account", "a read-only action"),
            ("projectcentral.source.read", "a reconcile of derived state"),
        ] {
            let (read, _) = dispatch(&kernel, invoke(action));
            read.unwrap();
            assert_eq!(
                probe(),
                Some(serde_json::json!({"kept": true})),
                "{class} keeps the readings"
            );
        }
        for action in ["machine.apply", "projectcentral.source.transfer.resolve"] {
            keep();
            // machine.apply is the person's act: it runs by the press alone (0b.2).
            let op = if action::person_act(action) {
                crate::person_press(invoke(action)).unwrap()
            } else {
                invoke(action)
            };
            let (written, _) = dispatch(&kernel, op);
            written.unwrap();
            assert_eq!(probe(), None, "{action}, a mutating action, retires them");
        }
        assert_eq!(
            central.calls("action.list"),
            1,
            "the catalogue is read once"
        );
    }

    /// The dispatch outcome says what the kernel decided (`action::reads_only`), so the window keeps no classifier of its own
    /// (kernel/bridge.ts `writesOwner`, O-I #858): an Action Central's catalogue classes as a reading answers `reads_only: true`
    /// and retires nothing; a write says nothing and retires the readings — `central.collections.show` and
    /// `projectcentral.source.transfer.resolve` among them, though their names end in a reading word.
    #[test]
    fn the_dispatch_outcome_says_whether_the_kernel_took_the_action_as_a_reading() {
        let central = FakeCentral::new("reads-only-word");
        let kernel = Mutex::new(central.kernel());
        let yes = serde_json::Value::Bool(true);
        for (action, reads) in [
            ("central.collections.read", true),
            ("machine.account", true),
            ("projectcentral.source.read", true),
            ("central.collections.show", false),
            ("projectcentral.source.transfer.resolve", false),
            ("machine.apply", false),
        ] {
            kernel
                .lock()
                .unwrap()
                .reads
                .put("knowledge:probe".into(), serde_json::json!({"kept": true}));
            let request = op(serde_json::json!({"op": "invoke_action",
                "invocation": {"action": action, "target_ref": format!("central:action:{action}"), "input": {}}}));
            // A person act (machine.apply) runs by the press alone (0b.2).
            let request = if action::person_act(action) {
                crate::person_press(request).unwrap()
            } else {
                request
            };
            let (outcome, _) = dispatch(&kernel, request);
            let outcome = serde_json::to_value(outcome.unwrap()).unwrap();
            assert_eq!(outcome["result"], "action_dispatched", "{action}");
            assert_eq!(
                outcome.get("reads_only"),
                reads.then_some(&yes),
                "{action}: the outcome says what reads_only decided"
            );
            let kept = kernel
                .lock()
                .unwrap()
                .reads
                .get("knowledge:probe", Duration::from_secs(600))
                .is_some();
            assert_eq!(
                kept, reads,
                "{action}: the readings retire exactly when the outcome does not say it read"
            );
        }
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

    /// The person's token follows the shell's human-press channel for every person act (O-I #747 round 895, DLW build ruling
    /// 2026-11-09, an addition to 0b.2). An `invoke_action` of one that came by any wire (the shell's `kernel_op`, the frame's
    /// pass-through, the agents' socket, the walk bridge) is refused in words and its owner is never asked, so no token goes; the same
    /// act by the host's press command (`crate::person_press`) runs on the person's token. An Action that is not the person's goes on
    /// no one's token, however it came, though the client holds one.
    #[test]
    fn a_person_act_runs_on_the_person_s_token_only_by_the_press_and_any_other_way_is_refused_in_words(
    ) {
        let central = FakeCentral::new("person-act-channel");
        let kernel = Mutex::new(Kernel::new(
            CentralClient::with(central.executable.clone(), None, "test".into())
                .with_person_token("person-token"),
        ));
        let invoke = |action: &str| {
            op(serde_json::json!({"op": "invoke_action",
                "invocation": {"action": action, "target_ref": format!("central:action:{action}"), "input": {}}}))
        };
        let tokens =
            || std::fs::read_to_string(central.log.with_extension("token")).unwrap_or_default();
        for action in [
            "machine.apply",
            "central.day.move.record",
            "agent-profile.express",
        ] {
            assert!(action::person_act(action), "{action} is a person act");
            let (refused, _) = dispatch(&kernel, invoke(action));
            let words = refused.expect_err("a person act by a wire is refused");
            assert!(
                words.contains(action) && words.contains("nothing was run"),
                "{action} is refused in words: {words}"
            );
            assert_eq!(central.calls(action), 0, "{action}: its owner is not asked");
        }
        // No wire can name the press: a request that says it came by it is read as any wire's.
        let claimed = op(
            serde_json::json!({"op": "invoke_action", "channel": "person_press",
            "invocation": {"action": "machine.apply", "target_ref": "central:action:machine.apply", "input": {}}}),
        );
        assert!(
            dispatch(&kernel, claimed).0.is_err(),
            "a claimed press is a wire's"
        );
        assert_eq!(central.calls("machine.apply"), 0);
        assert!(
            !tokens().contains("person-token"),
            "no token went by a wire: {}",
            tokens()
        );
        let (pressed, _) = dispatch(
            &kernel,
            crate::person_press(invoke("machine.apply")).unwrap(),
        );
        pressed.unwrap();
        assert!(
            tokens()
                .lines()
                .any(|line| line == "machine.apply person-token"),
            "the press runs it on the person's token: {}",
            tokens()
        );
        for by_press in [false, true] {
            let read = if by_press {
                crate::person_press(invoke("machine.account")).unwrap()
            } else {
                invoke("machine.account")
            };
            dispatch(&kernel, read).0.unwrap();
        }
        let asked: Vec<String> = tokens()
            .lines()
            .filter(|line| line.starts_with("machine.account "))
            .map(str::to_owned)
            .collect();
        assert!(
            !asked.is_empty() && asked.iter().all(|line| line == "machine.account -"),
            "an Action that is not the person's goes on no one's token: {asked:?}"
        );
    }

    /// O-I #747 round 896, 0R-authority.1 (item 0.2; review 1 of C99's authority half): Receiving's acts on a document and a Day's
    /// ensure, make and close are the person's own, and C99 ran them on the person's token by op alone, reachable by any wire. Now
    /// each runs on the token by the shell window's channel alone (`crate::person_press`): sent by a wire (the ordinary `kernel_op`,
    /// the frame's pass-through, the agents' socket, the walk bridge), or claiming the channel in its JSON, it is refused in words
    /// before Central is asked, so no call carries the token. A producer's own submission and every read go as before, on none.
    #[test]
    fn receiving_s_and_the_day_s_person_acts_by_a_wire_are_refused_in_words_and_no_call_carries_the_token(
    ) {
        let central = FakeCentral::new("person-ops-channel");
        let kernel = Mutex::new(Kernel::new(
            CentralClient::with(central.executable.clone(), None, "test".into())
                .with_person_token("person-token"),
        ));
        let tokens =
            || std::fs::read_to_string(central.log.with_extension("token")).unwrap_or_default();
        // Each is Central's own Action by the one act path (O-I #1002); a channel the wire claims is never read.
        let field = serde_json::json!({"op": "act", "action": "central.document.mutate", "channel": "person_press",
            "input": {"source_ref": "s", "document_id": "d", "expected_revision": "r",
                "request_id": "q", "field_id": "original:meta", "value": {}}});
        let review = serde_json::json!({"op": "act", "action": "central.receiving.review",
            "input": {"return_ref": "return:one", "expected_return_revision": "v", "disposition": "accepted"}});
        let ensure = serde_json::json!({"op": "act", "action": "central.day.ensure", "channel": "person_press",
            "input": {"expected_time_policy_revision": "tp-1"}});
        let close = serde_json::json!({"op": "act", "action": "central.day.lifecycle",
            "input": {"day_ref": "central:day:2026-10-18", "expected_revision": "rev-day-1",
                "expected_relations_revision": "rel-1", "lifecycle": "closed"}});
        for (act, wire) in [
            ("central.document.mutate", field.clone()),
            ("central.receiving.review", review.clone()),
            ("central.day.ensure", ensure.clone()),
            ("central.day.lifecycle", close.clone()),
        ] {
            let (refused, _) = dispatch(&kernel, op(wire));
            let words = refused.expect_err("a person act by a wire is refused");
            assert!(
                words.starts_with(act)
                    && words.contains("nothing was run and no token went with it"),
                "{act} is refused in words: {words}"
            );
        }
        assert_eq!(
            tokens(),
            "",
            "Central was never asked, so no call carried the token"
        );
        // By the shell window's channel each runs on the person's token.
        for pressed in [field, ensure] {
            dispatch(&kernel, crate::person_press(op(pressed)).unwrap())
                .0
                .unwrap();
        }
        assert!(
            tokens()
                .lines()
                .any(|line| line == "central.document.mutate person-token")
                && tokens()
                    .lines()
                    .any(|line| line == "central.day.ensure person-token"),
            "{}",
            tokens()
        );
        // A producer's own submission takes no token, by either channel; a read is no press at all.
        let submit = serde_json::json!({"op": "act", "action": "central.receiving.submit",
            "input": {"producer_key": "p", "occurred_at_unix_seconds": 1}});
        dispatch(&kernel, op(submit.clone())).0.unwrap();
        dispatch(&kernel, crate::person_press(op(submit)).unwrap())
            .0
            .unwrap();
        assert!(
            tokens()
                .lines()
                .filter(|line| line.starts_with("central.receiving.submit "))
                .all(|line| line == "central.receiving.submit -"),
            "{}",
            tokens()
        );
        let list = serde_json::json!({"op": "receiving", "project": null, "request": {"List": {}}});
        assert!(
            crate::person_press(op(list)).is_err(),
            "a read never comes by the press channel"
        );
        let inspect =
            serde_json::json!({"op": "central", "project": null, "request": {"kind": "inspect"}});
        assert!(crate::person_press(op(inspect)).is_err());
    }
}
