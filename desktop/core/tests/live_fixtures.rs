use oi_desktop_core::{host_native_contribution, ContributionAvailability, NativeContributionReading};
use serde::Deserialize;

#[derive(Deserialize)]
struct ContributionFixtures {
    schema: String,
    contributions: Vec<NativeContributionReading>,
}

#[test]
fn live_host_reading_fixture_is_parseable_and_truthful_about_cross_product_seams() {
    let fixtures: ContributionFixtures = serde_json::from_str(include_str!(
        "../../fixtures/native-contributions.json"
    ))
    .expect("desktop host-reading fixture must parse");

    assert_eq!(fixtures.schema, "oi.desktop-host-reading-fixtures/v1");

    let hosted = fixtures
        .contributions
        .into_iter()
        .map(|contribution| {
            host_native_contribution(None, contribution)
                .expect("each fixture must satisfy the desktop host-reading contract")
        })
        .collect::<Vec<_>>();

    let explore = hosted
        .iter()
        .find(|entry| entry.contribution.native_owner == "oi-explore")
        .expect("Explore host reading must be present");
    assert_eq!(
        explore.contribution.availability,
        ContributionAvailability::Ready
    );
    assert!(explore.contribution.actions.is_empty());
    assert!(!explore
        .contribution
        .accepted_selection_kinds
        .iter()
        .any(|kind| matches!(kind.as_str(), "contact" | "watch" | "authority" | "a2a_difference")));

    let actuation = hosted
        .iter()
        .find(|entry| entry.contribution.native_owner == "actuation")
        .expect("Actuation host reading must be present");
    assert_eq!(
        actuation.contribution.availability,
        ContributionAvailability::Ready
    );
    assert_eq!(
        actuation.contribution.provenance.revision.as_deref(),
        Some("b977939ec25c32b3dc8f5ed251b70e4c26933086")
    );
    assert!(actuation
        .contribution
        .accepted_selection_kinds
        .iter()
        .any(|kind| kind == "root_scope"));
    assert!(actuation
        .contribution
        .accepted_selection_kinds
        .iter()
        .any(|kind| kind == "metagency_grant"));

    assert!(hosted.iter().any(|entry| {
        entry.contribution.native_owner == "central"
            && entry.contribution.target_contract.as_deref() == Some("personal.show")
            && entry.contribution.availability == ContributionAvailability::Ready
            && entry
                .contribution
                .actions
                .iter()
                .any(|action| action.action_ref == "personal.notify")
    }));

    let factory = hosted
        .iter()
        .find(|entry| entry.contribution.native_owner == "software-factory")
        .expect("Factory Build host reading must be present");
    assert_eq!(
        factory.contribution.availability,
        ContributionAvailability::Degraded
    );
    assert_eq!(
        factory.contribution.target_contract.as_deref(),
        Some("@epilogos/factory-build-surface@0.1.0:FactoryBuildView")
    );
    assert_eq!(
        factory.contribution.provenance.revision.as_deref(),
        Some("2a1775e4ce251dcf01b4b1c621e0d56efe7195be")
    );
    for kind in [
        "project",
        "run",
        "candidate",
        "execution",
        "agency",
        "harness_composition",
        "agent_session",
        "material_binding",
    ] {
        assert!(factory
            .contribution
            .accepted_selection_kinds
            .iter()
            .any(|candidate| candidate == kind));
    }
    assert!(!factory
        .contribution
        .accepted_selection_kinds
        .iter()
        .any(|kind| kind == "session_space"));
    assert!(factory.contribution.actions.is_empty());
    assert!(factory.contribution.read_model_ref.is_none());

    assert!(hosted.iter().any(|entry| {
        entry.contribution.native_owner == "ai-kit"
            && entry.contribution.target_contract.as_deref()
                == Some("aikit.harness-composition-topology/v1")
            && entry.contribution.provenance.revision.as_deref()
                == Some("beae44c9b9f40565dcae24b4dceac91a3258bf44")
            && entry.contribution.availability == ContributionAvailability::Degraded
    }));
}
