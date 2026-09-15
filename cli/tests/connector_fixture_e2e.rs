//! End-to-end proof of the connector-owner mechanism (#299 §19, lane C4).
//!
//! The fixture connector executable under
//! `suite/configuration/connector-fixture/` is driven as a real subprocess
//! through the frozen C0 transport (`docs/cradle/09-CONFIGURATION-PLANE.md`
//! §6) in a temp sandbox: contribution → validate → plan → apply → receipt
//! → idempotent replay (`no_op` + original receipt) → reset, plus the
//! refusal paths (unsupported scope, unknown scope kind, unknown setting,
//! expired and unstaged plans) and the honest reread ruling of 09 §17: a
//! connector has no v2 axes, so reconciliation is `unknown` with the
//! receipt as applied evidence.
//!
//! The owner is a standalone crate (owners are independent of O:I; the
//! contract is the wire), so its wire documents are checked here against
//! the Gate-A types in `oi_cli::configuration` — the two sides have no
//! shared code.

use oi_cli::configuration::{
    connector_reread, validate_connector_contribution, validate_resolution, Contribution,
    ContributionRegistry, Desired, Receipt, ReceiptOutcome, ReconciliationStatus, Resolution,
    Scope, ScopeDecision, ScopeKind,
};
use serde_json::Value;
use std::io::Write as _;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::OnceLock;

const SETTING_REF: &str = "connector/factory-actuation:authority:authority.mode";
const RELATION_SCOPE: &str = "connector-relation:factory-actuation";
const APPLY_CHANGESET: &str = "cs-e2e-apply-1";
const RESET_CHANGESET: &str = "cs-e2e-reset-1";

fn fixture_crate_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../suite/configuration/connector-fixture")
}

/// Build the standalone fixture executable once and return its binary.
fn fixture_bin() -> &'static PathBuf {
    static BIN: OnceLock<PathBuf> = OnceLock::new();
    BIN.get_or_init(|| {
        let crate_dir = fixture_crate_dir();
        let status = Command::new(env!("CARGO"))
            .args(["build", "--quiet", "--manifest-path"])
            .arg(crate_dir.join("Cargo.toml"))
            .status()
            .expect("spawn cargo to build the fixture connector");
        assert!(status.success(), "the fixture connector must build");
        let target = std::env::var_os("CARGO_TARGET_DIR")
            .map(PathBuf::from)
            .unwrap_or_else(|| crate_dir.join("target"));
        let bin = ["debug", "release"]
            .iter()
            .map(|profile| target.join(profile).join("connector-fixture"))
            .find(|candidate| candidate.exists())
            .unwrap_or_else(|| {
                panic!(
                    "fixture binary missing under {} (cargo build reported success)",
                    target.display()
                )
            });
        bin
    })
}

struct Run {
    exit: i32,
    stdout: Value,
}

fn run_fixture(home: &Path, args: &[&str]) -> Run {
    let output = Command::new(fixture_bin())
        .args(args)
        .env("CONNECTOR_FIXTURE_HOME", home)
        .output()
        .expect("run fixture connector");
    Run {
        exit: output.status.code().unwrap_or(-1),
        stdout: parse_stdout(&output.stdout),
    }
}

/// Run with no home supplied at all: the owner must refuse, never fall back
/// to a default user path.
fn run_fixture_without_home(args: &[&str]) -> Run {
    let output = Command::new(fixture_bin())
        .args(args)
        .env_remove("CONNECTOR_FIXTURE_HOME")
        .output()
        .expect("run fixture connector");
    Run {
        exit: output.status.code().unwrap_or(-1),
        stdout: parse_stdout(&output.stdout),
    }
}

fn run_fixture_with_stdin(home: &Path, stdin: &str, args: &[&str]) -> Run {
    let mut child = Command::new(fixture_bin())
        .args(args)
        .env("CONNECTOR_FIXTURE_HOME", home)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .spawn()
        .expect("spawn fixture connector");
    child
        .stdin
        .take()
        .expect("stdin piped")
        .write_all(stdin.as_bytes())
        .expect("write stdin");
    let output = child.wait_with_output().expect("fixture connector runs");
    Run {
        exit: output.status.code().unwrap_or(-1),
        stdout: parse_stdout(&output.stdout),
    }
}

