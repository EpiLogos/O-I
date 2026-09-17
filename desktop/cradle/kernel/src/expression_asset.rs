//! ES3A reusable visual-asset vocabulary as an admission + occurrence index
//! (O:I #352). The index records real use: need → candidate form → used in a
//! real Expression → result witnessed → accepted occurrence admitted/indexed →
//! later work can disclose prior occurrences. It is an index over use, not an
//! advance procurement catalogue and not a second semantic store: an asset may
//! appear in many Expressions and a subject may have several visual forms,
//! and neither relation makes the form the canonical identity of the subject.
use crate::expression::{id, text, ReadingRef};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::BTreeMap;

/// The admitted asset kinds.
#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "snake_case")]
pub enum AssetKind {
    Glyph,
    Svg,
    Ascii,
    Image,
    Media,
    Diagram,
    Texture,
    GeneratedForm,
    Other,
}

/// One recorded use of an asset in a real Expression, as submitted at
/// admission. The kernel verifies the Expression is real and records its
/// revision at admission time in [`IndexedOccurrence`].
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct AssetOccurrence {
    pub expression_ref: String,
    #[serde(default)]
    pub scene_ref: Option<String>,
    #[serde(default)]
    pub profile_ref: Option<String>,
    /// Attribution of the witness; correlation, never authentication.
    pub witnessed_by: String,
    /// Accepted occurrence standing (witnessed and accepted vs witnessed only).
    pub accepted: bool,
}

/// An admitted asset reading: addressable ref + revision/digest, kind, native
/// source, rights/provenance, the subject refs it may depict or signify, plain
/// tags and profile roles, its fallback form and variant/family relations.
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct AdmittedAsset {
    /// `asset:<id>`.
    pub asset_ref: String,
    pub revision: String,
    pub digest: String,
    pub kind: AssetKind,
    /// Exact native source/asset reading.
    pub source: ReadingRef,
    /// Creator/source/rights/licence provenance readings.
    #[serde(default)]
    pub rights: Vec<ReadingRef>,
    /// Subject refs this form may depict or signify (common-referent refs).
    #[serde(default)]
    pub subject_refs: Vec<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub profile_roles: Vec<String>,
    /// Exact reading of the admitted fallback form, when one exists.
    #[serde(default)]
    pub fallback: Option<ReadingRef>,
    /// Variant/family relations to other assets.
    #[serde(default)]
    pub family_refs: Vec<String>,
    /// Occurrences submitted with this admission.
    #[serde(default)]
    pub occurrences: Vec<AssetOccurrence>,
}

/// An occurrence verified against the open Expression and indexed.
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct IndexedOccurrence {
    pub expression_ref: String,
    /// The Expression revision current at admission.
    pub expression_revision: u64,
    pub scene_ref: Option<String>,
    pub profile_ref: Option<String>,
    pub witnessed_by: String,
    pub accepted: bool,
}

/// One admitted (asset_ref, revision) reading with its verified occurrences.
#[derive(Clone, Debug, Serialize, PartialEq)]
pub struct IndexedAsset {
    pub asset: AdmittedAsset,
    pub occurrences: Vec<IndexedOccurrence>,
    pub admitted_by: String,
}

pub const MAX_INDEXED_ASSETS: usize = 256;
const MAX_OCCURRENCES_PER_ASSET: usize = 64;
const MAX_ASSET_SUBJECTS: usize = 32;
const MAX_ASSET_TAGS: usize = 16;

fn tag_token(value: &str) -> Result<(), String> {
    if value.is_empty() || value.len() > 32 {
        return Err("Asset tags/roles are bounded tokens".into());
    }
    Ok(())
}

