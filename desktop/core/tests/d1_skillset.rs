use oi_cli::package::{parse_manifest, PACKAGE_SCHEMA};
use oi_desktop_core::{
    authorize_action, host_native_contribution, remove_direct_projection, resolve_skillset,
    selection_for, write_direct_projection, write_direct_projection_with_state,
    ActionAuthorityGrant, ActionAvailability, AgentScope, AuthoritativeSkillRef,
    CanonicalActionBinding, ContributionAvailability, DirectProjectionUpdate, ExpectedNativeSkill,
    HostRegion, NativeContributionReading, NativeSkillPublicationState, RefProvenance,
    SemanticRef, SkillProfile, SkillSource, SuiteSkillSetManifest,
};
use std::collections::BTreeSet;

fn ready_contribution() -> NativeContributionReading {
    NativeContributionReading {
        schema: "oi.desktop-host-reading/v1".into(),
        contribution_ref: "factory.surface/build".into(),
        native_owner: "software-factory".into(),
        target_contract: Some("factory.surface/v1".into()),
        availability: ContributionAvailability::Ready,
        provenance: RefProvenance {
            source: "factory".into(),
            revision: Some("abc".into()),
        },
        regions: vec![HostRegion::Canvas, HostRegion::Inspector],
        read_model_ref: Some(SemanticRef {
            ref_id: "factory:run:r1".into(),
            kind: "run".into(),
            native_owner: "software-factory".into(),
            provenance: RefProvenance {
                source: "factory".into(),
                revision: Some("abc".into()),
            },
        }),
        accepted_selection_kinds: vec!["run".into(), "candidate".into()],
        actions: vec![CanonicalActionBinding {
            action_ref: "factory.action:recognise-candidate".into(),
            native_owner: "software-factory".into(),
            availability: ActionAvailability::Available,
            required_capability_ref: Some("factory.capability:recognition".into()),
        }],
        detail: None,
    }
}

#[test]
fn package_envelope_never_replaces_native_contribution_or_action_identity() {
    let manifest = parse_manifest(&format!(
        r#"{{
      "schema":"{PACKAGE_SCHEMA}","package_ref":"package:factory-build","version":"1.0.0",
      "source":{{"kind":"git","locator":"factory","revision":"abc"}},
      "compatibility":[],"permissions":["network"],"effects":[],
      "contributions":[{{"contribution_ref":"factory.surface/build","target_product":"software-factory",
        "target_contract":"factory.surface/v1","minimum_contract_version":"1.0.0","artifact":"build-surface",
        "permissions":[],"effects":[],"native_verification":{{"operation":"factory.verify","evidence_format":"json"}}}}]
    }}"#
    ))
    .unwrap();
    let hosted = host_native_contribution(Some(&manifest), ready_contribution()).unwrap();
    assert_eq!(hosted.package.unwrap().package_ref, "package:factory-build");
    assert_eq!(
        hosted.contribution.contribution_ref,
        "factory.surface/build"
    );
    assert_eq!(
        hosted.contribution.actions[0].action_ref,
        "factory.action:recognise-candidate"
    );
}

#[test]
fn selection_propagates_only_the_stable_subject_ref() {
    let contribution = ready_contribution();
    let selected = SemanticRef {
        ref_id: "factory:run:r9".into(),
        kind: "run".into(),
        native_owner: "software-factory".into(),
        provenance: RefProvenance {
            source: "factory".into(),
            revision: Some("def".into()),
        },
    };
    let projection = selection_for(&contribution, &selected).unwrap();
    assert_eq!(projection.subject, selected);
    assert!(!serde_json::to_string(&projection)
        .unwrap()
        .to_ascii_lowercase()
        .contains("context"));
}

#[test]
fn action_availability_capability_grant_and_authority_are_separate() {
    let contribution = ready_contribution();
    let binding = contribution.actions[0].clone();
    let missing_capability = ActionAuthorityGrant {
        authority_ref: "authority:human-confirmed".into(),
        action_ref: binding.action_ref.clone(),
        native_owner: binding.native_owner.clone(),
        capability_grant_ref: None,
    };
    assert!(authorize_action(&binding, &missing_capability).is_err());
    let granted = ActionAuthorityGrant {
        capability_grant_ref: Some("grant:recognition".into()),
        ..missing_capability
    };
    let invocation = authorize_action(&binding, &granted).unwrap();
    assert_eq!(invocation.action_ref, binding.action_ref);
    assert_eq!(invocation.authority_ref, "authority:human-confirmed");
}

