//! ES1 knowledge side + ES4 world operations over the real kernel: the
//! shared selection relation in both directions, portal placement through
//! the existing Surface host, cancellable acts, explicit whole rebase, and
//! the ref-preservation walk across presentations. No owner is mocked: the
//! ops exercised here touch only kernel-owned state, the way the structured
//! transport does.
use oi_cradle_kernel::events::KernelEvent;
use oi_cradle_kernel::expression_world::Request;
use oi_cradle_kernel::graph::{GraphEdge, GraphNode, GraphProvenance, GraphReading};
use oi_cradle_kernel::knowledge::Address;
use oi_cradle_kernel::{Kernel, KernelOp, KernelOpResult};
use serde_json::{json, Value};

const SUBJECT: &str = "wiki:node:lesson";
const REVISION: &str = "wiki-r19";

fn request(value: Value) -> Request {
    serde_json::from_value(value).unwrap()
}

fn world(kernel: &mut Kernel, value: Value) -> Value {
    let outcome = kernel
        .apply(KernelOp::ExpressionWorld {
            request: request(value),
        })
        .unwrap();
    match outcome.result {
        KernelOpResult::ExpressionWorld { data } => data,
        other => panic!("expression_world outcome expected, got {other:?}"),
    }
}

/// A bound Expression over the exact subject, with one disclosed Action.
fn bind_and_focus(kernel: &mut Kernel) {
    kernel
        .apply(KernelOp::Expression {
            request: serde_json::from_value(json!({
                "operation":"create","expression_ref":"expression:lesson","title":"Lesson","actor":"human:author"
            }))
            .unwrap(),
        })
        .unwrap();
    kernel
        .apply(KernelOp::Expression {
            request: serde_json::from_value(json!({
                "operation":"edit","expression_ref":"expression:lesson","expected_revision":1,"actor":"human:author",
                "changes":[
                    {"change":"entity_add","scene_ref":"expression:lesson:scene:main","entity_ref":"expression:lesson:entity:a","title":"Lesson"},
                    {"change":"subject_bind","entity_ref":"expression:lesson:entity:a","binding":{
                        "subject_ref":SUBJECT,"native_owner":"ai-kit","presentation_role":"thing",
                        "sources":[{"ref":"central:source:lesson","revision":REVISION,"availability":"available"}],
                        "readings":[{"ref":SUBJECT,"revision":REVISION,"availability":"available"}],
                        "actions":[{"action_ref":"aikit.knowledge.read","target_ref":SUBJECT,"authority_requirement":"native owner"}]
                    }}
                ]
            }))
            .unwrap(),
        })
        .unwrap();
}

fn graph_node() -> GraphNode {
    GraphNode {
        metadata: Default::default(),
        ref_id: SUBJECT.into(),
        kind: "wiki-node".into(),
        label: "Lesson".into(),
        native_owner: "central".into(),
        provenance: GraphProvenance {
            source: "central.wiki.read".into(),
            revision: Some(REVISION.into()),
            detail: vec![],
        },
        actions: vec!["central.wiki.read".into()],
    }
}

/// The presentation side of the graph reading: the same subject as a node,
/// with one declared owner edge (no other edges exist to mint).
fn graph_reading() -> GraphReading {
    GraphReading {
        formations: Vec::new(),
        truncated: false,
        schema: oi_cradle_kernel::graph::GRAPH_READING_SCHEMA.into(),
        inputs: oi_cradle_kernel::graph::GraphInputs {
            central_wiki: oi_cradle_kernel::graph::GraphInput::Available {
                owner_operation: "central.wiki.read".into(),
                detail: None,
            },
            aikit_resolution: oi_cradle_kernel::graph::GraphInput::Deferred {
                owner_operation: "aikit.knowledge.resolve".into(),
                detail: "not requested".into(),
            },
            shared_field: oi_cradle_kernel::graph::GraphInput::Deferred {
                owner_operation: "shared-field.projection".into(),
                detail: "not requested".into(),
            },
        },
        nodes: vec![graph_node()],
        edges: vec![GraphEdge {
            metadata: Default::default(),
            relation: "space-node".into(),
            from_ref: "wiki:space:root".into(),
            to_ref: SUBJECT.into(),
            provenance: GraphProvenance {
                source: "central.wiki.read".into(),
                revision: None,
                detail: vec![],
            },
        }],
        counts: oi_cradle_kernel::graph::GraphCounts {
            spaces: 0,
            wiki_nodes: 1,
            knowledge_rows: 0,
            hosted_rows: 0,
            nodes: 1,
            edges: 1,
        },
    }
}

