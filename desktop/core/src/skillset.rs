use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct SuiteSkillSetManifest {
    pub schema: String,
    pub skills: Vec<AuthoritativeSkillRef>,
    pub profiles: Vec<SkillProfile>,
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

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AgentScope {
    Ordinary,
    RootWorld,
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
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct DirectProjectionReceipt {
    pub schema: String,
    pub skill_ref: String,
    pub native_owner: String,
    pub source_revision: String,
    pub target: PathBuf,
    pub projection_mode: SkillProjectionMode,
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

    Ok(EffectiveSkillSet {
        schema: "oi.effective-skillset/v1".into(),
        profile_ref: profile.profile_ref.clone(),
        projection_mode: if aikit_available {
            SkillProjectionMode::AikitResolved
        } else {
            SkillProjectionMode::DirectDerived
        },
        skills,
    })
}

/// Minimal no-AIKit fallback. It can only derive O:I/Central Skill bodies that
/// the caller has already resolved from their authoritative product source.
/// It never grants a Capability or Action authority and refuses to overwrite a
/// non-derived target.
pub fn write_direct_projection(
    root: &Path,
    skill: &EffectiveSkill,
    authoritative_body: &str,
) -> Result<DirectProjectionReceipt, String> {
    if !matches!(skill.native_owner.as_str(), "oi" | "central") {
        return Err("direct fallback is limited to the O:I/Central-only path".into());
    }
    if !skill.available {
        return Err(format!("authoritative Skill `{}` is unavailable", skill.skill_ref));
    }
    if !skill.capability_grant_refs.is_empty() || !skill.action_authority_refs.is_empty() {
        return Err("direct Skill projection cannot carry authority grants".into());
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
    if target.exists() {
        let existing = fs::read_to_string(&target)
            .map_err(|error| format!("cannot read existing projection: {error}"))?;
        if !existing.starts_with("<!-- oi-derived-skill/v1") {
            return Err(format!(
                "refusing to overwrite non-derived Skill target {}",
                target.display()
            ));
        }
    }

    let body = format!(
        "<!-- oi-derived-skill/v1 skill_ref={} owner={} revision={} -->\n{}",
        skill.skill_ref, skill.native_owner, skill.source.revision, authoritative_body
    );
    fs::write(&target, body)
        .map_err(|error| format!("cannot write derived Skill projection: {error}"))?;

    Ok(DirectProjectionReceipt {
        schema: "oi.direct-skill-projection-receipt/v1".into(),
        skill_ref: skill.skill_ref.clone(),
        native_owner: skill.native_owner.clone(),
        source_revision: skill.source.revision.clone(),
        target,
        projection_mode: SkillProjectionMode::DirectDerived,
    })
}
