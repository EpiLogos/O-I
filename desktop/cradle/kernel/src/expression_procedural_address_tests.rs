//! Actual Application Create/Edit, native Document/address consumers only.
//! No Source grants, producer cache entries, timing witnesses or ACKs.
use super::*;
const EXPRESSION: &str = "expression:borrowed-native-address";

fn document() -> Document {
    let mut app = Application::default();
    let client = CentralClient::discover();
    let (created, event) = app
        .apply(
            &client,
            ExpressionRequest::Create {
                expression_ref: EXPRESSION.into(),
                title: "Borrowed native address".into(),
                actor: "human:address-owner".into(),
            },
        )
        .unwrap();
    assert_eq!(created["state"], "ready");
    assert!(event.is_some());
    let before = app.document(EXPRESSION).unwrap();
    let scene = before.scenes[0].scene_ref.clone();
    let entity = format!("{EXPRESSION}:entity:a");
    let presentation = crate::expression_scene::Presentation {
        schema: "oi.journey-scene/v1".into(),
        saved: None,
        scene: json!({"id":scene,"name":"Main","duration":30,"transition":2,
            "view":{"mode":"3d","yaw":0,"pitch":0,"zoom":1,"panX":0,"panY":0},
            "field":{"params":{"speed":0.5}},"composition":{},"morph":{},"engine":{},"text":[],"automation":[],
            "entities":[{"id":entity,"kind":"formation","scale":1,"force":{"strength":0.2},
                "layers":[{"id":"layer:a","text":"Base","z":0}],
                "sequence":{"steps":[{"id":"step:a","text":"A","layers":[{"id":"layer:a","text":"State","z":1}]}]}}]}),
    };
    let (edited, event) = app
        .apply(
            &client,
            ExpressionRequest::Edit {
                expression_ref: EXPRESSION.into(),
                expected_revision: before.revision,
                actor: "human:address-owner".into(),
                changes: vec![
                    Change::EntityAdd {
                        scene_ref: scene.clone(),
                        entity_ref: entity.clone(),
                        title: "A".into(),
                    },
                    Change::ParameterSet {
                        entity_ref: entity.clone(),
                        parameter: "scale".into(),
                        value: json!(1.0),
                    },
                    Change::ParameterSet {
                        entity_ref: entity,
                        parameter: "force_strength".into(),
                        value: json!(0.2),
                    },
                    Change::SceneMaterialSet {
                        scene_ref: scene,
                        presentation,
                    },
                ],
            },
        )
        .unwrap();
    assert_eq!(edited["state"], "ready");
    assert!(event.is_some());
    let document = app.document(EXPRESSION).unwrap().clone();
    document.validate().unwrap();
    document
}
fn at(
    d: &Document,
    component: Component,
    entity: bool,
    constituent: Option<&str>,
    property: Option<&str>,
) -> Address {
    Address {
        expression_ref: d.expression_ref.clone(),
        scene_ref: Some(d.scenes[0].scene_ref.clone()),
        entity_ref: entity.then(|| format!("{EXPRESSION}:entity:a")),
        component,
        constituent_ref: constituent.map(str::to_owned),
        parent_ref: None,
        property: property.map(str::to_owned),
    }
}
fn check_both(d: &Document, a: &Address, expected: &Value) {
    let borrowed = root(d, a).unwrap();
    borrowed.validate().unwrap();
    assert_eq!(addressed(d, a).unwrap(), *expected);
    assert_eq!(
        resolve(
            d,
            &Scope::Addresses {
                addresses: vec![a.clone()]
            }
        )
        .unwrap(),
        vec![canonical_address(d, a).unwrap()]
    );
}

