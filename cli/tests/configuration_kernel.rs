//! C1 kernel acceptance (#299 §16), driven by the frozen C0 fixtures
//! (`docs/cradle/09-CONFIGURATION-PLANE.md` §16): a fixture owner contributes
//! settings through the frozen discovery relation, is resolved at supported
//! scopes, receives planned/applied mutations through the frozen four-verb
//! transport, returns native receipts, and is re-read into truthful
//! reconciliation states — with no product-specific kernel branches. The
//! in-memory [`FixtureTransport`] stands in for owner executables; the real
//! `ProcessTransport` spawn loop is proven separately against a throwaway
//! shell fixture in this file only.

use oi_cli::configuration::kernel::{
    assemble_changeset, execute_changeset, reset_setting, resolve_setting, resolve_setting_address,
    ApplyRequest, ChangeKind, ConfigurationStore, DesiredChange, DesiredInput, OwnerGateway,
    OwnerRegistry, OwnerSpec, OwnerTransport, PlanDocument, ProcessTransport, ResetRequest,
    SettingRequest, TransportError, TransportFailure,
};
use oi_cli::configuration::{
    parse_scope_compact, validate_resolution, ChangeSetStatus, ErrorCode, IdempotencyKey,
    OperationKind, OperationStatus, ReceiptOutcome, ReconciliationStatus, Resolution, Scope,
    ScopeKind, ValueKind,
};
use serde_json::{json, Value};
use std::cell::{Cell, RefCell};
use std::collections::{BTreeMap, VecDeque};
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

fn contribution_of(name: &str) -> Value {
    load_case(name)["contribution"].clone()
}

/// Deterministic owner-side plan digest (the owner mints it; it only has to
/// be stable so the replay test exercises the frozen idempotency key).
fn plan_digest(request: &SettingRequest) -> String {
    use sha2::{Digest, Sha256};
    let body = format!(
        "{}|{}|{}",
        request.setting_ref,
        request.scope.compact(),
        request.value
    );
    let digest = Sha256::digest(body.as_bytes());
    digest.iter().map(|byte| format!("{byte:02x}")).collect()
}

fn key_of(setting_ref: &str) -> &str {
    setting_ref.split(':').nth(2).unwrap_or(setting_ref)
}

/// A fixture-backed owner: it answers the frozen discovery command and the
/// four-verb grammar from the C0 fixture documents, keeps a tiny native
/// state (the owner's own declared/effective truth), and hands back the
/// receipts the fixtures freeze. It is a stand-in owner executable, not
/// kernel code: the kernel drives it only through the [`OwnerTransport`]
/// trait, exactly as it would drive a real process.
#[derive(Default, Debug)]
struct FixtureTransport {
    contributions: BTreeMap<String, Value>,
    /// Whole-reading overrides (the resolution-case path pins exact axes).
    readings: BTreeMap<String, Value>,
    /// The owner's own state: setting_ref -> applied value.
    state: RefCell<BTreeMap<String, Value>>,
    /// Per-owner availability state for generated readings.
    availability: BTreeMap<String, String>,
    /// Per-owner receipt documents to hand back, in order (fixture bytes).
    receipt_queue: RefCell<BTreeMap<String, VecDeque<Value>>>,
    /// plan_digest -> the value the plan carries (a real owner plans a
    /// change and later executes that plan).
    planned_values: RefCell<BTreeMap<String, Value>>,
    /// Executed idempotency keys -> original receipt id (09 §9).
    executed: RefCell<BTreeMap<String, String>>,
    /// How many times the owner actually executed a mutation.
    executions: Cell<usize>,
    plans: Cell<u64>,
}

impl FixtureTransport {
    fn with_contribution(mut self, owner_ref: &str, fixture: &str) -> Self {
        self.contributions
            .insert(owner_ref.to_owned(), contribution_of(fixture));
        self
    }

    fn with_reading(mut self, owner_ref: &str, reading: Value) -> Self {
        self.readings.insert(owner_ref.to_owned(), reading);
        self
    }

    fn with_availability(mut self, owner_ref: &str, state: &str) -> Self {
        self.availability
            .insert(owner_ref.to_owned(), state.to_owned());
        self
    }

    /// Queue the receipts a fixture freezes for one owner: the single
    /// `receipt`, or every document under `receipts` named `owner_ref`.
    fn with_fixture_receipts(self, owner_ref: &str, fixture: &str) -> Self {
        let case = load_case(fixture);
        let documents: Vec<Value> = if let Some(receipt) = case.get("receipt") {
            vec![receipt.clone()]
        } else {
            case["receipts"]
                .as_array()
                .expect("receipts array")
                .iter()
                .filter(|receipt| receipt["owner_ref"].as_str() == Some(owner_ref))
                .cloned()
                .collect()
        };
        self.receipt_queue
            .borrow_mut()
            .insert(owner_ref.to_owned(), documents.into());
        self
    }

