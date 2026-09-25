//! The C5 engine seam for the native `oi config` / `oi profile` surface
//! (#299 §14 lane C5, against the frozen C0 contract of
//! `docs/cradle/09-CONFIGURATION-PLANE.md`).
//!
//! The C1 configuration kernel and the C2 profile store are built in their
//! own lanes. This module defines the two traits the command layer drives,
//! so the integrator can bind the real kernel/store with a thin adapter;
//! [`crate::fixture_surface`] carries a fixture-backed in-memory
//! implementation used by the C5 tests. The seam is faithful to the C0
//! types: every method speaks `oi_cli::configuration` documents, every
//! failure is an explicit `oi.config-error/v1` (09 §6/§13) — unsupported
//! scopes and absent owners are structured errors, never silent fallback.
//!
//! Additive wire types: C0 froze `oi.config-validation/v1`,
//! `oi.config-plan/v1` and `oi.config-error/v1` as JSON Schemas only; the
//! Rust types here state the same wire shapes (no frozen file is edited).
//! The small reading envelopes the CLI emits (`oi.config-listing/v1`,
//! `oi.config-get/v1`, `oi.config-diff/v1`, `oi.config-doctor/v1`,
//! `oi.config-plan-set/v1`, `oi.config-apply/v1`, `oi.config-discard/v1`,
//! `oi.config-receipts/v1`, `oi.profile-listing/v1`,
//! `oi.profile-activation/v1`, `oi.profile-edit/v1`) are C5-local headless
//! reading forms built entirely from frozen vocabularies and frozen
//! document types.

use crate::configuration::{
    ChangeSet, Contribution, DesiredEntry, Effect, EffectKind, ErrorCode, OperationKind, Profile,
    Receipt, ReceiptOutcome, ReconciliationStatus, Resolution, Scope, SettingSpec, ValueKind,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;

pub const CONFIG_ERROR_SCHEMA: &str = "oi.config-error/v1";
pub const CONFIG_VALIDATION_SCHEMA: &str = "oi.config-validation/v1";
pub const CONFIG_PLAN_SCHEMA: &str = "oi.config-plan/v1";

// ---------------------------------------------------------------------------
// Structured failure: oi.config-error/v1
// ---------------------------------------------------------------------------

/// The structured failure document every configuration-plane operation
/// returns on a non-zero exit (09 §6/§13). Error codes come only from the
/// frozen [`ErrorCode`] vocabulary.
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct ConfigError {
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

impl ConfigError {
    pub fn to_json_pretty(&self) -> String {
        serde_json::to_string_pretty(self).unwrap_or_else(|_| format!(
            "{{\"schema\":\"{CONFIG_ERROR_SCHEMA}\",\"error_code\":\"internal\",\"message\":\"unserialisable error\"}}"
        ))
    }
}

// ---------------------------------------------------------------------------
// SurfaceError: the seam's one failure type
// ---------------------------------------------------------------------------

/// The one failure type of the seam. It maps onto the frozen error
/// vocabulary and renders both the structured document (`--json`) and the
/// plain human line.
#[derive(Clone, Debug, PartialEq)]
pub struct SurfaceError {
    pub code: ErrorCode,
    pub message: String,
    pub setting_ref: Option<String>,
    pub scope_kind: Option<String>,
    pub retryable: bool,
    pub detail_ref: Option<String>,
}

impl SurfaceError {
    pub fn new(code: ErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
            setting_ref: None,
            scope_kind: None,
            retryable: false,
            detail_ref: None,
        }
    }

    pub fn setting(mut self, setting_ref: impl Into<String>) -> Self {
        self.setting_ref = Some(setting_ref.into());
        self
    }

    pub fn scope(mut self, scope: &Scope) -> Self {
        self.scope_kind = Some(scope.scope_kind.as_wire().to_owned());
        self
    }

    pub fn retryable(mut self) -> Self {
        self.retryable = true;
        self
    }

    pub fn document(&self) -> ConfigError {
        ConfigError {
            schema: CONFIG_ERROR_SCHEMA.to_owned(),
            error_code: self.code.as_wire().to_owned(),
            message: self.message.clone(),
            setting_ref: self.setting_ref.clone(),
            scope_kind: self.scope_kind.clone(),
            retryable: Some(self.retryable),
            detail_ref: self.detail_ref.clone(),
        }
    }
}

impl std::fmt::Display for SurfaceError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{} ({})", self.message, self.code.as_wire())
    }
}

