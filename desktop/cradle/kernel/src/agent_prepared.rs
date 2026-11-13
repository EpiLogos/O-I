//! Agent-scoped owner reads prepared under the kernel lock and run outside it
//! (dispatch.rs): the agency reading the shell polls, encounter verbs, an
//! encounter's task, the Agent definition family, the model roster, a
//! harness binding's gateway sessions, the machine's harness status and
//! AIKit's model catalogue. Ported from the
//! knowledge read (knowledge_prepared.rs): preparation captures the World the
//! op is scoped by — the retained reading, else the one its burst shares —
//! and the owner processes run without the lock. What the ordered arms
//! recorded is recorded by `Kernel::finish_agent_read` under the lock, after
//! the owner answered: an encounter reading's session registration. The
//! ordered arms run these same steps under the lock.
//!
//! Retention (the agent reads cache, shared with the ordered path):
//! - AIKit's root Project binding (`agent-session-scope`) is kept per working
//!   directory for the life of its basis — the Central root the binding
//!   itself discloses (`put_at`: it serves only a request from that root)
//!   and the bound ground (a ground bind withdraws it). AIKit gives the
//!   binding no revision; it moves only with the root or the ground.
//! - The agency reading's SessionSpaces (`discover`) and harness disclosure,
//!   and the model roster, keep their 2 s horizons: AIKit gives none of them
//!   a revision it can be asked for without running the read itself, and an
//!   attached session must not be served late on a guessed horizon.
//!
//! Every retained reading is put under a ticket taken before its owner call
//! (read_cache `begin`/`finish`): a reading whose basis moved while it was
//! read (a ground bind, a newer read of the same key) is answered, never
//! retained.
use crate::{
    agency, agent_definition, focus, read_cache, refs, CentralClient, Kernel, KernelOp,
    KernelOpOutcome, KernelOpResult, SemanticRef,
};
use serde_json::Value;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

/// The World reading a prepared op is scoped by, captured under the kernel
/// lock: the retained one, else the one its burst shares (read_cache
/// `flight`) — never one World read per op of a burst.
pub(crate) struct PreparedWorld {
    client: CentralClient,
    held: Option<Value>,
    flight: Option<Arc<read_cache::Flight>>,
}

impl PreparedWorld {
    /// The reading held at preparation — the retained one, or one a burst
    /// already shares — and no flight: an op that finds none reads the World
    /// itself, as the ordered path read it.
    pub(crate) fn held_only(client: CentralClient, held: Option<Value>) -> Self {
        Self {
            client,
            held,
            flight: None,
        }
    }
    /// A reading was retained (or already shared) at preparation.
    pub(crate) fn is_held(&self) -> bool {
        self.held.is_some()
    }
    /// The reading held at preparation, never read for this.
    pub(crate) fn held(&self) -> Option<&Value> {
        self.held.as_ref()
    }
    pub(crate) fn read(&self) -> Result<Value, String> {
        match (&self.held, &self.flight) {
            (Some(world), _) => Ok(world.clone()),
            (None, Some(flight)) => flight.read(read_cache::WORLD_TTL, || {
                crate::world::read_world(&self.client)
            }),
            (None, None) => crate::world::read_world(&self.client),
        }
    }
}

impl Kernel {
    pub(crate) fn prepare_world_reading(&mut self) -> PreparedWorld {
        let mut held = self.reads.get("world", read_cache::WORLD_TTL);
        let flight = if held.is_none() {
            let flight = self.reads.flight("world", read_cache::WORLD_TTL);
            held = flight.held(read_cache::WORLD_TTL);
            held.is_none().then_some(flight)
        } else {
            None
        };
        PreparedWorld {
            client: self.client.clone(),
            held,
            flight,
        }
    }
}

/// Where a Nara op runs: the working directory its Project label names and
/// the canonical ProjectRef bound there (lane Z). Both are owners' answers —
/// Central's World, Central's project inspection or AIKit's root binding —
/// which the kernel lock never guarded; dispatch resolves them outside it
/// before the op's prepare captures the kernel's own state.
#[derive(Clone, Debug)]
pub(crate) struct Place {
    pub(crate) cwd: PathBuf,
    pub(crate) project_ref: String,
}

/// A Nara op's place, prepared under the kernel lock (the World reading it
/// is scoped by, as an agent read captures it) and resolved outside it.
pub(crate) struct PreparedPlace {
    client: CentralClient,
    aikit: agency::Client,
    reads: Arc<Mutex<read_cache::OwnerReadCache>>,
    world: PreparedWorld,
    project: String,
}

impl PreparedPlace {
    /// The owners' answers, outside the kernel lock.
    pub(crate) fn resolve(self) -> Result<Place, String> {
        place_of(
            &self.client,
            &self.aikit,
            &self.reads,
            &self.world.read()?,
            &self.project,
        )
    }
}

impl Kernel {
    pub(crate) fn prepare_place(&mut self, project: &str) -> PreparedPlace {
        PreparedPlace {
            client: self.client.clone(),
            aikit: self.agency.clone(),
            reads: Arc::clone(&self.agent_reads),
            world: self.prepare_world_reading(),
            project: project.to_owned(),
        }
    }

    /// The place a Nara prepare runs at: the one dispatch resolved outside
    /// the lock, else (an op applied in order) resolved here, under it.
    pub(crate) fn nara_place(
        &mut self,
        project: &str,
        resolved: Option<Place>,
    ) -> Result<Place, String> {
        if let Some(place) = resolved {
            return Ok(place);
        }
        let cwd = self.agent_location((!project.is_empty()).then_some(project))?;
        let project_ref = self.agent_project_ref(project, &cwd)?;
        Ok(Place { cwd, project_ref })
    }
}

/// Where a conversation is held (O-I #1003): the World's root for the root World (an empty Project label), else the
/// disclosed Project's location, with the ProjectRef bound there ([`project_ref`]). Provisioning a conversation and every
/// encounter read of it resolve the one place, so a conversation the root World opens is the one its reads find.
pub(crate) fn place_of(
    client: &CentralClient,
    aikit: &agency::Client,
    reads: &Mutex<read_cache::OwnerReadCache>,
    world: &Value,
    project: &str,
) -> Result<Place, String> {
    let cwd = location(world, (!project.is_empty()).then_some(project))?;
    let project_ref = project_ref(client, aikit, reads, project, &cwd)?;
    Ok(Place { cwd, project_ref })
}

/// The working directory an agent op runs in: the World's root for the root
/// register (`None`), else the disclosed Project's location. The empty
/// conversation Project label is the renderer's explicit ROOT selection.
pub(crate) fn location(world: &Value, project: Option<&str>) -> Result<PathBuf, String> {
    let base = Path::new(
        world["root"]
            .as_str()
            .ok_or("Central root location unavailable")?,
    );
    match project {
        None => Ok(base.to_path_buf()),
        Some(project) => {
            let row = world["work"]["projects"]
                .as_array()
                .and_then(|rows| rows.iter().find(|r| r["name"].as_str() == Some(project)))
                .ok_or("Project is outside Central's disclosed ground")?;
            Ok(base.join(row["path"].as_str().ok_or("Project location unavailable")?))
        }
    }
}

/// A reading retained in `reads` within `ttl`, else the owner's — retained
/// only if no ground change or newer read of the key moved it meanwhile.
fn retained(
    reads: &Mutex<read_cache::OwnerReadCache>,
    key: &str,
    ttl: std::time::Duration,
    cwd: &Path,
    read: impl FnOnce() -> Result<Value, String>,
) -> Result<Value, String> {
    let ticket = {
        let mut cache = reads.lock().unwrap_or_else(|e| e.into_inner());
        if let Some(value) = cache.get(key, ttl) {
            return Ok(value);
        }
        let scopes = cache.aikit_scopes(cwd);
        cache.begin_in(key.to_owned(), scopes)
    };
    let value = read()?;
    let mut cache = reads.lock().unwrap_or_else(|e| e.into_inner());
    if cache.finish(key, ticket) {
        cache.put(key.to_owned(), value.clone());
    }
    Ok(value)
}

/// The canonical ProjectRef an agent op is bound to: Central's own inspect
/// reading for a named Project; for the root, AIKit's native root binding,
/// kept per working directory for the life of its basis (module docs).
pub(crate) fn project_ref(
    client: &CentralClient,
    aikit: &agency::Client,
    reads: &Mutex<read_cache::OwnerReadCache>,
    project: &str,
    cwd: &Path,
) -> Result<String, String> {
    if !project.is_empty() {
        let inspection = client
            .run(
                "projectcentral.inspect",
                serde_json::json!({"project":project}),
            )
            .map_err(|e| e.to_string())?;
        return inspection["manifest"]["project_id"]
            .as_str()
            .map(str::to_owned)
            .ok_or("Central has not bound a canonical ProjectRef".into());
    }
    // The basis is the Central root the binding itself discloses: a
    // retained binding serves only a request from that same root.
    let key = format!("agent-scope:{}", cwd.display());
    let held = reads
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .get_at(&key, &cwd.display().to_string());
    let scope = match held {
        Some(scope) => scope,
        None => {
            let ticket = reads
                .lock()
                .unwrap_or_else(|e| e.into_inner())
                .begin(key.clone());
            let scope = aikit.direct_agent(cwd, "agent-session-scope", None)?;
            if scope["schema"] != "aikit.direct-agent-scope/v1"
                || scope["execution_authority_granted"] != false
            {
                return Err("AIKit did not disclose the native root Project binding".into());
            }
            let mut cache = reads.lock().unwrap_or_else(|e| e.into_inner());
            if cache.finish(&key, ticket) {
                if let Some(root) = scope["central_root"].as_str() {
                    cache.put_at(key, root.to_owned(), scope.clone());
                }
            }
            scope
        }
    };
    scope["project_ref"]
        .as_str()
        .filter(|s| !s.is_empty())
        .map(str::to_owned)
        .ok_or("No native root Project binding".into())
}

