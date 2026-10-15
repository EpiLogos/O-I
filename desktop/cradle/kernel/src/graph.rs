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
//! Input 4 is DERIVED, and says so: `oi.cradle.wiki-links/v1` parses the
//! markdown documents the wiki reading itself points at (`node-source`
//! targets), resolves their wikilinks by the campaign contract
//! (`links.rs`; parity with the pinned reference is a repo test), and emits
//! `wiki-link` edges whose endpoints are the owner's own source refs —
//! nothing is invented that the owner did not disclose; the derivation is
//! deterministic over owner reads and its provenance names them. Dangling
//! targets are not minted as nodes: they are carried as typed
//! `unresolved_links` beside the graph (a divergence from the reference
//! UI's phantom nodes, which this wire keeps out of the node set because a
//! node here must be an owner ref).
//!
//! Honest degradation: a failed owner input is reported as an explicit
//! unavailable input with the owner's message, never as an empty graph
//! and never as fabricated rows. An unbound Shared Field target is
//! absence — an explicit unavailable input carrying the client's reason.
//!
//! These are disposable owner readings, not a semantic store. The kernel
//! retains them in OwnerReadCache; each input can be requested independently
//! so local navigation never waits for an optional hosted-field request.
//! The owner reads of one request never wait on each other (the `All`
//! inputs are read beside each other, the derivation's documents
//! `READERS` at a time), and `PreparedGraph` runs a request's owner reads
//! outside the kernel mutex so two requests never wait on each other.
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, OnceLock};

use crate::flow::{CentralClient, OwnerCallError};
use crate::knowledge;
use crate::links;
use crate::read_cache::{self, OwnerReadCache};
use crate::shared_field;
use crate::{KernelOp, KernelOpOutcome, KernelOpResult};

pub const GRAPH_READING_SCHEMA: &str = "oi.cradle.graph-reading/v1";
/// The hosted Shared Field projection owner input (the O:I-owned client's
/// `snapshot`), named on every hosted node, edge and input state.
pub const SHARED_FIELD_INPUT: &str = shared_field::OWNER_OPERATION;
/// The derived wikilink contribution (input 4): deterministic resolution of
/// the wiki reading's own markdown sources; provenance names it derived.
pub const WIKI_LINKS_DERIVATION: &str = "oi.cradle.wiki-links/v1";
/// Derivation bounds: at most this many markdown documents are read per
/// graph assembly, and larger documents are skipped.
const WIKI_LINKS_MAX_DOCS: usize = 48;
const WIKI_LINKS_MAX_BYTES: usize = 512 * 1024;
/// Concurrent owner reads for the derivation's documents; each is its own
/// owner process (ported: expression_home.rs `READERS`).
const READERS: usize = 8;

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
    WikiLinks,
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

/// The named inputs of the graph reading. All are always named on the wire;
/// a failed one is explicit — never an empty fabrication. `wiki_links` is
/// the derived input (serde default keeps older cached readings decodable).
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct GraphInputs {
    pub central_wiki: GraphInput,
    pub aikit_resolution: GraphInput,
    pub shared_field: GraphInput,
    #[serde(default = "deferred_wiki_links")]
    pub wiki_links: GraphInput,
}

fn deferred_wiki_links() -> GraphInput {
    GraphInput::Deferred {
        owner_operation: WIKI_LINKS_DERIVATION.into(),
        detail: "not requested yet".into(),
    }
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
    /// Derived `wiki-link` edges from input 4 (serde default: absent on
    /// older readers).
    #[serde(default)]
    pub link_rows: usize,
    pub nodes: usize,
    pub edges: usize,
}

/// A dangling wikilink target from input 4: the normalized key, the source
/// documents that mention it with their occurrence counts, and derivation
/// provenance. Not a graph node — a node here must be an owner ref.
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct UnresolvedLink {
    pub key: String,
    /// Source ref → occurrence count.
    pub sources: BTreeMap<String, usize>,
    pub provenance: GraphProvenance,
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
    #[serde(default)]
    pub shape_catalog: Option<Value>,
    #[serde(default)]
    pub truncated: bool,
    /// Dangling wikilink targets from input 4 (serde default: absent on
    /// older readers).
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub unresolved_links: Vec<UnresolvedLink>,
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
                wiki_links: deferred_wiki_links(),
            },
            nodes: Vec::new(),
            edges: Vec::new(),
            formations: Vec::new(),
            shape_catalog: None,
            truncated: false,
            unresolved_links: Vec::new(),
            counts: GraphCounts {
                spaces: 0,
                wiki_nodes: 0,
                knowledge_rows: 0,
                hosted_rows: 0,
                link_rows: 0,
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
    match options.input {
        // Every owner input at once: the three owners are read beside each
        // other, so none waits on another, and fold in their fixed order.
        InputSelection::All => {
            let (wiki, resolution, hosted) = beside(
                || client.run(wiki_action, wiki_input.clone()),
                || {
                    knowledge::call(
                        cwd,
                        &knowledge::Request::Resolve {
                            query: query.to_owned(),
                        },
                    )
                },
                || shared_field::call(&serde_json::json!({ "kind": "snapshot" })),
            );
            fold_central_wiki(&mut reading, wiki_action, wiki);
            fold_resolution(
                &mut reading,
                resolution
                    .unwrap_or_else(|| Err("The AIKit resolution read did not return".into())),
            );
            fold_shared_field(
                &mut reading,
                hosted.unwrap_or_else(|| {
                    Err(shared_field::CallError::Unavailable {
                        detail: "The SharedField snapshot read did not return".into(),
                    })
                }),
            );
        }
        // Input 1: Central wiki read model (cell C1). Also read when the
        // derived wikilink input is selected — the derivation reads the
        // same owner disclosure.
        InputSelection::CentralWiki => {
            fold_central_wiki(
                &mut reading,
                wiki_action,
                client.run(wiki_action, wiki_input.clone()),
            );
        }
        // Input 4: derived wikilinks over the wiki reading's own markdown
        // sources (`node-source` targets), resolved by the campaign
        // contract. Explicitly selectable (`wiki_links`), NOT default-on:
        // the derivation reads each document through the owner's source
        // contract (one owner process per document, `READERS` at a time;
        // a document the owner's change horizon still gives the retained
        // revision is not read again). Bounded and honest: the input
        // reports what it derived from, and every derived element names
        // its derivation.
        InputSelection::WikiLinks => {
            let wiki = client.run(wiki_action, wiki_input.clone());
            match fold_central_wiki(&mut reading, wiki_action, wiki) {
                Some(data) => {
                    let (docs, over_budget, unreadable) = collect_wiki_link_documents(
                        client,
                        wiki_input["project"].as_str(),
                        &data,
                        retained_documents(),
                    );
                    assemble_wiki_links(&mut reading, &docs, wiki_action, over_budget, unreadable);
                }
                None => {
                    reading.inputs.wiki_links = GraphInput::Unavailable {
                        owner_operation: WIKI_LINKS_DERIVATION.into(),
                        detail: "derivation requires the Central wiki reading".into(),
                    };
                }
            }
        }
        // Input 2 alone: the native metadata graph (`aikit knowledge graph`).
        InputSelection::AikitResolution => {
            assemble_native_knowledge(&mut reading, cwd, query, options);
        }
        // Input 3: the hosted Shared Field projection (Lane C step 5) — the
        // O:I-owned client's caller-visible snapshot, pulled per call
        // through the owner doorway.
        InputSelection::SharedField => {
            fold_shared_field(
                &mut reading,
                shared_field::call(&serde_json::json!({ "kind": "snapshot" })),
            );
        }
    }
    reading.counts.nodes = reading.nodes.len();
    reading.counts.edges = reading.edges.len();
    reading
}

