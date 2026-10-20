//! Production native operations, not a duplicate test reducer.
use oi_cradle_kernel::{
    expression::{Application, Request},
    CentralClient,
};
use serde_json::{json, Value};
fn apply(app: &mut Application, value: Value) -> Result<Value, String> {
    app.apply(
        &CentralClient::discover(),
        serde_json::from_value::<Request>(value).unwrap(),
    )
    .map(|value| value.0)
}
fn inspect(app: &mut Application) -> Value {
    apply(
        app,
        json!({"operation":"inspect","expression_ref":"expression:craft"}),
    )
    .unwrap()["document"]
        .clone()
}
fn edit(app: &mut Application, revision: u64, changes: Value) -> Result<Value, String> {
    apply(
        app,
        json!({"operation":"edit","expression_ref":"expression:craft","expected_revision":revision,"actor":"human:craft","changes":changes}),
    )
}
fn setup() -> Application {
    let mut app = Application::default();
    apply(&mut app,json!({"operation":"create","expression_ref":"expression:craft","title":"Inquiry","actor":"human:craft"})).unwrap();
    edit(&mut app,1,json!([{"change":"entity_add","scene_ref":"expression:craft:scene:main","entity_ref":"expression:craft:entity:one","title":"Source passage"}])).unwrap();
    app
}
fn material() -> Value {
    json!({"schema":"oi.journey-scene/v1","scene":{
        "id":"expression:craft:scene:main","name":"Main","character":"Attributable investigation", "duration":42,"transition":3,
        "view":{"mode":"3d","yaw":0.3,"pitch":0.1,"zoom":1.2,"panX":0.0,"panY":0.0},
        "field":{"background":"#fafafa","palette":["#111111","#222222"],"material":"ink","params":{"speed":0.75}},
        "engine":{"morphEnabled":true},"morph":{"thetaRate":0.4},"composition":{"layout":"free","plane":"XY"},
        "entities":[{"id":"expression:craft:entity:one","kind":"formation","name":"Passage","position":{"x":0.25,"y":0.0,"z":0.8}}],
        "text":[{"body":"Derived interpretation, not independent evidence"}],"automation":[]
    }})
}
#[test]
fn complete_native_scene_survives_export_open_rename_and_fork() {
    let mut app = setup();
    let mut body = material();
    // The actual native default scene is called Main.
    let d = inspect(&mut app);
    body["scene"]["name"] = d["scenes"][0]["title"].clone();
    edit(&mut app,2,json!([{"change":"scene_material_set","scene_ref":"expression:craft:scene:main","presentation":body}])).unwrap();
    let original = inspect(&mut app);
    assert_eq!(original["scenes"][0]["presentation"], body);
    let mut restart = Application::default();
    let reopened = apply(
        &mut restart,
        json!({"operation":"open","document":original,"actor":"human:reopen"}),
    )
    .unwrap();
    assert_eq!(reopened["document"], original);
    let fork=apply(&mut app,json!({"operation":"fork","expression_ref":"expression:craft","expected_revision":3,"new_expression_ref":"expression:variant","actor":"human:craft"})).unwrap();
    let scene = &fork["document"]["scenes"][0]["presentation"]["scene"];
    assert_eq!(scene["id"], "expression:variant:scene:main");
    assert_eq!(scene["entities"][0]["id"], "expression:variant:entity:one");
    assert!(
        scene.get("semanticField").is_none(),
        "fork must not manufacture optional material"
    );
    assert_eq!(scene["text"], body["scene"]["text"]);
    edit(&mut app,3,json!([{"change":"scene_rename","scene_ref":"expression:craft:scene:main","title":"The first question"}])).unwrap();
    assert_eq!(
        inspect(&mut app)["scenes"][0]["presentation"]["scene"]["name"],
        "The first question"
    );
}
#[test]
fn stale_scene_edits_never_replace_a_newer_human_composition() {
    let mut app = setup();
    edit(&mut app,2,json!([{"change":"scene_rename","scene_ref":"expression:craft:scene:main","title":"Human revision"}])).unwrap();
    let before = inspect(&mut app);
    let result=edit(&mut app,2,json!([{"change":"scene_material_set","scene_ref":"expression:craft:scene:main","presentation":material()}])).unwrap();
    assert_eq!(result["state"], "revision_conflict");
    assert_eq!(inspect(&mut app), before);
}
#[test]
fn malformed_material_unknown_carriers_and_wrong_occurrences_fail_atomically() {
    let mut app = setup();
    let before = inspect(&mut app);
    let mut base = material();
    base["scene"]["name"] = before["scenes"][0]["title"].clone();
    let mut wrong = base.clone();
    wrong["scene"]["entities"][0]["id"] = json!("expression:other:entity:private");
    let mut remote = base.clone();
    remote["scene"]["entities"][0]["source"] =
        json!({"kind":"image","image":{"dataUrl":"https://private.example/photo.png"}});
    let mut script = base.clone();
    script["scene"]["entities"][0]["source"] =
        json!({"kind":"image","image":{"dataUrl":"data:image/svg+xml;base64,PHN2Zz4="}});
    let mut unsafe_key = base.clone();
    unsafe_key["scene"]["field"]["__proto__"] = json!({"polluted":true});
    let mut timing = base.clone();
    timing["scene"]["duration"] = json!(0);
    for body in [wrong, remote, script, unsafe_key, timing] {
        assert!(edit(&mut app,2,json!([{"change":"scene_material_set","scene_ref":"expression:craft:scene:main","presentation":body}])).is_err());
        assert_eq!(inspect(&mut app), before);
    }
}
#[test]
fn scene_material_admits_the_manuals_drivers_and_keys_and_refuses_unknown_ones() {
    // DLW 20.14 Frequency driver (Torus, Manual, Focus, Automation) and 20.2 Key source (Torus, Sky, Manual): the kernel's validator
    // takes the values the manual names and refuses any other, in the Scene's composition and in its resonance drive.
    let mut app = setup();
    let before = inspect(&mut app);
    let mut base = material();
    base["scene"]["name"] = before["scenes"][0]["title"].clone();
    let with = |composition: Value, drive: Option<Value>| {
        let mut body = base.clone();
        for (key, value) in composition.as_object().unwrap() {
            body["scene"]["composition"][key] = value.clone();
        }
        if let Some(drive) = drive {
            body["scene"]["resonanceDrive"] = drive;
        }
        body
    };
    let set = |app: &mut Application, body: Value| {
        let revision = inspect(app)["revision"].as_u64().unwrap();
        edit(
            app,
            revision,
            json!([{"change":"scene_material_set","scene_ref":"expression:craft:scene:main","presentation":body}]),
        )
    };
    for driver in ["torus", "manual", "focus", "automation"] {
        set(&mut app, with(json!({"frequencyDriver": driver}), None))
            .unwrap_or_else(|e| panic!("driver {driver} refused: {e}"));
    }
    for key in ["torus", "sky", "manual"] {
        set(
            &mut app,
            with(
                json!({"frequencyDriver":"torus","keySource": key}),
                Some(json!({"kind":"torus","keySource": key})),
            ),
        )
        .unwrap_or_else(|e| panic!("key {key} refused: {e}"));
    }
    for drive in [
        json!({"kind":"frequency"}),
        json!({"kind":"sweep"}),
        json!({"kind":"semanticFocus","profileId":"chakra-seven-v1"}),
        json!({"kind":"torus"}),
    ] {
        set(&mut app, with(json!({}), Some(drive.clone())))
            .unwrap_or_else(|e| panic!("drive {drive} refused: {e}"));
    }
    let settled = inspect(&mut app);
    for (composition, drive) in [
        (json!({"frequencyDriver":"bogus"}), None),
        (json!({"frequencyDriver":3}), None),
        (json!({"keySource":"bogus"}), None),
        (json!({"keySource":7}), None),
        (json!({}), Some(json!({"kind":"bogus"}))),
        (json!({}), Some(json!({"kind":"torus","keySource":"bogus"}))),
        (json!({}), Some(json!("torus"))),
    ] {
        let body = with(composition.clone(), drive.clone());
        assert!(
            set(&mut app, body).is_err(),
            "accepted {composition} {drive:?}"
        );
        assert_eq!(
            inspect(&mut app),
            settled,
            "a refused drive or key leaves the document as it was"
        );
    }
}
#[test]
fn a_symbols_voice_is_written_in_one_shape_and_the_oscillators_fields_are_refused_in_words() {
    // DLW 20.2: "a name or a mode carrying the torus's sound, never its own oscillator". The voice is {enabled, carry?, gain?, attack?,
    // release?}; the four fields of the old oscillator are refused in a new write, each in its own words, and the document is left as it was.
    let mut app = setup();
    let before = inspect(&mut app);
    let mut base = material();
    base["scene"]["name"] = before["scenes"][0]["title"].clone();
    let with_voice = |sound: Value| {
        let mut body = base.clone();
        body["scene"]["entities"][0]["sound"] = sound;
        body
    };
    let set = |app: &mut Application, body: Value| {
        let revision = inspect(app)["revision"].as_u64().unwrap();
        edit(
            app,
            revision,
            json!([{"change":"scene_material_set","scene_ref":"expression:craft:scene:main","presentation":body}]),
        )
    };
    for sound in [
        json!({"enabled":true}),
        json!({"enabled":true,"carry":{"kind":"mode","ref":"chromatic/L0'/aeolian"},"gain":0.3,"attack":0.05,"release":1.5}),
        json!({"enabled":false,"carry":{"kind":"name","ref":"shem"}}),
    ] {
        set(&mut app, with_voice(sound.clone()))
            .unwrap_or_else(|e| panic!("voice {sound} refused: {e}"));
        assert_eq!(
            inspect(&mut app)["scenes"][0]["presentation"]["scene"]["entities"][0]["sound"],
            sound
        );
    }
    let settled = inspect(&mut app);
    for (sound, words) in [
        (
            json!({"enabled":true,"frequencyHz":330}),
            "frequencyHz was removed: a symbol's voice carries the torus's sound and has no pitch of its own",
        ),
        (
            json!({"enabled":true,"followCymatic":true}),
            "followCymatic was removed",
        ),
        (
            json!({"enabled":true,"waveform":"triangle"}),
            "waveform was removed: a symbol's voice has no oscillator",
        ),
        (
            json!({"enabled":true,"pan":-0.2}),
            "pan was removed: a symbol's voice stands where its symbol stands",
        ),
        (
            json!({"enabled":true,"carry":{"kind":"oscillator","ref":"x"}}),
            "Sound carry kind must be one of mode, name",
        ),
        (json!({"enabled":true,"gain":3}), "gain"),
        (json!({"gain":0.2}), "enabled flag"),
    ] {
        let error = set(&mut app, with_voice(sound.clone())).unwrap_err();
        assert!(error.contains(words), "{sound}: {error}");
        assert_eq!(
            inspect(&mut app),
            settled,
            "a refused voice leaves the document as it was"
        );
    }
}
#[test]
fn a_document_written_for_an_oscillator_still_opens_and_its_voices_are_carried_but_never_written_new(
) {
    // A document written before 20 Oct stores `sound` blocks with frequencyHz, waveform and pan. It must still open, and the kernel's own
    // rewrites of its material (a text passage, a page split) carry those voices byte for byte. What no write may do is introduce or change
    // a voice in the old shape; the frame migrates a voice when it opens one, so what it writes back is in the new shape.
    let mut app = setup();
    let mut old = material();
    old["scene"]["name"] = inspect(&mut app)["scenes"][0]["title"].clone();
    let oscillator = json!({"enabled":true,"followCymatic":false,"frequencyHz":330,"gain":0.3,"waveform":"triangle","attack":0.12,"release":1.1,"pan":-0.2});
    old["scene"]["entities"][0]["sound"] = oscillator.clone();
    let mut document = inspect(&mut app);
    document["scenes"][0]["presentation"] = old.clone();
    let mut reopened = Application::default();
    apply(
        &mut reopened,
        json!({"operation":"open","document":document,"actor":"human:reopen"}),
    )
    .expect("a stored oscillator voice does not make a document unopenable");
    let stored = inspect(&mut reopened);
    assert_eq!(
        stored["scenes"][0]["presentation"]["scene"]["entities"][0]["sound"],
        oscillator
    );
    let revision = stored["revision"].as_u64().unwrap();
    let set = |app: &mut Application, revision: u64, body: Value| {
        edit(
            app,
            revision,
            json!([{"change":"scene_material_set","scene_ref":"expression:craft:scene:main","presentation":body}]),
        )
    };
    // The kernel's own rewrite of other material (here a text layer) leaves the stored voice as it found it.
    let mut text_filled = old.clone();
    text_filled["scene"]["text"][0]["body"] = json!("Another passage");
    set(&mut reopened, revision, text_filled.clone())
        .expect("rewriting the scene around an unchanged old voice is not a new voice");
    assert_eq!(
        inspect(&mut reopened)["scenes"][0]["presentation"]["scene"]["entities"][0]["sound"],
        oscillator
    );
    // A scene copied with its members carries the voices the document already stores for those members: copying is not a new voice.
    let mut copy = old.clone();
    copy["scene"]["id"] = json!("expression:craft:scene:copy");
    copy["scene"]["name"] = json!("Copy");
    edit(
        &mut reopened,
        revision + 1,
        json!([
            {"change":"scene_create","scene_ref":"expression:craft:scene:copy","title":"Copy"},
            {"change":"scene_compose","scene_ref":"expression:craft:scene:copy","entity_refs":["expression:craft:entity:one"]},
            {"change":"scene_material_set","scene_ref":"expression:craft:scene:copy","presentation":copy}
        ]),
    )
    .expect("a copy of material that already holds a voice carries it");
    let revision = revision + 1;
    // A changed voice in the old shape is a new write and is refused.
    let settled = inspect(&mut reopened);
    let mut louder = text_filled.clone();
    louder["scene"]["entities"][0]["sound"]["gain"] = json!(0.5);
    let error = set(&mut reopened, revision + 1, louder).unwrap_err();
    assert!(error.contains("frequencyHz was removed"), "{error}");
    assert_eq!(inspect(&mut reopened), settled);
    // The migrated voice (what the frame writes) takes the old one's place.
    let mut migrated = text_filled;
    migrated["scene"]["entities"][0]["sound"] =
        json!({"enabled":true,"gain":0.3,"attack":0.12,"release":1.1});
    set(&mut reopened, revision + 1, migrated).expect("the migrated voice is written");
}
#[test]
fn symbol_voices_is_an_on_or_off_that_the_scene_may_carry_and_absent_reads_as_on() {
    // DLW 20.2 Field, "Symbol voices | On · Off | On": a boolean in the Scene's composition, beside the Key source. Anything else is refused.
    let mut app = setup();
    let mut base = material();
    base["scene"]["name"] = inspect(&mut app)["scenes"][0]["title"].clone();
    let set = |app: &mut Application, symbol_voices: Option<Value>| {
        let mut body = base.clone();
        if let Some(value) = symbol_voices {
            body["scene"]["composition"]["symbolVoices"] = value;
        }
        let revision = inspect(app)["revision"].as_u64().unwrap();
        edit(
            app,
            revision,
            json!([{"change":"scene_material_set","scene_ref":"expression:craft:scene:main","presentation":body}]),
        )
    };
    for value in [None, Some(json!(true)), Some(json!(false))] {
        set(&mut app, value.clone()).unwrap_or_else(|e| panic!("{value:?} refused: {e}"));
    }
    let settled = inspect(&mut app);
    for bad in [json!("on"), json!(1), json!(null), json!({"on":true})] {
        assert!(set(&mut app, Some(bad.clone())).is_err(), "accepted {bad}");
        assert_eq!(inspect(&mut app), settled);
    }
}
#[test]
fn removing_a_scene_is_not_deleting_native_members_or_the_last_scene() {
    let mut app = setup();
    assert!(edit(
        &mut app,
        2,
        json!([{"change":"scene_remove","scene_ref":"expression:craft:scene:main"}])
    )
    .is_err());
    edit(&mut app,2,json!([{"change":"scene_create","scene_ref":"expression:craft:scene:second","title":"Second"},{"change":"scene_compose","scene_ref":"expression:craft:scene:second","entity_refs":["expression:craft:entity:one"]}])).unwrap();
    edit(
        &mut app,
        3,
        json!([{"change":"scene_remove","scene_ref":"expression:craft:scene:main"}]),
    )
    .unwrap();
    let d = inspect(&mut app);
    assert!(d["entities"]["expression:craft:entity:one"].is_object());
    assert_eq!(d["selection"]["scene_ref"], "expression:craft:scene:second");
}