enum AgentRead {
    Agency,
    Encounter(agency::EncounterRequest),
    Task {
        agent_session: String,
    },
    Settings {
        agent_session: String,
        request: Option<Value>,
        expected_revision: Option<String>,
    },
    /// The owner's task creation (`encounter-task-configure`): a write, its
    /// request verbatim.
    TaskConfigure {
        agent_session: String,
        request: Value,
        expected_revision: Option<String>,
    },
    /// The owner's task removal (`encounter-task-remove`): a write.
    TaskRemove {
        agent_session: String,
        task_ref: String,
        expected_revision: String,
    },
    /// The owner's task Budget (`encounter-task-budget`): a write.
    TaskBudget {
        agent_session: String,
        task_ref: String,
        turns: Option<u64>,
        expected_revision: String,
        expected_budget_revision: Option<String>,
    },
    /// The owner's task copy onto a session holding none
    /// (`encounter-task-copy`): a write.
    TaskCopy {
        agent_session: String,
        from_session: String,
        task_ref: Option<String>,
    },
    /// A session taken off the set (SessionSpace `detach-agent-session`):
    /// a write.
    SessionDetach {
        agent_session: String,
    },
    /// The Agent rack's chain list (SessionSpace `bench-agent-session`,
    /// `attach-agent-session`, `session-space drag-out`): writes on the
    /// Project's spaces.
    SessionBench {
        space: String,
        agent_session: String,
        benched: bool,
    },
    SessionAttach {
        space: String,
        agent_session: String,
    },
    SessionDragOut {
        space: String,
        agent_session: String,
        into: String,
        label: Option<String>,
    },
    SessionGroup {
        space: String,
        agent_sessions: Vec<String>,
        into: String,
        label: Option<String>,
        agent_set: Option<String>,
        agent_set_revision: Option<String>,
    },
    SessionHotSwap {
        space: String,
        agent_session: String,
        agent_ref: String,
    },
    SessionDecisionHelper {
        space: String,
        bound: bool,
    },
    SettingsList {
        agent_sessions: Vec<String>,
    },
    AttemptsList {
        agent_sessions: Vec<String>,
    },
    Definition(agent_definition::Request),
    ModelRoster,
    /// The AIKit gateway's session list for one harness binding; it needs
    /// no World and no directory.
    Harness {
        binding: String,
    },
    /// The machine's harnesses (`HarnessStatus`) and AIKit's model
    /// catalogue: machine-level reads, no World, no directory.
    HarnessStatus,
    ModelCatalogue,
    /// The Decision helper's two machine-level readings (manual §19.20):
    /// AIKit's decision provider (`aikit decide status`) and QL's team space
    /// (`ql context-frame team-space`). Neither asks a model.
    DecisionStatus,
    TeamSpace,
}

/// One agent-scoped op prepared under the kernel lock
/// (`Kernel::prepare_agent_read`); `execute` runs its owner processes
/// outside it and records nothing.
pub struct PreparedAgent {
    client: CentralClient,
    aikit: agency::Client,
    reads: Arc<Mutex<read_cache::OwnerReadCache>>,
    world: PreparedWorld,
    /// The op's Project label; empty (or absent, for the Agent definition
    /// family) is the root register.
    project: Option<String>,
    read: AgentRead,
}

/// An agent op's owner answer awaiting its finish under the kernel lock.
pub struct AgentAnswered {
    result: Result<KernelOpOutcome, String>,
    /// An encounter reading's session, registered on finish as the ordered
    /// arm registered it.
    registration: Option<(String, focus::ProjectRef)>,
}

impl PreparedAgent {
    /// The owner calls, outside the kernel lock. Nothing is recorded here.
    pub fn execute(self) -> AgentAnswered {
        let mut registration = None;
        let result = self.run(&mut registration);
        AgentAnswered {
            result,
            registration,
        }
    }

