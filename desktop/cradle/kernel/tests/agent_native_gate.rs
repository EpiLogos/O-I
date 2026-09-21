//! Test-only subprocess peer exercising the production desktop/native attachment gate.
#![cfg(unix)]
use oi_cradle_kernel::agency::{Client, EncounterRequest};
use serde_json::{json, Value};
use std::sync::atomic::{AtomicU32, Ordering};
use std::{fs, os::unix::fs::PermissionsExt, path::PathBuf, time::{SystemTime, UNIX_EPOCH}};

static RIG_SEQ: AtomicU32 = AtomicU32::new(0);
struct Rig { root: PathBuf, executable: PathBuf }
impl Rig {
 fn new() -> Self {
  let stamp=SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos()
            + 0x1000000 * RIG_SEQ.fetch_add(1, Ordering::Relaxed) as u128;
  let root=std::env::temp_dir().join(format!("oi-agent-native-gate-{}-{stamp}",std::process::id()));
  fs::create_dir(&root).unwrap();
  let executable=root.join("controlled-owner");
  let staged=root.join("controlled-owner-staged");
  fs::write(&staged,r#"#!/usr/bin/env python3
import json, pathlib, sys
root=pathlib.Path(__file__).parent
args=sys.argv[1:]
if 'discover' in args:
 print(json.dumps([{'version':'aikit.session-space-application/v1','definition':{'id':'session-space/allowed','projects':['project/allowed']},'agent_sessions':{'agent-session/allowed':{'purpose':'test-only'}}}]))
elif 'encounter' in args:
 request=json.loads(args[-1])
 with (root/'requests.jsonl').open('a') as stream: stream.write(json.dumps(request)+'\n')
 print(json.dumps({'ok':True,'data':request}))
else:
 print('unexpected native operation',file=sys.stderr);sys.exit(2)
"#).unwrap();
  fs::set_permissions(&staged,fs::Permissions::from_mode(0o700)).unwrap();
  fs::rename(&staged,&executable).unwrap();
  Self{root,executable}
 }
 fn call(&self,request:EncounterRequest)->Result<Value,String>{Client::with(self.executable.clone(),None).encounter(&self.root,"project/allowed",&request)}
 fn requests(&self)->Vec<Value>{fs::read_to_string(self.root.join("requests.jsonl")).unwrap_or_default().lines().map(|line|serde_json::from_str(line).unwrap()).collect()}
}
impl Drop for Rig {fn drop(&mut self){let _=fs::remove_dir_all(&self.root);}}
#[test]
fn model_controls_are_carried_verbatim_only_for_an_attached_session() {
 let rig=Rig::new();
 rig.call(EncounterRequest::ModelRead{agent_session:"agent-session/allowed".into()}).unwrap();
 rig.call(EncounterRequest::ModelSelect{agent_session:"agent-session/allowed".into(),provider_model_id:"native/advertised".into(),provider_reasoning_effort:Some("high".into()),expected_native_session_id:"native-exact".into()}).unwrap();
 assert!(rig.call(EncounterRequest::ModelSelect{agent_session:"agent-session/other".into(),provider_model_id:"native/advertised".into(),provider_reasoning_effort:None,expected_native_session_id:"native-exact".into()}).is_err());
 let requests=rig.requests();assert_eq!(requests.len(),2);assert_eq!(requests[1],json!({"action":"model-select","agent_session":"agent-session/allowed","provider_model_id":"native/advertised","provider_reasoning_effort":"high","expected_native_session_id":"native-exact"}));
}
#[test]
fn reconnect_must_match_the_attached_session_space_before_spawning_encounter() {
 let rig=Rig::new();
 assert!(rig.call(EncounterRequest::Reconnect{space:"session-space/other".into(),agent_session:"agent-session/allowed".into(),provider:"eligible".into()}).is_err());
 assert!(rig.call(EncounterRequest::Open{space:"session-space/other".into(),agent_session:"agent-session/allowed".into(),provider:"eligible".into()}).is_err());
 assert!(rig.requests().is_empty());
 rig.call(EncounterRequest::Reconnect{space:"session-space/allowed".into(),agent_session:"agent-session/allowed".into(),provider:"eligible".into()}).unwrap();
 let requests=rig.requests();assert_eq!(requests.len(),1);assert_eq!(requests[0]["action"],"reconnect");assert_eq!(requests[0]["cwd"],rig.root.to_string_lossy().as_ref());
}
#[test]
fn new_model_write_requires_an_observed_native_identity_at_deserialization() {
 assert!(serde_json::from_value::<EncounterRequest>(json!({"action":"model-select","agent_session":"agent-session/allowed","provider_model_id":"native/advertised"})).is_err());
}
