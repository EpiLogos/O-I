//! The Gate-B binding proof (#299 §20): `oi config` and `oi profile` run
//! through the REAL engine — `cli/src/kernel_surface.rs` binding the C1
//! kernel and the C2 profile store — driven through the real binary with a
//! fake owner executable answering the frozen verb grammar over
//! `ProcessTransport` (the C1 process-transport test pattern).
//!
//! The fake owner is discovered through the deployed surface catalogue
//! (`OI_CATALOG` points the `ai-kit` position at the fixture executable);
//! every other product position degrades honestly on this machine. The
//! tests prove: resolution through the kernel reading path, the persisted
//! changeset/receipt/reconciliation identity, idempotent replay (`no_op`
//! from the owner), the profile store + composition active mark, profile
//! entries composing the desired layer, and reset withdrawing desired
//! state. No fixture mode is involved anywhere.

use serde_json::{json, Value};
use std::path::{Path, PathBuf};
use std::process::Command;
use tempfile::TempDir;

const SETTING_REF: &str = "ai-kit:resolution:model.default";
const SCOPE_ARG: &str = "project:binding-test";

/// One isolated binding scene: a temp O:I home, a fake `ai-kit` owner
/// executable (python3) with its own native state, and a runtime catalogue
/// pointing the `ai-kit` position at it.
struct Scene {
    home: TempDir,
    work: TempDir,
    catalogue: PathBuf,
}

impl Scene {
    fn open() -> Self {
        let home = TempDir::new().expect("temp OI home");
        let work = TempDir::new().expect("temp work dir");
        let bin = home.path().join("bin");
        std::fs::create_dir_all(&bin).expect("bin dir");
        let owner = write_fake_owner(&bin);
        let catalogue = write_catalogue(home.path(), &owner);
        Self {
            home,
            work,
            catalogue,
        }
    }

    fn oi(&self) -> Command {
        let mut command = Command::new(env!("CARGO_BIN_EXE_oi"));
        command
            .env("OI_HOME", self.home.path())
            .env("OI_CATALOG", &self.catalogue)
            .env_remove("OI_CONFIG_SURFACE_FIXTURES");
        command
    }

    fn run(&self, args: &[&str]) -> (i32, Value, String) {
        let output = self.oi().args(args).output().expect("the oi binary runs");
        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        let json = if stdout.trim().is_empty() {
            Value::Null
        } else {
            serde_json::from_str(&stdout)
                .unwrap_or_else(|error| panic!("stdout is not JSON ({error}): {stdout}"))
        };
        (
            output.status.code().unwrap_or(-1),
            json,
            format!("{stdout}{stderr}"),
        )
    }

    /// Run a command that must succeed, returning its JSON document.
    fn run_ok(&self, args: &[&str]) -> Value {
        let (code, json, text) = self.run(args);
        assert_eq!(code, 0, "`oi {}` failed: {text}", args.join(" "));
        json
    }

    fn configuration_dir(&self) -> PathBuf {
        self.home.path().join("configuration")
    }
}