#[test]
fn generic_native_edits_remain_visible_after_scene_material_is_saved() {
    let mut app = setup();
    let mut body = material();
    body["scene"]["name"] = inspect(&mut app)["scenes"][0]["title"].clone();
    edit(&mut app,2,json!([{"change":"scene_material_set","scene_ref":"expression:craft:scene:main","presentation":body}])).unwrap();
    edit(&mut app,3,json!([
        {"change":"parameter_set","entity_ref":"expression:craft:entity:one","parameter":"x","value":200},
        {"change":"parameter_set","entity_ref":"expression:craft:entity:one","parameter":"glyph","value":"Revised"}
    ])).unwrap();
    let d = inspect(&mut app);
    let entity = &d["scenes"][0]["presentation"]["scene"]["entities"][0];
    assert_eq!(entity["position"]["x"], 0.5);
    assert_eq!(entity["text"], "Revised");
    edit(
        &mut app,
        4,
        json!([{"change":"entity_remove","entity_ref":"expression:craft:entity:one"}]),
    )
    .unwrap();
    let d = inspect(&mut app);
    assert_eq!(
        d["scenes"][0]["presentation"]["scene"]["entities"],
        json!([])
    );
}

#[test]
fn expression_properties_and_title_survive_native_reopen_and_reject_unknown_authority() {
    let mut app = setup();
    let properties = json!({"schema":"oi.journey-properties/v1","description":"Authored interpretation, not independent corroboration","loop":false,
        "shared":{"toolbelt":[],"values":{"field.params.speed":0.2},"pointer":{}}});
    edit(&mut app,2,json!([{"change":"rename","title":"Revised investigation"},{"change":"composition_set","presentation":properties}])).unwrap();
    let original = inspect(&mut app);
    assert_eq!(original["title"], "Revised investigation");
    assert_eq!(original["presentation"], properties);
    let mut restart = Application::default();
    assert_eq!(
        apply(
            &mut restart,
            json!({"operation":"open","document":original,"actor":"human:reopen"})
        )
        .unwrap()["document"],
        original
    );
    let mut unsafe_properties = properties.clone();
    unsafe_properties["shared"]["authority"] = json!("write-anywhere");
    assert!(edit(
        &mut app,
        3,
        json!([{"change":"composition_set","presentation":unsafe_properties}])
    )
    .is_err());
    assert_eq!(inspect(&mut app), original);
    let stale = edit(
        &mut app,
        2,
        json!([{"change":"rename","title":"Late Agent response"}]),
    )
    .unwrap();
    assert_eq!(stale["state"], "revision_conflict");
    assert_eq!(inspect(&mut app), original);
}

