use oi_cli::skillset::{
    materialise_direct_projection, parse_manifest, remove_direct_projection, resolve_profile,
    ActionAuthorizationState, AgentScope, AuthorityObservation, CapabilityGrantState,
    DirectProjectionState, NativeSkillReference, Requiredness, SkillAvailability, SkillObservation,
    SkillResolutionMode, SuiteSkillSetManifest,
};
use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use tempfile::tempdir;

fn canonical_manifest() -> SuiteSkillSetManifest {
    parse_manifest(include_str!("../../skills/suite-operator/skillset.json")).unwrap()
}

fn observation(skill_ref: &str, revision: &str) -> SkillObservation {
    SkillObservation {
        skill_ref: skill_ref.to_owned(),
        availability: SkillAvailability::Available,
        source_revision: Some(revision.to_owned()),
        native_version: None,
    }
}

fn oi_central_observations() -> Vec<SkillObservation> {
    vec![
        observation("oi:skill:suite-operator", "oi-rev-1"),
        observation("oi:skill:operate-suite", "oi-rev-1"),
        observation(
            "central:skill:control-maintenance",
            "b134142532602a9570f2deb1060a1badb8432c6d",
        ),
        observation(
            "central:skill:machine-declaration",
            "b134142532602a9570f2deb1060a1badb8432c6d",
        ),
        observation(
            "central:skill:connector-authoring",
            "b134142532602a9570f2deb1060a1badb8432c6d",
        ),
        observation(
            "central:skill:connector-hardening",
            "b134142532602a9570f2deb1060a1badb8432c6d",
        ),
    ]
}

fn installed(products: &[&str]) -> BTreeSet<String> {
    products
        .iter()
        .map(|product| (*product).to_owned())
        .collect()
}

fn skill<'a>(manifest: &'a SuiteSkillSetManifest, skill_ref: &str) -> &'a NativeSkillReference {
    manifest
        .skills
        .iter()
        .find(|skill| skill.skill_ref == skill_ref)
        .unwrap()
}

#[test]
fn ordinary_agency_cannot_receive_root_metagentic_profile() {
    let manifest = canonical_manifest();
    let result = resolve_profile(
        &manifest,
        "oi:skillset:root-metagentic-operation",
        AgentScope::Ordinary,
        &oi_central_observations(),
        &installed(&["O:I", "Central"]),
        &AuthorityObservation::default(),
        SkillResolutionMode::AikitDynamic,
    );
    assert!(result.is_err());
}

#[test]
fn root_profile_is_only_projected_after_positional_scope_is_supplied() {
    let manifest = canonical_manifest();
    let effective = resolve_profile(
        &manifest,
        "oi:skillset:root-metagentic-operation",
        AgentScope::RootWorld,
        &oi_central_observations(),
        &installed(&["O:I", "Central"]),
        &AuthorityObservation::default(),
        SkillResolutionMode::AikitDynamic,
    )
    .unwrap();
    assert_eq!(effective.scope, AgentScope::RootWorld);
    assert!(effective
        .skills
        .iter()
        .any(|skill| skill.skill_ref == "central:skill:connector-authoring"));
}

#[test]
fn oi_and_central_without_aikit_have_legal_direct_projection_path() {
    let manifest = canonical_manifest();
    let effective = resolve_profile(
        &manifest,
        "oi:skillset:base-suite-operation",
        AgentScope::Ordinary,
        &oi_central_observations(),
        &installed(&["O:I", "Central"]),
        &AuthorityObservation::default(),
        SkillResolutionMode::OiDirectProjection,
    )
    .unwrap();
    assert!(!effective.degraded);
    assert_eq!(
        effective.resolution_mode,
        SkillResolutionMode::OiDirectProjection
    );

    let dir = tempdir().unwrap();
    let destination = dir.path().join("oi/SKILL.md");
    let outcome = materialise_direct_projection(
        skill(&manifest, "oi:skill:suite-operator"),
        "oi-rev-1",
        "# authoritative O:I Skill\n",
        &destination,
    )
    .unwrap();
    assert_eq!(outcome.state, DirectProjectionState::Created);
    let projected = fs::read_to_string(&destination).unwrap();
    assert!(projected.contains("O:I DERIVED SKILL PROJECTION"));
    assert!(projected
        .contains("canonical source = EpiLogos/O-I/skills/suite-operator/SKILL.md @ oi-rev-1"));
}

