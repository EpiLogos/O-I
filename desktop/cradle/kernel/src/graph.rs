//! Typed graph input assembly for U3.1/U3.4 presentation — adapter only.
//!
//! The graph reading composes three reviewed owner read models and nothing
//! else: Central's wiki reading (cell C1, `central.wiki.read` /
//! `projectcentral.wiki.read`, `central.wiki-reading/v1`), AIKit's
//! owner-side resolution rows (cell C2, `aikit knowledge resolve`,
//! `aikit.knowledge-resolution/v1`) and the hosted Shared Field projection
//! (Lane C step 5, `shared-field.projection`: the O:I-owned client's
//! `snapshot`, `oi.shared-field.snapshot/v1`). The kernel invents no
//! capability state: every node and edge carries the owner ref verbatim,
//! the owner operation that produced it, and that owner's own provenance
//! strings. Hosted refs are already world-qualified
//! (`world:central:project:O-I/…`), so they never collide with `central`
//! nodes; the desktop mints no second semantic object for them.
//!
//! Honest degradation: a failed owner input is reported as an explicit
//! unavailable input with the owner's message, never as an empty graph
//! and never as fabricated rows. An unbound Shared Field target is
//! absence — an explicit unavailable input carrying the client's reason.
//!
//! These are disposable owner readings, not a semantic store. The kernel
//! retains them in OwnerReadCache; each input can be requested independently
//! so local navigation never waits for an optional hosted-field request.
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::Path;

use crate::flow::{CentralClient, OwnerCallError};
use crate::knowledge;
use crate::shared_field;

pub const GRAPH_READING_SCHEMA: &str = "oi.cradle.graph-reading/v1";
/// The hosted Shared Field projection owner input (the O:I-owned client's
/// `snapshot`), named on every hosted node, edge and input state.
pub const SHARED_FIELD_INPUT: &str = shared_field::OWNER_OPERATION;

/// Independently loadable inputs. `All` preserves the earlier request shape;
/// the Wiki UI asks for the specific native inputs it actually displays.
#[derive(Clone, Copy, Debug, Default, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum InputSelection {
    #[default]
    All,
    CentralWiki,
    AikitResolution,
    SharedField,
}
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct ReadOptions {
    #[serde(default)]
    pub input: InputSelection,
    #[serde(default)]
    pub fresh: bool,
    #[serde(default = "node_budget")]
    pub max_nodes: usize,
    #[serde(default = "edge_budget")]
    pub max_edges: usize,
}
fn node_budget() -> usize {
    4096
}
fn edge_budget() -> usize {
    16384
}
impl Default for ReadOptions {
    fn default() -> Self {
        Self {
            input: InputSelection::All,
            fresh: false,
            max_nodes: node_budget(),
            max_edges: edge_budget(),
        }
    }
}
impl ReadOptions {
    pub fn validate(&self) -> Result<(), String> {
        if !(1..=20_000).contains(&self.max_nodes) || !(1..=100_000).contains(&self.max_edges) {
            return Err("Graph budgets require 1..=20000 nodes and 1..=100000 edges".into());
        }
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// The typed graph reading
// ---------------------------------------------------------------------------

/// Availability of one named owner input, stated explicitly. `Available`
/// names the owner operation that served it; `Unavailable` carries the
/// owner's own failure truth (`detail` is the owner message verbatim);
/// `Deferred` names an owner input that has not been requested yet.
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(tag = "state", rename_all = "snake_case")]
pub enum GraphInput {
    Available {
        owner_operation: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        detail: Option<String>,
    },
    Unavailable {
        owner_operation: String,
        detail: String,
    },
    Deferred {
        owner_operation: String,
        detail: String,
    },
}

impl GraphInput {
    fn unavailable(owner_operation: &str, error: &OwnerCallError) -> Self {
        Self::Unavailable {
            owner_operation: owner_operation.to_owned(),
            detail: error.detail(),
        }
    }

