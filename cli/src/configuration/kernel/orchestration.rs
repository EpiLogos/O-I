//! ChangeSet assembly, owner-native orchestration and re-read verification
//! (09 §6–§10): the O:I kernel builds ChangeSets from desired requests
//! resolved against the registry, runs them through the frozen four-verb
//! transport in dependency order, keeps per-operation truth
//! (`planned → validated → applied → verified`, or `failed`), and verifies
//! by re-reading the owner's `system --json` v2 evidence.
//!
//! Local laws this module lives by (all inside the frozen vocabulary):
//!
//! - **Verification digest.** The combined re-read digest is the 07 §4.5
//!   convention applied to the combined readings: every `*_unix_ms` field
//!   zeroed, every `reading_digest` nulled, sha256 hex over the canonical
//!   body. Two re-reads of an unchanged world produce the same digest.
//! - **Verification scope.** Verification reconciles *every* requested
//!   change, including ones whose operation failed — truthful partial
//!   failure names what settled and what did not.
//! - **Per-operation `verified`.** An operation is `verified` only when its
//!   setting actually reconciled `satisfied`; an applied-but-drifted
//!   operation stays `applied`, so the derived overall status never
//!   overclaims.
//! - **Dependency failure.** An operation whose dependency failed is marked
//!   `failed` with the frozen code `internal` and a message naming the
//!   failed dependency — it was not attempted, and no status outside the
//!   frozen vocabulary is minted to say so.
//! - **Reconciliation.** Desired/native comparison is the frozen pure
//!   `reconcile` truth table (09 §7.1); the native axes are the owner's own
//!   v2 facts passed through unmodified (§16 mapping: `owner_ref` ↔
//!   `product_id`, `section_ref` ↔ `sections[].id`, `setting_key` ↔
//!   `settings[].key`).

// The kernel's error documents carry whole owner failures by design (09 §6, §15):
// keeping them unboxed is the pass-through tradeoff, made explicit here.
#![allow(clippy::result_large_err)]
use crate::configuration::changeset::{
    derive_changeset_status, ChangeSet, IdempotencyKey, Operation, OperationKind, OperationStatus,
    RequestedChange, Verification, VerificationEntry,
};
use crate::configuration::contribution::ValueKind;
use crate::configuration::refs::{parse_setting_ref, Scope, ScopeDecision};
use crate::configuration::resolution::{
    reconcile, Desired, NativeAxes, NativeAxis, NativeReading, Reconciliation,
    ReconciliationInputs, ReconciliationStatus, Resolution, StageState, RESOLUTION_SCHEMA,
};
use crate::configuration::ErrorCode;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, BTreeSet};

use super::store::{ConfigurationStore, ReconciliationRecord};
use super::transport::{
    secret_wire_value, ApplyRequest, OwnerGateway, ResetRequest, SettingRequest,
};
use super::wire::PlanDocument;
use super::OwnerRegistry;

/// A kernel failure: a frozen error code plus what was actually observed.
/// Owner-side failures travel as recorded operation errors instead — this
/// type is for what O:I itself refuses or cannot do.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct KernelError {
    pub code: ErrorCode,
    pub message: String,
}

impl KernelError {
    pub fn new(code: ErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }

    pub fn internal(message: impl Into<String>) -> Self {
        Self::new(ErrorCode::Internal, message)
    }

    fn unsupported_setting(message: impl Into<String>) -> Self {
        Self::new(ErrorCode::UnsupportedSetting, message)
    }

    fn unsupported_scope(message: impl Into<String>) -> Self {
        Self::new(ErrorCode::UnsupportedScope, message)
    }
}

impl std::fmt::Display for KernelError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}: {}", self.code.as_wire(), self.message)
    }
}

/// What kind of desired change a request carries.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ChangeKind {
    /// Set the setting to a value (or to a secret reference for secret-kind
    /// settings) at an explicit scope.
    Set,
    /// Reset the setting at an explicit scope; carries no value.
    Reset,
}

/// One desired change resolved into the kernel: a setting at an explicit
/// scope with a value, a secret reference, or nothing (reset).
#[derive(Clone, Debug, PartialEq)]
pub struct DesiredChange {
    pub setting_ref: String,
    pub scope: Scope,
    pub kind: ChangeKind,
    pub value: Option<Value>,
    pub secret_reference: Option<crate::configuration::resolution::SecretReference>,
    /// Setting refs of other requests in this same assembly that must be
    /// applied first. Real dependencies only (09 §8); unknown names are
    /// refused at assembly, not discovered at apply time.
    pub depends_on: Vec<String>,
}

/// Client-minted changeset identity (09 §8): `cs-` + a globally-unique
/// suffix built from the clock, the process and a run counter.
pub fn mint_changeset_id(now_unix_ms: u64) -> String {
    use std::sync::atomic::{AtomicUsize, Ordering};
    static COUNTER: AtomicUsize = AtomicUsize::new(0);
    let step = COUNTER.fetch_add(1, Ordering::Relaxed);
    format!("cs-{:x}-{:x}-{step}", now_unix_ms, std::process::id())
}

/// The 07 §4.5 digest convention over any configuration body: every
/// `*_unix_ms` field zeroed, every `reading_digest` nulled, sha256 hex over
/// the canonical JSON. Unchanged worlds digest equal — never equal clocks.
pub fn canonical_reading_digest(body: &Value) -> String {
    let canonical = canonical_facts(body);
    let bytes = serde_json::to_vec(&canonical).unwrap_or_default();
    let digest = Sha256::digest(&bytes);
    let mut hex = String::with_capacity(digest.len() * 2);
    for byte in digest {
        hex.push_str(&format!("{byte:02x}"));
    }
    hex
}