#[test]
fn saved_scene_is_independent_of_working_draft_through_native_reopen_and_fork() {
    let mut app = setup();
    let mut body = material();
    body["scene"]["name"] = inspect(&mut app)["scenes"][0]["title"].clone();
    body["saved"] = body["scene"].clone();
    body["scene"]["duration"] = json!(75);
    edit(&mut app, 2, json!([{"change":"scene_material_set", "scene_ref":"expression:craft:scene:main", "presentation":body}])).unwrap();
    let original = inspect(&mut app);
    let mut fresh = Application::default();
    let reopened = apply(
        &mut fresh,
        json!({"operation":"open","document":original,"actor":"human:reopen"}),
    )
    .unwrap();
    assert_eq!(
        reopened["document"]["scenes"][0]["presentation"]["saved"]["duration"],
        42
    );
    assert_eq!(
        reopened["document"]["scenes"][0]["presentation"]["scene"]["duration"],
        75
    );
    let fork = apply(&mut app, json!({"operation":"fork","expression_ref":"expression:craft","expected_revision":3,"new_expression_ref":"expression:variant","actor":"human:craft"})).unwrap();
    assert_eq!(
        fork["document"]["scenes"][0]["presentation"]["saved"]["id"],
        "expression:variant:scene:main"
    );
    assert_eq!(
        fork["document"]["scenes"][0]["presentation"]["saved"]["entities"][0]["id"],
        "expression:variant:entity:one"
    );
    let mut wrong = body.clone();
    wrong["saved"]["entities"][0]["id"] = json!("expression:other:entity:private");
    assert!(edit(&mut app, 3, json!([{"change":"scene_material_set","scene_ref":"expression:craft:scene:main","presentation":wrong}])).is_err());
    assert_eq!(inspect(&mut app), original);
}