fn parse_stdout(stdout: &[u8]) -> Value {
    let text = String::from_utf8(stdout.to_vec()).expect("stdout is utf8");
    serde_json::from_str(&text).unwrap_or_else(|error| {
        panic!("every response is a bare JSON document on stdout, got `{text}`: {error}")
    })
}

fn temp_home() -> PathBuf {
    tempfile::tempdir().expect("temp sandbox").keep()
}

fn read_json(path: &Path) -> Value {
    let text = std::fs::read_to_string(path)
        .unwrap_or_else(|error| panic!("cannot read {}: {error}", path.display()));
    serde_json::from_str(&text).unwrap_or_else(|error| panic!("{path:?} is not JSON: {error}"))
}

/// The registry with the frozen contributions plus the live fixture's. The
/// live contribution stands in for the frozen `contribution-connector-fixture`
/// twin — same stable identity, and identity is unique (09 §3) — so only
/// one of them can register.
fn full_registry(live_contribution: &Contribution) -> ContributionRegistry {
    let cases = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../suite/configuration/cases");
    let mut registry = ContributionRegistry::new();
    for name in [
        "contribution-ai-kit",
        "contribution-oi",
        "contribution-unavailable",
    ] {
        let raw = std::fs::read_to_string(cases.join(format!("{name}.json"))).expect("fixture");
        let case: Value = serde_json::from_str(&raw).expect("fixture JSON");
        let contribution: Contribution = serde_json::from_value(case["contribution"].clone())
            .unwrap_or_else(|error| panic!("{name}: {error}"));
        registry
            .register(&contribution)
            .unwrap_or_else(|error| panic!("{name}: {error}"));
    }
    registry
        .register(live_contribution)
        .expect("the live contribution registers beside the frozen ones");
    registry
}

fn relation_scope() -> Scope {
    Scope {
        scope_kind: ScopeKind::ConnectorRelation,
        scope_ref: Some("factory-actuation".to_owned()),
    }
}

// ---------------------------------------------------------------------
// The acceptance walk (#299 §19): contribution → validate → plan →
// apply → receipt → replay no_op → reset, as real subprocess runs.
// ---------------------------------------------------------------------

#[test]
fn connector_contribution_matches_the_frozen_fixture_and_registers_first_class() {
    let home = temp_home();
    let run = run_fixture(&home, &["config-contribution", "--json"]);
    assert_eq!(run.exit, 0, "contribution exits zero");
    let live = &run.stdout;

    // The live document is the frozen mechanism fixture's shape, byte for
    // byte except for what must differ: the command names the real
    // executable and the disclosure timestamp is real.
    let cases = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../suite/configuration/cases");
    let frozen: Value =
        read_json(&cases.join("contribution-connector-fixture.json"))["contribution"].clone();
    let mut expected = frozen.clone();
    expected["owner"]["contribution_command"] =
        serde_json::json!(["connector-fixture", "config-contribution", "--json"]);
    expected["owner"]["disclosed_at_unix_ms"] = live["owner"]["disclosed_at_unix_ms"].clone();
    assert_eq!(
        live, &expected,
        "the live contribution carries the frozen shape"
    );

    // It parses and validates as the frozen contract's own type.
    let contribution: Contribution = serde_json::from_value(live.clone()).expect("parses");
    contribution
        .validate()
        .expect("the live contribution satisfies the frozen contract");
    validate_connector_contribution(&contribution)
        .expect("the live contribution satisfies connector law");

    // Connector settings are first-class in the registry beside product and
    // oi settings, with relation-specific scope decided explicitly.
    let registry = full_registry(&contribution);
    assert!(registry.lookup(SETTING_REF).is_some());
    assert_eq!(
        registry.scope_decision(SETTING_REF, &relation_scope()),
        ScopeDecision::Supported
    );
    assert_eq!(
        registry.scope_decision(
            SETTING_REF,
            &Scope {
                scope_kind: ScopeKind::Project,
                scope_ref: Some("epilogos/o-i".to_owned()),
            },
        ),
        ScopeDecision::UnsupportedScope,
        "a scope outside allowed_scopes is an error, never a fallback"
    );
}

