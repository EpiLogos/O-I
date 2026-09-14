//! W4-D changed-since-thought compose (W1.5, kernel half) through the exact
//! candidate O:I executable, pinned Central executable and pinned AIKit
//! executable. Isolated temp Central grounds and isolated AIKIT_HOME only.
//!
//! The adapter law under test: the kernel supplies the KnowledgeChangeHorizon
//! — adapted field-by-field from Central's own `projectcentral.change.horizon`
//! (`central.source-change-horizon/v1`), refs verbatim — calls the AIKit
//! owner's `flow changed-since`, and returns ONE typed reading with both
//! owner sides explicit. A side that could not be queried is named, never
//! faked empty. The compose records nothing and emits nothing (pull read +
//! owner read).
use oi_cradle_kernel::flow_cognition::{
    self, AikitChangedSince, ChangedSinceReading, HorizonSupply,
};
use oi_cradle_kernel::{CentralClient, Kernel, KernelOp, KernelOpResult};
use serde_json::{json, Value};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, MutexGuard};
use std::time::{SystemTime, UNIX_EPOCH};

/// Owner-executable environment is process-global; the compose tests own it
/// under one lock so each test still gets its own isolated grounds.
static ENV_LOCK: Mutex<()> = Mutex::new(());

const FLOW_REF: &str = "wiki:node:w4d-changed/test-flow";
const CENTRAL_WIKI_SOURCE: &str =
    "central:source:project:w4d-changed:ProjectCentral/agents/wiki/wiki.json";

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
        "oi-flow-changed-since-{tag}-{stamp}-{pid}",
        pid = std::process::id()
    ));
    fs::create_dir(&root).unwrap();
    root
}

fn write(path: &Path, contents: &str) {
    fs::create_dir_all(path.parent().unwrap()).unwrap();
    fs::write(path, contents).unwrap();
}

/// One owner-shaped FlowThoughtRecord: the deterministic invocation ref, the
/// FlowRef, the source identity and the horizon cursor the thought was
/// recorded at — every ref owner-spelled.
fn thought_record() -> Value {
    json!({
        "version": "aikit.flow-cognition/v1",
        "invocation_ref": "flow-contemplate/w4dchanged000000000000000000000000000000000000000000000000000000000",
        "flow_ref": FLOW_REF,
        "source_ref": "source:file:w4d-changed-note",
        "basis_revision": "rev-2",
        "horizon_cursor": 0,
    })
}

struct Fixture {
    _env: MutexGuard<'static, ()>,
    root: PathBuf,
    _aikit_home: PathBuf,
}

impl Fixture {
    /// One isolated Central ground + project + AIKIT_HOME with one Flow node
    /// and its exact-revision source pool material, exactly as the AIKit
    /// owner resolves them.
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