#[test]
fn non_oi_central_skill_cannot_use_direct_projection_fallback() {
    let mut manifest = canonical_manifest();
    let native = manifest
        .skills
        .iter_mut()
        .find(|skill| skill.skill_ref == "oi:skill:suite-operator")
        .unwrap();
    native.owner_product = "Workcell".into();
    let dir = tempdir().unwrap();
    assert!(materialise_direct_projection(
        native,
        "revision",
        "# body\n",
        &dir.path().join("SKILL.md")
    )
    .is_err());
}

#[test]
fn aikit_dynamic_resolution_uses_native_references_not_copied_skill_bodies() {
    let manifest = canonical_manifest();
    let effective = resolve_profile(
        &manifest,
        "oi:skillset:base-suite-operation",
        AgentScope::Ordinary,
        &oi_central_observations(),
        &installed(&["O:I", "Central", "AIKit"]),
        &AuthorityObservation::default(),
        SkillResolutionMode::AikitDynamic,
    )
    .unwrap();
    assert_eq!(effective.resolution_mode, SkillResolutionMode::AikitDynamic);
    assert!(effective.skills.iter().all(
        |skill| !skill.source_repository.is_empty() && skill.source_path.ends_with("SKILL.md")
    ));
    let manifest_text = include_str!("../../skills/suite-operator/skillset.json");
    assert!(!manifest_text.contains("## Native Skill ownership and gaps"));
}

#[test]
fn installed_product_without_native_skill_is_disclosed_as_gap_not_fake_competence() {
    let manifest = canonical_manifest();
    let effective = resolve_profile(
        &manifest,
        "oi:skillset:root-metagentic-operation",
        AgentScope::RootWorld,
        &oi_central_observations(),
        &installed(&["O:I", "Central", "Actuation"]),
        &AuthorityObservation::default(),
        SkillResolutionMode::AikitDynamic,
    )
    .unwrap();
    assert!(effective.degraded);
    let actuation = effective
        .expected_native_skills
        .iter()
        .find(|gap| gap.owner_product == "Actuation")
        .unwrap();
    assert_eq!(actuation.requiredness, Requiredness::IfProductInstalled);
    assert!(!effective
        .skills
        .iter()
        .any(|skill| skill.owner_product == "Actuation"));
}

#[test]
fn ordinary_base_profile_does_not_receive_root_extension_authoring_skills() {
    let manifest = canonical_manifest();
    let base = resolve_profile(
        &manifest,
        "oi:skillset:base-suite-operation",
        AgentScope::Ordinary,
        &oi_central_observations(),
        &installed(&["O:I", "Central"]),
        &AuthorityObservation::default(),
        SkillResolutionMode::AikitDynamic,
    )
    .unwrap();
    let refs = base
        .skills
        .iter()
        .map(|skill| skill.skill_ref.as_str())
        .collect::<Vec<_>>();
    assert!(!refs.contains(&"central:skill:connector-authoring"));
    assert!(!refs.contains(&"central:skill:connector-hardening"));
}

