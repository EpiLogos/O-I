use oi_cli::skillset::{
    materialise_direct_projection, parse_manifest, resolve_profile, AgentScope,
    AuthorityObservation, SkillAvailability, SkillObservation, SkillResolutionMode,
};
use std::collections::BTreeSet;
use std::fs;

const MANIFEST: &str = include_str!("../../skills/suite-operator/skillset.json");

fn installed_products() -> BTreeSet<String> {
    [
        "O:I",
        "Central",
        "AIKit",
        "Actuation",
        "Software Factory",
        "Workcell",
        "Quaternal Logic",
    ]
    .into_iter()
    .map(str::to_owned)
    .collect()
}

fn all_available() -> Vec<SkillObservation> {
    let manifest = parse_manifest(MANIFEST).expect("manifest");
    manifest
        .skills
        .into_iter()
        .map(|skill| SkillObservation {
            skill_ref: skill.skill_ref,
            availability: SkillAvailability::Available,
            source_revision: Some(
                skill
                    .source
                    .pinned_revision
                    .unwrap_or_else(|| "oi-current-head".into()),
            ),
            native_version: skill.source.native_version,
        })
        .collect()
}

#[test]
fn full_suite_root_read_model_contains_every_native_owner_without_authority_collapse() {
    let manifest = parse_manifest(MANIFEST).expect("manifest");
    assert!(manifest.expected_native_skills.is_empty());

    let effective = resolve_profile(
        &manifest,
        "oi:skillset:root-metagentic-operation",
        AgentScope::RootWorld,
        &all_available(),
        &installed_products(),
        &AuthorityObservation::default(),
        SkillResolutionMode::AikitDynamic,
    )
    .expect("root read model");

    assert!(!effective.degraded);
    assert!(effective.expected_native_skills.is_empty());
    let owners = effective
        .skills
        .iter()
        .map(|skill| skill.owner_product.as_str())
        .collect::<BTreeSet<_>>();
    for owner in [
        "O:I",
        "Central",
        "AIKit",
        "Actuation",
        "Software Factory",
        "Workcell",
        "Quaternal Logic",
    ] {
        assert!(owners.contains(owner), "missing owner {owner}");
    }
    for skill in &effective.skills {
        assert!(!skill.source_repository.is_empty());
        assert!(!skill.source_path.is_empty());
        if let Some(expected) = &skill.expected_revision {
            assert_eq!(Some(expected), skill.observed_revision.as_ref());
        }
        assert!(skill.capability_states.is_empty());
        assert!(skill.action_states.is_empty());
    }
}

#[test]
fn ordinary_worker_cannot_select_root_profile_even_when_the_skills_exist() {
    let manifest = parse_manifest(MANIFEST).expect("manifest");
    let error = resolve_profile(
        &manifest,
        "oi:skillset:root-metagentic-operation",
        AgentScope::Ordinary,
        &all_available(),
        &installed_products(),
        &AuthorityObservation::default(),
        SkillResolutionMode::AikitDynamic,
    )
    .expect_err("ordinary Agency must not receive Root profile");
    assert!(error.contains("ordinary Agency"));
}

#[test]
fn pinned_native_skill_revision_drift_degrades_instead_of_silent_replacement() {
    let manifest = parse_manifest(MANIFEST).expect("manifest");
    let mut observations = all_available();
    let workcell = observations
        .iter_mut()
        .find(|item| item.skill_ref == "workcell:operator")
        .expect("workcell observation");
    workcell.source_revision = Some("different-revision".into());

    let effective = resolve_profile(
        &manifest,
        "oi:skillset:base-suite-operation",
        AgentScope::Ordinary,
        &observations,
        &installed_products(),
        &AuthorityObservation::default(),
        SkillResolutionMode::AikitDynamic,
    )
    .expect("base read model");
    assert!(effective.degraded);
    let relation = effective
        .skills
        .iter()
        .find(|item| item.skill_ref == "workcell:operator")
        .expect("workcell relation");
    assert_ne!(relation.expected_revision, relation.observed_revision);
}

#[test]
fn direct_projection_fallback_rejects_foreign_native_skill_bodies() {
    let manifest = parse_manifest(MANIFEST).expect("manifest");
    let foreign = manifest
        .skills
        .iter()
        .find(|skill| skill.skill_ref == "actuation:operator")
        .expect("actuation Skill");
    let temp = tempfile::tempdir().expect("tempdir");
    let destination = temp.path().join("SKILL.md");
    let error = materialise_direct_projection(
        foreign,
        foreign.source.pinned_revision.as_deref().unwrap(),
        "authoritative foreign body",
        &destination,
    )
    .expect_err("O:I must not directly project foreign native Skills");
    assert!(error.contains("O:I/Central-only"));
    assert!(!destination.exists());
}

#[test]
fn direct_projection_preserves_local_edits_to_an_oi_derived_copy() {
    let manifest = parse_manifest(MANIFEST).expect("manifest");
    let oi = manifest
        .skills
        .iter()
        .find(|skill| skill.skill_ref == "oi:skill:suite-operator")
        .expect("O:I Skill");
    let temp = tempfile::tempdir().expect("tempdir");
    let destination = temp.path().join("SKILL.md");
    let first = materialise_direct_projection(oi, "oi-current-head", "source-v1", &destination)
        .expect("first projection");
    assert!(first.receipt.is_some());
    fs::write(&destination, "local edit").expect("edit projection");
    let second = materialise_direct_projection(oi, "oi-current-head-2", "source-v2", &destination)
        .expect("conflict outcome");
    assert!(second.detail.as_deref().unwrap_or_default().contains("local edits"));
    assert_eq!(fs::read_to_string(&destination).unwrap(), "local edit");
}
