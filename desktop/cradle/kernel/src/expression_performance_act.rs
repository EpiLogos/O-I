//! Versioned long-performance extension of the existing native Act owner.
//! Passages retain exact edition handles; immutable parts stay inside this Act
//! record. Selection resolves one Document through the ordinary restore/CAS.
//! Legacy inline editions retain their old bytes and original storage rules.
use crate::expression::{Document, DOCUMENT_BYTES};
use crate::expression_act_storage;
use crate::expression_file::{digest, digest_ref, UniqueValue};
use crate::expression_performance_storage::ActPerformanceCustody;
use crate::expression_world::{Act, ActPhase, Passage, PassageKind};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::borrow::Cow;
use std::collections::BTreeSet;

pub const STORAGE_SCHEMA: &str = "oi.expression-act-storage/v2";
pub const SOURCE_STORAGE_SCHEMA: &str = "oi.expression-act-storage/v3";
pub const RECORDING_STORAGE_SCHEMA: &str = "oi.expression-act-storage/v4";
pub fn supports_storage(schema: &Value) -> bool {
    schema == STORAGE_SCHEMA
        || schema == SOURCE_STORAGE_SCHEMA
        || schema == RECORDING_STORAGE_SCHEMA
}
fn storage_schema(act: &Act) -> &'static str {
    if act
        .performance_custody
        .as_ref()
        .is_some_and(ActPerformanceCustody::has_native_recordings)
    {
        RECORDING_STORAGE_SCHEMA
    } else if act
        .performance_custody
        .as_ref()
        .is_some_and(ActPerformanceCustody::has_native_sources)
    {
        SOURCE_STORAGE_SCHEMA
    } else {
        STORAGE_SCHEMA
    }
}
pub const MATERIAL_SCHEMA: &str = "oi.expression-act-material/v2";
pub const EDITION_SCHEMA: &str = "oi.expression-act-performance-edition/v1";

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PerformanceEdition {
    pub schema: String,
    pub index: u32,
    pub expression_ref: String,
    pub revision: u64,
    pub expanded_document_sha256: String,
    pub expanded_bytes: u32,
}

/// Prospective-only operation until the native Act CAS commits. All prior
/// immutable pages remain owned by this same Act, including undo/redo pages.
pub fn retain_edition(
    act: &mut Act,
    passage: &mut Passage,
    document: Document,
) -> Result<(), String> {
    document.validate()?;
    if act.material_contract.as_deref() != Some(MATERIAL_SCHEMA) {
        return Err(
            "indexed Editions require explicit retained-performance material-v2 opt-in".into(),
        );
    }
    let empty = ActPerformanceCustody::default();
    let prior = act.performance_custody.as_ref().unwrap_or(&empty);
    let index = prior.editions().len();
    let candidate = prior.appended(&document)?;
    let (reference, revision, hash, expanded_bytes) = candidate.document_identity(index)?;
    let handle = PerformanceEdition {
        schema: EDITION_SCHEMA.into(),
        index: u32::try_from(index).map_err(|_| "native edition index overflow")?,
        expression_ref: reference.into(),
        revision,
        expanded_document_sha256: hash.into(),
        expanded_bytes,
    };
    if passage.kind != PassageKind::Edition
        || passage.target_ref.as_deref() != Some(reference)
        || passage.revision.as_deref() != Some(revision.to_string().as_str())
    {
        return Err("native performance edition target/revision differs".into());
    }
    // Commit these two related fields only after the whole candidate validates.
    act.performance_custody = Some(candidate);
    passage.performance_edition = Some(handle);
    passage.edition = None;
    Ok(())
}

pub fn validate_edition(act: &Act, passage: &Passage) -> Result<(), String> {
    match (&passage.edition, &passage.performance_edition) {
        (Some(document), None) => {
            if passage.target_ref.as_deref() != Some(document.expression_ref.as_str())
                || passage.revision.as_deref() != Some(document.revision.to_string().as_str())
            {
                return Err("retained edition target or revision mismatch".into());
            }
            document.validate()
        }
        (None, Some(handle)) => {
            let custody = act
                .performance_custody
                .as_ref()
                .ok_or("native performance custody absent")?;
            let (reference, revision, hash, bytes) =
                custody.document_identity(handle.index as usize)?;
            if handle.schema != EDITION_SCHEMA
                || !digest_ref(&handle.expanded_document_sha256)
                || handle.expanded_bytes as usize > DOCUMENT_BYTES
                || handle.expression_ref != reference
                || handle.revision != revision
                || handle.expanded_document_sha256 != hash
                || handle.expanded_bytes != bytes
                || passage.target_ref.as_deref() != Some(reference)
                || passage.revision.as_deref() != Some(revision.to_string().as_str())
            {
                return Err(
                    "retained performance edition handle differs from exact native document".into(),
                );
            }
            Ok(())
        }
        _ => Err("edition must retain exactly one inline document or performance handle".into()),
    }
}