    fn effect_of(&self, setting_ref: &str) -> Value {
        for contribution in self.contributions.values() {
            for section in contribution["sections"].as_array().into_iter().flatten() {
                for setting in section["settings"].as_array().into_iter().flatten() {
                    if setting["setting_ref"].as_str() == Some(setting_ref) {
                        return setting["effect"].clone();
                    }
                }
            }
        }
        json!({ "kind": "value-change", "summary": null, "ref": null })
    }

    fn generated_reading(&self, owner_ref: &str) -> Value {
        let contribution = &self.contributions[owner_ref];
        let availability = self
            .availability
            .get(owner_ref)
            .map(String::as_str)
            .unwrap_or("available");
        let state = self.state.borrow();
        let sections: Vec<Value> = contribution["sections"]
            .as_array()
            .expect("sections")
            .iter()
            .map(|section| {
                let settings: Vec<Value> = section["settings"]
                    .as_array()
                    .expect("settings")
                    .iter()
                    .map(|setting| {
                        let reference = setting["setting_ref"].as_str().expect("setting_ref");
                        let value = state.get(reference).cloned().unwrap_or(Value::Null);
                        let axis = |path: &str| {
                            json!({
                                "value": value.clone(),
                                "provenance": {
                                    "owner_ref": owner_ref,
                                    "path": path,
                                    "observed_at_unix_ms": 0,
                                }
                            })
                        };
                        json!({
                            "key": key_of(reference),
                            "axes": {
                                "declared": axis("authored"),
                                "effective": axis("resolution"),
                                "staged": { "stage_state": "none" },
                            }
                        })
                    })
                    .collect();
                json!({ "id": section["id"], "title": section["title"], "settings": settings })
            })
            .collect();
        json!({
            "schema": "oi.product-settings-disclosure/v2",
            "product_id": owner_ref,
            "availability": { "state": availability, "reason": null },
            "degradations": [],
            "sections": sections,
            "observed_at_unix_ms": 0,
        })
    }
}

impl OwnerTransport for FixtureTransport {
    fn discover(&self, owner_ref: &str) -> Result<Value, TransportError> {
        self.contributions.get(owner_ref).cloned().ok_or_else(|| {
            TransportFailure::owner_unavailable(format!(
                "no fixture owner answered the discovery read for `{owner_ref}`"
            ))
            .into()
        })
    }

    fn system_reading(&self, owner_ref: &str) -> Result<Value, TransportError> {
        if let Some(reading) = self.readings.get(owner_ref) {
            return Ok(reading.clone());
        }
        Ok(self.generated_reading(owner_ref))
    }

    fn validate(
        &self,
        _owner_ref: &str,
        request: &SettingRequest,
    ) -> Result<Value, TransportError> {
        Ok(json!({
            "schema": "oi.config-validation/v1",
            "setting_ref": request.setting_ref,
            "scope": request.scope,
            "valid": true,
            "violations": [],
            "expected_effect": self.effect_of(&request.setting_ref),
        }))
    }

    fn plan(&self, owner_ref: &str, request: &SettingRequest) -> Result<Value, TransportError> {
        let step = self.plans.get() + 1;
        self.plans.set(step);
        let digest = plan_digest(request);
        self.planned_values
            .borrow_mut()
            .insert(digest.clone(), request.value.clone());
        Ok(json!({
            "schema": "oi.config-plan/v1",
            "plan_id": format!("plan-{owner_ref}-{step}"),
            "plan_digest": digest,
            "setting_ref": request.setting_ref,
            "scope": request.scope,
            "changes": [{
                "summary": format!("set {} at {}", request.setting_ref, request.scope.compact()),
            }],
            "expected_effect": self.effect_of(&request.setting_ref),
            "expires_at_unix_ms": 0,
        }))
    }

    fn apply(&self, owner_ref: &str, request: &ApplyRequest) -> Result<Value, TransportError> {
        // The raw plan arrives exactly as the owner minted it (09 §15); the
        // fixture reads it through the typed view like any owner would.
        let plan =
            &PlanDocument::parse(request.plan.clone()).map_err(TransportFailure::internal)?;
        // Fixture receipts first: they freeze exactly what these owners
        // answered in the conformance cases.
        if let Some(receipt) = self
            .receipt_queue
            .borrow_mut()
            .get_mut(owner_ref)
            .and_then(VecDeque::pop_front)
        {
            let outcome = receipt["outcome"].as_str().unwrap_or("applied").to_owned();
            if outcome == "applied" {
                if let Some(value) = self.planned_values.borrow().get(&plan.plan_digest) {
                    self.state
                        .borrow_mut()
                        .insert(plan.setting_ref.clone(), value.clone());
                }
                self.executions.set(self.executions.get() + 1);
            }
            return Ok(receipt);
        }
        // Synthesised owner behaviour under the frozen idempotency law: a
        // re-submitted executed key returns `no_op` naming the original
        // receipt; the owner does not re-execute (09 §9).
        let key = format!(
            "{}|{}|{}|{}|{}",
            owner_ref,
            request.changeset_id,
            plan.setting_ref,
            plan.scope.compact(),
            plan.plan_digest
        );
        let receipt_id = format!("{}-receipt-{}", owner_ref, plan.plan_id);
        let mut receipt = json!({
            "schema": "oi.config-receipt/v1",
            "receipt_id": receipt_id,
            "owner_ref": owner_ref,
            "changeset_id": request.changeset_id,
            "plan_digest": plan.plan_digest,
            "setting_ref": plan.setting_ref,
            "scope": plan.scope,
            "operation": "apply",
            "outcome": "applied",
            "applied_at_unix_ms": 0,
            "native_ref": format!("{owner_ref}:history:{}", key_of(&plan.setting_ref)),
            "expected_effect": plan.expected_effect,
            "original_receipt_id": null,
            "error": null,
        });
        if let Some(original) = self.executed.borrow().get(&key) {
            receipt["receipt_id"] = Value::String(format!("{original}-replay"));
            receipt["outcome"] = Value::String("no_op".into());
            receipt["original_receipt_id"] = Value::String(original.clone());
            return Ok(receipt);
        }
        self.executed
            .borrow_mut()
            .insert(key, receipt["receipt_id"].as_str().unwrap().to_owned());
        self.executions.set(self.executions.get() + 1);
        if let Some(value) = self.planned_values.borrow().get(&plan.plan_digest) {
            self.state
                .borrow_mut()
                .insert(plan.setting_ref.clone(), value.clone());
        }
        Ok(receipt)
    }