pub type SurfaceResult<T> = Result<T, SurfaceError>;

// ---------------------------------------------------------------------------
// Owner-native answers: oi.config-validation/v1 and oi.config-plan/v1
// ---------------------------------------------------------------------------

/// One owner-native violation inside a validation answer.
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct ValidationViolation {
    pub code: String,
    pub message: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
}

/// The owner-native validation answer for one requested value at one scope
/// (09 §6). The owner's native validation remains authoritative; the
/// contribution's `value_schema` is a disclosed hint, not O:I validation.
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct ConfigValidation {
    pub schema: String,
    pub setting_ref: String,
    pub scope: Scope,
    pub valid: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub violations: Option<Vec<ValidationViolation>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expected_effect: Option<Effect>,
}

/// One described change inside a plan.
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

/// The owner-native plan for one requested change (09 §6): owner-minted
/// `plan_id`, and the `plan_digest` that anchors idempotent apply.
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct ConfigPlan {
    pub schema: String,
    pub plan_id: String,
    pub plan_digest: String,
    pub setting_ref: String,
    pub scope: Scope,
    pub changes: Vec<PlanChange>,
    pub expected_effect: Effect,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expires_at_unix_ms: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub explain_ref: Option<String>,
}

impl ConfigPlan {
    /// The canonical plan body of 09 §6: the plan document with `plan_id`,
    /// `expires_at_unix_ms` and every `*_unix_ms` field zeroed. sha256 hex
    /// over this body is the idempotency anchor.
    pub fn canonical_digest(&self) -> String {
        let mut body = serde_json::to_value(self).unwrap_or(Value::Null);
        zero_plan_body(&mut body);
        let bytes = serde_json::to_vec(&body).unwrap_or_default();
        use sha2::{Digest, Sha256};
        let digest = Sha256::digest(&bytes);
        hex(&digest)
    }
}

fn zero_plan_body(body: &mut Value) {
    match body {
        Value::Object(map) => {
            for (key, value) in map.iter_mut() {
                if key == "plan_id" {
                    *value = Value::String(String::new());
                } else if key.ends_with("_unix_ms") {
                    // `expires_at_unix_ms` and every other unix-ms stamp zero
                    // the same way (09 §6 canonical plan body).
                    *value = Value::Number(0.into());
                } else {
                    zero_plan_body(value);
                }
            }
        }
        Value::Array(items) => items.iter_mut().for_each(zero_plan_body),
        _ => {}
    }
}

fn hex(bytes: &[u8]) -> String {
    let mut out = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        out.push_str(&format!("{byte:02x}"));
    }
    out
}

/// sha256 hex helper for surfaces that must digest a reading (the 07 §4.5
/// convention applies to real v2 documents; surfaces compute over whatever
/// reading document they actually hold).
pub fn sha256_hex(bytes: &[u8]) -> String {
    use sha2::{Digest, Sha256};
    hex(&Sha256::digest(bytes))
}

// ---------------------------------------------------------------------------
// Discovery and listing readings
// ---------------------------------------------------------------------------

/// One discovered owner (09 §4): either a validated contribution or a named
/// degradation. Absence of a contribution is data; a surface never invents
/// settings for an owner that did not answer.
#[derive(Clone, Debug)]
#[allow(clippy::large_enum_variant)] // the available arm carries the whole owner contribution by design (09 §15 pass-through)
pub enum OwnerContribution {
    Available(Contribution),
    Unavailable {
        owner_ref: String,
        reason: String,
        obligations: Vec<String>,
    },
}

impl OwnerContribution {
    pub fn owner_ref(&self) -> &str {
        match self {
            OwnerContribution::Available(contribution) => &contribution.owner.owner_ref,
            OwnerContribution::Unavailable { owner_ref, .. } => owner_ref,
        }
    }

    pub fn available(&self) -> bool {
        matches!(self, OwnerContribution::Available(_))
    }
}

/// One addressable setting in a listing: the owner's SettingSpec passed
/// through verbatim (pass-through duty, 09 §15) beside its owner.
#[derive(Clone, Debug)]
pub struct ListedSetting {
    pub owner_ref: String,
    pub setting: SettingSpec,
}

