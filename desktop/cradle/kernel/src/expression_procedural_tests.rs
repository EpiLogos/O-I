//! Independent tests to include as a child of expression_procedural in the
//! native owner's qualified CI cut. Real Document::edited/Runtime consumers;
//! no physical/audio ACKs or installed performance are invented.
use super::*;

const EXPRESSION: &str = "expression:independent-native";

// A real manually authored Application creation is applied material.
// It cannot mint a source-qualified procedural continuation witness.
fn warm_native_output() -> (Application, CentralClient, Document, Operation) {
    warm_native_output_with_saved(false)
}
fn warm_native_output_with_saved(saved: bool) -> (Application, CentralClient, Document, Operation) {
    let (mut app, client) = opened();
    let d = app.document(EXPRESSION).unwrap().clone();
    let scene_ref = format!("{EXPRESSION}:scene:generated");
    let mut material = d.scenes[0].presentation.clone().unwrap();
    material.scene["id"] = json!(scene_ref);
    material.scene["name"] = json!("Generated");
    material.scene["entities"] = json!([]);
    if saved {
        material.saved = Some(material.scene.clone());
    }
    let generated_basis = serde_json::to_value(&material).unwrap();
    let owned = Address {
        expression_ref: EXPRESSION.into(),
        scene_ref: Some(scene_ref.clone()),
        entity_ref: None,
        component: Component::Scene,
        parent_ref: None,
        constituent_ref: None,
        property: None,
    };
    let mut retained = empty_retention();
    retained["procedures"] = json!([{"procedure_ref":"procedure:independent-owner","revision":"1","source_basis":[],
        "seed":{"algorithm":"mulberry32","version":"1","value":"17"},
        "definition":{"schema":"oi.native-functional-owner-test/v1","admitted_operation":"scene_create"},
        "resolved_targets":[],"cursor":0,"state":"held","membership_events":[]}]);
    retained["contributions"] = json!([{"contribution_ref":"contribution:independent-owner","procedure_ref":"procedure:independent-owner",
        "output_slot":"scene","subject_refs":[],"occurrence_ref":scene_ref,"recipe_revision":"1",
        "owned_addresses":[owned],"generated_basis":generated_basis,"authored_overrides":[],"status":"active"}]);
    material.scene["procedural"] = retained;
    let mut e = envelope(&d, Scope::Expression, "a");
    e.operation_ref = "operation:independent-owner-creation".into();
    e.changes = vec![
        Change::SceneCreate {
            scene_ref: scene_ref.clone(),
            title: "Generated".into(),
        },
        Change::SceneMaterialSet {
            scene_ref,
            presentation: material,
        },
    ];
    app.procedural(
        &client,
        Request::Prepare {
            envelope: Box::new(e.clone()),
        },
    )
    .unwrap();
    let receipt = app
        .procedural(
            &client,
            Request::Commit {
                operation_ref: e.operation_ref,
            },
        )
        .unwrap()
        .0;
    let operation: Operation = serde_json::from_value(receipt["operation"].clone()).unwrap();
    assert_eq!(operation.status, Status::Applied);
    let actual = app.document(EXPRESSION).unwrap().clone();
    assert!(
        app.procedural_runtime
            .output_readings(&actual, "procedure:independent-owner")
            .is_err(),
        "manual Applied material plus recipe labels minted qualified producer ownership"
    );
    (app, client, actual, operation)
}

#[test]
fn a05_a13_raw_or_rebuilt_applied_journal_cannot_create_a_current_native_output_witness() {
    let (app, _client, d, operation) = warm_native_output();
    assert!(
        Runtime::default()
            .output_readings(&d, "procedure:independent-owner")
            .is_err(),
        "serialized Applied receipt manufactured current native creation authority"
    );
    let mut restored = Runtime::default();
    restored.restore_document(&d).unwrap();
    assert!(
        restored
            .output_readings(&d, "procedure:independent-owner")
            .is_err(),
        "restored Applied history was treated as a live native witness"
    );
    let mut rebuilt = d.clone();
    for scene in &mut rebuilt.scenes {
        let Some(p) = &mut scene.presentation else {
            continue;
        };
        let Some(rows) = p.scene["procedural"]["operations"].as_array_mut() else {
            continue;
        };
        for row in rows {
            if row["envelope"]["operation_ref"] != operation.envelope.operation_ref {
                continue;
            }
            row["envelope"]["actor"] = json!("agent:forged-rebuilt-creation");
            let envelope: Envelope = serde_json::from_value(row["envelope"].clone()).unwrap();
            row["fingerprint"] = json!(format!(
                "{:x}",
                Sha256::digest(serde_json::to_vec(&envelope).unwrap())
            ));
        }
    }
    // A valid rebuilt checksum is still a different producer intent. Actual
    // runtime creation must match the original typed journal, not just its ID.
    journal(&rebuilt).unwrap();
    assert!(
        app.procedural_runtime
            .output_readings(&rebuilt, "procedure:independent-owner")
            .is_err(),
        "a rehashed saved creation shadowed its actual native owner witness"
    );
}

#[test]
fn a05_a14_caller_source_tokens_and_copied_actual_journal_hash_cannot_admit_a_producer() {
    let (_warm, client, d, original) = warm_native_output();
    // These are receiving negatives. The genuine native Applied journal hash
    // is deliberately copied and relabeled; neither string is a source grant.
    // A positive grant must come from the actual protected compiler completion.
    for token in [
        format!("procedure-source:{}", "0".repeat(64)),
        format!("procedure-source:{}", original.fingerprint),
    ] {
        let mut recipient = Application::default();
        recipient
            .open(d.clone(), "agent:independent".into())
            .unwrap();
        let mut e = envelope(&d, Scope::Expression, "a");
        e.operation_ref = "operation:independent:caller-source-token".into();
        e.producer_ref = Some(token);
        let before = recipient.document(EXPRESSION).unwrap().clone();
        let result = recipient.procedural(
            &client,
            Request::Prepare {
                envelope: Box::new(e.clone()),
            },
        );
        assert!(
            result.is_err(),
            "an unissued or copied token created native producer authority"
        );
        assert!(
            result
                .unwrap_err()
                .contains("actual native producer admission")
        );
        assert_eq!(recipient.document(EXPRESSION).unwrap(), &before);
        assert!(
            recipient
                .procedural_runtime
                .inspect(&e.operation_ref)
                .is_err(),
            "refused source token retained an accepted operation"
        );
    }
}

#[test]
fn a13_a14_configuration_reopen_preserves_material_but_requires_explicit_current_source_replay() {
    let (_app, client, d, _operation) = warm_native_output();
    let saved = serde_json::to_vec(&d).unwrap();
    let mut cold = Application::default();
    cold.open(
        serde_json::from_slice(&saved).unwrap(),
        "agent:independent".into(),
    )
    .unwrap();
    assert_eq!(cold.document(EXPRESSION).unwrap(), &d);
    assert!(
        cold.procedural(
            &client,
            Request::ReadOutputs {
                expression_ref: EXPRESSION.into(),
                expected_revision: d.revision,
                procedure_ref: "procedure:independent-owner".into()
            }
        )
        .is_err(),
        "configuration open granted continuation authority from an old Applied receipt"
    );
    assert_eq!(
        cold.document(EXPRESSION).unwrap(),
        &d,
        "refused cold continuation changed actual saved material"
    );
}

fn document() -> Document {
    let mut entities = serde_json::Map::new();
    for id in ["a", "b"] {
        let r = format!("{EXPRESSION}:entity:{id}");
        entities.insert(r.clone(),json!({"entity_ref":r,"revision":1,"title":id,"subject":null,
            "parameters":{"scale":{"value":1.0,"automation":null},"x":{"value":0.0,"automation":null},"force_strength":{"value":0.2,"automation":null}}}));
    }
    let a = json!({"id":format!("{EXPRESSION}:entity:a"),"kind":"formation","scale":1.0,"position":{"x":0.0,"y":0.0,"z":0.0},"force":{"strength":0.2},
        "layers":[{"id":"layer:a","text":"A","z":0.0},{"id":"layer:b","text":"B","z":0.0}],
        "sequence":{"steps":[{"id":"step:a","text":"A"},{"id":"step:b","text":"B"}]}});
    let b = json!({"id":format!("{EXPRESSION}:entity:b"),"kind":"pin","force":{"strength":0.2}});
    let presentation = json!({"schema":"oi.journey-scene/v1","scene":{"id":format!("{EXPRESSION}:scene:main"),"name":"Main",
        "duration":30,"transition":2,"view":{"mode":"3d","yaw":0,"pitch":0,"zoom":1,"panX":0,"panY":0},
        "field":{"params":{"speed":0.5}},"composition":{},"morph":{},"engine":{},"text":[],"automation":[],"entities":[a,b]}});
    let scene = json!({"scene_ref":format!("{EXPRESSION}:scene:main"),"revision":1,"title":"Main",
        "entity_refs":[format!("{EXPRESSION}:entity:a"),format!("{EXPRESSION}:entity:b")],"presentation":presentation});
    let d:Document=serde_json::from_value(json!({"schema":"oi.expression/v1","expression_ref":EXPRESSION,"revision":1,
        "title":"Independent native targets","entities":entities,"relations":{},"provenance":[],"representations":[],
        "selection":{"scene_ref":format!("{EXPRESSION}:scene:main"),"entity_ref":null},"scenes":[scene]})).unwrap();
    d.validate().unwrap();
    d
}
fn addr(
    component: Component,
    entity: Option<&str>,
    constituent: Option<&str>,
    property: Option<&str>,
) -> Address {
    serde_json::from_value(json!({
        "expression_ref":EXPRESSION,"scene_ref":format!("{EXPRESSION}:scene:main"),
        "entity_ref":entity.map(|id|format!("{EXPRESSION}:entity:{id}")),
        "component":component,"constituent_ref":constituent,"property":property
    }))
    .unwrap()
}
fn envelope(d: &Document, scope: Scope, entity: &str) -> Envelope {
    Envelope {
        operation_ref: "operation:independent".into(),
        expression_ref: d.expression_ref.clone(),
        expected_revision: d.revision,
        actor: "agent:independent".into(),
        scope,
        sources: vec![],
        changes: vec![Change::ParameterSet {
            entity_ref: format!("{EXPRESSION}:entity:{entity}"),
            parameter: "scale".into(),
            value: json!(2.0),
        }],
        participants: vec![],
        timing: Timing::Immediate,
        cause_ref: None,
        output_readings: vec![],
        producer_ref: None,
    }
}

#[test]
fn a02_a05_selected_entity_cannot_write_a_different_constituent() {
    let d = document();
    let before = d.clone();
    let mut rt = Runtime::default();
    let scope = Scope::Addresses {
        addresses: vec![addr(Component::Entity, Some("a"), None, None)],
    };
    assert!(rt.prepare(&d, envelope(&d, scope, "b")).is_err());
    assert_eq!(d, before);
    assert!(rt.inspect("operation:independent").is_err());
}

#[test]
fn a02_a05_property_limited_broad_address_does_not_admit_other_property() {
    let d = document();
    let mut rt = Runtime::default();
    let scope = Scope::Addresses {
        addresses: vec![addr(
            Component::Entity,
            Some("a"),
            None,
            Some("force.strength"),
        )],
    };
    assert!(
        rt.prepare(&d, envelope(&d, scope, "a")).is_err(),
        "entity property selection widened to every entity write"
    );
}

#[test]
fn a01_a02_stable_layer_and_sequence_link_survive_real_native_material_reorder() {
    let d = document();
    for (component, section, original) in [
        (Component::Layer, "layers", "layer:a"),
        (Component::SequenceLink, "sequence", "step:a"),
    ] {
        let a = addr(component, Some("a"), Some(original), None);
        let before = addressed(&d, &a).unwrap();
        let mut presentation = d.scenes[0].presentation.clone().unwrap();
        let e = &mut presentation.scene["entities"][0];
        if section == "sequence" {
            e[section]["steps"].as_array_mut().unwrap().reverse();
        } else {
            e[section].as_array_mut().unwrap().reverse();
        }
        let reordered = d
            .edited(vec![Change::SceneMaterialSet {
                scene_ref: d.scenes[0].scene_ref.clone(),
                presentation: presentation.clone(),
            }])
            .unwrap();
        assert_eq!(addressed(&reordered, &a).unwrap(), before);
        if section == "sequence" {
            e_remove(
                &mut presentation.scene["entities"][0][section]["steps"],
                original,
            );
        } else {
            e_remove(&mut presentation.scene["entities"][0][section], original);
        }
        let dropped = d
            .edited(vec![Change::SceneMaterialSet {
                scene_ref: d.scenes[0].scene_ref.clone(),
                presentation,
            }])
            .unwrap();
        assert!(
            addressed(&dropped, &a).is_err(),
            "dropped stable constituent resolved to another array position"
        );
    }
}
fn e_remove(value: &mut Value, id: &str) {
    value.as_array_mut().unwrap().retain(|e| e["id"] != id);
}

#[test]
fn a05_identical_prepare_retry_returns_same_record_and_conflicting_payload_refuses() {
    let d = document();
    let mut rt = Runtime::default();
    let scope = Scope::Addresses {
        addresses: vec![addr(Component::Entity, Some("a"), None, None)],
    };
    let e = envelope(&d, scope, "a");
    let first = rt.prepare(&d, e.clone()).unwrap();
    assert_eq!(rt.prepare(&d, e.clone()).unwrap(), first);
    let mut conflict = e;
    conflict.actor = "agent:changed-payload".into();
    assert!(rt.prepare(&d, conflict).is_err());
    assert_eq!(rt.inspect("operation:independent").unwrap(), &first);
}

