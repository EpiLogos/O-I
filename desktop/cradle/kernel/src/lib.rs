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
//! The kernel never writes native source files or mints native subject refs.
//! Expression-local presentation refs do not acquire native subject identity.

pub mod events;
pub mod expression;
pub mod native_expression;
pub mod expression_asset;
pub mod expression_carrier;
pub mod expression_profile;
pub mod expression_transport;
pub mod expression_trigger;
pub mod flow;
pub mod history;
pub mod knowledge;
pub mod shared_field;
pub mod action;
pub mod configuration;
pub mod setup;
pub mod graph;
pub mod encounter;
pub mod agency;
pub mod being;
pub mod chat_defaults;
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
/// Short-horizon read-through cache for the owner readings the UI re-reads
/// (see the module's own law). Private to the kernel's apply path.
mod read_cache;
// --- expression_world (ES1 knowledge side + ES4 joint focus/deixis/portals),
// lane aikit/es-one-state-relation: the shared selection relation, Surface
// portals, ExpressiveAct and bounded local-whole bindings over exact refs.
pub mod expression_world;

pub use flow::{CentralClient, OwnerCallError};

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

use events::{KernelEvent, KernelEventLog, KernelEventReceipt};
use flow::{CRADLE_ACTOR, CRADLE_ACTOR_KIND, SourceReading, SourceWriteFailure};
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
    expressions: expression::Application,
    native_expression: native_expression::Manager,
    agency: agency::Client,
    client: CentralClient,
    focus: GlobalFocus,
    // --- expression_world (ES1/ES4, lane aikit/es-one-state-relation): the
    // one shared selection relation, portal/act/local-whole records.
    world: expression_world::WorldState,
    log: KernelEventLog,
    surfaces: BTreeMap<String, SurfaceState>,
    buffers: BTreeMap<String, SourceBuffer>,
    navigator: world::NavigatorReading,
    file_refs: BTreeMap<String, (SemanticRef, Option<focus::ProjectRef>)>,
    knowledge_refs: BTreeMap<String, SemanticRef>,
    encounter_refs: BTreeMap<String,(SemanticRef,focus::ProjectRef)>,
    knowledge_projects: BTreeMap<String, Option<focus::ProjectRef>>,
    reads: read_cache::OwnerReadCache,
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
    Setup { request: serde_json::Value },
    BeingEncounter { request: being::Request },
    Expression { request: expression::Request },
    NativeExpression { request: native_expression::Request },
    /// Pull the whole kernel state (read model; emits nothing).
    State,
    WorldRead,
    ProjectRead { project: String },
    /// `fresh` bypasses the read cache for this one reading — the explicit
    /// refresh affordance, not the ordinary browse.
    WorldBrowse { #[serde(default, skip_serializing_if = "Option::is_none")] fresh: Option<bool> },
    Knowledge { #[serde(default)] project: Option<String>, request: knowledge::Request },
    /// Assemble the typed graph input for U3.1/U3.4 presentation: Central's
    /// wiki read model (cell C1) composed with AIKit's owner-side resolution
    /// rows (cell C2) and the hosted Shared Field projection (Lane C step
    /// 5, the O:I-owned client's snapshot). Adapter only — every node/edge
    /// carries its owner ref, owner operation and owner provenance
    /// verbatim; a failed input degrades honestly as an explicit
    /// unavailable input. Emits nothing (pull read).
    Graph { #[serde(default)] project: Option<String>, #[serde(default)] query: String },
    /// One request to the O:I-owned SharedField client (`shared_field.rs`,
    /// cell S→S0 · aperture mode): `status` | `snapshot` | `read {ref}` |
    /// `publish {args}` | `participant` | `admit` | `contact`, carried
    /// verbatim to the owner doorway. Pull only — emits nothing. The
    /// hosting target and transport token are the client's own
    /// environment; an unbound target or unreachable field returns an
    /// explicit `{state:"unavailable", detail}` reading as data, never an
    /// error; the owner's own refusal is returned in the owner's words.
    SharedField { request: serde_json::Value },
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
    /// Compose the W1.5 changed-since-thought read (`flow_cognition.rs`):
    /// the kernel supplies the KnowledgeChangeHorizon adapted from Central's
    /// own `projectcentral.change.horizon` seam and calls the AIKit owner's
    /// `flow changed-since`; ONE typed reading comes back with both owner
    /// sides explicit — a side that could not be queried is named, never
    /// faked empty. Emits nothing (pull read + owner read).
    FlowChangedSince { #[serde(default)] project: Option<String>, thought: serde_json::Value },
    /// Commission one selection inside a flow instance (U4.1/U4.2 loop
    /// mode, `commission.rs`): the desktop composes the next instance
    /// through the template's own append-entry contract and hands it
    /// verbatim with the instance location and the expected revision; the
    /// commission lands as an owner revision through Central's
    /// `central.files.write` CAS — a stale expected revision is the owner's
    /// own structured conflict, never a silent overwrite. An optional
    /// AgentSession binds as the write's actor.
    InstanceCommission {
        location: files::Location,
        expected_revision: String,
        content: String,
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
    /// Provision ONE fresh chat conversation for a project and open it — the
    /// desktop's new-chat first Send. The kernel replays the owner's own
    /// SessionSpace CLI sequence (`project-context` → create →
    /// bind-project-context → attach-agent-session → encounter-agency-configure
    /// → encounter open) and returns the minted refs plus the open result.
    /// Every other encounter action keeps its attachment gate; this is the one
    /// path allowed to create the attachment it needs.
    EncounterProvision {project:String},
    MaterialRead {target:material::Target},
    /// The re-pinned build view (queue cell B): the owner CLI reads it as
    /// `factory build snapshot <state> <project-ref> <run-ref>` — the old
    /// `build discover`/`--binding` grammar is gone from the installed cut.
    /// Refs and state path are the caller's disclosure; payload verbatim
    /// after the contract schemas are verified.
    FactoryBuildSnapshot { #[serde(default)] project: Option<String>, state_path: ::std::path::PathBuf, project_ref: String, run_ref: String },
    /// 6D first consumer (queue cell 3): one developmental read through the
    /// owner's own `factory development` family. The state path is the
    /// caller's disclosure — the desktop never invents a Factory state.
    FactoryDevelopmentRead { #[serde(default)] project: Option<String>, state_path: ::std::path::PathBuf, read: String, #[serde(default)] subject: Option<String> },
    /// Run-in-Expressions: the whole SSSF attempt reading
    /// (`factory attempt read <state> <run-ref>`) — legs, attempts,
    /// verifications and the readable Return — so the Expression presents the
    /// run's actual evidence structure. The payload is carried verbatim after
    /// its contract schema is verified; no second run store is created.
    FactoryAttemptRead { state_path: ::std::path::PathBuf, run_ref: String },
    /// The task refs a Run's attempt field carries
    /// (`factory attempt list <state> <run-ref>` → the owner's
    /// `factory.attempt-task-list-reading/v1`). The state path and run ref are
    /// the caller's disclosure; the payload is carried verbatim after its
    /// contract schema is verified — no task list is invented.
    FactoryAttemptTaskListRead { state_path: ::std::path::PathBuf, run_ref: String },
    /// One task's attempt reading with the owner's own pagination
    /// (`factory attempt task <state> <run-ref> <task-ref> [--limit] [--cursor]`
    /// → `factory.attempt-task-reading/v1`): attempts, verifications, owner
    /// telemetry correlations and the readable Return. Limit and cursor are the
    /// owner's grammar, passed through; stale-cursor refusal stays the owner's.
    FactoryAttemptTaskRead { state_path: ::std::path::PathBuf, run_ref: String, task_ref: String, #[serde(default)] limit: Option<u32>, #[serde(default)] cursor: Option<serde_json::Value> },
    /// Workcell's own placement/status reading (`workcell status --json`),
    /// beside the Factory reads — placement is Workcell's, never the desktop's.
    WorkcellStatusRead,
    /// The installed harnesses' real status (`aikit --json client status`
    /// through the suite route): which harnesses are detected on this
    /// machine, which carry AIKit, their config dirs and gaps. Pull read,
    /// machine-level — the settings face renders the owner's rows verbatim.
    HarnessStatus,
    /// The resolved model catalogue (`aikit model-catalogue show --json`
    /// through the suite route): first-party seed, provider sources and
    /// owner entries as the owner resolved them. Pull read.
    ModelCatalogue,
    /// The desktop-held default provider for NEW chats
    /// (`chat_defaults.rs`): the desired-entry-shaped document when one is
    /// held, `None` when the owner's rows decide (`pi` row, else first).
    /// The owner's configuration plane carries no setting for this choice —
    /// its models are "resolved per launch", not addressable — so the
    /// desktop holds it honestly under its own `oi:cradle` namespace.
    ChatDefaultRead,
    /// Hold (or replace) that default: the provider id of one CONFIGURED
    /// encounter provider row. Machine-local desktop state, never an
    /// owner write.
    ChatDefaultHold { provider: String },
    /// Withdraw the held default — an explicit operation; the discard
    /// document carries the observed `removed` fact.
    ChatDefaultDiscard,
    /// The configuration-plane binding (#299 C6 live leg,
    /// `configuration.rs`): every operation routes through the INSTALLED
    /// `oi` executable — the same engine `oi config` / `oi profile` drive —
    /// so the Desktop holds no parallel product semantics. Pull/mutate
    /// details are documented on the module.
    /// The configuration registry: `<ns> config-contribution --json` per
    /// mount position (09 §4), the same owner positions
    /// `SystemCompositionRead` discovers. A failed or non-conforming read
    /// is a named degradation on the mount, never an invented contribution.
    ConfigRegistryRead,
    /// `oi.config-resolution/v1` per (setting, scope): desired folded by
    /// the engine's own desired store, native axes passed through
    /// unmodified from the owner's v2 reading (09 §7). A refused pairing
    /// comes back WITH a reconciliation status, never omitted.
    ConfigResolutionsRead { pairs: Vec<configuration::ConfigPair> },
    /// Hold (or replace) one desired entry in the engine's desired store —
    /// no owner is touched. Secret-kind holds carry the reference only.
    ConfigDesiredHold { request: configuration::ConfigRequest },
    /// Withdraw one held desired entry — an explicit operation, never
    /// implicit; the discard document carries the observed `removed` fact.
    ConfigDesiredDiscard { setting_ref: String, scope: configuration::ConfigScope },
    /// Owner-native plans through `oi config plan` (09 §6): owner-minted
    /// plans verbatim, refused requests as their own `oi.config-error/v1`.
    ConfigPlan { requests: Vec<configuration::ConfigRequest> },
    /// Apply the requests under ONE client-minted ChangeSet (09 §8) through
    /// `oi config apply`: the engine validates, orchestrates the owner
    /// verbs, takes the re-read verification (09 §9) and persists; the
    /// executed ChangeSet and owner-minted receipts cross back verbatim.
    ConfigApply { requests: Vec<configuration::ConfigRequest> },
    /// The stored `oi.profile/v1` documents beside the explicit active
    /// mark (09 §12).
    ProfileList,
    ProfileRead { profile_ref: String },
    /// The inspectable use plan: what the profile would hold beside what is
    /// currently held — BEFORE anything moves (09 §12; `use` writes only
    /// the active mark and moves no native state).
    ProfileUsePlan { profile_ref: String },
    /// Make the profile active — only ever AFTER its use plan was rendered
    /// and accepted (the mark is the engine's only write here).
    ProfileUseApply { profile_ref: String },
    /// Create an empty sparse profile.
    ProfileCreate { profile_ref: String, #[serde(default)] title: Option<String> },
    /// Edit a stored profile in place through the engine's own `oi profile
    /// edit` verb (09 §12, additive): an explicit operation set, judged and
    /// stored by the engine's own laws. Nothing is applied to any owner.
    ProfileEdit {
        profile_ref: String,
        operations: Vec<configuration::ProfileEditOp>,
    },
    /// The recorded receipt references (09 §9): a listing of the recorded
    /// refs, never a second store; the owner's own history stays the record
    /// of record.
    ConfigReceipts,
    Ground {request:ground::Request},
    CompositionRead {#[serde(default)] owners:bool},
    /// Wave 5 (docs/cradle/07): mount each of the six owners' own native
    /// `<product> system --json` disclosure, unmodified, alongside its
    /// honest availability. Distinct from `CompositionRead`, which reads
    /// the `oi` composition layer's own census.
    SystemCompositionRead,
    /// `fresh` bypasses the cached listing for this one read — the explicit
    /// tree refresh, not an ordinary expansion.
    FilesList { path: String, #[serde(default, skip_serializing_if = "Option::is_none")] fresh: Option<bool> },
    FileOperation {location:files::Location,request:files::Request},
    FileRead { location: files::Location },
    /// Binary-safe material read (FND-04): the owner's base64 encoding,
    /// never the UTF-8 text contract. Distinct name from the Workcell
    /// `MaterialRead` op above — this reads a native Central file, not a
    /// Workcell material target.
    FileBytes { location: files::Location },
    ProjectBrowse { project: String, #[serde(default, skip_serializing_if = "Option::is_none")] fresh: Option<bool> },
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
    // --- expression_world (ES1/ES4, lane aikit/es-one-state-relation): the
    // generic world operations — shared selection/deictic context,
    // SurfacePortal inspect/open/close/redock, ExpressiveAct
    // perform/interrupt/checkpoint/restore and bounded local-whole
    // bind/inspect/rebase over exact native refs. See expression_world.rs.
    ExpressionWorld { request: expression_world::Request },
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
    SetupReading { data: serde_json::Value },
    BeingEncounter { data: serde_json::Value },
    Expression { data: serde_json::Value },
    NativeExpression { data: serde_json::Value },
    State { snapshot: KernelSnapshot },
    WorldRead { snapshot: KernelSnapshot },
    Knowledge { data: serde_json::Value },
    GraphReading { reading: graph::GraphReading },
    /// The SharedField client's own reading (`oi.shared-field.*/v1`), or
    /// the explicit unavailable state — verbatim either way.
    SharedFieldReading { data: serde_json::Value },
    /// The typed encounter join (`encounter.rs`): both owner views, the
    /// grant-record seam and the failure-taxonomy disposition.
    EncounterJoined {
        reading: encounter::EncounterReading,
    },
    /// The typed result of one owner-Action dispatch (`action.rs`): the
    /// owner payload verbatim, or an explicit named state.
    ActionDispatched { dispatch: action::ActionDispatch },
    /// The typed changed-since-thought compose (`flow_cognition.rs`): both
    /// owner sides of the read, explicit.
    FlowChangedSince { reading: flow_cognition::ChangedSinceReading },
    /// The typed selection commission outcome (`commission.rs`): owner
    /// revision, structured conflict, or the owner's own refusal.
    InstanceCommissioned { outcome: commission::CommissionOutcome },
    AgencyReading { project_ref: String, spaces: serde_json::Value, observed_at_unix_ms: u64 },
    EncounterReading {data:serde_json::Value},
    /// The provisioned chat conversation: the minted space and session refs,
    /// the chosen default provider and the owner's own open result, verbatim.
    EncounterProvisioned {data:serde_json::Value},
    ReceivingReading {data:serde_json::Value},
    NowReading {data:serde_json::Value},
    EncounterTaskReading {data:serde_json::Value},
    FactoryDevelopmentReading {data:serde_json::Value},
    FactoryAttemptReading {data:serde_json::Value},
    FactoryAttemptTaskListReading {data:serde_json::Value},
    FactoryAttemptTaskReading {data:serde_json::Value},
    WorkcellStatusReading {data:serde_json::Value},
    /// The harness status rows, verbatim from the owner's `client status`.
    HarnessStatusReading {data:serde_json::Value},
    /// The resolved model catalogue, verbatim from the owner.
    ModelCatalogueReading {data:serde_json::Value},
    /// The held chat default — the desktop's own document, or `None` when
    /// the owner's rows decide.
    ChatDefaultReading {document:Option<serde_json::Value>},
    ChatDefaultHeld {document:serde_json::Value},
    ChatDefaultDiscarded {document:serde_json::Value},
    /// The configuration registry reading (`configuration.rs`): the seven
    /// canonical positions, each honestly mounted or degraded by name.
    ConfigRegistryReading { reading: configuration::RegistryReading },
    /// One resolution per requested pair, in order (09 §7 documents
    /// verbatim; refused pairings as named reconciliations).
    ConfigResolutions { resolutions: Vec<serde_json::Value> },
    /// The held desired entry as the engine recorded it.
    ConfigDesiredHeld { entry: serde_json::Value },
    /// The discard document, with its observed `removed` fact.
    ConfigDesiredDiscarded { document: serde_json::Value },
    /// Owner-minted plans plus the structured errors for the requests that
    /// could not be planned.
    ConfigPlanned { plans: Vec<serde_json::Value>, errors: Vec<serde_json::Value> },
    /// The executed ChangeSet beside the owner-minted receipts (09 §8/§9),
    /// verbatim. `owner_receipts` — not `receipts` — so the field never
    /// collides with the kernel event receipts beside it on the wire.
    ConfigApplied { changeset: serde_json::Value, #[serde(rename = "owner_receipts")] owner_receipts: Vec<serde_json::Value> },
    /// The stored profiles beside the explicit active mark; a document
    /// that stopped reading is named in `degraded`, never silently dropped.
    ProfileListing {
        active_profile_ref: Option<String>,
        profiles: Vec<serde_json::Value>,
        #[serde(default, skip_serializing_if = "Vec::is_empty")]
        degraded: Vec<serde_json::Value>,
    },
    ProfileReading { profile: serde_json::Value },
    /// The inspectable profile-use plan (09 §12).
    ProfileUsePlanning { plan: configuration::UsePlan },
    /// The activation document the engine recorded (the mark, nothing else).
    ProfileUsed { activation: serde_json::Value },
    ProfileCreated { profile: serde_json::Value },
    /// The edited document beside the per-operation record — the
    /// `oi.profile-edit/v1` envelope, verbatim.
    ProfileEdited { document: serde_json::Value },
    /// The recorded receipt references — the `oi.config-receipts/v1`
    /// envelope, verbatim; an absent history is an empty list.
    ConfigReceipts { document: serde_json::Value },
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
    // --- expression_world (ES1/ES4, lane aikit/es-one-state-relation).
    ExpressionWorld { data: serde_json::Value },
}

impl Kernel {
    pub fn new(client: CentralClient) -> Self {
        Self::with_agency(client, agency::Client::discover())
    }

    pub fn with_agency(client: CentralClient, agency: agency::Client) -> Self {
        Self {
            client,
            agency,
            expressions: expression::Application::default(),
            native_expression: native_expression::Manager::default(),
            focus: GlobalFocus::unfocused(),
            world: expression_world::WorldState::default(),
            log: KernelEventLog::new(),
            surfaces: BTreeMap::new(),
            buffers: BTreeMap::new(),
            navigator: world::NavigatorReading::default(),
            file_refs: BTreeMap::new(),
            knowledge_refs: BTreeMap::new(),
            encounter_refs: BTreeMap::new(),
            knowledge_projects: BTreeMap::new(),
            reads: read_cache::OwnerReadCache::default(),
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
            KernelOp::NativeExpression { request } => {
                let data = self.native_expression.apply(&self.client, request)?;
                Ok(KernelOpOutcome { receipts: Vec::new(), result: KernelOpResult::NativeExpression { data } })
            }
            KernelOp::Expression { request } => {
                let focus_ref = match &request {
                    expression::Request::Edit { expression_ref, changes, .. }
                        if changes.iter().any(|c| matches!(c, expression::Change::Focus { .. })) => Some(expression_ref.clone()),
                    _ => None,
                };
                let (data, changed) = self.expressions.apply(&self.client, request)?;
                let mut receipts = Vec::new();
                if let Some(change) = changed {
                    receipts.push(self.log.record(KernelEvent::ExpressionChanged { expression_ref: change.expression_ref, revision: change.revision, actor: change.actor, activity_ref: change.activity_ref }));
                }
                if data["state"] == "ready" {
                    if let Some(expression_ref) = focus_ref.as_deref() {
                        if let Some(subject) = self.expressions.selected_subject(expression_ref) {
                            let before = self.focus.clone();
                            self.focus.focus_subject(subject.clone()).map_err(|e| e.to_string())?;
                            if before != self.focus { receipts.push(self.log.record(KernelEvent::FocusChanged { focus: self.focus.clone() })); }
                            // --- expression_world (ES1/ES4, lane aikit/es-one-state-relation):
                            // an Expression focus edit IS the shared selection relation
                            // moving. The graph, Wiki and constellation presentations
                            // read and write this same deictic context over the exact
                            // same native ref (one canonical bounded selection state;
                            // every depth is a presentation over it). No separate
                            // event: the move already emitted FocusChanged when the
                            // relation changed, and `selection_read` is the pull.
                            self.world.record_expression_selection(expression_ref, &subject);
                        }
                    }
                }
                Ok(KernelOpOutcome { receipts, result: KernelOpResult::Expression { data } })
            }
            KernelOp::MaterialRead{target} => native_owner_reading("workcell",material::Client::discover().read(&target)),
            KernelOp::FactoryBuildSnapshot {project,state_path,project_ref,run_ref} => {
                if let Some(project)=&project {
                    let root=self.world_map(false).map_err(|e|e.to_string())?;
                    root["work"]["projects"].as_array().and_then(|rows|rows.iter().find(|r|r["name"].as_str()==Some(project.as_str()))).ok_or("Project is outside Central's disclosed ground")?;
                }
                let direct=std::env::var_os("OI_FACTORY_BIN").map(std::path::PathBuf::from);
                let (executable, suite_route)=match direct {
                    Some(path)=>(path, false),
                    None=>(std::env::var_os("OI_BIN").map(std::path::PathBuf::from).unwrap_or_else(|| std::path::PathBuf::from("oi")), true),
                };
                let data=factory::Client::with(executable).build_snapshot(&state_path,&project_ref,&run_ref,suite_route).map_err(|e|serde_json::to_string(&e).unwrap_or_else(|_|"factory build snapshot failed".into()))?;
                Ok(KernelOpOutcome{receipts:Vec::new(),result:KernelOpResult::FactoryDevelopmentReading{data}})
            }
            KernelOp::FactoryDevelopmentRead {project,state_path,read,subject} => {
                if let Some(project)=&project {
                    let root=self.world_map(false).map_err(|e|e.to_string())?;
                    root["work"]["projects"].as_array().and_then(|rows|rows.iter().find(|r|r["name"].as_str()==Some(project.as_str()))).ok_or("Project is outside Central's disclosed ground")?;
                }
                let direct=std::env::var_os("OI_FACTORY_BIN").map(std::path::PathBuf::from);
                let (executable, suite_route)=match direct {
                    Some(path)=>(path, false),
                    None=>(std::env::var_os("OI_BIN").map(std::path::PathBuf::from).unwrap_or_else(|| std::path::PathBuf::from("oi")), true),
                };
                let args=factory::development_read_args(&state_path,&read,subject.as_deref(),suite_route);
                let data=material::invoke(&executable,&args,None).map_err(|e|serde_json::to_string(&e).unwrap_or_else(|_|"factory development read failed".into()))?;
                Ok(KernelOpOutcome{receipts:Vec::new(),result:KernelOpResult::FactoryDevelopmentReading{data}})
            }
            KernelOp::FactoryAttemptRead {state_path,run_ref} => {
                let direct=std::env::var_os("OI_FACTORY_BIN").map(std::path::PathBuf::from);
                let (executable,suite_route)=match direct {Some(path)=>(path,false),None=>(std::env::var_os("OI_BIN").map(std::path::PathBuf::from).unwrap_or_else(||std::path::PathBuf::from("oi")),true)};
                let mut args:Vec<std::ffi::OsString>=Vec::new(); if suite_route {args.push("factory".into());} args.extend(["attempt".into(),"read".into(),state_path.as_os_str().to_string_lossy().into_owned().into(),run_ref.into(),"--json".into()]);
                let data=material::invoke(&executable,&args,None).map_err(|e|serde_json::to_string(&e).unwrap_or_else(|_|"factory attempt read failed".into()))?;
                if data.get("contract").and_then(serde_json::Value::as_str)!=Some("factory.attempt-reading/v1"){return Err("Factory returned incompatible attempt reading".into());}
                Ok(KernelOpOutcome{receipts:Vec::new(),result:KernelOpResult::FactoryAttemptReading{data}})
            }
            KernelOp::FactoryAttemptTaskListRead {state_path,run_ref} => {
                let direct=std::env::var_os("OI_FACTORY_BIN").map(std::path::PathBuf::from);
                let (executable,suite_route)=match direct {Some(path)=>(path,false),None=>(std::env::var_os("OI_BIN").map(std::path::PathBuf::from).unwrap_or_else(||std::path::PathBuf::from("oi")),true)};
                let mut args:Vec<std::ffi::OsString>=Vec::new(); if suite_route {args.push("factory".into());} args.extend(["attempt".into(),"list".into(),state_path.as_os_str().to_string_lossy().into_owned().into(),run_ref.into(),"--json".into()]);
                let data=material::invoke(&executable,&args,None).map_err(|e|serde_json::to_string(&e).unwrap_or_else(|_|"factory attempt list failed".into()))?;
                if data.get("contract").and_then(serde_json::Value::as_str)!=Some("factory.attempt-task-list-reading/v1"){return Err("Factory returned incompatible attempt-task list reading".into());}
                Ok(KernelOpOutcome{receipts:Vec::new(),result:KernelOpResult::FactoryAttemptTaskListReading{data}})
            }
            KernelOp::FactoryAttemptTaskRead {state_path,run_ref,task_ref,limit,cursor} => {
                let direct=std::env::var_os("OI_FACTORY_BIN").map(std::path::PathBuf::from);
                let (executable,suite_route)=match direct {Some(path)=>(path,false),None=>(std::env::var_os("OI_BIN").map(std::path::PathBuf::from).unwrap_or_else(||std::path::PathBuf::from("oi")),true)};
                let mut args:Vec<std::ffi::OsString>=Vec::new(); if suite_route {args.push("factory".into());} args.extend(["attempt".into(),"task".into(),state_path.as_os_str().to_string_lossy().into_owned().into(),run_ref.into(),task_ref.into(),"--json".into()]);
                if let Some(limit)=limit {args.push("--limit".into()); args.push(limit.to_string().into());}
                if let Some(cursor)=cursor {args.push("--cursor".into()); args.push(serde_json::to_string(&cursor).map_err(|e|e.to_string())?.into());}
                let data=material::invoke(&executable,&args,None).map_err(|e|serde_json::to_string(&e).unwrap_or_else(|_|"factory attempt task failed".into()))?;
                if data.get("contract").and_then(serde_json::Value::as_str)!=Some("factory.attempt-task-reading/v1"){return Err("Factory returned incompatible attempt-task reading".into());}
                Ok(KernelOpOutcome{receipts:Vec::new(),result:KernelOpResult::FactoryAttemptTaskReading{data}})
            }
            KernelOp::WorkcellStatusRead => {
                let workcell=std::env::var_os("OI_WORKCELL_BIN").map(std::path::PathBuf::from);
                let (executable, namespace): (std::path::PathBuf, Option<&str>) = match workcell {
                    Some(path)=>(path, None),
                    None=>(std::env::var_os("OI_BIN").map(std::path::PathBuf::from).unwrap_or_else(|| std::path::PathBuf::from("oi")), Some("workcell")),
                };
                let mut args:Vec<std::ffi::OsString>=Vec::new();
                if let Some(name)=namespace { args.push(name.into()); }
                args.extend(["status".into(),"--json".into()]);
                let data=material::invoke(&executable,&args,None).map_err(|e|serde_json::to_string(&e).unwrap_or_else(|_|"workcell status read failed".into()))?;
                Ok(KernelOpOutcome{receipts:Vec::new(),result:KernelOpResult::WorkcellStatusReading{data}})
            }
            KernelOp::HarnessStatus => {
                // Machine-level read: no project disclosure is consulted —
                // the harnesses are the machine's own facts.
                let data=self.agency.harness_status()?;
                Ok(KernelOpOutcome{receipts:Vec::new(),result:KernelOpResult::HarnessStatusReading{data}})
            }
            KernelOp::ModelCatalogue => {
                let data=self.agency.model_catalogue()?;
                Ok(KernelOpOutcome{receipts:Vec::new(),result:KernelOpResult::ModelCatalogueReading{data}})
            }
            KernelOp::ChatDefaultRead => {
                let document=chat_defaults::read()?;
                Ok(KernelOpOutcome{receipts:Vec::new(),result:KernelOpResult::ChatDefaultReading{document}})
            }
            KernelOp::ChatDefaultHold {provider} => {
                let document=chat_defaults::hold(&provider)?;
                Ok(KernelOpOutcome{receipts:Vec::new(),result:KernelOpResult::ChatDefaultHeld{document}})
            }
            KernelOp::ChatDefaultDiscard => {
                let document=chat_defaults::discard()?;
                Ok(KernelOpOutcome{receipts:Vec::new(),result:KernelOpResult::ChatDefaultDiscarded{document}})
            }
            KernelOp::Ground{request} => {
                // A ground change re-bases every path the cache holds.
                self.reads.clear();
                Ok(KernelOpOutcome{receipts:Vec::new(),result:KernelOpResult::GroundReading{reading:ground::operate(request)?}})
            },
            KernelOp::CompositionRead{owners} => {
                let root=self.world_map(false).ok();
                let cwd=root.as_ref().and_then(|value|value["root"].as_str()).map(std::path::PathBuf::from).unwrap_or(std::env::current_dir().map_err(|e|e.to_string())?);
                Ok(KernelOpOutcome{receipts:Vec::new(),result:KernelOpResult::CompositionReading{reading:composition::Client::discover().read_with_owners(&cwd,owners)}})
            },
            KernelOp::SystemCompositionRead => {
                let root=self.world_map(false).ok();
                let cwd=root.as_ref().and_then(|value|value["root"].as_str()).map(std::path::PathBuf::from).unwrap_or(std::env::current_dir().map_err(|e|e.to_string())?);
                Ok(KernelOpOutcome{receipts:Vec::new(),result:KernelOpResult::SystemCompositionReading{reading:system_composition::Client::discover().read(&cwd)}})
            },
            KernelOp::ConfigRegistryRead => {
                let root=self.world_map(false).ok();
                let cwd=root.as_ref().and_then(|value|value["root"].as_str()).map(std::path::PathBuf::from).unwrap_or(std::env::current_dir().map_err(|e|e.to_string())?);
                Ok(KernelOpOutcome{receipts:Vec::new(),result:KernelOpResult::ConfigRegistryReading{reading:configuration::Client::discover().registry_read(&cwd)}})
            },
            KernelOp::ConfigResolutionsRead {pairs} => {
                let root=self.world_map(false).ok();
                let cwd=root.as_ref().and_then(|value|value["root"].as_str()).map(std::path::PathBuf::from).unwrap_or(std::env::current_dir().map_err(|e|e.to_string())?);
                Ok(KernelOpOutcome{receipts:Vec::new(),result:KernelOpResult::ConfigResolutions{resolutions:configuration::Client::discover().resolutions_read(&cwd,&pairs)}})
            },
            KernelOp::ConfigDesiredHold {request} => {
                let root=self.world_map(false).ok();
                let cwd=root.as_ref().and_then(|value|value["root"].as_str()).map(std::path::PathBuf::from).unwrap_or(std::env::current_dir().map_err(|e|e.to_string())?);
                let entry=configuration::Client::discover().desired_hold(&cwd,&request)?;
                Ok(KernelOpOutcome{receipts:Vec::new(),result:KernelOpResult::ConfigDesiredHeld{entry}})
            },
            KernelOp::ConfigDesiredDiscard {setting_ref,scope} => {
                let root=self.world_map(false).ok();
                let cwd=root.as_ref().and_then(|value|value["root"].as_str()).map(std::path::PathBuf::from).unwrap_or(std::env::current_dir().map_err(|e|e.to_string())?);
                let document=configuration::Client::discover().desired_discard(&cwd,&configuration::ConfigPair{setting_ref,scope})?;
                Ok(KernelOpOutcome{receipts:Vec::new(),result:KernelOpResult::ConfigDesiredDiscarded{document}})
            },
            KernelOp::ConfigPlan {requests} => {
                let root=self.world_map(false).ok();
                let cwd=root.as_ref().and_then(|value|value["root"].as_str()).map(std::path::PathBuf::from).unwrap_or(std::env::current_dir().map_err(|e|e.to_string())?);
                let (plans,errors)=configuration::Client::discover().plan(&cwd,&requests);
                Ok(KernelOpOutcome{receipts:Vec::new(),result:KernelOpResult::ConfigPlanned{plans,errors}})
            },
            KernelOp::Setup {request} => {
                // First installation must work before Central/root discovery.
                let cwd=std::env::current_dir().map_err(|e|e.to_string())?;
                let data=setup::Client::discover().request(&cwd,&request)?;
                Ok(KernelOpOutcome{receipts:Vec::new(),result:KernelOpResult::SetupReading{data}})
            },
            KernelOp::ConfigApply {requests} => {
                let root=self.world_map(false).ok();
                let cwd=root.as_ref().and_then(|value|value["root"].as_str()).map(std::path::PathBuf::from).unwrap_or(std::env::current_dir().map_err(|e|e.to_string())?);
                let (changeset,owner_receipts)=configuration::Client::discover().apply(&cwd,&requests)?;
                Ok(KernelOpOutcome{receipts:Vec::new(),result:KernelOpResult::ConfigApplied{changeset,owner_receipts}})
            },
            KernelOp::ProfileList => {
                let root=self.world_map(false).ok();
                let cwd=root.as_ref().and_then(|value|value["root"].as_str()).map(std::path::PathBuf::from).unwrap_or(std::env::current_dir().map_err(|e|e.to_string())?);
                let listing=configuration::Client::discover().profile_list(&cwd)?;
                Ok(KernelOpOutcome{receipts:Vec::new(),result:KernelOpResult::ProfileListing{active_profile_ref:listing.active_profile_ref,profiles:listing.profiles,degraded:listing.degraded}})
            },
            KernelOp::ProfileRead {profile_ref} => {
                let root=self.world_map(false).ok();
                let cwd=root.as_ref().and_then(|value|value["root"].as_str()).map(std::path::PathBuf::from).unwrap_or(std::env::current_dir().map_err(|e|e.to_string())?);
                let profile=configuration::Client::discover().profile_read(&cwd,&profile_ref)?;
                Ok(KernelOpOutcome{receipts:Vec::new(),result:KernelOpResult::ProfileReading{profile}})
            },
            KernelOp::ProfileUsePlan {profile_ref} => {
                let root=self.world_map(false).ok();
                let cwd=root.as_ref().and_then(|value|value["root"].as_str()).map(std::path::PathBuf::from).unwrap_or(std::env::current_dir().map_err(|e|e.to_string())?);
                let plan=configuration::Client::discover().profile_use_plan(&cwd,&profile_ref)?;
                Ok(KernelOpOutcome{receipts:Vec::new(),result:KernelOpResult::ProfileUsePlanning{plan}})
            },
            KernelOp::ProfileUseApply {profile_ref} => {
                let root=self.world_map(false).ok();
                let cwd=root.as_ref().and_then(|value|value["root"].as_str()).map(std::path::PathBuf::from).unwrap_or(std::env::current_dir().map_err(|e|e.to_string())?);
                let activation=configuration::Client::discover().profile_use_apply(&cwd,&profile_ref)?;
                Ok(KernelOpOutcome{receipts:Vec::new(),result:KernelOpResult::ProfileUsed{activation}})
            },
            KernelOp::ProfileCreate {profile_ref,title} => {
                let root=self.world_map(false).ok();
                let cwd=root.as_ref().and_then(|value|value["root"].as_str()).map(std::path::PathBuf::from).unwrap_or(std::env::current_dir().map_err(|e|e.to_string())?);
                let profile=configuration::Client::discover().profile_create(&cwd,&profile_ref,title.as_deref())?;
                Ok(KernelOpOutcome{receipts:Vec::new(),result:KernelOpResult::ProfileCreated{profile}})
            },
            KernelOp::ProfileEdit {profile_ref,operations} => {
                let root=self.world_map(false).ok();
                let cwd=root.as_ref().and_then(|value|value["root"].as_str()).map(std::path::PathBuf::from).unwrap_or(std::env::current_dir().map_err(|e|e.to_string())?);
                let document=configuration::Client::discover().profile_edit(&cwd,&profile_ref,&operations)?;
                Ok(KernelOpOutcome{receipts:Vec::new(),result:KernelOpResult::ProfileEdited{document}})
            },
            KernelOp::ConfigReceipts => {
                let root=self.world_map(false).ok();
                let cwd=root.as_ref().and_then(|value|value["root"].as_str()).map(std::path::PathBuf::from).unwrap_or(std::env::current_dir().map_err(|e|e.to_string())?);
                let document=configuration::Client::discover().config_receipts(&cwd)?;
                Ok(KernelOpOutcome{receipts:Vec::new(),result:KernelOpResult::ConfigReceipts{document}})
            },
            KernelOp::FileOperation {location,request} => {
                let data=files::operate(&self.client,&location,&request)?;
                // A write changed what a directory contains; the parent
                // listing is the one cached reading it invalidates by name.
                if matches!(request,files::Request::Write{..}|files::Request::Restore{..}) {
                    self.reads.invalidate(&format!("dir:{}",files::parent_path(&location.path)));
                }
                // One state change, one event (the seam's law): a write or
                // restore the owner actually recorded (`created`/`written`)
                // discloses FileChanged so retained listings — the file
                // tree's workspace-keyed cache — invalidate by receipt, the
                // same "look again" relation the expressions surfaces keep
                // with `expression_changed`. An unchanged write mutated
                // nothing and emits nothing.
                let receipt=matches!(request,files::Request::Write{..}|files::Request::Restore{..})
                    .then(|| match data["outcome"].as_str() {
                        Some("created")=>Some(self.log.record(KernelEvent::FileChanged{path:location.path.clone(),summary:"A file was created through the owner's write.".into()})),
                        Some("written")=>Some(self.log.record(KernelEvent::FileChanged{path:location.path.clone(),summary:"A file changed through the owner's write.".into()})),
                        _=>None,
                    })
                    .flatten();
                Ok(KernelOpOutcome{receipts:receipt.into_iter().collect(),result:KernelOpResult::FileOperation {data}})
            },
            KernelOp::FilesList {path,fresh} => Ok(KernelOpOutcome { receipts:Vec::new(), result:KernelOpResult::DirectoryRead {directory:self.directory_listing(&path,fresh.unwrap_or(false))?} }),
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
                let (cwd,project_ref)=self.project_ground(&project)?;
                let data=self.agency.encounter(&cwd,&project_ref,&request)?;
                if let agency::EncounterRequest::Read{agent_session,..}=&request {
                    if data["agent_session"].as_str()!=Some(agent_session){return Err("AIKit encounter reading identity mismatch".into());}
                    let project=focus::ProjectRef::try_from(owner_relation(&project_ref,"project","projectcentral.inspect")).map_err(|e|e.to_string())?;
                    self.encounter_refs.insert(agent_session.clone(),(SemanticRef {ref_id:agent_session.clone(),kind:"agent-session".into(),native_owner:"ai-kit".into(),provenance:refs::RefProvenance {source:"aikit.encounter.read".into(),revision:None}},project));
                }
                Ok(KernelOpOutcome {receipts:Vec::new(),result:KernelOpResult::EncounterReading {data}})
            }
            KernelOp::EncounterProvision {project} => {
                // The same disclosure gate as every project-scoped op: the
                // project must be inside Central's disclosed ground, and the
                // canonical ProjectRef is Central's own, never the caller's.
                let (cwd,project_ref)=self.project_ground(&project)?;
                let data=self.agency.provision(&cwd,&project_ref)?;
                Ok(KernelOpOutcome {receipts:Vec::new(),result:KernelOpResult::EncounterProvisioned {data}})
            }
            KernelOp::BeingEncounter {request} => Ok(KernelOpOutcome {receipts:Vec::new(),result:KernelOpResult::BeingEncounter {data:being::apply(request)}}),
            KernelOp::AgencyRead { project } => {
                let root=self.world_map(false).map_err(|e|e.to_string())?;
                let row=root["work"]["projects"].as_array().and_then(|rows|rows.iter().find(|r|r["name"].as_str()==Some(&project))).ok_or("Project is outside Central's disclosed ground")?;
                let cwd=std::path::Path::new(root["root"].as_str().ok_or("Central root location unavailable")?).join(row["path"].as_str().ok_or("Project location unavailable")?);
                let inspection=self.inspect_project(&project,false).ok_or("Central has not bound a canonical ProjectRef")?;
                let project_ref=inspection["manifest"]["project_id"].as_str().ok_or("Central has not bound a canonical ProjectRef")?.to_owned();
                // The spaces reading spawns the AIKit owner (~100 ms); the
                // disclosure re-reads it on every branch expansion, so the
                // short horizon serves the repeat. A fresh stamp is minted
                // for every answer, cached or not.
                let cache_key=format!("agency:{}:{project_ref}",cwd.display());
                let spaces=if let Some(value)=self.reads.get(&cache_key,read_cache::HORIZON_TTL) {
                    value
                } else {
                    let spaces=self.agency.read_project(&cwd,&project_ref)?;
                    self.reads.put(cache_key,spaces.clone());
                    spaces
                };
                let observed_at_unix_ms=std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d|d.as_millis() as u64).unwrap_or(0);
                Ok(KernelOpOutcome {receipts:Vec::new(),result:KernelOpResult::AgencyReading {project_ref,spaces,observed_at_unix_ms}})
            }
            KernelOp::Receiving {project,request} => {
                // Same disclosure gate as every project-scoped read: a named
                // project must be inside Central's disclosed ground. `None`
                // is the root register's own field — a Day document lives
                // there, and its receiving field is the root's.
                if let Some(project)=&project {
                    let root=self.world_map(false).map_err(|e|e.to_string())?;
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
                    let root=self.world_map(false).map_err(|e|e.to_string())?;
                    root["work"]["projects"].as_array().and_then(|rows|rows.iter().find(|r|r["name"].as_str()==Some(project.as_str()))).ok_or("Project is outside Central's disclosed ground")?;
                }
                let data=self.client.now(project.as_deref(),&request).map_err(|e|e.to_string())?;
                Ok(KernelOpOutcome {receipts:Vec::new(),result:KernelOpResult::NowReading {data}})
            }
            KernelOp::EncounterTaskRead {project,agent_session} => {
                // The standard project-disclosure gate and cwd resolution —
                // the task record belongs to a session attached to THIS
                // project's SessionSpaces, exactly like the encounter reads.
                let root=self.world_map(false).map_err(|e|e.to_string())?;
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
                let root = self.world_map(false).map_err(|e| e.to_string())?;
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
                let root = self.world_map(false).map_err(|e| e.to_string())?;
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
            KernelOp::SharedField { request } => {
                // The kernel passes the request through on the desktop's own
                // account; the client resolves its target and token from its
                // own environment. Nothing is recorded, nothing is emitted.
                let data = shared_field::reading(&request)?;
                Ok(KernelOpOutcome { receipts: Vec::new(), result: KernelOpResult::SharedFieldReading { data } })
            }
            KernelOp::EncounterJoin { session, request_ref, reply } => {
                // Central discloses the context anchor, exactly as the
                // Graph/Knowledge arms; the lifecycle store itself is the
                // AIKit owner's (AIKIT_HOME), never renderer-supplied.
                let root = self.world_map(false).map_err(|e| e.to_string())?;
                let cwd = std::path::PathBuf::from(root["root"].as_str().ok_or("Central root location unavailable")?);
                let reading = encounter::assemble(&cwd, &session, &request_ref, reply.as_ref());
                Ok(KernelOpOutcome { receipts: Vec::new(), result: KernelOpResult::EncounterJoined { reading } })
            }
            KernelOp::InvokeAction { project, invocation } => {
                // Central discloses the scope, exactly as the Knowledge/Graph
                // arms: renderer-supplied paths never become invocation context.
                let root = self.world_map(false).map_err(|e| e.to_string())?;
                let base = root["root"].as_str().ok_or("Central root location unavailable")?;
                let cwd = if let Some(project) = project.as_ref() {
                    let row = root["work"]["projects"].as_array().and_then(|rows| rows.iter().find(|r| r["name"].as_str() == Some(project))).ok_or("Project is outside Central's disclosed ground")?;
                    std::path::Path::new(base).join(row["path"].as_str().ok_or("Project location unavailable")?)
                } else { std::path::PathBuf::from(base) };
                let dispatch = action::invoke(&self.client, &cwd, project.as_deref(), &invocation);
                Ok(KernelOpOutcome { receipts: Vec::new(), result: KernelOpResult::ActionDispatched { dispatch } })
            }
            KernelOp::FlowChangedSince { project, thought } => {
                // The changed-since compose resolves its owner cwd exactly as
                // the InvokeAction arm: Central discloses the scope,
                // renderer-supplied paths never become context.
                let root = self.world_map(false).map_err(|e| e.to_string())?;
                let base = root["root"].as_str().ok_or("Central root location unavailable")?;
                let cwd = if let Some(project) = project.as_ref() {
                    let row = root["work"]["projects"].as_array().and_then(|rows| rows.iter().find(|r| r["name"].as_str() == Some(project))).ok_or("Project is outside Central's disclosed ground")?;
                    std::path::Path::new(base).join(row["path"].as_str().ok_or("Project location unavailable")?)
                } else { std::path::PathBuf::from(base) };
                let reading = flow_cognition::changed_since(&self.client, project.as_deref().unwrap_or_else(|| self.client.configured_project()), &cwd, &thought).map_err(|e| e.to_string())?;
                Ok(KernelOpOutcome { receipts: Vec::new(), result: KernelOpResult::FlowChangedSince { reading } })
            }
            KernelOp::InstanceCommission { location, expected_revision, content, agent_session_ref } => {
                let outcome = commission::commission(&self.client, &location, &expected_revision, &content, agent_session_ref.as_deref()).map_err(|e| e.to_string())?;
                // The commission landed as a file write: the parent listing
                // it invalidates by name.
                self.reads.invalidate(&format!("dir:{}",files::parent_path(&location.path)));
                Ok(KernelOpOutcome { receipts: Vec::new(), result: KernelOpResult::InstanceCommissioned { outcome } })
            }
            KernelOp::WorldRead => self.navigate(None, false, false),
            KernelOp::ProjectRead { project } => self.navigate(Some(&project), false, false),
            KernelOp::WorldBrowse { fresh } => self.navigate(None, true, fresh.unwrap_or(false)),
            KernelOp::ProjectBrowse { project, fresh } => self.navigate(Some(&project), true, fresh.unwrap_or(false)),
            KernelOp::State => Ok(KernelOpOutcome {
                receipts: Vec::new(),
                result: KernelOpResult::State {
                    snapshot: self.snapshot(),
                },
            }),
            KernelOp::SourcesList { project } => Ok(KernelOpOutcome {
                receipts: Vec::new(),
                result: KernelOpResult::SourcesListed {
                    listing: self.participating_sources_cached(project.as_deref()),
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
            // --- expression_world (ES1/ES4, lane aikit/es-one-state-relation).
            KernelOp::ExpressionWorld { request } => self.expression_world(request),
        }
    }

    // -----------------------------------------------------------------------
    // Source buffers — the two state layers
    // -----------------------------------------------------------------------

    fn navigate(&mut self, project: Option<&str>, browse_only: bool, fresh: bool) -> Result<KernelOpOutcome, String> {
        let before = self.navigator.clone();
        let old_focus = self.focus.clone();
        let result = if let Some(query) = project {
            // Resolve only a project the owner's current root map disclosed.
            let known = self.navigator.root.as_ref().and_then(|r| r["work"]["projects"].as_array())
                .is_some_and(|rows| rows.iter().any(|p| p["name"].as_str() == Some(query)));
            if !known { return Err("Project is outside the disclosed World mapping; refresh World first".into()); }
            self.navigate_project(query, fresh)
        } else {
            self.navigate_root(fresh)
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

    /// The root mapping arm of `navigate` — owner calls through the cache,
    /// state moves exactly as before the cache existed.
    fn navigate_root(&mut self, fresh: bool) -> Result<(), String> {
        let reading = self.world_map(fresh)?;
        if self.navigator.project.is_some() {
            self.focus.project = None;
            self.focus.world = None;
            self.focus.clear_subject();
        }
        self.navigator.root = Some(reading);
        self.navigator.project = None;
        self.navigator.sources = None;
        self.navigator.project_ref = None;
        Ok(())
    }

    /// The project-mapping arm of `navigate`.
    fn navigate_project(&mut self, query: &str, fresh: bool) -> Result<(), String> {
        let reading = self.project_map(query, fresh)?;
        let bound = reading["project"]["projectcentral"]["state"] != "absent";
        let sources = bound.then(|| self.participating_sources_cached(Some(query)));
        let project_ref = if bound {
            self.inspect_project(query, fresh)
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
        Ok(())
    }

    // -----------------------------------------------------------------------
    // Cached owner readings — the same owner operations as before, served
    // from the short-horizon cache when a fresh reading was not demanded.
    // -----------------------------------------------------------------------

    fn world_map(&mut self, fresh: bool) -> Result<serde_json::Value, String> {
        if fresh { self.reads.invalidate("world"); }
        else if let Some(value) = self.reads.get("world", read_cache::WORLD_TTL) { return Ok(value); }
        let reading = world::read_world(&self.client)?;
        self.reads.put("world".into(), reading.clone());
        Ok(reading)
    }

    /// The project-scoped ground every project-named op shares: the project
    /// must be inside Central's disclosed ground, the cwd comes from that
    /// disclosure, and the canonical ProjectRef is Central's own inspect
    /// reading — never a caller-supplied path or ref.
    fn project_ground(&mut self, project: &str) -> Result<(std::path::PathBuf, String), String> {
        let root=self.world_map(false)?;
        let row=root["work"]["projects"].as_array().and_then(|rows|rows.iter().find(|r|r["name"].as_str()==Some(project))).ok_or("Project is outside Central's disclosed ground")?;
        let cwd=std::path::Path::new(root["root"].as_str().ok_or("Central root location unavailable")?).join(row["path"].as_str().ok_or("Project location unavailable")?);
        let inspection=self.client.run("projectcentral.inspect",serde_json::json!({"project":project})).map_err(|e|e.to_string())?;
        let project_ref=inspection["manifest"]["project_id"].as_str().ok_or("Central has not bound a canonical ProjectRef")?.to_owned();
        Ok((cwd,project_ref))
    }

    fn project_map(&mut self, project: &str, fresh: bool) -> Result<serde_json::Value, String> {
        let key = format!("project:{project}");
        if fresh { self.reads.invalidate(&key); }
        else if let Some(value) = self.reads.get(&key, read_cache::PROJECT_TTL) { return Ok(value); }
        let reading = world::read_project(&self.client, project)?;
        self.reads.put(key, reading.clone());
        Ok(reading)
    }

    fn inspect_project(&mut self, project: &str, fresh: bool) -> Option<serde_json::Value> {
        let key = format!("inspect:{project}");
        if fresh { self.reads.invalidate(&key); }
        else if let Some(value) = self.reads.get(&key, read_cache::HORIZON_TTL) { return Some(value); }
        let value = self.client.run("projectcentral.inspect", serde_json::json!({"project": project})).ok()?;
        self.reads.put(key, value.clone());
        Some(value)
    }

    /// Horizon-served source listings only: a degraded reading is the error
    /// path, and the error path is never cached.
    fn participating_sources_cached(&mut self, project: Option<&str>) -> SourceListing {
        let key = format!("horizon:{}", project.unwrap_or(""));
        if let Some(value) = self.reads.get(&key, read_cache::HORIZON_TTL) {
            if let Ok(listing) = serde_json::from_value(value) { return listing; }
        }
        let listing = participating_sources(&self.client, project);
        if matches!(listing.availability, world::ListingAvailability::Horizon) {
            if let Ok(value) = serde_json::to_value(&listing) { self.reads.put(key, value); }
        }
        listing
    }

    fn directory_listing(&mut self, path: &str, fresh: bool) -> Result<files::Directory, String> {
        let key = format!("dir:{path}");
        if fresh { self.reads.invalidate(&key); }
        else if let Some(value) = self.reads.get(&key, read_cache::DIR_TTL) {
            if let Ok(directory) = serde_json::from_value(value) { return Ok(directory); }
        }
        let directory = files::list(&self.client, path)?;
        if let Ok(value) = serde_json::to_value(&directory) { self.reads.put(key, value); }
        Ok(directory)
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

    /// A stand-in owner executable that answers the shaped readings the
    /// cache serves and appends every action it was asked to a log file, so
    /// a test can count real process spawns.
    const FAKE_OWNER: &str = r#"#!/usr/bin/env python3
import json, sys, os
# argv: <script> --json action run <action> <input-json>
action = sys.argv[4]
payload = json.loads(sys.argv[5]) if len(sys.argv) > 5 else {}
log = os.environ.get("FAKE_OWNER_LOG")
if log:
    with open(log, "a") as handle:
        handle.write(action + "\n")
def ok(data):
    print(json.dumps({"ok": True, "data": data}))
if action == "central.files.list":
    path = payload["path"]
    ok({"schema": "central.directory-reading/v1",
        "automatic_agent_or_model_invocation": False,
        "location": {"schema": "central.path-ref/v1", "ref": "ref:" + path, "root": "R", "path": path},
        "entries": [{"name": "a.md", "kind": "file", "byte_len": 1, "retrieval_allowed": True,
                     "location": {"schema": "central.path-ref/v1", "ref": "ref:" + path + "/a.md", "root": "R", "path": path + "/a.md"}}]})
elif action == "central.files.write":
    ok({"schema": "central.file-mutation/v1", "outcome": "written", "location": payload["location"]})
elif action == "central.world":
    ok({"schema": "central.world-map/v1", "root": "/tmp", "work": {"projects": []}})
else:
    ok({})
"#;

    #[cfg(unix)]
    struct FakeOwner {
        executable: std::path::PathBuf,
        log: std::path::PathBuf,
    }

    #[cfg(unix)]
    impl FakeOwner {
        /// One script + one spawn log per test, so parallel tests never
        /// share a counter. The log path is baked into a tiny wrapper so
        /// the count never rides a process environment tests race on.
        fn spawn_counter(test: &str) -> Self {
            use std::os::unix::fs::PermissionsExt;
            let stem = format!("oi-cradle-{}-{test}", std::process::id());
            let script = std::env::temp_dir().join(format!("{stem}.py"));
            let wrapper = std::env::temp_dir().join(format!("{stem}.sh"));
            let log = std::env::temp_dir().join(format!("{stem}.log"));
            std::fs::write(&script, FAKE_OWNER).unwrap();
            std::fs::write(&wrapper, format!("#!/bin/sh\nFAKE_OWNER_LOG={} exec python3 {} \"$@\"\n", log.display(), script.display())).unwrap();
            std::fs::set_permissions(&wrapper, std::fs::Permissions::from_mode(0o755)).unwrap();
            let _ = std::fs::remove_file(&log);
            Self { executable: wrapper, log }
        }
        fn kernel(&self) -> Kernel {
            Kernel::new(CentralClient::with(self.executable.clone(), None, "test".into()))
        }
        /// How many times the named action reached the owner executable.
        fn spawns(&self, action: &str) -> usize {
            std::fs::read_to_string(&self.log)
                .map(|text| text.lines().filter(|line| *line == action).count())
                .unwrap_or(0)
        }
    }

    #[cfg(unix)]
    impl Drop for FakeOwner {
        fn drop(&mut self) {
            let stem = self.executable.with_extension("");
            for suffix in [".sh", ".py"] {
                let _ = std::fs::remove_file(std::path::PathBuf::from(format!("{}{suffix}", stem.display())));
            }
            let _ = std::fs::remove_file(&self.log);
        }
    }

    #[cfg(unix)]
    #[test]
    fn a_repeated_directory_read_serves_from_the_cache_and_a_fresh_read_bypasses_it() {
        let owner = FakeOwner::spawn_counter("directory-cache");
        let mut kernel = owner.kernel();
        for _ in 0..3 {
            kernel.apply(KernelOp::FilesList { path: "Work/proj".into(), fresh: None }).unwrap();
        }
        assert_eq!(owner.spawns("central.files.list"), 1, "repeats inside the TTL are one owner read");
        kernel.apply(KernelOp::FilesList { path: "Work/proj".into(), fresh: Some(true) }).unwrap();
        assert_eq!(owner.spawns("central.files.list"), 2, "the explicit fresh read re-asks the owner");
    }

    #[cfg(unix)]
    #[test]
    fn a_file_write_invalidates_the_parent_listing_by_name() {
        let owner = FakeOwner::spawn_counter("write-invalidation");
        let mut kernel = owner.kernel();
        kernel.apply(KernelOp::FilesList { path: "Work/proj".into(), fresh: None }).unwrap();
        kernel.apply(KernelOp::FileOperation {
            location: files::Location {
                schema: "central.path-ref/v1".into(),
                ref_id: "ref:Work/proj/a.md".into(),
                root: "R".into(),
                path: "Work/proj/a.md".into(),
            },
            request: files::Request::Write { expected_revision: "r1".into(), content: "new".into() },
        }).unwrap();
        kernel.apply(KernelOp::FilesList { path: "Work/proj".into(), fresh: None }).unwrap();
        assert_eq!(owner.spawns("central.files.list"), 2, "the written directory is re-read after its write");
    }

    #[cfg(unix)]
    #[test]
    fn a_changed_file_write_discloses_one_file_changed_receipt() {
        // One state change, one event: an owner-confirmed write discloses
        // FileChanged naming the changed path (the receipt a retained listing
        // invalidates on); a non-mutating request discloses nothing.
        let owner = FakeOwner::spawn_counter("file-changed-receipt");
        let mut kernel = owner.kernel();
        let outcome = kernel.apply(KernelOp::FileOperation {
            location: files::Location {
                schema: "central.path-ref/v1".into(),
                ref_id: "ref:Work/proj/a.md".into(),
                root: "R".into(),
                path: "Work/proj/a.md".into(),
            },
            request: files::Request::Write { expected_revision: "r1".into(), content: "new".into() },
        }).unwrap();
        let receipt = outcome.receipts.iter().find(|logged| logged.envelope.event.tag() == "file_changed")
            .expect("a written file discloses one file_changed receipt");
        assert_eq!(receipt.envelope.event.subject(), None, "the changed path rides the payload, not a semantic subject");
        kernel.apply(KernelOp::FilesList { path: "Work/proj".into(), fresh: None }).unwrap();
        let listed = kernel.event_log().since(0);
        assert_eq!(listed.iter().filter(|logged| logged.envelope.event.tag() == "file_changed").count(), 1, "reads change no kernel state and emit nothing");
    }

    #[cfg(unix)]
    #[test]
    fn the_world_mapping_is_cached_until_a_fresh_browse_is_demanded() {
        let owner = FakeOwner::spawn_counter("world-cache");
        let mut kernel = owner.kernel();
        kernel.apply(KernelOp::WorldBrowse { fresh: None }).unwrap();
        kernel.apply(KernelOp::WorldBrowse { fresh: None }).unwrap();
        assert_eq!(owner.spawns("central.world"), 1, "repeat browses inside the TTL are one owner read");
        kernel.apply(KernelOp::WorldBrowse { fresh: Some(true) }).unwrap();
        assert_eq!(owner.spawns("central.world"), 2, "the explicit refresh re-asks the owner");
    }
}
