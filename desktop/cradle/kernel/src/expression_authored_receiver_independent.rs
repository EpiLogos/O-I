// Independent actual-Document authored receiver detectors. Include as a child
// test module of expression_procedural_authored_mutation. No sealed Source,
// native grant, transport, clock or consumer observation is constructed.
use super::*;

fn authored_receiving_document() -> Document {
    let actual: Value = serde_json::from_str(include_str!(
        "authored-driver-current-document-independent.json"
    ))
    .unwrap();
    serde_json::from_value(actual["original"].clone()).unwrap()
}

fn authored_receiving_context(document: &Document) -> (Value, Value, Address) {
    let scene = &document.scenes[0];
    let catalog: Value =
        serde_json::from_str(include_str!("authored-driver-catalog-independent.json")).unwrap();
    let reading = json!({"entity_refs":manual::scene_entity_refs(document,scene).unwrap()});
    let mut selected = address(document, Some(&scene.scene_ref), None, Component::Field);
    selected.property = Some("params.opacity".into());
    (catalog, reading, selected)
}

#[test]
fn a07_authored_attribution_cannot_rewrite_original_contribution_identity_or_generated_basis() {
    let document = authored_receiving_document();
    let original = document.scenes[0].presentation.as_ref().unwrap();
    validate_retention(&original.scene["procedural"]).unwrap();
    let before = document.clone();
    let (catalog, reading, selected) = authored_receiving_context(&document);
    let reference = original.scene["procedural"]["contributions"][0]["contribution_ref"].clone();
    let prepared = json!({"metadata_scope":[],"managed_control_addresses":[],
        "managed_contribution_refs":[reference]});
    for (key, replacement) in [
        ("output_slot", json!("another-existing-slot")),
        ("subject_refs", json!([document.scenes[0].entity_refs[0]])),
        ("occurrence_ref", json!(document.scenes[0].entity_refs[0])),
        ("recipe_revision", json!("another-recipe-revision")),
        ("status", json!("retired")),
        (
            "generated_basis",
            json!({"schema":"oi.journey-scene/v1","scene":{"name":"another authored basis"}}),
        ),
    ] {
        let mut after = original.clone();
        after.scene["procedural"]["contributions"][0][key] = replacement;
        assert!(
            validate_scene_edit(
                &document,
                &document.scenes[0].scene_ref,
                &[selected.clone()],
                &catalog,
                &reading,
                &json!({"kind":"set_base","value":0.42}),
                &prepared,
                &[Change::SceneMaterialSet {
                    scene_ref: document.scenes[0].scene_ref.clone(),
                    presentation: after,
                }],
            )
            .is_err(),
            "authored scalar accepted changed original contribution {key}"
        );
        assert!(
            document == before,
            "borrowed validation changed actual Document"
        );
    }
}

#[test]
fn a06_authored_scalar_cannot_reorder_other_actual_automation_targets() {
    let document = authored_receiving_document();
    let original = document.scenes[0].presentation.as_ref().unwrap();
    validate_retention(&original.scene["procedural"]).unwrap();
    let before = document.clone();
    let (catalog, reading, selected) = authored_receiving_context(&document);
    let prepared = json!({"metadata_scope":[],"managed_control_addresses":[],
        "managed_contribution_refs":[]});
    assert!(original.scene["automation"].as_array().unwrap().len() >= 2);
    let mut after = original.clone();
    after.scene["automation"].as_array_mut().unwrap().swap(0, 1);
    assert!(
        validate_scene_edit(
            &document,
            &document.scenes[0].scene_ref,
            &[selected],
            &catalog,
            &reading,
            &json!({"kind":"set_base","value":0.42}),
            &prepared,
            &[Change::SceneMaterialSet {
                scene_ref: document.scenes[0].scene_ref.clone(),
                presentation: after,
            }],
        )
        .is_err(),
        "Field opacity reordered actual Entity driver declaration order"
    );
    assert!(
        document == before,
        "borrowed validation changed actual Document"
    );
}

