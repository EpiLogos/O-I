//! Live proof of the reusable-material register through the real Central
//! owner (contract EXPRESSION-ACT-MATERIAL-V1 §1): `reuse_set` + `save_as`
//! into the register, discovery by `material_list`, and an act selecting the saved material by Central file ref. Ignored by
//! default: it needs an installed Central and writes (then removes) one file
//! in the register. Run: `cargo test --test expression_material_live -- --ignored`.
use oi_cradle_kernel::{Kernel, KernelOp, KernelOpResult};
use serde_json::{json, Value};

fn expression(k: &mut Kernel, request: Value) -> Value {
    match k.apply(KernelOp::Expression { request: serde_json::from_value(request).unwrap() }).unwrap().result {
        KernelOpResult::Expression { data } => data,
        other => panic!("{other:?}"),
    }
}
fn world(k: &mut Kernel, request: Value) -> Value {
    match k.apply(KernelOp::ExpressionWorld { request: serde_json::from_value(request).unwrap() }).unwrap().result {
        KernelOpResult::ExpressionWorld { data } => data,
        other => panic!("{other:?}"),
    }
}

#[test]
#[ignore = "live Central: writes and removes one register file"]
fn material_saves_into_the_register_and_is_discovered_and_performed() {
    let mut k = Kernel::discover();
    let stamp = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos();
    let r = format!("expression:live-character-{stamp}");
    let body = format!("{r}:entity:body");
    let idle = format!("{r}:scene:main");
    expression(&mut k, json!({"operation":"create","expression_ref":r,"title":"Live character","actor":"agent:lane-b"}));
    expression(&mut k, json!({"operation":"edit","expression_ref":r,"expected_revision":1,"actor":"agent:lane-b","changes":[
        {"change":"entity_add","scene_ref":idle,"entity_ref":body,"title":"Body"}]}));
    let data = expression(&mut k, json!({"operation":"edit","expression_ref":r,"expected_revision":2,"actor":"agent:lane-b","changes":[
        {"change":"scene_material_set","scene_ref":idle,"presentation":{"schema":"oi.journey-scene/v1","scene":{
            "id":idle,"name":"Main","character":"live","duration":6,"transition":1,
            "view":{"mode":"2d","yaw":0,"pitch":0,"zoom":1,"panX":0,"panY":0},
            "field":{"background":"#fafafa","palette":["#111111"],"material":"ink","params":{}},
            "engine":{},"morph":{},"composition":{"layout":"free","plane":"XY"},
            "entities":[{"id":body,"kind":"formation","role":"self","name":"Live","text":"✶","shape":"text","tint":"#123456","position":{"x":0,"y":0,"z":0},"rotation":0}],
            "text":[],"automation":[]}}},
        {"change":"reuse_set","reuse":{"schema":"oi.expression-reuse/v1","kind":"character","title":"Live character",
            "roles":[{"role":"self","accepts":"agent","entity_ref":body}],"states":{"idle":idle},"preview_state":"idle",
            "associations":{"workflow_keys":[format!("live-{stamp}")]}}}]}));
    assert_eq!(data["state"], "ready", "{data}");
    // Resolve the register folder through Central, then save into it.
    let folder = oi_cradle_kernel::files::list(&oi_cradle_kernel::flow::CentralClient::discover(),
        &format!("{}/character", oi_cradle_kernel::expression_material::MATERIAL_REGISTER)).unwrap();
    let name = format!("live-{stamp}.expression.json");
    let saved = expression(&mut k, json!({"operation":"save_as","expression_ref":r,"expected_revision":3,"parent":folder.location,
        "name":name,"operation_ref":format!("op:live-material-{stamp}"),"actor":"agent:lane-b","actor_kind":"agent"}));
    assert_eq!(saved["state"], "saved", "{saved}");
    let file_ref = saved["file"]["location"]["ref"].as_str().unwrap().to_owned();
    let path = std::path::Path::new(saved["file"]["location"]["root"].as_str().unwrap()).join(saved["file"]["location"]["path"].as_str().unwrap());
    let outcome = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        let listed = world(&mut k, json!({"operation":"material_list","kind":"character","association":{"workflow_key":format!("live-{stamp}")}}));
        let rows = listed["materials"].as_array().unwrap();
        assert_eq!(rows.len(), 1, "{listed}");
        assert_eq!(rows[0]["file_ref"], file_ref);
        assert_eq!(rows[0]["states"]["idle"], idle);
        // Perform the saved character by Central file ref into a live target.
        expression(&mut k, json!({"operation":"create","expression_ref":format!("expression:live-run-{stamp}"),"title":"Run","actor":"a"}));
        let target = format!("expression:live-run-{stamp}");
        world(&mut k, json!({"operation":"act_open","act_ref":format!("act:live-{stamp}"),"expression_ref":target,"mode":"expressions","actor":"a"}));
        let performed = world(&mut k, json!({"operation":"act_select","act_ref":format!("act:live-{stamp}"),"actor":"a",
            "material":{"file_ref":file_ref,"state":"idle"}}));
        assert_eq!(performed["state"], "act_performed", "{performed}");
        assert_eq!(performed["passage"]["file_ref"], file_ref);
        assert!(performed["passage"]["revision"].as_str().unwrap().starts_with("central.content-"));
        // The saved material closes and frees its slot; acts still read it by file ref.
        let closed = expression(&mut k, json!({"operation":"close","expression_ref":r,"actor":"agent:lane-b"}));
        assert_eq!(closed["state"], "closed", "{closed}");
        let again = world(&mut k, json!({"operation":"act_select","act_ref":format!("act:live-{stamp}"),"actor":"a","material":{"file_ref":file_ref,"state":"idle"}}));
        assert_eq!(again["state"], "act_performed", "{again}");
    }));
    let _ = std::fs::remove_file(&path);
    if let Err(panic) = outcome {
        std::panic::resume_unwind(panic);
    }
}
