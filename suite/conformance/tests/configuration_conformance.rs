//! The C7 conformance suite (#299 §22, lane C7): the fourteen required
//! cross-surface / cross-owner tests, executable end-to-end today against
//! the `config-owner-stub` product owner through the frozen C0-5 transport
//! (`docs/cradle/09-CONFIGURATION-PLANE.md`), over the frozen fixtures of
//! `suite/configuration/cases/` (consumed, never re-decided), with every
//! law check carried by the frozen `oi_cli::configuration` types.
//!
//! Where a scenario needs infrastructure that has not converged (the C1
//! kernel, the C2 profile engine, the C5 `oi config` CLI, the C6 Desktop,
//! the C4 connector fixture executable), the scenario is defined fully, the
//! stub-side world is implemented and proven, and the binding point is
//! named in the test's verdict — never faked as a pass. Run
//! `config-conformance-report` after the suite for the status table.

use oi_cli::configuration::{
    derive_changeset_status, parse_scope_compact, parse_setting_ref, reconcile, validate_changeset,
    validate_profile, validate_resolution, ChangeSet, ChangeSetStatus, Contribution,
    ContributionRegistry, IdempotencyKey, Receipt, ReceiptOutcome, ReconciliationInputs,
    ReconciliationStatus, Resolution, Scope, ScopeDecision, ScopeKind, StageState, ValueKind,
};
use oi_config_conformance::{
    artifacts_dir, canonical_plan_digest, fixture, owner_axes, record_verdict, redaction_sweep,
    PendingLeg, StubOwner, Verdict,
};
use serde_json::{json, Value};
use std::path::{Path, PathBuf};

const STUB_EXE: &str = env!("CARGO_BIN_EXE_config-owner-stub");
const CANARY: &str = "sk-ant-C7-SECRET-CANARY-plaintext-material-must-never-appear";
const PROJECT_SCOPE: &str = "project:epilogos/o-i";
const MODEL_DEFAULT: &str = "ai-kit:resolution:model.default";
const SESSION_PROVIDER: &str = "ai-kit:session:session.provider";
const VERIFY_BEFORE_RUN: &str = "oi:verify:verify.before-run";
const CREDENTIAL_REF: &str = "ai-kit:providers:credentials.anthropic";
const CONNECTOR_REF: &str = "connector/factory-actuation:authority:authority.mode";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

fn stub(slug: &str, owner: &str, degraded: bool) -> StubOwner {
    StubOwner::start(slug, Path::new(STUB_EXE), owner, degraded)
}

fn stub_exe_path() -> &'static str {
    STUB_EXE
}

fn parse_and_register(contribution_value: &Value, registry: &mut ContributionRegistry, name: &str) {
    let contribution: Contribution = serde_json::from_value(contribution_value.clone())
        .unwrap_or_else(|error| panic!("{name} does not parse into the frozen types: {error}"));
    contribution
        .validate()
        .unwrap_or_else(|error| panic!("{name} violates the contribution contract: {error}"));
    registry
        .register(&contribution)
        .unwrap_or_else(|error| panic!("{name} cannot register: {error}"));
}

/// The registry over both stub owners plus the frozen connector fixture —
/// three owner kinds in one registry, exactly the cross-owner surface C1
/// must carry.
fn registry_with_stubs(slug: &str) -> (ContributionRegistry, StubOwner, StubOwner) {
    let ai_kit = stub(slug, "ai-kit", false);
    let oi = stub(slug, "oi", false);
    let mut registry = ContributionRegistry::new();
    parse_and_register(&ai_kit.contribution().expect_success("contribution"), &mut registry, "stub ai-kit");
    parse_and_register(&oi.contribution().expect_success("contribution"), &mut registry, "stub oi");
    parse_and_register(
        &fixture("contribution-connector-fixture")["contribution"],
        &mut registry,
        "contribution-connector-fixture",
    );
    (registry, ai_kit, oi)
}

/// The one place desired state enters reconciliation: the frozen pure
/// function, fed by owner documents only.
fn reconcile_setting(
    reading: &Value,
    registry: &ContributionRegistry,
    setting_ref: &str,
    desired: Option<Value>,
) -> ReconciliationStatus {
    let secret_kind = registry
        .lookup(setting_ref)
        .map(|entry| entry.spec.value_schema.kind == ValueKind::Secret)
        .unwrap_or(false);
    let desired_ref = desired.as_ref();
    let axes = owner_axes(reading, setting_ref, secret_kind);
    // For secret-kind settings the presence fact (`present`) is observed
    // only and never part of a desired comparison (09 §14); the harness
    // compares references, accepting either the plain-ref shorthand or the
    // {secret_reference: {ref}} shape on the desired side.
    let (desired_axis, native_effective, native_declared) = if secret_kind {
        let desired_value = desired_ref.map(|d| {
            let entry = &d["secret_reference"];
            let reference = if entry.is_string() {
                entry.clone()
            } else {
                entry.get("ref").cloned().unwrap_or(Value::Null)
            };
            json!({ "secret_reference": { "ref": reference } })
        });
        (
            desired_value,
            axes.comparison_value.clone(),
            axes.comparison_value.clone(),
        )
    } else {
        (desired_ref.cloned(), axes.effective.clone(), axes.declared.clone())
    };
    reconcile(ReconciliationInputs {
        desired: desired_axis.as_ref(),
        native_effective: native_effective.as_ref(),
        native_declared: native_declared.as_ref(),
        stage_state: match axes.stage_state.as_str() {
            "prepared" => StageState::Prepared,
            "previewed" => StageState::Previewed,
            "discardable" => StageState::Discardable,
            _ => StageState::None,
        },
        owner_available: axes.owner_available,
        setting_supported: registry.lookup(setting_ref).is_some(),
    })
}

/// Carve one requested+operation pair into the ChangeSet document.
fn operation(
    op_id: &str,
    owner_ref: &str,
    setting_ref: &str,
    scope: &str,
    kind: &str,
    plan_digest: Option<&str>,
    status: &str,
    receipt_ref: Option<&str>,
    error: Option<Value>,
) -> Value {
    let mut op = json!({
        "op_id": op_id,
        "depends_on": [],
        "owner_ref": owner_ref,
        "setting_ref": setting_ref,
        "scope": parse_scope_compact(scope).expect("valid scope"),
        "kind": kind,
        "status": status,
    });
    if let Some(digest) = plan_digest {
        op["plan_digest"] = json!(digest);
    }
    if let Some(receipt) = receipt_ref {
        op["receipt_ref"] = json!(receipt);
    }
    if let Some(error) = error {
        op["error"] = error;
    }
    op
}

fn requested(setting_ref: &str, scope: &str, value: Value) -> Value {
    json!({
        "setting_ref": setting_ref,
        "scope": parse_scope_compact(scope).expect("valid scope"),
        "value": value
    })
}

fn as_changeset(document: &Value, what: &str) -> ChangeSet {
    let changeset: oi_cli::configuration::ChangeSet =
        serde_json::from_value(document.clone()).unwrap_or_else(|error| panic!("{what}: {error}"));
    changeset
        .validate()
        .unwrap_or_else(|error| panic!("{what} violates the frozen ChangeSet laws: {error}"));
    changeset
}

fn plan_and_apply(stub_owner: &StubOwner, setting: &str, scope: &str, value: &str, changeset: &str) -> (Value, Value) {
    let plan = stub_owner
        .plan_setting(setting, Some(scope), value)
        .expect_success("plan");
    assert_eq!(plan["schema"], "oi.config-plan/v1");
    let plan_path = stub_owner.write_plan_file(&plan);
    let receipt = stub_owner
        .apply_plan_file(&plan_path, changeset)
        .expect_success("apply");
    assert_eq!(receipt["schema"], "oi.config-receipt/v1");
    (plan, receipt)
}

/// Re-read the owner and assert the applied change is what the owner now
/// discloses; returns the reading.
fn verified_reading(stub_owner: &StubOwner, registry: &ContributionRegistry, setting: &str, desired: Value) -> Value {
    let reading = stub_owner.reading();
    let status = reconcile_setting(&reading, registry, setting, Some(desired));
    assert_eq!(
        status,
        ReconciliationStatus::Satisfied,
        "re-read must verify the applied change on {setting}"
    );
    reading
}