#[test]
fn full_transport_walk_validate_plan_apply_replay_reset() {
    let home = temp_home();
    let state_path = home.join("state.json");

    // -- validate: honest answers and explicit refusals -------------------
    let valid = run_fixture(
        &home,
        &[
            "config",
            "validate",
            "--json",
            "--setting",
            SETTING_REF,
            "--scope",
            RELATION_SCOPE,
            "--value",
            "\"delegated\"",
        ],
    );
    assert_eq!(valid.exit, 0);
    assert_eq!(valid.stdout["schema"], "oi.config-validation/v1");
    assert_eq!(valid.stdout["valid"], true);

    let rejected = run_fixture(
        &home,
        &[
            "config",
            "validate",
            "--json",
            "--setting",
            SETTING_REF,
            "--scope",
            RELATION_SCOPE,
            "--value",
            "\"bogus\"",
        ],
    );
    assert_eq!(
        rejected.exit, 0,
        "validate answers the question authoritatively"
    );
    assert_eq!(rejected.stdout["valid"], false);
    assert_eq!(rejected.stdout["violations"][0]["code"], "invalid_value");

    let wrong_scope = run_fixture(
        &home,
        &[
            "config",
            "validate",
            "--json",
            "--setting",
            SETTING_REF,
            "--scope",
            "project:epilogos/o-i",
            "--value",
            "\"delegated\"",
        ],
    );
    assert_ne!(wrong_scope.exit, 0);
    assert_eq!(wrong_scope.stdout["schema"], "oi.config-error/v1");
    assert_eq!(wrong_scope.stdout["error_code"], "unsupported_scope");

    let unknown_kind = run_fixture(
        &home,
        &[
            "config",
            "validate",
            "--json",
            "--setting",
            SETTING_REF,
            "--scope",
            "cluster:west",
            "--value",
            "\"delegated\"",
        ],
    );
    assert_ne!(unknown_kind.exit, 0);
    assert_eq!(unknown_kind.stdout["error_code"], "unknown_scope_kind");

    let unknown_setting = run_fixture(
        &home,
        &[
            "config",
            "validate",
            "--json",
            "--setting",
            "connector/other:authority:authority.mode",
            "--scope",
            RELATION_SCOPE,
            "--value",
            "\"delegated\"",
        ],
    );
    assert_ne!(unknown_setting.exit, 0);
    assert_eq!(unknown_setting.stdout["error_code"], "unsupported_setting");

    let invalid_ref = run_fixture(
        &home,
        &[
            "config",
            "validate",
            "--json",
            "--setting",
            "connector/factory-actuation:authority",
            "--scope",
            RELATION_SCOPE,
            "--value",
            "\"delegated\"",
        ],
    );
    assert_ne!(
        invalid_ref.exit, 0,
        "a ref that does not parse is never coerced"
    );

    // -- plan: owner-minted identity, stable digest, real staging ---------
    let plan = run_fixture(
        &home,
        &[
            "config",
            "plan",
            "--json",
            "--setting",
            SETTING_REF,
            "--scope",
            RELATION_SCOPE,
            "--value",
            "\"delegated\"",
        ],
    );
    assert_eq!(plan.exit, 0, "plan succeeds: {:?}", plan.stdout);
    assert_eq!(plan.stdout["schema"], "oi.config-plan/v1");
    let plan_id = plan.stdout["plan_id"]
        .as_str()
        .expect("owner-minted plan_id");
    assert!(!plan_id.is_empty());
    let digest = plan.stdout["plan_digest"].as_str().expect("plan_digest");
    assert_eq!(digest.len(), 64, "plan_digest is sha256 hex");
    assert!(digest.chars().all(|c| c.is_ascii_hexdigit()));
    assert_eq!(plan.stdout["expected_effect"]["kind"], "value-change");
    assert!(plan.stdout["expires_at_unix_ms"].as_u64().unwrap_or(0) > 0);

    let plan_again = run_fixture(
        &home,
        &[
            "config",
            "plan",
            "--json",
            "--setting",
            SETTING_REF,
            "--scope",
            RELATION_SCOPE,
            "--value",
            "\"delegated\"",
        ],
    );
    assert_eq!(plan_again.exit, 0);
    assert_eq!(
        plan_again.stdout["plan_digest"], plan.stdout["plan_digest"],
        "the digest is a function of the plan body, not of the minting moment"
    );
    assert_ne!(
        plan_again.stdout["plan_id"], plan.stdout["plan_id"],
        "plan_id is minted fresh per plan"
    );

    let plan_path = home.join("plan.json");
    std::fs::write(&plan_path, plan.stdout.to_string()).expect("write plan file");

    // -- apply: receipt, state change, provenance -------------------------
    let applied = run_fixture(
        &home,
        &[
            "config",
            "apply",
            "--json",
            "--plan-file",
            plan_path.to_str().unwrap(),
            "--changeset",
            APPLY_CHANGESET,
        ],
    );
    assert_eq!(applied.exit, 0, "apply succeeds: {:?}", applied.stdout);
    let receipt: Receipt = serde_json::from_value(applied.stdout.clone()).expect("parses");
    receipt
        .validate()
        .expect("the owner receipt satisfies the frozen receipt contract");
    assert_eq!(receipt.outcome, ReceiptOutcome::Applied);
    assert_eq!(receipt.owner_ref, "connector/factory-actuation");
    assert_eq!(receipt.plan_digest.as_deref(), Some(digest));
    assert!(
        receipt.receipt_id.starts_with("rcpt-"),
        "owner-minted receipt id"
    );

    let state = read_json(&state_path);
    let entry = &state["values"][format!("{SETTING_REF}@{RELATION_SCOPE}")];
    assert_eq!(
        entry["value"], "delegated",
        "apply genuinely changed the owner state"
    );
    assert_eq!(
        entry["receipt_id"],
        receipt.receipt_id.as_str(),
        "provenance names the receipt"
    );
    assert_eq!(entry["changeset_id"], APPLY_CHANGESET);
    assert_eq!(entry["set_by"], "connector/factory-actuation");

    let receipts_log = read_jsonl(&home.join("receipts.jsonl"));
    assert!(
        receipts_log
            .iter()
            .any(|r| r["receipt_id"] == receipt.receipt_id.as_str()),
        "the owner's own history records the receipt"
    );

    // -- replay under the key: no_op + original receipt, no re-execution --
    let replay = run_fixture(
        &home,
        &[
            "config",
            "apply",
            "--json",
            "--plan-file",
            plan_path.to_str().unwrap(),
            "--changeset",
            APPLY_CHANGESET,
        ],
    );
    assert_eq!(replay.exit, 0);
    let replay_receipt: Receipt = serde_json::from_value(replay.stdout.clone()).expect("parses");
    replay_receipt
        .validate()
        .expect("replay receipt is a valid receipt");
    assert_eq!(replay_receipt.outcome, ReceiptOutcome::NoOp);
    assert_eq!(
        replay_receipt.original_receipt_id.as_deref(),
        Some(receipt.receipt_id.as_str()),
        "the replay names the executed receipt (09 §9)"
    );
    let state_after_replay = read_json(&state_path);
    assert_eq!(
        state_after_replay["values"][format!("{SETTING_REF}@{RELATION_SCOPE}")]["set_at_unix_ms"],
        entry["set_at_unix_ms"],
        "the owner did not re-execute"
    );

    // A different changeset is a different key: the owner re-executes.
    let second = run_fixture(
        &home,
        &[
            "config",
            "apply",
            "--json",
            "--plan-file",
            plan_path.to_str().unwrap(),
            "--changeset",
            "cs-e2e-apply-2",
        ],
    );
    assert_eq!(second.exit, 0);
    assert_eq!(second.stdout["outcome"], "applied");
    assert_ne!(second.stdout["receipt_id"], receipt.receipt_id.as_str());

    // -- reset: restores, and is itself idempotent -------------------------
    let reset = run_fixture(
        &home,
        &[
            "config",
            "reset",
            "--json",
            "--setting",
            SETTING_REF,
            "--scope",
            RELATION_SCOPE,
            "--changeset",
            RESET_CHANGESET,
        ],
    );
    assert_eq!(reset.exit, 0, "reset succeeds: {:?}", reset.stdout);
    let reset_receipt: Receipt = serde_json::from_value(reset.stdout.clone()).expect("parses");
    reset_receipt.validate().expect("reset receipt is valid");
    assert_eq!(reset_receipt.outcome, ReceiptOutcome::Applied);
    let state_after_reset = read_json(&state_path);
    assert!(
        state_after_reset["values"][format!("{SETTING_REF}@{RELATION_SCOPE}")].is_null(),
        "reset restores the owner state"
    );

    let reset_replay = run_fixture(
        &home,
        &[
            "config",
            "reset",
            "--json",
            "--setting",
            SETTING_REF,
            "--scope",
            RELATION_SCOPE,
            "--changeset",
            RESET_CHANGESET,
        ],
    );
    assert_eq!(reset_replay.exit, 0);
    assert_eq!(reset_replay.stdout["outcome"], "no_op");
    assert_eq!(
        reset_replay.stdout["original_receipt_id"],
        reset_receipt.receipt_id.as_str(),
        "reset replay names the executed receipt"
    );

    // Re-submitting an executed key MUST return no_op (09 §9) — even after
    // the value was reset again meanwhile. The ledger is history.
    let late_replay = run_fixture(
        &home,
        &[
            "config",
            "apply",
            "--json",
            "--plan-file",
            plan_path.to_str().unwrap(),
            "--changeset",
            APPLY_CHANGESET,
        ],
    );
    assert_eq!(late_replay.exit, 0);
    assert_eq!(late_replay.stdout["outcome"], "no_op");
    assert_eq!(
        late_replay.stdout["original_receipt_id"],
        receipt.receipt_id.as_str()
    );
}

