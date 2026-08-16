use oi_cli::skillset::{
    materialise_direct_projection, parse_manifest, remove_direct_projection, resolve_profile,
    ActionAuthorizationState, AuthorityObservation, CapabilityGrantState, DirectProjectionState,
    NativeSkillReference, Requiredness, SkillAvailability, SkillObservation, SkillResolutionMode,
    SuiteSkillSetManifest,
};
use serde_json::Value;
use std::collections::BTreeMap;
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

fn central_only_observations() -> Vec<SkillObservation> {
    vec![
        observation("oi:skill:operate-suite", "oi-rev-1"),
        observation("central:skill:control-maintenance", "central-rev-1"),
        observation("central:skill:machine-declaration", "central-rev-1"),
        observation("central:skill:connector-authoring", "central-rev-1"),
        observation("central:skill:connector-hardening", "central-rev-1"),
    ]
}

fn skill<'a>(manifest: &'a SuiteSkillSetManifest, skill_ref: &str) -> &'a NativeSkillReference {
    manifest.skills.iter().find(|skill| skill.skill_ref == skill_ref).unwrap()
}

#[test]
fn oi_and_central_without_aikit_have_legal_direct_projection_path() {
    let manifest = canonical_manifest();
    let effective = resolve_profile(
        &manifest,
        "oi:skillset:base-suite-operation",
        &central_only_observations(),
        &AuthorityObservation::default(),
        SkillResolutionMode::OiDirectProjection,
    ).unwrap();
    assert!(!effective.degraded);
    assert!(effective.expected_native_skills.iter().any(|gap| gap.owner_product == "AIKit"));
    assert!(effective.skills.iter().all(|relation| relation.resolution_mode == SkillResolutionMode::OiDirectProjection));

    let dir = tempdir().unwrap();
    let destination = dir.path().join("oi/SKILL.md");
    let outcome = materialise_direct_projection(
        skill(&manifest, "oi:skill:operate-suite"),
        "oi-rev-1",
        "# authoritative O:I Skill\n",
        &destination,
    ).unwrap();
    assert_eq!(outcome.state, DirectProjectionState::Created);
    let projected = fs::read_to_string(&destination).unwrap();
    assert!(projected.contains("O:I DERIVED SKILL PROJECTION"));
    assert!(projected.contains("canonical source = EpiLogos/O-I/skills/oi/SKILL.md @ oi-rev-1"));
}

#[test]
fn aikit_dynamic_resolution_uses_native_references_not_copied_skill_bodies() {
    let manifest = canonical_manifest();
    let effective = resolve_profile(
        &manifest,
        "oi:skillset:base-suite-operation",
        &central_only_observations(),
        &AuthorityObservation::default(),
        SkillResolutionMode::AikitDynamic,
    ).unwrap();
    assert_eq!(effective.resolution_mode, SkillResolutionMode::AikitDynamic);
    assert!(effective.skills.iter().all(|skill| !skill.source_repository.is_empty() && skill.source_path.ends_with("SKILL.md")));
    let manifest_text = include_str!("../../skills/suite-operator/skillset.json");
    assert!(!manifest_text.contains("# {O:I} Agent Skill"));
    assert!(!manifest_text.contains("## Control authorship"));
}

#[test]
fn ordinary_base_operator_does_not_receive_root_extension_authoring_skills() {
    let manifest = canonical_manifest();
    let base = resolve_profile(
        &manifest,
        "oi:skillset:base-suite-operation",
        &central_only_observations(),
        &AuthorityObservation::default(),
        SkillResolutionMode::AikitDynamic,
    ).unwrap();
    let refs = base.skills.iter().map(|skill| skill.skill_ref.as_str()).collect::<Vec<_>>();
    assert!(!refs.contains(&"central:skill:connector-authoring"));
    assert!(!refs.contains(&"central:skill:connector-hardening"));
    assert!(!base.expected_native_skills.iter().any(|gap| gap.owner_product == "Actuation"));
}

#[test]
fn root_profile_is_expanded_but_skill_availability_does_not_grant_capability_or_action_authority() {
    let mut manifest = canonical_manifest();
    let root_skill = manifest.skills.iter_mut().find(|skill| skill.skill_ref == "central:skill:connector-authoring").unwrap();
    root_skill.required_capabilities = vec!["central.connector.author".into()];
    root_skill.required_actions = vec!["central.connector.register".into()];

    let mut authority = AuthorityObservation::default();
    authority.capability_grants.insert("central.connector.author".into(), CapabilityGrantState::Granted);
    authority.action_authorizations.insert("central.connector.register".into(), ActionAuthorizationState::Denied);
    let root = resolve_profile(
        &manifest,
        "oi:skillset:root-metagentic-operation",
        &central_only_observations(),
        &authority,
        SkillResolutionMode::AikitDynamic,
    ).unwrap();
    let authoring = root.skills.iter().find(|skill| skill.skill_ref == "central:skill:connector-authoring").unwrap();
    assert_eq!(authoring.availability, SkillAvailability::Available);
    assert_eq!(authoring.capability_states["central.connector.author"], CapabilityGrantState::Granted);
    assert_eq!(authoring.action_states["central.connector.register"], ActionAuthorizationState::Denied);
    assert!(root.expected_native_skills.iter().any(|gap| gap.owner_product == "Actuation" && gap.requiredness == Requiredness::IfProductInstalled));
}