#[test]
fn skill_availability_capability_grant_and_action_authority_are_independent() {
    let mut manifest = canonical_manifest();
    let native = manifest
        .skills
        .iter_mut()
        .find(|skill| skill.skill_ref == "oi:skill:suite-operator")
        .unwrap();
    native.required_capabilities = vec!["oi.package.manage".into()];
    native.required_actions = vec!["oi.package.install".into()];

    let mut authority = AuthorityObservation::default();
    authority
        .capability_grants
        .insert("oi.package.manage".into(), CapabilityGrantState::Granted);
    authority.action_authorizations.insert(
        "oi.package.install".into(),
        ActionAuthorizationState::Denied,
    );
    let effective = resolve_profile(
        &manifest,
        "oi:skillset:base-suite-operation",
        AgentScope::Ordinary,
        &oi_central_observations(),
        &installed(&["O:I", "Central"]),
        &authority,
        SkillResolutionMode::AikitDynamic,
    )
    .unwrap();
    let relation = effective
        .skills
        .iter()
        .find(|skill| skill.skill_ref == "oi:skill:suite-operator")
        .unwrap();
    assert_eq!(relation.availability, SkillAvailability::Available);
    assert_eq!(
        relation.capability_states["oi.package.manage"],
        CapabilityGrantState::Granted
    );
    assert_eq!(
        relation.action_states["oi.package.install"],
        ActionAuthorizationState::Denied
    );
}

#[test]
fn authoritative_revision_update_replaces_only_untouched_derived_projection() {
    let manifest = canonical_manifest();
    let dir = tempdir().unwrap();
    let destination = dir.path().join("SKILL.md");
    let native = skill(&manifest, "oi:skill:suite-operator");

    let created = materialise_direct_projection(native, "rev-1", "# v1\n", &destination).unwrap();
    assert_eq!(created.state, DirectProjectionState::Created);
    let updated = materialise_direct_projection(native, "rev-2", "# v2\n", &destination).unwrap();
    assert_eq!(updated.state, DirectProjectionState::Updated);
    assert_eq!(updated.receipt.as_ref().unwrap().source_revision, "rev-2");
    assert!(fs::read_to_string(&destination).unwrap().contains("# v2"));
}

#[test]
fn user_owned_and_locally_edited_projection_conflicts_are_preserved() {
    let manifest = canonical_manifest();
    let dir = tempdir().unwrap();
    let native = skill(&manifest, "oi:skill:suite-operator");
    let destination = dir.path().join("SKILL.md");

    fs::write(&destination, "# user-owned\n").unwrap();
    let conflict =
        materialise_direct_projection(native, "rev-1", "# native\n", &destination).unwrap();
    assert_eq!(conflict.state, DirectProjectionState::ConflictPreserved);
    assert_eq!(fs::read_to_string(&destination).unwrap(), "# user-owned\n");

    fs::remove_file(&destination).unwrap();
    materialise_direct_projection(native, "rev-1", "# native\n", &destination).unwrap();
    fs::write(&destination, "# locally edited derived copy\n").unwrap();
    let edited =
        materialise_direct_projection(native, "rev-2", "# native v2\n", &destination).unwrap();
    assert_eq!(edited.state, DirectProjectionState::ConflictPreserved);
    assert_eq!(
        fs::read_to_string(&destination).unwrap(),
        "# locally edited derived copy\n"
    );
    let removal = remove_direct_projection("oi:skill:suite-operator", &destination).unwrap();
    assert_eq!(removal.state, DirectProjectionState::ConflictPreserved);
    assert!(destination.exists());
}

#[test]
fn desktop_and_tui_can_share_the_same_serializable_effective_skillset_read_model() {
    let manifest = canonical_manifest();
    let effective = resolve_profile(
        &manifest,
        "oi:skillset:root-metagentic-operation",
        AgentScope::RootWorld,
        &oi_central_observations(),
        &installed(&["O:I", "Central"]),
        &AuthorityObservation {
            capability_grants: BTreeMap::new(),
            action_authorizations: BTreeMap::new(),
        },
        SkillResolutionMode::AikitDynamic,
    )
    .unwrap();
    let desktop = serde_json::to_value(&effective).unwrap();
    let tui: serde_json::Value =
        serde_json::from_slice(&serde_json::to_vec(&effective).unwrap()).unwrap();
    assert_eq!(desktop, tui);
    assert_eq!(
        desktop["profile_ref"],
        "oi:skillset:root-metagentic-operation"
    );
}
