//! The redaction law (09 §14): secret-kind settings are represented only as
//! `secret_reference`; `value` must be absent in every O:I-owned document.
//! Validation rejects a document that carries material for a secret-kind
//! setting — plaintext secrets never appear in profiles, ChangeSets,
//! receipts, resolutions, exports or logs.

use crate::configuration::changeset::ChangeSet;
use crate::configuration::contribution::{ContributionRegistry, ValueKind};
use crate::configuration::profile::Profile;
use crate::configuration::resolution::Resolution;

fn secret_kind(registry: &ContributionRegistry, setting_ref: &str) -> Option<ValueKind> {
    registry
        .lookup(setting_ref)
        .map(|entry| entry.spec.value_schema.kind)
}

/// Validate a profile's desired entries against the contributions' value
/// kinds: no material for a secret-kind setting; no stray secret reference
/// on an ordinary setting; every non-secret entry carries a value.
pub fn validate_profile(profile: &Profile, registry: &ContributionRegistry) -> Result<(), String> {
    profile.validate()?;
    for entry in &profile.desired {
        let Some(kind) = secret_kind(registry, &entry.setting_ref) else {
            return Err(format!(
                "`{}` resolves to no contributed setting; profiles reference contributions, they do not invent settings",
                entry.setting_ref
            ));
        };
        match kind {
            ValueKind::Secret => {
                if entry.value.is_some() {
                    return Err(format!(
                        "redaction: `{}` is secret-kind and must not carry `value` in a profile",
                        entry.setting_ref
                    ));
                }
                if entry.secret_reference.is_none() {
                    return Err(format!(
                        "`{}` is secret-kind and must carry `secret_reference`",
                        entry.setting_ref
                    ));
                }
            }
            _ => {
                if entry.secret_reference.is_some() {
                    return Err(format!(
                        "`{}` is not secret-kind; `secret_reference` belongs to secret-kind settings only",
                        entry.setting_ref
                    ));
                }
                if entry.value.is_none() {
                    return Err(format!(
                        "`{}` carries neither `value` nor a secret reference",
                        entry.setting_ref
                    ));
                }
            }
        }
    }
    Ok(())
}

/// Validate a ChangeSet's requested entries against the contributions'
/// value kinds.
pub fn validate_changeset(
    changeset: &ChangeSet,
    registry: &ContributionRegistry,
) -> Result<(), String> {
    changeset.validate()?;
    for requested in &changeset.requested {
        let Some(kind) = secret_kind(registry, &requested.setting_ref) else {
            return Err(format!(
                "`{}` resolves to no contributed setting",
                requested.setting_ref
            ));
        };
        match kind {
            ValueKind::Secret => {
                if requested.value.is_some() {
                    return Err(format!(
                        "redaction: `{}` is secret-kind and must not carry `value` in a ChangeSet",
                        requested.setting_ref
                    ));
                }
                if requested.secret_reference.is_none() {
                    return Err(format!(
                        "`{}` is secret-kind and must carry `secret_reference`",
                        requested.setting_ref
                    ));
                }
            }
            _ => {
                if requested.secret_reference.is_some() {
                    return Err(format!(
                        "`{}` is not secret-kind; `secret_reference` belongs to secret-kind settings only",
                        requested.setting_ref
                    ));
                }
            }
        }
    }
    Ok(())
}

/// Validate a resolution's desired block against the contributions' value
/// kinds.
pub fn validate_resolution(
    resolution: &Resolution,
    registry: &ContributionRegistry,
) -> Result<(), String> {
    if resolution.schema != crate::configuration::resolution::RESOLUTION_SCHEMA {
        return Err(format!(
            "unsupported_schema: expected `{}`, found `{}`",
            crate::configuration::resolution::RESOLUTION_SCHEMA,
            resolution.schema
        ));
    }
    let Some(desired) = &resolution.desired else {
        return Ok(());
    };
    let Some(kind) = secret_kind(registry, &resolution.setting_ref) else {
        return Err(format!(
            "`{}` resolves to no contributed setting",
            resolution.setting_ref
        ));
    };
    match kind {
        ValueKind::Secret => {
            if desired.value.is_some() {
                return Err(format!(
                    "redaction: `{}` is secret-kind and must not carry `value` in a resolution",
                    resolution.setting_ref
                ));
            }
        }
        _ => {
            if desired.secret_reference.is_some() {
                return Err(format!(
                    "`{}` is not secret-kind; `secret_reference` belongs to secret-kind settings only",
                    resolution.setting_ref
                ));
            }
        }
    }
    Ok(())
}
