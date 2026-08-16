use oi_desktop_core::{host_native_contribution, ContributionAvailability, NativeContributionReading};
use serde::Deserialize;

#[derive(Deserialize)]
struct ContributionFixtures {
    schema: String,
    contributions: Vec<NativeContributionReading>,
}

#[test]
fn live_contribution_fixture_is_parseable_hostable_and_explicit_about_pending_seams() {
    let fixtures: ContributionFixtures = serde_json::from_str(include_str!(
        "../../fixtures/native-contributions.json"
    ))
    .expect("desktop contribution fixture must parse");

    assert_eq!(fixtures.schema, "oi.desktop-contribution-fixtures/v1");

    let hosted = fixtures
        .contributions
        .into_iter()
        .map(|contribution| {
            host_native_contribution(None, contribution)
                .expect("each fixture must satisfy the native contribution contract")
        })
        .collect::<Vec<_>>();

    assert!(hosted.iter().any(|entry| {
        entry.contribution.native_owner == "oi-explore"
            && entry.contribution.availability == ContributionAvailability::Ready
    }));
    assert!(hosted.iter().any(|entry| {
        entry.contribution.native_owner == "actuation"
            && entry.contribution.availability == ContributionAvailability::Ready
    }));

    for owner in ["central", "software-factory", "ai-kit"] {
        assert!(hosted.iter().any(|entry| {
            entry.contribution.native_owner == owner
                && entry.contribution.availability
                    == ContributionAvailability::PendingNativeAdapter
        }));
    }
}