#[test]
fn selection_moves_in_both_directions_over_the_exact_refs() {
    let mut k = Kernel::discover();
    bind_and_focus(&mut k);
    // The Expression starts with no entity focused (revision 2).

    // Direction 1: a graph/constellation re-centre moves the Expression's
    // selection through the exact subject ref.
    let data = world(
        &mut k,
        json!({"operation":"selection_set","origin":"graph","subject_ref":SUBJECT,"kind":"wiki-node","native_owner":"central","revision":REVISION,"activity_ref":null,"expression_ref":"expression:lesson"}),
    );
    assert_eq!(data["state"], "selected");
    assert_eq!(data["selection"]["subject_ref"], SUBJECT);
    assert_eq!(data["selection"]["origin"], "graph");
    assert_eq!(data["expression"]["state"], "focused");
    assert_eq!(
        data["expression"]["entity_ref"],
        "expression:lesson:entity:a"
    );
    assert_eq!(
        data["selection"]["entity_ref"],
        "expression:lesson:entity:a"
    );
    // The document moved too: its selection is the bound entity now.
    let inspect = k
        .apply(KernelOp::Expression {
            request: serde_json::from_value(
                json!({"operation":"inspect","expression_ref":"expression:lesson"}),
            )
            .unwrap(),
        })
        .unwrap();
    let KernelOpResult::Expression { data } = inspect.result else {
        panic!()
    };
    assert_eq!(
        data["document"]["selection"]["entity_ref"],
        "expression:lesson:entity:a"
    );
    assert_eq!(data["document"]["revision"], 3);
    // Both relations moved: the global focus and the shared selection.
    assert_eq!(k.snapshot().focus.subject_ref().unwrap().ref_id, SUBJECT);
    let read = world(&mut k, json!({"operation":"selection_read"}));
    assert_eq!(read["selection"]["origin"], "graph");
    assert_eq!(read["selection"]["subject_ref"], SUBJECT);

    // Direction 2: an Expression focus edit moves the same shared selection.
    // The focus clears the entity, so the deictic subject is the Expression
    // ref itself — the exact same relation the global focus law keeps.
    k.apply(KernelOp::Expression {
        request: serde_json::from_value(json!({
            "operation":"edit","expression_ref":"expression:lesson","expected_revision":3,"actor":"human:author",
            "changes":[{"change":"focus","scene_ref":"expression:lesson:scene:main","entity_ref":null}]
        }))
        .unwrap(),
    })
    .unwrap();
    let read = world(&mut k, json!({"operation":"selection_read"}));
    assert_eq!(read["selection"]["origin"], "expression");
    assert_eq!(read["selection"]["subject_ref"], "expression:lesson");
    assert_eq!(read["selection"]["expression_ref"], "expression:lesson");

    // Round trip: the graph re-centre lands again on the exact same native ref.
    let data = world(
        &mut k,
        json!({"operation":"selection_set","origin":"constellation","subject_ref":SUBJECT,"kind":"wiki-node","native_owner":"central","revision":REVISION,"activity_ref":null,"expression_ref":"expression:lesson"}),
    );
    assert_eq!(data["selection"]["subject_ref"], SUBJECT);
    assert_eq!(data["selection"]["origin"], "constellation");
    assert_eq!(k.snapshot().focus.subject_ref().unwrap().ref_id, SUBJECT);
}

