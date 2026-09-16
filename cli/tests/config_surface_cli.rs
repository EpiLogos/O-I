//! C5 lane tests: the native `oi config` / `oi profile` surface over the C5
//! engine seam, driven through the real binary against the frozen C0
//! conformance fixtures (`suite/configuration/cases/`). These prove the
//! #299 §20 acceptance that is decidable now: ordinary contributed settings
//! need no product-specific command code; reads/diffs/plans/applications
//! have JSON forms; unsupported scopes and absent owners are explicit
//! structured errors; secrets stay references; ChangeSet/receipt identity
//! flows through output intact.
//!
//! The fixture-backed surface is in memory by law (the C2 profile store owns
//! persistence), so each binary invocation starts from the fixture state;
//! stateful behaviour — idempotent replay, desired state after apply — is
//! proven at the seam level in `fixture_surface` / the seam tests.

use oi_cli::configuration::{ReceiptOutcome, ReconciliationStatus};
use serde_json::Value;
use std::path::{Path, PathBuf};
use std::process::Command;
use tempfile::TempDir;

fn cases_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../suite/configuration/cases")
}

fn oi() -> Command {
    let mut command = Command::new(env!("CARGO_BIN_EXE_oi"));
    command
        .env("OI_CONFIG_SURFACE_FIXTURES", cases_dir())
        .env("OI_HOME", std::env::temp_dir().join("oi-c5-tests-home"));
    command
}

fn run(args: &[&str]) -> (i32, Value, String) {
    let output = oi().args(args).output().expect("the oi binary runs");
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let json = if stdout.trim().is_empty() {
        Value::Null
    } else {
        serde_json::from_str(&stdout)
            .unwrap_or_else(|error| panic!("stdout is not JSON ({error}): {stdout}"))
    };
    (output.status.code().unwrap_or(-1), json, stdout)
}

#[test]
fn help_screens_are_wired_and_the_real_engine_binds_without_fixtures() {
    let output = oi().args(["config", "--help"]).output().unwrap();
    assert!(output.status.success());
    let text = String::from_utf8_lossy(&output.stdout);
    assert!(text.contains("oi config set"), "{text}");
    assert!(text.contains("config-contribution"), "{text}");

    let output = oi().args(["profile", "--help"]).output().unwrap();
    assert!(output.status.success());
    let text = String::from_utf8_lossy(&output.stdout);
    assert!(text.contains("oi profile use"), "{text}");

    // Without fixtures the REAL engine binds (kernel_surface.rs): discovery
    // runs over the product positions and reports honestly — owners that do
    // not answer on this machine are named `unavailable` degradations, and
    // the listing is still a well-formed reading. It never fabricates
    // settings for an owner that did not contribute.
    let mut command = oi();
    command.env_remove("OI_CONFIG_SURFACE_FIXTURES");
    let output = command.args(["config", "list", "--json"]).output().unwrap();
    assert_eq!(output.status.code(), Some(0));
    let listing: Value = serde_json::from_str(&String::from_utf8_lossy(&output.stdout))
        .expect("the real engine answers with a JSON listing");
    assert_eq!(listing["schema"], "oi.config-listing/v1");
    let owners = listing["owners"].as_array().expect("owners array");
    assert!(
        owners.iter().any(|owner| owner["state"] == "unavailable"),
        "owners that did not answer are named degradations: {owners:?}"
    );
}