/// Reuse the existing native Application/material fixture: these are real
/// scene_material_set, CAS, file-codec, fork and entity removal operations.
fn rack_material(app: &mut Application) -> Value {
    let mut body = material();
    body["scene"]["name"] = inspect(app)["scenes"][0]["title"].clone();
    body["scene"]["parameterRacks"] = json!({
        "schema":"oi.parameter-racks/v1", "racks":[
            {"schema":"oi.parameter-rack/v1", "id":"rack:influence", "title":"Influence expression:craft:entity:one",
             "scope":{"kind":"entity", "entity_ref":"expression:craft:entity:one"},
             "macros":[{"id":"macro:influence", "name":"Influence", "value":0.25, "mappings":[
                 {"id":"map:strength", "target":{"kind":"entity", "entity_ref":"expression:craft:entity:one", "path":"forces.strength"}, "min":-2.0, "max":4.0, "unit":"scalar", "law":"linear"},
                 {"id":"map:radius", "target":{"kind":"entity", "entity_ref":"expression:craft:entity:one", "path":"forces.radius"}, "min":20.0, "max":2000.0, "unit":"px", "law":"log"}
             ]}], "excluded":[], "variations":[{"id":"variation:quiet", "name":"Quiet", "values":{"macro:influence":0.25}, "excluded":["macro:influence"]}]},
            {"schema":"oi.parameter-rack/v1", "id":"rack:field", "title":"Medium", "scope":{"kind":"field"},
             "macros":[{"id":"macro:pressure", "name":"Pressure", "value":0.5, "mappings":[
                 {"id":"map:pressure", "target":{"kind":"field", "path":"medium.pressure"}, "min":0.0, "max":20.0, "unit":"scalar", "law":"linear"}
             ]}], "excluded":[], "variations":[]}
        ]
    });
    body["saved"] = body["scene"].clone();
    body["scene"]["parameterRacks"]["racks"][0]["macros"][0]["value"] = json!(0.75);
    body
}

