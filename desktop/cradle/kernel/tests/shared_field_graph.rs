//! The hosted Shared Field input (Lane C step 5) through the real kernel
//! adapter with a fixture client on `OI_SHARED_FIELD_CLIENT`: the
//! available path (hand-countable rows), the unbound path and the
//! unavailable path. The Central and AIKit owners are pointed at
//! nonexistent executables so their inputs are honestly unavailable and
//! the Shared Field input is assembled on its own.
use oi_cradle_kernel::graph::{assemble, GraphInput, SHARED_FIELD_INPUT};
use oi_cradle_kernel::{CentralClient, Kernel, KernelOp, KernelOpResult};
use serde_json::json;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

/// Owner-executable environment is process-global; the tests own it under
/// one lock.
static ENV_LOCK: Mutex<()> = Mutex::new(());

fn witness(name: &str) -> PathBuf {
    let path = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/shared-field-client").join(name);
    assert!(path.is_file(), "missing fixture client {}", path.display());
    path
}

fn with_client<T>(name: &str, run: impl FnOnce() -> T) -> T {
    let _guard = ENV_LOCK.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
    std::env::set_var("OI_SHARED_FIELD_CLIENT", witness(name));
    std::env::set_var("OI_BIN", "/nonexistent/oi-fixture");
    let result = run();
    std::env::remove_var("OI_SHARED_FIELD_CLIENT");
    std::env::remove_var("OI_BIN");
    result
}

fn absent_owners() -> CentralClient {
    CentralClient::with("/nonexistent/ctrl-fixture".into(), None, "test".into())
}

fn assemble_with_absent_owners() -> oi_cradle_kernel::graph::GraphReading {
    assemble(&absent_owners(), "central.wiki.read", &json!({}), Path::new("/nonexistent/cwd"), "")
}

#[test]
fn hosted_snapshot_rows_become_nodes_and_edges_with_target_and_both_revisions() {
    let reading = with_client("snapshot.sh", assemble_with_absent_owners);
    match &reading.inputs.shared_field {
        GraphInput::Available { owner_operation, detail } => {
            assert_eq!(owner_operation, SHARED_FIELD_INPUT);
            assert_eq!(detail.as_deref(), Some("ws://fixture.invalid:3000/oi-shared-field-fixture"));
        }
        other => panic!("expected the hosted input available, got {other:?}"),
    }
    // The other two owners are honestly unavailable, not fabricated.
    assert!(matches!(reading.inputs.central_wiki, GraphInput::Unavailable { .. }));
    assert!(matches!(reading.inputs.aikit_resolution, GraphInput::Unavailable { .. }));

    let hosted: Vec<_> = reading.nodes.iter().filter(|node| node.native_owner == "shared-field").collect();
    assert_eq!(hosted.len(), 3, "one node per hosted Explore entry");
    assert_eq!(reading.counts.hosted_rows, 3);
    assert_eq!(reading.counts.nodes, 3, "no owner but the hosted field contributed nodes");
    assert_eq!(reading.counts.edges, 2, "one edge per hosted Explore relation");
    assert_eq!(reading.counts.spaces, 0);
    assert_eq!(reading.counts.wiki_nodes, 0);
    assert_eq!(reading.counts.knowledge_rows, 0);

    let world = hosted.iter().find(|node| node.ref_id == "world:fixture:project:X").expect("world entry");
    assert_eq!(world.kind, "hosted-central-world");
    assert_eq!(world.label, "X — a fixture world");
    assert_eq!(world.provenance.source, SHARED_FIELD_INPUT);
    assert_eq!(world.provenance.revision.as_deref(), Some("4"), "the world projection's revision");
    assert_eq!(world.provenance.detail, vec!["ws://fixture.invalid:3000/oi-shared-field-fixture".to_owned(), "rev-world-9".to_owned()]);
    assert!(world.actions.is_empty(), "the hosted field discloses no desktop Action; none is invented");

    let node = hosted.iter().find(|node| node.ref_id == "world:fixture:project:X/wiki:node:project-root/x").expect("wiki node entry");
    assert_eq!(node.kind, "hosted-wiki-node");
    assert_eq!(node.provenance.revision.as_deref(), Some("4"), "a world-qualified entry carries its world's projection revision");
    assert_eq!(node.provenance.detail[1], "1", "the entry's own revision rides beside the target");

    let artifact = hosted.iter().find(|node| node.ref_id == "world:fixture:project:X/artifact:fixture:one").expect("artifact entry");
    assert_eq!(artifact.kind, "hosted-curated-artifact");
    assert_eq!(artifact.provenance.revision.as_deref(), Some("4"), "the entry's world projection wins; its own projection is the fallback only");

    let mut edges: Vec<(String, String, String)> = reading.edges.iter().map(|edge| (edge.relation.clone(), edge.from_ref.clone(), edge.to_ref.clone())).collect();
    edges.sort();
    assert_eq!(edges, vec![
        ("node-source".to_owned(), "world:fixture:project:X/wiki:node:project-root/x".to_owned(), "world:fixture:project:X/artifact:fixture:one".to_owned()),
        ("oi.world/wiki-node".to_owned(), "world:fixture:project:X".to_owned(), "world:fixture:project:X/wiki:node:project-root/x".to_owned()),
    ], "relation spelling and endpoints verbatim");
    assert!(reading.edges.iter().all(|edge| edge.provenance.source == SHARED_FIELD_INPUT));
}