#[test]
fn ordinary_setting_round_trips_set_plan_apply_and_receipt_identity() {
    // A CLI set → ChangeSet request → owner-native plan → apply → receipt.
    let (code, request, _) = run(&[
        "config",
        "set",
        "ai-kit:resolution:model.default",
        "sonnet-next",
        "project:epilogos/o-i",
        "--json",
    ]);
    assert_eq!(code, 0, "set succeeds");
    assert_eq!(request["schema"], "oi.config-changeset/v1");
    assert_eq!(request["status"], "planned");
    assert_eq!(request["requested"][0]["value"], "sonnet-next");
    assert!(request["changeset_id"].as_str().unwrap().starts_with("cs-"));

    let request_path = std::env::temp_dir().join("oi-c5-simple-request.json");
    std::fs::write(&request_path, serde_json::to_vec(&request).unwrap()).unwrap();
    let request_arg = request_path.to_str().unwrap().to_owned();

    // The owner-native plan is inspectable and carries the idempotency
    // anchor; nothing mutates at plan time.
    let (code, planned, _) = run(&["config", "plan", "--request-file", &request_arg, "--json"]);
    assert_eq!(code, 0);
    assert_eq!(planned["changeset"]["status"], "validated");
    let plan = &planned["plans"][0];
    assert_eq!(plan["schema"], "oi.config-plan/v1");
    assert_eq!(plan["setting_ref"], "ai-kit:resolution:model.default");
    assert_eq!(plan["expected_effect"]["kind"], "session-restart-required");
    let digest = plan["plan_digest"].as_str().unwrap();
    assert_eq!(digest.len(), 64, "sha256 hex idempotency anchor");

    let (code, applied, stdout) =
        run(&["config", "apply", "--request-file", &request_arg, "--json"]);
    assert_eq!(code, 0, "{stdout}");
    assert_eq!(applied["schema"], "oi.config-apply/v1");
    let changeset = &applied["changeset"];
    assert_eq!(changeset["status"], "verified");
    assert_eq!(changeset["operations"][0]["status"], "verified");
    let receipt = &applied["receipts"][0];
    assert_eq!(receipt["schema"], "oi.config-receipt/v1");
    assert_eq!(receipt["outcome"], "applied");
    // Receipt identity flows through intact: the ChangeSet names the
    // owner-minted receipt, and the receipt names the ChangeSet.
    assert_eq!(
        changeset["operations"][0]["receipt_ref"],
        receipt["receipt_id"]
    );
    assert_eq!(receipt["changeset_id"], changeset["changeset_id"]);
    // Re-read verification on the ChangeSet.
    assert_eq!(
        changeset["verification"]["reconciliations"][0]["status"],
        "satisfied"
    );
    // Digest stability: applying the PLANNED document re-plans to the same
    // anchor, so the operation digest equals the standalone plan's digest.
    assert_eq!(
        changeset["operations"][0]["plan_digest"],
        plan["plan_digest"]
    );
}

#[test]
fn unsupported_scope_and_unknown_scope_kind_are_explicit_errors() {
    // `world` is not in the setting's allowed_scopes — never a fallback.
    let (code, error, _) = run(&[
        "config",
        "set",
        "ai-kit:resolution:model.default",
        "sonnet-next",
        "world",
        "--json",
    ]);
    assert_eq!(code, 1);
    assert_eq!(error["schema"], "oi.config-error/v1");
    assert_eq!(error["error_code"], "unsupported_scope");
    assert_eq!(error["scope_kind"], "world");
    assert_eq!(error["setting_ref"], "ai-kit:resolution:model.default");

    // A kind outside the frozen registry is `unknown_scope_kind`.
    let (code, error, _) = run(&[
        "config",
        "show",
        "ai-kit:resolution:model.default",
        "cluster:west",
        "--json",
    ]);
    assert_eq!(code, 1);
    assert_eq!(error["error_code"], "unknown_scope_kind");
}

#[test]
fn absent_owners_and_unknown_settings_are_distinct_explicit_errors() {
    // workcell disclosed itself unavailable: its settings are absent and the
    // error names the owner, not the setting.
    let (code, error, _) = run(&[
        "config",
        "show",
        "workcell:placement:placement.policy",
        "world",
        "--json",
    ]);
    assert_eq!(code, 1);
    assert_eq!(error["error_code"], "owner_unavailable");

    // An entirely unknown owner is an unsupported setting.
    let (code, error, _) = run(&["config", "get", "nope:section:key", "world", "--json"]);
    assert_eq!(code, 1);
    assert_eq!(error["error_code"], "unsupported_setting");
}