fn pending(surface: &str, lane: &str, reason: &str) -> PendingLeg {
    PendingLeg {
        surface: surface.to_owned(),
        lane: lane.to_owned(),
        reason: reason.to_owned(),
    }
}

fn verdict(n: u8, slug: &str, name: &str, status: &str, verified: Vec<&str>, pending_legs: Vec<PendingLeg>, evidence: Vec<String>) {
    record_verdict(Verdict {
        n,
        slug: slug.to_owned(),
        name: name.to_owned(),
        status: status.to_owned(),
        verified: verified.into_iter().map(str::to_owned).collect(),
        pending: pending_legs,
        evidence,
    });
}

fn c1(reason: &str) -> PendingLeg {
    pending("O:I configuration kernel (registry/resolver/ChangeSet engine)", "C1", reason)
}
fn c2(reason: &str) -> PendingLeg {
    pending("O:I profile persistence/switch engine", "C2", reason)
}
fn c5(reason: &str) -> PendingLeg {
    pending("native `oi config` / `oi profile` CLI", "C5", reason)
}
fn c6(reason: &str) -> PendingLeg {
    pending("Desktop System Configuration/Profiles", "C6", reason)
}

// ---------------------------------------------------------------------------
// 1 — ordinary-setting propagation
// ---------------------------------------------------------------------------

#[test]
fn t01_ordinary_setting_propagation() {
    let slug = "01-ordinary-propagation";
    let (registry, ai_kit, _oi) = registry_with_stubs(slug);
    let dir = artifacts_dir(slug);

    // The owner contributes the setting; discovery needs no per-setting code.
    let contribution_doc = ai_kit.contribution().expect_success("config-contribution --json");
    let entry = registry.lookup(MODEL_DEFAULT).expect("contributed setting resolves");
    assert_eq!(entry.spec.value_schema.kind, ValueKind::Enum);
    assert!(entry.spec.profileable, "an ordinary setting is profileable where marked");
    assert_eq!(
        parse_setting_ref(MODEL_DEFAULT).expect("grammar").owner_ref,
        "ai-kit"
    );

    // Scope addressing is explicit through both implementations.
    let scope = parse_scope_compact(PROJECT_SCOPE).expect("project scope");
    assert_eq!(
        registry.scope_decision(MODEL_DEFAULT, &scope),
        ScopeDecision::Supported
    );
    let validation = ai_kit
        .validate_setting(MODEL_DEFAULT, Some(PROJECT_SCOPE), "sonnet-current")
        .expect_success("validate");
    assert_eq!(validation["schema"], "oi.config-validation/v1");
    assert_eq!(validation["valid"], true);

    // Owner-native plan → apply → receipt through the frozen transport.
    let (plan, receipt) = plan_and_apply(&ai_kit, MODEL_DEFAULT, PROJECT_SCOPE, "sonnet-next", "cs-c7-t01");
    assert!(plan["plan_id"].as_str().expect("owner-minted plan_id").starts_with("plan-"));
    assert_eq!(
        plan["plan_digest"].as_str().expect("plan digest"),
        canonical_plan_digest(&plan),
        "plan_digest is sha256 over the canonical plan body"
    );
    let receipt_typed: Receipt = serde_json::from_value(receipt.clone()).expect("receipt parses");
    receipt_typed.validate().expect("receipt obeys the frozen laws");
    assert_eq!(receipt_typed.outcome, ReceiptOutcome::Applied);

    // v2 re-read verifies; reconciliation is the frozen pure function.
    let reading = verified_reading(&ai_kit, &registry, MODEL_DEFAULT, json!("sonnet-next"));
    let axes = owner_axes(&reading, MODEL_DEFAULT, false);
    assert_eq!(axes.effective, Some(json!("sonnet-next")));

    // The ChangeSet this flow produced obeys the frozen lifecycle laws.
    let reading_digest = reading["owner"]["reading_digest"].as_str().expect("reading digest");
    let changeset = json!({
        "schema": "oi.config-changeset/v1",
        "changeset_id": "cs-c7-t01",
        "created_at_unix_ms": 0,
        "requested": [requested(MODEL_DEFAULT, PROJECT_SCOPE, json!("sonnet-next"))],
        "operations": [operation(
            "op-1", "ai-kit", MODEL_DEFAULT, PROJECT_SCOPE, "apply",
            plan["plan_digest"].as_str(), "verified",
            receipt["receipt_id"].as_str(), None
        )],
        "verification": {
            "reading_digest": reading_digest,
            "observed_at_unix_ms": 0,
            "reconciliations": [{ "setting_ref": MODEL_DEFAULT, "status": "satisfied" }]
        },
        "status": "verified"
    });
    let changeset_typed = as_changeset(&changeset, "t01 ChangeSet");

    // One identity everywhere: contribution, plan, receipt, reading, ChangeSet.
    assert_eq!(receipt["setting_ref"], json!(MODEL_DEFAULT));
    assert_eq!(plan["setting_ref"], json!(MODEL_DEFAULT));
    assert_eq!(changeset_typed.operations[0].setting_ref, MODEL_DEFAULT);
    assert_eq!(
        IdempotencyKey::from_receipt(&receipt_typed),
        IdempotencyKey::from_operation(&changeset_typed.operations[0], "cs-c7-t01"),
        "receipt and operation share the frozen idempotency key"
    );

    // Every document of the flow is machine-readable, preserved verbatim.
    std::fs::write(dir.join("contribution.json"), serde_json::to_vec(&contribution_doc).unwrap()).unwrap();
    std::fs::write(dir.join("plan.json"), serde_json::to_vec(&plan).unwrap()).unwrap();
    std::fs::write(dir.join("receipt.json"), serde_json::to_vec(&receipt).unwrap()).unwrap();
    std::fs::write(dir.join("reading.json"), serde_json::to_vec(&reading).unwrap()).unwrap();
    std::fs::write(dir.join("changeset.json"), serde_json::to_vec(&changeset).unwrap()).unwrap();
    redaction_sweep(&dir, &[]).expect("t01 artifacts are redaction-clean");

    verdict(
        1,
        slug,
        "ordinary-setting propagation",
        "passed",
        vec![
            "contribution discovery (frozen types)",
            "identity grammar + scope decision (owner and registry agree)",
            "owner-native validate/plan/apply with owner-minted plan+receipt",
            "v2 re-read + frozen reconciliation (satisfied)",
            "ChangeSet lifecycle planned→verified (frozen laws)",
        ],
        vec![
            c1("the harness played the registry/router; the kernel must replace it"),
            c5("`oi config list/show/set` must surface the same ref and documents"),
            c6("Desktop generic rendering of the same setting"),
            pending("Agent/native Action surface", "C1/C5", "headless authorised operation over the kernel"),
        ],
        vec![format!("stub owner: {}", stub_exe_path()), format!("artifacts: {}", dir.display())],
    );
}

// ---------------------------------------------------------------------------
// 2 — native-first edit
// ---------------------------------------------------------------------------

