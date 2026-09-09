//! Typed graph kernel input through the exact candidate O:I executable,
//! pinned Central executable (cell C1 wiki read model) and pinned AIKit
//! executable (cell C2 resolution rows). Isolated temp Central grounds and
//! isolated AIKIT_HOME only — the live ground and user stores never move.
use oi_cradle_kernel::graph::{GraphInput, GRAPH_READING_SCHEMA, SHARED_FIELD_INPUT};
use oi_cradle_kernel::knowledge;
use oi_cradle_kernel::{CentralClient, Kernel, KernelOp, KernelOpResult};
use serde_json::{json, Value};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, MutexGuard};
use std::time::{SystemTime, UNIX_EPOCH};

/// Owner-executable environment is process-global; the graph tests own it
/// under one lock so each test still gets its own isolated grounds.
static ENV_LOCK: Mutex<()> = Mutex::new(());

fn candidate(name: &str) -> PathBuf {
    let variable = match name {
        "oi" => "OI_BIN",
        "ctrl" => "OI_CENTRAL_CTRL_BIN",
        "aikit" => "OI_AIKIT_BIN",
        _ => unreachable!(),
    };
    let path = PathBuf::from(
        std::env::var_os(variable)
            .unwrap_or_else(|| panic!("{variable} must name the frozen candidate executable")),
    );
    assert!(
        path.is_absolute(),
        "{variable} must be an absolute executable path: {}",
        path.display()
    );
    assert!(
        path.is_file(),
        "missing exact candidate executable: {}",
        path.display()
    );
    path
}

fn temporary_root(tag: &str) -> PathBuf {
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    let root = std::env::temp_dir().join(format!("oi-graph-input-{tag}-{stamp}-{}", std::process::id()));
    fs::create_dir(&root).unwrap();
    root
}

fn write(path: &Path, contents: &str) {
    fs::create_dir_all(path.parent().unwrap()).unwrap();
    fs::write(path, contents).unwrap();
}

/// Seed the C2 fixture ground: one SourcePool file. In a Central-bound
/// project the merged ai-kit resolve federates the ProjectCentral wiki (the
/// node hits come from there); an aikit-side semantic-wiki.json is not
/// consulted, so none is seeded.
fn seed_aikit_project(project: &Path) {
    write(&project.join(".aikit/profile.toml"), "schema = 1\n");
    write(
        &project.join("source-material.json"),
        r#"{
          "binding": {
            "source": "source:file:graph-onboarding",
            "revision": "rev-1",
            "title": "Graph onboarding file",
            "tags": ["graph", "test"],
            "visibility": "public",
            "owners": [],
            "media_type": "text/markdown",
            "metadata": {"origin":"graph-fixture"}
          },
          "body": "The graph fixture file keeps source evidence distinct from compiled knowledge."
        }"#,
    );
}

/// Seed the reviewed C1 fixture wiki: 1 space, 2 nodes, hand-countable
/// relation rows. Mirrors the C1 fixture shape (okf-wiki/v1 objects doc).
fn seed_project_wiki(project_root: &Path) {
    write(
        &project_root.join("ProjectCentral/agents/wiki/wiki.json"),
        r#"{
          "objects": [
            {
              "profile": "okf-wiki/v1",
              "object": "space",
              "ref": "central:wiki:graph-root",
              "revision": 9,
              "title": "Graph Root",
              "parent_space_refs": [],
              "child_space_refs": ["central:wiki:graph-child"],
              "node_refs": ["wiki:node:graph-note"],
              "anchor_ref": "wiki:node:graph-anchor"
            },
            {
              "profile": "okf-wiki/v1",
              "object": "node",
              "ref": "wiki:node:graph-note",
              "revision": 1,
              "type": "Note",
              "title": "Graph note",
              "space_refs": ["central:wiki:graph-root"],
              "source_refs": ["source:file:graph-note"],
              "provenance_source_refs": []
            },
            {
              "profile": "okf-wiki/v1",
              "object": "node",
              "ref": "wiki:node:graph-anchor",
              "revision": 2,
              "type": "Concept",
              "title": "Graph anchor",
              "space_refs": [],
              "source_refs": [],
              "provenance_source_refs": []
            },
            {
              "profile": "okf-wiki/v1",
              "object": "space",
              "ref": "central:wiki:graph-child",
              "revision": 1,
              "title": "Graph Child",
              "parent_space_refs": ["central:wiki:graph-root"],
              "child_space_refs": [],
              "node_refs": [],
              "anchor_ref": "wiki:node:graph-anchor"
            }
          ]
        }"#,
    );
}

struct Fixture {
    _env: MutexGuard<'static, ()>,
    root: PathBuf,
    _aikit_home: PathBuf,
}