/// The fake owner executable: a python3 script answering the frozen
/// discovery command and the four-verb grammar from its own little native
/// state, with the frozen idempotency law (a re-submitted executed key
/// answers `no_op` naming the original receipt, 09 §9).
fn write_fake_owner(bin: &Path) -> PathBuf {
    let script_path = bin.join("fixture-owner");
    std::fs::write(
        &script_path,
        r#"#!/usr/bin/env python3
import sys, os, json, hashlib

here = os.path.dirname(os.path.abspath(__file__))
state_dir = os.path.join(here, "state")

def load(name, default):
    path = os.path.join(state_dir, name)
    if not os.path.exists(path):
        return default
    with open(path) as handle:
        return json.load(handle)

def save(name, data):
    os.makedirs(state_dir, exist_ok=True)
    with open(os.path.join(state_dir, name), "w") as handle:
        json.dump(data, handle)

def scope_document(compact):
    if ":" in compact:
        kind, ref = compact.split(":", 1)
        return {"scope_kind": kind, "scope_ref": ref}
    return {"scope_kind": compact, "scope_ref": None}

def digest(setting_ref, scope_compact, value):
    body = f"{setting_ref}|{scope_compact}|{json.dumps(value, sort_keys=True)}"
    return hashlib.sha256(body.encode()).hexdigest()

def effect():
    return {"kind": "value-change", "summary": None, "ref": None}

argv = sys.argv[1:]
verb = argv[0] if argv else ""

if verb == "config-contribution":
    with open(os.path.join(here, "contribution.json")) as handle:
        print(handle.read())
    sys.exit(0)

if verb == "system":
    state = load("state.json", {})
    value = state.get("ai-kit:resolution:model.default")
    print(json.dumps({
        "schema": "oi.product-settings-disclosure/v2",
        "product_id": "ai-kit",
        "availability": {"state": "available", "reason": None},
        "degradations": [],
        "sections": [{
            "id": "resolution",
            "title": "Resolution",
            "settings": [{
                "key": "model.default",
                "axes": {
                    "declared": {"value": value},
                    "effective": {"value": value},
                    "staged": {"stage_state": "none"},
                },
            }],
        }],
        "observed_at_unix_ms": 0,
    }))
    sys.exit(0)

if verb == "config":
    rest = argv[1:]
    sub = rest[0] if rest else ""
    def flag(name):
        return rest[rest.index(name) + 1] if name in rest else None
    if sub == "validate":
        value = json.load(sys.stdin)
        print(json.dumps({
            "schema": "oi.config-validation/v1",
            "setting_ref": flag("--setting"),
            "scope": scope_document(flag("--scope")),
            "valid": True,
            "violations": [],
            "expected_effect": effect(),
        }))
        sys.exit(0)
    if sub == "plan":
        setting_ref = flag("--setting")
        scope_compact = flag("--scope")
        value = json.load(sys.stdin)
        anchor = digest(setting_ref, scope_compact, value)
        plans = load("plans.json", {})
        plans[anchor] = value
        save("plans.json", plans)
        print(json.dumps({
            "schema": "oi.config-plan/v1",
            "plan_id": f"plan-{anchor[:12]}",
            "plan_digest": anchor,
            "setting_ref": setting_ref,
            "scope": scope_document(scope_compact),
            "changes": [{"summary": f"set {setting_ref} at {scope_compact}"}],
            "expected_effect": effect(),
            "expires_at_unix_ms": 0,
        }))
        sys.exit(0)
    if sub == "apply":
        plan = json.load(sys.stdin)
        changeset_id = flag("--changeset")
        key = f"{changeset_id}|{plan['plan_digest']}"
        executed = load("executed.json", {})
        anchor = plan["plan_digest"]
        if key in executed:
            original = executed[key]
            print(json.dumps({
                "schema": "oi.config-receipt/v1",
                "receipt_id": f"{original}-replay",
                "owner_ref": "ai-kit",
                "changeset_id": changeset_id,
                "plan_digest": anchor,
                "setting_ref": plan["setting_ref"],
                "scope": plan["scope"],
                "operation": "apply",
                "outcome": "no_op",
                "applied_at_unix_ms": 0,
                "native_ref": "aikit:history:model.default:1",
                "expected_effect": plan["expected_effect"],
                "original_receipt_id": original,
                "error": None,
            }))
            sys.exit(0)
        receipt_id = f"aikit-receipt-{anchor[:12]}"
        executed[key] = receipt_id
        save("executed.json", executed)
        state = load("state.json", {})
        state[plan["setting_ref"]] = load("plans.json", {}).get(anchor)
        save("state.json", state)
        print(json.dumps({
            "schema": "oi.config-receipt/v1",
            "receipt_id": receipt_id,
            "owner_ref": "ai-kit",
            "changeset_id": changeset_id,
            "plan_digest": anchor,
            "setting_ref": plan["setting_ref"],
            "scope": plan["scope"],
            "operation": "apply",
            "outcome": "applied",
            "applied_at_unix_ms": 0,
            "native_ref": "aikit:history:model.default:1",
            "expected_effect": plan["expected_effect"],
            "original_receipt_id": None,
            "error": None,
        }))
        sys.exit(0)
    if sub == "reset":
        setting_ref = flag("--setting")
        baseline = load("baseline.json", {})
        state = load("state.json", {})
        if setting_ref in baseline:
            state[setting_ref] = baseline[setting_ref]
        else:
            state.pop(setting_ref, None)
        save("state.json", state)
        print(json.dumps({
            "schema": "oi.config-receipt/v1",
            "receipt_id": "aikit-reset-receipt",
            "owner_ref": "ai-kit",
            "changeset_id": flag("--changeset"),
            "plan_digest": None,
            "setting_ref": setting_ref,
            "scope": scope_document(flag("--scope")),
            "operation": "reset",
            "outcome": "applied",
            "applied_at_unix_ms": 0,
            "native_ref": "aikit:history:model.default:2",
            "expected_effect": effect(),
            "original_receipt_id": None,
            "error": None,
        }))
        sys.exit(0)

sys.stderr.write(f"fixture owner does not answer {argv}\n")
sys.exit(9)
"#,
    )
    .expect("fake owner written");
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&script_path, std::fs::Permissions::from_mode(0o755))
            .expect("chmod fake owner");
    }
    // The owner's contribution document: proven shape (same as the C1
    // process-transport fixture), named for the `ai-kit` position.
    std::fs::write(
        bin.join("contribution.json"),
        json!({
            "schema": "oi.configuration-contribution/v1",
            "contract_revision": "configuration-plane/contribution.1",
            "owner": {
                "owner_ref": "ai-kit",
                "owner_kind": "product",
                "owner_version": "0.0.0",
                "contribution_command": ["fixture-owner", "config-contribution", "--json"],
                "disclosed_at_unix_ms": 0,
            },
            "about": "kernel-surface binding fixture owner",
            "sections": [{
                "id": "resolution",
                "title": "Resolution",
                "settings": [{
                    "setting_ref": SETTING_REF,
                    "section_ref": "resolution",
                    "title": "Default model",
                    "value_schema": { "type": "scalar" },
                    "allowed_scopes": [{ "scope_kind": "project", "scope_ref": null }],
                    "writable": true,
                    "profileable": true,
                    "sensitive": false,
                    "effect": { "kind": "value-change", "summary": null, "ref": null },
                    "operations": { "validate": true, "plan": true, "apply": true, "reset": true },
                    "native_ref": "aikit:model.default",
                }],
            }],
            "operations": { "transport": "cli/v1" },
            "availability": { "state": "available", "reason": null },
        })
        .to_string(),
    )
    .expect("contribution written");
    // The owner's native baseline (its own declared truth, 09 §2.2); reset
    // returns the native fact to it.
    std::fs::create_dir_all(bin.join("state")).expect("state dir");
    std::fs::write(
        bin.join("state/state.json"),
        json!({ SETTING_REF: "sonnet-current" }).to_string(),
    )
    .expect("owner baseline written");
    std::fs::write(
        bin.join("state/baseline.json"),
        json!({ SETTING_REF: "sonnet-current" }).to_string(),
    )
    .expect("owner baseline reference written");
    script_path
}