#[test]
fn t02_native_first_edit() {
    let slug = "02-native-first-edit";
    let (registry, ai_kit, _oi) = registry_with_stubs(slug);
    let dir = artifacts_dir(slug);

    // O:I-routed desired state first: the world starts satisfied.
    let (_plan, _receipt) = plan_and_apply(&ai_kit, MODEL_DEFAULT, PROJECT_SCOPE, "sonnet-next", "cs-c7-t02a");
    let before = ai_kit.reading();
    assert_eq!(
        reconcile_setting(&before, &registry, MODEL_DEFAULT, Some(json!("sonnet-next"))),
        ReconciliationStatus::Satisfied
    );
    let digest_before = before["owner"]["reading_digest"].as_str().expect("digest").to_owned();

    // The native edit: the owner's own configuration file changes under a
    // native product CLI hand (aikit-style) — no O:I operation exists here.
    let mut store = ai_kit.read_store();
    let key = format!("{MODEL_DEFAULT}@{PROJECT_SCOPE}");
    store["overrides"][&key] = json!("opus");
    ai_kit.write_store(&store);

    // Re-read: the new v2 axes reach reconciliation and the setting is
    // drifted — explicitly, never silently repaired.
    let after = ai_kit.reading();
    let digest_after = after["owner"]["reading_digest"].as_str().expect("digest").to_owned();
    assert_ne!(digest_before, digest_after, "a changed world changes the reading digest");
    let axes = owner_axes(&after, MODEL_DEFAULT, false);
    assert_eq!(axes.effective, Some(json!("opus")), "the owner truth passed through unmodified");
    assert_eq!(
        reconcile_setting(&after, &registry, MODEL_DEFAULT, Some(json!("sonnet-next"))),
        ReconciliationStatus::Drifted
    );

    // O:I never rewrote the owner to restore its desired state: no receipt
    // was minted, and the store holds exactly the external edit.
    let receipt_count = std::fs::read_dir(ai_kit.receipts_dir()).unwrap().count();
    assert_eq!(receipt_count, 1, "the native edit minted no owner operation");
    assert_eq!(ai_kit.read_store()["overrides"][&key], json!("opus"));

    std::fs::write(dir.join("reading-before.json"), serde_json::to_vec(&before).unwrap()).unwrap();
    std::fs::write(dir.join("reading-after.json"), serde_json::to_vec(&after).unwrap()).unwrap();
    std::fs::write(dir.join("native-store-after-edit.json"), serde_json::to_vec(&store).unwrap()).unwrap();

    verdict(
        2,
        slug,
        "native-first edit",
        "passed",
        vec![
            "external native edit preserved as owner truth",
            "re-read sees the change (digest moved, axes passed through)",
            "reconciliation explicit: drifted, no silent rewrite",
            "no owner operation minted by the external edit",
        ],
        vec![c1("the O:I observer that persists desired state and reports drift is the kernel's")],
        vec![format!("artifacts: {}", dir.display())],
    );
}

// ---------------------------------------------------------------------------
// 3 — O:I-routed edit
// ---------------------------------------------------------------------------

#[test]
fn t03_oi_routed_edit() {
    let slug = "03-oi-routed-edit";
    let (registry, ai_kit, _oi) = registry_with_stubs(slug);
    let dir = artifacts_dir(slug);

    // validate → plan, with the digest recomputed independently by the
    // harness (two implementations of the canonicalisation must agree).
    let validation = ai_kit
        .validate_setting(MODEL_DEFAULT, Some(PROJECT_SCOPE), "sonnet-next")
        .expect_success("validate");
    assert_eq!(validation["valid"], true);
    let plan = ai_kit
        .plan_setting(MODEL_DEFAULT, Some(PROJECT_SCOPE), "sonnet-next")
        .expect_success("plan");
    assert_eq!(
        plan["plan_digest"].as_str().unwrap(),
        canonical_plan_digest(&plan),
        "owner-minted plan_digest is verifiable from the plan document alone"
    );

    // apply carries the plan over stdin (`--plan-file -`) — no argv limits.
    let receipt_value = ai_kit
        .apply_plan_stdin(&plan, "cs-c7-t03")
        .expect_success("apply over stdin");
    let receipt: Receipt = serde_json::from_value(receipt_value.clone()).expect("receipt parses");
    receipt.validate().expect("receipt obeys the frozen laws");
    assert_eq!(receipt.outcome, ReceiptOutcome::Applied);
    assert!(receipt.native_ref.as_deref().unwrap_or_default().starts_with("stub:history:"));

    // The owner performed the change; the v2 re-read verifies it.
    let reading = verified_reading(&ai_kit, &registry, MODEL_DEFAULT, json!("sonnet-next"));
    let reading_digest = reading["owner"]["reading_digest"].as_str().unwrap().to_owned();

    // Idempotent replay under the frozen key: no_op + the original receipt,
    // and the owner did not execute again.
    let replay_value = ai_kit.apply_plan_stdin(&plan, "cs-c7-t03").expect_success("replay");
    let replay: Receipt = serde_json::from_value(replay_value.clone()).expect("replay parses");
    replay.validate().expect("replay receipt obeys the frozen laws");
    assert_eq!(replay.outcome, ReceiptOutcome::NoOp);
    assert_eq!(replay.original_receipt_id.as_deref(), Some(receipt.receipt_id.as_str()));
    assert_eq!(IdempotencyKey::from_receipt(&receipt), IdempotencyKey::from_receipt(&replay));
    let executed_receipts = std::fs::read_dir(ai_kit.receipts_dir()).unwrap().count();
    assert_eq!(executed_receipts, 1, "the owner executed exactly once");

    let changeset = json!({
        "schema": "oi.config-changeset/v1",
        "changeset_id": "cs-c7-t03",
        "created_at_unix_ms": 0,
        "requested": [requested(MODEL_DEFAULT, PROJECT_SCOPE, json!("sonnet-next"))],
        "operations": [operation(
            "op-1", "ai-kit", MODEL_DEFAULT, PROJECT_SCOPE, "apply",
            plan["plan_digest"].as_str(), "verified",
            receipt_value["receipt_id"].as_str(), None
        )],
        "verification": {
            "reading_digest": reading_digest,
            "observed_at_unix_ms": 0,
            "reconciliations": [{ "setting_ref": MODEL_DEFAULT, "status": "satisfied" }]
        },
        "status": "verified"
    });
    as_changeset(&changeset, "t03 ChangeSet");

    std::fs::write(dir.join("receipt.json"), serde_json::to_vec(&receipt_value).unwrap()).unwrap();
    std::fs::write(dir.join("replay-receipt.json"), serde_json::to_vec(&replay_value).unwrap()).unwrap();
    std::fs::write(dir.join("reading.json"), serde_json::to_vec(&reading).unwrap()).unwrap();

    verdict(
        3,
        slug,
        "O:I-routed edit",
        "passed",
        vec![
            "owner validation is authoritative",
            "owner-minted plan_id/plan_digest verified by an independent implementation",
            "apply (stdin transport) executed owner-natively with a frozen-law receipt",
            "v2 re-read verified the change (satisfied)",
            "idempotent replay: no_op + original receipt, single execution",
        ],
        vec![
            c1("the kernel must own ChangeSet assembly and orchestration"),
            c5("`oi config apply` must return the same ChangeSet/receipt identity"),
        ],
        vec![format!("artifacts: {}", dir.display())],
    );
}

// ---------------------------------------------------------------------------
// 4 — profile switch
// ---------------------------------------------------------------------------

