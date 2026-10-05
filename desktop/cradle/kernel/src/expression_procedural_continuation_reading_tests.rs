//! Actual Application/Document observation tests. They confer no Source,
//! FIELD, receiver or conductor authority; genuine integration remains gated.
use super::*;

fn retained_document() -> Document {
    let d = independent_source_read_document();
    let mut presentation = d.scenes[0].presentation.clone().unwrap();
    presentation.scene["procedural"]["procedures"] = json!([{
        "procedure_ref":"procedure:continuation-observation", "revision":"1", "source_basis":[],
        "seed":{"algorithm":"sha256","version":"1","value":"retained"},
        "definition":{"schema":"oi.native-observation-test/v1","expression_ref":EXPRESSION,
            "procedure_ref":"procedure:continuation-observation","revision":"1"},
        "resolved_targets":[],"cursor":7,"state":"held","membership_events":[]}]);
    d.edited(vec![Change::SceneMaterialSet {
        scene_ref: d.scenes[0].scene_ref.clone(),
        presentation,
    }])
    .unwrap()
}

fn installed_reading(d: &Document) -> (Application, Value) {
    let mut app = Application::default();
    app.open(d.clone(), "agent:continuation-observation".into())
        .unwrap();
    let client = CentralClient::discover();
    let read = app
        .procedural(
            &client,
            Request::ReadSource {
                expression_ref: EXPRESSION.into(),
                expected_revision: d.revision,
                scope: Scope::Addresses {
                    addresses: vec![addr(Component::Entity, Some("a"), None, None)],
                },
                property_keys: vec!["x".into(), "position.x".into()],
                scene_profile: None,
            },
        )
        .unwrap()
        .0;
    let installed = json!({"expression_ref":EXPRESSION,
        "procedure":manual::definition_ref(d,"procedure:continuation-observation").unwrap(),
        "current_readings":read["current_readings"],
        "materialization":{"schema":"ql.procedural-lifecycle-materialization-reading/v1",
            "document_revision":d.revision,"scenes":[{"scene_ref":d.scenes[0].scene_ref}]}});
    (app, installed)
}

#[test]
fn actual_continuation_refreshes_native_units_coordinates_tags_and_occurrences_without_state_import(
) {
    let original = retained_document();
    let (_, installed) = installed_reading(&original);
    let current = original
        .edited(vec![Change::ParameterSet {
            entity_ref: format!("{EXPRESSION}:entity:a"),
            parameter: "x".into(),
            value: json!(120.0),
        }])
        .unwrap();
    let before = current.clone();
    let mut app = Application::default();
    app.open(current.clone(), "agent:continuation-observation".into())
        .unwrap();
    let result = app
        .procedural_continuation_reading(&current, &current.scenes[0].scene_ref, &installed)
        .unwrap();
    let row = &result["current_readings"][0];
    assert_eq!(row["address"], installed["current_readings"][0]["address"]);
    assert_eq!(row["occurrence_ref"], format!("{EXPRESSION}:entity:a"));
    assert_eq!(row["properties"]["x"], json!(120.0));
    assert_eq!(row["properties"]["position.x"], json!(0.3));
    assert_eq!(row["subject"], installed["current_readings"][0]["subject"]);
    assert!(
        row["revision"].as_u64().unwrap()
            > installed["current_readings"][0]["revision"]
                .as_u64()
                .unwrap()
    );
    assert_eq!(
        row["properties"]
            .as_object()
            .unwrap()
            .keys()
            .collect::<Vec<_>>(),
        installed["current_readings"][0]["properties"]
            .as_object()
            .unwrap()
            .keys()
            .collect::<Vec<_>>()
    );
    assert_eq!(
        result["materialization"]["document_revision"],
        current.revision
    );
    assert_eq!(
        result["materialization"]["schema"],
        "ql.procedural-lifecycle-materialization-reading/v1"
    );
    assert_eq!(
        result["materialization"]["scenes"][0]["existing_retention"]["procedures"][0]["cursor"],
        7
    );
    assert!(result.get("rule_cursor").is_none() && result.get("state").is_none());
    assert!(
        result["materialization"].get("rule_cursor").is_none()
            && result["materialization"].get("state").is_none()
    );
    assert_eq!(result.as_object().unwrap().len(), 2);
    assert_eq!(*app.document(EXPRESSION).unwrap(), before);
    assert!(app.procedural_runtime.operations.is_empty());
}

#[test]
fn actual_continuation_refuses_stale_document_foreign_procedure_and_changed_authored_definition() {
    let d = retained_document();
    let (app, installed) = installed_reading(&d);
    let scene = &d.scenes[0].scene_ref;
    let mut stale = d.clone();
    stale.revision -= 1;
    assert!(app
        .procedural_continuation_reading(&stale, scene, &installed)
        .unwrap_err()
        .contains("revision_conflict"));
    let mut wrong = installed.clone();
    wrong["expression_ref"] = json!("expression:foreign");
    assert!(app
        .procedural_continuation_reading(&d, scene, &wrong)
        .is_err());
    let mut changed = installed.clone();
    changed["procedure"]["revision"] = json!("2");
    assert!(app
        .procedural_continuation_reading(&d, scene, &changed)
        .is_err());
    let mut moved = installed.clone();
    moved["current_readings"][0]["address"]["expression_ref"] = json!("expression:foreign");
    assert!(app
        .procedural_continuation_reading(&d, scene, &moved)
        .is_err());
    assert_eq!(*app.document(EXPRESSION).unwrap(), d);
}

