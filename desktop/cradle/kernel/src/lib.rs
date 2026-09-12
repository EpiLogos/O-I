//! The cradle kernel — the composition surface's own mechanics (map §2:
//! "its kernel (stable refs, one global focus, ordered events)"), ported
//! KEEP-RE-EARN from `desktop/core` into the fresh shell and re-proven by
//! the U0.4 walk.
//!
//! What the kernel owns here:
//!
//! - **One global focus** (`focus.rs`, ported as-is) — the single notion of
//!   what the whole application is talking about.
//! - **The ordered event seam** (`events.rs`, ported law) — every kernel
//!   state change emits exactly one typed event into a log whose seqs are
//!   monotonic from 1 with no gaps; operations return the receipts they
//!   produced and none when nothing changed.
//! - **Two state layers** (map §1 law / 05 §4): the dirty buffer is
//!   cradle-held presentation state; the canonical revision is
//!   Central-owned. Saving is a compare-and-swap through
//!   `projectcentral.source.write` carrying the buffer's base revision; a
//!   save never overwrites either side silently.
//! - **Structured conflict** (`flow.rs::SourceWriteFailure`): a failed CAS
//!   surfaces `{kind: "revision-conflict", expected, current}` with BOTH
//!   sides preserved — the buffer content kept dirty, the canonical
//!   content re-readable. Never data loss.
//! - **Reading core only** (`world.rs`): participating sources from the
//!   owner's horizon/ground disclosures; no tree, no UI coupling.
//!
//! The kernel never writes files and never mints refs: every source ref is
//! Central's canonical grammar, carried verbatim.

pub mod events;
pub mod flow;
pub mod history;
pub mod knowledge;
pub mod action;
pub mod graph;
pub mod encounter;
pub mod agency;
pub mod files;
pub mod composition;
pub mod system_composition;
pub mod ground;
pub mod material;
pub mod factory;
pub mod focus;
pub mod refs;
pub mod world;
pub mod commission;
pub mod flow_cognition;

pub use flow::CentralClient;

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

use events::{KernelEvent, KernelEventLog, KernelEventReceipt};
use flow::{CRADLE_ACTOR, CRADLE_ACTOR_KIND, OwnerCallError, SourceReading, SourceWriteFailure};
use focus::GlobalFocus;
use refs::{source_semantic_ref, SemanticRef};
use world::{participating_sources, SourceListing};

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/// One surface binding the kernel knows: S's own presentation mechanic
/// (law 12), carrying the owner ref verbatim when the binding has one.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct SurfaceState {
    pub surface_id: String,
    pub kind: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_ref: Option<String>,
    pub title: String,
}

/// The conflict record a failed CAS leaves in the buffer: both observed
/// revisions plus the canonical content as the owner holds it now — the
/// other side of the two preserved layers, re-readable without losing the
/// buffer.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct SourceConflict {
    pub expected_revision: String,
    pub current_revision: String,
    /// The canonical content the re-read observed (the external side).
    pub canonical_content: String,
}

/// The two state layers for one open source:
///
/// - `content` — the cradle-held dirty buffer (presentation state);
/// - `saved_content` + `base_revision` — the canonical layer the buffer is
///   based on (Central-owned revision).
///
/// `dirty` says whether the two layers differ. A save CAS-writes `content`
/// against `base_revision`; a conflict keeps both layers intact.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct SourceBuffer {
    pub source_ref: String,
    /// Owner query retained at open; later selection never reroutes a save.
    #[serde(default)]
    pub project: String,
    #[serde(default)] pub world_ref: String,
    #[serde(default)] pub project_ref: Option<String>,
    /// The cradle-held buffer (presentation layer).
    pub content: String,
    /// The canonical content at `base_revision`.
    pub saved_content: String,
    /// The canonical revision this buffer is based on.
    pub base_revision: String,
    pub dirty: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub conflict: Option<SourceConflict>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
    /// Opened through the owner's Day route (a root-register source:
    /// `projectcentral.source.read` is project-scoped by registration, so
    /// the buffer comes from `central.day.read`'s own disclosure). A
    /// re-open through the project source route would refuse — remounts
    /// keep this buffer instead of re-reading.
    #[serde(default)]
    pub root_register: bool,
}

/// The whole kernel state, pulled by read models (events only trigger
/// re-renders — the pull is the truth). Empty maps serialise as `{}` (not
/// omitted): the wire shape is stable for the typed consumer.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct KernelSnapshot {
    pub focus: GlobalFocus,
    #[serde(default)]
    pub surfaces: BTreeMap<String, SurfaceState>,
    #[serde(default)]
    pub buffers: BTreeMap<String, SourceBuffer>,
    pub navigator: world::NavigatorReading,
}

/// The kernel itself. All mutation goes through [`Kernel::apply`]; every
/// state change is recorded exactly once on the ordered log.
#[derive(Debug)]
pub struct Kernel {
    agency: agency::Client,
    client: CentralClient,
    focus: GlobalFocus,
    log: KernelEventLog,
    surfaces: BTreeMap<String, SurfaceState>,
    buffers: BTreeMap<String, SourceBuffer>,
    navigator: world::NavigatorReading,
    file_refs: BTreeMap<String, (SemanticRef, Option<focus::ProjectRef>)>,
    knowledge_refs: BTreeMap<String, SemanticRef>,
    encounter_refs: BTreeMap<String,(SemanticRef,focus::ProjectRef)>,
    knowledge_projects: BTreeMap<String, Option<focus::ProjectRef>>,
}

// ---------------------------------------------------------------------------
// Operations — the typed seam the host (Tauri commands or the dev-only
// walk bridge) forwards. One operation = a real act; each returns the
// receipts its state changes produced.
// ---------------------------------------------------------------------------