    pub fn is_available(&self) -> bool {
        matches!(self, Self::Available { .. })
    }
}

/// The named inputs of the graph reading. All three are always named on
/// the wire; a failed one is explicit — never an empty fabrication.
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct GraphInputs {
    pub central_wiki: GraphInput,
    pub aikit_resolution: GraphInput,
    pub shared_field: GraphInput,
}

/// Owner attribution carried beside every node and edge (02 §5).
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct GraphProvenance {
    /// The owner operation that produced this entry.
    pub source: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub revision: Option<String>,
    /// The owner's own provenance strings, carried verbatim.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub detail: Vec<String>,
}

/// One graph node: a stable owner ref with its kind, label, owner
/// provenance and the available Action refs the owner disclosed for it.
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct GraphNode {
    #[serde(rename = "ref")]
    pub ref_id: String,
    /// `wiki-space` | `wiki-node` | the AIKit resolution row kind
    /// (`file` | `flow` | `skill` | `knowledge-subject`) | the hosted
    /// Explore entry kind prefixed `hosted-` (`hosted-central-world` |
    /// `hosted-wiki-space` | `hosted-wiki-node` | `hosted-curated-artifact`
    /// | `hosted-contribution`).
    pub kind: String,
    pub label: String,
    /// The native owner holding this ref (`central` | `ai-kit` |
    /// `shared-field`).
    pub native_owner: String,
    pub provenance: GraphProvenance,
    /// Available Action refs the owner disclosed for this ref. AIKit rows
    /// carry theirs verbatim; Central wiki nodes name the wiki read that
    /// discloses them.
    #[serde(default)]
    pub actions: Vec<String>,
    #[serde(flatten, default)]
    pub metadata: std::collections::BTreeMap<String, Value>,
}

/// One typed relation edge: both endpoint refs in the owner's own
/// spelling, the typed relation, and the owner provenance.
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct GraphEdge {
    /// `space-child-space` | `space-node` | `node-space` | `node-source`,
    /// or a hosted Explore relation spelling carried verbatim
    /// (`wiki.contains` | `oi.world/wiki-space` | `oi.world/artifact` | …).
    pub relation: String,
    #[serde(rename = "from_ref")]
    pub from_ref: String,
    #[serde(rename = "to_ref")]
    pub to_ref: String,
    pub provenance: GraphProvenance,
    #[serde(flatten, default)]
    pub metadata: std::collections::BTreeMap<String, Value>,
}

/// Census of the assembled graph, derived from the assembled nodes and
/// edges only — every number is checkable against the owner fixtures.
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct GraphCounts {
    pub spaces: usize,
    pub wiki_nodes: usize,
    pub knowledge_rows: usize,
    /// Hosted Explore entries from the Shared Field snapshot (absent on
    /// the wire from older readers: serde default).
    #[serde(default)]
    pub hosted_rows: usize,
    pub nodes: usize,
    pub edges: usize,
}

/// The typed graph input for U3.1/U3.4 presentation.
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct GraphReading {
    pub schema: String,
    pub inputs: GraphInputs,
    #[serde(default)]
    pub nodes: Vec<GraphNode>,
    #[serde(default)]
    pub edges: Vec<GraphEdge>,
    pub counts: GraphCounts,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub formations: Vec<Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub shape_catalog: Option<Value>,
    #[serde(default)]
    pub truncated: bool,
}

impl GraphReading {
    fn empty() -> Self {
        Self {
            schema: GRAPH_READING_SCHEMA.into(),
            inputs: GraphInputs {
                central_wiki: GraphInput::Deferred {
                    owner_operation: "central.wiki.read".into(),
                    detail: "not requested yet".into(),
                },
                aikit_resolution: GraphInput::Deferred {
                    owner_operation: "aikit.knowledge.resolve".into(),
                    detail: "not requested yet".into(),
                },
                shared_field: GraphInput::Deferred {
                    owner_operation: SHARED_FIELD_INPUT.into(),
                    detail: "not requested yet".into(),
                },
            },
            nodes: Vec::new(),
            edges: Vec::new(),
            formations: Vec::new(),
            shape_catalog: None,
            truncated: false,
            counts: GraphCounts {
                spaces: 0,
                wiki_nodes: 0,
                knowledge_rows: 0,
                hosted_rows: 0,
                nodes: 0,
                edges: 0,
            },
        }
    }
}

// ---------------------------------------------------------------------------
// Assembly — three owner read models composed, adapter only
// ---------------------------------------------------------------------------

/// Assemble one typed graph reading over the disclosed Central ground.
///
/// `wiki_action` is the owner wiki read for the requested register
/// (`central.wiki.read` or `projectcentral.wiki.read`), `wiki_input` its
/// owner-shaped input, `cwd` the AIKit project context, and `query` the
/// AIKit resolution query (empty = all rows). The hosted Shared Field
/// snapshot needs no caller input: its target is the client's own
/// environment. One input failing degrades that input honestly; the
/// others still contribute.
pub fn assemble(
    client: &CentralClient,
    wiki_action: &str,
    wiki_input: &Value,
    cwd: &Path,
    query: &str,
) -> GraphReading {
    assemble_selected(
        client,
        wiki_action,
        wiki_input,
        cwd,
        query,
        &ReadOptions::default(),
    )
}

pub fn assemble_selected(
    client: &CentralClient,
    wiki_action: &str,
    wiki_input: &Value,
    cwd: &Path,
    query: &str,
    options: &ReadOptions,
) -> GraphReading {
    let mut reading = GraphReading::empty();

    // Input 1: Central wiki read model (cell C1).
    if matches!(
        options.input,
        InputSelection::All | InputSelection::CentralWiki
    ) {
        match client.run(wiki_action, wiki_input.clone()) {
            Ok(data) => {
                if data["schema"] == "central.wiki-reading/v1" {
                    reading.inputs.central_wiki = GraphInput::Available {
                        owner_operation: wiki_action.to_owned(),
                        detail: data["source"]["ref"].as_str().map(str::to_owned),
                    };
                    for space in data["spaces"].as_array().cloned().unwrap_or_default() {
                        let revision = space["revision"].as_u64().map(|value| value.to_string());
                        reading.nodes.push(GraphNode {
                            ref_id: space["ref"].as_str().unwrap_or_default().to_owned(),
                            kind: "wiki-space".into(),
                            label: space["title"].as_str().unwrap_or_default().to_owned(),
                            native_owner: "central".into(),
                            provenance: GraphProvenance {
                                source: wiki_action.to_owned(),
                                revision,
                                detail: Vec::new(),
                            },
                            actions: vec![wiki_action.to_owned()],
                            metadata: Default::default(),
                        });
                    }
                    for node in data["nodes"].as_array().cloned().unwrap_or_default() {
                        let revision = node["revision"].as_u64().map(|value| value.to_string());
                        reading.nodes.push(GraphNode {
                            ref_id: node["ref"].as_str().unwrap_or_default().to_owned(),
                            kind: "wiki-node".into(),
                            label: node["title"].as_str().unwrap_or_default().to_owned(),
                            native_owner: "central".into(),
                            provenance: GraphProvenance {
                                source: wiki_action.to_owned(),
                                revision,
                                detail: Vec::new(),
                            },
                            actions: vec![wiki_action.to_owned()],
                            metadata: Default::default(),
                        });
                    }
                    for relation in data["relations"].as_array().cloned().unwrap_or_default() {
                        reading.edges.push(GraphEdge {
                            relation: relation["kind"].as_str().unwrap_or_default().to_owned(),
                            from_ref: relation["from_ref"].as_str().unwrap_or_default().to_owned(),
                            to_ref: relation["to_ref"].as_str().unwrap_or_default().to_owned(),
                            provenance: GraphProvenance {
                                source: wiki_action.to_owned(),
                                revision: None,
                                detail: Vec::new(),
                            },
                            metadata: Default::default(),
                        });
                    }
                    reading.counts.spaces = data["counts"]["spaces"].as_u64().unwrap_or(0) as usize;
                    reading.counts.wiki_nodes =
                        data["counts"]["nodes"].as_u64().unwrap_or(0) as usize;
                } else {
                    reading.inputs.central_wiki = GraphInput::Unavailable {
                        owner_operation: wiki_action.to_owned(),
                        detail: "Central wiki read returned an unsupported schema".into(),
                    };
                }
            }
            Err(error) => {
                reading.inputs.central_wiki = GraphInput::unavailable(wiki_action, &error);
            }
        }
    }

    // Input 2: AIKit owner-side resolution hits (cell C2, merged Vāk surface:
    // ai-kit PR #258 landed one resolver contract; resolve returns typed
    // hits carrying resource, kind, label, provider and authority — the
    // owner's disclosure is coarser than C2's original rows, and the kernel
    // reflects it verbatim rather than inventing what the owner no longer
    // discloses).
    if options.input == InputSelection::AikitResolution {
        assemble_native_knowledge(&mut reading, cwd, query, options);
    } else if options.input == InputSelection::All {
        match knowledge::call(
            cwd,
            &knowledge::Request::Resolve {
                query: query.to_owned(),
            },
        ) {
            Ok(data) => {
                if data.get("hits").map(Value::is_array).unwrap_or(false) {
                    reading.inputs.aikit_resolution = GraphInput::Available {
                        owner_operation: "aikit.knowledge.resolve".into(),
                        detail: None,
                    };
                    let hits = data["hits"].as_array().cloned().unwrap_or_default();
                    reading.counts.knowledge_rows = hits.len();
                    for hit in hits {
                        let provider = hit["provider"].as_str().unwrap_or_default().to_owned();
                        let authority = hit["authority"].as_str().unwrap_or_default().to_owned();
                        let mut detail: Vec<String> = Vec::new();
                        if !provider.is_empty() {
                            detail.push(provider);
                        }
                        if !authority.is_empty() {
                            detail.push(authority);
                        }
                        reading.nodes.push(GraphNode {
                            ref_id: hit["resource"].as_str().unwrap_or_default().to_owned(),
                            kind: hit["kind"].as_str().unwrap_or_default().to_owned(),
                            label: hit["label"].as_str().unwrap_or_default().to_owned(),
                            native_owner: "ai-kit".into(),
                            provenance: GraphProvenance {
                                source: "aikit.knowledge.resolve".into(),
                                revision: None,
                                detail,
                            },
                            // The merged resolve discloses no per-node Action list;
                            // the kernel invents none (see module law).
                            actions: Vec::new(),
                            metadata: Default::default(),
                        });
                    }
                } else {
                    reading.inputs.aikit_resolution = GraphInput::Unavailable {
                        owner_operation: "aikit.knowledge.resolve".into(),
                        detail: "AIKit resolution returned an unsupported schema".into(),
                    };
                }
            }
            Err(error) => {
                reading.inputs.aikit_resolution = GraphInput::Unavailable {
                    owner_operation: "aikit.knowledge.resolve".into(),
                    detail: error,
                };
            }
        }
    }

    // Input 3: the hosted Shared Field projection (Lane C step 5) — the
    // O:I-owned client's caller-visible snapshot, pulled per call through
    // the owner doorway. Unbound / unavailable / refused / malformed are
    // one explicit unavailable input in the client's own words.
    if matches!(
        options.input,
        InputSelection::All | InputSelection::SharedField
    ) {
        match shared_field::call(&serde_json::json!({ "kind": "snapshot" })) {
            Ok(data) => assemble_shared_field(&mut reading, &data),
            Err(error) => {
                reading.inputs.shared_field = GraphInput::Unavailable {
                    owner_operation: SHARED_FIELD_INPUT.into(),
                    detail: error.detail(),
                };
            }
        }
    }

    reading.counts.nodes = reading.nodes.len();
    reading.counts.edges = reading.edges.len();
    reading
}

/// Fold one `oi.shared-field.snapshot/v1` reading into the graph: hosted
/// Explore entries as nodes (kind = the entry kind prefixed `hosted-`),
/// hosted Explore relations as edges (spelling and endpoints verbatim).
/// Provenance carries the hosting target and both revisions — the
/// projection revision of the entry's world and the entry's own revision.
pub fn assemble_shared_field(reading: &mut GraphReading, data: &Value) {
    if data["schema"] != "oi.shared-field.snapshot/v1" || !data["entries"].is_array() {
        reading.inputs.shared_field = GraphInput::Unavailable {
            owner_operation: SHARED_FIELD_INPUT.into(),
            detail: "SharedField client returned an unsupported snapshot schema".into(),
        };
        return;
    }
    let target = format!(
        "{}/{}",
        data["target"]["uri"].as_str().unwrap_or_default(),
        data["target"]["database"].as_str().unwrap_or_default()
    );
    reading.inputs.shared_field = GraphInput::Available {
        owner_operation: SHARED_FIELD_INPUT.into(),
        detail: Some(target.clone()),
    };
    let projections = data["projections"].as_array().cloned().unwrap_or_default();
    let entries = data["entries"].as_array().cloned().unwrap_or_default();
    reading.counts.hosted_rows = entries.len();
    for entry in entries {
        let entry_ref = entry["ref"].as_str().unwrap_or_default();
        let world_ref = entry["world_ref"].as_str().unwrap_or_default();
        // The projection revision of the entry's world: the projection
        // whose subject is the world; an entry that names its own
        // projection (`meta.projection_ref`) falls back to that one.
        let projection = projections
            .iter()
            .find(|p| p["subject"]["ref"].as_str() == Some(world_ref))
            .or_else(|| {
                let own = entry["meta"]["projection_ref"].as_str()?;
                projections
                    .iter()
                    .find(|p| p["projection_ref"].as_str() == Some(own))
            });
        let revision = projection
            .and_then(|p| p["projection_revision"].as_u64())
            .map(|value| value.to_string());
        let mut detail = vec![target.clone()];
        if let Some(entry_revision) = entry["revision"].as_str().filter(|value| !value.is_empty()) {
            detail.push(entry_revision.to_owned());
        }
        reading.nodes.push(GraphNode {
            ref_id: entry_ref.to_owned(),
            kind: format!("hosted-{}", entry["kind"].as_str().unwrap_or_default()),
            label: entry["label"].as_str().unwrap_or_default().to_owned(),
            native_owner: "shared-field".into(),
            provenance: GraphProvenance {
                source: SHARED_FIELD_INPUT.into(),
                revision,
                detail,
            },
            // The hosted field discloses no desktop Action for a
            // projected ref; the kernel invents none.
            actions: Vec::new(),
            metadata: Default::default(),
        });
    }
    for relation in data["relations"].as_array().cloned().unwrap_or_default() {
        reading.edges.push(GraphEdge {
            relation: relation["relation"].as_str().unwrap_or_default().to_owned(),
            from_ref: relation["from"].as_str().unwrap_or_default().to_owned(),
            to_ref: relation["to"].as_str().unwrap_or_default().to_owned(),
            provenance: GraphProvenance {
                source: SHARED_FIELD_INPUT.into(),
                revision: None,
                detail: vec![target.clone()],
            },
            metadata: Default::default(),
        });
    }
}

/// Consume the native metadata graph, retaining typed addresses, occurrence
/// identity and constellation membership instead of inventing them in React.
fn assemble_native_knowledge(
    reading: &mut GraphReading,
    cwd: &Path,
    query: &str,
    options: &ReadOptions,
) {
    let nodes = options.max_nodes.to_string();
    let edges = options.max_edges.to_string();
    let data = knowledge::run(
        cwd,
        &[
            "knowledge",
            "graph",
            "--max-nodes",
            &nodes,
            "--max-edges",
            &edges,
            "--",
            query,
        ],
    );
    match data {
        Ok(data) => {
            if data["schema"] != "aikit.knowledge-graph/v1"
                || !data["nodes"].is_array()
                || !data["edges"].is_array()
            {
                reading.inputs.aikit_resolution = GraphInput::Unavailable {
                    owner_operation: "aikit.knowledge.graph".into(),
                    detail: "Native graph returned an unsupported schema".into(),
                };
                return;
            }
            adapt_native_graph(reading, &data);
        }
        Err(error) => {
            reading.inputs.aikit_resolution = GraphInput::Unavailable {
                owner_operation: "aikit.knowledge.graph".into(),
                detail: format!("Native Wiki graph unavailable: {error:?}"),
            }
        }
    }
}

pub fn adapt_native_graph(reading: &mut GraphReading, data: &Value) {
    reading.inputs.aikit_resolution = GraphInput::Available {
        owner_operation: "aikit.knowledge.graph".into(),
        detail: data
            .get("absences")
            .filter(|v| v.as_array().is_some_and(|a| !a.is_empty()))
            .map(ToString::to_string),
    };
    for node in data["nodes"].as_array().into_iter().flatten() {
        let Some(reference) = node["resource"].as_str().filter(|r| !r.is_empty()) else {
            continue;
        };
        let mut metadata = std::collections::BTreeMap::new();
        for field in ["address", "tags", "aliases", "subject_ref", "frame_ref"] {
            if let Some(value) = node.get(field) {
                metadata.insert(field.to_string(), value.clone());
            }
        }
        reading.nodes.push(GraphNode {
            ref_id: reference.into(),
            label: node["label"].as_str().unwrap_or(reference).into(),
            kind: node["kind"].as_str().unwrap_or("knowledge-subject").into(),
            native_owner: "ai-kit".into(),
            provenance: GraphProvenance {
                source: "aikit.knowledge.graph".into(),
                revision: node["revision"].as_str().map(str::to_owned),
                detail: ["provider", "authority"]
                    .iter()
                    .filter_map(|key| node[*key].as_str().map(str::to_owned))
                    .collect(),
            },
            actions: Vec::new(),
            metadata,
        });
    }
    for edge in data["edges"].as_array().into_iter().flatten() {
        let (Some(from), Some(to), Some(relation)) = (
            edge["from"].as_str(),
            edge["to"].as_str(),
            edge["relation"].as_str(),
        ) else {
            continue;
        };
        let mut metadata = std::collections::BTreeMap::new();
        for field in ["reference", "authored_relation", "origin", "containment", "family", "standing", "from_subject_ref", "to_subject_ref", "from_participation_ref", "to_participation_ref"] {
            if let Some(value) = edge.get(field).filter(|v| !v.is_null()) {
                metadata.insert(field.to_string(), value.clone());
            }
        }
        reading.edges.push(GraphEdge {
            from_ref: from.into(),
            to_ref: to.into(),
            relation: relation.into(),
            provenance: GraphProvenance {
                source: "aikit.knowledge.graph".into(),
                revision: edge["origin"]["revision"].as_str().map(str::to_owned),
                detail: Vec::new(),
            },
            metadata,
        });
    }
    reading.formations = data["formations"].as_array().cloned().unwrap_or_default();
    reading.shape_catalog = data.get("shape_catalog").filter(|v| v["schema"] == "aikit.ql-authoring-forms/v1").cloned();
    reading.truncated = data["truncated"] == true;
    reading.counts.knowledge_rows = reading.nodes.len();
    reading.counts.nodes = reading.nodes.len();
    reading.counts.edges = reading.edges.len();
}

#[cfg(test)]
mod native_graph_tests {
    use super::*;
    #[test]
    fn native_addresses_occurrences_and_partial_wholes_survive_adaptation() {
        let mut reading = GraphReading::empty();
        let value = serde_json::json!({"nodes":[{"resource":"source:a","kind":"knowledge-source","label":"A","address":{"kind":"source","value":"source:a"},"tags":["reading"],"revision":"r1"}],"edges":[{"reference":"edge:one","from":"source:a","to":"source:a","relation":"references","authored_relation":{"source_ref":"source:a","anchor":{"start_byte":4,"end_byte":9}},"origin":{"revision":"1"}}],"formations":[{"ref":"frame:a","partial":true,"members":[{"ref":"source:a","role":"0"}]}],"truncated":true});
        adapt_native_graph(&mut reading, &value);
        let wire = serde_json::to_value(reading).unwrap();
        assert_eq!(wire["nodes"][0]["address"]["kind"], "source");
        assert_eq!(wire["edges"][0]["reference"], "edge:one");
        assert_eq!(wire["formations"][0]["partial"], true);
        assert_eq!(wire["truncated"], true);
    }
    #[test]
    fn graph_budgets_are_explicit_and_bounded() {
        assert!(ReadOptions::default().validate().is_ok());
        assert!(ReadOptions {
            max_nodes: 0,
            ..ReadOptions::default()
        }
        .validate()
        .is_err());
        assert!(ReadOptions {
            max_edges: 100_001,
            ..ReadOptions::default()
        }
        .validate()
        .is_err());
    }
}