/// A runtime surface catalogue: the deployed catalogue with the `ai-kit`
/// position pointed at the fake owner executable.
fn write_catalogue(home: &Path, owner: &Path) -> PathBuf {
    let deployed = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../surfaces.json");
    let mut catalogue: Value = serde_json::from_str(
        &std::fs::read_to_string(&deployed).expect("deployed catalogue readable"),
    )
    .expect("deployed catalogue is JSON");
    let patched = catalogue["surfaces"]
        .as_array_mut()
        .expect("surfaces array")
        .iter_mut()
        .find(|surface| surface["id"] == "ai-kit")
        .expect("the ai-kit position exists in the deployed catalogue");
    patched["native"]["executable"] = Value::String(owner.display().to_string());
    let path = home.join("catalogue.json");
    std::fs::write(&path, catalogue.to_string()).expect("catalogue written");
    path
}

fn write_request(scene: &Scene, name: &str, document: &Value) -> String {
    let path = scene.work.path().join(name);
    std::fs::write(
        &path,
        serde_json::to_vec(document).expect("request encodes"),
    )
    .expect("request written");
    path.display().to_string()
}

// ---------------------------------------------------------------------------
// The config lifecycle through the real kernel
// ---------------------------------------------------------------------------

#[test]
fn config_lifecycle_runs_through_the_real_kernel_with_persisted_identity() {
    let scene = Scene::open();

    // Discovery ran the real `config-contribution` relation: the fake
    // ai-kit owner is available with its setting listed, and owners that
    // did not answer on this machine are named degradations.
    let listing = scene.run_ok(&["config", "list", "--json"]);
    assert_eq!(listing["schema"], "oi.config-listing/v1");
    assert!(listing["owners"]
        .as_array()
        .expect("owners")
        .iter()
        .any(|owner| { owner["owner_ref"] == "ai-kit" && owner["state"] == "available" }));
    assert!(
        listing["owners"]
            .as_array()
            .expect("owners")
            .iter()
            .any(|owner| owner["state"] == "unavailable"),
        "absent product positions degrade honestly: {:?}",
        listing["owners"]
    );
    assert!(
        listing["settings"]
            .as_array()
            .expect("settings")
            .iter()
            .any(|setting| setting["setting_ref"] == SETTING_REF),
        "the fake owner's setting is listed verbatim"
    );

    // Resolution through the kernel reading path: the owner's v2 axes are
    // the native truth, no desired intent is held yet.
    let reading = scene.run_ok(&["config", "show", SETTING_REF, SCOPE_ARG, "--json"]);
    assert_eq!(reading["schema"], "oi.config-resolution/v1");
    assert_eq!(reading["reconciliation"]["status"], "satisfied");
    assert_eq!(reading["native"]["effective"]["value"], "sonnet-current");
    assert!(reading.get("desired").is_none() || reading["desired"].is_null());

    let got = scene.run_ok(&["config", "get", SETTING_REF, SCOPE_ARG, "--json"]);
    assert_eq!(got["source"], "native");
    assert_eq!(got["value"], "sonnet-current");

    // set → the assembled ChangeSet request document.
    let request = scene.run_ok(&[
        "config",
        "set",
        SETTING_REF,
        "sonnet-next",
        SCOPE_ARG,
        "--json",
    ]);
    assert_eq!(request["schema"], "oi.config-changeset/v1");
    assert_eq!(request["status"], "planned");
    assert_eq!(request["requested"][0]["value"], "sonnet-next");
    let request_path = write_request(&scene, "set-request.json", &request);

    // plan → the owner mints the identity and the idempotency anchor.
    let planned = scene.run_ok(&["config", "plan", "--request-file", &request_path, "--json"]);
    assert_eq!(planned["changeset"]["status"], "validated");
    let plan = &planned["plans"][0];
    assert_eq!(plan["schema"], "oi.config-plan/v1");
    assert_eq!(plan["plan_digest"].as_str().unwrap().len(), 64);

    // apply → owner-native execution, re-read verification, and the SAME
    // changeset/receipt identity persisted under $OI_HOME/configuration.
    let applied = scene.run_ok(&[
        "config",
        "apply",
        "--request-file",
        &request_path,
        "--changeset",
        "cs-binding-1",
        "--json",
    ]);
    assert_eq!(applied["schema"], "oi.config-apply/v1");
    assert_eq!(applied["changeset"]["changeset_id"], "cs-binding-1");
    assert_eq!(applied["changeset"]["status"], "verified");
    let receipt = &applied["receipts"][0];
    assert_eq!(receipt["outcome"], "applied");
    assert_eq!(receipt["changeset_id"], "cs-binding-1");
    assert_eq!(
        applied["changeset"]["operations"][0]["receipt_ref"],
        receipt["receipt_id"]
    );
    assert_eq!(
        applied["changeset"]["verification"]["reconciliations"][0]["status"],
        "satisfied"
    );

    // The kernel persisted the whole truth O:I-side (09 §9): the ChangeSet,
    // the receipt reference, the reconciliation record.
    let changeset_document: Value = serde_json::from_str(
        &std::fs::read_to_string(
            scene
                .configuration_dir()
                .join("changesets")
                .join("cs-binding-1.json"),
        )
        .expect("the executed ChangeSet is persisted"),
    )
    .expect("persisted changeset is JSON");
    assert_eq!(changeset_document["status"], "verified");
    let receipts_dir = scene.configuration_dir().join("receipts");
    let receipt_files: Vec<_> = std::fs::read_dir(&receipts_dir)
        .expect("receipts directory exists")
        .collect();
    assert_eq!(receipt_files.len(), 1, "one receipt reference persisted");
    let stored_receipt: Value = serde_json::from_str(
        &std::fs::read_to_string(receipt_files[0].as_ref().expect("entry").path())
            .expect("receipt readable"),
    )
    .expect("stored receipt is JSON");
    assert_eq!(stored_receipt["receipt_id"], receipt["receipt_id"]);
    assert_eq!(stored_receipt["changeset_id"], "cs-binding-1");
    let reconciliation_dir = scene.configuration_dir().join("reconciliation");
    let reconciliation_files: Vec<_> = std::fs::read_dir(&reconciliation_dir)
        .expect("reconciliation directory exists")
        .collect();
    assert_eq!(reconciliation_files.len(), 1);
    let record: Value = serde_json::from_str(
        &std::fs::read_to_string(reconciliation_files[0].as_ref().expect("entry").path())
            .expect("record readable"),
    )
    .expect("record is JSON");
    assert_eq!(record["status"], "satisfied");
    assert_eq!(record["changeset_id"], "cs-binding-1");

    // Resolution now composes the O:I desired layer over the native truth.
    let got = scene.run_ok(&["config", "get", SETTING_REF, SCOPE_ARG, "--json"]);
    assert_eq!(got["source"], "desired");
    assert_eq!(got["value"], "sonnet-next");
    assert_eq!(got["reconciliation"]["status"], "satisfied");

    // Idempotent replay under the frozen key: the owner does not
    // re-execute and answers `no_op` naming the original receipt (09 §9).
    let replay = scene.run_ok(&[
        "config",
        "apply",
        "--request-file",
        &request_path,
        "--changeset",
        "cs-binding-1",
        "--json",
    ]);
    let replay_receipt = &replay["receipts"][0];
    assert_eq!(replay_receipt["outcome"], "no_op");
    assert_eq!(replay_receipt["original_receipt_id"], receipt["receipt_id"]);
    assert_eq!(replay["changeset"]["status"], "verified");

    // Doctor keys its findings off discovery degradations and the frozen
    // reconciliation table: the absent product positions are named
    // `owner_unavailable`, and the held desired entry (satisfied against
    // the fake owner) raises nothing.
    let doctor = scene.run_ok(&["config", "doctor", "--json"]);
    assert_eq!(doctor["schema"], "oi.config-doctor/v1");
    assert_eq!(doctor["healthy"], false, "{doctor}");
    let findings = doctor["findings"].as_array().expect("findings");
    assert!(
        !findings.is_empty()
            && findings
                .iter()
                .all(|finding| finding["classification"] == "owner_unavailable"),
        "only absent owners are findings here: {findings:?}"
    );
}

