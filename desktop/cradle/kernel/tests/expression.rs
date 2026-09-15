//! Real application state and local transport; no replacement owner or renderer.
use oi_cradle_kernel::{
    expression::{Application, Document, Request},
    CentralClient, Kernel, KernelOp,
};
use serde_json::{json, Value};
fn request(value: Value) -> Request {
    serde_json::from_value(value).unwrap()
}
fn apply(app: &mut Application, value: Value) -> Value {
    app.apply(&CentralClient::discover(), request(value))
        .unwrap()
        .0
}
fn create(app: &mut Application) -> Value {
    apply(
        app,
        json!({"operation":"create","expression_ref":"expression:test","title":"Lesson","actor":"agent:test"}),
    )
}
fn edit(app: &mut Application, revision: u64, changes: Value) -> Value {
    apply(
        app,
        json!({"operation":"edit","expression_ref":"expression:test","expected_revision":revision,"actor":"human:test","changes":changes}),
    )
}
fn entity() -> Value {
    json!({"change":"entity_add","scene_ref":"expression:test:scene:main","entity_ref":"expression:test:entity:a","title":"Subject"})
}
#[test]
fn composition_focus_roles_relations_and_fork_retain_native_identity() {
    let mut app = Application::default();
    create(&mut app);
    let data = edit(
        &mut app,
        1,
        json!([entity(),{"change":"subject_bind","entity_ref":"expression:test:entity:a","binding":{"subject_ref":"wiki:node:lesson","native_owner":"ai-kit","presentation_role":"being","sources":[{"ref":"source:lesson","revision":"r8","availability":"available"}],"readings":[],"actions":[]}},{"change":"focus","scene_ref":"expression:test:scene:main","entity_ref":"expression:test:entity:a"}]),
    );
    assert_eq!(data["document"]["revision"], 2);
    assert_eq!(
        data["document"]["entities"]["expression:test:entity:a"]["revision"],
        2
    );
    let data = edit(
        &mut app,
        2,
        json!([{"change":"scene_create","scene_ref":"expression:test:scene:second","title":"Second"},{"change":"scene_compose","scene_ref":"expression:test:scene:second","entity_refs":["expression:test:entity:a"]},{"change":"scene_reorder","scene_refs":["expression:test:scene:second","expression:test:scene:main"]},{"change":"relation_bind","binding":{"binding_ref":"expression:test:relation:one","relation":{"ref":"wiki:edge:real","revision":"9","availability":"available"},"from_entity_ref":"expression:test:entity:a","to_entity_ref":"expression:test:entity:a","provenance":[]}}]),
    );
    assert_eq!(data["document"]["scenes"][0]["title"], "Second");
    assert_eq!(
        data["document"]["entities"]["expression:test:entity:a"]["revision"],
        2
    );
    let fork = apply(
        &mut app,
        json!({"operation":"fork","expression_ref":"expression:test","expected_revision":3,"new_expression_ref":"expression:fork","actor":"agent:test"}),
    );
    assert_eq!(
        fork["document"]["entities"]["expression:fork:entity:a"]["subject"]["subject_ref"],
        "wiki:node:lesson"
    );
    assert_eq!(
        fork["document"]["relations"]["expression:fork:relation:one"]["relation"]["ref"],
        "wiki:edge:real"
    );
    assert_eq!(fork["document"]["provenance"][0]["revision"], "3");
    let export = apply(
        &mut app,
        json!({"operation":"export","expression_ref":"expression:test","expected_revision":3}),
    );
    assert_eq!(export["document"], data["document"]);
    assert_eq!(export["audience"], "local_private");
    let mut fresh = Application::default();
    let reopened = apply(
        &mut fresh,
        json!({"operation":"open","document":export["document"],"actor":"agent:fresh"}),
    );
    assert_eq!(reopened["document"], data["document"]);
    assert_eq!(reopened["dynamic_state"], "not_restored");
}
#[test]
fn edits_are_atomic_and_stale_concurrent_inputs_do_not_overwrite() {
    let mut app = Application::default();
    create(&mut app);
    edit(&mut app, 1, json!([entity()]));
    let before = apply(
        &mut app,
        json!({"operation":"inspect","expression_ref":"expression:test"}),
    );
    for bad in [
        json!({"change":"focus","scene_ref":"expression:test:scene:absent","entity_ref":null}),
        json!({"change":"parameter_set","entity_ref":"expression:test:entity:a","parameter":"scale","value":100}),
        json!({"change":"parameter_set","entity_ref":"expression:test:entity:a","parameter":"__proto__","value":1}),
    ] {
        let input = request(
            json!({"operation":"edit","expression_ref":"expression:test","expected_revision":2,"actor":"agent:test","changes":[{"change":"scene_create","scene_ref":"expression:test:scene:never","title":"Never"},bad]}),
        );
        assert!(app.apply(&CentralClient::discover(), input).is_err());
        assert_eq!(
            before,
            apply(
                &mut app,
                json!({"operation":"inspect","expression_ref":"expression:test"})
            )
        );
    }
    let stale = edit(
        &mut app,
        1,
        json!([{"change":"entity_remove","entity_ref":"expression:test:entity:a"}]),
    );
    assert_eq!(stale["state"], "revision_conflict");
    assert_eq!(stale["current_revision"], 2);
    assert_eq!(edit(&mut app, 2, json!([]))["document"]["revision"], 2);
    assert_eq!(
        edit(
            &mut app,
            2,
            json!([{"change":"focus","scene_ref":"expression:test:scene:main","entity_ref":null}])
        )["document"]["revision"],
        2
    );
}
#[test]
fn automation_requires_explicit_manual_takeover_and_bounded_material() {
    let mut app = Application::default();
    create(&mut app);
    edit(
        &mut app,
        1,
        json!([entity(),{"change":"parameter_set","entity_ref":"expression:test:entity:a","parameter":"scale","value":1},{"change":"parameter_automate","entity_ref":"expression:test:entity:a","parameter":"scale","automation":{"min":0.5,"max":1.5,"rate_hz":0.2,"waveform":"sine"}}]),
    );
    assert!(app.apply(&CentralClient::discover(),request(json!({"operation":"edit","expression_ref":"expression:test","expected_revision":2,"actor":"human:test","changes":[{"change":"parameter_set","entity_ref":"expression:test:entity:a","parameter":"scale","value":2}]}))).is_err());
    let result = edit(
        &mut app,
        2,
        json!([{"change":"parameter_manual","entity_ref":"expression:test:entity:a","parameter":"scale"},{"change":"parameter_set","entity_ref":"expression:test:entity:a","parameter":"scale","value":2}]),
    );
    assert_eq!(
        result["document"]["entities"]["expression:test:entity:a"]["parameters"]["scale"],
        json!({"value":2,"automation":null})
    );
}
#[test]
fn unknown_fields_and_undisclosed_actions_fail_closed() {
    // JSON integers must retain exact identity through the TypeScript face.
    let mut bounded = Application::default();
    let mut document = create(&mut bounded)["document"].clone();
    document["revision"] = json!(9_007_199_254_740_992_u64);
    let mut fresh = Application::default();
    assert!(fresh
        .apply(
            &CentralClient::discover(),
            request(json!({
                "operation":"open", "document":document, "actor":"agent:test"
            }))
        )
        .is_err());
    document["revision"] = json!(9_007_199_254_740_991_u64);
    apply(
        &mut fresh,
        json!({"operation":"open", "document":document, "actor":"agent:test"}),
    );
    assert!(fresh.apply(&CentralClient::discover(), request(json!({
        "operation":"edit", "expression_ref":"expression:test",
        "expected_revision":9_007_199_254_740_991_u64, "actor":"agent:test", "changes":[entity()]
    }))).is_err());
    assert_eq!(
        apply(
            &mut fresh,
            json!({"operation":"inspect", "expression_ref":"expression:test"})
        )["document"],
        document
    );
    assert!(serde_json::from_value::<Request>(json!({"operation":"create","expression_ref":"expression:a","title":"A","actor":"agent:a","authority":true})).is_err());
    let mut app = Application::default();
    let mut d = create(&mut app)["document"].clone();
    d["private_nara_state"] = json!("sentinel");
    assert!(serde_json::from_value::<Document>(d).is_err());
    edit(&mut app, 1, json!([entity()]));
    assert!(app.apply(&CentralClient::discover(),request(json!({"operation":"invoke","expression_ref":"expression:test","expected_revision":2,"entity_ref":"expression:test:entity:a","action_ref":"central.day.lifecycle","input":null,"project":null}))).is_err());
}
#[test]
fn kernel_emits_one_attributed_receipt_only_when_draft_changes() {
    let mut k = Kernel::discover();
    let output=k.apply(KernelOp::Expression{request:request(json!({"operation":"create","expression_ref":"expression:test","title":"A","actor":"agent:composer"}))}).unwrap();
    assert_eq!(output.receipts.len(), 1);
    let receipt = serde_json::to_value(&output.receipts[0]).unwrap();
    assert_eq!(receipt["actor"], "agent:composer");
    assert_eq!(receipt["event"], "expression_changed");
    let read = k
        .apply(KernelOp::Expression {
            request: Request::Inspect {
                expression_ref: "expression:test".into(),
            },
        })
        .unwrap();
    assert!(read.receipts.is_empty());
    let unchanged=k.apply(KernelOp::Expression{request:request(json!({"operation":"edit","expression_ref":"expression:test","expected_revision":1,"actor":"human:test","changes":[]}))}).unwrap();
    assert!(unchanged.receipts.is_empty());
}
#[cfg(unix)]
#[test]
fn native_socket_and_human_kernel_share_one_state_and_reject_foreign_protocol() {
    use oi_cradle_kernel::expression_transport::{call, serve};
    use std::{
        io::Write,
        os::unix::{fs::PermissionsExt, net::UnixStream},
        sync::{Arc, Mutex},
    };
    let path = std::env::temp_dir().join(format!(
        "ex1-{}-{}.sock",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    let kernel = Arc::new(Mutex::new(Kernel::discover()));
    let owner = kernel.clone();
    let server = serve(&path, move |request| {
        serde_json::to_value(
            owner
                .lock()
                .unwrap()
                .apply(KernelOp::Expression { request })?,
        )
        .map_err(|e| e.to_string())
    })
    .unwrap();
    assert_eq!(
        std::fs::metadata(&path).unwrap().permissions().mode() & 0o777,
        0o600
    );
    let made=call(&path,&request(json!({"operation":"create","expression_ref":"expression:test","title":"From Agent","actor":"agent:fresh"}))).unwrap();
    assert_eq!(made["outcome"]["data"]["document"]["title"], "From Agent");
    let mut human = kernel.lock().unwrap();
    human.apply(KernelOp::Expression{request:request(json!({"operation":"edit","expression_ref":"expression:test","expected_revision":1,"actor":"human:test","changes":[entity()]}))}).unwrap();
    drop(human);
    let observed = call(
        &path,
        &Request::Inspect {
            expression_ref: "expression:test".into(),
        },
    )
    .unwrap();
    assert_eq!(observed["outcome"]["data"]["document"]["revision"], 2);
    let mut foreign = UnixStream::connect(&path).unwrap();
    writeln!(foreign, "{{\"op\":\"invoke_action\"}}").unwrap();
    let mut response = String::new();
    std::io::Read::read_to_string(&mut foreign, &mut response).unwrap();
    assert_eq!(
        serde_json::from_str::<Value>(&response).unwrap()["ok"],
        false
    );
    drop(server);
    assert!(!path.exists());
}
#[test]
#[ignore = "requires OI_CENTRAL_CTRL_BIN naming a real current Central executable"]
fn real_central_save_conflict_and_authority_refusal() {
    use std::{fs, path::PathBuf};
    let root = std::env::temp_dir().join(format!("ex1-ground-{}", std::process::id()));
    fs::create_dir(&root).unwrap();
    let client = CentralClient::with(
        PathBuf::from(std::env::var_os("OI_CENTRAL_CTRL_BIN").expect("real Central executable")),
        Some(root.clone()),
        "".into(),
    );
    client.run("central.init", json!({})).unwrap();
    fs::create_dir(root.join("Work/Expressions")).unwrap();
    let mut app = Application::default();
    let d = create(&mut app)["document"].clone();
    fs::write(
        root.join("Work/Expressions/lesson.json"),
        serde_json::to_string(&d).unwrap(),
    )
    .unwrap();
    let directory = oi_cradle_kernel::files::list(&client, "Work/Expressions").unwrap();
    let location = directory.entries[0].location.clone();
    let file = oi_cradle_kernel::files::read(&client, &location).unwrap();
    edit(&mut app, 1, json!([entity()]));
    let save = request(
        json!({"operation":"save","expression_ref":"expression:test","expected_revision":2,"location":location,"expected_file_revision":file.revision,"actor":"agent:test","actor_kind":"agent"}),
    );
    let result = app.apply(&client, save.clone()).unwrap().0;
    assert_eq!(result["state"], "saved", "{result}");
    assert_eq!(
        serde_json::from_str::<Value>(
            &fs::read_to_string(root.join("Work/Expressions/lesson.json")).unwrap()
        )
        .unwrap()["revision"],
        2
    );
    let result = app.apply(&client, save).unwrap().0;
    assert_eq!(result["state"], "file_revision_conflict");
    edit(
        &mut app,
        2,
        json!([{"change":"subject_bind","entity_ref":"expression:test:entity:a","binding":{"subject_ref":"control:root","native_owner":"central","presentation_role":"thing","sources":[],"readings":[],"actions":[{"action_ref":"central.day.lifecycle","target_ref":"control:root","authority_requirement":"Central native authority"}]}}]),
    );
    let denied=app.apply(&client,request(json!({"operation":"invoke","expression_ref":"expression:test","expected_revision":3,"entity_ref":"expression:test:entity:a","action_ref":"central.day.lifecycle","input":{},"project":null}))).unwrap().0;
    assert_eq!(denied["dispatch"]["state"], "owner_refused", "{denied}");
    assert!(denied["dispatch"]["message"].as_str().unwrap().len() > 5);
    let (reopen, _) = app
        .apply(
            &client,
            request(json!({"operation":"open_file","location":location,"actor":"human:test"})),
        )
        .unwrap();
    assert_eq!(reopen["state"], "revision_conflict");
    let still_dirty = apply(
        &mut app,
        json!({"operation":"inspect","expression_ref":"expression:test"}),
    );
    assert_eq!(still_dirty["dirty"], true);
    assert_eq!(still_dirty["saved_revision"], 2);
    assert_eq!(
        still_dirty["file"]["location"],
        serde_json::to_value(&location).unwrap()
    );
    let direct = oi_cradle_kernel::action::invoke(
        &client,
        &root,
        None,
        &oi_cradle_kernel::action::ActionInvocation {
            action: "central.day.lifecycle".into(),
            target_ref: "control:root".into(),
            input: Some(json!({})),
        },
    );
    assert_eq!(denied["dispatch"], serde_json::to_value(direct).unwrap());
    fs::remove_dir_all(root).unwrap();
}

#[test]
fn focus_projects_the_native_subject_without_invoking_it() {
    let mut k = Kernel::discover();
    k.apply(KernelOp::Expression{request:request(json!({"operation":"create","expression_ref":"expression:test","title":"A","actor":"agent:test"}))}).unwrap();
    let changes = json!([entity(),{"change":"subject_bind","entity_ref":"expression:test:entity:a","binding":{"subject_ref":"wiki:node:subject","native_owner":"ai-kit","presentation_role":"being","sources":[],"readings":[],"actions":[]}},{"change":"focus","scene_ref":"expression:test:scene:main","entity_ref":"expression:test:entity:a"}]);
    let outcome=k.apply(KernelOp::Expression{request:request(json!({"operation":"edit","expression_ref":"expression:test","expected_revision":1,"actor":"human:test","changes":changes}))}).unwrap();
    assert_eq!(
        k.snapshot().focus.subject_ref().unwrap().ref_id,
        "wiki:node:subject"
    );
    assert_eq!(outcome.receipts.len(), 2);
    let before = k.snapshot().focus;
    k.apply(KernelOp::Expression{request:request(json!({"operation":"edit","expression_ref":"expression:test","expected_revision":1,"actor":"agent:stale","changes":[{"change":"focus","scene_ref":"expression:test:scene:main","entity_ref":null}]}))}).unwrap();
    assert_eq!(k.snapshot().focus, before);
}

#[test]
fn unavailable_bindings_and_wrong_targets_cannot_invoke() {
    let mut app = Application::default();
    create(&mut app);
    edit(
        &mut app,
        1,
        json!([entity(),{"change":"subject_bind","entity_ref":"expression:test:entity:a","binding":{"subject_ref":"control:root","native_owner":"central","presentation_role":"thing","sources":[],"readings":[{"ref":"reading:absent","revision":"1","availability":"unavailable"}],"actions":[{"action_ref":"central.day.lifecycle","target_ref":"control:root","authority_requirement":"native grant"}]}}]),
    );
    let result = apply(
        &mut app,
        json!({"operation":"invoke","expression_ref":"expression:test","expected_revision":2,"entity_ref":"expression:test:entity:a","action_ref":"central.day.lifecycle","input":null,"project":null}),
    );
    assert_eq!(result["state"], "binding_unavailable");
    let mut d = apply(
        &mut app,
        json!({"operation":"inspect","expression_ref":"expression:test"}),
    )["document"]
        .clone();
    d["entities"]["expression:test:entity:a"]["subject"]["actions"][0]["target_ref"] =
        json!("control:other");
    assert!(serde_json::from_value::<Document>(d)
        .unwrap()
        .validate()
        .is_err());
}