    fn run(
        &self,
        registration: &mut Option<(String, focus::ProjectRef)>,
    ) -> Result<KernelOpOutcome, String> {
        if let AgentRead::Harness { binding } = &self.read {
            return Ok(KernelOpOutcome {
                read_scopes: None,
                receipts: Vec::new(),
                result: KernelOpResult::HarnessAgentReading {
                    document: self.aikit.gateway_agent(None, binding, "sessions")?,
                    binding: binding.clone(),
                },
            });
        }
        // Machine-level reads: no project disclosure is consulted — the
        // harnesses and the catalogue are the machine's own facts.
        match &self.read {
            AgentRead::HarnessStatus => {
                return Ok(KernelOpOutcome {
                    read_scopes: None,
                    receipts: Vec::new(),
                    result: KernelOpResult::HarnessStatusReading {
                        data: self.aikit.harness_status()?,
                    },
                })
            }
            AgentRead::ModelCatalogue => {
                return Ok(KernelOpOutcome {
                    read_scopes: None,
                    receipts: Vec::new(),
                    result: KernelOpResult::ModelCatalogueReading {
                        data: self.aikit.model_catalogue()?,
                    },
                })
            }
            AgentRead::DecisionStatus => {
                return Ok(KernelOpOutcome {
                    read_scopes: None,
                    receipts: Vec::new(),
                    result: KernelOpResult::DecisionStatusReading {
                        data: self.aikit.decision_status()?,
                    },
                })
            }
            AgentRead::TeamSpace => {
                return Ok(KernelOpOutcome {
                    read_scopes: None,
                    receipts: Vec::new(),
                    result: KernelOpResult::TeamSpaceReading {
                        data: crate::team_space::read()?,
                    },
                })
            }
            _ => {}
        }
        let world = self.world.read()?;
        let label = self.project.as_deref().filter(|p| !p.is_empty());
        let cwd = location(&world, label)?;
        let project = self.project.as_deref().unwrap_or("");
        let result = match &self.read {
            AgentRead::Agency => {
                // The harness disclosure needs only the directory: it is read
                // beside the binding and the spaces, not after them.
                let (project_ref, spaces, harness_disclosure) = std::thread::scope(|scope| {
                    let disclosure = scope.spawn(crate::read_cache::carried(|| {
                        retained(
                            &self.reads,
                            &format!("harness-disclosure:{}", cwd.display()),
                            read_cache::HORIZON_TTL,
                            &cwd,
                            || {
                                Ok(match self.aikit.harness_disclosure(&cwd) {
                                    Ok(value) => value,
                                    Err(reason) => {
                                        serde_json::json!({"state":"unavailable","reason":reason})
                                    }
                                })
                            },
                        )
                    }));
                    let read = || -> Result<(String, Value), String> {
                        let project_ref =
                            project_ref(&self.client, &self.aikit, &self.reads, project, &cwd)?;
                        // The spaces reading spawns the AIKit owner; the
                        // disclosure re-reads it on every branch expansion,
                        // so the short horizon serves the repeat.
                        let spaces = retained(
                            &self.reads,
                            &format!("agency:{}:{project_ref}", cwd.display()),
                            read_cache::HORIZON_TTL,
                            &cwd,
                            || self.aikit.read_project(&cwd, &project_ref),
                        )?;
                        Ok((project_ref, spaces))
                    };
                    let bound = read();
                    let disclosure = disclosure
                        .join()
                        .unwrap_or_else(|_| Err("AIKit harness disclosure read failed".into()));
                    bound.and_then(|(project_ref, spaces)| Ok((project_ref, spaces, disclosure?)))
                })?;
                // A fresh stamp is minted for every answer, retained or not.
                let observed_at_unix_ms = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .map(|d| d.as_millis() as u64)
                    .unwrap_or(0);
                KernelOpResult::AgencyReading {
                    project_ref,
                    spaces,
                    harness_disclosure,
                    observed_at_unix_ms,
                }
            }
            AgentRead::Encounter(request) => {
                let project_ref =
                    project_ref(&self.client, &self.aikit, &self.reads, project, &cwd)?;
                // Its context and providers are readings of the owner's
                // registry; the rest of its verbs are a live session's own
                // state (a transcript, a draft, a turn) or act on it.
                let data = match request {
                    agency::EncounterRequest::Context { .. }
                    | agency::EncounterRequest::Providers => read_cache::aikit_read(
                        &self.aikit.identity(),
                        &format!(
                            "encounter:{project_ref}:{}",
                            serde_json::to_string(request).map_err(|e| e.to_string())?
                        ),
                        &cwd,
                        || self.aikit.encounter(&cwd, &project_ref, request),
                    )?,
                    _ => self.aikit.encounter(&cwd, &project_ref, request)?,
                };
                if let agency::EncounterRequest::Read { agent_session, .. } = request {
                    if data["agent_session"].as_str() != Some(agent_session) {
                        return Err("AIKit encounter reading identity mismatch".into());
                    }
                    let project = focus::ProjectRef::try_from(crate::owner_relation(
                        &project_ref,
                        "project",
                        "projectcentral.inspect",
                    ))
                    .map_err(|e| e.to_string())?;
                    *registration = Some((agent_session.clone(), project));
                }
                KernelOpResult::EncounterReading { data }
            }
            AgentRead::Task { agent_session } => KernelOpResult::EncounterTaskReading {
                data: read_cache::aikit_read(
                    &self.aikit.identity(),
                    &format!("encounter-task:{agent_session}"),
                    &cwd,
                    || self.aikit.task_read(&cwd, agent_session),
                )?,
            },
            AgentRead::Settings {
                agent_session,
                request,
                expected_revision,
            } => {
                let project_ref =
                    project_ref(&self.client, &self.aikit, &self.reads, project, &cwd)?;
                KernelOpResult::EncounterSessionSettingsReading {
                    data: self.aikit.session_settings(
                        &cwd,
                        &project_ref,
                        agent_session,
                        request.as_ref(),
                        expected_revision.as_deref(),
                    )?,
                }
            }
            AgentRead::TaskConfigure {
                agent_session,
                request,
                expected_revision,
            } => {
                let project_ref =
                    project_ref(&self.client, &self.aikit, &self.reads, project, &cwd)?;
                KernelOpResult::EncounterTaskReading {
                    data: self.aikit.task_configure(
                        &cwd,
                        &project_ref,
                        agent_session,
                        request,
                        expected_revision.as_deref(),
                    )?,
                }
            }
            AgentRead::TaskRemove {
                agent_session,
                task_ref,
                expected_revision,
            } => {
                let project_ref =
                    project_ref(&self.client, &self.aikit, &self.reads, project, &cwd)?;
                KernelOpResult::EncounterOwnerAct {
                    data: self.aikit.task_remove(
                        &cwd,
                        &project_ref,
                        agent_session,
                        task_ref,
                        expected_revision,
                    )?,
                }
            }
            AgentRead::TaskBudget {
                agent_session,
                task_ref,
                turns,
                expected_revision,
                expected_budget_revision,
            } => {
                let project_ref =
                    project_ref(&self.client, &self.aikit, &self.reads, project, &cwd)?;
                KernelOpResult::EncounterOwnerAct {
                    data: self.aikit.task_budget(
                        &cwd,
                        &project_ref,
                        agent_session,
                        task_ref,
                        *turns,
                        expected_revision,
                        expected_budget_revision.as_deref(),
                    )?,
                }
            }
            AgentRead::TaskCopy {
                agent_session,
                from_session,
                task_ref,
            } => {
                let project_ref =
                    project_ref(&self.client, &self.aikit, &self.reads, project, &cwd)?;
                KernelOpResult::EncounterOwnerAct {
                    data: self.aikit.task_copy(
                        &cwd,
                        &project_ref,
                        agent_session,
                        from_session,
                        task_ref.as_deref(),
                    )?,
                }
            }
            AgentRead::SessionDetach { agent_session } => {
                let project_ref =
                    project_ref(&self.client, &self.aikit, &self.reads, project, &cwd)?;
                KernelOpResult::EncounterOwnerAct {
                    data: self
                        .aikit
                        .session_detach(&cwd, &project_ref, agent_session)?,
                }
            }
            AgentRead::SessionBench {
                space,
                agent_session,
                benched,
            } => {
                let project_ref =
                    project_ref(&self.client, &self.aikit, &self.reads, project, &cwd)?;
                KernelOpResult::EncounterOwnerAct {
                    data: self.aikit.session_bench(
                        &cwd,
                        &project_ref,
                        space,
                        agent_session,
                        *benched,
                    )?,
                }
            }
            AgentRead::SessionAttach {
                space,
                agent_session,
            } => {
                let project_ref =
                    project_ref(&self.client, &self.aikit, &self.reads, project, &cwd)?;
                KernelOpResult::EncounterOwnerAct {
                    data: self
                        .aikit
                        .session_attach(&cwd, &project_ref, space, agent_session)?,
                }
            }
            AgentRead::SessionHotSwap {
                space,
                agent_session,
                agent_ref,
            } => {
                let project_ref =
                    project_ref(&self.client, &self.aikit, &self.reads, project, &cwd)?;
                KernelOpResult::EncounterOwnerAct {
                    data: self.aikit.session_hot_swap(
                        &cwd,
                        &project_ref,
                        space,
                        agent_session,
                        agent_ref,
                    )?,
                }
            }
            AgentRead::SessionDecisionHelper { space, bound } => {
                let project_ref =
                    project_ref(&self.client, &self.aikit, &self.reads, project, &cwd)?;
                KernelOpResult::EncounterOwnerAct {
                    data: self
                        .aikit
                        .session_decision_helper(&cwd, &project_ref, space, *bound)?,
                }
            }
            AgentRead::SessionDragOut {
                space,
                agent_session,
                into,
                label,
            } => {
                let project_ref =
                    project_ref(&self.client, &self.aikit, &self.reads, project, &cwd)?;
                KernelOpResult::EncounterOwnerAct {
                    data: self.aikit.session_drag_out(
                        &cwd,
                        &project_ref,
                        space,
                        agent_session,
                        into,
                        label.as_deref(),
                    )?,
                }
            }
            AgentRead::SessionGroup {
                space,
                agent_sessions,
                into,
                label,
                agent_set,
                agent_set_revision,
            } => {
                let project_ref =
                    project_ref(&self.client, &self.aikit, &self.reads, project, &cwd)?;
                KernelOpResult::EncounterOwnerAct {
                    data: self.aikit.session_group(
                        &cwd,
                        &project_ref,
                        space,
                        agent_sessions,
                        &crate::agency::GroupInto {
                            space: into,
                            label: label.as_deref(),
                            agent_set: agent_set.as_deref(),
                            agent_set_revision: agent_set_revision.as_deref(),
                        },
                    )?,
                }
            }
            AgentRead::SettingsList { agent_sessions } => {
                let project_ref =
                    project_ref(&self.client, &self.aikit, &self.reads, project, &cwd)?;
                KernelOpResult::EncounterSessionSettingsListReading {
                    data: read_cache::aikit_read(
                        &self.aikit.identity(),
                        &format!(
                            "session-settings-list:{project_ref}:{}",
                            serde_json::to_string(agent_sessions).map_err(|e| e.to_string())?
                        ),
                        &cwd,
                        || {
                            self.aikit
                                .session_settings_list(&cwd, &project_ref, agent_sessions)
                        },
                    )?,
                }
            }
            AgentRead::AttemptsList { agent_sessions } => {
                let project_ref =
                    project_ref(&self.client, &self.aikit, &self.reads, project, &cwd)?;
                KernelOpResult::EncounterTaskAttemptsListReading {
                    data: read_cache::aikit_read(
                        &self.aikit.identity(),
                        &format!(
                            "task-attempts-list:{project_ref}:{}",
                            serde_json::to_string(agent_sessions).map_err(|e| e.to_string())?
                        ),
                        &cwd,
                        || {
                            self.aikit
                                .task_attempts_list(&cwd, &project_ref, agent_sessions)
                        },
                    )?,
                }
            }
            AgentRead::ModelRoster => KernelOpResult::ModelRosterReading {
                reading: retained(
                    &self.reads,
                    &format!("model-roster:{}", cwd.display()),
                    read_cache::HORIZON_TTL,
                    &cwd,
                    || self.aikit.model_roster(&cwd),
                )?,
            },
            AgentRead::Harness { .. }
            | AgentRead::HarnessStatus
            | AgentRead::ModelCatalogue
            | AgentRead::DecisionStatus
            | AgentRead::TeamSpace => unreachable!("answered before the World is read"),
            AgentRead::Definition(request) => KernelOpResult::AgentDefinitionReading {
                data: agent_definition::execute(
                    &self.client,
                    &self.aikit,
                    self.project.as_deref(),
                    &cwd,
                    request,
                )?,
            },
        };
        Ok(KernelOpOutcome {
            read_scopes: None,
            receipts: Vec::new(),
            result,
        })
    }
}

