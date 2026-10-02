//! Private, lossless storage of complete immutable Act editions. Public Acts
//! still contain Documents. Literal Document fields and PNGs are shared only
//! inside one bounded record; they never depend on current owner state.
use crate::expression::{Document, DOCUMENT_BYTES};
use crate::expression_file::{self, StoredImage, UniqueValue};
use crate::expression_world::{Act, ActPhase, Passage, PassageKind};
use serde::{Deserialize, Serialize};
use serde::ser::{SerializeMap, SerializeSeq};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, BTreeSet};
use std::io::{self, Write};

pub(crate) const SCHEMA: &str = "oi.expression-act-storage/v1";
const EDITION: &str = "oi.expression-act-edition/v1";
const MAX_PARTS: usize = 8192;
pub(crate) const EXPANDED_BYTES: usize = DOCUMENT_BYTES;
/// Serialized expanded weight, not a measurement or promise of heap RSS.
pub(crate) const LIVE_BYTES: usize = 64 * 1024 * 1024;

#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct StoredRecord {
    schema: String,
    act: Value,
    parts: Vec<Part>,
    images: Vec<StoredImage>,
    expanded_act_sha256: String,
}
#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Part {
    r#ref: String,
    value: Value,
}
#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct StoredEdition {
    schema: String,
    fields: BTreeMap<String, String>,
    expanded_document_sha256: String,
}
#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Record<A> {
    schema: String,
    act: A,
}

struct Counter {
    bytes: usize,
    limit: usize,
    hash: Sha256,
}
impl Write for Counter {
    fn write(&mut self, bytes: &[u8]) -> io::Result<usize> {
        self.bytes = self.bytes.checked_add(bytes.len()).ok_or_else(|| {
            io::Error::other("Expanded Act size overflow")
        })?;
        if self.bytes > self.limit {
            return Err(io::Error::other("Expanded Act byte budget exceeded before cloning"));
        }
        self.hash.update(bytes);
        Ok(bytes.len())
    }
    fn flush(&mut self) -> io::Result<()> { Ok(()) }
}
pub(crate) fn measure<T: Serialize + ?Sized>(value: &T, limit: usize) -> Result<usize, String> {
    Ok(fingerprint(value, limit)?.0)
}

/// Count the prospective complete history without cloning any prior edition.
/// Timestamp uses the widest u64 representation, so the bound is conservative
/// until the ordinary native commit chooses its actual current time.
pub(crate) fn preflight_append(
    act: &Act, passage: &Passage, summary: &str, actor: &str,
    activity: Option<&str>, basis: u64, revision: u64,
) -> Result<usize, String> {
    struct Sequence<'a>(&'a [Passage], &'a Passage);
    impl Serialize for Sequence<'_> {
        fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
            let mut seq = s.serialize_seq(Some(self.0.len() + 1))?;
            for p in self.0 { seq.serialize_element(p)?; }
            seq.serialize_element(self.1)?;
            seq.end()
        }
    }
    struct Appended<'a> {
        act: &'a Act, passage: &'a Passage, summary: &'a str, actor: &'a str,
        activity: Option<&'a str>, basis: u64, revision: u64,
    }
    impl Serialize for Appended<'_> {
        fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
            // Exhaustive destructuring makes a future public Act field require
            // an explicit addition to this borrowed prospective serializer.
            let Act { act_ref, expression_ref, summary: _, actor: _, activity_ref,
                phase: _, basis_revision: _, revision: _, mode, cast, subject_ref,
                instrument_ref, material, bindings, selection, position: _, sequence,
                continuations, return_ref, result, role_entities, updated_at_unix_ms: _, archived } = self.act;
            let mut m = s.serialize_map(None)?;
            macro_rules! field { ($k:literal, $v:expr) => { m.serialize_entry($k, &$v)?; }; }
            macro_rules! optional { ($k:literal, $v:expr) => { if let Some(v) = $v { m.serialize_entry($k, v)?; } }; }
            field!("act_ref", act_ref); field!("expression_ref", expression_ref);
            field!("summary", self.summary); field!("actor", self.actor);
            optional!("activity_ref", self.activity.or(activity_ref.as_deref()));
            field!("phase", ActPhase::Running); field!("basis_revision", self.basis);
            field!("revision", self.revision); field!("mode", mode); field!("cast", cast);
            optional!("subject_ref", subject_ref); optional!("instrument_ref", instrument_ref);
            optional!("material", material); field!("bindings", bindings);
            optional!("selection", selection); field!("position", self.passage.index);
            field!("sequence", Sequence(sequence, self.passage)); field!("continuations", continuations);
            optional!("return_ref", return_ref); optional!("result", result);
            field!("role_entities", role_entities); field!("updated_at_unix_ms", u64::MAX);
            if *archived { field!("archived", true); }
            m.end()
        }
    }
    measure(&Appended { act, passage, summary, actor, activity, basis, revision }, EXPANDED_BYTES)
}
fn fingerprint<T: Serialize + ?Sized>(value: &T, limit: usize) -> Result<(usize, String), String> {
    let mut output = Counter { bytes: 0, limit, hash: Sha256::new() };
    serde_json::to_writer(&mut output, value).map_err(|e| e.to_string())?;
    Ok((output.bytes, format!("sha256:{:x}", output.hash.finalize())))
}

