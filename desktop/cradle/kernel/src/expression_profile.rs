//! ES3 reusable presentation grammar and portable editions (O:I #352/#335).
//!
//! `profile = presentation grammar; subject Reading = meaning; Expression =
//! instantiated presentation over that truth.` A profile never carries
//! semantic truth about a subject. An edition is a portable relation that
//! re-opens without becoming canonical source. Neither is a second semantic
//! store, and the Library remains one collection/index view over Expression
//! refs (`collections` on the document), never the identity boundary.
use crate::expression::{
    bounds, id, parameter, readings, text, Automation, Parameter, ReadingRef,
};
use crate::expression_carrier::CarrierKind;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::BTreeMap;

/// Every profile instantiates over the existing bounded engine parameter
/// vocabulary; profiles tighten, never widen, the material domain.
pub const PROFILE_PARAMETER_KEYS: [&str; 6] = ["glyph", "x", "y", "z", "scale", "share"];

const MAX_PROFILE_BYTES: usize = 64 * 1024;
const MAX_PARENTS: usize = 8;
const MAX_LINEAGE_DEPTH: usize = 8;
const MAX_DEFAULTS: usize = 32;
const MAX_FORMATIONS: usize = 32;
const MAX_OVERRIDES: usize = 32;
const MAX_SEEDS: usize = 16;

/// How a fallback is admitted when the live form is unavailable.
#[derive(Clone, Copy, Debug, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum FallbackPolicy {
    /// Show the safe preview / bound Thing and keep the native open Action.
    #[default]
    Preview,
    /// Use an exact capture (image/video) as the fallback form.
    Capture,
    /// No fallback is admitted; refuse to present rather than fake it.
    Refuse,
}

/// A glyph/image/text target rule: which admitted formation a carrier
/// resolves to. Formations must come from the profile's own vocabulary.
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct TargetRule {
    pub formation: String,
    #[serde(default)]
    pub text: Option<String>,
}

/// A tightened numeric domain for a parameter key.
#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct ParameterDomain {
    pub min: f64,
    pub max: f64,
}

/// A scene seed: an authored starting role a profile suggests for scenes.
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct SceneSeed {
    pub role: String,
    pub title: String,
}

/// ES3 ExpressionProfile: reusable presentation/material grammar — material
/// defaults, formation vocabulary, glyph/image/text target rules, physics/
/// colour/transition/automation defaults, scene seeds/roles, accepted binding
/// kinds and native owners, permitted parameter domains, fallback policy and
/// lineage. Small profiles are legitimate: a text profile need not carry the
/// physical vocabulary.
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct ExpressionProfile {
    /// `profile:<id>`.
    pub profile_ref: String,
    pub revision: u64,
    pub title: String,
    /// Controlled lineage: parents must already exist when the profile is
    /// defined, so corpus-wide defaults propagate through refs.
    #[serde(default)]
    pub parent_profile_refs: Vec<String>,
    /// Which scene-body carriers this profile may present.
    pub accepted_binding_kinds: Vec<CarrierKind>,
    /// Native owners admitted by this profile; empty means unrestricted.
    #[serde(default)]
    pub accepted_native_owners: Vec<String>,
    /// Base material defaults over the bounded parameter vocabulary.
    #[serde(default)]
    pub material_defaults: BTreeMap<String, Parameter>,
    /// Admitted formation names for target rules.
    #[serde(default)]
    pub formation_vocabulary: Vec<String>,
    /// Carrier → formation target rules.
    #[serde(default)]
    pub target_rules: BTreeMap<CarrierKind, TargetRule>,
    /// Parameter automation defaults (numeric parameters only).
    #[serde(default)]
    pub automation_defaults: BTreeMap<String, Automation>,
    /// Tightened numeric domains a profile admits.
    #[serde(default)]
    pub permitted_parameter_domains: BTreeMap<String, ParameterDomain>,
    #[serde(default)]
    pub scene_seeds: Vec<SceneSeed>,
    /// Authored camera/framing note; presentation data stays with the engine
    /// adapters, the profile only records the authored disposition.
    #[serde(default)]
    pub framing_note: Option<String>,
    #[serde(default)]
    pub fallback_policy: FallbackPolicy,
    #[serde(default)]
    pub provenance: Vec<ReadingRef>,
}

fn formation_token(value: &str) -> Result<(), String> {
    if value.is_empty()
        || value.len() > 32
        || !value.bytes().all(|c| c.is_ascii_alphanumeric() || b"-_.".contains(&c))
    {
        return Err("Formation names are bounded tokens".into());
    }
    Ok(())
}

