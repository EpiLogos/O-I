//! Configuration-plane contract types: the frozen C0 decisions of
//! `docs/cradle/09-CONFIGURATION-PLANE.md` (#299).
//!
//! This module is deliberately minimal: grammar, document types, and the
//! validation/reconciliation functions the contract names as pure. It owns
//! no commands, no registry engine, no persistence and no owner dispatch —
//! those are C1/C2/C5. Every document type accepts unknown fields (§15 of
//! the contract): unknown members are tolerated on read and never a reason
//! to drop a setting.
pub mod changeset;
pub mod contribution;
pub mod profile;
pub mod redaction;
pub mod refs;
pub mod resolution;

pub use changeset::{
    derive_changeset_status, Authority, ChangeSet, ChangeSetStatus, IdempotencyKey, Operation,
    OperationError, OperationKind, OperationStatus, Receipt, ReceiptOutcome, RequestedChange,
    Verification, VerificationEntry, CHANGSET_SCHEMA, RECEIPT_SCHEMA,
};
pub use contribution::{
    AllowedScope, Availability, AvailabilityState, Contribution, ContributionRegistry,
    DefaultSemantics, Degradation, DegradationState, Effect, EffectKind, EnumOption,
    OperationAvailability, OperationAvailabilityState, OwnerBlock, OwnerKind, OwnerOperations,
    RegisteredSetting, Section, SettingOperations, SettingSpec, TableColumn, ValueKind,
    ValueSchema, CONTRIBUTION_CONTRACT_REVISION, CONTRIBUTION_SCHEMA,
};
pub use profile::{
    profile_path, AuthoredBy, DesiredEntry, NativeProfileRef, Profile, ProfileProvenance,
    SecretReferenceValue, PROFILE_SCHEMA,
};
pub use redaction::{validate_changeset, validate_profile, validate_resolution};
pub use refs::{
    parse_scope_compact, parse_setting_ref, Scope, ScopeDecision, ScopeError, ScopeKind,
    SettingRefParts,
};
pub use resolution::{
    reconcile, Desired, NativeAxes, NativeAxis, NativeReading, Provenance, Reconciliation,
    ReconciliationInputs, ReconciliationStatus, Resolution, SecretReference, StageState,
    RESOLUTION_SCHEMA,
};

/// The structured error codes every configuration-plane operation may
/// return (09 §6/§13). Unsupported scopes and absent owners are explicit
/// errors, never silent reinterpretation.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ErrorCode {
    UnsupportedSetting,
    UnsupportedScope,
    UnknownScopeKind,
    InvalidValue,
    ValidationFailed,
    OwnerUnavailable,
    PlanExpired,
    NotAuthorised,
    UnsupportedSchema,
    Internal,
}

impl ErrorCode {
    pub fn as_wire(&self) -> &'static str {
        match self {
            ErrorCode::UnsupportedSetting => "unsupported_setting",
            ErrorCode::UnsupportedScope => "unsupported_scope",
            ErrorCode::UnknownScopeKind => "unknown_scope_kind",
            ErrorCode::InvalidValue => "invalid_value",
            ErrorCode::ValidationFailed => "validation_failed",
            ErrorCode::OwnerUnavailable => "owner_unavailable",
            ErrorCode::PlanExpired => "plan_expired",
            ErrorCode::NotAuthorised => "not_authorised",
            ErrorCode::UnsupportedSchema => "unsupported_schema",
            ErrorCode::Internal => "internal",
        }
    }

    pub fn from_wire(raw: &str) -> Option<Self> {
        Some(match raw {
            "unsupported_setting" => ErrorCode::UnsupportedSetting,
            "unsupported_scope" => ErrorCode::UnsupportedScope,
            "unknown_scope_kind" => ErrorCode::UnknownScopeKind,
            "invalid_value" => ErrorCode::InvalidValue,
            "validation_failed" => ErrorCode::ValidationFailed,
            "owner_unavailable" => ErrorCode::OwnerUnavailable,
            "plan_expired" => ErrorCode::PlanExpired,
            "not_authorised" => ErrorCode::NotAuthorised,
            "unsupported_schema" => ErrorCode::UnsupportedSchema,
            "internal" => ErrorCode::Internal,
            _ => return None,
        })
    }
}