impl Fixture {
    /// One isolated Central ground + project + AIKIT_HOME, exact bindings
    /// exported for every owner child process. `seed_wiki` controls whether
    /// the project wiki exists (absence is a tested state).
    fn new(tag: &str, seed_wiki: bool) -> Self {
        let env = ENV_LOCK.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
        let root = temporary_root(tag);
        let aikit_home = root.join("aikit-home");
        fs::create_dir_all(&aikit_home).unwrap();
        std::env::set_var("OI_BIN", candidate("oi"));
        std::env::set_var("OI_CENTRAL_CTRL_BIN", candidate("ctrl"));
        std::env::set_var("OI_AIKIT_BIN", candidate("aikit"));
        std::env::set_var("AIKIT_HOME", &aikit_home);

        let client = CentralClient::with_suite_owner(
            candidate("oi"),
            candidate("ctrl"),
            Some(root.clone()),
            "GraphGround".into(),
        );
        client.run("central.init", json!({})).unwrap();
        fs::create_dir(root.join("Work/GraphProj")).unwrap();
        client
            .run(
                "projectcentral.init",
                json!({"project":"GraphProj", "project_id":"graph-proj"}),
            )
            .unwrap();
        let project_root = root.join("Work/GraphProj");
        seed_aikit_project(&project_root);
        if seed_wiki {
            seed_project_wiki(&project_root);
        } else {
            // `projectcentral.init` scaffolds a default wiki; the absent
            // state requires the owner ground to truly have none.
            let _ = fs::remove_file(project_root.join("ProjectCentral/agents/wiki/wiki.json"));
        }
        Self { _env: env, root, _aikit_home: aikit_home }
    }

    fn client(&self) -> CentralClient {
        CentralClient::with_suite_owner(
            candidate("oi"),
            candidate("ctrl"),
            Some(self.root.clone()),
            "GraphGround".into(),
        )
    }

    fn project_cwd(&self) -> PathBuf {
        self.root.join("Work/GraphProj")
    }
}

fn assert_shared_field_named_deferred(reading: &oi_cradle_kernel::graph::GraphReading) {
    match &reading.inputs.shared_field {
        GraphInput::Deferred { owner_operation, detail } => {
            assert_eq!(owner_operation, SHARED_FIELD_INPUT);
            assert!(!detail.is_empty());
        }
        other => panic!("shared field must stay a named deferred input, got {other:?}"),
    }
}

#[test]
fn graph_reading_counts_equal_owner_fixture_counts_and_refs_round_trip() {
    let fixture = Fixture::new("counts", true);

    // Owner fixture counts, read directly through the pinned owners.
    let wiki: Value = fixture
        .client()
        .run("projectcentral.wiki.read", json!({"project": "GraphProj"}))
        .unwrap();
    assert_eq!(wiki["schema"], "central.wiki-reading/v1");
    let owner_spaces = wiki["counts"]["spaces"].as_u64().unwrap() as usize;
    let owner_wiki_nodes = wiki["counts"]["nodes"].as_u64().unwrap() as usize;
    let owner_edges = wiki["counts"]["edges"].as_u64().unwrap() as usize;
    assert_eq!((owner_spaces, owner_wiki_nodes, owner_edges), (2, 2, 4));
    let resolution = knowledge::call(
        &fixture.project_cwd(),
        &knowledge::Request::Resolve {
            query: "graph".into(),
        },
    )
    .unwrap();
    let owner_hits = resolution["hits"].as_array().expect("merged resolve returns typed hits").len();

    // The kernel adapter assembles the same ground through the typed op.
    let mut kernel = Kernel::new(fixture.client());
    let outcome = kernel
        .apply(KernelOp::Graph { project: Some("GraphProj".into()), query: "graph".into() })
        .unwrap();
    let KernelOpResult::GraphReading { reading } = outcome.result else {
        panic!("typed GraphReading result expected")
    };
    assert_eq!(reading.schema, GRAPH_READING_SCHEMA);
    assert!(outcome.receipts.is_empty(), "graph read is a pull; it emits nothing");
    assert!(reading.inputs.central_wiki.is_available());
    assert!(reading.inputs.aikit_resolution.is_available());
    assert_shared_field_named_deferred(&reading);

    // Counts equal the owner fixture counts, exactly.
    assert_eq!(reading.counts.spaces, owner_spaces, "spaces equal the C1 owner count");
    assert_eq!(reading.counts.wiki_nodes, owner_wiki_nodes, "wiki nodes equal the C1 owner count");
    assert_eq!(reading.counts.knowledge_rows, owner_hits, "rows equal the C2 owner count");
    assert_eq!(reading.counts.edges, owner_edges, "edges equal the C1 owner count");
    assert_eq!(reading.counts.nodes, owner_spaces + owner_wiki_nodes + owner_hits);

    // Every node ref round-trips through its owner read.
    let mut wiki_refs: Vec<&str> = wiki["spaces"].as_array().unwrap().iter()
        .chain(wiki["nodes"].as_array().unwrap().iter())
        .map(|entry| entry["ref"].as_str().unwrap())
        .collect();
    wiki_refs.sort();
    let mut hit_refs: Vec<&str> = resolution["hits"].as_array().unwrap().iter()
        .map(|hit| hit["resource"].as_str().unwrap())
        .collect();
    hit_refs.sort();
    for node in &reading.nodes {
        assert!(!node.ref_id.is_empty());
        assert!(!node.label.is_empty());
        match node.native_owner.as_str() {
            "central" => {
                assert!(wiki_refs.contains(&node.ref_id.as_str()), "{} round-trips through projectcentral.wiki.read", node.ref_id);
                assert_eq!(node.provenance.source, "projectcentral.wiki.read");
                assert_eq!(node.actions, vec!["projectcentral.wiki.read"]);
            }
            "ai-kit" => {
                assert!(hit_refs.contains(&node.ref_id.as_str()), "{} round-trips through aikit knowledge resolve", node.ref_id);
                assert_eq!(node.provenance.source, "aikit.knowledge.resolve");
                // The merged resolve discloses no per-node Action list and the
                // kernel invents none; provider + authority ride verbatim in
                // the provenance detail.
                assert_eq!(node.actions, Vec::<String>::new());
                assert!(!node.provenance.detail.is_empty(), "hit provider/authority carried verbatim");
            }
            other => panic!("unexpected native owner {other}"),
        }
    }
    // Every edge endpoint pair round-trips through the owner relation rows.
    let owner_relations: Vec<(String, String, String)> = wiki["relations"].as_array().unwrap().iter()
        .map(|r| (
            r["kind"].as_str().unwrap().to_owned(),
            r["from_ref"].as_str().unwrap().to_owned(),
            r["to_ref"].as_str().unwrap().to_owned(),
        ))
        .collect();
    assert_eq!(reading.edges.len(), owner_relations.len());
    for edge in &reading.edges {
        assert!(owner_relations.contains(&(edge.relation.clone(), edge.from_ref.clone(), edge.to_ref.clone())));
        assert_eq!(edge.provenance.source, "projectcentral.wiki.read");
    }

    let _ = fs::remove_dir_all(&fixture.root);
}