    fn reset(&self, owner_ref: &str, request: &ResetRequest) -> Result<Value, TransportError> {
        self.state.borrow_mut().remove(&request.setting_ref);
        self.executions.set(self.executions.get() + 1);
        Ok(json!({
            "schema": "oi.config-receipt/v1",
            "receipt_id": format!("{owner_ref}-reset-receipt"),
            "owner_ref": owner_ref,
            "changeset_id": request.changeset_id,
            "plan_digest": null,
            "setting_ref": request.setting_ref,
            "scope": request.scope,
            "operation": "reset",
            "outcome": "applied",
            "applied_at_unix_ms": 0,
            "native_ref": format!("{owner_ref}:history:{}", key_of(&request.setting_ref)),
            "expected_effect": self.effect_of(&request.setting_ref),
            "original_receipt_id": null,
            "error": null,
        }))
    }
}

/// Discover the fixture owners through the frozen discovery relation and
/// return the registry beside the transport that backs them.
fn discovered_registry(transport: &FixtureTransport, owners: &[&str]) -> OwnerRegistry {
    let mut registry = OwnerRegistry::new();
    for owner_ref in owners {
        registry.discover(
            transport,
            &OwnerSpec {
                owner_ref: (*owner_ref).to_owned(),
                program: PathBuf::from(format!("{owner_ref}-fixture-executable")),
            },
        );
    }
    assert!(
        registry.degradations().is_empty(),
        "fixture discovery degraded: {:?}",
        registry.degradations()
    );
    registry
}

fn desired_set(setting_ref: &str, scope: Scope, value: Value) -> DesiredChange {
    DesiredChange {
        setting_ref: setting_ref.to_owned(),
        scope,
        kind: ChangeKind::Set,
        value: Some(value),
        secret_reference: None,
        depends_on: Vec::new(),
    }
}

fn scope_project() -> Scope {
    Scope {
        scope_kind: ScopeKind::Project,
        scope_ref: Some("epilogos/o-i".to_owned()),
    }
}

// ---------------------------------------------------------------------------
// changeset-simple-apply: contribute → address → plan → apply → receipt →
// re-read → verified, with O:I-side persistence.
// ---------------------------------------------------------------------------

#[test]
fn simple_apply_walks_the_whole_lifecycle_and_settles_satisfied() {
    let transport = FixtureTransport::default()
        .with_contribution("ai-kit", "contribution-ai-kit")
        .with_fixture_receipts("ai-kit", "changeset-simple-apply");
    let registry = discovered_registry(&transport, &["ai-kit"]);

    let home = tempfile::tempdir().expect("tempdir");
    let store = ConfigurationStore::open(home.path());
    let gateway = OwnerGateway::new(&transport);

    let mut changeset = assemble_changeset(
        &registry,
        "cs-fixture-simple-apply-1",
        0,
        Some("development"),
        &[desired_set(
            "ai-kit:resolution:model.default",
            scope_project(),
            json!("sonnet-next"),
        )],
    )
    .expect("assembly resolves the fixture owner and scope");
    assert_eq!(changeset.status, ChangeSetStatus::Planned);

    let report = execute_changeset(&registry, &gateway, Some(&store), &mut changeset, 1_000)
        .expect("the fixture owner executes the changeset");

    // The owner's receipt crossed whole.
    assert_eq!(report.receipts.len(), 1);
    assert_eq!(report.receipts[0].receipt_id, "aikit-receipt-1");
    assert_eq!(report.receipts[0].outcome, ReceiptOutcome::Applied);
    assert_eq!(transport.executions.get(), 1, "the owner executed once");

    // The lifecycle settles verified with the frozen derivation.
    assert_eq!(changeset.status, ChangeSetStatus::Verified);
    let operation = &changeset.operations[0];
    assert_eq!(operation.status, OperationStatus::Verified);
    assert_eq!(operation.receipt_ref.as_deref(), Some("aikit-receipt-1"));
    assert!(operation.plan_digest.is_some(), "plan digest recorded");

    // Re-read verification: the digest plus a truthful reconciliation.
    let verification = changeset.verification.as_ref().expect("verification taken");
    assert!(verification.reading_digest.as_deref().unwrap_or("").len() == 64);
    assert_eq!(verification.reconciliations.len(), 1);
    assert_eq!(
        verification.reconciliations[0].status,
        ReconciliationStatus::Satisfied
    );

    // The owner's own state moved (the owner is authoritative, not O:I).
    assert_eq!(
        transport
            .state
            .borrow()
            .get("ai-kit:resolution:model.default"),
        Some(&json!("sonnet-next"))
    );

    // O:I-side persistence: the changeset, the receipt reference and the
    // reconciliation record are all recoverable.
    let stored = store
        .load_changeset("cs-fixture-simple-apply-1")
        .expect("readable")
        .expect("changeset persisted");
    assert_eq!(stored.status, ChangeSetStatus::Verified);
    let receipts = store
        .load_receipts("cs-fixture-simple-apply-1")
        .expect("receipts readable");
    assert_eq!(receipts.len(), 1, "the O:I-side receipt reference is kept");
    assert_eq!(
        receipts[0].native_ref.as_deref(),
        Some("aikit:history:model.default:1")
    );
    let record = store
        .load_reconciliation("ai-kit:resolution:model.default")
        .expect("readable")
        .expect("reconciliation persisted");
    assert_eq!(record.status, "satisfied");
    assert_eq!(
        record.changeset_id.as_deref(),
        Some("cs-fixture-simple-apply-1")
    );
}