impl ExpressionProfile {
    pub fn validate(&self) -> Result<(), String> {
        if serde_json::to_vec(self).map_err(|e| e.to_string())?.len() > MAX_PROFILE_BYTES {
            return Err("Expression profile exceeds 64 KiB".into());
        }
        id(&self.profile_ref, "profile:")?;
        text(&self.title)?;
        if self.revision == 0 || self.revision > crate::expression::MAX_REVISION {
            return Err("Invalid profile revision".into());
        }
        if self.parent_profile_refs.len() > MAX_PARENTS
            || self.parent_profile_refs.contains(&self.profile_ref)
        {
            return Err("Profile lineage budget exceeded or self-parented".into());
        }
        for parent in &self.parent_profile_refs {
            id(parent, "profile:")?;
        }
        let mut kinds = self.accepted_binding_kinds.clone();
        kinds.sort();
        kinds.dedup();
        if kinds.len() != self.accepted_binding_kinds.len()
            || self.accepted_binding_kinds.is_empty()
        {
            return Err("Profile must accept a unique, nonempty carrier vocabulary".into());
        }
        if self.accepted_native_owners.len() > 32 {
            return Err("Profile native-owner budget exceeded".into());
        }
        for owner in &self.accepted_native_owners {
            text(owner)?;
        }
        if self.material_defaults.len() > MAX_DEFAULTS {
            return Err("Profile material-default budget exceeded".into());
        }
        for (key, p) in &self.material_defaults {
            if !PROFILE_PARAMETER_KEYS.contains(&key.as_str()) {
                return Err("Profile material defaults stay inside the parameter vocabulary".into());
            }
            parameter(key, p)?;
        }
        if self.formation_vocabulary.len() > MAX_FORMATIONS {
            return Err("Profile formation vocabulary budget exceeded".into());
        }
        for formation in &self.formation_vocabulary {
            formation_token(formation)?;
        }
        if self.target_rules.len() > crate::expression_carrier::CARRIER_KINDS.len() {
            return Err("Profile target-rule budget exceeded".into());
        }
        for (carrier, rule) in &self.target_rules {
            formation_token(&rule.formation)?;
            if !self.formation_vocabulary.contains(&rule.formation) {
                return Err("Target rule must use an admitted formation".into());
            }
            if let Some(t) = &rule.text {
                text(t)?;
            }
            if !self.accepted_binding_kinds.contains(carrier) {
                return Err("Target rule names an unaccepted carrier".into());
            }
        }
        if self.automation_defaults.len() > MAX_DEFAULTS {
            return Err("Profile automation-default budget exceeded".into());
        }
        for (key, automation) in &self.automation_defaults {
            let (min, max) = bounds(key)
                .ok_or("Profile automation defaults stay inside numeric parameters")?;
            // Reuse the parameter law: glyph automation is unsupported, and
            // numeric automation must sit inside the global bounds.
            parameter(
                key,
                &Parameter { value: json!((min + max) / 2.), automation: Some(automation.clone()) },
            )?;
        }
        if self.permitted_parameter_domains.len() > MAX_DEFAULTS {
            return Err("Profile parameter-domain budget exceeded".into());
        }
        for (key, domain) in &self.permitted_parameter_domains {
            let (min, max) = bounds(key)
                .ok_or("Profile parameter domains stay inside numeric parameters")?;
            if !domain.min.is_finite()
                || !domain.max.is_finite()
                || domain.min < min
                || domain.max > max
                || domain.min > domain.max
            {
                return Err(format!("Profile domain for {key} must sit inside [{min}, {max}]"));
            }
        }
        if self.scene_seeds.len() > MAX_SEEDS {
            return Err("Profile scene-seed budget exceeded".into());
        }
        for seed in &self.scene_seeds {
            formation_token(&seed.role)?;
            text(&seed.title)?;
        }
        if let Some(note) = &self.framing_note {
            text(note)?;
        }
        readings(&self.provenance)?;
        Ok(())
    }

    /// Profile resolution against ordinary subject kinds: a profile admits a
    /// subject when the carrier kind is accepted and the native owner is
    /// accepted (an empty owner list is unrestricted).
    pub fn admits(&self, native_owner: &str, carrier: CarrierKind) -> bool {
        self.accepted_binding_kinds.contains(&carrier)
            && (self.accepted_native_owners.is_empty()
                || self.accepted_native_owners.iter().any(|o| o == native_owner))
    }
}

/// An Expression's recorded instantiation of a profile, with explicit,
/// legible child overrides. Overrides never rewrite the profile.
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct ProfileAdoption {
    pub profile_ref: String,
    pub revision: u64,
    #[serde(default)]
    pub overridden_parameters: BTreeMap<String, Parameter>,
}

impl ProfileAdoption {
    pub fn validate(&self) -> Result<(), String> {
        id(&self.profile_ref, "profile:")?;
        if self.revision == 0 || self.revision > crate::expression::MAX_REVISION {
            return Err("Invalid adopted profile revision".into());
        }
        if self.overridden_parameters.len() > MAX_OVERRIDES {
            return Err("Profile override budget exceeded".into());
        }
        for (key, p) in &self.overridden_parameters {
            if !PROFILE_PARAMETER_KEYS.contains(&key.as_str()) {
                return Err("Profile overrides stay inside the parameter vocabulary".into());
            }
            parameter(key, p)?;
        }
        Ok(())
    }
}