#[test]
fn actual_continuation_refuses_duplicate_original_coordinate_and_missing_actual_scene() {
    let d = retained_document();
    let (app, installed) = installed_reading(&d);
    let mut duplicate = installed.clone();
    let row = duplicate["current_readings"][0].clone();
    duplicate["current_readings"]
        .as_array_mut()
        .unwrap()
        .push(row);
    assert!(app
        .procedural_continuation_reading(&d, &d.scenes[0].scene_ref, &duplicate)
        .unwrap_err()
        .contains("duplicate"));
    assert!(app
        .procedural_continuation_reading(&d, "expression:missing:scene", &installed)
        .is_err());
    assert_eq!(*app.document(EXPRESSION).unwrap(), d);
}

#[test]
fn actual_continuation_refuses_new_global_parameter_manifestation_without_expanding_original_rule()
{
    let original = retained_document();
    let (_, installed) = installed_reading(&original);
    // A genuine native SceneCreate + SceneMaterialSet produces another actual
    // manifestation of the same continuing Entity; the old input set remains.
    let second = format!("{EXPRESSION}:scene:continuation-second");
    let mut presentation = original.scenes[0].presentation.clone().unwrap();
    presentation.scene["id"] = json!(second);
    presentation
        .scene
        .as_object_mut()
        .unwrap()
        .remove("procedural");
    let d = original
        .edited(vec![
            Change::SceneCreate {
                scene_ref: second.clone(),
                title: "Second manifestation".into(),
            },
            Change::SceneCompose {
                scene_ref: second.clone(),
                entity_refs: original.scenes[0].entity_refs.clone(),
            },
            Change::SceneMaterialSet {
                scene_ref: second,
                presentation,
            },
        ])
        .unwrap();
    let mut app = Application::default();
    app.open(d.clone(), "agent:continuation-observation".into())
        .unwrap();
    assert!(app
        .procedural_continuation_reading(&d, &d.scenes[0].scene_ref, &installed)
        .unwrap_err()
        .contains("affected actual Scene"));
    assert_eq!(installed["current_readings"].as_array().unwrap().len(), 1);
    assert_eq!(*app.document(EXPRESSION).unwrap(), d);
}

#[test]
fn actual_continuation_borrowed_intake_refuses_oversized_installed_coordinates_before_refresh() {
    let d = retained_document();
    let (app, mut installed) = installed_reading(&d);
    installed["current_readings"][0]["properties"]["x"] = json!("x".repeat(budget::SOURCE_BYTES));
    assert!(app
        .procedural_continuation_reading(&d, &d.scenes[0].scene_ref, &installed)
        .unwrap_err()
        .contains("budget"));
    assert_eq!(*app.document(EXPRESSION).unwrap(), d);
}

#[test]
fn actual_continuation_saved_pending_labels_never_replace_private_producer_and_journal() {
    let original = retained_document();
    let (_, mut installed) = installed_reading(&original);
    let d = independent_source_read_document();
    let mut app = Application::default();
    app.open(d.clone(), "agent:continuation-observation".into())
        .unwrap();
    installed["pending_operation_ref"] = json!("operation:caller-label");
    installed["pending_preparation"] = json!({"operation_ref":"operation:caller-label","original_procedure":installed["procedure"]});
    assert!(app
        .procedural_continuation_reading(&d, &d.scenes[0].scene_ref, &installed)
        .unwrap_err()
        .contains("live pending producer/journal"));
    assert!(
        app.procedural_runtime.producers.is_empty() && app.procedural_runtime.operations.is_empty()
    );
    assert_eq!(*app.document(EXPRESSION).unwrap(), d);
}

#[test]
fn actual_continuation_missing_planned_scene_json_never_grants_constructed_output_custody() {
    let d = retained_document();
    let (app, mut installed) = installed_reading(&d);
    let planned_scene = json!({
        "scene_ref":format!("{EXPRESSION}:scene:uncreated"),"document_revision":d.revision,
        "existing_retention":null,"current_presentation":null,
        "principal":installed["current_readings"][0]["subject"],"contributors":[],
        "locus":{"ref":"source:actual-place","revision":"place-r1","availability":"available"}});
    installed["materialization"]["scenes"]
        .as_array_mut()
        .unwrap()
        .push(planned_scene);
    assert!(app
        .procedural_continuation_reading(&d, &d.scenes[0].scene_ref, &installed)
        .unwrap_err()
        .contains("original live constructed pending Scene"));
    assert!(app.procedural_runtime.producers.is_empty());
    assert_eq!(*app.document(EXPRESSION).unwrap(), d);
}
