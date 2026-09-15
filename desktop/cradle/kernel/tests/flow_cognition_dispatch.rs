//! W4-D Contemplate dispatch binding (W1.4) through the exact candidate O:I
//! executable, pinned Central executable and pinned AIKit executable.
//! Isolated temp Central grounds and isolated AIKIT_HOME only.
//!
//! The adapter law under test: preflight-first — a bare row dispatch
//! surfaces the AIKit owner's deterministic preflight record and nothing
//! executes; the owner execution operation runs only when the caller
//! presents an explicit preflight record (`input.execute`, a JSON object) —
//! a boolean shorthand or an auto-invocation is structurally impossible
//! through the kernel, not just the owner. Owner refusals/unavailable pass
//! through verbatim; the dispatch records nothing and emits nothing.
use oi_cradle_kernel::action::{ActionDispatch, ActionInvocation};
use oi_cradle_kernel::{Kernel, KernelOp, KernelOpResult};
use serde_json::{json, Value};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, MutexGuard};
use std::time::{SystemTime, UNIX_EPOCH};

/// Owner-executable environment is process-global; the dispatch tests own
/// it under one lock so each test still gets its own isolated grounds.
static ENV_LOCK: Mutex<()> = Mutex::new(());

const FLOW_REF: &str = "wiki:node:w4d/test-flow";

fn candidate(name: &str) -> PathBuf {
    let variable = match name {
        "oi" => "OI_BIN",
        "ctrl" => "OI_CENTRAL_CTRL_BIN",
        "aikit" => "OI_AIKIT_BIN",
        _ => unreachable!(),
    };
    let path = PathBuf::from(
        std::env::var_os(variable)
            .unwrap_or_else(|| panic!("{variable} must name the frozen candidate executable")),
    );
    assert!(
        path.is_absolute(),
        "{variable} must be an absolute executable path: {}",
        path.display()
    );
    assert!(
        path.is_file(),
        "missing exact candidate executable: {}",
        path.display()
    );
    path
}

fn temporary_root(tag: &str) -> PathBuf {
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    let root = std::env::temp_dir().join(format!(
        "oi-flow-cognition-{tag}-{stamp}-{pid}",
        pid = std::process::id()
    ));
    fs::create_dir(&root).unwrap();
    root
}

fn write(path: &Path, contents: &str) {
    fs::create_dir_all(path.parent().unwrap()).unwrap();
    fs::write(path, contents).unwrap();
}

/// The provider-neutral KnowledgeChangeHorizon owner seam: the observed
/// source rides at the exact revision the Flow node's provenance discloses.
fn horizon_seam() -> Value {
    json!({
        "provider": "central.source-change-horizon/v1",
        "cursor": 0,
        "sources": [{
            "source": "source:file:w4d-note",
            "revision": "rev-2",
            "available": true,
        }],
        "changes": [],
    })
}

/// The host ModelRuntimeReadModel owner seam (aikit.model-runtime/v1):
/// model, Agent, Agency, AgentSession and Harness identities for attribution.
fn runtime_seam() -> Value {
    json!({
        "version": "aikit.model-runtime/v1",
        "project": "project:w4d",
        "agent": "agent:w4d",
        "agency": "agency:w4d",
        "harness": "harness:w4d",
        "agent_session": "session:w4d",
        "harness_composition_fingerprint": "w4d-fingerprint",
        "relation": {
            "model": {"model": "model:w4d", "variant": "default"},
            "engine": {
                "engine": "engine:w4d",
                "provider": "provider:w4d",
                "form": "external",
            },
            "materialisation": {
                "binding_ref": "binding:w4d",
                "placement": "local",
                "lifetime_owner": "w4d-test",
                "retraction": "live",
            },
            "model_surface": {
                "protocol": "text",
                "access": {
                    "inference": {"state": "available", "capabilities": ["text"]},
                    "material_control": {"state": "unavailable", "reason": "not required"},
                    "interior": {"state": "unavailable", "reason": "not required"},
                },
            },
            "change_application": "live",
        },
        "components": [],
        "contracts": [],
        "surfaces": [],
        "unavailable": [],
    })
}

struct Fixture {
    _env: MutexGuard<'static, ()>,
    root: PathBuf,
    _aikit_home: PathBuf,
}

