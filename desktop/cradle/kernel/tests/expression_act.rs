//! The mode-spanning expressive act over the real kernel (contract
//! docs/contracts/EXPRESSION-ACT-MATERIAL-V1.md §1, §3, §4): reusable
//! material documents, role grafting of two distinct characters, object-local
//! states and gestures, text roles, continuation across modes, completion,
//! timeline seek/replay, durable persistence across a fresh kernel, and the
//! fail-closed refusals. Material is addressed as open Expressions here (the
//! Central-file route shares every step after reading the document).
use oi_cradle_kernel::{Kernel, KernelOp, KernelOpResult};
use serde_json::{json, Value};

const RUN: &str = "expression:run";

#[test]
fn performed_editions_replay_after_restart_without_repeating_native_operations() {
    let home = std::env::temp_dir().join(format!(
        "oi-act-edition-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    let mut first = kernel();
    first.attach_act_store(&home).unwrap();
    expression(&mut first, json!({"operation":"create","expression_ref":RUN,"title":"Two participants","actor":"human:ann"})).unwrap();
    let scene_title = doc(&mut first, RUN)["scenes"][0]["title"]
        .as_str()
        .unwrap()
        .to_owned();
    let body = presentation(
        &format!("{RUN}:scene:main"),
        &scene_title,
        json!([
            {"id":format!("{RUN}:entity:ann"),"kind":"formation","name":"Ann","text":"A","shape":"text","position":{"x":-1,"y":0,"z":0}},
            {"id":format!("{RUN}:entity:bea"),"kind":"formation","name":"Bea","text":"B","shape":"text","position":{"x":1,"y":0,"z":0}}
        ]),
        json!([]),
    );
    let performed = world(&mut first, json!({"operation":"act_perform","act_ref":"act:edition","expression_ref":RUN,"expected_revision":1,"actor":"human:ann","summary":"Both participants","activity_ref":"agent-session/direct:retained","changes":[
        {"change":"entity_add","scene_ref":format!("{RUN}:scene:main"),"entity_ref":format!("{RUN}:entity:ann"),"title":"Ann"},
        {"change":"entity_add","scene_ref":format!("{RUN}:scene:main"),"entity_ref":format!("{RUN}:entity:bea"),"title":"Bea"},
        {"change":"scene_material_set","scene_ref":format!("{RUN}:scene:main"),"presentation":body}
    ]})).unwrap();
    assert_eq!(performed["act"]["sequence"][0]["kind"], "edition");
    let present = doc(&mut first, RUN)["scenes"][0]["presentation"].clone();
    world(&mut first, json!({"operation":"act_operate","act_ref":"act:edition","actor":"human:ann","operation_kind":"central.receiving.include","native_ref":"central:return:retained","summary":"Already included; observation only"})).unwrap();
    world(
        &mut first,
        json!({"operation":"act_interrupt","act_ref":"act:edition","actor":"human:ann"}),
    )
    .unwrap();
    let mut removed = present.clone();
    removed["scene"]["entities"][1]["enabled"] = json!(false);
    let revision = doc(&mut first, RUN)["revision"].clone();
    world(&mut first, json!({"operation":"act_perform","act_ref":"act:edition","expression_ref":RUN,"expected_revision":revision,"actor":"human:ann","summary":"Remove required body","changes":[{"change":"scene_material_set","scene_ref":format!("{RUN}:scene:main"),"presentation":removed}]})).unwrap();
    let retained = doc(&mut first, RUN);
    drop(first);
    let mut fresh = kernel();
    fresh.attach_act_store(&home).unwrap();
    expression(
        &mut fresh,
        json!({"operation":"open","document":retained,"actor":"human:ann"}),
    )
    .unwrap();
    let before = doc(&mut fresh, RUN)["revision"].as_u64().unwrap();
    let back = world(
        &mut fresh,
        json!({"operation":"act_seek","act_ref":"act:edition","actor":"human:ann","position":0}),
    )
    .unwrap();
    assert_eq!(back["state"], "act_sought");
    assert_eq!(doc(&mut fresh, RUN)["scenes"][0]["presentation"], present);
    assert!(doc(&mut fresh, RUN)["revision"].as_u64().unwrap() > before);
    let before_operation = doc(&mut fresh, RUN);
    let operation = world(
        &mut fresh,
        json!({"operation":"act_seek","act_ref":"act:edition","actor":"human:ann","position":1}),
    )
    .unwrap();
    assert_eq!(operation["performed"], false);
    assert_eq!(
        doc(&mut fresh, RUN),
        before_operation,
        "An operation receipt must not repeat a native effect"
    );
    let forward = world(
        &mut fresh,
        json!({"operation":"act_seek","act_ref":"act:edition","actor":"human:ann","position":2}),
    )
    .unwrap();
    assert_eq!(forward["state"], "act_sought");
    assert_eq!(doc(&mut fresh, RUN)["scenes"][0]["presentation"], removed);
    assert_eq!(forward["act"]["sequence"].as_array().unwrap().len(), 3);
    std::fs::remove_dir_all(home).unwrap();
}

fn kernel() -> Kernel {
    Kernel::new(oi_cradle_kernel::flow::CentralClient::with(
        "/nonexistent/oi".into(),
        None,
        String::new(),
    ))
}

fn expression(k: &mut Kernel, request: Value) -> Result<Value, String> {
    let outcome = k.apply(KernelOp::Expression {
        request: serde_json::from_value(request).map_err(|e| e.to_string())?,
    })?;
    match outcome.result {
        KernelOpResult::Expression { data } => Ok(data),
        other => panic!("expression outcome expected, got {other:?}"),
    }
}

fn world(k: &mut Kernel, request: Value) -> Result<Value, String> {
    let outcome = k.apply(KernelOp::ExpressionWorld {
        request: serde_json::from_value(request).map_err(|e| e.to_string())?,
    })?;
    match outcome.result {
        KernelOpResult::ExpressionWorld { data } => Ok(data),
        other => panic!("expression_world outcome expected, got {other:?}"),
    }
}

fn doc(k: &mut Kernel, r: &str) -> Value {
    expression(k, json!({"operation":"inspect","expression_ref":r})).unwrap()["document"].clone()
}

fn edit(k: &mut Kernel, r: &str, changes: Value) -> Value {
    let revision = doc(k, r)["revision"].as_u64().unwrap();
    let data = expression(k, json!({"operation":"edit","expression_ref":r,"expected_revision":revision,"actor":"human:author","changes":changes})).unwrap();
    assert_eq!(data["state"], "ready", "{data}");
    data
}

fn presentation(scene_ref: &str, name: &str, entities: Value, text: Value) -> Value {
    json!({"schema":"oi.journey-scene/v1","scene":{
        "id":scene_ref,"name":name,"character":"act test","duration":6,"transition":1.5,
        "view":{"mode":"2d","yaw":0,"pitch":0,"zoom":1,"panX":0,"panY":0},
        "field":{"background":"#fafafa","palette":["#111111"],"material":"ink","params":{}},
        "engine":{"morphEnabled":false},"morph":{"thetaRate":0.1},"composition":{"layout":"free","plane":"XY"},
        "entities":entities,"text":text,"automation":[]
    }})
}

/// A character: one `self` body in states idle/speaking and a nod gesture.
fn character(k: &mut Kernel, name: &str, glyph: &str, tint: &str) {
    let r = format!("expression:{name}");
    let body = format!("{r}:entity:body");
    expression(
        k,
        json!({"operation":"create","expression_ref":r,"title":name,"actor":"human:author"}),
    )
    .unwrap();
    let scenes = [
        ("idle", glyph.to_owned(), 1.0),
        ("speaking", format!("{glyph}!"), 1.4),
        ("nod", glyph.to_owned(), 1.0),
    ];
    let mut changes = vec![
        json!({"change":"entity_add","scene_ref":format!("{r}:scene:main"),"entity_ref":body,"title":"Body"}),
    ];
    for (scene, _, _) in &scenes {
        changes.push(
            json!({"change":"scene_create","scene_ref":format!("{r}:scene:{scene}"),"title":scene}),
        );
        changes.push(json!({"change":"scene_compose","scene_ref":format!("{r}:scene:{scene}"),"entity_refs":[body]}));
    }
    edit(k, &r, json!(changes));
    let mut changes = vec![];
    for (scene, text, scale) in &scenes {
        let mut entity = json!({"id":body,"kind":"formation","role":"self","name":name,"text":text,"shape":"text",
            "tint":tint,"scale":scale,"position":{"x":0,"y":0,"z":0},"rotation":0});
        if *scene == "nod" {
            entity["sequence"] = json!({"enabled":true,"clock":"seconds","steps":[{"text":glyph},{"text":"·"}],"transition":0.4});
        }
        let scene_ref = format!("{r}:scene:{scene}");
        changes.push(json!({"change":"scene_material_set","scene_ref":scene_ref,"presentation":presentation(&scene_ref, scene, json!([entity]), json!([]))}));
    }
    changes.push(json!({"change":"reuse_set","reuse":{"schema":"oi.expression-reuse/v1","kind":"character","title":name,
        "roles":[{"role":"self","accepts":"agent","entity_ref":body}],
        "states":{"idle":format!("{r}:scene:idle"),"speaking":format!("{r}:scene:speaking")},
        "gestures":{"nod":{"scene_ref":format!("{r}:scene:nod"),"role":"self"}},
        "preview_state":"idle","authored_by":"person:author"}}));
    edit(k, &r, json!(changes));
}

/// The reusable handoff Scene: sender / recipient / caption, an unroled
/// artifact, and a second "return" Scene.
fn handoff(k: &mut Kernel) {
    let r = "expression:handoff";
    expression(
        k,
        json!({"operation":"create","expression_ref":r,"title":"Handoff","actor":"human:author"}),
    )
    .unwrap();
    let main = format!("{r}:scene:main");
    let back = format!("{r}:scene:return");
    let (s, t, a) = (
        format!("{r}:entity:sender"),
        format!("{r}:entity:recipient"),
        format!("{r}:entity:artifact"),
    );
    edit(
        k,
        r,
        json!([
            {"change":"entity_add","scene_ref":main,"entity_ref":s,"title":"Sender"},
            {"change":"entity_add","scene_ref":main,"entity_ref":t,"title":"Recipient"},
            {"change":"entity_add","scene_ref":main,"entity_ref":a,"title":"Artifact"},
            {"change":"scene_create","scene_ref":back,"title":"Return"},
            {"change":"scene_compose","scene_ref":back,"entity_refs":[s,t,a]},
        ]),
    );
    let entities = |sender_x: f64| {
        json!([
            {"id":s,"kind":"formation","role":"sender","name":"Sender","text":"?","shape":"text","position":{"x":sender_x,"y":0,"z":0},"rotation":10},
            {"id":t,"kind":"formation","role":"recipient","name":"Recipient","text":"?","shape":"text","position":{"x":0.5,"y":0,"z":0},"rotation":0,"overrides":{"scale":2}},
            {"id":a,"kind":"pin","name":"Draft","text":"◇","shape":"text","position":{"x":0,"y":0.2,"z":0},"rotation":0}
        ])
    };
    edit(
        k,
        r,
        json!([
            {"change":"scene_material_set","scene_ref":main,"presentation":presentation(&main,"Main",entities(-0.5),json!([{"id":"t-caption","role":"caption","body":"…"},{"id":"t-result","role":"resultText","body":""}]))},
            {"change":"scene_material_set","scene_ref":back,"presentation":presentation(&back,"Return",entities(0.4),json!([{"id":"t-caption","role":"caption","body":"Returned"}]))},
            {"change":"reuse_set","reuse":{"schema":"oi.expression-reuse/v1","kind":"scene","title":"Handoff",
                "roles":[{"role":"sender","accepts":"agent","entity_ref":s},{"role":"recipient","accepts":"agent","entity_ref":t},{"role":"caption","accepts":"text","text_id":"t-caption"}],
                "entry_scene_ref":main,"playback":[main,back],
                "associations":{"workflow_keys":["handoff"],"event_families":["agent-message"]}}},
        ]),
    );
}

fn setup() -> Kernel {
    let mut k = kernel();
    character(&mut k, "nous", "N", "#aa0000");
    character(&mut k, "logos", "L", "#0000aa");
    handoff(&mut k);
    expression(
        &mut k,
        json!({"operation":"create","expression_ref":RUN,"title":"Run","actor":"human:author"}),
    )
    .unwrap();
    k
}

fn open_act(k: &mut Kernel, act: &str) -> Value {
    let data = world(k, json!({"operation":"act_open","act_ref":act,"expression_ref":RUN,"mode":"factory","actor":"agent:factory",
        "summary":"Draft handoff","subject_ref":"goal:draft","instrument_ref":"factory:attempt:1",
        "cast":[{"role":"sender","participant_ref":"agent:nous","character_ref":"expression:nous"},
                {"role":"recipient","participant_ref":"agent:logos","character_ref":"expression:logos"}],
        "bindings":{"sender":{"kind":"agent","agent_ref":"agent:nous","character_ref":"expression:nous","state":"speaking","label":"Nous"},
                    "recipient":{"kind":"agent","agent_ref":"agent:logos","character_ref":"expression:logos","label":"Logos"}}})).unwrap();
    assert_eq!(data["state"], "act_opened", "{data}");
    data
}

fn select_handoff(k: &mut Kernel, act: &str, scene: &str) -> Value {
    let data = world(k, json!({"operation":"act_select","act_ref":act,"actor":"agent:factory",
        "material":{"expression_ref":"expression:handoff","scene_ref":scene},
        "captions":{"caption":"Handing the draft to Logos"},
        "transition":{"duration":1.2,"easing":"smoothstep"},
        "event_basis":{"family":"agent-message","source":"aikit-encounter","event_ref":"encounter:1","occurrence":0}})).unwrap();
    assert_eq!(data["state"], "act_performed", "{data}");
    data
}

fn current_material(k: &mut Kernel) -> Value {
    let d = doc(k, RUN);
    let selected = d["selection"]["scene_ref"].clone();
    d["scenes"]
        .as_array()
        .unwrap()
        .iter()
        .find(|s| s["scene_ref"] == selected)
        .unwrap()["presentation"]
        .clone()
}

fn role<'a>(p: &'a Value, role: &str) -> &'a Value {
    p["scene"]["entities"]
        .as_array()
        .unwrap()
        .iter()
        .find(|e| e["role"] == role)
        .unwrap_or_else(|| panic!("no {role} in {p}"))
}

