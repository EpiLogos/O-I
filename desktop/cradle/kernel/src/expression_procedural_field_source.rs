//! Complete held FIELD source in existing native Scene/Edition asset custody.
//! The existing page codec bounds every expanded part. No musical performance,
//! new store, second clock or public source admission is created by these bytes.
use crate::expression_procedural_source_budget as expression_act_storage;
use crate::expression_procedural_source_budget::{digest, digest_ref, FILE_BYTES};
use crate::expression_procedural_source_codec::{EncodedPage, MAX_DECODED_BYTES};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::BTreeSet;
use std::sync::OnceLock;

pub const SCHEMA: &str = "oi.expression-native-field-source/v1";
const NATIVE_SCHEMA: &str = "ql.native-held-field-source/v1";
const PART_SAMPLES: usize = 512;
// Existing FieldHost/field_worker protocol bounds, not a new instrument cap.
const FIELD_SAMPLES: usize = 65_536;
const SHAPE_VALUES: usize = 262_144;

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
struct SamplePart {
    first: u32,
    count: u16,
    encoded: EncodedPage,
}
/// Saved source data only; imported bytes cannot mint a native Act/Field lease.
/// Complete immutable encoded parts live in the existing Scene metadata and
/// are deduplicated by the existing indexed Act Edition scene_part owner.
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct NativeFieldSource {
    schema: String,
    instance_ref: String,
    canonical_source_sha256: String,
    canonical_source_bytes: u32,
    sample_count: u32,
    header: EncodedPage,
    sample_parts: Vec<SamplePart>,
    #[serde(skip)]
    canonical: OnceLock<()>,
}
impl PartialEq for NativeFieldSource {
    fn eq(&self, other: &Self) -> bool {
        self.schema == other.schema
            && self.instance_ref == other.instance_ref
            && self.canonical_source_sha256 == other.canonical_source_sha256
            && self.canonical_source_bytes == other.canonical_source_bytes
            && self.sample_count == other.sample_count
            && self.header == other.header
            && self.sample_parts == other.sample_parts
    }
}
impl Eq for NativeFieldSource {}
fn source_fingerprint(source: &Value) -> Result<(usize, String), String> {
    let count = expression_act_storage::measure(source, expression_act_storage::LIVE_BYTES)?;
    let bytes = serde_json::to_vec(source).map_err(|e| e.to_string())?;
    Ok((count, digest(&bytes)))
}
fn bounded(text: &str) -> Result<(), String> {
    if text.is_empty() || text.len() > 4096 || text.chars().any(char::is_control) {
        return Err("native FIELD source reference unavailable or unbounded".into());
    }
    Ok(())
}
fn source_header(source: &Value) -> Result<(Value, &[Value]), String> {
    let object = source
        .as_object()
        .ok_or("native held FIELD source absent")?;
    const KEYS: [&str; 5] = [
        "schema",
        "instance_ref",
        "original_basis",
        "current_basis",
        "original_field",
    ];
    if object.len() != KEYS.len()
        || KEYS.iter().any(|key| !object.contains_key(*key))
        || source["schema"] != NATIVE_SCHEMA
    {
        return Err("complete original/current native FIELD source contract differs".into());
    }
    bounded(
        source["instance_ref"]
            .as_str()
            .ok_or("native FIELD instance absent")?,
    )?;
    let field = source["original_field"]
        .as_object()
        .ok_or("original FIELD input absent")?;
    let samples = field
        .get("samples")
        .and_then(Value::as_array)
        .ok_or("complete original FIELD samples absent")?;
    let modes = field
        .get("audio_gains")
        .and_then(Value::as_array)
        .ok_or("original FIELD mode gains absent")?
        .len();
    if modes == 0
        || modes > 4096
        || samples.is_empty()
        || samples.len() > FIELD_SAMPLES
        || samples.len() > SHAPE_VALUES / modes
    {
        return Err("original native FIELD sample/shape budget differs".into());
    }
    struct WithoutSamples<'a>(&'a serde_json::Map<String, Value>);
    impl Serialize for WithoutSamples<'_> {
        fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
            use serde::ser::SerializeMap;
            let mut map = serializer.serialize_map(Some(self.0.len() - 1))?;
            for (key, value) in self.0.iter().filter(|(key, _)| key.as_str() != "samples") {
                map.serialize_entry(key, value)?;
            }
            map.end()
        }
    }
    struct Header<'a>(
        &'a serde_json::Map<String, Value>,
        &'a serde_json::Map<String, Value>,
    );
    impl Serialize for Header<'_> {
        fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
            use serde::ser::SerializeMap;
            let mut map = serializer.serialize_map(Some(self.0.len()))?;
            for (key, value) in self.0 {
                if key == "original_field" {
                    map.serialize_entry(key, &WithoutSamples(self.1))?;
                } else {
                    map.serialize_entry(key, value)?;
                }
            }
            map.end()
        }
    }
    expression_act_storage::measure(&Header(object, field), MAX_DECODED_BYTES)?;
    // Copy only the preflighted bounded header, never the full 65k sample array.
    let fields = field
        .iter()
        .filter(|(key, _)| key.as_str() != "samples")
        .map(|(key, value)| (key.clone(), value.clone()))
        .collect();
    let mut header = source
        .as_object()
        .unwrap()
        .iter()
        .filter(|(key, _)| key.as_str() != "original_field")
        .map(|(key, value)| (key.clone(), value.clone()))
        .collect::<serde_json::Map<_, _>>();
    header.insert("original_field".into(), Value::Object(fields));
    Ok((Value::Object(header), samples))
}
fn sample_identity(sample: &Value, modes: usize) -> Result<u64, String> {
    const KEYS: [&str; 5] = [
        "identity",
        "constituent",
        "attachment",
        "rest_metres",
        "mode_shapes",
    ];
    let object = sample.as_object().ok_or("native FIELD sample absent")?;
    if object.len() != 5 || KEYS.iter().any(|key| !object.contains_key(*key)) {
        return Err("original native FIELD sample has missing or extra fields".into());
    }
    let identity = sample["identity"]
        .as_u64()
        .ok_or("native FIELD sample identity absent")?;
    bounded(
        sample["constituent"]
            .as_str()
            .ok_or("native FIELD constituent absent")?,
    )?;
    if sample["attachment"].as_u64().is_none_or(|n| n > 255) {
        return Err("native FIELD sample attachment differs".into());
    }
    let vector = |value: &Value| -> bool {
        value.as_array().is_some_and(|v| {
            v.len() == 3 && v.iter().all(|n| n.as_f64().is_some_and(f64::is_finite))
        })
    };
    if !vector(&sample["rest_metres"])
        || sample["mode_shapes"]
            .as_array()
            .is_none_or(|shapes| shapes.len() != modes || shapes.iter().any(|shape| !vector(shape)))
    {
        return Err("original native FIELD metric/shape array differs".into());
    }
    Ok(identity)
}
impl NativeFieldSource {
    /// Called only by the genuine selected native FIELD channel receiver.
    /// The actual owner/Scene/Act lease qualifies origin outside this data type.
    pub(crate) fn from_native_artifact(source: &Value) -> Result<Self, String> {
        let bytes = expression_act_storage::measure(source, expression_act_storage::LIVE_BYTES)?;
        let (header, samples) = source_header(source)?;
        expression_act_storage::measure(&header, MAX_DECODED_BYTES)?;
        let mut parts = Vec::with_capacity(samples.len().div_ceil(PART_SAMPLES));
        for (index, samples) in samples.chunks(PART_SAMPLES).enumerate() {
            parts.push(SamplePart {
                first: u32::try_from(index * PART_SAMPLES).map_err(|_| "FIELD offset overflow")?,
                count: u16::try_from(samples.len()).map_err(|_| "FIELD part count overflow")?,
                encoded: EncodedPage::from_value(samples)?,
            });
        }
        let data = Self {
            schema: SCHEMA.into(),
            instance_ref: source["instance_ref"].as_str().unwrap().into(),
            canonical_source_sha256: source_fingerprint(source)?.1,
            canonical_source_bytes: u32::try_from(bytes)
                .map_err(|_| "FIELD byte count overflow")?,
            sample_count: u32::try_from(samples.len())
                .map_err(|_| "FIELD sample count overflow")?,
            header: EncodedPage::from_value(&header)?,
            sample_parts: parts,
            canonical: OnceLock::new(),
        };
        // The existing file/Act cap remains exact; large sources fail honestly.
        expression_act_storage::measure(&data, FILE_BYTES)?;
        data.validate()?;
        Ok(data)
    }
    pub fn instance_ref(&self) -> &str {
        &self.instance_ref
    }
    pub fn sample_count(&self) -> usize {
        self.sample_count as usize
    }
    pub fn part_count(&self) -> usize {
        self.sample_parts.len()
    }
    pub fn source_digest(&self) -> &str {
        &self.canonical_source_sha256
    }
    pub fn canonical_header(&self) -> Result<Value, String> {
        self.header.read()
    }
    /// Exact existing codec bytes; field parts are never decoded by QL's own
    /// codec or reconstructed from a reduced geometry/continuation summary.
    pub fn sample_part(&self, index: usize) -> Result<Value, String> {
        let part = self
            .sample_parts
            .get(index)
            .ok_or("selected native FIELD part absent")?;
        let bytes = part.encoded.bytes()?;
        Ok(
            json!({"schema":"oi.expression-native-field-part/v1", "index":index,
            "first":part.first,"count":part.count,"original_encoded_part":part.encoded,
            "canonical_decoded_bytes":String::from_utf8(bytes.clone()).map_err(|e|e.to_string())?,
            "decoded_sha256":digest(&bytes),"decoded_length":bytes.len()}),
        )
    }
    pub fn validate(&self) -> Result<(), String> {
        bounded(&self.instance_ref)?;
        if self.schema != SCHEMA
            || !digest_ref(&self.canonical_source_sha256)
            || self.sample_count == 0
            || self.sample_count as usize > FIELD_SAMPLES
            || self.canonical_source_bytes == 0
            || self.canonical_source_bytes as usize > expression_act_storage::LIVE_BYTES
            || self.sample_parts.len() != (self.sample_count as usize).div_ceil(PART_SAMPLES)
        {
            return Err("native FIELD asset contract/count/byte bound differs".into());
        }
        expression_act_storage::measure(self, FILE_BYTES)?;
        if self.canonical.get().is_some() {
            return Ok(());
        }
        let header: Value = self.header.read()?;
        if header["schema"] != NATIVE_SCHEMA
            || header["instance_ref"] != self.instance_ref
            || header["original_field"].get("samples").is_some()
        {
            return Err(
                "native FIELD header changed instance or retained sample part contract".into(),
            );
        }
        let modes = header["original_field"]["audio_gains"]
            .as_array()
            .ok_or("original FIELD gains absent")?
            .len();
        if modes == 0 || modes > 4096 || self.sample_count as usize > SHAPE_VALUES / modes {
            return Err("native FIELD shape budget differs".into());
        }
        let mut expected = 0_usize;
        let mut identities = BTreeSet::new();
        for part in &self.sample_parts {
            let samples: Vec<Value> = part.encoded.read()?;
            if part.first as usize != expected
                || samples.len() != part.count as usize
                || samples.is_empty()
                || samples.len() != PART_SAMPLES.min(self.sample_count as usize - expected)
            {
                return Err("native FIELD source part missing, reordered or shortened".into());
            }
            for sample in &samples {
                if !identities.insert(sample_identity(sample, modes)?) {
                    return Err("original native FIELD sample identity duplicated".into());
                }
            }
            expected += samples.len();
        }
        if expected != self.sample_count as usize {
            return Err("complete native FIELD source sample count differs".into());
        }
        // Whole-source fingerprint uses the exact original existing JSON wire,
        // not a second structural digest/codec. Restore is bounded before clone.
        let source = self.restore_unchecked()?;
        if source_fingerprint(&source)?
            != (
                self.canonical_source_bytes as usize,
                self.canonical_source_sha256.clone(),
            )
        {
            return Err("complete original/current native FIELD source bytes differ".into());
        }
        source_header(&source)?;
        let _ = self.canonical.set(());
        Ok(())
    }
    fn restore_unchecked(&self) -> Result<Value, String> {
        if self.canonical_source_bytes as usize > expression_act_storage::LIVE_BYTES
            || self.sample_count as usize > FIELD_SAMPLES
            || self.sample_parts.len() > 128
        {
            return Err("native FIELD expansion exceeds existing bounded custody".into());
        }
        // Check the aggregate actual decoded part sizes BEFORE a full sample
        // array clone. Imported declared byte lengths cannot bypass live custody.
        let header_bytes = self.header.bytes()?;
        let mut expansion = header_bytes
            .len()
            .checked_add(13)
            .ok_or("native FIELD expansion overflow")?;
        for part in &self.sample_parts {
            expansion = expansion
                .checked_add(part.encoded.bytes()?.len())
                .ok_or("native FIELD expansion overflow")?;
            if expansion > expression_act_storage::LIVE_BYTES {
                return Err(
                    "native FIELD aggregate expansion exceeds live custody before clone".into(),
                );
            }
        }
        let mut source: Value = self.header.read()?;
        let mut samples = Vec::with_capacity(self.sample_count as usize);
        for part in &self.sample_parts {
            let chunk: Vec<Value> = part.encoded.read()?;
            if samples
                .len()
                .checked_add(chunk.len())
                .is_none_or(|n| n > self.sample_count as usize)
            {
                return Err("native FIELD part exceeds declared expansion before append".into());
            }
            samples.extend(chunk);
        }
        source["original_field"]["samples"] = Value::Array(samples);
        Ok(source)
    }
    /// Data restitution; live source/clock admission still requires full actual
    /// owner replay under the private selected Scene lease.
    pub fn restore(&self) -> Result<Value, String> {
        self.validate()?;
        self.restore_unchecked()
    }
    pub fn manifest(&self) -> Result<Value, String> {
        self.validate()?;
        let header = self.canonical_header()?;
        Ok(
            json!({"schema":"oi.expression-native-field-source-manifest/v1",
            "source_ref":digest(&serde_json::to_vec(self).map_err(|e|e.to_string())?),
            "instance_ref":self.instance_ref,"source_sha256":self.canonical_source_sha256,
            "source_bytes":self.canonical_source_bytes,"sample_count":self.sample_count,
            "part_count":self.sample_parts.len(),"header":header}),
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn actual() -> Value {
        let path = std::env::var_os("OI_NATIVE_DENSE_FIELD_SOURCE_ARTIFACT")
            .expect("mandatory genuine same native FieldHost 65000-source artifact");
        let bytes = std::fs::read(path).unwrap();
        assert!(bytes.len() <= expression_act_storage::LIVE_BYTES);
        let source: Value = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(source["schema"], NATIVE_SCHEMA);
        assert_eq!(
            source["original_field"]["samples"]
                .as_array()
                .unwrap()
                .len(),
            65000
        );
        source
    }
    #[test]
    fn genuine_full_field_source_roundtrips_all_65000_samples_under_existing_native_caps() {
        let source = actual();
        let data = NativeFieldSource::from_native_artifact(&source).unwrap();
        assert_eq!(data.restore().unwrap(), source);
        assert_eq!(data.sample_count(), 65000);
        assert_eq!(data.part_count(), 127);
        assert!(serde_json::to_vec(&data).unwrap().len() <= FILE_BYTES);
        let imported: NativeFieldSource =
            serde_json::from_slice(&serde_json::to_vec(&data).unwrap()).unwrap();
        assert_eq!(imported.restore().unwrap(), source);
        assert_eq!(imported, data);
    }
    #[test]
    fn genuine_source_parts_detect_prefix_loss_reorder_and_corrupted_original_bytes() {
        let data = NativeFieldSource::from_native_artifact(&actual()).unwrap();
        let mut bad = data.clone();
        bad.canonical = OnceLock::new();
        bad.sample_parts.remove(0);
        assert!(bad.validate().is_err());
        let mut bad = data.clone();
        bad.canonical = OnceLock::new();
        bad.sample_parts.swap(0, 1);
        assert!(bad.validate().is_err());
        let mut bad = serde_json::to_value(&data).unwrap();
        let payload = bad["sample_parts"][0]["encoded"]["payload"]
            .as_str()
            .unwrap()
            .to_owned();
        bad["sample_parts"][0]["encoded"]["payload"] = json!(format!("A{payload}"));
        let bad: NativeFieldSource = serde_json::from_value(bad).unwrap();
        assert!(bad.validate().is_err());
    }
    #[test]
    fn genuine_source_cannot_change_original_material_or_later_basis_with_retained_seal() {
        let data = NativeFieldSource::from_native_artifact(&actual()).unwrap();
        for pointer in [
            "/original_field/driver_numerator",
            "/current_basis/input/m3/stamp/identity/profile_generation",
        ] {
            let mut bad = data.clone();
            bad.canonical = OnceLock::new();
            let mut header = bad.canonical_header().unwrap();
            let slot = header
                .pointer_mut(pointer)
                .unwrap_or_else(|| panic!("genuine source omitted {pointer}"));
            let old = slot.clone();
            *slot = if old.is_string() {
                json!(format!("{}1", old.as_str().unwrap()))
            } else {
                json!(old.as_u64().unwrap() + 1)
            };
            assert_ne!(*slot, old);
            bad.header = EncodedPage::from_value(&header).unwrap();
            assert!(bad.validate().is_err());
        }
    }
}