impl ListedSetting {
    pub fn value_kind(&self) -> ValueKind {
        self.setting.value_schema.kind
    }
}

/// A requested change handed to the seam. `value` carries ordinary values;
/// secret-kind settings carry `secret_reference` and never a value (09 §14).
#[derive(Clone, Debug, PartialEq)]
pub struct ChangeRequest {
    pub setting_ref: String,
    pub scope: Scope,
    pub value: Option<Value>,
    pub secret_reference: Option<crate::configuration::SecretReferenceValue>,
}

/// The result of an owner-native application through the seam: the executed
/// ChangeSet (per-operation truth, derived overall status) beside the
/// owner-minted receipts. Receipt identity flows through unchanged.
#[derive(Clone, Debug)]
pub struct AppliedChange {
    pub changeset: ChangeSet,
    pub receipts: Vec<Receipt>,
}

// ---------------------------------------------------------------------------
// Composition disclosure: the settings × mode interface (lock §5, §7)
// ---------------------------------------------------------------------------

/// The world a settings surface stands in, carried beside the owners and
/// settings it lists. Everything here is the current-world reading's own
/// fact (`oi.current-world/v2`) passed through — the surfaces never
/// re-decide composition, never infer a mode from a product count, and keep
/// requested and effective distinct (`install_mode_basis` names which one
/// is speaking).
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct CompositionDisclosure {
    /// The person's recorded mode statement (`oi mode set`), when one
    /// exists. Never inferred from presence.
    pub requested_mode: Option<String>,
    /// The recognised install mode of the reading.
    pub install_mode: Option<String>,
    /// How `install_mode` was resolved: `requested` or `effective`.
    pub install_mode_basis: Option<String>,
    /// The effective composition: the present product positions.
    pub present_positions: Vec<u8>,
    /// The reading's own warnings, verbatim — including the shortfall
    /// naming when a requested mode is not fully realised (lock §5: the
    /// request keeps naming the world, degraded).
    #[serde(default)]
    pub warnings: Vec<String>,
    /// When the world reading itself was unavailable: the reason. No
    /// standings are invented behind this error; consumers treat every
    /// owner's standing as `unknown`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

impl CompositionDisclosure {
    /// The standing of one owner against this disclosure.
    pub fn standing_of(&self, owner_ref: &str) -> crate::current_world::CompositionStanding {
        if self.error.is_some() {
            return crate::current_world::CompositionStanding::Unknown;
        }
        crate::current_world::owner_composition_standing(&self.present_positions, owner_ref)
    }
}

// ---------------------------------------------------------------------------
// Doctor findings (#299 §12)
// ---------------------------------------------------------------------------

/// The doctor distinctions of #299 §12. Every finding keys off a
/// contribution `effect.kind` and/or a frozen reconciliation status
/// (09 §7.1/§11) — never off guesses. The classification labels are C5's
/// statement of the §12 list; the evidence they rest on is frozen vocabulary.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DoctorClassification {
    InvalidDesiredState,
    UnsupportedScope,
    OwnerUnavailable,
    OwnerValidationFailure,
    PendingEffect,
    NativeDesiredDrift,
    RuntimeDegradation,
}

impl DoctorClassification {
    pub fn as_wire(&self) -> &'static str {
        match self {
            DoctorClassification::InvalidDesiredState => "invalid_desired_state",
            DoctorClassification::UnsupportedScope => "unsupported_scope",
            DoctorClassification::OwnerUnavailable => "owner_unavailable",
            DoctorClassification::OwnerValidationFailure => "owner_validation_failed",
            DoctorClassification::PendingEffect => "pending_effect",
            DoctorClassification::NativeDesiredDrift => "native_desired_drift",
            DoctorClassification::RuntimeDegradation => "runtime_degradation",
        }
    }
}

/// One doctor finding.
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct DoctorFinding {
    pub classification: DoctorClassification,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub owner_ref: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub setting_ref: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub scope: Option<Scope>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reconciliation_status: Option<ReconciliationStatus>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub effect_kind: Option<EffectKind>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error_code: Option<String>,
    pub message: String,
}