#[test]
fn native_racks_working_saved_material_roundtrips_and_stale_cas_keeps_source() {
    let mut app = setup();
    let body = rack_material(&mut app);
    edit(&mut app, 2, json!([{"change":"scene_material_set", "scene_ref":"expression:craft:scene:main", "presentation":body}])).unwrap();
    let original = inspect(&mut app);
    assert_eq!(original["revision"], 3);
    assert_eq!(original["scenes"][0]["presentation"], body);
    assert_ne!(
        body["scene"]["parameterRacks"],
        body["saved"]["parameterRacks"]
    );
    let document: oi_cradle_kernel::expression::Document =
        serde_json::from_value(original.clone()).unwrap();
    document.validate().unwrap();
    let bytes = oi_cradle_kernel::expression_file::encode(&document).unwrap();
    let decoded = oi_cradle_kernel::expression_file::decode(&bytes).unwrap();
    assert_eq!(decoded, document);
    let mut fresh = Application::default();
    let reopened = apply(&mut fresh, json!({"operation":"open", "document":serde_json::to_value(decoded).unwrap(), "actor":"human:rack-reopen"})).unwrap();
    assert_eq!(reopened["document"], original);
    let mut late = body.clone();
    late["scene"]["parameterRacks"]["racks"][0]["macros"][0]["value"] = json!(0.1);
    let refusal = edit(&mut app, 2, json!([{"change":"scene_material_set", "scene_ref":"expression:craft:scene:main", "presentation":late}])).unwrap();
    assert_eq!(refusal["state"], "revision_conflict");
    assert_eq!(inspect(&mut app), original);
}

