//! Typed owner-Action dispatch adapter (cell C6) through the exact candidate
//! O:I executable, pinned Central executable (cell C1 Action runner) and
//! pinned AIKit executable (cell C2 owner operations). Isolated temp Central
//! grounds and isolated AIKIT_HOME only — the live ground and user stores
//! never move.
//!
//! The adapter law under test: the owner-disclosed Action ref, target ref
//! and optional input travel verbatim; owner payloads return unchanged;
//! spellings with no real owner operation are explicit unsupported states;
//! owner failures carry the owner's own words; the kernel records nothing
//! (owner-side effects — e.g. exactly one familiarity observation from
//! `knowledge/open` — are proven by replaying the owner event log).
use oi_cradle_kernel::action::{ActionDispatch, ActionInvocation, ACTION_DISPATCH_SCHEMA};
use oi_cradle_kernel::knowledge;
use oi_cradle_kernel::{CentralClient, Kernel, KernelOp, KernelOpResult};
use serde_json::{json, Value};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::{Mutex, MutexGuard};
use std::time::{SystemTime, UNIX_EPOCH};

/// Owner-executable environment is process-global; the dispatch tests own
/// it under one lock so each test still gets its own isolated grounds.
static ENV_LOCK: Mutex<()> = Mutex::new(());

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
    let root = std::env::temp_dir().join(format!("oi-action-dispatch-{tag}-{stamp}-{}", std::process::id()));
    fs::create_dir(&root).unwrap();
    root
}

fn write(path: &Path, contents: &str) {
    fs::create_dir_all(path.parent().unwrap()).unwrap();
    fs::write(path, contents).unwrap();
}

/// Seed the C2 fixture ground: one SourcePool file. The SourcePool file is
/// what the merged ai-kit resolve (Vāk surface, #258) surfaces for a
/// Central-bound project — the central wiki (seeded separately) supplies the
/// node hits, and an aikit-side semantic-wiki.json is not consulted once a
/// ProjectCentral ground exists, so none is seeded here.
fn seed_aikit_project(project: &Path) {
    write(&project.join(".aikit/profile.toml"), "schema = 1\n");
    write(
        &project.join("source-material.json"),
        r#"{
          "binding": {
            "source": "source:file:action-onboarding",
            "revision": "rev-1",
            "title": "action onboarding file",
            "tags": ["action", "test"],
            "visibility": "public",
            "owners": [],
            "media_type": "text/markdown",
            "metadata": {"origin":"action-fixture"}
          },
          "body": "The action fixture file keeps source evidence distinct from compiled knowledge."
        }"#,
    );
}

/// Seed the reviewed C1 fixture wiki: 1 space, 1 node, hand-countable.
fn seed_project_wiki(project_root: &Path) {
    write(
        &project_root.join("ProjectCentral/agents/wiki/wiki.json"),
        r#"{
          "objects": [
            {
              "profile": "okf-wiki/v1",
              "object": "space",
              "ref": "central:wiki:project:action-proj",
              "revision": 9,
              "title": "ActionProj Wiki",
              "parent_space_refs": ["central:wiki:root"],
              "child_space_refs": [],
              "node_refs": ["wiki:node:action-note", "wiki:node:action-flow", "wiki:node:action-subject"],
              "anchor_ref": "wiki:node:action-note"
            },
            {
              "profile": "okf-wiki/v1",
              "object": "node",
              "ref": "wiki:node:action-note",
              "revision": 1,
              "type": "Note",
              "title": "Action note",
              "space_refs": ["central:wiki:project:action-proj"],
              "source_refs": ["source:file:action-note"],
              "provenance_source_refs": []
            },
            {
              "profile": "okf-wiki/v1",
              "object": "node",
              "ref": "wiki:node:action-flow",
              "revision": 3,
              "type": "flow",
              "title": "Action test flow",
              "space_refs": ["central:wiki:project:action-proj"],
              "source_refs": ["source:file:action-onboarding"],
              "provenance_source_refs": []
            },
            {
              "profile": "okf-wiki/v1",
              "object": "node",
              "ref": "wiki:node:action-subject",
              "revision": 5,
              "type": "Concept",
              "title": "Action test subject",
              "space_refs": ["central:wiki:project:action-proj"],
              "source_refs": ["source:file:action-onboarding"],
              "provenance_source_refs": []
            }
          ]
        }"#,
    );
}

