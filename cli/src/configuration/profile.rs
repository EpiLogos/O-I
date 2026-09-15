//! O:I profiles (09 §12–§13): a sparse composition of desired relations.
//! Native product profiles are held by reference; secret-kind entries carry
//! a secret reference and never a value. Persistence lives beside
//! `composition.json` in the O:I application-config home — never in
//! Central/Control (generated profile state must not become authored
//! Central source).

use serde::{Deserialize, Serialize};

pub const PROFILE_SCHEMA: &str = "oi.profile/v1";

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct Profile {
    pub schema: String,
    pub profile_ref: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub created_at_unix_ms: u64,
    pub revised_at_unix_ms: u64,
    #[serde(default)]
    pub native_profiles: Vec<NativeProfileRef>,
    #[serde(default)]
    pub desired: Vec<DesiredEntry>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub provenance: Option<ProfileProvenance>,
}

/// A reference into an owner's own profile namespace. Opaque to O:I: it is
/// compared, displayed, planned and routed — never interpreted or copied.
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct NativeProfileRef {
    pub owner_ref: String,
    pub native_profile_ref: String,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct DesiredEntry {
    pub setting_ref: String,
    pub scope: crate::configuration::refs::Scope,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub value: Option<serde_json::Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub secret_reference: Option<SecretReferenceValue>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct SecretReferenceValue {
    #[serde(rename = "ref")]
    pub ref_: String,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct ProfileProvenance {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub authored_by: Option<AuthoredBy>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes_ref: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub imported_from_ref: Option<String>,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AuthoredBy {
    Human,
    Oi,
    Imported,
}

/// The frozen persistence location of a profile: `$OI_HOME/profiles/<ref>.json`
/// (XDG default `~/.config/oi/profiles/`), beside `composition.json`.
/// Regular files only, 0600, atomic publish (09 §12); C2 implements the
/// store against this law.
pub fn profile_path(config_home: &std::path::Path, profile_ref: &str) -> std::path::PathBuf {
    config_home
        .join("profiles")
        .join(format!("{profile_ref}.json"))
}

impl Profile {
    /// Structural profile laws (09 §12): identity grammar, references only,
    /// sparse desired entries, and entry-level secret/value exclusivity.
    /// Cross-checks against contributions (ref resolution, scope support,
    /// secret-kind detection) live in [`crate::configuration::redaction`].
    pub fn validate(&self) -> Result<(), String> {
        if self.schema != PROFILE_SCHEMA {
            return Err(format!(
                "unsupported_schema: expected `{PROFILE_SCHEMA}`, found `{}`",
                self.schema
            ));
        }
        let mut chars = self.profile_ref.chars();
        let first_ok = matches!(
            chars.next(),
            Some(c) if c.is_ascii_digit() || c.is_ascii_lowercase()
        );
        if !first_ok || !chars.all(|c| c.is_ascii_digit() || c.is_ascii_lowercase() || c == '-') {
            return Err(format!(
                "profile_ref `{}` violates `[a-z0-9][a-z0-9-]*`",
                self.profile_ref
            ));
        }
        for native in &self.native_profiles {
            if native.owner_ref.starts_with("connector/") {
                // Connector owners may hold native profile references too.
            } else if native.owner_ref.is_empty() {
                return Err("native_profiles entry names no owner".to_owned());
            }
            if native.native_profile_ref.is_empty() {
                return Err(format!(
                    "native_profiles entry for `{}` names no native profile",
                    native.owner_ref
                ));
            }
        }
        for entry in &self.desired {
            crate::configuration::refs::parse_setting_ref(&entry.setting_ref)
                .map_err(|error| format!("`{}`: {}", entry.setting_ref, error.message()))?;
            entry
                .scope
                .validate()
                .map_err(|error| format!("`{}`: {}", entry.setting_ref, error.message()))?;
            if entry.value.is_some() && entry.secret_reference.is_some() {
                return Err(format!(
                    "`{}` carries both `value` and `secret_reference`; secret-kind settings carry the reference and never a value",
                    entry.setting_ref
                ));
            }
        }
        Ok(())
    }
}