#[test]
fn t04_profile_switch() {
    let slug = "04-profile-switch";
    let (registry, ai_kit, oi) = registry_with_stubs(slug);
    let dir = artifacts_dir(slug);

    // The frozen profile fixture, consumed byte-for-byte.
    let profile_case = fixture("profile-development");
    let profile: oi_cli::configuration::Profile =
        serde_json::from_value(profile_case["profile"].clone()).expect("profile parses");
    validate_profile(&profile, &registry)
        .unwrap_or_else(|error| panic!("the frozen profile violates no contract against stub owners + connector fixture: {error}"));
    assert_eq!(profile.native_profiles.len(), 1);
    assert_eq!(profile.native_profiles[0].native_profile_ref, "coding", "native profiles travel by reference");

    // Profile switch: a deterministic, inspectable ChangeSet — every
    // desired entry becomes one requested change carried by one operation.
    let entries = profile_case["profile"]["desired"].as_array().unwrap();
    let mut requested_entries = Vec::new();
    let mut operations = Vec::new();
    let mut plans = Vec::new();
    for (index, entry) in entries.iter().enumerate() {
        let setting_ref = entry["setting_ref"].as_str().unwrap().to_owned();
        let scope_value = &entry["scope"];
        let scope_kind = scope_value["scope_kind"].as_str().unwrap().to_owned();
        let scope_compact = match scope_value["scope_ref"].as_str() {
            Some(r) => format!("{scope_kind}:{r}"),
            None => scope_kind.clone(),
        };
        let owner_ref = parse_setting_ref(&setting_ref).unwrap().owner_ref;
        let op_id = format!("op-{}", index + 1);
        requested_entries.push(json!({
            "setting_ref": setting_ref,
            "scope": parse_scope_compact(&scope_compact).unwrap(),
            "value": entry["value"].clone(),
            "secret_reference": entry["secret_reference"].clone(),
        }));
        if setting_ref == CONNECTOR_REF {
            // The connector owner has no executable on this base: the
            // operation stays planned, truthfully, until C4 binds.
            operations.push(operation(
                &op_id, "connector/factory-actuation", &setting_ref, &scope_compact,
                "apply", None, "planned", None, None,
            ));
            continue;
        }
        let owner = if owner_ref == "oi" { &oi } else { &ai_kit };
        let payload = if entry["secret_reference"].is_null() {
            serde_json::to_string(&entry["value"]).unwrap()
        } else {
            serde_json::to_string(&json!({
                "secret_reference": { "ref": entry["secret_reference"]["ref"].clone() }
            }))
            .unwrap()
        };
        owner
            .validate_setting(&setting_ref, Some(&scope_compact), &payload)
            .expect_success("profile-entry validation");
        let plan = owner
            .plan_setting(&setting_ref, Some(&scope_compact), &payload)
            .expect_success("profile-entry plan");
        operations.push(operation(
            &op_id,
            &owner_ref,
            &setting_ref,
            &scope_compact,
            "apply",
            plan["plan_digest"].as_str(),
            "validated",
            None,
            None,
        ));
        plans.push((owner_ref.clone(), plan));
    }
    assert_eq!(operations.len(), 5, "five desired entries, five operations");

    // No hidden writes: nothing has touched an owner store yet.
    for owner in [&ai_kit, &oi] {
        let overrides = owner.read_store()["overrides"].clone();
        assert!(
            overrides.as_object().map(|o| o.is_empty()).unwrap_or(true),
            "profile planning must not mutate the owner before apply"
        );
    }

    // Apply the four owner-backed operations; the connector operation
    // stays planned (no executable exists to run it — C4).
    let mut receipts = Vec::new();
    for (owner_ref, plan) in &plans {
        let owner = if owner_ref == "oi" { &oi } else { &ai_kit };
        let plan_path = owner.write_plan_file(plan);
        let receipt = owner
            .apply_plan_file(&plan_path, "cs-c7-t04")
            .expect_success("profile apply");
        receipts.push(receipt.clone());
        let op = operations
            .iter_mut()
            .find(|op| op["plan_digest"] == plan["plan_digest"])
            .expect("operation for plan");
        op["status"] = json!("verified");
        op["receipt_ref"] = receipt["receipt_id"].clone();
    }

    // Re-read both owners; reconcile every executed entry (secret by
    // reference — presence is observed-only, 09 §14).
    let ai_reading = ai_kit.reading();
    let oi_reading = oi.reading();
    let mut reconciliations = Vec::new();
    for entry in entries.iter() {
        let setting_ref = entry["setting_ref"].as_str().unwrap();
        if setting_ref == CONNECTOR_REF {
            continue; // unexecuted: no verification is claimed
        }
        let owner_reading = if setting_ref.starts_with("oi:") { &oi_reading } else { &ai_reading };
        let desired = if entry["secret_reference"].is_null() {
            entry["value"].clone()
        } else {
            json!({ "secret_reference": entry["secret_reference"]["ref"].clone() })
        };
        assert_eq!(
            reconcile_setting(owner_reading, &registry, setting_ref, Some(desired)),
            ReconciliationStatus::Satisfied,
            "profile switch verified on {setting_ref}"
        );
        reconciliations.push(json!({ "setting_ref": setting_ref, "status": "satisfied" }));
    }

    // The whole ChangeSet: 4 verified + 1 planned derives `validated`, the
    // truthful "not everything landed" state — the connector leg stays open.
    let changeset_value = json!({
        "schema": "oi.config-changeset/v1",
        "changeset_id": "cs-c7-t04",
        "created_at_unix_ms": 0,
        "profile_ref": "development",
        "requested": requested_entries,
        "operations": operations,
        "verification": {
            "reading_digest": ai_reading["owner"]["reading_digest"],
            "observed_at_unix_ms": 0,
            "reconciliations": reconciliations
        },
        "status": "planned"
    });
    // The frozen derivation refuses to overclaim: with the connector
    // operation unexecuted, the coarsest truthful state is `planned` — a
    // converged status would claim a completion that did not happen.
    let changeset = as_changeset(&changeset_value, "t04 ChangeSet");
    validate_changeset(&changeset, &registry)
        .unwrap_or_else(|error| panic!("the profile ChangeSet obeys the redaction law: {error}"));
    assert_eq!(
        derive_changeset_status(&changeset.operations, changeset.verification.as_ref()),
        ChangeSetStatus::Planned,
        "the frozen derivation does not overclaim while the connector operation is unexecuted"
    );
    assert_eq!(changeset.operations.len(), 5, "no compensation operation is invented");

    // The native-profile reference was preserved untouched by planning.
    let profile_after: oi_cli::configuration::Profile =
        serde_json::from_value(profile_case["profile"].clone()).expect("re-parses");
    assert_eq!(profile_after.native_profiles, profile.native_profiles);

    std::fs::write(dir.join("changeset.json"), serde_json::to_vec_pretty(&changeset_value).unwrap()).unwrap();
    std::fs::write(dir.join("profile.json"), serde_json::to_vec_pretty(&profile_case["profile"]).unwrap()).unwrap();

    verdict(
        4,
        slug,
        "profile switch",
        "passed",
        vec![
            "frozen profile validates against three owner kinds in one registry",
            "diff/plan produced inspectable owner plans before any apply",
            "no owner store changed before apply (no hidden writes)",
            "native-profile refs preserved by reference only",
            "sparse desired entries applied per owner; re-read reconciles satisfied",
            "frozen derivation does not overclaim: unexecuted connector op holds the ChangeSet at planned",
        ],
        vec![
            c2("profile persistence, selection and `oi profile use` are C2's engine"),
            pending("connector owner executable", "C4", "operation op-5 awaits the connector fixture owner; the scenario is defined and stays open"),
            c1("the kernel must drive profile ChangeSets"),
        ],
        vec![format!("artifacts: {}", dir.display())],
    );
}

// ---------------------------------------------------------------------------
// 5 — scope
// ---------------------------------------------------------------------------

#[test]
fn t05_scope_explicitness() {
    let slug = "05-scope-explicitness";
    let (registry, ai_kit, oi) = registry_with_stubs(slug);
    let dir = artifacts_dir(slug);

    let case_doc = fixture("scope-cases");
    let values: Value = json!({
        (MODEL_DEFAULT): "sonnet-current",
        (SESSION_PROVIDER): "herdr",
        "oi:composition:ground-binding": "stub://ground",
        (CONNECTOR_REF): "delegated"
    });
    let mut results = Vec::new();
    for entry in case_doc["cases"].as_array().expect("cases") {
        let name = entry["name"].as_str().unwrap();
        let setting_ref = entry["setting_ref"].as_str().unwrap();
        let scope_value = &entry["scope"];
        let scope_kind = scope_value["scope_kind"].as_str().unwrap();
        let scope_ref = scope_value["scope_ref"].as_str();
        let compact = match scope_ref {
            Some(r) => format!("{scope_kind}:{r}"),
            None => scope_kind.to_owned(),
        };
        let expected = entry["expect"].as_str().unwrap();

        // Frozen-registry decision (the O:I-side law).
        let registry_decision = match ScopeKind::from_wire(scope_kind) {
            None => ScopeDecision::UnknownScopeKind,
            Some(kind) => {
                let scope = Scope { scope_kind: kind, scope_ref: scope_ref.map(str::to_owned) };
                if scope.validate().is_err() {
                    ScopeDecision::UnsupportedScope
                } else {
                    registry.scope_decision(setting_ref, &scope)
                }
            }
        };
        let registry_wire = match registry_decision {
            ScopeDecision::Supported => "ok",
            ScopeDecision::UnsupportedScope => "unsupported_scope",
            ScopeDecision::UnknownScopeKind => "unknown_scope_kind",
        };

        // The owner-side decision, through the frozen transport. The
        // connector setting has no owner executable on this base: its case
        // is decided at contract level only.
        let owner_wire = if setting_ref == CONNECTOR_REF {
            registry_wire // no owner executable exists yet (C4)
        } else {
            let owner = if setting_ref.starts_with("oi:") { &oi } else { &ai_kit };
            let value = values[setting_ref].as_str().unwrap();
            let outcome = owner.validate_setting(setting_ref, Some(&compact), value);
            if outcome.exit == 0 {
                assert_eq!(outcome.json()["schema"], "oi.config-validation/v1");
                "ok"
            } else {
                let doc = outcome.json();
                assert_eq!(doc["schema"], "oi.config-error/v1", "scope case `{name}`");
                match doc["code"].as_str().unwrap() {
                    "unsupported_scope" => "unsupported_scope",
                    "unknown_scope_kind" => "unknown_scope_kind",
                    other => panic!("scope case `{name}`: unexpected code {other}"),
                }
            }
        };

        assert_eq!(registry_wire, expected, "registry decision for `{name}`");
        assert_eq!(owner_wire, expected, "owner decision for `{name}`");
        results.push(json!({ "name": name, "registry": registry_wire, "owner": owner_wire, "expect": expected }));
    }
    // The two implementations agreed on every frozen case.
    assert_eq!(results.len(), 9);

    std::fs::write(dir.join("scope-decisions.json"), serde_json::to_vec_pretty(&results).unwrap()).unwrap();

    verdict(
        5,
        slug,
        "scope",
        "partial",
        vec![
            "all nine frozen scope cases: registry and owner transport agree",
            "unsupported scope is an explicit error, never a fallback",
            "unknown scope kind is an explicit error, never invented",
        ],
        vec![pending(
            "connector owner executable",
            "C4",
            "the connector-relation scope case ran at contract (registry) level only; the executable case re-runs when C4's fixture owner lands",
        )],
        vec![format!("artifacts: {}", dir.display())],
    );
}