/// Resolve the effective material defaults of a profile lineage: parents
/// first, child last. A parent revision change therefore propagates to
/// children resolved through refs while explicit child/adoption overrides
/// remain exactly as authored.
pub fn resolve_lineage(
    registry: &BTreeMap<String, ExpressionProfile>,
    profile_ref: &str,
) -> Result<BTreeMap<String, Parameter>, String> {
    let mut chain = Vec::new();
    let mut visited = std::collections::BTreeSet::new();
    let mut current = profile_ref.to_owned();
    loop {
        if visited.contains(&current) || chain.len() > MAX_LINEAGE_DEPTH {
            return Err("Profile lineage is circular or too deep".into());
        }
        visited.insert(current.clone());
        let profile = registry
            .get(&current)
            .ok_or_else(|| format!("Profile {current} is not defined"))?;
        chain.push(profile);
        match profile.parent_profile_refs.first() {
            Some(parent) => current = parent.clone(),
            None => break,
        }
    }
    let mut resolved = BTreeMap::new();
    for profile in chain.iter().rev() {
        for (key, value) in &profile.material_defaults {
            resolved.insert(key.clone(), value.clone());
        }
    }
    Ok(resolved)
}

/// One admitted asset inside an edition: exact ref, revision and digest.
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct EditionAsset {
    pub asset_ref: String,
    pub revision: String,
    pub digest: String,
}

/// ES3 ExpressionEdition: the portable relation — expression/profile refs and
/// revisions, subject refs, front representation, optional verso presentation,
/// captures/fallbacks, admitted assets, provenance and integrity metadata.
/// Re-opening an edition never opens or rewrites the Expression; an edition is
/// a reading, not canonical source.
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct ExpressionEdition {
    /// `edition:<id>`.
    pub edition_ref: String,
    pub revision: u64,
    pub title: String,
    pub expression_ref: String,
    pub expression_revision: u64,
    #[serde(default)]
    pub profile_ref: Option<String>,
    #[serde(default)]
    pub profile_revision: Option<u64>,
    #[serde(default)]
    pub subject_refs: Vec<String>,
    pub front_representation: ReadingRef,
    #[serde(default)]
    pub verso_presentation_ref: Option<ReadingRef>,
    /// Captures/fallback forms (image/video/frozen) with exact readings.
    #[serde(default)]
    pub captures: Vec<ReadingRef>,
    /// Admitted assets carried by this edition.
    #[serde(default)]
    pub admitted_assets: Vec<EditionAsset>,
    #[serde(default)]
    pub provenance: Vec<ReadingRef>,
    /// Caller-supplied integrity digest over the edition envelope.
    pub digest: String,
}

const MAX_EDITION_ASSETS: usize = 64;
const MAX_EDITION_SUBJECTS: usize = 64;
const MAX_EDITION_CAPTURES: usize = 16;

impl ExpressionEdition {
    pub fn validate(&self) -> Result<(), String> {
        id(&self.edition_ref, "edition:")?;
        text(&self.title)?;
        id(&self.expression_ref, "expression:")?;
        if self.revision == 0 || self.revision > crate::expression::MAX_REVISION {
            return Err("Invalid edition revision".into());
        }
        if self.expression_revision == 0 || self.expression_revision > crate::expression::MAX_REVISION {
            return Err("Invalid edition expression revision".into());
        }
        if let Some(profile_ref) = &self.profile_ref {
            id(profile_ref, "profile:")?;
            if self.profile_revision.is_none() {
                return Err("An edition naming a profile must record its revision".into());
            }
        }
        if self.profile_revision.is_some_and(|r| r == 0) {
            return Err("Invalid edition profile revision".into());
        }
        if self.subject_refs.len() > MAX_EDITION_SUBJECTS {
            return Err("Edition subject budget exceeded".into());
        }
        for subject in &self.subject_refs {
            text(subject)?;
        }
        text(&self.front_representation.r#ref)?;
        text(&self.front_representation.revision)?;
        if let Some(verso) = &self.verso_presentation_ref {
            text(&verso.r#ref)?;
            text(&verso.revision)?;
        }
        if self.captures.len() > MAX_EDITION_CAPTURES {
            return Err("Edition capture budget exceeded".into());
        }
        for capture in &self.captures {
            text(&capture.r#ref)?;
            text(&capture.revision)?;
        }
        if self.admitted_assets.len() > MAX_EDITION_ASSETS {
            return Err("Edition admitted-asset budget exceeded".into());
        }
        for asset in &self.admitted_assets {
            id(&asset.asset_ref, "asset:")?;
            text(&asset.revision)?;
            text(&asset.digest)?;
        }
        readings(&self.provenance)?;
        text(&self.digest)?;
        Ok(())
    }
}
