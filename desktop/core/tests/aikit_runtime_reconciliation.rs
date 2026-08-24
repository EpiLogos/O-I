use std::fs;
use std::time::{SystemTime, UNIX_EPOCH};

use aikit_adapters::SessionSpaceFileObservationProvider;
use aikit_core::session_space_application::{
    ReconstructionStatus, SessionSpaceAgentAttachmentIntent, SessionSpaceMutation,
};
use aikit_core::{
    ResourceRef, SessionSpaceAgentSession, SessionSpaceAuthorityState, SessionSpaceConnection,
    SessionSpaceConnectionState, SessionSpaceDefinition, SessionSpaceRef, SessionSpaceRuntime,
};
use aikit_store::{AikitHome, SessionSpaceApplicationStore};
use oi_desktop_core::{LocalAikitSessionSpaceHost, LocalAikitWorkbench};

fn r(raw: &str) -> ResourceRef {
    ResourceRef::parse(raw).unwrap()
}

#[test]
fn desktop_reconciles_real_runtime_rows_but_does_not_infer_agent_continuity() {
    let root = std::env::temp_dir().join(format!(
        "oi-aikit-runtime-{}-{}",
        std::process::id(),
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    fs::create_dir_all(&root).unwrap();
    let observation_path = root.join("runtime.json");

    let home = AikitHome::at(root.join("aikit-home"));
    let store = SessionSpaceApplicationStore::new(home.clone());
    let space = SessionSpaceRef::parse("session-space/workbench-runtime").unwrap();
    let agent_session = r("agent-session/workbench-agent");

    let create = store
        .stage(
            None,
            SessionSpaceMutation::Create {
                id: space.clone(),
                label: Some("Runtime workbench".into()),
            },
        )
        .unwrap();
    store.apply(&create).unwrap();
    let attach = store
        .stage(
            Some(&space),
            SessionSpaceMutation::AttachAgentSession {
                attachment: SessionSpaceAgentAttachmentIntent {
                    agent_session: agent_session.clone(),
                    purpose: Some("generic desktop encounter".into()),
                    provenance: vec!["test canonical attachment".into()],
                },
            },
        )
        .unwrap();
    store.apply(&attach).unwrap();

    let mut runtime =
        SessionSpaceRuntime::open(SessionSpaceDefinition::new(space.clone())).unwrap();
    let lease = runtime
        .bind_agent_session(SessionSpaceAgentSession {
            agent_session: agent_session.clone(),
            harness: r("harness/test"),
            native_session_id: Some("provider-session-7".into()),
            provider: Some(r("provider/test-acp")),
            provenance: vec!["target-owned runtime binding".into()],
        })
        .unwrap();
    runtime
        .observe_connection(
            &lease,
            SessionSpaceConnection {
                connection: r("connection/test-acp/7"),
                provider: r("provider/test-acp"),
                protocol: "acp-v1".into(),
                agent_session: agent_session.clone(),
                component: None,
                surface: None,
                state: SessionSpaceConnectionState::Connected,
                native_session_id: Some("provider-session-7".into()),
                authority: SessionSpaceAuthorityState::default(),
                reason: None,
                provenance: vec!["real SessionSpaceRuntime observation".into()],
            },
        )
        .unwrap();

    SessionSpaceFileObservationProvider::publish(&observation_path, &runtime).unwrap();
    let provider = LocalAikitSessionSpaceHost::open(&observation_path).unwrap();
    let observed = provider.observe().unwrap();
    assert_eq!(observed.read_model.id, space);
    assert_eq!(observed.read_model.agent_sessions.len(), 1);
    assert_eq!(observed.read_model.connections.len(), 1);
    assert_eq!(
        observed.read_model.connections[0]
            .native_session_id
            .as_deref(),
        Some("provider-session-7")
    );

    let desktop = LocalAikitWorkbench::at(home.root());
    let reading = desktop
        .read_session_space_with_runtime(
            "session-space/workbench-runtime",
            Some(&observed.read_model),
        )
        .unwrap();
    assert_eq!(reading.state.id(), &space);
    assert_eq!(reading.runtime.as_ref().unwrap().agent_sessions.len(), 1);
    assert_eq!(reading.runtime.as_ref().unwrap().connections.len(), 1);

    let reconstruction = reading.explanation.reconstruction.unwrap();
    let agent_relation = reconstruction
        .relations
        .iter()
        .find(|relation| {
            relation.relation == "agent-session" && relation.reference == agent_session.to_string()
        })
        .unwrap();
    assert_eq!(agent_relation.status, ReconstructionStatus::Degraded);
    assert!(agent_relation
        .reason
        .as_deref()
        .unwrap()
        .contains("continuity is unproven"));

    fs::remove_dir_all(root).unwrap();
}
