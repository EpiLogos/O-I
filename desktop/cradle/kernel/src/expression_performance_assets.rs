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
use std::sync::{Arc, OnceLock, Weak};
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
    // Return the actual, canonical typed data once for this admission only.
    // No material or qualification is retained between catalog calls.
    fn qualified_value(&self) -> Result<Option<Value>, String> {
        let value = match self {
            Self::NativeRecording(v) => {
                v.validate()?;
                self.value()?
            }
            Self::EncodedEventPage(v) => {
                let page = v.read::<EventPage>()?;
                if page.events.is_empty()
                    || page.events.len() > crate::expression_performance::MAX_PAGE_EVENTS
                {
                    return Err("encoded event page budget differs".into());
                }
                serde_json::to_value(&page).map_err(|e| e.to_string())?
            }
            Self::Basis(v) => {
                v.validate()?;
                self.value()?
            }
            Self::Checkpoint(v) => {
                v.validate()?;
                self.value()?
            }
            Self::EncodedCheckpoint(v) => {
                let checkpoint = v.read::<CheckpointBinding>()?;
                checkpoint.validate()?;
                serde_json::to_value(&checkpoint).map_err(|e| e.to_string())?
            }
            Self::Index(v) => {
                v.validate()?;
                return Ok(None);
            }
            Self::NativeSource(v) => {
                v.validate()?;
                self.value()?
            }
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
                self.value()?
            }
            Self::EventPage(v) => {
                if v.events.is_empty()
                    || v.events.len() > crate::expression_performance::MAX_PAGE_EVENTS
                {
                    return Err("performance asset page budget invalid".into());
                }
                self.value()?
            }
        };
        reject_indexes(&value)?;
        Ok(Some(value))
    }
    fn validate(&self) -> Result<(), String> {
        self.qualified_value().map(|_| ())
    }
}
fn digest<T: Serialize + ?Sized>(v: &T) -> Result<String, String> {
    // Preserve the full native Serde stream without retaining a second buffer.
    // The independent admission/weight paths keep their original limits.
    Ok(crate::expression_act_storage::fingerprint(v, usize::MAX)?.1)
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
#[derive(Debug, Clone)]
struct QualifiedPartWeight {
    // Metadata proves only the weight of this exact previously admitted native
    // immutable part. It never retains an expanded value or admits selection.
    part: Weak<PerformancePart>,
    expanded_bytes: Option<usize>,
}
#[derive(Debug, Clone, Default)]
pub struct PerformancePartCatalog {
    parts: BTreeMap<String, Arc<PerformancePart>>,
    manifests: Vec<PerformanceManifest>,
    // Native-only scalar metadata. External reads construct an empty slot and
    // perform the original complete qualification before issuing this proof.
    qualified_part_weights: OnceLock<BTreeMap<String, QualifiedPartWeight>>,
}
impl PartialEq for PerformancePartCatalog {
    fn eq(&self, other: &Self) -> bool {
        self.parts == other.parts && self.manifests == other.manifests
    }
}
impl Eq for PerformancePartCatalog {}
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
#[derive(Clone)]
struct Walk {
    items: u32,
    bytes: u32,
    private: bool,
    depth: usize,
}
// Per-traversal qualification only; selected restitution has no weights.
#[derive(Default)]
struct WalkQualification<'a> {
    summaries: BTreeMap<String, Walk>,
    qualified_weights: Option<&'a BTreeMap<&'a str, usize>>,
}
/// Separate the exact native header and edition fields before any indexed
/// material is cloned. The exhaustive pattern makes new native fields an
/// explicit reconciliation. Part insertion still validates every full body and
/// rejects nested indexes; edition fields and header retain their own guards.
fn performance_fields(p: &Performance) -> Result<(PerformanceHeader, Value), String> {
    let Performance {
        schema,
        performance_ref,
        sample_rate,
        duration_samples,
        ppq,
        bases: _,
        pitches,
        layers,
        pages: _,
        parameters,
        routes,
        tempo,
        loop_range,
        position_sample,
        replay,
        checkpoints: _,
        native_sources,
        native_recordings,
        native_reservations,
        content_digest,
    } = p;
    let header = PerformanceHeader {
        schema: schema.clone(),
        performance_ref: performance_ref.clone(),
        sample_rate: *sample_rate,
        ppq: *ppq,
        pitches: pitches.clone(),
        layers: layers.clone(),
        parameters: parameters.clone(),
        routes: routes.clone(),
        tempo: tempo.clone(),
        replay: replay.clone(),
    };
    let mut fields = serde_json::Map::new();
    for (key, value) in [
        ("duration_samples", serde_json::to_value(duration_samples)),
        ("loop_range", serde_json::to_value(loop_range)),
        ("position_sample", serde_json::to_value(position_sample)),
        ("content_digest", serde_json::to_value(content_digest)),
    ] {
        fields.insert(key.into(), value.map_err(|e| e.to_string())?);
    }
    for key in ["bases", "pages", "checkpoints"] {
        fields.insert(key.into(), Value::Array(Vec::new()));
    }
    if !native_sources.is_empty() {
        fields.insert("native_sources".into(), Value::Array(Vec::new()));
    }
    if !native_recordings.is_empty() {
        fields.insert("native_recordings".into(), Value::Array(Vec::new()));
    }
    if !native_reservations.is_empty() {
        fields.insert(
            "native_reservations".into(),
            serde_json::to_value(native_reservations).map_err(|e| e.to_string())?,
        );
    }
    Ok((header, Value::Object(fields)))
}