/// Map a reconciliation status to a doctor classification. `Satisfied`
/// needs no finding — health is not a finding. The mapping is pure so the
/// whole table stays testable; findings carry the contribution's
/// `effect.kind` beside the classification as evidence (09 §11).
pub fn classify_reconciliation(status: ReconciliationStatus) -> Option<DoctorClassification> {
    match status {
        ReconciliationStatus::Drifted => Some(DoctorClassification::NativeDesiredDrift),
        ReconciliationStatus::Pending => Some(DoctorClassification::PendingEffect),
        // `blocked` names its reason: the caller refines owner-availability
        // blocks to `owner_unavailable`; validation and authority failures
        // stay owner-native validation failures.
        ReconciliationStatus::Blocked => Some(DoctorClassification::OwnerValidationFailure),
        ReconciliationStatus::Unsupported => Some(DoctorClassification::UnsupportedScope),
        ReconciliationStatus::Unknown => Some(DoctorClassification::RuntimeDegradation),
        ReconciliationStatus::Satisfied => None,
    }
}

// ---------------------------------------------------------------------------
// The configuration seam (C1 binds here)
// ---------------------------------------------------------------------------

/// The configuration engine seam. The command layer is generic over this
/// trait; the C1 kernel binds it with a thin adapter. Every method is
/// explicit: unknown settings, unsupported scopes and unavailable owners
/// return [`SurfaceError`] with the frozen codes.
pub trait ConfigSurface {
    /// Owner discovery (09 §4): validated contributions and named
    /// degradations. Never an invented contribution.
    fn discover(&self) -> SurfaceResult<Vec<OwnerContribution>>;

    /// The world this surface stands in (lock §5): the current-world
    /// reading's own composition facts, with each owner's standing joined
    /// against them by [`CompositionDisclosure::standing_of`]. Surfaces
    /// that hold no world reading disclose the honest `error` form.
    fn composition(&self) -> SurfaceResult<CompositionDisclosure> {
        Ok(CompositionDisclosure {
            error: Some(
                "this configuration surface does not disclose the world composition".to_owned(),
            ),
            ..CompositionDisclosure::default()
        })
    }

    /// Every addressable setting across discovered owners, specs verbatim.
    fn list(&self) -> SurfaceResult<Vec<ListedSetting>>;

    /// The frozen `oi.config-resolution/v1` reading for one setting at one
    /// scope, with whatever desired state this surface holds.
    fn resolve(&self, setting_ref: &str, scope: &Scope) -> SurfaceResult<Resolution>;

    /// Resolve an ordered batch; each refused address keeps its own error.
    fn resolve_many(&self, pairs: &[(String, Scope)]) -> Vec<SurfaceResult<Resolution>> {
        pairs.iter().map(|(setting, scope)| self.resolve(setting, scope)).collect()
    }

    /// Resolve one explicit desired entry (e.g. a profile entry) against
    /// native truth — the input to `oi profile diff`.
    fn resolve_entry(&self, entry: &DesiredEntry) -> SurfaceResult<Resolution>;

    /// The desired entries this surface currently holds (profiles plus
    /// explicit sets recorded in O:I-owned state).
    fn desired_entries(&self) -> SurfaceResult<Vec<DesiredEntry>>;

    /// Desired-vs-native across everything this surface holds.
    fn diff(&self) -> SurfaceResult<Vec<Resolution>>;

    /// Assemble a ChangeSet request: resolve every change explicitly, run
    /// the contribution-level shape checks, mutate nothing, plan nothing.
    fn assemble(
        &self,
        changeset_id: &str,
        requests: &[ChangeRequest],
        profile_ref: Option<&str>,
    ) -> SurfaceResult<ChangeSet>;

    /// Owner-native plan for one requested change. No mutation.
    fn plan(&self, request: &ChangeRequest) -> SurfaceResult<ConfigPlan>;

    /// Execute a ChangeSet: validate → plan → owner-native apply → re-read
    /// verification, per-operation truth throughout, records the desired
    /// entries in O:I-owned state, and replays idempotently under the
    /// frozen key (09 §9).
    fn apply(
        &self,
        changeset_id: &str,
        requests: &[ChangeRequest],
        profile_ref: Option<&str>,
    ) -> SurfaceResult<AppliedChange>;

    /// Reset one setting at one scope through the owner op and settle the
    /// resulting ChangeSet truthfully.
    fn reset(&self, setting_ref: &str, scope: &Scope) -> SurfaceResult<AppliedChange>;

