//! Gate-A contract tests for the configuration plane (#299 C0,
//! `docs/cradle/09-CONFIGURATION-PLANE.md`). These load the frozen
//! conformance fixtures in `suite/configuration/cases/`, parse them into
//! `oi_cli::configuration` types, and enforce the frozen laws: identity
//! grammar, scope decision, reconciliation truth table, ChangeSet status
//! derivation, idempotent replay, partial-apply truthfulness, the redaction
//! law, unknown-field tolerance, and the separation of the read and
//! operability planes.

use oi_cli::configuration::{
    parse_scope_compact, parse_setting_ref, reconcile, validate_changeset, validate_profile,
    validate_resolution, Contribution, ContributionRegistry, IdempotencyKey, Profile, Receipt,
    ReceiptOutcome, ReconciliationInputs, ReconciliationStatus, Resolution, Scope, ScopeDecision,
    ScopeKind, StageState, ValueKind,
};
use serde_json::Value;
use std::path::PathBuf;

fn cases_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../suite/configuration/cases")
}

fn load_case(name: &str) -> Value {
    let path = cases_dir().join(format!("{name}.json"));
    let raw = std::fs::read_to_string(&path)
        .unwrap_or_else(|error| panic!("cannot read {}: {error}", path.display()));
    serde_json::from_str(&raw).unwrap_or_else(|error| panic!("{name} is not JSON: {error}"))
}

/// Every contribution fixture, parsed and validated, in one registry.
fn registry_with_contributions() -> ContributionRegistry {
    let mut registry = ContributionRegistry::new();
    for name in [
        "contribution-ai-kit",
        "contribution-oi",
        "contribution-connector-fixture",
        "contribution-unavailable",
    ] {
        let case = load_case(name);
        let contribution: Contribution = serde_json::from_value(case["contribution"].clone())
            .unwrap_or_else(|error| panic!("{name} does not parse: {error}"));
        contribution
            .validate()
            .unwrap_or_else(|error| panic!("{name} violates the contribution contract: {error}"));
        registry
            .register(&contribution)
            .unwrap_or_else(|error| panic!("{name} cannot register: {error}"));
    }
    registry
}

#[test]
fn contribution_fixtures_parse_validate_and_register() {
    let registry = registry_with_contributions();
    // The secret-kind setting is reachable and typed as secret.
    let secret = registry
        .lookup("ai-kit:providers:credentials.anthropic")
        .expect("secret setting must resolve");
    assert_eq!(secret.spec.value_schema.kind, ValueKind::Secret);
    // The unavailable owner contributes no settings: empty is proof (L3).
    assert!(
        registry
            .lookup("workcell:placement:placement.policy")
            .is_none(),
        "an unavailable owner fabricates no settings"
    );
    // A connector ref is first-class in the same registry.
    assert!(
        registry
            .lookup("connector/factory-actuation:authority:authority.mode")
            .is_some(),
        "connector settings resolve beside product and oi settings"
    );
    // The frozen value-schema kinds appear across the fixtures.
    let expected_kinds = [
        ("ai-kit:resolution:model.default", ValueKind::Enum),
        ("ai-kit:resolution:skill-set", ValueKind::Path),
        ("ai-kit:sources:pins", ValueKind::Table),
        ("ai-kit:session:provider-instance", ValueKind::Reference),
        ("ai-kit:providers:credentials.anthropic", ValueKind::Secret),
        ("oi:verify:verify.before-run", ValueKind::Boolean),
        ("oi:composition:managed-root", ValueKind::Path),
    ];
    for (reference, kind) in expected_kinds {
        let entry = registry
            .lookup(reference)
            .unwrap_or_else(|| panic!("{reference} missing from the registry"));
        assert_eq!(entry.spec.value_schema.kind, kind, "`{reference}` kind");
    }
}

#[test]
fn setting_ref_grammar_accepts_and_rejects() {
    for accepted in [
        "ai-kit:resolution:model.default",
        "oi:composition:managed-root",
        "workcell:placement:placement.policy",
        "connector/factory-actuation:authority:authority.mode",
    ] {
        assert!(
            parse_setting_ref(accepted).is_ok(),
            "`{accepted}` is a valid setting ref"
        );
    }
    for rejected in [
        "ai-kit:resolution",
        "ai-kit:resolution:model.default:extra",
        "AIKit:resolution:model.default",
        "ai-kit:resolu.tion:model.default",
        "ai-kit:resolution:",
        "ai kit:resolution:model.default",
        "aikit system --json",
    ] {
        assert!(
            parse_setting_ref(rejected).is_err(),
            "`{rejected}` must not parse as a setting ref"
        );
    }
}

