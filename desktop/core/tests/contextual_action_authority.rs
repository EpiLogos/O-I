use oi_desktop_core::{
    ActionAuthorityGrant, ActionAuthorityStore, ActionExecutionRequest, BoundedActionGrant,
    SurfaceActionEmission, BOUNDED_ACTION_GRANT_SCHEMA,
};

fn grant(authority_ref: &str, subject_ref: &str) -> BoundedActionGrant {
    BoundedActionGrant {
        schema: BOUNDED_ACTION_GRANT_SCHEMA.into(),
        grant: ActionAuthorityGrant {
            authority_ref: authority_ref.into(),
            action_ref: "factory.action/recognise".into(),
            native_owner: "software-factory".into(),
            capability_ref: Some("capability/factory/recognise".into()),
            capability_grant_ref: Some("capability-grant/recognise".into()),
        },
        issuer_ref: "authority/factory".into(),
        subject_ref: subject_ref.into(),
        binding_revision: "42".into(),
        issued_at_unix_ms: 100,
        expires_at_unix_ms: 10_000,
        max_uses: 1,
        provenance: vec!["Factory native test authority".into()],
    }
}

fn request(subject_ref: &str, operation_id: &str) -> ActionExecutionRequest {
    ActionExecutionRequest {
        operation_id: operation_id.into(),
        emission: SurfaceActionEmission {
            action_ref: "factory.action/recognise".into(),
            subject_ref: subject_ref.into(),
        },
        native_owner: "software-factory".into(),
        required_capability_ref: Some("capability/factory/recognise".into()),
        binding_revision: "42".into(),
        now_unix_ms: 500,
    }
}

#[test]
fn contextual_command_consumes_exactly_matching_preissued_authority() {
    let mut store = ActionAuthorityStore::default();
    store
        .register_trusted(grant("authority/grant-1", "candidate/alpha"))
        .unwrap();

    let authorised = store
        .authorize_matching_and_consume(&request("candidate/alpha", "op-1"))
        .unwrap();

    assert_eq!(authorised.grant_ref, "authority/grant-1");
    assert_eq!(
        authorised.action_grant().action_ref,
        "factory.action/recognise"
    );
    assert_eq!(store.remaining_uses("authority/grant-1"), Some(0));
}

#[test]
fn contextual_command_cannot_turn_discovery_into_authority() {
    let mut store = ActionAuthorityStore::default();
    let error = store
        .authorize_matching_and_consume(&request("candidate/alpha", "op-1"))
        .unwrap_err();
    assert!(error.contains("no already-issued native Action authority"));
}

#[test]
fn contextual_command_rejects_wrong_subject_even_when_action_is_discoverable() {
    let mut store = ActionAuthorityStore::default();
    store
        .register_trusted(grant("authority/grant-1", "candidate/alpha"))
        .unwrap();
    let error = store
        .authorize_matching_and_consume(&request("candidate/beta", "op-1"))
        .unwrap_err();
    assert!(error.contains("no already-issued native Action authority"));
    assert_eq!(store.remaining_uses("authority/grant-1"), Some(1));
}

#[test]
fn contextual_command_fails_closed_when_native_authority_is_ambiguous() {
    let mut store = ActionAuthorityStore::default();
    store
        .register_trusted(grant("authority/grant-1", "candidate/alpha"))
        .unwrap();
    store
        .register_trusted(grant("authority/grant-2", "candidate/alpha"))
        .unwrap();

    let error = store
        .authorize_matching_and_consume(&request("candidate/alpha", "op-1"))
        .unwrap_err();

    assert!(error.contains("multiple native Action authorities"));
    assert_eq!(store.remaining_uses("authority/grant-1"), Some(1));
    assert_eq!(store.remaining_uses("authority/grant-2"), Some(1));
}