#[test]
fn native_scene_admission_rejects_malformed_racks_in_working_and_saved_atomically() {
    let mut app = setup();
    let body = rack_material(&mut app);
    edit(&mut app, 2, json!([{"change":"scene_material_set", "scene_ref":"expression:craft:scene:main", "presentation":body}])).unwrap();
    let original = inspect(&mut app);
    for carrier in ["scene", "saved"] {
        for defect in [
            "schema",
            "path",
            "unit",
            "bound",
            "log",
            "scope",
            "duplicate",
            "variation",
            "integer",
        ] {
            let mut wrong = body.clone();
            let state = &mut wrong[carrier]["parameterRacks"];
            let rack = &mut state["racks"][0];
            match defect {
                "schema" => state["schema"] = json!("unadmitted"),
                "path" => {
                    rack["macros"][0]["mappings"][0]["target"]["path"] = json!("forces.unknown")
                }
                "unit" => rack["macros"][0]["mappings"][1]["unit"] = json!("stage units"),
                "bound" => rack["macros"][0]["mappings"][0]["max"] = json!(1001.0),
                "log" => rack["macros"][0]["mappings"][0]["law"] = json!("log"),
                "scope" => rack["scope"]["entity_ref"] = json!("expression:other:entity:private"),
                "duplicate" => {
                    let duplicate = rack["macros"][0].clone();
                    rack["macros"].as_array_mut().unwrap().push(duplicate);
                }
                "variation" => rack["variations"][0]["values"] = json!({}),
                _ => {
                    let mapping = &mut rack["macros"][0]["mappings"][0];
                    mapping["target"] = json!({"kind":"field", "path":"medium.gridRes"});
                    mapping["min"] = json!(16.5);
                    mapping["max"] = json!(128.0);
                    rack["scope"] = json!({"kind":"field"});
                    rack["macros"][0]["mappings"]
                        .as_array_mut()
                        .unwrap()
                        .truncate(1);
                }
            }
            let result = edit(
                &mut app,
                3,
                json!([{"change":"scene_material_set", "scene_ref":"expression:craft:scene:main", "presentation":wrong}]),
            );
            assert!(
                result.is_err(),
                "{carrier} {defect} must be refused by native Scene admission"
            );
            assert_eq!(
                inspect(&mut app),
                original,
                "{carrier} {defect} must preserve the exact native source"
            );
        }
    }
}

