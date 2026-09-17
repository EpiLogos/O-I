//! ES substrate contracts (O:I #352): ES1A scene-body native carriers, ES1B
//! declarative triggers, ES3 profiles/editions/collection index, ES3A asset
//! admission + occurrence index. No second runtime, no copied semantic objects.
use oi_cradle_kernel::{
    expression::{Application, Document, Request},
    CentralClient,
};
use serde_json::{json, Value};

fn request(value: Value) -> Request {
    serde_json::from_value(value).unwrap()
}
fn apply(app: &mut Application, value: Value) -> Value {
    app.apply(&CentralClient::discover(), request(value))
        .unwrap()
        .0
}
fn refused(app: &mut Application, value: Value) -> String {
    app.apply(&CentralClient::discover(), request(value))
        .unwrap_err()
}
fn create(app: &mut Application, expression_ref: &str) -> Value {
    apply(
        app,
        json!({"operation":"create","expression_ref":expression_ref,"title":"Lesson","actor":"human:author"}),
    )
}
fn edit(app: &mut Application, expression_ref: &str, revision: u64, changes: Value) -> Value {
    apply(
        app,
        json!({"operation":"edit","expression_ref":expression_ref,"expected_revision":revision,"actor":"human:author","changes":changes}),
    )
}
fn inspect(app: &mut Application, expression_ref: &str) -> Value {
    apply(
        app,
        json!({"operation":"inspect","expression_ref":expression_ref}),
    )
}

/// The exact native open Action disclosed on a degraded file body.
fn open_action(subject_ref: &str) -> Value {
    json!([{"action_ref":"central.files.read","target_ref":subject_ref,"authority_requirement":"central ordinary file"}])
}

// ——— ES1A: scene-body native carrier relation ————————————————————————

#[test]
fn scene_body_carries_the_exact_native_subject_and_degrades_honestly() {
    let mut app = Application::default();
    create(&mut app, "expression:test");
    // A canonical Markdown/file subject becomes the scene body: exact ref,
    // revision/Reading, provenance, the real native open Action, honest
    // degradation (no renderer admitted) and a preview placement.
    let data = edit(
        &mut app,
        "expression:test",
        1,
        json!([{"change":"scene_body_set","scene_ref":"expression:test:scene:main","body":{
            "carrier":"file_thing",
            "subject_ref":"central:file:lessons/lesson.md",
            "native_owner":"central",
            "reading":{"ref":"central:file:lessons/lesson.md","revision":"r8","availability":"available"},
            "provenance":[{"ref":"central:source:lessons/lesson.md","revision":"r8","availability":"available"}],
            "actions":open_action("central:file:lessons/lesson.md"),
            "presentation":"preview",
            "capability":{"state":"degrades_to_thing","reason":"no inline renderer is admitted for this file type"}
        }}]),
    );
    let body = &data["document"]["scenes"][0]["body"];
    assert_eq!(body["subject_ref"], "central:file:lessons/lesson.md");
    assert_eq!(body["reading"]["revision"], "r8");
    assert_eq!(body["presentation"], "preview");
    assert_eq!(body["capability"]["state"], "degrades_to_thing");
    assert_eq!(body["actions"][0]["action_ref"], "central.files.read");

    // Honest degradation is enforced: a body may not claim a live
    // presentation without an admitted adapter.
    let error = refused(
        &mut app,
        json!({"operation":"edit","expression_ref":"expression:test","expected_revision":2,"actor":"human:author","changes":[
            {"change":"scene_body_set","scene_ref":"expression:test:scene:main","body":{
                "carrier":"file_thing","subject_ref":"central:file:x","native_owner":"central",
                "reading":{"ref":"central:file:x","revision":"r1","availability":"available"},
                "provenance":[],"actions":[],"presentation":"live",
                "capability":{"state":"degrades_to_thing","reason":"no renderer"}}}]}),
    );
    assert!(error.contains("presentation must match disclosed capability"), "{error}");
    // The atomic edit never left a fake live body behind.
    assert_eq!(inspect(&mut app, "expression:test")["document"]["scenes"][0]["body"]["presentation"], "preview");

    // Native carriers keep native subjects: an Expression ref is not a file.
    let error = refused(
        &mut app,
        json!({"operation":"edit","expression_ref":"expression:test","expected_revision":2,"actor":"human:author","changes":[
            {"change":"scene_body_set","scene_ref":"expression:test:scene:main","body":{
                "carrier":"text_source","subject_ref":"expression:other","native_owner":"oi",
                "reading":{"ref":"expression:other","revision":"1","availability":"available"},
                "provenance":[],"actions":[],"presentation":"preview",
                "capability":{"state":"degrades_to_thing","reason":"n/a"}}}]}),
    );
    assert!(error.contains("remain native"), "{error}");

    // The engine-composition body is the Expression's own live composition.
    let error = refused(
        &mut app,
        json!({"operation":"edit","expression_ref":"expression:test","expected_revision":2,"actor":"human:author","changes":[
            {"change":"scene_body_set","scene_ref":"expression:test:scene:main","body":{
                "carrier":"engine_composition","subject_ref":"expression:other","native_owner":"oi",
                "reading":{"ref":"expression:other","revision":"1","availability":"available"},
                "provenance":[],"actions":[],"presentation":"live","capability":{"state":"renderable"}}}]}),
    );
    assert!(error.contains("own composition"), "{error}");

    // Unknown carriers do not exist: they are refused at deserialization.
    assert!(serde_json::from_value::<Request>(json!(
        {"operation":"edit","expression_ref":"expression:test","expected_revision":2,"actor":"human:author","changes":[
            {"change":"scene_body_set","scene_ref":"expression:test:scene:main","body":{
                "carrier":"bespoke_svg_renderer_v9","subject_ref":"central:file:x","native_owner":"central",
                "reading":{"ref":"central:file:x","revision":"r1","availability":"available"},
                "provenance":[],"actions":[],"presentation":"live","capability":{"state":"renderable"}}}]})
    ).is_err());
}

