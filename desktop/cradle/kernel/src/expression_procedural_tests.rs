//! Independent tests to include as a child of expression_procedural in the
//! native owner's qualified CI cut. Real Document::edited/Runtime consumers;
//! no physical/audio ACKs or installed performance are invented.
use super::*;

const EXPRESSION: &str = "expression:independent-native";

#[test]
fn a05_a13_actual_journal_revisions_preserve_material_but_real_edits_invalidate_it() {
    let (mut app, client) = opened();
    let op = prepared(&mut app, &client);
    app.procedural(
        &client,
        Request::Commit {
            operation_ref: op.envelope.operation_ref.clone(),
        },
    )
    .unwrap();
    let first = app
        .procedural_runtime
        .inspect(&op.envelope.operation_ref)
        .unwrap()
        .clone();
    let material_revision = first.applied_revision.unwrap();
    assert!(app
        .procedural_runtime
        .current_material(app.document(EXPRESSION).unwrap(), &first));

    let d = app.document(EXPRESSION).unwrap().clone();
    let mut next = envelope(&d, Scope::Expression, "b");
    next.operation_ref = "operation:journal-only-second-preparation".into();
    app.procedural(
        &client,
        Request::Prepare {
            envelope: Box::new(next.clone()),
        },
    )
    .unwrap();
    assert!(app.document(EXPRESSION).unwrap().revision > material_revision);
    assert!(app
        .procedural_runtime
        .current_material(app.document(EXPRESSION).unwrap(), &first));
    app.procedural(
        &client,
        Request::Cancel {
            operation_ref: next.operation_ref,
        },
    )
    .unwrap();
    assert!(app
        .procedural_runtime
        .current_material(app.document(EXPRESSION).unwrap(), &first));
    assert_eq!(
        app.document(EXPRESSION).unwrap().entities[&format!("{EXPRESSION}:entity:a")].parameters
            ["scale"]
            .value,
        2.0
    );

    let d = app.document(EXPRESSION).unwrap().clone();
    app.apply(
        &client,
        ExpressionRequest::Edit {
            expression_ref: EXPRESSION.into(),
            expected_revision: d.revision,
            actor: "human:actual-material-intervention".into(),
            changes: vec![Change::ParameterSet {
                entity_ref: format!("{EXPRESSION}:entity:a"),
                parameter: "scale".into(),
                value: json!(3.0),
            }],
        },
    )
    .unwrap();
    assert!(!app
        .procedural_runtime
        .current_material(app.document(EXPRESSION).unwrap(), &first));
    assert_eq!(
        app.procedural_runtime
            .inspect(&op.envelope.operation_ref)
            .unwrap()
            .applied_revision,
        Some(material_revision)
    );
}

#[test]
fn a05_a13_borrowed_journal_classifier_cannot_hide_material_or_source_changes() {
    let (app, _, document, _) = warm_native_output_with_saved(true);
    let scene = document
        .scenes
        .iter()
        .find(|s| s.scene_ref.ends_with(":generated"))
        .unwrap();
    let original = scene.presentation.as_ref().unwrap();
    let mut journal = original.clone();
    journal.scene["procedural"]["operations"] = json!([]);
    let change = |presentation| Change::SceneMaterialSet {
        scene_ref: scene.scene_ref.clone(),
        presentation,
    };
    assert!(observation::journal_only(
        &document,
        &[change(journal.clone())]
    ));
    for mutation in 0..5 {
        let mut altered = journal.clone();
        match mutation {
            0 => altered.scene["name"] = json!("Changed authored Scene"),
            1 => altered.scene["procedural"]["procedures"][0]["cursor"] = json!(1),
            2 => {
                altered.scene["procedural"]["contributions"][0]["recipe_revision"] =
                    json!("changed")
            }
            3 => {
                altered.scene["procedural"]["contributions"][0]["authored_overrides"] =
                    json!([{"human":true}])
            }
            _ => altered.saved = None,
        }
        assert!(
            !observation::journal_only(&document, &[change(altered)]),
            "material/source mutation {mutation} was called journal-only"
        );
    }
    assert!(!observation::journal_only(&document, &[]));
    assert!(!observation::journal_only(
        &document,
        &[
            change(journal),
            Change::ParameterSet {
                entity_ref: format!("{EXPRESSION}:entity:a"),
                parameter: "scale".into(),
                value: json!(4.0),
            }
        ]
    ));
    assert_eq!(app.document(EXPRESSION).unwrap(), &document);
}

#[test]
fn a13_actual_cold_reopen_and_release_do_not_restore_material_runtime_fences() {
    let (mut app, _, document, operation) = warm_native_output();
    assert!(app
        .procedural_runtime
        .current_material(&document, &operation));
    let saved = app
        .procedural_runtime
        .checkpoint_document(&document)
        .unwrap();
    let mut reopened = Application::default();
    reopened
        .open(saved.clone(), "human:actual-reopen".into())
        .unwrap();
    let historical = reopened
        .procedural_runtime
        .inspect(&operation.envelope.operation_ref)
        .unwrap();
    assert_eq!(historical.status, Status::Applied);
    assert!(!reopened
        .procedural_runtime
        .current_material(&saved, historical));
    app.procedural_runtime.release_expression(EXPRESSION);
    assert!(app.procedural_runtime.material_fences.is_empty());
    assert!(app
        .procedural_runtime
        .inspect(&operation.envelope.operation_ref)
        .is_err());
}

#[test]
fn a04_a05_manual_material_cannot_accept_a_caller_held_consumer_receipt() {
    let (mut app, client, document, operation) = warm_native_output();
    let refused = ConsumerObservation {
        owner: "claimed-physical-owner".into(),
        instance_ref: "claimed-resident".into(),
        generation: 1,
        document_revision: operation.applied_revision.unwrap(),
        operation_ref: operation.envelope.operation_ref.clone(),
        cursor: 1,
        targets: operation.targets.clone(),
        effective: json!({"claimed":true}),
    };
    assert!(app.procedural_observe_from_owner(&client, refused).is_err());
    assert_eq!(app.document(EXPRESSION).unwrap(), &document);
    assert_eq!(
        app.procedural_runtime
            .inspect(&operation.envelope.operation_ref)
            .unwrap(),
        &operation
    );
}

#[test]
fn a06_a14_lifecycle_background_scene_policy_uses_actual_retained_procedure_without_focus() {
    let (app, _client, document, _) = warm_native_output();
    let generated = format!("{EXPRESSION}:scene:generated");
    assert_ne!(document.selection.scene_ref.as_str(), generated.as_str());
    let mut intent = lifecycle::Intent {
        expression_ref: document.expression_ref.clone(),
        expected_revision: document.revision,
        scene_ref: generated.clone(),
        operation_ref: "operation:background-scene-policy".into(),
        actor: "human:independent".into(),
        procedure_ref: "procedure:independent-owner".into(),
        expected_procedure_revision: "1".into(),
        action: lifecycle::Action::ScenePolicy {
            from_scene_ref: generated,
            to_scene_ref: format!("{EXPRESSION}:scene:main"),
            policy: lifecycle::ScenePolicy::Hold,
        },
    };
    intent.validate(&document).unwrap();
    assert_eq!(app.document(EXPRESSION).unwrap(), &document);
    intent.expected_procedure_revision = "foreign-revision".into();
    assert!(intent.validate(&document).is_err());
    intent.expected_procedure_revision = "1".into();
    intent.expected_revision += 1;
    assert_eq!(intent.validate(&document).unwrap_err(), "revision_conflict");
    assert_eq!(app.document(EXPRESSION).unwrap(), &document);
}

#[test]
fn a05_a06_lifecycle_stable_contribution_intent_cannot_detach_another_owner_or_supply_native_facts()
{
    let (app, _client, document, _) = warm_native_output();
    let mut intent = lifecycle::Intent {
        expression_ref: document.expression_ref.clone(),
        expected_revision: document.revision,
        scene_ref: format!("{EXPRESSION}:scene:generated"),
        operation_ref: "operation:detach-stable-contribution".into(),
        actor: "human:independent".into(),
        procedure_ref: "procedure:independent-owner".into(),
        expected_procedure_revision: "1".into(),
        action: lifecycle::Action::ContributionDetach {
            contribution_ref: "contribution:independent-owner".into(),
        },
    };
    intent.validate(&document).unwrap();
    let wire = intent.wire().unwrap();
    let native: Request = serde_json::from_value(wire.clone()).unwrap();
    assert_eq!(lifecycle::Intent::from_request(&native).unwrap(), intent);
    for key in [
        "rule_event",
        "native_position",
        "native_clock",
        "reading",
        "prepared",
        "source_current",
    ] {
        let mut supplied = wire.clone();
        supplied[key] = json!({"claimed":true});
        assert!(
            serde_json::from_value::<Request>(supplied).is_err(),
            "caller field {key} reached the private native lifecycle factory"
        );
    }
    intent.action = lifecycle::Action::ContributionDetach {
        contribution_ref: "contribution:another-owner".into(),
    };
    assert!(intent.validate(&document).is_err());
    assert_eq!(app.document(EXPRESSION).unwrap(), &document);
}

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
        "definition":{"schema":"oi.native-functional-owner-test/v1","expression_ref":EXPRESSION,"procedure_ref":"procedure:independent-owner","revision":"1","admitted_operation":"scene_create"},
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
        assert!(result
            .unwrap_err()
            .contains("actual native producer admission"));
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
    d.scenes[0].presentation.as_mut().unwrap().scene["entities"][0]["sequence"]["steps"][1]
        ["layers"][0]["id"] = json!("layer:state-a");
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
        assert!(reading["current_basis"]["scene"]
            .get("procedural")
            .is_none());
        assert!(reading["generated_basis"]["scene"]
            .get("procedural")
            .is_none());
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
    material["name"] = json!(d.scenes[0].title);
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
    let native_scalar = app
        .procedural(
            &client,
            request(
                d.revision,
                Scope::Addresses {
                    addresses: vec![scalar.clone()],
                },
                vec!["x".into()],
            ),
        )
        .unwrap()
        .0;
    assert_eq!(
        native_scalar["current_readings"][0]["properties"]["x"],
        json!(80.0),
        "the exact selected authored x scalar lost its actual native Parameter counterpart"
    );
    assert!(
        app.procedural(
            &client,
            request(
                d.revision,
                Scope::Addresses {
                    addresses: vec![scalar]
                },
                vec!["y".into()]
            )
        )
        .is_err(),
        "authored scalar Source disclosed a sibling native Parameter"
    );
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
                entity["sequence"]["steps"][0]["layers"] = json!((0..7)
                    .map(|i| {
                        let mut l = layer.clone();
                        l["id"] = json!(format!("state:{i}"));
                        l
                    })
                    .collect::<Vec<_>>());
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

// Append after the existing independent helpers and Source reader supplement.
// Real Document::edited and native source intake only. No producer admissions,
// qualified-operation maps, current owner ACKs or compiler completions are forged.

fn independent_output_contribution(
    _d: &Document,
    output: &str,
    occurrence: &str,
    owned: Vec<Address>,
    generated: Value,
) -> Value {
    json!({"contribution_ref":format!("contribution:independent:{output}"),"procedure_ref":"procedure:independent:basis",
        "output_slot":output,"subject_refs":[],"occurrence_ref":occurrence,"recipe_revision":"recipe-r1",
        "owned_addresses":owned,"generated_basis":generated,"authored_overrides":[],"status":"active"})
}

fn independent_retained_basis(d: &Document, contributions: Vec<Value>) -> Value {
    let mut retained = empty_retention();
    retained["procedures"] = json!([{"procedure_ref":"procedure:independent:basis","revision":"1","source_basis":[],
        "seed":{"algorithm":"mulberry32","version":"1","value":"17"},
        "definition":{"schema":"oi.native-source-intake-test/v1","reads_document_revision":d.revision},
        "resolved_targets":[],"cursor":0,"state":"held","membership_events":[]}]);
    retained["contributions"] = json!(contributions);
    retained
}

#[test]
fn a02_a07_a14_native_parameter_output_reads_actual_alias_units_and_refuses_other_owners() {
    let d = independent_source_read_document()
        .edited(vec![
            Change::ParameterSet {
                entity_ref: format!("{EXPRESSION}:entity:a"),
                parameter: "force_radius".into(),
                value: json!(120.0),
            },
            Change::ParameterSet {
                entity_ref: format!("{EXPRESSION}:entity:a"),
                parameter: "force_strength".into(),
                value: json!(0.875),
            },
        ])
        .unwrap();
    let before = d.clone();
    for (component, property, parameter, expected, authored, recipe_operand) in [
        (
            Component::Force,
            "radius",
            "force_radius",
            json!(120.0),
            json!(0.3),
            json!(0.1),
        ),
        (
            Component::Force,
            "strength",
            "force_strength",
            json!(0.875),
            json!(0.875),
            json!(0.2),
        ),
        (
            Component::Entity,
            "position.x",
            "x",
            json!(80.0),
            json!(0.2),
            json!(0.0),
        ),
    ] {
        let target = addr(component, Some("a"), None, Some(property));
        let contribution = independent_output_contribution(
            &d,
            "force",
            &format!("{EXPRESSION}:entity:a"),
            vec![target.clone()],
            json!({"parameter":parameter,"value":recipe_operand}),
        );
        let original = contribution.clone();
        let actual = source_current_output_basis(&d, &contribution).unwrap();
        assert_eq!(
            actual,
            json!({"schema":"ql.native-parameter-state/v1","address":target,"parameter":parameter,
            "value":expected,"target_revision":d.entities[&format!("{EXPRESSION}:entity:a")].revision})
        );
        assert_eq!(
            source_native_property(&d, &target, property).unwrap(),
            authored
        );
        assert_eq!(
            contribution, original,
            "reading native current state rewrote its generated recipe operand"
        );
        for case in [
            "other_parameter",
            "other_occurrence",
            "foreign_expression",
            "empty_owner",
            "second_owner",
        ] {
            let mut wrong = contribution.clone();
            match case {
                "other_parameter" => wrong["generated_basis"]["parameter"] = json!("y"),
                "other_occurrence" => {
                    wrong["occurrence_ref"] = json!(format!("{EXPRESSION}:entity:b"))
                }
                "foreign_expression" => {
                    wrong["owned_addresses"][0]["expression_ref"] = json!("expression:foreign")
                }
                "empty_owner" => wrong["owned_addresses"] = json!([]),
                _ => {
                    let other = serde_json::to_value(addr(
                        Component::Force,
                        Some("b"),
                        None,
                        Some("strength"),
                    ))
                    .unwrap();
                    wrong["owned_addresses"].as_array_mut().unwrap().push(other);
                }
            }
            assert!(
                source_current_output_basis(&d, &wrong).is_err(),
                "native {parameter} current basis admitted {case}"
            );
        }
    }
    assert_eq!(d, before);
}

#[test]
fn a07_a14_scene_output_reads_actual_human_material_and_fences_owner_before_schema_branch() {
    let d = independent_source_read_document();
    let generated = serde_json::to_value(d.scenes[0].presentation.as_ref().unwrap()).unwrap();
    let mut material = d.scenes[0].presentation.clone().unwrap();
    material.scene["character"] = json!("human preserved passage");
    let d = d
        .edited(vec![
            Change::SceneMaterialSet {
                scene_ref: d.scenes[0].scene_ref.clone(),
                presentation: material,
            },
            Change::ParameterSet {
                entity_ref: format!("{EXPRESSION}:entity:a"),
                parameter: "force_strength".into(),
                value: json!(0.875),
            },
        ])
        .unwrap();
    let original = independent_output_contribution(
        &d,
        "scene",
        &d.scenes[0].scene_ref,
        vec![addr(Component::Scene, None, None, None)],
        generated.clone(),
    );
    let actual = source_current_output_basis(&d, &original).unwrap();
    let mut expected = serde_json::to_value(d.scenes[0].presentation.as_ref().unwrap()).unwrap();
    expected["scene"]
        .as_object_mut()
        .unwrap()
        .remove("procedural");
    assert_eq!(actual, expected);
    assert_eq!(actual["scene"]["character"], "human preserved passage");
    assert_eq!(
        actual["scene"]["entities"][0]["force"]["strength"],
        json!(0.875)
    );
    assert_eq!(original["generated_basis"], generated);
    assert!(
        actual["scene"].get("procedural").is_none(),
        "recursive native journal leaked into compiler current material"
    );
    for case in [
        "foreign_owner",
        "entity_owner",
        "selected_property",
        "empty_owner",
        "other_occurrence",
    ] {
        let mut wrong = original.clone();
        match case {
            "foreign_owner" => {
                wrong["owned_addresses"][0]["expression_ref"] = json!("expression:foreign")
            }
            "entity_owner" => {
                wrong["owned_addresses"] = json!([addr(Component::Entity, Some("a"), None, None)])
            }
            "selected_property" => wrong["owned_addresses"][0]["property"] = json!("title"),
            "empty_owner" => wrong["owned_addresses"] = json!([]),
            _ => wrong["occurrence_ref"] = json!(format!("{EXPRESSION}:scene:missing")),
        }
        assert!(
            source_current_output_basis(&d, &wrong).is_err(),
            "Scene early schema branch admitted {case}"
        );
    }
}