fn canonical_facts(value: &Value) -> Value {
    match value {
        Value::Object(map) => Value::Object(
            map.iter()
                .map(|(key, value)| {
                    let value = if key.ends_with("_unix_ms") {
                        Value::from(0)
                    } else if key == "reading_digest" {
                        Value::Null
                    } else {
                        canonical_facts(value)
                    };
                    (key.clone(), value)
                })
                .collect(),
        ),
        Value::Array(items) => Value::Array(items.iter().map(canonical_facts).collect()),
        other => other.clone(),
    }
}

/// Resolve a setting address against the registry: grammar, existence, and
/// explicit scope support (09 §5). Every refusal is a frozen error code.
pub fn resolve_setting_address<'a>(
    registry: &'a OwnerRegistry,
    setting_ref: &str,
    scope: &Scope,
) -> Result<
    (
        &'a crate::configuration::contribution::RegisteredSetting,
        String,
    ),
    KernelError,
> {
    if parse_setting_ref(setting_ref).is_err() {
        return Err(KernelError::unsupported_setting(format!(
            "`{setting_ref}` is not a valid setting ref; a ref that does not parse is never coerced"
        )));
    }
    scope.validate().map_err(|error| {
        KernelError::unsupported_scope(format!("`{}`: {}", scope.compact(), error.message()))
    })?;
    let Some((registered, owner)) = registry.lookup(setting_ref) else {
        return Err(KernelError::unsupported_setting(format!(
            "`{setting_ref}` is not contributed by any discovered owner"
        )));
    };
    match registry.scope_decision(setting_ref, scope) {
        ScopeDecision::Supported => Ok((registered, owner.to_owned())),
        ScopeDecision::UnsupportedScope => Err(KernelError::unsupported_scope(format!(
            "`{}` is not within the allowed scopes of `{setting_ref}`",
            scope.compact()
        ))),
        ScopeDecision::UnknownScopeKind => Err(KernelError::new(
            ErrorCode::UnknownScopeKind,
            format!(
                "`{}` uses a scope kind outside the registry",
                scope.compact()
            ),
        )),
    }
}

/// Assemble a ChangeSet from desired requests (09 §7, §8): resolve identity
/// and scope explicitly, one operation per request, real dependencies only,
/// status derived — never asserted.
pub fn assemble_changeset(
    registry: &OwnerRegistry,
    changeset_id: &str,
    created_at_unix_ms: u64,
    profile_ref: Option<&str>,
    requests: &[DesiredChange],
) -> Result<ChangeSet, KernelError> {
    if !changeset_id.starts_with("cs-") || changeset_id.len() < 4 {
        return Err(KernelError::internal(format!(
            "changeset id `{changeset_id}` must be `cs-` + a unique suffix"
        )));
    }
    let mut requested = Vec::with_capacity(requests.len());
    let mut operations = Vec::with_capacity(requests.len());
    let mut seen: BTreeSet<(String, String)> = BTreeSet::new();
    let mut op_ids_by_setting: BTreeMap<String, Vec<String>> = BTreeMap::new();

    for (index, request) in requests.iter().enumerate() {
        let (registered, owner) =
            resolve_setting_address(registry, &request.setting_ref, &request.scope)?;
        let spec = &registered.spec;
        if !seen.insert((request.setting_ref.clone(), request.scope.compact())) {
            return Err(KernelError::internal(format!(
                "`{}` at `{}` is requested twice; one operation carries one requested change",
                request.setting_ref,
                request.scope.compact()
            )));
        }
        let op_id = format!("op-{}", index + 1);
        let requested_change = match request.kind {
            ChangeKind::Set => {
                if !spec.writable {
                    return Err(KernelError::unsupported_setting(format!(
                        "`{}` is not writable; the owner does not offer it to mutation",
                        request.setting_ref
                    )));
                }
                if !spec.operations.apply {
                    return Err(KernelError::unsupported_setting(format!(
                        "`{}` does not disclose apply through the configuration plane",
                        request.setting_ref
                    )));
                }
                match spec.value_schema.kind {
                    ValueKind::Secret => {
                        if request.value.is_some() {
                            return Err(KernelError::new(
                                ErrorCode::InvalidValue,
                                format!(
                                    "redaction: `{}` is secret-kind and must not carry `value`; the reference crosses, never material",
                                    request.setting_ref
                                ),
                            ));
                        }
                        let Some(secret_reference) = &request.secret_reference else {
                            return Err(KernelError::new(
                                ErrorCode::InvalidValue,
                                format!(
                                    "`{}` is secret-kind and must carry `secret_reference`",
                                    request.setting_ref
                                ),
                            ));
                        };
                        RequestedChange {
                            setting_ref: request.setting_ref.clone(),
                            scope: request.scope.clone(),
                            value: None,
                            secret_reference: Some(secret_reference.clone()),
                        }
                    }
                    _ => {
                        if request.secret_reference.is_some() {
                            return Err(KernelError::new(
                                ErrorCode::InvalidValue,
                                format!(
                                    "`{}` is not secret-kind; `secret_reference` belongs to secret-kind settings only",
                                    request.setting_ref
                                ),
                            ));
                        }
                        let Some(value) = &request.value else {
                            return Err(KernelError::new(
                                ErrorCode::InvalidValue,
                                format!("`{}` carries no value", request.setting_ref),
                            ));
                        };
                        RequestedChange {
                            setting_ref: request.setting_ref.clone(),
                            scope: request.scope.clone(),
                            value: Some(value.clone()),
                            secret_reference: None,
                        }
                    }
                }
            }
            ChangeKind::Reset => {
                if !spec.operations.reset {
                    return Err(KernelError::unsupported_setting(format!(
                        "`{}` does not disclose reset through the configuration plane",
                        request.setting_ref
                    )));
                }
                if request.value.is_some() || request.secret_reference.is_some() {
                    return Err(KernelError::new(
                        ErrorCode::InvalidValue,
                        format!("a reset of `{}` carries no value", request.setting_ref),
                    ));
                }
                RequestedChange {
                    setting_ref: request.setting_ref.clone(),
                    scope: request.scope.clone(),
                    value: None,
                    secret_reference: None,
                }
            }
        };
        requested.push(requested_change);
        operations.push(Operation {
            op_id: op_id.clone(),
            depends_on: None,
            owner_ref: owner,
            setting_ref: request.setting_ref.clone(),
            scope: request.scope.clone(),
            kind: match request.kind {
                ChangeKind::Set => OperationKind::Apply,
                ChangeKind::Reset => OperationKind::Reset,
            },
            plan_digest: None,
            plan_ref: None,
            status: OperationStatus::Planned,
            receipt_ref: None,
            error: None,
        });
        op_ids_by_setting
            .entry(request.setting_ref.clone())
            .or_default()
            .push(op_id);
    }

    // Map dependencies onto operation ids; unknown names are refused here,
    // at plan time — never at apply time.
    for (index, request) in requests.iter().enumerate() {
        let mut depends_on = BTreeSet::new();
        for dependency in &request.depends_on {
            let Some(targets) = op_ids_by_setting.get(dependency) else {
                return Err(KernelError::internal(format!(
                    "request {} depends_on `{dependency}`, which is not among the requested changes",
                    requests[index].setting_ref
                )));
            };
            depends_on.extend(targets.iter().cloned());
        }
        operations[index].depends_on = Some(depends_on.into_iter().collect());
    }

    // A plan that could never execute is not a plan; refuse cycles now.
    execution_order(&operations)?;

    let mut changeset = ChangeSet {
        schema: crate::configuration::changeset::CHANGSET_SCHEMA.to_owned(),
        changeset_id: changeset_id.to_owned(),
        created_at_unix_ms,
        profile_ref: profile_ref.map(str::to_owned),
        requested,
        operations,
        verification: None,
        status: crate::configuration::changeset::ChangeSetStatus::Planned,
        authority: None,
    };
    changeset.status = derive_changeset_status(&changeset.operations, None);
    changeset.validate().map_err(KernelError::internal)?;
    Ok(changeset)
}