/// Run two owner reads on their own threads beside the caller's own read,
/// so no input waits on another. A read whose thread did not return is
/// `None`, and the caller names it unavailable.
fn beside<A, B, C>(
    own: impl FnOnce() -> A,
    second: impl FnOnce() -> B + Send,
    third: impl FnOnce() -> C + Send,
) -> (A, Option<B>, Option<C>)
where
    B: Send,
    C: Send,
{
    std::thread::scope(|scope| {
        let second = scope.spawn(second);
        let third = scope.spawn(third);
        let own = own();
        (own, second.join().ok(), third.join().ok())
    })
}

/// Fold Central's wiki read model (cell C1) into a reading. Returns the
/// owner data when the input is available — the derivation reads it.
fn fold_central_wiki(
    reading: &mut GraphReading,
    wiki_action: &str,
    result: Result<Value, OwnerCallError>,
) -> Option<Value> {
    let data = match result {
        Ok(data) => data,
        Err(error) => {
            reading.inputs.central_wiki = GraphInput::unavailable(wiki_action, &error);
            return None;
        }
    };
    if data["schema"] != "central.wiki-reading/v1" {
        reading.inputs.central_wiki = GraphInput::Unavailable {
            owner_operation: wiki_action.to_owned(),
            detail: "Central wiki read returned an unsupported schema".into(),
        };
        return None;
    }
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
            native_owner: "wiki".into(),
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
            native_owner: "wiki".into(),
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
    reading.counts.wiki_nodes = data["counts"]["nodes"].as_u64().unwrap_or(0) as usize;
    Some(data)
}

/// Fold AIKit's owner-side resolution hits (cell C2, merged Vāk surface:
/// ai-kit PR #258 landed one resolver contract; resolve returns typed hits
/// carrying resource, kind, label, provider and authority — the owner's
/// disclosure is coarser than C2's original rows, and the kernel reflects
/// it verbatim rather than inventing what the owner no longer discloses).
fn fold_resolution(reading: &mut GraphReading, result: Result<Value, String>) {
    let data = match result {
        Ok(data) => data,
        Err(error) => {
            reading.inputs.aikit_resolution = GraphInput::Unavailable {
                owner_operation: "aikit.knowledge.resolve".into(),
                detail: error,
            };
            return;
        }
    };
    if !data.get("hits").map(Value::is_array).unwrap_or(false) {
        reading.inputs.aikit_resolution = GraphInput::Unavailable {
            owner_operation: "aikit.knowledge.resolve".into(),
            detail: "AIKit resolution returned an unsupported schema".into(),
        };
        return;
    }
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
            // The merged resolve discloses no per-node Action list; the
            // kernel invents none (see module law).
            actions: Vec::new(),
            metadata: Default::default(),
        });
    }
}

/// Fold the hosted Shared Field snapshot. Unbound / unavailable / refused /
/// malformed are one explicit unavailable input in the client's own words.
fn fold_shared_field(reading: &mut GraphReading, result: Result<Value, shared_field::CallError>) {
    match result {
        Ok(data) => assemble_shared_field(reading, &data),
        Err(error) => {
            reading.inputs.shared_field = GraphInput::Unavailable {
                owner_operation: SHARED_FIELD_INPUT.into(),
                detail: error.detail(),
            };
        }
    }
}

/// Wikilink documents retained by the owner's own revision, shared by every
/// derivation in this process. Keys carry the owner route's epoch, so two
/// owners never share an entry; an entry is served only at the revision
/// the owner's change horizon still gives it, so no write needs to reach
/// it to keep it honest.
fn retained_documents() -> &'static Mutex<OwnerReadCache> {
    static DOCUMENTS: OnceLock<Mutex<OwnerReadCache>> = OnceLock::new();
    DOCUMENTS.get_or_init(Default::default)
}

/// The markdown documents input 4 derives from: the wiki reading's own
/// `node-source` targets (`.md` only), read through the owner's source
/// contract (`projectcentral.source.read`, which a wiki reading's source
/// refs round-trip through), bounded by `WIKI_LINKS_MAX_DOCS` /
/// `WIKI_LINKS_MAX_BYTES`. A document retained at the revision Central's
/// change horizon still gives it is served without a read; the horizon is
/// asked only when something is retained. Returns `(docs, over_budget,
/// unreadable)`; a source the owner refuses (one that does not participate
/// in the register) is `unreadable` — honest absence, never fabrication.
fn collect_wiki_link_documents(
    client: &CentralClient,
    project: Option<&str>,
    data: &Value,
    retained: &Mutex<OwnerReadCache>,
) -> (BTreeMap<String, String>, usize, usize) {
    let targets = extract_node_source_targets(data);
    let over_budget = targets.len().saturating_sub(WIKI_LINKS_MAX_DOCS);
    let targets: Vec<String> = targets.into_iter().take(WIKI_LINKS_MAX_DOCS).collect();
    let epoch = client.retained_resource_epoch();
    let key = |reference: &str| {
        format!(
            "graph-document:{epoch}:{}:{reference}",
            project.unwrap_or_default()
        )
    };
    let any_retained = {
        let retained = retained.lock().unwrap_or_else(|e| e.into_inner());
        targets
            .iter()
            .any(|target| retained.revision_of(&key(target)).is_some())
    };
    let horizon = if any_retained {
        change_horizon(client, project)
    } else {
        BTreeMap::new()
    };
    let mut docs = BTreeMap::new();
    let mut unread = Vec::new();
    {
        let retained = retained.lock().unwrap_or_else(|e| e.into_inner());
        for target in targets {
            let held = horizon
                .get(&target)
                .and_then(|revision| retained.get_at(&key(&target), revision));
            match held {
                Some(Value::String(content)) => {
                    docs.insert(target, content);
                }
                _ => unread.push(target),
            }
        }
    }
    let mut unreadable = 0usize;
    for (reference, reading) in unread.iter().zip(read_documents(client, project, &unread)) {
        match reading {
            Ok(reading)
                if reading.content_encoding == "utf-8"
                    && reading.content.len() <= WIKI_LINKS_MAX_BYTES =>
            {
                retained.lock().unwrap_or_else(|e| e.into_inner()).put_at(
                    key(reference),
                    reading.revision.revision,
                    Value::String(reading.content.clone()),
                );
                docs.insert(reference.clone(), reading.content);
            }
            _ => unreadable += 1,
        }
    }
    (docs, over_budget, unreadable)
}

/// Read each document through the owner's source contract, `READERS` at a
/// time, in order (ported: expression_home.rs `read_all`). A read whose
/// thread did not return is an error in its own place.
fn read_documents(
    client: &CentralClient,
    project: Option<&str>,
    references: &[String],
) -> Vec<Result<crate::flow::SourceReading, String>> {
    let mut readings = Vec::with_capacity(references.len());
    for chunk in references.chunks(READERS) {
        std::thread::scope(|scope| {
            let reads: Vec<_> = chunk
                .iter()
                .map(|reference| {
                    scope.spawn(move || {
                        client
                            .source_read(project, reference)
                            .map_err(|error| error.to_string())
                    })
                })
                .collect();
            readings.extend(reads.into_iter().map(|read| {
                read.join().unwrap_or_else(|_| {
                    Err("The owner read of this document did not return".into())
                })
            }));
        });
    }
    readings
}