#[test]
fn a05_stale_cas_and_wrong_expression_leave_no_retained_operation() {
    let d = document();
    for mutate in [0, 1] {
        let mut rt = Runtime::default();
        let mut e = envelope(&d, Scope::Expression, "a");
        if mutate == 0 {
            e.expected_revision += 1;
        } else {
            e.expression_ref = "expression:foreign".into();
        }
        assert!(rt.prepare(&d, e).is_err());
        assert!(rt.inspect("operation:independent").is_err());
    }
}

fn opened() -> (Application, CentralClient) {
    let mut app = Application::default();
    app.open(document(), "agent:independent".into()).unwrap();
    (app, CentralClient::discover())
}
fn prepared(app: &mut Application, client: &CentralClient) -> Operation {
    let d = app.document(EXPRESSION).unwrap().clone();
    let (receipt, _) = app
        .procedural(
            client,
            Request::Prepare {
                envelope: Box::new(envelope(&d, Scope::Expression, "a")),
            },
        )
        .unwrap();
    serde_json::from_value(receipt["operation"].clone()).unwrap()
}

#[test]
fn a05_actual_native_prepare_journals_admitted_basis_commit_and_retry_apply_once() {
    let (mut app, client) = opened();
    let op = prepared(&mut app, &client);
    assert_eq!(op.envelope.expected_revision, 1);
    assert_eq!(op.accepted_revision, Some(2));
    assert_eq!(app.document(EXPRESSION).unwrap().revision, 2);
    assert_eq!(
        app.document(EXPRESSION).unwrap().entities[&format!("{EXPRESSION}:entity:a")].parameters
            ["scale"]
            .value,
        1.0
    );
    let (receipt, _) = app
        .procedural(
            &client,
            Request::Commit {
                operation_ref: op.envelope.operation_ref.clone(),
            },
        )
        .unwrap();
    let applied: Operation = serde_json::from_value(receipt["operation"].clone()).unwrap();
    assert_eq!(applied.status, Status::Applied);
    assert_eq!(applied.applied_revision, Some(3));
    let document = app.document(EXPRESSION).unwrap().clone();
    assert_eq!(
        document.entities[&format!("{EXPRESSION}:entity:a")].parameters["scale"].value,
        2.0
    );
    let (repeat, changed) = app
        .procedural(
            &client,
            Request::Commit {
                operation_ref: op.envelope.operation_ref,
            },
        )
        .unwrap();
    assert_eq!(repeat["repeated"], true);
    assert!(changed.is_none());
    assert_eq!(app.document(EXPRESSION).unwrap(), &document);
}

#[test]
fn a05_a13_ordinary_native_edit_cannot_forge_or_drop_owned_operation_journal() {
    let (mut app, client) = opened();
    prepared(&mut app, &client);
    let d = app.document(EXPRESSION).unwrap().clone();
    for mutation in [0, 1] {
        let mut p = d.scenes[0].presentation.clone().unwrap();
        if mutation == 0 {
            p.scene["procedural"]["operations"][0]["status"] = json!("applied");
        } else {
            p.scene["procedural"]["operations"] = json!([]);
        }
        let result = app.apply(
            &client,
            ExpressionRequest::Edit {
                expression_ref: EXPRESSION.into(),
                expected_revision: d.revision,
                actor: "agent:independent".into(),
                changes: vec![Change::SceneMaterialSet {
                    scene_ref: d.scenes[0].scene_ref.clone(),
                    presentation: p,
                }],
            },
        );
        assert!(
            result.is_err(),
            "ordinary Edit changed the actual owner operation journal"
        );
        assert_eq!(app.document(EXPRESSION).unwrap(), &d);
    }
}

#[test]
fn a05_a13_actual_unresolved_native_journal_restores_interrupted_without_duplicate_application() {
    let (mut app, client) = opened();
    let op = prepared(&mut app, &client);
    let retained = app
        .procedural_runtime
        .checkpoint_document(app.document(EXPRESSION).unwrap())
        .unwrap();
    let mut reopened = Application::default();
    reopened
        .open(retained.clone(), "agent:independent".into())
        .unwrap();
    let restored = reopened
        .procedural_runtime
        .inspect(&op.envelope.operation_ref)
        .unwrap();
    assert_eq!(restored.status, Status::Interrupted);
    assert!(restored.failure.is_some());
    let (repeat, changed) = reopened
        .procedural(
            &client,
            Request::Commit {
                operation_ref: op.envelope.operation_ref,
            },
        )
        .unwrap();
    assert_eq!(repeat["repeated"], true);
    assert!(changed.is_none());
    assert_eq!(reopened.document(EXPRESSION).unwrap(), &retained);
}

#[test]
fn a13_actual_applied_native_journal_reopens_as_history_without_effective_runtime_claim() {
    let (mut app, client) = opened();
    let op = prepared(&mut app, &client);
    app.procedural(
        &client,
        Request::Commit {
            operation_ref: op.envelope.operation_ref.clone(),
        },
    )
    .unwrap();
    let retained = app
        .procedural_runtime
        .checkpoint_document(app.document(EXPRESSION).unwrap())
        .unwrap();
    let mut reopened = Application::default();
    reopened.open(retained, "agent:independent".into()).unwrap();
    assert_eq!(
        reopened
            .procedural_runtime
            .inspect(&op.envelope.operation_ref)
            .unwrap()
            .status,
        Status::Applied
    );
    let (read, _) = reopened
        .procedural(
            &client,
            Request::Read {
                expression_ref: EXPRESSION.into(),
                scope: Scope::Expression,
                after_cursor: None,
            },
        )
        .unwrap();
    assert_eq!(read["effective_observations"], json!([]));
    assert!(
        read["operation_history"]
            .as_array()
            .is_some_and(|rows| rows
                .iter()
                .any(|row| row["operation"]["envelope"]["operation_ref"]
                    == op.envelope.operation_ref
                    && row["restored"] == true)),
        "native restart must disclose the retained applied receipt as history"
    );
}

#[test]
fn a13_native_retained_time_mapping_requires_actual_owner_instance_domain_and_numeric_position() {
    let mut retained = empty_retention();
    retained["time_mappings"] = json!([{"owner":"expressions","instance_ref":"instance:continuing-engine",
        "domain":"simulation_seconds","cursor":3.5,"rate":1.0,"origin":0.0}]);
    for key in [
        "owner",
        "instance_ref",
        "domain",
        "cursor",
        "rate",
        "origin",
    ] {
        let mut bad = retained.clone();
        bad["time_mappings"][0].as_object_mut().unwrap().remove(key);
        assert!(
            validate_retention(&bad).is_err(),
            "retained native time mapping lost {key}"
        );
    }
    let mut duplicate = retained.clone();
    duplicate["time_mappings"]
        .as_array_mut()
        .unwrap()
        .push(retained["time_mappings"][0].clone());
    assert!(
        validate_retention(&duplicate).is_err(),
        "ambiguous owner time mapping was admitted"
    );
}

#[test]
fn a09_a13_native_scene_flow_requires_known_continuation_and_same_world() {
    let mut retained = empty_retention();
    retained["scene_flow"] = json!([{"from_scene_ref":format!("{EXPRESSION}:scene:main"),
        "to_scene_ref":format!("{EXPRESSION}:scene:continuation"),"policy":"continue","cursor":3}]);
    for (key, value) in [
        ("policy", json!("invented-continuation")),
        ("from_scene_ref", json!("")),
        ("to_scene_ref", json!("expression:foreign:scene:other")),
        ("cursor", json!(-1)),
    ] {
        let mut bad = retained.clone();
        bad["scene_flow"][0][key] = value;
        assert!(
            validate_retention(&bad).is_err(),
            "native retained flow silently admitted invalid {key}"
        );
    }
}

#[test]
fn a07_a13_native_replay_refuses_lost_definition_or_generated_basis() {
    let mut retained = empty_retention();
    retained["procedures"] = json!([{"procedure_ref":"procedure:current","revision":"1","source_basis":[],
        "seed":{"algorithm":"mulberry32","version":"1","value":"17"},"definition":{"native_operation":"parameter_set"},
        "resolved_targets":[],"cursor":3,"state":"held","membership_events":[]}]);
    retained["contributions"] = json!([{"contribution_ref":"contribution:current","procedure_ref":"procedure:current",
        "output_slot":"force","subject_refs":["source:current"],"occurrence_ref":format!("{EXPRESSION}:entity:a"),
        "recipe_revision":"1","owned_addresses":[],"generated_basis":{"force":{"strength":0.5}},
        "authored_overrides":[],"status":"active"}]);
    let mut lost_definition = retained.clone();
    lost_definition["procedures"][0]
        .as_object_mut()
        .unwrap()
        .remove("definition");
    assert!(
        validate_retention(&lost_definition).is_err(),
        "native replay has no original procedure definition"
    );
    let mut lost_basis = retained;
    lost_basis["contributions"][0]
        .as_object_mut()
        .unwrap()
        .remove("generated_basis");
    assert!(
        validate_retention(&lost_basis).is_err(),
        "native three-way regeneration lost original generated basis"
    );
}

#[test]
#[ignore = "Unexecuted until actual compiled QL producer fixture is provided to native Application"]
fn a03_a07_a13_actual_ql_producer_reaches_native_application_override_regeneration_and_reopen() {
    let path = std::env::var("TA_ONTA_CONSUMER_FIXTURE")
        .expect("actual native TA_ONTA_FIXTURE_OUTPUT artifact required");
    let bytes = std::fs::read(&path).expect("actual producer fixture must be readable");
    let fixture: Value =
        serde_json::from_slice(&bytes).expect("complete actual producer JSON required");
    assert_eq!(fixture["schema"], "ql.procedural-stage-fixture/v1");
    let mut app = Application::default();
    let client = CentralClient::discover();
    let mut last_document = None;
    for (index, request) in [
        &fixture["create"],
        &fixture["prepared"]["native_edit"],
        &fixture["human_override"],
        &fixture["native_regeneration"],
    ]
    .into_iter()
    .enumerate()
    {
        let actual: ExpressionRequest = serde_json::from_value(request.clone())
            .expect("producer request must match existing native Expression interface");
        let (receipt, _) = app
            .apply(&client, actual)
            .expect("actual native Application must admit producer scene material");
        assert_eq!(receipt["state"], "ready");
        let d = app.document("expression:acceptance").unwrap().clone();
        assert_eq!(d.revision, (index + 1) as u64);
        if index >= 1 {
            assert_eq!(d.entities.len(), 6);
            for contribution in fixture["contributions"].as_array().unwrap() {
                let r = contribution["occurrence_ref"].as_str().unwrap();
                let scene = d
                    .scenes
                    .iter()
                    .find(|s| s.scene_ref == r)
                    .expect("generated native Scene must exist");
                assert_eq!(scene.entity_refs.len(), 2);
                for entity in &scene.entity_refs {
                    assert!(
                        d.entities[entity].subject.is_some(),
                        "actual Paśu principal was dropped by native consumer"
                    );
                }
            }
        }
        last_document = Some(d);
    }
    let d = last_document.unwrap();
    let entity = fixture["human_override"]["changes"][0]["entity_ref"]
        .as_str()
        .unwrap();
    assert_eq!(d.entities[entity].parameters["force_strength"].value, 0.875);
    let material = d
        .scenes
        .iter()
        .filter_map(|s| s.presentation.as_ref())
        .find_map(|p| {
            p.scene["entities"]
                .as_array()?
                .iter()
                .find(|e| e["id"] == entity)
        })
        .expect("actual native authored constituent must remain present");
    assert_eq!(
        material["force"]["strength"], 0.875,
        "regeneration lost actual human native intervention"
    );
    assert_eq!(
        material["sequence"]["steps"][1]["hold"], 3.5,
        "regeneration did not reach actual native sequence material"
    );
    let before = d.clone();
    let stale: ExpressionRequest =
        serde_json::from_value(fixture["prepared"]["native_edit"].clone()).unwrap();
    let (refused, changed) = app.apply(&client, stale).unwrap();
    assert_eq!(refused["state"], "revision_conflict");
    assert!(changed.is_none());
    assert_eq!(app.document("expression:acceptance").unwrap(), &before);
    let reopened: Document = serde_json::from_slice(&serde_json::to_vec(&d).unwrap()).unwrap();
    let mut continuation = Application::default();
    continuation
        .open(reopened, "agent:independent".into())
        .unwrap();
    assert_eq!(continuation.document("expression:acceptance").unwrap(), &d);
    if let Ok(path) = std::env::var("TA_ONTA_CONSUMED_DOCUMENT") {
        std::fs::write(path, serde_json::to_vec_pretty(&d).unwrap()).unwrap();
    }
}

#[test]
fn a02_a06_exact_authoring_scalar_address_reaches_same_native_parameter_and_material() {
    for (parameter, property, native_value, authoring_value) in
        [("scale", "scale", 2.0, 2.0), ("x", "position.x", 80.0, 0.2)]
    {
        let d = document();
        let mut rt = Runtime::default();
        let target = addr(Component::Entity, Some("a"), None, Some(property));
        assert_eq!(
            addressed(&d, &target).unwrap(),
            json!(if parameter == "scale" { 1.0 } else { 0.0 })
        );
        let mut e = envelope(
            &d,
            Scope::Addresses {
                addresses: vec![target.clone()],
            },
            "a",
        );
        e.changes = vec![Change::ParameterSet {
            entity_ref: format!("{EXPRESSION}:entity:a"),
            parameter: parameter.into(),
            value: json!(native_value),
        }];
        let operation = rt
            .prepare(&d, e.clone())
            .expect("exact UI property scope must admit its actual native parameter alias");
        assert_eq!(operation.targets, vec![target.clone()]);
        let actual = d.edited(e.changes).unwrap();
        assert_eq!(
            actual.entities[&format!("{EXPRESSION}:entity:a")].parameters[parameter].value,
            json!(native_value)
        );
        assert_eq!(
            addressed(&actual, &target).unwrap(),
            json!(authoring_value),
            "native parameter did not reach the same material target"
        );
        let mut foreign = envelope(
            &d,
            Scope::Addresses {
                addresses: vec![target],
            },
            "a",
        );
        foreign.operation_ref = "operation:foreign-property".into();
        foreign.changes = vec![Change::ParameterSet {
            entity_ref: format!("{EXPRESSION}:entity:a"),
            parameter: "force_strength".into(),
            value: json!(0.9),
        }];
        assert!(
            rt.prepare(&d, foreign).is_err(),
            "exact scalar selection widened to a different component/property"
        );
    }
}