/// One kernel operation. `project` stays optional everywhere: the
/// configured project query is the co-reference fallback (02 §7).
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(tag = "op", rename_all = "snake_case")]
pub enum KernelOp {
    /// Pull the whole kernel state (read model; emits nothing).
    State,
    WorldRead,
    ProjectRead { project: String },
    WorldBrowse,
    Knowledge { #[serde(default)] project: Option<String>, request: knowledge::Request },
    /// Assemble the typed graph input for U3.1/U3.4 presentation: Central's
    /// wiki read model (cell C1) composed with AIKit's owner-side resolution
    /// rows (cell C2). Adapter only — every node/edge carries its owner ref,
    /// owner operation and owner provenance verbatim; a failed input degrades
    /// honestly as an explicit unavailable input; the Shared Field
    /// projection is a named deferred input. Emits nothing (pull read).
    Graph { #[serde(default)] project: Option<String>, #[serde(default)] query: String },
    /// Compose the W3-A AIKit session-lifecycle read with the W3-B
    /// Actuation request-correlation read for ONE permission request
    /// identity (`oi.cradle.encounter/v1`). Adapter only — the identities
    /// travel verbatim, the pull emits nothing, and the grant-record seam
    /// is reconciled explicitly, never adjudicated. An optional `reply`
    /// is only classified against the pulled owner state (a later
    /// recorded disposition makes it a stale reply); the kernel records
    /// nothing.
    EncounterJoin {
        session: String,
        request_ref: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        reply: Option<encounter::ReplyAnswer>,
    },
    /// Dispatch one owner-disclosed Action ref to its native owner
    /// operation (U3.1: every result row invokes its Action). The kernel
    /// holds no authority: the ref, target and optional input travel
    /// verbatim; owner payloads return unchanged; spellings with no real
    /// owner operation are explicit unsupported states. Owner-side effects
    /// happen through the owner operation and are provable through the
    /// owner store; the kernel records nothing and emits nothing.
    InvokeAction { #[serde(default)] project: Option<String>, invocation: action::ActionInvocation },
    /// Forward one retained Flow/source-return Action to Central. The request
    /// and response remain owner-shaped; the kernel is only the typed seam.
    Flow { request: flow::Request },
    /// Compose the W1.5 changed-since-thought read (`flow_cognition.rs`):
    /// the kernel supplies the KnowledgeChangeHorizon adapted from Central's
    /// own `projectcentral.change.horizon` seam and calls the AIKit owner's
    /// `flow changed-since`; ONE typed reading comes back with both owner
    /// sides explicit — a side that could not be queried is named, never
    /// faked empty. Emits nothing (pull read + owner read).
    FlowChangedSince { #[serde(default)] project: Option<String>, thought: serde_json::Value },
    /// Commission one verbatim selection in one retained Flow (U4.1/U4.2
    /// loop mode, `commission.rs`): the selection travels verbatim with the
    /// Central FlowRef and the expected revision it was made against; the
    /// commission lands as an owner revision through Central's
    /// `projectcentral.flow.write` CAS — a stale expected revision refuses
    /// with both revisions observed, never a silent overwrite. An optional
    /// AgentSession binds without owning the Flow's identity.
    FlowCommission {
        #[serde(default)] project: Option<String>,
        flow_ref: String,
        expected_revision: String,
        selection: String,
        #[serde(default, skip_serializing_if = "Option::is_none")] agent_session_ref: Option<String>,
    },
    AgencyRead { project: String },
    /// Wave 6E: pending Returns tray — list/read plus human review/include
    /// through Central's native receiving operations (owner-validated).
    /// `project` names the project register's field; `None` is the ROOT
    /// register's field (a Day document lives there) — the scope follows the
    /// owner's own ref grammar, never the desktop's configured route.
    Receiving { #[serde(default)] project: Option<String>, request: flow::ReceivingRequest },
    /// NOW-relations (queue cell 1): read allocated NOW clearings by list or
    /// exact ref. Read-only; `project` follows the same explicit-null root
    /// law as `Receiving` — the register is the caller's to name.
    Now { #[serde(default)] project: Option<String>, request: flow::NowRequest },
    /// Task-basis cell (queue cell 2): read one session's task record through
    /// the owner's `encounter-task-read`. Read-only; absence is a null
    /// reading, never a fabricated record.
    EncounterTaskRead { project: String, agent_session: String },
    /// The human Day route: read the current today pointer (or one exact
    /// DayRef) through the owner. The disclosure carries the Day source's
    /// canonical ref — the only identity the desktop opens it by.
    DayRead { #[serde(default)] day_ref: Option<String> },
    /// Open the Day document's source buffer through the owner's Day route.
    /// There is no project-scoped source read for a root-register source:
    /// the buffer is built from `central.day.read`'s own disclosure.
    DaySourceOpen { #[serde(default)] day_ref: Option<String> },
    Encounter {project:String,request:agency::EncounterRequest},
    MaterialRead {target:material::Target},
    FactoryDiscover {project_ref:Option<String>},
    FactorySnapshot {binding_ref:String},
    FactoryIntent {binding_ref:String,request:factory::Intent},
    FactoryInvoke {binding_ref:String,request:factory::Invocation},
    Ground {request:ground::Request},
    CompositionRead {#[serde(default)] owners:bool},
    /// Wave 5 (docs/cradle/07): mount each of the six owners' own native
    /// `<product> system --json` disclosure, unmodified, alongside its
    /// honest availability. Distinct from `CompositionRead`, which reads
    /// the `oi` composition layer's own census.
    SystemCompositionRead,
    FilesList { path: String },
    FileOperation {location:files::Location,request:files::Request},
    FileRead { location: files::Location },
    /// Binary-safe material read (FND-04): the owner's base64 encoding,
    /// never the UTF-8 text contract. Distinct name from the Workcell
    /// `MaterialRead` op above — this reads a native Central file, not a
    /// Workcell material target.
    FileBytes { location: files::Location },
    ProjectBrowse { project: String },
    /// List a project's participating sources from the owner's
    /// disclosures (read-only; emits nothing).
    SourcesList { #[serde(default)] project: Option<String> },
    /// Open a source into the buffer layer through the owner's read.
    SourceOpen {
        #[serde(default)] project: Option<String>,
        source_ref: String,
    },
    /// Set the cradle-held buffer content. Emits `buffer_dirty` exactly
    /// once per clean/dirty crossing — continued typing emits nothing.
    SourceEdit { source_ref: String, content: String },
    SourceHistory { source_ref: String },
    SourceRestore { source_ref: String, content: String, base_revision: String, saved_content: String },
    /// CAS-save the buffer through `projectcentral.source.write`.
    SourceSave {
        #[serde(default)] project: Option<String>,
        source_ref: String,
    },
    /// Re-read the canonical layer (the conflict reconcile path): rebases
    /// the buffer's base revision, keeps the dirty buffer content.
    SourceReread {
        #[serde(default)] project: Option<String>,
        source_ref: String,
    },
    /// Register a surface binding (frame state, law 12).
    SurfaceOpen {
        surface_id: String,
        kind: String,
        #[serde(default)] source_ref: Option<String>,
        title: String,
    },
    /// Close a surface binding. Closing the focused surface also clears
    /// the focus relation — two state changes, two receipts.
    SurfaceClose { surface_id: String },
    /// Make a surface's ref the one current focus subject. Emits
    /// `focus_changed` only when the relation actually moved.
    SurfaceFocus { surface_id: String },
}

/// What an operation produced: its payload plus the receipts of the state
/// changes it made (empty when it changed nothing).
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct KernelOpOutcome {
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub receipts: Vec<KernelEventReceipt>,
    #[serde(flatten)]
    pub result: KernelOpResult,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(tag = "result", rename_all = "snake_case")]
pub enum KernelOpResult {
    State { snapshot: KernelSnapshot },
    WorldRead { snapshot: KernelSnapshot },
    Knowledge { data: serde_json::Value },
    GraphReading { reading: graph::GraphReading },
    /// The typed encounter join (`encounter.rs`): both owner views, the
    /// grant-record seam and the failure-taxonomy disposition.
    EncounterJoined {
        reading: encounter::EncounterReading,
    },
    /// The typed result of one owner-Action dispatch (`action.rs`): the
    /// owner payload verbatim, or an explicit named state.
    ActionDispatched { dispatch: action::ActionDispatch },
    Flow { response: flow::Response },
    /// The typed changed-since-thought compose (`flow_cognition.rs`): both
    /// owner sides of the read, explicit.
    FlowChangedSince { reading: flow_cognition::ChangedSinceReading },
    /// The typed selection commission outcome (`commission.rs`): owner
    /// revision, structured conflict, or the owner's own refusal.
    FlowCommissioned { outcome: commission::CommissionOutcome },
    AgencyReading { project_ref: String, spaces: serde_json::Value, observed_at_unix_ms: u64 },
    EncounterReading {data:serde_json::Value},
    ReceivingReading {data:serde_json::Value},
    NowReading {data:serde_json::Value},
    EncounterTaskReading {data:serde_json::Value},
    /// The owner's own `central.day.read` reading, carried verbatim — the
    /// Day's source identity is the owner's disclosure, never a ref the
    /// desktop derives from a path.
    DayReading {data:serde_json::Value},
    FileOperation {data:serde_json::Value},
    NativeOwnerReading {owner:String,data:Option<serde_json::Value>,failure:Option<serde_json::Value>},
    GroundReading {reading:serde_json::Value},
    CompositionReading {reading:composition::Reading},
    SystemCompositionReading {reading:system_composition::Reading},
    DirectoryRead { directory: files::Directory },
    FileRead { reading: files::Reading },
    FileBytes {
        location: files::Location,
        revision: String,
        byte_len: u64,
        mime_hint: Option<String>,
        content_base64: String,
    },
    SourcesListed { listing: SourceListing },
    SourceOpened { buffer: SourceBuffer },
    SourceHistory { history: history::SourceHistory },
    BufferEdited { buffer: SourceBuffer },
    /// A save that recorded a change (or landed unchanged on an equal
    /// canonical): the receipt revision is the canonical layer now.
    SourceSaved {
        buffer: SourceBuffer,
        previous_revision: String,
        revision: String,
        changed: bool,
    },
    /// A save the owner's CAS refused. The failure is structured; the
    /// buffer state beside it carries both preserved sides.
    SourceSaveFailed {
        buffer: SourceBuffer,
        failure: SourceWriteFailure,
    },
    SourceReread { buffer: SourceBuffer },
    SurfaceOpened { snapshot: KernelSnapshot },
    SurfaceClosed { snapshot: KernelSnapshot },
    SurfaceFocused { snapshot: KernelSnapshot },
}

impl Kernel {
    pub fn new(client: CentralClient) -> Self {
        Self::with_agency(client, agency::Client::discover())
    }

    pub fn with_agency(client: CentralClient, agency: agency::Client) -> Self {
        Self {
            client,
            agency,
            focus: GlobalFocus::unfocused(),
            log: KernelEventLog::new(),
            surfaces: BTreeMap::new(),
            buffers: BTreeMap::new(),
            navigator: world::NavigatorReading::default(),
            file_refs: BTreeMap::new(),
            knowledge_refs: BTreeMap::new(),
            encounter_refs: BTreeMap::new(),
            knowledge_projects: BTreeMap::new(),
        }
    }

    pub fn discover() -> Self {
        Self::new(CentralClient::discover())
    }

    /// The ordered event log — the observable seam the host exposes by
    /// command and forwards by event.
    pub fn event_log(&self) -> &KernelEventLog {
        &self.log
    }

    pub fn snapshot(&self) -> KernelSnapshot {
        KernelSnapshot {
            focus: self.focus.clone(),
            surfaces: self.surfaces.clone(),
            buffers: self.buffers.clone(),
            navigator: self.navigator.clone(),
        }
    }

    /// Apply one operation. This is the only mutation path; it records
    /// exactly one receipt per kernel state change.
    pub fn apply(&mut self, op: KernelOp) -> Result<KernelOpOutcome, String> {
        match op {
            KernelOp::MaterialRead{target} => native_owner_reading("workcell",material::Client::discover().read(&target)),
            KernelOp::FactoryDiscover{project_ref} => native_owner_reading("software-factory",factory::Client::discover().bindings(project_ref.as_deref())),
            KernelOp::FactorySnapshot{binding_ref} => native_owner_reading("software-factory",factory::Client::discover().snapshot(&binding_ref)),
            KernelOp::FactoryIntent{binding_ref,request} => native_owner_reading("software-factory",factory::Client::discover().intent(&binding_ref,&request)),
            KernelOp::FactoryInvoke{binding_ref,request} => native_owner_reading("software-factory",factory::Client::discover().invoke(&binding_ref,&request)),
            KernelOp::Ground{request} => Ok(KernelOpOutcome{receipts:Vec::new(),result:KernelOpResult::GroundReading{reading:ground::operate(request)?}}),
            KernelOp::CompositionRead{owners} => {
                let root=world::read_world(&self.client).ok();
                let cwd=root.as_ref().and_then(|value|value["root"].as_str()).map(std::path::PathBuf::from).unwrap_or(std::env::current_dir().map_err(|e|e.to_string())?);
                Ok(KernelOpOutcome{receipts:Vec::new(),result:KernelOpResult::CompositionReading{reading:composition::Client::discover().read_with_owners(&cwd,owners)}})
            },
            KernelOp::SystemCompositionRead => {
                let root=world::read_world(&self.client).ok();
                let cwd=root.as_ref().and_then(|value|value["root"].as_str()).map(std::path::PathBuf::from).unwrap_or(std::env::current_dir().map_err(|e|e.to_string())?);
                Ok(KernelOpOutcome{receipts:Vec::new(),result:KernelOpResult::SystemCompositionReading{reading:system_composition::Client::discover().read(&cwd)}})
            },
            KernelOp::FileOperation {location,request} => Ok(KernelOpOutcome {receipts:Vec::new(),result:KernelOpResult::FileOperation {data:files::operate(&self.client,&location,&request)?}}),
            KernelOp::FilesList {path} => Ok(KernelOpOutcome { receipts:Vec::new(), result:KernelOpResult::DirectoryRead {directory:files::list(&self.client,&path)?} }),
            KernelOp::FileRead {location} => {
                let reading = match files::read(&self.client,&location) {
                    Ok(reading) => reading,
                    Err(error) => { self.file_refs.remove(&location.ref_id); return Err(error); }
                };
                let project = reading.project.as_ref().and_then(|p| p.project_ref.as_ref()).map(|id|focus::ProjectRef::try_from(owner_relation(id,"project","central.files.read"))).transpose().map_err(|e|e.to_string())?;
                self.file_refs.insert(reading.location.ref_id.clone(),(owner_relation(&reading.location.ref_id,"file","central.files.read"),project));
                Ok(KernelOpOutcome {receipts:Vec::new(),result:KernelOpResult::FileRead {reading}})
            }
            KernelOp::FileBytes {location} => {
                let reading = match files::read_bytes(&self.client,&location) {
                    Ok(reading) => reading,
                    Err(error) => { self.file_refs.remove(&location.ref_id); return Err(error); }
                };
                // FND-04: a binary material file (image/pdf/unsupported) is
                // opened as a surface through this op, never `FileRead` — the
                // `SurfaceOpen` gate ("File must be read successfully
                // through Central before opening its surface") checks
                // `file_refs` regardless of which read resolved the ref, so
                // this registration is required exactly as `FileRead`'s is.
                let project = reading.project.as_ref().and_then(|p| p.project_ref.as_ref()).map(|id|focus::ProjectRef::try_from(owner_relation(id,"project","central.files.read"))).transpose().map_err(|e|e.to_string())?;
                self.file_refs.insert(reading.location.ref_id.clone(),(owner_relation(&reading.location.ref_id,"file","central.files.read"),project));
                Ok(KernelOpOutcome {receipts:Vec::new(),result:KernelOpResult::FileBytes {
                    location: reading.location,
                    revision: reading.revision,
                    byte_len: reading.byte_len,
                    mime_hint: reading.mime_hint,
                    content_base64: reading.content_base64,
                }})
            }
            KernelOp::Encounter {project,request} => {
                let root=world::read_world(&self.client).map_err(|e|e.to_string())?;
                let row=root["work"]["projects"].as_array().and_then(|rows|rows.iter().find(|r|r["name"].as_str()==Some(&project))).ok_or("Project is outside Central's disclosed ground")?;
                let cwd=std::path::Path::new(root["root"].as_str().ok_or("Central root location unavailable")?).join(row["path"].as_str().ok_or("Project location unavailable")?);
                let inspection=self.client.run("projectcentral.inspect",serde_json::json!({"project":project})).map_err(|e|e.to_string())?;
                let project_ref=inspection["manifest"]["project_id"].as_str().ok_or("Central has not bound a canonical ProjectRef")?;
                let data=self.agency.encounter(&cwd,project_ref,&request)?;
                if let agency::EncounterRequest::Read{agent_session,..}=&request {
                    if data["agent_session"].as_str()!=Some(agent_session){return Err("AIKit encounter reading identity mismatch".into());}
                    let project=focus::ProjectRef::try_from(owner_relation(project_ref,"project","projectcentral.inspect")).map_err(|e|e.to_string())?;
                    self.encounter_refs.insert(agent_session.clone(),(SemanticRef {ref_id:agent_session.clone(),kind:"agent-session".into(),native_owner:"ai-kit".into(),provenance:refs::RefProvenance {source:"aikit.encounter.read".into(),revision:None}},project));
                }
                Ok(KernelOpOutcome {receipts:Vec::new(),result:KernelOpResult::EncounterReading {data}})
            }
            KernelOp::AgencyRead { project } => {
                let root=world::read_world(&self.client).map_err(|e|e.to_string())?;
                let row=root["work"]["projects"].as_array().and_then(|rows|rows.iter().find(|r|r["name"].as_str()==Some(&project))).ok_or("Project is outside Central's disclosed ground")?;
                let cwd=std::path::Path::new(root["root"].as_str().ok_or("Central root location unavailable")?).join(row["path"].as_str().ok_or("Project location unavailable")?);
                let inspection=self.client.run("projectcentral.inspect",serde_json::json!({"project":project})).map_err(|e|e.to_string())?;
                let project_ref=inspection["manifest"]["project_id"].as_str().ok_or("Central has not bound a canonical ProjectRef")?.to_owned();
                let spaces=self.agency.read_project(&cwd,&project_ref)?;
                let observed_at_unix_ms=std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d|d.as_millis() as u64).unwrap_or(0);
                Ok(KernelOpOutcome {receipts:Vec::new(),result:KernelOpResult::AgencyReading {project_ref,spaces,observed_at_unix_ms}})
            }
            KernelOp::Receiving {project,request} => {
                // Same disclosure gate as every project-scoped read: a named
                // project must be inside Central's disclosed ground. `None`
                // is the root register's own field — a Day document lives
                // there, and its receiving field is the root's.
                if let Some(project)=&project {
                    let root=world::read_world(&self.client).map_err(|e|e.to_string())?;
                    root["work"]["projects"].as_array().and_then(|rows|rows.iter().find(|r|r["name"].as_str()==Some(project.as_str()))).ok_or("Project is outside Central's disclosed ground")?;
                }
                let data=self.client.receiving(project.as_deref(),&request).map_err(|e|e.to_string())?;
                Ok(KernelOpOutcome {receipts:Vec::new(),result:KernelOpResult::ReceivingReading {data}})
            }
            KernelOp::Now {project,request} => {
                // Same disclosure gate as `Receiving`: a named project must be
                // inside Central's disclosed ground; `None` is the root
                // register, carried as an explicit null to the owner.
                if let Some(project)=&project {
                    let root=world::read_world(&self.client).map_err(|e|e.to_string())?;
                    root["work"]["projects"].as_array().and_then(|rows|rows.iter().find(|r|r["name"].as_str()==Some(project.as_str()))).ok_or("Project is outside Central's disclosed ground")?;
                }
                let data=self.client.now(project.as_deref(),&request).map_err(|e|e.to_string())?;
                Ok(KernelOpOutcome {receipts:Vec::new(),result:KernelOpResult::NowReading {data}})
            }
            KernelOp::EncounterTaskRead {project,agent_session} => {
                // The standard project-disclosure gate and cwd resolution —
                // the task record belongs to a session attached to THIS
                // project's SessionSpaces, exactly like the encounter reads.
                let root=world::read_world(&self.client).map_err(|e|e.to_string())?;
                let row=root["work"]["projects"].as_array().and_then(|rows|rows.iter().find(|r|r["name"].as_str()==Some(&project))).ok_or("Project is outside Central's disclosed ground")?;
                let cwd=std::path::Path::new(root["root"].as_str().ok_or("Central root location unavailable")?).join(row["path"].as_str().ok_or("Project location unavailable")?);
                let data=self.agency.task_read(&cwd,&agent_session).map_err(|e|e.to_string())?;
                Ok(KernelOpOutcome {receipts:Vec::new(),result:KernelOpResult::EncounterTaskReading {data}})
            }
            KernelOp::DayRead {day_ref} => {
                // The Day is a ROOT-register carrier: an explicit null
                // project is the kernel's own convention for naming the
                // Central root register (absence would take the configured
                // project co-reference, which has no today pointer).
                let mut input=serde_json::Map::new();
                input.insert("project".to_owned(),serde_json::Value::Null);
                if let Some(day_ref)=day_ref { input.insert("day_ref".to_owned(),serde_json::Value::String(day_ref)); }
                let data=self.client.run("central.day.read",serde_json::Value::Object(input)).map_err(|e|e.to_string())?;
                Ok(KernelOpOutcome {receipts:Vec::new(),result:KernelOpResult::DayReading {data}})
            }
            KernelOp::DaySourceOpen {day_ref} => {
                // The owner's Day route is the only reader of a
                // root-register Day source: the buffer is built from
                // `central.day.read`'s own disclosure — its canonical ref,
                // revision and content — never a path-derived ref.
                let mut input=serde_json::Map::new();
                input.insert("project".to_owned(),serde_json::Value::Null);
                if let Some(day_ref)=day_ref { input.insert("day_ref".to_owned(),serde_json::Value::String(day_ref)); }
                let data=self.client.run("central.day.read",serde_json::Value::Object(input)).map_err(|e|e.to_string())?;
                let source_ref=data["source"]["ref"].as_str().ok_or("Central's Day reading disclosed no source ref")?.to_owned();
                let path=data["source"]["path"].as_str().ok_or("Central's Day reading disclosed no source path")?.to_owned();
                let revision=data["revision"]["revision"].as_str().ok_or("Central's Day reading disclosed no source revision")?.to_owned();
                let content=data["content"].as_str().ok_or("Central's Day reading disclosed no content")?.to_owned();
                let buffer=SourceBuffer {
                    source_ref: source_ref.clone(),
                    project: String::new(),
                    world_ref: String::new(),
                    project_ref: None,
                    content: content.to_owned(),
                    saved_content: content.to_owned(),
                    base_revision: revision.to_owned(),
                    dirty: false,
                    conflict: None,
                    path: Some(path),
                    root_register: true,
                };
                self.buffers.insert(source_ref.clone(),buffer.clone());
                let receipt=self.log.record(KernelEvent::SourceOpened {
                    source: source_semantic_ref(&source_ref,Some(&buffer.base_revision)).unwrap_or_else(|_| fallback_source_ref(&source_ref)),
                    revision: buffer.base_revision.clone(),
                    summary: format!("Opened from the owner's Day reading at revision {} ({} bytes).",short_revision(&buffer.base_revision),buffer.content.len()),
                });
                Ok(KernelOpOutcome {receipts:vec![receipt],result:KernelOpResult::SourceOpened {buffer}})
            }
            KernelOp::Knowledge { project, request } => {
                // Central discloses the scope; renderer-supplied filesystem paths
                // and stale persisted authority never become invocation context.
                let root = world::read_world(&self.client).map_err(|e| e.to_string())?;
                let project = if let knowledge::Request::Read { address } = &request {
                    root["work"]["projects"].as_array().and_then(|rows|rows.iter().find(|row|row["projectcentral"]["agent_wiki"]["wiki"]["space_ref"].as_str()==Some(address.reference())))
                        .and_then(|row|row["name"].as_str()).map(str::to_owned).or(project)
                } else { project };
                let base = root["root"].as_str().ok_or("Central root location unavailable")?;
                let cwd = if let Some(project) = project.as_ref() {
                    let row = root["work"]["projects"].as_array().and_then(|rows| rows.iter().find(|r| r["name"].as_str() == Some(project))).ok_or("Project is outside Central's disclosed ground")?;
                    std::path::Path::new(base).join(row["path"].as_str().ok_or("Project location unavailable")?)
                } else { std::path::PathBuf::from(base) };
                if let knowledge::Request::Use { address } = &request {
                    if !self.knowledge_refs.contains_key(address.reference()) { return Err("Read the native subject successfully before recording use".into()); }
                }
                let data = knowledge::call(&cwd, &request)?;
                if let knowledge::Request::Read { address } = &request {
                    if data["resource"].as_str() != Some(address.reference()) { return Err("AIKit reading identity does not match the requested subject".into()); }
                    let project_ref = if let Some(project) = project.as_ref() {
                        self.client.run("projectcentral.inspect", serde_json::json!({"project":project})).ok()
                            .and_then(|v| v["manifest"]["project_id"].as_str().map(str::to_owned))
                            .map(|r| focus::ProjectRef::try_from(owner_relation(&r,"project","projectcentral.inspect"))).transpose().map_err(|e| e.to_string())?
                    } else { None };
                    self.knowledge_projects.insert(address.reference().into(), project_ref);
                    self.knowledge_refs.insert(address.reference().into(), SemanticRef {
                        ref_id: address.reference().into(), kind: "knowledge".into(), native_owner: "ai-kit".into(),
                        provenance: refs::RefProvenance { source: "aikit.knowledge.read".into(), revision: data["revision"].as_str().map(str::to_owned) },
                    });
                }
                Ok(KernelOpOutcome { receipts: Vec::new(), result: KernelOpResult::Knowledge { data } })
            }
            KernelOp::Graph { project, query } => {
                // Central discloses the scope; the wiki read register and the
                // AIKit project context both come from the owner root map.
                let root = world::read_world(&self.client).map_err(|e| e.to_string())?;
                let base = root["root"].as_str().ok_or("Central root location unavailable")?;
                let (wiki_action, wiki_input, cwd) = if let Some(project) = project.as_ref() {
                    let row = root["work"]["projects"].as_array().and_then(|rows| rows.iter().find(|r| r["name"].as_str() == Some(project))).ok_or("Project is outside Central's disclosed ground")?;
                    let cwd = std::path::Path::new(base).join(row["path"].as_str().ok_or("Project location unavailable")?);
                    ("projectcentral.wiki.read", serde_json::json!({ "project": project }), cwd)
                } else {
                    ("central.wiki.read", serde_json::json!({}), std::path::PathBuf::from(base))
                };
                let reading = graph::assemble(&self.client, wiki_action, &wiki_input, &cwd, &query);
                Ok(KernelOpOutcome { receipts: Vec::new(), result: KernelOpResult::GraphReading { reading } })
            }
            KernelOp::EncounterJoin { session, request_ref, reply } => {
                // Central discloses the context anchor, exactly as the
                // Graph/Knowledge arms; the lifecycle store itself is the
                // AIKit owner's (AIKIT_HOME), never renderer-supplied.
                let root = world::read_world(&self.client).map_err(|e| e.to_string())?;
                let cwd = std::path::PathBuf::from(root["root"].as_str().ok_or("Central root location unavailable")?);
                let reading = encounter::assemble(&cwd, &session, &request_ref, reply.as_ref());
                Ok(KernelOpOutcome { receipts: Vec::new(), result: KernelOpResult::EncounterJoined { reading } })
            }
            KernelOp::InvokeAction { project, invocation } => {
                // Central discloses the scope, exactly as the Knowledge/Graph
                // arms: renderer-supplied paths never become invocation context.
                let root = world::read_world(&self.client).map_err(|e| e.to_string())?;
                let base = root["root"].as_str().ok_or("Central root location unavailable")?;
                let cwd = if let Some(project) = project.as_ref() {
                    let row = root["work"]["projects"].as_array().and_then(|rows| rows.iter().find(|r| r["name"].as_str() == Some(project))).ok_or("Project is outside Central's disclosed ground")?;
                    std::path::Path::new(base).join(row["path"].as_str().ok_or("Project location unavailable")?)
                } else { std::path::PathBuf::from(base) };
                let dispatch = action::invoke(&self.client, &cwd, project.as_deref(), &invocation);
                Ok(KernelOpOutcome { receipts: Vec::new(), result: KernelOpResult::ActionDispatched { dispatch } })
            }
            KernelOp::Flow { request } => {
                let action = request.owner_action().to_owned();
                let response = self
                    .client
                    .apply_request(request)
                    .unwrap_or_else(|error| flow::Response::Failure { action, error });
                Ok(KernelOpOutcome {
                    receipts: Vec::new(),
                    result: KernelOpResult::Flow { response },
                })
            }
            KernelOp::FlowChangedSince { project, thought } => {
                // The changed-since compose resolves its owner cwd exactly as
                // the InvokeAction arm: Central discloses the scope,
                // renderer-supplied paths never become context.
                let root = world::read_world(&self.client).map_err(|e| e.to_string())?;
                let base = root["root"].as_str().ok_or("Central root location unavailable")?;
                let cwd = if let Some(project) = project.as_ref() {
                    let row = root["work"]["projects"].as_array().and_then(|rows| rows.iter().find(|r| r["name"].as_str() == Some(project))).ok_or("Project is outside Central's disclosed ground")?;
                    std::path::Path::new(base).join(row["path"].as_str().ok_or("Project location unavailable")?)
                } else { std::path::PathBuf::from(base) };
                let reading = flow_cognition::changed_since(&self.client, project.as_deref().unwrap_or_else(|| self.client.configured_project()), &cwd, &thought).map_err(|e| e.to_string())?;
                Ok(KernelOpOutcome { receipts: Vec::new(), result: KernelOpResult::FlowChangedSince { reading } })
            }
            KernelOp::FlowCommission { project, flow_ref, expected_revision, selection, agent_session_ref } => {
                let outcome = commission::commission(&self.client, project.as_deref().unwrap_or_else(|| self.client.configured_project()), &flow_ref, &expected_revision, &selection, agent_session_ref.as_deref()).map_err(|e| e.to_string())?;
                Ok(KernelOpOutcome { receipts: Vec::new(), result: KernelOpResult::FlowCommissioned { outcome } })
            }
            KernelOp::WorldRead => self.navigate(None, false),
            KernelOp::ProjectRead { project } => self.navigate(Some(&project), false),
            KernelOp::WorldBrowse => self.navigate(None, true),
            KernelOp::ProjectBrowse { project } => self.navigate(Some(&project), true),
            KernelOp::State => Ok(KernelOpOutcome {
                receipts: Vec::new(),
                result: KernelOpResult::State {
                    snapshot: self.snapshot(),
                },
            }),
            KernelOp::SourcesList { project } => Ok(KernelOpOutcome {
                receipts: Vec::new(),
                result: KernelOpResult::SourcesListed {
                    listing: participating_sources(&self.client, project.as_deref()),
                },
            }),
            KernelOp::SourceRestore { source_ref, content, base_revision, saved_content } => {
                let current = self.buffers.get(&source_ref).ok_or("open the owner source before restoring writing")?.clone();
                if current.dirty { return Ok(KernelOpOutcome { receipts: Vec::new(), result: KernelOpResult::SourceOpened { buffer: current } }); }
                let mut outcome = self.source_edit(&source_ref, content)?;
                let buffer = self.buffers.get_mut(&source_ref).expect("opened source");
                if buffer.dirty {
                    buffer.base_revision = base_revision.clone();
                    buffer.saved_content = saved_content;
                    if current.base_revision != base_revision {
                        buffer.conflict = Some(SourceConflict { expected_revision: base_revision.clone(), current_revision: current.base_revision.clone(), canonical_content: current.content });
                        outcome.receipts.push(self.log.record(KernelEvent::SourceWriteConflict {
                            source: source_semantic_ref(&source_ref, Some(&base_revision))?, expected_revision: base_revision,
                            current_revision: current.base_revision, summary: "Restored writing has a different base from the current owner revision; both sides retained.".into(),
                        }));
                    }
                }
                outcome.result = KernelOpResult::SourceOpened { buffer: buffer.clone() };
                Ok(outcome)
            }
            KernelOp::SourceHistory { source_ref } => {
                let buffer = self.buffers.get(&source_ref).ok_or("open the source before reading its history")?;
                let history = history::read(&self.client, &buffer.project, &source_ref).map_err(|e| e.to_string())?;
                Ok(KernelOpOutcome { receipts: Vec::new(), result: KernelOpResult::SourceHistory { history } })
            }
            KernelOp::SourceOpen { project, source_ref } => {
                self.source_open(project.as_deref(), &source_ref)
            }
            KernelOp::SourceEdit { source_ref, content } => {
                self.source_edit(&source_ref, content)
            }
            KernelOp::SourceSave { project, source_ref } => {
                self.source_save(project.as_deref(), &source_ref)
            }
            KernelOp::SourceReread { project, source_ref } => {
                self.source_reread(project.as_deref(), &source_ref)
            }
            KernelOp::SurfaceOpen {
                surface_id,
                kind,
                source_ref,
                title,
            } => self.surface_open(surface_id, kind, source_ref, title),
            KernelOp::SurfaceClose { surface_id } => self.surface_close(surface_id),
            KernelOp::SurfaceFocus { surface_id } => self.surface_focus(surface_id),
        }
    }

    // -----------------------------------------------------------------------
    // Source buffers — the two state layers
    // -----------------------------------------------------------------------

    fn navigate(&mut self, project: Option<&str>, browse_only: bool) -> Result<KernelOpOutcome, String> {
        let before = self.navigator.clone();
        let old_focus = self.focus.clone();
        let result = if let Some(query) = project {
            // Resolve only a project the owner's current root map disclosed.
            let known = self.navigator.root.as_ref().and_then(|r| r["work"]["projects"].as_array())
                .is_some_and(|rows| rows.iter().any(|p| p["name"].as_str() == Some(query)));
            if !known { return Err("Project is outside the disclosed World mapping; refresh World first".into()); }
            world::read_project(&self.client, query).map(|reading| {
                let bound = reading["project"]["projectcentral"]["state"] != "absent";
                let sources = bound.then(|| participating_sources(&self.client, Some(query)));
                let project_ref = if bound {
                    self.client.run("projectcentral.inspect", serde_json::json!({"project": query})).ok()
                        .and_then(|v| v["manifest"]["project_id"].as_str().filter(|id| !id.trim().is_empty()).map(str::to_owned))
                } else { None };
                self.focus.project = None;
                self.focus.world = None;
                self.focus.clear_subject();
                let semantic = |id: String, kind: &str| SemanticRef {
                    ref_id: id, kind: kind.into(), native_owner: "central".into(),
                    provenance: refs::RefProvenance { source: "projectcentral.inspect".into(), revision: None },
                };
                if let Some(id) = project_ref.as_ref() {
                    let reference = semantic(id.clone(), "project");
                    self.focus.bind_project(focus::ProjectRef::try_from(reference.clone()).expect("owner project ref"));
                    self.focus.focus_subject(reference).expect("owner project ref");
                }
                if let Some(id) = sources.as_ref().and_then(|s| s.world_ref.as_ref()).filter(|id| !id.trim().is_empty()) {
                    let mut reference = semantic(id.clone(), "world");
                    reference.provenance.source = "projectcentral.change.horizon".into();
                    self.focus.bind_world(focus::WorldRef::try_from(reference).expect("owner world ref"));
                }
                self.navigator.project = Some(reading);
                self.navigator.sources = sources;
                self.navigator.project_ref = project_ref;
            })
        } else {
            world::read_world(&self.client).map(|reading| {
                if self.navigator.project.is_some() {
                    self.focus.project = None;
                    self.focus.world = None;
                    self.focus.clear_subject();
                }
                self.navigator.root = Some(reading);
                self.navigator.project = None;
                self.navigator.sources = None;
                self.navigator.project_ref = None;
            })
        };
        self.navigator.error = result.err();
        // Browsing changes the navigation reading, not the semantic subject
        // currently bound to open work. Explicit focus remains a separate act.
        if browse_only { self.focus = old_focus.clone(); }
        let mut receipts = Vec::new();
        if self.navigator != before {
            receipts.push(self.log.record(KernelEvent::WorldChanged { summary: "Central navigator reading changed".into() }));
        }
        if self.focus != old_focus {
            receipts.push(self.log.record(KernelEvent::FocusChanged { focus: self.focus.clone() }));
        }
        Ok(KernelOpOutcome { receipts, result: KernelOpResult::WorldRead { snapshot: self.snapshot() } })
    }

    fn source_open(
        &mut self,
        project: Option<&str>,
        source_ref: &str,
    ) -> Result<KernelOpOutcome, String> {
        // The cradle holds unsaved work: opening the same ref again reveals
        // the existing buffer — it never clobbers a dirty layer.
        let held = self.buffers.get(source_ref).cloned();
        if let Some(buffer) = &held {
            // A root-register buffer (the Day, opened through the owner's Day
            // route) is also served from its held state: its re-read route
            // (`projectcentral.source.read`) is project-scoped by
            // registration and cannot serve this ref.
            if buffer.dirty || buffer.root_register {
                return Ok(KernelOpOutcome {
                    receipts: Vec::new(),
                    result: KernelOpResult::SourceOpened {
                        buffer: buffer.clone(),
                    },
                });
            }
        }
        let reading = self.owner_read(project, source_ref)?;
        // The kernel state changed only if a buffer was created or the
        // canonical layer moved under a clean buffer; a re-open of the same
        // clean revision emits nothing (02 §5: return none when nothing
        // changed).
        let changed = held
            .as_ref()
            .map(|buffer| buffer.base_revision != reading.revision.revision)
            .unwrap_or(true);
        let route = project.unwrap_or(self.client.configured_project()).to_owned();
        let buffer = self.sync_buffer_from_reading(&reading, true, &route);
        let receipt = changed.then(|| {
            self.log.record(KernelEvent::SourceOpened {
                source: source_semantic_ref(source_ref, Some(&reading.revision.revision))
                    .unwrap_or_else(|_| fallback_source_ref(source_ref)),
                revision: reading.revision.revision.clone(),
                summary: format!(
                    "Opened from the owner's reading at revision {} ({} bytes).",
                    short_revision(&reading.revision.revision),
                    reading.revision.byte_len
                ),
            })
        });
        Ok(KernelOpOutcome {
            receipts: receipt.into_iter().collect(),
            result: KernelOpResult::SourceOpened { buffer },
        })
    }

    /// Re-read the canonical layer and sync the buffer to it. A clean
    /// buffer mirrors the canonical content; a dirty buffer keeps its
    /// content and only rebases (both layers stay distinct).
    fn sync_buffer_from_reading(&mut self, reading: &SourceReading, reset_content: bool, project: &str) -> SourceBuffer {
        let source_ref = reading.source.source_ref.clone();
        let previous = self.buffers.get(&source_ref);
        let keep_dirty = previous.map(|buffer| buffer.dirty).unwrap_or(false);
        let content = if keep_dirty && !reset_content {
            previous.expect("dirty implies present").content.clone()
        } else {
            reading.content.clone()
        };
        let dirty = keep_dirty && content != reading.content;
        let buffer = SourceBuffer {
            source_ref: source_ref.clone(),
            project: project.to_owned(),
            world_ref: reading.world_ref.clone(),
            project_ref: self.client.run("projectcentral.inspect", serde_json::json!({"project":project})).ok().and_then(|v| v.pointer("/manifest/project_id").and_then(serde_json::Value::as_str).map(str::to_owned)),
            content,
            saved_content: reading.content.clone(),
            base_revision: reading.revision.revision.clone(),
            dirty,
            conflict: None,
            path: Some(reading.source.path.clone()),
            root_register: false,
        };
        self.buffers.insert(source_ref, buffer.clone());
        buffer
    }

    fn source_edit(&mut self, source_ref: &str, content: String) -> Result<KernelOpOutcome, String> {
        let Some(buffer) = self.buffers.get_mut(source_ref) else {
            return Err(format!(
                "no open buffer for `{source_ref}`; a buffer exists only after the source is opened"
            ));
        };
        buffer.content = content;
        let now_dirty = buffer.content != buffer.saved_content;
        let crossed = now_dirty != buffer.dirty;
        buffer.dirty = now_dirty;
        let buffer = buffer.clone();
        let receipt = crossed.then(|| {
            self.log.record(KernelEvent::BufferDirty {
                source: source_semantic_ref(source_ref, Some(&buffer.base_revision))
                    .unwrap_or_else(|_| fallback_source_ref(source_ref)),
                dirty: now_dirty,
                summary: if now_dirty {
                    "The cradle buffer crossed the clean/dirty line: it now differs from the canonical layer.".to_owned()
                } else {
                    "The cradle buffer returned to the canonical content: clean again.".to_owned()
                },
            })
        });
        Ok(KernelOpOutcome {
            receipts: receipt.into_iter().collect(),
            result: KernelOpResult::BufferEdited { buffer },
        })
    }

    fn source_save(
        &mut self,
        project: Option<&str>,
        source_ref: &str,
    ) -> Result<KernelOpOutcome, String> {
        let Some(buffer) = self.buffers.get(source_ref) else {
            return Err(format!("no open buffer for `{source_ref}`; nothing to save"));
        };
        let route = if buffer.project.is_empty() { project.unwrap_or(self.client.configured_project()) } else { &buffer.project }.to_owned();
        let project = Some(route.as_str());
        let expected = buffer.base_revision.clone();
        let content = buffer.content.clone();
        match self.client.source_write(
            project,
            source_ref,
            &expected,
            &content,
            CRADLE_ACTOR,
            CRADLE_ACTOR_KIND,
        ) {
            Ok(receipt) => {
                let previous_revision = receipt.previous_revision.clone();
                let revision = receipt.revision.revision.clone();
                let changed = receipt.changed;
                // Sync both layers to the canonical state the owner recorded.
                // One state change — the save — one event: SourceChanged
                // (only when Central recorded a change; an unchanged write
                // mutated nothing and emits nothing).
                let event = changed.then(|| {
                    self.log.record(KernelEvent::SourceChanged {
                        source: source_semantic_ref(source_ref, Some(&revision))
                            .unwrap_or_else(|_| fallback_source_ref(source_ref)),
                        revision: revision.clone(),
                        summary: format!(
                            "Saved through the owner's CAS: revision advanced {} -> {}.",
                            short_revision(&previous_revision),
                            short_revision(&revision)
                        ),
                    })
                });
                if let Some(buffer) = self.buffers.get_mut(source_ref) {
                    buffer.saved_content = content;
                    buffer.base_revision = revision.clone();
                    buffer.dirty = false;
                    buffer.conflict = None;
                }
                let buffer = self.buffers.get(source_ref).cloned().expect("just saved");
                Ok(KernelOpOutcome {
                    receipts: event.into_iter().collect(),
                    result: KernelOpResult::SourceSaved {
                        buffer,
                        previous_revision,
                        revision,
                        changed,
                    },
                })
            }
            Err(error) => {
                // The ported heuristic: on a write error, re-read and
                // compare revisions — never parse conflict prose. Both
                // sides are preserved on a conflict: the buffer content
                // stays as it is (dirty), the canonical content is kept
                // re-readable in the conflict record.
                let failure = match &error {
                    OwnerCallError::Unavailable { detail } => SourceWriteFailure::Unavailable {
                        source_ref: source_ref.to_owned(),
                        detail: detail.clone(),
                    },
                    OwnerCallError::Refused { .. } | OwnerCallError::Malformed { .. } => {
                        match self.client.current_reading(project, source_ref) {
                            Ok(current) => {
                                if current.revision.revision == expected {
                                    SourceWriteFailure::OwnerRefused {
                                        source_ref: source_ref.to_owned(),
                                        message: error.to_string(),
                                    }
                                } else {
                                    let failure = SourceWriteFailure::RevisionConflict {
                                        source_ref: source_ref.to_owned(),
                                        expected: expected.clone(),
                                        current: current.revision.revision.clone(),
                                    };
                                    let canonical_content = current.content.clone();
                                    let current_revision =
                                        current.revision.revision.clone();
                                    if let Some(buffer) = self.buffers.get_mut(source_ref) {
                                        buffer.conflict = Some(SourceConflict {
                                            expected_revision: expected.clone(),
                                            current_revision,
                                            canonical_content,
                                        });
                                    }
                                    failure
                                }
                            }
                            // The owner is not even re-readable: surface the
                            // original refusal honestly; no state changed.
                            Err(_) => SourceWriteFailure::OwnerRefused {
                                source_ref: source_ref.to_owned(),
                                message: error.to_string(),
                            },
                        }
                    }
                };
                let conflict_event = matches!(failure, SourceWriteFailure::RevisionConflict { .. })
                    .then(|| {
                        let (expected, current) = match &failure {
                            SourceWriteFailure::RevisionConflict { expected, current, .. } => {
                                (expected.clone(), current.clone())
                            }
                            _ => unreachable!("guarded by matches!"),
                        };
                        self.log.record(KernelEvent::SourceWriteConflict {
                            source: source_semantic_ref(source_ref, Some(&expected))
                                .unwrap_or_else(|_| fallback_source_ref(source_ref)),
                            expected_revision: expected,
                            current_revision: current,
                            summary:
                                "The owner's CAS refused the save: the revision moved underneath the buffer. Both sides are preserved."
                                    .to_owned(),
                        })
                    });
                let buffer = self.buffers.get(source_ref).cloned().expect("save path holds it");
                Ok(KernelOpOutcome {
                    receipts: conflict_event.into_iter().collect(),
                    result: KernelOpResult::SourceSaveFailed { buffer, failure },
                })
            }
        }
    }

    fn source_reread(
        &mut self,
        project: Option<&str>,
        source_ref: &str,
    ) -> Result<KernelOpOutcome, String> {
        // A root-register buffer (the Day, opened through the owner's Day
        // route) re-reads through that same route: the project-scoped
        // `projectcentral.source.read` cannot serve its ref, so without this
        // branch an external Day change could never reach the open surface.
        if self.buffers.get(source_ref).map(|b| b.root_register).unwrap_or(false) {
            return self.day_reread(source_ref);
        }
        let route = self.buffers.get(source_ref).map(|b| b.project.as_str()).filter(|p| !p.is_empty())
            .or(project).unwrap_or(self.client.configured_project()).to_owned();
        let project = Some(route.as_str());
        let had_conflict = self
            .buffers
            .get(source_ref)
            .map(|buffer| buffer.conflict.is_some())
            .unwrap_or(false);
        let old_base = self
            .buffers
            .get(source_ref)
            .map(|buffer| buffer.base_revision.clone());
        let reading = self.owner_read(project, source_ref)?;
        let moved = old_base
            .as_deref()
            .map(|base| base != reading.revision.revision)
            .unwrap_or(true);
        // Nothing changed — same revision, no conflict to clear — nothing
        // is emitted.
        let changed = moved || had_conflict;
        let buffer = self.sync_buffer_from_reading(&reading, false, &route);
        let receipt = changed.then(|| {
            self.log.record(KernelEvent::SourceOpened {
                source: source_semantic_ref(source_ref, Some(&reading.revision.revision))
                    .unwrap_or_else(|_| fallback_source_ref(source_ref)),
                revision: reading.revision.revision.clone(),
                summary: format!(
                    "Re-read the canonical layer: now based on revision {}.",
                    short_revision(&reading.revision.revision)
                ),
            })
        });
        Ok(KernelOpOutcome {
            receipts: receipt.into_iter().collect(),
            result: KernelOpResult::SourceReread { buffer },
        })
    }

    /// Re-read a root-register Day buffer through the owner's own Day route
    /// (`central.day.read`, explicit-null project). The carrier identity is
    /// the held document's own `day_ref` — without it the owner would read
    /// today's carrier, which may already be a different source; that
    /// mismatch is refused, never silently swapped into this buffer.
    fn day_reread(&mut self, source_ref: &str) -> Result<KernelOpOutcome, String> {
        let Some(held) = self.buffers.get(source_ref) else {
            return Err(format!(
                "no open buffer for `{source_ref}`; a buffer exists only after the source is opened"
            ));
        };
        let day_ref = serde_json::from_str::<serde_json::Value>(&held.content)
            .ok()
            .and_then(|doc| doc.get("day_ref").and_then(|v| v.as_str()).map(str::to_owned));
        let mut input = serde_json::Map::new();
        input.insert("project".to_owned(), serde_json::Value::Null);
        if let Some(day_ref) = &day_ref {
            input.insert("day_ref".to_owned(), serde_json::Value::String(day_ref.clone()));
        }
        let data = self
            .client
            .run("central.day.read", serde_json::Value::Object(input))
            .map_err(|e| e.to_string())?;
        let disclosed_ref = data["source"]["ref"]
            .as_str()
            .ok_or("Central's Day reading disclosed no source ref")?;
        if disclosed_ref != source_ref {
            return Err(format!(
                "the Day route names a different carrier than this buffer holds ({disclosed_ref}); re-open through Today — this surface keeps its own identity"
            ));
        }
        let revision = data["revision"]["revision"]
            .as_str()
            .ok_or("Central's Day reading disclosed no source revision")?
            .to_owned();
        let path = data["source"]["path"]
            .as_str()
            .ok_or("Central's Day reading disclosed no source path")?
            .to_owned();
        let content = data["content"]
            .as_str()
            .ok_or("Central's Day reading disclosed no content")?
            .to_owned();
        let had_conflict = held.conflict.is_some();
        let moved = held.base_revision != revision;
        // Same law as a project re-read: a clean buffer mirrors the canonical
        // content; a dirty buffer keeps its content and only rebases.
        let buffer = {
            let buffer = self.buffers.get_mut(source_ref).expect("held above");
            let was_dirty = buffer.dirty;
            buffer.saved_content = content.clone();
            buffer.base_revision = revision.clone();
            buffer.path = Some(path);
            if !was_dirty {
                buffer.content = content;
            }
            if buffer.content == buffer.saved_content {
                buffer.dirty = false;
            }
            buffer.conflict = None;
            buffer.clone()
        };
        let changed = moved || had_conflict;
        let receipt = changed.then(|| {
            self.log.record(KernelEvent::SourceOpened {
                source: source_semantic_ref(source_ref, Some(&revision))
                    .unwrap_or_else(|_| fallback_source_ref(source_ref)),
                revision: revision.clone(),
                summary: format!(
                    "Re-read the Day through the owner's Day route: now based on revision {}.",
                    short_revision(&revision)
                ),
            })
        });
        Ok(KernelOpOutcome {
            receipts: receipt.into_iter().collect(),
            result: KernelOpResult::SourceReread { buffer },
        })
    }

    fn owner_read(&self, project: Option<&str>, source_ref: &str) -> Result<SourceReading, String> {
        self.client
            .source_read(project, source_ref)
            .map_err(|error| error.to_string())
    }

    // -----------------------------------------------------------------------
    // Surfaces — S's own frame state (law 12, D16)
    // -----------------------------------------------------------------------

    fn surface_open(
        &mut self,
        surface_id: String,
        kind: String,
        source_ref: Option<String>,
        title: String,
    ) -> Result<KernelOpOutcome, String> {
        if kind == "encounter" && !source_ref.as_ref().is_some_and(|r|self.encounter_refs.contains_key(r)){return Err("Encounter surface requires a current AIKit reading".into());}
        if kind == "file" && !source_ref.as_ref().is_some_and(|r| self.file_refs.contains_key(r)) {
            return Err("File must be read successfully through Central before opening its surface".into());
        }
        if kind == "knowledge" && !source_ref.as_ref().is_some_and(|r| self.knowledge_refs.contains_key(r)) {
            return Err("Knowledge surface requires a current owner reading".into());
        }
        let surface = SurfaceState {
            surface_id: surface_id.clone(),
            kind,
            source_ref: source_ref.clone(),
            title,
        };
        self.surfaces.insert(surface_id.clone(), surface.clone());
        let semantic = surface.source_ref.as_deref().and_then(|reference| {
            if surface.kind == "knowledge" { self.knowledge_refs.get(reference).cloned() }
            else if surface.kind == "file" { self.file_refs.get(reference).map(|r|r.0.clone()) }
            else if surface.kind == "encounter" {self.encounter_refs.get(reference).map(|r|r.0.clone())}
            else { source_semantic_ref(reference, None).ok() }
        });
        let receipt = self.log.record(KernelEvent::SurfaceChanged {
            surface_id,
            surface_ref: semantic,
            summary: format!("Surface opened: {}.", surface.title),
        });
        Ok(KernelOpOutcome {
            receipts: vec![receipt],
            result: KernelOpResult::SurfaceOpened {
                snapshot: self.snapshot(),
            },
        })
    }

    fn surface_close(&mut self, surface_id: String) -> Result<KernelOpOutcome, String> {
        let Some(surface) = self.surfaces.remove(&surface_id) else {
            return Err(format!("no surface `{surface_id}` is open"));
        };
        let mut receipts = vec![self.log.record(KernelEvent::SurfaceChanged {
            surface_id: surface.surface_id.clone(),
            surface_ref: surface
                .source_ref
                .as_deref()
                .and_then(|reference| {
                    if surface.kind == "knowledge" { self.knowledge_refs.get(reference).cloned() }
            else if surface.kind == "file" { self.file_refs.get(reference).map(|r|r.0.clone()) }
            else if surface.kind == "encounter" {self.encounter_refs.get(reference).map(|r|r.0.clone())}
                    else { source_semantic_ref(reference, None).ok() }
                }),
            summary: format!("Surface closed: {}.", surface.title),
        })];
        // Closing the focused subject's surface clears the focus relation —
        // a second state change, disclosed with its own receipt.
        let focused_this = self
            .focus
            .subject_ref()
            .map(|subject| {
                surface
                    .source_ref
                    .as_deref()
                    .is_some_and(|source_ref| source_ref == subject.ref_id)
            })
            .unwrap_or(false);
        if focused_this {
            self.focus.clear_subject();
            receipts.push(self.log.record(KernelEvent::FocusChanged {
                focus: self.focus.clone(),
            }));
        }
        Ok(KernelOpOutcome {
            receipts,
            result: KernelOpResult::SurfaceClosed {
                snapshot: self.snapshot(),
            },
        })
    }

    fn surface_focus(&mut self, surface_id: String) -> Result<KernelOpOutcome, String> {
        let Some(surface) = self.surfaces.get(&surface_id) else {
            return Err(format!("no surface `{surface_id}` is open"));
        };
        // Focus follows the active binding (D16). A surface with no
        // semantic ref (the sources index) holds no subject: the relation
        // returns to B0 No focus — an observation, never fabricated.
        let Some(source_ref) = surface.source_ref.clone() else {
            if self.focus.subject_ref().is_some() {
                self.focus.clear_subject();
                let receipt = self.log.record(KernelEvent::FocusChanged {
                    focus: self.focus.clone(),
                });
                return Ok(KernelOpOutcome {
                    receipts: vec![receipt],
                    result: KernelOpResult::SurfaceFocused {
                        snapshot: self.snapshot(),
                    },
                });
            }
            return Ok(KernelOpOutcome {
                receipts: Vec::new(),
                result: KernelOpResult::SurfaceFocused {
                    snapshot: self.snapshot(),
                },
            });
        };
        let old_focus = self.focus.clone();
        if let Some(buffer) = self.buffers.get(&source_ref) {
            if !buffer.world_ref.is_empty() {
                self.focus.bind_world(focus::WorldRef::try_from(owner_relation(&buffer.world_ref, "world", "projectcentral.source.read")).map_err(|e| e.to_string())?);
            }
            self.focus.project = buffer.project_ref.as_ref().map(|r| focus::ProjectRef::try_from(owner_relation(r, "project", "projectcentral.inspect"))).transpose().map_err(|e| e.to_string())?;
        }
        let subject = if surface.kind == "encounter" {
            let (subject,project)=self.encounter_refs.get(&source_ref).cloned().ok_or("Encounter must be resolved through AIKit")?;
            self.focus.project=Some(project);self.focus.world=None;subject
        } else if surface.kind == "file" {
            let (subject,project) = self.file_refs.get(&source_ref).cloned().ok_or("File must be resolved through Central")?;
            self.focus.project = project;
            self.focus.world = None;
            subject
        } else if surface.kind == "knowledge" {
            self.focus.project = self.knowledge_projects.get(&source_ref).cloned().flatten();
            self.focus.world = None;
            self.knowledge_refs.get(&source_ref).cloned().ok_or("Knowledge subject must be resolved through AIKit")?
        } else { source_semantic_ref(&source_ref, None)? };
        self.focus
            .focus_subject(subject)
            .map_err(|error| error.to_string())?;
        if self.focus == old_focus { return Ok(KernelOpOutcome { receipts: Vec::new(), result: KernelOpResult::SurfaceFocused { snapshot: self.snapshot() } }); }
        let receipt = self.log.record(KernelEvent::FocusChanged {
            focus: self.focus.clone(),
        });
        Ok(KernelOpOutcome {
            receipts: vec![receipt],
            result: KernelOpResult::SurfaceFocused {
                snapshot: self.snapshot(),
            },
        })
    }
}

/// A shortened revision for summaries (the full revision rides in the
/// payload fields; summaries are observations, never the data).
fn short_revision(revision: &str) -> &str {
    let Some((_, tail)) = revision.rsplit_once(':') else {
        return revision;
    };
    tail
}

/// Unreachable in practice (a buffer exists only for a non-empty ref); kept
/// so an event is never suppressed by a wrapping failure.
fn fallback_source_ref(source_ref: &str) -> SemanticRef {
    SemanticRef {
        ref_id: source_ref.to_owned(),
        kind: refs::SOURCE_KIND.to_owned(),
        native_owner: refs::SOURCE_NATIVE_OWNER.to_owned(),
        provenance: refs::RefProvenance {
            source: refs::SOURCE_PROVENANCE.to_owned(),
            revision: None,
        },
    }
}

fn owner_relation(reference: &str, kind: &str, source: &str) -> SemanticRef {
    SemanticRef { ref_id: reference.into(), kind: kind.into(), native_owner: "central".into(), provenance: refs::RefProvenance { source: source.into(), revision: None } }
}

fn native_owner_reading<T:Serialize>(owner:&str,result:Result<T,material::Error>)->Result<KernelOpOutcome,String>{
    let (data,failure)=match result {
        Ok(value)=>(Some(serde_json::to_value(value).map_err(|e|e.to_string())?),None),
        Err(error)=>(None,Some(serde_json::to_value(error).map_err(|e|e.to_string())?)),
    };
    Ok(KernelOpOutcome{receipts:Vec::new(),result:KernelOpResult::NativeOwnerReading{owner:owner.into(),data,failure}})
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn state_and_listing_ops_emit_nothing() {
        let mut kernel = Kernel::new(CentralClient::with(
            "/nonexistent/ctrl-fixture".into(),
            None,
            "test".into(),
        ));
        let outcome = kernel.apply(KernelOp::State).unwrap();
        assert!(outcome.receipts.is_empty());
        // unavailable ctrl -> honest unavailable listing, not an error
        let outcome = kernel
            .apply(KernelOp::SourcesList { project: None })
            .unwrap();
        assert!(outcome.receipts.is_empty());
        let KernelOpResult::SourcesListed { listing } = outcome.result else {
            panic!("listing result");
        };
        assert!(listing.sources.is_empty());
        assert!(matches!(
            listing.availability,
            world::ListingAvailability::Unavailable { .. }
        ));
        assert_eq!(kernel.event_log().len(), 0);
    }

    #[test]
    fn an_edit_without_an_open_buffer_is_refused() {
        let mut kernel = Kernel::new(CentralClient::with(
            "/nonexistent/ctrl-fixture".into(),
            None,
            "test".into(),
        ));
        assert!(kernel
            .apply(KernelOp::SourceEdit {
                source_ref: "central:source:project:project:test:a.md".into(),
                content: "x".into(),
            })
            .is_err());
    }
}
