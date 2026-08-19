#[cfg(unix)]
#[test]
fn generic_surface_preserves_canonical_agent_session_over_real_acp_process() {
    use aikit_adapters::ConnectionSignalKind;
    use oi_desktop_core::{AgentSurfaceOpenRequest, AikitAgentSurface};

    let script = r#"
import json, sys
session_id = 'provider-session-1'
for line in sys.stdin:
    msg = json.loads(line)
    method = msg.get('method')
    rid = msg.get('id')
    if method == 'initialize':
        print(json.dumps({'jsonrpc':'2.0','id':rid,'result':{'protocolVersion':1,'agentCapabilities':{}}}), flush=True)
    elif method == 'session/new':
        print(json.dumps({'jsonrpc':'2.0','id':rid,'result':{'sessionId':session_id}}), flush=True)
    elif method == 'session/prompt':
        text = msg['params']['prompt'][0]['text']
        print(json.dumps({'jsonrpc':'2.0','method':'session/update','params':{'sessionId':session_id,'update':{'sessionUpdate':'agent_message_chunk','content':{'type':'text','text':'echo: ' + text}}}}), flush=True)
        print(json.dumps({'jsonrpc':'2.0','id':rid,'result':{'stopReason':'end_turn'}}), flush=True)
    elif method == 'session/cancel':
        pass
"#;
    let argv = vec!["python3".into(), "-u".into(), "-c".into(), script.into()];
    let cwd = std::env::current_dir().unwrap().display().to_string();
    let (mut surface, opened) = AikitAgentSurface::open(AgentSurfaceOpenRequest {
        connection_ref: "connection/oi-test/acp".into(),
        agent_session_ref: "agent-session/oi-generic".into(),
        argv,
        cwd,
        mode: None,
        native_session_id: None,
        provenance: vec!["O:I provider-conformance test".into()],
    })
    .unwrap();

    assert_eq!(
        opened.binding.agent_session.as_ref().unwrap().to_string(),
        "agent-session/oi-generic"
    );
    assert_eq!(opened.binding.native_session_id, "provider-session-1");

    let turn = surface.send("same subject").unwrap();
    assert!(turn.iter().any(|signal| matches!(
        &signal.kind,
        ConnectionSignalKind::AgentMessageChunk { text } if text == "echo: same subject"
    )));
    assert!(turn.iter().any(|signal| matches!(
        &signal.kind,
        ConnectionSignalKind::Completed { stop_reason } if stop_reason == "end_turn"
    )));

    surface.cancel().unwrap();
    surface.close().unwrap();
}
