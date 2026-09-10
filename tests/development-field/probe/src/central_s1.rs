//! Native S1 actions on the same specimen. Human-facing values are fixture inputs,
//! not a claim that a human accepted an actual deployment or experience.
use std::{fs, path::Path};
use serde_json::{json, Value};
use central_ctrl::{action::{ActionExecutionContext, ActionRegistry}, development_field::*, root::RootOptions,
    projectcentral_ground::{apply_accepted_ground_relation, SourceProvenance, SourceStanding, SourceTreatment}};
use central_connector_sdk::{ConnectorContext, ConnectorRegistry};
use crate::{Result, roundtrip, write};

pub fn bind(root: &Path, project: &Path, out: &Path, expected_project: &str) -> Result<Value> {
    let before = inspect_project_development_field(project)?;
    assert_eq!(before.self_aperture.status, SelfApertureStatus::LegacyMigratableAbsence);
    let root_receipt = ensure_root_self(root)?;
    let project_receipt = ensure_project_self(project)?;
    assert!(!root_receipt.documentation_moved && !root_receipt.matrices_moved);
    assert!(!project_receipt.documentation_moved && !project_receipt.matrices_moved);
    fs::write(project.join(PROJECT_SELF_DIR).join("unbound.md"), "Generated fixture; not human authority.\n")?;
    let unbound = inspect_project_development_field(project)?;
    assert_eq!(unbound.self_aperture.unbound_sources.len(), 1);
    assert!(unbound.self_aperture.unbound_sources.iter().all(|s| !s.authority_from_location));
    // A fixture declaration of source adoption, using Central's existing law.
    // ProjectCentral/user is not an ordinary retained-native Project path.
    let adoption = apply_accepted_ground_relation(project, "ProjectCentral/user/intent.md",
        SourceProvenance::HumanAdopted, SourceStanding::AuthoredHumanPosition,
        SourceTreatment::ProjectcentralUser, vec!["self-description-source".into()])?;
    let source_ref = adoption.relation.source_ref.clone();
    let options = RootOptions { explicit_root: Some(root.to_owned()), ..Default::default() };
    let connectors = ConnectorRegistry::default();
    let platform = ConnectorContext::current();
    let context = ActionExecutionContext { root_options: &options, connectors: &connectors, connector_context: &platform };
    let mut actions = ActionRegistry::default();
    register_development_field_actions(&mut actions);
    let tier = actions.execute("projectcentral.self.tier.relate", &json!({
        "project":"specimen","source_ref":source_ref,"tier":1,"acceptance":"human-accepted"
    }), &context);
    assert!(tier.ok, "{tier:?}");
    let initial = inspect_project_development_field(project)?;
    let native_source = initial.tier_bindings[0].sources[0].as_ref().unwrap();
    assert_eq!(native_source.path, "ProjectCentral/user/intent.md");
    assert_eq!(native_source.source_ref, source_ref);
    assert_eq!(native_source.provenance, "human-adopted");
    let ux = actions.execute("projectcentral.self.ux.relate", &json!({
        "project":"specimen","source_ref":source_ref,"ux_ref":"ux:fixture:portable-cut","acceptance":"human-accepted"
    }), &context);
    assert!(ux.ok, "{ux:?}");
    let forged_ex = actions.execute("projectcentral.self.ex.relate", &json!({
        "project":"specimen","source_ref":source_ref,"ex_ref":"ex:fixture:not-human",
        "actor_kind":"agent","agent_session_ref":"agent-session:fixture:developer","acceptance":"human-accepted"
    }), &context);
    assert!(!forged_ex.ok);
    let invalid_tier = actions.execute("projectcentral.self.tier.relate", &json!({
        "project":"specimen","source_ref":source_ref,"tier":6,"acceptance":"human-accepted"
    }), &context);
    assert!(!invalid_tier.ok);
    let reading = inspect_project_development_field(project)?;
    assert_eq!(reading.scope_ref, expected_project);
    assert!(!reading.canonical_tier_labels_invented && !reading.source_payloads_exposed && !reading.automatic_agent_or_model_invocation);
    assert_eq!(reading.ux.len(), 1);
    assert!(reading.ux[0].intended_experience);
    assert!(!reading.ux[0].implementation_fact && !reading.ux[0].test_result && !reading.ux[0].ex_human_return);
    assert!(reading.ex.is_empty());
    let relations: DevelopmentSourceRelations = serde_json::from_slice(&fs::read(project.join(PROJECT_DEVELOPMENT_RELATIONS))?)?;
    let restored: DevelopmentSourceRelations = roundtrip(&relations)?;
    assert_eq!(restored, relations);
    let receipt = json!({"status":"passed","standing":"deterministic-fixture-not-human-acceptance",
        "root":inspect_root_development_field(root)?,"root_ensure":root_receipt,"project_ensure":project_receipt,
        "reading":reading,"relations":relations,"source_ref":source_ref,"negative_ex":forged_ex,"invalid_tier":invalid_tier,"H":"not-exercised"});
    write(&out.join("central-s1.json"), &receipt)?;
    Ok(receipt)
}