/// The current revision of every participating source of the register that
/// Central still admits to agent retrieval, by source ref, from Central's own
/// change horizon in one owner call (the kernel's existing horizon read:
/// flow_cognition.rs `central_horizon`). A source the owner now withholds is
/// left out, so its retained reading is never served: it is asked again and
/// the owner answers. A horizon the owner does not give is empty: nothing
/// retained is trusted.
fn change_horizon(client: &CentralClient, project: Option<&str>) -> BTreeMap<String, String> {
    let Ok(value) = client.run(
        crate::flow_cognition::CENTRAL_HORIZON_ACTION,
        serde_json::json!({ "project": project }),
    ) else {
        return BTreeMap::new();
    };
    if value["schema"] != crate::flow_cognition::CENTRAL_HORIZON_SCHEMA {
        return BTreeMap::new();
    }
    value["sources"]
        .as_array()
        .into_iter()
        .flatten()
        .filter(|source| source["binding"]["agent_retrieval_allowed"] == true)
        .filter_map(|source| {
            Some((
                source["binding"]["ref"].as_str()?.to_owned(),
                source["revision"]["revision"].as_str()?.to_owned(),
            ))
        })
        .collect()
}

// ---------------------------------------------------------------------------
// The Graph op outside the kernel mutex
// ---------------------------------------------------------------------------

/// The Graph op's retained readings, shared by the kernel and the prepared
/// reads that run outside its mutex (a host binds one per kernel). Readings
/// are retained for `GRAPH_TTL` exactly as the ordered path retains them.
#[derive(Clone, Debug, Default)]
pub struct GraphReads(Arc<Mutex<OwnerReadCache>>);

impl GraphReads {
    /// Withdraw every retained and pending graph reading: the kernel calls
    /// this wherever it invalidates its `graph:` readings or the ground
    /// changes, so a read in flight is not retained after it.
    pub fn invalidate(&self) {
        self.0.lock().unwrap_or_else(|e| e.into_inner()).clear();
    }

    fn reads(&self) -> std::sync::MutexGuard<'_, OwnerReadCache> {
        self.0.lock().unwrap_or_else(|e| e.into_inner())
    }
}

/// One Graph op whose owner reads run outside the kernel mutex. Its
/// immutable inputs are captured under the lock (owner_read.rs: "Prepare
/// their immutable inputs under the kernel lock, then run owner processes
/// without holding the ordered mutation/event queue"); `execute` answers
/// with the same document the ordered path builds, so one input's slow
/// owner never holds another input, or any other kernel op, behind it.
pub struct PreparedGraph {
    client: CentralClient,
    world: Option<Value>,
    project: Option<String>,
    query: String,
    options: ReadOptions,
    reads: GraphReads,
}

impl PreparedGraph {
    /// `world` is the World reading the kernel already holds, if any.
    pub fn prepare(
        client: &CentralClient,
        world: Option<Value>,
        op: &KernelOp,
        reads: &GraphReads,
    ) -> Option<Self> {
        let KernelOp::Graph {
            project,
            query,
            options,
        } = op
        else {
            return None;
        };
        Some(Self {
            client: client.clone(),
            world,
            project: project.clone(),
            query: query.clone(),
            options: options.clone().unwrap_or_default(),
            reads: reads.clone(),
        })
    }

    pub fn execute(self) -> Result<KernelOpOutcome, String> {
        self.options.validate()?;
        let world = match self.world {
            Some(world) => world,
            None => {
                let held = self.reads.reads().get("world", read_cache::WORLD_TTL);
                match held {
                    Some(world) => world,
                    None => {
                        let world = crate::world::read_world(&self.client)?;
                        self.reads.reads().put("world".into(), world.clone());
                        world
                    }
                }
            }
        };
        let (wiki_action, wiki_input, cwd) = graph_scope(&world, self.project.as_deref())?;
        let key = graph_key(&cwd, &self.options, &self.query);
        // Hosted access/projection changes are always checked at its owner.
        let cacheable = matches!(
            self.options.input,
            InputSelection::CentralWiki | InputSelection::AikitResolution
        );
        let ticket = {
            let mut reads = self.reads.reads();
            if self.options.fresh {
                reads.invalidate(&key);
            } else if cacheable {
                let held = reads
                    .get(&key, read_cache::GRAPH_TTL)
                    .and_then(|value| serde_json::from_value::<GraphReading>(value).ok());
                if let Some(reading) = held {
                    return Ok(graph_outcome(reading));
                }
            }
            reads.begin(key.clone())
        };
        let reading = assemble_selected(
            &self.client,
            wiki_action,
            &wiki_input,
            &cwd,
            &self.query,
            &self.options,
        );
        let available = match self.options.input {
            InputSelection::CentralWiki => reading.inputs.central_wiki.is_available(),
            InputSelection::AikitResolution => reading.inputs.aikit_resolution.is_available(),
            _ => false,
        };
        let mut reads = self.reads.reads();
        // A reading the kernel invalidated while it was read is answered,
        // never retained.
        if reads.finish(&key, ticket) && cacheable && available {
            if let Ok(value) = serde_json::to_value(&reading) {
                reads.put(key, value);
            }
        }
        Ok(graph_outcome(reading))
    }
}

fn graph_outcome(reading: GraphReading) -> KernelOpOutcome {
    KernelOpOutcome {
        receipts: Vec::new(),
        result: KernelOpResult::GraphReading { reading },
    }
}

/// The register a Graph op reads, as Central discloses it (the ordered
/// path's own scope, lib.rs `KernelOp::Graph`): the wiki read and its input,
/// and the AIKit project context, both from the owner's World map.
fn graph_scope(
    world: &Value,
    project: Option<&str>,
) -> Result<(&'static str, Value, PathBuf), String> {
    let base = world["root"]
        .as_str()
        .ok_or("Central root location unavailable")?;
    let Some(project) = project else {
        return Ok((
            "central.wiki.read",
            serde_json::json!({}),
            PathBuf::from(base),
        ));
    };
    let row = world["work"]["projects"]
        .as_array()
        .and_then(|rows| rows.iter().find(|r| r["name"].as_str() == Some(project)))
        .ok_or("Project is outside Central's disclosed ground")?;
    let cwd = Path::new(base).join(row["path"].as_str().ok_or("Project location unavailable")?);
    Ok((
        "projectcentral.wiki.read",
        serde_json::json!({ "project": project }),
        cwd,
    ))
}

/// The retention key of one Graph request (the ordered path's own key).
fn graph_key(cwd: &Path, options: &ReadOptions, query: &str) -> String {
    format!(
        "graph:{}:{:?}:{}:{}:{}",
        cwd.display(),
        options.input,
        options.max_nodes,
        options.max_edges,
        query
    )
}

/// The `node-source` relation targets of one wiki reading that look like
/// markdown documents.
fn extract_node_source_targets(data: &Value) -> std::collections::BTreeSet<String> {
    data["relations"]
        .as_array()
        .cloned()
        .unwrap_or_default()
        .into_iter()
        .filter(|relation| relation["kind"].as_str() == Some("node-source"))
        .filter_map(|relation| relation["to_ref"].as_str().map(str::to_owned))
        .filter(|target| links::is_markdown(target))
        .collect()
}

