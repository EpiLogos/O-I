// Include as a child of the existing actual native procedural test module.
// This tests real Document::edited/scene_material. It does not construct a
// private Source origin, conductor, producer, witness or consumer receipt.
use super::*;

#[test]
fn actual_force_parameter_write_refreshes_source_material_without_replacing_native_identity() {
    let original = independent_source_read_document();
    original.validate().unwrap();
    let entity_ref = format!("{EXPRESSION}:entity:a");
    let current = original
        .edited(vec![Change::ParameterSet {
            entity_ref: entity_ref.clone(),
            parameter: "force_strength".into(),
            value: json!(0.8),
        }])
        .unwrap();
    current.validate().unwrap();

    let before = manual::scene_material(&original.scenes[0]).unwrap();
    let after = manual::scene_material(&current.scenes[0]).unwrap();
    assert!(before != after, "Actual native Force edit must refresh closed Scene material");
    assert_ne!(
        crate::native_expression::procedural::bootstrap::fingerprint(&before).unwrap(),
        crate::native_expression::procedural::bootstrap::fingerprint(&after).unwrap()
    );
    let authored = after["scene"]["entities"]
        .as_array()
        .unwrap()
        .iter()
        .find(|entity| entity["id"] == entity_ref)
        .unwrap();
    assert_eq!(authored["force"]["strength"], json!(0.8));
    assert_eq!(current.entities[&entity_ref].parameters["force_strength"].value, json!(0.8));
    assert_eq!(current.expression_ref, original.expression_ref);
    assert_eq!(current.scenes[0].scene_ref, original.scenes[0].scene_ref);
    assert_eq!(current.scenes[0].entity_refs, original.scenes[0].entity_refs);
    assert_eq!(current.entities[&entity_ref].subject, original.entities[&entity_ref].subject);
    assert_eq!(
        current.scenes[0].presentation.as_ref().unwrap().scene["procedural"]["bindings"],
        original.scenes[0].presentation.as_ref().unwrap().scene["procedural"]["bindings"]
    );
    assert_eq!(
        current.scenes[0].presentation.as_ref().unwrap().scene["procedural"]["source_basis"],
        original.scenes[0].presentation.as_ref().unwrap().scene["procedural"]["source_basis"]
    );
    assert!(current.revision > original.revision);
    assert_eq!(original.entities[&entity_ref].parameters["force_strength"].value, json!(0.2));
}
