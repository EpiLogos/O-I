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
        .find(|entry| entry.contribution.contribution_ref == "factory.surface/build")
        .expect("Factory Build fallback reading must be present");
    assert_eq!(
        factory.contribution.availability,
        ContributionAvailability::Degraded
    );
    assert_eq!(
        factory.contribution.target_contract.as_deref(),
        Some("factory.build-view-provider/v1")
    );
    assert!(factory
        .contribution
        .detail
        .as_deref()
        .unwrap_or_default()
        .contains("OI_FACTORY_BUILD_STATE"));
    for kind in [
        "project",
        "run",
        "frontier",
        "candidate",
        "human_request",
        "execution",
        "trajectory",
        "agency",
        "harness_composition",
        "agent_session",
        "session_space",
        "material_binding",
    ] {
        assert!(factory
            .contribution
            .accepted_selection_kinds
            .iter()
            .any(|candidate| candidate == kind));
    }
    assert!(factory.contribution.actions.is_empty());
    assert!(factory.contribution.read_model_ref.is_none());

    let session_space = hosted
        .iter()
        .find(|entry| entry.contribution.contribution_ref == "aikit.session-space/read-model")
        .expect("AIKit SessionSpace host reading must be present");
    assert_eq!(
        session_space.contribution.target_contract.as_deref(),
        Some("aikit.session-space/v1")
    );
    assert_eq!(
        session_space.contribution.provenance.revision.as_deref(),
        Some("15d7c9f1122336b50189bb1d70961084cbb9685b")
    );
    assert_eq!(
        session_space.contribution.availability,
        ContributionAvailability::Degraded
    );
    assert!(session_space
        .contribution
        .accepted_selection_kinds
        .iter()
        .any(|kind| kind == "session_space"));
    assert!(session_space.contribution.actions.is_empty());
    assert!(session_space.contribution.read_model_ref.is_none());

    assert!(hosted.iter().any(|entry| {
        entry.contribution.contribution_ref == "aikit.harness-composition/deepseek-maximal"
            && entry.contribution.target_contract.as_deref()
                == Some("aikit.harness-composition-topology/v1")
            && entry.contribution.provenance.revision.as_deref()
                == Some("15d7c9f1122336b50189bb1d70961084cbb9685b")
            && entry.contribution.availability == ContributionAvailability::Degraded
    }));

    for owner in ["central", "actuation", "ai-kit", "factory", "workcell", "ql-mef"] {
        assert!(
            hosted
                .iter()
                .any(|entry| entry.contribution.native_owner == owner),
            "System fixture must disclose a truthful six-product slot for {owner}"
        );
    }

    let workcell = hosted
        .iter()
        .find(|entry| entry.contribution.native_owner == "workcell")
        .expect("Workcell System slot must be present");
    assert_eq!(
        workcell.contribution.availability,
        ContributionAvailability::PendingNativeAdapter
    );
    assert_eq!(
        workcell.contribution.target_contract.as_deref(),
        Some("workcell.control/v1")
    );
    assert!(workcell.contribution.read_model_ref.is_none());
    assert!(workcell.contribution.actions.is_empty());
    assert!(workcell
        .contribution
        .detail
        .as_deref()
        .unwrap_or_default()
        .contains("Current development, not accepted-main runtime evidence"));

    let ql = hosted
        .iter()
        .find(|entry| entry.contribution.native_owner == "ql-mef")
        .expect("QL-MEF System slot must be present");
    assert_eq!(
        ql.contribution.availability,
        ContributionAvailability::PendingNativeAdapter
    );
    assert!(ql.contribution.target_contract.is_none());
    assert!(ql.contribution.read_model_ref.is_none());
    assert!(ql.contribution.actions.is_empty());
    assert!(ql
        .contribution
        .detail
        .as_deref()
        .unwrap_or_default()
        .contains("ordinary operation remains available without QL"));
}