fn safe(value: &Value, depth: usize) -> Result<(), String> {
    if depth > 56 { return Err("Act storage nesting budget exceeded".into()); }
    match value {
        Value::String(s) if s.contains('\0') => return Err("Act storage contains NUL".into()),
        Value::Array(values) => {
            for v in values { safe(v, depth + 1)?; }
        }
        Value::Object(values) => {
            for (key, v) in values {
                if key.contains('\0') || ["__proto__", "constructor", "prototype"].contains(&key.as_str()) {
                    return Err("Unsafe Act storage key".into());
                }
                safe(v, depth + 1)?;
            }
        }
        _ => {}
    }
    Ok(())
}
fn no_edition_refs(value: &Value) -> Result<(), String> {
    if value["schema"] == EDITION || value["schema"] == SCHEMA {
        return Err("Act storage reference outside an edition slot".into());
    }
    match value {
        Value::Array(values) => { for v in values { no_edition_refs(v)?; } }
        Value::Object(values) => { for v in values.values() { no_edition_refs(v)?; } }
        _ => {}
    }
    Ok(())
}
fn no_metadata_refs(value: &Value) -> Result<(), String> {
    no_edition_refs(value)?;
    if value["schema"] == expression_file::IMAGE_REF_SCHEMA { return Err("Image reference outside retained edition material".into()); }
    match value {
        Value::Array(v) => { for x in v { no_metadata_refs(x)?; } }
        Value::Object(v) => { for x in v.values() { no_metadata_refs(x)?; } }
        _ => {}
    }
    Ok(())
}
fn canonical<T: serde::de::DeserializeOwned + Serialize>(value: &Value) -> Result<(), String> {
    // Only one physically bounded dictionary field is typed at a time here,
    // with PNG references still unexpanded. Native defaults/float formatting
    // must already be present, so the later expanded weight is exact.
    let typed = T::deserialize(value).map_err(|e| e.to_string())?;
    let native = serde_json::to_value(typed).map_err(|e| e.to_string())?;
    if fingerprint(&native, EXPANDED_BYTES)?.1 != fingerprint(value, EXPANDED_BYTES)?.1 {
        return Err("Stored edition literal differs from its canonical native field".into());
    }
    Ok(())
}
fn canonical_field(key: &str, value: &Value) -> Result<(), String> {
    use crate::expression::*;
    match key {
        "schema" | "expression_ref" | "title" => canonical::<String>(value),
        "revision" => canonical::<u64>(value),
        "scenes" => canonical::<Vec<Scene>>(value),
        "entities" => canonical::<BTreeMap<String, Entity>>(value),
        "relations" => canonical::<BTreeMap<String, Relation>>(value),
        "representations" => canonical::<Vec<Representation>>(value),
        "selection" => canonical::<Selection>(value),
        "provenance" => canonical::<Vec<ReadingRef>>(value),
        "refinements" => canonical::<Vec<Refinement>>(value),
        "collections" => canonical::<Vec<String>>(value),
        "profiles" => canonical::<Vec<crate::expression_profile::ProfileAdoption>>(value),
        "presentation" => canonical::<crate::expression_scene::Composition>(value),
        "reuse" => canonical::<Reuse>(value),
        _ => Err("Unknown native edition field".into()),
    }
}
pub(crate) fn validate(act: &Act) -> Result<(), String> {
    measure(act, EXPANDED_BYTES)?;
    if act.revision == 0 || act.sequence.len() > 513 || act.position.is_some_and(|p| p >= act.sequence.len()) {
        return Err("Invalid retained Act revision, position or passage budget".into());
    }
    if act.archived && !matches!(act.phase, ActPhase::Completed | ActPhase::Cancelled) {
        return Err("A retained archived Act must be ended".into());
    }
    for (index, passage) in act.sequence.iter().enumerate() {
        if passage.index != index { return Err("Retained Act passage index differs".into()); }
        match (&passage.kind, &passage.edition) {
            (PassageKind::Edition, Some(document)) => {
                if passage.target_ref.as_deref() != Some(document.expression_ref.as_str())
                    || passage.revision.as_deref() != Some(document.revision.to_string().as_str()) {
                    return Err("Retained edition target or revision mismatch".into());
                }
                document.validate()?;
            }
            (PassageKind::Edition, None) => return Err("Edition passage has no retained document".into()),
            (_, Some(_)) => return Err("Retained document outside an edition passage".into()),
            _ => {}
        }
    }
    Ok(())
}

