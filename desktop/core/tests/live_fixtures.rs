use oi_desktop_core::{
    host_native_contribution, CompositionReading, ContributionAvailability,
    NativeContributionReading, ProviderClass, PresenceState,
};
use oi_cli::status::{NativeSurfaceState, SuiteCompositionDisclosure};
use serde::Deserialize;

#[derive(Deserialize)]
struct ContributionFixtures {
    schema: String,
    contributions: Vec<NativeContributionReading>,
}

#[test]
fn live_host_reading_fixture_is_parseable_and_truthful_about_cross_product_seams() {
    let fixtures: ContributionFixtures =
        serde_json::from_str(include_str!("../../fixtures/native-contributions.json"))
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

    // A static document can never claim live, whatever it describes (02 §10).
    // Every entry in this catalog is fixture-served, so every entry is
    // Degraded and names the fixture as the reason.
    for entry in &hosted {
        assert_eq!(
            entry.contribution.availability,
            ContributionAvailability::Degraded,
            "{} is fixture-served and must not claim ready",
            entry.contribution.contribution_ref
        );
        assert!(
            entry
                .contribution
                .detail
                .as_deref()
                .unwrap_or_default()
                .contains("Fixture fallback"),
            "{} must name the fixture as its reason",
            entry.contribution.contribution_ref
        );
    }

    let explore = hosted
        .iter()
        .find(|entry| entry.contribution.native_owner == "oi-explore")
        .expect("Explore host reading must be present");
    assert!(explore.contribution.actions.is_empty());
    assert!(!explore
        .contribution
        .accepted_selection_kinds
        .iter()
        .any(|kind| matches!(
            kind.as_str(),
            "contact" | "watch" | "authority" | "a2a_difference"
        )));

    let actuation = hosted
        .iter()
        .find(|entry| entry.contribution.native_owner == "actuation")
        .expect("Actuation host reading must be present");
    assert!(
        actuation.contribution.provenance.revision.is_none()
            && actuation
                .contribution
                .read_model_ref
                .as_ref()
                .map(|reference| reference.provenance.revision.is_none())
                .unwrap_or(true),
            "no source revision is asserted as Actuation truth from a static fixture"
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
}

/// The composition reading is derived from live recognition; a fixture-served
/// constituent is an explicitly Degraded fallback and is never a presence
/// source (02 §10, §11 Retire). Pinned against the very catalog that once
/// claimed `ready`.
#[test]
fn the_composition_reading_reports_the_fixture_catalog_as_degraded_fallback_only() {
    let raw = include_str!("../../fixtures/native-contributions.json");
    let fixtures: ContributionFixtures = serde_json::from_str(raw).expect("fixture must parse");
    let hosted = fixtures
        .contributions
        .into_iter()
        .map(|contribution| host_native_contribution(None, contribution).unwrap())
        .collect::<Vec<_>>();

    // No live recognition and no surface registration observed: the reading
    // holds nothing but what the fixtures disclose, and says so.
    let reading = CompositionReading::compose(
        None,
        &SuiteCompositionDisclosure {
            schema: "oi.desktop-composition-disclosure/v1".to_owned(),
            personal_ground: None,
            surfaces: Vec::new(),
            warnings: Vec::new(),
        },
        &hosted,
    );

    assert!(
        !reading.constituents.is_empty(),
        "the fixture catalog still discloses its owners"
    );
    for constituent in &reading.constituents {
        assert_eq!(
            constituent.state,
            PresenceState::Degraded,
            "{} is fixture-served",
            constituent.native_owner
        );
        assert_eq!(
            constituent.provider_class,
            ProviderClass::Fixture,
            "a fixture can never claim live, whatever it says about itself"
        );
        assert!(!constituent.provider_class.claims_live());
    }
    assert!(
        reading.warnings.iter().any(|warning| warning.contains("static host-reading fixture")),
        "the reading discloses that a fixture served these constituents"
    );

    // With registration observed, the same owners are reported from O:I
    // recognition (presence, not health) and the fixture adds nothing.
    let disclosure = SuiteCompositionDisclosure {
        schema: "oi.desktop-composition-disclosure/v1".to_owned(),
        personal_ground: None,
        surfaces: vec![oi_cli::status::SurfaceDisclosure {
            id: "central".to_owned(),
            public_name: "Central".to_owned(),
            function: "covenant space".to_owned(),
            repository: "EpiLogos/Central".to_owned(),
            native_entry: "ctrl".to_owned(),
            accepted_revision: String::new(),
            canonical_namespace: "personal.show".to_owned(),
            compatibility_aliases: Vec::new(),
            version_command: Vec::new(),
            capability_command: Vec::new(),
            verification_command: Vec::new(),
            state: NativeSurfaceState::Registered,
            resolved: None,
            version: None,
            detail: None,
        }],
        warnings: Vec::new(),
    };
    let reading = CompositionReading::compose(None, &disclosure, &hosted);
    let central = reading
        .constituents
        .iter()
        .find(|constituent| constituent.native_owner == "central")
        .expect("Central is observed");
    assert_eq!(central.state, PresenceState::Present);
    assert_eq!(central.provider_class, ProviderClass::Recognition);
    assert!(
        !reading.warnings.iter().any(|warning| warning.contains("central")),
        "no fixture fallback is recorded for an owner recognition observed"
    );
}

/// Pinned (K2 fix round 1, S3 residual): a fixture action's `availability` is
/// a capability **descriptor** — what the owner's own Action surface offers —
/// and is never provider presence. `system-workbench-model.mjs` renders this
/// field verbatim, so the retirement surface K3 builds on it must not be able
/// to turn `"available"` into a §10 violation: the reading that fixture
/// serves stays Degraded no matter what its actions describe.
#[test]
fn fixture_action_availability_is_a_capability_descriptor_never_presence() {
    let raw = include_str!("../../fixtures/native-contributions.json");
    let value: serde_json::Value = serde_json::from_str(raw).expect("fixture must parse");

    let mut descriptor_actions = 0usize;
    for entry in value["contributions"].as_array().expect("contributions") {
        let contribution = entry;
        // The reading-level availability is the honest provider fact: this
        // static document serves Degraded, whatever it describes.
        assert_eq!(
            contribution["availability"].as_str(),
            Some("degraded"),
            "{} must stay a Degraded fixture reading",
            contribution["contribution_ref"].as_str().unwrap_or("?")
        );
        for action in contribution["actions"].as_array().unwrap_or(&Vec::new()) {
            let availability = action["availability"].as_str().unwrap_or_else(|| {
                panic!(
                    "action {} must declare its descriptor availability",
                    action["action_ref"]
                )
            });
            assert!(
                matches!(availability, "available" | "unavailable"),
                "action availability `{availability}` is outside the descriptor vocabulary"
            );
            descriptor_actions += 1;
        }
    }
    assert!(
        descriptor_actions > 0,
        "the fixture still carries the action descriptors this pin exists for"
    );

    // And behaviourally: composing the very catalog whose actions describe
    // themselves as available yields Degraded fixture constituents — the
    // descriptor never lifts presence.
    let fixtures: ContributionFixtures = serde_json::from_str(raw).expect("fixture must parse");
    let hosted = fixtures
        .contributions
        .into_iter()
        .map(|contribution| host_native_contribution(None, contribution).unwrap())
        .collect::<Vec<_>>();
    assert!(
        hosted
            .iter()
            .any(|entry| entry
                .contribution
                .actions
                .iter()
                .any(|action| action.availability == oi_desktop_core::ActionAvailability::Available)),
        "the catalog still carries available-described actions"
    );
    let reading = CompositionReading::compose(
        None,
        &SuiteCompositionDisclosure {
            schema: "oi.desktop-composition-disclosure/v1".to_owned(),
            personal_ground: None,
            surfaces: Vec::new(),
            warnings: Vec::new(),
        },
        &hosted,
    );
    for constituent in &reading.constituents {
        assert_eq!(
            constituent.state,
            PresenceState::Degraded,
            "{} stays Degraded whatever its action descriptors say",
            constituent.native_owner
        );
        assert_eq!(constituent.provider_class, ProviderClass::Fixture);
    }
}