/// Deterministic dependency-respecting execution order (09 §8: independent
/// operations may execute in any order; this one keeps document order).
fn execution_order(operations: &[Operation]) -> Result<Vec<usize>, KernelError> {
    let index_of: BTreeMap<&str, usize> = operations
        .iter()
        .enumerate()
        .map(|(index, op)| (op.op_id.as_str(), index))
        .collect();
    let dependencies: Vec<Vec<usize>> = operations
        .iter()
        .map(|op| {
            let mut unique = BTreeSet::new();
            for dependency in op.depends_on.iter().flatten() {
                let target = index_of.get(dependency.as_str()).copied().ok_or_else(|| {
                    KernelError::internal(format!(
                        "operation `{}` depends on unknown operation `{dependency}`",
                        op.op_id
                    ))
                })?;
                unique.insert(target);
            }
            Ok(unique.into_iter().collect())
        })
        .collect::<Result<Vec<_>, KernelError>>()?;
    let mut remaining: Vec<usize> = dependencies.iter().map(|deps| deps.len()).collect();
    let mut ready: Vec<usize> = (0..operations.len())
        .filter(|&i| remaining[i] == 0)
        .collect();
    let mut order = Vec::with_capacity(operations.len());
    while let Some(&next) = ready.first() {
        ready.remove(0);
        order.push(next);
        for (candidate, deps) in dependencies.iter().enumerate() {
            if deps.contains(&next) {
                remaining[candidate] -= 1;
                if remaining[candidate] == 0 {
                    let position = ready
                        .binary_search(&candidate)
                        .unwrap_or_else(|position| position);
                    ready.insert(position, candidate);
                }
            }
        }
    }
    if order.len() != operations.len() {
        return Err(KernelError::internal(
            "operation dependencies form a cycle; no execution order exists",
        ));
    }
    Ok(order)
}

/// What running a changeset produced: every receipt the owners returned and
/// the reconciliation records verification recorded. Owner failures are not
/// `Err`s here — they are recorded on the operations; `Err` is reserved for
/// what O:I itself could not do (invalid input, persistence failure).
pub struct ExecuteReport {
    pub receipts: Vec<crate::configuration::changeset::Receipt>,
    pub reconciliations: Vec<ReconciliationRecord>,
}