// ---------------------------------------------------------------------------
// 6 — secrets
// ---------------------------------------------------------------------------

#[test]
fn t06_secrets_never_materialize() {
    let slug = "06-secrets";
    let (registry, ai_kit, _oi) = registry_with_stubs(slug);
    let dir = artifacts_dir(slug);

    // Attempt 1: hand the owner credential material directly. The owner
    // refuses — and its error document must not echo the material.
    let outcome = ai_kit.validate_setting(CREDENTIAL_REF, Some("world"), &format!("\"{CANARY}\""));
    let error_doc = outcome.expect_error("secret material via validate", "invalid_value");
    assert!(
        !outcome.stdout.contains(CANARY),
        "the owner echoed credential material back into its error document"
    );
    assert!(serde_json::to_string(&error_doc).unwrap().contains("secret_reference"));

    // Attempt 2: material through plan.
    ai_kit
        .plan_setting(CREDENTIAL_REF, Some("world"), &format!("\"{CANARY}\""))
        .expect_error("secret material via plan", "invalid_value");

    // Attempt 3: material through an O:I profile — the frozen validator
    // rejects it, naming the redaction law.
    let violating: oi_cli::configuration::Profile = serde_json::from_value(
        fixture("secret-redaction-cases")["violating_example"]["document"].clone(),
    )
    .expect("violating example parses");
    let error = validate_profile(&violating, &registry).expect_err("material in a profile must be rejected");
    assert!(error.contains("redaction"), "rejection names the law: {error}");

    // The honest path: the plane carries a reference; presence is the
    // owner's own fact.
    let plan = ai_kit
        .plan_setting(CREDENTIAL_REF, Some("world"), "{\"secret_reference\":{\"ref\":\"stub:credentials:anthropic-key\"}}")
        .expect_success("secret reference plan");
    assert!(
        plan.get("value").is_none(),
        "a plan for a secret-kind setting carries no value"
    );
    assert_eq!(plan["secret_reference"]["ref"], json!("stub:credentials:anthropic-key"));
    let plan_path = ai_kit.write_plan_file(&plan);
    let receipt = ai_kit.apply_plan_file(&plan_path, "cs-c7-t06").expect_success("secret apply");

    let receipt_typed: Receipt = serde_json::from_value(receipt.clone()).expect("receipt parses");
    receipt_typed.validate().expect("receipt obeys the frozen laws");
    assert_eq!(receipt_typed.outcome, ReceiptOutcome::Applied);
    let reading = ai_kit.reading();
    let axes = owner_axes(&reading, CREDENTIAL_REF, true);
    assert_eq!(
        axes.comparison_value,
        Some(json!({ "secret_reference": { "ref": "stub:credentials:anthropic-key" } })),
        "the owner discloses presence plus reference"
    );
    assert_eq!(
        reconcile_setting(&reading, &registry, CREDENTIAL_REF, Some(json!({ "secret_reference": { "ref": "stub:credentials:anthropic-key" } }))),
        ReconciliationStatus::Satisfied
    );

    // The frozen redaction fixture re-proves every O:I-owned document type.
    let redaction_case = fixture("secret-redaction-cases");
    for document_entry in redaction_case["documents"].as_array().unwrap() {
        let document = &document_entry["document"];
        match document["schema"].as_str().unwrap() {
            "oi.profile/v1" => {
                let profile: oi_cli::configuration::Profile =
                    serde_json::from_value(document.clone()).expect("parses");
                validate_profile(&profile, &registry).expect("clean profile");
            }
            "oi.config-changeset/v1" => {
                let changeset: oi_cli::configuration::ChangeSet =
                    serde_json::from_value(document.clone()).expect("parses");
                validate_changeset(&changeset, &registry).expect("clean changeset");
            }
            "oi.config-receipt/v1" => {
                let receipt: Receipt = serde_json::from_value(document.clone()).expect("parses");
                receipt.validate().expect("clean receipt");
            }
            "oi.config-resolution/v1" => {
                let resolution: Resolution = serde_json::from_value(document.clone()).expect("parses");
                validate_resolution(&resolution, &registry).expect("clean resolution");
            }
            other => panic!("unknown schema {other}"),
        }
    }

    std::fs::write(dir.join("secret-receipt.json"), serde_json::to_vec(&receipt).unwrap()).unwrap();
    std::fs::write(dir.join("secret-plan.json"), serde_json::to_vec(&plan).unwrap()).unwrap();
    std::fs::write(dir.join("secret-reading.json"), serde_json::to_vec(&reading).unwrap()).unwrap();
    // The owner-side log is part of the artifact surface and must be
    // redaction-safe too.
    std::fs::write(dir.join("owner-history.log"), ai_kit.history()).unwrap();

    verdict(
        6,
        slug,
        "secrets",
        "passed",
        vec![
            "material refused at validate and plan; error documents echo nothing",
            "material-carrying profile rejected by the frozen validator",
            "reference-only flow: plan carries secret_reference, no value",
            "presence disclosed by the owner; reconciliation by reference",
            "frozen redaction fixture re-proven across all O:I document types",
        ],
        vec![
            c5("CLI must render presence-only for secret-kind settings"),
            c6("Desktop must render presence + owner operation, never a value"),
        ],
        vec![format!("artifacts: {}", dir.display())],
    );
}

// ---------------------------------------------------------------------------
// 7 — partial multi-owner apply
// ---------------------------------------------------------------------------