#[test]
fn focus_changed_fires_only_when_the_relation_actually_moves() {
    let mut k = Kernel::discover();
    bind_and_focus(&mut k);
    let before = k.event_log().len();
    let data = world(
        &mut k,
        json!({"operation":"selection_set","origin":"graph","subject_ref":SUBJECT,"kind":"wiki-node","native_owner":"central","revision":REVISION,"activity_ref":null,"expression_ref":"expression:lesson"}),
    );
    // expression_changed (document selection moved) + focus_changed (relation moved).
    let new_events = &k.event_log().since(0)[before..];
    assert_eq!(new_events.len(), 2, "one receipt per actual state change");
    assert!(new_events
        .iter()
        .any(|r| matches!(r.envelope.event, KernelEvent::FocusChanged { .. })));
    assert_eq!(data["state"], "selected");
    // The same selection again: nothing changes, so nothing is emitted.
    let before = k.event_log().len();
    world(
        &mut k,
        json!({"operation":"selection_set","origin":"graph","subject_ref":SUBJECT,"kind":"wiki-node","native_owner":"central","revision":REVISION,"activity_ref":null,"expression_ref":"expression:lesson"}),
    );
    assert_eq!(
        k.event_log().len(),
        before,
        "an unchanged relation emits nothing"
    );
}

#[test]
fn selection_is_inspection_and_never_mints_bindings_or_invokes_actions() {
    let mut k = Kernel::discover();
    bind_and_focus(&mut k);
    // An expression with no entity bound to the ref discloses `unbound`.
    let data = world(
        &mut k,
        json!({"operation":"selection_set","origin":"graph","subject_ref":"wiki:node:unbound","kind":"wiki-node","native_owner":"central","revision":"r1","activity_ref":null,"expression_ref":"expression:lesson"}),
    );
    assert_eq!(data["expression"]["state"], "unbound");
    assert_eq!(data["selection"]["subject_ref"], "wiki:node:unbound");
    let inspect = k
        .apply(KernelOp::Expression {
            request: serde_json::from_value(
                json!({"operation":"inspect","expression_ref":"expression:lesson"}),
            )
            .unwrap(),
        })
        .unwrap();
    let KernelOpResult::Expression { data } = inspect.result else {
        panic!()
    };
    assert_eq!(
        data["document"]["entities"]
            .as_object()
            .unwrap()
            .iter()
            .filter(|(_, e)| e["subject"]["subject_ref"] == "wiki:node:unbound")
            .count(),
        0,
        "selection never mints a subject binding"
    );
    assert_eq!(data["document"]["relations"].as_object().unwrap().len(), 0);
}

#[test]
fn malformed_selections_refuse() {
    let mut k = Kernel::discover();
    // Unknown origins and unknown fields fail deserialization.
    for bad in [
        json!({"operation":"selection_set","origin":"astral","subject_ref":"wiki:x","kind":"wiki-node","native_owner":"central","revision":null,"activity_ref":null}),
        json!({"operation":"selection_set","origin":"graph","subject_ref":"wiki:x","kind":"wiki-node","native_owner":"central","revision":"r1","activity_ref":null,"bogus":true}),
    ] {
        assert!(
            serde_json::from_value::<Request>(bad.clone()).is_err(),
            "{bad} must refuse"
        );
    }
    // An empty subject ref parses but refuses at the kernel.
    let empty = request(
        json!({"operation":"selection_set","origin":"graph","subject_ref":"","kind":"wiki-node","native_owner":"central","revision":null,"activity_ref":null}),
    );
    assert!(k
        .apply(KernelOp::ExpressionWorld { request: empty })
        .is_err());
    assert!(k
        .apply(KernelOp::ExpressionWorld {
            request: request(json!({"operation":"selection_read"}))
        })
        .is_ok());
}