#[test]
fn a02_a05_shared_dotted_registry_property_cannot_write_another_property_or_expression_metadata() {
    let mut d = document();
    d.presentation=Some(serde_json::from_value(json!({"schema":"oi.journey-properties/v1","description":"Retained original description","loop":true,
        "shared":{"values":{"morph.locality":0.5,"morph.speed":0.2},"pointer":{"morph.locality":false},"toolbelt":[]}})).unwrap());
    d.validate().unwrap();
    let target = Address {
        expression_ref: EXPRESSION.into(),
        scene_ref: None,
        entity_ref: None,
        component: Component::Expression,
        parent_ref: None,
        constituent_ref: None,
        property: Some("shared.values.morph.locality".into()),
    };
    assert_eq!(addressed(&d, &target).unwrap(), json!(0.5));
    let before = d.clone();
    for mutation in [
        "selected",
        "other_shared",
        "description",
        "loop",
        "pointer",
        "toolbelt",
    ] {
        let mut p = d.presentation.clone().unwrap();
        let mut shared = p.shared.clone().unwrap();
        match mutation {
            "selected" => shared["values"]["morph.locality"] = json!(0.8),
            "other_shared" => shared["values"]["morph.speed"] = json!(0.8),
            "description" => p.description = "Unselected authored metadata".into(),
            "loop" => p.loop_playback = false,
            "pointer" => shared["pointer"]["morph.locality"] = json!(true),
            "toolbelt" => {
                shared["toolbelt"] = json!([{"bind":"morph.locality","label":"Other control"}])
            }
            _ => unreachable!(),
        }
        p.shared = Some(shared);
        let changes = vec![Change::CompositionSet { presentation: p }];
        let mut e = envelope(
            &d,
            Scope::Addresses {
                addresses: vec![target.clone()],
            },
            "a",
        );
        e.changes = changes.clone();
        let result = Runtime::default().prepare(&d, e);
        if mutation == "selected" {
            result.expect("actual dotted registry key must be a usable whole-Expression address");
            assert_eq!(
                addressed(&d.edited(changes).unwrap(), &target).unwrap(),
                json!(0.8)
            );
        } else {
            assert!(
                result.is_err(),
                "selected shared locality admitted foreign {mutation}"
            );
        }
        assert_eq!(
            d, before,
            "scope verification mutated native original on {mutation}"
        );
    }
}

#[test]
fn a02_a05_native_granular_material_write_cannot_bypass_same_scalar_domain_or_type() {
    for (component, property, section, bad) in [
        (Component::Force, "strength", "force", json!(21.0)),
        (Component::Force, "strength", "force", json!("not a scalar")),
        (Component::Entity, "scale", "", json!(4.01)),
        (Component::Entity, "position.x", "position", json!(4.01)),
    ] {
        let d = document();
        let before = d.clone();
        let mut material = d.scenes[0].presentation.clone().unwrap();
        let entity = &mut material.scene["entities"][0];
        match section {
            "force" => entity["force"]["strength"] = bad.clone(),
            "position" => entity["position"]["x"] = bad.clone(),
            _ => entity["scale"] = bad.clone(),
        };
        let target = addr(component, Some("a"), None, Some(property));
        let mut e = envelope(
            &d,
            Scope::Addresses {
                addresses: vec![target],
            },
            "a",
        );
        e.changes = vec![Change::SceneMaterialSet {
            scene_ref: d.scenes[0].scene_ref.clone(),
            presentation: material,
        }];
        let mut runtime = Runtime::default();
        assert!(
            runtime.prepare(&d, e).is_err(),
            "granular native {property} bypassed the actual scalar domain with {bad}"
        );
        assert!(runtime.inspect("operation:independent").is_err());
        assert_eq!(d, before);
    }
}

fn nested_layers_document() -> Document {
    let mut d = document();
    let material = &mut d.scenes[0].presentation.as_mut().unwrap().scene;
    for step in material["entities"][0]["sequence"]["steps"]
        .as_array_mut()
        .unwrap()
    {
        step["shape"] = json!("text");
        step["hold"] = json!(2.0);
        step["transition"] = json!(1.0);
        step["position"] = Value::Null;
        step["objectState"] = json!({"size":{"x":1.0,"y":1.0},"rotation":0.0,"scale":1.0,
            "tint":"#ffffff","tintWeight":0.0,"force":{"kind":"attract","strength":0.2,"radius":0.5,"spin":0.0},"normalized":true});
    }
    material["entities"][0]["sequence"]["steps"][0]["layers"] =
        json!([{"id":"layer:state-a","text":"A","z":0.02,"scale":1.0}]);
    material["entities"][0]["sequence"]["steps"][1]["layers"] =
        json!([{"id":"layer:state-b","text":"B","z":0.15,"scale":1.0}]);
    d.validate().unwrap();
    d
}

#[test]
fn a01_a02_exact_state_layer_address_changes_actual_nested_material_without_retargeting() {
    let d = nested_layers_document();
    let target = addr(
        Component::Layer,
        Some("a"),
        Some("layer:state-a"),
        Some("z"),
    );
    assert_eq!(addressed(&d, &target).unwrap(), json!(0.02));
    let mut material = d.scenes[0].presentation.clone().unwrap();
    material.scene["entities"][0]["sequence"]["steps"]
        .as_array_mut()
        .unwrap()
        .reverse();
    let reordered = d
        .edited(vec![Change::SceneMaterialSet {
            scene_ref: d.scenes[0].scene_ref.clone(),
            presentation: material,
        }])
        .unwrap();
    assert_eq!(addressed(&reordered, &target).unwrap(), json!(0.02));
    let mut material = reordered.scenes[0].presentation.clone().unwrap();
    material.scene["entities"][0]["sequence"]["steps"][1]["layers"][0]["z"] = json!(0.08);
    let mut e = envelope(
        &reordered,
        Scope::Addresses {
            addresses: vec![target.clone()],
        },
        "a",
    );
    e.changes = vec![Change::SceneMaterialSet {
        scene_ref: d.scenes[0].scene_ref.clone(),
        presentation: material,
    }];
    let op = Runtime::default()
        .prepare(&reordered, e.clone())
        .expect("exact retained state-layer depth should be writable");
    let mut exact_target = target.clone();
    exact_target.parent_ref = Some(Some("step:a".into()));
    assert_eq!(op.targets, vec![exact_target]);
    let actual = reordered.edited(e.changes).unwrap();
    assert_eq!(addressed(&actual, &target).unwrap(), json!(0.08));
    assert_eq!(
        addressed(
            &actual,
            &addr(
                Component::Layer,
                Some("a"),
                Some("layer:state-b"),
                Some("z")
            )
        )
        .unwrap(),
        json!(0.15)
    );
}

#[test]
fn a02_a05_state_layer_scope_refuses_another_layer_or_membership_change() {
    let d = nested_layers_document();
    for mutation in ["other_state", "direct_layer", "membership"] {
        let mut material = d.scenes[0].presentation.clone().unwrap();
        match mutation {
            "other_state" => {
                material.scene["entities"][0]["sequence"]["steps"][1]["layers"][0]["z"] =
                    json!(0.09)
            }
            "direct_layer" => {
                material.scene["entities"][0]["layers"][0]["text"] = json!("Changed outside state")
            }
            _ => material.scene["entities"][0]["sequence"]["steps"][0]["layers"]
                .as_array_mut()
                .unwrap()
                .push(json!({"id":"layer:state-added","text":"New","z":0.0})),
        }
        let mut e = envelope(
            &d,
            Scope::Addresses {
                addresses: vec![addr(
                    Component::Layer,
                    Some("a"),
                    Some("layer:state-a"),
                    None,
                )],
            },
            "a",
        );
        e.changes = vec![Change::SceneMaterialSet {
            scene_ref: d.scenes[0].scene_ref.clone(),
            presentation: material,
        }];
        assert!(
            Runtime::default().prepare(&d, e).is_err(),
            "selected state layer admitted {mutation}"
        );
    }
}

#[test]
fn a02_a05_duplicate_state_layer_projection_does_not_hide_distinct_material() {
    let mut d = nested_layers_document();
    d.scenes[0].presentation.as_mut().unwrap().scene["entities"][0]["sequence"]["steps"][1]["layers"]
        [0]["id"] = json!("layer:state-a");
    let selected = addr(Component::Layer, Some("a"), Some("layer:state-a"), None);
    assert!(
        addressed(&d, &selected).is_err(),
        "distinct duplicated state layers were treated as one projection"
    );
    let mut e = envelope(
        &d,
        Scope::Addresses {
            addresses: vec![selected],
        },
        "a",
    );
    e.changes = vec![Change::ParameterSet {
        entity_ref: format!("{EXPRESSION}:entity:a"),
        parameter: "scale".into(),
        value: json!(0.9),
    }];
    assert!(Runtime::default().prepare(&d, e).is_err());
}

#[test]
fn a02_a05_scalar_validation_recurses_through_consumed_object_states_and_layer_domains() {
    // Source: model.ts SequenceStep.objectState + EntityLayer/validateJourney,
    // nativeBridge.toNativeEntity/toNativeLayers and EntityRuntime layer scale.
    // Layers have no force. Their scale is not the Entity ParameterSet domain.
    for (section, property, bad) in [
        ("state", "objectState.scale", json!(1000.001)),
        ("state", "objectState.scale", json!("not a scalar")),
        ("state", "objectState.size.x", json!(100.001)),
        ("state", "objectState.rotation", json!(36000.001)),
        ("state", "objectState.force.strength", json!(1000.001)),
        ("state", "objectState.force.strength", json!("not a scalar")),
        ("state", "objectState.force.radius", json!(125.001)),
        ("state", "objectState.force.spin", json!(1000.001)),
        ("layer", "scale", json!(0.009)),
        ("layer", "scale", json!(10.001)),
        ("layer", "scale", json!("not a scalar")),
        ("layer", "z", json!(100.001)),
        ("layer", "z", json!("not a scalar")),
    ] {
        let d = nested_layers_document();
        let target = if section == "state" {
            addr(
                Component::SequenceLink,
                Some("a"),
                Some("step:a"),
                Some(property),
            )
        } else {
            addr(
                Component::Layer,
                Some("a"),
                Some("layer:state-a"),
                Some(property),
            )
        };
        let replace = |value: Value| {
            let mut material = d.scenes[0].presentation.clone().unwrap();
            let mut row = if section == "state" {
                &mut material.scene["entities"][0]["sequence"]["steps"][0]
            } else {
                &mut material.scene["entities"][0]["sequence"]["steps"][0]["layers"][0]
            };
            let parts: Vec<_> = property.split('.').collect();
            for part in &parts[..parts.len() - 1] {
                row = &mut row[*part];
            }
            row[parts[parts.len() - 1]] = value;
            material
        };
        let mut e = envelope(
            &d,
            Scope::Addresses {
                addresses: vec![target],
            },
            "a",
        );
        let mut valid = e.clone();
        valid.changes = vec![Change::SceneMaterialSet {
            scene_ref: d.scenes[0].scene_ref.clone(),
            presentation: replace(json!(0.8)),
        }];
        Runtime::default()
            .prepare(&d, valid)
            .expect("same consumed nested address and valid scalar must be admitted");
        e.changes = vec![Change::SceneMaterialSet {
            scene_ref: d.scenes[0].scene_ref.clone(),
            presentation: replace(bad),
        }];
        assert!(
            Runtime::default().prepare(&d, e).is_err(),
            "nested {section} {property} admitted invalid source-domain value"
        );
    }
}

#[test]
fn a01_a02_a05_valid_authored_layer_and_state_domains_are_not_narrowed_to_entity_parameters() {
    let d = nested_layers_document();
    for (component, id, property, value) in [
        (Component::Layer, "layer:state-a", "scale", json!(4.01)),
        (
            Component::SequenceLink,
            "step:a",
            "objectState.scale",
            json!(4.01),
        ),
        (
            Component::SequenceLink,
            "step:a",
            "objectState.force.strength",
            json!(21.0),
        ),
    ] {
        let mut material = d.scenes[0].presentation.clone().unwrap();
        let mut row = if component == Component::Layer {
            &mut material.scene["entities"][0]["sequence"]["steps"][0]["layers"][0]
        } else {
            &mut material.scene["entities"][0]["sequence"]["steps"][0]
        };
        let parts: Vec<_> = property.split('.').collect();
        for part in &parts[..parts.len() - 1] {
            row = &mut row[*part];
        }
        row[parts[parts.len() - 1]] = value.clone();
        let target = addr(component, Some("a"), Some(id), Some(property));
        let mut e = envelope(
            &d,
            Scope::Addresses {
                addresses: vec![target.clone()],
            },
            "a",
        );
        e.changes = vec![Change::SceneMaterialSet {
            scene_ref: d.scenes[0].scene_ref.clone(),
            presentation: material,
        }];
        Runtime::default()
            .prepare(&d, e.clone())
            .expect("valid authored state/layer domain was narrowed to entity scalar limits");
        assert_eq!(
            addressed(&d.edited(e.changes).unwrap(), &target).unwrap(),
            value
        );
    }
}