impl Kernel {
    /// `AgencyRead`, `Encounter`, `EncounterTaskRead`, `EncounterSessionSettings`,
    /// `EncounterTaskConfigure`, `EncounterTaskRemove`, `EncounterTaskBudget`, `EncounterTaskCopy`,
    /// `EncounterSessionDetach`, `EncounterSessionBench`,
    /// `EncounterSessionAttach`, `EncounterSessionDragOut`,
    /// `EncounterSessionGroup`, `EncounterSessionHotSwap`, `EncounterSessionDecisionHelper`, `AgentDefinition`,
    /// `ModelRoster`, `HarnessAgentRead`, `HarnessStatus` and
    /// `ModelCatalogue`, prepared under the kernel lock; every other op is
    /// not an agent read.
    pub fn prepare_agent_read(&mut self, op: &KernelOp) -> Result<Option<PreparedAgent>, String> {
        let (project, read) = match op {
            KernelOp::AgencyRead { project } => (Some(project.clone()), AgentRead::Agency),
            KernelOp::Encounter { project, request } => {
                (Some(project.clone()), AgentRead::Encounter(request.clone()))
            }
            KernelOp::EncounterTaskRead {
                project,
                agent_session,
            } => (
                Some(project.clone()),
                AgentRead::Task {
                    agent_session: agent_session.clone(),
                },
            ),
            KernelOp::EncounterSessionSettings {
                project,
                agent_session,
                request,
                expected_revision,
            } => (
                Some(project.clone()),
                AgentRead::Settings {
                    agent_session: agent_session.clone(),
                    request: request.clone(),
                    expected_revision: expected_revision.clone(),
                },
            ),
            KernelOp::EncounterTaskConfigure {
                project,
                agent_session,
                request,
                expected_revision,
            } => (
                Some(project.clone()),
                AgentRead::TaskConfigure {
                    agent_session: agent_session.clone(),
                    request: request.clone(),
                    expected_revision: expected_revision.clone(),
                },
            ),
            KernelOp::EncounterTaskRemove {
                project,
                agent_session,
                task_ref,
                expected_revision,
            } => (
                Some(project.clone()),
                AgentRead::TaskRemove {
                    agent_session: agent_session.clone(),
                    task_ref: task_ref.clone(),
                    expected_revision: expected_revision.clone(),
                },
            ),
            KernelOp::EncounterTaskBudget {
                project,
                agent_session,
                task_ref,
                turns,
                expected_revision,
                expected_budget_revision,
            } => (
                Some(project.clone()),
                AgentRead::TaskBudget {
                    agent_session: agent_session.clone(),
                    task_ref: task_ref.clone(),
                    turns: *turns,
                    expected_revision: expected_revision.clone(),
                    expected_budget_revision: expected_budget_revision.clone(),
                },
            ),
            KernelOp::EncounterTaskCopy {
                project,
                agent_session,
                from_session,
                task_ref,
            } => (
                Some(project.clone()),
                AgentRead::TaskCopy {
                    agent_session: agent_session.clone(),
                    from_session: from_session.clone(),
                    task_ref: task_ref.clone(),
                },
            ),
            KernelOp::EncounterSessionDetach {
                project,
                agent_session,
            } => (
                Some(project.clone()),
                AgentRead::SessionDetach {
                    agent_session: agent_session.clone(),
                },
            ),
            KernelOp::EncounterSessionBench {
                project,
                space,
                agent_session,
                benched,
            } => (
                Some(project.clone()),
                AgentRead::SessionBench {
                    space: space.clone(),
                    agent_session: agent_session.clone(),
                    benched: *benched,
                },
            ),
            KernelOp::EncounterSessionAttach {
                project,
                space,
                agent_session,
            } => (
                Some(project.clone()),
                AgentRead::SessionAttach {
                    space: space.clone(),
                    agent_session: agent_session.clone(),
                },
            ),
            KernelOp::EncounterSessionDragOut {
                project,
                space,
                agent_session,
                into,
                label,
            } => (
                Some(project.clone()),
                AgentRead::SessionDragOut {
                    space: space.clone(),
                    agent_session: agent_session.clone(),
                    into: into.clone(),
                    label: label.clone(),
                },
            ),
            KernelOp::EncounterSessionGroup {
                project,
                space,
                agent_sessions,
                into,
                label,
                agent_set,
                agent_set_revision,
            } => (
                Some(project.clone()),
                AgentRead::SessionGroup {
                    space: space.clone(),
                    agent_sessions: agent_sessions.clone(),
                    into: into.clone(),
                    label: label.clone(),
                    agent_set: agent_set.clone(),
                    agent_set_revision: agent_set_revision.clone(),
                },
            ),
            KernelOp::EncounterSessionHotSwap {
                project,
                space,
                agent_session,
                agent_ref,
            } => (
                Some(project.clone()),
                AgentRead::SessionHotSwap {
                    space: space.clone(),
                    agent_session: agent_session.clone(),
                    agent_ref: agent_ref.clone(),
                },
            ),
            KernelOp::EncounterSessionDecisionHelper {
                project,
                space,
                bound,
            } => (
                Some(project.clone()),
                AgentRead::SessionDecisionHelper {
                    space: space.clone(),
                    bound: *bound,
                },
            ),
            KernelOp::EncounterSessionSettingsList {
                project,
                agent_sessions,
            } => (
                Some(project.clone()),
                AgentRead::SettingsList {
                    agent_sessions: agent_sessions.clone(),
                },
            ),
            KernelOp::EncounterTaskAttemptsList {
                project,
                agent_sessions,
            } => (
                Some(project.clone()),
                AgentRead::AttemptsList {
                    agent_sessions: agent_sessions.clone(),
                },
            ),
            KernelOp::ModelRoster { project } => (project.clone(), AgentRead::ModelRoster),
            KernelOp::HarnessAgentRead { binding } => (
                None,
                AgentRead::Harness {
                    binding: binding.clone(),
                },
            ),
            KernelOp::HarnessStatus => (None, AgentRead::HarnessStatus),
            KernelOp::ModelCatalogue => (None, AgentRead::ModelCatalogue),
            KernelOp::DecisionStatus => (None, AgentRead::DecisionStatus),
            KernelOp::TeamSpace => (None, AgentRead::TeamSpace),
            KernelOp::AgentDefinition { project, request } => {
                if project.as_deref() == Some("") {
                    return Err(
                        "Use explicit null for the Central root Agent definition scope".into(),
                    );
                }
                (project.clone(), AgentRead::Definition(request.clone()))
            }
            _ => return Ok(None),
        };
        // A harness binding's sessions, the harnesses' status and the model
        // catalogue need no World: none is prepared.
        let world = if matches!(
            read,
            AgentRead::Harness { .. }
                | AgentRead::HarnessStatus
                | AgentRead::ModelCatalogue
                | AgentRead::DecisionStatus
                | AgentRead::TeamSpace
        ) {
            PreparedWorld::held_only(self.client.clone(), None)
        } else {
            self.prepare_world_reading()
        };
        Ok(Some(PreparedAgent {
            client: self.client.clone(),
            aikit: self.agency.clone(),
            reads: Arc::clone(&self.agent_reads),
            world,
            project,
            read,
        }))
    }

    /// Record an agent op's answer under the kernel lock, exactly as the
    /// ordered arms recorded theirs: an encounter reading registers its
    /// session (the attachment the encounter gates consult).
    pub fn finish_agent_read(
        &mut self,
        answered: AgentAnswered,
    ) -> Result<KernelOpOutcome, String> {
        let outcome = answered.result?;
        if let Some((agent_session, project)) = answered.registration {
            self.encounter_refs.insert(
                agent_session.clone(),
                (
                    SemanticRef {
                        ref_id: agent_session,
                        kind: "agent-session".into(),
                        native_owner: "ai-kit".into(),
                        provenance: refs::RefProvenance {
                            source: "aikit.encounter.read".into(),
                            revision: None,
                        },
                    },
                    project,
                ),
            );
        }
        Ok(outcome)
    }
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;
    use crate::dispatch::dispatch;
    use std::time::{Duration, Instant};

    /// An AIKit stand-in: logs each verb as it starts, then waits while its
    /// gate file exists, then answers the shaped reading the verb asks for.
    const FAKE_AIKIT: &str = r#"#!/usr/bin/env python3
import json, os, sys, time
log, gate = sys.argv[1], sys.argv[2]
args = sys.argv[3:]
if args[:3] == ["--json", "harness", "disclose"]:
    verb = "harness-disclose"
elif args[:1] == ["session-space"]:
    cwd, verb = args[2], args[3]
else:
    verb = " ".join(args)
with open(log, "a") as handle:
    handle.write(verb + "\n")
while os.path.exists(gate):
    time.sleep(0.02)
if verb == "harness-disclose":
    print(json.dumps({"ok": True, "data": {"schema": "aikit.harness-disclosure/v1", "profiles": []}}))
elif verb == "agent-session-scope":
    print(json.dumps({"schema": "aikit.direct-agent-scope/v1", "execution_authority_granted": False,
                      "project_ref": "control:root", "central_root": cwd, "cwd": cwd}))
elif verb == "discover" and os.path.exists(log + ".spaces.json"):
    print(open(log + ".spaces.json").read())
elif verb == "hot-swap":
    with open(log + ".hot-swap.args", "w") as handle:
        handle.write(json.dumps(args[4:]))
    print(json.dumps({"schema": "aikit.session-space-hot-swap/v1", "into": "agent-session/other-1",
                      "steps": [{"step": "mint"}, {"step": "attach"}, {"step": "detach"}]}))
elif verb == "drag-out":
    with open(log + ".drag-out.args", "w") as handle:
        handle.write(json.dumps(args[4:]))
    print(json.dumps([{"sequence": 1, "space": args[args.index("--into") + 1]}]))
elif verb == "group":
    with open(log + ".group.args", "w") as handle:
        handle.write(json.dumps(args[4:]))
    print(json.dumps([{"sequence": 0, "space": args[args.index("--into") + 1]},
                      {"sequence": 5, "space": args[args.index("--space") + 1]}]))
elif verb == "discover":
    project = args[args.index("--project") + 1]
    print(json.dumps([{"version": "aikit.session-space-application/v1",
                       "definition": {"id": "session-space/s", "projects": [project]},
                       "agent_sessions": {"agent-session/x": {}}}]))
elif verb == "encounter":
    request = json.loads(args[args.index("--request-json") + 1])
    with open(log + ".encounter", "a") as handle:
        handle.write(json.dumps(request) + "\n")
    if request.get("action") == "status" and os.path.exists(log + ".status.json"):
        print(open(log + ".status.json").read())
        sys.exit(0)
    print(json.dumps({"ok": True, "data": {"agent_session": request.get("agent_session"),
                                           "events": [], "more": False}}))
elif verb == "encounter-task-read":
    print("null")
elif verb == "encounter-task-configure":
    flag = lambda name: args[args.index(name) + 1] if name in args else None
    with open(log + ".task-configure.request.json", "w") as handle:
        handle.write(flag("--request-json"))
    kept = log + ".task-configure.json"
    if os.path.exists(kept):
        answer = open(kept).read()
        if answer.startswith("!"):
            sys.stderr.write(answer[1:])
            sys.exit(2)
        print(answer)
    else:
        print(json.dumps({"schema": "aikit.encounter-task/v1", "revision": "task-binding/new", "ready": True,
                          "request": json.loads(flag("--request-json")), "expected": flag("--expected-revision"),
                          "agent_session": flag("--agent-session")}))
elif verb == "encounter-session-settings":
    flag = lambda name: args[args.index(name) + 1] if name in args else None
    sessions = [args[i + 1] for i, arg in enumerate(args) if arg == "--agent-session"]
    request = flag("--request-json")
    reading = lambda session: {"schema": "aikit.encounter-session-settings/v1", "agent_session": session,
                               "request": json.loads(request) if request else None,
                               "expected": flag("--expected-revision")}
    if len(sessions) == 1:
        print(json.dumps(reading(sessions[0])))
    else:
        print(json.dumps({"schema": "aikit.encounter-session-settings-list/v1",
                          "readings": [reading(session) for session in sessions]}))
elif verb in ("encounter-task-remove", "encounter-task-copy"):
    flag = lambda name: args[args.index(name) + 1] if name in args else None
    kept = log + "." + verb + ".json"
    if os.path.exists(kept):
        sys.stderr.write(open(kept).read())
        sys.exit(2)
    schema = "aikit.encounter-task-removal/v1" if verb == "encounter-task-remove" else "aikit.encounter-task-copy/v1"
    print(json.dumps({"schema": schema, "agent_session": flag("--agent-session"), "task_ref": flag("--task-ref"),
                      "expected": flag("--expected-revision"), "from_session": flag("--from-session")}))
elif verb == "encounter-task-budget":
    flag = lambda name: args[args.index(name) + 1] if name in args else None
    with open(log + ".task-budget.argv.json", "w") as handle:
        handle.write(json.dumps(args))
    kept = log + "." + verb + ".json"
    if os.path.exists(kept):
        sys.stderr.write(open(kept).read())
        sys.exit(2)
    cap = None if "--clear" in args else int(flag("--turns"))
    print(json.dumps({"schema": "aikit.encounter-task-budget/v1", "agent_session": flag("--agent-session"),
                      "task_ref": flag("--task-ref"), "task_revision": flag("--expected-revision"),
                      "outcome": "cleared" if cap is None else "set",
                      "turns": {"cap": cap, "used": None, "revision": "task-budget/new"}}))
elif verb == "stage":
    flag = lambda name: args[args.index(name) + 1] if name in args else None
    intent = json.loads(open(flag("--intent-json")[1:]).read())
    print(json.dumps({"space": flag("--space"), "intent": intent}))
elif verb == "apply":
    preview = open(args[args.index("--preview-json") + 1][1:]).read()
    with open(log + ".applied", "a") as handle:
        handle.write(preview.strip() + "\n")
    print(json.dumps({"applied": True}))
elif verb == "encounter-task-attempts":
    sessions = [args[i + 1] for i, arg in enumerate(args) if arg == "--agent-session"]
    reading = lambda session: {"schema": "aikit.encounter-task-attempts/v1", "agent_session": session,
                               "revision": None, "task_ref": None, "attempts": [], "earlier": []}
    if len(sessions) == 1:
        print(json.dumps(reading(sessions[0])))
    else:
        print(json.dumps({"schema": "aikit.encounter-task-attempts-list/v1",
                          "readings": [reading(session) for session in sessions]}))
else:
    sys.exit(2)
"#;

