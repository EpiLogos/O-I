//! Private application recovery, not an Expression publication or source write.
//! The journal acknowledges durable bytes before NativeWorking dispatches an
//! operation. Recovery never replays that operation; the ordinary Expression
//! owner must validate and reopen its acknowledged document explicitly.
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    collections::{BTreeMap, BTreeSet},
    path::PathBuf,
};

pub const MAX_RECORD_BYTES: usize = 8 * 1024 * 1024;
const MAX_SCOPE_BYTES: usize = 64 * 1024 * 1024;
const MAX_RECORDS: usize = 256;
const MAX_REVISION: u64 = crate::expression::MAX_REVISION;
const SCHEMA: &str = "oi.expression-recovery/v1";
const STORAGE_SCHEMA: &str = "oi.expression-recovery-storage/v1";

/// Recovery has its own filesystem lock and compare-and-set revisions. It
/// does not access Kernel memory or emit semantic events, so hosts execute
/// this owner without waiting behind unrelated World reads.
pub fn execute(request: Request) -> Result<crate::KernelOpOutcome, String> {
    let data = Store::default().apply(request)?;
    Ok(crate::KernelOpOutcome {
        receipts: Vec::new(),
        result: crate::KernelOpResult::ExpressionRecovery { data },
    })
}
#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Scope {
    Expressions,
    Techne,
}
impl Scope {
    fn name(self) -> &'static str {
        match self {
            Self::Expressions => "expressions",
            Self::Techne => "techne",
        }
    }
}
#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Kind {
    Draft,
    Checkpoint,
}
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(tag = "operation", rename_all = "snake_case", deny_unknown_fields)]
pub enum Request {
    Read {
        scope: Scope,
        kind: Kind,
        id: String,
    },
    List {
        scope: Scope,
        kind: Kind,
    },
    FindCheckpoint {
        scope: Scope,
        expression_ref: String,
    },
    Write {
        scope: Scope,
        kind: Kind,
        id: String,
        expected_revision: Option<u64>,
        value: Value,
    },
    Remove {
        scope: Scope,
        kind: Kind,
        id: String,
        expected_revision: u64,
    },
}
#[derive(Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Record {
    schema: String,
    scope: Scope,
    kind: Kind,
    id: String,
    revision: u64,
    value: Value,
}
/// Private storage only. Public recovery values remain the complete ordinary
/// checkpoint, including its independent acknowledged, local and pending bases.
#[derive(Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct StoredRecord {
    schema: String,
    record: Record,
    images: Vec<crate::expression_file::StoredImage>,
    expanded_value_sha256: String,
}
impl Record {
    fn public(&self) -> Value {
        json!({"id":self.id,"scope":self.scope,"kind":self.kind,"revision":self.revision,"value":self.value})
    }
    fn metadata(&self) -> Value {
        let mut row =
            json!({"id":self.id,"scope":self.scope,"kind":self.kind,"revision":self.revision});
        if self.kind == Kind::Checkpoint {
            if let Some(reference) = self
                .value
                .pointer("/view/document/expression_ref")
                .and_then(Value::as_str)
            {
                row["expression_ref"] = json!(reference);
            }
        }
        row
    }
}
#[derive(Debug, Default)]
pub struct Store {
    home: Option<PathBuf>,
}
fn safe_id(id: &str) -> Result<(), String> {
    if id.is_empty()
        || id.len() > 160
        || !id
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b"_.:-".contains(&b))
    {
        Err("Recovery identity must be a bounded native draft ID".into())
    } else {
        Ok(())
    }
}
fn reference(value: &str) -> Result<(), String> {
    let id = value
        .strip_prefix("expression:")
        .ok_or("Recovery requires an Expression reference")?;
    if id.is_empty()
        || id.len() > 128
        || !id
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b"_.-".contains(&b))
    {
        return Err("Invalid native Expression reference".into());
    }
    Ok(())
}
fn data(value: &Value, depth: usize) -> Result<(), String> {
    if depth > 64 {
        return Err("Recovery data nesting exceeds its bound".into());
    }
    match value {
        Value::Object(values) => {
            for (key, value) in values {
                if ["__proto__", "constructor", "prototype"].contains(&key.as_str()) {
                    return Err("Unsafe recovery property".into());
                }
                data(value, depth + 1)?;
            }
        }
        Value::Array(values) => {
            if values.len() > 16384 {
                return Err("Recovery array exceeds its bound".into());
            }
            for value in values {
                data(value, depth + 1)?;
            }
        }
        _ => {}
    }
    Ok(())
}
fn journey(value: &Value, id: &str) -> Result<(), String> {
    if value["schema"] != "oi.journey"
        || value["version"] != 1
        || value["id"].as_str() != Some(id)
        || !value["name"].is_string()
    {
        return Err("Recovery draft schema or identity disagrees with its key".into());
    }
    let scenes = value["scenes"]
        .as_array()
        .ok_or("Recovery draft has no Scene list")?;
    if scenes.is_empty() || scenes.len() > 64 {
        return Err("Recovery draft Scene count is outside its bound".into());
    }
    let mut ids = BTreeSet::new();
    for scene in scenes {
        let id = scene["id"]
            .as_str()
            .ok_or("Recovery Scene has no identity")?;
        safe_id(id)?;
        if !ids.insert(id) {
            return Err("Recovery draft has duplicate Scene identities".into());
        }
    }
    Ok(())
}
fn validate(kind: Kind, id: &str, value: &Value) -> Result<(), String> {
    safe_id(id)?;
    data(value, 0)?;
    // Refuse an oversized public component before typed Document/request
    // conversion can clone its material, not only before storage interning.
    preflight_components(kind, value)?;
    if kind == Kind::Draft {
        return journey(value, id);
    }
    let fields = value
        .as_object()
        .ok_or("Native checkpoint must be an object")?;
    if fields
        .keys()
        .any(|k| !["schema", "draft_id", "view", "file", "pending"].contains(&k.as_str()))
        || value["schema"] != "oi.native-working/v1"
        || value["draft_id"].as_str() != Some(id)
    {
        return Err("Native checkpoint schema or identity disagrees with its key".into());
    }
    let document = if let Some(view) = value.get("view") {
        journey(&view["journey"], id)?;
        let document: crate::expression::Document =
            serde_json::from_value(view["document"].clone())
                .map_err(|e| format!("Invalid native recovery document: {e}"))?;
        document.validate()?;
        Some(document)
    } else {
        None
    };
    if let Some(file) = value.get("file") {
        let doc = document
            .as_ref()
            .ok_or("Recovered file has no native document basis")?;
        let location: crate::files::Location = serde_json::from_value(file["location"].clone())
            .map_err(|e| format!("Invalid recovered file location: {e}"))?;
        if location.schema != "central.path-ref/v1"
            || location.ref_id.is_empty()
            || location.root.is_empty()
            || location.path.is_empty()
        {
            return Err("Recovered file location has no native identity".into());
        }
        if file["expression_ref"].as_str() != Some(doc.expression_ref.as_str())
            || !file["revision"].as_str().is_some_and(|v| !v.is_empty())
        {
            return Err("Recovered file identity/revision disagrees with its native basis".into());
        }
    }
    if let Some(pending) = value.get("pending") {
        match pending["kind"].as_str() {
            Some("create") => {
                if document.is_some() {
                    return Err(
                        "Pending creation cannot replace an acknowledged native basis".into(),
                    );
                }
                reference(
                    pending["expression_ref"]
                        .as_str()
                        .ok_or("Pending creation has no native ref")?,
                )?;
                journey(&pending["submitted"]["journey"], id)?;
            }
            Some("edit" | "selection" | "connections" | "occurrence" | "blueprint") => {
                let doc = document
                    .as_ref()
                    .ok_or("Pending edit has no native document basis")?;
                let request: crate::expression::Request =
                    serde_json::from_value(pending["request"].clone())
                        .map_err(|e| format!("Invalid pending native edit: {e}"))?;
                match request {
                    crate::expression::Request::Edit {
                        expression_ref,
                        expected_revision,
                        changes,
                        ..
                    } if expression_ref == doc.expression_ref
                        && expected_revision == doc.revision
                        && !changes.is_empty()
                        && changes.len() <= 256 => {}
                    _ => return Err("Pending edit disagrees with its exact native basis".into()),
                }
                if pending["kind"] == "edit" {
                    journey(&pending["submitted"]["journey"], id)?;
                }
                if pending["kind"] == "blueprint" {
                    let intent = &pending["intent"];
                    if intent["expression_ref"].as_str() != Some(doc.expression_ref.as_str())
                        || intent["revision"].as_u64() != Some(doc.revision)
                        || !intent["scene_ref"].as_str().is_some_and(|reference| {
                            doc.scenes.iter().any(|scene| scene.scene_ref == reference)
                        })
                        || !matches!(
                            intent["operation"].as_str(),
                            Some("bind" | "transform" | "release")
                        )
                    {
                        return Err(
                            "Pending blueprint disagrees with its exact native basis".into()
                        );
                    }
                    if intent["operation"] == "bind" {
                        serde_json::from_value::<crate::expression_blueprint::Binding>(
                            intent["binding"].clone(),
                        )
                        .map_err(|e| format!("Invalid pending blueprint binding: {e}"))?;
                    }
                }
                if pending["kind"] == "occurrence" {
                    let intent = &pending["intent"];
                    let scene_ref = intent["scene_ref"]
                        .as_str()
                        .ok_or("Occurrence intent has no Scene")?;
                    let scene = doc
                        .scenes
                        .iter()
                        .find(|scene| scene.scene_ref == scene_ref)
                        .ok_or("Occurrence intent addresses an absent Scene")?;
                    let new_ref = intent["new_entity_ref"]
                        .as_str()
                        .ok_or("Occurrence intent has no new identity")?;
                    crate::expression::id(new_ref, &format!("{}:entity:", doc.expression_ref))?;
                    if !new_ref.starts_with(&format!("{}:entity:occurrence-", doc.expression_ref))
                        || doc.entities.contains_key(new_ref)
                    {
                        return Err(
                            "Occurrence intent does not create a fresh native identity".into()
                        );
                    }
                    match intent["operation"].as_str() {
                        Some("duplicate") => {
                            let original = intent["entity_ref"]
                                .as_str()
                                .ok_or("Duplicate has no original occurrence")?;
                            if !scene
                                .entity_refs
                                .iter()
                                .any(|reference| reference == original)
                                || !doc
                                    .entities
                                    .get(original)
                                    .is_some_and(|entity| entity.subject.is_some())
                            {
                                return Err(
                                    "Duplicate does not address a source occurrence in its Scene"
                                        .into(),
                                );
                            }
                        }
                        Some("insert-source") => {
                            let binding: crate::expression::SubjectBinding =
                                serde_json::from_value(intent["binding"].clone())
                                    .map_err(|e| format!("Invalid inserted source binding: {e}"))?;
                            if !intent["title"]
                                .as_str()
                                .is_some_and(|title| !title.trim().is_empty() && title.len() <= 640)
                                || binding.subject_ref.starts_with("expression:")
                                || !binding.readings.iter().any(|reading| {
                                    reading.r#ref == binding.subject_ref
                                        && !reading.revision.is_empty()
                                        && reading.availability
                                            == crate::expression::Availability::Available
                                })
                            {
                                return Err(
                                    "Inserted source has no exact available owner reading".into()
                                );
                            }
                        }
                        _ => return Err("Unsupported native occurrence intent".into()),
                    }
                }
            }
            Some("file") => {
                if document.is_none() || !pending["intent"].is_object() {
                    return Err("Pending file save has no exact native intent/basis".into());
                }
            }
            _ => return Err("Unknown pending native recovery operation".into()),
        }
    } else if document.is_none() {
        return Err(
            "Native checkpoint has neither an acknowledged basis nor a pending creation".into(),
        );
    }
    Ok(())
}