impl PerformancePartCatalog {
    /// Canonical qualification precedes typed default expansion. Each value
    /// is one physically bounded dictionary, never expanded history.
    pub fn read_value(value: Value) -> Result<Self, String> {
        if encoded(&value)? > MAX_ENCODED_BYTES {
            return Err("native source catalog encoded budget exceeded before typing".into());
        }
        Self::read_decoded_value(value)
    }
    pub(crate) fn read_packed_value(
        value: Value,
        _proof: &crate::expression_performance_record_codec::PackedProof,
    ) -> Result<Self, String> {
        crate::expression_act_storage::measure(&value, MAX_LIVE_BYTES)?;
        Self::read_decoded_value(value)
    }
    fn read_decoded_value(value: Value) -> Result<Self, String> {
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
    // Existing immutable encoded parts may be reused only after exact original
    // canonical bytes equal the newly validated native value. No imported digest
    // is authority, no expanded part is cached, and collisions refuse atomically.
    fn encoded_part<T: Serialize + ?Sized>(
        &self,
        value: &T,
        checkpoint: bool,
    ) -> Result<PerformancePart, String> {
        crate::expression_act_storage::measure(
            value,
            crate::expression_performance_codec::MAX_DECODED_BYTES,
        )?;
        let raw = serde_json::to_vec(value).map_err(|e| e.to_string())?;
        let address = format!("sha256:{:x}", Sha256::digest(&raw));
        for part in self.parts.values() {
            let encoded = match (part.as_ref(), checkpoint) {
                (PerformancePart::EncodedCheckpoint(encoded), true)
                | (PerformancePart::EncodedEventPage(encoded), false) => encoded,
                _ => continue,
            };
            if encoded.decoded_digest() == address {
                if encoded.bytes()? != raw {
                    return Err("native encoded part canonical-byte collision".into());
                }
                return Ok(part.as_ref().clone());
            }
        }
        let encoded = crate::expression_performance_codec::EncodedPage::from_value(value)?;
        Ok(if checkpoint {
            PerformancePart::EncodedCheckpoint(encoded)
        } else {
            PerformancePart::EncodedEventPage(encoded)
        })
    }
    fn event_page_part(&self, page: EventPage, recorded: bool) -> Result<PerformancePart, String> {
        if recorded {
            return self.encoded_part(&page, false);
        }
        // Authored and recorded histories share the same native custody bound.
        // Use the existing lossless codec where it actually saves bytes; keep
        // old raw parts readable and leave the decoded-page bound unchanged.
        if encoded(&page)? > crate::expression_performance_codec::MAX_DECODED_BYTES {
            return Ok(PerformancePart::EventPage(page));
        }
        let packed = self.encoded_part(&page, false)?;
        let plain = PerformancePart::EventPage(page);
        Ok(if encoded(&packed)? < encoded(&plain)? {
            packed
        } else {
            plain
        })
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
        let (header, mut value) = performance_fields(p)?;
        reject_indexes(&value)?;
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
                    .map(|page| self.event_page_part(page, !p.native_recordings.is_empty()))
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
                            self.encoded_part(&checkpoint, true)
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
        let (expanded_bytes, expanded_performance_sha256) =
            crate::expression_act_storage::fingerprint(
                p,
                crate::expression_act_storage::LIVE_BYTES,
            )?;
        next.manifests.push(PerformanceManifest {
            schema: MANIFEST_SCHEMA.into(),
            performance: value,
            header_ref,
            performance_digest: p.content_digest.clone(),
            expanded_performance_sha256,
            expanded_bytes: u32::try_from(expanded_bytes)
                .map_err(|_| "performance expanded size overflow")?,
            private_context: p.bases.iter().any(|b| b.context.private)
                || p.native_sources
                    .iter()
                    .any(NativePerformanceSourceAsset::requires_private_disclosure),
        });
        // The candidate still validates every actual current part digest and
        // every manifest/index/source/privacy/budget. Only the scalar weights
        // of physically unchanged native parts may avoid repeated expansion.
        next.qualified_part_weights = OnceLock::new();
        next.validate_storage_with(self.qualified_part_weights.get())?;
        Ok(next)
    }
    fn walk(
        &self,
        reference: &str,
        kind: &str,
        path: &mut BTreeSet<String>,
        used: &mut BTreeSet<String>,
        out: &mut Option<Vec<Value>>,
        qualification: &mut WalkQualification<'_>,
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
        // Metadata is qualified only within this whole-catalog validation. An
        // immutable subtree was already fully visited in this same transaction;
        // its descendants are in `used`. Selected material restitution never
        // takes this summary path, and cached depth preserves the original bound.
        if out.is_none() {
            if let Some(summary) = qualification.summaries.get(reference) {
                if path.len().checked_add(summary.depth).is_none_or(|n| n > 33) {
                    return Err("cyclic/deep native performance part index".into());
                }
                path.remove(reference);
                return Ok(summary.clone());
            }
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
                if data.kind() != kind {
                    return Err("native performance leaf kind/weight differs".into());
                }
                let (actual_bytes, expanded_value) =
                    if let Some(weights) = qualification.qualified_weights {
                        (
                            *weights.get(part.as_str()).ok_or(
                                "native performance leaf was not qualified in this validation",
                            )?,
                            None,
                        )
                    } else {
                        // This exact native value already supplied the weight.
                        // Move it into restitution after all original checks;
                        // do not materialize the complete leaf a second time.
                        let value = data.value()?;
                        (encoded(&value)?, Some(value))
                    };
                if actual_bytes != *expanded_bytes as usize {
                    return Err("native performance leaf kind/weight differs".into());
                }
                used.insert(part.clone());
                let private = matches!(data.as_ref(),PerformancePart::Basis(b)if b.context.private)
                    || matches!(data.as_ref(), PerformancePart::NativeSource(source) if source.requires_private_disclosure());
                if let Some(values) = out {
                    values.push(match expanded_value {
                        Some(value) => value,
                        None => data.value()?,
                    });
                }
                Walk {
                    items: 1,
                    bytes: *expanded_bytes,
                    private,
                    depth: 0,
                }
            }
            PartIndex::Branch {
                left,
                right,
                items,
                expanded_bytes,
                ..
            } => {
                let l = self.walk(left, kind, path, used, out, qualification)?;
                let r = self.walk(right, kind, path, used, out, qualification)?;
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
                    depth: 1 + l.depth.max(r.depth),
                }
            }
        };
        path.remove(reference);
        if out.is_none() {
            qualification
                .summaries
                .insert(reference.into(), result.clone());
        }
        Ok(result)
    }
    fn validate_storage(&self) -> Result<(), String> {
        self.validate_storage_with(None)
    }
    fn validate_storage_with(
        &self,
        previous: Option<&BTreeMap<String, QualifiedPartWeight>>,
    ) -> Result<(), String> {
        if self.parts.len() > MAX_PARTS || self.manifests.len() > MAX_MANIFESTS {
            return Err("native performance part/manifest budget exceeded".into());
        }
        let mut used = BTreeSet::new();
        let mut qualified_weights = BTreeMap::new();
        let mut native_weights = BTreeMap::new();
        let mut bytes = 0usize;
        for (r, p) in &self.parts {
            let unchanged = previous
                .and_then(|weights| weights.get(r))
                .filter(|weight| {
                    weight
                        .part
                        .upgrade()
                        .is_some_and(|part| Arc::ptr_eq(&part, p))
                });
            let expanded_bytes = if let Some(weight) = unchanged {
                weight.expanded_bytes
            } else {
                p.qualified_value()?.as_ref().map(encoded).transpose()?
            };
            if let Some(weight) = expanded_bytes {
                qualified_weights.insert(r.as_str(), weight);
            }
            native_weights.insert(
                r.clone(),
                QualifiedPartWeight {
                    part: Arc::downgrade(p),
                    expanded_bytes,
                },
            );
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
            let (part_bytes, part_digest) = crate::expression_act_storage::fingerprint(
                p.as_ref(),
                crate::expression_act_storage::LIVE_BYTES,
            )?;
            if part_digest != *r {
                return Err("performance asset digest differs".into());
            }
            bytes = bytes
                .checked_add(part_bytes)
                .ok_or("retained performance size overflow")?;
        }
        let mut qualification = WalkQualification {
            summaries: BTreeMap::new(),
            qualified_weights: Some(&qualified_weights),
        };
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
                    &mut qualification,
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
        // Nothing is issued after a partial validation or refusal. A Weak
        // identity cannot survive replacement or keep any retired part alive.
        let _ = self.qualified_part_weights.set(native_weights);
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
                &mut WalkQualification::default(),
            )?;
            if w.items != r.items || w.bytes.checked_add(2) != Some(r.expanded_bytes) {
                return Err("native performance index changed".into());
            }
            v[key] = Value::Array(values.unwrap());
        }
        let p: Performance = serde_json::from_value(v).map_err(|e| e.to_string())?;
        p.validate()?;
        let (expanded_bytes, expanded_digest) = crate::expression_act_storage::fingerprint(
            &p,
            crate::expression_act_storage::LIVE_BYTES,
        )?;
        if p.content_digest != m.performance_digest
            || expanded_digest != m.expanded_performance_sha256
            || expanded_bytes != m.expanded_bytes as usize
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
            qualified_part_weights: OnceLock::new(),
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
        crate::expression_performance_record_codec::physical_bytes(self)
    }
    pub fn retained_references(&self, reference: &str) -> Option<usize> {
        self.parts.get(reference).map(Arc::strong_count)
    }
}