    struct FakeAikit {
        executable: PathBuf,
        script: PathBuf,
        log: PathBuf,
        gate: PathBuf,
    }

    impl FakeAikit {
        fn new(test: &str) -> Self {
            use std::os::unix::fs::PermissionsExt;
            let stem =
                std::env::temp_dir().join(format!("oi-cradle-{}-aikit-{test}", std::process::id()));
            let script = stem.with_extension("py");
            let executable = stem.with_extension("sh");
            let log = stem.with_extension("log");
            let gate = stem.with_extension("gate");
            std::fs::write(&script, FAKE_AIKIT).unwrap();
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
        fn client(&self) -> agency::Client {
            agency::Client::with(self.executable.clone(), None)
        }
        fn calls(&self, verb: &str) -> usize {
            std::fs::read_to_string(&self.log)
                .map(|text| text.lines().filter(|line| *line == verb).count())
                .unwrap_or(0)
        }
        fn hold(&self) {
            std::fs::write(&self.gate, "").unwrap();
        }
        fn release(&self) {
            let _ = std::fs::remove_file(&self.gate);
        }
        /// Wait until `verb` has been asked `count` times.
        fn await_call(&self, verb: &str, count: usize) {
            let deadline = Instant::now() + Duration::from_secs(20);
            while self.calls(verb) < count {
                assert!(Instant::now() < deadline, "{verb} was never asked");
                std::thread::sleep(Duration::from_millis(10));
            }
        }
    }

    impl Drop for FakeAikit {
        fn drop(&mut self) {
            for path in [&self.executable, &self.script, &self.log, &self.gate] {
                let _ = std::fs::remove_file(path);
            }
            // What a task creation was handed and told to answer (FAKE_AIKIT).
            for side in [".task-configure.json", ".task-configure.request.json"] {
                let _ = std::fs::remove_file(format!("{}{side}", self.log.display()));
            }
        }
    }

    fn reading(outcome: &KernelOpOutcome) -> (String, Value, Value) {
        let KernelOpResult::AgencyReading {
            project_ref,
            spaces,
            harness_disclosure,
            ..
        } = &outcome.result
        else {
            panic!("an agency reading")
        };
        (
            project_ref.clone(),
            spaces.clone(),
            harness_disclosure.clone(),
        )
    }

    /// The shell's agency poll: while its AIKit calls are in flight the
    /// kernel lock is free — an ordered op is answered at once — and the
    /// answer is the ordered arm's own.
    #[test]
    fn the_agency_poll_holds_no_kernel_lock_while_aikit_answers() {
        let owner = crate::tests::FakeOwner::spawn_counter("agency-poll");
        let aikit = FakeAikit::new("agency-poll");
        let kernel = Arc::new(Mutex::new(owner.kernel_with_agency(aikit.client())));
        aikit.hold();
        let polling = {
            let kernel = Arc::clone(&kernel);
            std::thread::spawn(move || {
                dispatch(
                    &kernel,
                    KernelOp::AgencyRead {
                        project: String::new(),
                    },
                )
            })
        };
        aikit.await_call("agent-session-scope", 1);
        aikit.await_call("harness-disclose", 1);
        let asked = Instant::now();
        let (state, timing) = dispatch(&kernel, KernelOp::State);
        assert!(state.is_ok());
        assert!(
            asked.elapsed() < Duration::from_secs(1) && timing.lock_wait < Duration::from_secs(1),
            "an ordered op waited {:?} behind the poll's AIKit calls",
            timing.lock_wait
        );
        assert_eq!(timing.form, "ordered");
        aikit.release();
        let (polled, timing) = polling.join().unwrap();
        let polled = polled.unwrap();
        assert_eq!(timing.form, "agent");
        assert!(timing.owner > timing.lock_held);
        let (project_ref, spaces, disclosure) = reading(&polled);
        assert_eq!(project_ref, "control:root");
        assert_eq!(spaces[0]["definition"]["projects"][0], "control:root");
        assert_eq!(disclosure["schema"], "aikit.harness-disclosure/v1");
        assert!(polled.receipts.is_empty());
        // The ordered arm answers the same reading from the same retention.
        let ordered = kernel
            .lock()
            .unwrap()
            .apply(KernelOp::AgencyRead {
                project: String::new(),
            })
            .unwrap();
        assert_eq!(reading(&ordered), (project_ref, spaces, disclosure));
        assert_eq!(aikit.calls("agent-session-scope"), 1);
    }

    /// AIKit's root binding is kept per working directory for the life of
    /// its basis: later polls never ask for it again, a ground bind
    /// withdraws it, and one read while the bind landed is never retained.
    #[test]
    fn the_root_binding_is_kept_until_the_ground_moves() {
        let owner = crate::tests::FakeOwner::spawn_counter("agency-scope");
        let aikit = FakeAikit::new("agency-scope");
        let kernel = Mutex::new(owner.kernel_with_agency(aikit.client()));
        let poll = || {
            dispatch(
                &kernel,
                KernelOp::AgencyRead {
                    project: String::new(),
                },
            )
            .0
            .unwrap()
        };
        poll();
        poll();
        assert_eq!(aikit.calls("agent-session-scope"), 1);
        kernel.lock().unwrap().ground_changed();
        poll();
        assert_eq!(aikit.calls("agent-session-scope"), 2);
        // A bind landing while the binding is read: answered, not retained.
        aikit.hold();
        kernel.lock().unwrap().ground_changed();
        std::thread::scope(|scope| {
            let read = scope.spawn(poll);
            aikit.await_call("agent-session-scope", 3);
            kernel.lock().unwrap().ground_changed();
            aikit.release();
            assert_eq!(reading(&read.join().unwrap()).0, "control:root");
        });
        poll();
        assert_eq!(aikit.calls("agent-session-scope"), 4);
    }