#[test]
fn scope_compact_form_round_trips_and_unknown_kinds_are_refused() {
    let project = parse_scope_compact("project:epilogos/o-i").expect("project scope parses");
    assert_eq!(project.scope_kind.as_wire(), "project");
    assert_eq!(project.scope_ref.as_deref(), Some("epilogos/o-i"));
    let world = parse_scope_compact("world").expect("singular world parses with null ref");
    assert_eq!(world.scope_ref, None);
    assert!(
        parse_scope_compact("cluster:west").is_none(),
        "unknown scope kinds never parse"
    );
    assert!(
        parse_scope_compact("project:").is_none(),
        "an empty ref is not a scope address"
    );
}

#[test]
fn scope_cases_decide_explicitly_never_by_fallback() {
    let registry = registry_with_contributions();
    let case = load_case("scope-cases");
    for entry in case["cases"].as_array().expect("cases array") {
        let name = entry["name"].as_str().unwrap();
        let setting_ref = entry["setting_ref"].as_str().unwrap();
        let scope_value = &entry["scope"];
        let scope_kind = scope_value["scope_kind"].as_str().unwrap();
        let scope_ref = scope_value["scope_ref"].as_str().map(str::to_owned);
        let expected = entry["expect"].as_str().unwrap();
        let decision = match ScopeKind::from_wire(scope_kind) {
            None => ScopeDecision::UnknownScopeKind,
            Some(kind) => {
                let scope = Scope {
                    scope_kind: kind,
                    scope_ref,
                };
                if scope.validate().is_err() {
                    // A structurally invalid address is an unsupported
                    // scope, never an unknown kind.
                    ScopeDecision::UnsupportedScope
                } else {
                    registry.scope_decision(setting_ref, &scope)
                }
            }
        };
        let decided = match decision {
            ScopeDecision::Supported => "ok",
            ScopeDecision::UnsupportedScope => "unsupported_scope",
            ScopeDecision::UnknownScopeKind => "unknown_scope_kind",
        };
        assert_eq!(decided, expected, "scope case `{name}`");
    }
}

/// A fixture JSON `null` means "absent" for reconciliation inputs.
fn present(value: &Value) -> Option<&Value> {
    if value.is_null() {
        None
    } else {
        Some(value)
    }
}

#[test]
fn resolution_cases_match_the_frozen_truth_table() {
    let case = load_case("resolution-cases");
    for entry in case["cases"].as_array().expect("cases array") {
        let name = entry["name"].as_str().unwrap();
        let stage_state = match entry["stage_state"].as_str().unwrap() {
            "none" => StageState::None,
            "prepared" => StageState::Prepared,
            "previewed" => StageState::Previewed,
            "discardable" => StageState::Discardable,
            other => panic!("unknown stage state {other}"),
        };
        let status = reconcile(ReconciliationInputs {
            desired: present(&entry["desired"]),
            native_effective: present(&entry["native_effective"]),
            native_declared: present(&entry["native_declared"]),
            stage_state,
            owner_available: entry["owner_available"].as_bool().unwrap(),
            setting_supported: entry["setting_supported"].as_bool().unwrap(),
        });
        let expected = match entry["expect"].as_str().unwrap() {
            "satisfied" => ReconciliationStatus::Satisfied,
            "drifted" => ReconciliationStatus::Drifted,
            "pending" => ReconciliationStatus::Pending,
            "blocked" => ReconciliationStatus::Blocked,
            "unsupported" => ReconciliationStatus::Unsupported,
            "unknown" => ReconciliationStatus::Unknown,
            other => panic!("unknown expected status {other}"),
        };
        assert_eq!(status, expected, "reconciliation case `{name}`");
    }
}

#[test]
fn changeset_simple_apply_walks_planned_to_verified() {
    let case = load_case("changeset-simple-apply");
    let lifecycle = case["lifecycle"].as_array().expect("lifecycle");
    let mut stages = Vec::new();
    for stage in lifecycle {
        let changeset: oi_cli::configuration::ChangeSet =
            serde_json::from_value(stage["changeset"].clone())
                .unwrap_or_else(|error| panic!("stage {} does not parse: {error}", stage["stage"]));
        changeset
            .validate()
            .unwrap_or_else(|error| panic!("stage {}: {error}", stage["stage"]));
        stages.push(stage["stage"].as_str().unwrap().to_owned());
    }
    assert_eq!(
        stages,
        vec!["planned", "validated", "applied", "verified"],
        "the lifecycle walks every frozen state in order"
    );
    let final_stage = lifecycle.last().unwrap();
    let final_changeset: oi_cli::configuration::ChangeSet =
        serde_json::from_value(final_stage["changeset"].clone())
            .unwrap_or_else(|error| panic!("final stage does not parse: {error}"));
    assert_eq!(final_stage["changeset"]["status"], "verified");
    let verification = final_changeset
        .verification
        .as_ref()
        .expect("verified carries verification");
    assert!(
        verification.reading_digest.is_some() && !verification.reconciliations.is_empty(),
        "verification carries the re-read digest and per-setting reconciliations"
    );
    let receipt: Receipt = serde_json::from_value(case["receipt"].clone())
        .unwrap_or_else(|error| panic!("receipt does not parse: {error}"));
    receipt
        .validate()
        .unwrap_or_else(|error| panic!("receipt invalid: {error}"));
    assert_eq!(receipt.outcome, ReceiptOutcome::Applied);
    assert_eq!(
        IdempotencyKey::from_receipt(&receipt),
        IdempotencyKey::from_operation(
            &final_changeset.operations[0],
            &final_changeset.changeset_id
        ),
        "receipt and operation share the frozen idempotency key"
    );
}