// ---------------------------------------------------------------------------
// changeset-partial-apply: two owners, one failure, truthful
// `partially_applied`, no rollback claim.
// ---------------------------------------------------------------------------

#[test]
fn partial_apply_is_truthful_across_two_owners_and_claims_no_rollback() {
    let transport = FixtureTransport::default()
        .with_contribution("ai-kit", "contribution-ai-kit")
        .with_contribution("oi", "contribution-oi")
        .with_fixture_receipts("ai-kit", "changeset-partial-apply")
        .with_fixture_receipts("oi", "changeset-partial-apply")
        // The composition layer could not publish: its re-read says so.
        .with_availability("oi", "unavailable");
    let registry = discovered_registry(&transport, &["ai-kit", "oi"]);
    let gateway = OwnerGateway::new(&transport);
    let home = tempfile::tempdir().expect("tempdir");
    let store = ConfigurationStore::open(home.path());

    let mut changeset = assemble_changeset(
        &registry,
        "cs-fixture-partial-apply-1",
        0,
        Some("development"),
        &[
            desired_set(
                "ai-kit:resolution:model.default",
                scope_project(),
                json!("sonnet-next"),
            ),
            desired_set(
                "oi:verify:verify.before-run",
                Scope {
                    scope_kind: ScopeKind::World,
                    scope_ref: None,
                },
                json!(true),
            ),
        ],
    )
    .expect("assembly resolves both fixture owners");

    let report = execute_changeset(&registry, &gateway, Some(&store), &mut changeset, 2_000)
        .expect("execution records every operation truthfully");

    assert_eq!(changeset.status, ChangeSetStatus::PartiallyApplied);
    let ai_kit = &changeset.operations[0];
    let oi = &changeset.operations[1];
    assert_eq!(ai_kit.status, OperationStatus::Verified);
    assert_eq!(ai_kit.receipt_ref.as_deref(), Some("aikit-receipt-2"));
    assert_eq!(oi.status, OperationStatus::Failed);
    assert_eq!(
        oi.error.as_ref().expect("owner error kept whole").code,
        "owner_unavailable",
        "the owner's own error code is represented, not flattened"
    );
    // No rollback is invented: exactly the two requested changes, no
    // compensation operation appears.
    assert_eq!(changeset.requested.len(), 2);
    assert_eq!(changeset.operations.len(), 2);

    // Verification reconciles every requested change — including the failed
    // one — into the frozen vocabulary.
    let verification = changeset.verification.as_ref().expect("verification taken");
    let statuses: BTreeMap<String, ReconciliationStatus> = verification
        .reconciliations
        .iter()
        .map(|entry| (entry.setting_ref.clone(), entry.status))
        .collect();
    assert_eq!(
        statuses.get("ai-kit:resolution:model.default"),
        Some(&ReconciliationStatus::Satisfied)
    );
    assert_eq!(
        statuses.get("oi:verify:verify.before-run"),
        Some(&ReconciliationStatus::Blocked),
        "the failed owner blocks truthfully"
    );
    assert_eq!(report.receipts.len(), 2, "the failed receipt crosses too");

    // Both receipt references persist O:I-side; the owner's history stays
    // the record of record.
    assert_eq!(
        store
            .load_receipts("cs-fixture-partial-apply-1")
            .expect("readable")
            .len(),
        2
    );
}

// ---------------------------------------------------------------------------
// changeset-idempotent-replay: replay under the frozen key returns no_op
// naming the original receipt; the owner does not re-execute.
// ---------------------------------------------------------------------------