pub fn validate_asset(asset: &AdmittedAsset) -> Result<(), String> {
    id(&asset.asset_ref, "asset:")?;
    text(&asset.revision)?;
    text(&asset.digest)?;
    text(&asset.source.r#ref)?;
    text(&asset.source.revision)?;
    if asset.rights.len() > crate::expression::LIMIT {
        return Err("Asset rights budget exceeded".into());
    }
    for r in &asset.rights {
        text(&r.r#ref)?;
        text(&r.revision)?;
    }
    if asset.subject_refs.len() > MAX_ASSET_SUBJECTS {
        return Err("Asset subject-ref budget exceeded".into());
    }
    for subject in &asset.subject_refs {
        text(subject)?;
    }
    if asset.tags.len() > MAX_ASSET_TAGS || asset.profile_roles.len() > MAX_ASSET_TAGS {
        return Err("Asset tag/role budget exceeded".into());
    }
    for t in asset.tags.iter().chain(&asset.profile_roles) {
        tag_token(t)?;
    }
    if let Some(fallback) = &asset.fallback {
        text(&fallback.r#ref)?;
        text(&fallback.revision)?;
    }
    if asset.family_refs.len() > MAX_ASSET_TAGS {
        return Err("Asset family budget exceeded".into());
    }
    for family in &asset.family_refs {
        id(family, "asset:")?;
    }
    if asset.occurrences.len() > MAX_OCCURRENCES_PER_ASSET {
        return Err("Asset occurrence budget exceeded".into());
    }
    for occurrence in &asset.occurrences {
        text(&occurrence.expression_ref)?;
        if let Some(scene) = &occurrence.scene_ref {
            text(scene)?;
        }
        if let Some(profile) = &occurrence.profile_ref {
            id(profile, "profile:")?;
        }
        text(&occurrence.witnessed_by)?;
    }
    Ok(())
}

/// The admission + occurrence index. Entries are keyed by (asset_ref,
/// revision): a new revision of the same ref is a distinct admitted reading;
/// the same ref+revision must keep its identity (kind/source/digest) and can
/// only accumulate verified occurrences.
#[derive(Debug, Default)]
pub struct AssetIndex {
    entries: BTreeMap<(String, String), IndexedAsset>,
}

impl AssetIndex {
    /// Admit an asset reading, verifying every occurrence against the real
    /// open Expressions. `open_revisions` resolves expression_ref → current
    /// revision; occurrences pointing at non-open Expressions are refused, so
    /// the index only ever records real use.
    pub fn admit(
        &mut self,
        asset: AdmittedAsset,
        open_revisions: &BTreeMap<String, u64>,
        actor: &str,
    ) -> Result<Value, String> {
        validate_asset(&asset)?;
        text(actor)?;
        let mut occurrences = Vec::new();
        for occurrence in asset.occurrences.clone() {
            let revision = open_revisions
                .get(&occurrence.expression_ref)
                .ok_or_else(|| {
                    "Occurrences record real use: the named Expression is not open in this application".to_owned()
                })?;
            occurrences.push(IndexedOccurrence {
                expression_ref: occurrence.expression_ref,
                expression_revision: *revision,
                scene_ref: occurrence.scene_ref,
                profile_ref: occurrence.profile_ref,
                witnessed_by: occurrence.witnessed_by,
                accepted: occurrence.accepted,
            });
        }
        let key = (asset.asset_ref.clone(), asset.revision.clone());
        if !self.entries.contains_key(&key) && self.entries.len() >= MAX_INDEXED_ASSETS {
            return Err("Asset index budget exceeded".into());
        }
        let entry = self.entries.entry(key).or_insert_with(|| IndexedAsset {
            asset: AdmittedAsset { occurrences: Vec::new(), ..asset.clone() },
            occurrences: Vec::new(),
            admitted_by: actor.to_owned(),
        });
        if entry.asset.kind != asset.kind
            || entry.asset.source != asset.source
            || entry.asset.digest != asset.digest
        {
            return Err(
                "The same asset ref+revision is already admitted with a different kind, source or digest".into(),
            );
        }
        let mut added = 0usize;
        for occurrence in occurrences {
            if entry.occurrences.contains(&occurrence) {
                continue;
            }
            if entry.occurrences.len() >= MAX_OCCURRENCES_PER_ASSET {
                return Err("Asset occurrence budget exceeded".into());
            }
            entry.occurrences.push(occurrence);
            added += 1;
        }
        Ok(json!({
            "state":"admitted",
            "asset_ref":asset.asset_ref,
            "revision":asset.revision,
            "new_occurrences":added,
            "occurrences":entry.occurrences,
        }))
    }

    /// asset/ref → source/provenance/rights → every use.
    pub fn traverse(&self, asset_ref: &str) -> Result<Value, String> {
        let matches: Vec<(&String, &IndexedAsset)> = self
            .entries
            .iter()
            .filter_map(|((r, revision), entry)| {
                (r == asset_ref).then_some((revision, entry))
            })
            .collect();
        if matches.is_empty() {
            return Err("Asset is not admitted".into());
        }
        let readings: Vec<Value> = matches
            .into_iter()
            .map(|(revision, entry)| {
                json!({
                    "revision":revision,
                    "asset":entry.asset,
                    "occurrences":entry.occurrences,
                    "admitted_by":entry.admitted_by,
                })
            })
            .collect();
        Ok(json!({"state":"asset","asset_ref":asset_ref,"readings":readings}))
    }

    /// subject/ref → available visual assets → every occurrence.
    pub fn for_subject(&self, subject_ref: &str) -> Value {
        let assets: Vec<Value> = self
            .entries
            .iter()
            .filter(|((_, _), entry)| {
                entry
                    .asset
                    .subject_refs
                    .iter()
                    .any(|s| s == subject_ref)
            })
            .map(|((asset_ref, revision), entry)| {
                json!({
                    "asset_ref":asset_ref,
                    "revision":revision,
                    "kind":entry.asset.kind,
                    "fallback":entry.asset.fallback,
                    "occurrences":entry.occurrences,
                })
            })
            .collect();
        json!({"state":"asset_subjects","subject_ref":subject_ref,"assets":assets})
    }

    pub fn len(&self) -> usize {
        self.entries.len()
    }

    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }
}