    /// Readiness findings for `oi config doctor`, keyed off contribution
    /// effect kinds and reconciliation statuses.
    fn doctor(&self) -> SurfaceResult<Vec<DoctorFinding>>;

    /// Hold one desired entry as explicit O:I intent — the desired axis of
    /// 09 §7 — without planning, applying or touching any owner. A hold
    /// replaces the previously held entry for the same (setting, scope).
    /// Surfaces that keep no desired state refuse.
    fn hold_desired(&self, _request: &ChangeRequest) -> SurfaceResult<DesiredEntry> {
        Err(SurfaceError::new(
            ErrorCode::Internal,
            "this configuration surface keeps no desired state; holding is an engine capability",
        ))
    }

    /// Withdraw one explicitly held desired entry. `Ok(false)` when nothing
    /// was held — the absence is observable, not an error. Surfaces that
    /// keep no desired state refuse.
    fn discard_desired(&self, _setting_ref: &str, _scope: &Scope) -> SurfaceResult<bool> {
        Err(SurfaceError::new(
            ErrorCode::Internal,
            "this configuration surface keeps no desired state; discarding is an engine capability",
        ))
    }

    /// The recorded receipt references (09 §9): one row per O:I-side receipt
    /// ref, identity intact. This is a listing/reading of what the engine
    /// recorded — never a second store; the owner's own history (`native_ref`)
    /// remains the record of record. A changeset with no recorded receipts
    /// lists as empty: named absence, never invented content. Surfaces that
    /// keep no receipt records refuse.
    fn receipts(&self) -> SurfaceResult<Vec<ReceiptSummary>> {
        Err(SurfaceError::new(
            ErrorCode::Internal,
            "this configuration surface keeps no receipt records; receipts listing is an engine capability",
        ))
    }
}

// ---------------------------------------------------------------------------
// The recorded receipt listing (09 §9)
// ---------------------------------------------------------------------------

/// One recorded receipt reference, as the receipts listing reads it: the
/// identity fields of `oi.config-receipt/v1` exactly as the engine recorded
/// them. This is a reading of recorded refs, never a mirror of owner state —
/// the owner's own history stays the record of record (`native_ref`, 09 §9).
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct ReceiptSummary {
    pub receipt_id: String,
    pub owner_ref: String,
    pub changeset_id: String,
    pub setting_ref: String,
    pub scope: Scope,
    pub operation: OperationKind,
    pub outcome: ReceiptOutcome,
    pub applied_at_unix_ms: u64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub native_ref: Option<String>,
}

// ---------------------------------------------------------------------------
// The profile seam (C2 binds here)
// ---------------------------------------------------------------------------

/// One row of `oi profile list`.
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct ProfileSummary {
    pub profile_ref: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub created_at_unix_ms: u64,
    pub revised_at_unix_ms: u64,
    pub native_profiles: usize,
    pub desired_entries: usize,
}

/// The result of the explicit `oi profile use` operation. The active mark is
/// written only here — never inferred (09 §12).
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct ProfileActivation {
    pub active_profile: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub previous: Option<String>,
}

/// One explicit, reviewable `oi profile edit` operation. Editing is a
/// persistence-path mutation of the sparse desired document through the
/// store's own laws — never an owner apply (09 §12).
#[derive(Clone, Debug, PartialEq)]
pub enum ProfileEditOp {
    /// Add or update one desired entry; the entry identity is
    /// `(setting_ref, scope)` and a set replaces the entry held for it.
    /// The same laws as any change request apply: explicit addressing, the
    /// secret law (secret-kind carries the reference and never a value),
    /// and the disclosed shape checks.
    SetEntry {
        setting_ref: String,
        scope: Scope,
        value: Option<Value>,
        secret_reference: Option<crate::configuration::SecretReferenceValue>,
    },
    /// Remove one desired entry. With no scope: the one entry held for the
    /// setting — refused as ambiguous when several exist, named-absent when
    /// none does.
    RemoveEntry {
        setting_ref: String,
        scope: Option<Scope>,
    },
    /// Set (or clear with `None`) the profile title.
    SetTitle(Option<String>),
    /// Set (or clear with `None`) the profile description.
    SetDescription(Option<String>),
}