fn read_jsonl(path: &Path) -> Vec<Value> {
    let text = std::fs::read_to_string(path)
        .unwrap_or_else(|error| panic!("cannot read {}: {error}", path.display()));
    text.lines()
        .filter(|line| !line.trim().is_empty())
        .map(|line| serde_json::from_str(line).expect("receipt line is JSON"))
        .collect()
}

// ---------------------------------------------------------------------
// The plan anchor is owner-side: staging, integrity, expiry.
// ---------------------------------------------------------------------

#[test]
fn plan_execution_is_guarded_owner_side() {
    let home = temp_home();
    let plan = run_fixture(
        &home,
        &[
            "config",
            "plan",
            "--json",
            "--setting",
            SETTING_REF,
            "--scope",
            RELATION_SCOPE,
            "--value",
            "\"audited\"",
        ],
    );
    assert_eq!(plan.exit, 0);
    let plan_path = home.join("plan.json");
    std::fs::write(&plan_path, plan.stdout.to_string()).expect("write plan file");

    // A tampered body no longer hashes to a staged digest.
    let mut tampered = plan.stdout.clone();
    tampered["changes"][0]["summary"] = Value::String("tampered".to_owned());
    let tampered_path = home.join("tampered.json");
    std::fs::write(&tampered_path, tampered.to_string()).expect("write tampered plan");
    let denied = run_fixture(
        &home,
        &[
            "config",
            "apply",
            "--json",
            "--plan-file",
            tampered_path.to_str().unwrap(),
            "--changeset",
            "cs-e2e-tamper",
        ],
    );
    assert_ne!(denied.exit, 0);
    assert_eq!(denied.stdout["schema"], "oi.config-error/v1");
    assert_eq!(denied.stdout["error_code"], "validation_failed");

    // A plan the owner never minted is not executable: the wire plan
    // carries no value — the owner's stage is what apply executes.
    let vanished = plan.stdout.clone();
    std::fs::remove_file(home.join("plans.json")).expect("remove the owner's stages");
    let vanished_path = home.join("unstaged.json");
    std::fs::write(&vanished_path, vanished.to_string()).expect("write unstaged plan");
    let unstaged = run_fixture(
        &home,
        &[
            "config",
            "apply",
            "--json",
            "--plan-file",
            vanished_path.to_str().unwrap(),
            "--changeset",
            "cs-e2e-unstaged",
        ],
    );
    assert_ne!(unstaged.exit, 0);
    assert_eq!(unstaged.stdout["error_code"], "validation_failed");

    // Expiry is enforced from the owner's own stage record — a client
    // cannot talk an expired plan back into life.
    let fresh = run_fixture(
        &home,
        &[
            "config",
            "plan",
            "--json",
            "--setting",
            SETTING_REF,
            "--scope",
            RELATION_SCOPE,
            "--value",
            "\"audited\"",
        ],
    );
    assert_eq!(fresh.exit, 0);
    let fresh_path = home.join("fresh.json");
    std::fs::write(&fresh_path, fresh.stdout.to_string()).expect("write fresh plan");
    let digest = fresh.stdout["plan_digest"].as_str().expect("digest");
    let mut plans = read_json(&home.join("plans.json"));
    plans["staged"][digest]["expires_at_unix_ms"] = Value::from(1);
    std::fs::write(home.join("plans.json"), plans.to_string()).expect("expire the stage");
    let expired = run_fixture(
        &home,
        &[
            "config",
            "apply",
            "--json",
            "--plan-file",
            fresh_path.to_str().unwrap(),
            "--changeset",
            "cs-e2e-expired",
        ],
    );
    assert_ne!(expired.exit, 0);
    assert_eq!(expired.stdout["error_code"], "plan_expired");

    // Values cross as JSON, including through stdin (`--value-file -`).
    let via_stdin = run_fixture_with_stdin(
        &home,
        "\"audited\"",
        &[
            "config",
            "plan",
            "--json",
            "--setting",
            SETTING_REF,
            "--scope",
            RELATION_SCOPE,
            "--value-file",
            "-",
        ],
    );
    assert_eq!(
        via_stdin.exit, 0,
        "stdin values work: {:?}",
        via_stdin.stdout
    );
    assert_eq!(via_stdin.stdout["schema"], "oi.config-plan/v1");

    // No home, no fallback: the fixture never guesses a store path.
    let homeless = run_fixture_without_home(&[
        "config",
        "plan",
        "--json",
        "--setting",
        SETTING_REF,
        "--scope",
        RELATION_SCOPE,
        "--value",
        "\"audited\"",
    ]);
    assert_ne!(homeless.exit, 0);
    assert_eq!(homeless.stdout["schema"], "oi.config-error/v1");
    assert_eq!(homeless.stdout["error_code"], "validation_failed");
    assert!(
        homeless.stdout["message"]
            .as_str()
            .unwrap()
            .contains("never writes a default user configuration path"),
        "the refusal names the sandboxing law"
    );
}

