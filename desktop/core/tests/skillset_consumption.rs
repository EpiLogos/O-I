use oi_cli::skillset::{parse_manifest, AgentScope, SUITE_SKILLSET_SCHEMA};

#[test]
fn desktop_consumes_the_canonical_suite_skillset_contract() {
    let manifest = parse_manifest(include_str!(
        "../../../skills/suite-operator/skillset.json"
    ))
    .expect("canonical suite SkillSet fixture must parse through oi-cli");

    assert_eq!(manifest.schema, SUITE_SKILLSET_SCHEMA);
    let base = manifest
        .profiles
        .iter()
        .find(|profile| profile.profile_ref == "oi:skillset:base-suite-operation")
        .expect("base suite-operation profile");
    assert_eq!(base.scope, AgentScope::Ordinary);

    let root = manifest
        .profiles
        .iter()
        .find(|profile| profile.profile_ref == "oi:skillset:root-metagentic-operation")
        .expect("root/metagentic suite-operation profile");
    assert_eq!(root.scope, AgentScope::RootWorld);

    assert!(manifest.expected_native_skills.is_empty());
    assert!(manifest
        .skills
        .iter()
        .any(|skill| skill.skill_ref == "actuation:operator" && skill.owner_product == "Actuation"));
}
