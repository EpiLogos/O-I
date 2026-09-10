//! Controlled native profile -> source -> projection -> body readback proof.
//! These are D tests of the shipped functions, not P/M harness-loaded claims.
use oi_cli::guardian::{
    project_guardian_skillset, GUARDIAN_HARNESS_SKILL_ROOTS, GUARDIAN_SKILL_SOURCES,
    SUITE_SKILLSET_MANIFEST_TOML,
};
use oi_cli::skillset::{
    parse_manifest, resolve_profile, AgentScope, AuthorityObservation, SkillAvailability,
    SkillObservation, SkillResolutionMode, SuiteSkillSetManifest, DERIVED_PROJECTION_MARKER,
};
use sha2::{Digest, Sha256};
use std::collections::BTreeSet;
use std::fs;
use std::path::Path;
use tempfile::tempdir;

const GOVERNANCE_SHA: &str = "7aa3005900612ee79323bf61b466ed25e36ee5427649b1b53953a8a53983cd61";
const ROLES: &[&str] = &["oi:skillset:coding", "oi:skillset:verifier"];
const OPERATOR: &str = "oi:skill:suite-operator";

fn manifest() -> SuiteSkillSetManifest {
    // Ordinary native manifest composition, not a second resolver or registry.
    parse_manifest(&format!(
        "{}\n{}",
        SUITE_SKILLSET_MANIFEST_TOML,
        include_str!("../../skills/suite-operator/caw-profiles.toml")
    ))
    .unwrap()
}

fn observations() -> Vec<SkillObservation> {
    manifest()
        .skills
        .iter()
        .map(|skill| SkillObservation {
            skill_ref: skill.skill_ref.clone(),
            availability: SkillAvailability::Available,
            source_revision: Some("controlled-native-source-cut".into()),
            native_version: None,
        })
        .collect()
}

fn read_governance(text: &str) -> Result<&str, String> {
    let start = "<!-- caw-governance-source:start -->\n";
    let end = "<!-- caw-governance-source:end -->";
    if text.matches(start).count() != 1 || text.matches(end).count() != 1 {
        return Err("missing or duplicated governance payload".into());
    }
    let body = text.split_once(start).unwrap().1.split_once(end).unwrap().0;
    if format!("{:x}", Sha256::digest(body.as_bytes())) != GOVERNANCE_SHA {
        return Err("governance body differs from exact authored S4 source".into());
    }
    Ok(body)
}

fn readback(ground: &Path) -> Result<(), String> {
    for harness in GUARDIAN_HARNESS_SKILL_ROOTS {
        let target = ground.join(harness).join("oi-suite-operator/SKILL.md");
        let text = fs::read_to_string(&target).map_err(|e| e.to_string())?;
        read_governance(&text)?;
        if !text.contains(DERIVED_PROJECTION_MARKER) {
            return Err("body lacks the native projection provenance".into());
        }
    }
    Ok(())
}

fn receive_role(
    role: &str,
    source: &SuiteSkillSetManifest,
    available: &[SkillObservation],
    ground: &Path,
) -> Result<(), String> {
    let effective = resolve_profile(
        source,
        role,
        AgentScope::Ordinary,
        available,
        &BTreeSet::from(["O:I".to_owned()]),
        &AuthorityObservation::default(),
        SkillResolutionMode::OiDirectProjection,
    )?;
    if effective.degraded
        || !effective
            .skills
            .iter()
            .any(|s| s.skill_ref == OPERATOR && s.availability == SkillAvailability::Available)
    {
        return Err("required operative governance unavailable to selected role".into());
    }
    assert_eq!(effective.scope, AgentScope::Ordinary);
    // The same native bootstrap that ships into real harness trees performs
    // this write. No test-generated replacement Skill or stub receipt.
    let report = project_guardian_skillset(ground, "controlled-native-source-cut")?;
    if report.degraded || report.conflicts().next().is_some() {
        return Err("native projection degraded or conflict-preserved".into());
    }
    readback(ground)
}

#[test]
fn exact_sixfold_source_is_embedded_in_the_shipped_operator() {
    let source = GUARDIAN_SKILL_SOURCES
        .iter()
        .find(|(p, _)| *p == "skills/suite-operator/SKILL.md")
        .unwrap()
        .1;
    let body = read_governance(source).unwrap();
    assert!(body.contains("**Standing:** Draft for human validation."));
    for i in 0..=5 {
        assert!(body.contains(&format!("## {i} —")));
    }
}

#[test]
fn coding_and_verifier_native_profiles_receive_complete_governance_in_both_harness_trees() {
    for role in ROLES {
        let ground = tempdir().unwrap();
        receive_role(role, &manifest(), &observations(), ground.path()).unwrap();
        assert!(!ground.path().join("Control").exists());
    }
}

#[test]
fn disconnect_profile_membership_fails_even_with_available_source() {
    let mut source = manifest();
    let base = source
        .profiles
        .iter_mut()
        .find(|p| p.profile_ref == "oi:skillset:base-guardian")
        .unwrap();
    base.members.retain(|member| member.skill_ref != OPERATOR);
    for role in ROLES {
        let ground = tempdir().unwrap();
        assert!(receive_role(role, &source, &observations(), ground.path()).is_err());
        assert!(!ground.path().join(".agents").exists());
    }
}

#[test]
fn missing_required_source_is_not_an_effective_role() {
    let mut available = observations();
    available.retain(|s| s.skill_ref != OPERATOR);
    for role in ROLES {
        let ground = tempdir().unwrap();
        assert!(receive_role(role, &manifest(), &available, ground.path()).is_err());
    }
}

#[test]
fn disconnect_materialisation_fails_despite_valid_resolution_and_receipts() {
    let ground = tempdir().unwrap();
    receive_role(ROLES[0], &manifest(), &observations(), ground.path()).unwrap();
    fs::remove_file(ground.path().join(".agents/skills/oi-suite-operator/SKILL.md")).unwrap();
    assert!(readback(ground.path()).is_err());
}

#[test]
fn altered_governance_payload_fails_without_overwriting_local_authorship() {
    let ground = tempdir().unwrap();
    receive_role(ROLES[1], &manifest(), &observations(), ground.path()).unwrap();
    let path = ground.path().join(".claude/skills/oi-suite-operator/SKILL.md");
    let authored = "# local edit; deliberately not adopted source\n";
    fs::write(&path, authored).unwrap();
    assert!(receive_role(ROLES[1], &manifest(), &observations(), ground.path()).is_err());
    assert_eq!(fs::read_to_string(path).unwrap(), authored);
}

#[test]
fn replay_preserves_the_exact_loaded_projection_bytes() {
    let ground = tempdir().unwrap();
    receive_role(ROLES[0], &manifest(), &observations(), ground.path()).unwrap();
    let path = ground.path().join(".agents/skills/oi-suite-operator/SKILL.md");
    let before = fs::read(&path).unwrap();
    receive_role(ROLES[0], &manifest(), &observations(), ground.path()).unwrap();
    assert_eq!(before, fs::read(path).unwrap());
}