#[test]
fn idempotent_replay_returns_no_op_and_the_owner_does_not_reexecute() {
    let transport = FixtureTransport::default().with_contribution("ai-kit", "contribution-ai-kit");
    let registry = discovered_registry(&transport, &["ai-kit"]);
    let gateway = OwnerGateway::new(&transport);
    let world = Scope {
        scope_kind: ScopeKind::World,
        scope_ref: None,
    };
    let request = || {
        vec![desired_set(
            "ai-kit:session:session.provider",
            world.clone(),
            json!("herdr"),
        )]
    };

    let mut first = assemble_changeset(
        &registry,
        "cs-fixture-idempotent-1",
        0,
        Some("development"),
        &request(),
    )
    .expect("assembly");
    let first_report =
        execute_changeset(&registry, &gateway, None, &mut first, 3_000).expect("execution");
    assert_eq!(first.status, ChangeSetStatus::Verified);
    assert_eq!(transport.executions.get(), 1, "executed exactly once");
    let first_key = IdempotencyKey::from_operation(&first.operations[0], "cs-fixture-idempotent-1");

    // The replay: the same change under the same changeset identity.
    let mut replay = assemble_changeset(
        &registry,
        "cs-fixture-idempotent-1",
        0,
        Some("development"),
        &request(),
    )
    .expect("assembly");
    let replay_report =
        execute_changeset(&registry, &gateway, None, &mut replay, 4_000).expect("replay");

    assert_eq!(
        transport.executions.get(),
        1,
        "the owner did not re-execute under the frozen idempotency key"
    );
    let replay_receipt = &replay_report.receipts[0];
    assert_eq!(replay_receipt.outcome, ReceiptOutcome::NoOp);
    assert_eq!(
        replay_receipt.original_receipt_id.as_deref(),
        Some(first_report.receipts[0].receipt_id.as_str()),
        "the replay names the original executed receipt"
    );
    assert_eq!(
        IdempotencyKey::from_operation(&replay.operations[0], "cs-fixture-idempotent-1"),
        first_key,
        "both sit under the same frozen key (owner, changeset, setting, scope, digest)"
    );
    assert_eq!(
        replay.operations[0].receipt_ref.as_deref(),
        Some(first_report.receipts[0].receipt_id.as_str()),
        "the operation points at the original receipt"
    );
    assert_eq!(replay.status, ChangeSetStatus::Verified);
}

// ---------------------------------------------------------------------------
// resolution-cases: the frozen truth table, wired through a real owner
// reading (the kernel path, not only the pure function).
// ---------------------------------------------------------------------------

#[test]
fn resolution_cases_settle_through_the_kernel_reading_path() {
    let case = load_case("resolution-cases");
    for entry in case["cases"].as_array().expect("cases array") {
        let name = entry["name"].as_str().unwrap();
        let expected = match entry["expect"].as_str().unwrap() {
            "satisfied" => ReconciliationStatus::Satisfied,
            "drifted" => ReconciliationStatus::Drifted,
            "pending" => ReconciliationStatus::Pending,
            "blocked" => ReconciliationStatus::Blocked,
            "unsupported" => ReconciliationStatus::Unsupported,
            "unknown" => ReconciliationStatus::Unknown,
            other => panic!("unknown expected status {other}"),
        };
        if !entry["setting_supported"].as_bool().unwrap() {
            // An unaddressable setting never resolves: the kernel refuses at
            // the door with the frozen code (the `unsupported` outcome in its
            // addressing form).
            let registry = OwnerRegistry::new();
            let transport = FixtureTransport::default();
            let gateway = OwnerGateway::new(&transport);
            let error = resolve_setting(
                &registry,
                &gateway,
                "ai-kit:resolution:model.default",
                &scope_project(),
                None,
                None,
                0,
            )
            .expect_err("an uncontributed setting is refused");
            assert_eq!(error.code, ErrorCode::UnsupportedSetting, "case `{name}`");
            continue;
        }
        let reading = json!({
            "schema": "oi.product-settings-disclosure/v2",
            "availability": {
                "state": if entry["owner_available"].as_bool().unwrap() {
                    "available"
                } else {
                    "unavailable"
                },
                "reason": null,
            },
            "degradations": [],
            "sections": [{
                "id": "resolution",
                "title": "Resolution",
                "settings": [{
                    "key": "model.default",
                    "axes": {
                        "declared": { "value": entry["native_declared"].clone() },
                        "effective": { "value": entry["native_effective"].clone() },
                        "staged": { "stage_state": entry["stage_state"].clone() },
                    },
                }],
            }],
            "observed_at_unix_ms": 0,
        });
        let transport = FixtureTransport::default().with_reading("ai-kit", reading);
        let mut registry = OwnerRegistry::new();
        registry
            .register_contribution(
                serde_json::from_value(contribution_of("contribution-ai-kit")).expect("fixture"),
            )
            .expect("registers");
        let gateway = OwnerGateway::new(&transport);

        let desired = !entry["desired"].is_null();
        let resolution: Resolution = resolve_setting(
            &registry,
            &gateway,
            "ai-kit:resolution:model.default",
            &scope_project(),
            if desired {
                Some(DesiredInput::Value(&entry["desired"]))
            } else {
                None
            },
            Some("profile:development"),
            5_000,
        )
        .unwrap_or_else(|error| panic!("case `{name}` did not resolve: {error}"));
        assert_eq!(resolution.reconciliation.status, expected, "case `{name}`");
        // The owner's axes crossed unmodified, and the document obeys the
        // redaction law against the contributions.
        let expected_effective = if entry["native_effective"].is_null() {
            None
        } else {
            Some(entry["native_effective"].clone())
        };
        assert_eq!(
            resolution
                .native
                .as_ref()
                .expect("native axes")
                .effective
                .as_ref()
                .expect("effective")
                .value,
            expected_effective,
            "case `{name}`: native axes are pass-through"
        );
        validate_resolution(&resolution, registry.settings())
            .unwrap_or_else(|error| panic!("case `{name}`: {error}"));
    }
}

