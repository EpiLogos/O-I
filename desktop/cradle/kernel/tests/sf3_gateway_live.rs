//! Live SF3 acceptance against AIKit's native SessionSpace owner and a real
//! configured provider. The caller provisions a disposable owner, exact Agency
//! binding and provider; this test never substitutes a protocol fixture.
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
fn refinement(value: &Value) -> Option<Value> {
    if value.get("schema").and_then(Value::as_str) == Some("oi.expression-refinement/v1") {
        return Some(value.clone());
    }
    if let Some(text) = value.as_str() {
        let mut trimmed = text.trim();
        if let Some(rest) = trimmed.strip_prefix("```json") {
            trimmed = rest
        } else if let Some(rest) = trimmed.strip_prefix("```") {
            trimmed = rest
        }
        if let Some(rest) = trimmed.strip_suffix("```") {
            trimmed = rest
        }
        let candidate = trimmed.trim();
        let bounded = candidate
            .find('{')
            .zip(candidate.rfind('}'))
            .map(|(start, end)| &candidate[start..=end])
            .unwrap_or(candidate);
        if let Ok(parsed) = serde_json::from_str::<Value>(bounded) {
            return refinement(&parsed);
        }
    }
    value
        .as_array()
        .and_then(|rows| rows.iter().find_map(refinement))
        .or_else(|| {
            value.as_object().and_then(|row| {
                row.iter()
                    .filter(|(key, _)| !matches!(key.as_str(), "request" | "submission"))
                    .find_map(|(_, child)| refinement(child))
            })
        })
}
#[test]
#[ignore = "requires disposable AIKit SessionSpace owner and real model provider"]
fn real_provider_return_is_reviewed_by_the_native_expression_owner() {
    let composition = json!({"schema":"oi.expression-composition/v1","expression_ref":"expression:sf3-lesson","revision":1,"title":"Shared lesson","scenes":[{"scene_ref":"expression:sf3-lesson:scene:main","revision":1,"title":"Lesson","entity_refs":[]}],"entities":{},"relations":{},"selection":{"scene_ref":"expression:sf3-lesson:scene:main","entity_ref":null},"provenance":[{"ref":"source/shared","revision":"rev/source-8","availability":"available"}],"representations":[]});
    let instruction="Return JSON only. Schema oi.expression-refinement/v1; expression_ref expression:sf3-lesson; expected_revision 1; summary nonempty; exactly one changes item exactly {change:entity_add, scene_ref:expression:sf3-lesson:scene:main, entity_ref:expression:sf3-lesson:entity:model, title:Model perspective}; method_refs must be empty because no source-backed Method was disclosed; evidence_refs must contain {ref:source/shared, revision:rev/source-8, availability:available}.";
    let returned = invoke_agent(BeingRequest::Invoke {
        agent_ref: "agent:sf3".into(),
        target_agency_ref: "agency:sf3".into(),
        subject_ref: "participant:second-world:sf3".into(),
        source_refs: vec![
            json!({"ref":"source/shared","revision":"rev/source-8","availability":"available"}),
        ],
        expression_ref: "expression:sf3-lesson".into(),
        expression_revision: 1,
        composition: composition.clone(),
        instruction: instruction.into(),
        invocation_ref: "invocation:sf3:model-accepted-v2".into(),
        return_ref: "return:sf3:model-accepted-v2".into(),
    });
    assert_eq!(returned["state"], "invoked", "{returned}");
    assert_eq!(returned["target"]["agent_ref"], "agent:sf3");
    assert_eq!(returned["target"]["agent_session"], "agent-session/sf3");
    assert_eq!(returned["delivery"]["phase"], "returned");
    let body = refinement(&returned["events"]["response_text"])
        .expect("real provider response text returned structured refinement");
    assert_eq!(body["expression_ref"], "expression:sf3-lesson");
    assert_eq!(body["expected_revision"], 1);
    let delivery_ref = returned["delivery"]["delivery_ref"].as_str().unwrap();
    let terminal_revision = returned["delivery"]["terminal_cursor"].to_string();
    let receipt =
        json!({"ref":delivery_ref,"revision":terminal_revision,"availability":"available"});
    let mut app = Application::default();
    expression(
        &mut app,
        json!({"operation":"create","expression_ref":"expression:sf3-lesson","title":"Shared lesson","actor":"human:world-b"}),
    );
    expression(
        &mut app,
        json!({"operation":"propose","expression_ref":"expression:sf3-lesson","expected_revision":1,"proposal_ref":"expression:sf3-lesson:proposal:model-rejected","actor":"agent:sf3","activity_ref":delivery_ref,"continues_proposal_ref":null,"summary":body["summary"],"changes":body["changes"],"method_refs":[],"evidence_refs":[body["evidence_refs"][0].clone(),receipt.clone()]}),
    );
    let rejected = expression(
        &mut app,
        json!({"operation":"review","expression_ref":"expression:sf3-lesson","expected_revision":2,"proposal_ref":"expression:sf3-lesson:proposal:model-rejected","actor":"human:world-b","decision":"rejected","reason":"Reject one actual returned refinement","corrections":[]}),
    );
    assert!(rejected["document"]["entities"]
        .as_object()
        .unwrap()
        .is_empty());
    expression(
        &mut app,
        json!({"operation":"propose","expression_ref":"expression:sf3-lesson","expected_revision":3,"proposal_ref":"expression:sf3-lesson:proposal:model-accepted","actor":"agent:sf3","activity_ref":delivery_ref,"continues_proposal_ref":"expression:sf3-lesson:proposal:model-rejected","summary":body["summary"],"changes":body["changes"],"method_refs":[],"evidence_refs":[body["evidence_refs"][0].clone(),receipt]}),
    );
    let accepted = expression(
        &mut app,
        json!({"operation":"review","expression_ref":"expression:sf3-lesson","expected_revision":4,"proposal_ref":"expression:sf3-lesson:proposal:model-accepted","actor":"human:world-b","decision":"accepted","reason":"Accept after native inspection","corrections":[]}),
    );
    assert!(accepted["document"]["entities"]
        .get("expression:sf3-lesson:entity:model")
        .is_some());
    assert_eq!(
        accepted["document"]["refinements"][1]["activity_ref"],
        delivery_ref
    );
    let unavailable = invoke_agent(BeingRequest::Standing {
        agent_ref: "agent:wrong".into(),
        target_agency_ref: "agency:wrong".into(),
        source_refs: vec![
            json!({"ref":"source/shared","revision":"rev/source-8","availability":"available"}),
        ],
    });
    assert_eq!(unavailable["state"], "unavailable", "{unavailable}");
}