#[test]
fn absent_wiki_is_an_explicit_unavailable_input_not_an_empty_graph() {
    let fixture = Fixture::new("absent", false);

    // The owner itself reports the absent state for this ground.
    let refused = fixture
        .client()
        .run("projectcentral.wiki.read", json!({"project": "GraphProj"}));
    assert!(refused.is_err(), "the owner refuses an absent wiki");

    let mut kernel = Kernel::new(fixture.client());
    let outcome = kernel
        .apply(KernelOp::Graph { project: Some("GraphProj".into()), query: "graph".into() })
        .unwrap();
    let KernelOpResult::GraphReading { reading } = outcome.result else {
        panic!("typed GraphReading result expected")
    };

    // The failed input degrades honestly: named, explicit, carrying the
    // owner's own words — never an empty graph, never fabricated rows.
    match &reading.inputs.central_wiki {
        GraphInput::Unavailable { owner_operation, detail } => {
            assert_eq!(owner_operation, "projectcentral.wiki.read");
            assert!(detail.contains("wiki"), "owner message carried verbatim: {detail}");
        }
        other => panic!("absent wiki must be an explicit unavailable input, got {other:?}"),
    }
    assert!(reading.inputs.aikit_resolution.is_available(), "the healthy input still contributes");
    assert_shared_field_named_deferred(&reading);
    assert_eq!(reading.counts.spaces, 0);
    assert_eq!(reading.counts.wiki_nodes, 0);
    assert_eq!(reading.counts.edges, 0);
    assert!(reading.edges.is_empty(), "no wiki edges are fabricated");
    assert!(reading.nodes.iter().all(|node| node.native_owner == "ai-kit"),
        "only the healthy AIKit input contributes nodes");
    assert!(reading.counts.knowledge_rows > 0);
    assert_eq!(reading.counts.nodes, reading.counts.knowledge_rows);

    let _ = fs::remove_dir_all(&fixture.root);
}

#[test]
fn graph_reading_wire_shape_is_stable_and_inputs_are_named() {
    let fixture = Fixture::new("wire", true);
    let wire = serde_json::to_value(KernelOp::Graph {
        project: Some("GraphProj".into()),
        query: "graph".into(),
    })
    .unwrap();
    assert_eq!(wire["op"], "graph");
    assert_eq!(wire["project"], "GraphProj");
    assert_eq!(wire["query"], "graph");

    let mut kernel = Kernel::new(fixture.client());
    let outcome = kernel
        .apply(KernelOp::Graph { project: None, query: String::new() })
        .unwrap();
    let KernelOpResult::GraphReading { reading } = outcome.result else {
        panic!("typed GraphReading result expected")
    };
    let serialized = serde_json::to_value(&reading).unwrap();
    assert_eq!(serialized["schema"], GRAPH_READING_SCHEMA);
    // Named inputs are always all present on the wire.
    for name in ["central_wiki", "aikit_resolution", "shared_field"] {
        assert!(serialized["inputs"].get(name).is_some(), "input `{name}` is named on the wire");
    }
    assert_eq!(serialized["inputs"]["shared_field"]["state"], "deferred");
    assert_eq!(serialized["inputs"]["shared_field"]["owner_operation"], SHARED_FIELD_INPUT);
    // No persistence/cache surface exists on the reading.
    for forbidden in ["cache", "index", "rank", "persisted", "revision_log"] {
        assert!(serialized.get(forbidden).is_none(), "graph reading carries no `{forbidden}`");
    }

    let _ = fs::remove_dir_all(&fixture.root);
}
