//! Parity with the pinned Obsidian 1.7.7 link resolver, asserted against the
//! campaign's captured oracle (`campaign-evidence/2026-10-07-obsidian-re/`,
//! verification gate 3). The fixture vault and the oracle travel with the
//! test so the contract holds in-repo, not only in the campaign workspace.

use oi_cradle_kernel::links::{build_cache, build_graph, GraphOptions, LinksIndex};
use serde_json::Value;
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

fn fixture_dir() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/obsidian-links-parity")
}

fn oracle() -> Value {
    let bytes = std::fs::read(fixture_dir().join("oracle.json")).expect("oracle fixture");
    serde_json::from_slice(&bytes).expect("oracle JSON")
}

/// Walk the fixture vault like the campaign walker: everything except
/// `.obsidian`, `/`-joined relative paths.
fn walk(dir: &Path, base: &str, out: &mut Vec<String>) {
    let mut entries: Vec<_> = std::fs::read_dir(dir)
        .expect("fixture vault")
        .flatten()
        .collect();
    entries.sort_by_key(|e| e.file_name());
    for entry in entries {
        let name = entry.file_name().to_string_lossy().into_owned();
        if name == ".obsidian" {
            continue;
        }
        let rel = if base.is_empty() {
            name.clone()
        } else {
            format!("{base}/{name}")
        };
        if entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
            walk(&entry.path(), &rel, out);
        } else {
            out.push(rel);
        }
    }
}

fn fixture_docs() -> BTreeMap<String, String> {
    let root = fixture_dir().join("vault");
    let mut rels = Vec::new();
    walk(&root, "", &mut rels);
    let mut docs = BTreeMap::new();
    for rel in rels {
        // Attachments are indexed but never parsed (their bytes are not
        // UTF-8 and never matter to resolution).
        let content = if oi_cradle_kernel::links::is_markdown(&rel) {
            std::fs::read_to_string(root.join(&rel)).expect("fixture file readable")
        } else {
            String::new()
        };
        docs.insert(rel, content);
    }
    docs
}

fn canonical(value: &Value) -> String {
    // The oracle was serialized with sorted keys (serde_json BTreeMap); the
    // comparison is on the mapping, not on serialization order.
    format!("{value:#?}")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

#[test]
fn resolved_and_unresolved_maps_match_the_live_oracle() {
    let docs = fixture_docs();
    let cache = build_cache(&docs);
    let oracle = oracle();
    let resolved = serde_json::to_value(&cache.resolved).unwrap();
    let unresolved = serde_json::to_value(&cache.unresolved).unwrap();
    assert_eq!(
        canonical(&resolved),
        canonical(&oracle["resolvedLinks"]),
        "resolvedLinks diverge from the 1.7.7 oracle"
    );
    assert_eq!(
        canonical(&unresolved),
        canonical(&oracle["unresolvedLinks"]),
        "unresolvedLinks diverge from the 1.7.7 oracle"
    );
}

#[test]
fn all_recorded_destination_probes_reproduce() {
    let docs = fixture_docs();
    let index = LinksIndex::new(docs.keys().cloned());
    let oracle = oracle();
    let probes = oracle["probes"].as_array().expect("probes");
    let mut failures = Vec::new();
    for probe in probes {
        let source = probe["source"].as_str().unwrap();
        let linktext = probe["linktext"].as_str().unwrap();
        let want = probe["dest"].as_str();
        let mine = if linktext.starts_with('#') {
            index.resolve_raw(source, linktext)
        } else {
            index.resolve(source, linktext)
        };
        let agree = match (mine.as_deref(), want) {
            (Some(mine), Some(want)) => mine.eq_ignore_ascii_case(want),
            (None, None) => true,
            _ => false,
        };
        if !agree {
            failures.push(format!(
                "{source} [[{linktext}]] -> mine={mine:?} live={want:?}"
            ));
        }
    }
    assert!(
        failures.is_empty(),
        "{} of {} probes diverge: {}",
        failures.len(),
        probes.len(),
        failures.join(" | ")
    );
}

#[test]
fn default_option_graph_matches_the_live_adjacency() {
    let docs = fixture_docs();
    let cache = build_cache(&docs);
    let paths: Vec<String> = docs.keys().cloned().collect();
    let graph = build_graph(&cache, &paths, &GraphOptions::default());
    let oracle = oracle();
    let live_edges: Vec<String> = oracle["live_graph"]["edges"]
        .as_array()
        .expect("live edges")
        .iter()
        .map(|e| e.as_str().unwrap().to_string())
        .collect();
    assert_eq!(
        graph.nodes.len(),
        oracle["live_graph"]["nodes"].as_u64().unwrap() as usize,
        "node count diverges"
    );
    let mine: Vec<String> = graph
        .edges
        .iter()
        .map(|(from, to)| format!("{from} --> {to}"))
        .collect();
    let mut a = mine.clone();
    let mut b = live_edges.clone();
    a.sort();
    b.sort();
    assert_eq!(a, b, "edge adjacency diverges from the live 1.7.7 graph");
}

#[test]
fn orphan_pruning_and_attachment_toggles_match_the_contract() {
    let docs = fixture_docs();
    let cache = build_cache(&docs);
    let paths: Vec<String> = docs.keys().cloned().collect();
    // Orphans off: self-loops never count, so SelfLoop.md and Orphan.md both
    // disappear (contract §4, live-verified in the campaign).
    let pruned = build_graph(
        &cache,
        &paths,
        &GraphOptions {
            show_orphans: false,
            ..GraphOptions::default()
        },
    );
    assert!(!pruned
        .nodes
        .iter()
        .any(|n| n == "SelfLoop.md" || n == "Orphan.md"));
    // Attachments on: the four attachment files become nodes.
    let shown = build_graph(
        &cache,
        &paths,
        &GraphOptions {
            show_attachments: true,
            ..GraphOptions::default()
        },
    );
    assert_eq!(shown.nodes.len(), 20, "attachments join the node set");
}