#[test]
fn authoritative_revision_update_replaces_only_untouched_derived_projection_and_updates_receipt() {
    let manifest = canonical_manifest();
    let dir = tempdir().unwrap();
    let destination = dir.path().join("SKILL.md");
    let native = skill(&manifest, "oi:skill:operate-suite");
    let created = materialise_direct_projection(native, "rev-1", "# v1\n", &destination).unwrap();
    assert_eq!(created.state, DirectProjectionState::Created);
    let updated = materialise_direct_projection(native, "rev-2", "# v2\n", &destination).unwrap();
    assert_eq!(updated.state, DirectProjectionState::Updated);
    assert_eq!(updated.receipt.as_ref().unwrap().source_revision, "rev-2");
    assert!(fs::read_to_string(destination).unwrap().contains("# v2"));
}

#[test]
fn unavailable_native_product_skill_is_disclosed_as_gap_without_fake_capability() {
    let manifest = canonical_manifest();
    let root = resolve_profile(
        &manifest,
        "oi:skillset:root-metagentic-operation",
        &central_only_observations(),
        &AuthorityObservation::default(),
        SkillResolutionMode::AikitDynamic,
    ).unwrap();
    let actuation = root.expected_native_skills.iter().find(|gap| gap.owner_product == "Actuation").unwrap();
    assert_eq!(actuation.requiredness, Requiredness::IfProductInstalled);
    assert!(!root.skills.iter().any(|skill| skill.owner_product == "Actuation"));
    assert!(!root.skills.iter().any(|skill| skill.source_repository == "EpiLogos/Actuation"));
}

#[test]
fn conflicting_user_file_and_locally_edited_projection_are_preserved() {
    let manifest = canonical_manifest();
    let dir = tempdir().unwrap();
    let native = skill(&manifest, "oi:skill:operate-suite");
    let destination = dir.path().join("SKILL.md");

    fs::write(&destination, "# user-owned\n").unwrap();
    let conflict = materialise_direct_projection(native, "rev-1", "# native\n", &destination).unwrap();
    assert_eq!(conflict.state, DirectProjectionState::ConflictPreserved);
    assert_eq!(fs::read_to_string(&destination).unwrap(), "# user-owned\n");

    fs::remove_file(&destination).unwrap();
    materialise_direct_projection(native, "rev-1", "# native\n", &destination).unwrap();
    fs::write(&destination, "# locally edited derived copy\n").unwrap();
    let edited = materialise_direct_projection(native, "rev-2", "# native v2\n", &destination).unwrap();
    assert_eq!(edited.state, DirectProjectionState::ConflictPreserved);
    assert_eq!(fs::read_to_string(&destination).unwrap(), "# locally edited derived copy\n");
    let removal = remove_direct_projection("oi:skill:operate-suite", &destination).unwrap();
    assert_eq!(removal.state, DirectProjectionState::ConflictPreserved);
    assert!(destination.exists());
}

#[test]
fn desktop_and_tui_can_share_the_same_serializable_effective_skillset_read_model() {
    let manifest = canonical_manifest();
    let effective = resolve_profile(
        &manifest,
        "oi:skillset:root-metagentic-operation",
        &central_only_observations(),
        &AuthorityObservation::default(),
        SkillResolutionMode::AikitDynamic,
    ).unwrap();
    let json = serde_json::to_value(&effective).unwrap();
    let desktop: Value = serde_json::from_str(&serde_json::to_string(&json).unwrap()).unwrap();
    let tui: Value = serde_json::from_slice(&serde_json::to_vec(&json).unwrap()).unwrap();
    assert_eq!(desktop, tui);
    assert_eq!(desktop["profile_ref"], "oi:skillset:root-metagentic-operation");
}

#[test]
fn availability_and_authority_are_three_separate_axes_by_default() {
    let mut manifest = canonical_manifest();
    let skill = manifest.skills.iter_mut().find(|skill| skill.skill_ref == "oi:skill:operate-suite").unwrap();
    skill.required_capabilities = vec!["oi.package.manage".into()];
    skill.required_actions = vec!["oi.package.install".into()];
    let effective = resolve_profile(
        &manifest,
        "oi:skillset:base-suite-operation",
        &central_only_observations(),
        &AuthorityObservation { capability_grants: BTreeMap::new(), action_authorizations: BTreeMap::new() },
        SkillResolutionMode::AikitDynamic,
    ).unwrap();
    let skill = effective.skills.iter().find(|skill| skill.skill_ref == "oi:skill:operate-suite").unwrap();
    assert_eq!(skill.availability, SkillAvailability::Available);
    assert_eq!(skill.capability_states["oi.package.manage"], CapabilityGrantState::NotEvaluated);
    assert_eq!(skill.action_states["oi.package.install"], ActionAuthorizationState::NotEvaluated);
}
