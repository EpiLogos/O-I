#[cfg(unix)]
#[test]
fn generic_surface_preserves_canonical_agent_session_over_real_acp_process() {
    use aikit_adapters::ConnectionSignalKind;

    let (mut surface, opened) = open_fixture_surface(
        "connection/oi-test/acp",
        "agent-session/oi-generic",
        "provider-session-1",
        "echo-a: ",
    );

    assert_eq!(
        opened.binding.agent_session.as_ref().unwrap().to_string(),
        "agent-session/oi-generic"
    );
    assert_eq!(opened.binding.native_session_id, "provider-session-1");

    let turn = surface.send("same subject").unwrap();
    assert!(turn.iter().any(|signal| matches!(
        &signal.kind,
        ConnectionSignalKind::AgentMessageChunk { text } if text == "echo-a: same subject"
    )));
    assert!(turn.iter().any(|signal| matches!(
        &signal.kind,
        ConnectionSignalKind::Completed { stop_reason } if stop_reason == "end_turn"
    )));

    surface.cancel().unwrap();
    surface.close().unwrap();
}

#[cfg(unix)]
#[test]
fn provider_rebind_changes_native_identity_without_renaming_agent_session() {
    let canonical = "agent-session/oi-rebind";
    let (mut first, first_opened) = open_fixture_surface(
        "connection/provider-a/acp",
        canonical,
        "native-provider-a-17",
        "provider-a: ",
    );
    assert_eq!(
        first_opened.binding.agent_session.as_ref().unwrap().to_string(),
        canonical
    );
    assert_eq!(first_opened.binding.native_session_id, "native-provider-a-17");
    assert_eq!(
        first_opened.descriptor.connection_ref.to_string(),
        "connection/provider-a/acp"
    );
    first.close().unwrap();

    let (mut second, second_opened) = open_fixture_surface(
        "connection/provider-b/acp",
        canonical,
        "native-provider-b-92",
        "provider-b: ",
    );
    assert_eq!(
        second_opened.binding.agent_session.as_ref().unwrap().to_string(),
        canonical
    );
    assert_eq!(second_opened.binding.native_session_id, "native-provider-b-92");
    assert_eq!(
        second_opened.descriptor.connection_ref.to_string(),
        "connection/provider-b/acp"
    );
    assert_ne!(
        first_opened.binding.native_session_id,
        second_opened.binding.native_session_id
    );
    assert_ne!(
        first_opened.descriptor.connection_ref,
        second_opened.descriptor.connection_ref
    );

    // This is provider-rebind conformance, not an AgentSession continuity claim:
    // the canonical identity is supplied independently to both native providers.
    second.close().unwrap();
}

#[cfg(unix)]
fn open_fixture_surface(
    connection_ref: &str,
    agent_session_ref: &str,
    native_session_id: &str,
    response_prefix: &str,
) -> (oi_desktop_core::AikitAgentSurface, oi_desktop_core::AgentSurfaceReading) {
    use oi_desktop_core::{AgentSurfaceOpenRequest, AikitAgentSurface};

    let script = format!(
        r#"
import json, sys
session_id = {session_id:?}
prefix = {prefix:?}
for line in sys.stdin:
    msg = json.loads(line)
    method = msg.get('method')
    rid = msg.get('id')
    if method == 'initialize':
        print(json.dumps({{'jsonrpc':'2.0','id':rid,'result':{{'protocolVersion':1,'agentCapabilities':{{}}}}}}), flush=True)
    elif method == 'session/new':
        print(json.dumps({{'jsonrpc':'2.0','id':rid,'result':{{'sessionId':session_id}}}}), flush=True)
    elif method == 'session/prompt':
        text = msg['params']['prompt'][0]['text']
        print(json.dumps({{'jsonrpc':'2.0','method':'session/update','params':{{'sessionId':session_id,'update':{{'sessionUpdate':'agent_message_chunk','content':{{'type':'text','text':prefix + text}}}}}}}}), flush=True)
        print(json.dumps({{'jsonrpc':'2.0','id':rid,'result':{{'stopReason':'end_turn'}}}}), flush=True)
    elif method == 'session/cancel':
        pass
"#,
        session_id = native_session_id,
        prefix = response_prefix,
    );
    let argv = vec!["python3".into(), "-u".into(), "-c".into(), script];
    let cwd = std::env::current_dir().unwrap().display().to_string();
    AikitAgentSurface::open(AgentSurfaceOpenRequest {
        connection_ref: connection_ref.into(),
        agent_session_ref: agent_session_ref.into(),
        argv,
        cwd,
        mode: None,
        native_session_id: None,
        provenance: vec!["O:I provider-conformance test".into()],
    })
    .unwrap()
}