struct Fixture {
    _env: MutexGuard<'static, ()>,
    root: PathBuf,
    _aikit_home: PathBuf,
}

impl Fixture {
    /// One isolated Central ground + project + AIKIT_HOME, exact bindings
    /// exported for every owner child process.
    fn new(tag: &str) -> Self {
        let env = ENV_LOCK.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
        let root = temporary_root(tag);
        let aikit_home = root.join("aikit-home");
        fs::create_dir_all(&aikit_home).unwrap();
        std::env::set_var("OI_BIN", candidate("oi"));
        std::env::set_var("OI_CENTRAL_CTRL_BIN", candidate("ctrl"));
        std::env::set_var("OI_AIKIT_BIN", candidate("aikit"));
        std::env::set_var("AIKIT_HOME", &aikit_home);

        let client = CentralClient::with_suite_owner(
            candidate("oi"),
            candidate("ctrl"),
            Some(root.clone()),
            "ActionGround".into(),
        );
        client.run("central.init", json!({})).unwrap();
        fs::create_dir(root.join("Work/ActionProj")).unwrap();
        client
            .run(
                "projectcentral.init",
                json!({"project":"ActionProj", "project_id":"action-proj"}),
            )
            .unwrap();
        let project_root = root.join("Work/ActionProj");
        seed_aikit_project(&project_root);
        // `projectcentral.init` scaffolds a default wiki; replace it with the
        // hand-countable C1 fixture.
        seed_project_wiki(&project_root);
        Self { _env: env, root, _aikit_home: aikit_home }
    }

    fn client(&self) -> CentralClient {
        CentralClient::with_suite_owner(
            candidate("oi"),
            candidate("ctrl"),
            Some(self.root.clone()),
            "ActionGround".into(),
        )
    }

    fn project_cwd(&self) -> PathBuf {
        self.root.join("Work/ActionProj")
    }

    fn kernel(&self) -> Kernel {
        Kernel::new(self.client())
    }

    /// Replay the owner event log: the same `usage_events` stream the
    /// owner's familiarity replay reads (`aikit log export`), counting the
    /// explicit `resource-use` familiarity observations.
    fn familiarity_observation_events(&self) -> usize {
        let output = Command::new(candidate("oi"))
            .arg("aikit")
            .arg("--json")
            .arg("-C")
            .arg(self.project_cwd())
            .args(["log", "export"])
            .output()
            .expect("launch the pinned suite executable for aikit log export");
        assert!(output.status.success(), "aikit log export failed: {}", String::from_utf8_lossy(&output.stderr));
        let envelope: Value = serde_json::from_slice(&output.stdout).expect("aikit log export envelope");
        assert_eq!(envelope["ok"], true);
        envelope["data"]["events"]
            .as_array()
            .expect("events array")
            .iter()
            .filter(|event| event["action"] == "resource-use")
            .count()
    }

    fn dispatch(&self, action: &str, target_ref: &str) -> ActionDispatch {
        self.dispatch_with_input(action, target_ref, None)
    }