#[test]
fn secret_settings_carry_references_and_never_material() {
    // The value argument for a secret-kind setting IS the owner-namespace
    // reference; the ChangeSet carries `secret_reference` and no `value`.
    let (code, request, stdout) = run(&[
        "config",
        "set",
        "ai-kit:providers:credentials.anthropic",
        "aikit:credentials:anthropic-key",
        "world",
        "--json",
    ]);
    assert_eq!(code, 0, "{stdout}");
    let requested = &request["requested"][0];
    assert!(
        requested.get("value").is_none(),
        "a secret-kind request must not carry `value`: {requested}"
    );
    assert_eq!(
        requested["secret_reference"]["ref"],
        "aikit:credentials:anthropic-key"
    );

    // `get` on a secret-kind setting never emits a `value` key at all.
    let (code, reading, stdout) = run(&[
        "config",
        "get",
        "ai-kit:providers:credentials.anthropic",
        "world",
        "--json",
    ]);
    assert_eq!(code, 0, "{stdout}");
    assert!(
        reading.get("value").is_none(),
        "secret-kind get must not carry `value`: {reading}"
    );
    assert!(!stdout.contains("sk-"), "credential material appeared");
}

#[test]
fn connector_setting_needs_no_product_specific_code() {
    let (code, request, stdout) = run(&[
        "config",
        "set",
        "connector/factory-actuation:authority:authority.mode",
        "delegated",
        "connector-relation:factory-actuation",
        "--json",
    ]);
    assert_eq!(code, 0, "{stdout}");
    assert_eq!(
        request["operations"][0]["owner_ref"],
        "connector/factory-actuation"
    );
    assert_eq!(request["requested"][0]["value"], "delegated");
}

#[test]
fn doctor_distinguishes_unavailable_owners_and_reconciliation_findings() {
    let (code, doctor, _) = run(&["config", "doctor", "--json"]);
    assert_eq!(code, 0);
    assert_eq!(doctor["schema"], "oi.config-doctor/v1");
    assert_eq!(doctor["healthy"], false);
    let findings = doctor["findings"].as_array().unwrap();
    let classifications: Vec<&str> = findings
        .iter()
        .map(|finding| finding["classification"].as_str().unwrap())
        .collect();
    // The unavailable owner is a named finding, never silence.
    assert!(
        classifications.contains(&"owner_unavailable"),
        "{classifications:?}"
    );
}

#[test]
fn doctor_keys_reconciliation_findings_off_the_frozen_truth_table() {
    let (config, profiles) = fixture_surface();
    // The active profile composes the World's desired state; its entries are
    // judged by the frozen reconciliation vocabulary, never by guesses.
    profiles.set_active(Some("development")).unwrap();
    let findings = config.doctor().unwrap();
    let by_classification = |needle: &str| {
        findings
            .iter()
            .find(|finding| finding.classification.as_wire() == needle)
            .unwrap_or_else(|| panic!("no {needle} finding in {findings:?}"))
    };
    // model.default has a computed default: no native axis may be copied, so
    // the honest reconciliation is `unknown` → runtime degradation.
    let degradation = by_classification("runtime_degradation");
    assert_eq!(
        degradation.setting_ref.as_deref(),
        Some("ai-kit:resolution:model.default")
    );
    assert_eq!(
        degradation.reconciliation_status,
        Some(ReconciliationStatus::Unknown)
    );
}