fn skill_manifest() -> SuiteSkillSetManifest {
    SuiteSkillSetManifest {
        schema: "oi.suite-skillset/v1".into(),
        skills: vec![
            AuthoritativeSkillRef {
                skill_ref: "oi.skill/operator".into(),
                native_owner: "oi".into(),
                source: SkillSource {
                    repository: "oi".into(),
                    revision: "r1".into(),
                    path: "skills/oi/SKILL.md".into(),
                },
                required_capability_refs: vec![],
                related_action_refs: vec![],
            },
            AuthoritativeSkillRef {
                skill_ref: "central.skill/connector-authoring".into(),
                native_owner: "central".into(),
                source: SkillSource {
                    repository: "central".into(),
                    revision: "r2".into(),
                    path: "skills/connector-authoring/SKILL.md".into(),
                },
                required_capability_refs: vec!["central.capability:connector-write".into()],
                related_action_refs: vec!["central.action:connector-register".into()],
            },
        ],
        profiles: vec![
            SkillProfile {
                profile_ref: "oi.skillset/base".into(),
                scope: AgentScope::Ordinary,
                skill_refs: vec!["oi.skill/operator".into()],
            },
            SkillProfile {
                profile_ref: "oi.skillset/root".into(),
                scope: AgentScope::RootWorld,
                skill_refs: vec![
                    "oi.skill/operator".into(),
                    "central.skill/connector-authoring".into(),
                ],
            },
        ],
        expected_native_skills: vec![ExpectedNativeSkill {
            native_owner: "actuation".into(),
            purpose: "WorldBinding/root determination/Return procedure".into(),
            profile_refs: vec!["oi.skillset/root".into()],
            required_when_installed: true,
            state: NativeSkillPublicationState::AwaitingNativePublication,
        }],
    }
}

#[test]
fn ordinary_agency_does_not_receive_root_profile_and_missing_product_stays_explicit() {
    let available = BTreeSet::from(["oi".to_owned()]);
    assert!(resolve_skillset(
        &skill_manifest(),
        "oi.skillset/root",
        AgentScope::Ordinary,
        &available,
        true
    )
    .is_err());
    let root = resolve_skillset(
        &skill_manifest(),
        "oi.skillset/root",
        AgentScope::RootWorld,
        &available,
        true,
    )
    .unwrap();
    let central = root
        .skills
        .iter()
        .find(|skill| skill.native_owner == "central")
        .unwrap();
    assert!(!central.available);
    assert!(central.capability_grant_refs.is_empty());
    assert!(central.action_authority_refs.is_empty());
}

#[test]
fn installed_product_without_native_skill_is_a_visible_gap_not_fake_competence() {
    let available = BTreeSet::from([
        "oi".to_owned(),
        "central".to_owned(),
        "actuation".to_owned(),
    ]);
    let root = resolve_skillset(
        &skill_manifest(),
        "oi.skillset/root",
        AgentScope::RootWorld,
        &available,
        true,
    )
    .unwrap();
    assert!(root.degraded);
    assert!(root
        .expected_native_skills
        .iter()
        .any(|expected| expected.native_owner == "actuation"));
    assert!(!root
        .skills
        .iter()
        .any(|skill| skill.native_owner == "actuation"));
}

#[test]
fn no_aikit_direct_projection_is_derived_provenance_bearing_and_authority_free() {
    let available = BTreeSet::from(["oi".to_owned(), "central".to_owned()]);
    let root = resolve_skillset(
        &skill_manifest(),
        "oi.skillset/root",
        AgentScope::RootWorld,
        &available,
        false,
    )
    .unwrap();
    assert_eq!(format!("{:?}", root.projection_mode), "DirectDerived");
    let skill = root.skills.first().unwrap();
    let directory = tempfile::tempdir().unwrap();
    let receipt =
        write_direct_projection(directory.path(), skill, "# authoritative body\n").unwrap();
    let materialized = std::fs::read_to_string(&receipt.target).unwrap();
    assert!(materialized.contains("oi-derived-skill/v1"));
    assert!(materialized.contains("revision=r1"));
    assert_eq!(receipt.source_repository, "oi");
    assert_eq!(receipt.source_path, "skills/oi/SKILL.md");
    assert!(skill.capability_grant_refs.is_empty());
    assert!(skill.action_authority_refs.is_empty());
}

