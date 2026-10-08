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
// Opt-in hosted-proof timings only. The bridge supplies a diagnostic ID;
// no request field, owner result, admission law or default execution changes.
thread_local! {
    static DIAGNOSTIC_TRACE: std::cell::Cell<Option<u64>> = const { std::cell::Cell::new(None) };
}
pub fn with_diagnostic_trace<T>(id: u64, run: impl FnOnce() -> T) -> T {
    struct Restore(Option<u64>);
    impl Drop for Restore {
        fn drop(&mut self) {
            DIAGNOSTIC_TRACE.with(|trace| trace.set(self.0));
        }
    }
    let _restore = Restore(DIAGNOSTIC_TRACE.with(|trace| trace.replace(Some(id))));
    run()
}

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
    // Qualify the independent acknowledged, authoring and pending components
    // before cloning any material into the native Document/request carriers.
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

fn encode_record(record: &Record) -> Result<Vec<u8>, String> {
    preflight_components(record.kind, &record.value)?;
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
            return Err("Recovery record exceeds 8 MiB".into());
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
        return Err("Recovery record exceeds 8 MiB".into());
    }
    Ok(encoded)
}

fn decode_record(bytes: &[u8], validate_body: bool) -> Result<Record, String> {
    let crate::expression_file::UniqueValue(value) =
        serde_json::from_slice(bytes).map_err(|e| format!("Invalid native recovery entry: {e}"))?;
    if value["schema"] == SCHEMA {
        let record: Record = serde_json::from_value(value).map_err(|e| e.to_string())?;
        if serde_json::to_vec(&record.value)
            .map_err(|e| e.to_string())?
            .len()
            > MAX_RECORD_BYTES
        {
            return Err("Recovery record exceeds 8 MiB".into());
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
        #[cfg(unix)]
        {
            self.apply_unix(request)
        }
        #[cfg(not(unix))]
        {
            let _ = request;
            Err("Native recovery is unavailable on this platform".into())
        }
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
            .or_else(|| std::env::var_os("OI_EXPRESSION_HOME").filter(|v| !v.is_empty()).map(PathBuf::from))
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
                let name = filename(kind, &id);
                let bytes = snapshot_record(&dir, &name)?;
                // Capture coherent durable bytes while writers are excluded;
                // expensive decoding and qualification do not hold their lock.
                drop(lock);
                let record = bytes
                    .as_deref()
                    .map(|bytes| qualify_snapshot(scope, &name, sequence, bytes, true))
                    .transpose()?;
                Ok(ready(record.as_ref()))
            }
            Request::List { kind, .. } => {
                let snapshots = snapshot_records(&dir)?;
                drop(lock);
                let records = qualify_snapshots(scope, sequence, &snapshots, false)?;
                Ok(
                    json!({"schema":SCHEMA,"state":"listed","records":records.iter().filter(|r|r.kind==kind).map(Record::metadata).collect::<Vec<_>>()}),
                )
            }
            Request::FindCheckpoint { expression_ref, .. } => {
                reference(&expression_ref)?;
                // Address one checkpoint from the same coherent snapshot,
                // without expanding unrelated retained bodies or holding a
                // writer's lock during image/digest qualification.
                let snapshots = snapshot_records(&dir)?;
                drop(lock);
                let records = qualify_snapshots(scope, sequence, &snapshots, false)?;
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
                        let name = filename(record.kind, &record.id);
                        let bytes = &snapshots
                            .iter()
                            .find(|(key, _)| key == &name)
                            .ok_or("Checkpoint is absent from its captured recovery snapshot")?
                            .1;
                        qualify_snapshot(scope, &name, sequence, bytes, true)
                    })
                    .transpose()?;
                Ok(ready(record.as_ref()))
            }
            Request::Write {
                kind,
                id,
                expected_revision,
                value,
                ..
            } => {
                validate(kind, &id, &value)?;
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
    snapshot_record(dir, name)?
        .as_deref()
        .map(|bytes| qualify_snapshot(scope, name, sequence, bytes, validate_body))
        .transpose()
}
#[cfg(unix)]
fn snapshot_record(dir: &unix::Directory, name: &str) -> Result<Option<Vec<u8>>, String> {
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
    Ok(Some(bytes))
}
#[cfg(unix)]
fn qualify_snapshot(
    scope: Scope,
    name: &str,
    sequence: u64,
    bytes: &[u8],
    validate_body: bool,
) -> Result<Record, String> {
    let record = decode_record(bytes, validate_body)?;
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
    Ok(record)
}
#[cfg(unix)]
fn snapshot_records(dir: &unix::Directory) -> Result<Vec<(String, Vec<u8>)>, String> {
    inventory(dir)?
        .into_iter()
        .map(|(name, _)| {
            let bytes = snapshot_record(dir, &name)?
                .ok_or("Native recovery entry disappeared under its lock")?;
            Ok((name, bytes))
        })
        .collect()
}
#[cfg(unix)]
fn qualify_snapshots(
    scope: Scope,
    sequence: u64,
    snapshots: &[(String, Vec<u8>)],
    validate_body: bool,
) -> Result<Vec<Record>, String> {
    let mut records = Vec::new();
    for (name, bytes) in snapshots {
        records.push(qualify_snapshot(
            scope,
            name,
            sequence,
            bytes,
            validate_body,
        )?);
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

    /// Read the owner's retained ordinary checkpoint and lossless draft in
    /// place. Only the isolated test Home receives writes or corruptions.
    /// The caller supplies their source hashes so this proof names real work,
    /// while the repository keeps no personal document or image fixture.
    #[test]
    #[ignore = "supply OI_RECOVERY_REAL_{CHECKPOINT,DRAFT} and their _SHA256 source hashes"]
    fn actual_retained_work_reopens_losslessly_with_owner_and_revision_evidence() {
        let actual = |name: &str| {
            let path = PathBuf::from(std::env::var(name).unwrap());
            let bytes = fs::read(&path).unwrap();
            assert_eq!(
                format!("{:x}", Sha256::digest(&bytes)),
                std::env::var(format!("{name}_SHA256")).unwrap(),
                "The retained source revision must be the one supplied for this proof"
            );
            (path, bytes)
        };
        let (checkpoint_path, checkpoint_bytes) = actual("OI_RECOVERY_REAL_CHECKPOINT");
        let (draft_path, draft_bytes) = actual("OI_RECOVERY_REAL_DRAFT");
        let checkpoint = decode_record(&checkpoint_bytes, true).unwrap();
        validate(checkpoint.kind, &checkpoint.id, &checkpoint.value).unwrap();
        assert_eq!(checkpoint.kind, Kind::Checkpoint);
        let document: crate::expression::Document =
            serde_json::from_value(checkpoint.value["view"]["document"].clone()).unwrap();
        document.validate().unwrap();
        let document_value = serde_json::to_value(&document).unwrap();

        // The native Expression owner validates and acknowledges the exact
        // retained Document. The event keeps its reference and revision.
        let mut owner = crate::expression::Application::default();
        let client = crate::flow::CentralClient::discover();
        let (opened, event) = owner
            .apply(
                &client,
                crate::expression::Request::Open {
                    document: Box::new(document.clone()),
                    actor: "test:retained-recovery".into(),
                },
            )
            .unwrap();
        assert_eq!(opened["state"], "ready");
        assert!(
            opened["document"] == document_value,
            "The owner must open the complete retained Document"
        );
        let event = event.expect("The native opening must acknowledge the retained basis");
        assert_eq!(event.expression_ref, document.expression_ref);
        assert_eq!(event.revision, document.revision);
        let (continued, event) = owner
            .apply(
                &client,
                crate::expression::Request::Open {
                    document: Box::new(document.clone()),
                    actor: "test:retained-recovery".into(),
                },
            )
            .unwrap();
        assert!(
            continued["document"] == document_value,
            "Continuation must retain the complete Document"
        );
        assert!(
            event.is_none(),
            "Continuing an identical open document is idempotent"
        );

        let home = Home::new();
        let written = home
            .store()
            .apply(write(
                checkpoint.scope,
                checkpoint.kind,
                &checkpoint.id,
                None,
                checkpoint.value.clone(),
            ))
            .unwrap();
        assert_eq!(written["state"], "written");
        assert!(
            written["record"]["value"] == checkpoint.value,
            "The native write must acknowledge every retained field"
        );
        let persisted_path = home.path(checkpoint.scope, checkpoint.kind, &checkpoint.id);
        let persisted_bytes = fs::read(&persisted_path).unwrap();
        assert!(
            home.store()
                .apply(read(checkpoint.scope, checkpoint.kind, &checkpoint.id))
                .unwrap()["record"]
                == written["record"],
            "A fresh recovery owner must read exactly the acknowledged native write"
        );
        assert!(
            home.store()
                .apply(Request::FindCheckpoint {
                    scope: checkpoint.scope,
                    expression_ref: document.expression_ref.clone(),
                })
                .unwrap()["record"]
                == written["record"],
            "Addressed checkpoint lookup must preserve the exact acknowledged value"
        );
        let refused = home
            .store()
            .apply(write(
                checkpoint.scope,
                checkpoint.kind,
                &checkpoint.id,
                Some(revision(&written) + 1),
                checkpoint.value.clone(),
            ))
            .unwrap();
        assert_eq!(refused["state"], "revision_conflict");
        assert!(
            fs::read(&persisted_path).unwrap() == persisted_bytes,
            "A stale writer must preserve the acknowledged bytes"
        );

        let draft = decode_record(&draft_bytes, true).unwrap();
        validate(draft.kind, &draft.id, &draft.value).unwrap();
        assert_eq!(draft.kind, Kind::Draft);
        let stored: Value = serde_json::from_slice(&draft_bytes).unwrap();
        assert_eq!(stored["schema"], STORAGE_SCHEMA);
        assert!(!stored["images"].as_array().unwrap().is_empty());
        let encoded = encode_record(&draft).unwrap();
        assert!(
            decode_record(&encoded, true).unwrap().value == draft.value,
            "Lossless storage must preserve every draft field"
        );
        // Capture the actual retained bodies at one durable sequence, then
        // let an ordinary guarded owner write finish while those bytes remain
        // undecoded. Qualification afterward must retain the older coherent
        // source basis, rather than rereading a mixture of storage revisions.
        let retained_draft = home
            .store()
            .apply(write(
                draft.scope,
                draft.kind,
                &draft.id,
                None,
                draft.value.clone(),
            ))
            .unwrap();
        let root = unix::Directory::open(&home.root()).unwrap();
        let scope_dir = root.child(checkpoint.scope.name()).unwrap();
        let lock = root.file(".lock", false, false).unwrap().unwrap();
        lock.try_lock().unwrap();
        let snapshots = snapshot_records(&scope_dir).unwrap();
        let captured_sequence = revision(&retained_draft);
        drop(lock);
        let concurrent_store = home.store();
        let concurrent_request = write(
            checkpoint.scope,
            checkpoint.kind,
            &checkpoint.id,
            Some(revision(&written)),
            checkpoint.value.clone(),
        );
        let advanced = std::thread::spawn(move || concurrent_store.apply(concurrent_request))
            .join()
            .unwrap()
            .unwrap();
        assert_eq!(advanced["state"], "written");
        assert!(revision(&advanced) > captured_sequence);
        let captured =
            qualify_snapshots(checkpoint.scope, captured_sequence, &snapshots, true).unwrap();
        let old_checkpoint = captured
            .iter()
            .find(|record| record.id == checkpoint.id)
            .unwrap();
        assert_eq!(old_checkpoint.revision, revision(&written));
        assert!(old_checkpoint.value == checkpoint.value);
        let old_draft = captured
            .iter()
            .find(|record| record.id == draft.id)
            .unwrap();
        assert_eq!(old_draft.revision, revision(&retained_draft));
        assert!(old_draft.value == draft.value);
        let latest = home
            .store()
            .apply(read(checkpoint.scope, checkpoint.kind, &checkpoint.id))
            .unwrap();
        assert_eq!(latest["record"]["revision"], advanced["record"]["revision"]);
        let mut corrupt = stored.clone();
        corrupt["expanded_value_sha256"] = json!(format!("sha256:{}", "0".repeat(64)));
        assert!(decode_record(&serde_json::to_vec(&corrupt).unwrap(), true)
            .unwrap_err()
            .contains("Expanded recovery value digest differs"));
        let mut missing = stored.clone();
        missing["images"].as_array_mut().unwrap().pop();
        assert!(decode_record(&serde_json::to_vec(&missing).unwrap(), true)
            .unwrap_err()
            .contains("Missing embedded image reference"));
        let duplicate_schema = format!(
            "{{\"schema\":\"{}\",{}",
            STORAGE_SCHEMA,
            std::str::from_utf8(&draft_bytes)
                .unwrap()
                .strip_prefix('{')
                .unwrap()
        );
        assert!(decode_record(duplicate_schema.as_bytes(), true)
            .unwrap_err()
            .contains("Duplicate"));
        assert!(
            fs::read(checkpoint_path).unwrap() == checkpoint_bytes,
            "The actual personal checkpoint must remain untouched"
        );
        assert!(
            fs::read(draft_path).unwrap() == draft_bytes,
            "The actual personal draft must remain untouched"
        );
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
}
