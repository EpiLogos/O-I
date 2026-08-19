use oi_desktop_core::{
    ContributionAvailability, LocalEpiCosmicHost, EPI_COSMIC_OPEN_DEPTH_ACTION_REF,
    EPI_COSMIC_PRODUCT_ID, EPI_CURRENT_SITUATED_SCHEMA, EPI_NATIVE_OWNER,
    EPI_PERSONAL_PRODUCT_ID,
};
use serde_json::json;
use std::env;

const EVENT_AT: u64 = 1_725_000_000_000;

fn degraded_fixture_request() -> serde_json::Value {
    json!({
        "eventAtUnixMs": EVENT_AT,
        "personalIdentity": {
            "qPersonal": [1.0, 0.0, 0.0, 0.0],
            "natalChartHandle": "protected:natal:oi-ci",
            "elementalBalance": {
                "earth": 0.25,
                "fire": 0.25,
                "water": 0.25,
                "air": 0.25
            },
            "identityHash": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
            "privacyClass": "protected-local-derived"
        },
        "activity": {
            "activityRef": "epi:activity:oi-ci",
            "qActivity": [0.0, 0.0, 1.0, 0.0],
            "observedAtUnixMs": EVENT_AT,
            "sourceClass": "protected-nara-activity"
        },
        "worldCondition": {
            "observationRef": "fixture:sky:oi-ci",
            "observationClass": "fixture",
            "providerRef": "fixture:sky-provider",
            "providerRevision": "fixture-revision-1",
            "observedAtUnixMs": EVENT_AT,
            "observerRef": "observer:earth:ci",
            "qTransit": [0.0, 1.0, 0.0, 0.0],
            "qTransitSourceRef": "fixture:q-transit:oi-ci",
            "solar": {
                "body": "Sun",
                "longitudeDegrees": 156.25,
                "retrograde": false,
                "sign": "Virgo",
                "decan": 15,
                "sourceRef": "fixture:sky:sun"
            },
            "planets": [{
                "body": "Moon",
                "longitudeDegrees": 90.0,
                "retrograde": false,
                "sign": "Cancer",
                "decan": 9,
                "sourceRef": "fixture:sky:moon"
            }],
            "correspondenceRefs": ["fixture:correspondence:oi-ci"]
        }
    })
}

#[test]
fn real_epi_current_situated_process_hosts_when_coordinated_binary_is_supplied() {
    let Some(binary) = env::var_os("EPI_BRIDGE_BIN") else {
        eprintln!(
            "EPI_BRIDGE_BIN not supplied; cross-repository acceptance is exercised by the dedicated workflow"
        );
        return;
    };
    let context = env::var_os("EPI_NARA_CONTEXT")
        .expect("dedicated workflow must provide protected Nara context");

    let observation = LocalEpiCosmicHost::open(binary)
        .with_nara_context_file(context)
        .current(degraded_fixture_request())
        .expect("real Epi Current Situated producer must host opaquely");

    assert_eq!(
        observation
            .reading
            .pointer("/event/schema")
            .and_then(|value| value.as_str()),
        Some(EPI_CURRENT_SITUATED_SCHEMA)
    );
    assert_eq!(
        observation
            .reading
            .pointer("/cosmic/productId")
            .and_then(|value| value.as_str()),
        Some(EPI_COSMIC_PRODUCT_ID)
    );
    assert_eq!(
        observation
            .reading
            .pointer("/event/personal/productId")
            .and_then(|value| value.as_str()),
        Some(EPI_PERSONAL_PRODUCT_ID)
    );
    assert_eq!(
        observation
            .reading
            .pointer("/event/m2/status")
            .and_then(|value| value.as_str()),
        Some("degraded"),
        "fixture world state must never become live-now merely by entering O:I"
    );
    assert_eq!(
        observation.contribution.contribution.native_owner,
        EPI_NATIVE_OWNER
    );
    assert_eq!(
        observation.contribution.contribution.availability,
        ContributionAvailability::Degraded
    );
    assert!(observation
        .contribution
        .contribution
        .actions
        .iter()
        .any(|action| action.action_ref == EPI_COSMIC_OPEN_DEPTH_ACTION_REF));

    let event_ref = observation
        .reading
        .pointer("/event/eventRef")
        .and_then(|value| value.as_str())
        .unwrap();
    assert_eq!(
        observation
            .reading
            .pointer("/cosmic/eventRef")
            .and_then(|value| value.as_str()),
        Some(event_ref)
    );
    assert_eq!(
        observation
            .reading
            .pointer("/event/personal/eventRef")
            .and_then(|value| value.as_str()),
        Some(event_ref)
    );
    assert_eq!(
        observation
            .reading
            .pointer("/event/personal/episodeRef")
            .and_then(|value| value.as_str()),
        Some("epi:episode:oi-ci")
    );
    assert_eq!(
        observation
            .reading
            .pointer("/cosmic/deepSurfaces/0/completionClaimed")
            .and_then(|value| value.as_bool()),
        Some(false)
    );
    assert_eq!(
        observation
            .reading
            .pointer("/cosmic/deepSurfaces/1/completionClaimed")
            .and_then(|value| value.as_bool()),
        Some(false)
    );
    assert_eq!(
        observation
            .reading
            .pointer("/cosmic/deepSurfaces/2/completionClaimed")
            .and_then(|value| value.as_bool()),
        Some(false)
    );
}

#[test]
fn host_body_does_not_reimplement_epi_semantics_or_fake_react_depth() {
    let source = include_str!("../src/local_epi_cosmic.rs");
    for forbidden in [
        "MathemeHarmonicProfile",
        "compose_personal_quaternion",
        "Kerykeion",
        "React",
        "CosmicSurface.tsx",
    ] {
        assert!(
            !source.contains(forbidden),
            "O:I Cosmic adapter must not reimplement or fabricate {forbidden}"
        );
    }
}