        let client = CentralClient::with_suite_owner(
            candidate("oi"),
            candidate("ctrl"),
            Some(root.clone()),
            "W4DChangedGround".into(),
        );
        client.run("central.init", json!({})).unwrap();
        fs::create_dir(root.join("Work/W4DChanged")).unwrap();
        client
            .run(
                "projectcentral.init",
                json!({"project": "W4DChanged", "project_id": "w4d-changed"}),
            )
            .unwrap();
        let project_root = root.join("Work/W4DChanged");
        write(&project_root.join(".aikit/profile.toml"), "schema = 1\n");
        write(
            &project_root.join("source-material.json"),
            r#"{
              "binding": {
                "source": "source:file:w4d-changed-note",
                "revision": "rev-2",
                "title": "w4d changed-since note",
                "tags": [],
                "visibility": "public",
                "owners": [],
                "media_type": "text/markdown",
                "metadata": {}
              },
              "body": "the w4d changed-since flow source body"
            }"#,
        );
        write(
            &project_root.join("ProjectCentral/agents/wiki/wiki.json"),
            r#"{
              "objects": [
                {
                  "profile": "okf-wiki/v1",
                  "object": "space",
                  "ref": "central:wiki:project:w4d-changed",
                  "revision": 1,
                  "title": "W4D Changed Wiki",
                  "parent_space_refs": ["central:wiki:root"],
                  "child_space_refs": [],
                  "node_refs": ["wiki:node:w4d-changed/test-flow"],
                  "anchor_ref": "wiki:node:w4d-changed/test-flow"
                },
                {
                  "profile": "okf-wiki/v1",
                  "object": "node",
                  "ref": "wiki:node:w4d-changed/test-flow",
                  "revision": 3,
                  "provenance": [{"source_ref": "source:file:w4d-changed-note", "source_revision": "rev-2"}],
                  "type": "flow",
                  "title": "w4d changed-since test flow",
                  "space_refs": ["central:wiki:project:w4d-changed"],
                  "source_refs": ["source:file:w4d-changed-note"],
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

    fn client(&self) -> CentralClient {
        CentralClient::with_suite_owner(
            candidate("oi"),
            candidate("ctrl"),
            Some(self.root.clone()),
            "W4DChangedGround".into(),
        )
    }

    fn project_cwd(&self) -> PathBuf {
        self.root.join("Work/W4DChanged")
    }

    fn compose(&self, thought: Value) -> ChangedSinceReading {
        let mut kernel = Kernel::new(self.client());
        let outcome = kernel
            .apply(KernelOp::FlowChangedSince {
                project: Some("W4DChanged".into()),
                thought,
            })
            .unwrap();
        assert!(
            outcome.receipts.is_empty(),
            "the changed-since compose is a pull read + owner read: no kernel receipts"
        );
        let KernelOpResult::FlowChangedSince { reading } = outcome.result else {
            panic!("typed FlowChangedSince result expected")
        };
        reading
    }
}

#[test]
#[ignore = "requires actual OI_BIN/OI_CENTRAL_CTRL_BIN frozen native candidates"]
fn compose_returns_one_reading_with_both_sides_available() {
    let fixture = Fixture::new("compose-empty");

    let reading = fixture.compose(thought_record());
    assert_eq!(reading.flow_ref, FLOW_REF);
    assert_eq!(
        reading.thought_ref,
        "flow-contemplate/w4dchanged000000000000000000000000000000000000000000000000000000000"
    );

    // The Central side: the horizon the kernel supplied, adapted from
    // Central's own seam, every source ref verbatim.
    let HorizonSupply::Available {
        owner_operation,
        provider,
        cursor,
        adapted,
    } = &reading.horizon
    else {
        panic!(
            "the Central horizon side must be available, got {:?}",
            reading.horizon
        )
    };
    assert_eq!(owner_operation, "projectcentral.change.horizon");
    assert_eq!(provider, "central.filesystem-reconcile/v1");
    assert_eq!(*cursor, 0);
    assert_eq!(
        adapted["sources"]
            .as_array()
            .unwrap()
            .iter()
            .map(|source| source["source"].as_str().unwrap())
            .collect::<Vec<_>>(),
        vec![CENTRAL_WIKI_SOURCE],
        "the adapted horizon carries Central's own source refs verbatim"
    );

    // The AIKit side: the typed owner receipt, verbatim. Central's horizon
    // observes Central's own sources; the AIKit Flow's source-pool material
    // is not a Central source, so the owner's own impact analysis reports
    // the Flow node's basis as `basis-unavailable` — an honest owner finding
    // the compose exists to surface, carried verbatim, never faked empty.
    let AikitChangedSince::Invoked {
        owner_operation,
        receipt,
    } = &reading.aikit
    else {
        panic!(
            "the AIKit owner side must be invoked, got {:?}",
            reading.aikit
        )
    };
    assert_eq!(owner_operation, "aikit flow changed-since");
    assert_eq!(receipt["version"], "aikit.flow-changed-since/v1");
    assert_eq!(receipt["reading"]["version"], "aikit.flow-changed-since/v1");
    assert_eq!(receipt["reading"]["flow_ref"], FLOW_REF);
    assert_eq!(receipt["reading"]["thought_ref"], reading.thought_ref);
    assert_eq!(receipt["reading"]["state"], "available");
    assert_eq!(receipt["reading"]["changed_sources"], json!([]));
    let affected = receipt["reading"]["affected_knowledge"].as_array().unwrap();
    assert_eq!(
        affected.len(),
        1,
        "the owner names the unobserved Flow basis"
    );
    assert_eq!(affected[0]["resource"], "wiki:node:w4d-changed/test-flow");
    assert_eq!(affected[0]["source"], "source:file:w4d-changed-note");
    assert_eq!(affected[0]["freshness"], "basis-unavailable");
    assert_eq!(
        receipt["reading"]["automatic_agent_or_model_invocation"],
        false
    );

    let _ = fs::remove_dir_all(&fixture.root);
}

#[test]
#[ignore = "requires actual OI_BIN/OI_CENTRAL_CTRL_BIN frozen native candidates"]
fn compose_reports_owner_changes_above_the_thought_cursor() {
    let fixture = Fixture::new("compose-changed");

    // Establish the owner reconcile baseline first; the change below then
    // lands strictly above the thought's horizon cursor.
    fixture
        .client()
        .run(
            "projectcentral.change.horizon",
            json!({"project": "W4DChanged"}),
        )
        .unwrap();

    // One owner-side change after the thought: the Central wiki gains a row
    // strictly above the thought's horizon cursor.
    let wiki_path = fixture
        .project_cwd()
        .join("ProjectCentral/agents/wiki/wiki.json");
    let mut wiki: Value = serde_json::from_str(&fs::read_to_string(&wiki_path).unwrap()).unwrap();
    wiki["objects"].as_array_mut().unwrap().push(json!({
        "profile": "okf-wiki/v1",
        "object": "node",
        "ref": "wiki:node:w4d-changed/later",
        "revision": 1,
        "type": "Note",
        "title": "a later note",
        "space_refs": ["central:wiki:project:w4d-changed"],
        "source_refs": ["source:file:w4d-changed-note"],
        "provenance_source_refs": []
    }));
    fs::write(&wiki_path, serde_json::to_string(&wiki).unwrap()).unwrap();

    let reading = fixture.compose(thought_record());
    let HorizonSupply::Available { adapted, .. } = &reading.horizon else {
        panic!(
            "the Central horizon side must be available, got {:?}",
            reading.horizon
        )
    };
    assert_eq!(
        adapted["cursor"].as_u64().unwrap(),
        1,
        "the adapted horizon rides the owner cursor after the change"
    );
    assert_eq!(
        adapted["changes"].as_array().unwrap()[0]["source"]
            .as_str()
            .unwrap(),
        CENTRAL_WIKI_SOURCE,
        "the adapted change row carries Central's own source ref verbatim"
    );

    let AikitChangedSince::Invoked { receipt, .. } = &reading.aikit else {
        panic!(
            "the AIKit owner side must be invoked, got {:?}",
            reading.aikit
        )
    };
    let owner_reading = &receipt["reading"];
    assert_eq!(owner_reading["state"], "available");
    let changed = owner_reading["changed_sources"].as_array().unwrap();
    assert_eq!(changed.len(), 1, "exactly the owner row above the cursor");
    assert_eq!(changed[0]["source"], CENTRAL_WIKI_SOURCE);
    assert_eq!(changed[0]["kind"], "modified");
    assert!(
        changed[0]["basis_revision"]
            .as_str()
            .unwrap()
            .starts_with("central.content-fnv1a64/v1:"),
        "the owner revision rides verbatim: {}",
        changed[0]["basis_revision"]
    );
    assert!(
        changed[0]["observed_revision"]
            .as_str()
            .unwrap()
            .starts_with("central.content-fnv1a64/v1:"),
        "the owner revision rides verbatim: {}",
        changed[0]["observed_revision"]
    );
    // The owner reading is a structured receipt: affected knowledge and
    // unresolved rows are owner fields, carried — never synthesized.
    assert!(owner_reading["affected_knowledge"].is_array());
    assert!(owner_reading["unresolved"].is_array());

    let _ = fs::remove_dir_all(&fixture.root);
}

#[test]
#[ignore = "requires actual OI_BIN/OI_CENTRAL_CTRL_BIN frozen native candidates"]
fn an_unavailable_side_is_named_never_faked_empty() {
    let fixture = Fixture::new("compose-unavailable");

    // Both owner executables absent: each side names its own absence — the
    // reading is explicit on both sides, never an invented empty horizon or
    // a fabricated empty owner receipt.
    let bogus = fixture.root.join("no-such-suite-executable");
    let _guard = support::EnvGuard::set("OI_BIN", &bogus);
    let client = CentralClient::with_suite_owner(
        bogus.clone(),
        candidate("ctrl"),
        Some(fixture.root.clone()),
        "W4DChangedGround".into(),
    );
    let reading = flow_cognition::changed_since(
        &client,
        "W4DChanged",
        &fixture.project_cwd(),
        &thought_record(),
    )
    .unwrap();

    let HorizonSupply::OwnerUnavailable {
        owner_operation,
        detail,
    } = &reading.horizon
    else {
        panic!(
            "the Central horizon side must name its unavailability, got {:?}",
            reading.horizon
        )
    };
    assert_eq!(owner_operation, "projectcentral.change.horizon");
    assert!(
        !detail.is_empty(),
        "the Central unavailability carries the owner launch detail"
    );

    let AikitChangedSince::OwnerUnavailable {
        owner_operation,
        detail,
    } = &reading.aikit
    else {
        panic!(
            "the AIKit side must name its unavailability, got {:?}",
            reading.aikit
        )
    };
    assert_eq!(owner_operation, "aikit flow changed-since");
    assert!(
        !detail.is_empty(),
        "the AIKit unavailability carries the owner launch detail"
    );

    let _ = fs::remove_dir_all(&fixture.root);
}

#[test]
#[ignore = "requires actual OI_BIN/OI_CENTRAL_CTRL_BIN frozen native candidates"]
fn a_malformed_thought_is_a_structural_error_naming_the_owner_shape() {
    let fixture = Fixture::new("compose-malformed");

    let mut kernel = Kernel::new(fixture.client());
    let error = kernel
        .apply(KernelOp::FlowChangedSince {
            project: Some("W4DChanged".into()),
            thought: json!("not an object"),
        })
        .unwrap_err();
    assert!(
        error.contains("owner-shaped JSON object"),
        "the structural error names the owner shape: {error}"
    );

    let error = kernel
        .apply(KernelOp::FlowChangedSince {
            project: Some("W4DChanged".into()),
            thought: json!({"version": "aikit.flow-cognition/v1"}),
        })
        .unwrap_err();
    assert!(
        error.contains("FlowRef"),
        "the structural error names the missing owner identity: {error}"
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