#[test]
fn a09_a14_atlas_output_reads_actual_native_focus_and_order_of_the_same_expression() {
    let d = independent_source_read_document();
    let second = format!("{EXPRESSION}:scene:second");
    let main = d.scenes[0].scene_ref.clone();
    let d = d
        .edited(vec![
            Change::SceneCreate {
                scene_ref: second.clone(),
                title: "Second canonical passage".into(),
            },
            Change::SceneReorder {
                scene_refs: vec![second.clone(), main.clone()],
            },
            Change::Focus {
                scene_ref: second.clone(),
                entity_ref: None,
            },
        ])
        .unwrap();
    let whole = address(&d, None, None, Component::Expression);
    let contribution = independent_output_contribution(
        &d,
        "atlas",
        EXPRESSION,
        vec![whole.clone()],
        json!({"native_flow":[{"change":"focus","scene_ref":main,"entity_ref":null},
            {"change":"scene_reorder","scene_refs":[main,second]}]}),
    );
    let original = contribution.clone();
    let actual = source_current_output_basis(&d, &contribution).unwrap();
    assert_eq!(
        actual,
        json!({"schema":"ql.native-atlas-state/v1","expression_ref":EXPRESSION,
        "focus":d.selection,"scene_order":[second,main]})
    );
    assert_eq!(contribution, original);
    for case in [
        "other_expression",
        "scene_owner",
        "selected_property",
        "empty_owner",
        "other_occurrence",
    ] {
        let mut wrong = contribution.clone();
        match case {
            "other_expression" => {
                wrong["owned_addresses"][0]["expression_ref"] = json!("expression:foreign")
            }
            "scene_owner" => {
                wrong["owned_addresses"] = json!([addr(Component::Scene, None, None, None)])
            }
            "selected_property" => wrong["owned_addresses"][0]["property"] = json!("title"),
            "empty_owner" => wrong["owned_addresses"] = json!([]),
            _ => wrong["occurrence_ref"] = json!("expression:foreign"),
        }
        assert!(
            source_current_output_basis(&d, &wrong).is_err(),
            "Atlas native current basis admitted {case}"
        );
    }
}

#[test]
fn a07_a14_source_current_contribution_intake_re_attests_material_without_granting_creation() {
    let d = independent_source_read_document();
    let generated = serde_json::to_value(d.scenes[0].presentation.as_ref().unwrap()).unwrap();
    let contribution = independent_output_contribution(
        &d,
        "scene",
        &d.scenes[0].scene_ref,
        vec![addr(Component::Scene, None, None, None)],
        generated,
    );
    let whole = address(&d, None, None, Component::Expression);
    let atlas = independent_output_contribution(
        &d,
        "atlas",
        EXPRESSION,
        vec![whole],
        json!({"native_flow":[{"change":"focus","scene_ref":d.scenes[0].scene_ref,"entity_ref":null}]}),
    );
    let mut presentation = d.scenes[0].presentation.clone().unwrap();
    presentation.scene["procedural"] =
        independent_retained_basis(&d, vec![contribution.clone(), atlas.clone()]);
    let second = format!("{EXPRESSION}:scene:projection");
    let mut projected = presentation.clone();
    projected.scene["id"] = json!(second);
    projected.scene["name"] = json!("Whole output projection");
    projected.scene["entities"] = json!([]);
    projected.scene["procedural"] = independent_retained_basis(&d, vec![atlas.clone()]);
    let d = d
        .edited(vec![
            Change::SceneMaterialSet {
                scene_ref: d.scenes[0].scene_ref.clone(),
                presentation,
            },
            Change::SceneCreate {
                scene_ref: second.clone(),
                title: "Whole output projection".into(),
            },
            Change::SceneMaterialSet {
                scene_ref: second,
                presentation: projected,
            },
        ])
        .unwrap();
    let material = source_current_output_basis(&d, &contribution).unwrap();
    let atlas_material = source_current_output_basis(&d, &atlas).unwrap();
    let payload = json!({"expression_ref":EXPRESSION,"document_revision":d.revision,
        "current_contributions":[{"contribution_ref":contribution["contribution_ref"],"material":material,"overlays":[]},
            {"contribution_ref":atlas["contribution_ref"],"material":atlas_material,"overlays":[]}]});
    validate_source_payload(&d, &payload).unwrap();
    assert!(
        Runtime::default()
            .output_readings(&d, "procedure:independent:basis")
            .is_err(),
        "a document-current material reading granted source-qualified original creation"
    );
    for case in [
        "changed_material",
        "unknown_identity",
        "duplicate",
        "caller_overlays",
        "missing_overlays",
    ] {
        let mut wrong = payload.clone();
        match case {
            "changed_material" => {
                wrong["current_contributions"][0]["material"]["scene"]["character"] =
                    json!("caller-made current material")
            }
            "unknown_identity" => {
                wrong["current_contributions"][0]["contribution_ref"] =
                    json!("contribution:foreign")
            }
            "duplicate" => {
                let row = wrong["current_contributions"][0].clone();
                wrong["current_contributions"]
                    .as_array_mut()
                    .unwrap()
                    .push(row);
            }
            "caller_overlays" => {
                wrong["current_contributions"][0]["overlays"] =
                    json!([{"path":"force.strength","value":0.875}])
            }
            _ => {
                wrong["current_contributions"][0]
                    .as_object_mut()
                    .unwrap()
                    .remove("overlays");
            }
        }
        assert!(
            validate_source_payload(&d, &wrong).is_err(),
            "current material intake admitted {case}"
        );
    }
    let mut conflicting = d.clone();
    conflicting.scenes[1].presentation.as_mut().unwrap().scene["procedural"]["contributions"][0]
        ["recipe_revision"] = json!("conflicting projection");
    assert!(
        validate_source_payload(&conflicting, &payload).is_err(),
        "equal whole identity concealed conflicting actual retained projections"
    );
    for case in ["retired", "foreign_owner"] {
        let mut wrong = d.clone();
        let retained = &mut wrong.scenes[0].presentation.as_mut().unwrap().scene["procedural"]
            ["contributions"][0];
        if case == "retired" {
            retained["status"] = json!("retired");
        } else {
            retained["owned_addresses"][0]["expression_ref"] = json!("expression:foreign");
        }
        assert!(
            validate_source_payload(&wrong, &payload).is_err(),
            "current source material used {case} retained output"
        );
    }
    let before = serde_json::to_vec(&d).unwrap();
    validate_source_payload(&d, &payload).unwrap();
    assert_eq!(serde_json::to_vec(&d).unwrap(), before);
}

// Native receiving counterpart for E's consolidated human-intervention wire.
// Include after existing independent helpers. Actual material Address readers
// and native scoped edit calculation; no extractor or Source grant is mocked.

#[test]
fn a02_a07_a13_human_intervention_addresses_read_actual_containers_and_authored_scene_fields() {
    let d = complete_layer_document();
    let layer_list = addr(Component::Entity, Some("a"), None, Some("layers"));
    let steps = addr(Component::Sequence, Some("a"), None, Some("steps"));
    let duration = addr(Component::Property, None, None, Some("duration"));
    let field_speed = addr(Component::Field, None, None, Some("params.speed"));
    let material = &d.scenes[0].presentation.as_ref().unwrap().scene;
    assert_eq!(
        addressed(&d, &layer_list).unwrap(),
        material["entities"][0]["layers"]
    );
    assert_eq!(
        addressed(&d, &steps).unwrap(),
        material["entities"][0]["sequence"]["steps"]
    );
    assert_eq!(addressed(&d, &duration).unwrap(), material["duration"]);
    assert_eq!(
        addressed(&d, &field_speed).unwrap(),
        material["field"]["params"]["speed"]
    );
    let state_layers = addr(
        Component::SequenceLink,
        Some("a"),
        Some("step:a"),
        Some("layers"),
    );
    assert_eq!(
        addressed(&d, &state_layers).unwrap(),
        material["entities"][0]["sequence"]["steps"][0]["layers"]
    );
    for wrong in [
        addr(Component::Entity, Some("a"), None, Some("layers.order")),
        addr(Component::Sequence, Some("a"), None, Some("steps.order")),
        addr(Component::Scene, None, None, Some("duration")),
        addr(Component::Scene, None, None, Some("field.params.speed")),
    ] {
        assert!(
            addressed(&d, &wrong).is_err(),
            "an extractor-only synthetic property became a native receiving address"
        );
    }
    assert_eq!(d, complete_layer_document());
}

#[test]
fn a02_a05_a07_native_scoped_scene_and_field_edits_use_those_actual_authored_addresses() {
    let d = complete_layer_document();
    for (component, property, section, key, value) in [
        (Component::Property, "duration", "", "duration", json!(43)),
        (
            Component::Field,
            "params.speed",
            "field",
            "speed",
            json!(0.9),
        ),
    ] {
        let selected = addr(component, None, None, Some(property));
        let mut presentation = d.scenes[0].presentation.clone().unwrap();
        if section.is_empty() {
            presentation.scene[key] = value.clone();
        } else {
            presentation.scene[section]["params"][key] = value.clone();
        }
        let mut envelope = envelope(
            &d,
            Scope::Addresses {
                addresses: vec![selected.clone()],
            },
            "a",
        );
        envelope.changes = vec![Change::SceneMaterialSet {
            scene_ref: d.scenes[0].scene_ref.clone(),
            presentation,
        }];
        let candidate = d.edited(envelope.changes.clone()).unwrap();
        let original = envelope.clone();
        Runtime::default()
            .prepare(&d, envelope)
            .expect("actual authored Scene/Field scalar must admit its exact native target");
        assert_eq!(addressed(&candidate, &selected).unwrap(), value);
        assert_eq!(d, complete_layer_document());
        let mut foreign = original;
        foreign.scope = Scope::Addresses {
            addresses: vec![addr(Component::Scene, None, None, Some(property))],
        };
        assert!(
            Runtime::default().prepare(&d, foreign).is_err(),
            "a native Scene struct property widened to authored material"
        );
    }
}

// Append after the independent Source receiving helpers. Actual native
// Document calculations and Source readers only; no compiler grant or ACK.

fn independent_retained_scene_program(source: &Value) -> Value {
    json!({"recipe":"scene_material","outputs":[{"output_slot":"continuing-source",
        "scene_ref":format!("{EXPRESSION}:scene:source-continuation-output"),"sequence_holds":[],"source":source}]})
}

#[test]
fn a09_a13_a14_original_native_program_source_survives_unrelated_actual_document_cas() {
    let original = independent_source_read_document();
    let source = source_native_scene_source(
        &original,
        &original.scenes[0].scene_ref,
        &independent_source_profile(),
    )
    .unwrap();
    let next = original
        .edited(vec![Change::Focus {
            scene_ref: original.scenes[0].scene_ref.clone(),
            entity_ref: Some(format!("{EXPRESSION}:entity:a")),
        }])
        .unwrap();
    assert_eq!(next.revision, original.revision + 1);
    assert_eq!(
        next.scenes, original.scenes,
        "unrelated focus changed source material"
    );
    assert_eq!(
        next.entities, original.entities,
        "unrelated focus changed subject/parameter source"
    );
    let current = source_native_scene_source(
        &next,
        &next.scenes[0].scene_ref,
        &independent_source_profile(),
    )
    .unwrap();
    let mut reobserved = source.clone();
    reobserved["document_revision"] = json!(next.revision);
    assert_eq!(
        reobserved, current,
        "actual source changed beyond its read ordinal"
    );
    let payload = json!({"expression_ref":EXPRESSION,"document_revision":next.revision,
        "program":independent_retained_scene_program(&source)});
    let before_payload = payload.clone();
    validate_source_payload(&next, &payload).unwrap();
    assert_eq!(
        payload, before_payload,
        "Source readmission rewrote the immutable original native program"
    );
    let mut stale_event = payload.clone();
    stale_event["document_revision"] = json!(original.revision);
    assert!(
        validate_source_payload(&next, &stale_event).is_err(),
        "old current event CAS was normalized as source history"
    );
}

#[test]
fn a02_a09_a14_original_native_source_readmission_refuses_changed_material_subject_profile_and_locus(
) {
    let original = independent_source_read_document();
    let source = source_native_scene_source(
        &original,
        &original.scenes[0].scene_ref,
        &independent_source_profile(),
    )
    .unwrap();
    for case in ["material", "subject", "profile", "locus"] {
        let mut presentation = original.scenes[0].presentation.clone().unwrap();
        match case {
            "material" => presentation.scene["duration"] = json!(43),
            "subject" => {
                presentation.scene["procedural"]["bindings"][1]["principal"]["subject_ref"] =
                    json!("subject:other-native-principal")
            }
            "profile" => {
                presentation.scene["procedural"]["source_basis"][0]["revision"] =
                    json!("source-r2");
                presentation.scene["procedural"]["bindings"][1]["principal"]["sources"][0]
                    ["revision"] = json!("source-r2");
            }
            _ => {
                presentation.scene["procedural"]["bindings"][1]["locus"]["revision"] =
                    json!("place-r2")
            }
        }
        let changed = original
            .edited(vec![Change::SceneMaterialSet {
                scene_ref: original.scenes[0].scene_ref.clone(),
                presentation,
            }])
            .unwrap();
        let payload = json!({"expression_ref":EXPRESSION,"document_revision":changed.revision,
            "program":independent_retained_scene_program(&source)});
        let before = changed.clone();
        assert!(
            validate_source_payload(&changed, &payload).is_err(),
            "changed actual {case} admitted old program source"
        );
        assert_eq!(changed, before);
    }
    let current = original
        .edited(vec![Change::Focus {
            scene_ref: original.scenes[0].scene_ref.clone(),
            entity_ref: Some(format!("{EXPRESSION}:entity:a")),
        }])
        .unwrap();
    let mut forged = source.clone();
    forged["presentation"]["scene"]["duration"] = json!(43);
    forged["material_fingerprint"] = json!(format!(
        "{:x}",
        Sha256::digest(serde_json::to_vec(&forged["presentation"]).unwrap())
    ));
    assert!(validate_source_payload(&current,&json!({"document_revision":current.revision,"program":independent_retained_scene_program(&forged)})).is_err(),
        "self-hashed source label replaced actual native material");
}

#[test]
fn a14_native_source_history_cannot_claim_future_zero_or_untyped_read_ordinals() {
    let original = independent_source_read_document();
    let source = source_native_scene_source(
        &original,
        &original.scenes[0].scene_ref,
        &independent_source_profile(),
    )
    .unwrap();
    let current = original
        .edited(vec![Change::Focus {
            scene_ref: original.scenes[0].scene_ref.clone(),
            entity_ref: Some(format!("{EXPRESSION}:entity:a")),
        }])
        .unwrap();
    for revision in [
        json!(0),
        json!(current.revision + 1),
        json!("1"),
        Value::Null,
    ] {
        let mut wrong = source.clone();
        wrong["document_revision"] = revision;
        assert!(
            validate_source_payload(
                &current,
                &json!({"expression_ref":EXPRESSION,"document_revision":current.revision,
            "program":independent_retained_scene_program(&wrong)})
            )
            .is_err(),
            "nonhistorical native Source ordinal admitted"
        );
    }
}

// Actual native ordinary-edit/source calculation supplement. Caller-created
// attribution is used only for refusals; qualified host/manual positives remain
// the genuine native Source/CONDUCT artifact gate.

#[test]
fn a09_a14_native_flow_focus_omits_empty_relation_and_scene_remove_changes_selection_and_order_together(
) {
    let original = independent_source_read_document();
    let main = original.scenes[0].scene_ref.clone();
    let second = format!("{EXPRESSION}:scene:canonical-other");
    let original = original
        .edited(vec![
            Change::SceneCreate {
                scene_ref: second.clone(),
                title: "Other actual canonical place".into(),
            },
            Change::Focus {
                scene_ref: main.clone(),
                entity_ref: Some(format!("{EXPRESSION}:entity:a")),
            },
        ])
        .unwrap();
    let whole = address(&original, None, None, Component::Expression);
    let before = source_native_property(&original, &whole, "native_atlas_state").unwrap();
    assert_eq!(before["focus"]["scene_ref"], main);
    assert_eq!(
        before["focus"]["entity_ref"],
        format!("{EXPRESSION}:entity:a")
    );
    assert!(
        before["focus"].get("relation_ref").is_none(),
        "real serde Selection unexpectedly retained an empty relation"
    );
    let actual = original
        .edited(vec![Change::SceneRemove {
            scene_ref: main.clone(),
        }])
        .unwrap();
    let after = source_native_property(&actual, &whole, "native_atlas_state").unwrap();
    assert_eq!(after["focus"]["scene_ref"], second);
    assert_eq!(after["focus"]["entity_ref"], Value::Null);
    assert!(after["focus"].get("relation_ref").is_none());
    assert_eq!(after["scene_order"], json!([second]));
    assert_ne!(before["focus"], after["focus"]);
    assert_ne!(before["scene_order"], after["scene_order"]);
    assert_eq!(actual.revision, original.revision + 1);
    assert_eq!(
        original.scenes.len(),
        2,
        "candidate calculation changed the original world"
    );
}