// ---------------------------------------------------------------------------
// The profile store, the active mark, and the composed desired layer
// ---------------------------------------------------------------------------

#[test]
fn profile_store_and_active_mark_compose_the_desired_layer() {
    let scene = Scene::open();

    // Import stores inspectable desired state — never applies (09 §12).
    let profile = json!({
        "schema": "oi.profile/v1",
        "profile_ref": "dev",
        "title": "Development",
        "created_at_unix_ms": 0,
        "revised_at_unix_ms": 0,
        "native_profiles": [
            { "owner_ref": "ai-kit", "native_profile_ref": "coding" }
        ],
        "desired": [{
            "setting_ref": SETTING_REF,
            "scope": { "scope_kind": "project", "scope_ref": "binding-test" },
            "value": "sonnet-next",
        }],
    });
    let profile_path = write_request(&scene, "profile.json", &profile);
    let imported = scene.run_ok(&["profile", "import", &profile_path, "--json"]);
    assert_eq!(imported["profile_ref"], "dev");
    assert_eq!(imported["provenance"]["authored_by"], "imported");
    // The C2 store law holds on disk: the profile file is in the store.
    let stored_path = scene.home.path().join("profiles").join("dev.json");
    assert!(
        stored_path.exists(),
        "the profile is stored beside composition.json"
    );

    // `use` writes the composition active mark — the only writer (09 §12).
    let activation = scene.run_ok(&["profile", "use", "dev", "--json"]);
    assert_eq!(activation["schema"], "oi.profile-activation/v1");
    assert_eq!(activation["active_profile"], "dev");
    let composition: Value = serde_json::from_str(
        &std::fs::read_to_string(scene.home.path().join("composition.json"))
            .expect("composition state exists"),
    )
    .expect("composition state is JSON");
    assert_eq!(composition["active_profile"], "dev");

    // The listing shows the store and the mark.
    let listing = scene.run_ok(&["profile", "list", "--json"]);
    assert_eq!(listing["active_profile"], "dev");
    let dev = listing["profiles"]
        .as_array()
        .expect("profiles")
        .iter()
        .find(|profile| profile["profile_ref"] == "dev")
        .expect("the imported profile is listed");
    assert_eq!(dev["desired_entries"], 1);
    assert_eq!(dev["native_profiles"], 1);

    // `oi config diff` sees the profile's desired entries through the REAL
    // kernel: desired sonnet-next vs the owner's native sonnet-current.
    let diff = scene.run_ok(&["config", "diff", "--json"]);
    assert_eq!(diff["schema"], "oi.config-diff/v1");
    let resolutions = diff["resolutions"].as_array().expect("resolutions");
    assert_eq!(resolutions.len(), 1, "{diff}");
    assert_eq!(resolutions[0]["setting_ref"], SETTING_REF);
    assert_eq!(resolutions[0]["desired"]["value"], "sonnet-next");
    assert_eq!(resolutions[0]["reconciliation"]["status"], "drifted");

    // After the same change is applied through the kernel, the profile
    // entry and the recorded desired state are the same layer: satisfied.
    let request = scene.run_ok(&[
        "config",
        "set",
        SETTING_REF,
        "sonnet-next",
        SCOPE_ARG,
        "--json",
    ]);
    let request_path = write_request(&scene, "set-request.json", &request);
    scene.run_ok(&[
        "config",
        "apply",
        "--request-file",
        &request_path,
        "--changeset",
        "cs-binding-2",
        "--json",
    ]);
    let diff = scene.run_ok(&["config", "diff", "--json"]);
    let resolutions = diff["resolutions"].as_array().expect("resolutions");
    assert_eq!(
        resolutions.len(),
        1,
        "explicit sets cover the profile entry"
    );
    assert_eq!(resolutions[0]["reconciliation"]["status"], "satisfied");
}