/// Orchestrate a ChangeSet through owner-native apply (09 §7, §8): every
/// pending operation is validated, planned, applied or reset through the
/// frozen verb grammar in dependency order, verification is taken by
/// re-reading the owners' v2 evidence, and the overall status is derived.
/// Progress is persisted at every transition when a store is given.
pub fn execute_changeset(
    registry: &OwnerRegistry,
    gateway: &OwnerGateway<'_>,
    store: Option<&ConfigurationStore>,
    changeset: &mut crate::configuration::changeset::ChangeSet,
    now_unix_ms: u64,
) -> Result<ExecuteReport, KernelError> {
    changeset.validate().map_err(KernelError::internal)?;
    let requested_changes = changeset.requested.clone();
    let changeset_id = changeset.changeset_id.clone();
    let order = execution_order(&changeset.operations)?;
    let mut receipts = Vec::new();

    for position in order {
        // Read-only dependency check first; the mutable borrow follows.
        let dependency_failed = changeset.operations[position]
            .depends_on
            .iter()
            .flatten()
            .any(|dependency| {
                changeset.operations.iter().any(|other| {
                    &other.op_id == dependency && other.status == OperationStatus::Failed
                })
            });
        let already_terminal = matches!(
            changeset.operations[position].status,
            OperationStatus::Verified | OperationStatus::Failed
        );
        if already_terminal {
            continue;
        }
        if dependency_failed {
            let failed_dependency = changeset.operations[position]
                .depends_on
                .iter()
                .flatten()
                .find(|dependency| {
                    changeset.operations.iter().any(|other| {
                        other.op_id == **dependency && other.status == OperationStatus::Failed
                    })
                })
                .cloned();
            let op = &mut changeset.operations[position];
            op.status = OperationStatus::Failed;
            op.error = Some(crate::configuration::changeset::OperationError {
                code: ErrorCode::Internal.as_wire().to_owned(),
                message: format!(
                    "dependency {} failed; operation `{}` was not attempted",
                    failed_dependency.as_deref().unwrap_or("?"),
                    op.op_id
                ),
                retryable: Some(false),
            });
            persist(store, changeset)?;
            continue;
        }

        let Some(requested) =
            requested_for_operation(&requested_changes, &changeset.operations[position])
        else {
            let op = &mut changeset.operations[position];
            op.status = OperationStatus::Failed;
            op.error = Some(crate::configuration::changeset::OperationError {
                code: ErrorCode::Internal.as_wire().to_owned(),
                message: format!("requested change for `{}` is missing", op.setting_ref),
                retryable: None,
            });
            persist(store, changeset)?;
            continue;
        };
        let requested = requested.clone();

        let op = &mut changeset.operations[position];
        let owner = op.owner_ref.clone();
        if registry.entry(&owner).is_none() {
            op.status = OperationStatus::Failed;
            op.error = Some(crate::configuration::changeset::OperationError {
                code: ErrorCode::OwnerUnavailable.as_wire().to_owned(),
                message: format!("owner `{owner}` is not registered in the kernel registry"),
                retryable: Some(true),
            });
            persist(store, changeset)?;
            continue;
        }
        match op.kind {
            OperationKind::Apply => {
                run_apply_operation(
                    registry,
                    gateway,
                    &changeset_id,
                    op,
                    &requested,
                    &mut receipts,
                );
            }
            OperationKind::Reset => {
                run_reset_operation(gateway, &changeset_id, op, &mut receipts);
            }
            OperationKind::Validate | OperationKind::Plan => {
                op.status = OperationStatus::Failed;
                op.error = Some(crate::configuration::changeset::OperationError {
                    code: ErrorCode::Internal.as_wire().to_owned(),
                    message: format!(
                        "operation kind `{}` is not executable by the kernel orchestration",
                        match op.kind {
                            OperationKind::Validate => "validate",
                            _ => "plan",
                        }
                    ),
                    retryable: None,
                });
            }
        }
        persist(store, changeset)?;
    }

    // Verification is evidence, not a promise: taken whenever something was
    // applied, covering every requested change (09 §9).
    let mut reconciliations = Vec::new();
    let any_executed = changeset.operations.iter().any(|op| {
        matches!(
            op.status,
            OperationStatus::Applied | OperationStatus::Verified
        )
    });
    if any_executed {
        let (verification, records) = take_verification(
            registry,
            gateway,
            &requested_changes,
            &mut changeset.operations,
            now_unix_ms,
        )?;
        reconciliations = records;
        changeset.verification = Some(verification);
        for record in reconciliations.iter_mut() {
            record.changeset_id = Some(changeset_id.clone());
        }
        if let Some(store) = store {
            for record in &reconciliations {
                store
                    .save_reconciliation(record)
                    .map_err(KernelError::internal)?;
            }
        }
    }
    // O:I-side receipt references persist beside the ChangeSet: the owner's
    // own history remains the record of record (09 §9); this store keeps
    // only the pointers the World shares.
    if let Some(store) = store {
        for receipt in &receipts {
            store.save_receipt(receipt).map_err(KernelError::internal)?;
        }
    }
    changeset.status =
        derive_changeset_status(&changeset.operations, changeset.verification.as_ref());
    persist(store, changeset)?;
    Ok(ExecuteReport {
        receipts,
        reconciliations,
    })
}

fn persist(
    store: Option<&ConfigurationStore>,
    changeset: &crate::configuration::changeset::ChangeSet,
) -> Result<(), KernelError> {
    match store {
        Some(store) => store
            .save_changeset(changeset)
            .map(|_| ())
            .map_err(KernelError::internal),
        None => Ok(()),
    }
}

fn requested_for_operation<'a>(
    requested: &'a [RequestedChange],
    operation: &Operation,
) -> Option<&'a RequestedChange> {
    requested.iter().find(|change| {
        change.setting_ref == operation.setting_ref && change.scope == operation.scope
    })
}

/// The value that crosses the transport for one requested change (09 §14:
/// the secret reference crosses; material never does).
fn wire_value(requested: &RequestedChange) -> Result<Value, KernelError> {
    if let Some(secret_reference) = &requested.secret_reference {
        return Ok(secret_wire_value(secret_reference));
    }
    requested.value.clone().ok_or_else(|| {
        KernelError::new(
            ErrorCode::InvalidValue,
            format!(
                "`{}` carries neither a value nor a secret reference",
                requested.setting_ref
            ),
        )
    })
}