#[test]
fn a02_a05_required_consumed_layer_and_object_state_fields_cannot_be_deleted_or_mistyped() {
    for (component, id, property, kind) in [
        (
            Component::SequenceLink,
            "step:a",
            "objectState.force.strength",
            "delete",
        ),
        (
            Component::SequenceLink,
            "step:a",
            "objectState.size.x",
            "delete",
        ),
        (Component::Layer, "layer:state-a", "text", "wrong_type"),
        (Component::Layer, "layer:state-a", "text", "delete"),
        (Component::Layer, "layer:state-a", "z", "delete"),
    ] {
        let d = nested_layers_document();
        let target = addr(component.clone(), Some("a"), Some(id), Some(property));
        let replace = |invalid: bool| {
            let mut material = d.scenes[0].presentation.clone().unwrap();
            let mut row = if component == Component::Layer {
                &mut material.scene["entities"][0]["sequence"]["steps"][0]["layers"][0]
            } else {
                &mut material.scene["entities"][0]["sequence"]["steps"][0]
            };
            let parts: Vec<_> = property.split('.').collect();
            for part in &parts[..parts.len() - 1] {
                row = &mut row[*part];
            }
            let key = parts[parts.len() - 1];
            if invalid && kind == "delete" {
                row.as_object_mut().unwrap().remove(key);
            } else {
                row[key] = if property == "text" && !invalid {
                    json!("Valid retained text")
                } else {
                    json!(0.8)
                };
            }
            material
        };
        let mut valid = envelope(
            &d,
            Scope::Addresses {
                addresses: vec![target.clone()],
            },
            "a",
        );
        valid.changes = vec![Change::SceneMaterialSet {
            scene_ref: d.scenes[0].scene_ref.clone(),
            presentation: replace(false),
        }];
        Runtime::default()
            .prepare(&d, valid)
            .expect("same actual consumed address and valid field must remain writable");
        let mut invalid = envelope(
            &d,
            Scope::Addresses {
                addresses: vec![target],
            },
            "a",
        );
        invalid.changes = vec![Change::SceneMaterialSet {
            scene_ref: d.scenes[0].scene_ref.clone(),
            presentation: replace(true),
        }];
        assert!(
            Runtime::default().prepare(&d, invalid).is_err(),
            "native material admitted {kind} of required consumed {property}"
        );
    }
}

#[test]
#[ignore = "Unexecuted until actual compiled QL producer fixture is admitted through native Application"]
fn a05_a07_a08_a13_native_owned_output_reading_extends_only_original_applied_creation() {
    let path = std::env::var("TA_ONTA_CONSUMER_FIXTURE")
        .expect("actual compiled TA_ONTA_FIXTURE_OUTPUT artifact required");
    let fixture: Value = serde_json::from_slice(&std::fs::read(path).unwrap()).unwrap();
    assert_eq!(fixture["schema"], "ql.procedural-stage-fixture/v1");
    let procedure = &fixture["procedure"];
    let procedure_ref = procedure["procedure_ref"].as_str().unwrap();
    let expression_ref = fixture["prepared"]["native_edit"]["expression_ref"]
        .as_str()
        .unwrap();
    let source_basis:Vec<Value> = ["recipe","profile"].into_iter().map(|key|
        json!({"ref":procedure[key]["source_ref"],"revision":procedure[key]["revision"],"availability":"available"})).collect();
    // This is a native consumer contract test over actual producer fields.
    // The final installed-host serializer remains a separate artifact gate.
    let mut retained = empty_retention();
    retained["source_basis"] = json!(source_basis);
    retained["procedures"] = json!([{"procedure_ref":procedure_ref,"revision":procedure["revision"],
        "source_basis":source_basis,"seed":{"algorithm":procedure["seed_algorithm"],"version":"1","value":procedure["seed"]},
        "definition":procedure,"resolved_targets":[],"cursor":0,"state":"held","membership_events":[]}]);
    retained["contributions"] = json!(fixture["contributions"].as_array().unwrap().iter().map(|c|
        json!({"contribution_ref":c["contribution_ref"],"procedure_ref":c["procedure_ref"],"output_slot":c["output_slot"],
            "subject_refs":c["subjects"],"occurrence_ref":c["occurrence_ref"],"recipe_revision":c["recipe"]["revision"],
            "owned_addresses":c["owned_addresses"],"generated_basis":c["generated_basis"],"authored_overrides":[],"status":"active"})).collect::<Vec<_>>());
    validate_retention(&retained).unwrap();
    let mut changes = fixture["prepared"]["native_edit"]["changes"]
        .as_array()
        .unwrap()
        .clone();
    let first_material = changes
        .iter_mut()
        .find(|c| c["change"] == "scene_material_set")
        .unwrap();
    first_material["presentation"]["scene"]["procedural"] = retained;
    let changes: Vec<Change> = serde_json::from_value(json!(changes)).unwrap();
    let mut app = Application::default();
    let client = CentralClient::discover();
    let create: ExpressionRequest = serde_json::from_value(fixture["create"].clone()).unwrap();
    assert_eq!(app.apply(&client, create).unwrap().0["state"], "ready");
    let d = app.document(expression_ref).unwrap().clone();
    let creation = Envelope {
        operation_ref: "operation:independent:actual-producer-creation".into(),
        expression_ref: expression_ref.into(),
        expected_revision: d.revision,
        actor: fixture["prepared"]["native_edit"]["actor"]
            .as_str()
            .unwrap()
            .into(),
        scope: Scope::Expression,
        sources: serde_json::from_value(json!(source_basis)).unwrap(),
        changes,
        participants: vec![],
        timing: Timing::Immediate,
        cause_ref: None,
        output_readings: vec![],
        producer_ref: None,
    };
    let prepared_reply = app
        .procedural(
            &client,
            Request::Prepare {
                envelope: Box::new(creation.clone()),
            },
        )
        .unwrap()
        .0;
    let prepared_creation: Operation =
        serde_json::from_value(prepared_reply["operation"].clone()).unwrap();
    let preparing = app.document(expression_ref).unwrap();
    assert!(
        app.procedural_runtime
            .output_readings(preparing, procedure_ref)
            .unwrap()
            .is_empty(),
        "uncommitted native creation yielded procedural output authority"
    );
    let accepted_document = preparing.clone();
    let applied = app
        .procedural(
            &client,
            Request::Commit {
                operation_ref: creation.operation_ref.clone(),
            },
        )
        .unwrap()
        .0;
    let applied_operation: Operation =
        serde_json::from_value(applied["operation"].clone()).unwrap();
    assert_eq!(applied_operation.status, Status::Applied);
    let d = app.document(expression_ref).unwrap().clone();
    let result = app
        .procedural(
            &client,
            Request::ReadOutputs {
                expression_ref: expression_ref.into(),
                expected_revision: d.revision,
                procedure_ref: procedure_ref.into(),
            },
        )
        .unwrap()
        .0;
    let readings = result["output_readings"].as_array().unwrap();
    assert_eq!(
        readings.len(),
        fixture["contributions"].as_array().unwrap().len()
    );
    for reading in readings {
        assert_eq!(reading["native_owner"], "oi.expression");
        assert_eq!(reading["document_revision"], d.revision);
        assert_eq!(
            reading["applied_operation"],
            serde_json::to_value(&applied_operation).unwrap()
        );
        assert!(
            reading["current_basis"]["scene"]
                .get("procedural")
                .is_none()
        );
        assert!(
            reading["generated_basis"]["scene"]
                .get("procedural")
                .is_none()
        );
        assert_eq!(reading["source_basis"], json!(source_basis));
    }
    let entity = fixture["contributions"][0]["generated_basis"]["scene"]["entities"][0]["id"]
        .as_str()
        .unwrap();
    let empty_selector = Scope::Tag {
        scene_refs: d.scenes.iter().map(|s| s.scene_ref.clone()).collect(),
        tag: "original:empty-selector".into(),
        origin: "authored".into(),
    };
    assert!(resolve(&d, &empty_selector).unwrap().is_empty());
    let regeneration = Envelope {
        operation_ref: "operation:independent:own-output-regeneration".into(),
        expression_ref: expression_ref.into(),
        expected_revision: d.revision,
        actor: "agent:independent".into(),
        scope: empty_selector,
        sources: serde_json::from_value(json!(source_basis)).unwrap(),
        changes: vec![Change::ParameterSet {
            entity_ref: entity.into(),
            parameter: "force_strength".into(),
            value: json!(0.33),
        }],
        participants: vec![],
        timing: Timing::Immediate,
        cause_ref: None,
        output_readings: vec![readings[0].clone()],
        producer_ref: None,
    };
    // The witness is the actual warm Application owner. A fresh Runtime has
    // no current authority merely because the document contains an Applied row.
    let live_creation_runtime = app.procedural_runtime.clone();
    let admitted = live_creation_runtime
        .clone()
        .prepare(&d, regeneration.clone())
        .expect("exact applied own output should continue from unchanged empty selector");
    assert!(!admitted.targets.is_empty());
    assert_eq!(
        d.edited(regeneration.changes.clone()).unwrap().entities[entity].parameters
            ["force_strength"]
            .value,
        json!(0.33)
    );
    let owned_scene = readings[0]["occurrence_ref"].as_str().unwrap();
    let other_scene = d
        .scenes
        .iter()
        .find(|s| s.scene_ref != owned_scene)
        .unwrap()
        .scene_ref
        .clone();
    for mutation in [
        "owner",
        "source",
        "revision",
        "subject",
        "current_material",
        "generated_material",
        "uncommitted",
        "outside_ownership",
    ] {
        let mut e = regeneration.clone();
        let r = &mut e.output_readings[0];
        match mutation {
            "owner" => r["native_owner"] = json!("foreign:owner"),
            "source" => r["source_basis"][0]["revision"] = json!("foreign:revision"),
            "revision" => r["document_revision"] = json!(d.revision + 1),
            "subject" => r["subject_refs"] = json!(["ql:m-coordinate:pratibimba:M3"]),
            "current_material" => {
                r["current_basis"]["scene"]["entities"][0]["force"]["strength"] = json!(0.9)
            }
            "generated_material" => {
                r["generated_basis"]["scene"]["entities"][0]["force"]["strength"] = json!(0.9)
            }
            "uncommitted" => r["applied_operation"]["status"] = json!("prepared"),
            _ => {
                r["owned_addresses"] = json!([{"expression_ref":expression_ref,"scene_ref":other_scene,
                "entity_ref":null,"component":"scene","constituent_ref":null,"property":null}])
            }
        }
        assert!(
            live_creation_runtime.clone().prepare(&d, e).is_err(),
            "actual retained owner reading admitted {mutation}"
        );
    }
    let containing = d
        .scenes
        .iter()
        .find(|s| {
            s.presentation.as_ref().is_some_and(|p| {
                p.scene["procedural"]["contributions"]
                    .as_array()
                    .is_some_and(|rows| !rows.is_empty())
            })
        })
        .unwrap();
    let mut material = containing.presentation.clone().unwrap();
    material.scene["procedural"]["contributions"][0]["status"] = json!("retired");
    let retired = d
        .edited(vec![Change::SceneMaterialSet {
            scene_ref: containing.scene_ref.clone(),
            presentation: material,
        }])
        .unwrap();
    let mut retired_request = regeneration.clone();
    retired_request.expected_revision = retired.revision;
    assert!(
        live_creation_runtime
            .clone()
            .prepare(&retired, retired_request)
            .is_err(),
        "retired output retained active continuation authority"
    );
    let changed_material = d
        .edited(vec![Change::ParameterSet {
            entity_ref: entity.into(),
            parameter: "force_strength".into(),
            value: json!(0.7),
        }])
        .unwrap();
    let mut stale_material = regeneration.clone();
    stale_material.expected_revision = changed_material.revision;
    assert!(
        live_creation_runtime
            .clone()
            .prepare(&changed_material, stale_material)
            .is_err(),
        "fresh CAS accepted a stale output material reading"
    );
    let mut outside = regeneration.clone();
    outside.changes = vec![Change::SceneRemove {
        scene_ref: other_scene,
    }];
    assert!(
        live_creation_runtime.clone().prepare(&d, outside).is_err(),
        "own output widened to another Scene"
    );
    let before_stale = app.document(expression_ref).unwrap().clone();
    let (stale_reply, stale_changed) = app
        .procedural(
            &client,
            Request::ReadOutputs {
                expression_ref: expression_ref.into(),
                expected_revision: d.revision - 1,
                procedure_ref: procedure_ref.into(),
            },
        )
        .unwrap();
    assert_eq!(stale_reply["state"], "revision_conflict");
    assert!(stale_changed.is_none());
    assert_eq!(app.document(expression_ref).unwrap(), &before_stale);
    let reopened: Document = serde_json::from_slice(&serde_json::to_vec(&d).unwrap()).unwrap();
    let mut continuation = Application::default();
    continuation
        .open(reopened, "agent:independent".into())
        .unwrap();
    assert_eq!(continuation.document(expression_ref).unwrap(), &d);
    let repeated = continuation.procedural(
        &client,
        Request::ReadOutputs {
            expression_ref: expression_ref.into(),
            expected_revision: d.revision,
            procedure_ref: procedure_ref.into(),
        },
    );
    assert!(
        repeated.is_err(),
        "configuration reopen relabeled historical Applied journal as current native creation authority"
    );
    if let Ok(path) = std::env::var("TA_ONTA_OUTPUT_READING_NATIVE_ARTIFACT") {
        std::fs::write(path,serde_json::to_vec_pretty(&json!({"schema":"oi.procedural-native-consumer-evidence/v1",
            "scope":"qualified native Application consumer test; installed host not exercised",
            "accepted_document":accepted_document,"prepared_creation_operation":prepared_creation,
            "native_commit_reply":applied,"document":d,"creation_operation":applied_operation,"output_readings":readings})).unwrap()).unwrap();
    }
}