impl Fixture {
    /// One isolated Central ground + project + AIKIT_HOME, exact bindings
    /// exported for every owner child process. The project wiki carries one
    /// Flow node whose provenance pins source:file:w4d-note at rev-2; the
    /// source pool material rides the same exact revision.
    fn new(tag: &str) -> Self {
        let env = ENV_LOCK
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        let root = temporary_root(tag);
        let aikit_home = root.join("aikit-home");
        fs::create_dir_all(&aikit_home).unwrap();
        std::env::set_var("OI_BIN", candidate("oi"));
        std::env::set_var("OI_CENTRAL_CTRL_BIN", candidate("ctrl"));
        std::env::set_var("OI_AIKIT_BIN", candidate("aikit"));
        std::env::set_var("AIKIT_HOME", &aikit_home);

        let client = oi_cradle_kernel::CentralClient::with_suite_owner(
            candidate("oi"),
            candidate("ctrl"),
            Some(root.clone()),
            "W4DGround".into(),
        );
        client.run("central.init", json!({})).unwrap();
        fs::create_dir(root.join("Work/W4DProj")).unwrap();
        client
            .run(
                "projectcentral.init",
                json!({"project": "W4DProj", "project_id": "w4d-proj"}),
            )
            .unwrap();
        let project_root = root.join("Work/W4DProj");
        write(&project_root.join(".aikit/profile.toml"), "schema = 1\n");
        write(
            &project_root.join("source-material.json"),
            r#"{
              "binding": {
                "source": "source:file:w4d-note",
                "revision": "rev-2",
                "title": "w4d flow note",
                "tags": [],
                "visibility": "public",
                "owners": [],
                "media_type": "text/markdown",
                "metadata": {}
              },
              "body": "the w4d flow source body"
            }"#,
        );
        // `projectcentral.init` scaffolds a default wiki; replace it with one
        // space and the Flow node, exactly as the owner resolves it.
        write(
            &project_root.join("ProjectCentral/agents/wiki/wiki.json"),
            r#"{
              "objects": [
                {
                  "profile": "okf-wiki/v1",
                  "object": "space",
                  "ref": "central:wiki:project:w4d-proj",
                  "revision": 1,
                  "title": "W4D Wiki",
                  "parent_space_refs": ["central:wiki:root"],
                  "child_space_refs": [],
                  "node_refs": ["wiki:node:w4d/test-flow"],
                  "anchor_ref": "wiki:node:w4d/test-flow"
                },
                {
                  "profile": "okf-wiki/v1",
                  "object": "node",
                  "ref": "wiki:node:w4d/test-flow",
                  "revision": 3,
                  "provenance": [{"source_ref": "source:file:w4d-note", "source_revision": "rev-2"}],
                  "type": "flow",
                  "title": "w4d test flow",
                  "space_refs": ["central:wiki:project:w4d-proj"],
                  "source_refs": ["source:file:w4d-note"],
                  "provenance_source_refs": []
                }
              ]
            }"#,
        );
        Self {
            _env: env,
            root,
            _aikit_home: aikit_home,
        }
    }

    fn client(&self) -> oi_cradle_kernel::CentralClient {
        oi_cradle_kernel::CentralClient::with_suite_owner(
            candidate("oi"),
            candidate("ctrl"),
            Some(self.root.clone()),
            "W4DGround".into(),
        )
    }

    fn project_cwd(&self) -> PathBuf {
        self.root.join("Work/W4DProj")
    }

    /// The NOW contemplation dispatch: the same kernel route, re-aimed
    /// subject (Central #175 cell 2). The Action spelling is the kernel's
    /// binding; the target ref is the now_ref, verbatim.
    fn dispatch_now(&self, target_ref: &str, input: Option<Value>) -> ActionDispatch {
        let mut kernel = Kernel::new(self.client());
        let outcome = kernel
            .apply(KernelOp::InvokeAction {
                project: Some("W4DProj".into()),
                invocation: ActionInvocation {
                    action: "action:contemplate-now".into(),
                    target_ref: target_ref.into(),
                    input,
                },
            })
            .unwrap();
        assert!(
            outcome.receipts.is_empty(),
            "the dispatch adapter records nothing of its own: no kernel receipts"
        );
        let KernelOpResult::ActionDispatched { dispatch } = outcome.result else {
            panic!("typed ActionDispatched result expected")
        };
        dispatch
    }

    /// Allocate one NOW clearing in the fixture ground and append one raw
    /// fixture to its T stream through Central's own Actions. The ground's
    /// placement policy is a controlled test fixture with the exact
    /// recognition the native authority law requires.
    fn allocated_now_with_fixture(&self) -> String {
        let relations_path = self.root.join("Control/relations/source-relations.json");
        let mut relations: Value = match fs::read_to_string(&relations_path) {
            Ok(raw) => serde_json::from_str(&raw).unwrap(),
            Err(_) => json!({
                "schema": "central.control.ground-relations/v1",
                "project_id": "control:root",
                "relations": []
            }),
        };
        let policy_path = "Control/user/placement.json";
        write(
            &self.root.join(policy_path),
            r#"{
  "schema": "central.work-placement-policy/v1",
  "scope_ref": "control:root",
  "authority_refs": [],
  "writable": [{"path": "Work/W4DProj", "class": "repository"}],
  "protected": [],
  "enforcement": "harness-interception",
  "required_coverage": ["filesystem"],
  "lease_seconds": 300
}
"#,
        );
        let policy_ref = format!("central:source:control:root:{policy_path}");
        let entry = json!({
            "ref": policy_ref,
            "path": policy_path,
            "roles": ["work-placement-policy"],
            "provenance": "human-adopted",
            "standing": "architecture-contract",
            "treatment": "projectcentral-user",
            "recognition": "explicit-controlled-test-fixture-not-personal-adoption",
            "recorded_at_unix_seconds": 1
        });
        let relations_entries = relations["relations"]
            .as_array_mut()
            .expect("relations array");
        if !relations_entries
            .iter()
            .any(|row| row["path"] == policy_path)
        {
            relations_entries.push(entry);
        }
        write(
            &relations_path,
            &format!("{}\n", serde_json::to_string_pretty(&relations).unwrap()),
        );

        let client = self.client();
        let policy = client
            .run("central.work.policy", json!({"project": Value::Null}))
            .expect("root work policy resolves");
        let allocation = client
            .run(
                "central.now.allocate",
                json!({
                    "project": Value::Null,
                    "task_ref": "task:now-contemplate",
                    "purpose": "NOW contemplation dispatch binding",
                    "expected_policy_revision": policy["revision"],
                }),
            )
            .expect("the fixture ground allocates a NOW clearing");
        let now_ref = allocation["now_ref"].as_str().unwrap().to_owned();
        client
            .run(
                "central.now.thoughts.append",
                json!({
                    "project": Value::Null,
                    "now_ref": now_ref,
                    "slug": "raw-finding",
                    "day": "2026-09-13",
                    "actor": "agent:w4d",
                    "actor_kind": "agent",
                    "content": "what returned today",
                }),
            )
            .expect("the raw fixture appends");
        now_ref
    }

    fn dispatch(&self, target_ref: &str, input: Option<Value>) -> ActionDispatch {
        let mut kernel = Kernel::new(self.client());
        let outcome = kernel
            .apply(KernelOp::InvokeAction {
                project: Some("W4DProj".into()),
                invocation: ActionInvocation {
                    action: "action:contemplate-flow".into(),
                    target_ref: target_ref.into(),
                    input,
                },
            })
            .unwrap();
        assert!(
            outcome.receipts.is_empty(),
            "the dispatch adapter records nothing of its own: no kernel receipts"
        );
        let KernelOpResult::ActionDispatched { dispatch } = outcome.result else {
            panic!("typed ActionDispatched result expected")
        };
        dispatch
    }
}

