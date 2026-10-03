//! Versioned adapter of the existing lossless Expression file owner.
//! Native Documents remain oi.expression/v1. Old no-performance files retain
//! their existing encoding. Page/checkpoint catalogs are embedded in this same
//! native file, with no external asset store, private factory or filesystem IO.
use crate::expression::{Document, DOCUMENT_BYTES};
use crate::expression_file::{self, StoredImage};
use crate::expression_performance_assets::{PerformancePartCatalog, StoredPerformanceParts};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{BTreeMap, BTreeSet};
pub const STORAGE_SCHEMA: &str = "oi.expression-storage/v2";
pub const SOURCE_STORAGE_SCHEMA: &str = "oi.expression-storage/v3";
pub const RECORDING_STORAGE_SCHEMA: &str = "oi.expression-storage/v4";
pub fn supports_storage(schema: &Value) -> bool {
    [
        STORAGE_SCHEMA,
        SOURCE_STORAGE_SCHEMA,
        RECORDING_STORAGE_SCHEMA,
    ]
    .iter()
    .any(|s| schema == *s)
}
pub const EDITION_REF_SCHEMA: &str = "oi.expression-performance-edition-ref/v1";
#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct PerformanceEditionRef {
    pub schema: String,
    pub catalog: u32,
    pub manifest: u32,
    pub performance_digest: String,
    pub expanded_bytes: u32,
}
#[derive(Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
struct StoredDocument<P = StoredPerformanceParts> {
    schema: String,
    document: Value,
    images: Vec<StoredImage>,
    performance_parts: Vec<P>,
    expanded_document_sha256: String,
}
fn weight<T: Serialize + ?Sized>(v: &T) -> Result<usize, String> {
    crate::expression_act_storage::measure(v, crate::expression_act_storage::LIVE_BYTES)
}
fn no_refs(v: &Value) -> Result<(), String> {
    if v["schema"] == EDITION_REF_SCHEMA || supports_storage(&v["schema"]) {
        return Err("native performance edition reference outside Scene slot".into());
    }
    match v {
        Value::Array(a) => {
            for x in a {
                no_refs(x)?;
            }
        }
        Value::Object(o) => {
            for x in o.values() {
                no_refs(x)?;
            }
        }
        _ => {}
    }
    Ok(())
}
/// Scene metadata is typed while its complete performance is still an index.
/// Borrowed deserialization injects the separately retained revision without
/// cloning a body. Nested serde defaults must already exist in stored bytes.
fn canonical_scene_metadata(value: &Value, revision: &Value) -> Result<(), String> {
    let object = value
        .as_object()
        .ok_or("native Scene metadata object absent")?;
    let fields = object
        .iter()
        .filter(|(key, _)| !["revision", "performance"].contains(&key.as_str()))
        .map(|(key, value)| (key.as_str(), value))
        .chain(std::iter::once(("revision", revision)));
    let typed = crate::expression::Scene::deserialize(serde::de::value::MapDeserializer::<
        _,
        serde_json::Error,
    >::new(fields))
    .map_err(|e| e.to_string())?;
    let mut canonical = serde_json::to_value(typed).map_err(|e| e.to_string())?;
    canonical.as_object_mut().unwrap().remove("revision");
    // Borrowed exclusion accounts for exactly the same native fields as the
    // typed metadata; no complete document or referenced body is cloned.
    struct Fields<'a>(&'a serde_json::Map<String, Value>);
    impl Fields<'_> {
        fn entries(&self) -> impl Iterator<Item = (&String, &Value)> {
            self.0
                .iter()
                .filter(|(key, _)| !["revision", "performance"].contains(&key.as_str()))
        }
    }
    impl Serialize for Fields<'_> {
        fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
            use serde::ser::SerializeMap;
            let mut out = s.serialize_map(None)?;
            for (key, value) in self.entries() {
                out.serialize_entry(key, value)?;
            }
            out.end()
        }
    }
    if expression_file::digest(&serde_json::to_vec(&canonical).map_err(|e| e.to_string())?)
        != expression_file::digest(&serde_json::to_vec(&Fields(object)).map_err(|e| e.to_string())?)
    {
        return Err("native Scene metadata omitted canonical nested defaults".into());
    }
    Ok(())
}
fn canonical_document_metadata(document: &Value) -> Result<(), String> {
    let fields = document
        .as_object()
        .ok_or("native Document object absent")?;
    const REQUIRED: [&str; 13] = [
        "schema",
        "expression_ref",
        "revision",
        "title",
        "entities",
        "relations",
        "selection",
        "provenance",
        "representations",
        "refinements",
        "collections",
        "profiles",
        "scenes",
    ];
    if REQUIRED.iter().any(|key| !fields.contains_key(*key)) {
        return Err("native Document omitted canonical required fields".into());
    }
    for (key, value) in fields {
        if key == "scenes" {
            let scenes = value.as_array().ok_or("native Scene array absent")?;
            if scenes.is_empty() || scenes.len() > 64 {
                return Err("native Scene count invalid".into());
            }
            for scene in scenes {
                let revision = scene
                    .get("revision")
                    .ok_or("native Scene revision absent")?;
                canonical_scene_metadata(scene, revision)?;
                for (key, value) in scene.as_object().unwrap() {
                    if key != "performance" {
                        no_refs(value)?;
                    }
                }
            }
        } else {
            no_refs(value)?;
            crate::expression_act_storage::canonical_field(key, value)?;
        }
    }
    Ok(())
}
/// Concrete native owner entry: expression_file::encode delegates here only
/// when a complete typed Scene performance is present.
pub fn encode_document(document: &Document) -> Result<String, String> {
    document.validate()?;
    if !document.scenes.iter().any(|s| s.performance.is_some()) {
        return expression_file::encode(document);
    }
    let raw = serde_json::to_vec(document).map_err(|e| e.to_string())?;
    let mut value = serde_json::to_value(document).map_err(|e| e.to_string())?;
    no_refs(&value)?;
    let mut parts = Vec::new();
    for (scene, native) in value["scenes"]
        .as_array_mut()
        .ok_or("native Scene array absent")?
        .iter_mut()
        .zip(&document.scenes)
    {
        if let Some(p) = &native.performance {
            let catalog = PerformancePartCatalog::default().appended(p)?;
            let marker = PerformanceEditionRef {
                schema: EDITION_REF_SCHEMA.into(),
                catalog: parts.len() as u32,
                manifest: 0,
                performance_digest: p.content_digest.clone(),
                expanded_bytes: u32::try_from(weight(p)?)
                    .map_err(|_| "native performance size overflow")?,
            };
            scene["performance"] = serde_json::to_value(marker).map_err(|e| e.to_string())?;
            parts.push(catalog.snapshot());
        }
    }
    let mut counts = BTreeMap::new();
    expression_file::count_images(&value, &mut counts);
    if counts.len() > expression_file::MAX_IMAGES {
        return Err("native file image dictionary budget exceeded".into());
    }
    let image_refs: BTreeMap<String, String> = counts
        .keys()
        .map(|u| ((*u).to_owned(), expression_file::digest(u.as_bytes())))
        .collect();
    let images = image_refs
        .iter()
        .map(|(url, r)| StoredImage {
            r#ref: r.clone(),
            data_url: url.clone(),
        })
        .collect();
    expression_file::intern(&mut value, &image_refs);
    let has_recordings = parts
        .iter()
        .any(|p| p.schema == crate::expression_performance_assets::RECORDING_CATALOG_SCHEMA);
    let has_sources = parts
        .iter()
        .any(|p| p.schema == crate::expression_performance_assets::SOURCE_CATALOG_SCHEMA);
    let encoded = serde_json::to_string(&StoredDocument {
        schema: if has_recordings {
            RECORDING_STORAGE_SCHEMA
        } else if has_sources {
            SOURCE_STORAGE_SCHEMA
        } else {
            STORAGE_SCHEMA
        }
        .into(),
        document: value,
        images,
        performance_parts: parts,
        expanded_document_sha256: expression_file::digest(&raw),
    })
    .map_err(|e| e.to_string())?;
    if encoded.len() > expression_file::FILE_BYTES {
        return Err(
            "complete native performance file exceeds 4 MiB; use admitted native asset custody"
                .into(),
        );
    }
    Ok(encoded)
}
fn safe_storage(value: &Value, depth: usize) -> Result<(), String> {
    if depth > 48 {
        return Err("native performance file nesting budget exceeded".into());
    }
    match value {
        Value::String(s) if s.contains('\0') => {
            return Err("native performance file contains NUL".into());
        }
        Value::Array(a) => {
            if a.len() > crate::expression_performance_assets::MAX_PARTS {
                return Err("native performance file array budget exceeded".into());
            }
            for v in a {
                safe_storage(v, depth + 1)?;
            }
        }
        Value::Object(o) => {
            for (k, v) in o {
                if k.contains('\0')
                    || ["__proto__", "prototype"].contains(&k.as_str())
                    || (k == "constructor"
                        && !crate::expression_performance_source_asset::native_constructor_metadata(
                            o,
                        ))
                {
                    return Err("unsafe native performance file key".into());
                }
                safe_storage(v, depth + 1)?;
            }
        }
        _ => {}
    }
    Ok(())
}
/// Caller uses expression_file::UniqueValue first, so duplicate keys retain the
/// exact existing admission rule. All amplification is bounded before expansion.
pub(crate) fn decode_document(value: Value) -> Result<Document, String> {
    safe_storage(&value, 0)?;
    if weight(&value)? > expression_file::FILE_BYTES {
        return Err("native performance file exceeds 4 MiB".into());
    }
    let mut stored: StoredDocument<Value> =
        serde_json::from_value(value).map_err(|e| e.to_string())?;
    if !supports_storage(&Value::String(stored.schema.clone()))
        || !expression_file::digest_ref(&stored.expanded_document_sha256)
        || stored.images.len() > expression_file::MAX_IMAGES
        || stored.performance_parts.len() > 64
    {
        return Err("unsupported native performance storage/dictionary budget".into());
    }
    let mut images = BTreeMap::new();
    for image in stored.images {
        if !expression_file::png(&image.data_url)
            || expression_file::digest(image.data_url.as_bytes()) != image.r#ref
            || images.insert(image.r#ref, image.data_url).is_some()
        {
            return Err("corrupt/duplicate native embedded image".into());
        }
    }
    let catalogs = stored
        .performance_parts
        .into_iter()
        .map(PerformancePartCatalog::read_value)
        .collect::<Result<Vec<_>, _>>()?;
    if (stored.schema == RECORDING_STORAGE_SCHEMA)
        != catalogs
            .iter()
            .any(PerformancePartCatalog::has_native_recordings)
    {
        return Err("native recording storage version/content differs".into());
    }
    if (stored.schema == SOURCE_STORAGE_SCHEMA || stored.schema == RECORDING_STORAGE_SCHEMA)
        != catalogs
            .iter()
            .any(|c| c.has_native_sources() || c.has_native_recordings())
    {
        return Err("native source file version/content differs".into());
    }
    let mut used = BTreeSet::new();
    let mut markers = Vec::new();
    for (index, scene) in stored.document["scenes"]
        .as_array()
        .ok_or("native Scene array absent")?
        .iter()
        .enumerate()
    {
        let Some(slot) = scene.get("performance") else {
            continue;
        };
        let r: PerformanceEditionRef =
            serde_json::from_value(slot.clone()).map_err(|e| e.to_string())?;
        if r.schema != EDITION_REF_SCHEMA
            || !expression_file::digest_ref(&r.performance_digest)
            || r.expanded_bytes as usize > DOCUMENT_BYTES
        {
            return Err("native performance edition marker invalid".into());
        }
        let catalog = catalogs
            .get(r.catalog as usize)
            .ok_or("missing native performance asset catalog")?;
        let m = catalog
            .manifests()
            .get(r.manifest as usize)
            .ok_or("missing native performance edition manifest")?;
        if m.performance_digest != r.performance_digest || m.expanded_bytes != r.expanded_bytes {
            return Err("native performance edition marker/source differs".into());
        }
        used.insert(r.catalog as usize);
        markers.push((index, r));
    }
    canonical_document_metadata(&stored.document)?;
    if used.len() != catalogs.len() {
        return Err("unused native performance asset catalog".into());
    }
    let mut used_images = BTreeSet::new();
    let mut expanded = weight(&stored.document)? as i128
        + expression_file::expansion_delta(&stored.document, None, &images, &mut used_images)?;
    if used_images.len() != images.len() {
        return Err("unused native embedded image".into());
    }
    for (index, r) in &markers {
        expanded = expanded
            .checked_add(
                i128::from(r.expanded_bytes)
                    - weight(&stored.document["scenes"][*index]["performance"])? as i128,
            )
            .ok_or("native file expansion overflow")?;
    }
    if expanded < 0 || expanded as usize > DOCUMENT_BYTES {
        return Err("complete native Document exceeds 8 MiB before cloning".into());
    }
    for (index, r) in markers {
        let p = catalogs[r.catalog as usize].restore(r.manifest as usize)?;
        stored.document["scenes"][index]["performance"] =
            serde_json::to_value(p).map_err(|e| e.to_string())?;
    }
    expression_file::expand(&mut stored.document, &images);
    let document: Document = serde_json::from_value(stored.document).map_err(|e| e.to_string())?;
    document.validate()?;
    if expression_file::digest(&serde_json::to_vec(&document).map_err(|e| e.to_string())?)
        != stored.expanded_document_sha256
    {
        return Err("expanded native performance Document digest differs".into());
    }
    Ok(document)
}

/// Versioned native Act custody keeps indexed immutable Document editions.
/// Act passages reference these indexes. Only seek restores one full Document;
/// public index reads do not expand hundreds of historical performances.
pub const ACT_CUSTODY_SCHEMA: &str = "oi.expression-act-performance-custody/v1";
pub const SOURCE_ACT_CUSTODY_SCHEMA: &str = "oi.expression-act-performance-custody/v2";
pub const RECORDING_ACT_CUSTODY_SCHEMA: &str = "oi.expression-act-performance-custody/v3";
#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct SceneEdition {
    pub scene_part: String,
    pub revision: u64,
    pub performance_catalog: Option<String>,
    pub performance_manifest: Option<u32>,
}
#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct DocumentEdition {
    pub fields: BTreeMap<String, String>,
    pub scenes: Vec<SceneEdition>,
    pub expanded_document_sha256: String,
    pub expanded_bytes: u32,
}
#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct EditionLiteral {
    pub r#ref: String,
    pub value: Value,
}
#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct StoredActPerformanceCustody<P = StoredPerformanceParts> {
    pub schema: String,
    pub documents: Vec<DocumentEdition>,
    pub literals: Vec<EditionLiteral>,
    pub performance_catalogs: BTreeMap<String, P>,
}
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct ActPerformanceCustody {
    documents: Vec<DocumentEdition>,
    literals: BTreeMap<String, std::sync::Arc<Value>>,
    performance_catalogs: BTreeMap<String, std::sync::Arc<PerformancePartCatalog>>,
}
/// Qualification belongs to one complete native validation/selection call.
/// The borrowed dictionary cannot change during that call. Field role remains
/// part of the key: identical literal bytes cannot qualify a different type.
#[derive(Default)]
struct EditionQualification<'a> {
    fields: BTreeMap<(&'a str, &'a str), usize>,
    scenes: BTreeMap<&'a str, usize>,
}
impl<'a> EditionQualification<'a> {
    fn field(&mut self, key: &'a str, reference: &'a str, value: &Value) -> Result<usize, String> {
        if let Some(size) = self.fields.get(&(key, reference)) {
            return Ok(*size);
        }
        crate::expression_act_storage::canonical_field(key, value)?;
        let size = weight(key)? + 1 + weight(value)? + 1;
        self.fields.insert((key, reference), size);
        Ok(size)
    }
    fn scene(&mut self, reference: &'a str, value: &Value, revision: u64) -> Result<usize, String> {
        if let Some(size) = self.scenes.get(reference) {
            return Ok(*size);
        }
        // SceneEdition already types each revision as u64. The canonical
        // comparison removes that separately retained revision; every edition
        // still measures its own revision below, including digit-width changes.
        canonical_scene_metadata(value, &Value::from(revision))?;
        let size = weight(value)?;
        self.scenes.insert(reference, size);
        Ok(size)
    }
}
impl Serialize for ActPerformanceCustody {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        use serde::ser::{SerializeMap, SerializeSeq};
        #[derive(Serialize)]
        struct Literal<'a> {
            r#ref: &'a str,
            value: &'a Value,
        }
        struct Literals<'a>(&'a BTreeMap<String, std::sync::Arc<Value>>);
        impl Serialize for Literals<'_> {
            fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
                let mut out = s.serialize_seq(Some(self.0.len()))?;
                for (r, v) in self.0 {
                    out.serialize_element(&Literal {
                        r#ref: r,
                        value: v.as_ref(),
                    })?;
                }
                out.end()
            }
        }
        struct Catalogs<'a>(&'a BTreeMap<String, std::sync::Arc<PerformancePartCatalog>>);
        impl Serialize for Catalogs<'_> {
            fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
                let mut out = s.serialize_map(Some(self.0.len()))?;
                for (r, v) in self.0 {
                    out.serialize_entry(r, v.as_ref())?;
                }
                out.end()
            }
        }
        let mut out = s.serialize_map(Some(4))?;
        out.serialize_entry("schema", self.schema())?;
        out.serialize_entry("documents", &self.documents)?;
        out.serialize_entry("literals", &Literals(&self.literals))?;
        out.serialize_entry(
            "performance_catalogs",
            &Catalogs(&self.performance_catalogs),
        )?;
        out.end()
    }
}
impl<'de> Deserialize<'de> for ActPerformanceCustody {
    fn deserialize<D: serde::Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        Self::read_value(Value::deserialize(d)?).map_err(serde::de::Error::custom)
    }
}
impl ActPerformanceCustody {
    pub fn has_native_sources(&self) -> bool {
        self.performance_catalogs
            .values()
            .any(|c| c.has_native_sources())
    }
    pub fn has_native_recordings(&self) -> bool {
        self.performance_catalogs
            .values()
            .any(|catalog| catalog.has_native_recordings())
    }
    pub fn schema(&self) -> &'static str {
        if self.has_native_recordings() {
            RECORDING_ACT_CUSTODY_SCHEMA
        } else if self.has_native_sources() {
            SOURCE_ACT_CUSTODY_SCHEMA
        } else {
            ACT_CUSTODY_SCHEMA
        }
    }
    fn literal(&mut self, v: Value) -> Result<String, String> {
        no_refs(&v)?;
        let r = expression_file::digest(&serde_json::to_vec(&v).map_err(|e| e.to_string())?);
        if let Some(old) = self.literals.get(&r) {
            if old.as_ref() != &v {
                return Err("native Act literal digest collision".into());
            }
        } else {
            if self.literals.len() >= 8192 {
                return Err("native Act literal part budget exceeded".into());
            }
            self.literals.insert(r.clone(), std::sync::Arc::new(v));
        }
        Ok(r)
    }
    pub fn editions(&self) -> &[DocumentEdition] {
        &self.documents
    }
    /// Stage before the existing native Document/Act CAS. Body/voice checkpoints
    /// remain indexed immutable parts; no per-block Document edition is created.
    pub fn appended(&self, document: &Document) -> Result<Self, String> {
        document.validate()?;
        if self.documents.len() >= 513 {
            return Err("native Act passage budget exceeded".into());
        }
        let mut next = self.clone();
        let mut fields = serde_json::to_value(document)
            .map_err(|e| e.to_string())?
            .as_object()
            .ok_or("native Document object absent")?
            .clone();
        fields.remove("scenes");
        let mut refs = BTreeMap::new();
        for (key, value) in fields {
            refs.insert(key, next.literal(value)?);
        }
        let mut scenes = Vec::new();
        for scene in &document.scenes {
            let mut metadata = serde_json::to_value(scene).map_err(|e| e.to_string())?;
            metadata.as_object_mut().unwrap().remove("revision");
            metadata.as_object_mut().unwrap().remove("performance");
            let scene_part = next.literal(metadata)?;
            let (performance_catalog, performance_manifest) = if let Some(p) = &scene.performance {
                let old = next
                    .performance_catalogs
                    .get(&scene.scene_ref)
                    .map(|c| c.as_ref().clone())
                    .unwrap_or_default();
                let manifest = old.manifests().len() as u32;
                let admitted = old.appended(p)?;
                next.performance_catalogs
                    .insert(scene.scene_ref.clone(), std::sync::Arc::new(admitted));
                (Some(scene.scene_ref.clone()), Some(manifest))
            } else {
                (None, None)
            };
            scenes.push(SceneEdition {
                scene_part,
                revision: scene.revision,
                performance_catalog,
                performance_manifest,
            });
        }
        next.documents.push(DocumentEdition {
            fields: refs,
            scenes,
            expanded_document_sha256: expression_file::digest(
                &serde_json::to_vec(document).map_err(|e| e.to_string())?,
            ),
            expanded_bytes: u32::try_from(weight(document)?)
                .map_err(|_| "native Document expanded size overflow")?,
        });
        next.validate()?;
        Ok(next)
    }
    pub(crate) fn validate(&self) -> Result<(), String> {
        if self.documents.len() > 513
            || self.literals.len() > 8192
            || self.performance_catalogs.len() > 64
        {
            return Err("native Act edition/dictionary budget exceeded".into());
        }
        let mut used_literals = BTreeSet::new();
        let mut used_catalogs = BTreeSet::new();
        let mut qualification = EditionQualification::default();
        for (r, value) in &self.literals {
            no_refs(value)?;
            if expression_file::digest(
                &serde_json::to_vec(value.as_ref()).map_err(|e| e.to_string())?,
            ) != *r
            {
                return Err("native Act edition literal digest differs".into());
            }
        }
        for (index, d) in self.documents.iter().enumerate() {
            if !expression_file::digest_ref(&d.expanded_document_sha256)
                || d.expanded_bytes as usize > DOCUMENT_BYTES
                || d.scenes.is_empty()
                || d.scenes.len() > 64
            {
                return Err("native Act Document manifest budget/digest invalid".into());
            }
            const REQUIRED: [&str; 13] = [
                "schema",
                "expression_ref",
                "revision",
                "title",
                "entities",
                "relations",
                "selection",
                "provenance",
                "representations",
                "refinements",
                "collections",
                "profiles",
                "scenes",
            ];
            if REQUIRED
                .iter()
                .filter(|k| **k != "scenes")
                .any(|k| !d.fields.contains_key(*k))
                || d.fields.keys().any(|k| {
                    !REQUIRED.contains(&k.as_str())
                        && !["presentation", "reuse"].contains(&k.as_str())
                })
            {
                return Err("native Act Document manifest lost canonical fields".into());
            }
            for (key, r) in &d.fields {
                let literal = self
                    .literals
                    .get(r)
                    .ok_or("missing native Act edition literal")?;
                qualification.field(key.as_str(), r.as_str(), literal)?;
                used_literals.insert(r.clone());
            }
            for s in &d.scenes {
                if !self.literals.contains_key(&s.scene_part) {
                    return Err("missing native Act Scene metadata".into());
                }
                let metadata = self.literals.get(&s.scene_part).unwrap();
                qualification.scene(s.scene_part.as_str(), metadata, s.revision)?;
                used_literals.insert(s.scene_part.clone());
                match (&s.performance_catalog, s.performance_manifest) {
                    (None, None) => {}
                    (Some(r), Some(i)) => {
                        let c = self
                            .performance_catalogs
                            .get(r)
                            .ok_or("missing native Act performance catalog")?;
                        if c.manifests().get(i as usize).is_none() {
                            return Err("missing native Act performance manifest".into());
                        }
                        used_catalogs.insert(r.clone());
                    }
                    _ => return Err("partial native Act performance binding".into()),
                }
            }
            self.selected_weight_with(index, &mut qualification)?;
        }
        if used_literals.len() != self.literals.len()
            || used_catalogs.len() != self.performance_catalogs.len()
        {
            return Err("unused native Act edition material".into());
        }
        // These are actual unique serialization budgets; history is not expanded
        // merely to count the same immutable page hundreds of times.
        if self.encoded_bytes()? > expression_file::FILE_BYTES {
            return Err("native indexed Act record exceeds 4 MiB".into());
        }
        Ok(())
    }
    pub fn document_identity(&self, index: usize) -> Result<(&str, u64, &str, u32), String> {
        let d = self
            .documents
            .get(index)
            .ok_or("native Act Document edition absent")?;
        let field = |key: &str| -> Result<&Value, String> {
            self.literals
                .get(
                    d.fields
                        .get(key)
                        .ok_or("native edition identity field absent")?,
                )
                .map(|v| v.as_ref())
                .ok_or_else(|| "native edition identity literal absent".into())
        };
        Ok((
            field("expression_ref")?
                .as_str()
                .ok_or("native edition Expression ref invalid")?,
            field("revision")?
                .as_u64()
                .ok_or("native edition revision invalid")?,
            &d.expanded_document_sha256,
            d.expanded_bytes,
        ))
    }
    fn selected_weight(&self, index: usize) -> Result<usize, String> {
        self.selected_weight_with(index, &mut EditionQualification::default())
    }
    fn selected_weight_with<'a>(
        &'a self,
        index: usize,
        qualification: &mut EditionQualification<'a>,
    ) -> Result<usize, String> {
        let d = self
            .documents
            .get(index)
            .ok_or("native Act Document edition absent")?;
        // Bound actual selected expansion before any literal or page clone.
        let mut expanded = 2usize;
        for (key, r) in &d.fields {
            let v = self
                .literals
                .get(r)
                .ok_or("missing native Act edition literal")?;
            let size = qualification.field(key.as_str(), r.as_str(), v)?;
            expanded = expanded
                .checked_add(size)
                .ok_or("native Act selected size overflow")?;
        }
        let mut scene_bytes = 2usize;
        for scene in &d.scenes {
            let metadata = self
                .literals
                .get(&scene.scene_part)
                .ok_or("missing native Act Scene metadata")?;
            let metadata_bytes =
                qualification.scene(scene.scene_part.as_str(), metadata, scene.revision)?;
            let mut size = metadata_bytes
                .checked_add(11 + weight(&scene.revision)?)
                .ok_or("native Scene size overflow")?;
            // comma + quoted revision key + colon = 12 bytes.
            size = size.checked_add(1).ok_or("native Scene size overflow")?;
            if let (Some(r), Some(i)) = (&scene.performance_catalog, scene.performance_manifest) {
                let m = self
                    .performance_catalogs
                    .get(r)
                    .ok_or("missing native Act performance catalog")?
                    .manifests()
                    .get(i as usize)
                    .ok_or("missing native Act performance manifest")?;
                size = size
                    .checked_add(15 + m.expanded_bytes as usize)
                    .ok_or("native Scene performance size overflow")?;
            }
            scene_bytes = scene_bytes
                .checked_add(size + 1)
                .ok_or("native Scene array size overflow")?;
        }
        if !d.scenes.is_empty() {
            scene_bytes -= 1;
        }
        // Existing fields all contribute a trailing comma; the added scenes
        // field follows them and therefore needs no extra separator.
        expanded = expanded
            .checked_add(9 + scene_bytes)
            .ok_or("native Document size overflow")?;
        if expanded > DOCUMENT_BYTES || expanded != d.expanded_bytes as usize {
            return Err("native Act selected Document weight differs before cloning".into());
        }
        Ok(expanded)
    }
    pub fn restore(&self, index: usize) -> Result<Document, String> {
        self.selected_weight(index)?;
        let d = self
            .documents
            .get(index)
            .ok_or("native Act Document edition absent")?;
        let mut fields = serde_json::Map::new();
        for (key, r) in &d.fields {
            fields.insert(
                key.clone(),
                self.literals
                    .get(r)
                    .ok_or("missing native Act edition literal")?
                    .as_ref()
                    .clone(),
            );
        }
        let mut scenes = Vec::with_capacity(d.scenes.len());
        for s in &d.scenes {
            let mut scene = self
                .literals
                .get(&s.scene_part)
                .ok_or("missing native Act Scene metadata")?
                .as_ref()
                .clone();
            scene["revision"] = Value::from(s.revision);
            if let (Some(r), Some(i)) = (&s.performance_catalog, s.performance_manifest) {
                let p = self
                    .performance_catalogs
                    .get(r)
                    .ok_or("missing native Act performance catalog")?
                    .restore(i as usize)?;
                scene["performance"] = serde_json::to_value(p).map_err(|e| e.to_string())?;
            }
            scenes.push(scene);
        }
        fields.insert("scenes".into(), Value::Array(scenes));
        let value = Value::Object(fields);
        if weight(&value)? > DOCUMENT_BYTES {
            return Err("native Act selected Document exceeds 8 MiB before typed clone".into());
        }
        let document: Document = serde_json::from_value(value).map_err(|e| e.to_string())?;
        document.validate()?;
        let raw = serde_json::to_vec(&document).map_err(|e| e.to_string())?;
        if raw.len() != d.expanded_bytes as usize
            || expression_file::digest(&raw) != d.expanded_document_sha256
        {
            return Err("restored native Act Document differs from exact edition".into());
        }
        Ok(document)
    }
    pub fn snapshot(&self) -> StoredActPerformanceCustody {
        StoredActPerformanceCustody {
            schema: self.schema().into(),
            documents: self.documents.clone(),
            literals: self
                .literals
                .iter()
                .map(|(r, v)| EditionLiteral {
                    r#ref: r.clone(),
                    value: v.as_ref().clone(),
                })
                .collect(),
            performance_catalogs: self
                .performance_catalogs
                .iter()
                .map(|(r, c)| (r.clone(), c.snapshot()))
                .collect(),
        }
    }
    pub fn read(stored: StoredActPerformanceCustody) -> Result<Self, String> {
        Self::read_value(serde_json::to_value(stored).map_err(|e| e.to_string())?)
    }
    pub fn read_value(value: Value) -> Result<Self, String> {
        safe_storage(&value, 0)?;
        if weight(&value)? > expression_file::FILE_BYTES {
            return Err("native Act performance custody exceeds physical record budget".into());
        }
        let stored =
            StoredActPerformanceCustody::<Value>::deserialize(&value).map_err(|e| e.to_string())?;
        if serde_json::to_value(&stored).map_err(|e| e.to_string())? != value {
            return Err("native Act custody omitted canonical defaults".into());
        }
        if ![
            ACT_CUSTODY_SCHEMA,
            SOURCE_ACT_CUSTODY_SCHEMA,
            RECORDING_ACT_CUSTODY_SCHEMA,
        ]
        .contains(&stored.schema.as_str())
            || stored.documents.len() > 513
            || stored.literals.len() > 8192
            || stored.performance_catalogs.len() > 64
        {
            return Err("native Act performance custody contract/budget invalid".into());
        }
        let schema = stored.schema;
        let mut literals = BTreeMap::new();
        for l in stored.literals {
            if !expression_file::digest_ref(&l.r#ref)
                || literals
                    .insert(l.r#ref, std::sync::Arc::new(l.value))
                    .is_some()
            {
                return Err("duplicate/invalid native Act edition literal".into());
            }
        }
        let performance_catalogs = stored
            .performance_catalogs
            .into_iter()
            .map(|(r, c)| {
                Ok((
                    r,
                    std::sync::Arc::new(PerformancePartCatalog::read_value(c)?),
                ))
            })
            .collect::<Result<_, String>>()?;
        let result = Self {
            documents: stored.documents,
            literals,
            performance_catalogs,
        };
        if schema != result.schema() {
            return Err("native source Act custody version/content differs".into());
        }
        result.validate()?;
        Ok(result)
    }
    pub fn encoded_bytes(&self) -> Result<usize, String> {
        weight(self)
    }
    pub fn requires_private_disclosure(&self) -> bool {
        self.performance_catalogs
            .values()
            .any(|c| c.requires_private_disclosure())
    }
}