    /// An encounter reading registers its session under the lock only when
    /// its answer is finished, exactly as the ordered arm registered it.
    #[test]
    fn an_encounter_reading_registers_its_session_when_finished() {
        let owner = crate::tests::FakeOwner::spawn_counter("encounter-read");
        let aikit = FakeAikit::new("encounter-read");
        let mut kernel = owner.kernel_with_agency(aikit.client());
        let read = KernelOp::Encounter {
            project: String::new(),
            request: agency::EncounterRequest::Read {
                agent_session: "agent-session/x".into(),
                after: 0,
                limit: 8,
            },
        };
        let answered = kernel.prepare_agent_read(&read).unwrap().unwrap().execute();
        assert!(!kernel.encounter_refs.contains_key("agent-session/x"));
        let outcome = kernel.finish_agent_read(answered).unwrap();
        assert!(matches!(
            outcome.result,
            KernelOpResult::EncounterReading { ref data } if data["agent_session"] == "agent-session/x"
        ));
        let (reference, project) = &kernel.encounter_refs["agent-session/x"];
        assert_eq!(reference.native_owner, "ai-kit");
        assert_eq!(project.semantic_ref().ref_id, "control:root");
        // A session outside the Project's spaces is refused before the owner.
        let outside = KernelOp::Encounter {
            project: String::new(),
            request: agency::EncounterRequest::Status {
                agent_session: "agent-session/elsewhere".into(),
            },
        };
        assert!(kernel.apply(outside).is_err());
        assert_eq!(aikit.calls("encounter"), 1);
        assert!(kernel
            .apply(KernelOp::EncounterTaskRead {
                project: String::new(),
                agent_session: "agent-session/x".into(),
            })
            .is_ok());
        assert!(kernel
            .apply(KernelOp::AgentDefinition {
                project: Some(String::new()),
                request: agent_definition::Request::Scope,
            })
            .is_err());
    }
    #[test]
    fn session_settings_pass_through_the_owner_for_an_attached_session_only() {
        let owner = crate::tests::FakeOwner::spawn_counter("session-settings");
        let aikit = FakeAikit::new("session-settings");
        let mut kernel = owner.kernel_with_agency(aikit.client());
        let settings = |agent_session: &str, request: Option<Value>, expected: Option<&str>| {
            KernelOp::EncounterSessionSettings {
                project: String::new(),
                agent_session: agent_session.into(),
                request,
                expected_revision: expected.map(Into::into),
            }
        };
        let read = kernel
            .apply(settings("agent-session/x", None, None))
            .unwrap();
        assert!(matches!(
            read.result,
            KernelOpResult::EncounterSessionSettingsReading { ref data }
                if data["agent_session"] == "agent-session/x" && data["request"].is_null()
        ));
        let change = serde_json::json!({"track": {"solo": true}});
        let written = kernel
            .apply(settings(
                "agent-session/x",
                Some(change.clone()),
                Some("session-settings/1"),
            ))
            .unwrap();
        assert!(matches!(
            written.result,
            KernelOpResult::EncounterSessionSettingsReading { ref data }
                if data["request"] == change && data["expected"] == "session-settings/1"
        ));
        // Another Project's session and a revision without a change never reach the owner.
        assert!(kernel
            .apply(settings("agent-session/elsewhere", Some(change), None))
            .is_err());
        assert!(kernel
            .apply(settings(
                "agent-session/x",
                None,
                Some("session-settings/1")
            ))
            .is_err());
        assert_eq!(aikit.calls("encounter-session-settings"), 2);
        // Many tracks ask once; an empty list and another Project's session never reach the owner.
        let list = |agent_sessions: &[&str]| KernelOp::EncounterSessionSettingsList {
            project: String::new(),
            agent_sessions: agent_sessions.iter().map(|s| s.to_string()).collect(),
        };
        let listed = kernel
            .apply(list(&["agent-session/x", "agent-session/x"]))
            .unwrap();
        assert!(matches!(
            listed.result,
            KernelOpResult::EncounterSessionSettingsListReading { ref data }
                if data["readings"].as_array().map(Vec::len) == Some(2)
        ));
        assert!(kernel.apply(list(&[])).is_err());
        assert!(kernel
            .apply(list(&["agent-session/x", "agent-session/elsewhere"]))
            .is_err());
        assert_eq!(aikit.calls("encounter-session-settings"), 3);
    }

    #[test]
    fn task_attempts_are_read_for_attached_sessions_only_and_always_as_a_list() {
        let owner = crate::tests::FakeOwner::spawn_counter("task-attempts");
        let aikit = FakeAikit::new("task-attempts");
        let mut kernel = owner.kernel_with_agency(aikit.client());
        let list = |agent_sessions: &[&str]| KernelOp::EncounterTaskAttemptsList {
            project: String::new(),
            agent_sessions: agent_sessions.iter().map(|s| s.to_string()).collect(),
        };
        let listed = kernel
            .apply(list(&["agent-session/x", "agent-session/x"]))
            .unwrap();
        assert!(matches!(
            listed.result,
            KernelOpResult::EncounterTaskAttemptsListReading { ref data }
                if data["schema"] == "aikit.encounter-task-attempts-list/v1"
                    && data["readings"].as_array().map(Vec::len) == Some(2)
        ));
        // One session answers its own reading; the outcome is still the list.
        let one = kernel.apply(list(&["agent-session/x"])).unwrap();
        assert!(matches!(
            one.result,
            KernelOpResult::EncounterTaskAttemptsListReading { ref data }
                if data["readings"][0]["schema"] == "aikit.encounter-task-attempts/v1"
                    && data["readings"][0]["agent_session"] == "agent-session/x"
        ));
        // An empty list and another Project's session never reach the owner.
        assert!(kernel.apply(list(&[])).is_err());
        assert!(kernel
            .apply(list(&["agent-session/x", "agent-session/elsewhere"]))
            .is_err());
        assert_eq!(aikit.calls("encounter-task-attempts"), 2);
    }