#[test]
fn a05_a07_a14_unqualified_saved_contribution_cannot_mint_native_manual_attribution() {
    let original = independent_source_read_document();
    let contribution = independent_output_contribution(
        &original,
        "manual-negative",
        &format!("{EXPRESSION}:entity:a"),
        vec![addr(Component::Force, Some("a"), None, Some("strength"))],
        json!({"parameter":"force_strength","value":0.2}),
    );
    let mut presentation = original.scenes[0].presentation.clone().unwrap();
    presentation.scene["procedural"] = independent_retained_basis(&original, vec![contribution]);
    let retained = original
        .edited(vec![Change::SceneMaterialSet {
            scene_ref: original.scenes[0].scene_ref.clone(),
            presentation,
        }])
        .unwrap();
    let mut app = Application::default();
    app.open(retained.clone(), "agent:independent".into())
        .unwrap();
    let request = ExpressionRequest::Edit {
        expression_ref: EXPRESSION.into(),
        expected_revision: retained.revision,
        actor: "human:actual-editor".into(),
        changes: vec![Change::ParameterSet {
            entity_ref: format!("{EXPRESSION}:entity:a"),
            parameter: "force_strength".into(),
            value: json!(0.875),
        }],
    };
    let candidate = retained
        .edited(match &request {
            ExpressionRequest::Edit { changes, .. } => changes.clone(),
            _ => unreachable!(),
        })
        .unwrap();
    assert_eq!(
        candidate.entities[&format!("{EXPRESSION}:entity:a")].parameters["force_strength"].value,
        json!(0.875)
    );
    assert!(
        app.prepare_procedural_manual_edit(&request).is_err(),
        "saved caller labels granted actual Source intervention custody"
    );
    assert_eq!(app.document(EXPRESSION).unwrap(), &retained);
    let mut forged = retained.scenes[0].presentation.clone().unwrap();
    forged.scene["procedural"]["contributions"][0]["authored_overrides"] = json!([{"actor":"human:actual-editor","revision":retained.revision+1,
        "persistent":true,"operation_ref":"invented-manual-source","address":addr(Component::Force,Some("a"),None,Some("strength")),
        "path":"/scene/entities/@a/force/strength","kind":"set","value":0.875,"before":0.2}]);
    let forgery = ExpressionRequest::Edit {
        expression_ref: EXPRESSION.into(),
        expected_revision: retained.revision,
        actor: "human:actual-editor".into(),
        changes: vec![Change::SceneMaterialSet {
            scene_ref: retained.scenes[0].scene_ref.clone(),
            presentation: forged,
        }],
    };
    assert!(
        app.prepare_procedural_manual_edit(&forgery).is_err(),
        "ordinary Edit authored its own procedural attribution"
    );
    assert_eq!(app.document(EXPRESSION).unwrap(), &retained);
}

// Append after the existing Source/output-basis independent helpers.
// Real Document::edited, native Parameter and material/context readers only.
// This does not inject a Source admission, installed conductor, owner receipt,
// authored attribution row or a qualified-operation entry.

fn independent_shared_source_document() -> Document {
    let d = independent_source_read_document();
    let second = format!("{EXPRESSION}:scene:aaa-shared");
    let entity_ref = format!("{EXPRESSION}:entity:a");
    let mut presentation = d.scenes[0].presentation.clone().unwrap();
    presentation.scene["id"] = json!(second);
    presentation.scene["name"] = json!("Second location of the continuing subject");
    presentation.scene["entities"] = json!(presentation.scene["entities"]
        .as_array()
        .unwrap()
        .iter()
        .filter(|entity| entity["id"] == entity_ref)
        .cloned()
        .collect::<Vec<_>>());
    presentation
        .scene
        .as_object_mut()
        .unwrap()
        .remove("procedural");
    d.edited(vec![
        Change::SceneCreate {
            scene_ref: second.clone(),
            title: "Second location of the continuing subject".into(),
        },
        Change::SceneCompose {
            scene_ref: second.clone(),
            entity_refs: vec![entity_ref],
        },
        Change::SceneMaterialSet {
            scene_ref: second,
            presentation,
        },
    ])
    .unwrap()
}

fn independent_shared_force_contribution(d: &Document) -> Value {
    let entity_ref = format!("{EXPRESSION}:entity:a");
    let mut owned = d
        .scenes
        .iter()
        .filter(|scene| scene.entity_refs.contains(&entity_ref))
        .map(|scene| {
            let mut target = addr(Component::Force, Some("a"), None, Some("strength"));
            target.scene_ref = Some(scene.scene_ref.clone());
            target
        })
        .collect::<Vec<_>>();
    owned.sort();
    independent_output_contribution(
        d,
        "shared-force",
        &entity_ref,
        owned,
        json!({"parameter":"force_strength","value":0.2}),
    )
}

#[test]
fn a02_a04_a07_shared_global_parameter_reads_every_real_scene_coordinate_without_duplicate_entities(
) {
    let before = independent_shared_source_document();
    let entity_ref = format!("{EXPRESSION}:entity:a");
    let d = before
        .edited(vec![Change::ParameterSet {
            entity_ref: entity_ref.clone(),
            parameter: "force_strength".into(),
            value: json!(0.875),
        }])
        .unwrap();
    let contribution = independent_shared_force_contribution(&d);
    let original = contribution.clone();
    let actual = source_current_output_basis(&d, &contribution).unwrap();
    let owned = source_parameter_addresses(&d, &contribution).unwrap();
    assert_eq!(owned.len(), 2);
    assert_eq!(actual["addresses"], json!(owned));
    assert_eq!(actual["address"], json!(owned[0]));
    assert_eq!(
        owned[0].scene_ref.as_deref(),
        Some(format!("{EXPRESSION}:scene:aaa-shared").as_str()),
        "shared primary is the real canonical first location, not Document scene order"
    );
    assert_eq!(actual["value"], json!(0.875));
    assert_eq!(
        actual["target_revision"],
        json!(d.entities[&entity_ref].revision)
    );
    assert_eq!(
        contribution, original,
        "readback changed the generated recipe operand"
    );
    assert_eq!(
        d.entities.len(),
        before.entities.len(),
        "one subject became duplicate native Entities"
    );
    for target in &owned {
        assert_eq!(
            source_native_property(&d, target, "force_strength").unwrap(),
            json!(0.875)
        );
        let scene = d
            .scenes
            .iter()
            .find(|scene| Some(&scene.scene_ref) == target.scene_ref.as_ref())
            .unwrap();
        let material = manual::scene_material(scene).unwrap();
        let subject = material["scene"]["entities"]
            .as_array()
            .unwrap()
            .iter()
            .find(|entity| entity["id"] == entity_ref)
            .unwrap();
        assert_eq!(
            subject["force"]["strength"],
            json!(0.875),
            "the actual ParameterSet did not reach this native Scene presentation"
        );
    }
    for case in [
        "omitted_location",
        "duplicate_location",
        "foreign_entity",
        "sibling_property",
        "foreign_expression",
        "nonexistent_scene",
    ] {
        let mut wrong = contribution.clone();
        match case {
            "omitted_location" => {
                wrong["owned_addresses"].as_array_mut().unwrap().pop();
            }
            "duplicate_location" => {
                let first = wrong["owned_addresses"][0].clone();
                wrong["owned_addresses"].as_array_mut().unwrap().push(first);
            }
            "foreign_entity" => {
                wrong["owned_addresses"][1]["entity_ref"] = json!(format!("{EXPRESSION}:entity:b"))
            }
            "sibling_property" => wrong["owned_addresses"][1]["property"] = json!("spin"),
            "foreign_expression" => {
                wrong["owned_addresses"][1]["expression_ref"] = json!("expression:foreign")
            }
            _ => {
                wrong["owned_addresses"][1]["scene_ref"] =
                    json!(format!("{EXPRESSION}:scene:missing"))
            }
        }
        assert!(
            source_current_output_basis(&d, &wrong).is_err(),
            "shared Parameter admitted {case}"
        );
    }
}

#[test]
fn a07_a10_a14_event_contexts_come_from_real_scene_material_and_do_not_grant_native_source_custody()
{
    let d = independent_shared_source_document();
    let contribution = independent_shared_force_contribution(&d);
    let mut changes = Vec::new();
    for scene in &d.scenes {
        let mut presentation = scene.presentation.clone().unwrap();
        presentation.scene["procedural"] =
            independent_retained_basis(&d, vec![contribution.clone()]);
        changes.push(Change::SceneMaterialSet {
            scene_ref: scene.scene_ref.clone(),
            presentation,
        });
    }
    let d = d.edited(changes).unwrap();
    let row = json!({"contribution_ref":contribution["contribution_ref"],
        "material":source_current_output_basis(&d,&contribution).unwrap(),"overlays":[]});
    let original = serde_json::to_vec(&d).unwrap();
    let contexts = source_event_intervention_contexts(&d, std::slice::from_ref(&row)).unwrap();
    assert_eq!(
        contexts.len(),
        2,
        "shared contribution lost a native Scene context"
    );
    for context in &contexts {
        assert_eq!(context["material_kind"], "scene");
        let scene = d
            .scenes
            .iter()
            .find(|scene| context["basis"]["scene_ref"] == scene.scene_ref)
            .unwrap();
        assert_eq!(
            context["basis"]["current_presentation"],
            manual::scene_material(scene).unwrap()
        );
        assert_eq!(
            context["basis"]["entity_refs"],
            json!(manual::scene_entity_refs(&d, scene).unwrap())
        );
        assert_eq!(
            context["basis"]["owned_addresses"],
            contribution["owned_addresses"]
        );
        assert_eq!(context["basis"]["document_revision"], json!(d.revision));
        assert_eq!(context["basis"]["retained_native_records"], json!([]));
        assert!(context["basis"]["current_presentation"]["scene"]
            .get("procedural")
            .is_none());
    }
    let payload = json!({"expression_ref":EXPRESSION,"document_revision":d.revision,
        "current_contributions":[row],"intervention_contexts":contexts});
    validate_source_payload(&d, &payload).unwrap();
    assert!(
        Runtime::default()
            .output_readings(&d, "procedure:independent:basis")
            .is_err(),
        "document-current context/empty overrides granted an original qualified Source operation"
    );
    for case in [
        "dropped_context",
        "foreign_scene",
        "changed_material",
        "old_revision",
        "caller_records",
        "caller_overlays",
    ] {
        let mut wrong = payload.clone();
        match case {
            "dropped_context" => {
                wrong["intervention_contexts"].as_array_mut().unwrap().pop();
            }
            "foreign_scene" => {
                wrong["intervention_contexts"][0]["basis"]["scene_ref"] =
                    json!("expression:foreign:scene")
            }
            "changed_material" => {
                wrong["intervention_contexts"][0]["basis"]["current_presentation"]["scene"]
                    ["character"] = json!("caller material")
            }
            "old_revision" => {
                wrong["intervention_contexts"][0]["basis"]["document_revision"] =
                    json!(d.revision - 1)
            }
            "caller_records" => {
                wrong["intervention_contexts"][0]["basis"]["retained_native_records"] =
                    json!([{"actor":"caller","value":0.875}])
            }
            _ => {
                wrong["current_contributions"][0]["overlays"] =
                    json!([{"path":"force.strength","value":0.875}])
            }
        }
        assert!(
            validate_source_payload(&d, &wrong).is_err(),
            "protected event context admitted {case}"
        );
    }
    assert_eq!(
        serde_json::to_vec(&d).unwrap(),
        original,
        "context calculation changed the native Document"
    );
}