// ---------------------------------------------------------------------------
// scope-cases: explicit decisions at the kernel door, never fallback.
// ---------------------------------------------------------------------------

#[test]
fn scope_cases_are_decided_explicitly_at_the_kernel_door() {
    let mut registry = OwnerRegistry::new();
    for fixture in [
        "contribution-ai-kit",
        "contribution-oi",
        "contribution-connector-fixture",
    ] {
        registry
            .register_contribution(
                serde_json::from_value(contribution_of(fixture)).expect("fixture"),
            )
            .unwrap_or_else(|error| panic!("{fixture}: {error}"));
    }
    let case = load_case("scope-cases");
    for entry in case["cases"].as_array().expect("cases array") {
        let name = entry["name"].as_str().unwrap();
        let setting_ref = entry["setting_ref"].as_str().unwrap();
        let scope_value = &entry["scope"];
        let expected = entry["expect"].as_str().unwrap();
        let kind_raw = scope_value["scope_kind"].as_str().unwrap();
        let Some(kind) = ScopeKind::from_wire(kind_raw) else {
            // An unknown scope kind cannot even enter the frozen types; the
            // grammar refuses it and the compact form never parses.
            assert_eq!(expected, "unknown_scope_kind", "case `{name}`");
            assert!(
                serde_json::from_value::<Scope>(scope_value.clone()).is_err(),
                "case `{name}`: an unknown kind must not deserialize"
            );
            assert!(parse_scope_compact(&format!("{kind_raw}:west")).is_none());
            continue;
        };
        let scope = Scope {
            scope_kind: kind,
            scope_ref: scope_value["scope_ref"].as_str().map(str::to_owned),
        };
        match resolve_setting_address(&registry, setting_ref, &scope) {
            Ok(_) => assert_eq!(expected, "ok", "case `{name}`"),
            Err(error) => {
                assert_eq!(error.code.as_wire(), expected, "case `{name}`");
                assert!(
                    error.message.contains(setting_ref) || error.message.contains(kind_raw),
                    "case `{name}`: the refusal names its address: {}",
                    error.message
                );
            }
        }
    }
    // The connector owner is dispatchable through the same registry.
    let connector_scope = Scope {
        scope_kind: ScopeKind::ConnectorRelation,
        scope_ref: Some("factory-actuation".to_owned()),
    };
    let (registered, owner) = resolve_setting_address(
        &registry,
        "connector/factory-actuation:authority:authority.mode",
        &connector_scope,
    )
    .expect("connector settings are first-class");
    assert_eq!(owner, "connector/factory-actuation");
    assert_eq!(
        registered.spec.value_schema.kind,
        ValueKind::Enum,
        "the spec crosses verbatim; no product-specific branch exists"
    );
}

// ---------------------------------------------------------------------------
// reset: the fourth verb runs owner-natively and settles without desired
// intent.
// ---------------------------------------------------------------------------

#[test]
fn reset_runs_the_fourth_verb_and_settles_without_desired_intent() {
    let transport = FixtureTransport::default().with_contribution("ai-kit", "contribution-ai-kit");
    let registry = discovered_registry(&transport, &["ai-kit"]);
    let gateway = OwnerGateway::new(&transport);

    // Put the owner into a mutated state first.
    let mut applied = assemble_changeset(
        &registry,
        "cs-reset-setup-1",
        0,
        None,
        &[desired_set(
            "ai-kit:resolution:model.default",
            scope_project(),
            json!("opus"),
        )],
    )
    .expect("assembly");
    execute_changeset(&registry, &gateway, None, &mut applied, 6_000).expect("apply");
    assert_eq!(
        transport
            .state
            .borrow()
            .get("ai-kit:resolution:model.default"),
        Some(&json!("opus"))
    );

    let (changeset, report) = reset_setting(
        &registry,
        &gateway,
        None,
        "cs-reset-1",
        0,
        "ai-kit:resolution:model.default",
        &scope_project(),
        7_000,
    )
    .expect("reset executes");
    assert_eq!(report.receipts[0].operation, OperationKind::Reset);
    assert_eq!(report.receipts[0].outcome, ReceiptOutcome::Applied);
    assert!(
        changeset.requested[0].value.is_none(),
        "a reset carries no value"
    );
    assert_eq!(changeset.status, ChangeSetStatus::Verified);
    assert_eq!(
        changeset.verification.as_ref().unwrap().reconciliations[0].status,
        ReconciliationStatus::Satisfied,
        "after reset no desired intent is held: satisfied, per 09 §7.1"
    );
    assert!(transport
        .state
        .borrow()
        .get("ai-kit:resolution:model.default")
        .is_none());
}