// Complete authored source literal previously exercised through the actual
// validateJourney -> toNativeConfig consumers. This is native material input,
// not an effective-state receipt or a substituted transport.
fn complete_layer_document() -> Document {
    let mut d = document();
    let mut presentation: Value = serde_json::from_str(
        r###"{
  "schema": "oi.journey-scene/v1",
  "scene": {
    "id": "expression:source:scene:material",
    "name": "Source-qualified passage",
    "character": "native controlled material",
    "duration": 42,
    "transition": 3,
    "view": {
      "mode": "3d",
      "yaw": 0.0,
      "pitch": 0.0,
      "zoom": 1.0,
      "panX": 0.0,
      "panY": 0.0
    },
    "field": {
      "background": "#111111",
      "palette": [
        "#d4cfbf",
        "#9a92af"
      ],
      "material": "ink",
      "params": {
        "speed": 0.75
      }
    },
    "engine": {
      "morphEnabled": true,
      "resonanceEnabled": true,
      "trajectory": "toroidalHopf",
      "driveShape": "sine",
      "autoOscillate": true,
      "relationalEnabled": false,
      "relationalMode": "orbital",
      "pointerMode": "repel",
      "colorMode": "linearGradient",
      "colorEnabled": true,
      "mediumPlane": "vertical",
      "autoSweep": false,
      "sweepDirection": "ascent"
    },
    "morph": {
      "thetaRate": 0.4,
      "phiRate": 0.2,
      "thetaOffset": 0,
      "phiOffset": 0,
      "law": "theta",
      "depth": 1,
      "dwell": 0
    },
    "composition": {
      "layout": "free",
      "plane": "XY",
      "focus": "parallel",
      "focusDuration": 8,
      "carryTint": true,
      "carryStation": true,
      "frequencyDriver": "manual"
    },
    "entities": [
      {
        "id": "source-form",
        "kind": "formation",
        "name": "Source form",
        "enabled": true,
        "position": {
          "x": 0,
          "y": 0,
          "z": 0
        },
        "size": {
          "x": 0.65,
          "y": 0.86
        },
        "rotation": 0,
        "scale": 1.0,
        "share": 1.0,
        "shape": "text",
        "text": "ATG",
        "tint": "#d4cfbf",
        "tintWeight": 1,
        "locked": false,
        "station": null,
        "source": {
          "kind": "ascii",
          "ascii": {
            "text": "ATG",
            "fontFamily": "system-ui",
            "fontSize": 64,
            "invert": false
          }
        },
        "layers": [
          {
            "id": "retained-layer",
            "text": "ATG",
            "z": 0.02,
            "scale": 0.9,
            "source": {
              "kind": "ascii",
              "ascii": {
                "text": "ATG",
                "fontFamily": "system-ui",
                "fontSize": 64,
                "invert": false
              }
            }
          }
        ],
        "force": {
          "kind": "attract",
          "strength": 0.25,
          "radius": 0.3,
          "spin": 0
        },
        "sequence": {
          "enabled": true,
          "clock": "seconds",
          "sourcesVersion": 1,
          "hold": 2,
          "transition": 1,
          "easing": "smoothstep",
          "order": "loop",
          "jitter": 0,
          "impulse": 0,
          "phaseOffset": 0,
          "rateMul": 1,
          "steps": [
            {
              "id": "source-1",
              "text": "ATG",
              "shape": "text",
              "hold": 2,
              "transition": 1,
              "position": null,
              "source": {
                "kind": "ascii",
                "ascii": {
                  "text": "ATG",
                  "fontFamily": "system-ui",
                  "fontSize": 64,
                  "invert": false
                }
              }
            },
            {
              "id": "source-2",
              "text": "TGA",
              "shape": "text",
              "hold": 2,
              "transition": 1,
              "position": null,
              "source": {
                "kind": "ascii",
                "ascii": {
                  "text": "TGA",
                  "fontFamily": "system-ui",
                  "fontSize": 64,
                  "invert": false
                }
              }
            }
          ]
        }
      },
      {
        "id": "source-force",
        "kind": "pin",
        "name": "Source force",
        "enabled": true,
        "position": {
          "x": 0.125,
          "y": 0,
          "z": 0
        },
        "size": {
          "x": 0.1,
          "y": 0.1
        },
        "rotation": 0,
        "scale": 1,
        "share": 0,
        "shape": "square",
        "text": "",
        "tint": "#9a92af",
        "tintWeight": 1,
        "locked": false,
        "station": null,
        "force": {
          "kind": "vortex",
          "strength": 0.125,
          "radius": 0.5,
          "spin": 0.2
        },
        "sequence": {
          "enabled": false,
          "clock": "seconds",
          "steps": []
        }
      }
    ],
    "text": [],
    "automation": []
  }
}
"###,
    )
    .unwrap();
    let material = &mut presentation["scene"];
    material["id"] = json!(d.scenes[0].scene_ref);
    material["entities"][0]["id"] = json!(format!("{EXPRESSION}:entity:a"));
    material["entities"][1]["id"] = json!(format!("{EXPRESSION}:entity:b"));
    let mut state_layer = material["entities"][0]["layers"][0].clone();
    state_layer["text"] = json!("TGA");
    state_layer["z"] = json!(0.17);
    state_layer["scale"] = json!(0.6);
    material["entities"][0]["sequence"]["steps"][0]["id"] = json!("step:a");
    material["entities"][0]["sequence"]["steps"][1]["id"] = json!("step:b");
    material["entities"][0]["sequence"]["steps"][0]["layers"] = json!([state_layer]);
    d.scenes[0].presentation = Some(serde_json::from_value(presentation).unwrap());
    d.validate().unwrap();
    d
}
fn state_layer_addr(parent: &str, property: Option<&str>) -> Address {
    let mut value = serde_json::to_value(addr(
        Component::Layer,
        Some("a"),
        Some("retained-layer"),
        property,
    ))
    .unwrap();
    value["parent_ref"] = json!(parent);
    serde_json::from_value(value)
        .expect("native Layer schema must retain its actual containing SequenceLink")
}
#[test]
fn a01_a02_whole_sequence_admits_actual_link_and_nested_layer_without_entity_scope() {
    let d = complete_layer_document();
    let selected = addr(Component::Sequence, Some("a"), None, None);
    let mut material = d.scenes[0].presentation.clone().unwrap();
    material.scene["entities"][0]["sequence"]["steps"][0]["hold"] = json!(3.5);
    material.scene["entities"][0]["sequence"]["steps"][0]["holdOverride"] = json!(true);
    material.scene["entities"][0]["sequence"]["steps"][0]["layers"][0]["z"] = json!(0.28);
    let mut e = envelope(
        &d,
        Scope::Addresses {
            addresses: vec![selected.clone()],
        },
        "a",
    );
    e.changes = vec![Change::SceneMaterialSet {
        scene_ref: d.scenes[0].scene_ref.clone(),
        presentation: material,
    }];
    let actual = d.edited(e.changes.clone()).unwrap();
    let prepared = Runtime::default()
        .prepare(&d, e)
        .expect("whole native Sequence must cover its real links and link layers");
    assert_eq!(prepared.targets, vec![selected]);
    assert_eq!(
        actual.scenes[0].presentation.as_ref().unwrap().scene["entities"][0]["sequence"]["steps"]
            [0]["hold"],
        json!(3.5)
    );
    assert_eq!(
        actual.scenes[0].presentation.as_ref().unwrap().scene["entities"][0]["sequence"]["steps"]
            [0]["layers"][0]["z"],
        json!(0.28)
    );
    assert_eq!(
        actual.scenes[0].presentation.as_ref().unwrap().scene["entities"][0]["layers"],
        d.scenes[0].presentation.as_ref().unwrap().scene["entities"][0]["layers"]
    );
    for outside in ["base_layer", "other_entity"] {
        let mut material = d.scenes[0].presentation.clone().unwrap();
        if outside == "base_layer" {
            material.scene["entities"][0]["layers"][0]["z"] = json!(0.29)
        } else {
            material.scene["entities"][1]["force"]["strength"] = json!(0.77)
        }
        let mut e = envelope(
            &d,
            Scope::Addresses {
                addresses: vec![addr(Component::Sequence, Some("a"), None, None)],
            },
            "a",
        );
        e.changes = vec![Change::SceneMaterialSet {
            scene_ref: d.scenes[0].scene_ref.clone(),
            presentation: material,
        }];
        assert!(
            Runtime::default().prepare(&d, e).is_err(),
            "Sequence scope covered {outside}"
        );
    }
}
#[test]
fn a01_a02_actual_sequence_link_covers_its_layer_and_refuses_foreign_link_or_base() {
    let d = complete_layer_document();
    let selected = addr(Component::SequenceLink, Some("a"), Some("step:a"), None);
    let mut material = d.scenes[0].presentation.clone().unwrap();
    material.scene["entities"][0]["sequence"]["steps"][0]["layers"][0]["text"] = json!("GAT");
    let mut e = envelope(
        &d,
        Scope::Addresses {
            addresses: vec![selected.clone()],
        },
        "a",
    );
    e.changes = vec![Change::SceneMaterialSet {
        scene_ref: d.scenes[0].scene_ref.clone(),
        presentation: material,
    }];
    let actual = d.edited(e.changes.clone()).unwrap();
    Runtime::default()
        .prepare(&d, e)
        .expect("native SequenceLink scope must cover its actual retained layer");
    assert_eq!(
        actual.scenes[0].presentation.as_ref().unwrap().scene["entities"][0]["sequence"]["steps"]
            [0]["layers"][0]["text"],
        json!("GAT")
    );
    for outside in ["base_layer", "other_link"] {
        let mut material = d.scenes[0].presentation.clone().unwrap();
        if outside == "base_layer" {
            material.scene["entities"][0]["layers"][0]["text"] = json!("CAT")
        } else {
            material.scene["entities"][0]["sequence"]["steps"][1]["text"] = json!("CAT")
        }
        let mut e = envelope(
            &d,
            Scope::Addresses {
                addresses: vec![selected.clone()],
            },
            "a",
        );
        e.changes = vec![Change::SceneMaterialSet {
            scene_ref: d.scenes[0].scene_ref.clone(),
            presentation: material,
        }];
        assert!(
            Runtime::default().prepare(&d, e).is_err(),
            "selected native link covered {outside}"
        );
    }
}
#[test]
fn a01_a02_same_id_base_and_state_layers_have_exact_containing_link_coordinates() {
    let d = complete_layer_document();
    let selected = state_layer_addr("step:a", Some("z"));
    assert_eq!(addressed(&d, &selected).unwrap(), json!(0.17));
    assert!(
        addressed(
            &d,
            &addr(
                Component::Layer,
                Some("a"),
                Some("retained-layer"),
                Some("z")
            )
        )
        .is_err(),
        "unqualified shared layer silently selected the base or state"
    );
    let mut material = d.scenes[0].presentation.clone().unwrap();
    material.scene["entities"][0]["sequence"]["steps"]
        .as_array_mut()
        .unwrap()
        .reverse();
    let reordered = d
        .edited(vec![Change::SceneMaterialSet {
            scene_ref: d.scenes[0].scene_ref.clone(),
            presentation: material,
        }])
        .unwrap();
    assert_eq!(addressed(&reordered, &selected).unwrap(), json!(0.17));
    let mut material = reordered.scenes[0].presentation.clone().unwrap();
    material.scene["entities"][0]["sequence"]["steps"][1]["layers"][0]["z"] = json!(0.32);
    let mut e = envelope(
        &reordered,
        Scope::Addresses {
            addresses: vec![selected.clone()],
        },
        "a",
    );
    e.changes = vec![Change::SceneMaterialSet {
        scene_ref: d.scenes[0].scene_ref.clone(),
        presentation: material,
    }];
    let actual = reordered.edited(e.changes.clone()).unwrap();
    Runtime::default()
        .prepare(&reordered, e)
        .expect("actual state qualified same-id layer must be writable");
    assert_eq!(addressed(&actual, &selected).unwrap(), json!(0.32));
    assert_eq!(
        actual.scenes[0].presentation.as_ref().unwrap().scene["entities"][0]["layers"][0]["z"],
        json!(0.02)
    );
    assert!(
        addressed(&actual, &state_layer_addr("step:b", Some("z"))).is_err(),
        "wrong containing link borrowed another state's layer"
    );
    assert!(addressed(&actual, &state_layer_addr("step:missing", Some("z"))).is_err());
    let mut material = actual.scenes[0].presentation.clone().unwrap();
    material.scene["entities"][0]["layers"][0]["z"] = json!(0.33);
    let mut e = envelope(
        &actual,
        Scope::Addresses {
            addresses: vec![selected],
        },
        "a",
    );
    e.changes = vec![Change::SceneMaterialSet {
        scene_ref: actual.scenes[0].scene_ref.clone(),
        presentation: material,
    }];
    assert!(
        Runtime::default().prepare(&actual, e).is_err(),
        "state-qualified layer changed the base projection sharing its id"
    );
}