#[test]
fn two_characters_bound_into_sender_and_recipient_keep_distinct_material() {
    let mut k = setup();
    open_act(&mut k, "act:handoff");
    let data = select_handoff(&mut k, "act:handoff", "main");
    assert_eq!(data["passage"]["kind"], "scene");
    assert_eq!(
        data["passage"]["revision"],
        doc(&mut k, "expression:handoff")["revision"].to_string()
    );
    let p = current_material(&mut k);
    let (sender, recipient) = (role(&p, "sender"), role(&p, "recipient"));
    // Nous in its speaking state; Logos in its preview (idle) state.
    assert_eq!(sender["text"], "N!");
    assert_eq!(sender["tint"], "#aa0000");
    assert_eq!(sender["scale"], 1.4);
    assert_eq!(recipient["text"], "L");
    assert_eq!(recipient["tint"], "#0000aa");
    // Placement kept; overrides applied last; labels named.
    assert_eq!(sender["position"]["x"], -0.5);
    assert_eq!(sender["rotation"], 10);
    assert_eq!(recipient["scale"], 2, "placeholder overrides apply last");
    assert_eq!(sender["name"], "Nous");
    assert_eq!(recipient["name"], "Logos");
    assert_ne!(sender["id"], recipient["id"]);
    // The unroled artifact keeps its authored material under a target ref.
    let artifact = p["scene"]["entities"]
        .as_array()
        .unwrap()
        .iter()
        .find(|e| e["name"] == "Draft")
        .unwrap();
    assert_eq!(artifact["text"], "◇");
    assert!(artifact["id"]
        .as_str()
        .unwrap()
        .starts_with("expression:run:entity:"));
    // Text role filled from the caption.
    assert_eq!(p["scene"]["text"][0]["body"], "Handing the draft to Logos");
    // Every presented occupant is a real entity of the live Expression.
    let d = doc(&mut k, RUN);
    for e in p["scene"]["entities"].as_array().unwrap() {
        assert!(d["entities"][e["id"].as_str().unwrap()].is_object(), "{e}");
    }
    let act = world(
        &mut k,
        json!({"operation":"act_inspect","act_ref":"act:handoff"}),
    )
    .unwrap()["act"]
        .clone();
    assert_eq!(act["role_entities"]["sender"], sender["id"]);
    assert_eq!(act["material"]["expression_ref"], "expression:handoff");
    assert_eq!(act["position"], 0);
}