    #[test]
    fn task_configure_carries_the_request_to_the_owner_for_an_attached_session_only() {
        let owner = crate::tests::FakeOwner::spawn_counter("task-configure");
        let aikit = FakeAikit::new("task-configure");
        let mut kernel = owner.kernel_with_agency(aikit.client());
        let configure = |agent_session: &str, request: &Value, expected: Option<&str>| {
            KernelOp::EncounterTaskConfigure {
                project: String::new(),
                agent_session: agent_session.into(),
                request: request.clone(),
                expected_revision: expected.map(Into::into),
            }
        };
        // The request travels verbatim; the owner's record comes back as it answered.
        let request = serde_json::json!({
            "central": {"task_ref": "task:of-a-constellation", "purpose": "A constellation"},
            "cwd": "/w", "source": "wiki:constellation/a"
        });
        let made = kernel
            .apply(configure("agent-session/x", &request, None))
            .unwrap();
        assert!(matches!(
            made.result,
            KernelOpResult::EncounterTaskReading { ref data }
                if data["schema"] == "aikit.encounter-task/v1"
                    && data["request"] == request
                    && data["expected"].is_null()
                    && data["agent_session"] == "agent-session/x"
        ));
        // Prepared again against the revision read: the revision travels too.
        let again = kernel
            .apply(configure(
                "agent-session/x",
                &request,
                Some("task-binding/new"),
            ))
            .unwrap();
        assert!(matches!(
            again.result,
            KernelOpResult::EncounterTaskReading { ref data } if data["expected"] == "task-binding/new"
        ));
        // Another Project's session never reaches the owner.
        assert!(kernel
            .apply(configure("agent-session/elsewhere", &request, None))
            .is_err());
        assert_eq!(aikit.calls("encounter-task-configure"), 2);
        // An answer that is not the owner's task record is refused, never passed on as one.
        let kept = PathBuf::from(format!("{}.task-configure.json", aikit.log.display()));
        std::fs::write(&kept, r#"{"schema":"aikit.encounter-session-settings/v1"}"#).unwrap();
        let refused = kernel
            .apply(configure("agent-session/x", &request, None))
            .unwrap_err();
        assert!(refused.contains("task record"), "{refused}");
        // The owner's refusal passes through in its own words.
        std::fs::write(
            &kept,
            "!Current Agency does not authorise this task, authority or participant",
        )
        .unwrap();
        let refused = kernel
            .apply(configure("agent-session/x", &request, None))
            .unwrap_err();
        assert_eq!(
            refused,
            "Current Agency does not authorise this task, authority or participant"
        );
        let _ = std::fs::remove_file(&kept);
    }

    /// A chain's Budget (O-I #743; DLW build ruling 2026-11-05: AIKit owns it) reaches AIKit for a session attached to the Project
    /// only: the turns, the task and both revisions travel verbatim, always as the person's (`--by human`), a clear as `--clear`;
    /// the receipt comes back as AIKit wrote it, AIKit's refusal in its own words.
    #[test]
    fn a_task_s_budget_reaches_the_owner_as_the_person_s_for_an_attached_session_only() {
        let owner = crate::tests::FakeOwner::spawn_counter("task-budget");
        let aikit = FakeAikit::new("task-budget");
        let mut kernel = owner.kernel_with_agency(aikit.client());
        let budget = |agent_session: &str, turns: Option<u64>, budget: Option<&str>| {
            KernelOp::EncounterTaskBudget {
                project: String::new(),
                agent_session: agent_session.into(),
                task_ref: "task:fixtures".into(),
                turns,
                expected_revision: "task-binding/1".into(),
                expected_budget_revision: budget.map(Into::into),
            }
        };
        let set = kernel
            .apply(budget("agent-session/x", Some(12), None))
            .unwrap();
        let KernelOpResult::EncounterOwnerAct { data } = set.result else {
            panic!("AIKit's receipt is the outcome");
        };
        assert_eq!(data["schema"], "aikit.encounter-task-budget/v1");
        assert_eq!(data["turns"]["cap"], 12);
        let argv = || -> Vec<String> {
            serde_json::from_str(
                &std::fs::read_to_string(format!("{}.task-budget.argv.json", aikit.log.display()))
                    .unwrap(),
            )
            .unwrap()
        };
        let sent = argv();
        let after = |flag: &str| {
            sent.iter()
                .position(|arg| arg == flag)
                .map(|at| sent[at + 1].clone())
        };
        assert_eq!(after("--agent-session").as_deref(), Some("agent-session/x"));
        assert_eq!(after("--task-ref").as_deref(), Some("task:fixtures"));
        assert_eq!(
            after("--expected-revision").as_deref(),
            Some("task-binding/1")
        );
        assert_eq!(
            after("--by").as_deref(),
            Some("human"),
            "the press is the person's"
        );
        assert_eq!(after("--turns").as_deref(), Some("12"));
        assert!(!sent.contains(&"--expected-budget-revision".to_string()));
        let cleared = kernel
            .apply(budget("agent-session/x", None, Some("task-budget/1")))
            .unwrap();
        assert!(
            matches!(cleared.result, KernelOpResult::EncounterOwnerAct { ref data } if data["outcome"] == "cleared")
        );
        let sent = argv();
        assert!(sent.contains(&"--clear".to_string()) && !sent.contains(&"--turns".to_string()));
        let at = sent
            .iter()
            .position(|arg| arg == "--expected-budget-revision")
            .unwrap();
        assert_eq!(sent[at + 1], "task-budget/1");
        assert!(kernel
            .apply(budget("agent-session/elsewhere", Some(3), None))
            .is_err());
        assert_eq!(
            aikit.calls("encounter-task-budget"),
            2,
            "another Project's session never reaches the owner"
        );
        let kept = PathBuf::from(format!(
            "{}.encounter-task-budget.json",
            aikit.log.display()
        ));
        std::fs::write(
            &kept,
            "Task Budget revision conflict; read the task's Budget again and set it from there",
        )
        .unwrap();
        assert_eq!(
            kernel
                .apply(budget("agent-session/x", Some(3), None))
                .unwrap_err(),
            "Task Budget revision conflict; read the task's Budget again and set it from there"
        );
        let _ = std::fs::remove_file(&kept);
    }

    /// A task's Delete and Paste and a session's Remove from the set (O-I #743) reach AIKit for a session attached to the Project
    /// only: the task named and the revision read travel verbatim, the receipt comes back as AIKit wrote it, AIKit's refusal in its
    /// own words; a session leaves the set through the SessionSpace's own `detach-agent-session`, staged and applied on the space
    /// that holds it.
    #[test]
    fn a_task_s_removal_and_copy_and_a_session_s_detach_reach_the_owner_for_an_attached_session_only(
    ) {
        let owner = crate::tests::FakeOwner::spawn_counter("task-acts");
        let aikit = FakeAikit::new("task-acts");
        let _ = std::fs::remove_file(format!("{}.applied", aikit.log.display()));
        let mut kernel = owner.kernel_with_agency(aikit.client());
        let remove = |agent_session: &str| KernelOp::EncounterTaskRemove {
            project: String::new(),
            agent_session: agent_session.into(),
            task_ref: "task:fixtures".into(),
            expected_revision: "task-binding/1".into(),
        };
        let removed = kernel.apply(remove("agent-session/x")).unwrap();
        let KernelOpResult::EncounterOwnerAct { data } = removed.result else {
            panic!("AIKit's receipt is the outcome");
        };
        assert_eq!(data["schema"], "aikit.encounter-task-removal/v1");
        assert_eq!(data["task_ref"], "task:fixtures");
        assert_eq!(data["expected"], "task-binding/1");
        assert!(kernel.apply(remove("agent-session/elsewhere")).is_err());
        assert_eq!(
            aikit.calls("encounter-task-remove"),
            1,
            "another Project's session never reaches the owner"
        );
        let kept = PathBuf::from(format!(
            "{}.encounter-task-remove.json",
            aikit.log.display()
        ));
        std::fs::write(
            &kept,
            "Task revision conflict; read current task before removing it",
        )
        .unwrap();
        assert_eq!(
            kernel.apply(remove("agent-session/x")).unwrap_err(),
            "Task revision conflict; read current task before removing it"
        );
        let _ = std::fs::remove_file(&kept);

        let copy = |to: &str, from: &str| KernelOp::EncounterTaskCopy {
            project: String::new(),
            agent_session: to.into(),
            from_session: from.into(),
            task_ref: Some("task:fixtures-copy".into()),
        };
        let copied = kernel
            .apply(copy("agent-session/x", "agent-session/x"))
            .unwrap();
        assert!(
            matches!(copied.result, KernelOpResult::EncounterOwnerAct { ref data }
            if data["schema"] == "aikit.encounter-task-copy/v1" && data["from_session"] == "agent-session/x"
                && data["task_ref"] == "task:fixtures-copy")
        );
        assert!(kernel
            .apply(copy("agent-session/x", "agent-session/elsewhere"))
            .is_err());
        assert!(kernel
            .apply(copy("agent-session/elsewhere", "agent-session/x"))
            .is_err());
        assert_eq!(aikit.calls("encounter-task-copy"), 1);

        let detach = |agent_session: &str| KernelOp::EncounterSessionDetach {
            project: String::new(),
            agent_session: agent_session.into(),
        };
        assert!(kernel.apply(detach("agent-session/elsewhere")).is_err());
        let detached = kernel.apply(detach("agent-session/x")).unwrap();
        let KernelOpResult::EncounterOwnerAct { data } = detached.result else {
            panic!("the detach's receipt is the outcome");
        };
        assert_eq!(data["outcome"], "detached");
        assert_eq!(data["spaces"], serde_json::json!(["session-space/s"]));
        let applied = std::fs::read_to_string(format!("{}.applied", aikit.log.display())).unwrap();
        let preview: Value = serde_json::from_str(applied.trim()).unwrap();
        assert_eq!(
            preview,
            serde_json::json!({"space": "session-space/s",
                "intent": {"operation": "detach-agent-session", "agent_session": "agent-session/x"}})
        );
    }

    /// The Agent rack's chain list (manual §19.15): Activator benches a chain in the rack's space and lifts the bench, adding a chain
    /// attaches a session standing elsewhere in the Project to a space that stands, and Drag out asks AIKit's drag-out for a space of
    /// the chain's own; each through AIKit's own SessionSpace operations, on a space and a session of this Project only.
    #[test]
    fn the_chain_list_benches_adds_and_drags_out_a_chain_through_aikit_s_own_operations() {
        let owner = crate::tests::FakeOwner::spawn_counter("chain-list");
        let aikit = FakeAikit::new("chain-list");
        let side = |name: &str| PathBuf::from(format!("{}.{name}", aikit.log.display()));
        let _ = std::fs::remove_file(side("applied"));
        std::fs::write(
            side("spaces.json"),
            serde_json::json!([
                {"version": "aikit.session-space-application/v1",
                 "definition": {"id": "session-space/crew", "projects": ["control:root"]},
                 "agent_sessions": {"agent-session/ada": {"purpose": "drafts the essay"}, "agent-session/cy": {}}},
                {"version": "aikit.session-space-application/v1",
                 "definition": {"id": "session-space/desk", "projects": ["control:root"]},
                 "agent_sessions": {"agent-session/bo": {}}}
            ])
            .to_string(),
        )
        .unwrap();
        let mut kernel = owner.kernel_with_agency(aikit.client());
        let last_applied = || -> Value {
            let applied = std::fs::read_to_string(side("applied")).unwrap();
            serde_json::from_str(applied.lines().last().unwrap()).unwrap()
        };

        let bench =
            |space: &str, agent_session: &str, benched: bool| KernelOp::EncounterSessionBench {
                project: String::new(),
                space: space.into(),
                agent_session: agent_session.into(),
                benched,
            };
        let benched = kernel
            .apply(bench("session-space/crew", "agent-session/cy", true))
            .unwrap();
        let KernelOpResult::EncounterOwnerAct { data } = benched.result else {
            panic!("the bench's receipt is the outcome");
        };
        assert_eq!(data["schema"], "oi.encounter-session-bench/v1");
        assert_eq!(data["benched"], true);
        assert_eq!(
            last_applied(),
            serde_json::json!({"space": "session-space/crew", "intent": {"operation": "bench-agent-session",
                "agent_session": "agent-session/cy", "benched": true}})
        );
        kernel
            .apply(bench("session-space/crew", "agent-session/cy", false))
            .unwrap();
        assert_eq!(last_applied()["intent"]["benched"], false);
        assert_eq!(
            kernel
                .apply(bench("session-space/crew", "agent-session/bo", true))
                .unwrap_err(),
            "agent-session/bo is not a chain of session-space/crew"
        );
        assert_eq!(
            kernel
                .apply(bench("session-space/elsewhere", "agent-session/cy", true))
                .unwrap_err(),
            "session-space/elsewhere is not one of this native Project's SessionSpaces"
        );

        let attach = |space: &str, agent_session: &str| KernelOp::EncounterSessionAttach {
            project: String::new(),
            space: space.into(),
            agent_session: agent_session.into(),
        };
        let attached = kernel
            .apply(attach("session-space/desk", "agent-session/ada"))
            .unwrap();
        let KernelOpResult::EncounterOwnerAct { data } = attached.result else {
            panic!("the attachment's receipt is the outcome");
        };
        assert_eq!(data["outcome"], "attached");
        assert_eq!(
            last_applied(),
            serde_json::json!({"space": "session-space/desk", "intent": {"operation": "attach-agent-session",
                "attachment": {"agent_session": "agent-session/ada", "purpose": "drafts the essay",
                    "provenance": ["added to the rack's chain list from the desk"]}}})
        );
        assert_eq!(
            kernel
                .apply(attach("session-space/crew", "agent-session/ada"))
                .unwrap_err(),
            "agent-session/ada is already a chain of session-space/crew"
        );
        assert_eq!(
            kernel.apply(attach("session-space/desk", "agent-session/nobody")).unwrap_err(),
            "agent-session/nobody stands in none of this native Project's SessionSpaces: only a standing session joins a rack"
        );
        assert_eq!(
            aikit.calls("apply"),
            3,
            "a refused act reaches no owner write"
        );

        let drag = |agent_session: &str| KernelOp::EncounterSessionDragOut {
            project: String::new(),
            space: "session-space/crew".into(),
            agent_session: agent_session.into(),
            into: "session-space/ada-1a2b3c4d".into(),
            label: Some("ada".into()),
        };
        let dragged = kernel.apply(drag("agent-session/ada")).unwrap();
        let KernelOpResult::EncounterOwnerAct { data } = dragged.result else {
            panic!("the drag-out's receipts are the outcome");
        };
        assert_eq!(data["schema"], "oi.encounter-session-drag-out/v1");
        assert_eq!(data["into"], "session-space/ada-1a2b3c4d");
        assert_eq!(data["receipts"][0]["space"], "session-space/ada-1a2b3c4d");
        let asked: Value =
            serde_json::from_str(&std::fs::read_to_string(side("drag-out.args")).unwrap()).unwrap();
        assert_eq!(
            asked,
            serde_json::json!([
                "--space",
                "session-space/crew",
                "--agent-session",
                "agent-session/ada",
                "--into",
                "session-space/ada-1a2b3c4d",
                "--label",
                "ada"
            ])
        );
        assert!(kernel.apply(drag("agent-session/bo")).is_err());
        assert_eq!(aikit.calls("drag-out"), 1);

        // Group (manual §19.15 "select agents' chains and choose Group: they become one chain that holds an Agent rack of them").
        // Accepted as Central's set, the set's space is tied to it (round 21): the set held as a chain reads its own Join.
        let group = |sessions: &[&str]| KernelOp::EncounterSessionGroup {
            project: String::new(),
            space: "session-space/crew".into(),
            agent_sessions: sessions.iter().map(|s| (*s).to_owned()).collect(),
            into: "session-space/crew-set-1a2b".into(),
            label: Some("pair".into()),
            agent_set: Some("agent-set:crew-set-1a2b".into()),
            agent_set_revision: Some("r1".into()),
        };
        let grouped = kernel
            .apply(group(&["agent-session/ada", "agent-session/cy"]))
            .unwrap();
        let KernelOpResult::EncounterOwnerAct { data } = grouped.result else {
            panic!("the group's receipts are the outcome");
        };
        assert_eq!(data["schema"], "oi.encounter-session-group/v1");
        assert_eq!(data["into"], "session-space/crew-set-1a2b");
        assert_eq!(data["receipts"][1]["space"], "session-space/crew");
        let asked: Value =
            serde_json::from_str(&std::fs::read_to_string(side("group.args")).unwrap()).unwrap();
        assert_eq!(
            asked,
            serde_json::json!([
                "--space",
                "session-space/crew",
                "--agent-session",
                "agent-session/ada",
                "--agent-session",
                "agent-session/cy",
                "--into",
                "session-space/crew-set-1a2b",
                "--label",
                "pair",
                "--agent-set",
                "agent-set:crew-set-1a2b",
                "--agent-set-revision",
                "r1"
            ])
        );
        assert_eq!(
            kernel
                .apply(group(&["agent-session/ada", "agent-session/bo"]))
                .unwrap_err(),
            "agent-session/bo is not a chain of session-space/crew"
        );
        assert_eq!(
            kernel.apply(group(&[])).unwrap_err(),
            "Group names no chain of session-space/crew to make a set of"
        );
        assert_eq!(
            aikit.calls("group"),
            1,
            "a refused Group reaches no owner write"
        );
        for name in ["applied", "spaces.json", "drag-out.args", "group.args"] {
            let _ = std::fs::remove_file(side(name));
        }
    }

    #[test]
    fn hot_swap_and_the_decision_helper_go_through_aikit_s_own_operations() {
        let owner = crate::tests::FakeOwner::spawn_counter("hot-swap");
        let aikit = FakeAikit::new("hot-swap");
        let side = |name: &str| PathBuf::from(format!("{}.{name}", aikit.log.display()));
        for name in ["applied", "encounter", "status.json"] {
            let _ = std::fs::remove_file(side(name));
        }
        let spaces = |helper: bool| {
            let mut crew = serde_json::json!({"version": "aikit.session-space-application/v1",
                "definition": {"id": "session-space/crew", "projects": ["control:root"]},
                "agent_sessions": {"agent-session/ada": {"purpose": "drafts the essay"}, "agent-session/cy": {},
                    // The session AIKit seats in ada's place (the fake's hot-swap answer), so its open passes the gate.
                    "agent-session/other-1": {}}});
            if helper {
                crew["agent_sessions"]["agent-session/settle"] =
                    serde_json::json!({"purpose": "Decision helper"});
                crew["decision_helper"] =
                    serde_json::json!({"agent_session": "agent-session/settle"});
            }
            std::fs::write(side("spaces.json"), serde_json::json!([crew]).to_string()).unwrap();
        };
        spaces(false);
        let mut kernel = owner.kernel_with_agency(aikit.client());

        // Hot-Swap (manual §19.15): AIKit seats the other agent's own session in the chain's place.
        let swap = |agent_session: &str| KernelOp::EncounterSessionHotSwap {
            project: String::new(),
            space: "session-space/crew".into(),
            agent_session: agent_session.into(),
            agent_ref: "agent/other".into(),
        };
        let swapped = kernel.apply(swap("agent-session/ada")).unwrap();
        let KernelOpResult::EncounterOwnerAct { data } = swapped.result else {
            panic!("the swap's receipts are the outcome");
        };
        assert_eq!(data["schema"], "oi.encounter-session-hot-swap/v1");
        assert_eq!(data["into"], "agent-session/other-1");
        assert_eq!(data["steps"][2]["step"], "detach");
        assert!(
            data["open"]["unopened"]
                .as_str()
                .unwrap()
                .contains("opens when you open it"),
            "a chain that was not open leaves the new session unopened: {data}"
        );
        let asked: Value =
            serde_json::from_str(&std::fs::read_to_string(side("hot-swap.args")).unwrap()).unwrap();
        assert_eq!(
            asked.as_array().unwrap()[..6],
            serde_json::json!([
                "--space",
                "session-space/crew",
                "--agent-session",
                "agent-session/ada",
                "--agent-ref",
                "agent/other"
            ])
            .as_array()
            .unwrap()[..]
        );
        assert_eq!(asked[6], "--project-cwd");
        // A chain that was open: the new session opens on the same provider.
        std::fs::write(
            side("status.json"),
            serde_json::json!({"ok": true, "data": {"provider": {"id": "hermes-acp"}}}).to_string(),
        )
        .unwrap();
        let swapped = kernel.apply(swap("agent-session/ada")).unwrap();
        let KernelOpResult::EncounterOwnerAct { data } = swapped.result else {
            panic!()
        };
        assert_eq!(data["open"]["opened"], "hermes-acp");
        let opened = std::fs::read_to_string(side("encounter")).unwrap();
        assert!(
            opened
                .lines()
                .filter_map(|line| serde_json::from_str::<Value>(line).ok())
                .any(|asked| asked["action"] == "open"
                    && asked["agent_session"] == "agent-session/other-1"
                    && asked["provider"] == "hermes-acp"),
            "{opened}"
        );
        assert_eq!(
            kernel.apply(swap("agent-session/bo")).unwrap_err(),
            "agent-session/bo is not a chain of session-space/crew"
        );

        // The Decision helper (manual §19.20): a session of the space, named its helper.
        let helper = |bound: bool| KernelOp::EncounterSessionDecisionHelper {
            project: String::new(),
            space: "session-space/crew".into(),
            bound,
        };
        let seated = kernel.apply(helper(true)).unwrap();
        let KernelOpResult::EncounterOwnerAct { data } = seated.result else {
            panic!()
        };
        assert_eq!(data["schema"], "oi.encounter-session-decision-helper/v1");
        let session = data["agent_session"].as_str().unwrap().to_owned();
        assert!(
            session.starts_with("agent-session/decision-helper-"),
            "{session}"
        );
        let applied: Vec<Value> = std::fs::read_to_string(side("applied"))
            .unwrap()
            .lines()
            .map(|line| serde_json::from_str(line).unwrap())
            .collect();
        assert_eq!(applied[0]["intent"]["operation"], "attach-agent-session");
        assert_eq!(
            applied[0]["intent"]["attachment"]["purpose"],
            "Decision helper"
        );
        assert_eq!(
            applied[1]["intent"],
            serde_json::json!({"operation": "bind-decision-helper",
            "binding": {"agent_session": session, "provenance": ["dropped on the Agent rack as its Decision helper"]}})
        );
        spaces(true);
        assert_eq!(
            kernel.apply(helper(true)).unwrap_err(),
            "One Decision helper answers every agent of session-space/crew, and agent-session/settle already does"
        );
        kernel.apply(helper(false)).unwrap();
        let applied: Vec<Value> = std::fs::read_to_string(side("applied"))
            .unwrap()
            .lines()
            .map(|line| serde_json::from_str(line).unwrap())
            .collect();
        assert_eq!(
            applied[2]["intent"],
            serde_json::json!({"operation": "unbind-decision-helper"})
        );
        assert_eq!(
            applied[3]["intent"],
            serde_json::json!({"operation": "detach-agent-session", "agent_session": "agent-session/settle"})
        );
        for name in [
            "applied",
            "spaces.json",
            "hot-swap.args",
            "encounter",
            "status.json",
        ] {
            let _ = std::fs::remove_file(side(name));
        }
    }

    /// The real exchange (tests/fixtures/owner-routes/aikit-task-configure-2026-10-28.json): the request the shell's Factory maker sent
    /// reaches AIKit as it was sent, AIKit's record comes back as AIKit wrote it, and AIKit's refusal for a session with no Agency in
    /// AIKit's own words.
    #[test]
    fn task_configure_carries_the_real_exchange_verbatim() {
        let fixture: Value = serde_json::from_str(include_str!(
            "../tests/fixtures/owner-routes/aikit-task-configure-2026-10-28.json"
        ))
        .unwrap();
        let owner = crate::tests::FakeOwner::spawn_counter("task-configure-real");
        let aikit = FakeAikit::new("task-configure-real");
        let mut kernel = owner.kernel_with_agency(aikit.client());
        let kept = PathBuf::from(format!("{}.task-configure.json", aikit.log.display()));
        let received = PathBuf::from(format!(
            "{}.task-configure.request.json",
            aikit.log.display()
        ));
        std::fs::write(&kept, fixture["answer"].to_string()).unwrap();
        let op = KernelOp::EncounterTaskConfigure {
            project: String::new(),
            agent_session: "agent-session/x".into(),
            request: fixture["request"]["request"].clone(),
            expected_revision: None,
        };
        let made = kernel.apply(op.clone()).unwrap();
        let KernelOpResult::EncounterTaskReading { data } = made.result else {
            panic!("AIKit's task record is the outcome");
        };
        assert_eq!(data, fixture["answer"], "AIKit's record, as AIKit wrote it");
        let sent: Value =
            serde_json::from_str(&std::fs::read_to_string(&received).unwrap()).unwrap();
        assert_eq!(
            sent, fixture["request"]["request"],
            "the request, as the shell sent it"
        );
        let refusal = fixture["refusal"].as_str().unwrap();
        std::fs::write(&kept, format!("!{refusal}")).unwrap();
        assert_eq!(kernel.apply(op).unwrap_err(), refusal);
        for path in [&kept, &received] {
            let _ = std::fs::remove_file(path);
        }
    }
}