#[test]
fn profile_lifecycle_exposes_frozen_documents() {
    let (code, listing, _) = run(&["profile", "list", "--json"]);
    assert_eq!(code, 0);
    assert_eq!(listing["schema"], "oi.profile-listing/v1");
    let development = listing["profiles"]
        .as_array()
        .unwrap()
        .iter()
        .find(|profile| profile["profile_ref"] == "development")
        .expect("the fixture profile is listed");
    assert_eq!(development["desired_entries"], 5);

    let (code, activation, _) = run(&["profile", "use", "development", "--json"]);
    assert_eq!(code, 0);
    assert_eq!(activation["schema"], "oi.profile-activation/v1");
    assert_eq!(activation["active_profile"], "development");

    let (code, diff, _) = run(&["profile", "diff", "development", "--json"]);
    assert_eq!(code, 0);
    assert_eq!(diff["schema"], "oi.config-diff/v1");
    let resolutions = diff["resolutions"].as_array().unwrap();
    assert_eq!(resolutions.len(), 5);
    let secret_entry = resolutions
        .iter()
        .find(|resolution| resolution["setting_ref"] == "ai-kit:providers:credentials.anthropic")
        .unwrap();
    // The secret-kind desired entry carries the reference, never a value.
    assert!(
        secret_entry["desired"].get("value").is_none()
            || secret_entry["desired"]["value"].is_null(),
        "{secret_entry}"
    );
    assert_eq!(
        secret_entry["desired"]["secret_reference"]["ref"],
        "aikit:credentials:anthropic-key"
    );

    let (code, exported, _) = run(&["profile", "export", "development", "--json"]);
    assert_eq!(code, 0);
    assert_eq!(exported["schema"], "oi.profile/v1");
    assert_eq!(
        exported["native_profiles"][0]["native_profile_ref"],
        "coding"
    );

    // Import stores inspectable desired state and is round-trip stable.
    let exported_path = std::env::temp_dir().join("oi-c5-exported-profile.json");
    std::fs::write(&exported_path, serde_json::to_vec(&exported).unwrap()).unwrap();
    let (code, imported, stdout) = run(&[
        "profile",
        "import",
        &format!("{}", exported_path.display()),
        "--json",
    ]);
    assert_eq!(code, 0, "{stdout}");
    assert_eq!(imported["profile_ref"], exported["profile_ref"]);
    assert_eq!(imported["provenance"]["authored_by"], "imported");
}

#[test]
fn dispatcher_passthrough_discloses_the_owner_contribution() {
    // `oi <namespace> config-contribution --json` resolves the namespace to
    // the deployed owner executable exactly as `system --json` does (C0 §4):
    // the document is emitted bare, no envelope.
    let bin = TempDir::new().unwrap();
    let aikit = fake_executable(bin.path(), "aikit");
    let mut command = oi();
    command.env("PATH", bin.path());
    let output = command
        .args(["aikit", "config-contribution", "--json"])
        .output()
        .unwrap();
    assert!(output.status.success());
    let stdout = String::from_utf8_lossy(&output.stdout);
    let document: Value =
        serde_json::from_str(stdout.trim()).expect("the contribution document is emitted bare");
    assert_eq!(document["schema"], "oi.configuration-contribution/v1");
    assert_eq!(document["owner"]["owner_ref"], "ai-kit");
    let _ = aikit;
}

#[cfg(unix)]
fn fake_executable(dir: &Path, name: &str) -> PathBuf {
    use std::fs;
    use std::os::unix::fs::PermissionsExt;
    let path = dir.join(name);
    fs::write(
        &path,
        "#!/bin/sh\nprintf '%s\\n' '{\"schema\":\"oi.configuration-contribution/v1\",\"owner\":{\"owner_ref\":\"ai-kit\",\"owner_kind\":\"product\",\"owner_version\":\"0.0.0\",\"contribution_command\":[\"aikit\",\"config-contribution\",\"--json\"],\"disclosed_at_unix_ms\":0},\"about\":\"fake\"}'\nexit 0\n",
    )
    .unwrap();
    let mut permissions = fs::metadata(&path).unwrap().permissions();
    permissions.set_mode(0o755);
    fs::set_permissions(&path, permissions).unwrap();
    path
}

// ---------------------------------------------------------------------------
// Seam-level proofs (one process, shared state)
// ---------------------------------------------------------------------------

type SurfacePair = (
    std::rc::Rc<dyn oi_cli::config_surface::ConfigSurface>,
    std::rc::Rc<dyn oi_cli::config_surface::ProfileSurface>,
);

use std::rc::Rc;

fn fixture_surface() -> SurfacePair {
    Rc::new(
        oi_cli::fixture_surface::FixtureSurface::from_cases_dir(&cases_dir())
            .expect("fixtures load"),
    )
    .into_surfaces()
}

