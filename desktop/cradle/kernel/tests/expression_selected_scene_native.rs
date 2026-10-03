//! The real native Application/Kernel owner, without a fabricated World, lease,
//! constructor, Source response, process or acknowledgement.
use oi_cradle_kernel::{Kernel, KernelOp, KernelOpResult};
use serde_json::{json, Value};

fn expression(kernel: &mut Kernel, request: Value) -> Value {
    let outcome = kernel
        .apply(KernelOp::Expression {
            request: serde_json::from_value(request).unwrap(),
        })
        .unwrap();
    match outcome.result {
        KernelOpResult::Expression { data } => data,
        other => panic!("Actual Expression result expected: {other:?}"),
    }
}
fn selected(kernel: &mut Kernel, operation: &str, request: Value) -> Result<Value, String> {
    let outcome = kernel.apply(
        serde_json::from_value(
            json!({"op":"native_expression","request":{"operation":operation,"request":request}}),
        )
        .unwrap(),
    )?;
    match outcome.result {
        KernelOpResult::NativeExpression { data } => Ok(data),
        other => panic!("Actual native result expected: {other:?}"),
    }
}
fn document(kernel: &mut Kernel) -> Value {
    expression(
        kernel,
        json!({"operation":"inspect","expression_ref":"expression:selected-scene"}),
    )["document"]
        .clone()
}
fn basis(document: &Value) -> Value {
    json!({"expression_ref":document["expression_ref"],"document_revision":document["revision"],
        "scene_ref":document["scenes"][0]["scene_ref"],"scene_revision":document["scenes"][0]["revision"]})
}
fn ordinary_scene() -> Kernel {
    let mut kernel = Kernel::discover();
    let created = expression(
        &mut kernel,
        json!({"operation":"create","expression_ref":"expression:selected-scene","title":"Selected Scene","actor":"human:source"}),
    );
    let scene = &created["document"]["scenes"][0];
    let presentation = json!({"schema":"oi.journey-scene/v1","scene":{
        "id":scene["scene_ref"],"name":scene["title"],"character":"Ordinary authored Scene","duration":42,"transition":3,
        "view":{"mode":"3d","yaw":0.3,"pitch":0.1,"zoom":1.2,"panX":0.0,"panY":0.0},
        "field":{"background":"#fafafa","palette":["#111111","#222222"],"material":"ink","params":{"speed":0.75}},
        "engine":{"morphEnabled":true},"morph":{"thetaRate":0.4},"composition":{"layout":"free","plane":"XY"},
        "entities":[],"text":[],"automation":[]}});
    let edited = expression(
        &mut kernel,
        json!({"operation":"edit","expression_ref":"expression:selected-scene",
        "expected_revision":created["document"]["revision"],"actor":"human:source",
        "changes":[{"change":"scene_material_set","scene_ref":scene["scene_ref"],"presentation":presentation}]}),
    );
    assert_eq!(edited["state"], "ready");
    kernel
}

#[test]
fn selected_scene_native_open_refuses_missing_world_on_actual_application_without_effects() {
    let mut kernel = ordinary_scene();
    let before = document(&mut kernel);
    let error = selected(&mut kernel, "open_selected_scene", basis(&before)).unwrap_err();
    assert!(
        error.contains("no saved native World constructor"),
        "{error}"
    );
    assert_eq!(document(&mut kernel), before);
    // A wrong lease would refuse if any process owner had been opened.
    let closed = kernel.apply(serde_json::from_value(json!({"op":"native_expression","request":{"operation":"close","lease":"absence-check"}})).unwrap()).unwrap();
    let KernelOpResult::NativeExpression { data } = closed.result else {
        panic!("Native close expected")
    };
    assert_eq!(data["closed"], true);
}
#[test]
fn selected_scene_native_open_uses_complete_actual_document_and_scene_cas() {
    for field in [
        "document_revision",
        "scene_revision",
        "scene_ref",
        "expression_ref",
    ] {
        let mut kernel = ordinary_scene();
        let before = document(&mut kernel);
        let mut request = basis(&before);
        match field {
            "document_revision" => request[field] = json!(1),
            "scene_revision" => request[field] = json!(1),
            "scene_ref" => request[field] = json!("expression:selected-scene:scene:foreign"),
            _ => request[field] = json!("expression:foreign"),
        }
        let error = selected(&mut kernel, "open_selected_scene", request).unwrap_err();
        assert!(
            !error.contains("no saved native World constructor"),
            "{field} bypassed its actual CAS: {error}"
        );
        assert_eq!(document(&mut kernel), before);
    }
}
#[test]
fn selected_scene_native_recovery_and_abandonment_require_original_owned_opening() {
    let mut kernel = ordinary_scene();
    let before = document(&mut kernel);
    for operation in ["recover_selected_scene", "abandon_selected_scene"] {
        let error = selected(&mut kernel, operation, basis(&before)).unwrap_err();
        assert!(
            error.contains("No original selected-Scene opening"),
            "{error}"
        );
        assert_eq!(document(&mut kernel), before);
    }
}
#[test]
fn selected_scene_public_wire_cannot_supply_a_world_constructor_or_source_grant() {
    let mut kernel = ordinary_scene();
    let before = document(&mut kernel);
    for operation in [
        "open_selected_scene",
        "recover_selected_scene",
        "abandon_selected_scene",
    ] {
        for forbidden in [
            "world",
            "constructor_request",
            "source",
            "native_scene_constructor",
            "lease",
        ] {
            let mut request = basis(&before);
            request[forbidden] = json!({"claimed":"available"});
            assert!(serde_json::from_value::<KernelOp>(json!({"op":"native_expression","request":{"operation":operation,"request":request}})).is_err(),"{operation} accepted public {forbidden}");
        }
    }
    assert_eq!(document(&mut kernel), before);
}
