//! The `oi.configuration-contribution/v1` document (09 §2): what an owner —
//! product, connector, or the O:I composition layer — discloses as
//! addressable by the composed World. Complementary to the v2 disclosure
//! plane: a contribution never carries declared/effective/active values.

use crate::configuration::refs::parse_setting_ref;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

pub const CONTRIBUTION_SCHEMA: &str = "oi.configuration-contribution/v1";
pub const CONTRIBUTION_CONTRACT_REVISION: &str = "configuration-plane/contribution.1";

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct Contribution {
    pub schema: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub contract_revision: Option<String>,
    pub owner: OwnerBlock,
    pub about: String,
    #[serde(default)]
    pub sections: Vec<Section>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub operations: Option<OwnerOperations>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub availability: Option<Availability>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub degradations: Option<Vec<Degradation>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub obligations: Option<Vec<String>>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct OwnerBlock {
    pub owner_ref: String,
    pub owner_kind: OwnerKind,
    pub owner_version: String,
    pub contribution_command: Vec<String>,
    pub disclosed_at_unix_ms: u64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reading_digest: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reading_digest_covers: Option<String>,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum OwnerKind {
    Product,
    Connector,
    Oi,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct Section {
    pub id: String,
    pub title: String,
    #[serde(default)]
    pub settings: Vec<SettingSpec>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct SettingSpec {
    pub setting_ref: String,
    pub section_ref: String,
    pub title: String,
    #[serde(default)]
    pub description: String,
    pub value_schema: ValueSchema,
    pub allowed_scopes: Vec<AllowedScope>,
    pub writable: bool,
    pub profileable: bool,
    pub sensitive: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub default: Option<serde_json::Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub default_semantics: Option<DefaultSemantics>,
    pub effect: Effect,
    pub operations: SettingOperations,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub native_ref: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct AllowedScope {
    pub scope_kind: crate::configuration::refs::ScopeKind,
    /// `null` = any instance of this kind.
    pub scope_ref: Option<String>,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DefaultSemantics {
    Constant,
    Computed,
    None,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct ValueSchema {
    #[serde(rename = "type")]
    pub kind: ValueKind,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub options: Option<Vec<EnumOption>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub columns: Option<Vec<TableColumn>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub items: Option<Box<ValueSchema>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub minimum: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub maximum: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pattern: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub format: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub subject_kind: Option<String>,
}

/// The frozen value-schema kinds (09 §2.3). Unknown kinds make the document
/// invalid at this revision — a contribution is an operability contract;
/// consumers must know they can operate, not merely render.
#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ValueKind {
    Boolean,
    Scalar,
    Number,
    Integer,
    Enum,
    Path,
    Reference,
    Table,
    List,
    Secret,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct EnumOption {
    pub value: serde_json::Value,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct TableColumn {
    pub name: String,
    #[serde(rename = "type")]
    pub kind: String,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct Effect {
    pub kind: EffectKind,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub summary: Option<String>,
    #[serde(rename = "ref", default, skip_serializing_if = "Option::is_none")]
    pub ref_: Option<String>,
}

/// The frozen expected-effect vocabulary (09 §11).
#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum EffectKind {
    None,
    ValueChange,
    RestartRequired,
    SessionRestartRequired,
    ProviderReconnectRequired,
    MaterialEffect,
    Pending,
    Unknown,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct SettingOperations {
    pub validate: bool,
    pub plan: bool,
    pub apply: bool,
    pub reset: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct OwnerOperations {
    pub transport: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub validate: Option<OperationAvailability>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub plan: Option<OperationAvailability>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub apply: Option<OperationAvailability>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reset: Option<OperationAvailability>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct OperationAvailability {
    pub availability: OperationAvailabilityState,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum OperationAvailabilityState {
    Disclosed,
    MissingNativeObligation,
    Unavailable,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct Availability {
    pub state: AvailabilityState,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AvailabilityState {
    Available,
    Degraded,
    Unavailable,
    Unknown,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct Degradation {
    pub subject_ref: Option<String>,
    pub state: DegradationState,
    pub reason: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub native_error: Option<String>,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DegradationState {
    Degraded,
    Unavailable,
    Unknown,
}

impl Contribution {
    /// The contribution-local laws of 09 §2: identity, section agreement,
    /// default law, operation/writability agreement, owner-kind agreement.
    /// Unknown fields are tolerated (09 §15); structural contradictions are
    /// not.
    pub fn validate(&self) -> Result<(), String> {
        if self.schema != CONTRIBUTION_SCHEMA {
            return Err(format!(
                "unsupported_schema: expected `{CONTRIBUTION_SCHEMA}`, found `{}`",
                self.schema
            ));
        }
        if let Some(revision) = &self.contract_revision {
            if revision != CONTRIBUTION_CONTRACT_REVISION {
                return Err(format!(
                    "unsupported_schema: contract revision `{revision}` is not {CONTRIBUTION_CONTRACT_REVISION}"
                ));
            }
        }
        let (is_connector, owner_name) = match self.owner.owner_ref.strip_prefix("connector/") {
            Some(name) => (true, name),
            None => (false, self.owner.owner_ref.as_str()),
        };
        if !is_label(owner_name) {
            return Err(format!(
                "owner_ref `{}` violates the namespace grammar",
                self.owner.owner_ref
            ));
        }
        let expected_kind = match (is_connector, owner_name) {
            (true, _) => OwnerKind::Connector,
            (false, "oi") => OwnerKind::Oi,
            (false, _) => OwnerKind::Product,
        };
        if self.owner.owner_kind != expected_kind {
            return Err(format!(
                "owner_ref `{}` implies owner kind {expected_kind:?}, document declares {:?}",
                self.owner.owner_ref, self.owner.owner_kind
            ));
        }
        if self.owner.contribution_command.is_empty() {
            return Err("owner.contribution_command must name the disclosing command".to_owned());
        }
        for section in &self.sections {
            if !is_label(&section.id) {
                return Err(format!("section id `{}` violates the grammar", section.id));
            }
            for setting in &section.settings {
                validate_setting(self, section, setting)?;
            }
        }
        if let Some(operations) = &self.operations {
            if operations.transport != "cli/v1" {
                return Err(format!(
                    "unsupported_schema: operations transport `{}` is not `cli/v1`",
                    operations.transport
                ));
            }
        }
        Ok(())
    }

    /// The owner kind this contribution's refs imply, for registry use.
    pub fn owner_kind(&self) -> OwnerKind {
        self.owner.owner_kind
    }
}

/// Mirror of [`OwnerKind`] used where only the marker distinction
/// (connector prefix) is needed without the full contribution.
pub mod marker {
    pub type Marker = crate::configuration::contribution::OwnerKind;
}

fn validate_setting(
    contribution: &Contribution,
    section: &Section,
    setting: &SettingSpec,
) -> Result<(), String> {
    let parts = parse_setting_ref(&setting.setting_ref)
        .map_err(|error| format!("{}: {}", setting.setting_ref, error.message()))?;
    let setting_owner = if parts.is_connector {
        format!("connector/{}", parts.owner_ref)
    } else {
        parts.owner_ref.clone()
    };
    if setting_owner != contribution.owner.owner_ref {
        return Err(format!(
            "`{}` lives under owner `{}` but this contribution is `{}`",
            setting.setting_ref, setting_owner, contribution.owner.owner_ref
        ));
    }
    if parts.section_ref != setting.section_ref {
        return Err(format!(
            "`{}` carries section_ref `{}` but sits in section `{}`",
            setting.setting_ref, setting.section_ref, section.id
        ));
    }
    if parts.section_ref != section.id {
        return Err(format!(
            "`{}` names section `{}` but is disclosed in `{}`",
            setting.setting_ref, parts.section_ref, section.id
        ));
    }
    // Default law (09 §2.2): `default` may appear only when
    // `default_semantics` is `constant`. Computed defaults are never cached
    // by O:I — a copied native default is a forbidden storage class.
    if setting.default.is_some() && setting.default_semantics != Some(DefaultSemantics::Constant) {
        return Err(format!(
            "`{}` carries `default` with default_semantics `{:?}`; only `constant` may disclose a default",
            setting.setting_ref, setting.default_semantics
        ));
    }
    // Operation/writability agreement: nothing may be planned, applied or
    // reset behind O:I for a setting the owner does not declare writable.
    if !setting.writable
        && (setting.operations.plan || setting.operations.apply || setting.operations.reset)
    {
        return Err(format!(
            "`{}` is not writable but declares plan/apply/reset capabilities",
            setting.setting_ref
        ));
    }
    // Value-schema kind restrictions.
    match setting.value_schema.kind {
        ValueKind::Enum => {
            if setting
                .value_schema
                .options
                .as_ref()
                .is_none_or(|o| o.is_empty())
            {
                return Err(format!(
                    "`{}` is enum-valued but discloses no options",
                    setting.setting_ref
                ));
            }
        }
        ValueKind::Table => {
            if setting
                .value_schema
                .columns
                .as_ref()
                .is_none_or(|c| c.is_empty())
            {
                return Err(format!(
                    "`{}` is a table but discloses no columns",
                    setting.setting_ref
                ));
            }
        }
        ValueKind::List if setting.value_schema.items.is_none() => {
            return Err(format!(
                "`{}` is a list but discloses no item schema",
                setting.setting_ref
            ));
        }
        _ => {}
    }
    for allowed in &setting.allowed_scopes {
        if let Some(reference) = &allowed.scope_ref {
            if reference.is_empty() {
                return Err(format!(
                    "`{}` allows scope `{}` with an empty scope_ref",
                    setting.setting_ref,
                    allowed.scope_kind.as_wire()
                ));
            }
        }
    }
    Ok(())
}

fn is_label(raw: &str) -> bool {
    let mut chars = raw.chars();
    match chars.next() {
        Some(first) if first.is_ascii_digit() || first.is_ascii_lowercase() => {}
        _ => return false,
    }
    chars.all(|c| c.is_ascii_digit() || c.is_ascii_lowercase() || c == '-')
}

/// A registry of every setting reachable from a set of contributions — the
/// smallest thing lanes need to resolve refs, scopes and secret law without
/// a kernel (the C1 kernel grows this, it does not replace it).
pub struct ContributionRegistry {
    settings: BTreeMap<String, RegisteredSetting>,
}

pub struct RegisteredSetting {
    pub spec: SettingSpec,
}

impl Default for ContributionRegistry {
    fn default() -> Self {
        Self::new()
    }
}

impl ContributionRegistry {
    pub fn new() -> Self {
        Self {
            settings: BTreeMap::new(),
        }
    }

    pub fn register(&mut self, contribution: &Contribution) -> Result<(), String> {
        contribution.validate()?;
        for section in &contribution.sections {
            for setting in &section.settings {
                if self.settings.contains_key(&setting.setting_ref) {
                    return Err(format!(
                        "`{}` contributed twice; stable identity is unique",
                        setting.setting_ref
                    ));
                }
                self.settings.insert(
                    setting.setting_ref.clone(),
                    RegisteredSetting {
                        spec: setting.clone(),
                    },
                );
            }
        }
        Ok(())
    }

    pub fn lookup(&self, setting_ref: &str) -> Option<&RegisteredSetting> {
        self.settings.get(setting_ref)
    }

    /// Decide scope support explicitly (09 §5): a setting addressed outside
    /// its `allowed_scopes` is `unsupported_scope`, never a fallback.
    pub fn scope_decision(
        &self,
        setting_ref: &str,
        scope: &crate::configuration::refs::Scope,
    ) -> crate::configuration::refs::ScopeDecision {
        use crate::configuration::refs::ScopeDecision;
        let Some(entry) = self.settings.get(setting_ref) else {
            return ScopeDecision::UnsupportedScope;
        };
        let scope_ref = scope.scope_ref.as_deref();
        if !scope.scope_kind.is_singular() && scope_ref.is_none() {
            return ScopeDecision::UnsupportedScope;
        }
        for allowed in &entry.spec.allowed_scopes {
            if allowed.scope_kind != scope.scope_kind {
                continue;
            }
            match (&allowed.scope_ref, scope_ref) {
                (None, _) => return ScopeDecision::Supported,
                (Some(pattern), Some(actual)) if pattern == actual => {
                    return ScopeDecision::Supported;
                }
                _ => {}
            }
        }
        ScopeDecision::UnsupportedScope
    }
}