fn run_apply_operation(
    registry: &OwnerRegistry,
    gateway: &OwnerGateway<'_>,
    changeset_id: &str,
    op: &mut Operation,
    requested: &RequestedChange,
    receipts: &mut Vec<crate::configuration::changeset::Receipt>,
) {
    let fail = |op: &mut Operation, error: crate::configuration::changeset::OperationError| {
        op.status = OperationStatus::Failed;
        op.error = Some(error);
    };
    // Owner-native validation first (09 §6): a refused value never reaches
    // plan. A setting that does not disclose validate goes straight to plan.
    if registry
        .lookup(&op.setting_ref)
        .map(|(registered, _)| registered.spec.operations.validate)
        .unwrap_or(false)
    {
        let request = SettingRequest {
            setting_ref: op.setting_ref.clone(),
            scope: op.scope.clone(),
            value: match wire_value(requested) {
                Ok(value) => value,
                Err(error) => return fail(op, internal_operation_error(&error)),
            },
        };
        match gateway.validate(&op.owner_ref, &request) {
            Ok(document) if document.valid => op.status = OperationStatus::Validated,
            Ok(document) => {
                return fail(
                    op,
                    crate::configuration::changeset::OperationError {
                        code: ErrorCode::ValidationFailed.as_wire().to_owned(),
                        message: document.violation_message(),
                        retryable: None,
                    },
                );
            }
            Err(error) => return fail(op, error.into_operation_error()),
        }
    } else {
        op.status = OperationStatus::Validated;
    }

    // Owner-native plan: the owner mints plan identity and the idempotency
    // digest (09 §6, §9).
    if registry
        .lookup(&op.setting_ref)
        .map(|(registered, _)| registered.spec.operations.plan)
        .unwrap_or(false)
    {
        let request = SettingRequest {
            setting_ref: op.setting_ref.clone(),
            scope: op.scope.clone(),
            value: match wire_value(requested) {
                Ok(value) => value,
                Err(error) => return fail(op, internal_operation_error(&error)),
            },
        };
        let plan = match gateway.plan(&op.owner_ref, &request) {
            Ok(plan) => plan,
            Err(error) => return fail(op, error.into_operation_error()),
        };
        op.plan_digest = Some(plan.document.plan_digest.clone());
        op.plan_ref = Some(
            plan.document
                .explain_ref
                .clone()
                .unwrap_or_else(|| plan.document.plan_id.clone()),
        );
        apply_plan(gateway, changeset_id, op, plan, receipts);
    } else {
        fail(
            op,
            crate::configuration::changeset::OperationError {
                code: ErrorCode::UnsupportedSetting.as_wire().to_owned(),
                message: format!(
                    "`{}` does not disclose plan through the configuration plane; apply cannot be routed",
                    op.setting_ref
                ),
                retryable: None,
            },
        );
    }
}

fn apply_plan(
    gateway: &OwnerGateway<'_>,
    changeset_id: &str,
    op: &mut Operation,
    plan: super::transport::OwnerPlan,
    receipts: &mut Vec<crate::configuration::changeset::Receipt>,
) {
    let request = ApplyRequest {
        plan: plan.raw,
        changeset_id: changeset_id.to_owned(),
    };
    match gateway.apply(&op.owner_ref, &request) {
        Ok(receipt) => {
            receipts.push(receipt.clone());
            record_receipt(op, receipt);
        }
        Err(error) => {
            op.status = OperationStatus::Failed;
            op.error = Some(error.into_operation_error());
        }
    }
}

fn run_reset_operation(
    gateway: &OwnerGateway<'_>,
    changeset_id: &str,
    op: &mut Operation,
    receipts: &mut Vec<crate::configuration::changeset::Receipt>,
) {
    let request = ResetRequest {
        setting_ref: op.setting_ref.clone(),
        scope: op.scope.clone(),
        changeset_id: changeset_id.to_owned(),
    };
    match gateway.reset(&op.owner_ref, &request) {
        Ok(receipt) => {
            receipts.push(receipt.clone());
            record_receipt(op, receipt);
        }
        Err(error) => {
            op.status = OperationStatus::Failed;
            op.error = Some(error.into_operation_error());
        }
    }
}

/// Land an owner receipt on its operation. `no_op` is the frozen idempotent
/// replay (09 §9): the owner did not re-execute; the operation counts as
/// applied and names the *original* receipt.
fn record_receipt(op: &mut Operation, receipt: crate::configuration::changeset::Receipt) {
    match receipt.outcome {
        crate::configuration::changeset::ReceiptOutcome::Applied => {
            op.status = OperationStatus::Applied;
            op.receipt_ref = Some(receipt.receipt_id);
        }
        crate::configuration::changeset::ReceiptOutcome::NoOp => {
            op.status = OperationStatus::Applied;
            op.receipt_ref = receipt
                .original_receipt_id
                .clone()
                .or(Some(receipt.receipt_id));
        }
        crate::configuration::changeset::ReceiptOutcome::Failed => {
            op.status = OperationStatus::Failed;
            op.error = receipt.error.clone().or_else(|| {
                Some(crate::configuration::changeset::OperationError {
                    code: ErrorCode::Internal.as_wire().to_owned(),
                    message: "the owner answered `failed` without an error".to_owned(),
                    retryable: None,
                })
            });
        }
    }
}

fn internal_operation_error(
    error: &KernelError,
) -> crate::configuration::changeset::OperationError {
    crate::configuration::changeset::OperationError {
        code: error.code.as_wire().to_owned(),
        message: error.message.clone(),
        retryable: None,
    }
}

/// One owner's re-read observation: the v2 evidence, its digest, and
/// whether the owner is truthfully available on this subject.
struct NativeObservation {
    reading: Option<Value>,
    reading_digest: Option<String>,
    available: bool,
    unavailable_reason: Option<String>,
}

fn observe_native(
    registry: &OwnerRegistry,
    gateway: &OwnerGateway<'_>,
    setting_ref: &str,
) -> Result<NativeObservation, KernelError> {
    let Some(owner) = registry.owner_of(setting_ref) else {
        return Err(KernelError::unsupported_setting(format!(
            "`{setting_ref}` is not contributed by any discovered owner"
        )));
    };
    match gateway.system_reading(owner) {
        Ok(reading) => {
            let digest = canonical_reading_digest(&reading);
            let (available, unavailable_reason) = owner_availability(&reading, setting_ref);
            Ok(NativeObservation {
                reading: Some(reading),
                reading_digest: Some(digest),
                available,
                unavailable_reason,
            })
        }
        Err(error) => Ok(NativeObservation {
            reading: None,
            reading_digest: None,
            available: false,
            unavailable_reason: Some(error.message()),
        }),
    }
}