#[test]
fn object_local_state_and_gesture_change_one_occupant_while_the_scene_continues() {
    let mut k = setup();
    open_act(&mut k, "act:local");
    select_handoff(&mut k, "act:local", "main");
    let before = current_material(&mut k);
    let data = world(&mut k, json!({"operation":"act_select","act_ref":"act:local","actor":"agent:factory","role":"sender","state":"idle"})).unwrap();
    assert_eq!(data["passage"]["kind"], "state", "{data}");
    let after = current_material(&mut k);
    assert_eq!(role(&after, "sender")["text"], "N");
    assert_eq!(
        role(&after, "sender")["name"],
        "Nous",
        "the occupant keeps its label"
    );
    assert_eq!(
        role(&after, "sender")["position"],
        role(&before, "sender")["position"]
    );
    assert_eq!(
        role(&after, "recipient"),
        role(&before, "recipient"),
        "other occupants continue"
    );
    assert_eq!(after["scene"]["text"], before["scene"]["text"]);
    let data = world(&mut k, json!({"operation":"act_gesture","act_ref":"act:local","actor":"agent:factory","gesture":"nod","role":"sender",
        "event_basis":{"family":"skill-invocation","source":"factory-attempt","event_ref":"attempt:1:op:3","occurrence":"2"}})).unwrap();
    assert_eq!(data["passage"]["kind"], "gesture", "{data}");
    let gestured = current_material(&mut k);
    assert_eq!(role(&gestured, "sender")["sequence"]["enabled"], true);
    assert_eq!(role(&gestured, "recipient"), role(&before, "recipient"));
    // Text/value roles.
    let data = world(&mut k, json!({"operation":"act_text","act_ref":"act:local","actor":"agent:factory","role":"caption","text":"Logos reviews"})).unwrap();
    assert_eq!(data["presented"], true, "{data}");
    assert_eq!(
        current_material(&mut k)["scene"]["text"][0]["body"],
        "Logos reviews"
    );
    let data = world(&mut k, json!({"operation":"act_text","act_ref":"act:local","actor":"agent:factory","role":"progress","value":0.4})).unwrap();
    assert_eq!(data["presented"], false);
    assert_eq!(data["act"]["bindings"]["progress"]["value"], 0.4);
}

#[test]
fn seek_replays_passages_deterministically_and_refuses_drifted_material() {
    let mut k = setup();
    open_act(&mut k, "act:seek");
    let mut snapshots = vec![];
    select_handoff(&mut k, "act:seek", "main");
    snapshots.push(current_material(&mut k));
    world(&mut k, json!({"operation":"act_gesture","act_ref":"act:seek","actor":"a","gesture":"nod","role":"sender"})).unwrap();
    snapshots.push(current_material(&mut k));
    world(&mut k, json!({"operation":"act_text","act_ref":"act:seek","actor":"a","role":"caption","text":"Reviewing"})).unwrap();
    snapshots.push(current_material(&mut k));
    world(&mut k, json!({"operation":"act_operate","act_ref":"act:seek","actor":"a","operation_kind":"factory.message","native_ref":"message:7"})).unwrap();
    snapshots.push(current_material(&mut k));
    select_handoff(&mut k, "act:seek", "return");
    snapshots.push(current_material(&mut k));
    assert_ne!(snapshots[0], snapshots[4]);
    for position in [1usize, 0, 4, 2, 3, 1] {
        let data = world(&mut k, json!({"operation":"act_seek","act_ref":"act:seek","actor":"human:viewer","position":position})).unwrap();
        assert_eq!(data["state"], "act_sought", "{data}");
        assert_eq!(
            current_material(&mut k),
            snapshots[position],
            "seek to {position} performs the recorded state"
        );
        assert_eq!(data["act"]["position"], position);
        assert_eq!(
            data["act"]["sequence"].as_array().unwrap().len(),
            5,
            "seek appends nothing"
        );
    }
    // Drifted material is refused before anything is performed.
    edit(
        &mut k,
        "expression:handoff",
        json!([{"change":"rename","title":"Handoff v2"}]),
    );
    let before = doc(&mut k, RUN)["revision"].clone();
    let data = world(
        &mut k,
        json!({"operation":"act_seek","act_ref":"act:seek","actor":"human:viewer","position":0}),
    )
    .unwrap();
    assert_eq!(data["state"], "material_revision_changed", "{data}");
    assert_eq!(doc(&mut k, RUN)["revision"], before);
    assert!(world(
        &mut k,
        json!({"operation":"act_seek","act_ref":"act:seek","actor":"h","position":9})
    )
    .is_err());
}

