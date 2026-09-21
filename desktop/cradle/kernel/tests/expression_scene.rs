//! Production native operations, not a duplicate test reducer.
use oi_cradle_kernel::{expression::{Application, Request}, CentralClient};
use serde_json::{json, Value};
fn apply(app: &mut Application, value: Value) -> Result<Value, String> {
    app.apply(&CentralClient::discover(), serde_json::from_value::<Request>(value).unwrap()).map(|value| value.0)
}
fn inspect(app: &mut Application) -> Value { apply(app,json!({"operation":"inspect","expression_ref":"expression:craft"})).unwrap()["document"].clone() }
fn edit(app:&mut Application,revision:u64,changes:Value)->Result<Value,String>{
    apply(app,json!({"operation":"edit","expression_ref":"expression:craft","expected_revision":revision,"actor":"human:craft","changes":changes}))
}
fn setup()->Application {
    let mut app=Application::default();
    apply(&mut app,json!({"operation":"create","expression_ref":"expression:craft","title":"Inquiry","actor":"human:craft"})).unwrap();
    edit(&mut app,1,json!([{"change":"entity_add","scene_ref":"expression:craft:scene:main","entity_ref":"expression:craft:entity:one","title":"Source passage"}])).unwrap();app
}
fn material()->Value {json!({"schema":"oi.journey-scene/v1","scene":{
    "id":"expression:craft:scene:main","name":"Main","character":"Attributable investigation", "duration":42,"transition":3,
    "view":{"mode":"3d","yaw":0.3,"pitch":0.1,"zoom":1.2,"panX":0.0,"panY":0.0},
    "field":{"background":"#fafafa","palette":["#111111","#222222"],"material":"ink","params":{"speed":0.75}},
    "engine":{"morphEnabled":true},"morph":{"thetaRate":0.4},"composition":{"layout":"free","plane":"XY"},
    "entities":[{"id":"expression:craft:entity:one","kind":"formation","name":"Passage","position":{"x":0.25,"y":0.0,"z":0.8}}],
    "text":[{"body":"Derived interpretation, not independent evidence"}],"automation":[]
}})}
#[test] fn complete_native_scene_survives_export_open_rename_and_fork() {
    let mut app=setup();let mut body=material();
    // The actual native default scene is called Main.
    let d=inspect(&mut app);body["scene"]["name"]=d["scenes"][0]["title"].clone();
    edit(&mut app,2,json!([{"change":"scene_material_set","scene_ref":"expression:craft:scene:main","presentation":body}])).unwrap();
    let original=inspect(&mut app);assert_eq!(original["scenes"][0]["presentation"],body);
    let mut restart=Application::default();
    let reopened=apply(&mut restart,json!({"operation":"open","document":original,"actor":"human:reopen"})).unwrap();
    assert_eq!(reopened["document"],original);
    let fork=apply(&mut app,json!({"operation":"fork","expression_ref":"expression:craft","expected_revision":3,"new_expression_ref":"expression:variant","actor":"human:craft"})).unwrap();
    let scene=&fork["document"]["scenes"][0]["presentation"]["scene"];
    assert_eq!(scene["id"],"expression:variant:scene:main");
    assert_eq!(scene["entities"][0]["id"],"expression:variant:entity:one");
    assert!(scene.get("semanticField").is_none(),"fork must not manufacture optional material");
    assert_eq!(scene["text"],body["scene"]["text"]);
    edit(&mut app,3,json!([{"change":"scene_rename","scene_ref":"expression:craft:scene:main","title":"The first question"}])).unwrap();
    assert_eq!(inspect(&mut app)["scenes"][0]["presentation"]["scene"]["name"],"The first question");
}
#[test] fn stale_scene_edits_never_replace_a_newer_human_composition() {
    let mut app=setup();edit(&mut app,2,json!([{"change":"scene_rename","scene_ref":"expression:craft:scene:main","title":"Human revision"}])).unwrap();
    let before=inspect(&mut app);
    let result=edit(&mut app,2,json!([{"change":"scene_material_set","scene_ref":"expression:craft:scene:main","presentation":material()}])).unwrap();
    assert_eq!(result["state"],"revision_conflict");assert_eq!(inspect(&mut app),before);
}
#[test] fn malformed_material_unknown_carriers_and_wrong_occurrences_fail_atomically() {
    let mut app=setup();let before=inspect(&mut app);let mut base=material();base["scene"]["name"]=before["scenes"][0]["title"].clone();
    let mut wrong=base.clone();wrong["scene"]["entities"][0]["id"]=json!("expression:other:entity:private");
    let mut remote=base.clone();remote["scene"]["entities"][0]["source"]=json!({"kind":"image","image":{"dataUrl":"https://private.example/photo.png"}});
    let mut script=base.clone();script["scene"]["entities"][0]["source"]=json!({"kind":"image","image":{"dataUrl":"data:image/svg+xml;base64,PHN2Zz4="}});
    let mut unsafe_key=base.clone();unsafe_key["scene"]["field"]["__proto__"]=json!({"polluted":true});
    let mut timing=base.clone();timing["scene"]["duration"]=json!(0);
    for body in [wrong,remote,script,unsafe_key,timing] {
        assert!(edit(&mut app,2,json!([{"change":"scene_material_set","scene_ref":"expression:craft:scene:main","presentation":body}])).is_err());
        assert_eq!(inspect(&mut app),before);
    }
}
#[test] fn removing_a_scene_is_not_deleting_native_members_or_the_last_scene() {
    let mut app=setup();
    assert!(edit(&mut app,2,json!([{"change":"scene_remove","scene_ref":"expression:craft:scene:main"}])).is_err());
    edit(&mut app,2,json!([{"change":"scene_create","scene_ref":"expression:craft:scene:second","title":"Second"},{"change":"scene_compose","scene_ref":"expression:craft:scene:second","entity_refs":["expression:craft:entity:one"]}])).unwrap();
    edit(&mut app,3,json!([{"change":"scene_remove","scene_ref":"expression:craft:scene:main"}])).unwrap();
    let d=inspect(&mut app);assert!(d["entities"]["expression:craft:entity:one"].is_object());assert_eq!(d["selection"]["scene_ref"],"expression:craft:scene:second");
}