/// Owner availability on one subject (07 §4.3/§4.7): the owner's own
/// `availability` plus its per-subject `degradations`. A degradation naming
/// the setting, its section, or the whole owner (null subject) blocks.
fn owner_availability(reading: &Value, setting_ref: &str) -> (bool, Option<String>) {
    let state = reading
        .get("availability")
        .and_then(|availability| availability.get("state"))
        .and_then(Value::as_str)
        .unwrap_or("unknown");
    if state != "available" && state != "degraded" {
        return (false, Some(format!("owner availability is `{state}`")));
    }
    let section = parse_setting_ref(setting_ref)
        .map(|parts| parts.section_ref)
        .unwrap_or_default();
    if let Some(degradations) = reading.get("degradations").and_then(Value::as_array) {
        for degradation in degradations {
            let subject = degradation.get("subject_ref").and_then(Value::as_str);
            let names_subject = match subject {
                None => true,
                Some(subject) => subject == setting_ref || subject == section,
            };
            if names_subject {
                let reason = degradation
                    .get("reason")
                    .and_then(Value::as_str)
                    .unwrap_or("degraded on this subject");
                return (false, Some(reason.to_owned()));
            }
        }
    }
    (true, None)
}

/// The axes of one setting inside a v2 reading, through the exact §16
/// identity mapping. `None` when the owner did not disclose the setting.
fn find_setting_axes<'a>(reading: &'a Value, setting_ref: &str) -> Option<&'a Value> {
    let parts = parse_setting_ref(setting_ref).ok()?;
    let sections = reading.get("sections")?.as_array()?;
    for section in sections {
        if section.get("id").and_then(Value::as_str) != Some(&parts.section_ref) {
            continue;
        }
        for setting in section.get("settings")?.as_array()? {
            if setting.get("key").and_then(Value::as_str) == Some(&parts.setting_key) {
                return Some(setting.get("axes").unwrap_or(&Value::Null));
            }
        }
    }
    None
}

fn stage_state_of(axes: Option<&Value>) -> StageState {
    let raw = axes
        .and_then(|axes| axes.get("staged"))
        .and_then(|staged| staged.get("stage_state"))
        .and_then(Value::as_str);
    match raw {
        Some("prepared") => StageState::Prepared,
        Some("previewed") => StageState::Previewed,
        Some("discardable") => StageState::Discardable,
        _ => StageState::None,
    }
}

fn axis_value(axes: Option<&Value>, name: &str) -> Option<Value> {
    let value = axes?.get(name)?.get("value")?.clone();
    (!value.is_null()).then_some(value)
}

/// The desired intent carried into reconciliation for one requested change:
/// the change itself during verification, the held profile/override value
/// during ordinary resolution.
fn desired_for_reconciliation(requested: &RequestedChange) -> Option<Value> {
    if let Some(secret_reference) = &requested.secret_reference {
        return Some(secret_wire_value(secret_reference));
    }
    requested.value.clone()
}

/// Re-read verification (09 §9): the reading digest per the 07 §4.5
/// convention over the combined re-read, and the per-setting reconciliation
/// over every requested change — including the ones that failed.
/// Operations whose setting reconciled `satisfied` become `verified`; the
/// rest keep their applied/failed truth.
fn take_verification(
    registry: &OwnerRegistry,
    gateway: &OwnerGateway<'_>,
    requested: &[RequestedChange],
    operations: &mut [Operation],
    now_unix_ms: u64,
) -> Result<(Verification, Vec<ReconciliationRecord>), KernelError> {
    // One re-read per involved owner.
    let mut readings: BTreeMap<String, Result<Value, String>> = BTreeMap::new();
    for op in operations.iter() {
        if readings.contains_key(&op.owner_ref) {
            continue;
        }
        let reading = match gateway.system_reading(&op.owner_ref) {
            Ok(value) => Ok(value),
            Err(error) => Err(error.message()),
        };
        readings.insert(op.owner_ref.clone(), reading);
    }
    let digest_body = json!({
        "owners": readings.iter().map(|(owner, reading)| (
            owner.clone(),
            reading.as_ref().map_or(Value::Null, |value| value.clone()),
        )).collect::<BTreeMap<String, Value>>(),
    });
    let reading_digest = canonical_reading_digest(&digest_body);

    let mut entries = Vec::with_capacity(requested.len());
    let mut records = Vec::with_capacity(requested.len());
    for change in requested {
        let setting_ref = &change.setting_ref;
        let supported = registry.lookup(setting_ref).is_some()
            && registry.scope_decision(setting_ref, &change.scope) == ScopeDecision::Supported;
        let owner = registry.owner_of(setting_ref).unwrap_or_default();
        let reading = readings
            .get(owner)
            .and_then(|reading| reading.as_ref().ok());
        let axes = reading.and_then(|reading| find_setting_axes(reading, setting_ref));
        let (observation_available, unavailable_reason) = match (reading, supported) {
            (None, _) => (false, Some("the owner produced no v2 reading".to_owned())),
            (Some(_), false) => (
                false,
                Some("the setting is not addressable at this scope".to_owned()),
            ),
            (Some(reading), true) => owner_availability(reading, setting_ref),
        };
        let desired_value = desired_for_reconciliation(change);
        let status = reconcile(ReconciliationInputs {
            desired: desired_value.as_ref(),
            native_effective: axis_value(axes, "effective").as_ref(),
            native_declared: axis_value(axes, "declared").as_ref(),
            stage_state: stage_state_of(axes),
            owner_available: observation_available,
            setting_supported: supported,
        });
        let reason = reconciliation_reason(
            status,
            supported,
            observation_available,
            unavailable_reason.as_deref(),
            desired_value.is_some(),
        );
        entries.push(VerificationEntry {
            setting_ref: setting_ref.clone(),
            status,
        });
        records.push(ReconciliationRecord {
            setting_ref: setting_ref.clone(),
            scope: change.scope.clone(),
            status: reconciliation_status_wire(status).to_owned(),
            reason: Some(reason),
            observed_at_unix_ms: now_unix_ms,
            reading_digest: reading.map(canonical_reading_digest),
            changeset_id: None,
        });
    }
    // An operation is verified only when its own setting truly reconciled
    // `satisfied`; applied-but-drifted stays applied, failed stays failed.
    for op in operations.iter_mut() {
        if op.status != OperationStatus::Applied {
            continue;
        }
        let settled = entries
            .iter()
            .zip(requested.iter())
            .find(|(_, change)| change.setting_ref == op.setting_ref && change.scope == op.scope)
            .map(|(entry, _)| entry.status == ReconciliationStatus::Satisfied)
            .unwrap_or(false);
        if settled {
            op.status = OperationStatus::Verified;
        }
    }
    let verification = Verification {
        reading_digest: Some(reading_digest),
        observed_at_unix_ms: now_unix_ms,
        reconciliations: entries,
    };
    Ok((verification, records))
}

