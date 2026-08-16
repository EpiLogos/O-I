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

    assert!(hosted.iter().any(|entry| {
        entry.contribution.native_owner == "actuation"
            && entry.contribution.availability == ContributionAvailability::Ready
    }));
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
    assert!(hosted.iter().any(|entry| {
        entry.contribution.native_owner == "ai-kit"
            && entry.contribution.target_contract.as_deref()
                == Some("aikit.harness-composition-topology/v1")
            && entry.contribution.provenance.revision.as_deref()
                == Some("8f821deabe2e8132d9817443f56046477fd68079")
            && entry.contribution.availability == ContributionAvailability::Degraded
    }));
    assert!(hosted.iter().any(|entry| {
        entry.contribution.native_owner == "software-factory"
            && entry.contribution.availability == ContributionAvailability::PendingNativeAdapter
    }));
}
