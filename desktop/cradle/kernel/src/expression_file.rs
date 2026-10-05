//! Lossless file encoding of the existing native Expression document. Exact
//! repeated embedded PNG payloads are stored once in this file; they are not
//! assets, semantic subjects, profile revisions or a second material service.
//! API/export Documents remain full. Decode expands before their ordinary
//! native validation and before a file can replace any working document.
use crate::expression::{Document, DOCUMENT_BYTES};
use serde::{Deserialize, Deserializer, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, BTreeSet};

pub const SCHEMA: &str = "oi.expression-storage/v1";
pub const IMAGE_REF_SCHEMA: &str = "oi.expression-image-ref/v1";
pub const FILE_BYTES: usize = 4 * 1024 * 1024;
pub(crate) const MAX_IMAGES: usize = 4096;
// Native rich material admits forty levels from its own material root. The
// Document and storage envelope add containers around that unchanged root.
const MAX_FILE_DEPTH: usize = 48;
const PNG: &str = "data:image/png;base64,";

#[derive(Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
struct StoredExpression {
    schema: String,
    document: Value,
    images: Vec<StoredImage>,
    expanded_document_sha256: String,
}
#[derive(Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct StoredImage {
    pub(crate) r#ref: String,
    pub(crate) data_url: String,
}
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct ImageRef {
    schema: String,
    r#ref: String,
}
// Preserve typed duplicate-field admission through the envelope's Value
// carrier too, including rich material objects. Borrowed raw shape admission
// preserves complete numeric JSON tokens without repeated subtree parsing.
pub(crate) struct UniqueValue(pub(crate) Value);
impl<'de> Deserialize<'de> for UniqueValue {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let raw = Box::<serde_json::value::RawValue>::deserialize(deserializer)?;
        unique_raw_value(&raw)
            .map(UniqueValue)
            .map_err(serde::de::Error::custom)
    }
}

// The RawValue above has already qualified actual JSON grammar. Traverse its
// borrowed bytes once to qualify real object-key identities and global depth
// before Value decoding can expose Serde's private Number transport. No child
// RawValue decoder may rescan the same nested source body.
fn qualify_raw_shape(raw: &str) -> Result<(), serde_json::Error> {
    const MAX_CONTAINER_DEPTH: usize = 127;
    let error = |reason| <serde_json::Error as serde::de::Error>::custom(reason);
    let bytes = raw.as_bytes();
    let mut containers: Vec<Option<BTreeSet<String>>> = Vec::new();
    let mut offset = 0;
    while offset < bytes.len() {
        match bytes[offset] {
            b'{' | b'[' => {
                if containers.len() >= MAX_CONTAINER_DEPTH {
                    return Err(error("recursion limit exceeded"));
                }
                containers.push((bytes[offset] == b'{').then(BTreeSet::new));
                offset += 1;
            }
            b'}' | b']' => {
                containers.pop();
                offset += 1;
            }
            b'"' => {
                let begin = offset;
                offset += 1;
                while offset < bytes.len() {
                    match bytes[offset] {
                        b'\\' => offset += 2,
                        b'"' => break,
                        _ => offset += 1,
                    }
                }
                if offset >= bytes.len() {
                    return Err(error("unterminated JSON string"));
                }
                offset += 1;
                let mut next = offset;
                while next < bytes.len() && bytes[next].is_ascii_whitespace() {
                    next += 1;
                }
                // In already-valid JSON, a quoted token followed by ':' is
                // exactly an object key, never text inside a string value.
                if bytes.get(next) == Some(&b':') {
                    let key: String = serde_json::from_str(&raw[begin..offset])?;
                    if matches!(
                        key.as_str(),
                        "$serde_json::private::Number" | "$serde_json::private::RawValue"
                    ) {
                        return Err(error("Reserved JSON decoder key"));
                    }
                    let Some(Some(keys)) = containers.last_mut() else {
                        return Err(error("JSON key outside object"));
                    };
                    if !keys.insert(key) {
                        return Err(error("Duplicate Expression file key"));
                    }
                }
            }
            _ => offset += 1,
        }
    }
    Ok(())
}
fn qualify_native_numbers(value: &Value) -> Result<(), serde_json::Error> {
    match value {
        Value::Number(number) if number.as_f64().is_none() => Err(
            <serde_json::Error as serde::de::Error>::custom("Invalid JSON number"),
        ),
        Value::Array(values) => values.iter().try_for_each(qualify_native_numbers),
        Value::Object(values) => values.values().try_for_each(qualify_native_numbers),
        _ => Ok(()),
    }
}
fn unique_raw_value(raw: &serde_json::value::RawValue) -> Result<Value, serde_json::Error> {
    qualify_raw_shape(raw.get())?;
    // Existing arbitrary_precision Value decoding preserves each complete raw
    // number token. Typing happens only after the complete shape/number guards.
    let value = serde_json::from_str(raw.get())?;
    qualify_native_numbers(&value)?;
    Ok(value)
}
/// Raw native JSON admission. Capture the actual object shape before Serde's
/// private Number/RawValue transports can reinterpret an authored map. Preserve
/// every admitted Value number token; caller and native-family byte caps remain.
pub fn read_native_json<T: serde::de::DeserializeOwned>(
    bytes: &[u8],
) -> Result<T, serde_json::Error> {
    let UniqueValue(value) = serde_json::from_slice(bytes)?;
    serde_json::from_value(value)
}