#[test]
fn a01_a02_explicit_null_layer_parent_names_base_and_cannot_write_state_projection() {
    let d = complete_layer_document();
    let mut wire = serde_json::to_value(addr(
        Component::Layer,
        Some("a"),
        Some("retained-layer"),
        Some("z"),
    ))
    .unwrap();
    assert!(
        wire.get("parent_ref").is_none(),
        "legacy omitted Layer parent was serialized as base authority"
    );
    wire["parent_ref"] = Value::Null;
    let base: Address = serde_json::from_value(wire.clone()).unwrap();
    assert_eq!(
        serde_json::to_value(&base).unwrap()["parent_ref"],
        Value::Null
    );
    assert_eq!(addressed(&d, &base).unwrap(), json!(0.02));
    let mut material = d.scenes[0].presentation.clone().unwrap();
    material.scene["entities"][0]["layers"][0]["z"] = json!(0.11);
    let mut e = envelope(
        &d,
        Scope::Addresses {
            addresses: vec![base.clone()],
        },
        "a",
    );
    e.changes = vec![Change::SceneMaterialSet {
        scene_ref: d.scenes[0].scene_ref.clone(),
        presentation: material,
    }];
    let actual = d.edited(e.changes.clone()).unwrap();
    Runtime::default()
        .prepare(&d, e)
        .expect("explicit null must admit exact actual base layer");
    assert_eq!(addressed(&actual, &base).unwrap(), json!(0.11));
    assert_eq!(
        addressed(&actual, &state_layer_addr("step:a", Some("z"))).unwrap(),
        json!(0.17)
    );
    let mut material = actual.scenes[0].presentation.clone().unwrap();
    material.scene["entities"][0]["sequence"]["steps"][0]["layers"][0]["z"] = json!(0.22);
    let mut e = envelope(
        &actual,
        Scope::Addresses {
            addresses: vec![base],
        },
        "a",
    );
    e.changes = vec![Change::SceneMaterialSet {
        scene_ref: actual.scenes[0].scene_ref.clone(),
        presentation: material,
    }];
    assert!(
        Runtime::default().prepare(&actual, e).is_err(),
        "explicit base authority leaked into same-id retained state layer"
    );
    wire["component"] = json!("force");
    wire["constituent_ref"] = Value::Null;
    wire["property"] = json!("strength");
    let wrong_component: Address = serde_json::from_value(wire).unwrap();
    assert!(
        addressed(&d, &wrong_component).is_err(),
        "Layer parent was admitted on a non-Layer constituent"
    );
}

#[test]
fn a01_a02_unique_legacy_layer_resolves_actual_state_parent_without_rewriting_original_intent() {
    let d = complete_layer_document();
    let mut material = d.scenes[0].presentation.clone().unwrap();
    material.scene["entities"][0]["layers"][0]["id"] = json!("base:actual");
    let d = d
        .edited(vec![Change::SceneMaterialSet {
            scene_ref: d.scenes[0].scene_ref.clone(),
            presentation: material,
        }])
        .unwrap();
    let legacy = addr(
        Component::Layer,
        Some("a"),
        Some("retained-layer"),
        Some("z"),
    );
    assert_eq!(addressed(&d, &legacy).unwrap(), json!(0.17));
    let mut material = d.scenes[0].presentation.clone().unwrap();
    material.scene["entities"][0]["sequence"]["steps"][0]["layers"][0]["z"] = json!(0.27);
    let original_scope = Scope::Addresses {
        addresses: vec![legacy.clone()],
    };
    let mut e = envelope(&d, original_scope.clone(), "a");
    e.changes = vec![Change::SceneMaterialSet {
        scene_ref: d.scenes[0].scene_ref.clone(),
        presentation: material,
    }];
    let actual = d.edited(e.changes.clone()).unwrap();
    let op = Runtime::default().prepare(&d, e.clone()).expect(
        "unique actual state Layer must canonicalize before comparing native changed addresses",
    );
    assert_eq!(op.targets, vec![state_layer_addr("step:a", Some("z"))]);
    assert_eq!(
        op.envelope.scope, original_scope,
        "canonical resolved target rewrote original immutable selector wire"
    );
    assert_eq!(op.envelope, e);
    assert_eq!(addressed(&actual, &op.targets[0]).unwrap(), json!(0.27));
    let mut ambiguous = complete_layer_document();
    let same = ambiguous.scenes[0].presentation.as_ref().unwrap().scene["entities"][0]["sequence"]
        ["steps"][0]["layers"][0]
        .clone();
    ambiguous.scenes[0].presentation.as_mut().unwrap().scene["entities"][0]["layers"][0] = same;
    ambiguous.validate().unwrap();
    assert!(
        addressed(&ambiguous, &legacy).is_err(),
        "equal layer bodies erased distinct actual base/state parent coordinates"
    );
    let mut base_wire = serde_json::to_value(legacy).unwrap();
    base_wire["parent_ref"] = Value::Null;
    let base: Address = serde_json::from_value(base_wire).unwrap();
    assert_eq!(addressed(&ambiguous, &base).unwrap(), json!(0.17));
    assert_eq!(
        addressed(&ambiguous, &state_layer_addr("step:a", Some("z"))).unwrap(),
        json!(0.17)
    );
}

fn source_source_read_document() -> Document {
    let mut d = document();
    let subject: crate::expression::SubjectBinding = serde_json::from_value(json!({"subject_ref":"subject:actual-native-owner",
        "native_owner":"oi.expression","presentation_role":"thing","sources":[{"ref":"source:actual-owner","revision":"source-r1","availability":"available"}],"readings":[],"actions":[]})).unwrap();
    d = d
        .edited(vec![Change::SubjectBind {
            entity_ref: format!("{EXPRESSION}:entity:a"),
            binding: subject.clone(),
        }])
        .unwrap();
    let scene = d.scenes[0].scene_ref.clone();
    let mut presentation = d.scenes[0].presentation.clone().unwrap();
    let mut r = empty_retention();
    let locus =
        json!({"ref":"source:actual-place","revision":"place-r1","availability":"available"});
    r["source_basis"] = json!(subject.sources);
    r["bindings"] = json!([
        {"address":addr(Component::Entity,Some("a"),None,None),"principal":subject,"contributors":[],"locus":locus,"tags":[{"tag":"selected","origin":"authored"}]},
        {"address":addr(Component::Scene,None,None,None),"principal":subject,"contributors":[],"locus":locus,"tags":[]}]);
    presentation.scene["procedural"] = r;
    d.edited(vec![Change::SceneMaterialSet {
        scene_ref: scene,
        presentation,
    }])
    .unwrap()
}

#[test]
fn a14_intake_proposal_native_properties_and_tags_refuse_caller_relabeling() {
    let d = source_source_read_document();
    let target = addr(Component::Entity, Some("a"), None, None);
    let actual = source_target_parts(
        &d,
        &target,
        &["force_strength".into(), "force.strength".into()],
    )
    .unwrap();
    source_recheck_target_parts(&d, &actual).unwrap();
    assert_eq!(actual["properties"]["force_strength"], json!(0.2));
    assert_eq!(actual["properties"]["force.strength"], json!(0.2));
    for mutation in [
        "property",
        "tag",
        "tag_origin",
        "tag_scope",
        "tag_basis",
        "subject",
        "revision",
    ] {
        let mut wrong = actual.clone();
        match mutation {
            "property" => wrong["properties"]["force_strength"] = json!(19.0),
            "tag" => wrong["tags"][0]["value"] = json!("invented"),
            "tag_origin" => wrong["tags"][0]["origin"] = json!("native_source"),
            "tag_scope" => wrong["tags"][0]["scope_ref"] = json!("scene:foreign"),
            "tag_basis" => wrong["tags"][0]["basis"]["revision"] = json!("stale"),
            "subject" => wrong["subject"]["subject_ref"] = json!("subject:prime"),
            _ => wrong["revision"] = json!(0),
        }
        assert!(
            source_recheck_target_parts(&d, &wrong).is_err(),
            "caller {mutation} became an owner read"
        );
    }
    assert_eq!(d, source_source_read_document());
}

#[test]
fn a14_intake_proposal_native_scene_source_refuses_self_hash_and_profile_invention() {
    let d = source_source_read_document();
    let profile: ReadingRef = serde_json::from_value(
        json!({"ref":"source:actual-owner","revision":"source-r1","availability":"available"}),
    )
    .unwrap();
    let actual = source_native_scene_source(&d, &d.scenes[0].scene_ref, &profile).unwrap();
    assert!(actual["presentation"]["scene"].get("procedural").is_none());
    let mut wrong = actual.clone();
    wrong["presentation"]["scene"]["entities"][0]["force"]["strength"] = json!(19.0);
    wrong["material_fingerprint"] = json!(format!(
        "{:x}",
        Sha256::digest(serde_json::to_vec(&wrong["presentation"]).unwrap())
    ));
    assert_ne!(
        wrong,
        source_native_scene_source(&d, &d.scenes[0].scene_ref, &profile).unwrap(),
        "self-consistent caller hash replaced actual native Scene material"
    );
    let mut wrong_profile = profile.clone();
    wrong_profile.revision = "unattested-currentness".into();
    assert!(source_native_scene_source(&d, &d.scenes[0].scene_ref, &wrong_profile).is_err());
    let mut absent = d.clone();
    absent.scenes[0].presentation.as_mut().unwrap().scene["procedural"]["bindings"] = json!([]);
    assert!(
        source_native_scene_source(&absent, &absent.scenes[0].scene_ref, &profile).is_err(),
        "body/subject labels manufactured a full source binding"
    );
}

// Append to the independent child test module after its existing helpers.
// Tests actual production Source readers / Application admission. No grants,
// private qualification maps, physical ACKs, worker replies or clocks are made.

fn independent_source_read_document() -> Document {
    let mut d = document();
    let subject: crate::expression::SubjectBinding = serde_json::from_value(json!({
        "subject_ref":"subject:actual-native-owner","native_owner":"oi.expression","presentation_role":"thing",
        "sources":[{"ref":"source:actual-owner","revision":"source-r1","availability":"available"}],"readings":[],"actions":[]
    })).unwrap();
    d = d
        .edited(vec![
            Change::SubjectBind {
                entity_ref: format!("{EXPRESSION}:entity:a"),
                binding: subject.clone(),
            },
            Change::ParameterSet {
                entity_ref: format!("{EXPRESSION}:entity:a"),
                parameter: "x".into(),
                value: json!(80.0),
            },
        ])
        .unwrap();
    let scene = d.scenes[0].scene_ref.clone();
    let mut presentation = d.scenes[0].presentation.clone().unwrap();
    let mut retained = empty_retention();
    let locus =
        json!({"ref":"source:actual-place","revision":"place-r1","availability":"available"});
    retained["source_basis"] = json!(subject.sources);
    retained["bindings"] = json!([
        {"address":addr(Component::Entity,Some("a"),None,None),"principal":subject,"contributors":[],"locus":locus,"tags":[{"tag":"selected","origin":"authored"}]},
        {"address":addr(Component::Scene,None,None,None),"principal":subject,"contributors":[],"locus":locus,"tags":[]}
    ]);
    presentation.scene["procedural"] = retained;
    d.edited(vec![Change::SceneMaterialSet {
        scene_ref: scene,
        presentation,
    }])
    .unwrap()
}

fn independent_source_profile() -> ReadingRef {
    serde_json::from_value(
        json!({"ref":"source:actual-owner","revision":"source-r1","availability":"available"}),
    )
    .unwrap()
}

#[test]
fn a02_a14_native_read_source_issues_occurrences_and_refuses_relabeling_or_stale_cas() {
    let d = independent_source_read_document();
    let before = d.clone();
    let mut app = Application::default();
    let client = CentralClient::discover();
    app.open(d.clone(), "agent:independent".into()).unwrap();
    let request = |revision, scope, keys| Request::ReadSource {
        expression_ref: EXPRESSION.into(),
        expected_revision: revision,
        scope,
        property_keys: keys,
        scene_profile: None,
    };
    let (read, changed) = app
        .procedural(
            &client,
            request(
                d.revision,
                Scope::Addresses {
                    addresses: vec![addr(Component::Entity, Some("a"), None, None)],
                },
                vec!["x".into(), "position.x".into()],
            ),
        )
        .unwrap();
    assert!(changed.is_none());
    let row = &read["current_readings"][0];
    assert_eq!(row["occurrence_ref"], format!("{EXPRESSION}:entity:a"));
    assert_eq!(row["properties"]["x"], json!(80.0));
    assert_eq!(row["properties"]["position.x"], json!(0.2));
    validate_source_payload(&d, &read).unwrap();
    let mut alias = read.clone();
    alias["current_readings"][0]["occurrence_ref"] = json!(format!("{EXPRESSION}:entity:b"));
    let err = validate_source_payload(&d, &alias).unwrap_err();
    assert!(
        err.contains("occurrence key"),
        "A→B alias was masked by an unrelated property failure: {err}"
    );
    let scalar = addr(Component::Entity, Some("a"), None, Some("position.x"));
    let read_scalar = app
        .procedural(
            &client,
            request(
                d.revision,
                Scope::Addresses {
                    addresses: vec![scalar.clone()],
                },
                vec!["position.x".into()],
            ),
        )
        .unwrap()
        .0;
    assert_eq!(
        read_scalar["current_readings"][0]["address"],
        serde_json::to_value(&scalar).unwrap()
    );
    assert_eq!(
        read_scalar["current_readings"][0]["occurrence_ref"],
        source_occurrence_ref(&scalar).unwrap()
    );
    assert_ne!(
        read_scalar["current_readings"][0]["occurrence_ref"],
        row["occurrence_ref"]
    );
    let native_scalar = app.procedural(&client, request(d.revision,
        Scope::Addresses { addresses: vec![scalar.clone()] }, vec!["x".into()])).unwrap().0;
    assert_eq!(native_scalar["current_readings"][0]["properties"]["x"], json!(80.0),
        "the exact selected authored x scalar lost its actual native Parameter counterpart");
    assert!(app.procedural(&client, request(d.revision,
        Scope::Addresses {addresses: vec![scalar]}, vec!["y".into()])).is_err(),
        "authored scalar Source disclosed a sibling native Parameter");
    let (stale, changed) = app
        .procedural(&client, request(d.revision - 1, Scope::Expression, vec![]))
        .unwrap();
    assert_eq!(stale["state"], "revision_conflict");
    assert!(changed.is_none());
    assert_eq!(app.document(EXPRESSION).unwrap(), &before);
}