#[test]
fn continuation_keeps_cast_subject_and_selection_and_resume_is_idempotent() {
    let mut k = setup();
    open_act(&mut k, "act:cross");
    world(&mut k, json!({"operation":"act_open","act_ref":"act:cross","expression_ref":RUN,"mode":"factory","actor":"a","selection":"entity:goal"})).unwrap();
    select_handoff(&mut k, "act:cross", "main");
    let data = world(&mut k, json!({"operation":"act_continue","act_ref":"act:cross","actor":"agent:factory","to":"techne","instrument_ref":"techne:constellation:draft"})).unwrap();
    assert_eq!(data["state"], "act_continued", "{data}");
    let act = &data["act"];
    assert_eq!(act["mode"], "techne");
    assert_eq!(
        act["continuations"][0],
        json!({"from":"factory","to":"techne","instrument_ref":"techne:constellation:draft","at":1})
    );
    assert_eq!(act["subject_ref"], "goal:draft");
    assert_eq!(act["selection"], "entity:goal");
    assert_eq!(act["cast"].as_array().unwrap().len(), 2);
    assert_eq!(act["instrument_ref"], "techne:constellation:draft");
    world(&mut k, json!({"operation":"act_operate","act_ref":"act:cross","actor":"agent:aletheia","operation_kind":"techne.develop","native_ref":"techne:op:1"})).unwrap();
    let back = world(
        &mut k,
        json!({"operation":"act_continue","act_ref":"act:cross","actor":"a","to":"factory"}),
    )
    .unwrap();
    assert_eq!(back["act"]["sequence"][2]["mode"], "techne");
    assert_eq!(back["act"]["cast"], act["cast"]);
    // Idempotent resume: an identical open changes nothing; a new member is
    // added once; an existing member is never duplicated.
    let revision = back["act"]["revision"].as_u64().unwrap();
    let same = world(&mut k, json!({"operation":"act_open","act_ref":"act:cross","expression_ref":RUN,"mode":"factory","actor":"a"})).unwrap();
    assert_eq!(same["changed"], false);
    assert_eq!(same["act"]["revision"], revision);
    for _ in 0..2 {
        world(&mut k, json!({"operation":"act_open","act_ref":"act:cross","expression_ref":RUN,"mode":"factory","actor":"a",
            "cast":[{"role":"sender","participant_ref":"agent:nous"},{"role":"reviewer","participant_ref":"agent:aletheia"}]})).unwrap();
    }
    let act = world(
        &mut k,
        json!({"operation":"act_inspect","act_ref":"act:cross"}),
    )
    .unwrap()["act"]
        .clone();
    assert_eq!(act["cast"].as_array().unwrap().len(), 3);
    // Completion: the Return fills the result role; an ended act refuses
    // further performance but still replays.
    let done = world(&mut k, json!({"operation":"act_complete","act_ref":"act:cross","actor":"a","return_ref":"return:1","result":"Draft accepted"})).unwrap();
    assert_eq!(done["state"], "act_completed", "{done}");
    assert_eq!(done["presented"], true);
    assert_eq!(done["act"]["phase"], "completed");
    assert_eq!(done["act"]["return_ref"], "return:1");
    assert!(world(&mut k, json!({"operation":"act_text","act_ref":"act:cross","actor":"a","role":"caption","text":"late"})).is_err());
    assert_eq!(
        world(
            &mut k,
            json!({"operation":"act_seek","act_ref":"act:cross","actor":"h","position":0})
        )
        .unwrap()["state"],
        "act_sought"
    );
}

#[test]
fn stale_revisions_are_refused_without_appending() {
    let mut k = setup();
    open_act(&mut k, "act:stale");
    let current = doc(&mut k, RUN)["revision"].as_u64().unwrap();
    let data = world(&mut k, json!({"operation":"act_select","act_ref":"act:stale","actor":"a","expected_revision":current - 1,
        "material":{"expression_ref":"expression:handoff","scene_ref":"main"}})).unwrap();
    assert_eq!(data["state"], "revision_conflict", "{data}");
    let data = world(&mut k, json!({"operation":"act_select","act_ref":"act:stale","actor":"a","expected_act_revision":99,
        "material":{"expression_ref":"expression:handoff","scene_ref":"main"}})).unwrap();
    assert_eq!(data["state"], "act_revision_conflict", "{data}");
    let pinned = world(
        &mut k,
        json!({"operation":"act_select","act_ref":"act:stale","actor":"a",
        "material":{"expression_ref":"expression:handoff","scene_ref":"main","revision":"1"}}),
    )
    .unwrap();
    assert_eq!(pinned["state"], "material_revision_changed", "{pinned}");
    let act = world(
        &mut k,
        json!({"operation":"act_inspect","act_ref":"act:stale"}),
    )
    .unwrap()["act"]
        .clone();
    assert!(act["sequence"].as_array().unwrap().is_empty());
    assert_eq!(doc(&mut k, RUN)["revision"].as_u64().unwrap(), current);
    let ok = world(&mut k, json!({"operation":"act_select","act_ref":"act:stale","actor":"a","expected_revision":current,"expected_act_revision":act["revision"],
        "material":{"expression_ref":"expression:handoff","scene_ref":"main"}})).unwrap();
    assert_eq!(ok["state"], "act_performed", "{ok}");
}

