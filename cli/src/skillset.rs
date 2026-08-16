use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};
use std::fs;
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

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq, Default)]
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
    Removed,
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
        return Err(format!("unsupported suite SkillSet schema `{}`", manifest.schema));
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
        for (label, value) in [
            ("owner_product", skill.owner_product.as_str()),
            ("purpose", skill.purpose.as_str()),
            ("source.repository", skill.source.repository.as_str()),
            ("source.path", skill.source.path.as_str()),
            ("risk_class", skill.risk_class.as_str()),
        ] {
            nonempty(label, value)?;
        }
        match skill.source.revision_policy {
            RevisionPolicy::Pinned => {
                nonempty(
                    "source.pinned_revision",
                    skill.source.pinned_revision.as_deref().ok_or_else(|| {
                        format!("pinned skill `{}` requires pinned_revision", skill.skill_ref)
                    })?,
                )?;
            }
            RevisionPolicy::ResolveAuthoritativeInstalledRevision if skill.source.pinned_revision.is_some() => {
                return Err(format!(
                    "skill `{}` cannot both resolve installed revision and pin one",
                    skill.skill_ref
                ));
            }
            RevisionPolicy::ResolveAuthoritativeInstalledRevision => {}
        }
        unique_nonempty("required_actions", &skill.required_actions)?;
        unique_nonempty("required_capabilities", &skill.required_capabilities)?;
        unique_nonempty("permission_requirements", &skill.permission_requirements)?;
    }

    let mut profiles = BTreeSet::new();
    for profile in &manifest.profiles {
        nonempty("profile_ref", &profile.profile_ref)?;
        nonempty("profile purpose", &profile.purpose)?;
        if !profiles.insert(profile.profile_ref.as_str()) {
            return Err(format!("duplicate profile_ref `{}`", profile.profile_ref));
        }
        let mut members = BTreeSet::new();
        for member in &profile.members {
            if !skill_refs.contains(member.skill_ref.as_str()) {
                return Err(format!(
                    "profile `{}` references unknown Skill `{}`",
                    profile.profile_ref, member.skill_ref
                ));
            }
            if !members.insert(member.skill_ref.as_str()) {
                return Err(format!("profile `{}` repeats `{}`", profile.profile_ref, member.skill_ref));
            }
        }
    }
    for profile in &manifest.profiles {
        for parent in &profile.inherits {
            if !profiles.contains(parent.as_str()) {
                return Err(format!("profile `{}` inherits unknown `{parent}`", profile.profile_ref));
            }
        }
    }
    detect_profile_cycles(manifest)?;
    for expectation in &manifest.expected_native_skills {
        nonempty("expected owner_product", &expectation.owner_product)?;
        nonempty("expected purpose", &expectation.purpose)?;
        if expectation.profiles.is_empty() {
            return Err(format!("{} native Skill expectation has no profile", expectation.owner_product));
        }
        for profile in &expectation.profiles {
            if !profiles.contains(profile.as_str()) {
                return Err(format!("{} expectation names unknown profile `{profile}`", expectation.owner_product));
            }
        }
    }
    Ok(())
}

