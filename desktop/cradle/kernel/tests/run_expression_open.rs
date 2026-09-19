//! Run-in-Expressions kernel acceptance: a document composed the way the
//! desktop's Factory adapter composes it (subject-bound Run, node/attempt
//! entities with native readings, verbatim edge relations, chunked scenes)
//! must pass the Expression application's own validation — and the
//! shortcuts the composition law forbids (semantic parameters, expression-
//! prefixed subjects) must be refused, not silently accepted.
use oi_cradle_kernel::{
    expression::{Application, Request},
    CentralClient,
};
use serde_json::{json, Value};

fn apply_ok(app: &mut Application, value: Value) -> Value {
    app.apply(&CentralClient::discover(), serde_json::from_value(value).unwrap())
        .unwrap()
        .0
}

fn run_document() -> Value {
    let expression_ref = "expression:factory-run-nrh";
    json!({
        "schema":"oi.expression/v1",
        "expression_ref":expression_ref,
        "revision":1,
        "title":"Run run:01M2XMVST05RBMFS3C3BVJDSB8",
        "scenes":[
            {"scene_ref":format!("{expression_ref}:scene:topology-1"),"revision":1,"title":"Run map — SSSF topology","entity_refs":[
                format!("{expression_ref}:entity:run"),
                format!("{expression_ref}:entity:destination"),
                format!("{expression_ref}:entity:work-harden-now-record-law"),
                format!("{expression_ref}:entity:gate-implementation-reviewed"),
            ]},
            {"scene_ref":format!("{expression_ref}:scene:executions-1"),"revision":1,"title":"Attempts — live and returned","entity_refs":[
                format!("{expression_ref}:entity:attempt-nrh-2026-09-19-1"),
            ]},
            {"scene_ref":format!("{expression_ref}:scene:return"),"revision":1,"title":"Return","entity_refs":[
                format!("{expression_ref}:entity:attempt-nrh-2026-09-19-1"),
            ]}
        ],
        "entities":{
            format!("{expression_ref}:entity:run"):{
                "entity_ref":format!("{expression_ref}:entity:run"),"revision":1,
                "title":"Root central.now.allocate/list/read succeed on the real field with v2 records present",
                "subject":{
                    "subject_ref":"run:01M2XMVST05RBMFS3C3BVJDSB8",
                    "native_owner":"software-factory",
                    "presentation_role":"being",
                    "sources":[{"ref":"file:/state/nrh-state.json","revision":"topology:4","availability":"available"}],
                    "readings":[
                        {"ref":"factory.run-reading/v1","revision":"4","availability":"available"},
                        {"ref":"factory.attempt-reading/v1","revision":"8","availability":"available"}
                    ],
                    "actions":[{
                        "action_ref":"action:01ARZ3NDEKTSV4RRFFQ69G5FAP",
                        "target_ref":"run:01M2XMVST05RBMFS3C3BVJDSB8",
                        "authority_requirement":"factory capability/factory/request-ev — the host may only carry this request; factory retains the authority"
                    }]
                },
                "parameters":{}
            },
            format!("{expression_ref}:entity:destination"):{
                "entity_ref":format!("{expression_ref}:entity:destination"),"revision":1,
                "title":"returns land in the root NOW field and the Factory development ledger on this machine",
                "subject":{
                    "subject_ref":"run:01M2XMVST05RBMFS3C3BVJDSB8#destination",
                    "native_owner":"software-factory",
                    "presentation_role":"thing",
                    "sources":[],
                    "readings":[{"ref":"factory.run-node/destination","revision":"unset","availability":"available"}],
                    "actions":[]
                },
                "parameters":{}
            },
            format!("{expression_ref}:entity:work-harden-now-record-law"):{
                "entity_ref":format!("{expression_ref}:entity:work-harden-now-record-law"),"revision":1,
                "title":"The root NOW record law must survive v2 records",
                "subject":{
                    "subject_ref":"run:01M2XMVST05RBMFS3C3BVJDSB8#work-harden-now-record-law",
                    "native_owner":"software-factory",
                    "presentation_role":"thing",
                    "sources":[],
                    "readings":[
                        {"ref":"factory.run-node/work","revision":"active","availability":"available"},
                        {"ref":"workflow-unit:55W1974035HK10DTEQ4PDAPNRA","revision":"native","availability":"available"}
                    ],
                    "actions":[]
                },
                "parameters":{}
            },
            format!("{expression_ref}:entity:gate-implementation-reviewed"):{
                "entity_ref":format!("{expression_ref}:entity:gate-implementation-reviewed"),"revision":1,
                "title":"Workflow barrier implementation-reviewed",
                "subject":{
                    "subject_ref":"run:01M2XMVST05RBMFS3C3BVJDSB8#gate-implementation-reviewed",
                    "native_owner":"software-factory",
                    "presentation_role":"thing",
                    "sources":[],
                    "readings":[{"ref":"factory.run-node/gate","revision":"unset","availability":"available"}],
                    "actions":[]
                },
                "parameters":{}
            },
            format!("{expression_ref}:entity:attempt-nrh-2026-09-19-1"):{
                "entity_ref":format!("{expression_ref}:entity:attempt-nrh-2026-09-19-1"),"revision":1,
                "title":"control:task:now-record-law-hardening-2026-09-19",
                "subject":{
                    "subject_ref":"attempt:nrh-2026-09-19-1",
                    "native_owner":"software-factory",
                    "presentation_role":"thing",
                    "sources":[],
                    "readings":[{"ref":"factory.verification/passed","revision":"verification:nrh-2026-09-19-1","availability":"available"}],
                    "actions":[]
                },
                "parameters":{}
            }
        },
        "relations":{
            format!("{expression_ref}:relation:edge-0-branches_to"):{
                "binding_ref":format!("{expression_ref}:relation:edge-0-branches_to"),
                "relation":{"ref":"factory.run-edge/branches_to","revision":"topology:4","availability":"available"},
                "from_entity_ref":format!("{expression_ref}:entity:destination"),
                "to_entity_ref":format!("{expression_ref}:entity:work-harden-now-record-law"),
                "provenance":[{"ref":"factory.run-reading/v1","revision":"4","availability":"available"}]
            }
        },
        "selection":{"scene_ref":format!("{expression_ref}:scene:topology-1"),"entity_ref":format!("{expression_ref}:entity:run")},
        "provenance":[
            {"ref":"file:/state/nrh-state.json","revision":"run:4","availability":"available"},
            {"ref":"factory.run-reading/v1","revision":"4","availability":"available"},
            {"ref":"factory.attempt-reading/v1","revision":"8","availability":"available"},
            {"ref":"factory.workflow-unit-list-reading/v1","revision":"1","availability":"available"}
        ],
        "representations":[],
        "refinements":[]
    })
}