#[test]
fn seam_apply_then_replay_is_idempotent_with_the_original_receipt() {
    use oi_cli::config_surface::{parse_scope_argument, ChangeRequest};

    let (config, _profiles) = fixture_surface();
    let request = ChangeRequest {
        setting_ref: "ai-kit:session:session.provider".to_owned(),
        scope: parse_scope_argument("world").unwrap(),
        value: Some(Value::String("herdr".to_owned())),
        secret_reference: None,
    };
    let applied = config
        .apply("cs-seam-replay-1", std::slice::from_ref(&request), None)
        .expect("first apply");
    assert_eq!(
        oi_cli::configuration::ChangeSetStatus::Verified,
        applied.changeset.status
    );
    let original_receipt_id = applied.receipts[0].receipt_id.clone();
    assert_eq!(applied.receipts[0].outcome, ReceiptOutcome::Applied);

    // The same request re-submitted under the same frozen idempotency key
    // returns `no_op` naming the original receipt; the owner must not
    // re-execute (09 §9).
    let replay = config
        .apply("cs-seam-replay-1", std::slice::from_ref(&request), None)
        .expect("replay");
    assert_eq!(replay.receipts[0].outcome, ReceiptOutcome::NoOp);
    assert_eq!(
        replay.receipts[0].original_receipt_id.as_deref(),
        Some(original_receipt_id.as_str())
    );
    // The desired entry is held once, and the resolution reconciles.
    assert_eq!(config.desired_entries().unwrap().len(), 1);
    let resolution = config
        .resolve(
            "ai-kit:session:session.provider",
            &parse_scope_argument("world").unwrap(),
        )
        .unwrap();
    assert_eq!(
        resolution.reconciliation.status,
        ReconciliationStatus::Satisfied
    );
}

#[test]
fn seam_diff_and_doctor_report_truthful_reconciliation() {
    let (config, profiles) = fixture_surface();
    // The active profile composes the World's desired state.
    profiles.set_active(Some("development")).unwrap();
    let diff = config.diff().expect("diff");
    assert_eq!(diff.len(), 5);
    // model.default has a computed default: no native axis is copied, so the
    // honest reconciliation is `unknown`.
    let model = diff
        .iter()
        .find(|resolution| resolution.setting_ref == "ai-kit:resolution:model.default")
        .unwrap();
    assert_eq!(model.reconciliation.status, ReconciliationStatus::Unknown);
    // session.provider holds desired `herdr` against the constant default.
    let provider = diff
        .iter()
        .find(|resolution| resolution.setting_ref == "ai-kit:session:session.provider")
        .unwrap();
    assert_eq!(
        provider.reconciliation.status,
        ReconciliationStatus::Satisfied
    );
}

#[test]
fn profile_edit_and_receipts_flow_through_the_fixture_surface() {
    // The seeded fixture profile, edited in one invocation: the same
    // operation set crosses, the previous entry is named, and the stored
    // document carries the edit.
    let (code, edited, stdout) = run(&[
        "profile",
        "edit",
        "development",
        "--set",
        "ai-kit:resolution:model.default",
        "opus",
        "project:epilogos/o-i",
        "--json",
    ]);
    assert_eq!(code, 0, "{stdout}");
    assert_eq!(edited["schema"], "oi.profile-edit/v1");
    assert_eq!(edited["profile"]["profile_ref"], "development");
    assert_eq!(edited["applied"][0]["action"], "entry_updated");
    assert_eq!(edited["applied"][0]["previous"]["value"], "sonnet-next");
    assert_eq!(edited["applied"][0]["next"]["value"], "opus");

    // An edit never applies: the fixture owner's native fact is unchanged,
    // and the (inactive) profile entry is not desired state.
    let (code, got, _) = run(&[
        "config",
        "get",
        "ai-kit:resolution:model.default",
        "project:epilogos/o-i",
        "--json",
    ]);
    assert_eq!(code, 0);
    assert_ne!(
        got["source"], "desired",
        "an edit is not a hold and not an apply: {got}"
    );

    // The receipts listing reads this session's records — in a fresh
    // fixture invocation, honestly empty (named absence).
    let (code, receipts, _) = run(&["config", "receipts", "--json"]);
    assert_eq!(code, 0);
    assert_eq!(receipts["schema"], "oi.config-receipts/v1");
    assert_eq!(receipts["receipts"].as_array().expect("receipts").len(), 0);

    // A usage refusal is the structured error document: an edit carries at
    // least one operation.
    let (code, error, _) = run(&["profile", "edit", "development", "--json"]);
    assert_eq!(code, 1);
    assert_eq!(error["schema"], "oi.config-error/v1");
    assert!(error["message"]
        .as_str()
        .expect("message")
        .contains("at least one operation"));
}
