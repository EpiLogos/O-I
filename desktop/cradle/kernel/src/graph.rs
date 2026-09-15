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
//! No persistence, no cache, no index, no ranking: the reading is a pure
//! pull assembled per call.
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
    let mut reading = GraphReading::empty();

    // Input 1: Central wiki read model (cell C1).
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
                    });
                }
                reading.counts.spaces = data["counts"]["spaces"].as_u64().unwrap_or(0) as usize;
                reading.counts.wiki_nodes = data["counts"]["nodes"].as_u64().unwrap_or(0) as usize;
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

    // Input 2: AIKit owner-side resolution hits (cell C2, merged Vāk surface:
    // ai-kit PR #258 landed one resolver contract; resolve returns typed
    // hits carrying resource, kind, label, provider and authority — the
    // owner's disclosure is coarser than C2's original rows, and the kernel
    // reflects it verbatim rather than inventing what the owner no longer
    // discloses).
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

    // Input 3: the hosted Shared Field projection (Lane C step 5) — the
    // O:I-owned client's caller-visible snapshot, pulled per call through
    // the owner doorway. Unbound / unavailable / refused / malformed are
    // one explicit unavailable input in the client's own words.
    match shared_field::call(&serde_json::json!({ "kind": "snapshot" })) {
        Ok(data) => assemble_shared_field(&mut reading, &data),
        Err(error) => {
            reading.inputs.shared_field = GraphInput::Unavailable {
                owner_operation: SHARED_FIELD_INPUT.into(),
                detail: error.detail(),
            };
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
                projections.iter().find(|p| p["projection_ref"].as_str() == Some(own))
            });
        let revision = projection.and_then(|p| p["projection_revision"].as_u64()).map(|value| value.to_string());
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
        });
    }
}