// Tagged enum content can buffer an arbitrary-precision Number as Serde's
// internal Number map. Typed scalar controls consume its finite value, while
// full receipt Values retain the original Number token. Real reserved maps are
// refused by raw native admission before this typed conversion.
pub(crate) fn finite_number<'de, D: Deserializer<'de>>(d: D) -> Result<f64, D::Error> {
    Value::deserialize(d)?
        .as_f64()
        .ok_or_else(|| serde::de::Error::custom("native scalar must be a finite JSON number"))
}
pub(crate) fn optional_finite_number<'de, D: Deserializer<'de>>(
    d: D,
) -> Result<Option<f64>, D::Error> {
    Option::<Value>::deserialize(d)?
        .map(|value| {
            value.as_f64().ok_or_else(|| {
                serde::de::Error::custom("native scalar must be a finite JSON number")
            })
        })
        .transpose()
}
pub(crate) fn finite_vector<'de, D: Deserializer<'de>>(d: D) -> Result<[f64; 3], D::Error> {
    let values = <[Value; 3]>::deserialize(d)?;
    let mut result = [0.0; 3];
    for (slot, value) in result.iter_mut().zip(values) {
        *slot = value.as_f64().ok_or_else(|| {
            serde::de::Error::custom("native vector must contain three finite JSON numbers")
        })?;
    }
    Ok(result)
}