/// Measure serialized UTF8 through a borrowed writer. This allocates neither
/// a serialized payload nor a cloned Value/image String.
fn serialized_size(value: &Value) -> Result<usize, String> {
    #[derive(Default)]
    struct Counter(usize);
    impl std::io::Write for Counter {
        fn write(&mut self, bytes: &[u8]) -> std::io::Result<usize> {
            self.0 = self
                .0
                .checked_add(bytes.len())
                .ok_or_else(|| std::io::Error::other("Recovery size overflow"))?;
            Ok(bytes.len())
        }
        fn flush(&mut self) -> std::io::Result<()> {
            Ok(())
        }
    }
    let mut counter = Counter::default();
    serde_json::to_writer(&mut counter, value).map_err(|e| e.to_string())?;
    Ok(counter.0)
}

fn component_budgets(
    kind: Kind,
    value: &Value,
    size: impl Fn(&Value) -> Result<usize, String>,
) -> Result<(), String> {
    let mut removed = 0i128;
    if kind == Kind::Checkpoint {
        for path in [
            "/view/document",
            "/view/journey",
            "/pending/request",
            "/pending/submitted/journey",
        ] {
            if let Some(component) = value.pointer(path) {
                let bytes = size(component)?;
                if bytes > MAX_RECORD_BYTES {
                    return Err(
                        "Expanded recovery component exceeds 8 MiB before material cloning".into(),
                    );
                }
                // Account for a null placeholder without constructing a
                // remainder copy. The four component roots never overlap.
                removed = removed
                    .checked_add(bytes as i128 - 4)
                    .ok_or("Recovery size overflow")?;
            }
        }
    }
    let remainder = (size(value)? as i128)
        .checked_sub(removed)
        .ok_or("Recovery size overflow")?;
    if remainder < 0 || remainder > MAX_RECORD_BYTES as i128 {
        return Err("Expanded recovery component exceeds 8 MiB before material cloning".into());
    }
    Ok(())
}

fn preflight_components(kind: Kind, value: &Value) -> Result<(), String> {
    component_budgets(kind, value, serialized_size)
}

fn expanded_size(value: &Value, images: &BTreeMap<String, String>) -> Result<usize, String> {
    let encoded = serialized_size(value)?;
    let delta = crate::expression_file::expansion_delta(value, None, images, &mut BTreeSet::new())?;
    usize::try_from(
        (encoded as i128)
            .checked_add(delta)
            .ok_or("Expanded recovery size overflow")?,
    )
    .map_err(|_| "Expanded recovery size overflow".into())
}

/// A checkpoint carries several different snapshots, not one larger native
/// Document. Qualify each existing component budget before cloning any PNG:
/// acknowledged Document, authoring Journey, pending request/submitted Journey,
/// and the remaining recovery metadata. None may use storage compression to
/// exceed its ordinary 8 MiB bound.
fn qualify_expansion(
    kind: Kind,
    value: &Value,
    images: &BTreeMap<String, String>,
) -> Result<(), String> {
    data(value, 0)?;
    let mut used = BTreeSet::new();
    crate::expression_file::expansion_delta(value, None, images, &mut used)?;
    if used.len() != images.len() {
        return Err("Unused embedded recovery image reference".into());
    }
    component_budgets(kind, value, |component| expanded_size(component, images))
}

/// Private values never enter this receipt. The original refusal stays the
/// first line; its bounded metadata travels through the existing native String
/// error channel to the hosted frame and NativeWorking's retained notice.
const SIZE_DIAGNOSTIC_SCHEMA: &str = "oi.recovery-size-diagnostic/v1";
const SIZE_DIAGNOSTIC_MARKER: &str = "\n[oi.recovery-size-diagnostic/v1] ";
const MAX_SIZE_DIAGNOSTIC_BYTES: usize = 16 * 1024;
const COMPONENT_SIZE_MESSAGE: &str =
    "Expanded recovery component exceeds 8 MiB before material cloning";