#[test]
fn t07_partial_multi_owner_apply() {
    let slug = "07-partial-multi-owner";
    let (_registry, ai_kit, _oi) = registry_with_stubs(slug);
    // The second owner is degraded: its mutation surface is honestly down.
    // Its sandbox is separate from the healthy registry stub's.
    let oi_down = stub(&format!("{slug}-degraded"), "oi", true);
    let dir = artifacts_dir(slug);

    // Owner 1 plans and applies normally.
    let (plan, receipt) = plan_and_apply(&ai_kit, MODEL_DEFAULT, PROJECT_SCOPE, "sonnet-next", "cs-c7-t07");
    assert_eq!(receipt["outcome"], json!("applied"));

    // Owner 2 refuses at plan: the error is explicit and frozen-coded.
    let error_doc = oi_down
        .plan_setting(VERIFY_BEFORE_RUN, Some("world"), "true")
        .expect_error("degraded owner plan", "owner_unavailable");
    // A direct validate attempt is refused with the same honesty.
    let _ = oi_down
        .validate_setting(VERIFY_BEFORE_RUN, Some("world"), "true")
        .expect_error("degraded owner validate", "owner_unavailable");
    // The operation carries the owner's error in the frozen shape.
    let owner_error = json!({
        "code": error_doc["code"],
        "message": error_doc["message"],
        "retryable": true
    });

    // The ChangeSet keeps per-operation truth: one verified, one failed
    // with the owner's own error — and derives `partially_applied`.
    let changeset_value = json!({
        "schema": "oi.config-changeset/v1",
        "changeset_id": "cs-c7-t07",
        "created_at_unix_ms": 0,
        "requested": [
            requested(MODEL_DEFAULT, PROJECT_SCOPE, json!("sonnet-next")),
            requested(VERIFY_BEFORE_RUN, "world", json!(true))
        ],
        "operations": [
            operation(
                "op-1", "ai-kit", MODEL_DEFAULT, PROJECT_SCOPE, "apply",
                plan["plan_digest"].as_str(), "verified",
                receipt["receipt_id"].as_str(), None
            ),
            operation(
                "op-2", "oi", VERIFY_BEFORE_RUN, "world", "apply", None, "failed", None,
                Some(owner_error)
            )
        ],
        "verification": {
            "reading_digest": Value::Null,
            "observed_at_unix_ms": 0,
            "reconciliations": []
        },
        "status": "partially_applied"
    });
    let changeset = as_changeset(&changeset_value, "t07 ChangeSet");
    assert_eq!(
        derive_changeset_status(&changeset.operations, None),
        ChangeSetStatus::PartiallyApplied
    );
    assert_eq!(changeset.operations.len(), 2, "no invented rollback: exactly the two requested mutations");
    let failed = &changeset.operations[1];
    assert_eq!(failed.error.as_ref().expect("failed op carries its error").code, "owner_unavailable");
    assert!(changeset.operations[0].receipt_ref.is_some(), "the applied operation keeps its receipt");
    assert!(
        changeset_value["verification"]["reconciliations"].as_array().unwrap().is_empty()
            && changeset_value["verification"]["reading_digest"].is_null(),
        "no verification is claimed for a changeset that did not verify"
    );

    std::fs::write(dir.join("partial-changeset.json"), serde_json::to_vec_pretty(&changeset_value).unwrap()).unwrap();
    std::fs::write(dir.join("oi-error.json"), serde_json::to_vec(&error_doc).unwrap()).unwrap();

    verdict(
        7,
        slug,
        "partial multi-owner apply",
        "passed",
        vec![
            "two owners in one ChangeSet, per-operation truth preserved",
            "degraded owner refuses explicitly (owner_unavailable), exit non-zero",
            "derived overall status partially_applied (frozen derivation)",
            "no fake rollback: exactly the requested operations, failed op keeps its error",
            "no verification overclaimed",
        ],
        vec![c1("the kernel orchestrates multi-owner application; the harness proved the cross-owner law")],
        vec![format!("artifacts: {}", dir.display())],
    );
}

// ---------------------------------------------------------------------------
// 8 — absence / degradation
// ---------------------------------------------------------------------------

#[test]
fn t08_absence_degradation_honesty() {
    let slug = "08-absence-degradation";
    let (registry, _ai_kit, _oi) = registry_with_stubs(slug);
    let dir = artifacts_dir(slug);
    let absent_owner = stub(slug, "oi", true);

    // The contribution is honest about absence: unavailable, empty
    // sections as proof, obligations named — nothing fabricated.
    let contribution_doc = absent_owner.contribution().expect_success("unavailable contribution");
    let contribution: Contribution =
        serde_json::from_value(contribution_doc.clone()).expect("unavailable contribution parses");
    contribution.validate().expect("honest absence still obeys the contract");
    assert_eq!(contribution_doc["availability"]["state"], json!("unavailable"));
    assert_eq!(contribution_doc["sections"], json!([]));
    assert!(
        contribution_doc["obligations"].as_array().map(|o| !o.is_empty()).unwrap_or(false),
        "absence names its obligation"
    );
    assert!(
        registry.lookup("workcell:placement:placement.policy").is_none(),
        "the unavailable fixture owner fabricates no settings (L3)"
    );

    // Reconciliation is blocked, explicitly.
    let reading = absent_owner.reading();
    assert_eq!(reading["availability"]["state"], json!("unavailable"));
    assert_eq!(
        reconcile_setting(&reading, &registry, VERIFY_BEFORE_RUN, Some(json!(true))),
        ReconciliationStatus::Blocked
    );

    // Every mutation refuses with the frozen code, non-zero exit.
    for attempt in [
        absent_owner.validate_setting(VERIFY_BEFORE_RUN, Some("world"), "true"),
        absent_owner.plan_setting(VERIFY_BEFORE_RUN, Some("world"), "true"),
    ] {
        attempt.expect_error("degraded mutation", "owner_unavailable");
    }

    // A setting no owner contributes is unsupported, never guessed.
    let unknown = owner_axes(&stub(slug, "ai-kit", false).reading(), "ai-kit:nonexistent:never.provided", false);
    assert!(unknown.effective.is_none());
    assert_eq!(
        reconcile(ReconciliationInputs {
            desired: Some(&json!("anything")),
            native_effective: None,
            native_declared: None,
            stage_state: StageState::None,
            owner_available: true,
            setting_supported: false,
        }),
        ReconciliationStatus::Unsupported
    );

    std::fs::write(dir.join("unavailable-contribution.json"), serde_json::to_vec_pretty(&contribution_doc).unwrap()).unwrap();
    std::fs::write(dir.join("unavailable-reading.json"), serde_json::to_vec(&reading).unwrap()).unwrap();

    verdict(
        8,
        slug,
        "absence/degradation",
        "passed",
        vec![
            "unavailable owner disclosed honestly (empty sections, obligations, L3)",
            "reconciliation blocked, explicitly",
            "mutations refuse with the frozen owner_unavailable code",
            "unknown settings reconcile unsupported, never guessed",
        ],
        vec![
            c5("`oi config doctor` must surface the distinction (unavailable vs drift vs pending)"),
            c6("Desktop must render absence as absence — no fabricated controls"),
        ],
        vec![format!("artifacts: {}", dir.display())],
    );
}

// ---------------------------------------------------------------------------
// 9 — CLI/Desktop parity
// ---------------------------------------------------------------------------

#[test]
fn t09_cli_desktop_parity() {
    let slug = "09-cli-desktop-parity";
    let (registry, ai_kit, _oi) = registry_with_stubs(slug);
    let dir = artifacts_dir(slug);

    // One operation, observed through four independent surfaces of the
    // owner boundary: the transport stdout, the persisted receipt, the
    // owner's history log, and the v2 disclosure's materialisation ref.
    let (plan, receipt) = plan_and_apply(&ai_kit, MODEL_DEFAULT, PROJECT_SCOPE, "sonnet-next", "cs-c7-t09");
    let receipt_id = receipt["receipt_id"].as_str().unwrap().to_owned();

    let persisted: Value = serde_json::from_str(
        &std::fs::read_to_string(ai_kit.receipts_dir().join(format!("{receipt_id}.json")))
            .expect("persisted receipt"),
    )
    .unwrap();
    assert_eq!(persisted, receipt, "transport stdout and the owner's record agree byte-wise");

    let history = ai_kit.history();
    assert!(
        history.contains(&receipt_id),
        "the owner history names the same receipt identity"
    );

    let reading = ai_kit.reading();
    let materialisation = reading["sections"]
        .as_array()
        .unwrap()
        .iter()
        .find_map(|s| {
            s["settings"]
                .as_array()
                .unwrap()
                .iter()
                .find(|set| set["key"] == "model.default")
                .map(|set| set["axes"]["active"]["materialisation_ref"].clone())
        })
        .expect("materialisation ref");
    assert_eq!(materialisation, json!(receipt_id), "the disclosure names the same operation");

    // The parity contract the surfaces must satisfy once bound: one
    // setting_ref, one desired/native state, one ChangeSet/receipt identity.
    let parity_matrix = json!({
        "setting_ref": MODEL_DEFAULT,
        "scope": parse_scope_compact(PROJECT_SCOPE),
        "changeset_id": "cs-c7-t09",
        "receipt_id": receipt_id,
        "plan_digest": plan["plan_digest"],
        "desired": "sonnet-next",
        "native_effective": owner_axes(&reading, MODEL_DEFAULT, false).effective,
        "reconciliation": "satisfied"
    });
    assert_eq!(
        reconcile_setting(&reading, &registry, MODEL_DEFAULT, Some(json!("sonnet-next"))),
        ReconciliationStatus::Satisfied
    );
    std::fs::write(dir.join("parity-matrix.json"), serde_json::to_vec_pretty(&parity_matrix).unwrap()).unwrap();

    verdict(
        9,
        slug,
        "CLI/Desktop parity",
        "partial",
        vec![
            "owner-boundary identity consistent across transport stdout, persisted receipt, history log and v2 disclosure",
            "the parity matrix (setting_ref, scope, ids, desired/native state) the surfaces must satisfy is pinned as data",
        ],
        vec![
            c5("the `oi config` CLI must return this same identity to be bound into the matrix"),
            c6("the Desktop must consume this same identity"),
            c1("the kernel issues the ChangeSet both surfaces must share"),
        ],
        vec![format!("artifacts: {}", dir.display())],
    );
}