#[test]
fn portals_route_through_the_surface_host_with_ref_preservation() {
    let mut k = Kernel::discover();
    // Open a portal onto the exact subject through the existing Surface host.
    let data = world(
        &mut k,
        json!({"operation":"portal_open","portal_ref":"portal:lesson","target_ref":SUBJECT,"surface_kind":"source","surface_id":"s-lesson","placement":"overlay","title":"Lesson source","actor":"agent:composer","activity_ref":"activity:caller:1"}),
    );
    assert_eq!(data["state"], "portal_open", "{data}");
    assert_eq!(data["portal"]["target_ref"], SUBJECT);
    assert_eq!(data["portal"]["placement"], "overlay");
    // The Surface host holds the binding with the exact ref preserved.
    let snapshot = k.snapshot();
    assert_eq!(
        snapshot.surfaces["s-lesson"].source_ref.as_deref(),
        Some(SUBJECT)
    );
    // Portal inspect discloses it, with the placement grammar.
    let data = world(
        &mut k,
        json!({"operation":"portal_inspect","target_ref":null}),
    );
    assert_eq!(data["portals"].as_array().unwrap().len(), 1);
    assert_eq!(
        data["placements"],
        json!(["preview", "overlay", "beside", "full", "detached"])
    );
    // Explicit re-placement onto the same target updates the placement.
    let data = world(
        &mut k,
        json!({"operation":"portal_open","portal_ref":"portal:lesson","target_ref":SUBJECT,"surface_kind":"source","surface_id":"s-lesson","placement":"beside","title":"Lesson source","actor":"human:author","activity_ref":null}),
    );
    assert_eq!(data["portal"]["placement"], "beside");
    // A detached portal re-docks; the canonical ref is unchanged.
    world(
        &mut k,
        json!({"operation":"portal_open","portal_ref":"portal:lesson","target_ref":SUBJECT,"surface_kind":"source","surface_id":"s-lesson","placement":"detached","title":"Lesson source","actor":"human:author","activity_ref":null}),
    );
    let data = world(
        &mut k,
        json!({"operation":"portal_redock","portal_ref":"portal:lesson","actor":"human:author"}),
    );
    assert_eq!(data["state"], "portal_redocked");
    assert_eq!(data["portal"]["target_ref"], SUBJECT);
    assert_eq!(data["portal"]["placement"], "preview");
    // Closing removes both the portal record and the surface binding.
    let data = world(
        &mut k,
        json!({"operation":"portal_close","portal_ref":"portal:lesson","actor":"human:author"}),
    );
    assert_eq!(data["state"], "portal_closed");
    assert_eq!(data["target_ref"], SUBJECT);
    assert!(!k.snapshot().surfaces.contains_key("s-lesson"));
    let data = world(
        &mut k,
        json!({"operation":"portal_inspect","target_ref":null}),
    );
    assert_eq!(data["portals"].as_array().unwrap().len(), 0);
}

#[test]
fn portal_targets_without_a_surface_degrade_explicitly_and_unknown_refs_refuse() {
    let mut k = Kernel::discover();
    // A knowledge-kind surface needs a current owner reading; the host's own
    // refusal is the degradation disclosure — no fabricated surface.
    let data = world(
        &mut k,
        json!({"operation":"portal_open","portal_ref":"portal:x","target_ref":SUBJECT,"surface_kind":"knowledge","surface_id":"s-x","placement":"preview","title":"X","actor":"agent:composer","activity_ref":null}),
    );
    assert_eq!(data["state"], "unavailable_surface", "{data}");
    assert_eq!(data["target_ref"], SUBJECT);
    assert!(
        data["detail"].as_str().unwrap().contains("owner reading"),
        "the host's own refusal"
    );
    assert!(!k.snapshot().surfaces.contains_key("s-x"));
    assert_eq!(
        world(
            &mut k,
            json!({"operation":"portal_inspect","target_ref":null})
        )["portals"]
            .as_array()
            .unwrap()
            .len(),
        0
    );
    // Unknown targets and refs refuse. A "redock" placement is not an
    // opening at all — it fails deserialization.
    assert!(serde_json::from_value::<Request>(json!({"operation":"portal_open","portal_ref":"portal:y","target_ref":SUBJECT,"surface_kind":"source","surface_id":"s-y","placement":"redock","title":"Y","actor":"a","activity_ref":null})).is_err());
    for bad in [
        json!({"operation":"portal_open","portal_ref":"portal:y","target_ref":"","surface_kind":"source","surface_id":"s-y","placement":"preview","title":"Y","actor":"a","activity_ref":null}),
        json!({"operation":"portal_close","portal_ref":"portal:absent","actor":"a"}),
        json!({"operation":"portal_redock","portal_ref":"portal:absent","actor":"a"}),
    ] {
        assert!(
            k.apply(KernelOp::ExpressionWorld {
                request: request(bad.clone())
            })
            .is_err(),
            "{bad}"
        );
    }
    // Redock only applies to detached portals.
    world(
        &mut k,
        json!({"operation":"portal_open","portal_ref":"portal:z","target_ref":SUBJECT,"surface_kind":"source","surface_id":"s-z","placement":"full","title":"Z","actor":"a","activity_ref":null}),
    );
    assert!(k
        .apply(KernelOp::ExpressionWorld {
            request: request(
                json!({"operation":"portal_redock","portal_ref":"portal:z","actor":"a"})
            )
        })
        .is_err());
}