/// Borrow an old edition; expand only one selected indexed edition. The caller
/// still performs the existing native Document restore with its real revision.
pub fn edition<'a>(act: &'a Act, passage: &'a Passage) -> Result<Cow<'a, Document>, String> {
    validate_edition(act, passage)?;
    if let Some(document) = &passage.edition {
        return Ok(Cow::Borrowed(document.as_ref()));
    }
    let index = passage
        .performance_edition
        .as_ref()
        .ok_or("native edition absent")?
        .index;
    Ok(Cow::Owned(
        act.performance_custody
            .as_ref()
            .ok_or("native custody absent")?
            .restore(index as usize)?,
    ))
}

/// Version2 accounts for unique retained parts plus bounded metadata. Every
/// selected Document remains at most8MiB; no cumulative full-history expansion
/// occurs. The same live owner continues to admit at most64MiB across its Acts.
pub fn retained_bytes(act: &Act) -> Result<usize, String> {
    expression_act_storage::measure(act, expression_act_storage::LIVE_BYTES)
}
pub fn validate(act: &Act) -> Result<(), String> {
    if act.material_contract.as_deref() != Some(MATERIAL_SCHEMA) {
        return Err("retained Act material contract must be explicit v2".into());
    }
    let custody = act
        .performance_custody
        .as_ref()
        .ok_or("indexed native Act custody absent")?;
    custody.validate()?;
    if act.revision == 0
        || act.sequence.len() > 513
        || act.position.is_some_and(|p| p >= act.sequence.len())
        || (act.archived && !matches!(act.phase, ActPhase::Completed | ActPhase::Cancelled))
    {
        return Err("invalid indexed native Act revision/position/phase/budget".into());
    }
    let mut used = BTreeSet::new();
    for (index, passage) in act.sequence.iter().enumerate() {
        if passage.index != index {
            return Err("native passage index differs".into());
        }
        if passage.kind == PassageKind::Edition {
            if passage.edition.is_some() {
                return Err("material-v2 Edition must be an exact native handle".into());
            }
            validate_edition(act, passage)?;
            if let Some(handle) = &passage.performance_edition {
                if !used.insert(handle.index) {
                    return Err("duplicate retained native edition handle".into());
                }
            }
        } else if passage.edition.is_some() || passage.performance_edition.is_some() {
            return Err("retained native document outside edition passage".into());
        }
    }
    if used.len() != custody.editions().len() {
        return Err("native performance custody has an unused or missing edition".into());
    }
    retained_bytes(act)?;
    Ok(())
}

#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Record<T> {
    schema: String,
    act: T,
    retained_act_sha256: String,
}
pub fn encode(act: &Act) -> Result<Vec<u8>, String> {
    validate(act)?;
    let bytes = serde_json::to_vec(act).map_err(|e| e.to_string())?;
    let record = serde_json::to_vec(&Record {
        schema: storage_schema(act).into(),
        act,
        retained_act_sha256: digest(&bytes),
    })
    .map_err(|e| e.to_string())?;
    if record.len() as u64 > crate::expression_act_store::MAX_RECORD_BYTES {
        return Err("complete indexed native Act record exceeds4MiB".into());
    }
    Ok(record)
}
pub fn decode(value: Value, available: usize) -> Result<Act, String> {
    if expression_act_storage::measure(
        &value,
        crate::expression_act_store::MAX_RECORD_BYTES as usize,
    )? > crate::expression_act_store::MAX_RECORD_BYTES as usize
    {
        return Err("indexed native Act record exceeds4MiB".into());
    }
    let stored = Record::<Act>::deserialize(&value).map_err(|e| e.to_string())?;
    if serde_json::to_value(&stored).map_err(|e| e.to_string())? != value {
        return Err("retained Act omitted canonical native defaults".into());
    }
    if stored.schema != storage_schema(&stored.act)
        || !digest_ref(&stored.retained_act_sha256)
        || digest(&serde_json::to_vec(&stored.act).map_err(|e| e.to_string())?)
            != stored.retained_act_sha256
    {
        return Err("indexed native Act storage schema/digest differs".into());
    }
    if retained_bytes(&stored.act)? > available.min(expression_act_storage::LIVE_BYTES) {
        return Err("indexed native Act exceeds current live custody budget".into());
    }
    validate(&stored.act)?;
    Ok(stored.act)
}