/// The inhabited World published through the same bundle
/// (shared-field/central-wiki-projection.mjs): the CI World publication —
/// Positions (one in occupancy mode, one address only), a constellation and
/// their World relations — as the hosted field hands it back. Positions and
/// constellations are hosted nodes like every other entry; their relation
/// spellings arrive verbatim, and nothing of an occupant's session rides the
/// graph.
#[test]
fn hosted_world_positions_and_constellations_become_nodes_with_their_world_relations() {
    let reading = with_client("inhabited.sh", assemble_with_absent_owners);
    assert!(matches!(reading.inputs.shared_field, GraphInput::Available { .. }));
    let hosted: Vec<_> = reading.nodes.iter().filter(|node| node.native_owner == "shared-field").collect();
    assert_eq!(hosted.len(), 7, "world, two spaces, one node, one constellation, two Positions");
    assert_eq!(reading.counts.edges, 9);

    let world = "world:ci:central:project:Fixture";
    let anima = format!("{world}/central:position:project:Fixture:anima-4");
    let aletheia = format!("{world}/central:position:project:Fixture:aletheia-5");
    let frame = format!("{world}/wiki:frame:ci-fixture-inquiry");
    let node = format!("{world}/wiki:node:project-root/fixture");

    let positions: Vec<_> = hosted.iter().filter(|node| node.kind == "hosted-world-position").collect();
    assert_eq!(positions.len(), 2);
    let occupied = positions.iter().find(|node| node.ref_id == anima).expect("the occupancy-mode Position");
    assert_eq!(occupied.label, "Anima 4 (CI fixture)");
    assert_eq!(occupied.provenance.revision.as_deref(), Some("1"), "a Position carries its World projection's revision");
    assert_eq!(occupied.provenance.detail, vec!["ws://fixture.invalid:3000/oi-shared-field-fixture".to_owned(), "r1".to_owned()], "and its own definition revision");
    assert!(occupied.actions.is_empty());
    assert!(positions.iter().any(|node| node.ref_id == aletheia));

    let constellation = hosted.iter().find(|node| node.ref_id == frame).expect("the constellation");
    assert_eq!(constellation.kind, "hosted-constellation");
    assert_eq!(constellation.label, "What holds the Fixture together?");
    assert_eq!(constellation.provenance.detail[1], "1", "the constellation's own frame revision");

    let edge = |relation: &str, from: &str, to: &str| reading.edges.iter().any(|edge| edge.relation == relation && edge.from_ref == from && edge.to_ref == to);
    assert!(edge("oi.world/position", world, &anima));
    assert!(edge("oi.world/position", world, &aletheia));
    assert!(edge("oi.world/constellation", world, &frame));
    assert!(edge("aikit.constellation/participation", &frame, &node));
    assert!(edge("oi.world/works-on", &anima, &node), "attested custody relates the occupied Position to its work");
    assert!(!reading.edges.iter().any(|edge| edge.relation == "oi.world/works-on" && edge.from_ref == aletheia), "an address-only Position discloses no work");

    let serialised = serde_json::to_string(&reading.nodes).unwrap() + &serde_json::to_string(&reading.edges).unwrap();
    for private in ["PRIVATE_SENTINEL", "session", "attention", "100.64.0.7"] {
        assert!(!serialised.contains(private), "no occupant-private material reaches the graph: {private}");
    }
}

