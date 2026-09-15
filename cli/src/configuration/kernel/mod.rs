//! The O:I configuration kernel (#299 C1): owner discovery and registry,
//! setting/scope addressing, ChangeSet assembly and owner-native
//! orchestration, re-read verification, reconciliation, and O:I-side
//! persistence — everything the frozen C0 contract names as kernel
//! territory (`docs/cradle/09-CONFIGURATION-PLANE.md` §4–§10, §16).
//!
//! This module is additive to the frozen C0 files beside it: it consumes
//! their types and pure functions (grammar, document validation, the
//! reconciliation truth table, the ChangeSet status derivation) and never
//! re-decides them.
//!
//! The kernel has no product-specific branches. An owner is a program that
//! answers the frozen discovery command and the frozen four-verb grammar;
//! every setting, scope, schema and effect fact comes from the owner's own
//! contribution document. Tests drive the same path with fixture-backed
//! in-memory owners via the [`transport::OwnerTransport`] trait.
pub mod orchestration;
pub mod registry;
pub mod store;
pub mod surface_adapter;
pub mod transport;
pub mod wire;

pub use orchestration::{
    assemble_changeset, canonical_reading_digest, execute_changeset, idempotency_key_of,
    mint_changeset_id, plan_request, reset_setting, resolve_setting, resolve_setting_address,
    ChangeKind, DesiredChange, DesiredInput, ExecuteReport, KernelError,
};
pub use registry::{
    product_position_specs, OwnerEntry, OwnerRegistry, RegistryDegradation, PRODUCT_POSITIONS,
};
pub use store::{oi_home, ConfigurationStore, ReconciliationRecord};
pub use surface_adapter::{
    desired_change, desired_change_from_entry, error_document, kernel_wire_error,
};
pub use transport::{
    scope_argument, secret_wire_value, verb_argv, ApplyRequest, OwnerGateway, OwnerOpError,
    OwnerSpec, OwnerTransport, ProcessTransport, ResetRequest, SettingRequest, TransportError,
    TransportFailure,
};
pub use wire::{
    ErrorDocument, PlanAuthority, PlanChange, PlanDocument, ValidationDocument,
    ValidationViolation, ERROR_SCHEMA, PLAN_SCHEMA, VALIDATION_SCHEMA,
};