// Configured native retention only. These complete rows are based on the actual
// production material fixture above; the Atlas flow uses real Document::edited
// native operations. No Source admission, SealedEdit, owner or ACK is made.
#[test]
fn a07_authored_scalar_does_not_manage_atlas_flow_or_inactive_material_contributions() {
    let document = authored_receiving_document();
    let scene_ref = document.scenes[0].scene_ref.clone();
    let actual_flow = vec![
        Change::Focus {
            scene_ref: scene_ref.clone(),
            entity_ref: None,
        },
        Change::SceneReorder {
            scene_refs: document
                .scenes
                .iter()
                .map(|s| s.scene_ref.clone())
                .collect(),
        },
    ];
    let flowed = document.edited(actual_flow.clone()).unwrap();
    assert_eq!(flowed.selection.scene_ref, scene_ref);
    assert!(flowed.selection.entity_ref.is_none());
    let mut material = flowed.scenes[0].presentation.clone().unwrap();
    let basis = material.scene["procedural"]["contributions"][0].clone();
    let mut atlas = basis.clone();
    atlas["contribution_ref"] = json!("contribution:configured-atlas-receiving-detector");
    atlas["output_slot"] = json!("atlas");
    atlas["occurrence_ref"] = json!(flowed.expression_ref);
    atlas["owned_addresses"] = json!([address(&flowed, None, None, Component::Expression)]);
    atlas["generated_basis"] = json!({"native_flow":actual_flow});
    atlas["authored_overrides"] = json!([]);
    let mut detached = basis;
    detached["contribution_ref"] = json!("contribution:configured-detached-receiving-detector");
    detached["status"] = json!("detached");
    detached["authored_overrides"] = json!([]);
    let mut retired = detached.clone();
    retired["contribution_ref"] = json!("contribution:configured-retired-receiving-detector");
    retired["status"] = json!("retired");
    assert_eq!(
        material.scene["procedural"]["contributions"]
            .as_array()
            .unwrap()
            .len(),
        1
    );
    material.scene["procedural"]["contributions"]
        .as_array_mut()
        .unwrap()
        .extend([atlas, detached, retired]);
    validate_retention(&material.scene["procedural"]).unwrap();
    let before = flowed
        .edited(vec![Change::SceneMaterialSet {
            scene_ref: scene_ref.clone(),
            presentation: material,
        }])
        .unwrap();
    before.validate().unwrap();
    let retained = before.scenes[0].presentation.as_ref().unwrap();
    let retained_copy = before.clone();
    let (catalog, reading, selected) = authored_receiving_context(&before);
    let apply = |index: usize| {
        let mut candidate = retained.clone();
        candidate.scene["field"]["params"]["opacity"] = json!(0.42);
        let row = &mut candidate.scene["procedural"]["contributions"][index];
        let reference = row["contribution_ref"].clone();
        row["authored_overrides"] = json!([{
            "address":selected,"actor":"human:borrowed-actual-receiver-test",
            "revision":before.revision+1,"operation_ref":"operation:configured-metadata-detector",
            "persistent":true,"path":"/scene/field/params/opacity","kind":"set",
            "value":0.42,"before":retained.scene["field"]["params"]["opacity"]
        }]);
        validate_retention(&candidate.scene["procedural"]).unwrap();
        validate_scene_edit(
            &before,
            &scene_ref,
            std::slice::from_ref(&selected),
            &catalog,
            &reading,
            &json!({"kind":"set_base","value":0.42}),
            &json!({"metadata_scope":[],"managed_control_addresses":[],"managed_contribution_refs":[reference]}),
            &[Change::SceneMaterialSet {
                scene_ref: scene_ref.clone(),
                presentation: candidate,
            }],
        )
    };
    assert!(
        apply(0).is_ok(),
        "complete active Scene material contribution may attribute the actual scoped opacity edit"
    );
    for index in [1, 2, 3] {
        let failure = apply(index).unwrap_err();
        assert!(
            failure.contains("another native contribution or flow"),
            "{failure}"
        );
        assert!(
            before == retained_copy,
            "borrowed refusal changed actual Document"
        );
    }
}