pub(crate) fn digest(bytes: &[u8]) -> String {
    format!("sha256:{:x}", Sha256::digest(bytes))
}
pub(crate) fn digest_ref(value: &str) -> bool {
    value.strip_prefix("sha256:").is_some_and(|hex| {
        hex.len() == 64
            && hex
                .bytes()
                .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
    })
}
pub(crate) fn png(value: &str) -> bool {
    value.strip_prefix(PNG).is_some_and(|bytes| {
        !bytes.is_empty()
            && bytes.len() % 4 == 0
            && bytes
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || b"+/=".contains(&b))
    })
}
/// The one admitted `constructor` key shape: the native world-construction
/// source-inputs record (schema, identity profile, natal, sky, occasion,
/// calibration, return context). Every other `constructor` key is unsafe.
fn native_constructor_metadata(object: &serde_json::Map<String, Value>) -> bool {
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
    object.len() == KEYS.len()
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

fn safe(value: &Value, depth: usize) -> Result<(), String> {
    if depth > MAX_FILE_DEPTH {
        return Err("Expression file nesting budget exceeded".into());
    }
    match value {
        Value::Number(number) if number.as_f64().is_none() => {
            Err("Expression file number must be finite".into())
        }
        Value::String(value) if value.contains('\0') => Err("Expression file contains NUL".into()),
        Value::Array(values) => {
            if values.len() > 4096 {
                return Err("Expression file array budget exceeded".into());
            }
            for value in values {
                safe(value, depth + 1)?;
            }
            Ok(())
        }
        Value::Object(values) => {
            for (key, value) in values {
                if key.contains('\0')
                    || [
                        "__proto__",
                        "prototype",
                        "$serde_json::private::Number",
                        "$serde_json::private::RawValue",
                    ]
                    .contains(&key.as_str())
                    || (key == "constructor" && !native_constructor_metadata(values))
                {
                    return Err("Unsafe Expression file key".into());
                }
                safe(value, depth + 1)?;
            }
            Ok(())
        }
        _ => Ok(()),
    }
}
pub(crate) fn count_images<'a>(value: &'a Value, counts: &mut BTreeMap<&'a str, usize>) {
    match value {
        Value::Object(values) => {
            for (key, value) in values {
                if key == "dataUrl" {
                    if let Some(url) = value.as_str().filter(|url| png(url)) {
                        *counts.entry(url).or_default() += 1;
                    }
                }
                count_images(value, counts);
            }
        }
        Value::Array(values) => {
            for value in values {
                count_images(value, counts);
            }
        }
        _ => {}
    }
}
pub(crate) fn intern(value: &mut Value, refs: &BTreeMap<String, String>) {
    match value {
        Value::Object(values) => {
            for (key, value) in values {
                if key == "dataUrl" {
                    if let Some(reference) = value.as_str().and_then(|url| refs.get(url)) {
                        *value = json!({"schema":IMAGE_REF_SCHEMA,"ref":reference});
                        continue;
                    }
                }
                intern(value, refs);
            }
        }
        Value::Array(values) => {
            for value in values {
                intern(value, refs);
            }
        }
        _ => {}
    }
}