#[test]
fn a02_a05_native_shared_radius_scope_accepts_only_its_selected_scalar_at_every_affected_scene() {
    let shared = independent_shared_source_document();
    let d = shared
        .edited(vec![Change::ParameterSet {
            entity_ref: format!("{EXPRESSION}:entity:a"),
            parameter: "force_radius".into(),
            value: json!(80.0),
        }])
        .unwrap();
    let mut addresses =
        source_parameter_addresses(&d, &independent_shared_force_contribution(&d)).unwrap();
    for target in &mut addresses {
        target.property = Some("radius".into());
    }
    let full = Scope::Addresses {
        addresses: addresses.clone(),
    };
    let mut selected = envelope(&d, full.clone(), "a");
    selected.changes = vec![Change::ParameterSet {
        entity_ref: format!("{EXPRESSION}:entity:a"),
        parameter: "force_radius".into(),
        value: json!(120.0),
    }];
    let before = d.clone();
    let admitted = Runtime::default().prepare(&d, selected.clone()).unwrap();
    assert_eq!(admitted.status, Status::Prepared);
    // This is a native manual scoped preparation, not a Source producer grant
    // or a live receipt. No private owner/capability maps are populated.
    for parameter in ["force_strength", "force_spin", "x"] {
        let mut wrong = selected.clone();
        wrong.changes = vec![Change::ParameterSet {
            entity_ref: format!("{EXPRESSION}:entity:a"),
            parameter: parameter.into(),
            value: json!(0.5),
        }];
        let mut runtime = Runtime::default();
        assert!(
            runtime.prepare(&d, wrong).is_err(),
            "the exact native radius scope admitted sibling {parameter}"
        );
        assert!(
            runtime.inspect(&selected.operation_ref).is_err(),
            "sibling refusal retained an accepted operation"
        );
    }
    let mut partial = selected.clone();
    partial.scope = Scope::Addresses {
        addresses: vec![addresses[0].clone()],
    };
    assert!(
        Runtime::default().prepare(&d, partial).is_err(),
        "the native global Parameter write hid the subject's other actual Scene location"
    );
    assert_eq!(
        d, before,
        "scoped preparation or refusal mutated actual material before Apply"
    );
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
        assert!(!app
            .procedural_runtime
            .operations
            .values()
            .any(|op| op.envelope.expression_ref == fork_ref));
        assert!(!app
            .procedural_runtime
            .producers
            .values()
            .any(|producer| producer.expression_ref == fork_ref));
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
            assert!(app
                .procedural_runtime
                .output_readings(&fork, "procedure:independent-owner")
                .is_err());
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
    // Actual unjournaled authored native material supplies the neighbour.
    // Its fresh native Fork transfers no procedural owner or receipts.
    let mut material_owner = Application::default();
    material_owner
        .open(document(), "agent:independent".into())
        .unwrap();
    let source_revision = material_owner.document(EXPRESSION).unwrap().revision;
    material_owner
        .apply(
            &client,
            ExpressionRequest::Fork {
                expression_ref: EXPRESSION.into(),
                expected_revision: source_revision,
                new_expression_ref: other.into(),
                actor: "agent:independent".into(),
            },
        )
        .unwrap();
    app.open(
        material_owner.document(other).unwrap().clone(),
        "agent:independent".into(),
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
    assert!(!app
        .procedural_runtime
        .deltas
        .iter()
        .any(|row| row["delta"]["expression_ref"] == EXPRESSION));
    assert!(app
        .procedural_runtime
        .deltas
        .iter()
        .any(|row| row["delta"]["expression_ref"] == other));
    assert!(app
        .procedural_runtime
        .inspect(&other_intent.operation_ref)
        .is_ok());
    let mut fresh = Application {
        procedural_runtime: std::mem::take(&mut app.procedural_runtime),
        ..Application::default()
    };
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
    assert!(reopened["operation_history"]
        .as_array()
        .unwrap()
        .iter()
        .all(|row| row["restored"] == true));
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
    let fork_ref = "expression:independent-native-fork-opaque-coordinates".to_owned();
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

// Append after the shared-global Source reader helpers. Actual native Document,
// Parameter automation, preview and Application ReadDriver route only. A read
// never grants Source/control custody or creates a live receiving ACK.
fn independent_driver_document() -> Document {
    let entity_ref = format!("{EXPRESSION}:entity:a");
    independent_shared_source_document()
        .edited(vec![
            Change::ParameterSet {
                entity_ref: entity_ref.clone(),
                parameter: "force_radius".into(),
                value: json!(80.0),
            },
            Change::ParameterAutomate {
                entity_ref,
                parameter: "force_radius".into(),
                automation: super::super::Automation {
                    min: 40.0,
                    max: 160.0,
                    rate_hz: 0.25,
                    waveform: super::super::Waveform::Sine,
                },
            },
        ])
        .unwrap()
}

#[test]
fn a02_a04_a06_native_driver_read_preserves_actual_automation_units_and_all_scene_locations() {
    let d = independent_driver_document();
    let before = d.clone();
    let entity_ref = format!("{EXPRESSION}:entity:a");
    let actual = source_parameter_driver(&d, &entity_ref, "force_radius", None).unwrap();
    assert_eq!(actual["schema"], "ql.native-parameter-driver/v1");
    assert_eq!(
        actual["native_parameter"],
        serde_json::to_value(&d.entities[&entity_ref].parameters["force_radius"]).unwrap()
    );
    assert_eq!(actual["native_parameter"]["value"], 80.0);
    assert_eq!(
        actual["native_parameter"]["automation"],
        json!({"min":40.0,"max":160.0,"rate_hz":0.25,"waveform":"sine"})
    );
    let addresses: Vec<Address> = serde_json::from_value(actual["addresses"].clone()).unwrap();
    assert_eq!(addresses.len(), 2);
    assert_eq!(actual["scenes"].as_array().unwrap().len(), 2);
    for (target, row) in addresses.iter().zip(actual["scenes"].as_array().unwrap()) {
        assert_eq!(target.component, Component::Force);
        assert_eq!(target.property.as_deref(), Some("radius"));
        assert_eq!(target.entity_ref.as_deref(), Some(entity_ref.as_str()));
        assert_eq!(row["scene_ref"], json!(target.scene_ref));
        assert!(row["entity_refs"]
            .as_object()
            .unwrap()
            .values()
            .any(|reference| reference == &json!(entity_ref)));
        let entity = row["presentation"]["scene"]["entities"]
            .as_array()
            .unwrap()
            .iter()
            .find(|entity| entity["id"] == entity_ref)
            .unwrap();
        assert_eq!(
            entity["force"]["radius"], 0.2,
            "native radius was copied into authored units"
        );
        assert!(row["parameter_candidate"].is_null());
        let mut expected = serde_json::to_value(
            d.scenes
                .iter()
                .find(|scene| Some(&scene.scene_ref) == target.scene_ref.as_ref())
                .unwrap()
                .presentation
                .as_ref()
                .unwrap(),
        )
        .unwrap();
        if expected["scene"]["procedural"].is_object() {
            expected["scene"]["procedural"]["operations"] = json!([]);
        }
        assert_eq!(
            row["presentation"], expected,
            "driver read lost Source/overrides/dormant/material fields"
        );
    }
    let mut app = Application::default();
    let client = CentralClient::discover();
    app.open(d.clone(), "agent:independent".into()).unwrap();
    let (read, changed) = app
        .procedural(
            &client,
            Request::ReadDriver {
                expression_ref: EXPRESSION.into(),
                expected_revision: d.revision,
                address: addresses[0].clone(),
                parameter: "force_radius".into(),
            },
        )
        .unwrap();
    assert!(changed.is_none());
    assert_eq!(read["native_parameter_driver"], actual);
    assert_eq!(app.document(EXPRESSION).unwrap(), &before);
    assert!(app.procedural_runtime.operations.is_empty());
    assert!(app.procedural_runtime.producers.is_empty());
}

#[test]
fn a04_a06_native_driver_preview_uses_native_parameter_conversion_without_replacing_original_driver_or_source(
) {
    let d = independent_driver_document();
    let original = serde_json::to_vec(&d).unwrap();
    let entity_ref = format!("{EXPRESSION}:entity:a");
    let actual =
        source_parameter_driver(&d, &entity_ref, "force_radius", Some(&json!(120.0))).unwrap();
    assert_eq!(actual["native_parameter"]["value"], 80.0);
    assert!(actual["native_parameter"]["automation"].is_object());
    let native_candidate = d
        .edited(vec![
            Change::ParameterManual {
                entity_ref: entity_ref.clone(),
                parameter: "force_radius".into(),
            },
            Change::ParameterSet {
                entity_ref: entity_ref.clone(),
                parameter: "force_radius".into(),
                value: json!(120.0),
            },
        ])
        .unwrap();
    assert_eq!(
        native_candidate.entities[&entity_ref].parameters["force_radius"].value,
        json!(120.0)
    );
    assert!(
        native_candidate.entities[&entity_ref].parameters["force_radius"]
            .automation
            .is_none()
    );
    for row in actual["scenes"].as_array().unwrap() {
        let mut current = row["presentation"].clone();
        let mut preview = row["parameter_candidate"].clone();
        let before = current["scene"]["entities"]
            .as_array_mut()
            .unwrap()
            .iter_mut()
            .find(|entity| entity["id"] == entity_ref)
            .unwrap();
        let after = preview["scene"]["entities"]
            .as_array_mut()
            .unwrap()
            .iter_mut()
            .find(|entity| entity["id"] == entity_ref)
            .unwrap();
        assert_eq!(before["force"]["radius"], 0.2);
        assert_eq!(after["force"]["radius"], 0.3);
        before["force"]["radius"] = Value::Null;
        after["force"]["radius"] = Value::Null;
        assert_eq!(
            current, preview,
            "preview changed a sibling, Source, retained override, driver or journal field"
        );
    }
    for value in [json!(0.0), json!(1601.0), json!("wrong units")] {
        assert!(source_parameter_driver(&d, &entity_ref, "force_radius", Some(&value)).is_err());
    }
    assert!(source_parameter_driver(&d, &entity_ref, "unknown_native_parameter", None).is_err());
    let mut bad = d.clone();
    bad.entities
        .get_mut(&entity_ref)
        .unwrap()
        .parameters
        .get_mut("force_radius")
        .unwrap()
        .value = json!(1601.0);
    assert!(source_parameter_driver(&bad, &entity_ref, "force_radius", None).is_err());
    assert_eq!(
        serde_json::to_vec(&d).unwrap(),
        original,
        "read/preview/refusal mutated native Document"
    );
}

#[test]
fn a02_a05_a06_native_driver_route_refuses_foreign_scope_siblings_outside_subject_and_stale_cas() {
    let d = independent_driver_document();
    let before = d.clone();
    let actual =
        source_parameter_driver(&d, &format!("{EXPRESSION}:entity:a"), "force_radius", None)
            .unwrap();
    let target: Address = serde_json::from_value(actual["addresses"][0].clone()).unwrap();
    let client = CentralClient::discover();
    let mut app = Application::default();
    app.open(d.clone(), "agent:independent".into()).unwrap();
    for case in [
        "sibling",
        "whole_entity",
        "wrong_component",
        "foreign_expression",
        "outside_scene",
        "missing_subject",
    ] {
        let mut address = target.clone();
        let mut parameter = "force_radius";
        match case {
            "sibling" => parameter = "force_strength",
            "whole_entity" => {
                address.component = Component::Entity;
                address.property = None;
            }
            "wrong_component" => address.component = Component::Entity,
            "foreign_expression" => address.expression_ref = "expression:foreign".into(),
            "outside_scene" => address.scene_ref = Some(format!("{EXPRESSION}:scene:missing")),
            _ => address.entity_ref = Some(format!("{EXPRESSION}:entity:missing")),
        }
        assert!(
            app.procedural(
                &client,
                Request::ReadDriver {
                    expression_ref: EXPRESSION.into(),
                    expected_revision: d.revision,
                    address,
                    parameter: parameter.into()
                }
            )
            .is_err(),
            "driver read admitted {case}"
        );
        assert_eq!(app.document(EXPRESSION).unwrap(), &before);
    }
    let (reply, changed) = app
        .procedural(
            &client,
            Request::ReadDriver {
                expression_ref: EXPRESSION.into(),
                expected_revision: d.revision - 1,
                address: target,
                parameter: "force_radius".into(),
            },
        )
        .unwrap();
    assert_eq!(reply["state"], "revision_conflict");
    assert!(changed.is_none());
    assert_eq!(app.document(EXPRESSION).unwrap(), &before);
    assert!(app.procedural_runtime.operations.is_empty());
}

// Actual authoring/control producer fixture -> real Application::Fork -> exact
// serialized Document -> real TS registry/native converter/release consumer.
// Include in the custodian's expression_procedural test module. No Source
// qualification, physical/audio receipt or live clock is fabricated here.

#[test]
fn a06_a13_actual_control_fork_preserves_persistent_configuration() {
    let source: Value = serde_json::from_str(include_str!("fork-control-source.json")).unwrap();
    assert_eq!(source["schema"], "oi.procedural-control-fork-source/v1");
    let client = CentralClient::discover();
    let mut artifact = json!({"schema":"oi.procedural-control-fork-application/v1"});
    for (input, output, original_key, fork_key) in [(&source, "fork_ref", "original", "fork")] {
        let original: Document = serde_json::from_value(input["original"].clone()).unwrap();
        original.validate().unwrap();
        let original_wire = serde_json::to_value(&original).unwrap();
        assert_eq!(
            original_wire, input["original"],
            "fixture diverged from actual typed Document"
        );
        let mut app = Application::default();
        app.open(original.clone(), "human:owner".into()).unwrap();
        let reference = input[output].as_str().unwrap();
        let (_, changed) = app
            .apply(
                &client,
                ExpressionRequest::Fork {
                    expression_ref: original.expression_ref.clone(),
                    expected_revision: original.revision,
                    new_expression_ref: reference.into(),
                    actor: "human:fork-owner".into(),
                },
            )
            .unwrap();
        assert_eq!(changed.unwrap().expression_ref, reference);
        assert_eq!(app.document(&original.expression_ref).unwrap(), &original);
        let fork = app.document(reference).unwrap();
        assert!(journal(fork).unwrap().is_empty());
        assert!(app
            .procedural_runtime
            .operations
            .values()
            .all(|operation| operation.envelope.expression_ref != reference));
        assert!(app
            .procedural_runtime
            .producers
            .values()
            .all(|producer| producer.expression_ref != reference));
        let scene = &fork.scenes[0].presentation.as_ref().unwrap().scene;
        let retained = &scene["procedural"];

        let control = &retained["controls"][0];
        assert_eq!(
            control["takeover"],
            input["original"]["scenes"][0]["presentation"]["scene"]["procedural"]["controls"][0]
                ["takeover"],
            "persistent authored takeover provenance/lifetime was discarded"
        );
        let target =
            "entity:expression%3Aindependent-native-fork-controls%3Aentity%3Aa:forces.strength"
                .to_owned();
        assert_eq!(
            control["target"], target,
            "actual encoded target still names the original Entity"
        );
        for track in control["dormant_tracks"].as_array().unwrap() {
            assert_eq!(track["entityId"], format!("{reference}:entity:a"));
        }
        for dormant in control["dormant_overrides"].as_array().unwrap() {
            for key in ["overrides", "takeover_overrides"] {
                for overlay in dormant[key].as_array().unwrap() {
                    assert_eq!(overlay["address"]["expression_ref"], reference);
                    assert_eq!(
                        overlay["address"]["entity_ref"],
                        format!("{reference}:entity:a")
                    );
                }
            }
        }

        assert_eq!(
            scene["entities"][0]["source"],
            original.scenes[0].presentation.as_ref().unwrap().scene["entities"][0]["source"]
        );
        assert_eq!(
            scene["entities"][0]["sequence"]["steps"][0]["id"],
            input["expected"]["step_ref"]
        );
        artifact[original_key] = original_wire;
        artifact[fork_key] = serde_json::to_value(fork).unwrap();
    }
    if let Ok(path) = std::env::var("TA_ONTA_NATIVE_FORK_CONTROL_OUTPUT") {
        std::fs::write(path, serde_json::to_vec_pretty(&artifact).unwrap()).unwrap();
    }
}

#[test]
fn a13_actual_fork_remaps_only_typed_parameter_and_atlas_basis_reference_slots() {
    let source: Value = serde_json::from_str(include_str!("fork-control-source.json")).unwrap();
    let mut original: Document = serde_json::from_value(source["original"].clone()).unwrap();
    let expression = original.expression_ref.clone();
    let reference = "expression:independent-native-fork-typed-basis";
    let mut owned: Address = serde_json::from_value(
        original.scenes[0].presentation.as_ref().unwrap().scene["procedural"]["controls"][0]
            ["address"]
            .clone(),
    )
    .unwrap();
    let native_basis = json!({"schema":"ql.native-parameter-state/v1","address":owned,"addresses":[owned],"parameter":"force_strength","value":0.8,"target_revision":original.entities[owned.entity_ref.as_ref().unwrap()].revision});
    let whole = Address {
        expression_ref: expression.clone(),
        scene_ref: None,
        entity_ref: None,
        component: Component::Expression,
        constituent_ref: None,
        parent_ref: None,
        property: None,
    };
    let flow_basis = json!({"schema":"ql.native-atlas-state/v1","expression_ref":expression,"focus":original.selection,"scene_order":[original.scenes[0].scene_ref]});
    let mut row = original.scenes[0].presentation.as_ref().unwrap().scene["procedural"]
        ["contributions"][0]
        .clone();
    row["contribution_ref"] = json!(format!("{expression}:contribution:parameter"));
    row["occurrence_ref"] = json!(owned.entity_ref);
    row["owned_addresses"] = json!([owned]);
    row["generated_basis"] = native_basis;
    row["authored_overrides"] = json!([]);
    let mut flow = row.clone();
    flow["contribution_ref"] = json!(format!("{expression}:contribution:atlas"));
    flow["occurrence_ref"] = json!(expression);
    flow["owned_addresses"] = json!([whole]);
    flow["generated_basis"] = flow_basis;
    original.scenes[0].presentation.as_mut().unwrap().scene["procedural"]["contributions"]
        .as_array_mut()
        .unwrap()
        .extend([row, flow]);
    let client = CentralClient::discover();
    let mut app = Application::default();
    app.open(original.clone(), "human:owner".into()).unwrap();
    app.apply(
        &client,
        ExpressionRequest::Fork {
            expression_ref: expression.clone(),
            expected_revision: original.revision,
            new_expression_ref: reference.into(),
            actor: "human:fork-owner".into(),
        },
    )
    .unwrap();
    let fork = app.document(reference).unwrap();
    let rows = &fork.scenes[0].presentation.as_ref().unwrap().scene["procedural"]["contributions"];
    owned.expression_ref = reference.into();
    owned.scene_ref = Some(format!("{reference}:scene:main"));
    owned.entity_ref = Some(format!("{reference}:entity:a"));
    assert_eq!(rows[1]["generated_basis"]["address"], json!(owned));
    assert_eq!(rows[1]["generated_basis"]["addresses"], json!([owned]));
    assert_eq!(rows[1]["generated_basis"]["parameter"], "force_strength");
    assert_eq!(rows[1]["generated_basis"]["value"], 0.8);
    assert_eq!(rows[2]["generated_basis"]["expression_ref"], reference);
    assert_eq!(
        rows[2]["generated_basis"]["focus"]["scene_ref"],
        format!("{reference}:scene:main")
    );
    assert_eq!(
        rows[2]["generated_basis"]["scene_order"],
        json!([format!("{reference}:scene:main")])
    );
    assert_eq!(
        rows[1]["subject_refs"],
        json!([format!("{expression}:source:literal")])
    );
    assert_eq!(app.document(&expression).unwrap(), &original);
}

#[test]
fn a06_a13_legacy_gesture_without_exact_native_parameter_base_refuses_fork_unchanged() {
    let source: Value = serde_json::from_str(include_str!("fork-control-source.json")).unwrap();
    let original: Document = serde_json::from_value(source["gesture"]["original"].clone()).unwrap();
    let client = CentralClient::discover();
    let mut app = Application::default();
    app.open(original.clone(), "human:owner".into()).unwrap();
    let fork_ref = source["gesture"]["fork_ref"].as_str().unwrap();
    let result = app.apply(
        &client,
        ExpressionRequest::Fork {
            expression_ref: original.expression_ref.clone(),
            expected_revision: original.revision,
            new_expression_ref: fork_ref.into(),
            actor: "human:fork-owner".into(),
        },
    );
    assert!(
        result.is_err(),
        "legacy gesture inferred a native driver/unit baseline"
    );
    assert_eq!(app.document(&original.expression_ref).unwrap(), &original);
    assert!(app.document(fork_ref).is_err());
    assert!(app.procedural_runtime.operations.is_empty());
    assert!(app.procedural_runtime.producers.is_empty());
}

// Append after Source, current-output and shared-global independent helpers.
// Actual native Document/Scene material, counted serde output and public manual
// Prepare only. No producer map, qualified operation, compiler or ACK injection.
fn independent_budget_document(shared: bool, count: usize, character_bytes: usize) -> Document {
    let d = if shared {
        independent_shared_source_document()
    } else {
        independent_source_read_document()
    };
    let d = d
        .edited(vec![Change::ParameterSet {
            entity_ref: format!("{EXPRESSION}:entity:a"),
            parameter: "force_strength".into(),
            value: json!(0.2),
        }])
        .unwrap();
    let mut contributions = Vec::new();
    for index in 0..count {
        let mut contribution = if shared {
            independent_shared_force_contribution(&d)
        } else {
            independent_output_contribution(
                &d,
                "force",
                &format!("{EXPRESSION}:entity:a"),
                vec![addr(Component::Force, Some("a"), None, Some("strength"))],
                json!({"parameter":"force_strength","value":0.2}),
            )
        };
        contribution["contribution_ref"] =
            json!(format!("contribution:independent:budget-{index}"));
        contribution["output_slot"] = json!(format!("budget-{index}"));
        contributions.push(contribution);
    }
    let changes = d
        .scenes
        .iter()
        .map(|scene| {
            let mut presentation = scene.presentation.clone().unwrap();
            presentation.scene["character"] = json!("c".repeat(character_bytes));
            presentation.scene["procedural"] =
                independent_retained_basis(&d, contributions.clone());
            Change::SceneMaterialSet {
                scene_ref: scene.scene_ref.clone(),
                presentation,
            }
        })
        .collect();
    d.edited(changes).unwrap()
}
fn independent_budget_current(document: &Document) -> Vec<Value> {
    document.scenes[0].presentation.as_ref().unwrap().scene["procedural"]["contributions"].as_array().unwrap().iter().map(|contribution|
        json!({"contribution_ref":contribution["contribution_ref"],"material":source_current_output_basis(document,contribution).unwrap(),"overlays":[]})
    ).collect()
}
#[test]
fn a10_a16_borrowed_material_and_entity_refs_count_exact_escaped_native_serialization() {
    let d = independent_budget_document(false, 1, 0);
    let mut presentation = d.scenes[0].presentation.clone().unwrap();
    presentation.scene["character"] = json!("é\n\"\\\u{0000}");
    presentation.saved = Some(presentation.scene.clone());
    let d = d
        .edited(vec![Change::SceneMaterialSet {
            scene_ref: d.scenes[0].scene_ref.clone(),
            presentation,
        }])
        .unwrap();
    let scene = &d.scenes[0];
    let material = manual::scene_material(scene).unwrap();
    let count = serde_json::to_vec(&material).unwrap().len();
    let mut exact = budget::Budget::new();
    exact.reserve(budget::SOURCE_BYTES - count).unwrap();
    exact
        .material(scene.presentation.as_ref().unwrap())
        .unwrap();
    assert!(
        exact.reserve(1).is_err(),
        "borrowed Material missed escaped/multibyte/saved bytes"
    );
    let mut short = budget::Budget::new();
    short.reserve(budget::SOURCE_BYTES - count + 1).unwrap();
    assert!(short
        .material(scene.presentation.as_ref().unwrap())
        .is_err());
    let refs = manual::scene_entity_refs(&d, scene).unwrap();
    let count = serde_json::to_vec(&refs).unwrap().len();
    let mut exact = budget::Budget::new();
    exact.reserve(budget::SOURCE_BYTES - count).unwrap();
    exact
        .entity_refs(scene.presentation.as_ref().unwrap())
        .unwrap();
    assert!(exact.reserve(1).is_err());
}
#[test]
fn a05_a14_borrowed_envelope_match_is_structural_complete_and_keeps_json_number_identity() {
    let d = independent_source_read_document();
    let mut intent = envelope(&d, Scope::Expression, "a");
    intent.changes.push(Change::SceneMaterialSet {
        scene_ref: d.scenes[0].scene_ref.clone(),
        presentation: d.scenes[0].presentation.clone().unwrap(),
    });
    intent.changes[0] = Change::ParameterSet {
        entity_ref: format!("{EXPRESSION}:entity:a"),
        parameter: "force_strength".into(),
        value: json!(1.0),
    };
    let raw = serde_json::to_value(&intent).unwrap();
    assert!(budget::matches_borrowed(&intent, &raw));
    let reparsed: Value = serde_json::from_slice(&serde_json::to_vec(&raw).unwrap()).unwrap();
    assert!(budget::matches_borrowed(&intent, &reparsed));
    for case in [
        "missing",
        "extra",
        "source",
        "material",
        "numeric_kind",
        "timing",
    ] {
        let mut wrong = raw.clone();
        match case {
            "missing" => {
                wrong.as_object_mut().unwrap().remove("cause_ref");
            }
            "extra" => wrong["unissued_basis"] = json!(true),
            "source" => {
                wrong["sources"] =
                    json!([{"ref":"foreign","revision":"1","availability":"available"}])
            }
            "material" => {
                wrong["changes"][1]["presentation"]["scene"]["character"] =
                    json!("different actual Source")
            }
            "numeric_kind" => wrong["changes"][0]["value"] = json!(1),
            _ => {
                wrong["timing"] = json!({"kind":"owner_boundary","owner":"foreign","instance_ref":"unissued","cursor":0})
            }
        }
        assert!(
            !budget::matches_borrowed(&intent, &wrong),
            "borrowed full envelope comparison accepted {case}"
        );
    }
}
#[test]
fn a10_a16_context_cardinality_precedes_byte_count_and_actual_scene_copy() {
    let d = independent_budget_document(true, 1025, 0);
    d.validate().unwrap();
    let rows = independent_budget_current(&d);
    assert_eq!(rows.len(), 1025);
    let before = serde_json::to_vec(&d).unwrap();
    let error = budget::preflight_event_contexts(&d, &rows).unwrap_err();
    assert!(
        error.contains("context bound exceeded before allocation"),
        "cardinality was hidden by another bound: {error}"
    );
    let error = source_event_intervention_contexts(&d, &rows).unwrap_err();
    assert!(error.contains("context bound exceeded before allocation"));
    assert_eq!(serde_json::to_vec(&d).unwrap(), before);
}
#[test]
fn a10_a16_few_shared_contexts_refuse_repeated_real_material_byte_expansion() {
    let d = independent_budget_document(true, 5, 1024 * 1024);
    d.validate().unwrap();
    let rows = independent_budget_current(&d);
    assert_eq!(rows.len(), 5);
    let before = serde_json::to_vec(&d).unwrap();
    assert!(before.len() < budget::SOURCE_BYTES);
    let error = budget::preflight_event_contexts(&d, &rows).unwrap_err();
    assert!(error.contains("aggregate intake byte budget exceeded before allocation"));
    let error = source_event_intervention_contexts(&d, &rows).unwrap_err();
    assert!(error.contains("aggregate intake byte budget exceeded before allocation"));
    assert_eq!(serde_json::to_vec(&d).unwrap(), before);
    assert!(
        Runtime::default()
            .output_readings(&d, "procedure:independent:basis")
            .is_err(),
        "byte admission became Source qualification"
    );
}
#[test]
fn a10_a16_output_cardinality_is_aggregate_across_real_scenes_before_byte_count() {
    let d = independent_budget_document(true, 1025, 0);
    let mut changes = Vec::new();
    for (index, scene) in d.scenes.iter().enumerate() {
        let mut presentation = scene.presentation.clone().unwrap();
        let rows = presentation.scene["procedural"]["contributions"]
            .as_array_mut()
            .unwrap();
        if index == 1 {
            rows.pop();
            for (offset, row) in rows.iter_mut().enumerate() {
                row["contribution_ref"] =
                    json!(format!("contribution:independent:second-{offset}"));
            }
        }
        changes.push(Change::SceneMaterialSet {
            scene_ref: scene.scene_ref.clone(),
            presentation,
        });
    }
    let d = d.edited(changes).unwrap();
    d.validate().unwrap();
    let before = serde_json::to_vec(&d).unwrap();
    let error =
        budget::preflight_source_outputs(&d, "procedure:independent:basis", &Runtime::default())
            .unwrap_err();
    assert!(error.contains("cardinality exceeded before allocation"));
    assert_eq!(serde_json::to_vec(&d).unwrap(), before);
}
#[test]
fn a07_a10_a16_projection_counts_generated_material_once_and_excludes_unshipped_overrides() {
    let d = independent_source_read_document();
    let mut generated = d.scenes[0].presentation.clone().unwrap();
    generated.scene["character"] = json!("g".repeat(3 * 1024 * 1024 / 4));
    let contribution = independent_output_contribution(
        &d,
        "scene",
        &d.scenes[0].scene_ref,
        vec![addr(Component::Scene, None, None, None)],
        serde_json::to_value(generated).unwrap(),
    );
    let mut presentation = d.scenes[0].presentation.clone().unwrap();
    presentation.scene["character"] = json!("a".repeat(13 * 1024 * 1024 / 2));
    presentation.scene["procedural"] = independent_retained_basis(&d, vec![contribution]);
    assert!(
        serde_json::to_vec(&presentation.scene["procedural"])
            .unwrap()
            .len()
            <= 1024 * 1024,
        "test input must pass the actual native journal admission"
    );
    let d = d
        .edited(vec![Change::SceneMaterialSet {
            scene_ref: d.scenes[0].scene_ref.clone(),
            presentation,
        }])
        .unwrap();
    d.validate().unwrap();
    let retained = &d.scenes[0].presentation.as_ref().unwrap().scene["procedural"];
    assert!(
        serde_json::to_vec(&d).unwrap().len() < budget::SOURCE_BYTES,
        "test input must fit the actual native document admission"
    );
    let original_retained = retained.clone();
    let projection = budget::OutputProjection {
        document: &d,
        procedure: &retained["procedures"][0],
        contribution: &retained["contributions"][0],
        current_scene: d.scenes[0].presentation.as_ref(),
        current_other: None,
        creation: None,
    };
    let projected = serde_json::to_value(&projection).unwrap();
    assert!(projected.get("authored_overrides").is_none());
    assert!(
        projected.get("applied_operation").is_none(),
        "unqualified configuration invented native creation"
    );
    let mut expected_generated = retained["contributions"][0]["generated_basis"].clone();
    expected_generated["scene"]
        .as_object_mut()
        .unwrap()
        .remove("procedural");
    assert!(
        projected["generated_basis"] == expected_generated,
        "generated projection must remove only the unshipped nested procedural journal and retain all actual authored material"
    );
    assert!(
        projected["current_basis"] == manual::scene_material(&d.scenes[0]).unwrap(),
        "current projection must retain the complete actual authored material"
    );
    assert!(
        retained == &original_retained,
        "projection must leave the full original retained generated basis/overrides untouched"
    );
    let exact = serde_json::to_vec(&projected).unwrap().len();
    assert!(exact + 4099 < budget::SOURCE_BYTES);
    assert!(
        exact
            + serde_json::to_vec(&retained["contributions"][0]["generated_basis"])
                .unwrap()
                .len()
            > budget::SOURCE_BYTES,
        "counting the retained generated material twice must exceed the bound"
    );
    let mut stream = budget::Budget::new();
    stream.reserve(budget::SOURCE_BYTES - exact).unwrap();
    stream.value(&projection).unwrap();
    assert!(stream.reserve(1).is_err());
    budget::preflight_source_outputs(&d, "procedure:independent:basis", &Runtime::default())
        .unwrap();
    assert!(
        Runtime::default()
            .output_readings(&d, "procedure:independent:basis")
            .is_err(),
        "accurate accounting granted Source ownership to retained labels"
    );
}
#[test]
fn a05_a14_budget_creation_selector_refuses_actual_public_manual_preparation_as_source_authority() {
    let d = independent_budget_document(false, 1, 0);
    let contribution =
        d.scenes[0].presentation.as_ref().unwrap().scene["procedural"]["contributions"][0].clone();
    let mut app = Application::default();
    let client = CentralClient::discover();
    app.open(d.clone(), "agent:independent".into()).unwrap();
    let intent = envelope(&d, Scope::Expression, "a");
    app.procedural(
        &client,
        Request::Prepare {
            envelope: Box::new(intent),
        },
    )
    .unwrap();
    let accepted = app.document(EXPRESSION).unwrap();
    let journal = budget::borrowed_journal(accepted).unwrap();
    assert_eq!(journal.len(), 1);
    assert!(budget::first_valid_creation(
        accepted,
        "procedure:independent:basis",
        &contribution,
        &app.procedural_runtime,
        &journal
    )
    .unwrap()
    .is_none());
    assert!(app.procedural_runtime.producers.is_empty());
    assert!(app.procedural_runtime.qualified_operations.is_empty());
    assert!(app
        .procedural_runtime
        .output_readings(accepted, "procedure:independent:basis")
        .is_err());
}

// Append after the actual native budget/source helpers. No Source grant/cache.
#[test]
fn a10_a16_manual_count_refuses_65_actual_affected_outputs_before_qualification_or_entry_cloning() {
    let d = independent_budget_document(false, 65, 0);
    let mut app = Application::default();
    app.open(d.clone(), "human:owner".into()).unwrap();
    let request = ExpressionRequest::Edit {
        expression_ref: EXPRESSION.into(),
        expected_revision: d.revision,
        actor: "human:owner".into(),
        changes: vec![Change::ParameterSet {
            entity_ref: format!("{EXPRESSION}:entity:a"),
            parameter: "force_strength".into(),
            value: json!(0.875),
        }],
    };
    let error = app.prepare_procedural_manual_edit(&request).unwrap_err();
    assert!(
        error.contains("batch budget exceeded before allocation"),
        "qualification/byte materialization preceded complete native count: {error}"
    );
    assert_eq!(app.document(EXPRESSION).unwrap(), &d);
    assert!(app.procedural_runtime.producers.is_empty());
    assert!(app.procedural_runtime.qualified_operations.is_empty());
}
#[test]
fn a02_a10_a16_affected_material_comparison_borrows_exact_selected_leaf_and_preserves_sibling_scope(
) {
    let d = independent_budget_document(false, 1, 1024 * 1024);
    let target = addr(Component::Force, Some("a"), None, Some("strength"));
    let root =
        &d.scenes[0].presentation.as_ref().unwrap().scene["entities"][0]["force"]["strength"];
    let actual = manual::borrowed_material(&d, &target).unwrap();
    assert!(
        std::ptr::eq(actual, root),
        "material comparison manufactured a copied field"
    );
    let mut presentation = d.scenes[0].presentation.clone().unwrap();
    presentation.scene["character"] = json!("unrelated actual human Scene writing");
    let candidate = d
        .edited(vec![Change::SceneMaterialSet {
            scene_ref: d.scenes[0].scene_ref.clone(),
            presentation,
        }])
        .unwrap();
    assert!(
        !manual::affected_without_scene_copy(&d, &candidate, &target),
        "sibling Scene material widened selected force scope"
    );
    assert!(manual::affected_without_scene_copy(
        &d,
        &candidate,
        &addr(Component::Scene, None, None, None)
    ));
    let candidate = d
        .edited(vec![Change::ParameterSet {
            entity_ref: format!("{EXPRESSION}:entity:a"),
            parameter: "force_strength".into(),
            value: json!(0.875),
        }])
        .unwrap();
    assert!(manual::affected_without_scene_copy(&d, &candidate, &target));
    assert!(!manual::affected_without_scene_copy(
        &d,
        &candidate,
        &addr(Component::Entity, Some("a"), None, Some("position.x"))
    ));
    assert_eq!(
        manual::borrowed_material(&candidate, &target).unwrap(),
        &json!(0.875)
    );
}

// Append after the shared Source/driver helpers. Actual public Application
// requests and native private-preparation refusal only. Configured Source labels
// never replace a producer admission. No private live cache/ACK is injected.
fn independent_control_request(d: &Document) -> Request {
    let driver =
        source_parameter_driver(d, &format!("{EXPRESSION}:entity:a"), "force_radius", None)
            .unwrap();
    Request::Control {
        expression_ref: d.expression_ref.clone(),
        expected_revision: d.revision,
        procedure_ref: "procedure:independent:basis".into(),
        address: serde_json::from_value(driver["addresses"][0].clone()).unwrap(),
        parameter: "force_radius".into(),
        actor: "human:owner".into(),
        operation_ref: "operation:independent-native-control".into(),
        action: control::Action::Takeover {
            value: json!(120.0),
            lifetime: control::Lifetime::Persistent,
        },
    }
}
#[test]
fn a02_a05_a06_native_control_rejects_unqualified_configured_procedure_and_all_foreign_scalar_intakes(
) {
    let d = independent_budget_document(true, 1, 0)
        .edited(vec![Change::ParameterSet {
            entity_ref: format!("{EXPRESSION}:entity:a"),
            parameter: "force_radius".into(),
            value: json!(80.0),
        }])
        .unwrap();
    let before = serde_json::to_vec(&d).unwrap();
    let client = CentralClient::discover();
    let baseline = serde_json::to_value(independent_control_request(&d)).unwrap();
    for case in [
        "configured_only",
        "wrong_key",
        "sibling",
        "other_expression",
        "foreign_scene",
        "missing_entity",
        "stale_cas",
        "invalid_value",
    ] {
        let mut raw = baseline.clone();
        match case {
            "wrong_key" => raw["parameter"] = json!("force_strength"),
            "sibling" => raw["address"]["property"] = json!("strength"),
            "other_expression" => raw["address"]["expression_ref"] = json!("expression:foreign"),
            "foreign_scene" => {
                raw["address"]["scene_ref"] = json!(format!("{EXPRESSION}:scene:missing"))
            }
            "missing_entity" => {
                raw["address"]["entity_ref"] = json!(format!("{EXPRESSION}:entity:missing"))
            }
            "stale_cas" => raw["expected_revision"] = json!(d.revision - 1),
            "invalid_value" => raw["action"]["value"] = json!(1601.0),
            _ => {}
        }
        let request: Request = serde_json::from_value(raw).unwrap();
        let mut app = Application::default();
        app.open(d.clone(), "agent:independent".into()).unwrap();
        let original = ExpressionRequest::Procedural {
            request: request.clone(),
        };
        let prepared = app.prepare_procedural_control(&original);
        if case == "stale_cas" {
            assert!(prepared.unwrap().is_none());
        } else {
            assert!(
                prepared.is_err(),
                "native control prepared {case} from configured labels"
            );
        }
        let (refused, changed) = app.procedural(&client, request).unwrap();
        assert!(changed.is_none());
        assert_eq!(
            refused["state"],
            if case == "stale_cas" {
                "revision_conflict"
            } else {
                "source_refused"
            }
        );
        assert_eq!(refused["native_procedural_receipts"], json!([]));
        assert_eq!(
            serde_json::to_vec(app.document(EXPRESSION).unwrap()).unwrap(),
            before
        );
        assert!(app.procedural_runtime.controls.is_empty());
        assert!(app.procedural_runtime.producers.is_empty());
        assert!(app.procedural_runtime.qualified_operations.is_empty());
    }
}
#[test]
fn a05_a06_control_wire_refuses_unknown_action_and_public_cached_or_source_receipt_fields() {
    let d = independent_driver_document();
    let baseline = serde_json::to_value(independent_control_request(&d)).unwrap();
    for case in [
        "action_kind",
        "cached",
        "source_reply",
        "native_ack",
        "producer_grant",
    ] {
        let mut raw = baseline.clone();
        match case {
            "action_kind" => raw["action"]["kind"] = json!("compiled_takeover"),
            "cached" => {
                raw["cache"] = json!({"provenance":"live_native_owner","document_sha256":"caller"})
            }
            "source_reply" => raw["native_result"] = json!({"operation":"control","result":{}}),
            "native_ack" => raw["native_procedural_receipts"] = json!([{"status":"ok"}]),
            _ => raw["producer_ref"] = json!("producer:caller"),
        }
        assert!(
            serde_json::from_value::<Request>(raw).is_err(),
            "public native control accepted {case}"
        );
    }
    for value in [
        json!("120"),
        json!(null),
        json!([120.0]),
        json!({"value":120.0}),
    ] {
        let mut raw = baseline.clone();
        raw["action"]["value"] = value;
        let request: Request = serde_json::from_value(raw).unwrap();
        let mut app = Application::default();
        app.open(d.clone(), "agent:independent".into()).unwrap();
        assert!(app
            .prepare_procedural_control(&ExpressionRequest::Procedural { request })
            .is_err());
        assert_eq!(app.document(EXPRESSION).unwrap(), &d);
    }
}
#[test]
fn a05_a13_cold_saved_control_operation_identity_and_labels_do_not_authorize_retry() {
    let d = independent_budget_document(true, 1, 0)
        .edited(vec![Change::ParameterSet {
            entity_ref: format!("{EXPRESSION}:entity:a"),
            parameter: "force_radius".into(),
            value: json!(80.0),
        }])
        .unwrap();
    let client = CentralClient::discover();
    let encoded = serde_json::to_vec(&d).unwrap();
    let reopened: Document = serde_json::from_slice(&encoded).unwrap();
    let request = independent_control_request(&reopened);
    let mut app = Application::default();
    app.open(reopened.clone(), "human:owner".into()).unwrap();
    for request in [request.clone(), {
        let mut raw = serde_json::to_value(&request).unwrap();
        raw["action"]["value"] = json!(160.0);
        serde_json::from_value(raw).unwrap()
    }] {
        let (refused, changed) = app.procedural(&client, request).unwrap();
        assert!(changed.is_none());
        assert_eq!(refused["state"], "source_refused");
        assert_eq!(refused["cache"]["provenance"], "unqualified");
        assert_eq!(refused["cache"]["restored"], true);
        assert_eq!(refused["native_procedural_receipts"], json!([]));
        assert_eq!(app.document(EXPRESSION).unwrap(), &reopened);
        assert!(app.procedural_runtime.controls.is_empty());
    }
}

#[test]
fn a13_native_export_observes_ordinary_material_without_creating_procedural_keys() {
    let (mut app, client) = opened();
    let before = app.document(EXPRESSION).unwrap().clone();
    assert!(before.scenes.iter().all(|s| {
        s.presentation
            .as_ref()
            .unwrap()
            .scene
            .get("procedural")
            .is_none()
    }));
    let (exported, changed) = app
        .apply(
            &client,
            ExpressionRequest::Export {
                expression_ref: EXPRESSION.into(),
                expected_revision: before.revision,
            },
        )
        .unwrap();
    assert!(changed.is_none());
    assert_eq!(exported["document"], serde_json::to_value(&before).unwrap());
    assert_eq!(app.document(EXPRESSION).unwrap(), &before);
    let decoded: Document = serde_json::from_value(exported["document"].clone()).unwrap();
    let mut reopened = Application::default();
    reopened.open(decoded, "human:owner".into()).unwrap();
    reopened
        .apply(
            &client,
            ExpressionRequest::Fork {
                expression_ref: EXPRESSION.into(),
                expected_revision: before.revision,
                new_expression_ref: "expression:plain-export-fork".into(),
                actor: "human:owner".into(),
            },
        )
        .unwrap();
    assert!(reopened
        .document("expression:plain-export-fork")
        .unwrap()
        .scenes
        .iter()
        .all(|s| s
            .presentation
            .as_ref()
            .unwrap()
            .scene
            .get("procedural")
            .is_none()));
    assert!(reopened.procedural_runtime.producers.is_empty());
}

#[test]
fn a13_native_restore_retains_actual_receipts_without_mutating_unjournaled_neighbor() {
    let (mut app, client) = opened();
    let op = prepared(&mut app, &client);
    app.procedural(
        &client,
        Request::Commit {
            operation_ref: op.envelope.operation_ref,
        },
    )
    .unwrap();
    let before = app.document(EXPRESSION).unwrap().clone();
    let neighbor = format!("{EXPRESSION}:scene:plain-neighbor");
    let mut material = before.scenes[0].presentation.clone().unwrap();
    material.scene.as_object_mut().unwrap().remove("procedural");
    material.scene["id"] = json!(neighbor);
    material.scene["name"] = json!("Plain neighbor");
    let before = before
        .edited(vec![
            Change::SceneCreate {
                scene_ref: neighbor.clone(),
                title: "Plain neighbor".into(),
            },
            Change::SceneCompose {
                scene_ref: neighbor.clone(),
                entity_refs: before.scenes[0].entity_refs.clone(),
            },
            Change::SceneMaterialSet {
                scene_ref: neighbor.clone(),
                presentation: material.clone(),
            },
        ])
        .unwrap();
    let original_journal = journal(&before).unwrap();
    assert!(!original_journal.is_empty());
    let mut candidate = before.clone();
    retain_journal_on_restore(&before, &mut candidate).unwrap();
    assert_eq!(journal(&candidate).unwrap(), original_journal);
    let plain = candidate
        .scenes
        .iter()
        .find(|s| s.scene_ref == neighbor)
        .unwrap()
        .presentation
        .as_ref()
        .unwrap();
    assert_eq!(plain, &material);
    assert!(plain.scene.get("procedural").is_none());
    candidate.validate().unwrap();
}

// Append after actual independent_budget_document; genuine Document/API only.
// Source qualification is deliberately absent, never injected as a fixture.
#[test]
fn a10_a16_manual_aggregate_bytes_refuse_before_any_source_qualification_or_entry_copy() {
    let d = independent_budget_document(false, 3, 1536 * 1024);
    let changes = vec![Change::ParameterSet {
        entity_ref: format!("{EXPRESSION}:entity:a"),
        parameter: "force_strength".into(),
        value: json!(0.875),
    }];
    let candidate = d.edited(changes.clone()).unwrap();
    let before_bytes = serde_json::to_vec(&manual::scene_material(&d.scenes[0]).unwrap())
        .unwrap()
        .len();
    let after_bytes = serde_json::to_vec(&manual::scene_material(&candidate.scenes[0]).unwrap())
        .unwrap()
        .len();
    assert!(
        serde_json::to_vec(&d).unwrap().len() < budget::SOURCE_BYTES,
        "detector must start with a genuinely bounded native Document"
    );
    assert!(
        before_bytes + after_bytes < budget::SOURCE_BYTES,
        "the first entry alone must fit; this detects aggregate ordering"
    );
    assert!(
        3 * (before_bytes + after_bytes) > budget::SOURCE_BYTES,
        "actual repeated native material must exceed the complete batch limit"
    );
    let mut app = Application::default();
    app.open(d.clone(), "human:owner".into()).unwrap();
    assert!(app.procedural_runtime.producers.is_empty());
    assert!(app.procedural_runtime.qualified_operations.is_empty());
    let request = ExpressionRequest::Edit {
        expression_ref: d.expression_ref.clone(),
        expected_revision: d.revision,
        actor: "human:owner".into(),
        changes,
    };
    let error = app.prepare_procedural_manual_edit(&request).unwrap_err();
    assert!(
        error.contains("aggregate intake byte budget exceeded before allocation"),
        "a partial entry reached Source qualification/copy before total bytes: {error}"
    );
    assert_eq!(app.document(EXPRESSION).unwrap(), &d);
    assert!(app.procedural_runtime.producers.is_empty());
    assert!(app.procedural_runtime.qualified_operations.is_empty());
}

// Append after independent_budget_document and actual Source/output helpers.
// The retained control is configuration for a negative preflight test. No
// private Source/current-owner/admission/ACK capability is injected.
#[test]
fn a06_a10_a16_joined_active_controls_charge_full_material_before_source_qualification() {
    let mut d = independent_budget_document(false, 0, 5 * 1024 * 1024);
    let entity_ref = format!("{EXPRESSION}:entity:a");
    let target = addr(Component::Force, Some("a"), None, Some("strength"));
    let native_base =
        serde_json::to_value(&d.entities[&entity_ref].parameters["force_strength"]).unwrap();
    let mut presentation = d.scenes[0].presentation.clone().unwrap();
    let retained = &mut presentation.scene["procedural"];
    retained["procedures"][0]["definition"] = json!({
        "expression_ref": d.expression_ref,
        "procedure_ref": "procedure:independent:basis",
        "program": {"recipe": "scene_material", "outputs": []}
    });
    retained["controls"] = json!([{
        "address": target, "target": format!("entity:{}:forces.strength", entity_ref.replace(':', "%3A")), "procedure_ref": "procedure:independent:basis", "parameter": "force_strength",
        "authored_base": 0.2, "native_base": native_base,
        "dormant_lanes": [], "dormant_tracks": [], "suspended_lanes": [], "source_basis": [], "dormant_overrides": [],
        "takeover": {"value": 0.2, "native_value": 0.2, "lifetime": "persistent", "actor": "human:owner", "operation_ref": "operation:retained-config"}
    }]);
    d = d
        .edited(vec![Change::SceneMaterialSet {
            scene_ref: d.scenes[0].scene_ref.clone(),
            presentation,
        }])
        .unwrap();
    d.validate().unwrap();
    let mut changed = d.scenes[0].presentation.clone().unwrap();
    changed.scene["name"] = json!("Actual human name revision");
    let changes = vec![
        Change::SceneRename {
            scene_ref: d.scenes[0].scene_ref.clone(),
            title: "Actual human name revision".into(),
        },
        Change::SceneMaterialSet {
            scene_ref: d.scenes[0].scene_ref.clone(),
            presentation: changed,
        },
    ];
    let candidate = d.edited(changes.clone()).unwrap();
    assert!(
        serde_json::to_vec(&d).unwrap().len() < budget::SOURCE_BYTES,
        "the ordinary actual Document must itself fit its native byte domain"
    );
    let before_bytes = serde_json::to_vec(d.scenes[0].presentation.as_ref().unwrap())
        .unwrap()
        .len();
    let after_bytes = serde_json::to_vec(candidate.scenes[0].presentation.as_ref().unwrap())
        .unwrap()
        .len();
    assert!(
        before_bytes + after_bytes > budget::SOURCE_BYTES,
        "the complete original/candidate active Source material must exceed the intake domain"
    );
    let mut application = Application::default();
    application.open(d.clone(), "human:owner".into()).unwrap();
    assert!(application.procedural_runtime.producers.is_empty());
    assert!(application
        .procedural_runtime
        .qualified_operations
        .is_empty());
    let request = ExpressionRequest::Edit {
        expression_ref: d.expression_ref.clone(),
        expected_revision: d.revision,
        actor: "human:owner".into(),
        changes,
    };
    let error = application
        .prepare_procedural_manual_edit(&request)
        .unwrap_err();
    assert!(
        error.contains("aggregate intake byte budget exceeded before allocation"),
        "live Source validation/material reconstruction ran before the complete active material prepass: {error}"
    );
    assert_eq!(application.document(EXPRESSION).unwrap(), &d);
    assert!(application.procedural_runtime.producers.is_empty());
    assert!(application
        .procedural_runtime
        .qualified_operations
        .is_empty());
}

// Append after actual native budget helpers; no Source/grant/receipt injection.
#[test]
fn a05_a06_a16_direct_native_control_rejects_complete_preview_bytes_before_qualification() {
    let d = independent_budget_document(false, 0, 5 * 1024 * 1024)
        .edited(vec![Change::ParameterSet {
            entity_ref: format!("{EXPRESSION}:entity:a"),
            parameter: "force_radius".into(),
            value: json!(80.0),
        }])
        .unwrap();
    d.validate().unwrap();
    let candidate = d
        .edited(vec![
            Change::ParameterManual {
                entity_ref: format!("{EXPRESSION}:entity:a"),
                parameter: "force_radius".into(),
            },
            Change::ParameterSet {
                entity_ref: format!("{EXPRESSION}:entity:a"),
                parameter: "force_radius".into(),
                value: json!(120.0),
            },
        ])
        .unwrap();
    assert!(
        serde_json::to_vec(&d).unwrap().len() < budget::SOURCE_BYTES,
        "negative must begin with a valid bounded current native Document"
    );
    let before_bytes = serde_json::to_vec(d.scenes[0].presentation.as_ref().unwrap())
        .unwrap()
        .len();
    let after_bytes = serde_json::to_vec(candidate.scenes[0].presentation.as_ref().unwrap())
        .unwrap()
        .len();
    assert!(
        before_bytes + after_bytes > budget::SOURCE_BYTES,
        "actual original/preview material must exceed the complete Source intake domain"
    );
    let mut application = Application::default();
    application.open(d.clone(), "human:owner".into()).unwrap();
    let request = ExpressionRequest::Procedural {
        request: Request::Control {
            expression_ref: d.expression_ref.clone(),
            expected_revision: d.revision,
            procedure_ref: "procedure:independent:basis".into(),
            address: addr(Component::Force, Some("a"), None, Some("radius")),
            parameter: "force_radius".into(),
            actor: "human:owner".into(),
            operation_ref: "operation:direct-control-budget".into(),
            action: control::Action::Takeover {
                value: json!(120.0),
                lifetime: control::Lifetime::Persistent,
            },
        },
    };
    let error = application
        .prepare_procedural_control(&request)
        .unwrap_err();
    assert!(
        error.contains("aggregate intake byte budget exceeded before allocation"),
        "Source qualification/material preview preceded the complete direct control prepass: {error}"
    );
    assert_eq!(application.document(EXPRESSION).unwrap(), &d);
    assert!(application.procedural_runtime.producers.is_empty());
    assert!(application
        .procedural_runtime
        .qualified_operations
        .is_empty());
    assert!(application.procedural_runtime.controls.is_empty());
}

// Append to the existing actual native independent receiving tests.
// Source snapshots are reads of a Document, not native Source qualification.
// No private cached Document, producer, qualified operation or ACK is injected.
#[test]
fn a05_a14_a16_source_snapshot_respects_actual_document_boundary_without_qualification() {
    let small = independent_budget_document(false, 0, 0);
    let overhead = serde_json::to_vec(&small).unwrap().len();
    assert_eq!(super::super::DOCUMENT_BYTES, budget::SOURCE_BYTES);
    let padding = budget::SOURCE_BYTES.checked_sub(overhead + 256).unwrap();
    let mut presentation = small.scenes[0].presentation.clone().unwrap();
    presentation.scene["character"] = json!("c".repeat(padding));
    let document = small
        .edited(vec![Change::SceneMaterialSet {
            scene_ref: small.scenes[0].scene_ref.clone(),
            presentation,
        }])
        .unwrap();
    document.validate().unwrap();
    let encoded_length = serde_json::to_vec(&document).unwrap().len();
    assert!(encoded_length <= budget::SOURCE_BYTES);
    assert!(encoded_length > budget::SOURCE_BYTES - 512);
    let mut application = Application::default();
    application
        .open(document.clone(), "human:owner".into())
        .unwrap();
    let snapshot = application
        .procedural_source_snapshot(EXPRESSION, document.revision)
        .unwrap();
    assert!(
        snapshot == document,
        "snapshot lost actual native Document material"
    );
    assert_eq!(
        application
            .procedural_source_snapshot(EXPRESSION, document.revision + 1)
            .unwrap_err(),
        "revision_conflict"
    );
    assert!(application.document(EXPRESSION).unwrap() == &document);
    assert!(application.procedural_runtime.producers.is_empty());
    assert!(application
        .procedural_runtime
        .qualified_operations
        .is_empty());

    // The actual ordinary owner rejects an oversized Document before it can
    // become a snapshot. Do not bypass Application::open to manufacture an
    // oversized private cached Document and call that real reception.
    let mut oversized = document.clone();
    oversized.scenes[0].presentation.as_mut().unwrap().scene["character"] =
        json!("c".repeat(budget::SOURCE_BYTES));
    assert!(serde_json::to_vec(&oversized).unwrap().len() > budget::SOURCE_BYTES);
    let mut streamed = budget::Budget::new();
    assert!(streamed
        .value(&oversized)
        .unwrap_err()
        .contains("byte budget"));
    let error = application
        .open(oversized, "human:owner".into())
        .unwrap_err();
    assert!(error.contains("Expression document exceeds 8 MiB"));
    assert!(application.document(EXPRESSION).unwrap() == &document);
    assert!(application.procedural_runtime.producers.is_empty());
    assert!(application
        .procedural_runtime
        .qualified_operations
        .is_empty());
}

#[test]
fn a05_a14_actual_edit_rejects_stale_source_snapshot_before_unqualified_payload_parsing() {
    let document = independent_budget_document(false, 0, 0);
    let client = CentralClient::discover();
    let mut application = Application::default();
    application
        .open(document.clone(), "human:owner".into())
        .unwrap();
    let snapshot = application
        .procedural_source_snapshot(EXPRESSION, document.revision)
        .unwrap();
    application
        .apply(
            &client,
            ExpressionRequest::Edit {
                expression_ref: document.expression_ref.clone(),
                expected_revision: document.revision,
                actor: "human:owner".into(),
                changes: vec![Change::ParameterSet {
                    entity_ref: format!("{EXPRESSION}:entity:a"),
                    parameter: "force_strength".into(),
                    value: json!(0.375),
                }],
            },
        )
        .unwrap();
    let current = application.document(EXPRESSION).unwrap().clone();
    assert_eq!(current.revision, snapshot.revision + 1);
    assert_eq!(
        current.entities[&format!("{EXPRESSION}:entity:a")].parameters["force_strength"].value,
        json!(0.375)
    );
    // Deliberately invalid compiler payloads distinguish the stale basis
    // refusal from source parsing. They supply no Source identity or grant.
    let error = application
        .admit_procedural_source(&snapshot, Value::Null, Value::Null)
        .unwrap_err();
    assert_eq!(
        error,
        "The original native compiler basis changed; retain and requalify the source intent"
    );
    assert!(application.document(EXPRESSION).unwrap() == &current);
    assert!(application.procedural_runtime.producers.is_empty());
    assert!(application
        .procedural_runtime
        .qualified_operations
        .is_empty());
    assert!(application.procedural_runtime.operations.is_empty());
}

// Append to the actual native independent receiving test module.
// These are configured Document negatives, never qualified producer examples.
fn independent_peer_configuration_candidate(controls: Vec<Value>) -> Result<Document, String> {
    let document = independent_budget_document(false, 0, 0).edited(vec![Change::ParameterSet {
        entity_ref: format!("{EXPRESSION}:entity:a"),
        parameter: "force_radius".into(),
        value: json!(80.0),
    }])?;
    let mut presentation = document.scenes[0].presentation.clone().unwrap();
    presentation.scene["procedural"]["controls"] = json!(controls);
    document.edited(vec![Change::SceneMaterialSet {
        scene_ref: document.scenes[0].scene_ref.clone(),
        presentation,
    }])
}
fn independent_peer_configuration_document(controls: Vec<Value>) -> Document {
    let document = independent_peer_configuration_candidate(controls).unwrap();
    document.validate().unwrap();
    document
}
fn independent_configured_peer() -> Value {
    let document = independent_budget_document(false, 0, 0);
    json!({
        "address":addr(Component::Force, Some("a"), None, Some("strength")),
        "procedure_ref":"procedure:independent:basis", "parameter":"force_strength",
        "target":format!("entity:{}:forces.strength", format!("{EXPRESSION}:entity:a").replace(':', "%3A")),
        "native_base":document.entities[&format!("{EXPRESSION}:entity:a")].parameters["force_strength"],
        "authored_base":0.2, "takeover":{"value":0.2,"native_value":0.2,"lifetime":"persistent","actor":"human:owner","operation_ref":"operation:configured-peer"},
        "dormant_lanes":[], "suspended_lanes":[], "dormant_tracks":[], "dormant_overrides":[], "source_basis":[]
    })
}
#[test]
fn a02_a05_a06_native_peer_intake_refuses_wrong_coordinates_duplicate_or_lost_paired_fact_unchanged(
) {
    for case in [
        "wrong_scene",
        "foreign_entity",
        "wrong_parameter",
        "wrong_target",
        "duplicate",
        "lost_base",
    ] {
        let mut peer = independent_configured_peer();
        match case {
            "wrong_scene" => {
                peer["address"]["scene_ref"] = json!(format!("{EXPRESSION}:scene:unissued"))
            }
            "foreign_entity" => {
                peer["address"]["entity_ref"] = json!(format!("{EXPRESSION}:entity:unissued"))
            }
            "wrong_parameter" => peer["parameter"] = json!("force_spin"),
            "wrong_target" => peer["target"] = json!("entity:foreign:forces.radius"),
            "lost_base" => {
                peer.as_object_mut().unwrap().remove("native_base");
            }
            _ => {}
        }
        let controls = if case == "duplicate" {
            vec![peer.clone(), peer]
        } else {
            vec![peer]
        };
        if case == "duplicate" {
            // The normal Document boundary refuses duplicate retained addresses
            // before a Source request can exist. Do not forge an invalid live
            // Document merely to reach a later private peer guard.
            let before = independent_budget_document(false, 0, 0);
            let mut application = Application::default();
            application
                .open(before.clone(), "human:owner".into())
                .unwrap();
            let error = independent_peer_configuration_candidate(controls).unwrap_err();
            assert_eq!(
                error, "Conflicting retained control",
                "duplicate peer escaped its actual retained identity guard"
            );
            assert_eq!(application.document(EXPRESSION).unwrap(), &before);
            assert!(application.procedural_runtime.producers.is_empty());
            assert!(application
                .procedural_runtime
                .qualified_operations
                .is_empty());
            assert!(application.procedural_runtime.controls.is_empty());
            continue;
        }
        let document = independent_peer_configuration_document(controls);
        let mut application = Application::default();
        application
            .open(document.clone(), "human:owner".into())
            .unwrap();
        let request = ExpressionRequest::Procedural {
            request: independent_control_request(&document),
        };
        let error = application
            .prepare_procedural_control(&request)
            .unwrap_err();
        match case {
            "lost_base" => assert!(
                error.contains("lost its paired baseline/value identity"),
                "lost paired native baseline escaped its guard: {error}"
            ),
            "wrong_parameter" => assert!(
                error.contains("no unique actual scalar Parameter"),
                "wrong peer native key escaped actual correspondence: {error}"
            ),
            _ => assert!(
                !error.contains("original live Source qualification"),
                "wrong actual coordinate reached producer qualification: {error}"
            ),
        }
        assert!(application.document(EXPRESSION).unwrap() == &document);
        assert!(application.procedural_runtime.producers.is_empty());
        assert!(application
            .procedural_runtime
            .qualified_operations
            .is_empty());
        assert!(application.procedural_runtime.controls.is_empty());
    }
}
#[test]
fn a05_a06_saved_peer_procedure_labels_never_mint_current_native_control_qualification() {
    let document = independent_peer_configuration_document(vec![independent_configured_peer()]);
    let mut application = Application::default();
    application
        .open(document.clone(), "human:owner".into())
        .unwrap();
    let request = ExpressionRequest::Procedural {
        request: independent_control_request(&document),
    };
    let error = application
        .prepare_procedural_control(&request)
        .unwrap_err();
    assert!(
        error.contains("original live Source qualification"),
        "configured labels bypassed native qualification or never reached the actual native guard: {error}"
    );
    assert!(application.document(EXPRESSION).unwrap() == &document);
    assert!(application.procedural_runtime.producers.is_empty());
    assert!(application
        .procedural_runtime
        .qualified_operations
        .is_empty());
    assert!(application.procedural_runtime.controls.is_empty());
}

#[test]
fn a06_a10_a16_distinct_native_peer_cardinality_refuses_before_source_qualification() {
    // Five actual global native Entities across the native maximum64 Scenes
    // produce2560 DISTINCT valid scalar coordinates, not duplicate labels.
    let mut document = independent_budget_document(false, 0, 0);
    let original_entity_count = document.entities.len();
    // The existing native fixture also has an ordinary, unaddressed Entity.
    // Keep it in the actual Document; only the five selected peers contribute
    // the bounded 2560 native control coordinates below.
    let original_primary_entity = format!("{EXPRESSION}:entity:a");
    let original_unaddressed = document
        .entities
        .iter()
        .filter(|(reference, _)| reference.as_str() != original_primary_entity.as_str())
        .map(|(reference, entity)| (reference.clone(), entity.clone()))
        .collect::<BTreeMap<_, _>>();
    let primary = document.scenes[0].scene_ref.clone();
    let entities = (0..5)
        .map(|index| {
            if index == 0 {
                format!("{EXPRESSION}:entity:a")
            } else {
                format!("{EXPRESSION}:entity:peer-{index}")
            }
        })
        .collect::<Vec<_>>();
    let parameters = [
        ("force_strength", json!(0.2)),
        ("force_spin", json!(0.1)),
        ("force_radius", json!(80.0)),
        ("x", json!(0.0)),
        ("y", json!(0.0)),
        ("z", json!(0.0)),
        ("scale", json!(1.0)),
        ("rotation", json!(0.0)),
    ];
    let mut changes = Vec::new();
    for (index, reference) in entities.iter().enumerate() {
        if index != 0 {
            changes.push(Change::EntityAdd {
                scene_ref: primary.clone(),
                entity_ref: reference.clone(),
                title: format!("Actual peer {index}"),
            });
        }
        for (parameter, value) in &parameters {
            changes.push(Change::ParameterSet {
                entity_ref: reference.clone(),
                parameter: (*parameter).into(),
                value: value.clone(),
            });
        }
    }
    document = document.edited(changes).unwrap();
    let original_material = document.scenes[0].presentation.clone().unwrap();
    let template = original_material.scene["entities"][0].clone();
    document = document
        .edited(
            (1..64)
                .map(|index| Change::SceneCreate {
                    scene_ref: format!("{EXPRESSION}:scene:peer-{index}"),
                    title: format!("Actual peer Scene {index}"),
                })
                .collect(),
        )
        .unwrap();
    let mut changes = Vec::new();
    for scene in &document.scenes {
        let mut presentation = original_material.clone();
        presentation.scene["id"] = json!(scene.scene_ref);
        presentation.scene["name"] = json!(scene.title);
        let mut material_entities = Vec::new();
        let mut controls = Vec::new();
        for reference in &entities {
            let mut entity = template.clone();
            entity["id"] = json!(reference);
            if entity["native"].is_object() && entity["native"].get("id").is_some() {
                entity["native"]["id"] = json!(reference);
            }
            material_entities.push(entity);
            for (parameter, value) in &parameters {
                let (component, property) = match *parameter {
                    "force_strength" => (Component::Force, "strength"),
                    "force_spin" => (Component::Force, "spin"),
                    "force_radius" => (Component::Force, "radius"),
                    "x" => (Component::Entity, "position.x"),
                    "y" => (Component::Entity, "position.y"),
                    "z" => (Component::Entity, "position.z"),
                    "scale" => (Component::Entity, "scale"),
                    _ => (Component::Entity, "rotation"),
                };
                let address = Address {
                    expression_ref: document.expression_ref.clone(),
                    scene_ref: Some(scene.scene_ref.clone()),
                    entity_ref: Some(reference.clone()),
                    component,
                    parent_ref: None,
                    constituent_ref: None,
                    property: Some(property.into()),
                };
                let material_path = if *parameter == "force_strength" {
                    "force.strength"
                } else if *parameter == "force_spin" {
                    "force.spin"
                } else if *parameter == "force_radius" {
                    "force.radius"
                } else {
                    property
                };
                let authored = material_path
                    .split('.')
                    .fold(&template, |body, key| &body[key]);
                assert!(authored.as_f64().is_some_and(f64::is_finite));
                // Registry control keys x/y/z name the native Parameter;
                // the authored material path above remains position.x/y/z.
                let suffix = match *parameter {
                    "force_strength" => "forces.strength",
                    "force_spin" => "forces.spin",
                    "force_radius" => "forces.radius",
                    _ => *parameter,
                };
                let target = format!("entity:{}:{suffix}", reference.replace(':', "%3A"));
                controls.push(json!({"address":address,"procedure_ref":"procedure:independent:basis","parameter":parameter,
                    "native_base":document.entities[reference].parameters[*parameter],"authored_base":authored,
                    "takeover":{"value":authored,"native_value":value,"lifetime":"persistent","actor":"human:owner","operation_ref":"operation:configured-peer-count"},
                    "target":target,"dormant_lanes":[],"suspended_lanes":[],"dormant_tracks":[],"dormant_overrides":[],"source_basis":[]}));
            }
        }
        presentation.scene["entities"] = json!(material_entities);
        presentation.scene["procedural"]["controls"] = json!(controls);
        changes.push(Change::SceneCompose {
            scene_ref: scene.scene_ref.clone(),
            entity_refs: entities.clone(),
        });
        changes.push(Change::SceneMaterialSet {
            scene_ref: scene.scene_ref.clone(),
            presentation,
        });
    }
    document = document.edited(changes).unwrap();
    document.validate().unwrap();
    assert_eq!(document.scenes.len(), 64);
    assert_eq!(document.entities.len(), original_entity_count + 4);
    assert!(original_unaddressed
        .iter()
        .all(|(reference, entity)| document.entities.get(reference) == Some(entity)));
    assert!(document
        .scenes
        .iter()
        .all(|scene| scene.entity_refs == entities));
    assert!(serde_json::to_vec(&document).unwrap().len() < budget::SOURCE_BYTES);
    let distinct = document
        .scenes
        .iter()
        .flat_map(|scene| {
            scene.presentation.as_ref().unwrap().scene["procedural"]["controls"]
                .as_array()
                .unwrap()
        })
        .map(|row| retained_address(&row["address"]).unwrap())
        .collect::<BTreeSet<_>>();
    assert_eq!(distinct.len(), 2560);
    assert!(distinct.len() > MAX_TARGETS);
    let mut application = Application::default();
    application
        .open(document.clone(), "human:owner".into())
        .unwrap();
    let request = ExpressionRequest::Procedural {
        request: independent_control_request(&document),
    };
    let error = application
        .prepare_procedural_control(&request)
        .unwrap_err();
    assert!(
        error.contains("Native control peer count exceeded before Source allocation"),
        "distinct current native peers reached Source qualification before their count bound: {error}"
    );
    assert!(application.document(EXPRESSION).unwrap() == &document);
    assert!(application.procedural_runtime.producers.is_empty());
    assert!(application
        .procedural_runtime
        .qualified_operations
        .is_empty());
    assert!(application.procedural_runtime.controls.is_empty());
}

// Uses the actual configured Document helper from expression_control_peer_independent.rs.
// Ordinary Edit must refuse a bad target before Source qualification; the saved
// row is configuration and never supplies a private producer/ACK capability.
#[test]
fn a02_a06_ordinary_active_edit_refuses_wrong_encoded_native_target_before_qualification() {
    let actual_entity = format!("{EXPRESSION}:entity:a");
    let encoded_entity = actual_entity.replace(':', "%3A");
    for wrong_target in [
        format!("entity:{encoded_entity}:forces.radius"),
        "entity:foreign:forces.strength".into(),
        format!("entity:{actual_entity}:forces.strength"),
    ] {
        let mut configured = independent_configured_peer();
        configured["target"] = json!(wrong_target);
        let document = independent_peer_configuration_document(vec![configured]);
        let mut presentation = document.scenes[0].presentation.clone().unwrap();
        presentation.scene["name"] = json!("Actual human name revision");
        let changes = vec![
            Change::SceneRename {
                scene_ref: document.scenes[0].scene_ref.clone(),
                title: "Actual human name revision".into(),
            },
            Change::SceneMaterialSet {
                scene_ref: document.scenes[0].scene_ref.clone(),
                presentation,
            },
        ];
        document.edited(changes.clone()).unwrap();
        let mut application = Application::default();
        application
            .open(document.clone(), "human:owner".into())
            .unwrap();
        let request = ExpressionRequest::Edit {
            expression_ref: document.expression_ref.clone(),
            expected_revision: document.revision,
            actor: "human:owner".into(),
            changes,
        };
        let error = application
            .prepare_procedural_manual_edit(&request)
            .unwrap_err();
        assert!(
            error
                .contains("Native control encoded target differs from its actual Entity/Parameter"),
            "wrong target reached Source qualification or escaped actual correspondence: {error}"
        );
        assert!(application.document(EXPRESSION).unwrap() == &document);
        assert!(application.procedural_runtime.producers.is_empty());
        assert!(application
            .procedural_runtime
            .qualified_operations
            .is_empty());
        assert!(application.procedural_runtime.controls.is_empty());
    }
}

// Independent additive tests, included after the existing actual Document helpers.
// These test normal native configuration and receiving refusals. They supply no
// Source admission, timing witness, private receiver boundary, or consumer ACK.

#[test]
fn a05_a14_normal_receiving_preflight_preserves_validation_and_changes_neither_document_nor_runtime(
) {
    let d = document();
    let original = d.clone();
    let mut runtime = Runtime::default();
    let e = envelope(&d, Scope::Expression, "a");
    let preview = runtime.check_preparation(&d, e.clone()).unwrap();
    assert_eq!(preview.status, Status::Prepared);
    assert!(preview.accepted_revision.is_none());
    assert!(runtime.inspect(&e.operation_ref).is_err());
    assert_eq!(runtime.cursor, 0);
    assert!(runtime.deltas.is_empty());
    assert!(runtime.qualified_operations.is_empty());
    assert!(runtime.producers.is_empty());
    assert_eq!(d, original);
    for case in 0..4 {
        let mut bad = e.clone();
        match case {
            0 => bad.expected_revision += 1,
            1 => {
                bad.scope = Scope::Addresses {
                    addresses: vec![addr(Component::Entity, Some("b"), None, None)],
                }
            }
            2 => {
                bad.changes = vec![Change::ParameterSet {
                    entity_ref: format!("{EXPRESSION}:entity:a"),
                    parameter: "scale".into(),
                    value: json!(4.01),
                }]
            }
            3 => bad.producer_ref = Some("procedure-source:unissued-native-origin".into()),
            _ => unreachable!(),
        }
        assert!(
            runtime.check_preparation(&d, bad).is_err(),
            "normal receiver preview bypassed native validation in case {case}"
        );
        assert!(runtime.inspect(&e.operation_ref).is_err());
        assert_eq!(runtime.cursor, 0);
        assert!(runtime.deltas.is_empty());
        assert!(runtime.qualified_operations.is_empty());
        assert!(runtime.producers.is_empty());
        assert_eq!(d, original);
    }
    // A normal manual material preparation is valid configuration, while it
    // still supplies no native Source continuation capability.
    let accepted = runtime.prepare(&d, e).unwrap();
    assert_eq!(accepted, preview);
    assert_eq!(runtime.cursor, 1);
    assert!(runtime.qualified_operations.is_empty());
    assert_eq!(d, original);
}

#[test]
fn a05_a14_genuine_manual_cancel_and_exact_saved_journal_cannot_settle_a_source_lifecycle() {
    let (mut app, client, d, _) = warm_native_output();
    let mut e = envelope(&d, Scope::Expression, "a");
    e.operation_ref = "operation:independent-manual-cancellation".into();
    app.procedural(
        &client,
        Request::Prepare {
            envelope: Box::new(e.clone()),
        },
    )
    .unwrap();
    let cancelled = app
        .procedural(
            &client,
            Request::Cancel {
                operation_ref: e.operation_ref.clone(),
            },
        )
        .unwrap()
        .0;
    let operation: Operation = serde_json::from_value(cancelled["operation"].clone()).unwrap();
    assert_eq!(operation.status, Status::Cancelled);
    assert!(operation.applied_revision.is_none());
    assert!(operation.failure.is_none());
    assert!(operation.observations.is_empty());
    let actual = app.document(EXPRESSION).unwrap().clone();
    let stored: Operation =
        serde_json::from_value(journal(&actual).unwrap()[&e.operation_ref].clone()).unwrap();
    assert_eq!(
        stored, operation,
        "actual native Cancel must retain its complete original typed journal"
    );
    let intent = lifecycle::CancelIntent {
        expression_ref: EXPRESSION.into(),
        expected_revision: actual.revision,
        scene_ref: format!("{EXPRESSION}:scene:generated"),
        operation_ref: e.operation_ref.clone(),
        actor: e.actor.clone(),
        procedure_ref: "procedure:independent-owner".into(),
        expected_procedure_revision: "1".into(),
    };
    let error = app
        .procedural_cancelled_readback(&actual, &intent)
        .unwrap_err();
    assert!(
        error.contains("actual original native S cancellation"),
        "manual Cancel granted Source abandonment: {error}"
    );
    assert_eq!(app.document(EXPRESSION).unwrap(), &actual);
    assert!(app.procedural_runtime.qualified_operations.is_empty());
    let saved = serde_json::to_vec(&actual).unwrap();
    let mut cold = Application::default();
    cold.open(
        serde_json::from_slice(&saved).unwrap(),
        "agent:independent-cold".into(),
    )
    .unwrap();
    cold.procedural_runtime.restore_document(&actual).unwrap();
    assert!(
        cold.procedural_cancelled_readback(&actual, &intent)
            .is_err(),
        "exact saved Cancelled journal manufactured warm Source authority"
    );
    assert_eq!(cold.document(EXPRESSION).unwrap(), &actual);
    assert!(cold.procedural_runtime.qualified_operations.is_empty());
}

// Origin serialization and aggregate accounting over real native Application
// edits. A manual operation remains unqualified: these tests never populate a
// producer map, qualified operation, source lease or consumer ACK.
#[test]
fn a05_a07_a13_original_typed_sources_stay_separate_from_current_recipe_basis() {
    let d = independent_budget_document(false, 1, 0);
    let client = CentralClient::discover();
    let mut app = Application::default();
    app.open(d.clone(), "human:origin-serialization-owner".into())
        .unwrap();
    let mut intent = envelope(&d, Scope::Expression, "a");
    intent.operation_ref = "operation:actual-origin-serialization".into();
    intent.sources = serde_json::from_value(json!([
        {"ref":"control:recipe:original", "revision":"recipe-r1", "availability":"available"},
        {"ref":"control:profile:original", "revision":"profile-r1", "availability":"available"},
        {"ref":"control:additional:original", "revision":"extra-r1", "availability":"available"}
    ]))
    .unwrap();
    app.procedural(
        &client,
        Request::Prepare {
            envelope: Box::new(intent.clone()),
        },
    )
    .unwrap();
    let applied = app
        .procedural(
            &client,
            Request::Commit {
                operation_ref: intent.operation_ref.clone(),
            },
        )
        .unwrap()
        .0;
    let original: Operation = serde_json::from_value(applied["operation"].clone()).unwrap();
    assert_eq!(original.status, Status::Applied);
    let original_bytes = serde_json::to_vec(&original).unwrap();
    let current = app.document(EXPRESSION).unwrap();
    let scene = &current.scenes[0];
    let mut material = scene.presentation.clone().unwrap();
    let retained = &mut material.scene["procedural"];
    retained["procedures"][0]["source_basis"] = json!([
        {"ref":"control:recipe:current", "revision":"recipe-r2", "availability":"available"},
        {"ref":"control:profile:current", "revision":"profile-r2", "availability":"available"}
    ]);
    retained["contributions"][0]["recipe_revision"] = json!("recipe-r2");
    retained["contributions"][0]["origin_source_basis"] = json!([{"ref":"caller:forged"}]);
    let current = current
        .edited(vec![Change::SceneMaterialSet {
            scene_ref: scene.scene_ref.clone(),
            presentation: material,
        }])
        .unwrap();
    let retained = &current.scenes[0].presentation.as_ref().unwrap().scene["procedural"];
    let contribution = &retained["contributions"][0];
    let current_basis = source_current_output_basis(&current, contribution).unwrap();
    let projection = budget::OutputProjection {
        document: &current,
        procedure: &retained["procedures"][0],
        contribution,
        current_scene: None,
        current_other: Some(&current_basis),
        creation: Some(&original),
    };
    let projected = serde_json::to_value(&projection).unwrap();
    assert_eq!(
        projected["origin_source_basis"],
        applied["operation"]["envelope"]["sources"]
    );
    assert_eq!(
        projected["source_basis"],
        json!([
            {"source_ref":"control:recipe:current", "revision":"recipe-r2"},
            {"source_ref":"control:profile:current", "revision":"profile-r2"}
        ])
    );
    assert_eq!(projected["recipe_revision"], "recipe-r2");
    assert_eq!(projected["applied_operation"], applied["operation"]);
    assert_eq!(projected["current_basis"], current_basis);
    assert_eq!(serde_json::to_vec(&original).unwrap(), original_bytes);
    let encoded = serde_json::to_vec(&projected).unwrap();
    let mut bounded = budget::Budget::new();
    bounded
        .reserve(budget::SOURCE_BYTES - encoded.len())
        .unwrap();
    bounded.value(&projection).unwrap();
    assert!(
        bounded.reserve(1).is_err(),
        "origin basis bytes escaped the aggregate bound"
    );
    let unqualified = budget::OutputProjection {
        creation: None,
        ..projection
    };
    let unqualified = serde_json::to_value(&unqualified).unwrap();
    assert!(
        unqualified.get("origin_source_basis").is_none(),
        "retained caller origin became a native origin"
    );
    assert!(unqualified.get("applied_operation").is_none());
    assert!(
        app.procedural_runtime
            .output_readings(&current, "procedure:independent:basis")
            .is_err(),
        "manual original sources or a serialized projection minted native Source authority"
    );
}

#[test]
fn a05_a14_original_source_projection_refuses_unavailable_or_invalid_typed_sources() {
    let client = CentralClient::discover();
    let (mut app, _) = opened();
    let d = app.document(EXPRESSION).unwrap().clone();
    let mut intent = envelope(&d, Scope::Expression, "a");
    intent.operation_ref = "operation:actual-origin-availability".into();
    intent.sources = serde_json::from_value(json!([
        {"ref":"control:recipe:original", "revision":"recipe-r1", "availability":"available"}
    ]))
    .unwrap();
    app.procedural(
        &client,
        Request::Prepare {
            envelope: Box::new(intent.clone()),
        },
    )
    .unwrap();
    let applied = app
        .procedural(
            &client,
            Request::Commit {
                operation_ref: intent.operation_ref,
            },
        )
        .unwrap()
        .0;
    let original: Operation = serde_json::from_value(applied["operation"].clone()).unwrap();
    let original_bytes = serde_json::to_vec(&original).unwrap();
    assert_eq!(
        serde_json::to_value(budget::OriginSourceBasis(&original.envelope.sources)).unwrap(),
        applied["operation"]["envelope"]["sources"]
    );
    for availability in [
        super::super::Availability::Unavailable,
        super::super::Availability::Withheld,
        super::super::Availability::Stale,
    ] {
        let mut wrong = original.envelope.sources.clone();
        wrong[0].availability = availability;
        assert!(serde_json::to_value(budget::OriginSourceBasis(&wrong)).is_err());
    }
    let mut wrong = original.envelope.sources.clone();
    wrong[0].revision.clear();
    assert!(serde_json::to_value(budget::OriginSourceBasis(&wrong)).is_err());
    wrong[0].revision = "recipe-r1".into();
    wrong[0].r#ref.clear();
    assert!(serde_json::to_value(budget::OriginSourceBasis(&wrong)).is_err());
    assert!(serde_json::to_value(budget::OriginSourceBasis(&[])).is_err());
    assert_eq!(serde_json::to_vec(&original).unwrap(), original_bytes);
}

#[path = "expression_procedural_continuation_reading_tests.rs"]
mod continuation_reading_tests;

#[path = "expression_procedural_force_continuation_tests.rs"]
mod force_continuation_tests;

/// Exercises the real Application/Runtime journal and Scene constructor. The
/// legacy ownership-only envelope is not a qualified Source or numeric ACK.
#[test]
fn actual_prepare_journal_requires_a_new_current_scene_read_without_rewriting_original_intent() {
    let (mut app, client) = opened();
    let before = app.document(EXPRESSION).unwrap().clone();
    let scene_ref = before.scenes[0].scene_ref.clone();
    let initial_owner = app.procedural_scene_owner(&before, &scene_ref).unwrap();
    let initial_fact = initial_owner
        .closed_constructor_fact(&before, &scene_ref)
        .unwrap();
    let envelope = envelope(&before, Scope::Expression, "a");
    let original_envelope = envelope.clone();
    let (reply, changed) = app
        .procedural(
            &client,
            Request::Prepare {
                envelope: Box::new(envelope),
            },
        )
        .unwrap();
    assert!(changed.is_some());
    assert_eq!(reply["durability"], "native_document_until_file_save");
    let after = app.document(EXPRESSION).unwrap().clone();
    assert_eq!(after.revision, before.revision + 1);
    let admitted: Operation = serde_json::from_value(reply["operation"].clone()).unwrap();
    assert_eq!(admitted.envelope, original_envelope);
    assert_eq!(admitted.envelope.expected_revision, before.revision);
    assert_eq!(admitted.accepted_revision, Some(after.revision));
    assert_eq!(admitted.status, Status::Prepared);
    assert_eq!(admitted.applied_revision, None);
    assert!(admitted.observations.is_empty());
    assert!(
        app.require_procedural_scene_owner(&initial_owner, &after)
            .is_err()
    );
    assert!(
        initial_owner
            .closed_constructor_fact(&after, &scene_ref)
            .is_err()
    );
    let fresh_owner = app.procedural_scene_owner(&after, &scene_ref).unwrap();
    app.require_procedural_scene_owner(&fresh_owner, &after)
        .unwrap();
    let fresh_fact = fresh_owner
        .closed_constructor_fact(&after, &scene_ref)
        .unwrap();
    assert_eq!(initial_owner.instance_ref(), fresh_owner.instance_ref());
    assert_eq!(
        initial_owner.construction_generation(),
        fresh_owner.construction_generation()
    );
    assert_eq!(
        initial_fact["initial_document_sha256"],
        fresh_fact["initial_document_sha256"]
    );
    assert_eq!(initial_fact["document_revision"], before.revision);
    assert_eq!(fresh_fact["document_revision"], after.revision);
    assert_ne!(
        initial_fact["document_sha256"],
        fresh_fact["document_sha256"]
    );

    let strip_journal_metadata = |document: &Document| {
        let mut material = document
            .scenes
            .iter()
            .find(|s| s.scene_ref == scene_ref)
            .unwrap()
            .presentation
            .as_ref()
            .unwrap()
            .clone();
        material.scene.as_object_mut().unwrap().remove("procedural");
        material
    };
    assert_eq!(
        strip_journal_metadata(&before),
        strip_journal_metadata(&after)
    );
    assert_eq!(before.entities, after.entities);
    let (repeated, changed) = app
        .procedural(
            &client,
            Request::Prepare {
                envelope: Box::new(original_envelope.clone()),
            },
        )
        .unwrap();
    assert_eq!(repeated["repeated"], true);
    assert!(changed.is_none());
    assert_eq!(app.document(EXPRESSION).unwrap(), &after);
    let retained = app
        .procedural_runtime
        .inspect(&original_envelope.operation_ref)
        .unwrap();
    assert_eq!(retained, &admitted);
    assert!(retained.envelope.producer_ref.is_none());
    assert!(app.procedural_runtime.producers.is_empty());
}

#[test]
fn a13_actual_continuation_stale_document_refuses_before_shared_copy_callback() {
    let before=source_source_read_document();
    let mut app=Application::default();
    app.open(before.clone(),"human:actual-resource-reader".into()).unwrap();
    let stale=before.edited(vec![Change::ParameterSet {
        entity_ref:format!("{EXPRESSION}:entity:a"),parameter:"force_strength".into(),
        value:json!(0.63),
    }]).unwrap();
    let mut calls=0;
    let error=app.procedural_continuation_reading_with_capture(&stale,
        &stale.scenes[0].scene_ref,&Value::Null,&mut |_|{calls+=1;Ok(())}).unwrap_err();
    assert_eq!(error,"revision_conflict");
    assert_eq!(calls,0);
    assert_eq!(app.document(EXPRESSION).unwrap(),&before);
}
#[test]
fn a05_actual_current_document_does_not_turn_bare_definition_into_source_custody() {
    let before=source_source_read_document();
    let mut app=Application::default();
    app.open(before.clone(),"human:actual-resource-reader".into()).unwrap();
    let mut calls=0;
    assert!(app.procedural_continuation_reading_with_capture(&before,
        &before.scenes[0].scene_ref,&Value::Null,&mut |_|{calls+=1;Ok(())}).is_err());
    assert_eq!(calls,0);
    assert!(app.procedural_runtime.producers.is_empty());
    assert!(app.procedural_runtime.qualified_operations.is_empty());
    assert_eq!(app.document(EXPRESSION).unwrap(),&before);
}