#[test]
fn expressive_acts_run_hold_checkpoint_and_restore_exact_documents() {
    let mut k = Kernel::discover();
    bind_and_focus(&mut k);
    // Perform a bounded act: one atomic edit, exact revision.
    let data = world(
        &mut k,
        json!({"operation":"act_perform","act_ref":"act:1","expression_ref":"expression:lesson","expected_revision":2,"summary":"Widen the lesson","actor":"agent:composer","activity_ref":"activity:caller:9","changes":[{"change":"parameter_set","entity_ref":"expression:lesson:entity:a","parameter":"scale","value":2}]}),
    );
    assert_eq!(data["state"], "act_running", "{data}");
    assert_eq!(data["act"]["state"], "running");
    assert_eq!(data["act"]["basis_revision"], 2);
    // A running act refuses a second performance.
    assert!(k.apply(KernelOp::ExpressionWorld { request: request(json!({
        "operation":"act_perform","act_ref":"act:1","expression_ref":"expression:lesson","expected_revision":3,"summary":"Again","actor":"agent:composer","activity_ref":null,
        "changes":[{"change":"parameter_set","entity_ref":"expression:lesson:entity:a","parameter":"scale","value":3}]})) }).is_err());
    // Checkpoint the act's document exactly.
    let data = world(
        &mut k,
        json!({"operation":"act_checkpoint","act_ref":"act:1","checkpoint_ref":"cp:1","actor":"agent:composer"}),
    );
    assert_eq!(data["checkpoint"]["revision"], 3);
    // The human interrupts: the act holds, nothing reverts, nothing advances.
    let data = world(
        &mut k,
        json!({"operation":"act_interrupt","act_ref":"act:1","actor":"human:author","reason":"Let me look first"}),
    );
    assert_eq!(data["state"], "act_held");
    let inspect = k
        .apply(KernelOp::Expression {
            request: serde_json::from_value(
                json!({"operation":"inspect","expression_ref":"expression:lesson"}),
            )
            .unwrap(),
        })
        .unwrap();
    let KernelOpResult::Expression { data } = inspect.result else {
        panic!()
    };
    assert_eq!(
        data["document"]["revision"], 3,
        "interruption holds the act: nothing reverted"
    );
    assert_eq!(
        data["document"]["entities"]["expression:lesson:entity:a"]["parameters"]["scale"]["value"],
        2
    );
    // More human edits happen after the interruption.
    k.apply(KernelOp::Expression { request: serde_json::from_value(json!({
        "operation":"edit","expression_ref":"expression:lesson","expected_revision":3,"actor":"human:author",
        "changes":[{"change":"parameter_set","entity_ref":"expression:lesson:entity:a","parameter":"scale","value":1.5}] })).unwrap() }).unwrap();
    // Restore with a stale expected revision refuses without mutation.
    let data = world(
        &mut k,
        json!({"operation":"act_restore","act_ref":"act:1","checkpoint_ref":"cp:1","expected_revision":3,"actor":"human:author","activity_ref":null}),
    );
    assert_eq!(data["state"], "revision_conflict");
    // Restore against the current revision returns the draft to the exact
    // checkpointed document, one revision on.
    let data = world(
        &mut k,
        json!({"operation":"act_restore","act_ref":"act:1","checkpoint_ref":"cp:1","expected_revision":4,"actor":"human:author","activity_ref":null}),
    );
    assert_eq!(data["state"], "act_restored", "{data}");
    let document = &data["expression"]["document"];
    assert_eq!(document["revision"], 5);
    assert_eq!(
        document["entities"]["expression:lesson:entity:a"]["parameters"]["scale"]["value"],
        2
    );
    assert_eq!(
        document["entities"]["expression:lesson:entity:a"]["subject"]["subject_ref"], SUBJECT,
        "exact subject refs preserved through restore"
    );
    // Restoring an identical checkpoint is a no-op, not a revision bump.
    let data = world(
        &mut k,
        json!({"operation":"act_restore","act_ref":"act:1","checkpoint_ref":"cp:1","expected_revision":5,"actor":"human:author","activity_ref":null}),
    );
    assert_eq!(
        data["expression"]["document"]["revision"], 5,
        "no-op restore does not advance"
    );
    // Checkpoints belong to their act.
    assert!(k.apply(KernelOp::ExpressionWorld { request: request(json!({"operation":"act_checkpoint","act_ref":"act:absent","checkpoint_ref":"cp:2","actor":"a"})) }).is_err());
}