/// What one edit operation changed, named per operation. `next` carries the
/// entry as an add/set left it; `previous` carries the entry as a
/// replacement or removal found it — a secret-kind entry carries its
/// reference only, never material.
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct ProfileEditApplied {
    /// `entry_added` | `entry_updated` | `entry_removed` | `entry_absent` |
    /// `title_set` | `description_set`.
    pub action: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub setting_ref: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub scope: Option<Scope>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub next: Option<DesiredEntry>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub previous: Option<DesiredEntry>,
}

/// The outcome of one `oi profile edit`: the stored document beside the
/// per-operation record of what changed. Nothing was applied to any owner.
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct ProfileEditOutcome {
    pub profile: Profile,
    pub applied: Vec<ProfileEditApplied>,
}

/// The profile store seam. The C2 store binds it with a thin adapter.
/// Persistence law is frozen (09 §12): `$OI_HOME/profiles/<ref>.json`,
/// regular files, 0600, atomic publish, never in Central; import is never a
/// hidden apply.
pub trait ProfileSurface {
    /// Every stored profile, in stable order.
    fn list(&self) -> SurfaceResult<Vec<ProfileSummary>>;

    /// Load one profile by ref; an unknown ref is an explicit error.
    fn load(&self, profile_ref: &str) -> SurfaceResult<Profile>;

    /// Create an empty sparse profile.
    fn create(
        &self,
        profile_ref: &str,
        title: Option<String>,
        description: Option<String>,
    ) -> SurfaceResult<Profile>;

    /// Copy one profile to a new ref (secrets travel as references only).
    fn clone_profile(&self, source_ref: &str, target_ref: &str) -> SurfaceResult<Profile>;

    /// The explicit active-profile mark: `use` records it, `None` clears it.
    fn set_active(&self, profile_ref: Option<&str>) -> SurfaceResult<ProfileActivation>;

    /// The currently active profile, if one was explicitly set.
    fn active(&self) -> SurfaceResult<Option<String>>;

    /// The portable form: the same `oi.profile/v1` document. Secret-kind
    /// entries stay references; there is nothing to strip.
    fn export(&self, profile_ref: &str) -> SurfaceResult<Profile>;

    /// Store an imported profile as inspectable desired state. Never
    /// applies anything; validates the document and its secret law first.
    fn import(&self, profile: &Profile, source_ref: Option<&str>) -> SurfaceResult<Profile>;

    /// Edit a stored profile in place through an explicit, reviewable
    /// operation set (09 §12: a persistence-path mutation of the sparse
    /// desired document — never an owner apply, the active mark untouched).
    /// Every operation is validated through the same laws as creation; the
    /// document is stored atomically under the store's own file law.
    /// Surfaces without an edit capability refuse.
    fn edit(
        &self,
        _profile_ref: &str,
        _operations: &[ProfileEditOp],
    ) -> SurfaceResult<ProfileEditOutcome> {
        Err(SurfaceError::new(
            ErrorCode::Internal,
            "this profile surface does not support in-place edits; editing is an engine capability",
        ))
    }
}

// ---------------------------------------------------------------------------
// Shared validation helpers used by both the seam and the command layer
// ---------------------------------------------------------------------------

/// Validate that a document carries the exact expected schema string; an
/// unknown major version is an explicit `unsupported_schema` (09 §15).
pub fn expect_schema(document: &Value, expected: &str) -> SurfaceResult<()> {
    match document.get("schema").and_then(Value::as_str) {
        Some(schema) if schema == expected => Ok(()),
        Some(other) => Err(SurfaceError::new(
            ErrorCode::UnsupportedSchema,
            format!("expected `{expected}`, found `{other}`"),
        )),
        None => Err(SurfaceError::new(
            ErrorCode::UnsupportedSchema,
            format!("document carries no `schema`; expected `{expected}`"),
        )),
    }
}

