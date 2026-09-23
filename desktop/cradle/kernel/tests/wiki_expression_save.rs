//! Strict destination-owner boundary. The final joined browser test separately
//! executes actual Central; this process fixture detects injected scope fields.
#![cfg(unix)]
#[path = "support/stub.rs"]
mod stub;
use oi_cradle_kernel::{
    expression::{Application, Request},
    CentralClient,
};
use serde_json::{json, Value};
use std::{
    fs,
    os::unix::fs::PermissionsExt,
    path::PathBuf,
    time::{SystemTime, UNIX_EPOCH},
};

struct Fixture(PathBuf);
impl Fixture {
    fn new() -> Self {
        let root = std::env::temp_dir().join(format!(
            "wiki-save-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&root).unwrap();
        fs::write(root.join("owner"), r#"#!/usr/bin/env python3
import json, pathlib, sys
root=pathlib.Path(__file__).parent
name=sys.argv[-2]; request=json.loads(sys.argv[-1])
def answer(data):
 print(json.dumps({'ok':True,'data':data}))
if name=='central.files.create':
 (root/'request.json').write_text(json.dumps(request))
 allowed={'parent','name','content','expected_absent','operation_ref','actor','actor_kind','agent_session_ref'}
 if set(request)-allowed:
  print(json.dumps({'ok':False,'error':{'message':'Unknown ordinary-file creation field'}}));sys.exit(2)
 path=root/request['name']
 if path.exists():
  print(json.dumps({'ok':False,'error':{'message':'Existing destination is not overwritten'}}));sys.exit(2)
 path.write_text(request['content'])
 location=dict(request['parent'],path=request['name'],ref='central:path:artifact')
 (root/'location.json').write_text(json.dumps(location))
 answer({'schema':'central.file-mutation/v1','outcome':'created','location':location,'revision':'file-r1','changed':True})
elif name=='central.files.read':
 answer({'schema':'central.file-reading/v1','location':request['location'],'revision':'file-r1','byte_len':len((root/request['location']['path']).read_bytes()),'content_encoding':'utf-8','content':(root/request['location']['path']).read_text(),'project':None,'source':None,'automatic_agent_or_model_invocation':False})
else:
 raise AssertionError(name)
"#).unwrap();
        fs::set_permissions(root.join("owner"), fs::Permissions::from_mode(0o700)).unwrap();
        stub::settle_stub(&root.join("owner"));
        Self(root)
    }
}
impl Drop for Fixture {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}
fn operation(app: &mut Application, client: &CentralClient, request: Value) -> Value {
    app.apply(client, serde_json::from_value::<Request>(request).unwrap())
        .unwrap()
        .0
}
#[test]
fn first_expression_save_uses_the_selected_directory_not_the_default_project() {
    let fixture = Fixture::new();
    let client = CentralClient::with(
        fixture.0.join("owner"),
        Some(fixture.0.clone()),
        "unrelated-configured-project".into(),
    );
    let mut app = Application::default();
    let created = operation(
        &mut app,
        &client,
        json!({"operation":"create","expression_ref":"expression:exact","title":"Exact source","actor":"human:test"}),
    );
    let parent = json!({"schema":"central.path-ref/v1","ref":"central:path:directory","root":fixture.0,"path":""});
    let saved = operation(
        &mut app,
        &client,
        json!({"operation":"save_as","expression_ref":"expression:exact","expected_revision":1,"parent":parent,"name":"work.expression.json","operation_ref":"operation:save","actor":"human:test","actor_kind":"human"}),
    );
    assert_eq!(saved["state"], "saved", "{saved}");
    assert_eq!(saved["persisted"], true);
    assert_eq!(saved["readback_verified"], true);
    let received: Value =
        serde_json::from_slice(&fs::read(fixture.0.join("request.json")).unwrap()).unwrap();
    assert!(
        received.get("project").is_none(),
        "file creation is root/destination addressed: {received}"
    );
    assert_eq!(received["parent"], parent);
    let file: Value =
        serde_json::from_slice(&fs::read(fixture.0.join("work.expression.json")).unwrap()).unwrap();
    assert_eq!(file, created["document"]);
    let current = operation(
        &mut app,
        &client,
        json!({"operation":"inspect","expression_ref":"expression:exact"}),
    );
    assert_eq!(current["dirty"], false);
    assert_eq!(current["document"], created["document"]);
    let before = fs::read(fixture.0.join("work.expression.json")).unwrap();
    let refused = operation(
        &mut app,
        &client,
        json!({"operation":"save_as","expression_ref":"expression:exact","expected_revision":1,"parent":parent,"name":"work.expression.json","operation_ref":"operation:other","actor":"human:test","actor_kind":"human"}),
    );
    assert_eq!(refused["state"], "save_refused");
    assert_eq!(
        refused["failure"]["message"],
        "Existing destination is not overwritten"
    );
    assert_eq!(
        fs::read(fixture.0.join("work.expression.json")).unwrap(),
        before
    );
}
