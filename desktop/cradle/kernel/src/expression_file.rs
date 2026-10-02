//! Lossless file encoding of the existing native Expression document. Exact
//! repeated embedded PNG payloads are stored once in this file; they are not
//! assets, semantic subjects, profile revisions or a second material service.
//! API/export Documents remain full. Decode expands before their ordinary
//! native validation and before a file can replace any working document.
use crate::expression::{Document, DOCUMENT_BYTES};
use serde::{
    de::{MapAccess, SeqAccess, Visitor},
    Deserialize, Deserializer, Serialize,
};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, BTreeSet};
use std::fmt;

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
// carrier too, including rich material objects.
pub(crate) struct UniqueValue(pub(crate) Value);
impl<'de> Deserialize<'de> for UniqueValue {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        struct UniqueVisitor;
        impl<'de> Visitor<'de> for UniqueVisitor {
            type Value = UniqueValue;
            fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result {
                f.write_str("JSON without duplicate object keys")
            }
            fn visit_bool<E: serde::de::Error>(self, value: bool) -> Result<Self::Value, E> {
                Ok(UniqueValue(Value::Bool(value)))
            }
            fn visit_i64<E: serde::de::Error>(self, value: i64) -> Result<Self::Value, E> {
                Ok(UniqueValue(Value::Number(value.into())))
            }
            fn visit_u64<E: serde::de::Error>(self, value: u64) -> Result<Self::Value, E> {
                Ok(UniqueValue(Value::Number(value.into())))
            }
            fn visit_f64<E: serde::de::Error>(self, value: f64) -> Result<Self::Value, E> {
                serde_json::Number::from_f64(value)
                    .map(|number| UniqueValue(Value::Number(number)))
                    .ok_or_else(|| E::custom("Invalid JSON number"))
            }
            fn visit_str<E: serde::de::Error>(self, value: &str) -> Result<Self::Value, E> {
                Ok(UniqueValue(Value::String(value.to_owned())))
            }
            fn visit_string<E: serde::de::Error>(self, value: String) -> Result<Self::Value, E> {
                Ok(UniqueValue(Value::String(value)))
            }
            fn visit_unit<E: serde::de::Error>(self) -> Result<Self::Value, E> {
                Ok(UniqueValue(Value::Null))
            }
            fn visit_seq<A: SeqAccess<'de>>(
                self,
                mut sequence: A,
            ) -> Result<Self::Value, A::Error> {
                let mut values = Vec::new();
                while let Some(UniqueValue(value)) = sequence.next_element()? {
                    values.push(value);
                }
                Ok(UniqueValue(Value::Array(values)))
            }
            fn visit_map<A: MapAccess<'de>>(self, mut entries: A) -> Result<Self::Value, A::Error> {
                let mut values = serde_json::Map::new();
                while let Some(key) = entries.next_key::<String>()? {
                    if values.contains_key(&key) {
                        return Err(serde::de::Error::custom("Duplicate Expression file key"));
                    }
                    let UniqueValue(value) = entries.next_value()?;
                    values.insert(key, value);
                }
                Ok(UniqueValue(Value::Object(values)))
            }
        }
        deserializer.deserialize_any(UniqueVisitor)
    }
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
fn safe(value: &Value, depth: usize) -> Result<(), String> {
    if depth > MAX_FILE_DEPTH {
        return Err("Expression file nesting budget exceeded".into());
    }
    match value {
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
                    || ["__proto__", "constructor", "prototype"].contains(&key.as_str())
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
    if document.scenes.iter().any(|s| s.performance.is_some()) {
        return crate::expression_performance_storage::encode_document(document);
    }
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
    if crate::expression_performance_storage::supports_storage(&value["schema"]) {
        return crate::expression_performance_storage::decode_document(value);
    }
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