/// Independent source-ready file admission helper for owner integration tests.
/// Production ActStore calls its existing UniqueValue/safe pass then decode.
pub fn decode_bytes(bytes: &[u8], available: usize) -> Result<Act, String> {
    if bytes.len() as u64 > crate::expression_act_store::MAX_RECORD_BYTES {
        return Err("indexed native Act record exceeds4MiB".into());
    }
    let UniqueValue(value) = serde_json::from_slice(bytes).map_err(|e| e.to_string())?;
    expression_act_storage::safe(&value, 0)?;
    decode(value, available)
}

/// A borrowed native passage projection. Exhaustive destructuring keeps the
/// versioned index response in parity with future Passage fields. Complete
/// inline Editions are never cloned during admission or migration.
struct RetainedPassage<'a> {
    passage: &'a Passage,
    handle: Option<&'a PerformanceEdition>,
}
impl Serialize for RetainedPassage<'_> {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        use serde::ser::SerializeMap;
        let Passage {
            index,
            kind,
            edition,
            performance_edition,
            file_ref,
            expression_ref,
            revision,
            scene_ref,
            target_ref,
            target_scene_ref,
            state,
            role,
            gesture,
            bindings,
            captions,
            transition,
            event_basis,
            operation,
            native_ref,
            text,
            value,
            field,
            summary,
            mode,
            at_unix_ms,
            coalesced,
        } = self.passage;
        let mut m = s.serialize_map(None)?;
        macro_rules! field {
            ($k:literal,$v:expr) => {
                m.serialize_entry($k, &$v)?;
            };
        }
        macro_rules! optional {
            ($k:literal,$v:expr) => {
                if let Some(v) = $v {
                    m.serialize_entry($k, &v)?;
                }
            };
        }
        field!("index", index);
        field!("kind", kind);
        if let Some(handle) = self.handle {
            field!("performance_edition", handle);
        } else {
            optional!("edition", edition);
            optional!("performance_edition", performance_edition);
        }
        optional!("file_ref", file_ref);
        optional!("expression_ref", expression_ref);
        optional!("revision", revision);
        optional!("scene_ref", scene_ref);
        optional!("target_ref", target_ref);
        optional!("target_scene_ref", target_scene_ref);
        optional!("state", state);
        optional!("role", role);
        optional!("gesture", gesture);
        if !bindings.is_empty() {
            field!("bindings", bindings);
        }
        if !captions.is_empty() {
            field!("captions", captions);
        }
        optional!("transition", transition);
        optional!("event_basis", event_basis);
        optional!("operation", operation);
        optional!("native_ref", native_ref);
        optional!("text", text);
        optional!("value", value);
        optional!("field", field);
        optional!("summary", summary);
        field!("mode", mode);
        field!("at_unix_ms", at_unix_ms);
        if *coalesced != 0 {
            field!("coalesced", coalesced);
        }
        m.end()
    }
}
struct RetainedSequence<'a> {
    sequence: &'a [Passage],
    append: Option<&'a Passage>,
    handles: &'a std::collections::BTreeMap<usize, PerformanceEdition>,
}
impl Serialize for RetainedSequence<'_> {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        use serde::ser::SerializeSeq;
        let mut seq = s.serialize_seq(Some(
            self.sequence.len() + usize::from(self.append.is_some()),
        ))?;
        for p in self.sequence.iter().chain(self.append) {
            seq.serialize_element(&RetainedPassage {
                passage: p,
                handle: self.handles.get(&p.index),
            })?;
        }
        seq.end()
    }
}
struct RetainedAct<'a> {
    act: &'a Act,
    custody: &'a ActPerformanceCustody,
    handles: &'a std::collections::BTreeMap<usize, PerformanceEdition>,
    append: Option<&'a Passage>,
    summary: &'a str,
    actor: &'a str,
    activity: Option<&'a str>,
    basis: u64,
    revision: u64,
    updated: u64,
}
impl Serialize for RetainedAct<'_> {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        use serde::ser::SerializeMap;
        let Act {
            act_ref,
            expression_ref,
            summary: _,
            actor: _,
            activity_ref,
            phase,
            basis_revision: _,
            revision: _,
            mode,
            cast,
            subject_ref,
            instrument_ref,
            material,
            bindings,
            selection,
            position,
            sequence,
            material_contract: _,
            performance_custody: _,
            continuations,
            return_ref,
            result,
            role_entities,
            updated_at_unix_ms: _,
            archived,
        } = self.act;
        let mut m = s.serialize_map(None)?;
        macro_rules! field {
            ($k:literal,$v:expr) => {
                m.serialize_entry($k, &$v)?;
            };
        }
        macro_rules! optional {
            ($k:literal,$v:expr) => {
                if let Some(v) = $v {
                    m.serialize_entry($k, &v)?;
                }
            };
        }
        field!("act_ref", act_ref);
        field!("expression_ref", expression_ref);
        field!("summary", self.summary);
        field!("actor", self.actor);
        optional!("activity_ref", self.activity.or(activity_ref.as_deref()));
        field!(
            "phase",
            if self.append.is_some() {
                ActPhase::Running
            } else {
                *phase
            }
        );
        field!("basis_revision", self.basis);
        field!("revision", self.revision);
        field!("mode", mode);
        field!("cast", cast);
        optional!("subject_ref", subject_ref);
        optional!("instrument_ref", instrument_ref);
        optional!("material", material);
        field!("bindings", bindings);
        optional!("selection", selection);
        optional!("position", self.append.map(|p| p.index).or(*position));
        field!(
            "sequence",
            RetainedSequence {
                sequence,
                append: self.append,
                handles: self.handles
            }
        );
        field!("material_contract", MATERIAL_SCHEMA);
        field!("performance_custody", self.custody);
        field!("continuations", continuations);
        optional!("return_ref", return_ref);
        optional!("result", result);
        field!("role_entities", role_entities);
        field!("updated_at_unix_ms", self.updated);
        if *archived {
            field!("archived", true);
        }
        m.end()
    }
}
fn handle(custody: &ActPerformanceCustody, index: usize) -> Result<PerformanceEdition, String> {
    let (expression_ref, revision, hash, expanded_bytes) = custody.document_identity(index)?;
    Ok(PerformanceEdition {
        schema: EDITION_SCHEMA.into(),
        index: u32::try_from(index).map_err(|_| "edition index overflow")?,
        expression_ref: expression_ref.into(),
        revision,
        expanded_document_sha256: hash.into(),
        expanded_bytes,
    })
}
fn materialize(mut view: RetainedAct<'_>, available: usize) -> Result<Act, String> {
    // Measure the same record before allocating JSON or any prior history.
    // The timestamp is conservative; the actual owner chooses its commit time.
    let updated = view.updated;
    view.updated = u64::MAX;
    let resident = expression_act_storage::measure(&view, expression_act_storage::LIVE_BYTES)?;
    if resident > available.min(expression_act_storage::LIVE_BYTES) {
        return Err(
            "retained Act exceeds available unique-material live custody before allocation".into(),
        );
    }
    let conservative = Record {
        schema: if view.custody.has_native_recordings() {
            RECORDING_STORAGE_SCHEMA
        } else if view.custody.has_native_sources() {
            SOURCE_STORAGE_SCHEMA
        } else {
            STORAGE_SCHEMA
        }
        .to_owned(),
        act: &view,
        retained_act_sha256: format!("sha256:{}", "0".repeat(64)),
    };
    expression_act_storage::measure(
        &conservative,
        crate::expression_act_store::MAX_RECORD_BYTES as usize,
    )?;
    view.updated = updated;
    // This view contains already-native, privately qualified immutable custody.
    // Materialize only passage metadata; serializing/reimporting the entire
    // custody would discard its private page qualification and re-run every
    // historical page's canonical codec. External decode remains independent.
    let sequence = view
        .act
        .sequence
        .iter()
        .chain(view.append)
        .map(|passage| {
            let value = serde_json::to_value(RetainedPassage {
                passage,
                handle: view.handles.get(&passage.index),
            })
            .map_err(|e| e.to_string())?;
            serde_json::from_value(value).map_err(|e| e.to_string())
        })
        .collect::<Result<Vec<Passage>, String>>()?;
    // Exhaustive ownership keeps the public Act fields in parity with the
    // same borrowed serializer that supplied both pre-allocation budgets.
    let Act {
        act_ref,
        expression_ref,
        summary: _,
        actor: _,
        activity_ref,
        phase,
        basis_revision: _,
        revision: _,
        mode,
        cast,
        subject_ref,
        instrument_ref,
        material,
        bindings,
        selection,
        position,
        sequence: _,
        material_contract: _,
        performance_custody: _,
        continuations,
        return_ref,
        result,
        role_entities,
        updated_at_unix_ms: _,
        archived,
    } = view.act;
    let act = Act {
        act_ref: act_ref.clone(),
        expression_ref: expression_ref.clone(),
        summary: view.summary.to_owned(),
        actor: view.actor.to_owned(),
        activity_ref: view
            .activity
            .map(str::to_owned)
            .or_else(|| activity_ref.clone()),
        phase: if view.append.is_some() {
            ActPhase::Running
        } else {
            *phase
        },
        basis_revision: view.basis,
        revision: view.revision,
        mode: *mode,
        cast: cast.clone(),
        subject_ref: subject_ref.clone(),
        instrument_ref: instrument_ref.clone(),
        material: material.clone(),
        bindings: bindings.clone(),
        selection: selection.clone(),
        position: view.append.map(|p| p.index).or(*position),
        sequence,
        material_contract: Some(MATERIAL_SCHEMA.into()),
        performance_custody: None,
        continuations: continuations.clone(),
        return_ref: return_ref.clone(),
        result: result.clone(),
        role_entities: role_entities.clone(),
        updated_at_unix_ms: updated,
        archived: *archived,
    };
    // Retain the original typed metadata/numeric/default refusal semantics,
    // without treating this native custody as a newly imported wire record.
    let metadata = serde_json::to_vec(&act).map_err(|e| e.to_string())?;
    let mut act: Act = serde_json::from_slice(&metadata).map_err(|e| e.to_string())?;
    act.performance_custody = Some(view.custody.clone());
    validate(&act)?;
    Ok(act)
}
/// Explicit native material-v2 opt-in. Original Edition bytes remain exact in
/// the same Act's content-addressed custody; the migration has one Act CAS and
/// changes no current Expression or source generation.
pub fn migrate(act: &Act, available: usize) -> Result<Act, String> {
    if act.material_contract.is_some() || act.performance_custody.is_some() {
        return Err("Act is already retained or has unqualified custody".into());
    }
    expression_act_storage::validate(act)?;
    let mut custody = ActPerformanceCustody::default();
    let mut handles = std::collections::BTreeMap::new();
    for p in &act.sequence {
        if let Some(document) = &p.edition {
            let index = custody.editions().len();
            custody = custody.appended(document)?;
            handles.insert(p.index, handle(&custody, index)?);
        }
    }
    materialize(
        RetainedAct {
            act,
            custody: &custody,
            handles: &handles,
            append: None,
            summary: &act.summary,
            actor: &act.actor,
            activity: None,
            basis: act.basis_revision,
            revision: act.revision,
            updated: act.updated_at_unix_ms,
        },
        available,
    )
}
/// Pure prospective native Edition. Prior Act/Document bodies stay borrowed
/// through budget admission; immutable page Arcs are shared across editions.
#[allow(clippy::too_many_arguments)]
pub fn prepare_append(
    act: &Act,
    passage: &Passage,
    document: &Document,
    summary: &str,
    actor: &str,
    activity: Option<&str>,
    basis: u64,
    revision: u64,
    available: usize,
) -> Result<Act, String> {
    if act.material_contract.as_deref() != Some(MATERIAL_SCHEMA) {
        return Err("retained performance operation requires explicit material-v2 opt-in".into());
    }
    if passage.kind != PassageKind::Edition
        || passage.index != act.sequence.len()
        || passage.target_ref.as_deref() != Some(document.expression_ref.as_str())
        || passage.revision.as_deref() != Some(document.revision.to_string().as_str())
    {
        return Err("retained prospective Edition identity differs".into());
    }
    let empty = ActPerformanceCustody::default();
    let prior = act.performance_custody.as_ref().unwrap_or(&empty);
    let index = prior.editions().len();
    let custody = prior.appended(document)?;
    let handles = std::collections::BTreeMap::from([(passage.index, handle(&custody, index)?)]);
    materialize(
        RetainedAct {
            act,
            custody: &custody,
            handles: &handles,
            append: Some(passage),
            summary,
            actor,
            activity,
            basis,
            revision,
            updated: 0,
        },
        available,
    )
}
/// Restitution is a complete ordinary native Document, never a handle exposed
/// as a document. The caller retains existing Expression restore/CAS authority.
pub fn selected_document(act: &Act, position: usize) -> Result<Document, String> {
    if act.material_contract.as_deref() != Some(MATERIAL_SCHEMA) {
        return Err("selected retained Edition requires material-v2".into());
    }
    let passage = act
        .sequence
        .get(position)
        .ok_or("retained passage absent")?;
    Ok(edition(act, passage)?.into_owned())
}