#[test] fn generic_native_edits_remain_visible_after_scene_material_is_saved() {
    let mut app=setup();let mut body=material();body["scene"]["name"]=inspect(&mut app)["scenes"][0]["title"].clone();
    edit(&mut app,2,json!([{"change":"scene_material_set","scene_ref":"expression:craft:scene:main","presentation":body}])).unwrap();
    edit(&mut app,3,json!([
        {"change":"parameter_set","entity_ref":"expression:craft:entity:one","parameter":"x","value":200},
        {"change":"parameter_set","entity_ref":"expression:craft:entity:one","parameter":"glyph","value":"Revised"}
    ])).unwrap();
    let d=inspect(&mut app);let entity=&d["scenes"][0]["presentation"]["scene"]["entities"][0];
    assert_eq!(entity["position"]["x"],0.5);assert_eq!(entity["text"],"Revised");
    edit(&mut app,4,json!([{"change":"entity_remove","entity_ref":"expression:craft:entity:one"}])).unwrap();
    let d=inspect(&mut app);assert_eq!(d["scenes"][0]["presentation"]["scene"]["entities"],json!([]));
}

#[test] fn expression_properties_and_title_survive_native_reopen_and_reject_unknown_authority() {
    let mut app=setup();
    let properties=json!({"schema":"oi.journey-properties/v1","description":"Authored interpretation, not independent corroboration","loop":false,
        "shared":{"toolbelt":[],"values":{"field.params.speed":0.2},"pointer":{}}});
    edit(&mut app,2,json!([{"change":"rename","title":"Revised investigation"},{"change":"composition_set","presentation":properties}])).unwrap();
    let original=inspect(&mut app);assert_eq!(original["title"],"Revised investigation");assert_eq!(original["presentation"],properties);
    let mut restart=Application::default();
    assert_eq!(apply(&mut restart,json!({"operation":"open","document":original,"actor":"human:reopen"})).unwrap()["document"],original);
    let mut unsafe_properties=properties.clone();unsafe_properties["shared"]["authority"]=json!("write-anywhere");
    assert!(edit(&mut app,3,json!([{"change":"composition_set","presentation":unsafe_properties}])).is_err());
    assert_eq!(inspect(&mut app),original);
    let stale=edit(&mut app,2,json!([{"change":"rename","title":"Late Agent response"}])).unwrap();
    assert_eq!(stale["state"],"revision_conflict");assert_eq!(inspect(&mut app),original);
}
