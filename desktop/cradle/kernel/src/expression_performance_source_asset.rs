//! Complete original and projected native producer source in existing Act/file
//! asset custody. This value has no location, writer, clock or independent store.
//! Only the current native producer can replay its semantics and admit playback.
use crate::expression::{Availability, ReadingRef};
use crate::expression_performance::{
    ContextBinding, Identity, PerformanceBasis, MAX_PERFORMANCE_BYTES,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};

#[path = "expression_performance_acoustic_source.rs"]
mod acoustic_source;
#[path = "expression_performance_physical_source.rs"]
mod physical_source;

pub const SCHEMA: &str = "oi.expression-performance-source-asset/v1";

/// This native producer uses `constructor` as a literal source-route tag,
/// never an executable or a JavaScript object constructor. Keep its complete
/// payload, while admitting no other use of that key through file/Act custody.
pub(crate) fn native_constructor_metadata(object: &serde_json::Map<String, Value>) -> bool {
    const KEYS: [&str; 9] = [
        "schema",
        "constructor",
        "world_request",
        "identity_profile",
        "natal",
        "sky",
        "original_occasion",
        "calibration",
        "return_context",
    ];
    (object.len() == KEYS.len()
        || (object.len() == KEYS.len() + 1
            && object
                .get("acoustic_receiving")
                .is_some_and(Value::is_object)))
        && KEYS.iter().all(|key| object.contains_key(*key))
        && object["schema"] == "ql.native-performance-receiving-source-inputs/v1"
        && object["constructor"].as_str().is_some_and(|tag| {
            [
                "native-world",
                "native-protected",
                "explicit-reference-world",
            ]
            .contains(&tag)
        })
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct NativePerformanceSourceAsset {
    schema: String,
    basis_digest: String,
    identity: Identity,
    context: ContextBinding,
    native_bundle: Value,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    native_physical_source_history: Option<Vec<Value>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    native_acoustic_source_history: Option<Vec<Value>>,
}
impl NativePerformanceSourceAsset {
    /// The existing native worker lease passes the ACTUAL PerformanceOwner
    /// output and its independently bound Return. A browser receipt is not
    /// qualified by this structural constructor or a content hash.
    pub fn from_native(basis: &PerformanceBasis, native_bundle: Value) -> Result<Self, String> {
        Self::from_native_with_physical_history(basis, native_bundle, None)
    }
    /// Complete actual owner artifact, reached by the existing qualified source
    /// channel. This structural constructor alone confers no native authority.
    pub(crate) fn from_native_artifact(
        basis: &PerformanceBasis,
        artifact: &Value,
    ) -> Result<Self, String> {
        if artifact["schema"] != "ql.retained-source-performance-fixture/v1" {
            return Err("actual native source artifact contract absent".into());
        }
        let bundle = artifact
            .get("source_assets")
            .filter(|v| v.is_object())
            .ok_or("actual complete native source bundle absent")?;
        let history = artifact.get("native_physical_source_history");
        let acoustic = artifact.get("native_acoustic_source_history");
        // Count both borrowed payloads before any potentially large clone.
        crate::expression_act_storage::measure(
            &(bundle, history, acoustic),
            MAX_PERFORMANCE_BYTES,
        )?;
        let history = history
            .map(|v| serde_json::from_value::<Vec<Value>>(v.clone()).map_err(|e| e.to_string()))
            .transpose()?;
        let acoustic = acoustic
            .map(|v| serde_json::from_value::<Vec<Value>>(v.clone()).map_err(|e| e.to_string()))
            .transpose()?;
        Self::from_native_with_source_histories(basis, bundle.clone(), history, acoustic)
    }
    pub fn from_native_with_physical_history(
        basis: &PerformanceBasis,
        native_bundle: Value,
        native_physical_source_history: Option<Vec<Value>>,
    ) -> Result<Self, String> {
        Self::from_native_with_source_histories(
            basis,
            native_bundle,
            native_physical_source_history,
            None,
        )
    }
    /// Complete separate original stopped body and acoustic applications.
    /// Structural retention is not native admission or currentness authority.
    pub fn from_native_with_source_histories(
        basis: &PerformanceBasis,
        native_bundle: Value,
        native_physical_source_history: Option<Vec<Value>>,
        native_acoustic_source_history: Option<Vec<Value>>,
    ) -> Result<Self, String> {
        basis.validate()?;
        let asset = Self {
            schema: SCHEMA.into(),
            basis_digest: basis.content_digest.clone(),
            identity: basis.identity.clone(),
            context: basis.context.clone(),
            native_bundle,
            native_physical_source_history,
            native_acoustic_source_history,
        };
        asset.validate_basis(basis)?;
        Ok(asset)
    }
    pub fn native_bundle(&self) -> &Value {
        &self.native_bundle
    }
    pub fn native_physical_source_history(&self) -> Option<&[Value]> {
        self.native_physical_source_history.as_deref()
    }
    pub fn native_acoustic_source_history(&self) -> Option<&[Value]> {
        self.native_acoustic_source_history.as_deref()
    }
    pub fn basis_digest(&self) -> &str {
        &self.basis_digest
    }
    pub fn private(&self) -> bool {
        self.context.private
    }
    pub fn requires_private_disclosure(&self) -> bool {
        self.context.private
            || self.native_bundle["source_context"]["availability"] != "available"
            || self.validate_source_payload().is_err()
            || physical_source::validate_history(
                &self.native_bundle,
                self.native_physical_source_history.as_deref(),
                true,
            )
            .is_err()
            || acoustic_source::validate_history(
                &self.native_bundle,
                self.native_acoustic_source_history.as_deref(),
                true,
            )
            .is_err()
    }
    pub fn reading(&self) -> Result<ReadingRef, String> {
        self.validate()?;
        // Same exact PerformancePart tagged envelope used by the native
        // catalog. An address identifies immutable bytes, never authority.
        #[derive(Serialize)]
        struct NativeSourcePart<'a> {
            kind: &'static str,
            value: &'a NativePerformanceSourceAsset,
        }
        let part = NativeSourcePart {
            kind: "native_source",
            value: self,
        };
        let reference = format!(
            "sha256:{:x}",
            Sha256::digest(serde_json::to_vec(&part).map_err(|e| e.to_string())?)
        );
        Ok(ReadingRef {
            r#ref: reference,
            revision: SCHEMA.into(),
            availability: Availability::Available,
        })
    }
    pub fn validate(&self) -> Result<(), String> {
        self.identity.validate()?;
        self.context.validate()?;
        crate::expression_performance::safe(&self.native_bundle, 0)?;
        if let Some(history) = &self.native_physical_source_history {
            for original in history {
                crate::expression_performance::safe(original, 0)?;
            }
        }
        if let Some(history) = &self.native_acoustic_source_history {
            for original in history {
                crate::expression_performance::safe(original, 0)?;
            }
        }
        if !self.basis_digest.strip_prefix("sha256:").is_some_and(|s| {
            s.len() == 64
                && s.bytes()
                    .all(|b| b.is_ascii_hexdigit() && !b.is_ascii_uppercase())
        }) {
            return Err("native source asset requires exact saved basis digest".into());
        }
        if self.schema != SCHEMA
            || self.native_bundle["schema"] != "ql.retained-performance-source-assets/v1"
            || !self.native_bundle["configuration"].is_object()
            || !self.native_bundle["consumer_roles"].is_object()
            || !self.native_bundle["native_basis"].is_object()
            || !self.native_bundle["original_native_input"].is_object()
            || !self.native_bundle["source_form_recipe"].is_object()
            || !self.native_bundle["source_geometry_reading"].is_object()
            || !self.native_bundle["physical_consumer_projection"].is_object()
            || !self
                .native_bundle
                .as_object()
                .is_some_and(|o| o.contains_key("source_key_preparation"))
            || self.native_bundle["configuration"]["schema"]
                != "ql.retained-source-performance-config/v1"
            || self.native_bundle["source_form_recipe"]
                != self.native_bundle["configuration"]["recipe"]
            || crate::expression_act_storage::measure(self, MAX_PERFORMANCE_BYTES)?
                > MAX_PERFORMANCE_BYTES
        {
            return Err("complete native performance source asset absent or excessive".into());
        }
        let bundle = &self.native_bundle;
        let roles = &bundle["consumer_roles"];
        if !roles["physical"].is_string()
            || !roles["legacy_mode_frequency_remapping"].is_string()
            || ["personal_nine_force_routes", "sky_ten_source_forcing"]
                .iter()
                .any(|name| {
                    let role = &roles[*name];
                    !role.as_object().is_some_and(|o| o.contains_key("reason"))
                        || match role["available"].as_bool() {
                            Some(true) => !role["reason"].is_null() && !role["reason"].is_string(),
                            Some(false) => role["reason"].as_str().is_none_or(str::is_empty),
                            None => true,
                        }
                })
            || bundle["configuration"]["sparse_condition"].is_null()
                != bundle["source_key_preparation"].is_null()
        {
            return Err(
                "native source lost explicit consumer roles or sparse source preparation".into(),
            );
        }
        physical_source::validate_bundle_projection(bundle)?;
        physical_source::validate_history(
            bundle,
            self.native_physical_source_history.as_deref(),
            false,
        )?;
        acoustic_source::validate_history(
            &self.native_bundle,
            self.native_acoustic_source_history.as_deref(),
            false,
        )?;
        Ok(())
    }
    /// Retention of unclassified opaque source is not public disclosure or
    /// current native playback authority. The receiving owner classifies ALL
    /// original receipts, binds their exact bytes, occasion and current refs.
    pub fn require_source_context(&self, basis: &PerformanceBasis) -> Result<(), String> {
        self.validate_basis(basis)?;
        self.validate_source_payload()?;
        physical_source::validate_history(
            &self.native_bundle,
            self.native_physical_source_history.as_deref(),
            true,
        )?;
        acoustic_source::validate_history(
            &self.native_bundle,
            self.native_acoustic_source_history.as_deref(),
            true,
        )?;
        let witness = &self.native_bundle["source_context"];
        if witness["schema"] != "ql.retained-performance-source-context/v1"
            || witness["availability"] != "available"
        {
            return Err("native original source context classification unavailable".into());
        }
        if witness["context"] != serde_json::to_value(&basis.context).map_err(|e| e.to_string())?
            || witness["original_occasion"] != basis.m4_episode.clone().unwrap_or(Value::Null)
            || !witness["currentness_refs"]
                .as_array()
                .is_some_and(|refs| !refs.is_empty())
        {
            return Err("native source context/occasion/currentness differs".into());
        }
        let original = &self.native_bundle["original_native_input"];
        let original_hash = format!(
            "sha256:{:x}",
            Sha256::digest(serde_json::to_vec(original).map_err(|e| e.to_string())?)
        );
        if witness["classified_original_input_sha256"] != original_hash {
            return Err("source owner classification binds other original native input".into());
        }
        let receipts = original["source_receipts"]
            .as_array()
            .ok_or("original receipts absent")?;
        let classifications = witness["classifications"]
            .as_array()
            .ok_or("original receipt classifications absent")?;
        if classifications.len() != receipts.len() {
            return Err("unclassified original native source receipt".into());
        }
        for (index, (receipt, classification)) in receipts.iter().zip(classifications).enumerate() {
            let hash = format!(
                "sha256:{:x}",
                Sha256::digest(serde_json::to_vec(receipt).map_err(|e| e.to_string())?)
            );
            if classification["receipt_index"] != serde_json::json!(index)
                || classification["receipt_sha256"] != hash
                || !classification["private"].is_boolean()
                || classification["source_owner_ref"]
                    .as_str()
                    .is_none_or(str::is_empty)
                || classification["source_owner_revision"]
                    .as_str()
                    .is_none_or(str::is_empty)
                || (!basis.context.private && classification["private"] != false)
            {
                return Err(
                    "original source receipt classification lost or private in World".into(),
                );
            }
        }
        for r in witness["currentness_refs"].as_array().unwrap() {
            let typed: ReadingRef = serde_json::from_value(r.clone()).map_err(|e| e.to_string())?;
            if typed.availability != Availability::Available
                || typed.r#ref.is_empty()
                || typed.revision.is_empty()
            {
                return Err("source owner classification currentness unavailable".into());
            }
        }
        Ok(())
    }
    // This checks retained integrity and disclosure completeness only. A full
    // independent native owner/lease replay remains mandatory before playback.
    fn validate_source_payload(&self) -> Result<(), String> {
        let bundle = self
            .native_bundle
            .as_object()
            .ok_or("native source bundle absent")?;
        let known = [
            "schema",
            "original_native_input",
            "physical_consumer_projection",
            "native_basis",
            "source_form_recipe",
            "source_geometry_reading",
            "source_key_preparation",
            "configuration",
            "source_context",
            "consumer_roles",
            "receiving_source_inputs",
            "receiving_definition",
            "current_receiving",
            "acoustic_receiving",
            "operative_native_input",
            "operative_physical_consumer_projection",
            "physical_transition_history",
            "acoustic_transition_history",
        ];
        if bundle.keys().any(|key| !known.contains(&key.as_str())) {
            return Err(
                "native source payload classification unavailable for additional retained fields"
                    .into(),
            );
        }
        let names = [
            "receiving_source_inputs",
            "receiving_definition",
            "current_receiving",
        ];
        if names.iter().all(|name| !bundle.contains_key(*name)) {
            return Ok(()); // Complete original Reference/World asset contract.
        }
        if names
            .iter()
            .any(|name| !bundle.get(*name).is_some_and(Value::is_object))
        {
            return Err(
                "complete native receiving source payload classification unavailable".into(),
            );
        }
        let current = &bundle["current_receiving"];
        let inputs = &bundle["receiving_source_inputs"];
        validate_receiving_snapshot(
            current,
            inputs,
            &bundle["source_context"],
            &bundle["receiving_definition"],
            &bundle["native_basis"],
            self.context.private,
        )?;
        if self.context.kind == crate::expression_performance::ContextKind::World
            && [
                "identity_profile",
                "natal",
                "sky",
                "original_occasion",
                "calibration",
            ]
            .iter()
            .any(|key| !inputs[*key].is_null())
        {
            return Err("neutral World cannot disclose protected native receiving inputs".into());
        }
        physical_source::validate_acoustic_payload(&self.native_bundle, self.context.private)?;
        Ok(())
    }
    pub(crate) fn context_readings(
        &self,
        basis: &PerformanceBasis,
    ) -> Result<Vec<ReadingRef>, String> {
        self.require_source_context(basis)?;
        serde_json::from_value(self.native_bundle["source_context"]["currentness_refs"].clone())
            .map_err(|e| e.to_string())
    }
    pub fn validate_basis(&self, basis: &PerformanceBasis) -> Result<(), String> {
        self.validate()?;
        basis.validate()?;
        // Full producer assets include receiving inputs and native owner sidecars.
        // An original-input-only guard cannot cover a protected occasion elsewhere.
        reject_episode_transfer(&self.native_bundle, basis)?;
        if let Some(history) = &self.native_physical_source_history {
            for original in history {
                reject_episode_transfer(original, basis)?;
            }
        }
        if let Some(history) = &self.native_acoustic_source_history {
            for original in history {
                reject_episode_transfer(original, basis)?;
            }
        }
        let native = &self.native_bundle["native_basis"];
        if self.basis_digest != basis.content_digest
            || self.identity != basis.identity
            || self.context != basis.context
            || native["m1"] != basis.m1
            || native["m3"] != basis.m3_score
            || !native["input"]["source_receipts"]
                .as_array()
                .is_some_and(|r| r.contains(&basis.m2_plan))
            || self.native_bundle["configuration"]["controls"]["sample_rate"]
                != basis.prepared_body["request"]["sample_rate"]
            || self.native_bundle["configuration"]["controls"]["expected_m3_generation"]
                != serde_json::json!(basis.identity.m3_generation.0)
        {
            return Err("native source asset detached from exact saved source/context/body".into());
        }
        Ok(())
    }
    /// The existing native producer recomputes from its original input/config
    /// and source registry. Compare that COMPLETE output before playback. A
    /// stale or missing source never becomes current by changing its digest.
    pub fn verify_native_replay(
        &self,
        basis: &PerformanceBasis,
        replayed: &Value,
    ) -> Result<(), String> {
        self.require_source_context(basis)?;
        if &self.native_bundle != replayed {
            return Err("native source/config/projection replay differs".into());
        }
        Ok(())
    }
}