#[test]
#[ignore = "requires actual OI_BIN/OI_CENTRAL_CTRL_BIN frozen native candidates"]
fn structural_impossibility_a_boolean_or_auto_invocation_cannot_execute() {
    let fixture = Fixture::new("contemplate-gate");

    // A boolean shorthand refuses before any owner call — structural
    // impossibility preserved through the kernel, not just the owner.
    let dispatch = fixture.dispatch(
        FLOW_REF,
        Some(json!({"horizon": horizon_seam(), "runtime": runtime_seam(), "execute": true})),
    );
    let ActionDispatch::MalformedRef { detail } = &dispatch else {
        panic!("boolean execute shorthand must refuse as a malformed ref, got {dispatch:?}")
    };
    assert!(
        detail.contains("structural impossibility"),
        "the refusal names the structural law: {detail}"
    );

    // A non-object input of any other shape is equally unusable.
    let dispatch = fixture.dispatch(FLOW_REF, Some(json!("execute please")));
    assert!(
        matches!(dispatch, ActionDispatch::MalformedRef { .. }),
        "a non-object input must refuse as a malformed ref, got {dispatch:?}"
    );

    // A non-object seam refuses with the seam named.
    let dispatch = fixture.dispatch(FLOW_REF, Some(json!({"horizon": "not-an-object"})));
    let ActionDispatch::MalformedRef { detail } = &dispatch else {
        panic!("a non-object seam must refuse as a malformed ref, got {dispatch:?}")
    };
    assert!(
        detail.contains("horizon"),
        "the refusal names the seam: {detail}"
    );

    let _ = fs::remove_dir_all(&fixture.root);
}