#[test]
fn native_rack_fork_remaps_only_occurrence_refs_in_working_and_saved_material() {
    let mut app = setup();
    let body = rack_material(&mut app);
    edit(&mut app, 2, json!([{"change":"scene_material_set", "scene_ref":"expression:craft:scene:main", "presentation":body}])).unwrap();
    let original = inspect(&mut app);
    let fork = apply(&mut app, json!({"operation":"fork", "expression_ref":"expression:craft", "expected_revision":3, "new_expression_ref":"expression:rack-variant", "actor":"human:rack-fork"})).unwrap();
    let document: oi_cradle_kernel::expression::Document =
        serde_json::from_value(fork["document"].clone()).unwrap();
    document.validate().unwrap();
    for carrier in ["scene", "saved"] {
        let racks =
            &fork["document"]["scenes"][0]["presentation"][carrier]["parameterRacks"]["racks"];
        let entity = &racks[0];
        assert_eq!(
            entity["scope"]["entity_ref"],
            "expression:rack-variant:entity:one"
        );
        for mapping in entity["macros"][0]["mappings"].as_array().unwrap() {
            assert_eq!(
                mapping["target"]["entity_ref"],
                "expression:rack-variant:entity:one"
            );
        }
        let mut expected = body[carrier]["parameterRacks"]["racks"][0].clone();
        expected["scope"]["entity_ref"] = json!("expression:rack-variant:entity:one");
        for mapping in expected["macros"][0]["mappings"].as_array_mut().unwrap() {
            mapping["target"]["entity_ref"] = json!("expression:rack-variant:entity:one");
        }
        assert_eq!(
            *entity, expected,
            "IDs, captions, native paths, units and captured variation values remain exact"
        );
        assert_eq!(
            racks[1], body[carrier]["parameterRacks"]["racks"][1],
            "Field rack has no occurrence refs to remap"
        );
    }
    assert_eq!(
        inspect(&mut app),
        original,
        "fork does not mutate its source Expression"
    );
}