// ---------------------------------------------------------------------------
// The real transport: ProcessTransport spawns per the frozen verb grammar,
// pipes values over stdin, and represents owner failures truthfully.
// ---------------------------------------------------------------------------

/// Write a throwaway fixture-owner script answering the frozen grammar.
fn write_script_owner(dir: &std::path::Path) -> PathBuf {
    let script = dir.join("fixture-owner");
    std::fs::write(
        &script,
        r#"#!/bin/sh
# A throwaway fixture owner: canned answers, frozen verb grammar.
dir=$(dirname "$0")
if [ "$1" = "config-contribution" ]; then cat "$dir/contribution.json"; exit 0; fi
if [ "$1" = "system" ]; then cat "$dir/reading.json"; exit 0; fi
if [ "$1" = "config" ]; then
  for argument in "$@"; do
    if [ "$argument" = "fixture:main:boom" ]; then
      printf '{"schema":"oi.config-error/v1","error_code":"invalid_value","message":"the fixture owner refuses `boom`","setting_ref":"fixture:main:boom","retryable":false}'
      exit 3
    fi
  done
  if [ "$2" = "apply" ]; then cat > "$dir/last-plan.json"; else cat > "$dir/last-value.json"; fi
  case "$2" in
    validate)
      printf '{"schema":"oi.config-validation/v1","setting_ref":"fixture:main:tone","scope":{"scope_kind":"project","scope_ref":"p1"},"valid":true,"violations":[]}';;
    plan)
      printf '{"schema":"oi.config-plan/v1","plan_id":"plan-9","plan_digest":"aa11bb","setting_ref":"fixture:main:tone","scope":{"scope_kind":"project","scope_ref":"p1"},"changes":[{"summary":"set tone"}],"expected_effect":{"kind":"value-change","summary":null,"ref":null},"expires_at_unix_ms":0}';;
    apply)
      printf '{"schema":"oi.config-receipt/v1","receipt_id":"fixture-receipt-1","owner_ref":"fixture","changeset_id":"cs-proc-1","plan_digest":"aa11bb","setting_ref":"fixture:main:tone","scope":{"scope_kind":"project","scope_ref":"p1"},"operation":"apply","outcome":"applied","applied_at_unix_ms":0,"native_ref":"fixture:history:tone:1","expected_effect":{"kind":"value-change","summary":null,"ref":null},"original_receipt_id":null,"error":null}';;
    reset)
      printf '{"schema":"oi.config-receipt/v1","receipt_id":"fixture-reset-1","owner_ref":"fixture","changeset_id":"cs-proc-reset","plan_digest":null,"setting_ref":"fixture:main:tone","scope":{"scope_kind":"project","scope_ref":"p1"},"operation":"reset","outcome":"applied","applied_at_unix_ms":0,"native_ref":"fixture:history:tone:2","expected_effect":{"kind":"value-change","summary":null,"ref":null},"original_receipt_id":null,"error":null}';;
    *) exit 9;;
  esac
  exit 0
fi
exit 9
"#,
    )
    .expect("script written");
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&script, std::fs::Permissions::from_mode(0o755)).expect("chmod");
    }
    script
}

fn write_script_owner_documents(dir: &std::path::Path) {
    std::fs::write(
        dir.join("contribution.json"),
        json!({
            "schema": "oi.configuration-contribution/v1",
            "contract_revision": "configuration-plane/contribution.1",
            "owner": {
                "owner_ref": "fixture",
                "owner_kind": "product",
                "owner_version": "0.0.0",
                "contribution_command": ["fixture-owner", "config-contribution", "--json"],
                "disclosed_at_unix_ms": 0,
            },
            "about": "process-transport fixture owner",
            "sections": [{
                "id": "main",
                "title": "Main",
                "settings": [{
                    "setting_ref": "fixture:main:tone",
                    "section_ref": "main",
                    "title": "Tone",
                    "value_schema": { "type": "scalar" },
                    "allowed_scopes": [{ "scope_kind": "project", "scope_ref": null }],
                    "writable": true,
                    "profileable": true,
                    "sensitive": false,
                    "effect": { "kind": "value-change", "summary": null, "ref": null },
                    "operations": { "validate": true, "plan": true, "apply": true, "reset": true },
                    "native_ref": "fixture:tone",
                }],
            }],
            "operations": { "transport": "cli/v1" },
            "availability": { "state": "available", "reason": null },
        })
        .to_string(),
    )
    .expect("contribution written");
    std::fs::write(
        dir.join("reading.json"),
        json!({
            "schema": "oi.product-settings-disclosure/v2",
            "availability": { "state": "available", "reason": null },
            "degradations": [],
            "sections": [{
                "id": "main",
                "title": "Main",
                "settings": [{
                    "key": "tone",
                    "axes": {
                        "declared": { "value": "warm" },
                        "effective": { "value": "warm" },
                        "staged": { "stage_state": "none" },
                    },
                }],
            }],
            "observed_at_unix_ms": 0,
        })
        .to_string(),
    )
    .expect("reading written");
}