// Shared retained-integrity check for body admission and receiver birth/segment.
// Each retains its own exact operation and payload hashes; dates are not merged.
fn validate_receiving_snapshot(
    current: &Value,
    inputs: &Value,
    source_context: &Value,
    definition: &Value,
    native_basis: &Value,
    private: bool,
) -> Result<(), String> {
    let witness = &current["source_payload_context"];
    let admission = &current["native_admission"];
    let exact_keys = |value: &Value, names: &[&str]| {
        value.as_object().is_some_and(|object| {
            object.len() == names.len() && names.iter().all(|name| object.contains_key(*name))
        })
    };
    if !exact_keys(
        current,
        &[
            "schema",
            "source_inputs",
            "source_context",
            "source_payload_context",
            "receiving_definition",
            "native_admission",
        ],
    ) || !inputs.as_object().is_some_and(native_constructor_metadata)
        || current["schema"] != "ql.current-performance-receiving/v1"
        || inputs["schema"] != "ql.native-performance-receiving-source-inputs/v1"
        || witness["schema"] != "ql.native-receiving-source-payload-context/v1"
        || current["source_inputs"] != *inputs
        || current["source_context"] != *source_context
        || current["receiving_definition"] != *definition
        || admission["schema"] != "ql.performance-receiving-admission/v1"
        || admission["receiving_definition"] != *definition
        || admission["native_basis"] != *native_basis
        || witness["private"].as_bool() != Some(private)
        || !admission["native_preparation"].is_object()
    {
        return Err("native receiving source payload/context/admission lost or changed".into());
    }
    for (name, value) in [
        ("source_inputs_sha256", inputs),
        ("source_context_sha256", &current["source_context"]),
        ("native_admission_sha256", admission),
    ] {
        let actual = format!(
            "sha256:{:x}",
            Sha256::digest(serde_json::to_vec(value).map_err(|e| e.to_string())?)
        );
        if witness[name] != actual {
            return Err("native receiving complete payload binding differs".into());
        }
    }
    let owner: ReadingRef =
        serde_json::from_value(witness["owner"].clone()).map_err(|e| e.to_string())?;
    if owner.availability != Availability::Available
        || owner.r#ref != "crates/ql-mef/src/continuous/performance_receiving.rs"
        || !owner.revision.strip_prefix("sha256:").is_some_and(|v| {
            v.len() == 64
                && v.bytes()
                    .all(|b| b.is_ascii_hexdigit() && !b.is_ascii_uppercase())
        })
        || witness["standing"].as_str().is_none_or(str::is_empty)
    {
        return Err("native receiving source payload owner unavailable".into());
    }
    Ok(())
}

// This identifies the native occasion structure by its complete required
// custody fields, not by a private/public label. Opaque data still requires
// require_source_context; passing this guard does not classify unknown bytes.
fn reject_episode_transfer(value: &Value, basis: &PerformanceBasis) -> Result<(), String> {
    match value {
        Value::Object(object) => {
            if [
                "occasion_ref",
                "subject_id",
                "event",
                "protected_state_ref",
                "identity_revision",
                "personal_reception_generation",
            ]
            .iter()
            .all(|key| object.contains_key(*key))
                && (!basis.context.private || basis.m4_episode.as_ref() != Some(value))
            {
                return Err(
                    "original native source contains another protected occasion/context".into(),
                );
            }
            for child in object.values() {
                reject_episode_transfer(child, basis)?;
            }
        }
        Value::Array(items) => {
            for child in items {
                reject_episode_transfer(child, basis)?;
            }
        }
        _ => {}
    }
    Ok(())
}