#[cfg(test)]
mod actual_captured_native_continuation {
    use super::*;

    // Both inputs are actual retained native records. The successor was produced
    // by the original public native 170-to-171 operation, not a test recipe.
    #[test]
    #[ignore = "explicitly run with the exact captured native Act and original real producer fixture"]
    fn actual_captured_prefix_170_to_original_171_preserves_parts_and_refusals() {
        use crate::expression_performance::Counter;
        let fixture_path = std::env::var("QL_RETAINED_PERFORMANCE_FIXTURE")
            .expect("exact actual native producer fixture required; no fallback");
        let fixture_bytes = std::fs::read(fixture_path).unwrap();
        assert_eq!(
            crate::expression_file::digest(&fixture_bytes),
            "sha256:186da30c0024d3fc4025bb91ea841340d1c3c6a9e1d8a133222972de646c4a5b"
        );
        let path = std::env::var("OI_ACT_IMMUTABLE_NATIVE_RECORD")
            .expect("exact captured 170-edition native Act required; no fallback");
        let bytes = std::fs::read(path).unwrap();
        assert!(bytes.len() as u64 <= crate::expression_act_store::MAX_RECORD_BYTES);
        assert_eq!(
            crate::expression_file::digest(&bytes),
            "sha256:d66e49ac297f54a5839182cfba41e83546460db0e89f4755a3231bb0e447fafa"
        );
        let act = crate::expression_performance_act::decode_bytes(
            &bytes,
            crate::expression_act_storage::LIVE_BYTES,
        )
        .unwrap();
        assert_eq!(act.sequence.len(), 170);
        assert_eq!(act.revision, 340);
        assert_eq!(act.phase, crate::expression_world::ActPhase::Held);
        let custody = act.performance_custody.as_ref().unwrap();
        let original_document = custody.restore(169).unwrap();
        let performance = original_document.scenes[0].performance.as_ref().unwrap();
        let successor_bytes = std::fs::read(std::env::var("OI_ACT_IMMUTABLE_NATIVE_SUCCESSOR").expect(
            "exact previously produced and native-qualified 171-edition Act required; no fallback",
        ))
        .unwrap();
        assert_eq!(
            crate::expression_file::digest(&successor_bytes),
            "sha256:144e39b300b3e9f9bbacc42267c723c3e476a06466f9029bd21a23c2502ac064"
        );
        let observed_successor = crate::expression_performance_act::decode_bytes(
            &successor_bytes,
            crate::expression_act_storage::LIVE_BYTES,
        )
        .unwrap();
        assert_eq!(observed_successor.sequence.len(), 171);
        assert_eq!(observed_successor.revision, 341);
        assert_eq!(
            observed_successor.phase,
            crate::expression_world::ActPhase::Running
        );
        assert_eq!(&observed_successor.sequence[..170], act.sequence.as_slice());
        let successor_custody = observed_successor.performance_custody.as_ref().unwrap();
        assert_eq!(successor_custody.restore(169).unwrap(), original_document);
        let observed_document = successor_custody.restore(170).unwrap();
        let prefix170 = performance.clone();
        let prefix171 = observed_document.scenes[0]
            .performance
            .as_ref()
            .unwrap()
            .clone();
        assert_eq!(prefix170.duration_samples, Counter(43_200_000));
        assert_eq!(prefix171.duration_samples, Counter(43_200_000));
        assert_eq!(prefix170.event_count(), 42_500);
        assert_eq!(prefix171.event_count(), 42_750);
        let prior_events: Vec<_> = prefix170.events().cloned().collect();
        let next_events: Vec<_> = prefix171.events().cloned().collect();
        assert_eq!(&next_events[..42_500], prior_events.as_slice());
        assert_eq!(next_events[42_500..].len(), 250);
        assert!(next_events[42_500..]
            .iter()
            .all(|e| e.sample() >= 170 * 5 * 48_000 && e.sample() < 171 * 5 * 48_000));
        // Every other native field retains its original meaning and data. Remove
        // only the actual new page content and reseal with the same native owner.
        let mut without_new_pages = prefix171.clone();
        without_new_pages.pages = prefix170.pages.clone();
        assert_eq!(without_new_pages.seal().unwrap(), prefix170);
        let stored = custody
            .snapshot()
            .performance_catalogs
            .into_values()
            .next()
            .unwrap();
        let original = PerformancePartCatalog::read(stored).unwrap();
        let original_wire = serde_json::to_vec(&original).unwrap();
        assert_eq!(original.manifests.len(), 170);
        assert_eq!(original.restore(169).unwrap(), prefix170);
        let qualified = original.qualified_part_weights.get().unwrap();
        assert_eq!(qualified.len(), original.parts.len());
        for (reference, part) in &original.parts {
            assert!(Arc::ptr_eq(
                &qualified[reference].part.upgrade().unwrap(),
                part
            ));
        }
        let successor = original.appended(&prefix171).unwrap();
        assert_eq!(successor.manifests.len(), 171);
        assert_eq!(&successor.manifests[..170], original.manifests.as_slice());
        assert_eq!(successor.restore(169).unwrap(), prefix170);
        assert_eq!(successor.restore(170).unwrap(), prefix171);
        assert_eq!(serde_json::to_vec(&original).unwrap(), original_wire);
        for (reference, part) in &original.parts {
            assert!(Arc::ptr_eq(part, &successor.parts[reference]));
        }
        let new_leaf = successor
            .parts
            .iter()
            .find_map(|(reference, part)| {
                (!original.parts.contains_key(reference)
                    && matches!(part.as_ref(), PerformancePart::EncodedEventPage(_)))
                .then_some(reference.clone())
            })
            .expect("the actual new 250-event material must produce a new native event leaf");
        assert!(!qualified.contains_key(&new_leaf));
        assert!(Arc::ptr_eq(
            &successor.qualified_part_weights.get().unwrap()[&new_leaf]
                .part
                .upgrade()
                .unwrap(),
            &successor.parts[&new_leaf],
        ));
        // New material receives real type/decode qualification, even when every old
        // actual Arc has a native weight proof. A changed new leaf cannot use it.
        let mut bad_new_leaf = successor.clone();
        let PerformancePart::EncodedEventPage(page) = bad_new_leaf.parts[&new_leaf].as_ref() else {
            panic!("actual successor leaf is not an encoded event page")
        };
        let mut broken_page = serde_json::to_value(page).unwrap();
        broken_page["decoded_sha256"] = Value::from(format!("sha256:{}", "0".repeat(64)));
        bad_new_leaf.parts.insert(
            new_leaf.clone(),
            Arc::new(PerformancePart::EncodedEventPage(
                serde_json::from_value(broken_page).unwrap(),
            )),
        );
        bad_new_leaf.qualified_part_weights = OnceLock::new();
        assert!(bad_new_leaf
            .validate_storage_with(Some(qualified))
            .unwrap_err()
            .contains("decoded length/hash differs"));
        assert!(bad_new_leaf.qualified_part_weights.get().is_none());
        let successor_wire = serde_json::to_vec(&successor).unwrap();
        let cold: PerformancePartCatalog = serde_json::from_slice(&successor_wire).unwrap();
        assert_eq!(
            cold, successor,
            "private proof must not change semantic equality"
        );
        assert_eq!(serde_json::to_vec(&cold).unwrap(), successor_wire);
        assert_eq!(cold.restore(169).unwrap(), prefix170);
        assert_eq!(cold.restore(170).unwrap(), prefix171);
        // Both prior and new manifests remain fully checked outside reused weights.
        for index in [0, 170] {
            let mut wrong_privacy = successor.clone();
            wrong_privacy.manifests[index].private_context =
                !successor.manifests[index].private_context;
            assert!(wrong_privacy
                .validate_storage_with(Some(qualified))
                .unwrap_err()
                .contains("weight/privacy differs"));
            let mut wrong_weight = successor.clone();
            wrong_weight.manifests[index].expanded_bytes += 1;
            assert!(wrong_weight
                .validate_storage_with(Some(qualified))
                .unwrap_err()
                .contains("weight/privacy differs"));
        }
        let old_leaf = original
            .parts
            .iter()
            .find_map(|(reference, part)| {
                matches!(part.as_ref(), PerformancePart::EncodedEventPage(_))
                    .then_some(reference.clone())
            })
            .unwrap();
        for leaf in [&old_leaf, &new_leaf] {
            let mut missing = successor.clone();
            missing.parts.remove(leaf);
            assert!(missing.validate_storage_with(Some(qualified)).is_err());
        }
        let mut replaced = successor.clone();
        let old = replaced.parts[&old_leaf].clone();
        replaced
            .parts
            .insert(old_leaf.clone(), Arc::new(old.as_ref().clone()));
        assert!(!Arc::ptr_eq(&old, &replaced.parts[&old_leaf]));
        replaced.qualified_part_weights = OnceLock::new();
        let mut retired_weights = qualified.clone();
        retired_weights.get_mut(&old_leaf).unwrap().expanded_bytes = Some(usize::MAX);
        replaced
            .validate_storage_with(Some(&retired_weights))
            .unwrap();
        assert_eq!(serde_json::to_vec(&replaced).unwrap(), successor_wire);
        assert!(Arc::ptr_eq(
            &replaced.qualified_part_weights.get().unwrap()[&old_leaf]
                .part
                .upgrade()
                .unwrap(),
            &replaced.parts[&old_leaf],
        ));
        // Even an unchanged actual Arc and matching private metadata cannot waive
        // fresh hashing against the current declared address.
        let mut wrong_address = successor.clone();
        let same_part = wrong_address.parts.remove(&old_leaf).unwrap();
        let bad_ref = format!("sha256:{}", "0".repeat(64));
        wrong_address.parts.insert(bad_ref.clone(), same_part);
        let mut misplaced_weights = qualified.clone();
        misplaced_weights.insert(bad_ref, qualified[&old_leaf].clone());
        assert!(wrong_address
            .validate_storage_with(Some(&misplaced_weights))
            .unwrap_err()
            .contains("performance asset digest differs"));
        let mut foreign = serde_json::to_value(&successor).unwrap();
        foreign["qualified_part_weights"] = serde_json::json!({"claimed": true});
        assert!(PerformancePartCatalog::read_value(foreign).is_err());
        assert_eq!(original.restore(169).unwrap(), *performance);
        assert_eq!(custody.restore(169).unwrap(), original_document);
        eprintln!("actual-native-successor-private-proof prefix170={} prefix171={} new_leaf={} original_wire={} successor_wire={} cases=positive,cold,old-and-new-privacy,old-and-new-weight,old-and-new-missing,new-leaf-codec,replacement-allocation,fresh-address-digest,external-injection",
            prefix170.content_digest, prefix171.content_digest, new_leaf,
            crate::expression_file::digest(&original_wire), crate::expression_file::digest(&successor_wire));
    }
}