/// The wire form of the frozen reconciliation vocabulary (09 §7.1).
fn reconciliation_status_wire(status: ReconciliationStatus) -> &'static str {
    match status {
        ReconciliationStatus::Satisfied => "satisfied",
        ReconciliationStatus::Drifted => "drifted",
        ReconciliationStatus::Pending => "pending",
        ReconciliationStatus::Blocked => "blocked",
        ReconciliationStatus::Unsupported => "unsupported",
        ReconciliationStatus::Unknown => "unknown",
    }
}

fn reconciliation_reason(
    status: ReconciliationStatus,
    supported: bool,
    owner_available: bool,
    unavailable_reason: Option<&str>,
    desired_held: bool,
) -> String {
    let _ = owner_available;
    match status {
        ReconciliationStatus::Unsupported => {
            if supported {
                "the setting is not addressable here".to_owned()
            } else {
                "the setting is not contributed or the scope is not allowed".to_owned()
            }
        }
        ReconciliationStatus::Blocked => format!(
            "the owner is unavailable on this subject: {}",
            unavailable_reason.unwrap_or("unavailable")
        ),
        ReconciliationStatus::Pending => "the owner has a stage in flight".to_owned(),
        ReconciliationStatus::Unknown => {
            "no native axes were disclosed for this setting".to_owned()
        }
        ReconciliationStatus::Satisfied => {
            if desired_held {
                "desired equals the native fact".to_owned()
            } else {
                "no desired intent is held for this setting here".to_owned()
            }
        }
        ReconciliationStatus::Drifted => "desired differs from the native fact".to_owned(),
    }
}

/// The resolved reading of one setting at one scope (09 §7): the desired
/// axis O:I owns beside the owner's own v2 axes, and the frozen
/// reconciliation status — the ordinary re-read path for external native
/// edits.
pub fn resolve_setting(
    registry: &OwnerRegistry,
    gateway: &OwnerGateway<'_>,
    setting_ref: &str,
    scope: &Scope,
    desired: Option<DesiredInput<'_>>,
    source_ref: Option<&str>,
    now_unix_ms: u64,
) -> Result<Resolution, KernelError> {
    resolve_setting_address(registry, setting_ref, scope)?;
    let observation = observe_native(registry, gateway, setting_ref)?;
    let axes = observation
        .reading
        .as_ref()
        .and_then(|reading| find_setting_axes(reading, setting_ref));
    let desired_value = desired.as_ref().map(|input| input.wire_value());
    let status = reconcile(ReconciliationInputs {
        desired: desired_value.as_ref(),
        native_effective: axis_value(axes, "effective").as_ref(),
        native_declared: axis_value(axes, "declared").as_ref(),
        stage_state: stage_state_of(axes),
        owner_available: observation.available,
        setting_supported: true,
    });
    let reason = reconciliation_reason(
        status,
        true,
        observation.available,
        observation.unavailable_reason.as_deref(),
        desired_value.is_some(),
    );
    let axis_document = |name: &str| -> Option<NativeAxis> {
        let raw = axes?.get(name)?.clone();
        serde_json::from_value(raw).ok()
    };
    let native = observation.reading.as_ref().map(|_| NativeAxes {
        declared: axis_document("declared"),
        effective: axis_document("effective"),
        active: axis_document("active"),
        staged: axis_document("staged"),
    });
    Ok(Resolution {
        schema: RESOLUTION_SCHEMA.to_owned(),
        setting_ref: setting_ref.to_owned(),
        scope: scope.clone(),
        desired: desired.map(|input| Desired {
            value: input.desired_value(),
            secret_reference: input.desired_secret(),
            source_ref: source_ref.map(str::to_owned),
            set_at_unix_ms: Some(now_unix_ms),
        }),
        native,
        native_reading: Some(NativeReading {
            reading_digest: observation.reading_digest.clone(),
            observed_at_unix_ms: Some(now_unix_ms),
        }),
        reconciliation: Reconciliation {
            status,
            reason: Some(reason),
            detail_ref: None,
        },
    })
}

/// The desired axis a caller holds for one setting: a value, or a secret
/// reference (09 §14 — never both, never material).
#[derive(Clone, Debug)]
pub enum DesiredInput<'a> {
    Value(&'a Value),
    Secret(&'a crate::configuration::resolution::SecretReference),
}

impl DesiredInput<'_> {
    fn wire_value(&self) -> Value {
        match self {
            DesiredInput::Value(value) => (*value).clone(),
            DesiredInput::Secret(secret) => secret_wire_value(secret),
        }
    }

    fn desired_value(&self) -> Option<Value> {
        match self {
            DesiredInput::Value(value) => Some((*value).clone()),
            DesiredInput::Secret(_) => None,
        }
    }

    fn desired_secret(&self) -> Option<crate::configuration::resolution::SecretReference> {
        match self {
            DesiredInput::Value(_) => None,
            DesiredInput::Secret(secret) => Some((*secret).clone()),
        }
    }
}

