//! Wire documents the owner dispatch transport parses but the frozen C0
//! module does not type: `oi.config-validation/v1`, `oi.config-plan/v1` and
//! `oi.config-error/v1` (09 §6). New additive types for the C1 kernel — the
//! frozen C0 files are untouched.
//!
//! Unknown fields are tolerated on every type (09 §15): the plane accepts
//! same-major additive evolution, never drops what it does not understand.

use crate::configuration::contribution::Effect;
use crate::configuration::refs::Scope;
use serde::{Deserialize, Serialize};
use serde_json::Value;

pub const VALIDATION_SCHEMA: &str = "oi.config-validation/v1";
pub const PLAN_SCHEMA: &str = "oi.config-plan/v1";
pub const ERROR_SCHEMA: &str = "oi.config-error/v1";

/// The owner's validation answer for one requested value at one scope.
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct ValidationDocument {
    pub schema: String,
    pub setting_ref: String,
    pub scope: Scope,
    pub valid: bool,
    #[serde(default)]
    pub violations: Vec<ValidationViolation>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expected_effect: Option<Effect>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct ValidationViolation {
    pub code: String,
    pub message: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
}

impl ValidationDocument {
    /// The document is only usable when it names the frozen schema; anything
    /// else on stdout of a successful validate is an internal transport
    /// failure, never silently accepted.
    pub fn parse(value: Value) -> Result<Self, String> {
        let document: Self = serde_json::from_value(value)
            .map_err(|error| format!("validate answer is not {VALIDATION_SCHEMA}: {error}"))?;
        if document.schema != VALIDATION_SCHEMA {
            return Err(format!(
                "unsupported_schema: expected `{VALIDATION_SCHEMA}`, found `{}`",
                document.schema
            ));
        }
        Ok(document)
    }

    /// The owner's violation list, joined into one truthful message.
    pub fn violation_message(&self) -> String {
        self.violations
            .iter()
            .map(|violation| {
                match &violation.path {
                    Some(path) => format!("{} (at {path}): {}", violation.code, violation.message),
                    None => format!("{}: {}", violation.code, violation.message),
                }
            })
            .collect::<Vec<_>>()
            .join("; ")
    }
}

/// The owner's plan/explain answer: the owner-minted `plan_id` and the
/// `plan_digest` that anchors idempotent apply (09 §6, §9).
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct PlanDocument {
    pub schema: String,
    pub plan_id: String,
    /// sha256 hex over the canonical plan body — the idempotency anchor.
    pub plan_digest: String,
    pub setting_ref: String,
    pub scope: Scope,
    #[serde(default)]
    pub changes: Vec<PlanChange>,
    pub expected_effect: Effect,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expires_at_unix_ms: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub explain_ref: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub authority: Option<PlanAuthority>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct PlanChange {
    pub summary: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub native_ref: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub before_ref: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub after_ref: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct PlanAuthority {
    #[serde(default)]
    pub requires: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub granted_by: Option<String>,
}

impl PlanDocument {
    pub fn parse(value: Value) -> Result<Self, String> {
        let document: Self = serde_json::from_value(value)
            .map_err(|error| format!("plan answer is not {PLAN_SCHEMA}: {error}"))?;
        if document.schema != PLAN_SCHEMA {
            return Err(format!(
                "unsupported_schema: expected `{PLAN_SCHEMA}`, found `{}`",
                document.schema
            ));
        }
        if document.plan_id.is_empty() || document.plan_digest.is_empty() {
            return Err("plan answer carries no plan_id or no plan_digest".to_owned());
        }
        Ok(document)
    }
}

/// The structured failure document an owner emits with a non-zero exit
/// (09 §6). Its `error_code` is inside the frozen vocabulary.
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct ErrorDocument {
    pub schema: String,
    pub error_code: String,
    pub message: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub setting_ref: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub scope_kind: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub retryable: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub detail_ref: Option<String>,
}

impl ErrorDocument {
    /// Parse any stdout/stderr-shaped JSON into an error document. Returns
    /// `None` when the bytes are not `oi.config-error/v1` — the caller then
    /// owes a transport failure, not an invented owner answer.
    pub fn parse(value: Value) -> Option<Self> {
        let document: Self = serde_json::from_value(value).ok()?;
        (document.schema == ERROR_SCHEMA).then_some(document)
    }

    /// The frozen code, or `internal` when the owner sent a code outside the
    /// vocabulary (an explicit contract error, never a new local code).
    pub fn code(&self) -> crate::configuration::ErrorCode {
        crate::configuration::ErrorCode::from_wire(&self.error_code)
            .unwrap_or(crate::configuration::ErrorCode::Internal)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::configuration::refs::{Scope, ScopeKind};
    use serde_json::json;

    fn scope() -> Scope {
        Scope {
            scope_kind: ScopeKind::Project,
            scope_ref: Some("epilogos/o-i".to_owned()),
        }
    }

    #[test]
    fn validation_document_tolerates_unknown_fields_and_rejects_foreign_schemas() {
        let value = json!({
            "schema": VALIDATION_SCHEMA,
            "setting_ref": "ai-kit:resolution:model.default",
            "scope": { "scope_kind": "project", "scope_ref": "epilogos/o-i" },
            "valid": true,
            "violations": [],
            "oi-unknown-future-field": { "kept": true }
        });
        let document = ValidationDocument::parse(value).expect("parses");
        assert!(document.valid);

        let mut foreign = json!({ "schema": "oi.config-validation/v2", "valid": true });
        foreign["setting_ref"] = json!("ai-kit:resolution:model.default");
        foreign["scope"] = json!({ "scope_kind": "project", "scope_ref": null });
        assert!(ValidationDocument::parse(foreign).is_err());
    }

    #[test]
    fn error_document_maps_codes_and_refuses_foreign_schemas() {
        let value = json!({
            "schema": ERROR_SCHEMA,
            "error_code": "unsupported_scope",
            "message": "world is not allowed for this setting",
            "scope_kind": "world"
        });
        let document = ErrorDocument::parse(value).expect("parses");
        assert_eq!(document.code(), crate::configuration::ErrorCode::UnsupportedScope);
        assert_eq!(document.scope_kind.as_deref(), Some("world"));

        assert!(ErrorDocument::parse(json!({ "error": "boom" })).is_none());
    }

    #[test]
    fn violation_message_carries_owner_reasons() {
        let document = ValidationDocument {
            schema: VALIDATION_SCHEMA.to_owned(),
            setting_ref: "ai-kit:resolution:model.default".to_owned(),
            scope: scope(),
            valid: false,
            violations: vec![ValidationViolation {
                code: "not_in_enum".to_owned(),
                message: "`haiku` is not one of sonnet-current, sonnet-next, opus".to_owned(),
                path: None,
            }],
            expected_effect: None,
        };
        assert!(document.violation_message().contains("not_in_enum"));
        assert!(document.violation_message().contains("haiku"));
    }
}
