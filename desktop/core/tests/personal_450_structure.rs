use oi_desktop_core::{
    ActionAuthorityGrant, ActionAuthorityStore, ActionExecutionRequest, BoundedActionGrant,
    BridgeCallClass, BridgeCaller, BridgePolicy, SurfaceActionEmission,
    BOUNDED_ACTION_GRANT_SCHEMA,
};

#[test]
fn sandboxed_contributions_cannot_cross_personal_or_central_privileged_boundaries() {
    for call in [
        BridgeCallClass::ObserveEpiPersonal,
        BridgeCallClass::WriteEpiNara,
        BridgeCallClass::DispatchEpiNaraAction,
        BridgeCallClass::DispatchEpiPersonalAction,
        BridgeCallClass::ObserveCentralNow,
        BridgeCallClass::InteractAgentSession,
        BridgeCallClass::ObserveKnowledge,
    ] {
        assert!(BridgePolicy.authorize(BridgeCaller::ShellUi, call).is_ok());
        assert!(
            BridgePolicy
                .authorize(BridgeCaller::SandboxedContribution, call)
                .is_err(),
            "sandboxed contribution unexpectedly gained {call:?}"
        );
    }
}

#[test]
fn protected_child_action_consumes_authority_bound_to_stable_episode_parent() {
    let mut store = ActionAuthorityStore::default();
    store
        .register_trusted(BoundedActionGrant {
            schema: BOUNDED_ACTION_GRANT_SCHEMA.into(),
            grant: ActionAuthorityGrant {
                authority_ref: "authority/epi/personal/1".into(),
                action_ref: "epi.action.epii.review".into(),
                native_owner: "epi".into(),
                capability_ref: Some("epi.capability.epii.personal-review".into()),
                capability_grant_ref: Some("capability-grant/epi/review/1".into()),
            },
            issuer_ref: "epi:authority:personal".into(),
            subject_ref: "epi:nara:episode:2026-08-19".into(),
            binding_revision: "epi-revision-1".into(),
            issued_at_unix_ms: 10,
            expires_at_unix_ms: 1_000,
            max_uses: 1,
            provenance: vec!["native Epi authority".into()],
        })
        .unwrap();

    let request = ActionExecutionRequest {
        operation_id: "operation/personal/review/1".into(),
        emission: SurfaceActionEmission {
            action_ref: "epi.action.epii.review".into(),
            subject_ref: "epi:nara:selection:exact-range".into(),
        },
        native_owner: "epi".into(),
        required_capability_ref: Some("epi.capability.epii.personal-review".into()),
        binding_revision: "epi-revision-1".into(),
        now_unix_ms: 100,
    };

    assert!(
        store
            .authorize_and_consume("authority/epi/personal/1", &request)
            .is_err(),
        "generic exact-subject authority must not silently treat the child as its parent"
    );
    let authorised = store
        .authorize_parent_and_consume(
            "authority/epi/personal/1",
            &request,
            "epi:nara:episode:2026-08-19",
        )
        .unwrap();
    assert_eq!(authorised.grant_ref, "authority/epi/personal/1");
    assert_eq!(store.remaining_uses("authority/epi/personal/1"), Some(0));
}

#[test]
fn personal_host_does_not_reintroduce_local_chat_graph_or_parallel_event_runtime() {
    let epi = include_str!("../src/local_epi.rs");
    let tauri = include_str!("../../src-tauri/src/personal.rs");
    assert!(!epi.contains("struct EpiiRuntime"));
    assert!(!epi.contains("struct PersonalEvent"));
    assert!(!tauri.contains("struct EpiiRuntime"));
    assert!(!tauri.contains("struct PersonalEvent"));
    assert!(epi.contains("personal-application"));
    assert!(tauri.contains("knowledge_read"));
    assert!(tauri.contains("return_personal_proposal"));
    assert!(tauri.contains("available_grant_ref"));
    assert!(tauri.contains("authorize_parent_and_consume"));
}
