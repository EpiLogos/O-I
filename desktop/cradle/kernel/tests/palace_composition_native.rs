//! M5′ Palace durable composition over the EXISTING Expression substrate
//! (O:I #352 ES1A/ES1B) — no second Palace store. A region is a Scene; a
//! region's contained Expression is that Scene's own body
//! (`scene_body_set`, carrier `expression_ref`); the guided path is
//! `scene_reorder`; independent opening is a Portal trigger
//! (`scene_trigger_attach`). See the coordinator finding this proves:
//! `Change::SubjectBind` explicitly refuses an Entity subject bound to
//! another Expression ("Subject must remain native") — so a contained
//! Expression can be disclosed as a Scene's own body, never as a bound
//! Entity subject. This is reported, not worked around.
//!
//! Owner boundary this leaves standing: because a Scene has exactly one
//! body, and an Entity cannot be subject-bound to an Expression, the
//! substrate as it exists today discloses AT MOST ONE contained Expression
//! per Scene — so a Palace region holds exactly one Expression, never
//! several. A multi-member region needs an owner-admitted capability this
//! substrate does not yet have: either several bodies per Scene, or an
//! Expression-member Entity binding the kernel currently refuses. Until
//! then, the Palace's own answer is: one region, one Expression — a region
//! wanting a second Expression is a second region.
use oi_cradle_kernel::{
    expression::{Application, Request},
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
fn create(app: &mut Application, expression_ref: &str, title: &str) -> Value {
    apply(
        app,
        json!({"operation":"create","expression_ref":expression_ref,"title":title,"actor":"agent:test"}),
    )
}
fn edit(app: &mut Application, expression_ref: &str, revision: u64, changes: Value) -> Value {
    apply(
        app,
        json!({"operation":"edit","expression_ref":expression_ref,"expected_revision":revision,"actor":"human:palace-test","changes":changes}),
    )
}

/// FINDING: a Palace region cannot disclose a contained Expression by
/// subject-binding an Entity to it — the kernel's own Entity-subject
/// validation refuses any `subject_ref` starting with `expression:`
/// ("Subject must remain native"). The edit is refused outright and the
/// document is left completely unmutated (still at revision 1).
#[test]
fn entity_subject_bind_refuses_an_expression_ref_and_mutates_nothing() {
    let mut app = Application::default();
    create(&mut app, "expression:palace", "Palace");
    create(&mut app, "expression:contained", "Contained work");
    let attempt = request(json!({
        "operation":"edit","expression_ref":"expression:palace","expected_revision":1,"actor":"human:palace-test",
        "changes":[
            {"change":"entity_add","scene_ref":"expression:palace:scene:main","entity_ref":"expression:palace:entity:member-a","title":"Contained work"},
            {"change":"subject_bind","entity_ref":"expression:palace:entity:member-a","binding":{
                "subject_ref":"expression:contained","native_owner":"oi","presentation_role":"thing",
                "sources":[],"readings":[],"actions":[]
            }}
        ]
    }));
    assert!(
        app.apply(&CentralClient::discover(), attempt).is_err(),
        "Entity subject_bind onto another Expression must be refused, not silently accepted"
    );
    let after = apply(&mut app, json!({"operation":"inspect","expression_ref":"expression:palace"}));
    assert_eq!(after["document"]["revision"], 1, "the refused edit left the document completely unmutated");
    assert!(
        after["document"]["entities"].as_object().unwrap().is_empty(),
        "the entity_add in the SAME edit was rolled back too — the edit is atomic, not partially applied"
    );
}

/// The legitimate substrate path: a region (Scene) discloses its contained
/// Expression as its OWN body (`scene_body_set`, carrier `expression_ref`),
/// which the kernel accepts, and a Portal trigger can then open it — because
/// `validate_target` for `TriggerTarget::Portal` accepts a subject disclosed
/// on the scene's OWN body (not only a bound entity).
#[test]
fn a_region_scene_discloses_its_contained_expression_as_its_own_body_and_is_portal_openable() {
    let mut app = Application::default();
    create(&mut app, "expression:palace", "Palace");
    create(&mut app, "expression:contained", "Contained work");
    let region_scene = "expression:palace:scene:region-one";
    let data = edit(
        &mut app,
        "expression:palace",
        1,
        json!([
            {"change":"scene_create","scene_ref":region_scene,"title":"Region one"},
            {"change":"scene_body_set","scene_ref":region_scene,"body":{
                "carrier":"expression_ref",
                "subject_ref":"expression:contained",
                "native_owner":"oi",
                "reading":{"ref":"expression:contained","revision":"1","availability":"available"},
                "presentation":"preview",
                "capability":{"state":"renderable"},
                "recursion":{"host_expression_ref":"expression:palace","max_depth":1}
            }},
            {"change":"scene_trigger_attach","scene_ref":region_scene,"trigger":{
                "trigger_ref":"expression:palace:trigger:region-one-portal",
                "occasion":"activate",
                "target":{"kind":"portal","placement":"beside","subject_ref":"expression:contained"}
            }}
        ]),
    );
    assert_eq!(data["document"]["revision"], 2);
    let scene = data["document"]["scenes"].as_array().unwrap().iter().find(|s| s["scene_ref"] == region_scene).unwrap();
    assert_eq!(scene["body"]["subject_ref"], "expression:contained");
    assert_eq!(scene["triggers"][0]["target"]["kind"], "portal");
    assert_eq!(scene["triggers"][0]["target"]["subject_ref"], "expression:contained");
}

/// Guided path = `scene_reorder` over the Palace's own region Scenes; free
/// selection is simply opening any region directly. Reordering twice with
/// the same order is a no-op edit that still advances the revision (no
/// duplicate scenes, no invented members).
#[test]
fn guided_path_reorders_region_scenes_and_replay_creates_no_duplicates() {
    let mut app = Application::default();
    create(&mut app, "expression:palace", "Palace");
    let data = edit(
        &mut app,
        "expression:palace",
        1,
        json!([
            {"change":"scene_create","scene_ref":"expression:palace:scene:a","title":"Region A"},
            {"change":"scene_create","scene_ref":"expression:palace:scene:b","title":"Region B"}
        ]),
    );
    assert_eq!(data["document"]["revision"], 2);
    let reordered = edit(
        &mut app,
        "expression:palace",
        2,
        json!([{"change":"scene_reorder","scene_refs":["expression:palace:scene:main","expression:palace:scene:b","expression:palace:scene:a"]}]),
    );
    let refs: Vec<String> = reordered["document"]["scenes"].as_array().unwrap().iter().map(|s| s["scene_ref"].as_str().unwrap().to_string()).collect();
    assert_eq!(refs, vec!["expression:palace:scene:main", "expression:palace:scene:b", "expression:palace:scene:a"]);
    assert_eq!(reordered["document"]["scenes"].as_array().unwrap().len(), 3, "reorder mutates order only, never mints or drops a Scene");

    // Replaying the identical reorder at the new CAS basis is idempotent:
    // same three scenes, same order, no duplicates.
    let replayed = edit(
        &mut app,
        "expression:palace",
        3,
        json!([{"change":"scene_reorder","scene_refs":["expression:palace:scene:main","expression:palace:scene:b","expression:palace:scene:a"]}]),
    );
    let replayed_refs: Vec<String> = replayed["document"]["scenes"].as_array().unwrap().iter().map(|s| s["scene_ref"].as_str().unwrap().to_string()).collect();
    assert_eq!(replayed_refs, refs);
    assert_eq!(replayed["document"]["scenes"].as_array().unwrap().len(), 3);
}

/// A stale CAS basis is refused outright and the document is left exactly
/// as it was — the Palace's compose-then-save never retries or force-writes.
#[test]
fn a_stale_composition_basis_is_refused_and_mutates_nothing() {
    let mut app = Application::default();
    create(&mut app, "expression:palace", "Palace");
    edit(&mut app, "expression:palace", 1, json!([{"change":"scene_create","scene_ref":"expression:palace:scene:a","title":"Region A"}]));
    let stale = request(json!({
        "operation":"edit","expression_ref":"expression:palace","expected_revision":1,"actor":"human:palace-test",
        "changes":[{"change":"scene_create","scene_ref":"expression:palace:scene:b","title":"Region B"}]
    }));
    let result = app.apply(&CentralClient::discover(), stale).unwrap().0;
    assert_eq!(result["state"], "revision_conflict");
    let after = apply(&mut app, json!({"operation":"inspect","expression_ref":"expression:palace"}));
    assert_eq!(after["document"]["revision"], 2, "the stale attempt did not advance or mutate the document beyond the prior accepted edit");
    assert_eq!(after["document"]["scenes"].as_array().unwrap().len(), 2, "only main + Region A — Region B from the refused stale edit was never created");
}