#[test]
fn expression_ref_bodies_stay_under_visible_recursion_limits() {
    let mut app = Application::default();
    create(&mut app, "expression:test");
    edit(
        &mut app,
        "expression:test",
        1,
        json!([{"change":"scene_body_set","scene_ref":"expression:test:scene:main","body":{
            "carrier":"expression_ref","subject_ref":"edition:card-9","native_owner":"oi",
            "reading":{"ref":"edition:card-9","revision":"2","availability":"available"},
            "provenance":[],"actions":[],"presentation":"preview","capability":{"state":"renderable"},
            "recursion":{"host_expression_ref":"expression:test","max_depth":2}}}]),
    );
    let error = refused(
        &mut app,
        json!({"operation":"edit","expression_ref":"expression:test","expected_revision":2,"actor":"human:author","changes":[
            {"change":"scene_body_set","scene_ref":"expression:test:scene:main","body":{
                "carrier":"expression_ref","subject_ref":"expression:other","native_owner":"oi",
                "reading":{"ref":"expression:other","revision":"1","availability":"available"},
                "provenance":[],"actions":[],"presentation":"preview","capability":{"state":"renderable"},
                "recursion":{"host_expression_ref":"expression:other","max_depth":3}}}]}),
    );
    assert!(error.contains("Recursion host"), "{error}");
    let error = refused(
        &mut app,
        json!({"operation":"edit","expression_ref":"expression:test","expected_revision":2,"actor":"human:author","changes":[
            {"change":"scene_body_set","scene_ref":"expression:test:scene:main","body":{
                "carrier":"expression_ref","subject_ref":"expression:other","native_owner":"oi",
                "reading":{"ref":"expression:other","revision":"1","availability":"available"},
                "provenance":[],"actions":[],"presentation":"preview","capability":{"state":"renderable"},
                "recursion":{"host_expression_ref":"expression:test","max_depth":9}}}]}),
    );
    assert!(error.contains("1..=4"), "{error}");
    // Selected spans apply only to text sources.
    let error = refused(
        &mut app,
        json!({"operation":"edit","expression_ref":"expression:test","expected_revision":2,"actor":"human:author","changes":[
            {"change":"scene_body_set","scene_ref":"expression:test:scene:main","body":{
                "carrier":"image_media","subject_ref":"central:file:diagram.png","native_owner":"central",
                "reading":{"ref":"central:file:diagram.png","revision":"r1","availability":"available"},
                "provenance":[],"actions":[],"presentation":"preview","capability":{"state":"renderable"},
                "span":{"start":0,"end":20}}}]}),
    );
    assert!(error.contains("spans apply only to text_source"), "{error}");
}