#[test]
fn whole_drift_is_disclosed_and_rebasing_is_explicit_never_silent() {
    let mut k = Kernel::discover();
    bind_and_focus(&mut k);
    let data = world(
        &mut k,
        json!({"operation":"whole_bind","whole_ref":"whole:lesson","basis":{"ref":SUBJECT,"revision":REVISION,"availability":"available"},"locus_ref":SUBJECT,
            "members":[
                {"subject":{"ref":SUBJECT,"revision":REVISION,"availability":"available"},"native_owner":"central"},
                {"subject":{"ref":"wiki:node:other","revision":"r2","availability":"available"},"native_owner":"central"}
            ],
            "relations":[{"relation":{"ref":"wiki:relation:lesson-other","revision":"4","availability":"available"},"from_ref":SUBJECT,"to_ref":"wiki:node:other"}],
            "expression_ref":"expression:lesson","actor":"human:author","activity_ref":null}),
    );
    assert_eq!(data["state"], "whole_bound", "{data}");
    assert_eq!(data["whole"]["basis"]["revision"], REVISION);
    // A stale expectation of the basis is a structured conflict, no mutation.
    let data = world(
        &mut k,
        json!({"operation":"whole_rebase","whole_ref":"whole:lesson","expected_basis_revision":"wiki-r18","basis":{"ref":SUBJECT,"revision":"wiki-r20","availability":"available"},
            "members":[{"subject":{"ref":SUBJECT,"revision":"wiki-r20","availability":"available"},"native_owner":"central"}],
            "relations":[],"actor":"human:author","activity_ref":null}),
    );
    assert_eq!(data["state"], "whole_basis_conflict");
    assert_eq!(data["current_basis_revision"], REVISION);
    // A same-revision rebase is refused: rebasing must never be silent.
    let data = world(
        &mut k,
        json!({"operation":"whole_rebase","whole_ref":"whole:lesson","expected_basis_revision":REVISION,"basis":{"ref":SUBJECT,"revision":REVISION,"availability":"available"},
            "members":[{"subject":{"ref":SUBJECT,"revision":REVISION,"availability":"available"},"native_owner":"central"}],
            "relations":[],"actor":"human:author","activity_ref":null}),
    );
    assert_eq!(data["state"], "whole_unchanged");
    // The recorded whole still carries its original members and relations.
    let data = world(
        &mut k,
        json!({"operation":"whole_inspect","whole_ref":"whole:lesson"}),
    );
    assert_eq!(data["whole"]["members"].as_array().unwrap().len(), 2);
    assert_eq!(data["whole"]["relations"].as_array().unwrap().len(), 1);
    // An explicit, correct rebase moves the whole to the new basis.
    let data = world(
        &mut k,
        json!({"operation":"whole_rebase","whole_ref":"whole:lesson","expected_basis_revision":REVISION,"basis":{"ref":SUBJECT,"revision":"wiki-r20","availability":"available"},
            "members":[{"subject":{"ref":SUBJECT,"revision":"wiki-r20","availability":"available"},"native_owner":"central"}],
            "relations":[],"actor":"human:author","activity_ref":null}),
    );
    assert_eq!(data["state"], "whole_rebased");
    assert_eq!(data["previous_basis_revision"], REVISION);
    assert_eq!(data["whole"]["basis"]["revision"], "wiki-r20");
    assert_eq!(
        data["whole"]["expression_ref"], "expression:lesson",
        "the Expression binding is kept"
    );
    // Unknown wholes are disclosed, never fabricated.
    assert_eq!(
        world(
            &mut k,
            json!({"operation":"whole_inspect","whole_ref":"whole:absent"})
        )["state"],
        "unknown_whole"
    );
    assert_eq!(
        world(
            &mut k,
            json!({"operation":"whole_rebase","whole_ref":"whole:absent","expected_basis_revision":"r1","basis":{"ref":"x","revision":"r2","availability":"available"},"members":[],"relations":[],"actor":"a","activity_ref":null})
        )["state"],
        "unknown_whole"
    );
    // Bind refuses malformed and duplicate records outright.
    for bad in [
        json!({"operation":"whole_bind","whole_ref":"whole:2","basis":{"ref":"x","revision":"r1","availability":"stale"},"locus_ref":"x","members":[{"subject":{"ref":"x","revision":"r1","availability":"available"},"native_owner":"central"}],"relations":[],"actor":"a","activity_ref":null}),
        json!({"operation":"whole_bind","whole_ref":"whole:lesson","basis":{"ref":"x","revision":"r1","availability":"available"},"locus_ref":"x","members":[{"subject":{"ref":"x","revision":"r1","availability":"available"},"native_owner":"central"}],"relations":[],"actor":"a","activity_ref":null}),
        json!({"operation":"whole_bind","whole_ref":"whole:3","basis":{"ref":"x","revision":"r1","availability":"available"},"locus_ref":"x","members":[{"subject":{"ref":"x","revision":"r1","availability":"available"},"native_owner":"central"},{"subject":{"ref":"x","revision":"r1","availability":"available"},"native_owner":"central"}],"relations":[],"actor":"a","activity_ref":null}),
    ] {
        assert!(k
            .apply(KernelOp::ExpressionWorld {
                request: request(bad)
            })
            .is_err());
    }
}

