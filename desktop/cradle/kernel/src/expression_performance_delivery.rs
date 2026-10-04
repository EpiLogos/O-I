//! Complete selected native Act material for the score and export consumers.
//! Selection is a read of the existing Act/Edition/Scene owner. This module
//! does not admit imported source, publish a file or advance the native clock.
use crate::expression::{Availability, Document, ReadingRef, Scene, DOCUMENT_BYTES};
use crate::expression_file::digest;
use crate::expression_performance::{ContextBinding, Counter, Identity, Performance};
use crate::expression_performance_act;
use crate::expression_world::Act;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::io::Write;

pub const SCHEMA: &str = "oi.expression-performance-delivery/v1";
pub const PAGE_SCHEMA: &str = "oi.expression-native-page-delivery/v1";
/// A finite read transport bound, not a replacement Document/Act/file budget.
/// Exact canonical byte strings may be JSON escaped beside their decoded view.
pub const MAX_DELIVERY_BYTES: usize = 4 * DOCUMENT_BYTES;

#[derive(Serialize)]
struct TaggedPart<'a, T: Serialize> {
    kind: &'static str,
    value: &'a T,
}
#[derive(Serialize)]
struct PartWitness {
    page_index: usize,
    reading: ReadingRef,
    canonical_part_bytes: String,
    decoded_sha256: String,
    decoded_length: Counter,
}
#[derive(Serialize)]
struct SourceWitness {
    source_index: usize,
    reading: ReadingRef,
    canonical_part_bytes: String,
}
fn part_bytes<T: Serialize>(kind: &'static str, value: &T) -> Result<Vec<u8>, String> {
    serde_json::to_vec(&TaggedPart { kind, value }).map_err(|e| e.to_string())
}
fn utf8(bytes: Vec<u8>) -> Result<String, String> {
    String::from_utf8(bytes).map_err(|e| e.to_string())
}
fn recording_witness(
    index: usize,
    page: &crate::expression_performance_recording::NativeRecordingPage,
) -> Result<PartWitness, String> {
    let decoded = page.canonical_decoded_bytes()?;
    let part = part_bytes("native_recording", page)?;
    Ok(PartWitness {
        page_index: index,
        reading: ReadingRef {
            r#ref: digest(&part),
            revision: crate::expression_performance_recording::NATIVE_PAGE_SCHEMA.into(),
            availability: Availability::Available,
        },
        canonical_part_bytes: utf8(part)?,
        decoded_sha256: digest(&decoded),
        decoded_length: Counter(decoded.len() as u64),
    })
}

/// The existing native Act lookup supplies the Act; every requested identity
/// must still match before expanding the selected full Document.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Selection {
    pub expected_act_revision: u64,
    pub edition_position: usize,
    pub scene_ref: String,
    pub expected_expression_revision: u64,
    pub expected_scene_revision: u64,
    pub performance_digest: String,
}

/// Privately selected complete material. No Deserialize or receipt constructor
/// can turn a browser-carried payload into the existing native Act owner.
pub struct SelectedPerformance {
    act_ref: String,
    act_revision: u64,
    act_digest: String,
    edition_position: usize,
    document_digest: String,
    document: Document,
    scene_index: usize,
    private_act_custody: bool,
}

#[derive(Serialize)]
struct OriginalEpisode<'a> {
    basis_index: usize,
    basis_digest: &'a str,
    identity: &'a Identity,
    context: &'a ContextBinding,
    original_episode: &'a Option<Value>,
}

#[derive(Serialize)]
struct Payload<'a> {
    schema: &'static str,
    material_contract: &'static str,
    act_ref: &'a str,
    act_revision: u64,
    act_digest: &'a str,
    edition_position: usize,
    expanded_document_sha256: &'a str,
    expression_ref: &'a str,
    expression_revision: u64,
    scene_ref: &'a str,
    scene_revision: u64,
    performance_digest: &'a str,
    /// The COMPLETE existing value carries authored events, actual encoded
    /// native receipt pages, source assets, reservations, routes and paired
    /// checkpoints. These are not reduced to a fixed initial score snapshot.
    performance: &'a Performance,
    /// Exact original native Serialize bytes bind the complete selected value,
    /// including the beginning of every historical recording stream.
    canonical_performance_bytes: String,
    selected_performance_sha256: String,
    native_recording_parts: Vec<PartWitness>,
    native_source_parts: Vec<SourceWitness>,
    original_episodes: Vec<OriginalEpisode<'a>>,
}