// ——— ES1B: declarative triggers, never scripts ———————————————————————

#[test]
fn triggers_open_the_exact_native_subject_and_refuse_script_bodies() {
    let mut app = Application::default();
    create(&mut app, "expression:test");
    edit(
        &mut app,
        "expression:test",
        1,
        json!([{"change":"scene_body_set","scene_ref":"expression:test:scene:main","body":{
            "carrier":"file_thing","subject_ref":"central:file:lessons/lesson.md","native_owner":"central",
            "reading":{"ref":"central:file:lessons/lesson.md","revision":"r8","availability":"available"},
            "provenance":[],"actions":open_action("central:file:lessons/lesson.md"),
            "presentation":"preview","capability":{"state":"degrades_to_thing","reason":"no renderer"}}}]),
    );
    // Authored activation opens that exact file in the native Surface.
    let data = edit(
        &mut app,
        "expression:test",
        2,
        json!([{"change":"scene_trigger_attach","scene_ref":"expression:test:scene:main","trigger":{
            "trigger_ref":"expression:test:trigger:open-lesson",
            "occasion":"activate",
            "target":{"kind":"portal","placement":"beside","subject_ref":"central:file:lessons/lesson.md"}}}]),
    );
    assert_eq!(
        data["document"]["scenes"][0]["triggers"][0]["target"]["placement"],
        "beside"
    );
    // A trigger's native Action must be disclosed; the scene body's open
    // Action is disclosed, an undisclosed one is not.
    let error = refused(
        &mut app,
        json!({"operation":"edit","expression_ref":"expression:test","expected_revision":3,"actor":"human:author","changes":[
            {"change":"scene_trigger_attach","scene_ref":"expression:test:scene:main","trigger":{
                "trigger_ref":"expression:test:trigger:rogue","occasion":"activate",
                "target":{"kind":"native_action","action_ref":"central.day.lifecycle","target_ref":"control:root","authority_requirement":"native"}}}]}),
    );
    assert!(error.contains("must be disclosed"), "{error}");
    let error = refused(
        &mut app,
        json!({"operation":"edit","expression_ref":"expression:test","expected_revision":3,"actor":"human:author","changes":[
            {"change":"scene_trigger_attach","scene_ref":"expression:test:scene:main","trigger":{
                "trigger_ref":"expression:test:trigger:nav","occasion":"scene_enter",
                "target":{"kind":"navigate","scene_ref":"expression:test:scene:absent","entity_ref":null}}}]}),
    );
    assert!(error.contains("absent scene"), "{error}");
    // Triggers never mutate documents silently: only read operations.
    let error = refused(
        &mut app,
        json!({"operation":"edit","expression_ref":"expression:test","expected_revision":3,"actor":"human:author","changes":[
            {"change":"scene_trigger_attach","scene_ref":"expression:test:scene:main","trigger":{
                "trigger_ref":"expression:test:trigger:mutate","occasion":"scene_enter",
                "target":{"kind":"expression_operation","operation":"edit","expression_ref":"expression:test"}}}]}),
    );
    assert!(error.contains("limited to"), "{error}");

    // Arbitrary executable script bodies are refused with a typed error.
    // Structurally first: deny_unknown_fields means a script body cannot even
    // enter a document.
    let smuggled = json!({"operation":"edit","expression_ref":"expression:test","expected_revision":3,"actor":"human:author","changes":[
        {"change":"scene_trigger_attach","scene_ref":"expression:test:scene:main","trigger":{
            "trigger_ref":"expression:test:trigger:script","occasion":"activate",
            "script":"window.open('file:///lessons/lesson.md')"}}]});
    assert!(serde_json::from_value::<Request>(smuggled).is_err());
    let raw = json!({"trigger_ref":"t","occasion":"activate","script":"doEvil()"});
    let error = oi_cradle_kernel::expression_trigger::refuse_script_body(&raw).unwrap_err();
    assert!(error.contains("script_body_refused"), "{error}");
    assert!(oi_cradle_kernel::expression_trigger::refuse_script_body(&json!("harmless string")).is_ok());
}

