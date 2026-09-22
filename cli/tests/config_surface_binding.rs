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

    /// Run a command and return its exit code with the raw output text —
    /// for the plain (non-JSON) renderings.
    fn run_raw(&self, args: &[&str]) -> (i32, String) {
        let output = self.oi().args(args).output().expect("the oi binary runs");
        (
            output.status.code().unwrap_or(-1),
            format!(
                "{}{}",
                String::from_utf8_lossy(&output.stdout),
                String::from_utf8_lossy(&output.stderr)
            ),
        )
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
            }, {
                "id": "providers",
                "title": "Providers",
                "settings": [{
                    "setting_ref": "ai-kit:providers:credentials.anthropic",
                    "section_ref": "providers",
                    "title": "Anthropic credential reference",
                    "value_schema": { "type": "secret" },
                    "allowed_scopes": [{ "scope_kind": "world", "scope_ref": null }],
                    "writable": true,
                    "profileable": true,
                    "sensitive": true,
                    "effect": { "kind": "provider-reconnect-required", "summary": null, "ref": null },
                    "operations": { "validate": true, "plan": true, "apply": true, "reset": true },
                    "native_ref": "aikit:credentials:anthropic-key",
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
/// position pointed at the fake owner executable and every other product
/// position pointed at a guaranteed-absent executable. The other positions
/// keep bare names in the deployed catalogue, and bare names resolve through
/// the ambient `PATH` — on a machine with the suite installed the real
/// products answer discovery, and the scene's assertions about absent
/// positions (`config list` degradations, `config doctor`'s
/// `owner_unavailable` findings) would flip with whatever is installed.
/// Absence is by construction here, not machine luck.
fn write_catalogue(home: &Path, owner: &Path) -> PathBuf {
    let deployed = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../surfaces.json");
    let mut catalogue: Value = serde_json::from_str(
        &std::fs::read_to_string(&deployed).expect("deployed catalogue readable"),
    )
    .expect("deployed catalogue is JSON");
    for surface in catalogue["surfaces"]
        .as_array_mut()
        .expect("surfaces array")
        .iter_mut()
    {
        if surface["id"] == "ai-kit" {
            surface["native"]["executable"] = Value::String(owner.display().to_string());
        } else {
            let id = surface["id"].as_str().unwrap_or("unknown").to_owned();
            surface["native"]["executable"] =
                Value::String(format!("/nonexistent/oi-env-isolation/{id}"));
        }
    }
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

/// The listing reports each owner's own probed availability (07 §4.7,
/// carried into 09 §2.1) — never a hardcoded literal. An owner that answers
/// the discovery read but discloses itself unavailable is listed exactly as
/// it disclosed, reason attached, and flips back when the owner recovers.
#[test]
fn listing_reports_the_owners_own_disclosed_availability() {
    let scene = Scene::open();
    let listed = scene.run_ok(&["config", "list", "--json"]);
    let owner = listed["owners"]
        .as_array()
        .expect("owners array")
        .iter()
        .find(|owner| owner["owner_ref"] == "ai-kit")
        .expect("the answering owner is listed")
        .clone();
    assert_eq!(owner["state"], "available");
    assert!(owner["reason"].is_null());

    // The owner withdraws: the same discovery read now discloses
    // unavailability with its reason (the frozen unavailable-owner shape of
    // `contribution-unavailable.json`: zero sections, honest availability).
    let contribution_path = scene.home.path().join("bin").join("contribution.json");
    let mut contribution: Value =
        serde_json::from_str(&std::fs::read_to_string(&contribution_path).expect("contribution"))
            .expect("contribution parses");
    contribution["availability"] =
        json!({"state": "unavailable", "reason": "scene owner withdraws"});
    contribution["sections"] = json!([]);
    std::fs::write(&contribution_path, contribution.to_string()).expect("contribution rewritten");

    let listed = scene.run_ok(&["config", "list", "--json"]);
    let owner = listed["owners"]
        .as_array()
        .expect("owners array")
        .iter()
        .find(|owner| owner["owner_ref"] == "ai-kit")
        .expect("the withdrawn owner is still listed — absence is data")
        .clone();
    assert_eq!(owner["state"], "unavailable");
    assert_eq!(owner["reason"], "scene owner withdraws");
    assert!(
        listed["settings"]
            .as_array()
            .expect("settings array")
            .iter()
            .all(|setting| setting["owner_ref"] != "ai-kit"),
        "a withdrawn owner fabricates no settings"
    );
}

/// The frozen error vocabulary holds at the command layer in the no-scope
/// path too: an unknown setting is `unsupported_setting`, an omitted scope
/// the contribution cannot default is `unsupported_scope` naming the
/// disclosed scopes — the same codes the engine answers with when a scope
/// argument is present (09 §13; headless callers key on the code).
#[test]
fn frozen_error_codes_hold_without_a_scope_argument() {
    let scene = Scene::open();

    // Unknown setting, no scope argument: unsupported_setting.
    let (code, error, _) = scene.run(&["config", "show", "nope:section:key", "--json"]);
    assert_eq!(code, 1);
    assert_eq!(error["error_code"], "unsupported_setting");
    assert_eq!(error["setting_ref"], "nope:section:key");

    // Known setting whose single allowed scope is non-singular, no scope
    // argument: unsupported_scope naming the disclosed scope.
    let (code, error, _) = scene.run(&["config", "show", SETTING_REF, "--json"]);
    assert_eq!(code, 1);
    assert_eq!(error["error_code"], "unsupported_scope");
    assert_eq!(error["setting_ref"], SETTING_REF);

    // With an explicit scope the engine classifies the unknown owner
    // itself — the same frozen code, from the resolve path.
    let (code, error, _) = scene.run(&[
        "config",
        "get",
        "nope:section:key",
        "project:binding-test",
        "--json",
    ]);
    assert_eq!(code, 1);
    assert_eq!(error["error_code"], "unsupported_setting");
}

// ---------------------------------------------------------------------------
// Held desired intent: hold drifts without touching the owner; discard
// withdraws; an executed ChangeSet retires the hold
// ---------------------------------------------------------------------------

#[test]
fn hold_records_intent_without_touching_the_owner_and_discard_withdraws_it() {
    let scene = Scene::open();

    // Before any hold: no desired, the owner's own native axis only.
    let before = scene.run_ok(&["config", "show", SETTING_REF, SCOPE_ARG, "--json"]);
    assert_eq!(before["desired"], Value::Null);
    assert_eq!(before["native"]["effective"]["value"], "sonnet-current");
    assert_eq!(before["reconciliation"]["status"], "satisfied");

    // Hold desired intent: the same addressing/secret law as `set`, and
    // nothing native moves (09 §7 — desired is O:I's own axis).
    let held = scene.run_ok(&[
        "config",
        "hold",
        SETTING_REF,
        "sonnet-next",
        SCOPE_ARG,
        "--json",
    ]);
    assert_eq!(held["setting_ref"], SETTING_REF);
    assert_eq!(held["value"], "sonnet-next");

    // The resolution reads drifted: desired carried beside the owner's own
    // untouched native fact.
    let show = scene.run_ok(&["config", "show", SETTING_REF, SCOPE_ARG, "--json"]);
    assert_eq!(show["desired"]["value"], "sonnet-next");
    assert_eq!(show["native"]["effective"]["value"], "sonnet-current");
    assert_eq!(show["reconciliation"]["status"], "drifted");

    // The owner's native state stayed at its baseline through `get`.
    let got = scene.run_ok(&["config", "get", SETTING_REF, SCOPE_ARG, "--json"]);
    assert_eq!(got["source"], "desired", "the hold speaks first: {got}");

    // The hold persists in the O:I configuration store, beside the fold.
    let desired_dir = scene.configuration_dir().join("desired");
    let stored: Vec<_> = std::fs::read_dir(&desired_dir)
        .expect("desired records directory exists")
        .collect();
    assert_eq!(stored.len(), 1, "one held record on disk");

    // A second hold of the same subject replaces the first.
    scene.run_ok(&["config", "hold", SETTING_REF, "opus", SCOPE_ARG, "--json"]);
    let show = scene.run_ok(&["config", "show", SETTING_REF, SCOPE_ARG, "--json"]);
    assert_eq!(show["desired"]["value"], "opus");
    let stored: Vec<_> = std::fs::read_dir(&desired_dir)
        .expect("desired records directory")
        .collect();
    assert_eq!(stored.len(), 1, "the replacement kept one record");

    // Discard withdraws the intent; the owner was never touched.
    let discarded = scene.run_ok(&["config", "discard", SETTING_REF, SCOPE_ARG, "--json"]);
    assert_eq!(discarded["schema"], "oi.config-discard/v1");
    assert_eq!(discarded["removed"], true);
    let show = scene.run_ok(&["config", "show", SETTING_REF, SCOPE_ARG, "--json"]);
    assert_eq!(show["desired"], Value::Null);
    assert_eq!(show["reconciliation"]["status"], "satisfied");

    // Discarding again observes the absence.
    let discarded = scene.run_ok(&["config", "discard", SETTING_REF, SCOPE_ARG, "--json"]);
    assert_eq!(discarded["removed"], false);
}

#[test]
fn executed_changeset_retires_the_hold_and_secret_holds_carry_references_only() {
    let scene = Scene::open();

    // A secret-kind hold carries the owner-namespace reference — never
    // material, never a `value` (09 §14).
    let held = scene.run_ok(&[
        "config",
        "hold",
        "ai-kit:providers:credentials.anthropic",
        "aikit:credentials:held-ref",
        "world",
        "--json",
    ]);
    assert!(
        held.get("value").is_none(),
        "a secret hold carries no value: {held}"
    );
    assert_eq!(
        held["secret_reference"]["ref"],
        "aikit:credentials:held-ref"
    );

    // A value hold at the project scope, then applied: the executed
    // ChangeSet settles the subject, and the hold retires — exactly one
    // O:I record speaks for it (the fold, not the overlay).
    scene.run_ok(&[
        "config",
        "hold",
        SETTING_REF,
        "sonnet-next",
        SCOPE_ARG,
        "--json",
    ]);
    let request = scene.run_ok(&[
        "config",
        "set",
        SETTING_REF,
        "sonnet-next",
        SCOPE_ARG,
        "--json",
    ]);
    let request_path = write_request(&scene, "hold-apply.json", &request);
    let applied = scene.run_ok(&[
        "config",
        "apply",
        "--request-file",
        &request_path,
        "--changeset",
        "cs-hold-apply-1",
        "--json",
    ]);
    assert_eq!(applied["schema"], "oi.config-apply/v1");
    assert_eq!(applied["changeset"]["status"], "verified");

    // The desired state still reads (now from the ChangeSet fold), and the
    // overlay record is gone.
    let show = scene.run_ok(&["config", "show", SETTING_REF, SCOPE_ARG, "--json"]);
    assert_eq!(show["desired"]["value"], "sonnet-next");
    assert_eq!(show["reconciliation"]["status"], "satisfied");
    let desired_dir = scene.configuration_dir().join("desired");
    let remaining: Vec<_> = std::fs::read_dir(&desired_dir)
        .expect("desired records directory")
        .collect();
    assert_eq!(remaining.len(), 1, "only the secret hold remains");

    // The secret hold survives the unrelated apply and still reads as a
    // reference beside the owner's presence fact.
    let secret_show = scene.run_ok(&[
        "config",
        "show",
        "ai-kit:providers:credentials.anthropic",
        "world",
        "--json",
    ]);
    assert_eq!(
        secret_show["desired"]["secret_reference"]["ref"],
        "aikit:credentials:held-ref"
    );
    assert!(secret_show["desired"].get("value").is_none());
}

// ---------------------------------------------------------------------------
// `oi profile edit`: in-place desired edits through the store's own laws
// ---------------------------------------------------------------------------

#[test]
fn profile_edit_rewrites_desired_in_place_and_reports_what_changed() {
    let scene = Scene::open();

    let created = scene.run_ok(&["profile", "create", "dev", "--json"]);
    assert_eq!(created["profile_ref"], "dev");

    // Add: one entry, reported by name, stored in the profile document.
    let edited = scene.run_ok(&[
        "profile",
        "edit",
        "dev",
        "--set",
        SETTING_REF,
        "sonnet-next",
        SCOPE_ARG,
        "--json",
    ]);
    assert_eq!(edited["schema"], "oi.profile-edit/v1");
    assert_eq!(edited["profile"]["profile_ref"], "dev");
    assert_eq!(edited["applied"][0]["action"], "entry_added");
    assert_eq!(edited["applied"][0]["next"]["value"], "sonnet-next");
    assert_eq!(edited["profile"]["desired"][0]["value"], "sonnet-next");

    // Nothing was applied and nothing was activated: the owner's native
    // fact is unchanged and no desired state is held yet — edit composes
    // with the explicit use/plan/apply flow, never replacing it.
    let got = scene.run_ok(&["config", "get", SETTING_REF, SCOPE_ARG, "--json"]);
    assert_eq!(got["source"], "native", "{got}");
    let diff = scene.run_ok(&["config", "diff", "--json"]);
    assert_eq!(
        diff["resolutions"].as_array().expect("resolutions").len(),
        0,
        "an edit never activates a profile or touches an owner: {diff}"
    );

    // Update: the same (setting, scope) is replaced in place, and the
    // report names the previous entry.
    let edited = scene.run_ok(&[
        "profile",
        "edit",
        "dev",
        "--set",
        SETTING_REF,
        "opus",
        SCOPE_ARG,
        "--json",
    ]);
    assert_eq!(edited["applied"][0]["action"], "entry_updated");
    assert_eq!(edited["applied"][0]["previous"]["value"], "sonnet-next");
    assert_eq!(edited["applied"][0]["next"]["value"], "opus");
    assert_eq!(
        edited["profile"]["desired"]
            .as_array()
            .expect("desired")
            .len(),
        1,
        "the replacement kept one entry"
    );

    // The store's own file law holds on the edited document: 0600.
    let stored = scene.home.path().join("profiles").join("dev.json");
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mode = std::fs::metadata(&stored)
            .expect("stored profile")
            .permissions()
            .mode();
        assert_eq!(mode & 0o777, 0o600, "edited profiles stay 0600");
    }

    // Secret law: a secret-kind entry carries the reference and never a
    // value (09 §14) — the same normalisation as any change request.
    let edited = scene.run_ok(&[
        "profile",
        "edit",
        "dev",
        "--set",
        "ai-kit:providers:credentials.anthropic",
        "aikit:credentials:held-ref",
        "world",
        "--json",
    ]);
    assert_eq!(edited["applied"][0]["action"], "entry_added");
    assert_eq!(
        edited["profile"]["desired"][1]["secret_reference"]["ref"],
        "aikit:credentials:held-ref"
    );
    assert!(edited["profile"]["desired"][1].get("value").is_none());

    // show reads the edited document back from the store.
    let shown = scene.run_ok(&["profile", "show", "dev", "--json"]);
    assert_eq!(shown["desired"].as_array().expect("desired").len(), 2);

    // Removal by setting+scope; removing an absent entry reads as absence.
    let removed = scene.run_ok(&[
        "profile",
        "edit",
        "dev",
        "--remove",
        SETTING_REF,
        SCOPE_ARG,
        "--json",
    ]);
    assert_eq!(removed["applied"][0]["action"], "entry_removed");
    assert_eq!(removed["applied"][0]["previous"]["value"], "opus");

    let absent = scene.run_ok(&[
        "profile",
        "edit",
        "dev",
        "--remove",
        SETTING_REF,
        SCOPE_ARG,
        "--json",
    ]);
    assert_eq!(absent["applied"][0]["action"], "entry_absent");

    // A removal without a scope that matches several held entries refuses,
    // names the scopes, and stores nothing — no partial edit.
    scene.run_ok(&[
        "profile",
        "edit",
        "dev",
        "--set",
        SETTING_REF,
        "opus",
        SCOPE_ARG,
        "--set",
        SETTING_REF,
        "opus",
        "project:other",
        "--json",
    ]);
    let (code, error, _) =
        scene.run(&["profile", "edit", "dev", "--remove", SETTING_REF, "--json"]);
    assert_eq!(code, 1);
    assert_eq!(error["error_code"], "invalid_value");
    assert!(
        error["message"]
            .as_str()
            .expect("message")
            .contains("several scopes"),
        "{error}"
    );
    let shown = scene.run_ok(&["profile", "show", "dev", "--json"]);
    assert_eq!(
        shown["desired"].as_array().expect("desired").len(),
        3,
        "a refused edit stores nothing: the two held entries and the secret stay"
    );

    // The engine's own addressing law refuses an unknown setting.
    let (code, error, _) = scene.run(&[
        "profile",
        "edit",
        "dev",
        "--set",
        "nope:section:key",
        "x",
        SCOPE_ARG,
        "--json",
    ]);
    assert_eq!(code, 1);
    assert_eq!(error["error_code"], "unsupported_setting");

    // Title/description edits and clears ride the same operation set.
    let titled = scene.run_ok(&[
        "profile",
        "edit",
        "dev",
        "--title",
        "Staging",
        "--description",
        "Sparse staging intent",
        "--json",
    ]);
    assert_eq!(titled["profile"]["title"], "Staging");
    let cleared = scene.run_ok(&["profile", "edit", "dev", "--clear-title", "--json"]);
    assert!(cleared["profile"]["title"].is_null());

    // The plain report names exactly what changed and says nothing was
    // applied.
    let (code, text) = scene.run_raw(&[
        "profile",
        "edit",
        "dev",
        "--set",
        SETTING_REF,
        "sonnet-next",
        SCOPE_ARG,
    ]);
    assert_eq!(code, 0, "{text}");
    assert!(text.contains("Profile `dev` edited"), "{text}");
    assert!(text.contains("nothing was applied"), "{text}");
    assert!(
        text.contains("set ai-kit:resolution:model.default"),
        "{text}"
    );
}

// ---------------------------------------------------------------------------
// Receipts listing: a reading of the recorded refs, never a second store
// ---------------------------------------------------------------------------

#[test]
fn receipts_listing_reads_the_recorded_refs_and_names_absence() {
    let scene = Scene::open();

    // Nothing recorded yet: an empty listing, never invented content.
    let (code, empty, _) = scene.run(&["config", "receipts", "--json"]);
    assert_eq!(code, 0);
    assert_eq!(empty["schema"], "oi.config-receipts/v1");
    assert_eq!(empty["receipts"].as_array().expect("receipts").len(), 0);

    // Apply one ChangeSet through the owner: the receipt ref is recorded
    // under the O:I configuration store.
    let request = scene.run_ok(&[
        "config",
        "set",
        SETTING_REF,
        "sonnet-next",
        SCOPE_ARG,
        "--json",
    ]);
    let request_path = write_request(&scene, "receipts-request.json", &request);
    let applied = scene.run_ok(&[
        "config",
        "apply",
        "--request-file",
        &request_path,
        "--changeset",
        "cs-receipts-1",
        "--json",
    ]);
    let receipt_id = applied["receipts"][0]["receipt_id"].clone();

    // The listing reads the recorded ref with its identity intact.
    let listed = scene.run_ok(&["config", "receipts", "--json"]);
    assert_eq!(listed["schema"], "oi.config-receipts/v1");
    let rows = listed["receipts"].as_array().expect("receipt rows");
    assert_eq!(rows.len(), 1);
    assert_eq!(rows[0]["receipt_id"], receipt_id);
    assert_eq!(rows[0]["owner_ref"], "ai-kit");
    assert_eq!(rows[0]["changeset_id"], "cs-receipts-1");
    assert_eq!(rows[0]["operation"], "apply");
    assert_eq!(rows[0]["outcome"], "applied");
    assert_eq!(rows[0]["native_ref"], "aikit:history:model.default:1");

    // Filtering is by the changeset identity; an unknown changeset reads
    // as named absence — an empty list, not an error and not a fabrication.
    let filtered = scene.run_ok(&[
        "config",
        "receipts",
        "--changeset",
        "cs-receipts-1",
        "--json",
    ]);
    assert_eq!(filtered["receipts"].as_array().expect("receipts").len(), 1);
    let absent = scene.run_ok(&["config", "receipts", "--changeset", "cs-absent", "--json"]);
    assert_eq!(absent["receipts"].as_array().expect("receipts").len(), 0);

    // The plain form carries the same identity.
    let (code, text) = scene.run_raw(&["config", "receipts"]);
    assert_eq!(code, 0, "{text}");
    assert!(
        text.contains(receipt_id.as_str().expect("receipt id")),
        "{text}"
    );
    assert!(text.contains("owner-minted identity"), "{text}");
}
