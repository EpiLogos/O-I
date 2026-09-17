//! Desired/native resolution (09 §7): the one axis native disclosure does
//! not contain — O:I desired state — beside the owner's own v2 axes, with
//! the frozen reconciliation status vocabulary and its pure truth table.

use crate::configuration::refs::Scope;
use serde::{Deserialize, Serialize};
use serde_json::Value;

pub const RESOLUTION_SCHEMA: &str = "oi.config-resolution/v1";

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct Resolution {
    pub schema: String,
    pub setting_ref: String,
    pub scope: Scope,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub desired: Option<Desired>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub native: Option<NativeAxes>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub native_reading: Option<NativeReading>,
    pub reconciliation: Reconciliation,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct Desired {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub value: Option<Value>,
    /// Secret-kind settings carry a reference and never a value (09 §14).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub secret_reference: Option<SecretReference>,
    /// `profile:<ref>` | `invocation` | `oi-setting`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_ref: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub set_at_unix_ms: Option<u64>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct SecretReference {
    #[serde(rename = "ref")]
    pub ref_: String,
    /// Observed-only presence fact; never stored as desired state.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub present: Option<bool>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct NativeAxes {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub declared: Option<NativeAxis>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub effective: Option<NativeAxis>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub active: Option<NativeAxis>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub staged: Option<NativeAxis>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct NativeAxis {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub value: Option<Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub provenance: Option<Provenance>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub materialisation_ref: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub stage_state: Option<StageState>,
}

/// `provenance.path` is a location, never a command (07 §4.6, carried).
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct Provenance {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub owner_ref: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub observed_at_unix_ms: Option<u64>,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum StageState {
    None,
    Prepared,
    Previewed,
    Discardable,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct NativeReading {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reading_digest: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub observed_at_unix_ms: Option<u64>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct Reconciliation {
    pub status: ReconciliationStatus,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub detail_ref: Option<String>,
}

/// The frozen reconciliation vocabulary (09 §7.1). Derivation is a pure
/// function of desired state and native reading — never asserted, never
/// guessed.
#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ReconciliationStatus {
    Satisfied,
    Drifted,
    Pending,
    Blocked,
    Unsupported,
    Unknown,
}

pub struct ReconciliationInputs<'a> {
    /// O:I desired value for this setting at this scope; `None` = no
    /// desired intent held.
    pub desired: Option<&'a Value>,
    pub native_effective: Option<&'a Value>,
    pub native_declared: Option<&'a Value>,
    pub stage_state: StageState,
    pub owner_available: bool,
    pub setting_supported: bool,
}

/// The frozen truth table of 09 §7.1, pinned by
/// `suite/configuration/cases/resolution-cases.json`.
pub fn reconcile(inputs: ReconciliationInputs<'_>) -> ReconciliationStatus {
    if !inputs.setting_supported {
        return ReconciliationStatus::Unsupported;
    }
    if !inputs.owner_available {
        return ReconciliationStatus::Blocked;
    }
    if matches!(
        inputs.stage_state,
        StageState::Prepared | StageState::Previewed | StageState::Discardable
    ) {
        return ReconciliationStatus::Pending;
    }
    let Some(desired) = inputs.desired else {
        return ReconciliationStatus::Satisfied;
    };
    // The owner's effective fact wins; declared is the honest fallback
    // where effective is absent (09 §7.1). Absence of both is `unknown` —
    // never guessed, never fabricated.
    let Some(native) = inputs.native_effective.or(inputs.native_declared) else {
        return ReconciliationStatus::Unknown;
    };
    if native == desired {
        ReconciliationStatus::Satisfied
    } else {
        ReconciliationStatus::Drifted
    }
}