#[test]
fn an_unbound_target_is_an_explicit_unavailable_input_with_the_clients_reason() {
    let reading = with_client("unbound.sh", assemble_with_absent_owners);
    match &reading.inputs.shared_field {
        GraphInput::Unavailable { owner_operation, detail } => {
            assert_eq!(owner_operation, SHARED_FIELD_INPUT);
            assert!(detail.starts_with("no SharedField target bound"), "client reason verbatim: {detail}");
        }
        other => panic!("unbound must be an explicit unavailable input, got {other:?}"),
    }
    assert!(reading.nodes.iter().all(|node| node.native_owner != "shared-field"), "no hosted rows are fabricated");
    assert_eq!(reading.counts.hosted_rows, 0);
}

#[test]
fn an_unreachable_field_is_an_explicit_unavailable_input_never_an_empty_graph() {
    let reading = with_client("unavailable.sh", assemble_with_absent_owners);
    match &reading.inputs.shared_field {
        GraphInput::Unavailable { owner_operation, detail } => {
            assert_eq!(owner_operation, SHARED_FIELD_INPUT);
            assert!(detail.contains("is unavailable"), "client message verbatim: {detail}");
        }
        other => panic!("unreachable must be an explicit unavailable input, got {other:?}"),
    }
    assert_eq!(reading.counts.hosted_rows, 0);
    assert!(reading.edges.is_empty());
}

#[test]
fn the_shared_field_op_is_a_pull_and_returns_absence_as_data() {
    with_client("unbound.sh", || {
        let mut kernel = Kernel::new(absent_owners());
        let outcome = kernel.apply(KernelOp::SharedField { request: json!({"kind":"snapshot"}) }).unwrap();
        assert!(outcome.receipts.is_empty(), "a hosted read emits nothing");
        let KernelOpResult::SharedFieldReading { data } = outcome.result else { panic!("typed SharedFieldReading expected") };
        assert_eq!(data["state"], "unavailable");
        assert_eq!(data["owner_operation"], SHARED_FIELD_INPUT);
        assert!(data["detail"].as_str().unwrap().starts_with("no SharedField target bound"));
        assert_eq!(kernel.event_log().len(), 0);
    });
    with_client("snapshot.sh", || {
        let mut kernel = Kernel::new(absent_owners());
        let outcome = kernel.apply(KernelOp::SharedField { request: json!({"kind":"status"}) }).unwrap();
        let KernelOpResult::SharedFieldReading { data } = outcome.result else { panic!("typed SharedFieldReading expected") };
        assert_eq!(data["schema"], "oi.shared-field.status/v1");
        assert_eq!(data["bound"], true);
        // The owner's own refusal returns in the owner's words, as the
        // kernel's error — never rewritten.
        let refused = kernel.apply(KernelOp::SharedField { request: json!({"kind":"nonsense"}) }).unwrap_err();
        assert_eq!(refused, "fixture answers status and snapshot only");
    });
    // The wire shape is the tagged seam every other op uses.
    let wire = serde_json::to_value(KernelOp::SharedField { request: json!({"kind":"read","ref":"world:nobody"}) }).unwrap();
    assert_eq!(wire, json!({"op":"shared_field","request":{"kind":"read","ref":"world:nobody"}}));
}
