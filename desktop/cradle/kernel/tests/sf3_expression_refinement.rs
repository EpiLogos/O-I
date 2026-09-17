//! SF3's consequential path uses the real EX1 application state and review
//! operations. No test double stands in for Expression mutation.
use oi_cradle_kernel::{
    expression::{Application, Request},
    CentralClient,
};
use serde_json::{json, Value};

fn apply(app: &mut Application, value: Value) -> Value {
    let request: Request = serde_json::from_value(value).unwrap();
    app.apply(&CentralClient::discover(), request).unwrap().0
}

#[test]
fn agent_proposal_and_human_accept_reject_have_real_revisions_and_attribution() {
    let mut app = Application::default();
    apply(
        &mut app,
        json!({"operation":"create","expression_ref":"expression:sf3","title":"Shared lesson","actor":"human:world-b"}),
    );
    let proposed = apply(
        &mut app,
        json!({
          "operation":"propose","expression_ref":"expression:sf3","expected_revision":1,
          "proposal_ref":"expression:sf3:proposal:one","actor":"agent:epii","activity_ref":"activity:agent:lesson","continues_proposal_ref":null,
          "summary":"Place the source in relation","changes":[{"change":"entity_add","scene_ref":"expression:sf3:scene:main","entity_ref":"expression:sf3:entity:source","title":"Source"}],
          "method_refs":[{"ref":"method:epii/pedagogy","revision":"m1","availability":"available"}],"evidence_refs":[{"ref":"source:lesson","revision":"8","availability":"available"}]
        }),
    );
    assert_eq!(proposed["document"]["revision"], 2);
    assert_eq!(
        proposed["document"]["refinements"][0]["activity_ref"],
        "activity:agent:lesson"
    );
    let rejected = apply(
        &mut app,
        json!({"operation":"review","expression_ref":"expression:sf3","expected_revision":2,"proposal_ref":"expression:sf3:proposal:one","actor":"human:world-b","decision":"rejected","reason":"Keep the source still","corrections":[]}),
    );
    assert_eq!(rejected["document"]["revision"], 3);
    assert!(
        rejected["document"]["entities"]
            .as_object()
            .unwrap()
            .is_empty(),
        "rejection retains the proposal and does not apply it"
    );
    apply(
        &mut app,
        json!({
          "operation":"propose","expression_ref":"expression:sf3","expected_revision":3,
          "proposal_ref":"expression:sf3:proposal:two","actor":"agent:epii","activity_ref":"activity:agent:lesson:2","continues_proposal_ref":"expression:sf3:proposal:one",
          "summary":"Place the source with the human correction","changes":[{"change":"entity_add","scene_ref":"expression:sf3:scene:main","entity_ref":"expression:sf3:entity:source","title":"Source"}],
          "method_refs":[{"ref":"method:epii/pedagogy","revision":"m1","availability":"available"}],"evidence_refs":[{"ref":"source:lesson","revision":"8","availability":"available"}]
        }),
    );
    let accepted = apply(
        &mut app,
        json!({"operation":"review","expression_ref":"expression:sf3","expected_revision":4,"proposal_ref":"expression:sf3:proposal:two","actor":"human:world-b","decision":"accepted","reason":"The relation is now clear","corrections":[]}),
    );
    assert_eq!(accepted["document"]["revision"], 5);
    assert_eq!(
        accepted["document"]["entities"]["expression:sf3:entity:source"]["title"],
        "Source"
    );
    assert_eq!(
        accepted["document"]["refinements"][1]["decision"]["actor"],
        "human:world-b"
    );
}
