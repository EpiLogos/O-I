//! ChangeSets and receipts (09 §8–§10): a stable, machine-readable change
//! plan over owner-native operations. Not a distributed transaction —
//! per-operation truth, a derived overall status, and no implicit rollback.

use crate::configuration::refs::Scope;
use serde::{Deserialize, Serialize};

pub const CHANGSET_SCHEMA: &str = "oi.config-changeset/v1";
pub const RECEIPT_SCHEMA: &str = "oi.config-receipt/v1";

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct ChangeSet {
    pub schema: String,
    pub changeset_id: String,
    pub created_at_unix_ms: u64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub profile_ref: Option<String>,
    pub requested: Vec<RequestedChange>,
    pub operations: Vec<Operation>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub verification: Option<Verification>,
    pub status: ChangeSetStatus,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub authority: Option<Authority>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct RequestedChange {
    pub setting_ref: String,
    pub scope: Scope,
    /// Absent for reset; MUST be absent for secret-kind settings, which
    /// carry `secret_reference` only (09 §14).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub value: Option<serde_json::Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub secret_reference: Option<crate::configuration::resolution::SecretReference>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct Operation {
    pub op_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub depends_on: Option<Vec<String>>,
    pub owner_ref: String,
    pub setting_ref: String,
    pub scope: Scope,
    pub kind: OperationKind,
    /// sha256 hex over the canonical plan body — the idempotency anchor.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub plan_digest: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub plan_ref: Option<String>,
    pub status: OperationStatus,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub receipt_ref: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error: Option<OperationError>,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum OperationKind {
    Plan,
    Validate,
    Apply,
    Reset,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum OperationStatus {
    Planned,
    Validated,
    Applied,
    Verified,
    Failed,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct OperationError {
    pub code: String,
    pub message: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub retryable: Option<bool>,
}

impl OperationError {
    /// The error-code vocabulary is frozen (09 §6/§13); an unknown code is
    /// an explicit contract error, not a new code.
    pub fn validate(&self) -> Result<(), String> {
        if crate::configuration::ErrorCode::from_wire(&self.code).is_none() {
            return Err(format!(
                "error code `{}` is outside the frozen vocabulary",
                self.code
            ));
        }
        Ok(())
    }
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct Verification {
    /// sha256 over the post-apply v2 reading, 07 §4.5 convention.
    pub reading_digest: Option<String>,
    pub observed_at_unix_ms: u64,
    pub reconciliations: Vec<VerificationEntry>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct VerificationEntry {
    pub setting_ref: String,
    pub status: crate::configuration::resolution::ReconciliationStatus,
}

/// The frozen ChangeSet status vocabulary (09 §8). Derived from
/// per-operation statuses, never asserted.
#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ChangeSetStatus {
    Planned,
    Validated,
    Applied,
    Verified,
    PartiallyApplied,
    Failed,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct Authority {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub requires: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub granted_by: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub evidence_ref: Option<String>,
}

/// The frozen derivation of 09 §8. In-flight mixes that fall between
/// vocabulary points resolve to the coarsest truthful state that does not
/// overclaim: executed-but-not-all-verified is `applied`, never `verified`.
pub fn derive_changeset_status(
    operations: &[Operation],
    verification: Option<&Verification>,
) -> ChangeSetStatus {
    let failed = operations
        .iter()
        .filter(|op| op.status == OperationStatus::Failed)
        .count();
    let executed = operations
        .iter()
        .filter(|op| {
            matches!(
                op.status,
                OperationStatus::Applied | OperationStatus::Verified
            )
        })
        .count();
    if failed > 0 && failed == operations.len() {
        return ChangeSetStatus::Failed;
    }
    if failed > 0 && executed > 0 {
        return ChangeSetStatus::PartiallyApplied;
    }
    let all_verified = operations
        .iter()
        .all(|op| op.status == OperationStatus::Verified);
    if all_verified {
        return if verification.is_some() {
            ChangeSetStatus::Verified
        } else {
            ChangeSetStatus::Applied
        };
    }
    if executed == operations.len() {
        return ChangeSetStatus::Applied;
    }
    let any_validated = operations
        .iter()
        .any(|op| op.status == OperationStatus::Validated);
    if any_validated {
        return ChangeSetStatus::Validated;
    }
    ChangeSetStatus::Planned
}

/// The owner-minted receipt for one configuration operation (09 §9).
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct Receipt {
    pub schema: String,
    pub receipt_id: String,
    pub owner_ref: String,
    pub changeset_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub plan_digest: Option<String>,
    pub setting_ref: String,
    pub scope: Scope,
    pub operation: OperationKind,
    pub outcome: ReceiptOutcome,
    pub applied_at_unix_ms: u64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub native_ref: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expected_effect: Option<crate::configuration::contribution::Effect>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub original_receipt_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error: Option<OperationError>,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ReceiptOutcome {
    Applied,
    /// Idempotent replay: the owner did not re-execute.
    NoOp,
    Failed,
}

/// The frozen idempotency key (09 §9): re-submitting an executed key
/// returns `no_op` with `original_receipt_id` — no re-execution, no
/// re-planning.
#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub struct IdempotencyKey {
    pub owner_ref: String,
    pub changeset_id: String,
    pub setting_ref: String,
    pub scope: Scope,
    pub plan_digest: Option<String>,
}

impl IdempotencyKey {
    pub fn from_receipt(receipt: &Receipt) -> Self {
        Self {
            owner_ref: receipt.owner_ref.clone(),
            changeset_id: receipt.changeset_id.clone(),
            setting_ref: receipt.setting_ref.clone(),
            scope: receipt.scope.clone(),
            plan_digest: receipt.plan_digest.clone(),
        }
    }

    pub fn from_operation(operation: &Operation, changeset_id: &str) -> Self {
        Self {
            owner_ref: operation.owner_ref.clone(),
            changeset_id: changeset_id.to_owned(),
            setting_ref: operation.setting_ref.clone(),
            scope: operation.scope.clone(),
            plan_digest: operation.plan_digest.clone(),
        }
    }
}

impl ChangeSet {
    pub fn validate(&self) -> Result<(), String> {
        if self.schema != CHANGSET_SCHEMA {
            return Err(format!(
                "unsupported_schema: expected `{CHANGSET_SCHEMA}`, found `{}`",
                self.schema
            ));
        }
        if !self.changeset_id.starts_with("cs-") || self.changeset_id.len() < 4 {
            return Err(format!(
                "changeset id `{}` must be `cs-` + a unique suffix",
                self.changeset_id
            ));
        }
        let mut op_ids = std::collections::BTreeSet::new();
        for operation in &self.operations {
            if !op_ids.insert(operation.op_id.clone()) {
                return Err(format!("operation id `{}` appears twice", operation.op_id));
            }
            match operation.status {
                OperationStatus::Applied | OperationStatus::Verified => {
                    if operation.receipt_ref.is_none() {
                        return Err(format!(
                            "operation `{}` reached `{}` but names no receipt",
                            operation.op_id,
                            status_wire(match operation.status {
                                OperationStatus::Applied => ChangeSetStatus::Applied,
                                _ => ChangeSetStatus::Verified,
                            })
                        ));
                    }
                }
                OperationStatus::Failed => {
                    if let Some(error) = &operation.error {
                        error
                            .validate()
                            .map_err(|e| format!("operation `{}`: {e}", operation.op_id))?;
                    } else {
                        return Err(format!(
                            "operation `{}` failed but carries no error",
                            operation.op_id
                        ));
                    }
                }
                OperationStatus::Planned | OperationStatus::Validated => {}
            }
        }
        for operation in &self.operations {
            for dependency in operation.depends_on.iter().flatten() {
                if !op_ids.contains(dependency) {
                    return Err(format!(
                        "operation `{}` depends on unknown operation `{dependency}`",
                        operation.op_id
                    ));
                }
            }
        }
        // Every requested change is carried by exactly one operation, and
        // no operation mutates anything that was not requested.
        for requested in &self.requested {
            if self
                .operations
                .iter()
                .filter(|op| op.setting_ref == requested.setting_ref && op.scope == requested.scope)
                .count()
                != 1
            {
                return Err(format!(
                    "requested change `{}` is not carried by exactly one operation",
                    requested.setting_ref
                ));
            }
        }
        for operation in &self.operations {
            if !self.requested.iter().any(|requested| {
                requested.setting_ref == operation.setting_ref && requested.scope == operation.scope
            }) {
                return Err(format!(
                    "operation `{}` mutates `{}`, which was not requested",
                    operation.op_id, operation.setting_ref
                ));
            }
        }
        let derived = derive_changeset_status(&self.operations, self.verification.as_ref());
        if derived != self.status {
            return Err(format!(
                "status `{}` was asserted but operations derive `{derived:?}`; status is derived, never asserted",
                status_wire(self.status)
            ));
        }
        Ok(())
    }
}

impl Receipt {
    pub fn validate(&self) -> Result<(), String> {
        if self.schema != RECEIPT_SCHEMA {
            return Err(format!(
                "unsupported_schema: expected `{RECEIPT_SCHEMA}`, found `{}`",
                self.schema
            ));
        }
        if self.receipt_id.is_empty() {
            return Err("receipt_id must be owner-minted and non-empty".to_owned());
        }
        match self.outcome {
            ReceiptOutcome::NoOp if self.original_receipt_id.is_none() => {
                return Err("no_op replay must name original_receipt_id".to_owned());
            }
            ReceiptOutcome::Failed if self.error.is_none() => {
                return Err("failed receipt must carry its error".to_owned());
            }
            _ => {}
        }
        if let Some(error) = &self.error {
            error.validate()?;
        }
        Ok(())
    }
}

fn status_wire(status: ChangeSetStatus) -> &'static str {
    match status {
        ChangeSetStatus::Planned => "planned",
        ChangeSetStatus::Validated => "validated",
        ChangeSetStatus::Applied => "applied",
        ChangeSetStatus::Verified => "verified",
        ChangeSetStatus::PartiallyApplied => "partially_applied",
        ChangeSetStatus::Failed => "failed",
    }
}