// ——— ES3: profiles, editions and the Library-as-view index ————————————

fn base_profile() -> Value {
    json!({
        "profile_ref":"profile:base","revision":1,"title":"Editorial base",
        "parent_profile_refs":[],
        "accepted_binding_kinds":["text_source","file_thing","engine_composition"],
        "accepted_native_owners":[],
        "material_defaults":{"share":{"value":1,"automation":null},"scale":{"value":1.5,"automation":null}},
        "formation_vocabulary":["plain-line"],
        "target_rules":{"text_source":{"formation":"plain-line","text":"excerpt"}},
        "permitted_parameter_domains":{"scale":{"min":0.5,"max":2}},
        "scene_seeds":[{"role":"opening","title":"Opening"}],
        "fallback_policy":"preview",
        "provenance":[]
    })
}

#[test]
fn profiles_define_lineage_resolution_editions_and_index() {
    let mut app = Application::default();
    let base = base_profile();
    let defined = apply(&mut app, json!({"operation":"profile_define","profile":base,"actor":"human:author"}));
    assert_eq!(defined["state"], "profile");
    // A child profile narrows the grammar; parents must exist first.
    let child = json!({
        "profile_ref":"profile:editorial","revision":1,"title":"Editorial",
        "parent_profile_refs":["profile:base"],
        "accepted_binding_kinds":["text_source"],
        "material_defaults":{"scale":{"value":1.0,"automation":null}},
        "fallback_policy":"capture",
        "provenance":[]
    });
    let defined = apply(&mut app, json!({"operation":"profile_define","profile":child,"actor":"human:author"}));
    // Parents-first resolution: the child inherits share and overrides scale.
    assert_eq!(defined["resolved_defaults"]["share"]["value"], 1);
    assert_eq!(defined["resolved_defaults"]["scale"]["value"], 1.0);
    // An undefined parent is refused.
    let orphan = json!({
        "profile_ref":"profile:orphan","revision":1,"title":"Orphan",
        "parent_profile_refs":["profile:ghost"],"accepted_binding_kinds":["text_source"],"provenance":[]
    });
    let error = refused(&mut app, json!({"operation":"profile_define","profile":orphan,"actor":"human:author"}));
    assert!(error.contains("not defined"), "{error}");
    // Profile resolution against ordinary subject kinds.
    let resolved = apply(
        &mut app,
        json!({"operation":"profile_resolve","native_owner":"central","carrier":"text_source"}),
    );
    assert_eq!(resolved["state"], "resolved");
    assert_eq!(resolved["profile_ref"], "profile:base"); // deterministic first admitting profile
    let unresolved = apply(
        &mut app,
        json!({"operation":"profile_resolve","native_owner":"central","carrier":"agent_surface"}),
    );
    assert_eq!(unresolved["state"], "unresolved");

    // An Expression instantiates a profile with explicit, legible overrides.
    create(&mut app, "expression:lesson");
    let data = edit(
        &mut app,
        "expression:lesson",
        1,
        json!([{"change":"profile_adopt","adoption":{"profile_ref":"profile:editorial","revision":1,
            "overridden_parameters":{"scale":{"value":2.0,"automation":null}}}},
            {"change":"collections_set","collections":["library","lessons"]}]),
    );
    assert_eq!(data["document"]["profiles"][0]["profile_ref"], "profile:editorial");
    assert_eq!(data["document"]["profiles"][0]["overridden_parameters"]["scale"]["value"], 2.0);
    assert_eq!(data["document"]["collections"], json!(["library","lessons"]));

    // A portable edition names the open Expression's current revision.
    let edition = json!({
        "edition_ref":"edition:lesson-1","revision":1,"title":"Lesson card",
        "expression_ref":"expression:lesson","expression_revision":2,
        "profile_ref":"profile:editorial","profile_revision":1,
        "subject_refs":["central:file:lessons/lesson.md"],
        "front_representation":{"ref":"representation:live","revision":"2","availability":"available"},
        "captures":[{"ref":"capture:lesson.png","revision":"r1","availability":"available"}],
        "admitted_assets":[{"asset_ref":"asset:lesson-glyph","revision":"r1","digest":"a1b2"}],
        "provenance":[],"digest":"9f86d081884c7d65"
    });
    let mut stale_edition = edition.clone();
    stale_edition["expression_revision"] = json!(1);
    let stale = refused(&mut app, json!({"operation":"edition_create","edition":stale_edition,"actor":"human:author"}));
    assert!(stale.contains("current revision"), "{stale}");
    let created = apply(&mut app, json!({"operation":"edition_create","edition":edition,"actor":"human:author"}));
    assert_eq!(created["state"], "edition");
    assert_eq!(created["expression_opened"], false);
    // Re-opening an edition never opens or rewrites the Expression.
    let opened = apply(&mut app, json!({"operation":"edition_inspect","edition_ref":"edition:lesson-1"}));
    assert_eq!(opened["state"], "edition");
    assert_eq!(opened["expression_opened"], false);
    assert_eq!(inspect(&mut app, "expression:lesson")["document"]["revision"], 2);

    // Library-as-view: one index reading over the same refs the Library reads.
    let index = apply(&mut app, json!({"operation":"index"}));
    assert_eq!(index["schema"], "oi.expression-index/v1");
    let entry = index["expressions"]
        .as_array()
        .unwrap()
        .iter()
        .find(|e| e["expression_ref"] == "expression:lesson")
        .unwrap();
    assert_eq!(entry["collections"], json!(["library","lessons"]));
    assert_eq!(entry["profiles"][0]["profile_ref"], "profile:editorial");
    assert_eq!(index["collections"]["lessons"], json!(["expression:lesson"]));
    assert_eq!(index["editions"][0]["edition_ref"], "edition:lesson-1");
}