#[test]
fn ref_preservation_walk_across_presentations() {
    let mut k = Kernel::discover();
    bind_and_focus(&mut k);
    // Hop 1 — LIST / Wiki page: the owner address the read model opens by.
    let page_address = Address::Wiki(SUBJECT.into());
    // Hop 2 — GRAPH: the same ref is the graph node identity, revision and all.
    let reading = graph_reading();
    let node = reading
        .nodes
        .iter()
        .find(|n| n.ref_id == page_address.reference())
        .expect("the subject is the graph node");
    assert_eq!(node.provenance.revision.as_deref(), Some(REVISION));
    // Hop 3 — selection: the graph re-centre names the same exact ref.
    let data = world(
        &mut k,
        json!({"operation":"selection_set","origin":"graph","subject_ref":node.ref_id,"kind":node.kind,"native_owner":node.native_owner,"revision":node.provenance.revision,"activity_ref":null,"expression_ref":"expression:lesson"}),
    );
    assert_eq!(data["selection"]["subject_ref"], page_address.reference());
    assert_eq!(
        k.snapshot().focus.subject_ref().unwrap().ref_id,
        page_address.reference()
    );
    // Hop 4 — Expression binding: the focused entity is bound to the same ref,
    // with the same reading revision and the same disclosed Action target.
    let inspect = k
        .apply(KernelOp::Expression {
            request: serde_json::from_value(
                json!({"operation":"inspect","expression_ref":"expression:lesson"}),
            )
            .unwrap(),
        })
        .unwrap();
    let KernelOpResult::Expression { data } = inspect.result else {
        panic!()
    };
    let entity = &data["document"]["entities"]["expression:lesson:entity:a"];
    assert_eq!(entity["subject"]["subject_ref"], page_address.reference());
    assert_eq!(
        entity["subject"]["readings"][0]["ref"],
        page_address.reference()
    );
    assert_eq!(entity["subject"]["readings"][0]["revision"], REVISION);
    assert_eq!(
        entity["subject"]["actions"][0]["target_ref"],
        page_address.reference()
    );
    // Hop 5 — portal: the same ref opens through the Surface host.
    world(
        &mut k,
        json!({"operation":"portal_open","portal_ref":"portal:walk","target_ref":page_address.reference().to_string(),"surface_kind":"source","surface_id":"s-walk","placement":"beside","title":"Lesson","actor":"human:author","activity_ref":null}),
    );
    assert_eq!(
        k.snapshot().surfaces["s-walk"].source_ref.as_deref(),
        Some(page_address.reference())
    );
    // No copied semantic store: the walk minted no entity, no relation, no
    // second identity — one Expression entity over the one native ref, and
    // presentation geometry over the whole adds nothing semantic.
    assert_eq!(data["document"]["entities"].as_object().unwrap().len(), 1);
    assert_eq!(data["document"]["relations"].as_object().unwrap().len(), 0);
    // The wire carries the same tagged seam as every other kernel op.
    let wire = serde_json::to_value(KernelOp::ExpressionWorld {
        request: request(json!({"operation":"selection_read"})),
    })
    .unwrap();
    assert_eq!(wire["op"], "expression_world");
    assert_eq!(wire["request"]["operation"], "selection_read");
    let outcome = k
        .apply(KernelOp::ExpressionWorld {
            request: request(json!({"operation":"capabilities"})),
        })
        .unwrap();
    let KernelOpResult::ExpressionWorld { data } = outcome.result else {
        panic!()
    };
    assert_eq!(data["schema"], "oi.expression-world-capabilities/v1");
    assert!(data["unsupported"]
        .as_array()
        .unwrap()
        .iter()
        .any(|u| u == "semantic_edge_minting"));
}