/// A scope kind is only addressable inside the frozen registry
/// (`parse_scope_compact`); callers owe the explicit `unknown_scope_kind`.
pub fn parse_scope_argument(raw: &str) -> SurfaceResult<Scope> {
    crate::configuration::parse_scope_compact(raw).ok_or_else(|| {
        SurfaceError::new(
            ErrorCode::UnknownScopeKind,
            format!(
                "scope `{raw}` is not a known scope kind; the frozen kinds are world, ground, \
                 project, machine, workcell, agency, agent, session-space, agent-session, \
                 provider, connector-relation, invocation"
            ),
        )
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::configuration::{
        parse_scope_compact, EffectKind, ReconciliationStatus, ScopeKind, CONTRIBUTION_SCHEMA,
    };

    fn scope(raw: &str) -> Scope {
        parse_scope_compact(raw).expect("test scope parses")
    }

    #[test]
    fn canonical_plan_digest_zeroes_identity_and_time() {
        let plan = ConfigPlan {
            schema: CONFIG_PLAN_SCHEMA.to_owned(),
            plan_id: "fixture-plan-1".into(),
            plan_digest: String::new(),
            setting_ref: "ai-kit:resolution:model.default".into(),
            scope: scope("project:epilogos/o-i"),
            changes: vec![PlanChange {
                summary: "set model".into(),
                native_ref: None,
                before_ref: None,
                after_ref: None,
            }],
            expected_effect: Effect {
                kind: EffectKind::SessionRestartRequired,
                summary: None,
                ref_: None,
            },
            expires_at_unix_ms: Some(42),
            explain_ref: None,
        };
        let digest = plan.canonical_digest();
        assert_eq!(digest.len(), 64, "sha256 hex");
        // Identity and time are zeroed inside the body, so the digest is
        // stable under their variation.
        let mut other = plan.clone();
        other.plan_id = "fixture-plan-2".into();
        other.expires_at_unix_ms = Some(999);
        assert_eq!(
            digest,
            other.canonical_digest(),
            "idempotency anchor is stable"
        );
        let mut different = plan.clone();
        different.setting_ref = "ai-kit:resolution:skill-set".into();
        assert_ne!(
            digest,
            different.canonical_digest(),
            "body changes the digest"
        );
    }

    #[test]
    fn doctor_classification_covers_the_frozen_distinctions() {
        assert_eq!(
            classify_reconciliation(ReconciliationStatus::Drifted),
            Some(DoctorClassification::NativeDesiredDrift)
        );
        assert_eq!(
            classify_reconciliation(ReconciliationStatus::Pending),
            Some(DoctorClassification::PendingEffect)
        );
        assert_eq!(
            classify_reconciliation(ReconciliationStatus::Blocked),
            Some(DoctorClassification::OwnerValidationFailure)
        );
        assert_eq!(
            classify_reconciliation(ReconciliationStatus::Unsupported),
            Some(DoctorClassification::UnsupportedScope)
        );
        assert_eq!(
            classify_reconciliation(ReconciliationStatus::Unknown),
            Some(DoctorClassification::RuntimeDegradation)
        );
        assert_eq!(
            classify_reconciliation(ReconciliationStatus::Satisfied),
            None,
            "health is not a finding"
        );
    }

    #[test]
    fn surface_errors_render_the_frozen_document() {
        let error = SurfaceError::new(ErrorCode::UnsupportedScope, "world is not allowed here")
            .setting("ai-kit:resolution:model.default")
            .scope(&scope("world"));
        let document = error.document();
        assert_eq!(document.schema, "oi.config-error/v1");
        assert_eq!(document.error_code, "unsupported_scope");
        assert_eq!(
            document.setting_ref.as_deref(),
            Some("ai-kit:resolution:model.default")
        );
        assert_eq!(document.scope_kind.as_deref(), Some("world"));
        let raw = document.to_json_pretty();
        assert!(raw.contains("unsupported_scope"));
    }

    #[test]
    fn unknown_scope_arguments_are_explicit_unknown_scope_kind() {
        let error = parse_scope_argument("cluster:west").expect_err("unknown kind is an error");
        assert_eq!(error.code, ErrorCode::UnknownScopeKind);
        let parsed = parse_scope_argument("project:epilogos/o-i").expect("known kind parses");
        assert_eq!(parsed.scope_kind, ScopeKind::Project);
    }

    #[test]
    fn schema_guard_rejects_unknown_majors() {
        let document = serde_json::json!({ "schema": CONTRIBUTION_SCHEMA });
        expect_schema(&document, CONTRIBUTION_SCHEMA).expect("same schema passes");
        let future = serde_json::json!({ "schema": "oi.configuration-contribution/v2" });
        let error = expect_schema(&future, CONTRIBUTION_SCHEMA).expect_err("v2 is an error");
        assert_eq!(error.code, ErrorCode::UnsupportedSchema);
    }
}
