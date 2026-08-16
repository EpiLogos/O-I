use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct SuiteSkillSetManifest {
    pub schema: String,
    pub skills: Vec<AuthoritativeSkillRef>,
    pub profiles: Vec<SkillProfile>,
    #[serde(default)]
    pub expected_native_skills: Vec<ExpectedNativeSkill>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct AuthoritativeSkillRef {
    pub skill_ref: String,
    pub native_owner: String,
    pub source: SkillSource,
    #[serde(default)]
    pub required_capability_refs: Vec<String>,
    #[serde(default)]
    pub related_action_refs: Vec<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct SkillSource {
    pub repository: String,
    pub revision: String,
    pub path: String,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct SkillProfile {
    pub profile_ref: String,
    pub scope: AgentScope,
    pub skill_refs: Vec<String>,
}

/// Projection eligibility only. This is not an Agent kind: RootWorld must be
/// supplied from an Actuation positional WorldBinding/root determination.
#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AgentScope {
    Ordinary,
    RootWorld,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct ExpectedNativeSkill {
    pub native_owner: String,
    pub purpose: String,
    pub profile_refs: Vec<String>,
    /// When true, an installed owner without this product-owned Skill makes the
    /// effective suite profile explicitly degraded rather than silently capable.
    pub required_when_installed: bool,
    pub state: NativeSkillPublicationState,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum NativeSkillPublicationState {
    AwaitingNativePublication,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SkillProjectionMode {
    AikitResolved,
    DirectDerived,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct EffectiveSkill {
    pub skill_ref: String,
    pub native_owner: String,
    pub source: SkillSource,
    pub available: bool,
    #[serde(default)]
    pub required_capability_refs: Vec<String>,
    #[serde(default)]
    pub related_action_refs: Vec<String>,
    /// Deliberately empty at SkillSet resolution time. Skill availability is not
    /// a Capability grant and does not authorize Actions.
    #[serde(default)]
    pub capability_grant_refs: Vec<String>,
    #[serde(default)]
    pub action_authority_refs: Vec<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct EffectiveSkillSet {
    pub schema: String,
    pub profile_ref: String,
    pub projection_mode: SkillProjectionMode,
    pub skills: Vec<EffectiveSkill>,
    #[serde(default)]
    pub expected_native_skills: Vec<ExpectedNativeSkill>,
    pub degraded: bool,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct DirectProjectionReceipt {
    pub schema: String,
    pub skill_ref: String,
    pub native_owner: String,
    pub source_repository: String,
    pub source_path: String,
    pub source_revision: String,
    pub target: PathBuf,
    pub projection_mode: SkillProjectionMode,
    /// Deterministic drift fingerprint only; this is not a trust/security digest.
    pub generated_digest: String,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum DirectProjectionUpdate {
    Created,
    Updated,
    Unchanged,
}

pub fn resolve_skillset(
    manifest: &SuiteSkillSetManifest,
    requested_profile: &str,
    actor_scope: AgentScope,
    available_owners: &BTreeSet<String>,
    aikit_available: bool,
) -> Result<EffectiveSkillSet, String> {
    if manifest.schema != "oi.suite-skillset/v1" {
        return Err(format!("unsupported suite SkillSet schema `{}`", manifest.schema));
    }
    let profile = manifest
        .profiles
        .iter()
        .find(|profile| profile.profile_ref == requested_profile)
        .ok_or_else(|| format!("unknown suite SkillSet profile `{requested_profile}`"))?;
    if profile.scope == AgentScope::RootWorld && actor_scope != AgentScope::RootWorld {
        return Err("ordinary Agency cannot receive the Root/metagentic SkillSet profile".into());
    }

    let skills = profile
        .skill_refs
        .iter()
        .map(|skill_ref| {
            let skill = manifest
                .skills
                .iter()
                .find(|candidate| &candidate.skill_ref == skill_ref)
                .ok_or_else(|| format!("profile references unknown Skill `{skill_ref}`"))?;
            Ok(EffectiveSkill {
                skill_ref: skill.skill_ref.clone(),
                native_owner: skill.native_owner.clone(),
                source: skill.source.clone(),
                available: available_owners.contains(&skill.native_owner),
                required_capability_refs: skill.required_capability_refs.clone(),
                related_action_refs: skill.related_action_refs.clone(),
                capability_grant_refs: Vec::new(),
                action_authority_refs: Vec::new(),
            })
        })
        .collect::<Result<Vec<_>, String>>()?;

    let expected_native_skills = manifest
        .expected_native_skills
        .iter()
        .filter(|expected| expected.profile_refs.iter().any(|profile_ref| profile_ref == requested_profile))
        .cloned()
        .collect::<Vec<_>>();
    let missing_required_native_skill = expected_native_skills.iter().any(|expected| {
        expected.required_when_installed && available_owners.contains(&expected.native_owner)
    });
    let missing_profile_skill = skills.iter().any(|skill| !skill.available);

    Ok(EffectiveSkillSet {
        schema: "oi.effective-skillset/v1".into(),
        profile_ref: profile.profile_ref.clone(),
        projection_mode: if aikit_available {
            SkillProjectionMode::AikitResolved
        } else {
            SkillProjectionMode::DirectDerived
        },
        skills,
        expected_native_skills,
        degraded: missing_profile_skill || missing_required_native_skill,
    })
}

/// Minimal no-AIKit fallback. It can only derive O:I/Central Skill bodies that
/// the caller has already resolved from their authoritative product source.
/// It never grants a Capability or Action authority. A source update can replace
/// an untouched O:I-derived projection, but local/user edits are preserved.
pub fn write_direct_projection(
    root: &Path,
    skill: &EffectiveSkill,
    authoritative_body: &str,
) -> Result<DirectProjectionReceipt, String> {
    write_direct_projection_with_state(root, skill, authoritative_body).map(|(_, receipt)| receipt)
}

pub fn write_direct_projection_with_state(
    root: &Path,
    skill: &EffectiveSkill,
    authoritative_body: &str,
) -> Result<(DirectProjectionUpdate, DirectProjectionReceipt), String> {
    if !matches!(skill.native_owner.as_str(), "oi" | "central") {
        return Err("direct fallback is limited to the O:I/Central-only path".into());
    }
    if !skill.available {
        return Err(format!("authoritative Skill `{}` is unavailable", skill.skill_ref));
    }
    if !skill.capability_grant_refs.is_empty() || !skill.action_authority_refs.is_empty() {
        return Err("direct Skill projection cannot carry authority grants".into());
    }
    if authoritative_body.is_empty() {
        return Err("authoritative Skill body must not be empty".into());
    }

    fs::create_dir_all(root)
        .map_err(|error| format!("cannot create derived Skill directory: {error}"))?;
    let slug = skill
        .skill_ref
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || character == '-' {
                character
            } else {
                '_'
            }
        })
        .collect::<String>();
    let target = root.join(format!("{slug}.md"));
    let receipt_target = projection_receipt_path(&target);
    let body = format!(
        "<!-- oi-derived-skill/v1 skill_ref={} owner={} revision={} source={}/{} -->\n{}",
        skill.skill_ref,
        skill.native_owner,
        skill.source.revision,
        skill.source.repository,
        skill.source.path,
        authoritative_body
    );
    let generated_digest = stable_digest(body.as_bytes());

    let update = if target.exists() {
        if !receipt_target.exists() {
            return Err(format!(
                "refusing to overwrite local/non-derived Skill target {}: no O:I projection receipt",
                target.display()
            ));
        }
        let previous = read_projection_receipt(&receipt_target)?;
        if previous.skill_ref != skill.skill_ref || previous.target != target {
            return Err(format!(
                "refusing to overwrite {}: projection receipt belongs to another Skill/target",
                target.display()
            ));
        }
        let existing = fs::read(&target)
            .map_err(|error| format!("cannot read existing projection: {error}"))?;
        if stable_digest(&existing) != previous.generated_digest {
            return Err(format!(
                "refusing to overwrite locally edited derived Skill target {}",
                target.display()
            ));
        }
        if previous.generated_digest == generated_digest
            && previous.source_revision == skill.source.revision
        {
            return Ok((DirectProjectionUpdate::Unchanged, previous));
        }
        DirectProjectionUpdate::Updated
    } else {
        if receipt_target.exists() {
            return Err(format!(
                "refusing to recreate {} while an orphaned O:I projection receipt exists",
                target.display()
            ));
        }
        DirectProjectionUpdate::Created
    };

    fs::write(&target, body)
        .map_err(|error| format!("cannot write derived Skill projection: {error}"))?;
    let receipt = DirectProjectionReceipt {
        schema: "oi.direct-skill-projection-receipt/v1".into(),
        skill_ref: skill.skill_ref.clone(),
        native_owner: skill.native_owner.clone(),
        source_repository: skill.source.repository.clone(),
        source_path: skill.source.path.clone(),
        source_revision: skill.source.revision.clone(),
        target,
        projection_mode: SkillProjectionMode::DirectDerived,
        generated_digest,
    };
    write_projection_receipt(&receipt_target, &receipt)?;
    Ok((update, receipt))
}

pub fn remove_direct_projection(skill_ref: &str, target: &Path) -> Result<(), String> {
    let receipt_target = projection_receipt_path(target);
    if !target.exists() && !receipt_target.exists() {
        return Ok(());
    }
    if !target.exists() || !receipt_target.exists() {
        return Err("refusing partial projection cleanup: file/receipt pair is incomplete".into());
    }
    let receipt = read_projection_receipt(&receipt_target)?;
    if receipt.skill_ref != skill_ref || receipt.target != target {
        return Err("refusing projection cleanup: receipt belongs to another Skill/target".into());
    }
    let existing = fs::read(target).map_err(|error| format!("cannot read projected Skill: {error}"))?;
    if stable_digest(&existing) != receipt.generated_digest {
        return Err("refusing projection cleanup: derived Skill has local edits".into());
    }
    fs::remove_file(target).map_err(|error| format!("cannot remove projected Skill: {error}"))?;
    fs::remove_file(receipt_target).map_err(|error| format!("cannot remove projection receipt: {error}"))?;
    Ok(())
}

fn projection_receipt_path(target: &Path) -> PathBuf {
    let file_name = target.file_name().and_then(|value| value.to_str()).unwrap_or("SKILL.md");
    target.with_file_name(format!("{file_name}.oi-projection.json"))
}

fn write_projection_receipt(path: &Path, receipt: &DirectProjectionReceipt) -> Result<(), String> {
    let encoded = serde_json::to_vec_pretty(receipt)
        .map_err(|error| format!("cannot encode projection receipt: {error}"))?;
    fs::write(path, encoded).map_err(|error| format!("cannot write projection receipt: {error}"))
}

fn read_projection_receipt(path: &Path) -> Result<DirectProjectionReceipt, String> {
    let encoded = fs::read(path).map_err(|error| format!("cannot read projection receipt: {error}"))?;
    let receipt: DirectProjectionReceipt = serde_json::from_slice(&encoded)
        .map_err(|error| format!("invalid projection receipt: {error}"))?;
    if receipt.schema != "oi.direct-skill-projection-receipt/v1" {
        return Err(format!("unsupported projection receipt schema `{}`", receipt.schema));
    }
    Ok(receipt)
}

fn stable_digest(bytes: &[u8]) -> String {
    // FNV-1a is used only as a deterministic local drift fingerprint.
    let mut hash = 0xcbf29ce484222325u64;
    for byte in bytes {
        hash ^= *byte as u64;
        hash = hash.wrapping_mul(0x100000001b3);
    }
    format!("fnv1a64:{hash:016x}")
}