fn detect_profile_cycles(manifest: &SuiteSkillSetManifest) -> Result<(), String> {
    let index = manifest.profiles.iter().map(|p| (p.profile_ref.as_str(), p)).collect::<BTreeMap<_, _>>();
    for profile in &manifest.profiles {
        visit_profile(profile.profile_ref.as_str(), &index, &mut BTreeSet::new())?;
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
    for parent in &index.get(profile_ref).ok_or_else(|| format!("unknown profile `{profile_ref}`"))?.inherits {
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
    let profiles = manifest.profiles.iter().map(|p| (p.profile_ref.as_str(), p)).collect::<BTreeMap<_, _>>();
    let skill_index = manifest.skills.iter().map(|s| (s.skill_ref.as_str(), s)).collect::<BTreeMap<_, _>>();
    let observation_index = observations.iter().map(|o| (o.skill_ref.as_str(), o)).collect::<BTreeMap<_, _>>();
    let mut members = BTreeMap::<String, Requiredness>::new();
    collect_members(profile_ref, &profiles, &mut members)?;

    let mut degraded = false;
    let mut skills = Vec::new();
    for (skill_ref, requiredness) in members {
        let skill = skill_index.get(skill_ref.as_str()).ok_or_else(|| format!("unknown Skill `{skill_ref}`"))?;
        let observed = observation_index.get(skill_ref.as_str()).copied();
        let availability = observed.map(|o| o.availability).unwrap_or(SkillAvailability::Missing);
        if availability != SkillAvailability::Available && requiredness != Requiredness::Optional {
            degraded = true;
        }
        if let (Some(expected), Some(actual)) = (
            skill.source.pinned_revision.as_deref(),
            observed.and_then(|o| o.source_revision.as_deref()),
        ) {
            if expected != actual { degraded = true; }
        }
        skills.push(EffectiveSkillRelation {
            skill_ref: skill.skill_ref.clone(),
            owner_product: skill.owner_product.clone(),
            purpose: skill.purpose.clone(),
            requiredness,
            source_repository: skill.source.repository.clone(),
            source_path: skill.source.path.clone(),
            expected_revision: skill.source.pinned_revision.clone(),
            observed_revision: observed.and_then(|o| o.source_revision.clone()),
            availability,
            resolution_mode: mode,
            capability_states: skill.required_capabilities.iter().map(|capability| {
                (capability.clone(), authority.capability_grants.get(capability).copied().unwrap_or(CapabilityGrantState::NotEvaluated))
            }).collect(),
            action_states: skill.required_actions.iter().map(|action| {
                (action.clone(), authority.action_authorizations.get(action).copied().unwrap_or(ActionAuthorizationState::NotEvaluated))
            }).collect(),
            risk_class: skill.risk_class.clone(),
            permission_requirements: skill.permission_requirements.clone(),
        });
    }

    let expected_native_skills = manifest.expected_native_skills.iter()
        .filter(|expectation| expectation.profiles.iter().any(|profile| profile == profile_ref))
        .cloned().collect::<Vec<_>>();
    if expected_native_skills.iter().any(|expectation| expectation.requiredness == Requiredness::Required) {
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

fn collect_members(
    profile_ref: &str,
    profiles: &BTreeMap<&str, &SuiteSkillProfile>,
    output: &mut BTreeMap<String, Requiredness>,
) -> Result<(), String> {
    let profile = profiles.get(profile_ref).ok_or_else(|| format!("unknown suite SkillSet profile `{profile_ref}`"))?;
    for parent in &profile.inherits { collect_members(parent, profiles, output)?; }
    for member in &profile.members { output.insert(member.skill_ref.clone(), member.requiredness); }
    Ok(())
}

pub fn materialise_direct_projection(
    skill: &NativeSkillReference,
    source_revision: &str,
    authoritative_content: &str,
    destination: &Path,
) -> Result<DirectProjectionOutcome, String> {
    nonempty("source_revision", source_revision)?;
    if authoritative_content.is_empty() { return Err("authoritative Skill content must not be empty".into()); }
    if let Some(pinned) = skill.source.pinned_revision.as_deref() {
        if pinned != source_revision {
            return Err(format!("revision `{source_revision}` does not satisfy pinned `{pinned}`"));
        }
    }

    let existed_before = destination.exists();
    let receipt_path = projection_receipt_path(destination);
    let generated = generated_projection(skill, source_revision, authoritative_content);
    let generated_digest = stable_digest(generated.as_bytes());

    if existed_before {
        if !receipt_path.exists() {
            return Ok(conflict(None, format!("{} is user/local-owned; no O:I receipt", destination.display())));
        }
        let receipt = read_receipt(&receipt_path)?;
        if receipt.skill_ref != skill.skill_ref || receipt.destination != destination.to_string_lossy() {
            return Ok(conflict(Some(receipt), "receipt belongs to another projection"));
        }
        let current = fs::read(destination).map_err(|error| format!("read projection: {error}"))?;
        let current_digest = stable_digest(&current);
        if current_digest != receipt.generated_digest {
            return Ok(conflict(Some(receipt), "derived copy has local edits; preserving it"));
        }
        if current_digest == generated_digest && receipt.source_revision == source_revision {
            return Ok(DirectProjectionOutcome { state: DirectProjectionState::Unchanged, receipt: Some(receipt), detail: None });
        }
    }

    if let Some(parent) = destination.parent() {
        fs::create_dir_all(parent).map_err(|error| format!("create projection directory: {error}"))?;
    }
    fs::write(destination, generated.as_bytes()).map_err(|error| format!("write projection: {error}"))?;
    let receipt = DirectProjectionReceipt {
        schema: DIRECT_PROJECTION_SCHEMA.to_owned(),
        skill_ref: skill.skill_ref.clone(),
        source_repository: skill.source.repository.clone(),
        source_path: skill.source.path.clone(),
        source_revision: source_revision.to_owned(),
        destination: destination.to_string_lossy().into_owned(),
        generated_digest,
    };
    write_receipt(&receipt_path, &receipt)?;
    Ok(DirectProjectionOutcome {
        state: if existed_before { DirectProjectionState::Updated } else { DirectProjectionState::Created },
        receipt: Some(receipt),
        detail: None,
    })
}

pub fn remove_direct_projection(skill_ref: &str, destination: &Path) -> Result<DirectProjectionOutcome, String> {
    let receipt_path = projection_receipt_path(destination);
    if !destination.exists() && !receipt_path.exists() {
        return Ok(DirectProjectionOutcome { state: DirectProjectionState::Unchanged, receipt: None, detail: Some("already absent".into()) });
    }
    if !destination.exists() || !receipt_path.exists() {
        return Ok(conflict(None, "projection file/receipt pair incomplete; preserving remaining state"));
    }
    let receipt = read_receipt(&receipt_path)?;
    let current = fs::read(destination).map_err(|error| format!("read projection before removal: {error}"))?;
    if receipt.skill_ref != skill_ref || stable_digest(&current) != receipt.generated_digest {
        return Ok(conflict(Some(receipt), "not an unmodified O:I-owned derived copy; preserving it"));
    }
    fs::remove_file(destination).map_err(|error| format!("remove projection: {error}"))?;
    fs::remove_file(&receipt_path).map_err(|error| format!("remove receipt: {error}"))?;
    Ok(DirectProjectionOutcome { state: DirectProjectionState::Removed, receipt: Some(receipt), detail: None })
}

fn generated_projection(skill: &NativeSkillReference, revision: &str, body: &str) -> String {
    format!(
        "<!-- O:I DERIVED SKILL PROJECTION; canonical source = {}/{} @ {}; skill_ref = {}; local edits never become authoritative. -->\n{}",
        skill.source.repository, skill.source.path, revision, skill.skill_ref, body
    )
}

fn projection_receipt_path(destination: &Path) -> PathBuf {
    let file_name = destination.file_name().and_then(|value| value.to_str()).unwrap_or("SKILL.md");
    destination.with_file_name(format!("{file_name}.oi-projection.json"))
}

fn write_receipt(path: &Path, receipt: &DirectProjectionReceipt) -> Result<(), String> {
    let bytes = serde_json::to_vec_pretty(receipt).map_err(|error| format!("encode receipt: {error}"))?;
    fs::write(path, bytes).map_err(|error| format!("write receipt: {error}"))
}

fn read_receipt(path: &Path) -> Result<DirectProjectionReceipt, String> {
    let receipt: DirectProjectionReceipt = serde_json::from_slice(&fs::read(path).map_err(|error| format!("read receipt: {error}"))?)
        .map_err(|error| format!("invalid projection receipt: {error}"))?;
    if receipt.schema != DIRECT_PROJECTION_SCHEMA { return Err(format!("unsupported projection receipt schema `{}`", receipt.schema)); }
    Ok(receipt)
}

fn conflict(receipt: Option<DirectProjectionReceipt>, detail: impl Into<String>) -> DirectProjectionOutcome {
    DirectProjectionOutcome { state: DirectProjectionState::ConflictPreserved, receipt, detail: Some(detail.into()) }
}

fn stable_digest(bytes: &[u8]) -> String {
    // Deterministic drift fingerprint only; this is not a security primitive.
    let mut hash = 0xcbf29ce484222325u64;
    for byte in bytes { hash ^= *byte as u64; hash = hash.wrapping_mul(0x100000001b3); }
    format!("fnv1a64:{hash:016x}")
}

fn nonempty(label: &str, value: &str) -> Result<(), String> {
    if value.trim().is_empty() { Err(format!("{label} must be non-empty")) } else { Ok(()) }
}

fn unique_nonempty(label: &str, values: &[String]) -> Result<(), String> {
    let mut seen = BTreeSet::new();
    for value in values {
        nonempty(label, value)?;
        if !seen.insert(value.as_str()) { return Err(format!("{label} contains duplicate `{value}`")); }
    }
    Ok(())
}