#[test]
fn gesture_material_revision_is_pinned_before_target_or_durable_act_mutation() {
    let home = temp_home("gesture-material-pin");
    let mut k = setup();
    k.attach_act_store(&home).unwrap();
    open_act(&mut k, "act:gesture-material-pin");
    select_handoff(&mut k, "act:gesture-material-pin", "main");
    let material_revision = doc(&mut k, "expression:nous")["revision"].to_string();
    edit(
        &mut k,
        "expression:nous",
        json!([{"change":"rename","title":"Nous changed after listing"}]),
    );
    let before_target = doc(&mut k, RUN);
    let before_act = world(
        &mut k,
        json!({"operation":"act_inspect","act_ref":"act:gesture-material-pin"}),
    )
    .unwrap()["act"]
        .clone();
    let refused = world(&mut k, json!({"operation":"act_gesture","act_ref":"act:gesture-material-pin","actor":"a","gesture":"nod","role":"sender",
        "expected_revision":before_target["revision"],"expected_act_revision":before_act["revision"],
        "material":{"expression_ref":"expression:nous","revision":material_revision}})).unwrap();
    assert_eq!(refused["state"], "material_revision_changed", "{refused}");
    assert_eq!(refused["material"], "gesture");
    assert_eq!(refused["ref"], "expression:nous");
    assert_eq!(doc(&mut k, RUN), before_target);
    let mut fresh = kernel();
    fresh.attach_act_store(&home).unwrap();
    assert_eq!(
        world(
            &mut fresh,
            json!({"operation":"act_inspect","act_ref":"act:gesture-material-pin"})
        )
        .unwrap()["act"],
        before_act
    );
    let current_revision = doc(&mut k, "expression:nous")["revision"].to_string();
    let accepted = world(&mut k, json!({"operation":"act_gesture","act_ref":"act:gesture-material-pin","actor":"a","gesture":"nod","role":"sender",
        "expected_revision":before_target["revision"],"expected_act_revision":before_act["revision"],
        "material":{"expression_ref":"expression:nous","revision":current_revision}})).unwrap();
    assert_eq!(accepted["state"], "act_performed", "{accepted}");
    assert_eq!(accepted["passage"]["revision"], current_revision);
    assert_eq!(
        accepted["act"]["sequence"].as_array().unwrap().len(),
        before_act["sequence"].as_array().unwrap().len() + 1
    );
    std::fs::remove_dir_all(home).unwrap();
}

#[test]
fn unknown_fields_and_invalid_reuse_fail_closed() {
    let mut k = setup();
    open_act(&mut k, "act:closed");
    assert!(world(&mut k, json!({"operation":"act_select","act_ref":"act:closed","actor":"a","material":{"expression_ref":"expression:handoff"},"surprise":1})).is_err());
    assert!(world(&mut k, json!({"operation":"act_select","act_ref":"act:closed","actor":"a","material":{"expression_ref":"expression:handoff","colour":"red"}})).is_err());
    assert!(world(&mut k, json!({"operation":"act_open","act_ref":"act:x","expression_ref":RUN,"mode":"factory","actor":"a","bindings":{"sender":{"kind":"agent","power":9}}})).is_err());
    assert!(world(&mut k, json!({"operation":"act_open","act_ref":"act:x","expression_ref":RUN,"mode":"elsewhere","actor":"a"})).is_err());
    assert!(world(&mut k, json!({"operation":"act_open","act_ref":"act:x","expression_ref":"expression:absent","mode":"factory","actor":"a"})).is_err(), "an act addresses a live target");
    let revision = doc(&mut k, "expression:handoff")["revision"]
        .as_u64()
        .unwrap();
    for reuse in [
        json!({"schema":"oi.expression-reuse/v1","kind":"scene","title":"T","extra":true}),
        json!({"schema":"oi.expression-reuse/v2","kind":"scene","title":"T"}),
        json!({"schema":"oi.expression-reuse/v1","kind":"prop","title":"T"}),
        json!({"schema":"oi.expression-reuse/v1","kind":"scene","title":"T","entry_scene_ref":"expression:handoff:scene:absent"}),
        json!({"schema":"oi.expression-reuse/v1","kind":"scene","title":"T","roles":[{"role":"sender","accepts":"agent","entity_ref":"expression:handoff:entity:absent"}]}),
        json!({"schema":"oi.expression-reuse/v1","kind":"scene","title":"T","roles":[{"role":"caption","accepts":"text","text_id":"t-absent"}]}),
        json!({"schema":"oi.expression-reuse/v1","kind":"scene","title":"T","roles":[{"role":"bad role","accepts":"agent","entity_ref":"expression:handoff:entity:sender"}]}),
        json!({"schema":"oi.expression-reuse/v1","kind":"character","title":"T","states":{"idle":"expression:handoff:scene:main"},"preview_state":"missing"}),
        json!({"schema":"oi.expression-reuse/v1","kind":"scene","title":"T","playback":vec!["expression:handoff:scene:main"; 257]}),
    ] {
        let refused = expression(
            &mut k,
            json!({"operation":"edit","expression_ref":"expression:handoff","expected_revision":revision,"actor":"a","changes":[{"change":"reuse_set","reuse":reuse}]}),
        );
        assert!(refused.is_err(), "{reuse} must be refused");
    }
    // A placeholder's overrides never re-address identity.
    let mut p = current_material(&mut k);
    p["scene"]["id"] = json!(format!("{RUN}:scene:main"));
    let d = doc(&mut k, RUN);
    let bad = presentation(
        &format!("{RUN}:scene:main"),
        "Main",
        json!([]),
        json!([{"id":"t","role":"caption","body":"","overrides":{"id":"x"}}]),
    );
    assert!(expression(&mut k, json!({"operation":"edit","expression_ref":RUN,"expected_revision":d["revision"],"actor":"a","changes":[{"change":"scene_material_set","scene_ref":format!("{RUN}:scene:main"),"presentation":bad}]})).is_err());
}

#[test]
fn reuse_survives_export_reopen_and_fork_with_local_refs_remapped() {
    let mut k = setup();
    let revision = doc(&mut k, "expression:handoff")["revision"]
        .as_u64()
        .unwrap();
    let exported = expression(&mut k, json!({"operation":"export","expression_ref":"expression:handoff","expected_revision":revision})).unwrap();
    let document = exported["document"].clone();
    assert_eq!(document["reuse"]["kind"], "scene");
    assert_eq!(
        document["reuse"]["associations"]["workflow_keys"][0],
        "handoff"
    );
    let mut fresh = kernel();
    let reopened = expression(
        &mut fresh,
        json!({"operation":"open","document":document,"actor":"a"}),
    )
    .unwrap();
    assert_eq!(reopened["document"], document);
    let forked = expression(&mut k, json!({"operation":"fork","expression_ref":"expression:handoff","expected_revision":revision,"new_expression_ref":"expression:handoff2","actor":"a"})).unwrap();
    let reuse = &forked["document"]["reuse"];
    assert_eq!(reuse["entry_scene_ref"], "expression:handoff2:scene:main");
    assert_eq!(
        reuse["roles"][0]["entity_ref"],
        "expression:handoff2:entity:sender"
    );
    assert_eq!(reuse["playback"][1], "expression:handoff2:scene:return");
    // reuse_clear returns an ordinary Expression.
    edit(
        &mut k,
        "expression:handoff2",
        json!([{"change":"reuse_clear"}]),
    );
    assert!(doc(&mut k, "expression:handoff2").get("reuse").is_none());
    let caps = expression(&mut k, json!({"operation":"capabilities"})).unwrap();
    assert!(caps["operations"]
        .as_array()
        .unwrap()
        .contains(&json!("restore")));
    assert!(caps["changes"]
        .as_array()
        .unwrap()
        .contains(&json!("reuse_set")));
    let world_caps = world(&mut k, json!({"operation":"capabilities"})).unwrap();
    for op in [
        "material_list",
        "act_open",
        "act_select",
        "act_gesture",
        "act_text",
        "act_operate",
        "act_continue",
        "act_complete",
        "act_seek",
        "act_inspect",
        "act_list",
    ] {
        assert!(
            world_caps["operations"]
                .as_array()
                .unwrap()
                .contains(&json!(op)),
            "{op}"
        );
    }
}

