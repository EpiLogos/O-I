use oi_cli::skillset::{parse_manifest, SUITE_SKILLSET_SCHEMA};

#[test]
fn desktop_consumes_the_canonical_suite_skillset_contract() {
    let manifest = parse_manifest(include_str!(
        "../../../skills/suite-operator/skillset.json"
    ))
    .expect("canonical suite SkillSet fixture must parse through oi-cli");

    assert_eq!(manifest.schema, SUITE_SKILLSET_SCHEMA);
    assert!(manifest
        .profiles
        .iter()
        .any(|profile| profile.profile_ref == "oi:skillset:base-suite-operation"));
    assert!(manifest
        .profiles
        .iter()
        .any(|profile| profile.profile_ref == "oi:skillset:root-metagentic-operation"));
}