impl SelectedPerformance {
    pub fn from_act(act: &Act, selection: &Selection) -> Result<Self, String> {
        if act.revision != selection.expected_act_revision {
            return Err("selected native Act revision changed".into());
        }
        expression_performance_act::validate(act)?;
        let document =
            expression_performance_act::selected_document(act, selection.edition_position)?;
        if document.revision != selection.expected_expression_revision
            || document.expression_ref != act.expression_ref
        {
            return Err("selected full native Edition identity changed".into());
        }
        let matching: Vec<_> = document
            .scenes
            .iter()
            .enumerate()
            .filter(|(_, scene)| scene.scene_ref == selection.scene_ref)
            .collect();
        if matching.len() != 1 {
            return Err("selected native performance Scene missing or ambiguous".into());
        }
        let (scene_index, scene) = matching[0];
        if scene.revision != selection.expected_scene_revision
            || scene
                .performance
                .as_ref()
                .ok_or("selected Scene has no retained performance")?
                .fingerprint()?
                != selection.performance_digest
        {
            return Err("selected native Scene/performance revision changed".into());
        }
        let act_digest = digest(&serde_json::to_vec(act).map_err(|e| e.to_string())?);
        let document_digest = digest(&serde_json::to_vec(&document).map_err(|e| e.to_string())?);
        Ok(Self {
            act_ref: act.act_ref.clone(),
            act_revision: act.revision,
            act_digest,
            edition_position: selection.edition_position,
            document_digest,
            document,
            scene_index,
            private_act_custody: act
                .performance_custody
                .as_ref()
                .is_some_and(|c| c.requires_private_disclosure()),
        })
    }
    pub fn document(&self) -> &Document {
        &self.document
    }
    pub fn scene(&self) -> &Scene {
        &self.document.scenes[self.scene_index]
    }
    pub fn performance(&self) -> &Performance {
        self.scene()
            .performance
            .as_ref()
            .expect("validated selected performance")
    }
    pub fn requires_private_disclosure(&self) -> bool {
        self.private_act_custody
            || self.performance().bases.iter().any(|b| b.context.private)
            || self
                .performance()
                .native_sources
                .iter()
                .any(|s| s.requires_private_disclosure())
    }
    /// Existing source/receiving lease must independently rebuild every full
    /// native source bundle; a retained digest is not replay authority.
    pub fn verify_native_sources(&self, actual: &[Value]) -> Result<(), String> {
        let performance = self.performance();
        let mut musical_digests = std::collections::BTreeSet::new();
        let per_basis = performance.native_sources.len() == performance.bases.len()
            && performance.bases.iter().all(|basis| {
                musical_digests.insert(&basis.content_digest)
                    && performance.native_sources.iter().filter(|source| source.basis_digest() == basis.content_digest).count() == 1
            });
        if per_basis {
            self.performance().verify_native_source_replay(actual)
        } else {
            self.performance().verify_native_source_epoch_replay(actual)
        }
    }
    fn payload(&self) -> Result<Payload<'_>, String> {
        let performance = self.performance();
        performance.validate()?;
        crate::expression_performance_recording::validate_recording_pages(performance)?;
        let canonical = serde_json::to_vec(performance).map_err(|e| e.to_string())?;
        let selected_performance_sha256 = digest(&canonical);
        Ok(Payload {
            schema: SCHEMA,
            material_contract: expression_performance_act::MATERIAL_SCHEMA,
            act_ref: &self.act_ref,
            act_revision: self.act_revision,
            act_digest: &self.act_digest,
            edition_position: self.edition_position,
            expanded_document_sha256: &self.document_digest,
            expression_ref: &self.document.expression_ref,
            expression_revision: self.document.revision,
            scene_ref: &self.scene().scene_ref,
            scene_revision: self.scene().revision,
            performance_digest: &performance.content_digest,
            performance,
            canonical_performance_bytes: utf8(canonical)?,
            selected_performance_sha256,
            native_recording_parts: performance
                .native_recordings
                .iter()
                .enumerate()
                .map(|(index, page)| recording_witness(index, page))
                .collect::<Result<_, _>>()?,
            native_source_parts: performance
                .native_sources
                .iter()
                .enumerate()
                .map(|(source_index, source)| {
                    let canonical = part_bytes("native_source", source)?;
                    let reading = source.reading()?;
                    if reading.r#ref != digest(&canonical) {
                        return Err("native source part byte identity differs".into());
                    }
                    Ok(SourceWitness {
                        source_index,
                        reading,
                        canonical_part_bytes: utf8(canonical)?,
                    })
                })
                .collect::<Result<_, String>>()?,
            original_episodes: performance
                .bases
                .iter()
                .enumerate()
                .map(|(basis_index, basis)| OriginalEpisode {
                    basis_index,
                    basis_digest: &basis.content_digest,
                    identity: &basis.identity,
                    context: &basis.context,
                    original_episode: &basis.m4_episode,
                })
                .collect(),
        })
    }
    /// Internal/native Return material may include private original episodes.
    /// The current receiving owner, not this serializer, grants disclosure.
    pub fn write_native_payload<W: Write>(&self, output: &mut W) -> Result<(), String> {
        let payload = self.payload()?;
        crate::expression_act_storage::measure(&payload, MAX_DELIVERY_BYTES)?;
        serde_json::to_writer(output, &payload).map_err(|e| e.to_string())
    }
    pub fn native_payload(&self) -> Result<Value, String> {
        let payload = self.payload()?;
        crate::expression_act_storage::measure(&payload, MAX_DELIVERY_BYTES)?;
        serde_json::to_value(payload).map_err(|e| e.to_string())
    }
    pub fn write_public_payload<W: Write>(&self, output: &mut W) -> Result<(), String> {
        if self.requires_private_disclosure() {
            return Err("complete native Act source requires its private disclosure owner".into());
        }
        self.write_native_payload(output)
    }
    /// A native renderer uses this seal for exactly this selected edited score;
    /// the actual stopped A/P owner must still admit cursor and queued state.
    pub fn prefix_digest(&self, sample: Counter) -> Result<String, String> {
        self.performance().prefix_digest(sample.0)
    }
    /// Restitute the exact complete stopped checkpoint through its existing
    /// native wire owner. One checkpoint travels per read; a score consumer
    /// must not recreate queued/input/body state from labels or selected fields.
    pub fn native_checkpoint(&self, index: usize) -> Result<Value, String> {
        let checkpoint = self
            .performance()
            .checkpoints
            .get(index)
            .ok_or("native retained checkpoint absent")?;
        checkpoint.validate()?;
        let wire = checkpoint.native_management_wire()?;
        let canonical = part_bytes("checkpoint", checkpoint)?;
        let wire_bytes = serde_json::to_vec(&wire).map_err(|e| e.to_string())?;
        let value = serde_json::json!({
            "schema":"oi.expression-native-checkpoint-delivery/v1",
            "act_ref":self.act_ref,"act_revision":self.act_revision,
            "act_digest":self.act_digest,"edition_position":self.edition_position,
            "expanded_document_sha256":self.document_digest,
            "scene_ref":self.scene().scene_ref,"scene_revision":self.scene().revision,
            "performance_digest":self.performance().content_digest,
            "checkpoint_index":index,"checkpoint":checkpoint,
            // This reading witnesses the restituted full native part. The
            // existing encoded checkpoint remains in the same Act catalog.
            "canonical_part_bytes":utf8(canonical.clone())?,
            "reading":{"ref":digest(&canonical),"revision":"oi.expression-performance-checkpoint/v1","availability":"available"},
            "native_management_wire":wire,
            "canonical_native_wire_bytes":utf8(wire_bytes.clone())?,
            "native_wire_sha256":digest(&wire_bytes)
        });
        crate::expression_act_storage::measure(&value, MAX_DELIVERY_BYTES)?;
        Ok(value)
    }
    /// All receipt pages remain in the SAME native Act. This read decodes one
    /// selected page with its original codec; no consumer reimplements it.
    pub fn native_page(&self, index: usize) -> Result<Value, String> {
        // Construction validated the entire immutable selected Performance;
        // only this page is decoded here, preserving bounded streaming work.
        let page = self
            .performance()
            .native_recordings
            .get(index)
            .ok_or("native retained recording page absent")?;
        let witness = recording_witness(index, page)?;
        let canonical = page.canonical_decoded_bytes()?;
        let decoded: Value = serde_json::from_slice(&canonical).map_err(|e| e.to_string())?;
        #[derive(Serialize)]
        struct Page<'a> {
            schema: &'static str,
            act_ref: &'a str,
            act_revision: u64,
            act_digest: &'a str,
            edition_position: usize,
            expanded_document_sha256: &'a str,
            scene_ref: &'a str,
            scene_revision: u64,
            performance_digest: &'a str,
            witness: PartWitness,
            original_encoded_page: &'a crate::expression_performance_recording::NativeRecordingPage,
            canonical_decoded_bytes: String,
            decoded: Value,
        }
        let reply = Page {
            schema: PAGE_SCHEMA,
            act_ref: &self.act_ref,
            act_revision: self.act_revision,
            act_digest: &self.act_digest,
            edition_position: self.edition_position,
            expanded_document_sha256: &self.document_digest,
            scene_ref: &self.scene().scene_ref,
            scene_revision: self.scene().revision,
            performance_digest: &self.performance().content_digest,
            witness,
            original_encoded_page: page,
            canonical_decoded_bytes: utf8(canonical)?,
            decoded,
        };
        crate::expression_act_storage::measure(&reply, MAX_DELIVERY_BYTES)?;
        serde_json::to_value(reply).map_err(|e| e.to_string())
    }
}