#[test]
fn profile_domains_and_automation_stay_inside_the_bounded_vocabulary() {
    let mut app = Application::default();
    let wild = json!({
        "profile_ref":"profile:wild","revision":1,"title":"Wild",
        "accepted_binding_kinds":["text_source"],
        "material_defaults":{"mood":{"value":"dark","automation":null}},
        "permitted_parameter_domains":{"scale":{"min":-10,"max":10}},
        "automation_defaults":{"scale":{"min":0.5,"max":1.5,"rate_hz":0.2,"waveform":"sine"}},
        "provenance":[]
    });
    let error = refused(&mut app, json!({"operation":"profile_define","profile":wild,"actor":"human:author"}));
    // "mood" is outside the bounded parameter vocabulary: unsupported
    // parameters fail closed.
    assert!(error.contains("parameter vocabulary"), "{error}");
    let mut app = Application::default();
    let domain = json!({
        "profile_ref":"profile:tight","revision":1,"title":"Tight",
        "accepted_binding_kinds":["text_source"],
        "permitted_parameter_domains":{"scale":{"min":0.0001,"max":50}},
        "provenance":[]
    });
    let error = refused(&mut app, json!({"operation":"profile_define","profile":domain,"actor":"human:author"}));
    assert!(error.contains("must sit inside"), "{error}");
    let mut app = Application::default();
    let glyph_automation = json!({
        "profile_ref":"profile:glyph-motion","revision":1,"title":"GlyphMotion",
        "accepted_binding_kinds":["text_source"],
        "automation_defaults":{"glyph":{"min":0.0,"max":1.0,"rate_hz":0.2,"waveform":"sine"}},
        "provenance":[]
    });
    let error = refused(&mut app, json!({"operation":"profile_define","profile":glyph_automation,"actor":"human:author"}));
    assert!(error.contains("numeric parameters"), "{error}");
}