#[test]
fn changeset_partial_apply_is_truthful_and_claims_no_rollback() {
    let case = load_case("changeset-partial-apply");
    let stage = &case["lifecycle"].as_array().unwrap()[0];
    let changeset: oi_cli::configuration::ChangeSet =
        serde_json::from_value(stage["changeset"].clone())
            .unwrap_or_else(|error| panic!("changeset does not parse: {error}"));
    changeset
        .validate()
        .unwrap_or_else(|error| panic!("changeset invalid: {error}"));
    assert_eq!(stage["changeset"]["status"], "partially_applied");
    let operations = stage["changeset"]["operations"].as_array().unwrap();
    let applied = operations
        .iter()
        .find(|op| op["status"] == "verified")
        .expect("one operation verified");
    let failed = operations
        .iter()
        .find(|op| op["status"] == "failed")
        .expect("one operation failed");
    assert!(
        applied["receipt_ref"].is_string(),
        "the applied operation keeps its receipt"
    );
    assert!(
        failed["error"]["code"].is_string(),
        "the failed operation keeps its owner error"
    );
    // No compensation is invented: the operations list holds exactly the two
    // requested mutations, nothing added to "undo" the failure.
    assert_eq!(operations.len(), 2, "no invented rollback operations");
    for receipt_value in case["receipts"].as_array().unwrap() {
        let receipt: Receipt = serde_json::from_value(receipt_value.clone())
            .unwrap_or_else(|error| panic!("receipt does not parse: {error}"));
        receipt
            .validate()
            .unwrap_or_else(|error| panic!("receipt invalid: {error}"));
    }
}

#[test]
fn changeset_idempotent_replay_returns_no_op_with_the_original_receipt() {
    let case = load_case("changeset-idempotent-replay");
    let original: Receipt = serde_json::from_value(case["receipt"].clone())
        .unwrap_or_else(|error| panic!("receipt does not parse: {error}"));
    let replay: Receipt = serde_json::from_value(case["replay_receipt"].clone())
        .unwrap_or_else(|error| panic!("replay receipt does not parse: {error}"));
    original
        .validate()
        .unwrap_or_else(|error| panic!("original receipt invalid: {error}"));
    replay
        .validate()
        .unwrap_or_else(|error| panic!("replay receipt invalid: {error}"));
    assert_eq!(replay.outcome, ReceiptOutcome::NoOp);
    assert_eq!(
        replay.original_receipt_id.as_deref(),
        Some(original.receipt_id.as_str()),
        "the replay names the executed receipt; the owner did not re-execute"
    );
    assert_eq!(
        IdempotencyKey::from_receipt(&original),
        IdempotencyKey::from_receipt(&replay),
        "both receipts sit under the same frozen idempotency key"
    );
    let changeset = &case["lifecycle"].as_array().unwrap()[0]["changeset"];
    assert_eq!(changeset["status"], "verified");
}

#[test]
fn profile_fixture_resolves_against_contributions_and_keeps_secrets_referenced() {
    let registry = registry_with_contributions();
    let case = load_case("profile-development");
    let profile: Profile = serde_json::from_value(case["profile"].clone())
        .unwrap_or_else(|error| panic!("profile does not parse: {error}"));
    validate_profile(&profile, &registry)
        .unwrap_or_else(|error| panic!("profile violates the contract: {error}"));
    // Native profiles travel by reference only.
    assert_eq!(profile.native_profiles.len(), 1);
    assert_eq!(profile.native_profiles[0].native_profile_ref, "coding");
    // The secret-kind entry carries a reference and no value.
    let secret_entry = profile
        .desired
        .iter()
        .find(|entry| entry.setting_ref == "ai-kit:providers:credentials.anthropic")
        .expect("secret entry present");
    assert!(secret_entry.value.is_none());
    assert!(secret_entry.secret_reference.is_some());
    // The profile is sparse: no entry snapshots a native tree.
    assert_eq!(profile.desired.len(), 5);
    assert_eq!(case["expect"]["sparse"], true);
    assert_eq!(case["expect"]["secret_entry_has_no_value"], true);
}