// ---------------------------------------------------------------------
// The reread ruling (09 §17): no v2 axes for a connector —
// reconciliation is `unknown`, the receipt is the applied evidence.
// ---------------------------------------------------------------------

#[test]
fn connector_reread_is_unknown_with_the_receipt_as_evidence() {
    let home = temp_home();
    let plan = run_fixture(
        &home,
        &[
            "config",
            "plan",
            "--json",
            "--setting",
            SETTING_REF,
            "--scope",
            RELATION_SCOPE,
            "--value",
            "\"delegated\"",
        ],
    );
    assert_eq!(plan.exit, 0);
    let plan_path = home.join("plan.json");
    std::fs::write(&plan_path, plan.stdout.to_string()).expect("write plan file");
    let applied = run_fixture(
        &home,
        &[
            "config",
            "apply",
            "--json",
            "--plan-file",
            plan_path.to_str().unwrap(),
            "--changeset",
            "cs-e2e-reread",
        ],
    );
    assert_eq!(applied.exit, 0);
    let receipt: Receipt = serde_json::from_value(applied.stdout.clone()).expect("parses");

    // The live contribution comes over the wire.
    let disclosed = run_fixture(&home, &["config-contribution", "--json"]);
    let contribution: Contribution =
        serde_json::from_value(disclosed.stdout.clone()).expect("parses");
    let registry = full_registry(&contribution);

    let desired = Desired {
        value: Some(serde_json::json!("delegated")),
        secret_reference: None,
        source_ref: Some("invocation".to_owned()),
        set_at_unix_ms: Some(0),
    };
    let resolution: Resolution =
        connector_reread(SETTING_REF, relation_scope(), Some(desired), Some(&receipt))
            .expect("the honest connector reread builds");

    assert_eq!(
        resolution.reconciliation.status,
        ReconciliationStatus::Unknown,
        "no native axes are disclosed for a connector owner (09 §17)"
    );
    assert_eq!(
        resolution.reconciliation.detail_ref.as_deref(),
        Some(format!("receipt:{}", receipt.receipt_id).as_str()),
        "the resolution points at the applied evidence instead of inventing axes"
    );
    assert!(resolution.native.is_none() && resolution.native_reading.is_none());

    validate_resolution(&resolution, &registry)
        .expect("the reread document satisfies the frozen resolution contract");

    // The read plane and the operability plane stay separate: no disclosure
    // axis ever appears in the connector's reread.
    let serialized = serde_json::to_string(&resolution).unwrap();
    for forbidden_axis in ["\"declared\"", "\"effective\"", "\"active\"", "\"staged\""] {
        assert!(
            !serialized.contains(forbidden_axis),
            "a connector reread carries the disclosure axis {forbidden_axis}"
        );
    }
}