// ——— ES3A: asset admission + occurrence index ————————————————————————

fn asset(occurrences: Value) -> Value {
    json!({
        "asset_ref":"asset:lesson-glyph","revision":"r1","digest":"a1b2c3d4e5f6a7b8",
        "kind":"glyph",
        "source":{"ref":"central:file:assets/lesson-glyph.svg","revision":"r4","availability":"available"},
        "rights":[{"ref":"rights:cc-by-4.0","revision":"1","availability":"available"}],
        "subject_refs":["central:file:lessons/lesson.md"],
        "tags":["lesson","opening"],
        "profile_roles":["editorial"],
        "fallback":{"ref":"central:file:assets/lesson-glyph.png","revision":"r2","availability":"available"},
        "family_refs":[],
        "occurrences":occurrences
    })
}

#[test]
fn assets_index_real_use_and_never_pre_decide_it() {
    let mut app = Application::default();
    // Occurrences record real use: the Expression must be open.
    create(&mut app, "expression:one");
    create(&mut app, "expression:two");
    let error = refused(
        &mut app,
        json!({"operation":"asset_admit","asset":asset(json!([
            {"expression_ref":"expression:ghost","scene_ref":null,"profile_ref":null,"witnessed_by":"human:a","accepted":true}
        ])),"actor":"human:a"}),
    );
    assert!(error.contains("not open"), "{error}");
    // The same asset ref used in two real Expressions: exact provenance and
    // both occurrences disclosed to later work.
    let admitted = apply(
        &mut app,
        json!({"operation":"asset_admit","asset":asset(json!([
            {"expression_ref":"expression:one","scene_ref":"expression:one:scene:main","profile_ref":null,"witnessed_by":"human:a","accepted":true}
        ])),"actor":"human:a"}),
    );
    assert_eq!(admitted["state"], "admitted");
    assert_eq!(admitted["new_occurrences"], 1);
    let readmitted = apply(
        &mut app,
        json!({"operation":"asset_admit","asset":asset(json!([
            {"expression_ref":"expression:two","scene_ref":"expression:two:scene:main","profile_ref":null,"witnessed_by":"human:b","accepted":false}
        ])),"actor":"human:b"}),
    );
    assert_eq!(readmitted["new_occurrences"], 1);
    let traversal = apply(&mut app, json!({"operation":"asset_traverse","asset_ref":"asset:lesson-glyph"}));
    assert_eq!(traversal["state"], "asset");
    assert_eq!(traversal["readings"].as_array().unwrap().len(), 1);
    let reading = &traversal["readings"][0];
    assert_eq!(reading["asset"]["rights"][0]["ref"], "rights:cc-by-4.0");
    assert_eq!(reading["occurrences"].as_array().unwrap().len(), 2);
    assert_eq!(reading["occurrences"][0]["expression_revision"], 1);
    assert_eq!(reading["occurrences"][0]["accepted"], true);
    assert_eq!(reading["occurrences"][1]["witnessed_by"], "human:b");
    assert_eq!(reading["occurrences"][1]["accepted"], false);
    // The same ref with a different digest is a different claim, refused.
    let mut forged = asset(json!([]));
    forged["digest"] = json!("ffffffffffffffff");
    let error = refused(&mut app, json!({"operation":"asset_admit","asset":forged,"actor":"human:a"}));
    assert!(error.contains("different kind, source or digest"), "{error}");
    // subject/ref → available visual assets → every occurrence.
    let by_subject = apply(
        &mut app,
        json!({"operation":"asset_subject","subject_ref":"central:file:lessons/lesson.md"}),
    );
    assert_eq!(by_subject["state"], "asset_subjects");
    assert_eq!(by_subject["assets"].as_array().unwrap().len(), 1);
    assert_eq!(by_subject["assets"][0]["occurrences"].as_array().unwrap().len(), 2);
    let none = apply(
        &mut app,
        json!({"operation":"asset_subject","subject_ref":"central:file:other.md"}),
    );
    assert_eq!(none["assets"].as_array().unwrap().len(), 0);
}