#[test]
fn secret_redaction_holds_across_every_owned_document_type() {
    let registry = registry_with_contributions();
    let case = load_case("secret-redaction-cases");
    for document_entry in case["documents"].as_array().expect("documents") {
        let name = document_entry["name"].as_str().unwrap();
        let document = &document_entry["document"];
        match document["schema"].as_str().unwrap() {
            "oi.profile/v1" => {
                let profile: Profile = serde_json::from_value(document.clone())
                    .unwrap_or_else(|error| panic!("{name} does not parse: {error}"));
                validate_profile(&profile, &registry)
                    .unwrap_or_else(|error| panic!("{name}: {error}"));
            }
            "oi.config-changeset/v1" => {
                let changeset: oi_cli::configuration::ChangeSet =
                    serde_json::from_value(document.clone())
                        .unwrap_or_else(|error| panic!("{name} does not parse: {error}"));
                validate_changeset(&changeset, &registry)
                    .unwrap_or_else(|error| panic!("{name}: {error}"));
            }
            "oi.config-receipt/v1" => {
                let receipt: Receipt = serde_json::from_value(document.clone())
                    .unwrap_or_else(|error| panic!("{name} does not parse: {error}"));
                receipt
                    .validate()
                    .unwrap_or_else(|error| panic!("{name}: {error}"));
            }
            "oi.config-resolution/v1" => {
                let resolution: Resolution = serde_json::from_value(document.clone())
                    .unwrap_or_else(|error| panic!("{name} does not parse: {error}"));
                validate_resolution(&resolution, &registry)
                    .unwrap_or_else(|error| panic!("{name}: {error}"));
            }
            other => panic!("{name} carries unknown schema {other}"),
        }
    }
    // No credential material anywhere in the clean documents.
    let serialized = serde_json::to_string(&case["documents"]).unwrap();
    assert!(
        !serialized.contains("sk-ant-"),
        "credential material appeared in a redaction-clean fixture"
    );
    // The violating example is rejected — validation refuses material.
    let violating: Profile = serde_json::from_value(case["violating_example"]["document"].clone())
        .unwrap_or_else(|error| panic!("violating example does not parse: {error}"));
    let error = validate_profile(&violating, &registry)
        .expect_err("the violating example must be rejected");
    assert!(
        error.contains("redaction"),
        "rejection must name the redaction law, got: {error}"
    );
}

#[test]
fn unknown_fields_are_tolerated_and_unknown_majors_are_explicit_errors() {
    let mut injected = load_case("contribution-ai-kit");
    injected["contribution"]["oi-unknown-future-field"] = Value::String("preserved".into());
    injected["contribution"]["sections"][0]["settings"][0]["oi-unknown-setting-field"] =
        Value::Bool(true);
    let contribution: Contribution = serde_json::from_value(injected["contribution"].clone())
        .expect("unknown fields are tolerated on read (09 §15)");
    contribution
        .validate()
        .expect("unknown fields never invalidate a same-major document");
    // An unknown major version is an explicit unsupported_schema error.
    let mut future = load_case("contribution-ai-kit");
    future["contribution"]["schema"] = Value::String("oi.configuration-contribution/v2".into());
    let future: Contribution =
        serde_json::from_value(future["contribution"].clone()).expect("parses");
    let error = future.validate().expect_err("unknown major is an error");
    assert!(
        error.contains("unsupported_schema"),
        "unknown major names unsupported_schema, got: {error}"
    );
}

#[test]
fn read_plane_and_operability_plane_do_not_mix() {
    for name in [
        "contribution-ai-kit",
        "contribution-oi",
        "contribution-connector-fixture",
    ] {
        let case = load_case(name);
        let serialized = serde_json::to_string(&case["contribution"]).unwrap();
        for forbidden_axis in [
            "\"declared\"",
            "\"effective\"",
            "\"active\"",
            "\"staged\"",
            "\"desired\"",
        ] {
            assert!(
                !serialized.contains(forbidden_axis),
                "{name} carries the disclosure axis {forbidden_axis}; a contribution never carries state"
            );
        }
    }
    // And the resolution document type has no operability fields: the types
    // themselves cannot represent a contribution inside a resolution.
    let resolution_json = serde_json::json!({
        "schema": "oi.config-resolution/v1",
        "setting_ref": "ai-kit:resolution:model.default",
        "scope": { "scope_kind": "project", "scope_ref": "epilogos/o-i" },
        "reconciliation": { "status": "unknown" },
        "allowed_scopes": [{ "scope_kind": "project", "scope_ref": null }]
    });
    let resolution: Resolution = serde_json::from_value(resolution_json).expect("parses");
    assert_eq!(
        resolution.reconciliation.status,
        ReconciliationStatus::Unknown
    );
}