// This is a diagnostic-work ceiling, not an admission budget change. A
// checkpoint has at most four existing 8 MiB bases plus an 8 MiB remainder.
const MAX_DIAGNOSTIC_PUBLIC_BYTES: usize = 5 * MAX_RECORD_BYTES;
const MAX_DIAGNOSTIC_RAW_BYTES: usize = MAX_DIAGNOSTIC_PUBLIC_BYTES + 2048;
#[derive(Serialize)]
struct SerializedMeasurement {
    status: &'static str,
    serialized_utf8_bytes: Option<usize>,
    serialized_utf8_bytes_at_least: Option<usize>,
    measurement_limit_bytes: usize,
    sha256: Option<String>,
}
fn measured_bytes(bytes: &[u8], limit: usize) -> SerializedMeasurement {
    let complete = bytes.len() <= limit;
    SerializedMeasurement {
        status: if complete {
            "complete"
        } else {
            "exact_size_over_bound_hash_not_measured"
        },
        serialized_utf8_bytes: Some(bytes.len()),
        serialized_utf8_bytes_at_least: None,
        measurement_limit_bytes: limit,
        sha256: complete.then(|| format!("{:x}", Sha256::digest(bytes))),
    }
}
/// A borrowed bounded serializer/hash sink: no payload Vec, Value or image
/// clone. A refused write is not hashed, and a prefix is never a full digest.
fn measure_serialized<T: Serialize + ?Sized>(value: &T, limit: usize) -> SerializedMeasurement {
    struct Sink {
        bytes: usize,
        limit: usize,
        over_bound: bool,
        hash: Sha256,
    }
    impl std::io::Write for Sink {
        fn write(&mut self, bytes: &[u8]) -> std::io::Result<usize> {
            let next = self.bytes.checked_add(bytes.len());
            if next.is_none_or(|next| next > self.limit) {
                self.over_bound = true;
                return Err(std::io::Error::other(
                    "Recovery diagnostic measurement bound",
                ));
            }
            self.bytes = next.expect("bounded measurement count");
            self.hash.update(bytes);
            Ok(bytes.len())
        }
        fn flush(&mut self) -> std::io::Result<()> {
            Ok(())
        }
    }
    let mut sink = Sink {
        bytes: 0,
        limit,
        over_bound: false,
        hash: Sha256::new(),
    };
    let result = serde_json::to_writer(&mut sink, value);
    let complete = result.is_ok();
    SerializedMeasurement {
        status: if complete {
            "complete"
        } else if sink.over_bound {
            "over_bound_partial_not_fully_measured"
        } else {
            "serialization_refused_not_fully_measured"
        },
        serialized_utf8_bytes: complete.then_some(sink.bytes),
        serialized_utf8_bytes_at_least: sink.over_bound.then(|| limit.saturating_add(1)),
        measurement_limit_bytes: limit,
        sha256: complete.then(|| format!("{:x}", sink.hash.finalize())),
    }
}
#[derive(Serialize)]
struct SizeRequestContext {
    operation: &'static str,
    scope: Scope,
    kind: Option<Kind>,
    requested_address_sha256: Option<String>,
    cas_applicable: bool,
    expected_revision: Option<u64>,
}
fn draft_address_sha256(scope: Scope, kind: Kind, id: &str) -> Option<String> {
    #[derive(Serialize)]
    struct Address<'a> {
        scope: Scope,
        kind: Kind,
        id: &'a str,
    }
    (id.len() <= 160)
        .then(|| measure_serialized(&Address { scope, kind, id }, 32 * 1024))
        .and_then(|m| m.sha256)
}
fn size_request_context(request: &Request) -> SizeRequestContext {
    // These tiny borrowed address objects are hashed, never disclosed. Invalid
    // unbounded addresses retain their ordinary validation error unchanged.
    #[derive(Serialize)]
    struct ExpressionAddress<'a> {
        scope: Scope,
        expression_ref: &'a str,
    }
    let (operation, scope, kind, address, cas_applicable, expected_revision) = match request {
        Request::Read { scope, kind, id } => (
            "read",
            *scope,
            Some(*kind),
            draft_address_sha256(*scope, *kind, id),
            false,
            None,
        ),
        Request::List { scope, kind } => (
            "list",
            *scope,
            Some(*kind),
            measure_serialized(&(*scope, *kind), 32 * 1024).sha256,
            false,
            None,
        ),
        Request::FindCheckpoint {
            scope,
            expression_ref,
        } => (
            "find_checkpoint",
            *scope,
            None,
            (expression_ref.len() <= 4096)
                .then(|| {
                    measure_serialized(
                        &ExpressionAddress {
                            scope: *scope,
                            expression_ref,
                        },
                        32 * 1024,
                    )
                })
                .and_then(|m| m.sha256),
            false,
            None,
        ),
        Request::Write {
            scope,
            kind,
            id,
            expected_revision,
            ..
        } => (
            "write",
            *scope,
            Some(*kind),
            draft_address_sha256(*scope, *kind, id),
            true,
            *expected_revision,
        ),
        Request::Remove {
            scope,
            kind,
            id,
            expected_revision,
        } => (
            "remove",
            *scope,
            Some(*kind),
            draft_address_sha256(*scope, *kind, id),
            true,
            Some(*expected_revision),
        ),
    };
    SizeRequestContext {
        operation,
        scope,
        kind,
        requested_address_sha256: address,
        cas_applicable,
        expected_revision,
    }
}
/// Serialize the exact existing remainder with component roots replaced by
/// null. The numeric locations refer to real object keys, never a concatenated
/// pointer string; a literal key containing '/' cannot masquerade as a root.
struct RecoveryRemainder<'a> {
    value: &'a Value,
    location: u8,
}
impl Serialize for RecoveryRemainder<'_> {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        use serde::ser::SerializeMap;
        let Some(object) = self.value.as_object() else {
            return self.value.serialize(serializer);
        };
        let mut map = serializer.serialize_map(Some(object.len()))?;
        for (key, value) in object {
            match (self.location, key.as_str()) {
                (1, "document" | "journey") | (2, "request") | (3, "journey") => {
                    map.serialize_entry(key, &())?
                }
                (0, "view") => {
                    map.serialize_entry(key, &RecoveryRemainder { value, location: 1 })?
                }
                (0, "pending") => {
                    map.serialize_entry(key, &RecoveryRemainder { value, location: 2 })?
                }
                (2, "submitted") => {
                    map.serialize_entry(key, &RecoveryRemainder { value, location: 3 })?
                }
                _ => map.serialize_entry(key, value)?,
            }
        }
        map.end()
    }
}
fn bounded_image_metrics(value: &Value, dictionary_entries: Option<usize>) -> Value {
    struct Counts<'a> {
        unique: BTreeMap<&'a str, bool>,
        unique_overflow: bool,
        occurrences: Option<usize>,
        occurrence_bytes: Option<usize>,
    }
    fn visit<'a>(value: &'a Value, counts: &mut Counts<'a>) {
        match value {
            Value::Object(object) => {
                for (key, value) in object {
                    if key == "dataUrl" {
                        if let Some(url) = value
                            .as_str()
                            .filter(|url| crate::expression_file::png(url))
                        {
                            counts.occurrences = counts.occurrences.and_then(|n| n.checked_add(1));
                            counts.occurrence_bytes = counts
                                .occurrence_bytes
                                .and_then(|n| n.checked_add(url.len()));
                            if let Some(repeated) = counts.unique.get_mut(url) {
                                *repeated = true;
                            } else if counts.unique.len() < crate::expression_file::MAX_IMAGES {
                                counts.unique.insert(url, false);
                            } else {
                                counts.unique_overflow = true;
                            }
                        }
                    }
                    visit(value, counts);
                }
            }
            Value::Array(array) => {
                for value in array {
                    visit(value, counts);
                }
            }
            _ => {}
        }
    }
    let mut counts = Counts {
        unique: BTreeMap::new(),
        unique_overflow: false,
        occurrences: Some(0),
        occurrence_bytes: Some(0),
    };
    visit(value, &mut counts);
    let exact = !counts.unique_overflow;
    let unique_bytes = exact
        .then(|| {
            counts
                .unique
                .keys()
                .try_fold(0usize, |n, url| n.checked_add(url.len()))
        })
        .flatten();
    json!({
        "eligible_occurrences": counts.occurrences,
        "eligible_data_url_utf8_bytes_with_repetition": counts.occurrence_bytes,
        "eligible_unique": exact.then_some(counts.unique.len()),
        "eligible_unique_data_url_utf8_bytes": unique_bytes,
        "repeated_unique": exact.then(|| counts.unique.values().filter(|repeated| **repeated).count()),
        "unique_metrics_status": if exact { "complete" } else { "more_than_4096_unique_images_not_retained_in_diagnostic" },
        "actual_candidate_dictionary_entries": dictionary_entries,
        "diagnostic_unique_tracking_limit": crate::expression_file::MAX_IMAGES
    })
}
struct SizeEvidence<'a> {
    public: Option<&'a [u8]>,
    raw_record: Option<&'a [u8]>,
    stored_candidate: Option<&'a [u8]>,
    dictionary_entries: Option<usize>,
}
fn format_size_refusal(message: &str, diagnostic: &Value) -> String {
    match serde_json::to_string(diagnostic) {
        Ok(body) if body.len() <= MAX_SIZE_DIAGNOSTIC_BYTES =>
            format!("{message}{SIZE_DIAGNOSTIC_MARKER}{body}"),
        // A metadata-format failure must never turn a refusal into success,
        // reveal a value, or lose its original human-facing message.
        _ => format!("{message}{SIZE_DIAGNOSTIC_MARKER}{{\"schema\":\"{SIZE_DIAGNOSTIC_SCHEMA}\",\"diagnostic_status\":\"metadata_format_refused\"}}"),
    }
}
struct SizeRecordBasis<'a> {
    scope: Scope,
    kind: Kind,
    id: &'a str,
    revision: Option<u64>,
    value: &'a Value,
}
fn size_refusal(
    record: &Record,
    message: &str,
    branch: &'static str,
    evidence: SizeEvidence<'_>,
) -> String {
    size_refusal_basis(
        SizeRecordBasis {
            scope: record.scope,
            kind: record.kind,
            id: &record.id,
            revision: Some(record.revision),
            value: &record.value,
        },
        message,
        branch,
        evidence,
    )
}
fn size_refusal_basis(
    record: SizeRecordBasis<'_>,
    message: &str,
    branch: &'static str,
    evidence: SizeEvidence<'_>,
) -> String {
    let components: Vec<_> = if record.kind == Kind::Checkpoint {
        ["/view/document", "/view/journey", "/pending/request", "/pending/submitted/journey"]
            .into_iter().map(|path| json!({
                "path": path,
                "present": record.value.pointer(path).is_some(),
                "measurement": record.value.pointer(path).map(|value| measure_serialized(value, MAX_RECORD_BYTES))
            })).collect()
    } else {
        Vec::new()
    };
    let remainder = if record.kind == Kind::Checkpoint {
        measure_serialized(
            &RecoveryRemainder {
                value: record.value,
                location: 0,
            },
            MAX_RECORD_BYTES,
        )
    } else {
        measure_serialized(&record.value, MAX_RECORD_BYTES)
    };
    let public_limit = if record.kind == Kind::Checkpoint {
        MAX_DIAGNOSTIC_PUBLIC_BYTES
    } else {
        MAX_RECORD_BYTES
    };
    let public = evidence
        .public
        .map(|bytes| measured_bytes(bytes, public_limit))
        .unwrap_or_else(|| measure_serialized(&record.value, public_limit));
    let complete = public.status == "complete"
        && remainder.status == "complete"
        && components
            .iter()
            .all(|row| row["present"] == false || row["measurement"]["status"] == "complete");
    let removed = components.iter().try_fold(0i128, |total, row| {
        if row["present"] == false {
            return Some(total);
        }
        total.checked_add(row["measurement"]["serialized_utf8_bytes"].as_u64()? as i128 - 4)
    });
    let remainder_formula_bytes = public
        .serialized_utf8_bytes
        .and_then(|full| usize::try_from((full as i128).checked_sub(removed?)?).ok());
    let remainder_matches_formula = remainder
        .serialized_utf8_bytes
        .and_then(|measured| remainder_formula_bytes.map(|formula| formula == measured));
    // An over-bound refused public Value must not cause another full image walk.
    let images = if public.status == "complete" {
        bounded_image_metrics(record.value, evidence.dictionary_entries)
    } else {
        json!({
            "eligible_occurrences": null,
            "eligible_data_url_utf8_bytes_with_repetition": null,
            "eligible_unique": null,
            "eligible_unique_data_url_utf8_bytes": null,
            "repeated_unique": null,
            "unique_metrics_status": "not_walked_public_measurement_incomplete_or_over_bound",
            "actual_candidate_dictionary_entries": evidence.dictionary_entries,
            "diagnostic_unique_tracking_limit": crate::expression_file::MAX_IMAGES
        })
    };
    let diagnostic = json!({
        "schema": SIZE_DIAGNOSTIC_SCHEMA,
        "diagnostic_status": if complete { "measured_at_native_size_refusal" } else { "partial_measurement_at_native_size_refusal" },
        "failure_branch": branch,
        "operation_context": null,
        "record_address_sha256": draft_address_sha256(record.scope, record.kind, record.id),
        "record_scope": record.scope, "record_kind": record.kind,
        "record_revision": record.revision,
        "record_revision_role": if branch == "legacy_raw_value_decode" { "stored" } else if branch == "inbound_component_preflight" { "unallocated_inbound" } else { "proposed_not_acknowledged" },
        "cas_guard": "not_qualified_until_store_request_context",
        "public_value": public,
        "components": components, "remainder_with_null_component_roots": remainder,
        "remainder_formula_bytes": remainder_formula_bytes,
        "remainder_measurement_matches_formula": remainder_matches_formula,
        "raw_record": evidence.raw_record.map(|bytes| measured_bytes(bytes, MAX_DIAGNOSTIC_RAW_BYTES)),
        "stored_candidate": evidence.stored_candidate.map(|bytes| measured_bytes(bytes, MAX_RECORD_BYTES + 2048)),
        "stored_candidate_admitted_current_operation": false,
        "stored_candidate_status": if branch == "legacy_raw_value_decode" { "existing_raw_bytes_refused" } else if evidence.stored_candidate.is_some() { "candidate_not_written" } else { "not_materialised" },
        "images": images,
        "limits": {"component_and_remainder_bytes": MAX_RECORD_BYTES, "stored_record_bytes": MAX_RECORD_BYTES + 2048, "scope_bytes": MAX_SCOPE_BYTES, "scope_records": MAX_RECORDS,
            "diagnostic_public_measurement_bytes": public_limit, "diagnostic_raw_measurement_bytes": MAX_DIAGNOSTIC_RAW_BYTES, "diagnostic_metadata_utf8_bytes": MAX_SIZE_DIAGNOSTIC_BYTES},
        "private_values_disclosed": false
    });
    format_size_refusal(message, &diagnostic)
}
fn attach_size_request_context(error: String, context: &SizeRequestContext) -> String {
    let Some((message, body)) = error.split_once(SIZE_DIAGNOSTIC_MARKER) else {
        return error;
    };
    if !matches!(
        message,
        "Recovery record exceeds 8 MiB" | COMPONENT_SIZE_MESSAGE
    ) || body.len() > MAX_SIZE_DIAGNOSTIC_BYTES
    {
        return error;
    }
    let Ok(mut diagnostic) = serde_json::from_str::<Value>(body) else {
        return error;
    };
    if diagnostic["schema"] != SIZE_DIAGNOSTIC_SCHEMA || !diagnostic.is_object() {
        return error;
    }
    diagnostic["operation_context"] = match serde_json::to_value(context) {
        Ok(value) => value,
        Err(_) => return error,
    };
    diagnostic["cas_guard"] = json!(
        match (context.operation, diagnostic["failure_branch"].as_str()) {
            ("write", Some("inbound_component_preflight")) =>
                "not_reached_inbound_validation_refused",
            ("write", Some("legacy_raw_value_decode"))
            | ("remove", Some("legacy_raw_value_decode")) =>
                "not_reached_existing_record_decode_refused",
            (
                "write",
                Some(
                    "component_preflight"
                    | "write_without_image_dictionary"
                    | "write_image_dictionary_storage",
                ),
            ) => "passed_before_size_refusal",
            _ => "not_applicable",
        }
    );
    format_size_refusal(message, &diagnostic)
}

