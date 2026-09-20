//! Controlled subprocess owners exercise the production Agent definition bridge.
//! No fixtures enter production; these checks do not assert live-provider use.
#![cfg(unix)]
use oi_cradle_kernel::{
    agency::Client,
    agent_definition::{self, Request},
    flow::CentralClient,
};
use serde_json::{json, Value};
use std::{
    fs,
    os::unix::fs::PermissionsExt,
    path::PathBuf,
    time::{SystemTime, UNIX_EPOCH},
};
struct Rig {
    root: PathBuf,
    executable: PathBuf,
}
impl Rig {
    fn new() -> Self {
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!(
            "oi-agent-definition-{}-{stamp}",
            std::process::id()
        ));
        fs::create_dir(&root).unwrap();
        let executable = root.join("owner");
        fs::write(&executable, r#"#!/usr/bin/env python3
import json,pathlib,sys
root=pathlib.Path(__file__).parent
args=sys.argv[1:]
with (root/'calls').open('a') as f: f.write(json.dumps(args)+'\n')
if 'action' in args:
 op=args[-2];req=json.loads(args[-1])
 if op=='agent-profile.roster': value={'schema':'central.agent-profile-roster/v1','scope_ref':'control:root','profiles':[],'execution_authority_granted':False}
 elif op=='agent-profile.express': value={'profile':{'ref':'agent-profile:allocated'}}
 else: value={'operation':op,'input':req}
 print(json.dumps({'ok':True,'data':value}))
elif 'agent-session-scope' in args:
 print(json.dumps({'schema':'aikit.direct-agent-scope/v1','project_ref':'control:root'}))
elif 'discover' in args:
 print(json.dumps([{'definition':{'id':'session-space/native','projects':['control:root']},'agent_sessions':{'agent-session/native':{}}}]))
else:
 value={'schema':'aikit.direct-agent-session/v1','request_id':'request-12345678','profile_ref':'agent-profile:allocated','agent_ref':'agent:native','agent_session':'agent-session/native','space':'session-space/native','project_ref':'control:root','prepared':True,'provider_started':False,'execution_authority_granted':False}
 if (root/'override.json').exists(): value.update(json.loads((root/'override.json').read_text()))
 print(json.dumps(value))
"#).unwrap();
        fs::set_permissions(&executable, fs::Permissions::from_mode(0o700)).unwrap();
        Self { root, executable }
    }
    fn call(&self, request: Request) -> Result<Value, String> {
        agent_definition::execute(
            &CentralClient::with(
                self.executable.clone(),
                Some(self.root.clone()),
                "MUST-NOT-FALLBACK".into(),
            ),
            &Client::with(self.executable.clone(), None),
            None,
            &self.root,
            &request,
        )
    }
    fn calls(&self) -> Vec<Value> {
        fs::read_to_string(self.root.join("calls"))
            .unwrap_or_default()
            .lines()
            .map(|l| serde_json::from_str(l).unwrap())
            .collect()
    }
    fn prepare() -> Request {
        Request::Prepare {
            request_id: "request-12345678".into(),
            profile_ref: "agent-profile:allocated".into(),
            expected_revision: "r1".into(),
            expected_content_digest: "sha256:source".into(),
            expected_acceptance_ref: "acceptance:source".into(),
        }
    }
}
impl Drop for Rig {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.root);
    }
}
#[test]
fn root_does_not_fallback_to_a_configured_child_and_no_acceptance_is_implied() {
    let rig = Rig::new();
    let value = rig
        .call(Request::Propose {
            name: "Reader".into(),
            purpose: "Keep my exact words.".into(),
            expected_scope_ref: "control:root".into(),
            skill_refs: vec![],
        })
        .unwrap();
    assert_eq!(value["operation"], "agent-profile.review");
    let calls = rig.calls();
    assert_eq!(calls.len(), 3);
    for call in &calls {
        let request: Value =
            serde_json::from_str(call.as_array().unwrap().last().unwrap().as_str().unwrap())
                .unwrap();
        assert!(request.get("project").is_none());
        assert_eq!(request["scope"], "root");
    }
    let request: Value = serde_json::from_str(
        calls[1]
            .as_array()
            .unwrap()
            .last()
            .unwrap()
            .as_str()
            .unwrap(),
    )
    .unwrap();
    assert_eq!(request["ratified_world_refs"], json!(["control:root"]));
    assert_eq!(request["intent_expression"], "Keep my exact words.");
    assert!(!calls.iter().any(|c| c
        .as_array()
        .unwrap()
        .iter()
        .any(|v| v == "agent-profile.accept")));
}
#[test]
fn changed_scope_or_unreviewed_trim_is_refused_before_generation() {
    let rig = Rig::new();
    assert!(rig
        .call(Request::Propose {
            name: "Reader".into(),
            purpose: "Exact".into(),
            expected_scope_ref: "project:other".into(),
            skill_refs: vec![]
        })
        .is_err());
    assert_eq!(rig.calls().len(), 1);
    assert!(rig
        .call(Request::Propose {
            name: "Reader".into(),
            purpose: " Exact ".into(),
            expected_scope_ref: "control:root".into(),
            skill_refs: vec![]
        })
        .is_err());
    assert_eq!(rig.calls().len(), 1);
}
#[test]
fn acceptance_transports_only_the_reviewed_native_basis_not_authority() {
    let rig = Rig::new();
    let value = rig
        .call(Request::Accept {
            profile_ref: "agent-profile:allocated".into(),
            expected_revision: "r1".into(),
            expected_content_digest: "sha256:source".into(),
        })
        .unwrap();
    assert_eq!(value["operation"], "agent-profile.accept");
    assert_eq!(value["input"]["expected_revision"], "r1");
    assert!(value["input"].get("actor").is_none());
    assert!(value["input"].get("credential").is_none());
    for field in ["credential", "actor", "agent_ref", "executable"] {
        let mut request = json!({"action":"accept","profile_ref":"p","expected_revision":"r","expected_content_digest":"d"});
        request[field] = json!("forged");
        assert!(serde_json::from_value::<Request>(request).is_err());
    }
}
#[test]
fn prepared_session_must_be_attached_and_in_the_actual_native_scope() {
    let rig = Rig::new();
    rig.call(Rig::prepare()).unwrap();
    fs::write(
        rig.root.join("override.json"),
        r#"{"space":"session-space/foreign"}"#,
    )
    .unwrap();
    assert!(rig.call(Rig::prepare()).is_err());
    fs::write(
        rig.root.join("override.json"),
        r#"{"project_ref":"project:foreign"}"#,
    )
    .unwrap();
    assert!(rig.call(Rig::prepare()).is_err());
}
#[test]
fn correlation_and_effect_flags_cannot_turn_a_bad_reply_into_success() {
    let rig = Rig::new();
    for patch in [
        json!({"request_id":"other"}),
        json!({"provider_started":true}),
        json!({"prepared":false}),
        json!({"execution_authority_granted":true}),
        json!({"agent_session":"foreign"}),
    ] {
        fs::write(rig.root.join("override.json"), patch.to_string()).unwrap();
        assert!(rig.call(Rig::prepare()).is_err());
    }
}
#[test]
fn readback_uses_the_original_request_and_cannot_invoke_an_arbitrary_cli() {
    let rig = Rig::new();
    rig.call(Request::Find {
        request_id: "request-12345678".into(),
    })
    .unwrap();
    let calls = rig.calls();
    assert!(calls[0]
        .as_array()
        .unwrap()
        .iter()
        .any(|v| v == "agent-session-find"));
    assert!(!calls.iter().any(|c| c
        .as_array()
        .unwrap()
        .iter()
        .any(|v| v == "agent-session-prepare")));
    assert!(Client::with(rig.executable.clone(), None)
        .direct_agent(&rig.root, "credential-delete", None)
        .is_err());
    assert_eq!(rig.calls().len(), calls.len());
}