#[test]
fn unknown_operations_and_fields_fail_closed() {
    let bogus: Result<Request, _> =
        serde_json::from_value(json!({"operation":"portal_invoke","portal_ref":"p","actor":"a"}));
    assert!(bogus.is_err(), "no such operation exists");
    let bogus: Result<Request, _> = serde_json::from_value(
        json!({"operation":"whole_bind","whole_ref":"w","basis":{"ref":"x","revision":"r","availability":"available"},"locus_ref":"x","members":[],"relations":[],"actor":"a","activity_ref":null,"authority":"root"}),
    );
    assert!(
        bogus.is_err(),
        "unknown fields are refused, never silently accepted"
    );
}

#[test]
fn subject_handoff_never_chooses_an_arbitrary_repeated_occurrence() {
    let mut k=Kernel::discover();
    bind_and_focus(&mut k);
    k.apply(KernelOp::Expression { request: serde_json::from_value(json!({
        "operation":"edit","expression_ref":"expression:lesson","expected_revision":2,"actor":"human:test",
        "changes":[{"change":"entity_add","scene_ref":"expression:lesson:scene:main","entity_ref":"expression:lesson:entity:b","title":"Second occurrence"},
        {"change":"subject_bind","entity_ref":"expression:lesson:entity:b","binding":{"subject_ref":SUBJECT,"native_owner":"ai-kit","presentation_role":"thing","sources":[],"readings":[],"actions":[]}}]
    })).unwrap() }).unwrap();
    let selected=world(&mut k,json!({"operation":"selection_set","origin":"graph","subject_ref":SUBJECT,
        "kind":"wiki-node","native_owner":"ai-kit","expression_ref":"expression:lesson"}));
    assert_eq!(selected["expression"]["state"],"ambiguous_occurrence");
    assert_eq!(selected["expression"]["occurrences"].as_array().unwrap().len(),2);
    k.apply(KernelOp::Expression { request: serde_json::from_value(json!({
        "operation":"edit","expression_ref":"expression:lesson","expected_revision":3,"actor":"human:test",
        "changes":[{"change":"focus","scene_ref":"expression:lesson:scene:main","entity_ref":"expression:lesson:entity:b"}]
    })).unwrap() }).unwrap();
    let selected=world(&mut k,json!({"operation":"selection_set","origin":"graph","subject_ref":SUBJECT,
        "kind":"wiki-node","native_owner":"ai-kit","expression_ref":"expression:lesson"}));
    assert_eq!(selected["expression"]["state"],"focused");
    assert_eq!(selected["expression"]["entity_ref"],"expression:lesson:entity:b");
}