// Real Document/Composition changes only. No Source owner, private issuer,
// clock, lease, transport receipt or consumer ACK is constructed here.
fn configured_shared_document() -> Document {
    let actual = authored_receiving_document();
    let composition = crate::expression_scene::Composition {
        schema: "oi.journey-properties/v1".into(),
        description: "Shared receiver regression".into(),
        loop_playback: true,
        shared: Some(json!({"toolbelt":[],"values":{
            "field.params.opacity":0.5,"field.params.gravity":0.1},"pointer":{}})),
    };
    let actual = actual
        .edited(vec![Change::CompositionSet {
            presentation: composition,
        }])
        .unwrap();
    actual.validate().unwrap();
    actual
}

#[test]
fn a06_real_shared_composition_edit_preserves_local_scene_material() {
    let before = configured_shared_document();
    let mut selected = address(&before, None, None, Component::Expression);
    selected.property = Some("shared.values.field.params.opacity".into());
    let mut next = before.presentation.as_ref().unwrap().clone();
    next.shared.as_mut().unwrap()["values"]["field.params.opacity"] = json!(0.42);
    validate_shared_composition(&before, std::slice::from_ref(&selected), &next).unwrap();
    let applied = before
        .edited(vec![Change::CompositionSet { presentation: next }])
        .unwrap();
    assert_eq!(applied.scenes, before.scenes);
    assert_eq!(applied.entities, before.entities);
    assert_eq!(applied.provenance, before.provenance);
    assert_eq!(applied.relations, before.relations);
    assert_eq!(
        applied
            .presentation
            .as_ref()
            .unwrap()
            .shared
            .as_ref()
            .unwrap()["values"]["field.params.opacity"],
        0.42
    );
}

#[test]
fn a08_real_shared_composition_refuses_a_second_scalar_or_scene_configuration() {
    let before = configured_shared_document();
    let unchanged = before.clone();
    let mut selected = address(&before, None, None, Component::Expression);
    selected.property = Some("shared.values.field.params.opacity".into());
    for change in ["other_scalar", "description", "loop"] {
        let mut next = before.presentation.as_ref().unwrap().clone();
        next.shared.as_mut().unwrap()["values"]["field.params.opacity"] = json!(0.42);
        match change {
            "other_scalar" => {
                next.shared.as_mut().unwrap()["values"]["field.params.gravity"] = json!(0.8)
            }
            "description" => next.description = "Unrelated rewritten human text".into(),
            "loop" => next.loop_playback = false,
            _ => unreachable!(),
        }
        assert!(
            validate_shared_composition(&before, std::slice::from_ref(&selected), &next).is_err(),
            "{change}"
        );
        assert_eq!(before, unchanged);
    }
}

#[test]
fn a06_real_shared_release_can_remove_only_its_original_absent_scalar() {
    let before = configured_shared_document();
    let mut selected = address(&before, None, None, Component::Expression);
    selected.property = Some("shared.values.field.params.opacity".into());
    let mut next = before.presentation.as_ref().unwrap().clone();
    next.shared.as_mut().unwrap()["values"]
        .as_object_mut()
        .unwrap()
        .remove("field.params.opacity");
    validate_shared_composition(&before, std::slice::from_ref(&selected), &next).unwrap();
    let applied = before
        .edited(vec![Change::CompositionSet { presentation: next }])
        .unwrap();
    let values = &applied
        .presentation
        .as_ref()
        .unwrap()
        .shared
        .as_ref()
        .unwrap()["values"];
    assert!(values.get("field.params.opacity").is_none());
    assert_eq!(values["field.params.gravity"], 0.1);
    assert_eq!(applied.scenes, before.scenes);
}