// ---------------------------------------------------------------------------
// Reset: the fourth verb withdraws desired state truthfully
// ---------------------------------------------------------------------------

#[test]
fn reset_withdraws_desired_state_and_settles_without_intent() {
    let scene = Scene::open();
    let request = scene.run_ok(&[
        "config",
        "set",
        SETTING_REF,
        "sonnet-next",
        SCOPE_ARG,
        "--json",
    ]);
    let request_path = write_request(&scene, "set-request.json", &request);
    scene.run_ok(&[
        "config",
        "apply",
        "--request-file",
        &request_path,
        "--changeset",
        "cs-reset-scene",
        "--json",
    ]);
    let changesets_dir = scene.configuration_dir().join("changesets");
    assert_eq!(
        std::fs::read_dir(&changesets_dir)
            .expect("changesets")
            .count(),
        1
    );

    let applied = scene.run_ok(&["config", "reset", SETTING_REF, SCOPE_ARG, "--json"]);
    assert_eq!(applied["schema"], "oi.config-apply/v1");
    assert_eq!(applied["changeset"]["status"], "verified");
    assert_eq!(applied["receipts"][0]["operation"], "reset");
    assert_eq!(applied["receipts"][0]["outcome"], "applied");

    // The desired intent is withdrawn O:I-side; resolution falls back to
    // the owner's own truth with no desired held (09 §7.1).
    let got = scene.run_ok(&["config", "get", SETTING_REF, SCOPE_ARG, "--json"]);
    assert_eq!(got["source"], "native");
    assert_eq!(got["value"], "sonnet-current");
    assert_eq!(got["reconciliation"]["status"], "satisfied");

    // The reset ChangeSet persisted beside the apply's — the fold over both
    // is the desired layer.
    assert_eq!(
        std::fs::read_dir(&changesets_dir)
            .expect("changesets")
            .count(),
        2
    );
}