#[test]
fn a14_actual_scene_source_is_re_attested_across_library_and_program_even_after_self_hash() {
    let d = independent_source_read_document();
    let before = d.clone();
    let mut app = Application::default();
    let client = CentralClient::discover();
    app.open(d.clone(), "agent:independent".into()).unwrap();
    let (read, changed) = app
        .procedural(
            &client,
            Request::ReadSource {
                expression_ref: EXPRESSION.into(),
                expected_revision: d.revision,
                scope: Scope::Scenes {
                    scene_refs: vec![d.scenes[0].scene_ref.clone()],
                },
                property_keys: vec![],
                scene_profile: Some(independent_source_profile()),
            },
        )
        .unwrap();
    assert!(changed.is_none());
    let source = &read["scene_sources"][0];
    assert_eq!(
        source["source_basis"],
        json!({"source_ref":"source:actual-owner","revision":"source-r1"})
    );
    assert!(source["presentation"]["scene"].get("procedural").is_none());
    let payload = json!({"expression_ref":EXPRESSION,"document_revision":d.revision,
        "library":{"items":[source]},"program":{"outputs":[{"source":source}]}});
    validate_source_payload(&d, &payload).unwrap();
    for path in ["library", "program"] {
        let mut wrong = payload.clone();
        let source = if path == "library" {
            &mut wrong["library"]["items"][0]
        } else {
            &mut wrong["program"]["outputs"][0]["source"]
        };
        source["presentation"]["scene"]["entities"][0]["force"]["strength"] = json!(0.875);
        source["material_fingerprint"] = json!(format!(
            "{:x}",
            Sha256::digest(serde_json::to_vec(&source["presentation"]).unwrap())
        ));
        assert!(
            validate_source_payload(&d, &wrong).is_err(),
            "self-hashed {path} material became an actual owner source"
        );
    }
    let mut wrong = payload.clone();
    wrong["library"]["items"][0]["principal"]["subject_ref"] = json!("subject:wrong-prime");
    assert!(validate_source_payload(&d, &wrong).is_err());
    let mut wrong = payload.clone();
    wrong["library"]["items"][0]["source_basis"]["revision"] = json!("unattested-current");
    assert!(validate_source_payload(&d, &wrong).is_err());
    let mut wrong = payload.clone();
    wrong["library"]["items"][0]["locus_revision"] = json!("wrong-place");
    assert!(validate_source_payload(&d, &wrong).is_err());
    assert_eq!(app.document(EXPRESSION).unwrap(), &before);
}

#[test]
fn a01_a07_a14_new_output_materialization_uses_current_native_source_and_empty_owner_state() {
    let d = independent_source_read_document();
    let source =
        source_native_scene_source(&d, &d.scenes[0].scene_ref, &independent_source_profile())
            .unwrap();
    let output_ref = format!("{EXPRESSION}:scene:source-output");
    let payload = json!({"expression_ref":EXPRESSION,"document_revision":d.revision,
        "program":{"outputs":[{"scene_ref":output_ref,"source":source}]},
        "materialization":{"schema":"ql.procedural-materialization/v1","document_revision":d.revision,"rule_cursor":0,"state":"held",
            "scenes":[{"scene_ref":output_ref,"document_revision":d.revision,"existing_retention":null,"current_presentation":null,
                "principal":source["principal"],"contributors":source["contributors"],
                "locus":{"ref":source["locus_ref"],"revision":source["locus_revision"],"availability":"available"}}]}});
    // This positive concerns original Source intake only. It issues no native
    // producer grant, compiler completion, creation, output ownership or ACK.
    validate_source_payload(&d, &payload).unwrap();
    for case in [
        "principal",
        "contributors",
        "locus",
        "retention",
        "material",
        "duplicate",
        "foreign",
        "missing_program",
        "duplicate_output",
    ] {
        let mut wrong = payload.clone();
        match case {
            "principal" => {
                wrong["materialization"]["scenes"][0]["principal"]["subject_ref"] =
                    json!("subject:prime")
            }
            "contributors" => {
                wrong["materialization"]["scenes"][0]["contributors"] = json!([source["principal"]])
            }
            "locus" => {
                wrong["materialization"]["scenes"][0]["locus"]["revision"] = json!("prime-place")
            }
            "retention" => {
                wrong["materialization"]["scenes"][0]["existing_retention"] = empty_retention()
            }
            "material" => {
                wrong["materialization"]["scenes"][0]["current_presentation"] =
                    source["presentation"].clone()
            }
            "duplicate" => {
                let row = wrong["materialization"]["scenes"][0].clone();
                wrong["materialization"]["scenes"]
                    .as_array_mut()
                    .unwrap()
                    .push(row);
            }
            "foreign" => {
                wrong["materialization"]["scenes"][0]["scene_ref"] =
                    json!("expression:foreign:scene:source-output")
            }
            "missing_program" => wrong["program"]["outputs"] = json!([]),
            _ => {
                let row = wrong["program"]["outputs"][0].clone();
                wrong["program"]["outputs"]
                    .as_array_mut()
                    .unwrap()
                    .push(row);
            }
        }
        assert!(
            validate_source_payload(&d, &wrong).is_err(),
            "new Source context admitted {case}"
        );
    }
    assert_eq!(d, independent_source_read_document());
}

#[test]
fn a11_a14_native_layer_source_admission_is_same_in_procedural_and_ordinary_application() {
    let d = complete_layer_document();
    let scene_ref = d.scenes[0].scene_ref.clone();
    let before = d.clone();
    let mut valid = d.scenes[0].presentation.clone().unwrap();
    valid.scene["entities"][0]["layers"][0]["z"] = json!(0.12);
    valid.scene["entities"][0]["layers"][0]["text"] = json!("human layer text");
    let changes = vec![Change::SceneMaterialSet {
        scene_ref: scene_ref.clone(),
        presentation: valid,
    }];
    let mut e = envelope(&d, Scope::Expression, "a");
    e.changes = changes.clone();
    Runtime::default()
        .prepare(&d, e)
        .expect("equal Sources may retain different actual parent layer text and depth");
    let mut ordinary = Application::default();
    let client = CentralClient::discover();
    ordinary
        .open(d.clone(), "agent:independent".into())
        .unwrap();
    ordinary
        .apply(
            &client,
            ExpressionRequest::Edit {
                expression_ref: EXPRESSION.into(),
                expected_revision: d.revision,
                actor: "agent:independent".into(),
                changes,
            },
        )
        .unwrap();
    assert_eq!(
        ordinary.document(EXPRESSION).unwrap().scenes[0]
            .presentation
            .as_ref()
            .unwrap()
            .scene["entities"][0]["sequence"]["steps"][0],
        d.scenes[0].presentation.as_ref().unwrap().scene["entities"][0]["sequence"]["steps"][0],
        "base text/depth edit changed the actual state parent"
    );
    for case in [
        "shared_source",
        "base_id",
        "state_id",
        "state_id_unsafe",
        "state_id_long",
        "state_duplicate",
        "state_cross_duplicate",
        "state_budget",
        "base_container",
        "state_container_null",
        "state_container_object",
        "ascii_kind",
        "ascii_utf16",
        "ascii_font",
        "ascii_invert",
        "image_mode",
        "image_mime",
    ] {
        let mut material = d.scenes[0].presentation.clone().unwrap();
        let entity = &mut material.scene["entities"][0];
        match case {
            "shared_source" => {
                entity["sequence"]["steps"][0]["layers"][0]["source"]["ascii"]["text"] =
                    json!("different actual sample source")
            }
            "base_id" => entity["layers"][0]["id"] = json!(""),
            "state_id" => entity["sequence"]["steps"][0]["layers"][0]["id"] = json!(""),
            "state_id_unsafe" => {
                entity["sequence"]["steps"][0]["layers"][0]["id"] = json!("state layer with spaces")
            }
            "state_id_long" => {
                entity["sequence"]["steps"][0]["layers"][0]["id"] = json!("a".repeat(161))
            }
            "state_duplicate" => {
                let layer = entity["sequence"]["steps"][0]["layers"][0].clone();
                entity["sequence"]["steps"][0]["layers"]
                    .as_array_mut()
                    .unwrap()
                    .push(layer);
            }
            "state_cross_duplicate" => {
                entity["sequence"]["steps"][1]["layers"] =
                    entity["sequence"]["steps"][0]["layers"].clone()
            }
            "state_budget" => {
                let layer = entity["sequence"]["steps"][0]["layers"][0].clone();
                entity["sequence"]["steps"][0]["layers"] = json!(
                    (0..7)
                        .map(|i| {
                            let mut l = layer.clone();
                            l["id"] = json!(format!("state:{i}"));
                            l
                        })
                        .collect::<Vec<_>>()
                );
            }
            "base_container" => entity["layers"] = json!({"id":"object-is-not-a-layer-list"}),
            "state_container_null" => entity["sequence"]["steps"][0]["layers"] = Value::Null,
            "state_container_object" => {
                entity["sequence"]["steps"][0]["layers"] =
                    json!({"id":"object-is-not-a-layer-list"})
            }
            _ => {
                let source = match case {
                    "ascii_kind" => json!({"kind":"decorative-label"}),
                    "ascii_utf16" => {
                        json!({"kind":"ascii","ascii":{"text":"😀".repeat(25_001),"fontSize":64}})
                    }
                    "ascii_font" => json!({"kind":"ascii","ascii":{"text":"ATG","fontSize":1025}}),
                    "ascii_invert" => json!({"kind":"ascii","ascii":{"text":"ATG","invert":null}}),
                    "image_mode" => {
                        json!({"kind":"image","image":{"mode":"made-up","threshold":0.5,"scale":1.0}})
                    }
                    _ => {
                        json!({"kind":"image","image":{"mode":"luminance","threshold":0.5,"scale":1.0,"dataUrl":"data:image/svg+xml;base64,AAAA"}})
                    }
                };
                // Equal malformed Sources avoid masking their domain defect
                // behind the separate shared sample identity invariant.
                entity["layers"][0]["source"] = source.clone();
                entity["sequence"]["steps"][0]["layers"][0]["source"] = source;
            }
        }
        let changes = vec![Change::SceneMaterialSet {
            scene_ref: scene_ref.clone(),
            presentation: material,
        }];
        let mut e = envelope(&d, Scope::Expression, "a");
        e.changes = changes.clone();
        let mut rt = Runtime::default();
        assert!(
            rt.prepare(&d, e).is_err(),
            "procedural material admitted actual Source defect {case}"
        );
        assert!(rt.inspect("operation:independent").is_err());
        let mut app = Application::default();
        app.open(d.clone(), "agent:independent".into()).unwrap();
        assert!(
            app.apply(
                &client,
                ExpressionRequest::Edit {
                    expression_ref: EXPRESSION.into(),
                    expected_revision: d.revision,
                    actor: "agent:independent".into(),
                    changes
                }
            )
            .is_err(),
            "ordinary Application material admitted actual Source defect {case}"
        );
        assert_eq!(
            app.document(EXPRESSION).unwrap(),
            &before,
            "refused ordinary Source mutation {case} changed actual document"
        );
        assert_eq!(d, before);
    }
}