#[test]
fn authoritative_skill_update_replaces_only_untouched_derived_copy() {
    let available = BTreeSet::from(["oi".to_owned(), "central".to_owned()]);
    let root = resolve_skillset(
        &skill_manifest(),
        "oi.skillset/base",
        AgentScope::Ordinary,
        &available,
        false,
    )
    .unwrap();
    let mut skill = root.skills[0].clone();
    let directory = tempfile::tempdir().unwrap();

    let (created, first) =
        write_direct_projection_with_state(directory.path(), &skill, "# v1\n").unwrap();
    assert_eq!(created, DirectProjectionUpdate::Created);
    skill.source.revision = "r2".into();
    let (updated, second) =
        write_direct_projection_with_state(directory.path(), &skill, "# v2\n").unwrap();
    assert_eq!(updated, DirectProjectionUpdate::Updated);
    assert_eq!(second.source_revision, "r2");
    assert_eq!(first.target, second.target);
    assert!(std::fs::read_to_string(second.target).unwrap().contains("# v2"));
}

#[test]
fn local_skill_projection_edits_are_preserved_on_update_and_removal() {
    let available = BTreeSet::from(["oi".to_owned(), "central".to_owned()]);
    let root = resolve_skillset(
        &skill_manifest(),
        "oi.skillset/base",
        AgentScope::Ordinary,
        &available,
        false,
    )
    .unwrap();
    let mut skill = root.skills[0].clone();
    let directory = tempfile::tempdir().unwrap();
    let receipt = write_direct_projection(directory.path(), &skill, "# v1\n").unwrap();
    std::fs::write(&receipt.target, "# human/local edit\n").unwrap();
    skill.source.revision = "r2".into();

    assert!(write_direct_projection(directory.path(), &skill, "# v2\n").is_err());
    assert_eq!(
        std::fs::read_to_string(&receipt.target).unwrap(),
        "# human/local edit\n"
    );
    assert!(remove_direct_projection(&skill.skill_ref, &receipt.target).is_err());
    assert!(receipt.target.exists());
}

#[test]
fn actual_suite_manifest_discloses_unpublished_native_skills_without_invented_paths() {
    let manifest: SuiteSkillSetManifest = serde_json::from_str(include_str!(
        "../../../skills/suite-operator/manifest.json"
    ))
    .unwrap();
    let owners = manifest
        .skills
        .iter()
        .map(|skill| skill.native_owner.as_str())
        .collect::<BTreeSet<_>>();
    assert_eq!(owners, BTreeSet::from(["central", "oi"]));
    for expected in ["actuation", "aikit", "software-factory", "workcell"] {
        assert!(manifest
            .expected_native_skills
            .iter()
            .any(|skill| skill.native_owner == expected));
    }
}

#[test]
fn effective_skillset_is_one_serializable_read_model_for_desktop_and_tui() {
    let available = BTreeSet::from(["oi".to_owned(), "central".to_owned()]);
    let effective = resolve_skillset(
        &skill_manifest(),
        "oi.skillset/root",
        AgentScope::RootWorld,
        &available,
        true,
    )
    .unwrap();
    let desktop = serde_json::to_value(&effective).unwrap();
    let tui: serde_json::Value =
        serde_json::from_slice(&serde_json::to_vec(&effective).unwrap()).unwrap();
    assert_eq!(desktop, tui);
    assert_eq!(desktop["profile_ref"], "oi.skillset/root");
    assert_eq!(
        desktop["skills"][0]["capability_grant_refs"],
        serde_json::json!([])
    );
    assert_eq!(
        desktop["skills"][0]["action_authority_refs"],
        serde_json::json!([])
    );
}