#[test]
fn exact_native_typed_and_authored_paths_agree_without_changing_the_document() {
    let d = document();
    let original = d.clone();
    for (a, expected) in [
        (
            at(&d, Component::Scene, false, None, Some("revision")),
            json!(d.scenes[0].revision),
        ),
        (
            at(
                &d,
                Component::Scene,
                false,
                None,
                Some("presentation.scene.duration"),
            ),
            json!(30),
        ),
        (
            at(
                &d,
                Component::Property,
                true,
                None,
                Some("force_strength.value"),
            ),
            json!(0.2),
        ),
        (
            at(
                &d,
                Component::Property,
                true,
                None,
                Some("force_strength.automation"),
            ),
            Value::Null,
        ),
        (
            at(&d, Component::Property, false, None, Some("duration")),
            json!(30),
        ),
        (
            at(&d, Component::Field, false, None, Some("params.speed")),
            json!(0.5),
        ),
        (
            at(&d, Component::Force, true, None, Some("strength")),
            json!(0.2),
        ),
        (
            at(
                &d,
                Component::SequenceLink,
                true,
                Some("step:a"),
                Some("text"),
            ),
            json!("A"),
        ),
    ] {
        check_both(&d, &a, &expected);
    }
    let a = at(&d, Component::Force, true, None, Some("strength"));
    assert!(std::ptr::eq(
        root(&d, &a).unwrap().borrowed_value().unwrap(),
        &d.scenes[0].presentation.as_ref().unwrap().scene["entities"][0]["force"]["strength"]
    ));
    let a = at(&d, Component::Scene, false, None, None);
    assert!(
        matches!(root(&d,&a).unwrap().root, NativeRoot::Scene(s) if std::ptr::eq(s,&d.scenes[0]))
    );
    assert_eq!(d, original);
    let typed = d
        .edited(vec![Change::SceneMaterialClear {
            scene_ref: d.scenes[0].scene_ref.clone(),
        }])
        .unwrap();
    typed.validate().unwrap();
    check_both(
        &typed,
        &at(
            &typed,
            Component::Entity,
            true,
            None,
            Some("parameters.scale.value"),
        ),
        &json!(1.0),
    );
    for property in [
        "pinned",
        "parameters.scale.missing",
        "parameters.scale.value.child",
    ] {
        let a = at(&typed, Component::Entity, true, None, Some(property));
        assert!(root(&typed, &a).unwrap().validate().is_err());
        assert!(addressed(&typed, &a).is_err());
    }
    assert!(addressed(
        &typed,
        &at(&typed, Component::Entity, true, None, Some("subject"))
    )
    .unwrap()
    .is_null());
}

#[test]
fn actual_layer_containers_keep_explicit_base_state_and_legacy_discrimination() {
    let d = document();
    let a = at(&d, Component::Layer, true, Some("layer:a"), Some("text"));
    assert!(root(&d, &a).is_err());
    assert!(resolve(
        &d,
        &Scope::Addresses {
            addresses: vec![a.clone()]
        }
    )
    .is_err());
    let mut base = a.clone();
    base.parent_ref = Some(None);
    check_both(&d, &base, &json!("Base"));
    let mut state = a.clone();
    state.parent_ref = Some(Some("step:a".into()));
    check_both(&d, &state, &json!("State"));
    let mut presentation = d.scenes[0].presentation.clone().unwrap();
    presentation.scene["entities"][0]["sequence"]["steps"][0]["layers"] = json!([]);
    let one = d
        .edited(vec![Change::SceneMaterialSet {
            scene_ref: d.scenes[0].scene_ref.clone(),
            presentation,
        }])
        .unwrap();
    assert_eq!(canonical_address(&one, &a).unwrap().parent_ref, Some(None));
    assert!(addressed(&one, &state).is_err());
    let mut presentation = d.scenes[0].presentation.clone().unwrap();
    presentation.scene["entities"][0]["sequence"]["steps"][0]["layers"][0] =
        presentation.scene["entities"][0]["layers"][0].clone();
    let equal = d
        .edited(vec![Change::SceneMaterialSet {
            scene_ref: d.scenes[0].scene_ref.clone(),
            presentation,
        }])
        .unwrap();
    assert!(
        canonical_address(&equal, &a).is_err(),
        "equal bodies do not merge distinct containers"
    );
}

