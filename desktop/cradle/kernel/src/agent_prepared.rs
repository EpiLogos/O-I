//! Agent-scoped owner reads prepared under the kernel lock and run outside it
//! (dispatch.rs): the agency reading the shell polls, encounter verbs, an
//! encounter's task, the Agent definition family, the model roster and a
//! harness binding's gateway sessions. Ported from the
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
    /// A reading was retained (or already shared) at preparation.
    pub(crate) fn is_held(&self) -> bool {
        self.held.is_some()
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
    read: impl FnOnce() -> Result<Value, String>,
) -> Result<Value, String> {
    let ticket = {
        let mut cache = reads.lock().unwrap_or_else(|e| e.into_inner());
        if let Some(value) = cache.get(key, ttl) {
            return Ok(value);
        }
        cache.begin(key.to_owned())
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
    Definition(agent_definition::Request),
    ModelRoster,
    /// The AIKit gateway's session list for one harness binding; it needs
    /// no World and no directory.
    Harness {
        binding: String,
    },
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
                receipts: Vec::new(),
                result: KernelOpResult::HarnessAgentReading {
                    document: self.aikit.gateway_agent(None, binding, "sessions")?,
                    binding: binding.clone(),
                },
            });
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
                    let disclosure = scope.spawn(|| {
                        retained(
                            &self.reads,
                            &format!("harness-disclosure:{}", cwd.display()),
                            read_cache::HORIZON_TTL,
                            || {
                                Ok(match self.aikit.harness_disclosure(&cwd) {
                                    Ok(value) => value,
                                    Err(reason) => {
                                        serde_json::json!({"state":"unavailable","reason":reason})
                                    }
                                })
                            },
                        )
                    });
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
                let data = self.aikit.encounter(&cwd, &project_ref, request)?;
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
                data: self
                    .aikit
                    .task_read(&cwd, agent_session)
                    .map_err(|e| e.to_string())?,
            },
            AgentRead::ModelRoster => KernelOpResult::ModelRosterReading {
                reading: retained(
                    &self.reads,
                    &format!("model-roster:{}", cwd.display()),
                    read_cache::HORIZON_TTL,
                    || self.aikit.model_roster(&cwd),
                )?,
            },
            AgentRead::Harness { .. } => unreachable!("answered before the World is read"),
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
            receipts: Vec::new(),
            result,
        })
    }
}

impl Kernel {
    /// `AgencyRead`, `Encounter`, `EncounterTaskRead`, `AgentDefinition`,
    /// `ModelRoster` and `HarnessAgentRead`, prepared under the kernel lock;
    /// every other op is not an agent read.
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
            KernelOp::ModelRoster { project } => (project.clone(), AgentRead::ModelRoster),
            KernelOp::HarnessAgentRead { binding } => (
                None,
                AgentRead::Harness {
                    binding: binding.clone(),
                },
            ),
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
        // A harness binding's sessions need no World: none is prepared.
        let world = if matches!(read, AgentRead::Harness { .. }) {
            PreparedWorld {
                client: self.client.clone(),
                held: None,
                flight: None,
            }
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
elif verb == "discover":
    project = args[args.index("--project") + 1]
    print(json.dumps([{"version": "aikit.session-space-application/v1",
                       "definition": {"id": "session-space/s", "projects": [project]},
                       "agent_sessions": {"agent-session/x": {}}}]))
elif verb == "encounter":
    request = json.loads(args[args.index("--request-json") + 1])
    print(json.dumps({"ok": True, "data": {"agent_session": request.get("agent_session"),
                                           "events": [], "more": False}}))
elif verb == "encounter-task-read":
    print("null")
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
}