/// Owner-native plan for one requested change without mutating anything
/// (09 §6): owner validation first where the setting discloses it, then the
/// owner plan. The plan document crosses back whole — O:I never mints
/// plan identity or the idempotency digest.
pub fn plan_request(
    registry: &OwnerRegistry,
    gateway: &OwnerGateway<'_>,
    requested: &RequestedChange,
) -> Result<PlanDocument, KernelError> {
    let (registered, owner) =
        resolve_setting_address(registry, &requested.setting_ref, &requested.scope)?;
    let spec = &registered.spec;
    if !spec.writable {
        return Err(KernelError::unsupported_setting(format!(
            "`{}` is not writable; the owner does not offer it to mutation",
            requested.setting_ref
        )));
    }
    if !spec.operations.plan {
        return Err(KernelError::unsupported_setting(format!(
            "`{}` does not disclose plan through the configuration plane",
            requested.setting_ref
        )));
    }
    let request = SettingRequest {
        setting_ref: requested.setting_ref.clone(),
        scope: requested.scope.clone(),
        value: wire_value(requested)?,
    };
    if spec.operations.validate {
        match gateway.validate(&owner, &request) {
            Ok(document) if document.valid => {}
            Ok(document) => {
                return Err(KernelError::new(
                    ErrorCode::ValidationFailed,
                    document.violation_message(),
                ));
            }
            Err(error) => {
                return Err(KernelError::new(error.code(), error.message()));
            }
        }
    }
    gateway
        .plan(&owner, &request)
        .map(|owner_plan| owner_plan.document)
        .map_err(|error| KernelError::new(error.code(), error.message()))
}

/// Reset one setting at one explicit scope through the owner op (09 §6),
/// settle the resulting ChangeSet truthfully and verify by re-read. A
/// convenience over [`assemble_changeset`] + [`execute_changeset`] for the
/// one-change case.
#[allow(clippy::too_many_arguments)] // the frozen per-call facts of one reset (identity, routing, persistence, clock)
pub fn reset_setting(
    registry: &OwnerRegistry,
    gateway: &OwnerGateway<'_>,
    store: Option<&ConfigurationStore>,
    changeset_id: &str,
    created_at_unix_ms: u64,
    setting_ref: &str,
    scope: &Scope,
    now_unix_ms: u64,
) -> Result<(ChangeSet, ExecuteReport), KernelError> {
    let requests = vec![DesiredChange {
        setting_ref: setting_ref.to_owned(),
        scope: scope.clone(),
        kind: ChangeKind::Reset,
        value: None,
        secret_reference: None,
        depends_on: Vec::new(),
    }];
    let mut changeset =
        assemble_changeset(registry, changeset_id, created_at_unix_ms, None, &requests)?;
    let report = execute_changeset(registry, gateway, store, &mut changeset, now_unix_ms)?;
    Ok((changeset, report))
}

/// The idempotency key of one operation, for surfaces that must show or
/// store what apply is anchored on (09 §9).
pub fn idempotency_key_of(operation: &Operation, changeset_id: &str) -> IdempotencyKey {
    IdempotencyKey::from_operation(operation, changeset_id)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::configuration::changeset::Operation;
    use crate::configuration::refs::{Scope, ScopeKind};

    fn op(id: &str, depends_on: &[&str]) -> Operation {
        Operation {
            op_id: id.to_owned(),
            depends_on: Some(depends_on.iter().map(|s| s.to_string()).collect()),
            owner_ref: "ai-kit".to_owned(),
            setting_ref: "ai-kit:resolution:model.default".to_owned(),
            scope: Scope {
                scope_kind: ScopeKind::Project,
                scope_ref: Some("p".to_owned()),
            },
            kind: OperationKind::Apply,
            plan_digest: None,
            plan_ref: None,
            status: OperationStatus::Planned,
            receipt_ref: None,
            error: None,
        }
    }

    #[test]
    fn execution_order_respects_dependencies_and_detects_cycles() {
        let ops = vec![
            op("op-1", &[]),
            op("op-2", &["op-1"]),
            op("op-3", &["op-1"]),
            op("op-4", &["op-2", "op-3"]),
        ];
        let order = execution_order(&ops).expect("order exists");
        assert_eq!(order, vec![0, 1, 2, 3]);
        let cyclic = vec![op("op-1", &["op-2"]), op("op-2", &["op-1"])];
        let error = execution_order(&cyclic).expect_err("a cycle has no order");
        assert!(error.message.contains("cycle"), "{}", error.message);
    }

    #[test]
    fn digest_ignores_clocks_and_digest_fields() {
        let first = json!({
            "observed_at_unix_ms": 1000,
            "reading_digest": "aaa",
            "owner": { "observed_at_unix_ms": 7, "reading_digest": "bbb" },
            "value": "sonnet"
        });
        let second = json!({
            "observed_at_unix_ms": 2000,
            "reading_digest": null,
            "owner": { "observed_at_unix_ms": 9, "reading_digest": null },
            "value": "sonnet"
        });
        assert_eq!(
            canonical_reading_digest(&first),
            canonical_reading_digest(&second)
        );
        let changed = json!({
            "observed_at_unix_ms": 1000,
            "reading_digest": "aaa",
            "owner": { "observed_at_unix_ms": 7, "reading_digest": "bbb" },
            "value": "opus"
        });
        assert_ne!(
            canonical_reading_digest(&first),
            canonical_reading_digest(&changed)
        );
    }
}