#[test]
fn a_composed_run_expression_opens_through_the_kernel() {
    let mut app = Application::default();
    let data = apply_ok(
        &mut app,
        json!({"operation":"open","document":run_document(),"actor":"agent:factory-adapter"}),
    );
    assert_eq!(data["state"], "ready");
    let document = data["document"].as_object().expect("open returns the document");
    assert_eq!(document["entities"].as_object().unwrap().len(), 5);
    // Every edge kind survives verbatim as a relation.
    assert_eq!(document["relations"].as_object().unwrap().len(), 1);
    assert!(document["relations"]
        .as_object()
        .unwrap()
        .contains_key(format!("expression:factory-run-nrh:relation:edge-0-branches_to").as_str()));
    // The run subject stays native and action-carrying; nodes are Things.
    let run = &document["entities"][format!("expression:factory-run-nrh:entity:run")];
    assert_eq!(run["subject"]["presentation_role"], "being");
    assert_eq!(run["subject"]["native_owner"], "software-factory");
    let node = &document["entities"][format!("expression:factory-run-nrh:entity:work-harden-now-record-law")];
    assert_eq!(node["subject"]["readings"][0]["ref"], "factory.run-node/work");
}

#[test]
fn semantic_parameters_and_expression_prefixed_subjects_are_refused() {
    let mut document = run_document();
    let entity = document["entities"]
        .as_object_mut()
        .unwrap()
        .get_mut("expression:factory-run-nrh:entity:work-harden-now-record-law")
        .unwrap();
    // The composition law allows only presentation parameters; a node kind
    // smuggled in as a parameter must be refused, which is exactly why the
    // adapter carries kinds as readings instead.
    entity["parameters"] = json!({"kind":{"value":"work","automation":null}});
    let mut app = Application::default();
    let result = app.apply(
        &CentralClient::discover(),
        serde_json::from_value(json!({"operation":"open","document":document,"actor":"agent:factory-adapter"})).unwrap(),
    );
    assert!(result.is_err(), "semantic parameters must be refused");

    let mut document = run_document();
    let run = document["entities"]
        .as_object_mut()
        .unwrap()
        .get_mut("expression:factory-run-nrh:entity:run")
        .unwrap();
    // A subject must remain native; an expression-local subject ref would
    // let the presentation claim to be the owner.
    run["subject"]["subject_ref"] = json!("expression:factory-run-nrh");
    let mut app = Application::default();
    let result = app.apply(
        &CentralClient::discover(),
        serde_json::from_value(json!({"operation":"open","document":document,"actor":"agent:factory-adapter"})).unwrap(),
    );
    assert!(result.is_err(), "expression-prefixed subjects must be refused");
}
