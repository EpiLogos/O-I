//! Live SF3 acceptance against the native Actuation gateway. The test is
//! ignored by ordinary CI because it requires a deliberately provisioned
//! controller and live target; the invocation and refusal are real owner ops.
use oi_cradle_kernel::{
    being::{apply as invoke_agent, Request as BeingRequest},
    expression::{Application, Request as ExpressionRequest},
    CentralClient,
};
use serde_json::{json, Value};

fn expression(app: &mut Application, value: Value) -> Value {
    let request: ExpressionRequest = serde_json::from_value(value.clone()).unwrap();
    app.apply(&CentralClient::discover(), request)
        .unwrap_or_else(|error| panic!("{error}; request={value}"))
        .0
}

#[test]
#[ignore = "requires OI_SHARED_AGENT_CONTROLLER and a live Actuation gateway target"]
fn permitted_and_refused_transport_invocations_return_owner_receipts() {
    let composition = json!({"schema":"oi.expression/v1","expression_ref":"expression:sf3-lesson","revision":1,"title":"Shared lesson","scenes":[{"scene_ref":"expression:sf3-lesson:scene:main","title":"Lesson","entity_refs":[]}],"entities":{},"relations":{},"selection":{"scene_ref":"expression:sf3-lesson:scene:main","entity_ref":null},"provenance":[],"representations":[],"refinements":[]});
    let accepted = invoke_agent(BeingRequest::Invoke {
        agent_ref: "agent:sf3-target".into(),
        target_agency_ref: "agency:sf3-target".into(),
        subject_ref: "participant:world-a:sf3-target".into(),
        source_refs: vec!["source:sf3-lesson".into()],
        expression_ref: "expression:sf3-lesson".into(),
        expression_revision: 1,
        composition: composition.clone(),
        instruction: "Return one structured entity_add refinement for the projected lesson.".into(),
        invocation_ref: "invocation:sf3:accepted".into(),
        return_ref: "return:sf3:accepted".into(),
    });
    assert_eq!(accepted["state"], "invoked", "{accepted}");
    assert_eq!(accepted["owner_operation"], "actuation-gateway invoke");
    assert_eq!(
        accepted["receipt"]["reply"]["invocation_ref"],
        "invocation:sf3:accepted"
    );
    assert_eq!(
        accepted["receipt"]["reply"]["return_event"]["return_ref"],
        "return:sf3:accepted"
    );
    let returned: Value = serde_json::from_str(
        accepted
            .pointer("/receipt/reply/return_event/content")
            .and_then(Value::as_str)
            .expect("provider Return has structured content"),
    )
    .unwrap();
    assert_eq!(returned["schema"], "oi.expression-refinement/v1");
    let mut app = Application::default();
    expression(
        &mut app,
        json!({"operation":"create","expression_ref":"expression:sf3-lesson","title":"Shared lesson","actor":"human:world-b"}),
    );
    let changes = returned["changes"].clone();
    let methods = returned["method_refs"].clone();
    let evidence = returned["evidence_refs"].clone();
    expression(
        &mut app,
        json!({"operation":"propose","expression_ref":"expression:sf3-lesson","expected_revision":1,"proposal_ref":"expression:sf3-lesson:proposal:model-rejected","actor":"agent:sf3-target","activity_ref":"activity:sf3:model:return","continues_proposal_ref":null,"summary":returned["summary"],"changes":changes,"method_refs":methods,"evidence_refs":evidence}),
    );
    let rejected = expression(
        &mut app,
        json!({"operation":"review","expression_ref":"expression:sf3-lesson","expected_revision":2,"proposal_ref":"expression:sf3-lesson:proposal:model-rejected","actor":"human:world-b","decision":"rejected","reason":"Clarify the title","corrections":[]}),
    );
    assert!(rejected["document"]["entities"]
        .as_object()
        .unwrap()
        .is_empty());
    expression(
        &mut app,
        json!({"operation":"propose","expression_ref":"expression:sf3-lesson","expected_revision":3,"proposal_ref":"expression:sf3-lesson:proposal:model-accepted","actor":"agent:sf3-target","activity_ref":"activity:sf3:model:return","continues_proposal_ref":"expression:sf3-lesson:proposal:model-rejected","summary":returned["summary"],"changes":returned["changes"],"method_refs":returned["method_refs"],"evidence_refs":returned["evidence_refs"]}),
    );
    let accepted_review = expression(
        &mut app,
        json!({"operation":"review","expression_ref":"expression:sf3-lesson","expected_revision":4,"proposal_ref":"expression:sf3-lesson:proposal:model-accepted","actor":"human:world-b","decision":"accepted","reason":"The refinement is clear","corrections":[]}),
    );
    assert_eq!(accepted_review["document"]["revision"], 5);
    assert_eq!(
        accepted_review["document"]["refinements"][1]["activity_ref"],
        "activity:sf3:model:return"
    );
    let refused = invoke_agent(BeingRequest::Invoke {
        agent_ref: "agent:intruder".into(),
        target_agency_ref: "agency:intruder".into(),
        subject_ref: "participant:intruder".into(),
        source_refs: vec![],
        expression_ref: "expression:sf3-lesson".into(),
        expression_revision: 1,
        composition,
        instruction: "Attempt outside the grant.".into(),
        invocation_ref: "invocation:sf3:refused".into(),
        return_ref: "return:sf3:refused".into(),
    });
    assert_eq!(refused["state"], "refused", "{refused}");
    assert_eq!(refused["receipt"]["reply"]["denied"], true);
    assert_eq!(
        refused["receipt"]["reply"]["refusal_receipt"]["event"]["kind"],
        "refusal"
    );
}