#[test]
fn acts_persist_across_a_fresh_kernel() {
    let home = std::env::temp_dir().join(format!(
        "oi-act-store-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    let (sequence, revision) = {
        let mut k = setup();
        k.attach_act_store(&home).unwrap();
        open_act(&mut k, "act:durable");
        select_handoff(&mut k, "act:durable", "main");
        world(&mut k, json!({"operation":"act_operate","act_ref":"act:durable","actor":"a","operation_kind":"factory.task","native_ref":"task:1"})).unwrap();
        let act = world(
            &mut k,
            json!({"operation":"act_inspect","act_ref":"act:durable"}),
        )
        .unwrap()["act"]
            .clone();
        (act["sequence"].clone(), act["revision"].clone())
    };
    let mut fresh = kernel();
    fresh.attach_act_store(&home).unwrap();
    let act = world(
        &mut fresh,
        json!({"operation":"act_inspect","act_ref":"act:durable"}),
    )
    .unwrap();
    assert_eq!(act["state"], "act", "{act}");
    assert_eq!(act["act"]["sequence"], sequence);
    assert_eq!(act["act"]["revision"], revision);
    assert_eq!(act["act"]["cast"].as_array().unwrap().len(), 2);
    assert_eq!(act["act"]["subject_ref"], "goal:draft");
    let listed = world(&mut fresh, json!({"operation":"act_list","mode":"factory"})).unwrap();
    assert_eq!(listed["persistent"], true);
    assert_eq!(listed["acts"][0]["passages"], 2);
    // The durable record is CAS-guarded: a second kernel that holds an older
    // revision cannot overwrite a newer write.
    let mut stale = kernel();
    stale.attach_act_store(&home).unwrap();
    world(&mut fresh, json!({"operation":"act_operate","act_ref":"act:durable","actor":"a","operation_kind":"factory.task","native_ref":"task:2"})).unwrap();
    let refused = world(&mut stale, json!({"operation":"act_operate","act_ref":"act:durable","actor":"b","operation_kind":"factory.task","native_ref":"task:3"})).unwrap();
    assert_eq!(refused["state"], "act_revision_conflict", "{refused}");
    let reread = world(
        &mut stale,
        json!({"operation":"act_inspect","act_ref":"act:durable"}),
    )
    .unwrap();
    assert_eq!(
        reread["act"]["sequence"].as_array().unwrap().len(),
        3,
        "the conflict reloads the stored act"
    );
    let _ = std::fs::remove_dir_all(&home);
}

fn temp_home(tag: &str) -> std::path::PathBuf {
    std::env::temp_dir().join(format!(
        "oi-act-{tag}-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ))
}

#[test]
fn ended_acts_archive_to_make_room_and_stay_readable_by_ref() {
    let home = temp_home("archive");
    let mut k = setup();
    k.attach_act_store(&home).unwrap();
    open_act(&mut k, "act:first");
    select_handoff(&mut k, "act:first", "main");
    let first_scene = current_material(&mut k);
    // A live act is never archived.
    assert!(world(
        &mut k,
        json!({"operation":"act_archive","act_ref":"act:first","actor":"a"})
    )
    .is_err());
    world(
        &mut k,
        json!({"operation":"act_complete","act_ref":"act:first","actor":"a"}),
    )
    .unwrap();
    // Fill the live budget: the ended act is archived (oldest ended first).
    for i in 1..256 {
        world(&mut k, json!({"operation":"act_open","act_ref":format!("act:n{i}"),"expression_ref":RUN,"mode":"expressions","actor":"a"})).unwrap();
    }
    assert_eq!(
        world(&mut k, json!({"operation":"act_list"})).unwrap()["acts"]
            .as_array()
            .unwrap()
            .len(),
        256
    );
    world(&mut k, json!({"operation":"act_open","act_ref":"act:overflow","expression_ref":RUN,"mode":"expressions","actor":"a"})).unwrap();
    let listed = world(&mut k, json!({"operation":"act_list"})).unwrap();
    assert!(
        listed["acts"]
            .as_array()
            .unwrap()
            .iter()
            .all(|a| a["act_ref"] != "act:first"),
        "the ended act left the live set"
    );
    let archived = world(
        &mut k,
        json!({"operation":"act_inspect","act_ref":"act:first"}),
    )
    .unwrap();
    assert_eq!(archived["act"]["archived"], true, "{archived}");
    assert!(
        home.join("desktop/expression-acts/archive")
            .read_dir()
            .unwrap()
            .count()
            == 1
    );
    // All 256 live: a further act is refused; nothing live is evicted.
    let refused = world(
        &mut k,
        json!({"operation":"act_open","act_ref":"act:refused","expression_ref":RUN,"mode":"expressions","actor":"a"}),
    );
    assert!(refused.unwrap_err().contains("Live act budget"));
    // An archived act still replays by ref, from a fresh kernel too.
    edit(
        &mut k,
        RUN,
        json!([{"change":"rename","title":"Run moved"}]),
    );
    let sought = world(
        &mut k,
        json!({"operation":"act_seek","act_ref":"act:first","actor":"h","position":0}),
    )
    .unwrap();
    assert_eq!(sought["state"], "act_sought", "{sought}");
    assert_eq!(current_material(&mut k), first_scene);
    let mut fresh = setup();
    fresh.attach_act_store(&home).unwrap();
    assert_eq!(
        world(
            &mut fresh,
            json!({"operation":"act_inspect","act_ref":"act:first"})
        )
        .unwrap()["act"]["archived"],
        true
    );
    assert_eq!(
        world(&mut fresh, json!({"operation":"act_list"})).unwrap()["acts"]
            .as_array()
            .unwrap()
            .len(),
        256
    );
    let _ = std::fs::remove_dir_all(&home);
}

#[test]
fn budgets_and_store_are_checked_before_the_expression_is_edited_and_failures_roll_back() {
    let home = temp_home("order");
    let mut k = setup();
    k.attach_act_store(&home).unwrap();
    open_act(&mut k, "act:order");
    let before = doc(&mut k, RUN);
    // An unwritable store refuses before any edit.
    use std::os::unix::fs::PermissionsExt;
    let root = home.join("desktop/expression-acts");
    std::fs::set_permissions(&root, std::fs::Permissions::from_mode(0o555)).unwrap();
    let refused = world(
        &mut k,
        json!({"operation":"act_select","act_ref":"act:order","actor":"a","material":{"expression_ref":"expression:handoff","scene_ref":"main"}}),
    );
    std::fs::set_permissions(&root, std::fs::Permissions::from_mode(0o755)).unwrap();
    assert!(refused.is_err());
    assert_eq!(doc(&mut k, RUN), before, "nothing was edited");
    // A failure midway through a multi-Scene play restores the target.
    let broken = "expression:broken";
    expression(
        &mut k,
        json!({"operation":"create","expression_ref":broken,"title":"Broken","actor":"a"}),
    )
    .unwrap();
    let handoff = doc(&mut k, "expression:handoff");
    let main = handoff["scenes"][0]["presentation"].clone();
    let mut scene = main.clone();
    let text = scene["scene"]["text"].clone();
    scene["scene"] = json!({"id":format!("{broken}:scene:main"),"name":"Main","character":"b","duration":6,"transition":1,
        "view":{"mode":"2d","yaw":0,"pitch":0,"zoom":1,"panX":0,"panY":0},"field":{},"engine":{},"morph":{},"composition":{},"entities":[],"text":text,"automation":[]});
    edit(
        &mut k,
        broken,
        json!([{"change":"scene_material_set","scene_ref":format!("{broken}:scene:main"),"presentation":scene},
        {"change":"scene_create","scene_ref":format!("{broken}:scene:bare"),"title":"Bare"}]),
    );
    let before = doc(&mut k, RUN);
    let failed = world(
        &mut k,
        json!({"operation":"act_play","act_ref":"act:order","actor":"a","material":{"expression_ref":broken}}),
    );
    assert!(failed.is_err(), "{failed:?}");
    let mut after = doc(&mut k, RUN);
    after["revision"] = before["revision"].clone();
    for s in after["scenes"].as_array_mut().unwrap() {
        s["revision"] = json!(0);
    }
    let mut expected = before.clone();
    for s in expected["scenes"].as_array_mut().unwrap() {
        s["revision"] = json!(0);
    }
    assert_eq!(
        after["scenes"], expected["scenes"],
        "the pre-edit document was restored"
    );
    assert!(world(
        &mut k,
        json!({"operation":"act_inspect","act_ref":"act:order"})
    )
    .unwrap()["act"]["sequence"]
        .as_array()
        .unwrap()
        .is_empty());
    let _ = std::fs::remove_dir_all(&home);
}

#[test]
fn seek_refuses_drifted_characters_unless_accepted_and_kind_must_match_shape() {
    let mut k = setup();
    open_act(&mut k, "act:drift");
    let performed = select_handoff(&mut k, "act:drift", "main");
    let nous = doc(&mut k, "expression:nous")["revision"].to_string();
    assert_eq!(
        performed["passage"]["bindings"]["sender"]["character_revision"],
        nous
    );
    world(&mut k, json!({"operation":"act_operate","act_ref":"act:drift","actor":"a","operation_kind":"x","native_ref":"y"})).unwrap();
    edit(
        &mut k,
        "expression:nous",
        json!([{"change":"rename","title":"Nous v2"}]),
    );
    let refused = world(
        &mut k,
        json!({"operation":"act_seek","act_ref":"act:drift","actor":"h","position":0}),
    )
    .unwrap();
    assert_eq!(refused["state"], "material_revision_changed", "{refused}");
    assert_eq!(refused["material"], "character");
    let accepted = world(&mut k, json!({"operation":"act_seek","act_ref":"act:drift","actor":"h","position":0,"accept_drift":true})).unwrap();
    assert_eq!(accepted["state"], "act_sought", "{accepted}");
    // A new performance reads the character's current revision (no stale pin).
    let again = select_handoff(&mut k, "act:drift", "main");
    assert_eq!(
        again["passage"]["bindings"]["sender"]["character_revision"],
        doc(&mut k, "expression:nous")["revision"].to_string()
    );
    // A caller-supplied kind that contradicts the request shape is refused.
    assert!(world(&mut k, json!({"operation":"act_select","act_ref":"act:drift","actor":"a","role":"sender","state":"idle","kind":"scene"})).is_err());
    assert!(world(&mut k, json!({"operation":"act_select","act_ref":"act:drift","actor":"a","material":{"expression_ref":"expression:handoff","scene_ref":"main"},"kind":"gesture"})).is_err());
    assert_eq!(world(&mut k, json!({"operation":"act_select","act_ref":"act:drift","actor":"a","role":"sender","state":"idle","kind":"state"})).unwrap()["passage"]["kind"], "state");
}

#[test]
fn act_play_performs_the_saved_playback_order_with_transitions_and_seek_reopens_it() {
    let mut k = setup();
    open_act(&mut k, "act:play");
    let played = world(&mut k, json!({"operation":"act_play","act_ref":"act:play","actor":"a","material":{"expression_ref":"expression:handoff"},
        "captions":{"caption":"Playing"}})).unwrap();
    assert_eq!(played["state"], "act_played", "{played}");
    let passages = played["passages"].as_array().unwrap();
    assert_eq!(passages.len(), 2);
    assert_eq!(passages[0]["scene_ref"], "expression:handoff:scene:main");
    assert_eq!(passages[1]["scene_ref"], "expression:handoff:scene:return");
    assert_eq!(passages[0]["transition"]["duration"], 1.5);
    let end = current_material(&mut k);
    assert_eq!(
        role(&end, "sender")["position"]["x"],
        0.4,
        "the return Scene is the final state"
    );
    assert_eq!(played["act"]["position"], 1);
    let back = world(
        &mut k,
        json!({"operation":"act_seek","act_ref":"act:play","actor":"h","position":0}),
    )
    .unwrap();
    assert_eq!(back["replayed"]["incremental"], false);
    assert_eq!(
        role(&current_material(&mut k), "sender")["position"]["x"],
        -0.5
    );
    let forward = world(
        &mut k,
        json!({"operation":"act_seek","act_ref":"act:play","actor":"h","position":1}),
    )
    .unwrap();
    assert_eq!(
        forward["replayed"],
        json!({"from":1,"to":1,"incremental":true})
    );
    assert_eq!(current_material(&mut k), end);
    let from = world(&mut k, json!({"operation":"act_play","act_ref":"act:play","actor":"a","material":{"expression_ref":"expression:handoff"},"from":1})).unwrap();
    assert_eq!(from["passages"].as_array().unwrap().len(), 1);
    assert!(world(&mut k, json!({"operation":"act_play","act_ref":"act:play","actor":"a","material":{"expression_ref":"expression:handoff"},"from":5})).is_err());
}

#[test]
fn unroled_material_is_replaced_not_accumulated_on_scene_change() {
    let mut k = setup();
    let board = "expression:board";
    expression(
        &mut k,
        json!({"operation":"create","expression_ref":board,"title":"Board","actor":"a"}),
    )
    .unwrap();
    let pin = format!("{board}:entity:pin");
    edit(
        &mut k,
        board,
        json!([{"change":"entity_add","scene_ref":format!("{board}:scene:main"),"entity_ref":pin,"title":"Pin"}]),
    );
    edit(
        &mut k,
        board,
        json!([{"change":"scene_material_set","scene_ref":format!("{board}:scene:main"),"presentation":presentation(&format!("{board}:scene:main"),"Main",
        json!([{"id":pin,"kind":"pin","name":"Pin","text":"•","shape":"text","position":{"x":0,"y":0,"z":0},"rotation":0}]),json!([]))}]),
    );
    open_act(&mut k, "act:replace");
    select_handoff(&mut k, "act:replace", "main");
    let artifact = format!("{RUN}:entity:m.handoff.artifact");
    assert!(doc(&mut k, RUN)["entities"][&artifact].is_object());
    world(&mut k, json!({"operation":"act_select","act_ref":"act:replace","actor":"a","material":{"expression_ref":board,"scene_ref":"main"}})).unwrap();
    let d = doc(&mut k, RUN);
    assert!(
        d["entities"].get(&artifact).is_none(),
        "the previous unroled material was replaced"
    );
    assert!(d["entities"][format!("{RUN}:entity:m.board.pin")].is_object());
    assert!(
        d["entities"][format!("{RUN}:entity:role.sender")].is_object(),
        "role occupants persist"
    );
    let members = d["scenes"][0]["entity_refs"].as_array().unwrap();
    assert!(!members.contains(&json!(artifact)));
    // Replaying keeps the target bounded: repeated performances add nothing.
    let count = d["entities"].as_object().unwrap().len();
    for _ in 0..3 {
        select_handoff(&mut k, "act:replace", "main");
    }
    assert_eq!(
        doc(&mut k, RUN)["entities"].as_object().unwrap().len(),
        count
    );
}

#[test]
fn progress_text_coalesces_and_the_passage_limit_is_a_structured_refusal() {
    let mut k = setup();
    open_act(&mut k, "act:long");
    select_handoff(&mut k, "act:long", "main");
    for (i, text) in ["10%", "40%", "90%"].iter().enumerate() {
        let data = world(&mut k, json!({"operation":"act_text","act_ref":"act:long","actor":"a","role":"caption","text":text,
            "event_basis":{"family":"progress","source":"factory-attempt","event_ref":"e","occurrence":"one-progress-reading"}})).unwrap();
        assert_eq!(data["coalesced"], i > 0);
    }
    let act = world(
        &mut k,
        json!({"operation":"act_inspect","act_ref":"act:long"}),
    )
    .unwrap()["act"]
        .clone();
    assert_eq!(act["sequence"].as_array().unwrap().len(), 2);
    assert_eq!(act["sequence"][1]["text"], "90%");
    assert_eq!(act["sequence"][1]["coalesced"], 2);
    assert_eq!(current_material(&mut k)["scene"]["text"][0]["body"], "90%");
    for i in 2..512 {
        world(&mut k, json!({"operation":"act_operate","act_ref":"act:long","actor":"a","operation_kind":"t","native_ref":format!("op:{i}")})).unwrap();
    }
    let before = doc(&mut k, RUN)["revision"].clone();
    for request in [
        json!({"operation":"act_select","act_ref":"act:long","actor":"a","material":{"expression_ref":"expression:handoff","scene_ref":"main"}}),
        json!({"operation":"act_gesture","act_ref":"act:long","actor":"a","gesture":"nod","role":"sender"}),
    ] {
        let limited = world(&mut k, request).unwrap();
        assert_eq!(limited["state"], "act_passage_limit", "{limited}");
        assert!(limited["detail"].as_str().unwrap().contains("act_open"));
    }
    assert_eq!(
        doc(&mut k, RUN)["revision"],
        before,
        "a refused passage edits nothing"
    );
    let done = world(
        &mut k,
        json!({"operation":"act_complete","act_ref":"act:long","actor":"a","result":"Done"}),
    )
    .unwrap();
    assert_eq!(
        done["state"], "act_completed",
        "the Return may exceed the limit by one"
    );
    assert_eq!(done["act"]["sequence"].as_array().unwrap().len(), 513);
}

#[test]
fn removing_a_scene_prunes_the_reuse_index() {
    let mut k = setup();
    edit(
        &mut k,
        "expression:handoff",
        json!([{"change":"scene_remove","scene_ref":"expression:handoff:scene:return"}]),
    );
    let reuse = doc(&mut k, "expression:handoff")["reuse"].clone();
    assert_eq!(reuse["playback"], json!(["expression:handoff:scene:main"]));
    edit(
        &mut k,
        "expression:nous",
        json!([{"change":"scene_remove","scene_ref":"expression:nous:scene:idle"}]),
    );
    let reuse = doc(&mut k, "expression:nous")["reuse"].clone();
    assert!(reuse["states"].get("idle").is_none());
    assert!(
        reuse.get("preview_state").is_none(),
        "a preview of a removed state is dropped"
    );
}

#[test]
fn distinct_native_text_events_keep_each_acceptance() {
    let mut k = setup();
    open_act(&mut k, "act:text-events");
    select_handoff(&mut k, "act:text-events", "main");
    for (world_ref, cursor) in [("world:ann", 7), ("world:bea", 7), ("world:bea", 8)] {
        let result = world(&mut k, json!({"operation":"act_text","act_ref":"act:text-events","actor":"a","role":"caption","text":format!("{world_ref} contribution {cursor}"),
            "event_basis":{"family":"message","source":"aikit-encounter","event_ref":format!("{world_ref}/agent-session/same-local-name"),"occurrence":format!("cursor:{cursor}")}})).unwrap();
        assert_eq!(result["coalesced"], false);
    }
    let act = world(
        &mut k,
        json!({"operation":"act_inspect","act_ref":"act:text-events"}),
    )
    .unwrap()["act"]
        .clone();
    let sequence = act["sequence"].as_array().unwrap();
    assert_eq!(sequence.len(), 4);
    assert_eq!(
        sequence[1]["event_basis"]["event_ref"],
        "world:ann/agent-session/same-local-name"
    );
    assert_eq!(
        sequence[2]["event_basis"]["event_ref"],
        "world:bea/agent-session/same-local-name"
    );
    assert_eq!(sequence[3]["event_basis"]["occurrence"], "cursor:8");
}