#[test]
fn a13_native_fork_keeps_original_receipts_and_copies_material_without_live_authority() {
    for (committed, saved) in [(false, false), (true, false), (true, true)] {
        let (mut app, client, original, operation) = if committed {
            warm_native_output_with_saved(saved)
        } else {
            let (mut app, client) = opened();
            let operation = prepared(&mut app, &client);
            let original = app.document(EXPRESSION).unwrap().clone();
            (app, client, original, operation)
        };
        let fork_ref = format!("expression:independent-native-fork-{committed}-{saved}");
        let original_journal = journal(&original).unwrap();
        let original_operation = serde_json::to_value(
            app.procedural_runtime
                .inspect(&operation.envelope.operation_ref)
                .unwrap(),
        )
        .unwrap();
        let (_, changed) = app
            .apply(
                &client,
                ExpressionRequest::Fork {
                    expression_ref: EXPRESSION.into(),
                    expected_revision: original.revision,
                    new_expression_ref: fork_ref.clone(),
                    actor: "agent:independent".into(),
                },
            )
            .unwrap();
        assert_eq!(changed.unwrap().expression_ref, fork_ref);
        let fork = app.document(&fork_ref).unwrap().clone();
        assert_eq!(app.document(EXPRESSION).unwrap(), &original);
        assert_eq!(
            journal(app.document(EXPRESSION).unwrap()).unwrap(),
            original_journal
        );
        assert_eq!(
            serde_json::to_value(
                app.procedural_runtime
                    .inspect(&operation.envelope.operation_ref)
                    .unwrap()
            )
            .unwrap(),
            original_operation
        );
        assert_eq!(fork.provenance.len(), original.provenance.len() + 1);
        assert_eq!(
            &fork.provenance[..original.provenance.len()],
            &original.provenance
        );
        assert_eq!(
            fork.provenance.last().unwrap(),
            &ReadingRef {
                r#ref: EXPRESSION.into(),
                revision: original.revision.to_string(),
                availability: super::super::Availability::Available,
            }
        );
        assert_eq!(
            fork.entities[&format!("{fork_ref}:entity:a")].parameters,
            original.entities[&format!("{EXPRESSION}:entity:a")].parameters
        );
        assert!(journal(&fork).unwrap().is_empty());
        assert!(
            !app.procedural_runtime
                .operations
                .values()
                .any(|op| op.envelope.expression_ref == fork_ref)
        );
        assert!(
            !app.procedural_runtime
                .producers
                .values()
                .any(|producer| producer.expression_ref == fork_ref)
        );
        if committed {
            let old = &original
                .scenes
                .iter()
                .find(|s| s.scene_ref.ends_with(":scene:generated"))
                .unwrap()
                .presentation
                .as_ref()
                .unwrap()
                .scene["procedural"];
            let new = &fork
                .scenes
                .iter()
                .find(|s| s.scene_ref.ends_with(":scene:generated"))
                .unwrap()
                .presentation
                .as_ref()
                .unwrap()
                .scene["procedural"];
            assert_eq!(new["source_basis"], old["source_basis"]);
            assert_eq!(
                new["procedures"][0]["definition"],
                old["procedures"][0]["definition"]
            );
            assert_eq!(
                new["contributions"][0]["owned_addresses"][0]["expression_ref"],
                fork_ref
            );
            assert_eq!(
                new["contributions"][0]["occurrence_ref"],
                format!("{fork_ref}:scene:generated")
            );
            assert_eq!(
                new["contributions"][0]["generated_basis"]["scene"]["id"],
                format!("{fork_ref}:scene:generated")
            );
            if saved {
                assert_eq!(
                    old["contributions"][0]["generated_basis"]["saved"]["id"],
                    format!("{EXPRESSION}:scene:generated")
                );
                assert_eq!(
                    new["contributions"][0]["generated_basis"]["saved"]["id"],
                    format!("{fork_ref}:scene:generated")
                );
                let saved_scene = fork
                    .scenes
                    .iter()
                    .find(|s| s.scene_ref.ends_with(":scene:generated"))
                    .unwrap()
                    .presentation
                    .as_ref()
                    .unwrap()
                    .saved
                    .as_ref()
                    .unwrap();
                assert_eq!(saved_scene["id"], format!("{fork_ref}:scene:generated"));
            }
            assert!(
                app.procedural_runtime
                    .output_readings(&fork, "procedure:independent-owner")
                    .is_err()
            );
        }
        let (reading, _) = app
            .procedural(
                &client,
                Request::Read {
                    expression_ref: fork_ref,
                    scope: Scope::Expression,
                    after_cursor: Some(0),
                },
            )
            .unwrap();
        assert_eq!(reading["operation_history"], json!([]));
        assert_eq!(reading["effective_observations"], json!([]));
    }
}

#[test]
fn a13_native_runtime_retirement_and_reopen_resynchronise_without_prior_life_deltas() {
    let (mut app, client) = opened();
    let operation = prepared(&mut app, &client);
    app.procedural(
        &client,
        Request::Commit {
            operation_ref: operation.envelope.operation_ref.clone(),
        },
    )
    .unwrap();
    let retained = app
        .procedural_runtime
        .checkpoint_document(app.document(EXPRESSION).unwrap())
        .unwrap();
    let retained_bytes = serde_json::to_vec(&retained).unwrap();
    let (before, _) = app
        .procedural(
            &client,
            Request::Read {
                expression_ref: EXPRESSION.into(),
                scope: Scope::Expression,
                after_cursor: Some(0),
            },
        )
        .unwrap();
    assert!(!before["deltas"].as_array().unwrap().is_empty());
    let other = "expression:other-retirement-owner";
    app.apply(
        &client,
        ExpressionRequest::Create {
            expression_ref: other.into(),
            title: "Other native material".into(),
            actor: "agent:independent".into(),
        },
    )
    .unwrap();
    let mut other_intent = envelope(app.document(other).unwrap(), Scope::Expression, "a");
    other_intent.operation_ref = "operation:other-retirement-owner".into();
    other_intent.changes = vec![Change::Rename {
        title: "Other owner's actual edit".into(),
    }];
    app.procedural(
        &client,
        Request::Prepare {
            envelope: Box::new(other_intent.clone()),
        },
    )
    .unwrap();
    app.procedural(
        &client,
        Request::Commit {
            operation_ref: other_intent.operation_ref.clone(),
        },
    )
    .unwrap();
    let cursor = app.procedural_runtime.cursor;
    // Invoke the actual cleanup callback used by native Close. No save marker,
    // receiving ACK, producer qualification or external effect is fabricated.
    app.procedural_runtime.release_expression(EXPRESSION);
    assert_eq!(app.procedural_runtime.cursor, cursor);
    assert!(
        !app.procedural_runtime
            .deltas
            .iter()
            .any(|row| row["delta"]["expression_ref"] == EXPRESSION)
    );
    assert!(
        app.procedural_runtime
            .deltas
            .iter()
            .any(|row| row["delta"]["expression_ref"] == other)
    );
    assert!(
        app.procedural_runtime
            .inspect(&other_intent.operation_ref)
            .is_ok()
    );
    let mut fresh = Application::default();
    fresh.procedural_runtime = std::mem::take(&mut app.procedural_runtime);
    fresh
        .open(
            serde_json::from_slice(&retained_bytes).unwrap(),
            "agent:independent".into(),
        )
        .unwrap();
    let (reopened, _) = fresh
        .procedural(
            &client,
            Request::Read {
                expression_ref: EXPRESSION.into(),
                scope: Scope::Expression,
                after_cursor: Some(0),
            },
        )
        .unwrap();
    assert_eq!(reopened["resynchronised"], true);
    assert_eq!(reopened["deltas"], json!([]));
    assert_eq!(reopened["effective_observations"], json!([]));
    assert!(!reopened["snapshot"].as_array().unwrap().is_empty());
    assert!(
        reopened["operation_history"]
            .as_array()
            .unwrap()
            .iter()
            .all(|row| row["restored"] == true)
    );
    let unchanged = fresh.document(EXPRESSION).unwrap().clone();
    let (repeated, changed) = fresh
        .procedural(
            &client,
            Request::Commit {
                operation_ref: operation.envelope.operation_ref,
            },
        )
        .unwrap();
    assert_eq!(repeated["repeated"], true);
    assert!(changed.is_none());
    assert_eq!(fresh.document(EXPRESSION).unwrap(), &unchanged);
    let mut continuing = envelope(&unchanged, Scope::Expression, "a");
    continuing.operation_ref = "operation:after-native-retirement".into();
    continuing.changes = vec![Change::ParameterSet {
        entity_ref: format!("{EXPRESSION}:entity:a"),
        parameter: "scale".into(),
        value: json!(3.0),
    }];
    fresh
        .procedural(
            &client,
            Request::Prepare {
                envelope: Box::new(continuing.clone()),
            },
        )
        .unwrap();
    fresh
        .procedural(
            &client,
            Request::Commit {
                operation_ref: continuing.operation_ref,
            },
        )
        .unwrap();
    let (continuation, _) = fresh
        .procedural(
            &client,
            Request::Read {
                expression_ref: EXPRESSION.into(),
                scope: Scope::Expression,
                after_cursor: Some(cursor),
            },
        )
        .unwrap();
    assert_eq!(continuation["resynchronised"], true);
    let (current, _) = fresh
        .procedural(
            &client,
            Request::Read {
                expression_ref: EXPRESSION.into(),
                scope: Scope::Expression,
                after_cursor: Some(cursor + 1),
            },
        )
        .unwrap();
    assert_eq!(current["resynchronised"], false);
    assert!(!current["deltas"].as_array().unwrap().is_empty());
    assert_eq!(
        fresh.document(EXPRESSION).unwrap().entities[&format!("{EXPRESSION}:entity:a")].parameters
            ["scale"]
            .value,
        3.0
    );
}

#[test]
fn a13_native_fork_preserves_prefixed_layer_state_and_driver_coordinates() {
    let mut original = complete_layer_document();
    let layer_ref = format!("{EXPRESSION}:opaque-layer");
    let state_ref = format!("{EXPRESSION}:opaque-state");
    let driver_ref = format!("{EXPRESSION}:opaque-driver");
    let mut state = state_layer_addr(&state_ref, None);
    state.constituent_ref = Some(layer_ref.clone());
    let link = addr(Component::SequenceLink, Some("a"), Some(&state_ref), None);
    let driver = addr(Component::Driver, Some("a"), Some(&driver_ref), None);
    let material = original.scenes[0].presentation.as_mut().unwrap();
    material.scene["entities"][0]["sequence"]["steps"][0]["id"] = json!(state_ref);
    material.scene["entities"][0]["sequence"]["steps"][0]["layers"][0]["id"] = json!(layer_ref);
    material.saved = Some(material.scene.clone());
    let generated_basis = serde_json::to_value(&*material).unwrap();
    let mut retained = empty_retention();
    let locus = json!({"ref":EXPRESSION,"revision":original.revision.to_string(),"availability":"available"});
    retained["bindings"] = json!([{"address":state,"locus":locus,
        "principal":{"subject_ref":"agent:independent","native_owner":"agent-system","sources":[]},
        "contributors":[],"tags":[{"tag":"work","origin":"authored"}]}]);
    retained["controls"] = json!([{"address":state,"target":driver_ref,
        "dormant_lanes":[],"dormant_tracks":[],"source_basis":[]}]);
    retained["procedures"] = json!([{"procedure_ref":"procedure:independent-owner","revision":"1","source_basis":[],
        "seed":{"algorithm":"mulberry32","version":"1","value":"17"},
        "definition":{"schema":"oi.native-functional-owner-test/v1","admitted_operation":"scene_material_set"},
        "resolved_targets":[state,link,driver],"cursor":0,"state":"held","membership_events":[]}]);
    retained["contributions"] = json!([{"contribution_ref":"contribution:independent-owner","procedure_ref":"procedure:independent-owner",
        "output_slot":"scene","subject_refs":[],"occurrence_ref":original.scenes[0].scene_ref,"recipe_revision":"1",
        "owned_addresses":[state,link,driver],"generated_basis":generated_basis,
        "authored_overrides":[{"address":state,"actor":"agent:independent"}],"status":"active"}]);
    original.scenes[0].presentation.as_mut().unwrap().scene["procedural"] = retained;
    original.validate().unwrap();
    let original_state = addressed(&original, &state).unwrap();
    let mut app = Application::default();
    let client = CentralClient::discover();
    app.open(original.clone(), "agent:independent".into())
        .unwrap();
    let fork_ref = String::from("expression:independent-native-fork-opaque-coordinates");
    app.apply(
        &client,
        ExpressionRequest::Fork {
            expression_ref: EXPRESSION.into(),
            expected_revision: original.revision,
            new_expression_ref: fork_ref.clone(),
            actor: "agent:independent".into(),
        },
    )
    .unwrap();
    let fork = app.document(&fork_ref).unwrap();
    assert_eq!(app.document(EXPRESSION).unwrap(), &original);
    let p = fork.scenes[0].presentation.as_ref().unwrap();
    let retained = &p.scene["procedural"];
    assert_eq!(retained["controls"][0]["target"], driver_ref);
    assert_eq!(retained["bindings"][0]["locus"], locus);
    for address in std::iter::once(&retained["bindings"][0]["address"])
        .chain(std::iter::once(&retained["controls"][0]["address"]))
        .chain(
            retained["procedures"][0]["resolved_targets"]
                .as_array()
                .unwrap(),
        )
        .chain(
            retained["contributions"][0]["owned_addresses"]
                .as_array()
                .unwrap(),
        )
        .chain(std::iter::once(
            &retained["contributions"][0]["authored_overrides"][0]["address"],
        ))
    {
        let address: Address = serde_json::from_value(address.clone()).unwrap();
        assert_eq!(address.expression_ref, fork_ref);
        assert_eq!(address.scene_ref, Some(format!("{fork_ref}:scene:main")));
        assert_eq!(address.entity_ref, Some(format!("{fork_ref}:entity:a")));
        let actual = addressed(fork, &address)
            .expect("fork retained address must resolve against actual native material");
        match address.component {
            Component::Layer => {
                assert_eq!(address.constituent_ref.as_deref(), Some(layer_ref.as_str()));
                assert_eq!(address.parent_ref, Some(Some(state_ref.clone())));
                assert_eq!(actual, original_state);
            }
            Component::SequenceLink => assert_eq!(actual["id"], state_ref),
            Component::Driver => assert_eq!(actual["target"], driver_ref),
            _ => panic!("unexpected test coordinate"),
        }
    }
    let basis = &retained["contributions"][0]["generated_basis"];
    assert_eq!(basis["saved"]["id"], format!("{fork_ref}:scene:main"));
    assert_eq!(
        basis["saved"]["entities"][0]["id"],
        format!("{fork_ref}:entity:a")
    );
    assert_eq!(
        basis["saved"]["entities"][0]["sequence"]["steps"][0]["id"],
        state_ref
    );
    assert_eq!(
        basis["saved"]["entities"][0]["sequence"]["steps"][0]["layers"][0]["id"],
        layer_ref
    );
    let addresses: Vec<Address> =
        serde_json::from_value(retained["procedures"][0]["resolved_targets"].clone()).unwrap();
    let (read, _) = app
        .procedural(
            &client,
            Request::Read {
                expression_ref: fork_ref,
                scope: Scope::Addresses { addresses },
                after_cursor: Some(0),
            },
        )
        .unwrap();
    assert_eq!(read["snapshot"].as_array().unwrap().len(), 3);
}