#[test]
fn process_transport_spawns_the_frozen_grammar_and_represents_failures_truthfully() {
    let home = tempfile::tempdir().expect("tempdir");
    write_script_owner_documents(home.path());
    let program = write_script_owner(home.path());

    let transport = ProcessTransport::with_specs(&[OwnerSpec {
        owner_ref: "fixture".to_owned(),
        program: program.clone(),
    }]);
    let mut registry = OwnerRegistry::new();
    registry.discover(
        &transport,
        &OwnerSpec {
            owner_ref: "fixture".to_owned(),
            program: program.clone(),
        },
    );
    assert!(
        registry.entry("fixture").is_some(),
        "discovery ran the real `config-contribution --json` and registered the document"
    );
    let gateway = OwnerGateway::new(&transport);

    // The whole lifecycle against a real process: the value crosses on
    // stdin (`--value-file -`), the plan returns, apply returns a receipt,
    // and the re-read verifies.
    let mut changeset = assemble_changeset(
        &registry,
        "cs-proc-1",
        0,
        None,
        &[desired_set(
            "fixture:main:tone",
            Scope {
                scope_kind: ScopeKind::Project,
                scope_ref: Some("p1".to_owned()),
            },
            json!("warm"),
        )],
    )
    .expect("assembly");
    let report =
        execute_changeset(&registry, &gateway, None, &mut changeset, 8_000).expect("execution");
    assert_eq!(changeset.status, ChangeSetStatus::Verified);
    assert_eq!(report.receipts[0].receipt_id, "fixture-receipt-1");
    // The value crossed the pipe (`--value-file -`), and the plan crossed
    // back through `--plan-file -` on apply.
    let last_value: Value = serde_json::from_str(
        &std::fs::read_to_string(home.path().join("last-value.json")).expect("value captured"),
    )
    .expect("the piped value is JSON");
    assert_eq!(last_value, json!("warm"));
    let last_plan: Value = serde_json::from_str(
        &std::fs::read_to_string(home.path().join("last-plan.json")).expect("plan captured"),
    )
    .expect("the piped plan is JSON");
    assert_eq!(last_plan["plan_digest"], json!("aa11bb"));

    // Assembly refuses a setting no owner contributed — the kernel never
    // invents an address (09 §4/§5).
    let unaddressable = assemble_changeset(
        &registry,
        "cs-proc-2",
        0,
        None,
        &[desired_set(
            "fixture:main:boom",
            Scope {
                scope_kind: ScopeKind::Project,
                scope_ref: Some("p1".to_owned()),
            },
            json!("x"),
        )],
    )
    .expect_err("an uncontributed setting is refused at assembly");
    assert_eq!(unaddressable.code, ErrorCode::UnsupportedSetting);

    // An owner refusal inside its failure contract: non-zero exit plus
    // oi.config-error/v1 is represented truthfully as the owner's own
    // error, never flattened (09 §6).
    let request = SettingRequest {
        setting_ref: "fixture:main:boom".to_owned(),
        scope: Scope {
            scope_kind: ScopeKind::Project,
            scope_ref: Some("p1".to_owned()),
        },
        value: json!("x"),
    };
    let error = transport
        .validate("fixture", &request)
        .expect_err("the owner refuses `boom`");
    match error {
        TransportError::Owner(document) => {
            assert_eq!(document.error_code, "invalid_value");
            assert_eq!(document.code(), ErrorCode::InvalidValue);
        }
        other => panic!("expected an owner error document, got {other:?}"),
    }

    // A reset through a real process.
    let (reset, reset_report) = reset_setting(
        &registry,
        &gateway,
        None,
        "cs-proc-reset",
        0,
        "fixture:main:tone",
        &Scope {
            scope_kind: ScopeKind::Project,
            scope_ref: Some("p1".to_owned()),
        },
        8_200,
    )
    .expect("reset executes against the process");
    assert_eq!(reset.status, ChangeSetStatus::Verified);
    assert_eq!(reset_report.receipts[0].receipt_id, "fixture-reset-1");

    // An unreachable owner degrades discovery honestly: spawn failure is a
    // named degradation, never an invented contribution.
    let mut degrading = OwnerRegistry::new();
    degrading.discover(
        &transport,
        &OwnerSpec {
            owner_ref: "absent".to_owned(),
            program: PathBuf::from("/nonexistent/oi-fixture-owner"),
        },
    );
    assert!(degrading.entry("absent").is_none());
    assert_eq!(degrading.degradations().len(), 1);
    assert_eq!(
        degrading.degradations()[0].owner_ref,
        "absent",
        "the degradation names the owner that did not answer"
    );
}
