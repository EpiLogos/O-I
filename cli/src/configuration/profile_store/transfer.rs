//! Profile export/import (09 §12 portability law): export is the same
//! `oi.profile/v1` document — machine- and world-specific references
//! (native profile refs, scope refs) travel as references; import
//! validates and stores the document as inspectable desired state and
//! never applies anything. A ChangeSet for imported state is planned
//! separately by the kernel.

use crate::configuration::contribution::ContributionRegistry;
use crate::configuration::profile::Profile;
use crate::configuration::profile_store::store::ProfileStore;
use crate::configuration::profile_store::StoreError;
use crate::configuration::redaction;
use serde_json::{Map, Value};

/// Export one stored profile as its `oi.profile/v1` document: the same
/// document the store holds, unknown fields intact. Secret-safety is by
/// construction — the store never accepts material for a secret-kind
/// entry — and when a registry is supplied the redaction law (09 §14) is
/// re-checked before anything leaves the store.
pub fn export_document(
    store: &ProfileStore,
    profile_ref: &str,
    registry: Option<&ContributionRegistry>,
) -> Result<Value, StoreError> {
    let document = store.load_value(profile_ref)?;
    if let Some(registry) = registry {
        let profile: Profile = serde_json::from_value(document.clone())
            .map_err(|error| StoreError::InvalidJson(error.to_string()))?;
        redaction::validate_profile(&profile, registry).map_err(StoreError::Invalid)?;
    }
    Ok(document)
}

/// Import an `oi.profile/v1` document into the store as inspectable
/// desired state (09 §12: "Import must not be a hidden apply"). The
/// document is validated — structurally always, against the redaction law
/// too when a registry is supplied — checked against the never-overwrite
/// law, stamped with import provenance, and stored verbatim otherwise
/// (unknown fields included; rebinding targets such as `native_profile_ref`
/// and scope refs are preserved as references, untouched).
///
/// Nothing is applied, nothing is activated: composition.json is not read
/// or written, and no owner is contacted.
///
/// `source_ref` records where the document came from (a path, URI or other
/// stable label of the importer's choosing). When it is `None` and the
/// document already carries `provenance.imported_from_ref`, that value is
/// kept.
pub fn import_document(
    store: &ProfileStore,
    document: &Value,
    source_ref: Option<&str>,
    registry: Option<&ContributionRegistry>,
) -> Result<Profile, StoreError> {
    let profile: Profile = serde_json::from_value(document.clone()).map_err(|error| {
        StoreError::InvalidJson(format!(
            "document does not parse as {}: {error}",
            crate::configuration::profile::PROFILE_SCHEMA
        ))
    })?;
    profile.validate().map_err(StoreError::Invalid)?;
    if let Some(registry) = registry {
        redaction::validate_profile(&profile, registry).map_err(StoreError::Invalid)?;
    }
    if store.exists(&profile.profile_ref)? {
        return Err(StoreError::AlreadyExists(profile.profile_ref.clone()));
    }

    // Import provenance is recorded as data; every other field — desired
    // entries, native-profile references, scopes, unknown future fields —
    // travels untouched.
    let mut stored = document.clone();
    let object = stored
        .as_object_mut()
        .ok_or_else(|| StoreError::InvalidJson("profile document must be a JSON object".into()))?;
    let provenance = object
        .entry("provenance".to_owned())
        .or_insert_with(|| Value::Object(Map::new()));
    let provenance = provenance
        .as_object_mut()
        .ok_or_else(|| StoreError::Invalid("provenance must be an object".into()))?;
    provenance.insert(
        "authored_by".to_owned(),
        Value::String("imported".to_owned()),
    );
    let imported_from = match source_ref {
        Some(source) => Some(source.to_owned()),
        None => provenance
            .get("imported_from_ref")
            .and_then(Value::as_str)
            .map(str::to_owned),
    };
    provenance.insert(
        "imported_from_ref".to_owned(),
        imported_from.map_or(Value::Null, Value::String),
    );

    store.save_value(&stored, registry)
}