// ——— Atomicity covers the new changes —————————————————————————————————

#[test]
fn substrate_edits_are_atomic_and_fork_remaps_local_refs_only() {
    let mut app = Application::default();
    create(&mut app, "expression:test");
    edit(
        &mut app,
        "expression:test",
        1,
        json!([{"change":"scene_body_set","scene_ref":"expression:test:scene:main","body":{
            "carrier":"file_thing","subject_ref":"central:file:lessons/lesson.md","native_owner":"central",
            "reading":{"ref":"central:file:lessons/lesson.md","revision":"r8","availability":"available"},
            "provenance":[],"actions":open_action("central:file:lessons/lesson.md"),
            "presentation":"preview","capability":{"state":"degrades_to_thing","reason":"no renderer"}}}]),
    );
    // A batch whose trigger attachment is invalid leaves the whole edit
    // unapplied: the collection tag must not survive either.
    let error = refused(
        &mut app,
        json!({"operation":"edit","expression_ref":"expression:test","expected_revision":2,"actor":"human:author","changes":[
            {"change":"collections_set","collections":["keepout"]},
            {"change":"scene_trigger_attach","scene_ref":"expression:test:scene:main","trigger":{
                "trigger_ref":"expression:test:trigger:x","occasion":"activate",
                "target":{"kind":"navigate","scene_ref":"expression:test:scene:absent","entity_ref":null}}}]}),
    );
    assert!(error.contains("absent scene"), "{error}");
    let document = inspect(&mut app, "expression:test")["document"].clone();
    assert_eq!(document["collections"], json!([]));
    assert_eq!(document["revision"], 2);

    // Fork remaps Expression-local refs (triggers, recursion hosts) and keeps
    // native subjects/Actions and collection membership exact.
    edit(
        &mut app,
        "expression:test",
        2,
        json!([{"change":"scene_trigger_attach","scene_ref":"expression:test:scene:main","trigger":{
            "trigger_ref":"expression:test:trigger:open","occasion":"activate",
            "target":{"kind":"native_action","action_ref":"central.files.read","target_ref":"central:file:lessons/lesson.md","authority_requirement":"central ordinary file"}}},
            {"change":"collections_set","collections":["library"]}]),
    );
    let fork = apply(
        &mut app,
        json!({"operation":"fork","expression_ref":"expression:test","expected_revision":3,"new_expression_ref":"expression:fork","actor":"human:author"}),
    );
    let scene = &fork["document"]["scenes"][0];
    assert_eq!(scene["body"]["subject_ref"], "central:file:lessons/lesson.md");
    assert_eq!(scene["triggers"][0]["trigger_ref"], "expression:fork:trigger:open");
    assert_eq!(
        scene["triggers"][0]["target"]["target_ref"],
        "central:file:lessons/lesson.md"
    );
    assert_eq!(fork["document"]["collections"], json!(["library"]));
    // Export → reopen keeps the whole substrate state byte-exact.
    let export = apply(
        &mut app,
        json!({"operation":"export","expression_ref":"expression:test","expected_revision":3}),
    );
    let mut fresh = Application::default();
    let reopened = fresh
        .apply(
            &CentralClient::discover(),
            request(json!({"operation":"open","document":export["document"],"actor":"human:author"})),
        )
        .unwrap()
        .0;
    assert_eq!(reopened["document"], export["document"]);
    let parsed: Document = serde_json::from_value(export["document"].clone()).unwrap();
    assert!(parsed.validate().is_ok());
}