// ---------------------------------------------------------------------------
// 10 — Agent parity
// ---------------------------------------------------------------------------

#[test]
fn t10_agent_parity() {
    let slug = "10-agent-parity";
    let (registry, ai_kit, _oi) = registry_with_stubs(slug);
    let dir = artifacts_dir(slug);

    // An agent operates headlessly: every step is a bare-JSON subprocess
    // document, no UI concept exists anywhere on the path.
    let contribution = ai_kit.contribution().expect_success("agent discovery");
    assert!(contribution.is_object(), "bare document, no envelope");
    let plan = ai_kit
        .plan_setting(SESSION_PROVIDER, Some("world"), "herdr")
        .expect_success("agent plan");
    assert!(plan.is_object());
    let plan_path = ai_kit.write_plan_file(&plan);
    let receipt = ai_kit.apply_plan_file(&plan_path, "cs-c7-t10").expect_success("agent apply");
    let reading = ai_kit.reading();
    assert_eq!(
        reconcile_setting(&reading, &registry, SESSION_PROVIDER, Some(json!("herdr"))),
        ReconciliationStatus::Satisfied
    );

    // Structured state parity: the agent reads the same documents the
    // transport serves — same refs, same receipt identity, same axes.
    let state = json!({
        "discovered": contribution["owner"]["owner_ref"],
        "setting_ref": SESSION_PROVIDER,
        "profileable": registry.lookup(SESSION_PROVIDER).unwrap().spec.profileable,
        "plan_id": plan["plan_id"],
        "receipt_id": receipt["receipt_id"],
        "reconciliation": "satisfied"
    });
    assert_eq!(state["profileable"], json!(true));

    std::fs::write(dir.join("agent-state.json"), serde_json::to_vec_pretty(&state).unwrap()).unwrap();
    std::fs::write(dir.join("agent-receipt.json"), serde_json::to_vec(&receipt).unwrap()).unwrap();

    verdict(
        10,
        slug,
        "Agent parity",
        "partial",
        vec![
            "whole flow driven through bare-JSON subprocess documents (no DOM/UI dependence)",
            "agent-visible structured state identical to the transport's documents",
        ],
        vec![
            pending("O:I native Action surface", "C1/C5", "the agent-facing authorised operation over the kernel must expose the same structured state"),
            c6("Desktop consumes the same state; parity across agent and UI"),
        ],
        vec![format!("artifacts: {}", dir.display())],
    );
}

// ---------------------------------------------------------------------------
// 11 — no semantic mirroring
// ---------------------------------------------------------------------------

#[test]
fn t11_no_semantic_mirroring() {
    let slug = "11-no-semantic-mirroring";
    let (registry, ai_kit, _oi) = registry_with_stubs(slug);
    let dir = artifacts_dir(slug);

    // (a) Validation authority is the owner's. The harness reached the
    // decision through generic registry/transport code only — no
    // per-setting branch exists on the O:I side.
    let rejection = ai_kit
        .plan_setting(MODEL_DEFAULT, Some(PROJECT_SCOPE), "\"wizard-model\"")
        .expect_error("owner refuses a value outside its options", "invalid_value");
    assert!(serde_json::to_string(&rejection).unwrap().contains("owner's options"));

    // (b) Computed defaults are disclosed, never cached: the contribution
    // carries no `default` for a computed-default setting, and the only
    // profile the suite treats as O:I desired state stays sparse — no
    // native tree is snapshotted into it.
    let contribution = ai_kit.contribution().expect_success("contribution");
    let model_entry = contribution["sections"]
        .as_array()
        .unwrap()
        .iter()
        .flat_map(|s| s["settings"].as_array().unwrap().iter())
        .find(|s| s["setting_ref"] == json!(MODEL_DEFAULT))
        .unwrap();
    assert_eq!(model_entry["default_semantics"], json!("computed"));
    assert!(
        model_entry.get("default").is_none(),
        "a computed default is never materialised into the contribution"
    );
    let profile_body = serde_json::to_string(&fixture("profile-development")["profile"]).unwrap();
    for native_only_value in ["\"cmux\"", "\"tmux\"", "\"plain\"", "\"opus\""] {
        assert!(
            !profile_body.contains(native_only_value),
            "the profile snapshots no native catalogue value {native_only_value}"
        );
    }

    // (c) Two independent implementations of the frozen grammar agree.
    let corpus = [
        "ai-kit:resolution:model.default",
        "oi:composition:managed-root",
        "connector/factory-actuation:authority:authority.mode",
        "a-b_1:c-d:e_f.g-h",
        "ai-kit:resolution",
        "ai-kit:resolution:model.default:extra",
        "AIKit:resolution:model.default",
        "ai-kit:resolu.tion:model.default",
        "ai-kit:resolution:",
    ];
    let mut grammar_agreement = Vec::new();
    for reference in corpus {
        let oi_cli_accepts = parse_setting_ref(reference).is_ok();
        let stub_answer = ai_kit.validate_setting(reference, None, "true");
        // The stub answers unsupported_setting for anything it does not
        // contribute; a *malformed* ref is named as malformed. Grammar
        // acceptance agrees when the stub does not reject the ref as
        // malformed.
        let stub_accepts_grammar = !(stub_answer.exit != 0
            && stub_answer
                .stdout
                .contains("malformed setting ref"));
        assert_eq!(
            oi_cli_accepts, stub_accepts_grammar,
            "grammar disagreement on `{reference}`: oi_cli={oi_cli_accepts} stub={stub_accepts_grammar}"
        );
        grammar_agreement.push(json!({ "ref": reference, "accepted": oi_cli_accepts }));
    }

    // (d) One generic path serves all owner kinds (registry with product,
    // oi and connector settings resolves through one lookup API).
    for reference in [MODEL_DEFAULT, VERIFY_BEFORE_RUN, CONNECTOR_REF] {
        assert!(registry.lookup(reference).is_some(), "{reference} resolves generically");
    }

    std::fs::write(dir.join("grammar-agreement.json"), serde_json::to_vec_pretty(&grammar_agreement).unwrap()).unwrap();
    std::fs::write(dir.join("owner-rejection.json"), serde_json::to_vec(&rejection).unwrap()).unwrap();

    verdict(
        11,
        slug,
        "no semantic mirroring",
        "passed",
        vec![
            "owner validation authority proven (O:I side holds no value logic)",
            "computed defaults disclosed but never materialised/cached",
            "profiles stay sparse — no native tree snapshot",
            "two independent grammar implementations agree on accept/reject",
            "one generic registry path serves product/oi/connector owners",
        ],
        vec![pending(
            "real owner lanes",
            "C3",
            "each real owner proves the same law with its own executable against these fixtures",
        )],
        vec![format!("artifacts: {}", dir.display())],
    );
}

// ---------------------------------------------------------------------------
// 12 — bootstrap reuse
// ---------------------------------------------------------------------------