fn encode_record(record: &Record) -> Result<Vec<u8>, String> {
    preflight_components(record.kind, &record.value).map_err(|error| {
        if error == COMPONENT_SIZE_MESSAGE {
            size_refusal(
                record,
                &error,
                "component_preflight",
                SizeEvidence {
                    public: None,
                    raw_record: None,
                    stored_candidate: None,
                    dictionary_entries: None,
                },
            )
        } else {
            error
        }
    })?;
    let full = serde_json::to_vec(&record.value).map_err(|e| e.to_string())?;
    let mut counts = BTreeMap::new();
    crate::expression_file::count_images(&record.value, &mut counts);
    let refs: BTreeMap<String, String> = counts
        .into_iter()
        .filter(|(_, count)| *count > 1)
        .take(crate::expression_file::MAX_IMAGES)
        .map(|(url, _)| {
            (
                url.to_owned(),
                crate::expression_file::digest(url.as_bytes()),
            )
        })
        .collect();
    let raw = serde_json::to_vec(record).map_err(|e| e.to_string())?;
    if refs.is_empty() {
        if full.len() > MAX_RECORD_BYTES {
            return Err(size_refusal(
                record,
                "Recovery record exceeds 8 MiB",
                "write_without_image_dictionary",
                SizeEvidence {
                    public: Some(&full),
                    raw_record: Some(&raw),
                    stored_candidate: Some(&raw),
                    dictionary_entries: Some(0),
                },
            ));
        }
        return Ok(raw);
    }
    let mut compact = Record {
        schema: record.schema.clone(),
        scope: record.scope,
        kind: record.kind,
        id: record.id.clone(),
        revision: record.revision,
        value: record.value.clone(),
    };
    crate::expression_file::intern(&mut compact.value, &refs);
    let mut images: Vec<_> = refs
        .iter()
        .map(|(url, reference)| crate::expression_file::StoredImage {
            r#ref: reference.clone(),
            data_url: url.clone(),
        })
        .collect();
    images.sort_by(|a, b| a.r#ref.cmp(&b.r#ref));
    qualify_expansion(
        record.kind,
        &compact.value,
        &refs
            .iter()
            .map(|(url, reference)| (reference.clone(), url.clone()))
            .collect(),
    )?;
    let stored = StoredRecord {
        schema: STORAGE_SCHEMA.into(),
        record: compact,
        images,
        expanded_value_sha256: crate::expression_file::digest(&full),
    };
    let encoded = serde_json::to_vec(&stored).map_err(|e| e.to_string())?;
    if encoded.len() >= raw.len() && full.len() <= MAX_RECORD_BYTES {
        return Ok(raw);
    }
    if encoded.len() > MAX_RECORD_BYTES + 2048 {
        return Err(size_refusal(
            record,
            "Recovery record exceeds 8 MiB",
            "write_image_dictionary_storage",
            SizeEvidence {
                public: Some(&full),
                raw_record: Some(&raw),
                stored_candidate: Some(&encoded),
                dictionary_entries: Some(stored.images.len()),
            },
        ));
    }
    Ok(encoded)
}

fn decode_record(bytes: &[u8], validate_body: bool) -> Result<Record, String> {
    let crate::expression_file::UniqueValue(value) =
        serde_json::from_slice(bytes).map_err(|e| format!("Invalid native recovery entry: {e}"))?;
    if value["schema"] == SCHEMA {
        let record: Record = serde_json::from_value(value).map_err(|e| e.to_string())?;
        let full = serde_json::to_vec(&record.value).map_err(|e| e.to_string())?;
        if full.len() > MAX_RECORD_BYTES {
            return Err(size_refusal(
                &record,
                "Recovery record exceeds 8 MiB",
                "legacy_raw_value_decode",
                SizeEvidence {
                    public: Some(&full),
                    raw_record: Some(bytes),
                    stored_candidate: Some(bytes),
                    dictionary_entries: Some(0),
                },
            ));
        }
        return Ok(record);
    }
    if value["schema"] != STORAGE_SCHEMA {
        return Err("Unsupported native recovery storage schema".into());
    }
    let mut stored: StoredRecord = serde_json::from_value(value)
        .map_err(|e| format!("Invalid native recovery envelope: {e}"))?;
    if !crate::expression_file::digest_ref(&stored.expanded_value_sha256)
        || stored.images.len() > crate::expression_file::MAX_IMAGES
    {
        return Err("Invalid recovery digest or image dictionary budget".into());
    }
    let mut images = BTreeMap::new();
    for image in stored.images {
        if !crate::expression_file::digest_ref(&image.r#ref)
            || !crate::expression_file::png(&image.data_url)
            || crate::expression_file::digest(image.data_url.as_bytes()) != image.r#ref
        {
            return Err("Invalid embedded recovery image schema or digest".into());
        }
        if images.insert(image.r#ref, image.data_url).is_some() {
            return Err("Duplicate embedded recovery image reference".into());
        }
    }
    qualify_expansion(stored.record.kind, &stored.record.value, &images)?;
    if validate_body {
        crate::expression_file::expand(&mut stored.record.value, &images);
        if crate::expression_file::digest(
            &serde_json::to_vec(&stored.record.value).map_err(|e| e.to_string())?,
        ) != stored.expanded_value_sha256
        {
            return Err("Expanded recovery value digest differs".into());
        }
    }
    Ok(stored.record)
}
fn filename(kind: Kind, id: &str) -> String {
    format!(
        "{:x}.json",
        Sha256::digest(format!("{kind:?}:{id}").as_bytes())
    )
}
fn ready(record: Option<&Record>) -> Value {
    json!({"schema":SCHEMA,"state":"ready","record":record.map(Record::public)})
}
fn conflict(current: Option<u64>) -> Value {
    json!({"schema":SCHEMA,"state":"revision_conflict","current_revision":current})
}

impl Store {
    pub fn apply(&self, request: Request) -> Result<Value, String> {
        let context = size_request_context(&request);
        #[cfg(unix)]
        let result = self.apply_unix(request);
        #[cfg(not(unix))]
        let result = {
            let _ = request;
            Err("Native recovery is unavailable on this platform".into())
        };
        result.map_err(|error| attach_size_request_context(error, &context))
    }
    #[cfg(unix)]
    fn apply_unix(&self, request: Request) -> Result<Value, String> {
        use std::{
            fs,
            io::Read,
            time::{Duration, Instant},
        };
        let home = self
            .home
            .clone()
            .or_else(|| std::env::var_os("OI_HOME").map(PathBuf::from))
            .or_else(|| std::env::var_os("HOME").map(|h| PathBuf::from(h).join(".oi")))
            .ok_or("Native recovery home is unavailable")?;
        fs::create_dir_all(&home).map_err(|e| e.to_string())?;
        if fs::symlink_metadata(&home)
            .map_err(|e| e.to_string())?
            .file_type()
            .is_symlink()
        {
            return Err("Native recovery home must not be a symlink".into());
        }
        let home = unix::Directory::open(&home)?;
        let root = home.child("desktop")?.child("expression-recovery")?;
        let lock = root
            .file(".lock", true, true)?
            .ok_or("Cannot open native recovery lock")?;
        let started = Instant::now();
        loop {
            match lock.try_lock() {
                Ok(()) => break,
                Err(std::fs::TryLockError::WouldBlock)
                    if started.elapsed() < Duration::from_secs(3) =>
                {
                    std::thread::sleep(Duration::from_millis(10))
                }
                Err(error) => return Err(format!("Native recovery lock is unavailable: {error}")),
            }
        }
        root.cleanup_pending(128)?;
        let scope = match &request {
            Request::Read { scope, .. }
            | Request::List { scope, .. }
            | Request::FindCheckpoint { scope, .. }
            | Request::Write { scope, .. }
            | Request::Remove { scope, .. } => *scope,
        };
        let dir = root.child(scope.name())?;
        dir.cleanup_pending(MAX_RECORD_BYTES + 2048)?;
        let mut sequence = match root.file(".sequence", false, false)? {
            None => 0,
            Some(mut file) => {
                let mut bytes = Vec::new();
                file.by_ref()
                    .take(128)
                    .read_to_end(&mut bytes)
                    .map_err(|e| e.to_string())?;
                if file.metadata().map_err(|e| e.to_string())?.len() > 128 {
                    return Err("Native recovery sequence exceeds its bound".into());
                }
                serde_json::from_slice::<u64>(&bytes)
                    .map_err(|_| "Native recovery sequence is corrupt")?
            }
        };
        if sequence > MAX_REVISION {
            return Err("Native recovery revision exceeds the exact JSON integer bound".into());
        }
        match request {
            Request::Read { kind, id, .. } => {
                safe_id(&id)?;
                let record = read_record(&dir, scope, &filename(kind, &id), sequence, true)?;
                Ok(ready(record.as_ref()))
            }
            Request::List { kind, .. } => {
                let records = read_records(&dir, scope, sequence, false)?;
                Ok(
                    json!({"schema":SCHEMA,"state":"listed","records":records.iter().filter(|r|r.kind==kind).map(Record::metadata).collect::<Vec<_>>()}),
                )
            }
            Request::FindCheckpoint { expression_ref, .. } => {
                reference(&expression_ref)?;
                // Inspect metadata without expanding every unrelated private
                // body. Only the exact addressed checkpoint returns content.
                let records = read_records(&dir, scope, sequence, false)?;
                let matching = records
                    .iter()
                    .filter(|r| {
                        r.kind == Kind::Checkpoint
                            && r.value
                                .pointer("/view/document/expression_ref")
                                .and_then(Value::as_str)
                                == Some(&expression_ref)
                    })
                    .collect::<Vec<_>>();
                if matching.len() > 1 {
                    return Err("Several native working drafts address this Expression; choose a draft explicitly".into());
                }
                let record = matching
                    .first()
                    .map(|record| {
                        read_record(
                            &dir,
                            scope,
                            &filename(record.kind, &record.id),
                            sequence,
                            true,
                        )
                    })
                    .transpose()?
                    .flatten();
                Ok(ready(record.as_ref()))
            }
            Request::Write {
                kind,
                id,
                expected_revision,
                value,
                ..
            } => {
                validate(kind, &id, &value).map_err(|error| {
                    if error == COMPONENT_SIZE_MESSAGE {
                        size_refusal_basis(
                            SizeRecordBasis {
                                scope,
                                kind,
                                id: &id,
                                revision: None,
                                value: &value,
                            },
                            &error,
                            "inbound_component_preflight",
                            SizeEvidence {
                                public: None,
                                raw_record: None,
                                stored_candidate: None,
                                dictionary_entries: None,
                            },
                        )
                    } else {
                        error
                    }
                })?;
                let previous = read_record(&dir, scope, &filename(kind, &id), sequence, true)?;
                if previous.as_ref().map(|r| r.revision) != expected_revision {
                    return Ok(conflict(previous.as_ref().map(|r| r.revision)));
                }
                let entries = inventory(&dir)?;
                if previous.is_none() && entries.len() >= MAX_RECORDS {
                    return Err(
                        "Native recovery scope exceeds 256 records; no retained work was evicted"
                            .into(),
                    );
                }
                sequence = sequence
                    .checked_add(1)
                    .filter(|v| *v <= MAX_REVISION)
                    .ok_or("Native recovery revision exhausted")?;
                let record = Record {
                    schema: SCHEMA.into(),
                    scope,
                    kind,
                    id,
                    revision: sequence,
                    value,
                };
                let bytes = encode_record(&record)?;
                let target = filename(kind, &record.id);
                let total = entries
                    .iter()
                    .filter(|(name, _)| *name != target)
                    .try_fold(bytes.len(), |total, (_, len)| {
                        total
                            .checked_add(*len)
                            .ok_or("Native recovery size overflow")
                    })?;
                if total > MAX_SCOPE_BYTES {
                    return Err(
                        "Native recovery scope exceeds 64 MiB; no retained work was evicted".into(),
                    );
                }
                // Allocate monotonically first. A crash can leave a gap, never reissue a
                // previously acknowledged revision after remove/recreate.
                root.atomic(
                    ".sequence",
                    &serde_json::to_vec(&sequence).map_err(|e| e.to_string())?,
                )?;
                dir.atomic(&filename(kind, &record.id), &bytes)?;
                Ok(json!({"schema":SCHEMA,"state":"written","record":record.public()}))
            }
            Request::Remove {
                kind,
                id,
                expected_revision,
                ..
            } => {
                safe_id(&id)?;
                let previous = read_record(&dir, scope, &filename(kind, &id), sequence, true)?;
                if previous.as_ref().map(|r| r.revision) != Some(expected_revision) {
                    return Ok(conflict(previous.as_ref().map(|r| r.revision)));
                }
                sequence = sequence
                    .checked_add(1)
                    .filter(|v| *v <= MAX_REVISION)
                    .ok_or("Native recovery revision exhausted")?;
                root.atomic(
                    ".sequence",
                    &serde_json::to_vec(&sequence).map_err(|e| e.to_string())?,
                )?;
                dir.remove(&filename(kind, &id))?;
                Ok(json!({"schema":SCHEMA,"state":"removed","id":id,"revision":sequence}))
            }
        }
    }
}
// Autosave reads only the addressed body. Capacity accounting uses file
// metadata under the same process-independent lock, never parses other drafts.
#[cfg(unix)]
fn inventory(dir: &unix::Directory) -> Result<Vec<(String, usize)>, String> {
    let mut entries = Vec::new();
    let mut total = 0usize;
    for name in dir.names()? {
        if !name.ends_with(".json") {
            continue;
        }
        if name.len() != 69 || !name.as_bytes()[..64].iter().all(|b| b.is_ascii_hexdigit()) {
            return Err("Invalid native recovery filename".into());
        }
        if entries.len() >= MAX_RECORDS {
            return Err("Native recovery scope exceeds 256 records".into());
        }
        let file = dir
            .file(&name, false, false)?
            .ok_or("Native recovery entry disappeared under its lock")?;
        let len = usize::try_from(file.metadata().map_err(|e| e.to_string())?.len())
            .map_err(|_| "Native recovery size overflow")?;
        if len > MAX_RECORD_BYTES + 2048 {
            return Err("Native recovery entry exceeds its byte bound".into());
        }
        total = total
            .checked_add(len)
            .ok_or("Native recovery size overflow")?;
        if total > MAX_SCOPE_BYTES {
            return Err("Native recovery scope exceeds 64 MiB".into());
        }
        entries.push((name, len));
    }
    Ok(entries)
}
#[cfg(unix)]
fn read_record(
    dir: &unix::Directory,
    scope: Scope,
    name: &str,
    sequence: u64,
    validate_body: bool,
) -> Result<Option<Record>, String> {
    use std::io::Read;
    let Some(mut file) = dir.file(name, false, false)? else {
        return Ok(None);
    };
    let len = file.metadata().map_err(|e| e.to_string())?.len();
    if len > MAX_RECORD_BYTES as u64 + 2048 {
        return Err("Native recovery entry exceeds its byte bound".into());
    }
    let mut bytes = Vec::new();
    file.by_ref()
        .take(MAX_RECORD_BYTES as u64 + 2049)
        .read_to_end(&mut bytes)
        .map_err(|e| e.to_string())?;
    if bytes.len() as u64 != len {
        return Err("Native recovery entry changed while being read".into());
    }
    let record = decode_record(&bytes, validate_body)?;
    if record.schema != SCHEMA
        || record.scope != scope
        || record.revision == 0
        || record.revision > sequence
        || filename(record.kind, &record.id) != name
    {
        return Err(
            "Native recovery entry identity disagrees with its storage key or sequence".into(),
        );
    }
    safe_id(&record.id)?;
    if validate_body {
        validate(record.kind, &record.id, &record.value)?;
    }
    Ok(Some(record))
}
#[cfg(unix)]
fn read_records(
    dir: &unix::Directory,
    scope: Scope,
    sequence: u64,
    validate_body: bool,
) -> Result<Vec<Record>, String> {
    let mut records = Vec::new();
    for (name, _) in inventory(dir)? {
        records.push(
            read_record(dir, scope, &name, sequence, validate_body)?
                .ok_or("Native recovery entry disappeared under its lock")?,
        );
    }
    records.sort_by(|a, b| a.id.cmp(&b.id));
    Ok(records)
}

#[cfg(unix)]
mod unix {
    use std::{
        ffi::{CStr, CString},
        fs::{File, OpenOptions},
        io::Write,
        os::{
            fd::{AsRawFd, FromRawFd},
            unix::fs::{MetadataExt, OpenOptionsExt},
        },
        path::Path,
    };
    pub struct Directory(File);
    fn name(value: &str) -> Result<CString, String> {
        if value.is_empty() || value.contains('/') || value == "." || value == ".." {
            return Err("Invalid native recovery member".into());
        }
        CString::new(value).map_err(|e| e.to_string())
    }
    fn error() -> String {
        std::io::Error::last_os_error().to_string()
    }
    fn owned_file(fd: i32) -> Result<File, String> {
        if fd < 0 {
            Err(error())
        } else {
            Ok(unsafe { File::from_raw_fd(fd) })
        }
    }
    impl Directory {
        pub fn open(path: &Path) -> Result<Self, String> {
            let file = OpenOptions::new()
                .read(true)
                .custom_flags(libc::O_NOFOLLOW | libc::O_DIRECTORY | libc::O_CLOEXEC)
                .open(path)
                .map_err(|e| e.to_string())?;
            Ok(Self(file))
        }
        pub fn child(&self, value: &str) -> Result<Self, String> {
            let value = name(value)?;
            let fd = self.0.as_raw_fd();
            let flags = libc::O_RDONLY | libc::O_DIRECTORY | libc::O_NOFOLLOW | libc::O_CLOEXEC;
            let mut result = unsafe { libc::openat(fd, value.as_ptr(), flags) };
            if result < 0 && std::io::Error::last_os_error().kind() == std::io::ErrorKind::NotFound
            {
                if unsafe { libc::mkdirat(fd, value.as_ptr(), 0o700) } < 0
                    && std::io::Error::last_os_error().kind() != std::io::ErrorKind::AlreadyExists
                {
                    return Err(error());
                }
                self.0.sync_all().map_err(|e| e.to_string())?;
                result = unsafe { libc::openat(fd, value.as_ptr(), flags) };
            }
            Ok(Self(owned_file(result)?))
        }
        pub fn file(
            &self,
            value: &str,
            writable: bool,
            create: bool,
        ) -> Result<Option<File>, String> {
            let value = name(value)?;
            let flags = (if writable {
                libc::O_RDWR
            } else {
                libc::O_RDONLY
            }) | libc::O_NOFOLLOW
                | libc::O_CLOEXEC
                | libc::O_NONBLOCK
                | if create { libc::O_CREAT } else { 0 };
            let fd = unsafe { libc::openat(self.0.as_raw_fd(), value.as_ptr(), flags, 0o600) };
            if fd < 0 && std::io::Error::last_os_error().kind() == std::io::ErrorKind::NotFound {
                return Ok(None);
            }
            let file = owned_file(fd)?;
            let meta = file.metadata().map_err(|e| e.to_string())?;
            if !meta.is_file() || meta.nlink() != 1 {
                return Err("Native recovery member must be a private regular file".into());
            }
            Ok(Some(file))
        }
        /// Atomic writes create only this exact temporary namespace. A process
        /// crash releases the outer lock but may leave an unacknowledged file;
        /// remove those private files before accepting another operation. Never
        /// delete a record or infer that a temporary is an acknowledged draft.
        pub fn cleanup_pending(&self, max_bytes: usize) -> Result<(), String> {
            for value in self.names()? {
                if !value.starts_with(".pending-") {
                    continue;
                }
                if value.len() != 73 || !value.as_bytes()[9..].iter().all(|b| b.is_ascii_hexdigit())
                {
                    return Err("Invalid native recovery temporary identity".into());
                }
                let file = self
                    .file(&value, false, false)?
                    .ok_or("Native recovery temporary disappeared under its lock")?;
                if file.metadata().map_err(|e| e.to_string())?.len() > max_bytes as u64 {
                    return Err("Native recovery temporary exceeds its byte bound".into());
                }
                self.remove(&value)?;
            }
            Ok(())
        }
        pub fn atomic(&self, value: &str, bytes: &[u8]) -> Result<(), String> {
            // Inspect the existing destination with NOFOLLOW as well as writing the
            // fresh descriptor. renameat never follows a destination swapped later.
            let _ = self.file(value, false, false)?;
            let target = name(value)?;
            let mut random = [0u8; 16];
            getrandom::fill(&mut random).map_err(|e| e.to_string())?;
            let temporary = format!(".pending-{:x}", sha2::Sha256::digest(random));
            let temp = name(&temporary)?;
            let mut file = owned_file(unsafe {
                libc::openat(
                    self.0.as_raw_fd(),
                    temp.as_ptr(),
                    libc::O_WRONLY
                        | libc::O_CREAT
                        | libc::O_EXCL
                        | libc::O_NOFOLLOW
                        | libc::O_CLOEXEC,
                    0o600,
                )
            })?;
            let result = (|| {
                file.write_all(bytes).map_err(|e| e.to_string())?;
                file.sync_all().map_err(|e| e.to_string())?;
                if unsafe {
                    libc::renameat(
                        self.0.as_raw_fd(),
                        temp.as_ptr(),
                        self.0.as_raw_fd(),
                        target.as_ptr(),
                    )
                } < 0
                {
                    return Err(error());
                }
                self.0.sync_all().map_err(|e| e.to_string())
            })();
            if result.is_err() {
                unsafe { libc::unlinkat(self.0.as_raw_fd(), temp.as_ptr(), 0) };
            }
            result
        }
        pub fn remove(&self, value: &str) -> Result<(), String> {
            let _ = self
                .file(value, false, false)?
                .ok_or("Native recovery member is absent")?;
            let value = name(value)?;
            if unsafe { libc::unlinkat(self.0.as_raw_fd(), value.as_ptr(), 0) } < 0 {
                return Err(error());
            }
            self.0.sync_all().map_err(|e| e.to_string())
        }
        pub fn names(&self) -> Result<Vec<String>, String> {
            // A dup shares the directory offset; reopen the anchored directory
            // so cleanup followed by inventory always starts at the beginning.
            let fd = unsafe {
                libc::openat(
                    self.0.as_raw_fd(),
                    c".".as_ptr(),
                    libc::O_RDONLY | libc::O_DIRECTORY | libc::O_NOFOLLOW | libc::O_CLOEXEC,
                )
            };
            if fd < 0 {
                return Err(error());
            }
            let stream = unsafe { libc::fdopendir(fd) };
            if stream.is_null() {
                unsafe { libc::close(fd) };
                return Err(error());
            }
            struct Close(*mut libc::DIR);
            impl Drop for Close {
                fn drop(&mut self) {
                    unsafe {
                        libc::closedir(self.0);
                    }
                }
            }
            let guard = Close(stream);
            let mut values = Vec::new();
            loop {
                #[cfg(any(target_os = "macos", target_os = "ios", target_os = "freebsd"))]
                unsafe {
                    *libc::__error() = 0;
                }
                #[cfg(any(target_os = "linux", target_os = "android"))]
                unsafe {
                    *libc::__errno_location() = 0;
                }
                let entry = unsafe { libc::readdir(guard.0) };
                if entry.is_null() {
                    if std::io::Error::last_os_error().raw_os_error().unwrap_or(0) != 0 {
                        return Err(error());
                    }
                    break;
                }
                let name = unsafe { CStr::from_ptr((*entry).d_name.as_ptr()) }
                    .to_str()
                    .map_err(|_| "Native recovery filename is not UTF-8")?;
                if name != "." && name != ".." {
                    values.push(name.to_owned());
                }
                if values.len() > 1024 {
                    return Err("Native recovery directory exceeds its entry bound".into());
                }
            }
            Ok(values)
        }
    }
    use sha2::Digest;
}
#[cfg(all(test, unix))]
mod tests {
    use super::*;
    use std::{
        fs,
        os::unix::fs::{symlink, PermissionsExt},
        sync::{Arc, Barrier},
    };

    struct Home(PathBuf);
    impl Home {
        fn new() -> Self {
            let mut nonce = [0u8; 16];
            getrandom::fill(&mut nonce).unwrap();
            let path = std::env::temp_dir().join(format!(
                "oi-expression-recovery-{:x}",
                Sha256::digest(nonce)
            ));
            fs::create_dir(&path).unwrap();
            Self(path)
        }
        fn store(&self) -> Store {
            Store {
                home: Some(self.0.clone()),
            }
        }
        fn root(&self) -> PathBuf {
            self.0.join("desktop/expression-recovery")
        }
        fn path(&self, scope: Scope, kind: Kind, id: &str) -> PathBuf {
            self.root().join(scope.name()).join(filename(kind, id))
        }
    }
    impl Drop for Home {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }
    // These are declared local journal payloads, never claimed as a source
    // reading. The process-level integration separately uses the production
    // Journey converter and NativeWorking checkpoint implementation.
    fn draft(id: &str) -> Value {
        json!({"schema":"oi.journey","version":1,"id":id,"name":"Recovery test","scenes":[{"id":"main"}]})
    }
    fn write(scope: Scope, kind: Kind, id: &str, revision: Option<u64>, value: Value) -> Request {
        Request::Write {
            scope,
            kind,
            id: id.into(),
            expected_revision: revision,
            value,
        }
    }
    fn read(scope: Scope, kind: Kind, id: &str) -> Request {
        Request::Read {
            scope,
            kind,
            id: id.into(),
        }
    }
    fn revision(value: &Value) -> u64 {
        value["record"]["revision"].as_u64().unwrap()
    }
    fn native_checkpoint(id: &str) -> Value {
        let mut owner = crate::expression::Application::default();
        let (reply, _) = owner
            .apply(
                &crate::flow::CentralClient::discover(),
                crate::expression::Request::Create {
                    expression_ref: "expression:recovery-test".into(),
                    title: "Recovery test".into(),
                    actor: "test:recovery".into(),
                },
            )
            .unwrap();
        assert_eq!(reply["state"], "ready");
        json!({"schema":"oi.native-working/v1","draft_id":id,"view":{"document":reply["document"],"journey":draft(id)}})
    }

    #[test]
    fn oversized_public_component_refuses_before_image_materialisation() {
        let home = Home::new();
        let mut value = draft("oversized-images");
        let png = format!(
            "data:image/png;base64,{}",
            "AAAA".repeat(MAX_RECORD_BYTES / 4)
        );
        value["retained"] = json!([
            {"dataUrl": png}, {"dataUrl": png},
            {"schema":"oi.expression-image-ref/v1","ref":"invalid-placement"}
        ]);
        // If interning or expansion qualification runs before the borrowed
        // size preflight, the misplaced reference wins with a different error.
        // The ordinary native write must refuse the size first, without a
        // record or a persisted sequence, before copying either PNG String.
        let record = Record {
            schema: SCHEMA.into(),
            scope: Scope::Expressions,
            kind: Kind::Draft,
            id: "oversized-images".into(),
            revision: 1,
            value,
        };
        let refused = encode_record(&record).unwrap_err();
        assert!(
            refused.contains("8 MiB before material cloning"),
            "{refused}"
        );
        let refused = home
            .store()
            .apply(write(
                Scope::Expressions,
                Kind::Draft,
                "oversized-images",
                None,
                record.value,
            ))
            .unwrap_err();
        assert!(
            refused.contains("8 MiB before material cloning"),
            "{refused}"
        );
        assert!(!home
            .path(Scope::Expressions, Kind::Draft, "oversized-images")
            .exists());
        assert!(!home.root().join(".sequence").exists());
    }

    /// The input is the retained failed public operation from the ordinary
    /// Epi world, not a synthesized checkpoint or an owner-response fixture.
    #[test]
    #[ignore = "supply OI_RECOVERY_REAL_FAILURE with the retained ordinary-production refusal"]
    fn actual_epi_checkpoint_preserves_all_material_and_pending_work_across_recovery() {
        let path = std::env::var("OI_RECOVERY_REAL_FAILURE").unwrap();
        let failure: Value = serde_json::from_slice(&fs::read(path).unwrap()).unwrap();
        assert_eq!(
            failure["response"]["error"],
            "Recovery record exceeds 8 MiB"
        );
        let request = &failure["request"]["request"];
        let original = request["value"].clone();
        let id = request["id"].as_str().unwrap();
        assert_eq!(request["kind"], "checkpoint");
        assert!(serde_json::to_vec(&original).unwrap().len() > MAX_RECORD_BYTES);
        let document: crate::expression::Document =
            serde_json::from_value(original["view"]["document"].clone()).unwrap();
        document.validate().unwrap();
        let home = Home::new();
        let written = home
            .store()
            .apply(write(
                Scope::Expressions,
                Kind::Checkpoint,
                id,
                None,
                original.clone(),
            ))
            .expect("The complete actual checkpoint must fit by lossless native storage encoding");
        assert_eq!(written["record"]["value"], original);
        let stored_path = home.path(Scope::Expressions, Kind::Checkpoint, id);
        let stored_bytes = fs::read(&stored_path).unwrap();
        assert!(stored_bytes.len() <= MAX_RECORD_BYTES + 2048);
        let stored: Value = serde_json::from_slice(&stored_bytes).unwrap();
        assert_eq!(stored["schema"], "oi.expression-recovery-storage/v1");
        assert_eq!(stored["images"].as_array().unwrap().len(), 6);

        // A fresh Store has no in-memory state. Every body, source, private
        // history, working/saved material and interrupted request must return
        // exactly; recovery itself never executes the pending owner operation.
        let reopened = home
            .store()
            .apply(read(Scope::Expressions, Kind::Checkpoint, id))
            .unwrap();
        assert_eq!(reopened["record"], written["record"]);
        let found = home
            .store()
            .apply(Request::FindCheckpoint {
                scope: Scope::Expressions,
                expression_ref: document.expression_ref.clone(),
            })
            .unwrap();
        assert_eq!(found["record"], written["record"]);
        let listed = home
            .store()
            .apply(Request::List {
                scope: Scope::Expressions,
                kind: Kind::Checkpoint,
            })
            .unwrap();
        assert_eq!(listed["records"].as_array().unwrap().len(), 1);
        assert_eq!(listed["records"][0]["id"], id);
        assert_eq!(
            listed["records"][0]["expression_ref"],
            document.expression_ref
        );
        assert!(
            listed["records"][0].get("value").is_none(),
            "Inventory must not materialize private body data"
        );
        let stale = home
            .store()
            .apply(write(
                Scope::Expressions,
                Kind::Checkpoint,
                id,
                Some(revision(&written) + 1),
                original.clone(),
            ))
            .unwrap();
        assert_eq!(stale["state"], "revision_conflict");
        assert_eq!(fs::read(&stored_path).unwrap(), stored_bytes);

        let mut missing = stored.clone();
        missing["images"].as_array_mut().unwrap().pop();
        let mut modified = stored.clone();
        modified["images"][0]["data_url"] = json!("data:image/png;base64,AAAA");
        let mut duplicate = stored.clone();
        let first = duplicate["images"][0].clone();
        duplicate["images"].as_array_mut().unwrap().push(first);
        let mut wrong_digest = stored.clone();
        wrong_digest["expanded_value_sha256"] = json!(format!("sha256:{}", "0".repeat(64)));
        let mut unused = stored.clone();
        let url = "data:image/png;base64,AAAA";
        unused["images"].as_array_mut().unwrap().push(json!({
            "ref": crate::expression_file::digest(url.as_bytes()), "data_url": url
        }));
        let mut wrong_placement = stored.clone();
        wrong_placement["record"]["value"]["view"]["notes"] =
            json!([{"schema":"oi.expression-image-ref/v1","ref":stored["images"][0]["ref"]}]);
        for mutant in [
            missing,
            modified,
            duplicate,
            wrong_digest,
            unused,
            wrong_placement,
        ] {
            fs::write(&stored_path, serde_json::to_vec(&mutant).unwrap()).unwrap();
            assert!(
                home.store()
                    .apply(read(Scope::Expressions, Kind::Checkpoint, id))
                    .is_err(),
                "A corrupted image dictionary or source envelope must refuse"
            );
        }
        let mut future_schema = stored.clone();
        future_schema["schema"] = json!("oi.expression-recovery-storage/v99");
        let mut unknown_envelope = stored.clone();
        unknown_envelope["unexpected"] = json!(true);
        let mut unknown_record = stored.clone();
        unknown_record["record"]["unexpected"] = json!(true);
        let mut unknown_image = stored.clone();
        unknown_image["images"][0]["unexpected"] = json!(true);
        let mut unknown_ref = stored.clone();
        let marker = &mut unknown_ref["record"]["value"]["view"]["journey"]["scenes"][0]
            ["entities"][16]["source"]["image"]["dataUrl"];
        assert_eq!(marker["schema"], "oi.expression-image-ref/v1");
        marker["unexpected"] = json!(true);
        for (mutant, reason) in [
            (future_schema, "Unsupported native recovery storage schema"),
            (unknown_envelope, "unknown field"),
            (unknown_record, "unknown field"),
            (unknown_image, "unknown field"),
            (unknown_ref, "unknown field"),
        ] {
            fs::write(&stored_path, serde_json::to_vec(&mutant).unwrap()).unwrap();
            let refused = home
                .store()
                .apply(read(Scope::Expressions, Kind::Checkpoint, id))
                .unwrap_err();
            assert!(refused.contains(reason), "{refused}");
        }
        let duplicate_key = format!(
            "{{\"schema\":\"{}\",{}",
            STORAGE_SCHEMA,
            std::str::from_utf8(&stored_bytes)
                .unwrap()
                .strip_prefix('{')
                .unwrap()
        );
        fs::write(&stored_path, duplicate_key).unwrap();
        assert!(home
            .store()
            .apply(read(Scope::Expressions, Kind::Checkpoint, id))
            .unwrap_err()
            .contains("Duplicate"));

        // Listing deliberately exposes only metadata. It is not acceptance
        // of a checkpoint body: finding this exact Expression must verify the
        // full expanded digest before returning any private material.
        let mut corrupt_body = stored.clone();
        corrupt_body["expanded_value_sha256"] = json!(format!("sha256:{}", "0".repeat(64)));
        fs::write(&stored_path, serde_json::to_vec(&corrupt_body).unwrap()).unwrap();
        let metadata = home
            .store()
            .apply(Request::List {
                scope: Scope::Expressions,
                kind: Kind::Checkpoint,
            })
            .unwrap();
        assert_eq!(
            metadata["records"][0]["expression_ref"],
            document.expression_ref
        );
        assert!(metadata["records"][0].get("value").is_none());
        assert!(home
            .store()
            .apply(Request::FindCheckpoint {
                scope: Scope::Expressions,
                expression_ref: document.expression_ref.clone(),
            })
            .unwrap_err()
            .contains("Expanded recovery value digest differs"));
        let mut amplified = stored.clone();
        let largest = stored["images"]
            .as_array()
            .unwrap()
            .iter()
            .max_by_key(|row| row["data_url"].as_str().unwrap().len())
            .unwrap();
        amplified["record"]["value"]["view"]["journey"]["retained"] = json!(vec![
            json!({"dataUrl":{"schema":"oi.expression-image-ref/v1","ref":largest["ref"]}});
            400
        ]);
        fs::write(&stored_path, serde_json::to_vec(&amplified).unwrap()).unwrap();
        assert!(home
            .store()
            .apply(read(Scope::Expressions, Kind::Checkpoint, id))
            .unwrap_err()
            .contains("8 MiB before material cloning"));
        fs::write(&stored_path, &stored_bytes).unwrap();
        assert_eq!(
            home.store()
                .apply(read(Scope::Expressions, Kind::Checkpoint, id))
                .unwrap()["record"],
            written["record"]
        );

        // A valid material dictionary cannot bypass any expanded component's
        // existing byte bound or make recovery evict the accepted checkpoint.
        let mut oversized = original.clone();
        oversized["view"]["journey"]["retained"] = json!("x".repeat(MAX_RECORD_BYTES));
        assert!(home
            .store()
            .apply(write(
                Scope::Expressions,
                Kind::Checkpoint,
                id,
                Some(revision(&written)),
                oversized
            ))
            .unwrap_err()
            .contains("8 MiB"));
        assert_eq!(fs::read(&stored_path).unwrap(), stored_bytes);
    }

    #[test]
    fn durable_reopen_scopes_metadata_and_no_revision_aba() {
        let home = Home::new();
        let original = draft("draft-1");
        let first = home
            .store()
            .apply(write(
                Scope::Expressions,
                Kind::Draft,
                "draft-1",
                None,
                original.clone(),
            ))
            .unwrap();
        let old = revision(&first);
        // Recreate the owner from disk; no in-memory map is shared.
        assert_eq!(
            home.store()
                .apply(read(Scope::Expressions, Kind::Draft, "draft-1"))
                .unwrap()["record"]["value"],
            original
        );
        assert!(home
            .store()
            .apply(read(Scope::Techne, Kind::Draft, "draft-1"))
            .unwrap()["record"]
            .is_null());
        assert!(home
            .store()
            .apply(read(Scope::Expressions, Kind::Checkpoint, "draft-1"))
            .unwrap()["record"]
            .is_null());
        home.store()
            .apply(write(
                Scope::Techne,
                Kind::Draft,
                "draft-1",
                None,
                original.clone(),
            ))
            .unwrap();
        let listing = home
            .store()
            .apply(Request::List {
                scope: Scope::Expressions,
                kind: Kind::Draft,
            })
            .unwrap();
        assert_eq!(listing["records"].as_array().unwrap().len(), 1);
        assert!(listing["records"][0].get("value").is_none());
        home.store()
            .apply(Request::Remove {
                scope: Scope::Expressions,
                kind: Kind::Draft,
                id: "draft-1".into(),
                expected_revision: old,
            })
            .unwrap();
        assert!(home
            .store()
            .apply(read(Scope::Expressions, Kind::Draft, "draft-1"))
            .unwrap()["record"]
            .is_null());
        let recreated = home
            .store()
            .apply(write(
                Scope::Expressions,
                Kind::Draft,
                "draft-1",
                None,
                original.clone(),
            ))
            .unwrap();
        assert!(revision(&recreated) > old);
        assert_eq!(
            home.store()
                .apply(write(
                    Scope::Expressions,
                    Kind::Draft,
                    "draft-1",
                    Some(old),
                    original
                ))
                .unwrap()["state"],
            "revision_conflict"
        );
        assert_eq!(
            home.store()
                .apply(Request::Remove {
                    scope: Scope::Expressions,
                    kind: Kind::Draft,
                    id: "draft-1".into(),
                    expected_revision: old
                })
                .unwrap()["state"],
            "revision_conflict"
        );
        assert_eq!(
            home.store()
                .apply(read(Scope::Expressions, Kind::Draft, "draft-1"))
                .unwrap()["record"]["revision"],
            recreated["record"]["revision"]
        );
        assert_eq!(
            fs::metadata(home.path(Scope::Expressions, Kind::Draft, "draft-1"))
                .unwrap()
                .permissions()
                .mode()
                & 0o777,
            0o600
        );
        assert_eq!(
            fs::metadata(home.root()).unwrap().permissions().mode() & 0o777,
            0o700
        );
    }

    #[test]
    fn actual_native_document_identity_and_interrupted_creation_are_retained_without_execution() {
        let home = Home::new();
        let checkpoint = native_checkpoint("native-1");
        home.store()
            .apply(write(
                Scope::Techne,
                Kind::Checkpoint,
                "native-1",
                None,
                checkpoint.clone(),
            ))
            .unwrap();
        let found = home
            .store()
            .apply(Request::FindCheckpoint {
                scope: Scope::Techne,
                expression_ref: "expression:recovery-test".into(),
            })
            .unwrap();
        assert_eq!(found["record"]["value"], checkpoint);
        let mut invalid = checkpoint.clone();
        invalid["view"]["document"]["revision"] = json!(0);
        assert!(home
            .store()
            .apply(write(
                Scope::Techne,
                Kind::Checkpoint,
                "native-1",
                Some(revision(&found)),
                invalid
            ))
            .is_err());
        let mut wrong_pending = checkpoint.clone();
        wrong_pending["pending"] = json!({"kind":"selection","request":{"operation":"edit","expression_ref":"expression:other","expected_revision":1,"actor":"test:recovery","changes":[{"change":"focus","scene_ref":"expression:recovery-test:scene:main","entity_ref":null}]}});
        assert!(home
            .store()
            .apply(write(
                Scope::Techne,
                Kind::Checkpoint,
                "native-1",
                Some(revision(&found)),
                wrong_pending
            ))
            .is_err());
        assert_eq!(
            home.store()
                .apply(read(Scope::Techne, Kind::Checkpoint, "native-1"))
                .unwrap()["record"]["value"],
            checkpoint
        );
        let pending = json!({"schema":"oi.native-working/v1","draft_id":"pending-1","pending":{"kind":"create","expression_ref":"expression:pending-recovery","submitted":{"journey":draft("pending-1"),"sceneId":"main","entityId":null}}});
        home.store()
            .apply(write(
                Scope::Techne,
                Kind::Checkpoint,
                "pending-1",
                None,
                pending.clone(),
            ))
            .unwrap();
        assert_eq!(
            home.store()
                .apply(read(Scope::Techne, Kind::Checkpoint, "pending-1"))
                .unwrap()["record"]["value"],
            pending
        );
        assert!(home
            .store()
            .apply(Request::FindCheckpoint {
                scope: Scope::Techne,
                expression_ref: "expression:pending-recovery".into()
            })
            .unwrap()["record"]
            .is_null());
        let mut duplicate = checkpoint.clone();
        duplicate["draft_id"] = json!("native-2");
        duplicate["view"]["journey"]["id"] = json!("native-2");
        home.store()
            .apply(write(
                Scope::Techne,
                Kind::Checkpoint,
                "native-2",
                None,
                duplicate,
            ))
            .unwrap();
        assert!(home
            .store()
            .apply(Request::FindCheckpoint {
                scope: Scope::Techne,
                expression_ref: "expression:recovery-test".into()
            })
            .unwrap_err()
            .contains("Several"));
    }

    #[test]
    fn independent_store_writers_have_exactly_one_cas_winner() {
        let home = Home::new();
        let initial = home
            .store()
            .apply(write(
                Scope::Expressions,
                Kind::Draft,
                "race",
                None,
                draft("race"),
            ))
            .unwrap();
        let expected = revision(&initial);
        let barrier = Arc::new(Barrier::new(3));
        let threads = (0..2)
            .map(|n| {
                let barrier = barrier.clone();
                let store = home.store();
                std::thread::spawn(move || {
                    let mut value = draft("race");
                    value["name"] = json!(format!("Writer {n}"));
                    barrier.wait();
                    store
                        .apply(write(
                            Scope::Expressions,
                            Kind::Draft,
                            "race",
                            Some(expected),
                            value,
                        ))
                        .unwrap()
                })
            })
            .collect::<Vec<_>>();
        barrier.wait();
        let results = threads
            .into_iter()
            .map(|t| t.join().unwrap())
            .collect::<Vec<_>>();
        assert_eq!(
            results.iter().filter(|v| v["state"] == "written").count(),
            1
        );
        assert_eq!(
            results
                .iter()
                .filter(|v| v["state"] == "revision_conflict")
                .count(),
            1
        );
        let winner = results.iter().find(|v| v["state"] == "written").unwrap();
        assert_eq!(
            home.store()
                .apply(read(Scope::Expressions, Kind::Draft, "race"))
                .unwrap()["record"],
            winner["record"]
        );
    }

    #[test]
    fn symlink_and_hardlink_destinations_never_touch_their_target() {
        for target_kind in [
            "record", "sequence", "lock", "scope", "root", "home", "hardlink",
        ] {
            let home = Home::new();
            let outside = Home::new();
            let sentinel = outside.0.join("sentinel");
            fs::write(&sentinel, b"untouched").unwrap();
            let created = home
                .store()
                .apply(write(
                    Scope::Expressions,
                    Kind::Draft,
                    "protected",
                    None,
                    draft("protected"),
                ))
                .unwrap();
            let target = match target_kind {
                "record" | "hardlink" => home.path(Scope::Expressions, Kind::Draft, "protected"),
                "sequence" => home.root().join(".sequence"),
                "lock" => home.root().join(".lock"),
                "scope" => home.root().join("expressions"),
                "root" => home.root(),
                "home" => home.0.clone(),
                _ => unreachable!(),
            };
            if target.is_dir() {
                fs::remove_dir_all(&target).unwrap();
                symlink(&outside.0, &target).unwrap();
            } else {
                fs::remove_file(&target).unwrap();
                if target_kind == "hardlink" {
                    fs::hard_link(&sentinel, &target).unwrap();
                } else {
                    symlink(&sentinel, &target).unwrap();
                }
            }
            assert!(
                home.store()
                    .apply(write(
                        Scope::Expressions,
                        Kind::Draft,
                        "protected",
                        Some(revision(&created)),
                        draft("protected")
                    ))
                    .is_err(),
                "{target_kind}"
            );
            assert_eq!(fs::read(&sentinel).unwrap(), b"untouched", "{target_kind}");
        }
    }

    #[test]
    fn malformed_paths_fifo_and_unsafe_revision_refuse_without_hanging() {
        use std::ffi::CString;
        use std::os::unix::ffi::OsStrExt;
        let home = Home::new();
        home.store()
            .apply(Request::List {
                scope: Scope::Expressions,
                kind: Kind::Draft,
            })
            .unwrap();
        let malformed = format!("{}éx.json", "a".repeat(61));
        assert_eq!(malformed.len(), 69);
        let path = home.root().join("expressions").join(malformed);
        fs::write(&path, b"{}").unwrap();
        assert!(home
            .store()
            .apply(Request::List {
                scope: Scope::Expressions,
                kind: Kind::Draft
            })
            .is_err());
        fs::remove_file(path).unwrap();
        let fifo = home.path(Scope::Expressions, Kind::Draft, "pipe");
        let raw = CString::new(fifo.as_os_str().as_bytes()).unwrap();
        assert_eq!(unsafe { libc::mkfifo(raw.as_ptr(), 0o600) }, 0);
        let started = std::time::Instant::now();
        assert!(home
            .store()
            .apply(read(Scope::Expressions, Kind::Draft, "pipe"))
            .is_err());
        assert!(started.elapsed() < std::time::Duration::from_secs(1));
        fs::remove_file(fifo).unwrap();
        fs::write(home.root().join(".sequence"), MAX_REVISION.to_string()).unwrap();
        assert!(home
            .store()
            .apply(write(
                Scope::Expressions,
                Kind::Draft,
                "full",
                None,
                draft("full")
            ))
            .unwrap_err()
            .contains("exhausted"));
        fs::write(
            home.root().join(".sequence"),
            (MAX_REVISION + 1).to_string(),
        )
        .unwrap();
        assert!(home
            .store()
            .apply(read(Scope::Expressions, Kind::Draft, "full"))
            .unwrap_err()
            .contains("integer"));
        assert!(!home.path(Scope::Expressions, Kind::Draft, "full").exists());
    }

    #[test]
    fn bounded_capacity_refuses_without_evicting_saved_work() {
        let home = Home::new();
        let mut large = draft("large");
        large["retained"] = json!("x".repeat(MAX_RECORD_BYTES));
        assert!(home
            .store()
            .apply(write(Scope::Expressions, Kind::Draft, "large", None, large))
            .unwrap_err()
            .contains("8 MiB"));
        for n in 0..MAX_RECORDS {
            let id = format!("draft-{n}");
            home.store()
                .apply(write(
                    Scope::Expressions,
                    Kind::Draft,
                    &id,
                    None,
                    draft(&id),
                ))
                .unwrap();
        }
        assert!(home
            .store()
            .apply(write(
                Scope::Expressions,
                Kind::Draft,
                "extra",
                None,
                draft("extra")
            ))
            .unwrap_err()
            .contains("256"));
        assert!(home
            .store()
            .apply(read(Scope::Expressions, Kind::Draft, "draft-0"))
            .unwrap()["record"]
            .is_object());
        let first = home
            .store()
            .apply(read(Scope::Expressions, Kind::Draft, "draft-0"))
            .unwrap();
        assert_eq!(
            home.store()
                .apply(write(
                    Scope::Expressions,
                    Kind::Draft,
                    "draft-0",
                    Some(revision(&first)),
                    draft("draft-0")
                ))
                .unwrap()["state"],
            "written"
        );
        // Capacity is independent across the two application scopes.
        home.store()
            .apply(write(
                Scope::Techne,
                Kind::Draft,
                "extra",
                None,
                draft("extra"),
            ))
            .unwrap();
    }

    #[test]
    fn interrupted_atomic_temporaries_are_cleaned_without_evicting_work() {
        let home = Home::new();
        let written = home
            .store()
            .apply(write(
                Scope::Expressions,
                Kind::Draft,
                "retained",
                None,
                draft("retained"),
            ))
            .unwrap();
        let pending = format!(".pending-{}", "a".repeat(64));
        let root_temp = home.root().join(&pending);
        let record_temp = home.root().join("expressions").join(&pending);
        fs::write(&root_temp, b"2").unwrap();
        fs::write(&record_temp, b"interrupted unacknowledged bytes").unwrap();
        assert_eq!(
            home.store()
                .apply(read(Scope::Expressions, Kind::Draft, "retained"))
                .unwrap()["record"],
            written["record"]
        );
        assert!(!root_temp.exists());
        assert!(!record_temp.exists());
    }

    #[test]
    fn aggregate_byte_capacity_refuses_without_eviction() {
        let home = Home::new();
        // Eight individually admitted bodies fit just below64MiB; the next
        // body crosses aggregate capacity while remaining below8MiB itself.
        for n in 0..8 {
            let id = format!("large-{n}");
            let mut value = draft(&id);
            value["retained"] = json!("x".repeat(MAX_RECORD_BYTES - 4096));
            home.store()
                .apply(write(Scope::Expressions, Kind::Draft, &id, None, value))
                .unwrap();
        }
        let mut next = draft("extra");
        next["retained"] = json!("x".repeat(64 * 1024));
        assert!(home
            .store()
            .apply(write(Scope::Expressions, Kind::Draft, "extra", None, next))
            .unwrap_err()
            .contains("64 MiB"));
        assert!(home
            .store()
            .apply(read(Scope::Expressions, Kind::Draft, "large-0"))
            .unwrap()["record"]
            .is_object());
        assert!(!home.path(Scope::Expressions, Kind::Draft, "extra").exists());
    }
    /// Real serde writer qualification, not a native request/installed fixture.
    #[test]
    fn refusal_diagnostic_hashes_only_complete_bounded_serialization() {
        let value = json!({"text":"a\\\"b"});
        let encoded = serde_json::to_vec(&value).unwrap();
        let complete = measure_serialized(&value, encoded.len());
        assert_eq!(complete.status, "complete");
        assert_eq!(complete.serialized_utf8_bytes, Some(encoded.len()));
        assert_eq!(
            complete.sha256,
            Some(format!("{:x}", Sha256::digest(&encoded)))
        );
        let stopped = measure_serialized(&value, encoded.len() - 1);
        assert_eq!(stopped.status, "over_bound_partial_not_fully_measured");
        assert_eq!(stopped.serialized_utf8_bytes, None);
        assert_eq!(stopped.serialized_utf8_bytes_at_least, Some(encoded.len()));
        assert_eq!(stopped.sha256, None);
        let known = measured_bytes(&encoded, encoded.len() - 1);
        assert_eq!(known.status, "exact_size_over_bound_hash_not_measured");
        assert_eq!(known.serialized_utf8_bytes, Some(encoded.len()));
        assert_eq!(known.sha256, None);
    }
    fn refusal_metadata(error: &str, message: &str) -> Value {
        let (first, body) = error.split_once(SIZE_DIAGNOSTIC_MARKER).unwrap();
        assert_eq!(first, message);
        assert!(body.len() <= MAX_SIZE_DIAGNOSTIC_BYTES);
        let data: Value = serde_json::from_str(body).unwrap();
        assert_eq!(data["schema"], SIZE_DIAGNOSTIC_SCHEMA);
        assert_eq!(data["private_values_disclosed"], false);
        assert_eq!(data["stored_candidate_admitted_current_operation"], false);
        data
    }
    /// Genuine ordinary owner-created Document plus two explicitly controlled
    /// local Journey snapshots. This is a budget boundary test, not the absent
    /// installed533 refusal payload or a source/identity/whole-world fixture.
    fn two_basis_checkpoint(id: &str, bytes_per_text: usize, repeated_png: bool) -> Value {
        let mut value = native_checkpoint(id);
        value["view"]["journey"]["retained_text"] = json!("x".repeat(bytes_per_text));
        let mut submitted = draft(id);
        submitted["retained_text"] = json!("y".repeat(bytes_per_text));
        if repeated_png {
            value["view"]["journey"]["retained_image"] =
                json!({"dataUrl":"data:image/png;base64,AAAA"});
            submitted["retained_image"] = json!({"dataUrl":"data:image/png;base64,AAAA"});
        }
        let document = &value["view"]["document"];
        let pending = json!({"kind":"edit","request":{"operation":"edit","expression_ref":document["expression_ref"],"expected_revision":document["revision"],"actor":"test:recovery","changes":[{"change":"focus","scene_ref":document["scenes"][0]["scene_ref"],"entity_ref":null}]},"submitted":{"journey":submitted}});
        value["pending"] = pending;
        value
    }
    #[test]
    fn real_inbound_component_diagnostic_refusal_preserves_last_good_and_unreached_cas() {
        let home = Home::new();
        let id = "diagnostic-inbound";
        let accepted = home
            .store()
            .apply(write(
                Scope::Expressions,
                Kind::Checkpoint,
                id,
                None,
                native_checkpoint(id),
            ))
            .unwrap();
        let old_revision = revision(&accepted);
        let path = home.path(Scope::Expressions, Kind::Checkpoint, id);
        let old_bytes = fs::read(&path).unwrap();
        let old_sequence = fs::read(home.root().join(".sequence")).unwrap();
        let mut incoming = native_checkpoint(id);
        incoming["view"]["journey"]["retained_text"] = json!("x".repeat(MAX_RECORD_BYTES + 1));
        let refusal = home
            .store()
            .apply(write(
                Scope::Expressions,
                Kind::Checkpoint,
                id,
                Some(old_revision),
                incoming,
            ))
            .unwrap_err();
        let data = refusal_metadata(&refusal, COMPONENT_SIZE_MESSAGE);
        assert_eq!(data["failure_branch"], "inbound_component_preflight");
        assert_eq!(data["record_revision"], Value::Null);
        assert_eq!(data["record_revision_role"], "unallocated_inbound");
        assert_eq!(data["cas_guard"], "not_reached_inbound_validation_refused");
        assert_eq!(data["operation_context"]["operation"], "write");
        assert_eq!(data["operation_context"]["expected_revision"], old_revision);
        assert_eq!(
            data["components"][1]["measurement"]["status"],
            "over_bound_partial_not_fully_measured"
        );
        assert_eq!(data["components"][1]["measurement"]["sha256"], Value::Null);
        assert!(!refusal.contains(id));
        assert!(!refusal.contains(&"x".repeat(256)));
        assert_eq!(fs::read(&path).unwrap(), old_bytes);
        assert_eq!(
            fs::read(home.root().join(".sequence")).unwrap(),
            old_sequence
        );
        assert_eq!(
            home.store()
                .apply(read(Scope::Expressions, Kind::Checkpoint, id))
                .unwrap()["record"],
            accepted["record"]
        );
        let stale = home
            .store()
            .apply(write(
                Scope::Expressions,
                Kind::Checkpoint,
                id,
                None,
                native_checkpoint(id),
            ))
            .unwrap();
        assert_eq!(stale["state"], "revision_conflict");
        assert_eq!(fs::read(&path).unwrap(), old_bytes);
        let next = home
            .store()
            .apply(write(
                Scope::Expressions,
                Kind::Checkpoint,
                id,
                Some(old_revision),
                native_checkpoint(id),
            ))
            .unwrap();
        assert_eq!(revision(&next), old_revision + 1);
    }
    #[test]
    fn real_public_and_dictionary_storage_refusals_retain_last_good_bytes_and_cas() {
        for repeated_png in [false, true] {
            let home = Home::new();
            let id = "diagnostic-storage";
            let accepted = home
                .store()
                .apply(write(
                    Scope::Expressions,
                    Kind::Checkpoint,
                    id,
                    None,
                    native_checkpoint(id),
                ))
                .unwrap();
            let path = home.path(Scope::Expressions, Kind::Checkpoint, id);
            let old_bytes = fs::read(&path).unwrap();
            let old_sequence = fs::read(home.root().join(".sequence")).unwrap();
            let incoming = two_basis_checkpoint(id, MAX_RECORD_BYTES / 2 + 4096, repeated_png);
            validate(Kind::Checkpoint, id, &incoming).unwrap();
            let public_bytes = serde_json::to_vec(&incoming).unwrap();
            assert!(public_bytes.len() > MAX_RECORD_BYTES + 2048);
            let refusal = home
                .store()
                .apply(write(
                    Scope::Expressions,
                    Kind::Checkpoint,
                    id,
                    Some(revision(&accepted)),
                    incoming,
                ))
                .unwrap_err();
            let data = refusal_metadata(&refusal, "Recovery record exceeds 8 MiB");
            assert_eq!(
                data["failure_branch"],
                if repeated_png {
                    "write_image_dictionary_storage"
                } else {
                    "write_without_image_dictionary"
                }
            );
            assert_eq!(data["cas_guard"], "passed_before_size_refusal");
            assert_eq!(
                data["public_value"]["serialized_utf8_bytes"],
                public_bytes.len()
            );
            assert_eq!(
                data["public_value"]["sha256"],
                format!("{:x}", Sha256::digest(&public_bytes))
            );
            assert!(
                data["stored_candidate"]["serialized_utf8_bytes"]
                    .as_u64()
                    .unwrap()
                    > (MAX_RECORD_BYTES + 2048) as u64
            );
            assert_eq!(data["stored_candidate"]["sha256"], Value::Null);
            assert_eq!(
                data["images"]["actual_candidate_dictionary_entries"],
                if repeated_png { 1 } else { 0 }
            );
            assert_eq!(fs::read(&path).unwrap(), old_bytes);
            assert_eq!(
                fs::read(home.root().join(".sequence")).unwrap(),
                old_sequence
            );
            assert_eq!(
                home.store()
                    .apply(read(Scope::Expressions, Kind::Checkpoint, id))
                    .unwrap()["record"],
                accepted["record"]
            );
        }
    }
    #[test]
    fn real_legacy_decode_size_refusal_reports_existing_basis_before_write_cas() {
        let home = Home::new();
        let id = "diagnostic-legacy";
        let accepted = home
            .store()
            .apply(write(Scope::Expressions, Kind::Draft, id, None, draft(id)))
            .unwrap();
        let mut existing = draft(id);
        existing["retained_text"] = json!("x".repeat(MAX_RECORD_BYTES));
        let bytes = serde_json::to_vec(&Record {
            schema: SCHEMA.into(),
            scope: Scope::Expressions,
            kind: Kind::Draft,
            id: id.into(),
            revision: revision(&accepted),
            value: existing,
        })
        .unwrap();
        assert!(bytes.len() <= MAX_RECORD_BYTES + 2048);
        let path = home.path(Scope::Expressions, Kind::Draft, id);
        fs::write(&path, &bytes).unwrap();
        let sequence = fs::read(home.root().join(".sequence")).unwrap();
        for request in [
            read(Scope::Expressions, Kind::Draft, id),
            write(
                Scope::Expressions,
                Kind::Draft,
                id,
                Some(revision(&accepted)),
                draft(id),
            ),
        ] {
            let refusal = home.store().apply(request).unwrap_err();
            let data = refusal_metadata(&refusal, "Recovery record exceeds 8 MiB");
            assert_eq!(data["failure_branch"], "legacy_raw_value_decode");
            assert_eq!(data["record_revision_role"], "stored");
            assert_eq!(data["record_revision"], revision(&accepted));
            assert_eq!(
                data["cas_guard"],
                if data["operation_context"]["operation"] == "write" {
                    "not_reached_existing_record_decode_refused"
                } else {
                    "not_applicable"
                }
            );
            assert_eq!(
                data["images"]["unique_metrics_status"],
                "not_walked_public_measurement_incomplete_or_over_bound"
            );
            assert_eq!(data["public_value"]["sha256"], Value::Null);
            assert_eq!(fs::read(&path).unwrap(), bytes);
            assert_eq!(fs::read(home.root().join(".sequence")).unwrap(), sequence);
        }
    }
}
