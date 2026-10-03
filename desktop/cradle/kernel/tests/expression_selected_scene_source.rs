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

fn source_request(document: &Value) -> Value {
    json!({"selection":basis(document),"lease":"absent-selected-native-owner","actor":"human:source",
        "expected_request_id":"1","expected_generation":"0","expected_samples_elapsed":"0"})
}
#[test]
fn native_source_retention_and_recovery_require_the_actual_opening_without_document_effects() {
    let mut kernel = ordinary_scene();
    let before = document(&mut kernel);
    for operation in [
        "retain_selected_scene_source",
        "recover_selected_scene_source",
    ] {
        let error = selected(&mut kernel, operation, source_request(&before)).unwrap_err();
        assert!(
            error.contains("No actual selected-Scene opening"),
            "{operation}: {error}"
        );
        assert_eq!(document(&mut kernel), before);
    }
}
#[test]
fn native_source_observation_checks_actual_document_cas_before_reaching_a_native_channel() {
    let mut kernel = ordinary_scene();
    let before = document(&mut kernel);
    let mut request = source_request(&before);
    request["selection"]["document_revision"] = json!(before["revision"].as_u64().unwrap() + 1);
    let error = selected(&mut kernel, "retain_selected_scene_source", request).unwrap_err();
    assert!(
        !error.contains("No actual selected-Scene opening"),
        "Actual Document CAS was bypassed: {error}"
    );
    assert_eq!(document(&mut kernel), before);
}
#[test]
fn public_native_source_observation_cannot_import_source_or_acknowledgements() {
    let mut kernel = ordinary_scene();
    let before = document(&mut kernel);
    for operation in [
        "retain_selected_scene_source",
        "recover_selected_scene_source",
    ] {
        for key in [
            "native_result",
            "host_receipt",
            "native_field_source",
            "native_source_channel",
            "constructor_request",
        ] {
            let mut request = source_request(&before);
            request[key] = json!({"claimed":"available"});
            assert!(serde_json::from_value::<KernelOp>(json!({"op":"native_expression","request":{"operation":operation,"request":request}})).is_err(), "Public {key} entered {operation}");
        }
    }
    assert_eq!(document(&mut kernel), before);
}
