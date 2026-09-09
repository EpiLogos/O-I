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
fn bare_row_dispatch_surfaces_the_owner_preflight_and_never_executes() {
    let fixture = Fixture::new("preflight-bare");

    let dispatch = fixture.dispatch(FLOW_REF, None);
    let ActionDispatch::Invoked {
        owner_operation,
        data,
    } = &dispatch
    else {
        panic!("bare Contemplate dispatch must invoke the owner preflight, got {dispatch:?}")
    };
    // Preflight-first: the owner operation served is the deterministic
    // preflight, never the execution operation.
    assert_eq!(owner_operation, "aikit flow preflight");
    assert_eq!(data["version"], "aikit.flow-cognition/v1");
    assert_eq!(data["flow"], FLOW_REF);
    // Without owner seams the owner's own answer is the explicit
    // `unavailable` preflight — carried verbatim, never faked into cognition.
    assert_eq!(data["state"], "unavailable");
    let reason = data["reason"].as_str().unwrap_or("");
    assert!(
        reason.contains("horizon") && reason.contains("runtime"),
        "the owner unavailable reason names the absent seams: {reason}"
    );

    let _ = fs::remove_dir_all(&fixture.root);
}

#[test]
#[ignore = "requires actual OI_BIN/OI_CENTRAL_CTRL_BIN frozen native candidates"]
fn owner_seams_travel_verbatim_and_the_deterministic_record_is_surfaced() {
    let fixture = Fixture::new("preflight-seams");
    let horizon = horizon_seam();
    let runtime = runtime_seam();

    let dispatch = fixture.dispatch(
        FLOW_REF,
        Some(json!({"horizon": horizon, "runtime": runtime})),
    );
    let ActionDispatch::Invoked {
        owner_operation,
        data,
    } = &dispatch
    else {
        panic!("seamed Contemplate dispatch must invoke the owner preflight, got {dispatch:?}")
    };
    assert_eq!(owner_operation, "aikit flow preflight");
    assert_eq!(data["version"], "aikit.flow-cognition/v1");
    assert_eq!(data["state"], "preflight");
    // The deterministic preflight record: the Flow ref, the standing context
    // binding the exact source revision, and the invocation ref a later
    // execution must present — all owner-produced, carried unchanged.
    let preflight = &data["preflight"];
    assert_eq!(preflight["version"], "aikit.flow-contemplate/v1");
    assert_eq!(preflight["standing"]["binding"]["flow_ref"], FLOW_REF);
    assert_eq!(preflight["standing"]["binding"]["flow_revision"], "rev-2");
    assert_eq!(
        preflight["standing"]["binding"]["source_ref"],
        "source:file:w4d-note"
    );
    let invocation_ref = preflight["invocation_ref"].as_str().unwrap_or("");
    assert!(
        invocation_ref.starts_with("flow-contemplate/"),
        "the owner invocation ref is deterministic and owner-shaped: {invocation_ref}"
    );
    // The bounded field discloses exactly the seam-carried identities.
    assert_eq!(preflight["bounded"]["base"]["agent"], "agent:w4d");
    assert_eq!(preflight["bounded"]["base"]["agency"], "agency:w4d");
    assert_eq!(preflight["automatic_agent_or_model_invocation"], false);

    let _ = fs::remove_dir_all(&fixture.root);
}

#[test]
#[ignore = "requires actual OI_BIN/OI_CENTRAL_CTRL_BIN frozen native candidates"]
fn explicit_record_executes_and_carries_the_typed_cognition_reading() {
    let fixture = Fixture::new("contemplate-execute");

    // The caller presents an explicit preflight record gating execution —
    // the only door to the owner execution operation.
    let dispatch = fixture.dispatch(
        FLOW_REF,
        Some(json!({
            "horizon": horizon_seam(),
            "runtime": runtime_seam(),
            "execute": {"record": "present"},
        })),
    );
    let ActionDispatch::Invoked {
        owner_operation,
        data,
    } = &dispatch
    else {
        panic!(
            "record-gated Contemplate dispatch must invoke the owner execution, got {dispatch:?}"
        )
    };
    assert_eq!(owner_operation, "aikit flow contemplate");
    assert_eq!(data["version"], "aikit.flow-cognition/v1");
    // The pinned CLI surface carries no host ContemplateExecutor aperture:
    // the honest typed reading is the owner's explicit `unavailable`, naming
    // the absent executor — never faked into cognition.
    let cognition = &data["cognition"];
    assert_eq!(cognition["version"], "aikit.flow-cognition/v1");
    assert_eq!(cognition["state"], "unavailable");
    let reason = cognition["reason"].as_str().unwrap_or("");
    assert!(
        reason.contains("ContemplateExecutor") && reason.contains("never auto-invoked"),
        "the owner unavailable reason names the absent executor and the invariant: {reason}"
    );
    assert_eq!(cognition["flow_ref"], FLOW_REF);
    // The owner re-ran its deterministic preflight beside the reading.
    assert_eq!(
        data["preflight"]["standing"]["binding"]["flow_ref"],
        FLOW_REF
    );

    let _ = fs::remove_dir_all(&fixture.root);
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