/// Save the exact full native Document through its file owner. No serializer
/// or public Document shape changes: only the file has reference encoding.
pub fn encode(document: &Document) -> Result<String, String> {
    document.validate()?;
    let full = serde_json::to_vec(document).map_err(|e| e.to_string())?;
    let mut value = serde_json::to_value(document).map_err(|e| e.to_string())?;
    safe(&value, 0)?;
    let mut counts = BTreeMap::new();
    count_images(&value, &mut counts);
    let refs: BTreeMap<String, String> = counts
        .into_iter()
        .filter(|(_, count)| *count > 1)
        .take(MAX_IMAGES)
        .map(|(url, _)| (url.to_owned(), digest(url.as_bytes())))
        .collect();
    if refs.is_empty() {
        if full.len() > FILE_BYTES {
            return Err("Expression file exceeds 4 MiB".into());
        }
        return String::from_utf8(full).map_err(|e| e.to_string());
    }
    let mut images: Vec<StoredImage> = refs
        .iter()
        .map(|(url, reference)| StoredImage {
            r#ref: reference.clone(),
            data_url: url.clone(),
        })
        .collect();
    images.sort_by(|a, b| a.r#ref.cmp(&b.r#ref));
    intern(&mut value, &refs);
    let stored = StoredExpression {
        schema: SCHEMA.into(),
        document: value,
        images,
        expanded_document_sha256: digest(&full),
    };
    let encoded = serde_json::to_string(&stored).map_err(|e| e.to_string())?;
    if encoded.len() >= full.len() && full.len() <= FILE_BYTES {
        return String::from_utf8(full).map_err(|e| e.to_string());
    }
    if encoded.len() > FILE_BYTES {
        return Err("Expression file exceeds 4 MiB".into());
    }
    Ok(encoded)
}

/// Validate every local image reference and account for its entire expanded
/// size BEFORE any repeated image String is cloned. A literal-only image
/// dictionary makes reference cycles structurally impossible.
pub(crate) fn expansion_delta(
    value: &Value,
    key: Option<&str>,
    images: &BTreeMap<String, String>,
    used: &mut BTreeSet<String>,
) -> Result<i128, String> {
    if value.is_object() && (key == Some("dataUrl") || value["schema"] == IMAGE_REF_SCHEMA) {
        if key != Some("dataUrl") {
            return Err("Image reference outside dataUrl".into());
        }
        let reference: ImageRef = serde_json::from_value(value.clone())
            .map_err(|e| format!("Invalid embedded image reference: {e}"))?;
        if reference.schema != IMAGE_REF_SCHEMA || !digest_ref(&reference.r#ref) {
            return Err("Invalid embedded image reference schema/digest".into());
        }
        let image = images
            .get(&reference.r#ref)
            .ok_or("Missing embedded image reference")?;
        used.insert(reference.r#ref);
        let removed = serde_json::to_vec(value).map_err(|e| e.to_string())?.len();
        // Admitted PNG data URLs are ASCII without JSON escaping.
        return Ok(image.len() as i128 + 2 - removed as i128);
    }
    let mut delta = 0i128;
    match value {
        Value::Object(values) => {
            for (key, value) in values {
                delta = delta
                    .checked_add(expansion_delta(value, Some(key), images, used)?)
                    .ok_or("Expanded Expression file size overflow")?;
            }
        }
        Value::Array(values) => {
            for value in values {
                delta = delta
                    .checked_add(expansion_delta(value, None, images, used)?)
                    .ok_or("Expanded Expression file size overflow")?;
            }
        }
        _ => {}
    }
    Ok(delta)
}
pub(crate) fn expand(value: &mut Value, images: &BTreeMap<String, String>) {
    if value.is_object() && value["schema"] == IMAGE_REF_SCHEMA {
        // Every reference was qualified by expansion_delta before this pass.
        let reference = value["ref"].as_str().unwrap();
        let image = images[reference].clone();
        *value = Value::String(image);
        return;
    }
    match value {
        Value::Object(values) => {
            for value in values.values_mut() {
                expand(value, images);
            }
        }
        Value::Array(values) => {
            for value in values {
                expand(value, images);
            }
        }
        _ => {}
    }
}

/// Read legacy full JSON or this lossless file envelope, then return only the
/// same fully validated native Document. No owner state is mutated here.
pub fn decode(content: &str) -> Result<Document, String> {
    if content.len() > FILE_BYTES {
        return Err("Expression file exceeds 4 MiB".into());
    }
    let UniqueValue(value) =
        serde_json::from_str(content).map_err(|e| format!("Invalid Expression file: {e}"))?;
    safe(&value, 0)?;
    if value["schema"] == crate::expression::SCHEMA {
        let document: Document = serde_json::from_str(content).map_err(|e| e.to_string())?;
        document.validate()?;
        return Ok(document);
    }
    if value["schema"] != SCHEMA {
        return Err("Unsupported Expression file storage schema".into());
    }
    let mut stored: StoredExpression = serde_json::from_str(content)
        .map_err(|e| format!("Invalid Expression file envelope: {e}"))?;
    if !digest_ref(&stored.expanded_document_sha256) || stored.images.len() > MAX_IMAGES {
        return Err("Invalid expanded Expression digest or image dictionary budget".into());
    }
    let mut images = BTreeMap::new();
    for image in stored.images {
        if !digest_ref(&image.r#ref)
            || !png(&image.data_url)
            || digest(image.data_url.as_bytes()) != image.r#ref
        {
            return Err("Invalid embedded image schema or digest".into());
        }
        if images.insert(image.r#ref, image.data_url).is_some() {
            return Err("Duplicate embedded image reference".into());
        }
    }
    let mut used = BTreeSet::new();
    let encoded_size = serde_json::to_vec(&stored.document)
        .map_err(|e| e.to_string())?
        .len();
    let size = (encoded_size as i128)
        .checked_add(expansion_delta(&stored.document, None, &images, &mut used)?)
        .ok_or("Expanded Expression file size overflow")?;
    if size < 0 || size > DOCUMENT_BYTES as i128 {
        return Err("Expanded Expression document exceeds 8 MiB before material cloning".into());
    }
    if used.len() != images.len() {
        return Err("Unused embedded image reference".into());
    }
    expand(&mut stored.document, &images);
    let document: Document = serde_json::from_value(stored.document).map_err(|e| e.to_string())?;
    let full = serde_json::to_vec(&document).map_err(|e| e.to_string())?;
    if digest(&full) != stored.expanded_document_sha256 {
        return Err("Expanded Expression document digest differs".into());
    }
    document.validate()?;
    Ok(document)
}

#[cfg(test)]
mod complete_json_custody_tests {
    use super::*;

    #[test]
    fn unique_read_keeps_original_numeric_tokens_without_numeric_reinterpretation() {
        // The scientific token is from the actual QL240 World sky source
        // payload in canonical ee880's retained original native artifact.
        let raw = r#"{"source":[2.0937213582368774e-05,1e+09,0.08000000000000002],"text":"$serde_json::private::Number"}"#;
        let UniqueValue(value) = serde_json::from_str(raw).unwrap();
        assert_eq!(serde_json::to_string(&value).unwrap(), raw);
        assert_eq!(value["source"][0].as_f64().unwrap(), 2.0937213582368774e-05);
        assert_eq!(value["source"][1].as_f64().unwrap(), 1e9);
    }

    #[test]
    fn unique_read_refuses_real_reserved_keys_duplicates_and_original_number_depth_bounds() {
        for raw in [
            r#"{"$serde_json::private::Number":"1"}"#,
            r#"{"nested":{"$serde_json::private::RawValue":"null"}}"#,
            r#"{"\u0024serde_json::private::Number":"1"}"#,
            r#"{"value":1,"\u0076alue":2}"#,
            r#"[{"native":[2.0937213582368774e-05],"native":[] }]"#,
            r#"{"number":1e400}"#,
        ] {
            assert!(serde_json::from_str::<UniqueValue>(raw).is_err(), "{raw}");
        }
        let allowed = format!("{}0{}", "[".repeat(127), "]".repeat(127));
        let refused = format!("{}0{}", "[".repeat(128), "]".repeat(128));
        assert!(serde_json::from_str::<UniqueValue>(&allowed).is_ok());
        assert!(serde_json::from_str::<UniqueValue>(&refused).is_err());
    }
}

#[cfg(test)]
mod native_json_admission_tests {
    use super::*;
    use crate::{expression::Request, KernelOp};

    #[test]
    fn exact_receipt_numbers_and_typed_tagged_finite_controls_are_distinct() {
        let a: Value = read_native_json(br#"{"value":1e-05}"#).unwrap();
        let b: Value = read_native_json(br#"{"value":1e-5}"#).unwrap();
        assert_eq!(serde_json::to_vec(&a).unwrap(), br#"{"value":1e-05}"#);
        assert_eq!(serde_json::to_vec(&b).unwrap(), br#"{"value":1e-5}"#);
        assert_ne!(a, b, "receipt Value equality retains exact Number custody");
        for token in ["1e-05", "1e-5", "0.00001"] {
            let raw = format!(
                r#"{{"op":"expression","request":{{"operation":"edit","expression_ref":"expression:numeric","expected_revision":1,"actor":"human:numeric","changes":[{{"change":"parameter_automate","entity_ref":"expression:numeric:entity:one","parameter":"x","automation":{{"min":{token},"max":1,"rate_hz":{token},"waveform":"sine"}}}}]}}}}"#
            );
            let KernelOp::Expression {
                request: Request::Edit { changes, .. },
            } = read_native_json(raw.as_bytes()).unwrap()
            else {
                panic!("exact tagged operation required")
            };
            let crate::expression::Change::ParameterAutomate { automation, .. } = &changes[0]
            else {
                panic!("exact tagged change required")
            };
            assert_eq!(automation.min.to_bits(), 0.00001_f64.to_bits());
            assert_eq!(automation.rate_hz.to_bits(), 0.00001_f64.to_bits());
            let factory = format!(
                r#"{{"op":"factory_owner","request":{{"kind":"telemetry-watch","state_path":"controlled-state","duration_secs":{token}}}}}"#
            );
            let op: KernelOp = read_native_json(factory.as_bytes()).unwrap();
            assert_eq!(
                serde_json::to_value(op).unwrap()["request"]["duration_secs"].as_f64(),
                Some(0.00001)
            );
            let world = format!(
                r#"{{"op":"expression_world","request":{{"operation":"act_text","act_ref":"act:numeric","actor":"human:numeric","role":"progress","value":{token}}}}}"#
            );
            let op: KernelOp = read_native_json(world.as_bytes()).unwrap();
            assert_eq!(
                serde_json::to_value(op).unwrap()["request"]["value"].as_f64(),
                Some(0.00001)
            );
        }
    }

    #[test]
    fn raw_admission_refuses_duplicate_escaped_reserved_overflow_and_non_utf8_before_typing() {
        for raw in [
            r#"{"x":1,"x":2}"#,
            r#"{"x":1,"\u0078":2}"#,
            r#"{"$serde_json::private::Number":"3600"}"#,
            r#"{"\u0024serde_json::private::Number":"3600"}"#,
            r#"{"$serde_json::private::RawValue":"42"}"#,
            r#"{"nested":[{"value":1e400}]}"#,
        ] {
            assert!(read_native_json::<Value>(raw.as_bytes()).is_err(), "{raw}");
        }
        assert!(read_native_json::<Value>(&[b'"', 0xff, b'"']).is_err());
        let infinite: Value = serde_json::from_str("1e400").unwrap();
        assert!(safe(&infinite, 0).is_err());
        assert!(crate::expression_scene::data(&infinite, 0).is_err());
        for key in [
            "$serde_json::private::Number",
            "$serde_json::private::RawValue",
        ] {
            let object = Value::Object(
                [(key.into(), Value::String("3600".into()))]
                    .into_iter()
                    .collect(),
            );
            assert!(safe(&object, 0).is_err());
            assert!(crate::expression_scene::data(&object, 0).is_err());
        }
    }
}

#[cfg(test)]
mod linear_raw_admission_tests {
    use super::*;
    #[test]
    fn actual_raw_number_spellings_and_distinct_object_scopes_remain_lossless() {
        // These three number spellings are the original 3f1 input operand,
        // not a newly synthesized numerical expectation or native fixture.
        let raw = r#"[{"rate":-1.1802825996413943e-05},{"rate":2.6595910808642593e-05},{"rate":1.1881545124631414e-05}]"#;
        let UniqueValue(value) = serde_json::from_str(raw).unwrap();
        assert_eq!(serde_json::to_string(&value).unwrap(), raw);
        let raw = r#"{"data":"\\\" : { [ ] }","nested":[{"key\"\\":1e-05}]}"#;
        let UniqueValue(value) = serde_json::from_str(raw).unwrap();
        assert_eq!(value["data"], "\\\" : { [ ] }");
        assert_eq!(
            serde_json::to_string(&value["nested"][0]["key\"\\"]).unwrap(),
            "1e-05"
        );
        let raw = r#"{"text":"{\"$serde_json::private::Number\":1}"}"#;
        let UniqueValue(value) = serde_json::from_str(raw).unwrap();
        assert_eq!(value["text"], "{\"$serde_json::private::Number\":1}");
    }
    #[test]
    fn borrowed_shape_checks_do_not_relax_escaped_keys_depth_or_bad_json() {
        for raw in [
            r#"[{"rate":1e-05,"\u0072ate":1e-5}]"#,
            r#"{"x":[{"\u0024serde_json::private::Number":"1e-05"}]}"#,
            r#"{"x":[{"$serde_json::private::RawValue":"1e-05"}]}"#,
            r#"{"x":[{"rate":1e400}]}"#,
            r#"{"x":1} {"x":2}"#,
            r#"{"x":[1,]}"#,
            r#"{"x":"unterminated}"#,
        ] {
            assert!(serde_json::from_str::<UniqueValue>(raw).is_err(), "{raw}");
        }
        let allowed = format!("{}1e-05{}", "[".repeat(127), "]".repeat(127));
        let refused = format!("{}1e-05{}", "[".repeat(128), "]".repeat(128));
        assert!(serde_json::from_str::<UniqueValue>(&allowed).is_ok());
        assert!(serde_json::from_str::<UniqueValue>(&refused).is_err());
    }
}
