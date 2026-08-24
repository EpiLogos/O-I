use oi_desktop_core::{
    ActionAuthorityGrant, ActionAuthorityStore, ActionExecutionRequest, BoundedActionGrant,
    BridgeCallClass, BridgeCaller, BridgePolicy, SurfaceActionEmission,
    BOUNDED_ACTION_GRANT_SCHEMA,
};
use serde_json::Value;

const ACTION: &str = "action:factory/request-more-evidence";
const CAPABILITY: &str = "capability/factory/request-evidence";
const SUBJECT: &str = "candidate:demo";
const REVISION: &str = "42";

fn bounded_grant(max_uses: u32) -> BoundedActionGrant {
    BoundedActionGrant {
        schema: BOUNDED_ACTION_GRANT_SCHEMA.into(),
        grant: ActionAuthorityGrant {
            authority_ref: "authority/phase4/demo".into(),
            action_ref: ACTION.into(),
            native_owner: "factory".into(),
            capability_ref: Some(CAPABILITY.into()),
            capability_grant_ref: Some("capability-grant/phase4/demo".into()),
        },
        issuer_ref: "aikit/authority-resolution/demo".into(),
        subject_ref: SUBJECT.into(),
        binding_revision: REVISION.into(),
        issued_at_unix_ms: 1_000,
        expires_at_unix_ms: 10_000,
        max_uses,
        provenance: vec!["Phase-4 authority fixture".into()],
    }
}

fn request(operation_id: &str) -> ActionExecutionRequest {
    ActionExecutionRequest {
        operation_id: operation_id.into(),
        emission: SurfaceActionEmission {
            action_ref: ACTION.into(),
            subject_ref: SUBJECT.into(),
        },
        native_owner: "factory".into(),
        required_capability_ref: Some(CAPABILITY.into()),
        binding_revision: REVISION.into(),
        now_unix_ms: 2_000,
    }
}

#[test]
fn discoverable_action_has_zero_execution_authority_without_a_registered_native_grant() {
    let mut store = ActionAuthorityStore::default();
    let error = store
        .authorize_and_consume("authority/phase4/demo", &request("operation/1"))
        .unwrap_err();
    assert!(error.contains("no native Action authority"));
}

#[test]
fn exact_finite_grant_is_consumed_before_privileged_dispatch_and_cannot_be_replayed() {
    let mut store = ActionAuthorityStore::default();
    store.register_trusted(bounded_grant(1)).unwrap();

    let authorised = store
        .authorize_and_consume("authority/phase4/demo", &request("operation/1"))
        .unwrap();
    assert_eq!(authorised.action_grant().action_ref, ACTION);
    assert_eq!(store.remaining_uses("authority/phase4/demo"), Some(0));

    let replay = store
        .authorize_and_consume("authority/phase4/demo", &request("operation/1"))
        .unwrap_err();
    assert!(replay.contains("already consumed"));

    let second = store
        .authorize_and_consume("authority/phase4/demo", &request("operation/2"))
        .unwrap_err();
    assert!(second.contains("exhausted"));
}

#[test]
fn subject_revision_capability_and_operation_substitution_fail_before_use_is_spent() {
    let mut store = ActionAuthorityStore::default();
    store.register_trusted(bounded_grant(1)).unwrap();

    let mut wrong_subject = request("operation/confused-deputy");
    wrong_subject.emission.subject_ref = "candidate:other".into();
    assert!(store
        .authorize_and_consume("authority/phase4/demo", &wrong_subject)
        .unwrap_err()
        .contains("exact Action/owner/subject"));

    let mut wrong_revision = request("operation/stale-revision");
    wrong_revision.binding_revision = "43".into();
    assert!(store
        .authorize_and_consume("authority/phase4/demo", &wrong_revision)
        .unwrap_err()
        .contains("revision"));

    let mut wrong_capability = request("operation/capability-widening");
    wrong_capability.required_capability_ref = Some("capability/factory/admin".into());
    assert!(store
        .authorize_and_consume("authority/phase4/demo", &wrong_capability)
        .unwrap_err()
        .contains("Capability"));

    assert_eq!(store.remaining_uses("authority/phase4/demo"), Some(1));
}

#[test]
fn expiry_and_revocation_fail_closed() {
    let mut expired_store = ActionAuthorityStore::default();
    expired_store.register_trusted(bounded_grant(1)).unwrap();
    let mut expired = request("operation/expired");
    expired.now_unix_ms = 10_000;
    assert!(expired_store
        .authorize_and_consume("authority/phase4/demo", &expired)
        .unwrap_err()
        .contains("expired"));

    let mut revoked_store = ActionAuthorityStore::default();
    revoked_store.register_trusted(bounded_grant(1)).unwrap();
    revoked_store.revoke("authority/phase4/demo").unwrap();
    assert!(revoked_store
        .authorize_and_consume("authority/phase4/demo", &request("operation/revoked"))
        .unwrap_err()
        .contains("revoked"));
}

#[test]
fn rendered_contribution_identity_never_confers_native_bridge_authority() {
    for call in BridgeCallClass::ALL {
        assert!(BridgePolicy
            .authorize(BridgeCaller::SandboxedContribution, call)
            .is_err());
    }
}

#[test]
fn root_webview_has_no_filesystem_shell_process_network_or_frame_capability() {
    let capability: Value = serde_json::from_str(include_str!(
        "../../src-tauri/capabilities/main-window.json"
    ))
    .unwrap();
    assert_eq!(
        capability["permissions"],
        serde_json::json!(["core:default"])
    );

    let config: Value =
        serde_json::from_str(include_str!("../../src-tauri/tauri.conf.json")).unwrap();
    let csp = &config["app"]["security"]["csp"];
    assert_eq!(csp["object-src"], "'none'");
    assert_eq!(csp["frame-src"], "'none'");
    assert_eq!(csp["base-uri"], "'none'");
    assert_eq!(csp["script-src"], "'self'");
    assert_eq!(csp["connect-src"], "ipc: http://ipc.localhost");
}

#[test]
fn declarative_rich_content_surface_does_not_use_raw_html_or_iframe_execution() {
    let ui = include_str!("../../ui/src/main.tsx");
    assert!(!ui.contains("dangerouslySetInnerHTML"));
    assert!(!ui.contains("<iframe"));
    assert!(!ui.contains("srcDoc="));
    assert!(!ui.contains("eval("));
}