pub(crate) fn encode(act: &Act) -> Result<Vec<u8>, String> {
    // This borrowed pass counts every complete occurrence before allocating a
    // Value or sharing fields. Unique dictionary size cannot license history.
    let (_, expanded_act_sha256) = fingerprint(act, EXPANDED_BYTES)?;
    validate(act)?;
    let raw = serde_json::to_vec(&Record { schema: crate::expression_act_store::SCHEMA.into(), act })
        .map_err(|e| e.to_string())?;
    if !act.sequence.iter().any(|p| p.edition.is_some()) {
        return bounded(raw);
    }
    let mut value = serde_json::to_value(act).map_err(|e| e.to_string())?;
    let passages = value["sequence"].as_array_mut().ok_or("Act sequence is not an array")?;
    let mut counts = BTreeMap::new();
    for passage in passages.iter() {
        if let Some(document) = passage.get("edition") { expression_file::count_images(document, &mut counts); }
    }
    if counts.len() > expression_file::MAX_IMAGES { return Err("Act image dictionary budget exceeded".into()); }
    let image_refs: BTreeMap<String, String> = counts.keys().map(|url| ((*url).to_owned(), expression_file::digest(url.as_bytes()))).collect();
    let images = image_refs.iter().map(|(url, reference)| StoredImage { r#ref: reference.clone(), data_url: url.clone() }).collect();
    drop(counts);
    let mut parts: BTreeMap<String, Value> = BTreeMap::new();
    for (passage, native) in passages.iter_mut().zip(&act.sequence) {
        let Some(document) = native.edition.as_deref() else { continue; };
        let slot = passage.get_mut("edition").ok_or("Missing retained edition slot")?;
        expression_file::intern(slot, &image_refs);
        let Value::Object(fields) = std::mem::take(slot) else { return Err("Edition is not a Document".into()); };
        let mut refs = BTreeMap::new();
        for (key, field) in fields {
            no_edition_refs(&field)?;
            let reference = fingerprint(&field, EXPANDED_BYTES)?.1;
            if let Some(existing) = parts.get(&reference) {
                if existing != &field { return Err("Act literal part digest collision".into()); }
            } else { parts.insert(reference.clone(), field); }
            refs.insert(key, reference);
        }
        if parts.len() > MAX_PARTS { return Err("Act literal dictionary budget exceeded".into()); }
        *slot = serde_json::to_value(StoredEdition {
            schema: EDITION.into(), fields: refs,
            expanded_document_sha256: fingerprint(document, DOCUMENT_BYTES)?.1,
        }).map_err(|e| e.to_string())?;
    }
    let encoded = serde_json::to_vec(&StoredRecord {
        schema: SCHEMA.into(), act: value,
        parts: parts.into_iter().map(|(reference, value)| Part { r#ref: reference, value }).collect(),
        images, expanded_act_sha256,
    }).map_err(|e| e.to_string())?;
    if raw.len() < encoded.len() { bounded(raw) } else { bounded(encoded) }
}
fn bounded(bytes: Vec<u8>) -> Result<Vec<u8>, String> {
    if bytes.len() as u64 > crate::expression_act_store::MAX_RECORD_BYTES {
        return Err("Act record exceeds its 4 MiB bound; retain this Act and continue in a successor Act".into());
    }
    Ok(bytes)
}

pub(crate) fn header(bytes: &[u8]) -> Result<(String, bool, u64, bool), String> {
    let UniqueValue(value) = serde_json::from_slice(bytes).map_err(|e| e.to_string())?;
    if value["schema"] != SCHEMA && value["schema"] != crate::expression_act_store::SCHEMA {
        return Err("Unsupported Act storage schema".into());
    }
    let reference = value["act"]["act_ref"].as_str().ok_or("Missing Act ref")?.to_owned();
    let ended = match value["act"]["phase"].as_str() {
        Some("completed" | "cancelled") => true,
        Some("running" | "held") => false,
        _ => return Err("Invalid stored Act phase".into()),
    };
    let updated = value["act"].get("updated_at_unix_ms").map_or(Ok(0), |v| v.as_u64().ok_or("Invalid Act update time"))?;
    let archived = value["act"].get("archived").map_or(Ok(false), |v| v.as_bool().ok_or("Invalid Act archive flag"))?;
    Ok((reference, ended, updated, archived))
}

pub(crate) fn decode(bytes: &[u8], available: usize) -> Result<Act, String> {
    if bytes.len() as u64 > crate::expression_act_store::MAX_RECORD_BYTES { return Err("Act record exceeds 4 MiB".into()); }
    let UniqueValue(value) = serde_json::from_slice(bytes).map_err(|e| format!("Invalid Act record: {e}"))?;
    safe(&value, 0)?;
    // The caller supplies the budget. An untrusted archived flag never bypasses
    // startup/live admission; only an explicit archive-by-ref read is transient.
    let limit = available.min(EXPANDED_BYTES);
    if value["schema"] == crate::expression_act_store::SCHEMA {
        measure(&value["act"], limit)?;
        no_metadata_refs(&value["act"])?;
        let record: Record<Act> = serde_json::from_value(value).map_err(|e| e.to_string())?;
        measure(&record.act, limit)?;
        validate(&record.act)?;
        return Ok(record.act);
    }
    if value["schema"] != SCHEMA { return Err("Unsupported Act storage schema".into()); }
    let mut stored: StoredRecord = serde_json::from_value(value).map_err(|e| format!("Invalid Act storage envelope: {e}"))?;
    if !expression_file::digest_ref(&stored.expanded_act_sha256) || stored.parts.len() > MAX_PARTS || stored.images.len() > expression_file::MAX_IMAGES {
        return Err("Invalid Act storage digest/dictionary budget".into());
    }
    let mut images = BTreeMap::new();
    for image in stored.images {
        if !expression_file::digest_ref(&image.r#ref) || !expression_file::png(&image.data_url) || expression_file::digest(image.data_url.as_bytes()) != image.r#ref {
            return Err("Invalid Act embedded image digest/PNG".into());
        }
        if images.insert(image.r#ref, image.data_url).is_some() { return Err("Duplicate Act image reference".into()); }
    }
    let mut used_images = BTreeSet::new();
    let mut parts = BTreeMap::new();
    let mut weights = BTreeMap::new();
    for part in stored.parts {
        no_edition_refs(&part.value)?;
        if !expression_file::digest_ref(&part.r#ref) || fingerprint(&part.value, EXPANDED_BYTES)?.1 != part.r#ref {
            return Err("Act literal part digest differs".into());
        }
        let size = (measure(&part.value, EXPANDED_BYTES)? as i128)
            .checked_add(expression_file::expansion_delta(&part.value, None, &images, &mut used_images)?).ok_or("Act expansion overflow")?;
        if size < 0 || size > DOCUMENT_BYTES as i128 { return Err("Act literal part expanded budget exceeded".into()); }
        weights.insert(part.r#ref.clone(), size as usize);
        if parts.insert(part.r#ref, part.value).is_some() { return Err("Duplicate Act literal part".into()); }
    }
    if used_images.len() != images.len() { return Err("Unused Act embedded image reference".into()); }
    let passages = stored.act["sequence"].as_array().ok_or("Act sequence is not an array")?;
    if passages.len() > 513 { return Err("Act passage budget exceeded".into()); }
    let mut editions = Vec::new();
    let mut used_parts = BTreeSet::new();
    let mut canonical_parts = BTreeSet::new();
    for (index, passage) in passages.iter().enumerate() {
        let Some(slot) = passage.get("edition") else { continue; };
        if passage["kind"] != "edition" { return Err("Stored edition outside an edition passage".into()); }
        let edition: StoredEdition = serde_json::from_value(slot.clone()).map_err(|e| format!("Invalid stored edition: {e}"))?;
        if edition.schema != EDITION || !expression_file::digest_ref(&edition.expanded_document_sha256) { return Err("Invalid stored edition schema/digest".into()); }
        const REQUIRED: [&str; 13] = ["schema", "expression_ref", "title", "revision", "scenes", "entities", "relations", "representations", "selection", "provenance", "refinements", "collections", "profiles"];
        if REQUIRED.iter().any(|k| !edition.fields.contains_key(*k))
            || edition.fields.keys().any(|k| !REQUIRED.contains(&k.as_str()) && !["presentation", "reuse"].contains(&k.as_str())) {
            return Err("Stored edition does not retain every canonical native Document field".into());
        }
        let mut size = 2usize;
        for (key, reference) in &edition.fields {
            let weight = *weights.get(reference).ok_or("Missing Act literal part")?;
            if canonical_parts.insert((key.clone(), reference.clone())) { canonical_field(key, &parts[reference])?; }
            let key_size = measure(key, EXPANDED_BYTES)?;
            size = size.checked_add(key_size + 1).and_then(|s| s.checked_add(weight)).and_then(|s| s.checked_add(1)).ok_or("Act expansion overflow")?;
            used_parts.insert(reference.clone());
        }
        if !edition.fields.is_empty() { size -= 1; }
        if size > DOCUMENT_BYTES { return Err("Expanded edition exceeds 8 MiB before cloning".into()); }
        editions.push((index, size, edition));
    }
    if used_parts.len() != parts.len() { return Err("Unused Act literal part".into()); }
    // Qualify reserved references at every remaining metadata position too.
    for passage in stored.act["sequence"].as_array_mut().unwrap() {
        if let Some(object) = passage.as_object_mut() {
            if object.contains_key("edition") { object.insert("edition".into(), Value::Null); }
        }
    }
    no_metadata_refs(&stored.act)?;
    // Deserialize bounded metadata before adding bodies so native defaulted
    // metadata fields count too. Only edition slots have been removed.
    let mut act: Act = serde_json::from_value(stored.act).map_err(|e| e.to_string())?;
    let mut expanded_size = measure(&act, limit)?;
    for (_, size, _) in &editions {
        // Each Passage already has fields; this is its comma + edition key.
        expanded_size = expanded_size.checked_add(11).and_then(|n| n.checked_add(*size)).ok_or("Act expansion overflow")?;
        if expanded_size > limit { return Err("Expanded Act live byte budget exceeded before cloning".into()); }
    }
    // All amplification and reference integrity checks preceded these clones.
    for (index, _, edition) in editions {
        let mut fields = serde_json::Map::new();
        for (key, reference) in edition.fields { fields.insert(key, parts[&reference].clone()); }
        let mut value = Value::Object(fields);
        expression_file::expand(&mut value, &images);
        let document: Document = serde_json::from_value(value).map_err(|e| e.to_string())?;
        if fingerprint(&document, DOCUMENT_BYTES)?.1 != edition.expanded_document_sha256 { return Err("Expanded Act edition digest differs".into()); }
        document.validate()?;
        act.sequence[index].edition = Some(Box::new(document));
    }
    if fingerprint(&act, limit)?.1 != stored.expanded_act_sha256 { return Err("Expanded Act digest differs".into()); }
    validate(&act)?;
    Ok(act)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{Kernel, KernelOp, KernelOpResult};
    use serde_json::json;

    #[test]
    fn a_defaulted_legacy_native_act_obeys_the_canonical_caller_budget() {
        let mut kernel = Kernel::new(crate::flow::CentralClient::with("/nonexistent/oi".into(), None, String::new()));
        let reference = "expression:controlled-legacy-budget";
        kernel.apply(KernelOp::Expression {
            request: serde_json::from_value(json!({"operation":"create","expression_ref":reference,
                "actor":"person:controlled-world-a","title":"Legacy budget"})).unwrap(),
        }).unwrap();
        let outcome = kernel.apply(KernelOp::ExpressionWorld {
            request: serde_json::from_value(json!({"operation":"act_open","act_ref":"act:controlled-legacy-budget",
                "expression_ref":reference,"mode":"expressions","actor":"person:controlled-world-a","summary":"Legacy budget"})).unwrap(),
        }).unwrap();
        let KernelOpResult::ExpressionWorld { data } = outcome.result else { panic!("Wrong native result") };
        let actual: Act = serde_json::from_value(data["act"].clone()).unwrap();
        let mut literal = data["act"].clone();
        literal.as_object_mut().unwrap().remove("cast");
        let raw_weight = serde_json::to_vec(&literal).unwrap().len();
        let bytes = serde_json::to_vec(&json!({"schema":crate::expression_act_store::SCHEMA,"act":literal})).unwrap();
        // Native legacy defaults are compatible at the normal record bound,
        // but their full canonical weight must fit the caller's remaining space.
        assert_eq!(decode(&bytes, EXPANDED_BYTES).unwrap(), actual);
        assert!(decode(&bytes, raw_weight).unwrap_err().contains("budget"));
    }
}
