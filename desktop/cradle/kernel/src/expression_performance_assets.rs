//! Lossless immutable performance parts in existing Expression file/Act custody.
//! Historical editions share exact Arc parts and persistent content indexes.
//! One selected edition restores a full native Performance. This payload has
//! no independent location, file writer, project identity, store or clock.
use crate::expression_performance::{
    CheckpointBinding, EventPage, Performance, PerformanceBasis, MAX_PERFORMANCE_BYTES,
};
use crate::expression_performance_source_asset::NativePerformanceSourceAsset;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, BTreeSet};
use std::sync::Arc;
pub const MANIFEST_SCHEMA: &str = "oi.expression-performance-manifest/v1";
pub const INDEX_SCHEMA: &str = "oi.expression-performance-part-index/v1";
pub const CATALOG_SCHEMA: &str = "oi.expression-performance-parts/v1";
pub const SOURCE_CATALOG_SCHEMA: &str = "oi.expression-performance-parts/v2";
pub const RECORDING_CATALOG_SCHEMA: &str = "oi.expression-performance-parts/v3";
pub const MAX_PARTS: usize = 8192;
pub const MAX_MANIFESTS: usize = 513;
pub const MAX_ENCODED_BYTES: usize = 4 * 1024 * 1024;
pub const MAX_LIVE_BYTES: usize = 64 * 1024 * 1024;
#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(
    tag = "kind",
    content = "value",
    rename_all = "snake_case",
    deny_unknown_fields
)]
pub enum PerformancePart {
    EventPage(EventPage),
    EncodedEventPage(crate::expression_performance_codec::EncodedPage),
    NativeRecording(crate::expression_performance_recording::NativeRecordingPage),
    Basis(Box<PerformanceBasis>),
    Checkpoint(Box<CheckpointBinding>),
    EncodedCheckpoint(crate::expression_performance_codec::EncodedPage),
    Index(PartIndex),
    Header(PerformanceHeader),
    NativeSource(Box<NativePerformanceSourceAsset>),
}
#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct PerformanceHeader {
    pub schema: String,
    pub performance_ref: String,
    pub sample_rate: u32,
    pub ppq: u16,
    pub pitches: Vec<crate::expression_performance::Pitch>,
    pub layers: Vec<crate::expression_performance::Layer>,
    pub parameters: Vec<crate::expression_performance::ParameterTarget>,
    pub routes: Vec<crate::expression_performance::ModulationRoute>,
    pub tempo: Vec<crate::expression_performance::TempoSegment>,
    pub replay: crate::expression_performance::ReplayPolicy,
}
#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(tag = "node", rename_all = "snake_case", deny_unknown_fields)]
pub enum PartIndex {
    Leaf {
        part: String,
        kind: String,
        expanded_bytes: u32,
    },
    Branch {
        left: String,
        right: String,
        kind: String,
        items: u32,
        expanded_bytes: u32,
    },
}
impl PartIndex {
    fn kind(&self) -> &str {
        match self {
            Self::Leaf { kind, .. } | Self::Branch { kind, .. } => kind,
        }
    }
    fn items(&self) -> u32 {
        match self {
            Self::Leaf { .. } => 1,
            Self::Branch { items, .. } => *items,
        }
    }
    fn bytes(&self) -> u32 {
        match self {
            Self::Leaf { expanded_bytes, .. } | Self::Branch { expanded_bytes, .. } => {
                *expanded_bytes
            }
        }
    }
    fn validate(&self) -> Result<(), String> {
        if ![
            "basis",
            "event_page",
            "checkpoint",
            "native_source",
            "native_recording",
        ]
        .contains(&self.kind())
            || self.items() == 0
            || self.items() > 8192
            || self.bytes() as usize > MAX_PERFORMANCE_BYTES
        {
            return Err("native performance index kind/count/budget invalid".into());
        }
        match self {
            Self::Leaf { part, .. } => check_digest(part)?,
            Self::Branch {
                left, right, items, ..
            } => {
                check_digest(left)?;
                check_digest(right)?;
                if *items < 2 {
                    return Err("native performance branch count invalid".into());
                }
            }
        }
        Ok(())
    }
}
impl PerformancePart {
    fn kind(&self) -> &'static str {
        match self {
            Self::EventPage(_) | Self::EncodedEventPage(_) => "event_page",
            Self::NativeRecording(_) => "native_recording",
            Self::Basis(_) => "basis",
            Self::Checkpoint(_) | Self::EncodedCheckpoint(_) => "checkpoint",
            Self::Index(_) => "index",
            Self::Header(_) => "header",
            Self::NativeSource(_) => "native_source",
        }
    }
    fn value(&self) -> Result<Value, String> {
        match self {
            Self::EventPage(v) => serde_json::to_value(v),
            Self::EncodedEventPage(v) => {
                return serde_json::to_value(v.read::<EventPage>()?).map_err(|e| e.to_string());
            }
            Self::NativeRecording(v) => serde_json::to_value(v),
            Self::Basis(v) => serde_json::to_value(v),
            Self::Checkpoint(v) => serde_json::to_value(v),
            Self::EncodedCheckpoint(v) => {
                return serde_json::to_value(v.read::<CheckpointBinding>()?)
                    .map_err(|e| e.to_string());
            }
            Self::Index(v) => serde_json::to_value(v),
            Self::Header(v) => serde_json::to_value(v),
            Self::NativeSource(v) => serde_json::to_value(v),
        }
        .map_err(|e| e.to_string())
    }
    fn validate(&self) -> Result<(), String> {
        match self {
            Self::NativeRecording(v) => v.validate()?,
            Self::EncodedEventPage(v) => {
                let page = v.read::<EventPage>()?;
                if page.events.is_empty()
                    || page.events.len() > crate::expression_performance::MAX_PAGE_EVENTS
                {
                    return Err("encoded event page budget differs".into());
                }
            }
            Self::Basis(v) => v.validate()?,
            Self::Checkpoint(v) => v.validate()?,
            Self::EncodedCheckpoint(v) => v.read::<CheckpointBinding>()?.validate()?,
            Self::Index(v) => return v.validate(),
            Self::NativeSource(v) => v.validate()?,
            Self::Header(v) => {
                if ![
                    crate::expression_performance::SCHEMA,
                    crate::expression_performance::SOURCE_SCHEMA,
                    crate::expression_performance::RECORDING_SCHEMA,
                ]
                .contains(&v.schema.as_str())
                    || !(8000..=192000).contains(&v.sample_rate)
                    || v.ppq == 0
                    || v.ppq > 32767
                    || v.layers.is_empty()
                    || v.layers.len() > crate::expression_performance::MAX_LAYERS
                    || v.pitches.len() > crate::expression_performance::MAX_PITCHES
                    || v.routes.len() > crate::expression_performance::MAX_ROUTES
                    || v.parameters.len() > crate::expression_performance::MAX_ROUTES
                    || v.tempo.is_empty()
                    || v.tempo.len() > 256
                {
                    return Err("native performance header budget invalid".into());
                }
            }
            Self::EventPage(v) => {
                if v.events.is_empty()
                    || v.events.len() > crate::expression_performance::MAX_PAGE_EVENTS
                {
                    return Err("performance asset page budget invalid".into());
                }
            }
        }
        reject_indexes(&self.value()?)
    }
}
fn digest<T: Serialize + ?Sized>(v: &T) -> Result<String, String> {
    Ok(format!(
        "sha256:{:x}",
        Sha256::digest(serde_json::to_vec(v).map_err(|e| e.to_string())?)
    ))
}
fn encoded<T: Serialize + ?Sized>(v: &T) -> Result<usize, String> {
    crate::expression_act_storage::measure(v, crate::expression_act_storage::LIVE_BYTES)
}
fn check_digest(v: &str) -> Result<(), String> {
    if !v.strip_prefix("sha256:").is_some_and(|x| {
        x.len() == 64
            && x.bytes()
                .all(|b| b.is_ascii_hexdigit() && !b.is_ascii_uppercase())
    }) {
        return Err("native performance content digest invalid".into());
    }
    Ok(())
}
fn reject_indexes(v: &Value) -> Result<(), String> {
    if [
        INDEX_SCHEMA,
        MANIFEST_SCHEMA,
        CATALOG_SCHEMA,
        SOURCE_CATALOG_SCHEMA,
        RECORDING_CATALOG_SCHEMA,
    ]
    .iter()
    .any(|s| v["schema"] == *s)
    {
        return Err("performance index outside its typed manifest slot".into());
    }
    match v {
        Value::Array(a) => {
            for x in a {
                reject_indexes(x)?;
            }
        }
        Value::Object(o) => {
            for x in o.values() {
                reject_indexes(x)?;
            }
        }
        _ => {}
    }
    Ok(())
}
#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct IndexReference {
    pub schema: String,
    pub kind: String,
    pub r#ref: String,
    pub items: u32,
    pub expanded_bytes: u32,
}
#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct PerformanceManifest {
    pub schema: String,
    /// Canonical fields; only bases/pages/checkpoints can be indexed arrays.
    pub performance: Value,
    pub header_ref: String,
    pub performance_digest: String,
    pub expanded_performance_sha256: String,
    pub expanded_bytes: u32,
    pub private_context: bool,
}
impl PerformanceManifest {
    fn roots(&self) -> Result<Vec<(&str, IndexReference)>, String> {
        if self.schema != MANIFEST_SCHEMA || self.expanded_bytes as usize > MAX_PERFORMANCE_BYTES {
            return Err("performance manifest contract/budget invalid".into());
        }
        check_digest(&self.header_ref)?;
        check_digest(&self.performance_digest)?;
        check_digest(&self.expanded_performance_sha256)?;
        let object = self
            .performance
            .as_object()
            .ok_or("performance manifest needs native fields")?;
        let mut roots = Vec::new();
        for (key, value) in object {
            match key.as_str() {
                "bases" | "pages" | "checkpoints" | "native_sources" | "native_recordings" => {
                    if value.as_array().is_some_and(Vec::is_empty) {
                        continue;
                    }
                    let kind = match key.as_str() {
                        "bases" => "basis",
                        "pages" => "event_page",
                        "checkpoints" => "checkpoint",
                        "native_sources" => "native_source",
                        _ => "native_recording",
                    };
                    let r: IndexReference =
                        serde_json::from_value(value.clone()).map_err(|e| e.to_string())?;
                    let limit = match kind {
                        "basis" => crate::expression_performance::MAX_BASES,
                        "event_page" => crate::expression_performance::MAX_PAGES,
                        "checkpoint" => crate::expression_performance::MAX_CHECKPOINTS,
                        "native_recording" => crate::expression_performance::MAX_PAGES,
                        _ => crate::expression_performance::MAX_BASES,
                    };
                    if r.schema != INDEX_SCHEMA
                        || r.kind != kind
                        || r.items == 0
                        || r.items as usize > limit
                        || r.expanded_bytes as usize > MAX_PERFORMANCE_BYTES
                    {
                        return Err("performance index kind/count/weight invalid".into());
                    }
                    check_digest(&r.r#ref)?;
                    roots.push((key.as_str(), r));
                }
                _ => reject_indexes(value)?,
            }
        }
        for key in ["bases", "pages", "checkpoints"] {
            if !object.contains_key(key) {
                return Err("performance manifest lost native part field".into());
            }
        }
        Ok(roots)
    }
    pub fn references(&self) -> Result<Vec<IndexReference>, String> {
        Ok(self.roots()?.into_iter().map(|(_, r)| r).collect())
    }
}
#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct StoredPart {
    pub r#ref: String,
    pub part: PerformancePart,
}
/// Embedded in the current native file/Act versioned envelope, never saved alone.
#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct StoredPerformanceParts {
    pub schema: String,
    pub manifests: Vec<PerformanceManifest>,
    pub parts: Vec<StoredPart>,
}
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct PerformancePartCatalog {
    parts: BTreeMap<String, Arc<PerformancePart>>,
    manifests: Vec<PerformanceManifest>,
}
impl Serialize for PerformancePartCatalog {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        use serde::ser::{SerializeMap, SerializeSeq};
        #[derive(Serialize)]
        struct BorrowPart<'a> {
            r#ref: &'a str,
            part: &'a PerformancePart,
        }
        struct Parts<'a>(&'a BTreeMap<String, Arc<PerformancePart>>);
        impl Serialize for Parts<'_> {
            fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
                let mut out = s.serialize_seq(Some(self.0.len()))?;
                for (r, p) in self.0 {
                    out.serialize_element(&BorrowPart {
                        r#ref: r,
                        part: p.as_ref(),
                    })?;
                }
                out.end()
            }
        }
        let mut out = s.serialize_map(Some(3))?;
        out.serialize_entry("schema", self.schema())?;
        out.serialize_entry("manifests", &self.manifests)?;
        out.serialize_entry("parts", &Parts(&self.parts))?;
        out.end()
    }
}
impl<'de> Deserialize<'de> for PerformancePartCatalog {
    fn deserialize<D: serde::Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        Self::read_value(Value::deserialize(d)?).map_err(serde::de::Error::custom)
    }
}
struct Walk {
    items: u32,
    bytes: u32,
    private: bool,
}
impl PerformancePartCatalog {
    /// Canonical qualification precedes typed default expansion. Each value
    /// is one physically bounded dictionary, never expanded history.
    pub fn read_value(value: Value) -> Result<Self, String> {
        if encoded(&value)? > MAX_ENCODED_BYTES {
            return Err("native source catalog encoded budget exceeded before typing".into());
        }
        let typed = StoredPerformanceParts::deserialize(&value).map_err(|e| e.to_string())?;
        if digest(&serde_json::to_value(&typed).map_err(|e| e.to_string())?)? != digest(&value)? {
            return Err(
                "native performance catalog omitted or changed canonical typed defaults".into(),
            );
        }
        Self::read(typed)
    }
    pub fn has_native_sources(&self) -> bool {
        self.parts
            .values()
            .any(|p| matches!(p.as_ref(), PerformancePart::NativeSource(_)))
    }
    pub fn has_native_recordings(&self) -> bool {
        self.parts
            .values()
            .any(|p| matches!(p.as_ref(), PerformancePart::NativeRecording(_)) || matches!(p.as_ref(), PerformancePart::Header(h) if h.schema == crate::expression_performance::RECORDING_SCHEMA))
    }
    pub fn schema(&self) -> &'static str {
        if self.has_native_recordings() {
            RECORDING_CATALOG_SCHEMA
        } else if self.has_native_sources() {
            SOURCE_CATALOG_SCHEMA
        } else {
            CATALOG_SCHEMA
        }
    }
    pub fn manifests(&self) -> &[PerformanceManifest] {
        &self.manifests
    }
    pub fn unique_parts(&self) -> usize {
        self.parts.len()
    }
    fn insert(&mut self, part: PerformancePart) -> Result<String, String> {
        part.validate()?;
        let reference = digest(&part)?;
        if let Some(p) = self.parts.get(&reference) {
            if p.as_ref() != &part {
                return Err("performance asset hash collision".into());
            }
        } else {
            if self.parts.len() >= MAX_PARTS {
                return Err("native performance part budget exceeded".into());
            }
            self.parts.insert(reference.clone(), Arc::new(part));
        }
        Ok(reference)
    }
    /// Canonical power-of-two left subtree keeps append-only indexes persistent:
    /// all full prior subtrees are shared; only the right path changes.
    fn index(&mut self, parts: &[(String, u32)], kind: &str) -> Result<(String, u32), String> {
        if parts.is_empty() {
            return Err("cannot index an empty native part list".into());
        }
        if parts.len() == 1 {
            let bytes = parts[0].1;
            let reference = self.insert(PerformancePart::Index(PartIndex::Leaf {
                part: parts[0].0.clone(),
                kind: kind.into(),
                expanded_bytes: bytes,
            }))?;
            return Ok((reference, bytes));
        }
        let split = 1usize << ((usize::BITS - 1 - (parts.len() - 1).leading_zeros()) as usize);
        let (left, lbytes) = self.index(&parts[..split], kind)?;
        let (right, rbytes) = self.index(&parts[split..], kind)?;
        let bytes = lbytes
            .checked_add(rbytes)
            .and_then(|x| x.checked_add(1))
            .ok_or("native index size overflow")?;
        let reference = self.insert(PerformancePart::Index(PartIndex::Branch {
            left,
            right,
            kind: kind.into(),
            items: parts.len() as u32,
            expanded_bytes: bytes,
        }))?;
        Ok((reference, bytes))
    }
    /// Refusal leaves the live catalog untouched. Existing Act CAS commits the
    /// prospective catalog and new edition manifest together.
    pub fn appended(&self, p: &Performance) -> Result<Self, String> {
        p.validate()?;
        if self.manifests.len() >= MAX_MANIFESTS {
            return Err("native Act passage/manifest budget exceeded".into());
        }
        let mut next = self.clone();
        let mut value = serde_json::to_value(p).map_err(|e| e.to_string())?;
        reject_indexes(&value)?;
        let mut header = serde_json::Map::new();
        for key in [
            "schema",
            "performance_ref",
            "sample_rate",
            "ppq",
            "pitches",
            "layers",
            "parameters",
            "routes",
            "tempo",
            "replay",
        ] {
            header.insert(
                key.into(),
                value
                    .as_object_mut()
                    .ok_or("native performance fields absent")?
                    .remove(key)
                    .ok_or("native performance header field absent")?,
            );
        }
        let header: PerformanceHeader =
            serde_json::from_value(Value::Object(header)).map_err(|e| e.to_string())?;
        let header_ref = next.insert(PerformancePart::Header(header))?;
        for (key, kind, parts) in [
            (
                "bases",
                "basis",
                p.bases
                    .iter()
                    .cloned()
                    .map(|basis| PerformancePart::Basis(Box::new(basis)))
                    .collect::<Vec<_>>(),
            ),
            (
                "pages",
                "event_page",
                p.pages
                    .iter()
                    .cloned()
                    .map(|page| {
                        if p.native_recordings.is_empty() {
                            Ok(PerformancePart::EventPage(page))
                        } else {
                            crate::expression_performance_codec::EncodedPage::from_value(&page)
                                .map(PerformancePart::EncodedEventPage)
                        }
                    })
                    .collect::<Result<Vec<_>, String>>()?,
            ),
            (
                "checkpoints",
                "checkpoint",
                p.checkpoints
                    .iter()
                    .cloned()
                    .map(|checkpoint| {
                        if p.native_recordings.is_empty() {
                            Ok(PerformancePart::Checkpoint(Box::new(checkpoint)))
                        } else {
                            crate::expression_performance_codec::EncodedPage::from_value(
                                &checkpoint,
                            )
                            .map(PerformancePart::EncodedCheckpoint)
                        }
                    })
                    .collect::<Result<Vec<_>, String>>()?,
            ),
            (
                "native_recordings",
                "native_recording",
                p.native_recordings
                    .iter()
                    .cloned()
                    .map(PerformancePart::NativeRecording)
                    .collect::<Vec<_>>(),
            ),
            (
                "native_sources",
                "native_source",
                p.native_sources
                    .iter()
                    .cloned()
                    .map(|source| PerformancePart::NativeSource(Box::new(source)))
                    .collect::<Vec<_>>(),
            ),
        ] {
            if parts.is_empty() {
                if key == "native_sources" || key == "native_recordings" {
                    continue;
                }
                value[key] = Value::Array(Vec::new());
                continue;
            }
            let mut references = Vec::with_capacity(parts.len());
            for part in parts {
                let weight = u32::try_from(encoded(&part.value()?)?)
                    .map_err(|_| "native part size overflow")?;
                references.push((next.insert(part)?, weight));
            }
            let (reference, weight) = next.index(&references, kind)?;
            value[key] = serde_json::to_value(IndexReference {
                schema: INDEX_SCHEMA.into(),
                kind: kind.into(),
                r#ref: reference,
                items: references.len() as u32,
                expanded_bytes: weight.checked_add(2).ok_or("native array size overflow")?,
            })
            .map_err(|e| e.to_string())?;
        }
        next.manifests.push(PerformanceManifest {
            schema: MANIFEST_SCHEMA.into(),
            performance: value,
            header_ref,
            performance_digest: p.content_digest.clone(),
            expanded_performance_sha256: digest(p)?,
            expanded_bytes: u32::try_from(encoded(p)?)
                .map_err(|_| "performance expanded size overflow")?,
            private_context: p.bases.iter().any(|b| b.context.private)
                || p.native_sources
                    .iter()
                    .any(NativePerformanceSourceAsset::requires_private_disclosure),
        });
        next.validate_storage()?;
        Ok(next)
    }
    fn walk(
        &self,
        reference: &str,
        kind: &str,
        path: &mut BTreeSet<String>,
        used: &mut BTreeSet<String>,
        out: &mut Option<Vec<Value>>,
    ) -> Result<Walk, String> {
        if path.len() > 32 || !path.insert(reference.into()) {
            return Err("cyclic/deep native performance part index".into());
        }
        let part = self
            .parts
            .get(reference)
            .ok_or("missing immutable native performance part")?;
        used.insert(reference.into());
        let PerformancePart::Index(index) = part.as_ref() else {
            return Err("native performance index points to a data part".into());
        };
        if index.kind() != kind {
            return Err("native performance index kind mismatch".into());
        }
        let result = match index {
            PartIndex::Leaf {
                part,
                kind,
                expanded_bytes,
            } => {
                let data = self
                    .parts
                    .get(part)
                    .ok_or("missing immutable native performance data part")?;
                if data.kind() != kind || encoded(&data.value()?)? != *expanded_bytes as usize {
                    return Err("native performance leaf kind/weight differs".into());
                }
                used.insert(part.clone());
                let private = matches!(data.as_ref(),PerformancePart::Basis(b)if b.context.private)
                    || matches!(data.as_ref(), PerformancePart::NativeSource(source) if source.requires_private_disclosure());
                if let Some(values) = out {
                    values.push(data.value()?);
                }
                Walk {
                    items: 1,
                    bytes: *expanded_bytes,
                    private,
                }
            }
            PartIndex::Branch {
                left,
                right,
                items,
                expanded_bytes,
                ..
            } => {
                let l = self.walk(left, kind, path, used, out)?;
                let r = self.walk(right, kind, path, used, out)?;
                let count = l
                    .items
                    .checked_add(r.items)
                    .ok_or("native performance item overflow")?;
                let bytes = l
                    .bytes
                    .checked_add(r.bytes)
                    .and_then(|n| n.checked_add(1))
                    .ok_or("native performance index size overflow")?;
                if count != *items || bytes != *expanded_bytes {
                    return Err("native performance index declared count/weight differs".into());
                }
                Walk {
                    items: count,
                    bytes,
                    private: l.private || r.private,
                }
            }
        };
        path.remove(reference);
        Ok(result)
    }
    fn validate_storage(&self) -> Result<(), String> {
        if self.parts.len() > MAX_PARTS || self.manifests.len() > MAX_MANIFESTS {
            return Err("native performance part/manifest budget exceeded".into());
        }
        let mut used = BTreeSet::new();
        let mut bytes = 0usize;
        for (r, p) in &self.parts {
            p.validate()?;
            if let PerformancePart::NativeSource(source) = p.as_ref() {
                if source.reading()?.r#ref != *r {
                    return Err("native source leaf address differs".into());
                }
                let basis = self
                    .parts
                    .values()
                    .find_map(|p| match p.as_ref() {
                        PerformancePart::Basis(basis)
                            if basis.content_digest == source.basis_digest() =>
                        {
                            Some(basis)
                        }
                        _ => None,
                    })
                    .ok_or("native source asset lost its exact saved basis")?;
                source.validate_basis(basis)?;
            }
            if digest(p.as_ref())? != *r {
                return Err("performance asset digest differs".into());
            }
            bytes = bytes
                .checked_add(encoded(p.as_ref())?)
                .ok_or("retained performance size overflow")?;
        }
        for m in &self.manifests {
            let header = self
                .parts
                .get(&m.header_ref)
                .ok_or("missing immutable performance header")?;
            if !matches!(header.as_ref(), PerformancePart::Header(_)) {
                return Err("native performance header kind differs".into());
            }
            used.insert(m.header_ref.clone());
            let mut expected =
                encoded(&m.performance)? as i128 + encoded(&header.value()?)? as i128 - 1;
            let mut private = false;
            for (key, r) in m.roots()? {
                let w = self.walk(
                    &r.r#ref,
                    &r.kind,
                    &mut BTreeSet::new(),
                    &mut used,
                    &mut None,
                )?;
                let expanded = w
                    .bytes
                    .checked_add(2)
                    .ok_or("native array weight overflow")?;
                if w.items != r.items || expanded != r.expanded_bytes {
                    return Err("native performance root count/weight differs".into());
                }
                expected = expected
                    .checked_add(expanded as i128 - encoded(&m.performance[key])? as i128)
                    .ok_or("native performance expansion overflow")?;
                private |= w.private;
            }
            if expected < 0
                || expected as usize > MAX_PERFORMANCE_BYTES
                || expected as u32 != m.expanded_bytes
                || private != m.private_context
            {
                return Err("native performance manifest expanded weight/privacy differs".into());
            }
            bytes = bytes
                .checked_add(encoded(m)?)
                .ok_or("retained performance size overflow")?;
        }
        if used.len() != self.parts.len() {
            return Err("unused native performance part".into());
        }
        if bytes > MAX_LIVE_BYTES {
            return Err("unique retained performance state exceeds native live custody".into());
        }
        if self.encoded_bytes()? > MAX_ENCODED_BYTES {
            return Err("native performance file/Act part record exceeds 4 MiB".into());
        }
        Ok(())
    }
    /// Restore only one selected edition. The ordinary complete validator and
    /// native checkpoint owner still admit the material before live use.
    pub fn restore(&self, index: usize) -> Result<Performance, String> {
        let m = self
            .manifests
            .get(index)
            .ok_or("retained performance edition absent")?;
        let header = self
            .parts
            .get(&m.header_ref)
            .ok_or("missing immutable performance header")?;
        let PerformancePart::Header(_) = header.as_ref() else {
            return Err("native performance header kind differs".into());
        };
        let mut v = header.value()?;
        for (key, value) in m
            .performance
            .as_object()
            .ok_or("native performance manifest fields absent")?
        {
            if v.as_object_mut()
                .unwrap()
                .insert(key.clone(), value.clone())
                .is_some()
            {
                return Err("duplicate native performance header/edition field".into());
            }
        }
        for (key, r) in m.roots()? {
            let mut values = Some(Vec::with_capacity(r.items as usize));
            let w = self.walk(
                &r.r#ref,
                &r.kind,
                &mut BTreeSet::new(),
                &mut BTreeSet::new(),
                &mut values,
            )?;
            if w.items != r.items || w.bytes.checked_add(2) != Some(r.expanded_bytes) {
                return Err("native performance index changed".into());
            }
            v[key] = Value::Array(values.unwrap());
        }
        let p: Performance = serde_json::from_value(v).map_err(|e| e.to_string())?;
        p.validate()?;
        if p.content_digest != m.performance_digest
            || digest(&p)? != m.expanded_performance_sha256
            || encoded(&p)? != m.expanded_bytes as usize
        {
            return Err("restored native performance differs from retained edition".into());
        }
        Ok(p)
    }
    pub fn snapshot(&self) -> StoredPerformanceParts {
        StoredPerformanceParts {
            schema: self.schema().into(),
            manifests: self.manifests.clone(),
            parts: self
                .parts
                .iter()
                .map(|(r, p)| StoredPart {
                    r#ref: r.clone(),
                    part: p.as_ref().clone(),
                })
                .collect(),
        }
    }
    pub fn read(stored: StoredPerformanceParts) -> Result<Self, String> {
        if ![
            CATALOG_SCHEMA,
            SOURCE_CATALOG_SCHEMA,
            RECORDING_CATALOG_SCHEMA,
        ]
        .contains(&stored.schema.as_str())
            || stored.parts.len() > MAX_PARTS
            || stored.manifests.len() > MAX_MANIFESTS
        {
            return Err("unsupported native performance parts/budget".into());
        }
        let schema = stored.schema;
        let mut parts = BTreeMap::new();
        for p in stored.parts {
            check_digest(&p.r#ref)?;
            if digest(&p.part)? != p.r#ref || parts.insert(p.r#ref, Arc::new(p.part)).is_some() {
                return Err("corrupt or duplicate native performance asset".into());
            }
        }
        let result = Self {
            parts,
            manifests: stored.manifests,
        };
        if schema != result.schema() {
            return Err("native source catalog version/content differs".into());
        }
        result.validate_storage()?;
        // Retained manifests' full hashes are checked on selection. Reading
        // verifies every immutable asset/index and all declared amplification,
        // without expanding the entire history or discarding historical tails.
        Ok(result)
    }
    pub fn requires_private_disclosure(&self) -> bool {
        self.manifests.iter().any(|m| m.private_context)
    }
    pub fn encoded_bytes(&self) -> Result<usize, String> {
        encoded(self)
    }
    pub fn retained_references(&self, reference: &str) -> Option<usize> {
        self.parts.get(reference).map(Arc::strong_count)
    }
}
