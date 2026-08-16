use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::io;
use std::path::{Path, PathBuf};

pub const SUITE_SKILLSET_SCHEMA: &str = "oi.suite-skillset/v1";
pub const DIRECT_PROJECTION_SCHEMA: &str = "oi.skill-projection-receipt/v1";

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct SuiteSkillSetManifest {
    pub schema: String,
    pub profiles: Vec<SuiteSkillProfile>,
    pub skills: Vec<NativeSkillReference>,
    #[serde(default)]
    pub expected_native_skills: Vec<NativeSkillExpectation>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct SuiteSkillProfile {
    pub profile_ref: String,
    pub purpose: String,
    #[serde(default)]
    pub inherits: Vec<String>,
    pub members: Vec<ProfileSkillMember>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct ProfileSkillMember {
    pub skill_ref: String,
    pub requiredness: Requiredness,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Requiredness {
    Required,
    IfProductInstalled,
    Optional,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct NativeSkillReference {
    pub skill_ref: String,
    pub owner_product: String,
    pub purpose: String,
    pub source: NativeSkillSource,
    #[serde(default)]
    pub compatibility: Vec<SkillCompatibilityRequirement>,
    #[serde(default)]
    pub required_actions: Vec<String>,
    #[serde(default)]
    pub required_capabilities: Vec<String>,
    pub risk_class: String,
    #[serde(default)]
    pub permission_requirements: Vec<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct NativeSkillSource {
    pub repository: String,
    pub path: String,
    pub revision_policy: RevisionPolicy,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pinned_revision: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub native_version: Option<String>,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum RevisionPolicy {
    ResolveAuthoritativeInstalledRevision,
    Pinned,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct SkillCompatibilityRequirement {
    pub product: String,
    pub minimum_version: String,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct NativeSkillExpectation {
    pub owner_product: String,
    pub purpose: String,
    pub requiredness: Requiredness,
    pub profiles: Vec<String>,
    pub state: NativeSkillExpectationState,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum NativeSkillExpectationState {
    AwaitingNativePublication,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct SkillObservation {
    pub skill_ref: String,
    pub availability: SkillAvailability,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_revision: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub native_version: Option<String>,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SkillAvailability {
    Available,
    Missing,
    Drifted,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CapabilityGrantState {
    NotEvaluated,
    Granted,
    Denied,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ActionAuthorizationState {
    NotEvaluated,
    Authorized,
    Denied,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SkillResolutionMode {
    AikitDynamic,
    OiDirectProjection,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct AuthorityObservation {
    #[serde(default)]
    pub capability_grants: BTreeMap<String, CapabilityGrantState>,
    #[serde(default)]
    pub action_authorizations: BTreeMap<String, ActionAuthorizationState>,
}

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
pub struct EffectiveSkillSet {
    pub schema: &'static str,
    pub profile_ref: String,
    pub resolution_mode: SkillResolutionMode,
    pub skills: Vec<EffectiveSkillRelation>,
    pub expected_native_skills: Vec<NativeSkillExpectation>,
    pub degraded: bool,
}

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
pub struct EffectiveSkillRelation {
    pub skill_ref: String,
    pub owner_product: String,
    pub purpose: String,
    pub requiredness: Requiredness,
    pub source_repository: String,
    pub source_path: String,
    pub expected_revision: Option<String>,
    pub observed_revision: Option<String>,
    pub availability: SkillAvailability,
    pub resolution_mode: SkillResolutionMode,
    pub capability_states: BTreeMap<String, CapabilityGrantState>,
    pub action_states: BTreeMap<String, ActionAuthorizationState>,
    pub risk_class: String,
    pub permission_requirements: Vec<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct DirectProjectionReceipt {
    pub schema: String,
    pub skill_ref: String,
    pub source_repository: String,
    pub source_path: String,
    pub source_revision: String,
    pub destination: String,
    pub generated_digest: String,
}

#[derive(Clone, Copy, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DirectProjectionState {
    Created,
    Updated,
    Unchanged,
    ConflictPreserved,
}

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
pub struct DirectProjectionOutcome {
    pub state: DirectProjectionState,
    pub receipt: Option<DirectProjectionReceipt>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
}

pub fn parse_manifest(input: &str) -> Result<SuiteSkillSetManifest, String> {
    let manifest: SuiteSkillSetManifest = serde_json::from_str(input)
        .map_err(|error| format!("suite SkillSet manifest is not valid JSON: {error}"))?;
    validate_manifest(&manifest)?;
    Ok(manifest)
}

pub fn validate_manifest(manifest: &SuiteSkillSetManifest) -> Result<(), String> {
    if manifest.schema != SUITE_SKILLSET_SCHEMA {
        return Err(format!(
            "unsupported suite SkillSet schema `{}`; expected `{SUITE_SKILLSET_SCHEMA}`",
            manifest.schema
        ));
    }
    if manifest.profiles.is_empty() {
        return Err("suite SkillSet manifest requires at least one profile".into());
    }

    let mut skill_refs = BTreeSet::new();
    for skill in &manifest.skills {
        nonempty("skill_ref", &skill.skill_ref)?;
        if !skill_refs.insert(skill.skill_ref.as_str()) {
            return Err(format!("duplicate native skill_ref `{}`", skill.skill_ref));
        }
        nonempty("owner_product", &skill.owner_product)?;
        nonempty("purpose", &skill.purpose)?;
        nonempty("source.repository", &skill.source.repository)?;
        nonempty("source.path", &skill.source.path)?;
        nonempty("risk_class", &skill.risk_class)?;
        match skill.source.revision_policy {
            RevisionPolicy::Pinned => {
                let revision = skill
                    .source
                    .pinned_revision
                    .as_deref()
                    .ok_or_else(|| format!("pinned skill `{}` requires pinned_revision", skill.skill_ref))?;
                nonempty("source.pinned_revision", revision)?;
            }
            RevisionPolicy::ResolveAuthoritativeInstalledRevision => {
                if skill.source.pinned_revision.is_some() {
                    return Err(format!(
                        "skill `{}` uses installed-revision resolution and must not also pin a revision",
                        skill.skill_ref
                    ));
                }
            }
        }
        unique_nonempty("required_actions", &skill.required_actions)?;
        unique_nonempty("required_capabilities", &skill.required_capabilities)?;
        unique_nonempty("permission_requirements", &skill.permission_requirements)?;
        for requirement in &skill.compatibility {
            nonempty("compatibility.product", &requirement.product)?;
            nonempty("compatibility.minimum_version", &requirement.minimum_version)?;
        }
    }

    let mut profile_refs = BTreeSet::new();
    for profile in &manifest.profiles {
        nonempty("profile_ref", &profile.profile_ref)?;
        nonempty("profile purpose", &profile.purpose)?;
        if !profile_refs.insert(profile.profile_ref.as_str()) {
            return Err(format!("duplicate profile_ref `{}`", profile.profile_ref));
        }
        unique_nonempty("profile inherits", &profile.inherits)?;
        let mut members = BTreeSet::new();
        for member in &profile.members {
            nonempty("profile member skill_ref", &member.skill_ref)?;
            if !skill_refs.contains(member.skill_ref.as_str()) {
                return Err(format!(
                    "profile `{}` references unknown native skill `{}`",
                    profile.profile_ref, member.skill_ref
                ));
            }
            if !members.insert(member.skill_ref.as_str()) {
                return Err(format!(
                    "profile `{}` repeats skill `{}`",
                    profile.profile_ref, member.skill_ref
                ));
            }
        }
    }
    for profile in &manifest.profiles {
        for parent in &profile.inherits {
            if !profile_refs.contains(parent.as_str()) {
                return Err(format!(
                    "profile `{}` inherits unknown profile `{parent}`",
                    profile.profile_ref
                ));
            }
        }
    }
    detect_profile_cycles(manifest)?;

    for expectation in &manifest.expected_native_skills {
        nonempty("expected owner_product", &expectation.owner_product)?;
        nonempty("expected purpose", &expectation.purpose)?;
        if expectation.profiles.is_empty() {
            return Err(format!(
                "native Skill expectation for `{}` must name at least one profile",
                expectation.owner_product
            ));
        }
        for profile in &expectation.profiles {
            if !profile_refs.contains(profile.as_str()) {
                return Err(format!(
                    "native Skill expectation for `{}` names unknown profile `{profile}`",
                    expectation.owner_product
                ));
            }
        }
    }
    Ok(())
}

fn detect_profile_cycles(manifest: &SuiteSkillSetManifest) -> Result<(), String> {
    let index = manifest
        .profiles
        .iter()
        .map(|profile| (profile.profile_ref.as_str(), profile))
        .collect::<BTreeMap<_, _>>();
    for profile in &manifest.profiles {
        let mut visiting = BTreeSet::new();
        visit_profile(profile.profile_ref.as_str(), &index, &mut visiting)?;
    }
    Ok(())
}

fn visit_profile<'a>(
    profile_ref: &'a str,
    index: &BTreeMap<&'a str, &'a SuiteSkillProfile>,
    visiting: &mut BTreeSet<&'a str>,
) -> Result<(), String> {
    if !visiting.insert(profile_ref) {
        return Err(format!("suite SkillSet profile inheritance cycle at `{profile_ref}`"));
    }
    let profile = index
        .get(profile_ref)
        .ok_or_else(|| format!("unknown suite SkillSet profile `{profile_ref}`"))?;
    for parent in &profile.inherits {
        visit_profile(parent, index, visiting)?;
    }
    visiting.remove(profile_ref);
    Ok(())
}

pub fn resolve_profile(
    manifest: &SuiteSkillSetManifest,
    profile_ref: &str,
    observations: &[SkillObservation],
    authority: &AuthorityObservation,
    mode: SkillResolutionMode,
) -> Result<EffectiveSkillSet, String> {
    validate_manifest(manifest)?;
    let profile_index = manifest
        .profiles
        .iter()
        .map(|profile| (profile.profile_ref.as_str(), profile))
        .collect::<BTreeMap<_, _>>();
    if !profile_index.contains_key(profile_ref) {
        return Err(format!("unknown suite SkillSet profile `{profile_ref}`"));
    }
    let skill_index = manifest
        .skills
        .iter()
        .map(|skill| (skill.skill_ref.as_str(), skill))
        .collect::<BTreeMap<_, _>>();
    let observation_index = observations
        .iter()
        .map(|observation| (observation.skill_ref.as_str(), observation))
        .collect::<BTreeMap<_, _>>();

    let mut members = BTreeMap::<String, Requiredness>::new();
    collect_profile_members(profile_ref, &profile_index, &mut members)?;
    let mut degraded = false;
    let mut skills = Vec::with_capacity(members.len());
    for (skill_ref, requiredness) in members {
        let skill = skill_index
            .get(skill_ref.as_str())
            .ok_or_else(|| format!("profile resolution lost native skill `{skill_ref}`"))?;
        let observation = observation_index.get(skill_ref.as_str()).copied();
        let availability = observation
            .map(|observation| observation.availability)
            .unwrap_or(SkillAvailability::Missing);
        if availability != SkillAvailability::Available && requiredness != Requiredness::Optional {
            degraded = true;
        }
        let expected_revision = skill.source.pinned_revision.clone();
        if let (Some(expected), Some(observed)) = (
            expected_revision.as_deref(),
            observation.and_then(|observation| observation.source_revision.as_deref()),
        ) {
            if expected != observed {
                degraded = true;
            }
        }

        let capability_states = skill
            .required_capabilities
            .iter()
            .map(|capability| {
                (
                    capability.clone(),
                    authority
                        .capability_grants
                        .get(capability)
                        .copied()
                        .unwrap_or(CapabilityGrantState::NotEvaluated),
                )
            })
            .collect();
        let action_states = skill
            .required_actions
            .iter()
            .map(|action| {
                (
                    action.clone(),
                    authority
                        .action_authorizations
                        .get(action)
                        .copied()
                        .unwrap_or(ActionAuthorizationState::NotEvaluated),
                )
            })
            .collect();
        skills.push(EffectiveSkillRelation {
            skill_ref: skill.skill_ref.clone(),
            owner_product: skill.owner_product.clone(),
            purpose: skill.purpose.clone(),
            requiredness,
            source_repository: skill.source.repository.clone(),
            source_path: skill.source.path.clone(),
            expected_revision,
            observed_revision: observation.and_then(|observation| observation.source_revision.clone()),
            availability,
            resolution_mode: mode,
            capability_states,
            action_states,
            risk_class: skill.risk_class.clone(),
            permission_requirements: skill.permission_requirements.clone(),
        });
    }

    let expected_native_skills = manifest
        .expected_native_skills
        .iter()
        .filter(|expectation| expectation.profiles.iter().any(|profile| profile == profile_ref))
        .cloned()
        .collect::<Vec<_>>();
    if expected_native_skills
        .iter()
        .any(|expectation| expectation.requiredness == Requiredness::Required)
    {
        degraded = true;
    }

    Ok(EffectiveSkillSet {
        schema: SUITE_SKILLSET_SCHEMA,
        profile_ref: profile_ref.to_owned(),
        resolution_mode: mode,
        skills,
        expected_native_skills,
        degraded,
    })
}

fn collect_profile_members(
    profile_ref: &str,
    profiles: &BTreeMap<&str, &SuiteSkillProfile>,
    output: &mut BTreeMap<String, Requiredness>,
) -> Result<(), String> {
    let profile = profiles
        .get(profile_ref)
        .ok_or_else(|| format!("unknown suite SkillSet profile `{profile_ref}`"))?;
    for parent in &profile.inherits {
        collect_profile_members(parent, profiles, output)?;
    }
    for member in &profile.members {
        output.insert(member.skill_ref.clone(), member.requiredness);
    }
    Ok(())
}

pub fn materialise_direct_projection(
    skill: &NativeSkillReference,
    source_revision: &str,
    authoritative_content: &str,
    destination: &Path,
) -> Result<DirectProjectionOutcome, String> {
    nonempty("source_revision", source_revision)?;
    if authoritative_content.is_empty() {
        return Err("authoritative Skill content must not be empty".into());
    }
    if let Some(pinned) = skill.source.pinned_revision.as_deref() {
        if pinned != source_revision {
            return Err(format!(
                "authoritative revision `{source_revision}` does not satisfy pinned revision `{pinned}` for `{}`",
                skill.skill_ref
            ));
        }
    }

    let generated = generated_projection(skill, source_revision, authoritative_content);
    let generated_digest = stable_digest(generated.as_bytes());
    let receipt_path = projection_receipt_path(destination);

    if destination.exists() {
        if !receipt_path.exists() {
            return Ok(DirectProjectionOutcome {
                state: DirectProjectionState::ConflictPreserved,
                receipt: None,
                detail: Some(format!(
                    "destination {} exists without an O:I projection receipt; preserved",
                    destination.display()
                )),
            });
        }
        let receipt = read_projection_receipt(&receipt_path)?;
        if receipt.skill_ref != skill.skill_ref || receipt.destination != destination.to_string_lossy() {
            return Ok(DirectProjectionOutcome {
                state: DirectProjectionState::ConflictPreserved,
                receipt: Some(receipt),
                detail: Some("existing projection receipt belongs to another Skill or destination; preserved".into()),
            });
        }
        let current = fs::read(destination)
            .map_err(|error| format!("could not read existing projected Skill: {error}"))?;
        let current_digest = stable_digest(&current);
        if current_digest != receipt.generated_digest {
            return Ok(DirectProjectionOutcome {
                state: DirectProjectionState::ConflictPreserved,
                receipt: Some(receipt),
                detail: Some("derived projection has local edits; preserved without overwrite".into()),
            });
        }
        if current_digest == generated_digest && receipt.source_revision == source_revision {
            return Ok(DirectProjectionOutcome {
                state: DirectProjectionState::Unchanged,
                receipt: Some(receipt),
                detail: None,
            });
        }
    }

    if let Some(parent) = destination.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("could not create projection directory: {error}"))?;
    }
    fs::write(destination, generated.as_bytes())
        .map_err(|error| format!("could not write derived Skill projection: {error}"))?;
    let receipt = DirectProjectionReceipt {
        schema: DIRECT_PROJECTION_SCHEMA.to_owned(),
        skill_ref: skill.skill_ref.clone(),
        source_repository: skill.source.repository.clone(),
        source_path: skill.source.path.clone(),
        source_revision: source_revision.to_owned(),
        destination: destination.to_string_lossy().into_owned(),
        generated_digest,
    };
    write_projection_receipt(&receipt_path, &receipt)?;
    Ok(DirectProjectionOutcome {
        state: if receipt_path.exists() && destination.exists() {
            // At this point both are guaranteed to exist; use the previous existence to distinguish below.
            DirectProjectionState::Updated
        } else {
            DirectProjectionState::Created
        },
        receipt: Some(receipt),
        detail: None,
    })
}

pub fn remove_direct_projection(
    skill_ref: &str,
    destination: &Path,
) -> Result<DirectProjectionOutcome, String> {
    let receipt_path = projection_receipt_path(destination);
    if !destination.exists() && !receipt_path.exists() {
        return Ok(DirectProjectionOutcome {
            state: DirectProjectionState::Unchanged,
            receipt: None,
            detail: Some("projection is already absent".into()),
        });
    }
    if !destination.exists() || !receipt_path.exists() {
        return Ok(DirectProjectionOutcome {
            state: DirectProjectionState::ConflictPreserved,
            receipt: None,
            detail: Some("projection file/receipt pair is incomplete; preserved".into()),
        });
    }
    let receipt = read_projection_receipt(&receipt_path)?;
    let current = fs::read(destination)
        .map_err(|error| format!("could not read projected Skill before removal: {error}"))?;
    if receipt.skill_ref != skill_ref || stable_digest(&current) != receipt.generated_digest {
        return Ok(DirectProjectionOutcome {
            state: DirectProjectionState::ConflictPreserved,
            receipt: Some(receipt),
            detail: Some("projection is not an unmodified O:I-owned derived copy; preserved".into()),
        });
    }
    fs::remove_file(destination)
        .map_err(|error| format!("could not remove projected Skill: {error}"))?;
    fs::remove_file(&receipt_path)
        .map_err(|error| format!("could not remove projection receipt: {error}"))?;
    Ok(DirectProjectionOutcome {
        state: DirectProjectionState::Updated,
        receipt: Some(receipt),
        detail: Some("owned derived projection removed".into()),
    })
}

fn generated_projection(
    skill: &NativeSkillReference,
    source_revision: &str,
    authoritative_content: &str,
) -> String {
    format!(
        "<!-- O:I DERIVED SKILL PROJECTION; canonical source = {}/{} @ {}; skill_ref = {}; local edits are preserved as conflicts, not promoted upstream. -->\n{}",
        skill.source.repository,
        skill.source.path,
        source_revision,
        skill.skill_ref,
        authoritative_content
    )
}

fn projection_receipt_path(destination: &Path) -> PathBuf {
    let file_name = destination
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("SKILL.md");
    destination.with_file_name(format!("{file_name}.oi-projection.json"))
}

fn write_projection_receipt(path: &Path, receipt: &DirectProjectionReceipt) -> Result<(), String> {
    let bytes = serde_json::to_vec_pretty(receipt)
        .map_err(|error| format!("could not encode projection receipt: {error}"))?;
    fs::write(path, bytes).map_err(|error| format!("could not write projection receipt: {error}"))
}

fn read_projection_receipt(path: &Path) -> Result<DirectProjectionReceipt, String> {
    let bytes = fs::read(path).map_err(|error| format!("could not read projection receipt: {error}"))?;
    let receipt: DirectProjectionReceipt = serde_json::from_slice(&bytes)
        .map_err(|error| format!("projection receipt is invalid JSON: {error}"))?;
    if receipt.schema != DIRECT_PROJECTION_SCHEMA {
        return Err(format!(
            "unsupported projection receipt schema `{}`",
            receipt.schema
        ));
    }
    Ok(receipt)
}

fn stable_digest(bytes: &[u8]) -> String {
    // FNV-1a is used only as a deterministic drift fingerprint, never as a security primitive.
    let mut hash = 0xcbf29ce484222325u64;
    for byte in bytes {
        hash ^= *byte as u64;
        hash = hash.wrapping_mul(0x100000001b3);
    }
    format!("fnv1a64:{hash:016x}")
}

fn nonempty(label: &str, value: &str) -> Result<(), String> {
    if value.trim().is_empty() {
        Err(format!("{label} must be non-empty"))
    } else {
        Ok(())
    }
}

fn unique_nonempty(label: &str, values: &[String]) -> Result<(), String> {
    let mut seen = BTreeSet::new();
    for value in values {
        nonempty(label, value)?;
        if !seen.insert(value.as_str()) {
            return Err(format!("{label} contains duplicate `{value}`"));
        }
    }
    Ok(())
}

pub fn io_error_detail(error: &io::Error) -> String {
    format!("{} ({:?})", error, error.kind())
}