#[test]
#[ignore = "requires actual OI_BIN/OI_CENTRAL_CTRL_BIN frozen native candidates"]
fn owner_refusal_and_unavailable_pass_through_verbatim() {
    let fixture = Fixture::new("contemplate-owner-failures");

    // The owner answered, and the answer was no: the owner's own words ride.
    let dispatch = fixture.dispatch("wiki:node:w4d/missing", None);
    let ActionDispatch::OwnerRefused {
        owner_operation,
        message,
    } = &dispatch
    else {
        panic!("an unresolvable Flow must carry the owner's refusal, got {dispatch:?}")
    };
    assert_eq!(owner_operation, "aikit flow preflight");
    assert!(
        message.contains("no Flow node resolves wiki:node:w4d/missing"),
        "owner refusal verbatim: {message}"
    );

    // The owner executable could not be launched: honest absence, named.
    // Driven through `action::invoke` directly: the kernel op's scope read
    // fronts every dispatch and legitimately errors first when the pinned
    // suite executable itself cannot launch; the adapter's owner-unavailable
    // state is what the spawn absence classifies as below.
    let client = fixture.client();
    let cwd = fixture.project_cwd();
    let bogus = fixture.root.join("no-such-suite-executable");
    let _guard = support::EnvGuard::set("OI_BIN", &bogus);
    let dispatch = oi_cradle_kernel::action::invoke(
        &client,
        &cwd,
        Some("W4DProj"),
        &ActionInvocation {
            action: "action:contemplate-flow".into(),
            target_ref: FLOW_REF.into(),
            input: None,
        },
    );
    let ActionDispatch::OwnerUnavailable {
        owner_operation,
        detail,
    } = &dispatch
    else {
        panic!("an absent owner must be explicit unavailability, got {dispatch:?}")
    };
    assert_eq!(owner_operation, "aikit flow preflight");
    assert!(
        !detail.is_empty(),
        "the owner unavailability carries the launch detail verbatim"
    );

    let _ = fs::remove_dir_all(&fixture.root);
}

mod support {
    use std::path::Path;
    /// One environment variable restored on drop, so a failed assertion
    /// cannot leak a bogus owner binding into the next serialized test.
    pub struct EnvGuard {
        key: &'static str,
        original: Option<std::ffi::OsString>,
    }
    impl EnvGuard {
        pub fn set(key: &'static str, value: &Path) -> Self {
            let original = std::env::var_os(key);
            std::env::set_var(key, value);
            Self { key, original }
        }
    }
    impl Drop for EnvGuard {
        fn drop(&mut self) {
            match &self.original {
                Some(value) => std::env::set_var(self.key, value),
                None => std::env::remove_var(self.key),
            }
        }
    }
}

#[test]
#[ignore = "requires actual OI_BIN/OI_CENTRAL_CTRL_BIN/OI_AIKIT_BIN frozen native candidates with the NOW contemplation reading"]
fn now_subject_dispatch_reads_central_stream_and_surfaces_the_owner_preflight() {
    let fixture = Fixture::new("contemplate-now");
    let now_ref = fixture.allocated_now_with_fixture();

    // Bare dispatch: the kernel reads the stream from Central and the AIKit
    // owner answers its explicit preflight — carried verbatim.
    let dispatch = fixture.dispatch_now(&now_ref, None);
    let ActionDispatch::Invoked {
        owner_operation,
        data,
    } = &dispatch
    else {
        panic!("NOW dispatch must invoke the owner preflight, got {dispatch:?}")
    };
    assert_eq!(owner_operation, "aikit flow preflight");
    assert_eq!(data["version"], "aikit.now-contemplation/v1");
    assert_eq!(data["now_ref"], now_ref);
    let preflight = &data["preflight"];
    assert_eq!(preflight["fixture_count"], 1);
    assert_eq!(preflight["days"], json!(["2026-09-13"]));
    assert_eq!(
        preflight["source_fixtures"],
        json!(["raw-finding-2026-09-13.md"])
    );
    assert!(preflight["invocation_ref"]
        .as_str()
        .unwrap_or("")
        .starts_with("now-contemplate/"));
    assert_eq!(preflight["automatic_agent_or_model_invocation"], false);
    // The CLI surface carries no host executor: the honest terminal state.
    assert_eq!(data["contemplation"]["state"], "unavailable");

    // A NOW ref that owns no stream refuses through Central's own words.
    let refused = fixture.dispatch_now("central:now:control:root:nowhere", None);
    assert!(
        matches!(
            refused,
            ActionDispatch::OwnerRefused { ref owner_operation, .. }
                if owner_operation == "central.now.thoughts.read"
        ),
        "the stream read refusal names Central's Action, got {refused:?}"
    );

    let _ = fs::remove_dir_all(&fixture.root);
}