#[test]
fn native_entity_removal_retires_its_racks_in_both_materials_and_preserves_field_racks() {
    let mut app = setup();
    let body = rack_material(&mut app);
    edit(&mut app, 2, json!([{"change":"scene_material_set", "scene_ref":"expression:craft:scene:main", "presentation":body}])).unwrap();
    edit(
        &mut app,
        3,
        json!([{"change":"entity_remove", "entity_ref":"expression:craft:entity:one"}]),
    )
    .unwrap();
    let document = inspect(&mut app);
    assert_eq!(document["revision"], 4);
    assert!(document["entities"]
        .get("expression:craft:entity:one")
        .is_none());
    for carrier in ["scene", "saved"] {
        let material = &document["scenes"][0]["presentation"][carrier];
        assert_eq!(material["entities"], json!([]));
        assert_eq!(
            material["parameterRacks"]["racks"],
            json!([body[carrier]["parameterRacks"]["racks"][1].clone()])
        );
    }
    serde_json::from_value::<oi_cradle_kernel::expression::Document>(document)
        .unwrap()
        .validate()
        .unwrap();
}

#[test]
fn native_racks_survive_presentation_hide_and_reveal_without_rebinding_membership() {
    let mut app = setup();
    let body = rack_material(&mut app);
    edit(&mut app, 2, json!([{"change":"scene_material_set", "scene_ref":"expression:craft:scene:main", "presentation":body}])).unwrap();
    let original = inspect(&mut app);
    let mut hidden = body.clone();
    hidden["scene"]["entities"] = json!([]);
    edit(&mut app, 3, json!([{"change":"scene_material_set", "scene_ref":"expression:craft:scene:main", "presentation":hidden}])).unwrap();
    let after_hide = inspect(&mut app);
    assert_eq!(
        after_hide["scenes"][0]["entity_refs"],
        original["scenes"][0]["entity_refs"]
    );
    assert_eq!(after_hide["entities"], original["entities"]);
    assert_eq!(
        after_hide["scenes"][0]["presentation"]["scene"]["entities"],
        json!([])
    );
    assert_eq!(
        after_hide["scenes"][0]["presentation"]["scene"]["parameterRacks"],
        body["scene"]["parameterRacks"]
    );
    assert_eq!(
        after_hide["scenes"][0]["presentation"]["saved"]["parameterRacks"],
        body["saved"]["parameterRacks"]
    );
    let mut restarted = Application::default();
    let reopened = apply(
        &mut restarted,
        json!({"operation":"open", "document":after_hide, "actor":"human:rack-hidden-reopen"}),
    )
    .unwrap();
    assert_eq!(reopened["document"], after_hide);
    edit(&mut app, 4, json!([{"change":"scene_material_set", "scene_ref":"expression:craft:scene:main", "presentation":body}])).unwrap();
    let revealed = inspect(&mut app);
    assert_eq!(
        revealed["scenes"][0]["entity_refs"],
        original["scenes"][0]["entity_refs"]
    );
    assert_eq!(
        revealed["scenes"][0]["presentation"],
        original["scenes"][0]["presentation"]
    );
}