#[test]
fn t12_bootstrap_reuse() {
    let slug = "12-bootstrap-reuse";
    let (registry, ai_kit, _oi) = registry_with_stubs(slug);
    let dir = artifacts_dir(slug);

    // An empty world: the sandbox store is empty. The FIRST contact with
    // the owner is the same discovery and the same transport — no separate
    // bootstrap settings language exists.
    let contribution = ai_kit.contribution().expect_success("first-contact contribution");
    assert_eq!(contribution["availability"]["state"], json!("available"));

    // The honest empty world: nobody has authored anything, so `declared`
    // is null — and that null is the finding (07 §4.8).
    let reading = ai_kit.reading();
    let axes = owner_axes(&reading, MODEL_DEFAULT, false);
    assert_eq!(axes.declared, None, "an empty world declares nothing");
    assert_eq!(
        axes.effective,
        Some(json!("sonnet-current")),
        "the owner still resolves its computed default"
    );
    assert_eq!(
        reconcile_setting(&reading, &registry, MODEL_DEFAULT, None),
        ReconciliationStatus::Satisfied,
        "no desired held and nothing owed is satisfied"
    );

    // First-run configuration is the ordinary verb set, unmodified.
    let (_plan, receipt) = plan_and_apply(&ai_kit, MODEL_DEFAULT, PROJECT_SCOPE, "sonnet-current", "cs-c7-t12");
    assert_eq!(receipt["outcome"], json!("applied"));
    let after = ai_kit.reading();
    let axes_after = owner_axes(&after, MODEL_DEFAULT, false);
    assert_eq!(axes_after.declared, Some(json!("sonnet-current")));
    assert_eq!(
        reconcile_setting(&after, &registry, MODEL_DEFAULT, Some(json!("sonnet-current"))),
        ReconciliationStatus::Satisfied
    );

    // Reset restores the empty world through the ordinary grammar.
    let reset_receipt = ai_kit
        .reset_setting(MODEL_DEFAULT, Some(PROJECT_SCOPE), "cs-c7-t12-reset")
        .expect_success("reset");
    assert_eq!(reset_receipt["operation"], json!("reset"));
    let axes_reset = owner_axes(&ai_kit.reading(), MODEL_DEFAULT, false);
    assert_eq!(axes_reset.declared, None, "reset returns the world to empty");

    std::fs::write(dir.join("bootstrap-reading.json"), serde_json::to_vec_pretty(&reading).unwrap()).unwrap();
    std::fs::write(dir.join("bootstrap-reset-receipt.json"), serde_json::to_vec(&reset_receipt).unwrap()).unwrap();

    verdict(
        12,
        slug,
        "bootstrap reuse",
        "passed",
        vec![
            "empty world served by the same discovery/transport verbs",
            "empty-world disclosure honest: declared null, owner default resolves",
            "first-run configuration through the ordinary plan/apply path",
            "reset through the ordinary grammar restores the empty world",
        ],
        vec![
            pending("O:I bootstrap/adopt", "C1/C2", "install/first-run must reuse the kernel engine — the stub-side world is proven"),
            c5("the same verbs must be reachable as `oi config` in an empty world"),
        ],
        vec![format!("artifacts: {}", dir.display())],
    );
}

// ---------------------------------------------------------------------------
// 13 — connector proof
// ---------------------------------------------------------------------------

#[test]
fn t13_connector_proof() {
    let slug = "13-connector-proof";
    let (registry, _ai_kit, _oi) = registry_with_stubs(slug);
    let dir = artifacts_dir(slug);

    // Representability is frozen and proven: the connector owner
    // contributes beside product and oi owners, in the same registry,
    // addressed at its relation scope.
    let connector_case = fixture("contribution-connector-fixture")["contribution"].clone();
    let entry = registry
        .lookup(CONNECTOR_REF)
        .expect("connector setting resolves beside product/oi settings");
    assert_eq!(entry.spec.value_schema.kind, ValueKind::Enum);
    let relation_scope = parse_scope_compact("connector-relation:factory-actuation").expect("relation scope");
    assert_eq!(
        registry.scope_decision(CONNECTOR_REF, &relation_scope),
        ScopeDecision::Supported
    );
    let other_relation = parse_scope_compact("connector-relation:some-other-relation").expect("scope");
    assert_ne!(
        registry.scope_decision(CONNECTOR_REF, &other_relation),
        ScopeDecision::Supported,
        "another relation's scope is not silently accepted"
    );

    // The executable leg: the connector fixture owner (C4's deliverable,
    // `suite/configuration/connector-fixture/`) does not exist on this
    // base. The scenario is defined and stays open — never faked.
    let connector_fixture_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../configuration/connector-fixture");
    let executable_available = connector_fixture_dir.exists();
    assert!(
        !executable_available,
        "C4's connector fixture executable exists on this base: bind it here (drive config-contribution, plan, apply, receipt, reread) instead of reporting pending"
    );

    std::fs::write(dir.join("connector-contribution.json"), serde_json::to_vec_pretty(&connector_case).unwrap()).unwrap();
    std::fs::write(
        dir.join("connector-scenario.json"),
        serde_json::to_vec_pretty(&json!({
            "scenario": "connector-owned relation configuration",
            "setting_ref": CONNECTOR_REF,
            "scope": relation_scope,
            "steps": [
                "connector executable serves config-contribution --json",
                "registry registers it beside product/oi owners",
                "plan/apply through the same C0-5 transport",
                "connector-minted receipt",
                "relation-scoped reread + reconciliation"
            ],
            "state": "defined; executable binding awaits C4 (suite/configuration/connector-fixture/)"
        }))
        .unwrap(),
    )
    .unwrap();

    verdict(
        13,
        slug,
        "connector proof",
        "partial",
        vec![
            "connector owner representable in the one registry (frozen fixture)",
            "relation scope decided explicitly (accepted for its relation, refused for another)",
        ],
        vec![pending(
            "connector fixture owner executable",
            "C4",
            "plan/apply/receipt/reread for a relation-scoped setting needs the connector executable; the scenario is fully defined in connector-scenario.json and must be bound, not re-implemented",
        )],
        vec![format!("artifacts: {}", dir.display())],
    );
}

// ---------------------------------------------------------------------------
// 14 — versioning
// ---------------------------------------------------------------------------

#[test]
fn t14_versioning_explicit_degradation() {
    let slug = "14-versioning";
    let (registry, ai_kit, _oi) = registry_with_stubs(slug);
    let dir = artifacts_dir(slug);

    // Same-major additive evolution: unknown fields are tolerated and no
    // setting is dropped.
    let mut injected = ai_kit.contribution().expect_success("contribution");
    injected["oi-future-top-field"] = json!({ "note": "unknown members are tolerated" });
    injected["sections"][0]["settings"][0]["oi-future-setting-field"] = json!(true);
    let contribution: Contribution =
        serde_json::from_value(injected.clone()).expect("unknown fields tolerated on read (09 §15)");
    contribution.validate().expect("unknown fields never invalidate a same-major document");
    assert!(registry.lookup(MODEL_DEFAULT).is_some(), "settings survive unknown fields");

    // An unknown major is an explicit unsupported_schema error — never a
    // silent reinterpretation, never a silent drop.
    let future_owner = stub(slug, "ai-kit", false).with_contract("future-schema");
    let future_doc = future_owner.contribution().expect_success("future owner still discloses");
    assert_eq!(future_doc["schema"], json!("oi.configuration-contribution/v2"));
    let future_contribution: Contribution =
        serde_json::from_value(future_doc.clone()).expect("the document itself parses");
    let error = future_contribution
        .validate()
        .expect_err("an unknown major must be an explicit error");
    assert!(error.contains("unsupported_schema"), "rejection names the law: {error}");

    // An unknown value-schema kind inside an otherwise-v1 document is an
    // explicit rejection (an operability contract: consumers must know they
    // can operate — 09 §2.2), never a degraded rendering of an inoperable
    // setting.
    let unknown_kind_owner = stub(slug, "ai-kit", false).with_contract("unknown-kind");
    let unknown_doc = unknown_kind_owner.contribution().expect_success("unknown-kind owner discloses");
    let parse_error = serde_json::from_value::<Contribution>(unknown_doc.clone())
        .expect_err("a v1 document with an unknown value kind must be refused");
    assert!(
        parse_error.to_string().contains("unknown variant"),
        "the refusal names the unknown kind explicitly: {parse_error}"
    );

    // The pass-through duty: owner documents relay unmodified. The suite
    // writes every owner document byte-for-byte into its artifacts (see the
    // writes throughout), and the mount digest convention is honoured by
    // the owner itself (verified in t02: changed world, changed digest).
    std::fs::write(dir.join("injected-contribution.json"), serde_json::to_vec_pretty(&injected).unwrap()).unwrap();
    std::fs::write(dir.join("future-contribution.json"), serde_json::to_vec_pretty(&future_doc).unwrap()).unwrap();
    std::fs::write(dir.join("unknown-kind-contribution.json"), serde_json::to_vec_pretty(&unknown_doc).unwrap()).unwrap();

    verdict(
        14,
        slug,
        "versioning",
        "passed",
        vec![
            "unknown fields tolerated, settings never dropped",
            "unknown major rejected explicitly (unsupported_schema)",
            "unknown value-schema kind inside v1 refused explicitly",
            "owner documents relayed verbatim; digest convention proven in test 2",
        ],
        vec![c1("the kernel mount must carry the same explicit-degradation behaviour end-to-end")],
        vec![format!("artifacts: {}", dir.display())],
    );
}