    fn dispatch_with_input(&self, action: &str, target_ref: &str, input: Option<Value>) -> ActionDispatch {
        let mut kernel = self.kernel();
        let outcome = kernel
            .apply(KernelOp::InvokeAction {
                project: Some("ActionProj".into()),
                invocation: ActionInvocation {
                    action: action.into(),
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

// Central-bound project: the merged ai-kit resolve (Vāk surface, #258)
// federates the ProjectCentral wiki, so the seeded flow surfaces under its
// C1 central-wiki ref.
const FILE_ROW_REF: &str = "source:file:action-onboarding";
const FLOW_ROW_REF: &str = "wiki:node:action-flow";
const SUBJECT_ROW_REF: &str = "wiki:node:action-subject";

#[test]
fn open_dispatches_through_the_real_owner_and_records_exactly_one_familiarity_observation() {
    let fixture = Fixture::new("open");

    // The real owner resolution hits (merged Vāk surface, ai-kit #258) and
    // the disclosed open Action spelling, invocable on any resolved ref.
    let resolution = knowledge::call(
        &fixture.project_cwd(),
        &knowledge::Request::Resolve { query: "action".into() },
    )
    .unwrap();
    let hits = resolution["hits"].as_array().expect("merged resolve returns typed hits");
    assert!(
        hits.iter().any(|hit| hit["resource"] == FILE_ROW_REF),
        "the seeded file resolves as a hit"
    );

    // Querying records nothing: the owner event log replays zero observations.
    assert_eq!(
        fixture.familiarity_observation_events(),
        0,
        "resolution itself records no familiarity (C2 law)"
    );

    // Dispatch the disclosed Action through the typed kernel op.
    let dispatch = fixture.dispatch("knowledge/open", FILE_ROW_REF);
    let ActionDispatch::Invoked { owner_operation, data } = &dispatch else {
        panic!("knowledge/open must invoke the real owner operation, got {dispatch:?}")
    };
    assert_eq!(owner_operation, "aikit knowledge open");

    // The owner receipt rides verbatim: opened ref, recorded event kind and
    // the durable observation id the owner minted.
    assert_eq!(data["opened"], FILE_ROW_REF);
    assert_eq!(data["recorded"], "familiarity/resource-use");
    let observation_id = data["observation_id"].as_str().unwrap().to_owned();
    assert!(
        observation_id.starts_with("knowledge-open-use/"),
        "owner observation id carried verbatim: {observation_id}"
    );

    // Exactly one successful-use familiarity observation is provable through
    // the pinned owner store by replaying its event log.
    assert_eq!(fixture.familiarity_observation_events(), 1);

    // A failed open of an unresolved ref records nothing (owner law, C2).
    let refused = fixture.dispatch("knowledge/open", "wiki:node:absent");
    assert!(
        matches!(refused, ActionDispatch::OwnerRefused { .. }),
        "unresolved ref refuses through the owner: {refused:?}"
    );
    assert_eq!(fixture.familiarity_observation_events(), 1, "a failed open records nothing");

    // The kernel log itself stayed empty: owner-side effects live in the
    // owner store, not in kernel state.
    let kernel = fixture.kernel();
    assert_eq!(kernel.event_log().len(), 0, "the dispatch adapter emits nothing");

    let _ = fs::remove_dir_all(&fixture.root);
}

#[test]
fn every_seeded_resolution_hit_invokes_its_open_action() {
    let fixture = Fixture::new("walk");

    // U3.1's walk on the merged Vāk surface (ai-kit #258): the seeded file,
    // flow and subject all resolve as typed hits, and each dispatches
    // `knowledge/open` through the real owner operation.
    let resolution = knowledge::call(
        &fixture.project_cwd(),
        &knowledge::Request::Resolve {
            query: "action".into(),
        },
    )
    .unwrap();
    let hits = resolution["hits"].as_array().expect("merged resolve returns typed hits");
    let seeded = [FILE_ROW_REF, FLOW_ROW_REF, SUBJECT_ROW_REF];
    for expected in seeded {
        assert!(
            hits.iter().any(|hit| hit["resource"] == expected),
            "the fixture seeds {expected} and the owner resolve returns it"
        );
    }
    let mut opened = 0usize;
    for reference in seeded {
        let dispatch = fixture.dispatch("knowledge/open", reference);
        assert!(
            matches!(dispatch, ActionDispatch::Invoked { .. }),
            "knowledge/open invokes on the seeded ref ({reference}): {dispatch:?}"
        );
        opened += 1;
    }
    // Each invocation recorded exactly one observation through the owner.
    assert_eq!(fixture.familiarity_observation_events(), opened);

    let _ = fs::remove_dir_all(&fixture.root);
}

#[test]
fn central_wiki_read_action_returns_the_owner_payload_unchanged() {
    let fixture = Fixture::new("central");

    // Owner baseline, straight through the pinned Central runner.
    let baseline: Value = fixture
        .client()
        .run("projectcentral.wiki.read", json!({"project": "ActionProj"}))
        .unwrap();
    assert_eq!(baseline["schema"], "central.wiki-reading/v1");

    // The same Action, dispatched as the graph node's disclosed Action ref
    // (target_ref is the Central wiki node ref, carried verbatim).
    let dispatch = fixture.dispatch("projectcentral.wiki.read", "wiki:node:action-note");
    let ActionDispatch::Invoked { owner_operation, data } = dispatch else {
        panic!("Central wiki read must invoke, got {dispatch:?}")
    };
    assert_eq!(owner_operation, "projectcentral.wiki.read");

    // The owner payload is returned unchanged.
    assert_eq!(data, baseline, "Central Action payload returned verbatim");

    // Root-register wiki read dispatches the same way (op project omitted:
    // the Central runner supplies the configured query, which names no
    // project row, so the owner answers for the register itself or refuses
    // explicitly — both are owner truths, never a fabrication).
    let mut kernel = fixture.kernel();
    let root_outcome = kernel
        .apply(KernelOp::InvokeAction {
            project: None,
            invocation: ActionInvocation {
                action: "central.wiki.read".into(),
                target_ref: "central:wiki:project:action-proj".into(),
                input: None,
            },
        })
        .unwrap();
    let KernelOpResult::ActionDispatched { dispatch: root_dispatch } = root_outcome.result else {
        panic!("typed ActionDispatched result expected")
    };
    match root_dispatch {
        ActionDispatch::Invoked { data, .. } => assert_eq!(data["schema"], "central.wiki-reading/v1"),
        ActionDispatch::OwnerRefused { .. } => {
            // The fixture's root register keeps no authored wiki; the owner's
            // refusal is an owner truth, carried verbatim.
        }
        other => panic!("root wiki read must invoke or carry the owner's refusal, got {other:?}"),
    }

    let _ = fs::remove_dir_all(&fixture.root);
}

#[test]
fn unsupported_spellings_are_explicit_states_naming_the_ref() {
    let fixture = Fixture::new("unsupported");
    let reasons = [
        ("knowledge/read", "typed Knowledge address"),
        ("knowledge/sources", "typed Knowledge address"),
        ("knowledge/relations", "typed Knowledge address"),
        ("knowledge/explain", "typed Knowledge address"),
        ("knowledge/route", "typed Knowledge address"),
        ("run", "no structured owner payload"),
        ("skill/overlay/set", "overlay patch"),
        // W4-D: `action:contemplate-flow` binds for real (preflight-first,
        // record-gated) — its coverage lives in `flow_cognition_dispatch.rs`.
    ];
    for (spelling, reason_part) in reasons {
        let dispatch = fixture.dispatch(spelling, FILE_ROW_REF);
        match &dispatch {
            ActionDispatch::UnsupportedAction { owner, detail } => {
                assert_eq!(owner, "ai-kit", "{spelling} routes to its real owner");
                assert!(
                    detail.contains(reason_part),
                    "{spelling} unsupported reason names the grounding: {detail}"
                );
            }
            other => panic!("{spelling} must be an explicit unsupported state, got {other:?}"),
        }
    }
    let _ = fs::remove_dir_all(&fixture.root);
}

#[test]
fn unknown_owner_and_malformed_refs_are_explicit_states() {
    let fixture = Fixture::new("malformed");

    let unknown = fixture.dispatch("acme.everything", FILE_ROW_REF);
    match &unknown {
        ActionDispatch::UnknownOwner { action } => assert_eq!(action, "acme.everything"),
        other => panic!("unregistered spelling must be an explicit unknown-owner state, got {other:?}"),
    }

    for (action, target_ref) in [
        ("", FILE_ROW_REF),
        ("not a spelling", FILE_ROW_REF),
        ("knowledge/open", ""),
        ("projectcentral.wiki.read", "  "),
    ] {
        let dispatch = fixture.dispatch(action, target_ref);
        assert!(
            matches!(dispatch, ActionDispatch::MalformedRef { .. }),
            "({action:?}, {target_ref:?}) must be an explicit malformed-ref state, got {dispatch:?}"
        );
    }

    let _ = fs::remove_dir_all(&fixture.root);
}

#[test]
fn owner_refusal_and_unavailable_are_explicit_verbatim_states() {
    let fixture = Fixture::new("owner-states");

    // Owner refusal: the unresolved-ref answer is the owner's own message,
    // carried verbatim (C2 recorded this owner error as
    // `knowledge.open_unresolved` / "no knowledge provider resolves …").
    let refused = fixture.dispatch("knowledge/open", "wiki:node:absent");
    match &refused {
        ActionDispatch::OwnerRefused { owner_operation, message } => {
            assert_eq!(owner_operation, "aikit knowledge open");
            assert!(
                message.contains("no knowledge provider resolves"),
                "owner message carried verbatim: {message}"
            );
        }
        other => panic!("owner refusal must be explicit and verbatim, got {other:?}"),
    }

    // Owner refusal on the Central arm: a Central Action the owner does not
    // register answers no, verbatim.
    let central_refused = fixture.dispatch("projectcentral.wiki.absent", "wiki:node:action-note");
    match &central_refused {
        ActionDispatch::OwnerRefused { owner_operation, message } => {
            assert_eq!(owner_operation, "projectcentral.wiki.absent");
            assert!(!message.trim().is_empty(), "Central refusal message verbatim: {message}");
        }
        other => panic!("Central owner refusal must be explicit, got {other:?}"),
    }

    // Owner unavailable: the pinned executable binding pointing nowhere is
    // absence, not an error — an explicit state, and no retry/rerouting.
    // This case drives `action::invoke` directly: the kernel op's scope read
    // fronts every dispatch and legitimately errors first when the pinned
    // suite executable itself cannot launch; the adapter's owner-unavailable
    // state is what the spawn absence classifies as below.
    let real_oi = candidate("oi");
    let client = fixture.client();
    let invocation = ActionInvocation {
        action: "knowledge/open".into(),
        target_ref: FILE_ROW_REF.into(),
        input: None,
    };
    let nowhere = fixture.root.join("definitely/not/an/oi");
    std::env::set_var("OI_BIN", &nowhere);
    let unavailable = oi_cradle_kernel::action::invoke(
        &client,
        &fixture.project_cwd(),
        Some("ActionProj"),
        &invocation,
    );
    std::env::set_var("OI_BIN", &real_oi);
    match &unavailable {
        ActionDispatch::OwnerUnavailable { owner_operation, detail } => {
            assert_eq!(owner_operation, "aikit knowledge open");
            assert!(!detail.trim().is_empty(), "unavailable detail names the absence: {detail}");
        }
        other => panic!("owner unavailability must be an explicit state, got {other:?}"),
    }
    // The owner store proves nothing was recorded while the owner was absent.
    assert_eq!(fixture.familiarity_observation_events(), 0);

    let _ = fs::remove_dir_all(&fixture.root);
}

#[test]
fn wire_shape_is_stable_for_the_typed_consumer() {
    let fixture = Fixture::new("wire");

    let op = serde_json::to_value(KernelOp::InvokeAction {
        project: Some("ActionProj".into()),
        invocation: ActionInvocation {
            action: "knowledge/open".into(),
            target_ref: FILE_ROW_REF.into(),
            input: None,
        },
    })
    .unwrap();
    assert_eq!(op["op"], "invoke_action");
    assert_eq!(op["project"], "ActionProj");
    assert_eq!(op["invocation"]["action"], "knowledge/open");
    assert_eq!(op["invocation"]["target_ref"], FILE_ROW_REF);
    assert!(op["invocation"].get("input").is_none(), "absent optional input stays off the wire");

    // Schema constant is named and versioned for the receipt contract.
    assert_eq!(ACTION_DISPATCH_SCHEMA, "oi.cradle.action-dispatch/v1");

    // Every dispatch state is a named snake_case tag the renderer can
    // render honestly.
    let states = serde_json::to_value(ActionDispatch::Invoked {
        owner_operation: "aikit knowledge open".into(),
        data: json!({}),
    })
    .unwrap();
    assert_eq!(states["state"], "invoked");
    for state in [
        ActionDispatch::UnsupportedAction { owner: "ai-kit".into(), detail: "d".into() },
        ActionDispatch::MalformedRef { detail: "d".into() },
        ActionDispatch::UnknownOwner { action: "a".into() },
        ActionDispatch::OwnerRefused { owner_operation: "o".into(), message: "m".into() },
        ActionDispatch::OwnerUnavailable { owner_operation: "o".into(), detail: "d".into() },
    ] {
        let wire = serde_json::to_value(state).unwrap();
        assert!(wire["state"].is_string(), "explicit state named on the wire: {wire}");
        assert_ne!(wire["state"], "invoked");
    }

    let dispatch = fixture.dispatch("knowledge/open", FILE_ROW_REF);
    assert!(matches!(dispatch, ActionDispatch::Invoked { .. }));

    let _ = fs::remove_dir_all(&fixture.root);
}