#[test]
fn whole_expression_shared_complete_keys_and_serde_omissions_are_native() {
    let d = document();
    let d=d.edited(vec![Change::CompositionSet { presentation:crate::expression_scene::Composition {
        schema:"oi.journey-properties/v1".into(),description:"Actual shared projection".into(),loop_playback:false,
        shared:Some(json!({"toolbelt":[],"values":{"field.params.speed":0.7},"pointer":{"field.params.speed":true}})),
    } }]).unwrap();
    let mut a = address(&d, None, None, Component::Expression);
    for (property, expected) in [
        ("shared.values.field.params.speed", json!(0.7)),
        ("shared.pointer.field.params.speed", json!(true)),
        ("selection.scene_ref", json!(d.selection.scene_ref)),
    ] {
        a.property = Some(property.into());
        check_both(&d, &a, &expected);
    }
    for property in [
        "shared.values.field",
        "selection.relation_ref",
        "scenes.zero",
    ] {
        a.property = Some(property.into());
        assert!(root(&d, &a).and_then(|r| r.validate()).is_err());
        assert!(addressed(&d, &a).is_err());
    }
    assert_eq!(
        resolve(&d, &Scope::Expression).unwrap(),
        vec![address(&d, None, None, Component::Expression)]
    );
}

#[test]
fn exact_source_binding_preflight_and_scope_modes_keep_native_targets() {
    let d = document();
    let entity = format!("{EXPRESSION}:entity:a");
    let subject:crate::expression::SubjectBinding=serde_json::from_value(json!({
        "subject_ref":"subject:address-owner","native_owner":"oi.expression","presentation_role":"thing",
        "sources":[{"ref":"source:address-owner","revision":"r1","availability":"available"}],"readings":[],"actions":[]
    })).unwrap();
    let d = d
        .edited(vec![Change::SubjectBind {
            entity_ref: entity,
            binding: subject.clone(),
        }])
        .unwrap();
    let target = at(&d, Component::Entity, true, None, None);
    let scene_target = at(&d, Component::Scene, false, None, None);
    let mut presentation = d.scenes[0].presentation.clone().unwrap();
    let mut retained = empty_retention();
    retained["source_basis"] = json!(subject.sources);
    retained["bindings"] = json!([{ "address":target,"principal":subject,"contributors":[],
        "locus":{"ref":"source:address-place","revision":"r1","availability":"available"},"tags":[{"tag":"selected","origin":"authored"}] }]);
    presentation.scene["procedural"] = retained;
    let d = d
        .edited(vec![Change::SceneMaterialSet {
            scene_ref: d.scenes[0].scene_ref.clone(),
            presentation,
        }])
        .unwrap();
    let pointer = &d.scenes[0].presentation.as_ref().unwrap().scene["procedural"]["bindings"][0];
    assert!(std::ptr::eq(
        source_exact_binding_borrowed(&d, &target).unwrap().unwrap(),
        pointer
    ));
    for scope in [
        Scope::Addresses {
            addresses: vec![target.clone()],
        },
        Scope::Subject {
            subject_ref: "subject:address-owner".into(),
        },
        Scope::Locus {
            source_ref: "source:address-place".into(),
            source_revision: "r1".into(),
        },
        Scope::Tag {
            scene_refs: vec![d.scenes[0].scene_ref.clone()],
            tag: "selected".into(),
            origin: "authored".into(),
        },
    ] {
        assert_eq!(resolve(&d, &scope).unwrap(), vec![target.clone()]);
    }
    assert_eq!(
        resolve(
            &d,
            &Scope::Scenes {
                scene_refs: vec![d.scenes[0].scene_ref.clone()]
            }
        )
        .unwrap(),
        vec![scene_target]
    );
    for mutation in 0..5 {
        let mut wrong = target.clone();
        match mutation {
            0 => wrong.expression_ref = "expression:foreign".into(),
            1 => wrong.scene_ref = Some(format!("{EXPRESSION}:scene:absent")),
            2 => wrong.parent_ref = Some(None),
            3 => wrong.property = Some("__proto__.speed".into()),
            _ => {
                wrong.component = Component::Field;
                wrong.entity_ref = target.entity_ref.clone();
            }
        }
        assert!(root(&d, &wrong).and_then(|r| r.validate()).is_err());
        assert!(addressed(&d, &wrong).is_err());
        assert!(resolve(
            &d,
            &Scope::Addresses {
                addresses: vec![wrong]
            }
        )
        .is_err());
    }
    assert_eq!(
        d.scenes[0].presentation.as_ref().unwrap().scene["procedural"]["operations"],
        json!([])
    );
}