/// Fold the derived wikilink contribution (input 4) into a reading:
/// `wiki-link` edges between the owner's own source refs, the referenced
/// source documents as `file` nodes, and every dangling target as a typed
/// `UnresolvedLink` — never as a node. Uniqueness per contract §4 (parallel
/// occurrences collapse into the edge, their count carried in metadata).
pub fn assemble_wiki_links(
    reading: &mut GraphReading,
    docs: &BTreeMap<String, String>,
    wiki_action: &str,
    over_budget: usize,
    unreadable: usize,
) {
    let _derivation = GraphProvenance {
        source: WIKI_LINKS_DERIVATION.into(),
        revision: None,
        detail: vec![format!("derived from {wiki_action}")],
    };
    let cache = links::build_cache(docs);
    let derivation = GraphProvenance {
        source: WIKI_LINKS_DERIVATION.into(),
        revision: None,
        detail: vec![format!("derived from {wiki_action}")],
    };
    for path in docs.keys() {
        let label = path.rsplit('/').next().unwrap_or(path).to_owned();
        reading.nodes.push(GraphNode {
            ref_id: path.clone(),
            kind: "file".into(),
            label,
            native_owner: "central".into(),
            provenance: derivation.clone(),
            actions: Vec::new(),
            metadata: Default::default(),
        });
    }
    let mut link_rows = 0usize;
    for (source, targets) in &cache.resolved {
        for (target, count) in targets {
            // Only pairs whose both endpoints were read join the wire;
            // attachment targets are indexed but are not documents.
            if !docs.contains_key(target) {
                continue;
            }
            let mut metadata = BTreeMap::new();
            metadata.insert("occurrences".into(), serde_json::json!(count));
            reading.edges.push(GraphEdge {
                relation: "wiki-link".into(),
                from_ref: source.clone(),
                to_ref: target.clone(),
                provenance: derivation.clone(),
                metadata,
            });
            link_rows += 1;
        }
    }
    let mut keys: BTreeMap<String, BTreeMap<String, usize>> = BTreeMap::new();
    for (source, unresolved) in &cache.unresolved {
        for (key, count) in unresolved {
            keys.entry(key.clone())
                .or_default()
                .insert(source.clone(), *count);
        }
    }
    reading.unresolved_links = keys
        .into_iter()
        .map(|(key, sources)| UnresolvedLink {
            key,
            sources,
            provenance: derivation.clone(),
        })
        .collect();
    reading.counts.link_rows = link_rows;
    let mut detail = format!("derived from {wiki_action} over {} documents", docs.len());
    if over_budget > 0 {
        detail.push_str(&format!(", {over_budget} over the document budget"));
    }
    if unreadable > 0 {
        detail.push_str(&format!(", {unreadable} unreadable"));
    }
    reading.inputs.wiki_links = GraphInput::Available {
        owner_operation: WIKI_LINKS_DERIVATION.into(),
        detail: Some(detail),
    };
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
        for field in [
            "reference",
            "authored_relation",
            "origin",
            "containment",
            "family",
            "standing",
            "from_subject_ref",
            "to_subject_ref",
            "from_participation_ref",
            "to_participation_ref",
        ] {
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
    reading.shape_catalog = data
        .get("shape_catalog")
        .filter(|v| v["schema"] == "aikit.ql-authoring-forms/v1")
        .cloned();
    reading.truncated = data["truncated"] == true;
    reading.counts.knowledge_rows = reading.nodes.len();
    reading.counts.nodes = reading.nodes.len();
    reading.counts.edges = reading.edges.len();
}

#[cfg(test)]
mod native_graph_tests {
    use super::*;

    #[test]
    fn derived_wiki_links_fold_owner_refs_with_counts_and_dangling_keys() {
        let mut reading = GraphReading::empty();
        let docs = BTreeMap::from([
            (
                "central:source:control:root:x/Alpha.md".to_string(),
                "# Alpha\nsee [[Beta]] and [[Beta|again]] and [[Missing]]\n".to_string(),
            ),
            (
                "central:source:control:root:x/Beta.md".to_string(),
                "# Beta\nback [[./Alpha]]\n".to_string(),
            ),
        ]);
        assemble_wiki_links(&mut reading, &docs, "central.wiki.read", 0, 0);
        // Alpha→Beta (2 occurrences) collapses to one unique-pair edge;
        // Beta→Alpha via the relative form joins Alpha's folder.
        assert_eq!(reading.counts.link_rows, 2);
        let alpha_edge = reading
            .edges
            .iter()
            .find(|e| e.from_ref.ends_with("Alpha.md"))
            .expect("alpha edge");
        assert_eq!(alpha_edge.relation, "wiki-link");
        assert!(alpha_edge.to_ref.ends_with("Beta.md"));
        assert_eq!(alpha_edge.metadata["occurrences"], 2);
        assert_eq!(alpha_edge.provenance.source, WIKI_LINKS_DERIVATION);
        // Source docs join as `file` nodes; dangling keys never do.
        assert!(reading
            .nodes
            .iter()
            .any(|n| n.kind == "file" && n.ref_id.ends_with("Alpha.md")));
        assert!(!reading.nodes.iter().any(|n| n.kind == "unresolved-link"));
        assert_eq!(reading.unresolved_links.len(), 1);
        assert_eq!(reading.unresolved_links[0].key, "Missing");
        assert_eq!(reading.unresolved_links[0].sources.len(), 1);
        assert!(reading.inputs.wiki_links.is_available());
    }

    #[test]
    fn node_source_targets_extract_md_only_and_skip_empties() {
        let data = serde_json::json!({"relations": [
            {"kind": "node-source", "to_ref": "central:source:control:root:a.md"},
            {"kind": "node-source", "to_ref": "central:source:control:root:img.png"},
            {"kind": "space-node", "to_ref": "central:source:control:root:b.md"},
            {"kind": "node-source", "to_ref": ""}
        ]});
        assert_eq!(extract_node_source_targets(&data).len(), 1);
    }

    #[test]
    fn old_readings_without_the_derived_input_still_decode() {
        // Wire compatibility: a cached reading from before input 4 existed
        // deserializes with the derived input deferred and zero link rows.
        let legacy = serde_json::json!({
            "schema": GRAPH_READING_SCHEMA,
            "inputs": {
                "central_wiki": {"state": "deferred", "owner_operation": "central.wiki.read", "detail": "x"},
                "aikit_resolution": {"state": "deferred", "owner_operation": "aikit.knowledge.resolve", "detail": "x"},
                "shared_field": {"state": "deferred", "owner_operation": SHARED_FIELD_INPUT, "detail": "x"}
            },
            "counts": {"spaces": 0, "wiki_nodes": 0, "knowledge_rows": 0, "nodes": 0, "edges": 0}
        });
        let decoded: GraphReading = serde_json::from_value(legacy).expect("legacy reading decodes");
        assert!(!decoded.inputs.wiki_links.is_available());
        assert_eq!(decoded.counts.link_rows, 0);
    }

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

/// The owner reads of the Graph op over a fake Central owner: the
/// derivation's parallel document reads, their revision retention, the
/// `All` inputs read beside each other, and the prepared read that runs
/// outside the kernel mutex.
#[cfg(test)]
mod owner_read_tests {
    use super::*;
    use std::fs;
    use std::time::{Duration, Instant};

    /// A fake Central owner over a temporary ground: `central.world`,
    /// `central.wiki.read` (a root wiki whose `node-source` targets are the
    /// files under `docs/`, plus one source that does not participate),
    /// `projectcentral.source.read` and `projectcentral.change.horizon`,
    /// in Central's shapes. Every call is logged by action name; source
    /// reads also log how many were in flight at once. It is not Central.
    struct Ground(PathBuf);

    impl Ground {
        fn new(tag: &str, documents: &[(&str, &str)]) -> Self {
            let base = std::env::temp_dir().join(format!(
                "graph-owner-{tag}-{}-{}",
                std::process::id(),
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_nanos()
            ));
            fs::create_dir_all(base.join("docs")).unwrap();
            fs::create_dir_all(base.join("inflight")).unwrap();
            let ground = Self(base);
            for (name, content) in documents {
                ground.write(name, content);
            }
            let owner = ground.0.join("owner");
            fs::write(&owner, r#"#!/usr/bin/env python3
import hashlib, json, os, pathlib, sys, time, uuid
args = sys.argv[1:]
root = pathlib.Path(args[args.index('--root') + 1])
name, request = args[-2], json.loads(args[-1])
with open(root / 'calls.log', 'a') as log: log.write(name + '\n')
def answer(data): print(json.dumps({'ok': True, 'data': data}))
def refuse(message): print(json.dumps({'ok': False, 'error': {'message': message}})); sys.exit(2)
def ref(path): return 'central:source:control:root:' + path
def revision(path): return 'fnv:' + hashlib.sha256((root / path).read_bytes()).hexdigest()[:16]
docs = sorted('docs/' + p.name for p in (root / 'docs').iterdir())
participating = [p for p in docs if 'outside' not in p]
withheld = (root / 'withheld').read_text().split() if (root / 'withheld').exists() else []
if name == 'central.world':
    answer({'schema': 'central.world-map/v1', 'root': str(root), 'work': {'projects': []}})
elif name == 'central.wiki.read':
    if (root / 'no-wiki').exists(): refuse('Central wiki source is absent')
    relations = [{'kind': 'node-source', 'from_ref': 'wiki:node:n', 'to_ref': ref(p)} for p in docs]
    answer({'schema': 'central.wiki-reading/v1', 'source': {'ref': ref('wiki.json')}, 'spaces': [],
            'nodes': [{'ref': 'wiki:node:n', 'title': 'N', 'revision': 1}], 'relations': relations,
            'counts': {'spaces': 0, 'nodes': 1}})
elif name == 'projectcentral.source.read':
    path = request['source_ref'][len(ref('')):]
    if path not in participating: refuse('source_ref is not a participating source of the requested World')
    if path in withheld: refuse('source is excluded from agent retrieval')
    mark = root / 'inflight' / uuid.uuid4().hex
    mark.touch(); time.sleep(0.4)
    with open(root / 'concurrency.log', 'a') as log: log.write(str(len(os.listdir(root / 'inflight'))) + '\n')
    mark.unlink()
    content = (root / path).read_text()
    answer({'schema': 'central.project-world-source-reading/v1', 'world_ref': 'control:root',
            'source': {'ref': request['source_ref'], 'path': path, 'exists': True, 'agent_retrieval_allowed': True},
            'revision': {'revision': revision(path), 'byte_len': len(content)}, 'content': content,
            'content_encoding': 'utf-8', 'automatic_agent_or_model_invocation': False})
elif name == 'projectcentral.change.horizon':
    answer({'schema': 'central.source-change-horizon/v1', 'cursor': 1, 'changes': [],
            'sources': [{'binding': {'ref': ref(p), 'agent_retrieval_allowed': p not in withheld},
                         'revision': {'revision': revision(p), 'byte_len': 0}} for p in participating]})
else:
    refuse('Unexpected owner action ' + name)
"#).unwrap();
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(&owner, fs::Permissions::from_mode(0o700)).unwrap();
            crate::test_stub::settle_stub(&owner);
            ground
        }

        fn write(&self, name: &str, content: &str) {
            fs::write(self.0.join("docs").join(name), content).unwrap();
        }

        fn client(&self) -> CentralClient {
            CentralClient::with(self.0.join("owner"), Some(self.0.clone()), "test".into())
        }

        fn reference(name: &str) -> String {
            format!("central:source:control:root:docs/{name}")
        }

        /// Owner calls since the last look, by action name.
        fn calls(&self) -> BTreeMap<String, usize> {
            let path = self.0.join("calls.log");
            let mut calls = BTreeMap::new();
            for line in fs::read_to_string(&path).unwrap_or_default().lines() {
                *calls.entry(line.to_owned()).or_insert(0) += 1;
            }
            let _ = fs::remove_file(path);
            calls
        }

        fn most_in_flight(&self) -> usize {
            fs::read_to_string(self.0.join("concurrency.log"))
                .unwrap_or_default()
                .lines()
                .filter_map(|line| line.parse().ok())
                .max()
                .unwrap_or(0)
        }
    }

    impl Drop for Ground {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    fn calls(pairs: &[(&str, usize)]) -> BTreeMap<String, usize> {
        pairs
            .iter()
            .map(|(name, count)| (name.to_string(), *count))
            .collect()
    }

    #[test]
    fn documents_are_read_beside_each_other_in_order_within_the_reader_bound() {
        let names: Vec<String> = (0..2 * READERS + 3)
            .map(|n| format!("d{n:02}.md"))
            .collect();
        let mut documents: Vec<(&str, &str)> =
            names.iter().map(|n| (n.as_str(), "# body")).collect();
        documents.push(("outside.md", "# not participating"));
        let ground = Ground::new("order", &documents);
        let mut references: Vec<String> = names.iter().map(|n| Ground::reference(n)).collect();
        // The refused one sits in the middle: its error keeps its own place.
        references.insert(5, Ground::reference("outside.md"));
        let readings = read_documents(&ground.client(), None, &references);
        assert_eq!(readings.len(), references.len());
        for (reference, reading) in references.iter().zip(&readings) {
            match reading {
                Ok(reading) => assert_eq!(&reading.source.source_ref, reference),
                Err(error) => {
                    assert!(reference.ends_with("outside.md"), "{reference}: {error}");
                    assert!(error.contains("not a participating source"), "{error}");
                }
            }
        }
        assert_eq!(readings.iter().filter(|r| r.is_err()).count(), 1);
        let most = ground.most_in_flight();
        assert!(
            most <= READERS,
            "{most} owner reads in flight exceeds {READERS}"
        );
        assert!(most > 1, "the documents were read one at a time");
    }

    #[test]
    fn a_retained_document_is_read_again_only_when_its_owner_revision_moves() {
        let ground = Ground::new(
            "revision",
            &[
                ("Alpha.md", "# Alpha\nsee [[Beta]]\n"),
                ("Beta.md", "# Beta\nback [[Alpha]]\n"),
                ("outside.md", "# not participating"),
            ],
        );
        let client = ground.client();
        let wiki = client
            .run("central.wiki.read", serde_json::json!({}))
            .unwrap();
        ground.calls();
        let retained = Mutex::new(OwnerReadCache::default());

        // Cold: every document is read; nothing is retained, so the horizon
        // is not asked.
        let (docs, over, unreadable) = collect_wiki_link_documents(&client, None, &wiki, &retained);
        assert_eq!((docs.len(), over, unreadable), (2, 0, 1));
        assert_eq!(ground.calls(), calls(&[("projectcentral.source.read", 3)]));

        // Unmoved: one horizon read; only the source the owner gives no
        // revision for (it refuses it) is asked again.
        let (again, _, unreadable) = collect_wiki_link_documents(&client, None, &wiki, &retained);
        assert_eq!(again, docs);
        assert_eq!(unreadable, 1);
        assert_eq!(
            ground.calls(),
            calls(&[
                ("projectcentral.change.horizon", 1),
                ("projectcentral.source.read", 1)
            ])
        );

        // Moved: the changed document alone is read again, at its new content.
        ground.write("Beta.md", "# Beta\nnow [[Gamma]]\n");
        let (moved, _, _) = collect_wiki_link_documents(&client, None, &wiki, &retained);
        assert_eq!(
            ground.calls(),
            calls(&[
                ("projectcentral.change.horizon", 1),
                ("projectcentral.source.read", 2)
            ])
        );
        assert_eq!(
            moved[&Ground::reference("Beta.md")],
            "# Beta\nnow [[Gamma]]\n"
        );
        assert_eq!(
            moved[&Ground::reference("Alpha.md")],
            docs[&Ground::reference("Alpha.md")]
        );

        // Withheld at an unmoved revision: the retained reading is not served;
        // the owner is asked and its refusal counts the document unreadable.
        fs::write(ground.0.join("withheld"), "docs/Alpha.md").unwrap();
        let (withheld, _, unreadable) =
            collect_wiki_link_documents(&client, None, &wiki, &retained);
        assert!(!withheld.contains_key(&Ground::reference("Alpha.md")));
        assert_eq!(unreadable, 2);
        assert_eq!(
            ground.calls(),
            calls(&[
                ("projectcentral.change.horizon", 1),
                ("projectcentral.source.read", 2)
            ])
        );
    }

    #[test]
    fn the_derived_input_reads_the_wiki_and_its_documents_through_the_owner() {
        let ground = Ground::new(
            "derive",
            &[
                ("Alpha.md", "# Alpha\nsee [[Beta]] and [[Missing]]\n"),
                ("Beta.md", "# Beta\nback [[Alpha]]\n"),
                ("outside.md", "# not participating"),
            ],
        );
        let options = ReadOptions {
            input: InputSelection::WikiLinks,
            ..ReadOptions::default()
        };
        let reading = assemble_selected(
            &ground.client(),
            "central.wiki.read",
            &serde_json::json!({}),
            &ground.0,
            "",
            &options,
        );
        assert!(reading.inputs.central_wiki.is_available());
        assert_eq!(reading.counts.link_rows, 2);
        assert_eq!(reading.unresolved_links.len(), 1);
        match &reading.inputs.wiki_links {
            GraphInput::Available { detail, .. } => assert_eq!(
                detail.as_deref(),
                Some("derived from central.wiki.read over 2 documents, 1 unreadable")
            ),
            other => panic!("the derived input is available: {other:?}"),
        }

        // No wiki reading: the derivation is an explicit unavailable input.
        fs::write(ground.0.join("no-wiki"), "").unwrap();
        let reading = assemble_selected(
            &ground.client(),
            "central.wiki.read",
            &serde_json::json!({}),
            &ground.0,
            "",
            &options,
        );
        match (&reading.inputs.central_wiki, &reading.inputs.wiki_links) {
            (
                GraphInput::Unavailable { detail: wiki, .. },
                GraphInput::Unavailable { detail, .. },
            ) => {
                assert!(wiki.contains("Central wiki source is absent"), "{wiki}");
                assert_eq!(detail, "derivation requires the Central wiki reading");
            }
            other => panic!("both inputs are explicitly unavailable: {other:?}"),
        }
        assert!(reading.nodes.is_empty() && reading.edges.is_empty());
    }

    #[test]
    fn the_inputs_of_one_request_are_read_beside_each_other() {
        let pause = Duration::from_millis(300);
        let span = || {
            let start = Instant::now();
            std::thread::sleep(pause);
            (start, Instant::now())
        };
        let started = Instant::now();
        let (first, second, third) = beside(span, span, span);
        let (second, third) = (second.unwrap(), third.unwrap());
        let spans = [first, second, third];
        // Every read began before any read ended: none waited on another.
        let last_start = spans.iter().map(|span| span.0).max().unwrap();
        let first_end = spans.iter().map(|span| span.1).min().unwrap();
        assert!(last_start < first_end);
        assert!(started.elapsed() < pause * 3);
        // A read whose thread did not return is named, not dropped.
        let (own, lost, kept) = beside(|| 1, || -> u8 { panic!("owner read lost") }, || 3);
        assert_eq!((own, lost, kept), (1, None, Some(3)));
    }

    #[test]
    fn a_prepared_graph_read_runs_while_the_kernel_is_locked_and_retains_by_request() {
        let ground = Ground::new("prepared", &[("Alpha.md", "# Alpha\n")]);
        let client = ground.client();
        let kernel = Mutex::new(crate::Kernel::new(client.clone()));
        let reads = GraphReads::default();
        let op = |fresh: bool| KernelOp::Graph {
            project: None,
            query: String::new(),
            options: Some(ReadOptions {
                input: InputSelection::CentralWiki,
                fresh,
                ..ReadOptions::default()
            }),
        };
        let wiki_nodes = |outcome: KernelOpOutcome| match outcome.result {
            KernelOpResult::GraphReading { reading } => {
                assert!(reading.inputs.central_wiki.is_available());
                reading.counts.wiki_nodes
            }
            other => panic!("a graph reading: {other:?}"),
        };
        // The kernel stays locked for the whole read: nothing in it waits.
        let held = kernel.lock().unwrap();
        let prepared = PreparedGraph::prepare(&client, None, &op(false), &reads).unwrap();
        assert_eq!(wiki_nodes(prepared.execute().unwrap()), 1);
        drop(held);
        assert_eq!(
            ground.calls(),
            calls(&[("central.wiki.read", 1), ("central.world", 1)])
        );
        // Retained by request, and the World with it.
        let prepared = PreparedGraph::prepare(&client, None, &op(false), &reads).unwrap();
        assert_eq!(wiki_nodes(prepared.execute().unwrap()), 1);
        assert!(ground.calls().is_empty());
        // `fresh` reads again; so does a read after the kernel invalidates.
        let prepared = PreparedGraph::prepare(&client, None, &op(true), &reads).unwrap();
        assert_eq!(wiki_nodes(prepared.execute().unwrap()), 1);
        assert_eq!(ground.calls(), calls(&[("central.wiki.read", 1)]));
        reads.invalidate();
        let prepared = PreparedGraph::prepare(&client, None, &op(false), &reads).unwrap();
        assert_eq!(wiki_nodes(prepared.execute().unwrap()), 1);
        assert_eq!(
            ground.calls(),
            calls(&[("central.wiki.read", 1), ("central.world", 1)])
        );
        // Only the Graph op prepares here; budgets are still refused.
        assert!(PreparedGraph::prepare(&client, None, &KernelOp::WorldRead, &reads).is_none());
        let unbounded = KernelOp::Graph {
            project: None,
            query: String::new(),
            options: Some(ReadOptions {
                max_nodes: 0,
                ..ReadOptions::default()
            }),
        };
        let prepared = PreparedGraph::prepare(&client, None, &unbounded, &reads).unwrap();
        assert!(prepared.execute().is_err());
    }
}

/// Real-ground timing of the Graph op (and of what waits behind it). Ignored
/// and env-gated: it spawns the installed suite against the owner's real
/// ground, so it never runs in CI. Owner processes are counted from
/// `OI_SHIM_LOG` when a measuring wrapper on the owner executables appends
/// one line per process (` aikit` lines are AIKit, `shared-field-client`
/// lines are the hosted field, the rest are Central).
///
/// `OI_GRAPH_REAL_GROUND=1 cargo test --lib graph::real_ground -- --ignored --nocapture --test-threads=1`
#[cfg(test)]
mod real_ground {
    use super::*;
    use crate::{Kernel, KernelOp, KernelOpOutcome, KernelOpResult};
    use std::sync::{Arc, Mutex};
    use std::time::Instant;

    fn enabled() -> bool {
        std::env::var_os("OI_GRAPH_REAL_GROUND").is_some()
    }

    /// Owner processes logged so far: (central, aikit, hosted field).
    fn calls() -> [usize; 3] {
        let log = std::env::var_os("OI_SHIM_LOG")
            .and_then(|path| std::fs::read_to_string(path).ok())
            .unwrap_or_default();
        let mut counts = [0; 3];
        for line in log.lines() {
            let owner = if line.contains("shared-field-client") {
                2
            } else if line.contains(" aikit") {
                1
            } else {
                0
            };
            counts[owner] += 1;
        }
        counts
    }

    fn delta(before: [usize; 3]) -> String {
        let after = calls();
        format!(
            "central={} aikit={} field={}",
            after[0] - before[0],
            after[1] - before[1],
            after[2] - before[2]
        )
    }

    fn graph_op(input: InputSelection) -> KernelOp {
        KernelOp::Graph {
            project: None,
            query: String::new(),
            options: Some(ReadOptions {
                input,
                ..ReadOptions::default()
            }),
        }
    }

    fn state(input: &GraphInput) -> String {
        match input {
            GraphInput::Available { detail, .. } => match detail {
                Some(detail) => format!(
                    "available ({})",
                    detail.chars().take(90).collect::<String>()
                ),
                None => "available".into(),
            },
            GraphInput::Unavailable { detail, .. } => {
                format!(
                    "UNAVAILABLE ({})",
                    detail.chars().take(140).collect::<String>()
                )
            }
            GraphInput::Deferred { .. } => "-".into(),
        }
    }

    fn describe(outcome: &Result<KernelOpOutcome, String>) -> String {
        match outcome {
            Ok(KernelOpOutcome {
                result: KernelOpResult::GraphReading { reading },
                ..
            }) => format!(
                "nodes={} edges={} | central_wiki: {} | aikit_resolution: {} | shared_field: {} | wiki_links: {}",
                reading.counts.nodes,
                reading.counts.edges,
                state(&reading.inputs.central_wiki),
                state(&reading.inputs.aikit_resolution),
                state(&reading.inputs.shared_field),
                state(&reading.inputs.wiki_links)
            ),
            Ok(_) => "answered".into(),
            Err(error) => format!("ERR {}", error.chars().take(160).collect::<String>()),
        }
    }

    /// The host's own sequence for one op (src-tauri `kernel_op`, the
    /// walk-bridge `/op`): an owner read prepared under the kernel lock runs
    /// outside it; a knowledge read runs outside and finishes under it;
    /// everything else applies under the lock.
    fn host(kernel: &Mutex<Kernel>, op: KernelOp) -> Result<KernelOpOutcome, String> {
        let read = kernel.lock().unwrap().prepare_owner_read(&op);
        if let Some(read) = read {
            return read.execute();
        }
        let knowledge = kernel.lock().unwrap().prepare_knowledge(&op)?;
        if let Some(prepared) = knowledge {
            let completed = prepared.execute()?;
            return kernel.lock().unwrap().finish_knowledge(completed);
        }
        kernel.lock().unwrap().apply(op)
    }

    #[test]
    #[ignore = "measures the real ground: OI_GRAPH_REAL_GROUND=1, never in CI"]
    fn real_ground_each_input_cold_then_warm() {
        if !enabled() {
            return;
        }
        for input in [
            InputSelection::CentralWiki,
            InputSelection::SharedField,
            InputSelection::AikitResolution,
            InputSelection::WikiLinks,
            InputSelection::All,
        ] {
            // A new kernel retains nothing: the first read is cold.
            let mut kernel = Kernel::discover();
            for pass in ["cold", "warm"] {
                let before = calls();
                let start = Instant::now();
                let outcome = kernel.apply(graph_op(input));
                eprintln!(
                    "MEASURE {input:?} {pass}: {:.2}s {} | {}",
                    start.elapsed().as_secs_f64(),
                    delta(before),
                    describe(&outcome)
                );
            }
        }
    }

    #[test]
    #[ignore = "measures the real ground: OI_GRAPH_REAL_GROUND=1, never in CI"]
    fn real_ground_inputs_asked_together_through_the_host_lock() {
        if !enabled() {
            return;
        }
        // The shell asks per input at once (graphProgress.ts, the atlas's
        // suite provider); a Technē file listing arrives beside them.
        let kernel = Arc::new(Mutex::new(Kernel::discover()));
        let start = Instant::now();
        // AIKit's input is asked first (graphProgress.ts asks it first), the
        // others a moment after it.
        let mut asks: Vec<(String, KernelOp)> = [
            InputSelection::AikitResolution,
            InputSelection::CentralWiki,
            InputSelection::SharedField,
        ]
        .into_iter()
        .map(|input| (format!("graph {input:?}"), graph_op(input)))
        .collect();
        asks.push((
            "files_list Control/agents/wiki".into(),
            KernelOp::FilesList {
                path: "Control/agents/wiki".into(),
                fresh: Some(true),
            },
        ));
        let handles: Vec<_> = asks
            .into_iter()
            .enumerate()
            .map(|(index, (name, op))| {
                let kernel = Arc::clone(&kernel);
                std::thread::sleep(std::time::Duration::from_millis(if index == 1 {
                    200
                } else {
                    0
                }));
                std::thread::spawn(move || {
                    let outcome = host(&kernel, op);
                    (name, start.elapsed().as_secs_f64(), describe(&outcome))
                })
            })
            .collect();
        for handle in handles {
            let (name, seconds, described) = handle.join().unwrap();
            eprintln!("MEASURE together {name}: answered at {seconds:.2}s | {described}");
        }
    }

    #[test]
    #[ignore = "measures the real ground: OI_GRAPH_REAL_GROUND=1, never in CI"]
    fn real_ground_inputs_asked_together_with_the_prepared_graph_read() {
        if !enabled() {
            return;
        }
        // The host sequence with the Graph op prepared like every other
        // independent owner read: captured under the kernel lock, executed
        // outside it (`PreparedGraph`); everything else as the host does.
        let kernel = Arc::new(Mutex::new(Kernel::discover()));
        let reads = GraphReads::default();
        let start = Instant::now();
        // AIKit's input is asked first (graphProgress.ts asks it first), the
        // others a moment after it.
        let mut asks: Vec<(String, KernelOp)> = [
            InputSelection::AikitResolution,
            InputSelection::CentralWiki,
            InputSelection::SharedField,
        ]
        .into_iter()
        .map(|input| (format!("graph {input:?}"), graph_op(input)))
        .collect();
        asks.push((
            "files_list Control/agents/wiki".into(),
            KernelOp::FilesList {
                path: "Control/agents/wiki".into(),
                fresh: Some(true),
            },
        ));
        let handles: Vec<_> = asks
            .into_iter()
            .enumerate()
            .map(|(index, (name, op))| {
                let (kernel, reads) = (Arc::clone(&kernel), reads.clone());
                std::thread::sleep(std::time::Duration::from_millis(if index == 1 {
                    200
                } else {
                    0
                }));
                std::thread::spawn(move || {
                    let prepared = {
                        let kernel = kernel.lock().unwrap();
                        PreparedGraph::prepare(
                            &kernel.client,
                            kernel.reads.get("world", read_cache::WORLD_TTL),
                            &op,
                            &reads,
                        )
                    };
                    let outcome = match prepared {
                        Some(prepared) => prepared.execute(),
                        None => host(&kernel, op),
                    };
                    (name, start.elapsed().as_secs_f64(), describe(&outcome))
                })
            })
            .collect();
        for handle in handles {
            let (name, seconds, described) = handle.join().unwrap();
            eprintln!("MEASURE prepared {name}: answered at {seconds:.2}s | {described}");
        }
    }

    #[test]
    #[ignore = "measures the real ground: OI_GRAPH_REAL_GROUND=1, never in CI"]
    fn real_ground_inputs_asked_together_without_the_kernel_lock() {
        if !enabled() {
            return;
        }
        // The same three inputs, each assembled on its own thread with no
        // kernel mutex around it: what the inputs cost when they never wait
        // on each other.
        let client = CentralClient::discover();
        let root = crate::world::read_world(&client).expect("world");
        let cwd = std::path::PathBuf::from(root["root"].as_str().expect("root"));
        let start = Instant::now();
        std::thread::scope(|scope| {
            let handles: Vec<_> = [
                InputSelection::CentralWiki,
                InputSelection::SharedField,
                InputSelection::AikitResolution,
            ]
            .into_iter()
            .map(|input| {
                let (client, cwd) = (&client, &cwd);
                scope.spawn(move || {
                    let options = ReadOptions {
                        input,
                        ..ReadOptions::default()
                    };
                    let reading = assemble_selected(
                        client,
                        "central.wiki.read",
                        &serde_json::json!({}),
                        cwd,
                        "",
                        &options,
                    );
                    let outcome = Ok(KernelOpOutcome {
                        receipts: Vec::new(),
                        result: KernelOpResult::GraphReading { reading },
                    });
                    (input, start.elapsed().as_secs_f64(), describe(&outcome))
                })
            })
            .collect();
            for handle in handles {
                let (input, seconds, described) = handle.join().unwrap();
                eprintln!("MEASURE unlocked {input:?}: answered at {seconds:.2}s | {described}");
            }
        });
    }

    #[test]
    #[ignore = "measures the real ground: OI_GRAPH_REAL_GROUND=1, never in CI"]
    fn real_ground_techne_registers_through_the_host_lock() {
        if !enabled() {
            return;
        }
        // Technē's register load (wikiSubjectStanding.ts loadRegisters →
        // wikiExpression.ts readWikiRegister): world_read, then per register
        // files_list, file_read and the AIKit relations of its first space.
        let kernel = Arc::new(Mutex::new(Kernel::discover()));
        let before = calls();
        let start = Instant::now();
        let world = host(&kernel, KernelOp::WorldRead);
        eprintln!(
            "MEASURE techne world_read: {:.2}s {} ok={}",
            start.elapsed().as_secs_f64(),
            delta(before),
            world.is_ok()
        );
        let root = crate::world::read_world(&CentralClient::discover()).expect("world");
        let mut registers: Vec<(Option<String>, String)> = vec![(None, String::new())];
        for row in root["work"]["projects"]
            .as_array()
            .cloned()
            .unwrap_or_default()
        {
            if let (Some(name), Some(path)) = (row["name"].as_str(), row["path"].as_str()) {
                registers.push((Some(name.to_owned()), path.to_owned()));
            }
        }
        let read_register = |kernel: &Mutex<Kernel>, project: &Option<String>, path: &str| {
            let directory = if path.is_empty() {
                "Control/agents/wiki".to_owned()
            } else {
                format!("{path}/ProjectCentral/agents/wiki")
            };
            let mut steps = Vec::new();
            let begin = Instant::now();
            let listed = host(
                kernel,
                KernelOp::FilesList {
                    path: directory,
                    fresh: None,
                },
            );
            steps.push(format!("list {:.2}s", begin.elapsed().as_secs_f64()));
            let location = match listed {
                Ok(KernelOpOutcome {
                    result: KernelOpResult::DirectoryRead { directory },
                    ..
                }) => directory
                    .entries
                    .into_iter()
                    .find(|entry| entry.name == "wiki.json")
                    .map(|entry| entry.location),
                _ => None,
            };
            let Some(location) = location else {
                steps.push("absent".into());
                return steps.join(" ");
            };
            let begin = Instant::now();
            let read = host(kernel, KernelOp::FileRead { location });
            steps.push(format!("read {:.2}s", begin.elapsed().as_secs_f64()));
            let space = match read {
                Ok(KernelOpOutcome {
                    result: KernelOpResult::FileRead { reading },
                    ..
                }) => serde_json::from_str::<Value>(&reading.content)
                    .ok()
                    .and_then(|wiki| {
                        wiki["objects"].as_array().and_then(|objects| {
                            objects
                                .iter()
                                .find(|object| object["object"] == "space")
                                .and_then(|space| space["ref"].as_str().map(str::to_owned))
                        })
                    }),
                _ => None,
            };
            let Some(space) = space else {
                steps.push("no space".into());
                return steps.join(" ");
            };
            let begin = Instant::now();
            let relations = host(
                kernel,
                KernelOp::Knowledge {
                    project: project.clone(),
                    request: knowledge::Request::Relations {
                        address: knowledge::Address::Wiki(space),
                    },
                    fresh: false,
                },
            );
            steps.push(format!(
                "relations {:.2}s{}",
                begin.elapsed().as_secs_f64(),
                if relations.is_ok() { "" } else { " ERR" }
            ));
            steps.join(" ")
        };
        // One register alone, then every register at once as the shell asks.
        let before = calls();
        let begin = Instant::now();
        let alone = read_register(&kernel, &registers[0].0, &registers[0].1);
        eprintln!(
            "MEASURE techne root alone: {:.2}s {} | {alone}",
            begin.elapsed().as_secs_f64(),
            delta(before)
        );
        // Every register at once as the shell asks: cold, then warm, then
        // beside a Graph op's AIKit input asked a moment earlier — through
        // the host's lock as it stands, and with the Graph op prepared.
        let reads = GraphReads::default();
        for pass in [
            "cold",
            "warm",
            "beside graph (host lock)",
            "beside graph (prepared)",
        ] {
            let before = calls();
            let start = Instant::now();
            let graph = pass.starts_with("beside").then(|| {
                let (kernel, reads) = (Arc::clone(&kernel), reads.clone());
                let prepared = pass.ends_with("(prepared)");
                let handle = std::thread::spawn(move || {
                    let op = graph_op(InputSelection::AikitResolution);
                    let prepared = prepared
                        .then(|| {
                            let kernel = kernel.lock().unwrap();
                            PreparedGraph::prepare(
                                &kernel.client,
                                kernel.reads.get("world", read_cache::WORLD_TTL),
                                &op,
                                &reads,
                            )
                        })
                        .flatten();
                    let outcome = match prepared {
                        Some(prepared) => prepared.execute(),
                        None => host(&kernel, op),
                    };
                    (start.elapsed().as_secs_f64(), describe(&outcome))
                });
                std::thread::sleep(std::time::Duration::from_millis(200));
                handle
            });
            let handles: Vec<_> = registers
                .iter()
                .cloned()
                .map(|(project, path)| {
                    let kernel = Arc::clone(&kernel);
                    std::thread::spawn(move || {
                        let steps = read_register(&kernel, &project, &path);
                        (project, start.elapsed().as_secs_f64(), steps)
                    })
                })
                .collect();
            let count = handles.len();
            let mut last = 0f64;
            for handle in handles {
                let (project, seconds, steps) = handle.join().unwrap();
                last = last.max(seconds);
                eprintln!(
                    "MEASURE techne {pass} register {}: settled at {seconds:.2}s | {steps}",
                    project.as_deref().unwrap_or("root")
                );
            }
            eprintln!("MEASURE techne {pass}: {count} registers settled at {last:.2}s");
            if let Some(graph) = graph {
                let (seconds, described) = graph.join().unwrap();
                eprintln!("MEASURE techne {pass}: the graph input answered at {seconds:.2}s | {described}");
            }
            eprintln!("MEASURE techne {pass}: owner calls {}", delta(before));
        }
    }
}
