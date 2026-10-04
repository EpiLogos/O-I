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

pub mod action;
pub mod agency;
pub mod agent_card;
pub mod agent_definition;
pub mod application_asset;
pub mod being;
pub mod central;
pub mod chat_defaults;
pub mod commission;
pub mod composition;
pub mod configuration;
pub mod construction;
pub mod credentials;
pub mod decision;
pub mod dictation;
pub mod encounter;
pub mod events;
pub mod expression;
// Source6 support remains operative beside the original native File/Act/
// Performance owners enrolled for the retained physical-musical instrument.
pub mod expression_act_storage;
pub mod expression_act_store;
pub mod expression_file;
pub mod expression_performance;
pub mod expression_performance_act;
pub mod expression_performance_assets;
pub mod expression_performance_codec;
pub mod expression_performance_delivery;
pub mod expression_performance_management;
pub mod expression_performance_reader;
pub mod expression_performance_recording;
pub mod expression_performance_reservation;
pub mod expression_performance_source_asset;
pub mod expression_performance_storage;
pub(crate) mod expression_procedural_field_source;
pub(crate) mod expression_procedural_scene_reader;
pub(crate) mod expression_procedural_source_budget;
pub(crate) mod expression_procedural_source_codec;

pub mod expression_asset;
pub mod expression_blueprint;
pub mod expression_carrier;
pub mod expression_material;
pub mod expression_profile;
pub mod expression_recovery;
pub mod expression_scene;
pub mod expression_transport;
pub mod expression_trigger;
pub mod factory;
pub mod files;
pub mod flow;
pub mod flow_cognition;
pub mod focus;
pub mod git;
pub mod graph;
pub mod ground;
pub mod history;
pub mod inhabitation;
pub mod knowledge;
pub mod knowledge_prepared;
pub mod m3_reception;
pub mod material;
pub mod nara_coordinate;
pub mod nara_current;
pub mod nara_dialogue;
pub mod nara_epii;
pub mod nara_expressive_act;
pub mod nara_identity;
pub mod nara_presence;
pub mod nara_voice;
mod nara_voice_actor;
mod nara_voice_answer;
mod nara_voice_constitution;
mod nara_voice_transport;
pub mod nara_world_readiness;
pub mod native_expression;
pub mod native_owner_transport;
#[cfg(any(target_os = "linux", target_os = "macos"))]
pub mod native_parent_image;
pub mod native_process;
pub mod owner_read;
pub mod presentation;
/// Short-horizon read-through cache for the owner readings the UI re-reads
/// (see the module's own law). Private to the kernel's apply path.
mod read_cache;
pub mod refs;
pub mod retained_files;
pub mod routine;
pub mod setup;
pub mod shared_field;
pub mod system_composition;
pub mod working_surface;
pub mod world;
// --- expression_world (ES1 knowledge side + ES4 joint focus/deixis/portals),
// lane aikit/es-one-state-relation: the shared selection relation, Surface
// portals, ExpressiveAct and bounded local-whole bindings over exact refs.
pub mod expression_world;

pub use flow::{CentralClient, OwnerCallError};

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

use events::{KernelEvent, KernelEventLog, KernelEventReceipt};
use flow::{SourceReading, SourceWriteFailure, CRADLE_ACTOR, CRADLE_ACTOR_KIND};
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
    #[serde(default)]
    pub world_ref: String,
    #[serde(default)]
    pub project_ref: Option<String>,
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
#[derive(Debug, Default)]
struct NaraContextEntry {
    checkpoint: Option<nara_expressive_act::Checkpoint>,
    personal_current: Option<nara_current::Pinned>,
    m3: Option<m3_reception::Resident>,
}

#[derive(Debug)]
pub struct Kernel {
    presentation: presentation::Store,
    decisions: decision::Store,
    dictation: dictation::Store,
    nara_voice: nara_voice::Store,
    nara_contexts: BTreeMap<String, NaraContextEntry>,
    retained_files: retained_files::Store,
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
    encounter_refs: BTreeMap<String, (SemanticRef, focus::ProjectRef)>,
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
    FileLastReading {
        location: files::Location,
    },
    DictationRead,
    DictationConfigure {
        stt_url: String,
        expected_revision: u64,
    },
    DictationProbe,
    DictationTranscribe {
        capture_ref: String,
        wav_base64: String,
    },
    // Bounded decisions (Lane E). Issuance exists only on the native host.
    DecisionRead,
    DecisionPreflight {
        proposal: decision::Proposal,
    },
    Decide {
        preflight_ref: String,
        authority_ref: String,
    },
    DecisionEpisodeRevoke {
        authority_ref: String,
    },
    // Central-owned repository changes.
    GitRepositoryRead {
        project: String,
    },
    GitDiffRead {
        request: git::DiffRequest,
    },
    // Presentation-state authority (Lane B).
    PresentationRead,
    PresentationObserve {
        window_id: String,
        visuals: serde_json::Value,
        arrangement: serde_json::Value,
    },
    ThemeImport {
        theme: presentation::CustomTheme,
    },
    ThemeApply {
        appearance: String,
        #[serde(default)]
        id: Option<String>,
    },
    ThemeRevert,
    ThemeRemove {
        id: String,
    },
    NaraDecisionRecord {
        decision: serde_json::Value,
    },

    Setup {
        request: serde_json::Value,
    },
    BeingEncounter {
        request: being::Request,
    },
    /// A hosted subject's explicitly qualified native owner route. The host
    /// binds its own published World address; the renderer cannot select a
    /// root, credential, executable or fallback owner.
    HostedNative {
        source_world_ref: String,
        request: Box<KernelOp>,
    },
    Expression {
        request: expression::Request,
    },
    ExpressionRecovery {
        request: expression_recovery::Request,
    },
    NativeExpression {
        request: native_expression::Request,
    },
    NaraCoordinate {
        request: nara_coordinate::Request,
    },
    NaraEpii {
        project: String,
        request: nara_epii::Request,
    },
    NaraExpressiveAct {
        project: String,
        request: nara_expressive_act::Request,
    },
    NaraPresence {
        project: String,
        request: nara_presence::Request,
    },
    M3Reception {
        project: String,
        request: m3_reception::Request,
    },
    NaraCurrent {
        project: String,
        request: nara_current::Request,
    },
    NaraIdentity {
        request: nara_identity::Request,
    },
    NaraDialogue {
        project: String,
        request: nara_dialogue::Request,
    },
    NaraVoice {
        project: String,
        request: nara_voice::Request,
    },
    /// Pull the whole kernel state (read model; emits nothing).
    State,
    WorldRead,
    ProjectRead {
        project: String,
    },
    /// `fresh` bypasses the read cache for this one reading — the explicit
    /// refresh affordance, not the ordinary browse.
    WorldBrowse {
        #[serde(default, skip_serializing_if = "Option::is_none")]
        fresh: Option<bool>,
    },
    Routine {
        #[serde(default)]
        project: Option<String>,
        request: routine::Request,
    },
    Knowledge {
        #[serde(default)]
        project: Option<String>,
        request: knowledge::Request,
        #[serde(default, skip_serializing_if = "knowledge::not_fresh")]
        fresh: bool,
    },
    /// Assemble the typed graph input for U3.1/U3.4 presentation: Central's
    /// wiki read model (cell C1) composed with AIKit's owner-side resolution
    /// rows (cell C2) and the hosted Shared Field projection (Lane C step
    /// 5, the O:I-owned client's snapshot). Adapter only — every node/edge
    /// carries its owner ref, owner operation and owner provenance
    /// verbatim; a failed input degrades honestly as an explicit
    /// unavailable input. Emits nothing (pull read).
    Graph {
        #[serde(default)]
        project: Option<String>,
        #[serde(default)]
        query: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        options: Option<graph::ReadOptions>,
    },
    /// One request to the O:I-owned SharedField client (`shared_field.rs`,
    /// cell S→S0 · aperture mode): `status` | `snapshot` | `read {ref}` |
    /// `publish {args}` | `participant` | `admit` | `contact`, carried
    /// verbatim to the owner doorway. Pull only — emits nothing. The
    /// hosting target and transport token are the client's own
    /// environment; an unbound target or unreachable field returns an
    /// explicit `{state:"unavailable", detail}` reading as data, never an
    /// error; the owner's own refusal is returned in the owner's words.
    SharedField {
        request: serde_json::Value,
    },
    /// One A2A HTTP+JSON v1 exchange through the owner floor
    /// (`shared-field/a2a-runner.mjs` spawning `shared-field/a2a.mjs`). The
    /// request carries the binding, presence, initiator and message; the
    /// kernel composes the operator-send authority (the person's send IS the
    /// exchange-authority act) and the network I/O happens in this spawned
    /// process — the renderer never touches `fetch` and never mints a grant.
    A2aExchange {
        request: serde_json::Value,
    },
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
    InvokeAction {
        #[serde(default)]
        project: Option<String>,
        invocation: action::ActionInvocation,
    },
    /// Compose the W1.5 changed-since-thought read (`flow_cognition.rs`):
    /// the kernel supplies the KnowledgeChangeHorizon adapted from Central's
    /// own `projectcentral.change.horizon` seam and calls the AIKit owner's
    /// `flow changed-since`; ONE typed reading comes back with both owner
    /// sides explicit — a side that could not be queried is named, never
    /// faked empty. Emits nothing (pull read + owner read).
    FlowChangedSince {
        #[serde(default)]
        project: Option<String>,
        thought: serde_json::Value,
    },
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
        #[serde(default, skip_serializing_if = "Option::is_none")]
        agent_session_ref: Option<String>,
    },
    // Exact native working-surface reads; never materialise a missing pane.
    WorkingSurfaceRead {
        project: String,
        agent_session: String,
        binding: Option<String>,
    },
    WorkingSurfaceAttachment {
        project: String,
        agent_session: String,
        binding: String,
    },
    RecordingCapabilityRead,
    AgencyRead {
        project: String,
    },
    /// Native ranked route disclosure only; no winner, session or inference.
    ModelRoster {
        project: Option<String>,
    },
    AgentDefinition {
        project: Option<String>,
        request: agent_definition::Request,
    },
    /// The human Agent card (`oi.human-agent-card/v1`), derived by the
    /// installed suite's `oi agent card` from AgentWorldParticipation. Read
    /// only; the kernel neither composes nor keeps it.
    AgentCard {
        agent_ref: String,
        #[serde(default)]
        world_ref: Option<String>,
    },
    /// Wave 6E: pending Returns tray — list/read plus human review/include
    /// through Central's native receiving operations (owner-validated).
    /// `project` names the project register's field; `None` is the ROOT
    /// register's field (a Day document lives there) — the scope follows the
    /// owner's own ref grammar, never the desktop's configured route.
    Receiving {
        #[serde(default)]
        project: Option<String>,
        request: flow::ReceivingRequest,
    },
    /// NOW-relations (queue cell 1): read allocated NOW clearings by list or
    /// exact ref. Read-only; `project` follows the same explicit-null root
    /// law as `Receiving` — the register is the caller's to name.
    Now {
        #[serde(default)]
        project: Option<String>,
        request: flow::NowRequest,
    },
    /// Task-basis cell (queue cell 2): read one session's task record through
    /// the owner's `encounter-task-read`. Read-only; absence is a null
    /// reading, never a fabricated record.
    EncounterTaskRead {
        project: String,
        agent_session: String,
    },
    /// The human Day route: read the current today pointer (or one exact
    /// DayRef) through the owner. The disclosure carries the Day source's
    /// canonical ref — the only identity the desktop opens it by.
    DayRead {
        #[serde(default)]
        day_ref: Option<String>,
    },
    /// Finite Central root/project navigation and native Day operations.
    Central {
        #[serde(default)]
        project: Option<String>,
        request: central::Request,
    },
    /// Open the Day document's source buffer through the owner's Day route.
    /// There is no project-scoped source read for a root-register source:
    /// the buffer is built from `central.day.read`'s own disclosure.
    DaySourceOpen {
        #[serde(default)]
        day_ref: Option<String>,
    },
    Encounter {
        project: String,
        request: agency::EncounterRequest,
    },
    /// Provision ONE fresh chat conversation for a project and open it — the
    /// desktop's new-chat first Send. The kernel replays the owner's own
    /// SessionSpace CLI sequence (`project-context` → create →
    /// bind-project-context → attach-agent-session → encounter-agency-configure
    /// → encounter open) and returns the minted refs plus the open result.
    /// Every other encounter action keeps its attachment gate; this is the one
    /// path allowed to create the attachment it needs.
    EncounterProvision {
        project: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        preferred_body_ref: Option<String>,
    },
    /// Bring a named roster Agent into a shared Flow (O:I #558): a fresh
    /// Agency session for exactly that Agent, its resident opened, and this one
    /// sender and Flow source admitted to it. Nothing else is widened.
    FlowParticipantProvision {
        project: String,
        agent_ref: String,
        /// The Flow's native source ref (`central.path-ref/v1` `ref`).
        flow_ref: String,
        /// Who will be asking, as the owner's admission names them.
        sender: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        preferred_body_ref: Option<String>,
    },
    MaterialRead {
        target: material::Target,
    },
    /// The re-pinned build view (queue cell B): the owner CLI reads it as
    /// `factory build snapshot <state> <project-ref> <run-ref>` — the old
    /// `build discover`/`--binding` grammar is gone from the installed cut.
    /// Refs and state path are the caller's disclosure; payload verbatim
    /// after the contract schemas are verified.
    FactoryBuildSnapshot {
        #[serde(default)]
        project: Option<String>,
        state_path: ::std::path::PathBuf,
        project_ref: String,
        run_ref: String,
    },
    /// 6D first consumer (queue cell 3): one developmental read through the
    /// owner's own `factory development` family. The state path is the
    /// caller's disclosure — the desktop never invents a Factory state.
    FactoryDevelopmentRead {
        #[serde(default)]
        project: Option<String>,
        state_path: ::std::path::PathBuf,
        read: String,
        #[serde(default)]
        subject: Option<String>,
    },
    /// Run-in-Expressions: the whole SSSF attempt reading
    /// (`factory attempt read <state> <run-ref>`) — legs, attempts,
    /// verifications and the readable Return — so the Expression presents the
    /// run's actual evidence structure. The payload is carried verbatim after
    /// its contract schema is verified; no second run store is created.
    FactoryAttemptRead {
        state_path: ::std::path::PathBuf,
        run_ref: String,
    },
    /// The task refs a Run's attempt field carries
    /// (`factory attempt list <state> <run-ref>` → the owner's
    /// `factory.attempt-task-list-reading/v1`). The state path and run ref are
    /// the caller's disclosure; the payload is carried verbatim after its
    /// contract schema is verified — no task list is invented.
    FactoryAttemptTaskListRead {
        state_path: ::std::path::PathBuf,
        run_ref: String,
    },
    /// One task's attempt reading with the owner's own pagination
    /// (`factory attempt task <state> <run-ref> <task-ref> [--limit] [--cursor]`
    /// → `factory.attempt-task-reading/v1`): attempts, verifications, owner
    /// telemetry correlations and the readable Return. Limit and cursor are the
    /// owner's grammar, passed through; stale-cursor refusal stays the owner's.
    FactoryAttemptTaskRead {
        state_path: ::std::path::PathBuf,
        run_ref: String,
        task_ref: String,
        #[serde(default)]
        limit: Option<u32>,
        #[serde(default)]
        cursor: Option<serde_json::Value>,
    },
    /// 11-FACTORY §2/§3: Factory source discovery, workflow inspection,
    /// telemetry, the attempt Return, the action projection and the person's
    /// Recognition — one owner request family (factory::OwnerRequest).
    FactoryOwner {
        request: factory::OwnerRequest,
    },
    /// World inhabitation (WORLD-INHABITATION-V1 §4): AIKit's population,
    /// joined whoami and Refocus readings, carried verbatim after the schema
    /// check, each bounded by a timeout. A failed read is an error the
    /// renderer names as an absence (inhabitation::Request).
    InhabitationRead {
        request: inhabitation::Request,
    },
    /// Workcell's own placement/status reading (`workcell status --json`),
    /// beside the Factory reads — placement is Workcell's, never the desktop's.
    WorkcellStatusRead,
    /// The Agent Wiki operational projection behind one source
    /// (`aikit --json wiki projection read --file <path>`): the current body,
    /// its exact SHA-256 revision and the attributed feedback ledger. AIKit
    /// owns the source grammar and eligibility; the desktop only discloses
    /// the reading and never edits the file itself.
    WikiProjectionRead {
        root: ::std::path::PathBuf,
        path: String,
    },
    /// The composed projection selection (`aikit --json context current` →
    /// the continuity tuning): which sources the active composition named,
    /// and which composition selected them. Read-only disclosure of the
    /// composition's own declaration.
    WikiProjectionSources,
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
    ChatDefaultHold {
        provider: String,
    },
    /// Withdraw the held default — an explicit operation; the discard
    /// document carries the observed `removed` fact.
    ChatDefaultDiscard,
    /// Settings · Credentials (docs/cradle/12-SETTINGS.md §3.4, S12/S13):
    /// the owner's own `aikit credential …` verbs (`credentials.rs`). A
    /// pasted key crosses to AIKit on STDIN only and never comes back out.
    CredentialList,
    CredentialDiscover,
    CredentialSetup {
        credential: String,
        #[serde(default)]
        reference: Option<String>,
        #[serde(default)]
        material: Option<credentials::SecretMaterial>,
    },
    CredentialRotate {
        credential: String,
        #[serde(default)]
        reference: Option<String>,
        #[serde(default)]
        material: Option<credentials::SecretMaterial>,
    },
    CredentialVerify {
        credential: String,
    },
    CredentialRevoke {
        credential: String,
    },
    /// Settings · Harnesses (12 §3.2): `aikit client install <client>`.
    ClientInstall {
        client: String,
    },
    /// Settings · auth login (HARNESS-SETTINGS-RESEARCH-2026-09-22 §2a):
    /// `aikit harness auth <slug> --json` — the harness's declared auth
    /// options (env-var names, own-login entries with runnable + argv or
    /// note) verbatim. Describe only: the login itself is a terminal act,
    /// never a kernel op — nothing here spawns a login.
    HarnessAuthDescribe {
        harness: String,
    },
    /// Settings · product pages (12 §3.9): run one owner-disclosed action.
    ProductActionRun {
        product_id: String,
        action_ref: String,
    },
    /// Settings · read-only rows (12 §2, S11): reveal the owner's own file.
    SettingsReveal {
        path: String,
    },
    /// Settings · the staged changes (12 §2): every held desired entry with
    /// its resolution in one engine call (`oi config diff --json`).
    ConfigDiff,
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
    ConfigResolutionsRead {
        pairs: Vec<configuration::ConfigPair>,
    },
    /// Hold (or replace) one desired entry in the engine's desired store —
    /// no owner is touched. Secret-kind holds carry the reference only.
    ConfigDesiredHold {
        request: configuration::ConfigRequest,
    },
    /// Withdraw one held desired entry — an explicit operation, never
    /// implicit; the discard document carries the observed `removed` fact.
    ConfigDesiredDiscard {
        setting_ref: String,
        scope: configuration::ConfigScope,
    },
    /// Owner-native plans through `oi config plan` (09 §6): owner-minted
    /// plans verbatim, refused requests as their own `oi.config-error/v1`.
    ConfigPlan {
        requests: Vec<configuration::ConfigRequest>,
    },
    /// Apply the requests under ONE client-minted ChangeSet (09 §8) through
    /// `oi config apply`: the engine validates, orchestrates the owner
    /// verbs, takes the re-read verification (09 §9) and persists; the
    /// executed ChangeSet and owner-minted receipts cross back verbatim.
    ConfigApply {
        requests: Vec<configuration::ConfigRequest>,
    },
    /// The stored `oi.profile/v1` documents beside the explicit active
    /// mark (09 §12).
    ProfileList,
    ProfileRead {
        profile_ref: String,
    },
    /// The inspectable use plan: what the profile would hold beside what is
    /// currently held — BEFORE anything moves (09 §12; `use` writes only
    /// the active mark and moves no native state).
    ProfileUsePlan {
        profile_ref: String,
    },
    /// Make the profile active — only ever AFTER its use plan was rendered
    /// and accepted (the mark is the engine's only write here).
    ProfileUseApply {
        profile_ref: String,
    },
    /// Create an empty sparse profile.
    ProfileCreate {
        profile_ref: String,
        #[serde(default)]
        title: Option<String>,
    },
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
    Ground {
        request: ground::Request,
    },
    CompositionRead {
        #[serde(default)]
        owners: bool,
    },
    /// Wave 5 (docs/cradle/07): mount each of the six owners' own native
    /// `<product> system --json` disclosure, unmodified, alongside its
    /// honest availability. Distinct from `CompositionRead`, which reads
    /// the `oi` composition layer's own census.
    SystemCompositionRead,
    /// `fresh` bypasses the cached listing for this one read — the explicit
    /// tree refresh, not an ordinary expansion.
    FileResolve {
        reference: String,
    },
    FilesList {
        path: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        fresh: Option<bool>,
    },
    FileOperation {
        location: files::Location,
        request: files::Request,
    },
    FileRead {
        location: files::Location,
    },
    /// Binary-safe material read (FND-04): the owner's base64 encoding,
    /// never the UTF-8 text contract. Distinct name from the Workcell
    /// `MaterialRead` op above — this reads a native Central file, not a
    /// Workcell material target.
    FileBytes {
        location: files::Location,
    },
    ProjectBrowse {
        project: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        fresh: Option<bool>,
    },
    /// List a project's participating sources from the owner's
    /// disclosures (read-only; emits nothing).
    SourcesList {
        #[serde(default)]
        project: Option<String>,
    },
    /// Open a source into the buffer layer through the owner's read.
    SourceOpen {
        #[serde(default)]
        project: Option<String>,
        source_ref: String,
    },
    /// Set the cradle-held buffer content. Emits `buffer_dirty` exactly
    /// once per clean/dirty crossing — continued typing emits nothing.
    SourceEdit {
        source_ref: String,
        content: String,
    },
    SourceHistory {
        source_ref: String,
    },
    SourceRestore {
        source_ref: String,
        content: String,
        base_revision: String,
        saved_content: String,
    },
    /// CAS-save the buffer through `projectcentral.source.write`.
    SourceSave {
        #[serde(default)]
        project: Option<String>,
        source_ref: String,
    },
    /// Re-read the canonical layer (the conflict reconcile path): rebases
    /// the buffer's base revision, keeps the dirty buffer content.
    SourceReread {
        #[serde(default)]
        project: Option<String>,
        source_ref: String,
    },
    /// Register a surface binding (frame state, law 12).
    SurfaceOpen {
        surface_id: String,
        kind: String,
        #[serde(default)]
        source_ref: Option<String>,
        title: String,
    },
    /// Close a surface binding. Closing the focused surface also clears
    /// the focus relation — two state changes, two receipts.
    SurfaceClose {
        surface_id: String,
    },
    /// Make a surface's ref the one current focus subject. Emits
    /// `focus_changed` only when the relation actually moved.
    SurfaceFocus {
        surface_id: String,
    },
    // --- expression_world (ES1/ES4, lane aikit/es-one-state-relation): the
    // generic world operations — shared selection/deictic context,
    // SurfacePortal inspect/open/close/redock, ExpressiveAct
    // perform/interrupt/checkpoint/restore and bounded local-whole
    // bind/inspect/rebase over exact native refs. See expression_world.rs.
    ExpressionWorld {
        request: expression_world::Request,
    },
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
    /// Remote receipts keep their owner's generation and cursor. They never
    /// enter this kernel's independent ordered log or local event topic.
    HostedNative {
        source_world_ref: String,
        owner_generation: String,
        outcome: Box<KernelOpOutcome>,
    },
    FileLastReading {
        recovery: retained_files::Recovery,
    },
    DictationReading {
        stipulation: dictation::Stipulation,
    },
    DictationPrepared {
        capture_ref: String,
        stipulation: dictation::Stipulation,
    },
    DictationTranscribed {
        outcome: dictation::Outcome,
    },
    DecisionReading {
        reading: serde_json::Value,
    },
    DecisionPreflightReading {
        preflight: decision::Preflight,
    },
    DecisionEpisodeAuthorised {
        episode: decision::EpisodeSummary,
    },
    DecisionEpisodeRevoked {
        episode: decision::EpisodeSummary,
    },
    DecisionMade {
        receipt: decision::Receipt,
    },
    GitRepositoryReading {
        document: serde_json::Value,
    },
    GitDiffReading {
        document: serde_json::Value,
    },
    PresentationReading {
        document: serde_json::Value,
    },
    NaraDecisionRecorded {
        decision: serde_json::Value,
    },

    SetupReading {
        data: serde_json::Value,
    },
    BeingEncounter {
        data: serde_json::Value,
    },
    Expression {
        data: serde_json::Value,
    },
    ExpressionRecovery {
        data: serde_json::Value,
    },
    NativeExpression {
        data: serde_json::Value,
    },
    NaraCoordinate {
        data: serde_json::Value,
    },
    NaraEpii {
        data: serde_json::Value,
    },
    NaraExpressiveAct {
        data: serde_json::Value,
    },
    NaraPresence {
        data: serde_json::Value,
    },
    M3Reception {
        data: serde_json::Value,
    },
    NaraCurrent {
        data: serde_json::Value,
    },
    NaraIdentity {
        data: serde_json::Value,
    },
    NaraDialogue {
        data: serde_json::Value,
    },
    NaraVoice {
        data: serde_json::Value,
    },
    State {
        snapshot: KernelSnapshot,
    },
    WorldRead {
        snapshot: KernelSnapshot,
    },
    Routine {
        data: serde_json::Value,
    },
    Knowledge {
        data: serde_json::Value,
    },
    GraphReading {
        reading: graph::GraphReading,
    },
    /// The SharedField client's own reading (`oi.shared-field.*/v1`), or
    /// the explicit unavailable state — verbatim either way.
    SharedFieldReading {
        data: serde_json::Value,
    },
    /// The owner floor's `oi.a2a-difference/v1` document, carried verbatim.
    A2aExchangeDifference {
        data: serde_json::Value,
    },
    /// The typed encounter join (`encounter.rs`): both owner views, the
    /// grant-record seam and the failure-taxonomy disposition.
    EncounterJoined {
        reading: encounter::EncounterReading,
    },
    /// The typed result of one owner-Action dispatch (`action.rs`): the
    /// owner payload verbatim, or an explicit named state.
    ActionDispatched {
        dispatch: action::ActionDispatch,
    },
    /// The typed changed-since-thought compose (`flow_cognition.rs`): both
    /// owner sides of the read, explicit.
    FlowChangedSince {
        reading: flow_cognition::ChangedSinceReading,
    },
    /// The typed selection commission outcome (`commission.rs`): owner
    /// revision, structured conflict, or the owner's own refusal.
    InstanceCommissioned {
        outcome: commission::CommissionOutcome,
    },
    WorkingSurfaceReading {
        document: serde_json::Value,
    },
    RecordingCapability {
        document: serde_json::Value,
    },
    AgencyReading {
        project_ref: String,
        spaces: serde_json::Value,
        harness_disclosure: serde_json::Value,
        observed_at_unix_ms: u64,
    },
    ModelRosterReading {
        reading: serde_json::Value,
    },
    EncounterReading {
        data: serde_json::Value,
    },
    /// The provisioned chat conversation: the minted space and session refs,
    /// the chosen default provider and the owner's own open result, verbatim.
    EncounterProvisioned {
        data: serde_json::Value,
    },
    AgentDefinitionReading {
        data: serde_json::Value,
    },
    AgentCardReading {
        data: serde_json::Value,
    },
    ReceivingReading {
        data: serde_json::Value,
    },
    NowReading {
        data: serde_json::Value,
    },
    EncounterTaskReading {
        data: serde_json::Value,
    },
    FactoryDevelopmentReading {
        data: serde_json::Value,
    },
    FactoryAttemptReading {
        data: serde_json::Value,
    },
    FactoryAttemptTaskListReading {
        data: serde_json::Value,
    },
    FactoryAttemptTaskReading {
        data: serde_json::Value,
    },
    WorkcellStatusReading {
        data: serde_json::Value,
    },
    /// An AIKit inhabitation reading (the envelope's `data`, verbatim) and the
    /// envelope's own warnings, carried so the renderer can name them.
    InhabitationReading {
        data: serde_json::Value,
        #[serde(default, skip_serializing_if = "Vec::is_empty")]
        warnings: Vec<serde_json::Value>,
    },
    WikiProjectionReading {
        data: serde_json::Value,
    },
    WikiProjectionSourcesReading {
        data: serde_json::Value,
    },
    /// The harness status rows, verbatim from the owner's `client status`.
    HarnessStatusReading {
        data: serde_json::Value,
    },
    /// The resolved model catalogue, verbatim from the owner.
    ModelCatalogueReading {
        data: serde_json::Value,
    },
    /// The held chat default — the desktop's own document, or `None` when
    /// the owner's rows decide.
    ChatDefaultReading {
        document: Option<serde_json::Value>,
    },
    ChatDefaultHeld {
        document: serde_json::Value,
    },
    ChatDefaultDiscarded {
        document: serde_json::Value,
    },
    /// The owner's credential readings/changes (`credentials.rs`), verbatim
    /// `data` — binding metadata and verdicts only, never material.
    CredentialReading {
        data: serde_json::Value,
    },
    CredentialChanged {
        data: serde_json::Value,
    },
    CredentialVerified {
        data: serde_json::Value,
    },
    ClientInstalled {
        data: serde_json::Value,
    },
    /// The harness's declared auth options (`harness auth --json`), verbatim
    /// `data` — names and notes only; a login never runs through this seam.
    HarnessAuthReading {
        data: serde_json::Value,
    },
    ProductActionRan {
        data: serde_json::Value,
    },
    SettingsRevealed {
        data: serde_json::Value,
    },
    ConfigDiffReading {
        resolutions: Vec<serde_json::Value>,
    },
    /// The configuration registry reading (`configuration.rs`): the seven
    /// canonical positions, each honestly mounted or degraded by name.
    ConfigRegistryReading {
        reading: configuration::RegistryReading,
    },
    /// One resolution per requested pair, in order (09 §7 documents
    /// verbatim; refused pairings as named reconciliations).
    ConfigResolutions {
        resolutions: Vec<serde_json::Value>,
    },
    /// The held desired entry as the engine recorded it.
    ConfigDesiredHeld {
        entry: serde_json::Value,
    },
    /// The discard document, with its observed `removed` fact.
    ConfigDesiredDiscarded {
        document: serde_json::Value,
    },
    /// Owner-minted plans plus the structured errors for the requests that
    /// could not be planned.
    ConfigPlanned {
        plans: Vec<serde_json::Value>,
        errors: Vec<serde_json::Value>,
    },
    /// The executed ChangeSet beside the owner-minted receipts (09 §8/§9),
    /// verbatim. `owner_receipts` — not `receipts` — so the field never
    /// collides with the kernel event receipts beside it on the wire.
    ConfigApplied {
        changeset: serde_json::Value,
        #[serde(rename = "owner_receipts")]
        owner_receipts: Vec<serde_json::Value>,
    },
    /// The stored profiles beside the explicit active mark; a document
    /// that stopped reading is named in `degraded`, never silently dropped.
    ProfileListing {
        active_profile_ref: Option<String>,
        profiles: Vec<serde_json::Value>,
        #[serde(default, skip_serializing_if = "Vec::is_empty")]
        degraded: Vec<serde_json::Value>,
    },
    ProfileReading {
        profile: serde_json::Value,
    },
    /// The inspectable profile-use plan (09 §12).
    ProfileUsePlanning {
        plan: configuration::UsePlan,
    },
    /// The activation document the engine recorded (the mark, nothing else).
    ProfileUsed {
        activation: serde_json::Value,
    },
    ProfileCreated {
        profile: serde_json::Value,
    },
    /// The edited document beside the per-operation record — the
    /// `oi.profile-edit/v1` envelope, verbatim.
    ProfileEdited {
        document: serde_json::Value,
    },
    /// The recorded receipt references — the `oi.config-receipts/v1`
    /// envelope, verbatim; an absent history is an empty list.
    ConfigReceipts {
        document: serde_json::Value,
    },
    /// The owner's own `central.day.read` reading, carried verbatim — the
    /// Day's source identity is the owner's disclosure, never a ref the
    /// desktop derives from a path.
    DayReading {
        data: serde_json::Value,
    },
    CentralReading {
        data: serde_json::Value,
    },
    FileOperation {
        data: serde_json::Value,
    },
    NativeOwnerReading {
        owner: String,
        data: Option<serde_json::Value>,
        failure: Option<serde_json::Value>,
    },
    GroundReading {
        reading: serde_json::Value,
    },
    CompositionReading {
        reading: composition::Reading,
    },
    SystemCompositionReading {
        reading: system_composition::Reading,
    },
    DirectoryRead {
        directory: files::Directory,
    },
    FileResolved {
        location: files::Location,
    },
    FileRead {
        reading: files::Reading,
    },
    FileBytes {
        location: files::Location,
        revision: String,
        byte_len: u64,
        mime_hint: Option<String>,
        content_base64: String,
        source: Option<flow::SourceBinding>,
    },
    SourcesListed {
        listing: SourceListing,
    },
    SourceOpened {
        buffer: SourceBuffer,
    },
    SourceHistory {
        history: history::SourceHistory,
    },
    BufferEdited {
        buffer: SourceBuffer,
    },
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
    SourceReread {
        buffer: SourceBuffer,
    },
    SurfaceOpened {
        snapshot: KernelSnapshot,
    },
    SurfaceClosed {
        snapshot: KernelSnapshot,
    },
    SurfaceFocused {
        snapshot: KernelSnapshot,
    },
    // --- expression_world (ES1/ES4, lane aikit/es-one-state-relation).
    ExpressionWorld {
        data: serde_json::Value,
    },
}

impl Kernel {
    pub fn new(client: CentralClient) -> Self {
        Self::with_agency(client, agency::Client::discover())
    }

    pub fn with_agency(client: CentralClient, agency: agency::Client) -> Self {
        Self {
            client,
            agency,
            presentation: presentation::Store::default(),
            decisions: decision::Store::default(),
            dictation: dictation::Store::default(),
            nara_voice: nara_voice::Store::default(),
            nara_contexts: BTreeMap::new(),
            retained_files: retained_files::Store::default(),
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

    /// Identity calls only native owners; release the global UI kernel lock
    /// while ephemeris calculation or Central's source CAS is running.
    pub fn prepare_nara_identity(&self, op: &KernelOp) -> Option<nara_identity::Prepared> {
        match op {
            KernelOp::NaraIdentity { request } => Some(nara_identity::Prepared::new(
                self.client.clone(),
                request.clone(),
            )),
            _ => None,
        }
    }

    fn nara_context_key(project: &str, binding: &nara_dialogue::Request) -> Result<String, String> {
        let mut nara = binding.clone();
        nara.role = nara_dialogue::Role::Nara;
        let native = nara_dialogue::Binding::new(project, &nara)?;
        serde_json::to_string(&(native.agent_session, &binding.expression_ref))
            .map_err(|e| e.to_string())
    }

    fn nara_context_state(
        &self,
        project: &str,
        binding: &nara_dialogue::Request,
        document: &serde_json::Value,
        profile: &nara_dialogue::ProfileBasis,
    ) -> Result<nara_dialogue::ContextState, String> {
        Ok(self.nara_context_state_at(
            &Self::nara_context_key(project, binding)?,
            binding,
            document,
            profile,
        ))
    }
    fn nara_context_state_at(
        &self,
        key: &str,
        binding: &nara_dialogue::Request,
        document: &serde_json::Value,
        profile: &nara_dialogue::ProfileBasis,
    ) -> nara_dialogue::ContextState {
        let mut state = nara_dialogue::ContextState::default();
        if let Some(entry) = self.nara_contexts.get(key) {
            state.expressive_act = entry
                .checkpoint
                .as_ref()
                .and_then(|c| c.context_state(binding, document, profile))
                .unwrap_or_default();
            if let Some(pin) = entry
                .personal_current
                .as_ref()
                .filter(|p| p.current(binding, profile))
            {
                state.personal_current = pin.context();
                state.personal_current_reading = pin.reading();
            }
        }
        state
    }

    pub fn prepare_nara_presence(
        &mut self,
        op: &KernelOp,
    ) -> Result<Option<nara_presence::Prepared>, String> {
        let KernelOp::NaraPresence { project, request } = op else {
            return Ok(None);
        };
        let binding = &request.binding;
        let document = self
            .expressions
            .apply(
                &self.client,
                expression::Request::Inspect {
                    expression_ref: binding.expression_ref.clone(),
                },
            )?
            .0["document"]
            .clone();
        let profile = self.nara_expression_profile(&document)?;
        let cwd = self.agent_location((!project.is_empty()).then_some(project.as_str()))?;
        let project_ref = self.agent_project_ref(project, &cwd)?;
        Ok(Some(nara_presence::Prepared::new(
            self.client.clone(),
            self.agency.clone(),
            cwd,
            project_ref,
            request.clone(),
            document,
            profile,
        )))
    }
    pub fn finish_nara_presence(
        &mut self,
        completed: nara_presence::Completed,
    ) -> Result<KernelOpOutcome, String> {
        let binding = &completed.request.binding;
        let document = self
            .expressions
            .apply(
                &self.client,
                expression::Request::Inspect {
                    expression_ref: binding.expression_ref.clone(),
                },
            )?
            .0["document"]
            .clone();
        if document != completed.document
            || self.nara_expression_profile(&document)? != completed.profile
        {
            return Err(
                "The Expression or adopted profile changed during presence admission".into(),
            );
        }
        let (source, identity) = nara_identity::read(&self.client, &binding.source_ref)?;
        if source.revision.revision != binding.expected_revision
            || identity["person_ref"] != binding.person_ref
            || identity["nara_ref"] != binding.nara_ref
        {
            return Err("The saved identity changed during presence admission".into());
        }
        // Serialize publication with native Expression changes. No renderer
        // bundle or captured personal reading is accepted at this commit seam.
        let mut data =
            shared_field::call(&completed.transport_request()).map_err(|e| e.detail())?;
        data["consent_reading"] = completed.consent_reading;
        Ok(KernelOpOutcome {
            receipts: vec![],
            result: KernelOpResult::NaraPresence { data },
        })
    }

    pub fn prepare_m3_reception(
        &mut self,
        op: &KernelOp,
    ) -> Result<Option<m3_reception::Prepared>, String> {
        let KernelOp::M3Reception { project, request } = op else {
            return Ok(None);
        };
        let binding = request.binding();
        let document = self
            .expressions
            .apply(
                &self.client,
                expression::Request::Inspect {
                    expression_ref: binding.expression_ref.clone(),
                },
            )?
            .0["document"]
            .clone();
        let profile = self.nara_expression_profile(&document)?;
        let cwd = self.agent_location((!project.is_empty()).then_some(project.as_str()))?;
        let project_ref = self.agent_project_ref(project, &cwd)?;
        let entry = self
            .nara_contexts
            .get(&Self::nara_context_key(&project_ref, binding)?);
        Ok(Some(m3_reception::Prepared::new(
            self.client.clone(),
            project_ref,
            request.clone(),
            document,
            profile,
            entry.and_then(|e| e.personal_current.clone()),
            entry.and_then(|e| e.m3.clone()),
        )))
    }
    pub fn finish_m3_reception(
        &mut self,
        completed: m3_reception::Completed,
    ) -> Result<KernelOpOutcome, String> {
        let binding = &completed.binding;
        let document = self
            .expressions
            .apply(
                &self.client,
                expression::Request::Inspect {
                    expression_ref: binding.expression_ref.clone(),
                },
            )?
            .0["document"]
            .clone();
        if document != completed.document
            || self.nara_expression_profile(&document)? != completed.profile
        {
            return Err("The Expression or profile changed during M3 reception".into());
        }
        let (source, identity) = nara_identity::read(&self.client, &binding.source_ref)?;
        if source.revision.revision != binding.expected_revision
            || identity["person_ref"] != binding.person_ref
            || identity["nara_ref"] != binding.nara_ref
        {
            return Err("The saved identity changed during M3 reception".into());
        }
        let key = serde_json::to_string(&(&completed.agent_session_ref, &binding.expression_ref))
            .map_err(|e| e.to_string())?;
        let entry = self.nara_contexts.get(&key);
        let current = entry
            .and_then(|e| e.personal_current.as_ref())
            .filter(|p| p.current(binding, &completed.profile))
            .map(|p| p.context())
            .unwrap_or_default();
        if current != completed.current_context
            || entry
                .and_then(|e| e.m3.as_ref())
                .map(|r| r.revision().to_owned())
                != completed.expected_revision
        {
            return Err("The native event or M3 generation changed during reception".into());
        }
        if let Some(candidate) = completed.candidate {
            if self.nara_contexts.len() >= 64 && !self.nara_contexts.contains_key(&key) {
                return Err("This native host has reached its Nara context bound".into());
            }
            if let Some(current) = completed.current_candidate {
                self.nara_voice
                    .invalidate_expression(&binding.expression_ref);
                self.nara_contexts
                    .entry(key.clone())
                    .or_default()
                    .personal_current = Some(current);
            }
            self.nara_contexts.entry(key).or_default().m3 = Some(candidate);
        }
        Ok(KernelOpOutcome {
            receipts: vec![],
            result: KernelOpResult::M3Reception {
                data: completed.data,
            },
        })
    }

    pub fn prepare_nara_current(
        &mut self,
        op: &KernelOp,
    ) -> Result<Option<nara_current::Prepared>, String> {
        let KernelOp::NaraCurrent { project, request } = op else {
            return Ok(None);
        };
        let binding = request.binding();
        let document = self
            .expressions
            .apply(
                &self.client,
                expression::Request::Inspect {
                    expression_ref: binding.expression_ref.clone(),
                },
            )?
            .0["document"]
            .clone();
        let profile = self.nara_expression_profile(&document)?;
        let cwd = self.agent_location((!project.is_empty()).then_some(project.as_str()))?;
        let project_ref = self.agent_project_ref(project, &cwd)?;
        let existing = self
            .nara_contexts
            .get(&Self::nara_context_key(&project_ref, binding)?)
            .and_then(|e| e.personal_current.clone());
        Ok(Some(nara_current::Prepared::new(
            self.client.clone(),
            project_ref,
            request.clone(),
            document,
            profile,
            existing,
        )))
    }

    pub fn finish_nara_current(
        &mut self,
        completed: nara_current::Completed,
    ) -> Result<KernelOpOutcome, String> {
        let binding = &completed.binding;
        let document = self
            .expressions
            .apply(
                &self.client,
                expression::Request::Inspect {
                    expression_ref: binding.expression_ref.clone(),
                },
            )?
            .0["document"]
            .clone();
        if document != completed.document
            || self.nara_expression_profile(&document)? != completed.profile
        {
            return Err(
                "The Expression or adopted profile changed during the personal current reading"
                    .into(),
            );
        }
        let (source, identity) = nara_identity::read(&self.client, &binding.source_ref)?;
        if source.revision.revision != binding.expected_revision
            || identity["person_ref"] != binding.person_ref
            || identity["nara_ref"] != binding.nara_ref
        {
            return Err("The saved identity changed during the personal current reading".into());
        }
        let key = serde_json::to_string(&(&completed.agent_session_ref, &binding.expression_ref))
            .map_err(|e| e.to_string())?;
        let current = self
            .nara_contexts
            .get(&key)
            .and_then(|entry| entry.personal_current.as_ref().map(|pin| pin.context()));
        if current != completed.expected_current {
            return Err("The pinned personal current changed while this reading was prepared; read its current native basis".into());
        }
        if let Some(pin) = completed.candidate {
            if self.nara_contexts.len() >= 64 && !self.nara_contexts.contains_key(&key) {
                return Err("This native host has reached its Nara context bound".into());
            }
            let entry = self.nara_contexts.entry(key).or_default();
            if entry.personal_current.as_ref().map(|old| old.context()) != Some(pin.context()) {
                self.nara_voice
                    .invalidate_expression(&binding.expression_ref);
            }
            if entry.personal_current.as_ref().map(|old| old.context()) != Some(pin.context()) {
                entry.m3 = None;
            }
            entry.personal_current = Some(pin);
        }
        Ok(KernelOpOutcome {
            receipts: vec![],
            result: KernelOpResult::NaraCurrent {
                data: completed.data,
            },
        })
    }

    pub fn prepare_nara_voice(
        &mut self,
        op: &KernelOp,
    ) -> Result<Option<nara_voice::Prepared>, String> {
        let KernelOp::NaraVoice { project, request } = op else {
            return Ok(None);
        };
        let document = match self.nara_voice.binding(request)? {
            Some(binding) => self
                .expressions
                .apply(
                    &self.client,
                    expression::Request::Inspect {
                        expression_ref: binding.expression_ref,
                    },
                )?
                .0["document"]
                .clone(),
            None => serde_json::Value::Null,
        };
        let profile = if document["profiles"].as_array().is_some_and(|rows| {
            rows.iter().any(|row| {
                row["profile_ref"]
                    .as_str()
                    .is_some_and(|reference| reference.starts_with("profile:epi-coordinate-"))
            })
        }) {
            Some(self.nara_expression_profile(&document)?)
        } else {
            None
        };
        let cwd = self.agent_location((!project.is_empty()).then_some(project.as_str()))?;
        let project_ref = self.agent_project_ref(project, &cwd)?;
        let context_state = match (self.nara_voice.binding(request)?, profile.as_ref()) {
            (Some(binding), Some(profile)) => {
                self.nara_context_state(&project_ref, &binding, &document, profile)?
            }
            _ => nara_dialogue::ContextState::default(),
        };
        self.nara_voice
            .prepare(
                self.client.clone(),
                self.agency.clone(),
                cwd,
                project_ref,
                request.clone(),
                document,
                profile,
            )
            .map(|prepared| Some(prepared.with_context_state(context_state)))
    }

    fn nara_expression_profile(
        &mut self,
        document: &serde_json::Value,
    ) -> Result<nara_dialogue::ProfileBasis, String> {
        let adoptions = document["profiles"]
            .as_array()
            .ok_or("This Expression has no adopted coordinate profile")?;
        let adoptions: Vec<_> = adoptions
            .iter()
            .filter(|row| {
                row["profile_ref"]
                    .as_str()
                    .is_some_and(|reference| reference.starts_with("profile:epi-coordinate-"))
            })
            .collect();
        if adoptions.len() != 1 {
            return Err(
                "Coordinate dialogue requires one unambiguous adopted Expression profile".into(),
            );
        }
        let profile_ref = adoptions[0]["profile_ref"]
            .as_str()
            .ok_or("Adopted Expression profile has no reference")?
            .to_owned();
        let profile = self
            .expressions
            .apply(
                &self.client,
                expression::Request::ProfileInspect {
                    profile_ref: profile_ref.clone(),
                },
            )?
            .0["profile"]
            .clone();
        if profile["revision"] != adoptions[0]["revision"] {
            return Err(
                "The adopted Expression profile changed; review and adopt its current revision"
                    .into(),
            );
        }
        Ok(nara_dialogue::ProfileBasis {
            profile,
            lineage: self.expressions.profile_lineage_snapshot(&profile_ref)?,
        })
    }

    pub fn prepare_nara_dialogue(
        &mut self,
        op: &KernelOp,
    ) -> Result<Option<nara_dialogue::Prepared>, String> {
        let KernelOp::NaraDialogue { project, request } = op else {
            return Ok(None);
        };
        let document = self
            .expressions
            .apply(
                &self.client,
                expression::Request::Inspect {
                    expression_ref: request.expression_ref.clone(),
                },
            )?
            .0["document"]
            .clone();
        let profile = if matches!(
            request.operation,
            nara_dialogue::Operation::Context | nara_dialogue::Operation::Readiness
        ) {
            Some(self.nara_expression_profile(&document)?)
        } else {
            None
        };
        let cwd = self.agent_location((!project.is_empty()).then_some(project.as_str()))?;
        let project_ref = self.agent_project_ref(project, &cwd)?;
        let context_state = profile
            .as_ref()
            .map(|profile| self.nara_context_state(&project_ref, request, &document, profile))
            .transpose()?
            .unwrap_or_default();
        Ok(Some(
            nara_dialogue::Prepared::new(
                self.client.clone(),
                self.agency.clone(),
                cwd,
                project_ref,
                request.clone(),
                document,
                profile,
            )
            .with_context_state(context_state),
        ))
    }

    pub fn prepare_nara_epii(
        &mut self,
        op: &KernelOp,
    ) -> Result<Option<nara_epii::Prepared>, String> {
        let KernelOp::NaraEpii { project, request } = op else {
            return Ok(None);
        };
        let document = self
            .expressions
            .apply(
                &self.client,
                expression::Request::Inspect {
                    expression_ref: request.binding().expression_ref.clone(),
                },
            )?
            .0["document"]
            .clone();
        let profile = self.nara_expression_profile(&document);
        let cwd = self.agent_location((!project.is_empty()).then_some(project.as_str()))?;
        let project_ref = self.agent_project_ref(project, &cwd)?;
        let context_state = profile
            .as_ref()
            .ok()
            .map(|profile| {
                self.nara_context_state(&project_ref, request.binding(), &document, profile)
            })
            .transpose()?
            .unwrap_or_default();
        Ok(Some(
            nara_epii::Prepared::new(
                self.client.clone(),
                self.agency.clone(),
                cwd,
                project_ref,
                request.clone(),
                document,
                profile,
            )
            .with_context_state(context_state),
        ))
    }

    pub fn finish_nara_epii(
        &mut self,
        result: nara_epii::PreparedOutcome,
    ) -> Result<KernelOpOutcome, String> {
        let reviewed = match result {
            nara_epii::PreparedOutcome::Read(data) => {
                return Ok(KernelOpOutcome {
                    receipts: vec![],
                    result: KernelOpResult::NaraEpii { data },
                })
            }
            nara_epii::PreparedOutcome::Accept(reviewed) => *reviewed,
        };
        let document = self
            .expressions
            .apply(
                &self.client,
                expression::Request::Inspect {
                    expression_ref: reviewed.expression_ref.clone(),
                },
            )?
            .0["document"]
            .clone();
        if document != reviewed.captured_document {
            return Err("The Expression changed during Epii review; read the return against its current revision".into());
        }
        let profile = self.nara_expression_profile(&document)?;
        if profile.profile != reviewed.captured_profile.profile
            || profile.lineage != reviewed.captured_profile.lineage
        {
            return Err("The coordinate profile changed during Epii review".into());
        }
        let context_key =
            serde_json::to_string(&(&reviewed.origin_session_ref, &reviewed.expression_ref))
                .map_err(|e| e.to_string())?;
        if self.nara_context_state_at(&context_key, &reviewed.origin_binding, &document, &profile)
            != reviewed.context_state
        {
            return Err(
                "The personal occasion or expressive state changed during Epii review".into(),
            );
        }
        let (source, _) = nara_identity::read(&self.client, &reviewed.identity_source_ref)?;
        if source.revision.revision != reviewed.identity_revision {
            return Err("The saved identity changed during Epii review".into());
        }
        let (data, changes) = self.apply_reviewed_focus_with_attribution(
            native_expression::procedural::manual::epii_proposal(&reviewed),
        )?;
        self.nara_voice
            .invalidate_expression(&reviewed.expression_ref);
        let mut receipts = changes
            .into_iter()
            .map(|change| {
                self.log.record(KernelEvent::ExpressionChanged {
                    expression_ref: change.expression_ref,
                    revision: change.revision,
                    actor: change.actor,
                    activity_ref: change.activity_ref,
                })
            })
            .collect::<Vec<_>>();
        if let Some(subject) = self.expressions.selected_subject(&reviewed.expression_ref) {
            let before = self.focus.clone();
            self.focus
                .focus_subject(subject.clone())
                .map_err(|e| e.to_string())?;
            if before != self.focus {
                receipts.push(self.log.record(KernelEvent::FocusChanged {
                    focus: self.focus.clone(),
                }));
            }
            self.world
                .record_expression_selection(&reviewed.expression_ref, &subject);
        }
        Ok(KernelOpOutcome {
            receipts,
            result: KernelOpResult::NaraEpii {
                data: serde_json::json!({
                    "schema":"oi.nara-epii-accepted/v1","document":data["document"],"provenance":reviewed.provenance,"applied":true,
                    "native_procedural_source":data["native_procedural_source"],
                }),
            },
        })
    }

    pub fn prepare_nara_expressive_act(
        &mut self,
        op: &KernelOp,
    ) -> Result<Option<nara_expressive_act::Prepared>, String> {
        let KernelOp::NaraExpressiveAct { project, request } = op else {
            return Ok(None);
        };
        let document = self
            .expressions
            .apply(
                &self.client,
                expression::Request::Inspect {
                    expression_ref: request.binding().expression_ref.clone(),
                },
            )?
            .0["document"]
            .clone();
        let profile = self.nara_expression_profile(&document)?;
        let cwd = self.agent_location((!project.is_empty()).then_some(project.as_str()))?;
        let project_ref = self.agent_project_ref(project, &cwd)?;
        let context_state =
            self.nara_context_state(&project_ref, request.binding(), &document, &profile)?;
        Ok(Some(
            nara_expressive_act::Prepared::new(
                self.client.clone(),
                self.agency.clone(),
                cwd,
                project_ref,
                request.clone(),
                document,
                profile,
            )
            .with_context_state(context_state),
        ))
    }

    pub fn finish_nara_expressive_act(
        &mut self,
        result: nara_expressive_act::PreparedOutcome,
    ) -> Result<KernelOpOutcome, String> {
        use nara_expressive_act::PreparedOutcome;
        let (binding, captured, profile, session) = match &result {
            PreparedOutcome::Read(data) => {
                return Ok(KernelOpOutcome {
                    receipts: vec![],
                    result: KernelOpResult::NaraExpressiveAct { data: data.clone() },
                })
            }
            PreparedOutcome::Focus(f) => (
                &f.binding,
                &f.captured_document,
                &f.captured_profile,
                &f.agent_session_ref,
            ),
            PreparedOutcome::Restore(r) => (
                &r.binding,
                &r.captured_document,
                &r.captured_profile,
                &r.agent_session_ref,
            ),
        };
        let reference = binding.expression_ref.clone();
        let document = self
            .expressions
            .apply(
                &self.client,
                expression::Request::Inspect {
                    expression_ref: reference.clone(),
                },
            )?
            .0["document"]
            .clone();
        if &document != captured {
            return Err("The Expression changed during the expressive act; inspect the current answer basis".into());
        }
        let current_profile = self.nara_expression_profile(&document)?;
        if current_profile.profile != profile.profile || current_profile.lineage != profile.lineage
        {
            return Err("The adopted profile changed during the expressive act".into());
        }
        let (source, identity) = nara_identity::read(&self.client, &binding.source_ref)?;
        if source.revision.revision != binding.expected_revision
            || identity["nara_ref"] != binding.nara_ref
            || identity["person_ref"] != binding.person_ref
        {
            return Err("The saved identity changed during the expressive act".into());
        }
        // One ephemeral checkpoint for this exact native AgentSession and
        // Expression, never another profile, document store or saved identity.
        let key = serde_json::to_string(&(session, &reference)).map_err(|e| e.to_string())?;
        let (data, changed, act_ref, checkpoint_ref, operation) = match result {
            PreparedOutcome::Focus(focus) => {
                if self.nara_context_state_at(&key, &focus.binding, &document, &current_profile)
                    != focus.context_state
                {
                    return Err("The personal occasion or expressive state changed during the expressive act".into());
                }
                if self.nara_contexts.len() >= 64 && !self.nara_contexts.contains_key(&key) {
                    return Err(
                        "This native host has reached its expressive checkpoint bound".into(),
                    );
                }
                let (data, changed) = self
                    .apply_native_expression_with_procedural_attribution(focus.request.clone())?;
                if data["state"] != "ready" {
                    return Err(data["reason"]
                        .as_str()
                        .unwrap_or("Native focus admission was refused")
                        .into());
                }
                if changed.is_none() {
                    return Err("The reviewed focus did not change the native selection".into());
                }
                let after = data["document"].clone();
                let checkpoint = nara_expressive_act::Checkpoint::committed(&focus, after)?;
                self.nara_contexts.entry(key).or_default().checkpoint = Some(checkpoint);
                (data, changed, focus.act_ref, focus.checkpoint_ref, "focus")
            }
            PreparedOutcome::Restore(restore) => {
                let checkpoint = self
                    .nara_contexts
                    .get(&key)
                    .and_then(|entry| entry.checkpoint.as_ref())
                    .ok_or(
                        "This native host has no retained checkpoint for that Nara and Expression",
                    )?;
                if current_profile.profile != checkpoint.captured_profile.profile
                    || current_profile.lineage != checkpoint.captured_profile.lineage
                {
                    return Err(
                        "The checkpoint's adopted profile lineage is no longer current".into(),
                    );
                }
                let request = checkpoint.restore_request(
                    &restore.binding,
                    &restore.act_ref,
                    restore.expected_revision,
                    &document,
                )?;
                let checkpoint_ref = checkpoint.reading()["checkpoint_ref"]
                    .as_str()
                    .ok_or("Native checkpoint reference absent")?
                    .to_owned();
                let (data, changed) = self.apply_checkpoint_restore_with_attribution(request)?;
                if let Some(entry) = self.nara_contexts.get_mut(&key) {
                    entry.checkpoint = None;
                }
                if self
                    .nara_contexts
                    .get(&key)
                    .is_some_and(|entry| entry.personal_current.is_none() && entry.m3.is_none())
                {
                    self.nara_contexts.remove(&key);
                }
                (data, changed, restore.act_ref, checkpoint_ref, "restore")
            }
            PreparedOutcome::Read(_) => unreachable!(),
        };
        let applied = changed.is_some();
        let mut receipts = Vec::new();
        if let Some(change) = changed {
            self.nara_voice.invalidate_expression(&reference);
            receipts.push(self.log.record(KernelEvent::ExpressionChanged {
                expression_ref: change.expression_ref,
                revision: change.revision,
                actor: change.actor,
                activity_ref: change.activity_ref,
            }));
            if let Some(subject) = self.expressions.selected_subject(&reference) {
                let before = self.focus.clone();
                self.focus
                    .focus_subject(subject.clone())
                    .map_err(|e| e.to_string())?;
                if before != self.focus {
                    receipts.push(self.log.record(KernelEvent::FocusChanged {
                        focus: self.focus.clone(),
                    }));
                }
                self.world.record_expression_selection(&reference, &subject);
            }
        }
        Ok(KernelOpOutcome {
            receipts,
            result: KernelOpResult::NaraExpressiveAct {
                data: serde_json::json!({
                    "schema":"oi.nara-expressive-act-effect/v1","operation":operation,"act_ref":act_ref,
                    "checkpoint_ref":checkpoint_ref,"nara_ref":identity["nara_ref"],"expression_ref":reference,
                    "expression_revision":data["document"]["revision"],"document":data["document"],
                    "effect_applied":applied,"dynamic_checkpoint":false,
                    "native_procedural_source":data["native_procedural_source"],
                }),
            },
        })
    }

    /// The ordered event log — the observable seam the host exposes by
    /// command and forwards by event.
    /// Capture immutable read inputs only. Hosts execute the returned work
    /// after releasing their kernel mutex; no source or event state is cloned.
    pub fn prepare_owner_read(&mut self, op: &KernelOp) -> Option<owner_read::PreparedRead> {
        owner_read::PreparedRead::prepare(
            &self.client,
            self.reads.get("world", read_cache::WORLD_TTL),
            op,
        )
    }

    fn presentation_outcome(
        &mut self,
        (document, changed): (serde_json::Value, bool),
    ) -> Result<KernelOpOutcome, String> {
        let receipts = if changed {
            vec![self.log.record(KernelEvent::PresentationChanged {
                revision: document["revision"]
                    .as_u64()
                    .ok_or("Appearance revision absent")?,
                theme: serde_json::from_value(document["theme"].clone())
                    .map_err(|e| e.to_string())?,
            })]
        } else {
            vec![]
        };
        Ok(KernelOpOutcome {
            receipts,
            result: KernelOpResult::PresentationReading { document },
        })
    }

    pub fn prepare_working_surface_read(
        &mut self,
        project: &str,
        agent_session: String,
        binding: Option<String>,
        attachment: bool,
    ) -> Result<working_surface::PreparedRead, String> {
        Ok(working_surface::PreparedRead {
            client: self.agency.clone(),
            central: self.client.clone(),
            world: self.reads.get("world", read_cache::WORLD_TTL),
            project: project.to_owned(),
            agent_session,
            binding,
            attachment,
        })
    }

    /// Native host notification after an actual attachment/client release.
    /// No renderer KernelOp can fabricate a driving interval.
    pub fn record_working_surface_driving(
        &mut self,
        agent_session: String,
        binding: String,
        client_id: String,
        driving: bool,
    ) -> KernelEventReceipt {
        self.log.record(KernelEvent::WorkingSurfaceDriving {
            agent_session,
            binding,
            client_id,
            driving,
            observed_at_unix_ms: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis() as u64,
        })
    }

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
        if let Some(prepared) = self.prepare_knowledge(&op)? {
            return self.finish_knowledge(prepared.execute()?);
        }
        match op {
            KernelOp::FileLastReading { location } => Ok(KernelOpOutcome {
                receipts: vec![],
                result: KernelOpResult::FileLastReading {
                    recovery: self.retained_files.recovery(&self.client, &location)?,
                },
            }),
            KernelOp::DictationRead => Ok(KernelOpOutcome {
                receipts: vec![],
                result: KernelOpResult::DictationReading {
                    stipulation: self.dictation.read()?,
                },
            }),
            KernelOp::DictationConfigure {
                stt_url,
                expected_revision,
            } => {
                let (stipulation, changed) =
                    self.dictation.configure(stt_url, expected_revision)?;
                let receipts = if changed {
                    vec![self.log.record(KernelEvent::DictationChanged {
                        revision: stipulation.revision,
                        stt_url: stipulation.stt_url.clone(),
                    })]
                } else {
                    vec![]
                };
                Ok(KernelOpOutcome {
                    receipts,
                    result: KernelOpResult::DictationReading { stipulation },
                })
            }
            op @ (KernelOp::DictationProbe | KernelOp::DictationTranscribe { .. }) => self
                .prepare_dictation(&op)?
                .ok_or("Cannot prepare dictation")?
                .execute(),
            KernelOp::DecisionRead => Ok(KernelOpOutcome {
                receipts: vec![],
                result: KernelOpResult::DecisionReading {
                    reading: self.decisions.reading()?,
                },
            }),
            KernelOp::DecisionPreflight { proposal } => Ok(KernelOpOutcome {
                receipts: vec![],
                result: KernelOpResult::DecisionPreflightReading {
                    preflight: self.decision_preflight(proposal)?,
                },
            }),
            op @ KernelOp::Decide { .. } => {
                let prepared = self
                    .prepare_decision(&op)?
                    .ok_or("Cannot prepare decision")?;
                self.finish_decision(prepared.execute()?, false)
            }
            KernelOp::DecisionEpisodeRevoke { authority_ref } => {
                let (episode, changed) = self.decisions.revoke(&authority_ref)?;
                let receipts = if changed {
                    vec![self.log.record(KernelEvent::DecisionEpisodeChanged {
                        episode: serde_json::to_value(&episode).map_err(|e| e.to_string())?,
                    })]
                } else {
                    vec![]
                };
                Ok(KernelOpOutcome {
                    receipts,
                    result: KernelOpResult::DecisionEpisodeRevoked { episode },
                })
            }
            KernelOp::InvokeAction {
                project,
                invocation,
            } if invocation.action.starts_with("action:decision.") => {
                match invocation.action.as_str() {
                    "action:decision.preflight" => {
                        let mut proposal:decision::Proposal=serde_json::from_value(invocation.input.unwrap_or(serde_json::Value::Null)).map_err(|e|e.to_string())?;
                        if proposal.project.is_some() && proposal.project!=project {return Err("Decision project differs from its Action scope".into());}
                        proposal.project=project;
                        if proposal.observer_id.as_deref()!=Some(invocation.target_ref.as_str()) {return Err("Decision Action target must name its exact renderer observation".into());}
                        if !proposal.sites.iter().all(|site|site=="agent.ui") {return Err("Agent UI Action uses only the declared agent.ui site".into());}
                        let preflight=self.decision_preflight(proposal)?;
                        Ok(KernelOpOutcome{receipts:vec![],result:KernelOpResult::ActionDispatched{dispatch:action::ActionDispatch::Invoked{owner_operation:"oi kernel decision preflight".into(),data:serde_json::to_value(preflight).map_err(|e|e.to_string())?}}})
                    },
                    "action:decision.decide" => {
                        let op=KernelOp::InvokeAction{project,invocation};
                        let prepared=self.prepare_decision(&op)?.ok_or("Cannot prepare decision Action")?;
                        self.finish_decision(prepared.execute()?,true)
                    },
                    _=>Err("Unknown decision Action; authority issuance is available only through native confirmation".into()),
                }
            }
            KernelOp::GitRepositoryRead { project } => Ok(KernelOpOutcome {
                receipts: vec![],
                result: KernelOpResult::GitRepositoryReading {
                    document: git::repository(&self.client, &project)?,
                },
            }),
            KernelOp::GitDiffRead { request } => Ok(KernelOpOutcome {
                receipts: vec![],
                result: KernelOpResult::GitDiffReading {
                    document: git::diff(&self.client, request)?,
                },
            }),
            KernelOp::ConfigDiff
            | KernelOp::CompositionRead { .. }
            | KernelOp::SystemCompositionRead
            | KernelOp::ConfigRegistryRead
            | KernelOp::ConfigResolutionsRead { .. } => self
                .prepare_owner_read(&op)
                .ok_or("Cannot prepare owner disclosure")?
                .execute(),
            KernelOp::PresentationRead => Ok(KernelOpOutcome {
                receipts: vec![],
                result: KernelOpResult::PresentationReading {
                    document: self.presentation.reading()?,
                },
            }),
            KernelOp::PresentationObserve {
                window_id,
                visuals,
                arrangement,
            } => Ok(KernelOpOutcome {
                receipts: vec![],
                result: KernelOpResult::PresentationReading {
                    document: self.presentation.observe(window_id, visuals, arrangement)?,
                },
            }),
            KernelOp::ThemeImport { theme } => {
                let update = self.presentation.import(theme)?;
                self.presentation_outcome(update)
            }
            KernelOp::ThemeApply { appearance, id } => {
                let update = self
                    .presentation
                    .apply(presentation::ThemeChoice { appearance, id })?;
                self.presentation_outcome(update)
            }
            KernelOp::ThemeRevert => {
                let update = self
                    .presentation
                    .apply(presentation::ThemeChoice::default())?;
                self.presentation_outcome(update)
            }
            KernelOp::ThemeRemove { id } => {
                let update = self.presentation.remove(&id)?;
                self.presentation_outcome(update)
            }
            KernelOp::NaraDecisionRecord { decision } => {
                let changed = self.presentation.record_decision(decision.clone())?;
                let receipts = if changed {
                    vec![self.log.record(KernelEvent::NaraDecisionRecorded {
                        decision: decision.clone(),
                    })]
                } else {
                    vec![]
                };
                Ok(KernelOpOutcome {
                    receipts,
                    result: KernelOpResult::NaraDecisionRecorded { decision },
                })
            }
            KernelOp::NativeExpression { request } => {
                let data = match request {
                    native_expression::Request::RetainSelectedSceneSource { request } => {
                        return self.native_selected_scene_source_retain(request)
                    }
                    native_expression::Request::RecoverSelectedSceneSource { request } => {
                        self.native_selected_scene_source_recover(request)?
                    }
                    native_expression::Request::OpenSelectedScene { request } => {
                        self.native_selected_scene_open(request)?
                    }
                    native_expression::Request::RecoverSelectedScene { request } => {
                        self.recover_native_selected_scene_open(request)?
                    }
                    native_expression::Request::AbandonSelectedScene { request } => {
                        self.abandon_native_selected_scene_open(request)?
                    }
                    native_expression::Request::ProceduralStageLibrary { .. } => {
                        return Err("Stage Library production requires native prepare/execute/finish outside the mutation lock".into());
                    }
                    native_expression::Request::ProceduralStageLibraryRetry { request } => {
                        match self.native_stage_library_retry(request.clone()) {
                            Ok(data) => data,
                            Err(reason) => {
                                native_expression::procedural::stage_library::known_refusal(
                                    &request, reason,
                                )?
                            }
                        }
                    }
                    native_expression::Request::ProceduralStageCapability { request } => {
                        self.native_stage_capability(request)?
                    }
                    native_expression::Request::ProceduralConduct { request } => {
                        self.native_procedural_conduct(request)?
                    }
                    native_expression::Request::ProceduralSourceBootstrapRetry { request } => {
                        self.native_procedural_source_bootstrap_retry(request)?
                    }
                    request => self.native_expression.apply(&self.client, request)?,
                };
                Ok(KernelOpOutcome {
                    receipts: Vec::new(),
                    result: KernelOpResult::NativeExpression { data },
                })
            }
            op @ KernelOp::NaraVoice { .. } => self
                .prepare_nara_voice(&op)?
                .ok_or("Native voice preparation unavailable")?
                .execute(),
            op @ KernelOp::NaraDialogue { .. } => self
                .prepare_nara_dialogue(&op)?
                .ok_or("Native dialogue preparation unavailable")?
                .execute(),
            KernelOp::NaraCoordinate { request } => nara_coordinate::execute(request),
            op @ KernelOp::NaraEpii { .. } => {
                let result = self
                    .prepare_nara_epii(&op)?
                    .ok_or("Native Epii preparation unavailable")?
                    .execute()?;
                self.finish_nara_epii(result)
            }
            op @ KernelOp::NaraExpressiveAct { .. } => {
                let result = self
                    .prepare_nara_expressive_act(&op)?
                    .ok_or("Native act preparation unavailable")?
                    .execute()?;
                self.finish_nara_expressive_act(result)
            }
            op @ KernelOp::NaraPresence { .. } => {
                let completed = self
                    .prepare_nara_presence(&op)?
                    .ok_or("Native presence preparation unavailable")?
                    .execute()?;
                self.finish_nara_presence(completed)
            }
            op @ KernelOp::M3Reception { .. } => {
                let completed = self
                    .prepare_m3_reception(&op)?
                    .ok_or("Native M3 preparation unavailable")?
                    .execute()?;
                self.finish_m3_reception(completed)
            }
            op @ KernelOp::NaraCurrent { .. } => {
                let completed = self
                    .prepare_nara_current(&op)?
                    .ok_or("Native personal current preparation unavailable")?
                    .execute()?;
                self.finish_nara_current(completed)
            }
            KernelOp::NaraIdentity { request } => {
                let data = nara_identity::apply(&self.client, request)?;
                Ok(KernelOpOutcome {
                    receipts: Vec::new(),
                    result: KernelOpResult::NaraIdentity { data },
                })
            }
            KernelOp::ExpressionRecovery { request } => expression_recovery::execute(request),
            KernelOp::HostedNative {
                source_world_ref,
                request,
            } => {
                if !native_owner_transport::admitted(&request) {
                    return Err("This hosted route admits only native document, Expression and session operations".into());
                }
                let local = std::env::var("OI_SHARED_FIELD_LOCAL_WORLD_REF").map_err(|_| {
                    "No hosted World address is bound to this native owner".to_owned()
                })?;
                if source_world_ref != local {
                    return native_owner_transport::remote(&source_world_ref, &request);
                }
                self.apply(*request)
            }
            KernelOp::Expression { request } => {
                let selection_only = matches!(&request, expression::Request::Edit { changes, .. }
                    if !changes.is_empty() && changes.iter().all(|change| matches!(change,
                        expression::Change::Focus { .. } | expression::Change::RelationFocus { .. })));
                let profile_dependents = match &request {
                    expression::Request::ProfileDefine { profile, .. } => {
                        self.expressions.profile_definition_dependents(profile)
                    }
                    _ => Vec::new(),
                };
                let focus_ref = match &request {
                    expression::Request::Edit {
                        expression_ref,
                        changes,
                        ..
                    } if changes.iter().any(|c| {
                        matches!(
                            c,
                            expression::Change::Focus { .. }
                                | expression::Change::RelationFocus { .. }
                        )
                    }) =>
                    {
                        Some(expression_ref.clone())
                    }
                    _ => None,
                };
                let closed_ref = match &request {
                    expression::Request::Close { expression_ref, .. } => {
                        Some(expression_ref.clone())
                    }
                    _ => None,
                };
                let (data, changed) =
                    self.apply_native_expression_with_procedural_attribution(request)?;
                if data["state"] == "closed" {
                    if let Some(reference) = closed_ref {
                        self.nara_contexts.retain(|_, entry| {
                            entry
                                .checkpoint
                                .as_ref()
                                .is_none_or(|checkpoint| checkpoint.expression_ref() != reference)
                                && entry
                                    .personal_current
                                    .as_ref()
                                    .is_none_or(|pin| pin.expression_ref() != reference)
                                && entry
                                    .m3
                                    .as_ref()
                                    .is_none_or(|state| state.expression_ref() != reference)
                        });
                    }
                }
                for expression_ref in profile_dependents {
                    self.nara_voice.invalidate_expression(&expression_ref);
                    for entry in self.nara_contexts.values_mut() {
                        if entry
                            .m3
                            .as_ref()
                            .is_some_and(|state| state.expression_ref() == expression_ref)
                        {
                            entry.m3 = None;
                        }
                    }
                }
                let mut receipts = Vec::new();
                if let Some(change) = changed {
                    if !selection_only {
                        for entry in self.nara_contexts.values_mut() {
                            if entry.m3.as_ref().is_some_and(|state| {
                                state.expression_ref() == change.expression_ref
                            }) {
                                entry.m3 = None;
                            }
                        }
                    }
                    self.nara_voice
                        .invalidate_expression(&change.expression_ref);
                    receipts.push(self.log.record(KernelEvent::ExpressionChanged {
                        expression_ref: change.expression_ref,
                        revision: change.revision,
                        actor: change.actor,
                        activity_ref: change.activity_ref,
                    }));
                }
                if data["persisted"] == true && data["data"]["changed"] == true {
                    if let Some(path) = data["file"]["location"]["path"]
                        .as_str()
                        .or_else(|| data["data"]["location"]["path"].as_str())
                    {
                        self.reads
                            .invalidate(&format!("dir:{}", files::parent_path(path)));
                        receipts.push(self.log.record(KernelEvent::FileChanged {
                            path: path.into(),
                            summary: "Saved an Expression through its native file owner.".into(),
                        }));
                    }
                }
                if data["state"] == "ready" {
                    if let Some(expression_ref) = focus_ref.as_deref() {
                        if let Some(subject) = self.expressions.selected_subject(expression_ref) {
                            let before = self.focus.clone();
                            self.focus
                                .focus_subject(subject.clone())
                                .map_err(|e| e.to_string())?;
                            if before != self.focus {
                                receipts.push(self.log.record(KernelEvent::FocusChanged {
                                    focus: self.focus.clone(),
                                }));
                            }
                            // --- expression_world (ES1/ES4, lane aikit/es-one-state-relation):
                            // an Expression focus edit IS the shared selection relation
                            // moving. The graph, Wiki and constellation presentations
                            // read and write this same deictic context over the exact
                            // same native ref (one canonical bounded selection state;
                            // every depth is a presentation over it). No separate
                            // event: the move already emitted FocusChanged when the
                            // relation changed, and `selection_read` is the pull.
                            self.world
                                .record_expression_selection(expression_ref, &subject);
                        }
                    }
                }
                Ok(KernelOpOutcome {
                    receipts,
                    result: KernelOpResult::Expression { data },
                })
            }
            KernelOp::MaterialRead { target } => {
                native_owner_reading("workcell", material::Client::discover().read(&target))
            }
            KernelOp::FactoryBuildSnapshot {
                project,
                state_path,
                project_ref,
                run_ref,
            } => {
                if let Some(project) = &project {
                    let root = self.world_map(false).map_err(|e| e.to_string())?;
                    root["work"]["projects"]
                        .as_array()
                        .and_then(|rows| {
                            rows.iter()
                                .find(|r| r["name"].as_str() == Some(project.as_str()))
                        })
                        .ok_or("Project is outside Central's disclosed ground")?;
                }
                let direct = std::env::var_os("OI_FACTORY_BIN").map(std::path::PathBuf::from);
                let (executable, suite_route) = match direct {
                    Some(path) => (path, false),
                    None => (
                        std::env::var_os("OI_BIN")
                            .map(std::path::PathBuf::from)
                            .unwrap_or_else(|| std::path::PathBuf::from("oi")),
                        true,
                    ),
                };
                let data = factory::Client::with(executable)
                    .build_snapshot(&state_path, &project_ref, &run_ref, suite_route)
                    .map_err(|e| {
                        serde_json::to_string(&e)
                            .unwrap_or_else(|_| "factory build snapshot failed".into())
                    })?;
                Ok(KernelOpOutcome {
                    receipts: Vec::new(),
                    result: KernelOpResult::FactoryDevelopmentReading { data },
                })
            }
            KernelOp::FactoryDevelopmentRead {
                project,
                state_path,
                read,
                subject,
            } => {
                if let Some(project) = &project {
                    let root = self.world_map(false).map_err(|e| e.to_string())?;
                    root["work"]["projects"]
                        .as_array()
                        .and_then(|rows| {
                            rows.iter()
                                .find(|r| r["name"].as_str() == Some(project.as_str()))
                        })
                        .ok_or("Project is outside Central's disclosed ground")?;
                }
                // The allowlist holds on this path too: the dispatch arm builds
                // the owner grammar itself, so it must not bypass the list the
                // client enforces.
                if !factory::is_development_read(&read) {
                    return Err(format!("Unsupported Factory development read ({read})"));
                }
                let direct = std::env::var_os("OI_FACTORY_BIN").map(std::path::PathBuf::from);
                let (executable, suite_route) = match direct {
                    Some(path) => (path, false),
                    None => (
                        std::env::var_os("OI_BIN")
                            .map(std::path::PathBuf::from)
                            .unwrap_or_else(|| std::path::PathBuf::from("oi")),
                        true,
                    ),
                };
                let args = factory::development_read_args(
                    &state_path,
                    &read,
                    subject.as_deref(),
                    suite_route,
                );
                let data = material::invoke(&executable, &args, None).map_err(|e| {
                    serde_json::to_string(&e)
                        .unwrap_or_else(|_| "factory development read failed".into())
                })?;
                Ok(KernelOpOutcome {
                    receipts: Vec::new(),
                    result: KernelOpResult::FactoryDevelopmentReading { data },
                })
            }
            KernelOp::FactoryAttemptRead {
                state_path,
                run_ref,
            } => {
                let direct = std::env::var_os("OI_FACTORY_BIN").map(std::path::PathBuf::from);
                let (executable, suite_route) = match direct {
                    Some(path) => (path, false),
                    None => (
                        std::env::var_os("OI_BIN")
                            .map(std::path::PathBuf::from)
                            .unwrap_or_else(|| std::path::PathBuf::from("oi")),
                        true,
                    ),
                };
                let mut args: Vec<std::ffi::OsString> = Vec::new();
                if suite_route {
                    args.push("factory".into());
                }
                args.extend([
                    "attempt".into(),
                    "read".into(),
                    state_path.as_os_str().to_string_lossy().into_owned().into(),
                    run_ref.into(),
                    "--json".into(),
                ]);
                let data = material::invoke(&executable, &args, None).map_err(|e| {
                    serde_json::to_string(&e)
                        .unwrap_or_else(|_| "factory attempt read failed".into())
                })?;
                if data.get("contract").and_then(serde_json::Value::as_str)
                    != Some("factory.attempt-reading/v1")
                {
                    return Err("Factory returned incompatible attempt reading".into());
                }
                Ok(KernelOpOutcome {
                    receipts: Vec::new(),
                    result: KernelOpResult::FactoryAttemptReading { data },
                })
            }
            KernelOp::FactoryOwner { request } => {
                let world = if request.needs_world() {
                    Some(self.world_map(false)?)
                } else {
                    None
                };
                let data = factory::owner(request, world.as_ref()).map_err(|e| {
                    serde_json::to_string(&e)
                        .unwrap_or_else(|_| "factory owner request failed".into())
                })?;
                Ok(KernelOpOutcome {
                    receipts: Vec::new(),
                    result: KernelOpResult::FactoryDevelopmentReading { data },
                })
            }
            KernelOp::FactoryAttemptTaskListRead {
                state_path,
                run_ref,
            } => {
                let direct = std::env::var_os("OI_FACTORY_BIN").map(std::path::PathBuf::from);
                let (executable, suite_route) = match direct {
                    Some(path) => (path, false),
                    None => (
                        std::env::var_os("OI_BIN")
                            .map(std::path::PathBuf::from)
                            .unwrap_or_else(|| std::path::PathBuf::from("oi")),
                        true,
                    ),
                };
                let mut args: Vec<std::ffi::OsString> = Vec::new();
                if suite_route {
                    args.push("factory".into());
                }
                args.extend([
                    "attempt".into(),
                    "list".into(),
                    state_path.as_os_str().to_string_lossy().into_owned().into(),
                    run_ref.into(),
                    "--json".into(),
                ]);
                let data = material::invoke(&executable, &args, None).map_err(|e| {
                    serde_json::to_string(&e)
                        .unwrap_or_else(|_| "factory attempt list failed".into())
                })?;
                if data.get("contract").and_then(serde_json::Value::as_str)
                    != Some("factory.attempt-task-list-reading/v1")
                {
                    return Err("Factory returned incompatible attempt-task list reading".into());
                }
                Ok(KernelOpOutcome {
                    receipts: Vec::new(),
                    result: KernelOpResult::FactoryAttemptTaskListReading { data },
                })
            }
            KernelOp::FactoryAttemptTaskRead {
                state_path,
                run_ref,
                task_ref,
                limit,
                cursor,
            } => {
                let direct = std::env::var_os("OI_FACTORY_BIN").map(std::path::PathBuf::from);
                let (executable, suite_route) = match direct {
                    Some(path) => (path, false),
                    None => (
                        std::env::var_os("OI_BIN")
                            .map(std::path::PathBuf::from)
                            .unwrap_or_else(|| std::path::PathBuf::from("oi")),
                        true,
                    ),
                };
                let mut args: Vec<std::ffi::OsString> = Vec::new();
                if suite_route {
                    args.push("factory".into());
                }
                args.extend([
                    "attempt".into(),
                    "task".into(),
                    state_path.as_os_str().to_string_lossy().into_owned().into(),
                    run_ref.into(),
                    task_ref.into(),
                    "--json".into(),
                ]);
                if let Some(limit) = limit {
                    args.push("--limit".into());
                    args.push(limit.to_string().into());
                }
                if let Some(cursor) = cursor {
                    args.push("--cursor".into());
                    args.push(
                        serde_json::to_string(&cursor)
                            .map_err(|e| e.to_string())?
                            .into(),
                    );
                }
                let data = material::invoke(&executable, &args, None).map_err(|e| {
                    serde_json::to_string(&e)
                        .unwrap_or_else(|_| "factory attempt task failed".into())
                })?;
                if data.get("contract").and_then(serde_json::Value::as_str)
                    != Some("factory.attempt-task-reading/v1")
                {
                    return Err("Factory returned incompatible attempt-task reading".into());
                }
                Ok(KernelOpOutcome {
                    receipts: Vec::new(),
                    result: KernelOpResult::FactoryAttemptTaskReading { data },
                })
            }
            KernelOp::InhabitationRead { request } => {
                // The scope's ground comes from Central's own disclosure: a
                // project's working directory and canonical ProjectRef, or the
                // Central root for a root-scope read (best effort — AIKit
                // resolves its own root when Central's world is unreadable).
                let ground: Option<(std::path::PathBuf, Option<String>)> = match request.project() {
                    Some(project) => {
                        let (cwd, project_id) = self.project_ground(project)?;
                        Some((cwd, Some(format!("project:{project_id}"))))
                    }
                    None => self
                        .world_map(false)
                        .ok()
                        .and_then(|world| world["root"].as_str().map(std::path::PathBuf::from))
                        .map(|root| (root, None)),
                };
                let (data, warnings) = inhabitation::read(
                    &request,
                    ground
                        .as_ref()
                        .map(|(cwd, world)| (cwd.as_path(), world.as_deref())),
                )
                .map_err(|e| {
                    serde_json::to_string(&e).unwrap_or_else(|_| "inhabitation read failed".into())
                })?;
                Ok(KernelOpOutcome {
                    receipts: Vec::new(),
                    result: KernelOpResult::InhabitationReading { data, warnings },
                })
            }
            KernelOp::WorkcellStatusRead => {
                let workcell = std::env::var_os("OI_WORKCELL_BIN").map(std::path::PathBuf::from);
                let (executable, namespace): (std::path::PathBuf, Option<&str>) = match workcell {
                    Some(path) => (path, None),
                    None => (
                        std::env::var_os("OI_BIN")
                            .map(std::path::PathBuf::from)
                            .unwrap_or_else(|| std::path::PathBuf::from("oi")),
                        Some("workcell"),
                    ),
                };
                let mut args: Vec<std::ffi::OsString> = Vec::new();
                if let Some(name) = namespace {
                    args.push(name.into());
                }
                args.extend(["status".into(), "--json".into()]);
                let data = material::invoke(&executable, &args, None).map_err(|e| {
                    serde_json::to_string(&e)
                        .unwrap_or_else(|_| "workcell status read failed".into())
                })?;
                Ok(KernelOpOutcome {
                    receipts: Vec::new(),
                    result: KernelOpResult::WorkcellStatusReading { data },
                })
            }
            KernelOp::WikiProjectionRead { root, path } => {
                let aikit = std::env::var_os("OI_AIKIT_BIN")
                    .map(std::path::PathBuf::from)
                    .unwrap_or_else(|| std::path::PathBuf::from("aikit"));
                let args: Vec<std::ffi::OsString> = vec![
                    "--json".into(),
                    "-C".into(),
                    root.as_os_str().to_string_lossy().into_owned().into(),
                    "wiki".into(),
                    "projection".into(),
                    "read".into(),
                    "--file".into(),
                    path.into(),
                ];
                let data = material::invoke(&aikit, &args, None).map_err(|e| {
                    serde_json::to_string(&e)
                        .unwrap_or_else(|_| "wiki projection read failed".into())
                })?;
                if data
                    .get("state")
                    .and_then(serde_json::Value::as_str)
                    .is_none()
                    || data.get("projection").is_none()
                {
                    return Err("AIKit returned an incompatible wiki projection reading".into());
                }
                Ok(KernelOpOutcome {
                    receipts: Vec::new(),
                    result: KernelOpResult::WikiProjectionReading { data },
                })
            }
            KernelOp::WikiProjectionSources => {
                let aikit = std::env::var_os("OI_AIKIT_BIN")
                    .map(std::path::PathBuf::from)
                    .unwrap_or_else(|| std::path::PathBuf::from("aikit"));
                let args: Vec<std::ffi::OsString> =
                    vec!["--json".into(), "context".into(), "current".into()];
                let data = material::invoke(&aikit, &args, None).map_err(|e| {
                    serde_json::to_string(&e)
                        .unwrap_or_else(|_| "wiki projection sources read failed".into())
                })?;
                if data.get("continuity").is_none() {
                    return Err("AIKit returned a context reading without continuity".into());
                }
                Ok(KernelOpOutcome {
                    receipts: Vec::new(),
                    result: KernelOpResult::WikiProjectionSourcesReading { data },
                })
            }
            KernelOp::HarnessStatus => {
                // Machine-level read: no project disclosure is consulted —
                // the harnesses are the machine's own facts.
                let data = self.agency.harness_status()?;
                Ok(KernelOpOutcome {
                    receipts: Vec::new(),
                    result: KernelOpResult::HarnessStatusReading { data },
                })
            }
            KernelOp::ModelCatalogue => {
                let data = self.agency.model_catalogue()?;
                Ok(KernelOpOutcome {
                    receipts: Vec::new(),
                    result: KernelOpResult::ModelCatalogueReading { data },
                })
            }
            KernelOp::ChatDefaultRead => {
                let document = chat_defaults::read()?;
                Ok(KernelOpOutcome {
                    receipts: Vec::new(),
                    result: KernelOpResult::ChatDefaultReading { document },
                })
            }
            KernelOp::ChatDefaultHold { provider } => {
                let document = chat_defaults::hold(&provider)?;
                Ok(KernelOpOutcome {
                    receipts: Vec::new(),
                    result: KernelOpResult::ChatDefaultHeld { document },
                })
            }
            KernelOp::ChatDefaultDiscard => {
                let document = chat_defaults::discard()?;
                Ok(KernelOpOutcome {
                    receipts: Vec::new(),
                    result: KernelOpResult::ChatDefaultDiscarded { document },
                })
            }
            KernelOp::CredentialList
            | KernelOp::CredentialDiscover
            | KernelOp::CredentialSetup { .. }
            | KernelOp::CredentialRotate { .. }
            | KernelOp::CredentialVerify { .. }
            | KernelOp::CredentialRevoke { .. }
            | KernelOp::ClientInstall { .. }
            | KernelOp::HarnessAuthDescribe { .. } => {
                let root = self.world_map(false).ok();
                let cwd = root
                    .as_ref()
                    .and_then(|value| value["root"].as_str())
                    .map(std::path::PathBuf::from)
                    .unwrap_or(std::env::current_dir().map_err(|e| e.to_string())?);
                let result = credentials::apply(&cwd, op)?;
                Ok(KernelOpOutcome {
                    receipts: Vec::new(),
                    result,
                })
            }
            KernelOp::ProductActionRun {
                product_id,
                action_ref,
            } => {
                let root = self.world_map(false).ok();
                let cwd = root
                    .as_ref()
                    .and_then(|value| value["root"].as_str())
                    .map(std::path::PathBuf::from)
                    .unwrap_or(std::env::current_dir().map_err(|e| e.to_string())?);
                let data = system_composition::Client::discover().run_action(
                    &cwd,
                    &product_id,
                    &action_ref,
                )?;
                Ok(KernelOpOutcome {
                    receipts: Vec::new(),
                    result: KernelOpResult::ProductActionRan { data },
                })
            }
            KernelOp::SettingsReveal { path } => Ok(KernelOpOutcome {
                receipts: Vec::new(),
                result: KernelOpResult::SettingsRevealed {
                    data: system_composition::reveal(&path)?,
                },
            }),
            KernelOp::Ground { request } => {
                // A ground change re-bases every path the cache holds — but
                // `Status`/`Recognize` are read-only (their own contract
                // rejects a mutated/bound reply), and a status poll runs
                // concurrently with ordinary reads throughout a session.
                // Clearing the whole cache — and every in-flight read
                // ticket — for a read-only ground query supersedes
                // unrelated, unchanged reads on pure coincidence of timing.
                if request.mutates() {
                    self.reads.clear();
                }
                Ok(KernelOpOutcome {
                    receipts: Vec::new(),
                    result: KernelOpResult::GroundReading {
                        reading: ground::operate(request)?,
                    },
                })
            }
            KernelOp::ConfigDesiredHold { request } => {
                let root = self.world_map(false).ok();
                let cwd = root
                    .as_ref()
                    .and_then(|value| value["root"].as_str())
                    .map(std::path::PathBuf::from)
                    .unwrap_or(std::env::current_dir().map_err(|e| e.to_string())?);
                let entry = configuration::Client::discover().desired_hold(&cwd, &request)?;
                let receipt = self.log.record(KernelEvent::ConfigurationChanged {
                    operation: "desired_hold".into(),
                    references: vec![request.setting_ref],
                });
                Ok(KernelOpOutcome {
                    receipts: vec![receipt],
                    result: KernelOpResult::ConfigDesiredHeld { entry },
                })
            }
            KernelOp::ConfigDesiredDiscard { setting_ref, scope } => {
                let root = self.world_map(false).ok();
                let cwd = root
                    .as_ref()
                    .and_then(|value| value["root"].as_str())
                    .map(std::path::PathBuf::from)
                    .unwrap_or(std::env::current_dir().map_err(|e| e.to_string())?);
                let document = configuration::Client::discover().desired_discard(
                    &cwd,
                    &configuration::ConfigPair {
                        setting_ref: setting_ref.clone(),
                        scope,
                    },
                )?;
                let receipts = if document["removed"].as_bool() == Some(true) {
                    vec![self.log.record(KernelEvent::ConfigurationChanged {
                        operation: "desired_discard".into(),
                        references: vec![setting_ref],
                    })]
                } else {
                    vec![]
                };
                Ok(KernelOpOutcome {
                    receipts,
                    result: KernelOpResult::ConfigDesiredDiscarded { document },
                })
            }
            KernelOp::ConfigPlan { requests } => {
                let root = self.world_map(false).ok();
                let cwd = root
                    .as_ref()
                    .and_then(|value| value["root"].as_str())
                    .map(std::path::PathBuf::from)
                    .unwrap_or(std::env::current_dir().map_err(|e| e.to_string())?);
                let (plans, errors) = configuration::Client::discover().plan(&cwd, &requests);
                Ok(KernelOpOutcome {
                    receipts: Vec::new(),
                    result: KernelOpResult::ConfigPlanned { plans, errors },
                })
            }
            KernelOp::Setup { request } => {
                // First installation must work before Central/root discovery.
                let cwd = std::env::current_dir().map_err(|e| e.to_string())?;
                let data = setup::Client::discover().request(&cwd, &request)?;
                Ok(KernelOpOutcome {
                    receipts: Vec::new(),
                    result: KernelOpResult::SetupReading { data },
                })
            }
            KernelOp::ConfigApply { requests } => {
                let root = self.world_map(false).ok();
                let cwd = root
                    .as_ref()
                    .and_then(|value| value["root"].as_str())
                    .map(std::path::PathBuf::from)
                    .unwrap_or(std::env::current_dir().map_err(|e| e.to_string())?);
                let (changeset, owner_receipts) =
                    configuration::Client::discover().apply(&cwd, &requests)?;
                let receipt = self.log.record(KernelEvent::ConfigurationChanged {
                    operation: "apply_completed".into(),
                    references: requests.iter().map(|r| r.setting_ref.clone()).collect(),
                });
                Ok(KernelOpOutcome {
                    receipts: vec![receipt],
                    result: KernelOpResult::ConfigApplied {
                        changeset,
                        owner_receipts,
                    },
                })
            }
            KernelOp::ProfileList => {
                let root = self.world_map(false).ok();
                let cwd = root
                    .as_ref()
                    .and_then(|value| value["root"].as_str())
                    .map(std::path::PathBuf::from)
                    .unwrap_or(std::env::current_dir().map_err(|e| e.to_string())?);
                let listing = configuration::Client::discover().profile_list(&cwd)?;
                Ok(KernelOpOutcome {
                    receipts: Vec::new(),
                    result: KernelOpResult::ProfileListing {
                        active_profile_ref: listing.active_profile_ref,
                        profiles: listing.profiles,
                        degraded: listing.degraded,
                    },
                })
            }
            KernelOp::ProfileRead { profile_ref } => {
                let root = self.world_map(false).ok();
                let cwd = root
                    .as_ref()
                    .and_then(|value| value["root"].as_str())
                    .map(std::path::PathBuf::from)
                    .unwrap_or(std::env::current_dir().map_err(|e| e.to_string())?);
                let profile = configuration::Client::discover().profile_read(&cwd, &profile_ref)?;
                Ok(KernelOpOutcome {
                    receipts: Vec::new(),
                    result: KernelOpResult::ProfileReading { profile },
                })
            }
            KernelOp::ProfileUsePlan { profile_ref } => {
                let root = self.world_map(false).ok();
                let cwd = root
                    .as_ref()
                    .and_then(|value| value["root"].as_str())
                    .map(std::path::PathBuf::from)
                    .unwrap_or(std::env::current_dir().map_err(|e| e.to_string())?);
                let plan =
                    configuration::Client::discover().profile_use_plan(&cwd, &profile_ref)?;
                Ok(KernelOpOutcome {
                    receipts: Vec::new(),
                    result: KernelOpResult::ProfileUsePlanning { plan },
                })
            }
            KernelOp::ProfileUseApply { profile_ref } => {
                let root = self.world_map(false).ok();
                let cwd = root
                    .as_ref()
                    .and_then(|value| value["root"].as_str())
                    .map(std::path::PathBuf::from)
                    .unwrap_or(std::env::current_dir().map_err(|e| e.to_string())?);
                let activation =
                    configuration::Client::discover().profile_use_apply(&cwd, &profile_ref)?;
                Ok(KernelOpOutcome {
                    receipts: Vec::new(),
                    result: KernelOpResult::ProfileUsed { activation },
                })
            }
            KernelOp::ProfileCreate { profile_ref, title } => {
                let root = self.world_map(false).ok();
                let cwd = root
                    .as_ref()
                    .and_then(|value| value["root"].as_str())
                    .map(std::path::PathBuf::from)
                    .unwrap_or(std::env::current_dir().map_err(|e| e.to_string())?);
                let profile = configuration::Client::discover().profile_create(
                    &cwd,
                    &profile_ref,
                    title.as_deref(),
                )?;
                Ok(KernelOpOutcome {
                    receipts: Vec::new(),
                    result: KernelOpResult::ProfileCreated { profile },
                })
            }
            KernelOp::ProfileEdit {
                profile_ref,
                operations,
            } => {
                let root = self.world_map(false).ok();
                let cwd = root
                    .as_ref()
                    .and_then(|value| value["root"].as_str())
                    .map(std::path::PathBuf::from)
                    .unwrap_or(std::env::current_dir().map_err(|e| e.to_string())?);
                let document = configuration::Client::discover().profile_edit(
                    &cwd,
                    &profile_ref,
                    &operations,
                )?;
                Ok(KernelOpOutcome {
                    receipts: Vec::new(),
                    result: KernelOpResult::ProfileEdited { document },
                })
            }
            KernelOp::ConfigReceipts => {
                let root = self.world_map(false).ok();
                let cwd = root
                    .as_ref()
                    .and_then(|value| value["root"].as_str())
                    .map(std::path::PathBuf::from)
                    .unwrap_or(std::env::current_dir().map_err(|e| e.to_string())?);
                let document = configuration::Client::discover().config_receipts(&cwd)?;
                Ok(KernelOpOutcome {
                    receipts: Vec::new(),
                    result: KernelOpResult::ConfigReceipts { document },
                })
            }
            KernelOp::FileOperation { location, request } => {
                let data = files::operate(&self.client, &location, &request)?;
                // A write changed what a directory contains; the parent
                // listing is the one cached reading it invalidates by name.
                if matches!(
                    request,
                    files::Request::Write { .. } | files::Request::Restore { .. }
                ) {
                    self.reads
                        .invalidate(&format!("dir:{}", files::parent_path(&location.path)));
                    self.reads.invalidate_prefix("knowledge:");
                    self.reads.invalidate_prefix("graph:");
                }
                // One state change, one event (the seam's law): a write or
                // restore the owner actually recorded (`created`/`written`)
                // discloses FileChanged so retained listings — the file
                // tree's workspace-keyed cache — invalidate by receipt, the
                // same "look again" relation the expressions surfaces keep
                // with `expression_changed`. An unchanged write mutated
                // nothing and emits nothing.
                let receipt = matches!(
                    request,
                    files::Request::Write { .. } | files::Request::Restore { .. }
                )
                .then(|| match data["outcome"].as_str() {
                    Some("created") => Some(self.log.record(KernelEvent::FileChanged {
                        path: location.path.clone(),
                        summary: "A file was created through the owner's write.".into(),
                    })),
                    Some("written") => Some(self.log.record(KernelEvent::FileChanged {
                        path: location.path.clone(),
                        summary: "A file changed through the owner's write.".into(),
                    })),
                    _ => None,
                })
                .flatten();
                Ok(KernelOpOutcome {
                    receipts: receipt.into_iter().collect(),
                    result: KernelOpResult::FileOperation { data },
                })
            }
            KernelOp::FileResolve { reference } => Ok(KernelOpOutcome {
                receipts: Vec::new(),
                result: KernelOpResult::FileResolved {
                    location: files::resolve(&self.client, &reference)?,
                },
            }),
            KernelOp::FilesList { path, fresh } => Ok(KernelOpOutcome {
                receipts: Vec::new(),
                result: KernelOpResult::DirectoryRead {
                    directory: self.directory_listing(&path, fresh.unwrap_or(false))?,
                },
            }),
            KernelOp::FileRead { location } => {
                let reading = match self.retained_files.read(&self.client, &location) {
                    Ok(reading) => reading,
                    Err(error) => {
                        self.file_refs.remove(&location.ref_id);
                        return Err(error);
                    }
                };
                let project = reading
                    .project
                    .as_ref()
                    .and_then(|p| p.project_ref.as_ref())
                    .map(|id| {
                        focus::ProjectRef::try_from(owner_relation(
                            id,
                            "project",
                            "central.files.read",
                        ))
                    })
                    .transpose()
                    .map_err(|e| e.to_string())?;
                self.file_refs.insert(
                    reading.location.ref_id.clone(),
                    (
                        owner_relation(&reading.location.ref_id, "file", "central.files.read"),
                        project,
                    ),
                );
                Ok(KernelOpOutcome {
                    receipts: Vec::new(),
                    result: KernelOpResult::FileRead { reading },
                })
            }
            KernelOp::FileBytes { location } => {
                let reading = match files::read_bytes(&self.client, &location) {
                    Ok(reading) => reading,
                    Err(error) => {
                        self.file_refs.remove(&location.ref_id);
                        return Err(error);
                    }
                };
                // FND-04: a binary material file (image/pdf/unsupported) is
                // opened as a surface through this op, never `FileRead` — the
                // `SurfaceOpen` gate ("File must be read successfully
                // through Central before opening its surface") checks
                // `file_refs` regardless of which read resolved the ref, so
                // this registration is required exactly as `FileRead`'s is.
                let project = reading
                    .project
                    .as_ref()
                    .and_then(|p| p.project_ref.as_ref())
                    .map(|id| {
                        focus::ProjectRef::try_from(owner_relation(
                            id,
                            "project",
                            "central.files.read",
                        ))
                    })
                    .transpose()
                    .map_err(|e| e.to_string())?;
                self.file_refs.insert(
                    reading.location.ref_id.clone(),
                    (
                        owner_relation(&reading.location.ref_id, "file", "central.files.read"),
                        project,
                    ),
                );
                Ok(KernelOpOutcome {
                    receipts: Vec::new(),
                    result: KernelOpResult::FileBytes {
                        location: reading.location,
                        revision: reading.revision,
                        byte_len: reading.byte_len,
                        mime_hint: reading.mime_hint,
                        content_base64: reading.content_base64,
                        source: reading.source,
                    },
                })
            }
            KernelOp::AgentDefinition { project, request } => {
                if project.as_deref() == Some("") {
                    return Err(
                        "Use explicit null for the Central root Agent definition scope".into(),
                    );
                }
                let cwd = self.agent_location(project.as_deref())?;
                let data = agent_definition::execute(
                    &self.client,
                    &self.agency,
                    project.as_deref(),
                    &cwd,
                    &request,
                )?;
                Ok(KernelOpOutcome {
                    receipts: Vec::new(),
                    result: KernelOpResult::AgentDefinitionReading { data },
                })
            }
            KernelOp::AgentCard {
                agent_ref,
                world_ref,
            } => {
                let data = agent_card::read(
                    &agent_card::oi_executable(),
                    &agent_ref,
                    world_ref.as_deref(),
                )?;
                Ok(KernelOpOutcome {
                    receipts: Vec::new(),
                    result: KernelOpResult::AgentCardReading { data },
                })
            }
            KernelOp::Encounter { project, request } => {
                let cwd = self.agent_location((!project.is_empty()).then_some(project.as_str()))?;
                let owned_ref = self.agent_project_ref(&project, &cwd)?;
                let project_ref = owned_ref.as_str();
                let data = self.agency.encounter(&cwd, project_ref, &request)?;
                if let agency::EncounterRequest::Read { agent_session, .. } = &request {
                    if data["agent_session"].as_str() != Some(agent_session) {
                        return Err("AIKit encounter reading identity mismatch".into());
                    }
                    let project = focus::ProjectRef::try_from(owner_relation(
                        project_ref,
                        "project",
                        "projectcentral.inspect",
                    ))
                    .map_err(|e| e.to_string())?;
                    self.encounter_refs.insert(
                        agent_session.clone(),
                        (
                            SemanticRef {
                                ref_id: agent_session.clone(),
                                kind: "agent-session".into(),
                                native_owner: "ai-kit".into(),
                                provenance: refs::RefProvenance {
                                    source: "aikit.encounter.read".into(),
                                    revision: None,
                                },
                            },
                            project,
                        ),
                    );
                }
                Ok(KernelOpOutcome {
                    receipts: Vec::new(),
                    result: KernelOpResult::EncounterReading { data },
                })
            }
            KernelOp::EncounterProvision {
                project,
                preferred_body_ref,
            } => {
                // The same disclosure gate as every project-scoped op: the
                // project must be inside Central's disclosed ground, and the
                // canonical ProjectRef is Central's own, never the caller's.
                let (cwd, project_ref) = self.project_ground(&project)?;
                let data =
                    self.agency
                        .provision(&cwd, &project_ref, preferred_body_ref.as_deref())?;
                Ok(KernelOpOutcome {
                    receipts: Vec::new(),
                    result: KernelOpResult::EncounterProvisioned { data },
                })
            }
            KernelOp::FlowParticipantProvision {
                project,
                agent_ref,
                flow_ref,
                sender,
                preferred_body_ref,
            } => {
                let (cwd, project_ref) = self.project_ground(&project)?;
                let data = self.agency.provision_flow_participant(
                    &cwd,
                    &project_ref,
                    &agent_ref,
                    preferred_body_ref.as_deref(),
                    &sender,
                    &flow_ref,
                )?;
                Ok(KernelOpOutcome {
                    receipts: Vec::new(),
                    result: KernelOpResult::EncounterProvisioned { data },
                })
            }
            KernelOp::BeingEncounter { request } => Ok(KernelOpOutcome {
                receipts: Vec::new(),
                result: KernelOpResult::BeingEncounter {
                    data: being::apply(request),
                },
            }),
            KernelOp::WorkingSurfaceRead {
                project,
                agent_session,
                binding,
            } => {
                let cwd = self.agent_location((!project.is_empty()).then_some(project.as_str()))?;
                let project_ref = self.agent_project_ref(&project, &cwd)?;
                let document = working_surface::read(
                    &self.agency,
                    &cwd,
                    &project_ref,
                    &agent_session,
                    binding.as_deref(),
                    false,
                )?;
                Ok(KernelOpOutcome {
                    receipts: vec![],
                    result: KernelOpResult::WorkingSurfaceReading { document },
                })
            }
            KernelOp::WorkingSurfaceAttachment {
                project,
                agent_session,
                binding,
            } => {
                let cwd = self.agent_location((!project.is_empty()).then_some(project.as_str()))?;
                let project_ref = self.agent_project_ref(&project, &cwd)?;
                let document = working_surface::read(
                    &self.agency,
                    &cwd,
                    &project_ref,
                    &agent_session,
                    Some(&binding),
                    true,
                )?;
                Ok(KernelOpOutcome {
                    receipts: vec![],
                    result: KernelOpResult::WorkingSurfaceReading { document },
                })
            }
            KernelOp::RecordingCapabilityRead => Ok(KernelOpOutcome {
                receipts: vec![],
                result: KernelOpResult::RecordingCapability {
                    document: working_surface::recording_capability(),
                },
            }),
            KernelOp::AgencyRead { project } => {
                let cwd = self.agent_location((!project.is_empty()).then_some(project.as_str()))?;
                let project_ref = self.agent_project_ref(&project, &cwd)?;
                // The spaces reading spawns the AIKit owner (~100 ms); the
                // disclosure re-reads it on every branch expansion, so the
                // short horizon serves the repeat. A fresh stamp is minted
                // for every answer, cached or not.
                let cache_key = format!("agency:{}:{project_ref}", cwd.display());
                let spaces =
                    if let Some(value) = self.reads.get(&cache_key, read_cache::HORIZON_TTL) {
                        value
                    } else {
                        let spaces = self.agency.read_project(&cwd, &project_ref)?;
                        self.reads.put(cache_key, spaces.clone());
                        spaces
                    };
                let disclosure_key = format!("harness-disclosure:{}", cwd.display());
                let harness_disclosure = if let Some(value) =
                    self.reads.get(&disclosure_key, read_cache::HORIZON_TTL)
                {
                    value
                } else {
                    let value = match self.agency.harness_disclosure(&cwd) {
                        Ok(value) => value,
                        Err(reason) => serde_json::json!({"state":"unavailable","reason":reason}),
                    };
                    self.reads.put(disclosure_key, value.clone());
                    value
                };
                let observed_at_unix_ms = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .map(|d| d.as_millis() as u64)
                    .unwrap_or(0);
                Ok(KernelOpOutcome {
                    receipts: Vec::new(),
                    result: KernelOpResult::AgencyReading {
                        project_ref,
                        spaces,
                        harness_disclosure,
                        observed_at_unix_ms,
                    },
                })
            }
            KernelOp::ModelRoster { project } => {
                let cwd =
                    self.agent_location(project.as_deref().filter(|value| !value.is_empty()))?;
                let key = format!("model-roster:{}", cwd.display());
                let reading = if let Some(value) = self.reads.get(&key, read_cache::HORIZON_TTL) {
                    value
                } else {
                    let value = self.agency.model_roster(&cwd)?;
                    self.reads.put(key, value.clone());
                    value
                };
                Ok(KernelOpOutcome {
                    receipts: Vec::new(),
                    result: KernelOpResult::ModelRosterReading { reading },
                })
            }
            KernelOp::Receiving { project, request } => {
                // Same disclosure gate as every project-scoped read: a named
                // project must be inside Central's disclosed ground. `None`
                // is the root register's own field — a Day document lives
                // there, and its receiving field is the root's.
                if let Some(project) = &project {
                    let root = self.world_map(false).map_err(|e| e.to_string())?;
                    root["work"]["projects"]
                        .as_array()
                        .and_then(|rows| {
                            rows.iter()
                                .find(|r| r["name"].as_str() == Some(project.as_str()))
                        })
                        .ok_or("Project is outside Central's disclosed ground")?;
                }
                let data = self
                    .client
                    .receiving(project.as_deref(), &request)
                    .map_err(|e| e.to_string())?;
                Ok(KernelOpOutcome {
                    receipts: Vec::new(),
                    result: KernelOpResult::ReceivingReading { data },
                })
            }
            KernelOp::Now { project, request } => {
                // Same disclosure gate as `Receiving`: a named project must be
                // inside Central's disclosed ground; `None` is the root
                // register, carried as an explicit null to the owner.
                if let Some(project) = &project {
                    let root = self.world_map(false).map_err(|e| e.to_string())?;
                    root["work"]["projects"]
                        .as_array()
                        .and_then(|rows| {
                            rows.iter()
                                .find(|r| r["name"].as_str() == Some(project.as_str()))
                        })
                        .ok_or("Project is outside Central's disclosed ground")?;
                }
                let data = self
                    .client
                    .now(project.as_deref(), &request)
                    .map_err(|e| e.to_string())?;
                Ok(KernelOpOutcome {
                    receipts: Vec::new(),
                    result: KernelOpResult::NowReading { data },
                })
            }
            KernelOp::EncounterTaskRead {
                project,
                agent_session,
            } => {
                // Use the Encounter's native location law: an empty Project
                // label selects the actual root; a named Project still passes
                // the disclosure gate. A root task reading may lawfully be null.
                let cwd = self.agent_location((!project.is_empty()).then_some(project.as_str()))?;
                let data = self
                    .agency
                    .task_read(&cwd, &agent_session)
                    .map_err(|e| e.to_string())?;
                Ok(KernelOpOutcome {
                    receipts: Vec::new(),
                    result: KernelOpResult::EncounterTaskReading { data },
                })
            }
            KernelOp::DayRead { day_ref } => {
                // The Day is a ROOT-register carrier: an explicit null
                // project is the kernel's own convention for naming the
                // Central root register (absence would take the configured
                // project co-reference, which has no today pointer).
                let mut input = serde_json::Map::new();
                input.insert("project".to_owned(), serde_json::Value::Null);
                if let Some(day_ref) = day_ref {
                    input.insert("day_ref".to_owned(), serde_json::Value::String(day_ref));
                }
                let data = self
                    .client
                    .run("central.day.read", serde_json::Value::Object(input))
                    .map_err(|e| e.to_string())?;
                Ok(KernelOpOutcome {
                    receipts: Vec::new(),
                    result: KernelOpResult::DayReading { data },
                })
            }
            KernelOp::Central { project, request } => {
                let data = central::operate(&self.client, project.as_deref(), &request)?;
                Ok(KernelOpOutcome {
                    receipts: Vec::new(),
                    result: KernelOpResult::CentralReading { data },
                })
            }
            KernelOp::DaySourceOpen { day_ref } => {
                // The owner's Day route is the only reader of a
                // root-register Day source: the buffer is built from
                // `central.day.read`'s own disclosure — its canonical ref,
                // revision and content — never a path-derived ref.
                let mut input = serde_json::Map::new();
                input.insert("project".to_owned(), serde_json::Value::Null);
                if let Some(day_ref) = day_ref {
                    input.insert("day_ref".to_owned(), serde_json::Value::String(day_ref));
                }
                let data = self
                    .client
                    .run("central.day.read", serde_json::Value::Object(input))
                    .map_err(|e| e.to_string())?;
                let source_ref = data["source"]["ref"]
                    .as_str()
                    .ok_or("Central's Day reading disclosed no source ref")?
                    .to_owned();
                let path = data["source"]["path"]
                    .as_str()
                    .ok_or("Central's Day reading disclosed no source path")?
                    .to_owned();
                let revision = data["revision"]["revision"]
                    .as_str()
                    .ok_or("Central's Day reading disclosed no source revision")?
                    .to_owned();
                let content = data["content"]
                    .as_str()
                    .ok_or("Central's Day reading disclosed no content")?
                    .to_owned();
                let buffer = SourceBuffer {
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
                self.buffers.insert(source_ref.clone(), buffer.clone());
                let receipt = self.log.record(KernelEvent::SourceOpened {
                    source: source_semantic_ref(&source_ref, Some(&buffer.base_revision))
                        .unwrap_or_else(|_| fallback_source_ref(&source_ref)),
                    revision: buffer.base_revision.clone(),
                    summary: format!(
                        "Opened from the owner's Day reading at revision {} ({} bytes).",
                        short_revision(&buffer.base_revision),
                        buffer.content.len()
                    ),
                });
                Ok(KernelOpOutcome {
                    receipts: vec![receipt],
                    result: KernelOpResult::SourceOpened { buffer },
                })
            }
            KernelOp::Routine { project, request } => {
                let cwd = self.agent_location(project.as_deref())?;
                let data = routine::call(&cwd, &request)?;
                let receipts = if let Some((action, routine_ref)) = request.mutation() {
                    vec![self.log.record(KernelEvent::RoutineActionReturned {
                        action: action.into(),
                        routine_ref: routine_ref.into(),
                        data: data.clone(),
                    })]
                } else {
                    Vec::new()
                };
                Ok(KernelOpOutcome {
                    receipts,
                    result: KernelOpResult::Routine { data },
                })
            }
            KernelOp::Knowledge {
                project,
                request,
                fresh,
            } => {
                // Central discloses the scope; renderer-supplied filesystem paths
                // and stale persisted authority never become invocation context.
                let root = self.world_map(false).map_err(|e| e.to_string())?;
                let project = if let knowledge::Request::Read { address } = &request {
                    root["work"]["projects"]
                        .as_array()
                        .and_then(|rows| {
                            rows.iter().find(|row| {
                                row["projectcentral"]["agent_wiki"]["wiki"]["space_ref"].as_str()
                                    == Some(address.reference())
                            })
                        })
                        .and_then(|row| row["name"].as_str())
                        .map(str::to_owned)
                        .or(project)
                } else {
                    project
                };
                let base = root["root"]
                    .as_str()
                    .ok_or("Central root location unavailable")?;
                let cwd = if let Some(project) = project.as_ref() {
                    let row = root["work"]["projects"]
                        .as_array()
                        .and_then(|rows| rows.iter().find(|r| r["name"].as_str() == Some(project)))
                        .ok_or("Project is outside Central's disclosed ground")?;
                    std::path::Path::new(base)
                        .join(row["path"].as_str().ok_or("Project location unavailable")?)
                } else {
                    std::path::PathBuf::from(base)
                };
                if let knowledge::Request::Use { address } = &request {
                    if !self.knowledge_refs.contains_key(address.reference()) {
                        return Err(
                            "Read the native subject successfully before recording use".into()
                        );
                    }
                }
                let cacheable = matches!(
                    request,
                    knowledge::Request::Read { .. } | knowledge::Request::Relations { .. }
                );
                let key = format!(
                    "knowledge:{}:{}",
                    cwd.display(),
                    serde_json::to_string(&request).map_err(|e| e.to_string())?
                );
                if fresh {
                    self.reads.invalidate(&key);
                }
                let held = if cacheable && !fresh {
                    self.reads.get(&key, read_cache::KNOWLEDGE_TTL)
                } else {
                    None
                };
                let data = if let Some(value) = held {
                    value
                } else {
                    let value = knowledge::call(&cwd, &request)?;
                    // Transport failures are not native readings. They must
                    // neither become cached truth nor establish resource identity.
                    if value["schema"] == "oi.native-call-failure/v1" {
                        return Ok(KernelOpOutcome {
                            receipts: Vec::new(),
                            result: KernelOpResult::Knowledge { data: value },
                        });
                    }
                    if cacheable {
                        self.reads.put(key, value.clone());
                    }
                    value
                };
                if let knowledge::Request::Read { address } = &request {
                    if data["resource"].as_str() != Some(address.reference()) {
                        return Err(
                            "AIKit reading identity does not match the requested subject".into(),
                        );
                    }
                    let project_ref = if let Some(project) = project.as_ref() {
                        self.client
                            .run(
                                "projectcentral.inspect",
                                serde_json::json!({"project":project}),
                            )
                            .ok()
                            .and_then(|v| v["manifest"]["project_id"].as_str().map(str::to_owned))
                            .map(|r| {
                                focus::ProjectRef::try_from(owner_relation(
                                    &r,
                                    "project",
                                    "projectcentral.inspect",
                                ))
                            })
                            .transpose()
                            .map_err(|e| e.to_string())?
                    } else {
                        None
                    };
                    self.knowledge_projects
                        .insert(address.reference().into(), project_ref);
                    self.knowledge_refs.insert(
                        address.reference().into(),
                        SemanticRef {
                            ref_id: address.reference().into(),
                            kind: "knowledge".into(),
                            native_owner: "ai-kit".into(),
                            provenance: refs::RefProvenance {
                                source: "aikit.knowledge.read".into(),
                                revision: data["revision"].as_str().map(str::to_owned),
                            },
                        },
                    );
                }
                Ok(KernelOpOutcome {
                    receipts: Vec::new(),
                    result: KernelOpResult::Knowledge { data },
                })
            }
            KernelOp::Graph {
                project,
                query,
                options,
            } => {
                let options = options.unwrap_or_default();
                options.validate()?;
                // Central discloses the scope; the wiki read register and the
                // AIKit project context both come from the owner root map.
                let root = self.world_map(false).map_err(|e| e.to_string())?;
                let base = root["root"]
                    .as_str()
                    .ok_or("Central root location unavailable")?;
                let (wiki_action, wiki_input, cwd) = if let Some(project) = project.as_ref() {
                    let row = root["work"]["projects"]
                        .as_array()
                        .and_then(|rows| rows.iter().find(|r| r["name"].as_str() == Some(project)))
                        .ok_or("Project is outside Central's disclosed ground")?;
                    let cwd = std::path::Path::new(base)
                        .join(row["path"].as_str().ok_or("Project location unavailable")?);
                    (
                        "projectcentral.wiki.read",
                        serde_json::json!({ "project": project }),
                        cwd,
                    )
                } else {
                    (
                        "central.wiki.read",
                        serde_json::json!({}),
                        std::path::PathBuf::from(base),
                    )
                };
                let key = format!(
                    "graph:{}:{:?}:{}:{}:{}",
                    cwd.display(),
                    options.input,
                    options.max_nodes,
                    options.max_edges,
                    query
                );
                if options.fresh {
                    self.reads.invalidate(&key);
                }
                // Hosted access/projection changes are always checked at its owner.
                let cacheable = matches!(
                    options.input,
                    graph::InputSelection::CentralWiki | graph::InputSelection::AikitResolution
                );
                let held = if cacheable && !options.fresh {
                    self.reads
                        .get(&key, read_cache::GRAPH_TTL)
                        .and_then(|value| serde_json::from_value(value).ok())
                } else {
                    None
                };
                let reading = if let Some(reading) = held {
                    reading
                } else {
                    let reading = graph::assemble_selected(
                        &self.client,
                        wiki_action,
                        &wiki_input,
                        &cwd,
                        &query,
                        &options,
                    );
                    let available = match options.input {
                        graph::InputSelection::CentralWiki => {
                            reading.inputs.central_wiki.is_available()
                        }
                        graph::InputSelection::AikitResolution => {
                            reading.inputs.aikit_resolution.is_available()
                        }
                        _ => false,
                    };
                    if cacheable && available {
                        if let Ok(value) = serde_json::to_value(&reading) {
                            self.reads.put(key, value);
                        }
                    }
                    reading
                };
                Ok(KernelOpOutcome {
                    receipts: Vec::new(),
                    result: KernelOpResult::GraphReading { reading },
                })
            }
            KernelOp::A2aExchange { request } => {
                let data = shared_field::a2a_exchange(&request)?;
                Ok(KernelOpOutcome {
                    receipts: Vec::new(),
                    result: KernelOpResult::A2aExchangeDifference { data },
                })
            }
            KernelOp::SharedField { request } => {
                // The kernel passes the request through on the desktop's own
                // account; the client resolves its target and token from its
                // own environment. Nothing is recorded, nothing is emitted.
                let data = shared_field::reading(&request)?;
                Ok(KernelOpOutcome {
                    receipts: Vec::new(),
                    result: KernelOpResult::SharedFieldReading { data },
                })
            }
            KernelOp::EncounterJoin {
                session,
                request_ref,
                reply,
            } => {
                // Central discloses the context anchor, exactly as the
                // Graph/Knowledge arms; the lifecycle store itself is the
                // AIKit owner's (AIKIT_HOME), never renderer-supplied.
                let root = self.world_map(false).map_err(|e| e.to_string())?;
                let cwd = std::path::PathBuf::from(
                    root["root"]
                        .as_str()
                        .ok_or("Central root location unavailable")?,
                );
                let reading = encounter::assemble(&cwd, &session, &request_ref, reply.as_ref());
                Ok(KernelOpOutcome {
                    receipts: Vec::new(),
                    result: KernelOpResult::EncounterJoined { reading },
                })
            }
            KernelOp::InvokeAction {
                project,
                invocation,
            } => {
                // Central discloses the scope, exactly as the Knowledge/Graph
                // arms: renderer-supplied paths never become invocation context.
                let root = self.world_map(false).map_err(|e| e.to_string())?;
                let base = root["root"]
                    .as_str()
                    .ok_or("Central root location unavailable")?;
                let cwd = if let Some(project) = project.as_ref() {
                    let row = root["work"]["projects"]
                        .as_array()
                        .and_then(|rows| rows.iter().find(|r| r["name"].as_str() == Some(project)))
                        .ok_or("Project is outside Central's disclosed ground")?;
                    std::path::Path::new(base)
                        .join(row["path"].as_str().ok_or("Project location unavailable")?)
                } else {
                    std::path::PathBuf::from(base)
                };
                let dispatch = action::invoke(&self.client, &cwd, project.as_deref(), &invocation);
                self.reads.invalidate_prefix("knowledge:");
                self.reads.invalidate_prefix("graph:");
                let mut receipts = Vec::new();
                if matches!(
                    invocation.action.as_str(),
                    construction::APPLY | construction::APPLY_FACTS
                ) {
                    if let action::ActionDispatch::Invoked { data, .. } = &dispatch {
                        if data["persisted"] == true && data["state"] == "saved" {
                            if let Some(path) = data["native_file"]["location"]["path"]
                                .as_str()
                                .or_else(|| {
                                    invocation
                                        .input
                                        .as_ref()
                                        .and_then(|i| i["location"]["path"].as_str())
                                })
                            {
                                self.reads
                                    .invalidate(&format!("dir:{}", files::parent_path(path)));
                                receipts.push(self.log.record(KernelEvent::FileChanged {
                                    path: path.into(),
                                    summary: if invocation.action == construction::APPLY_FACTS {
                                        "The native Wiki owner saved time and place facts.".into()
                                    } else {
                                        "The native Wiki owner saved a constructive whole.".into()
                                    },
                                }));
                            }
                        }
                    }
                }
                Ok(KernelOpOutcome {
                    receipts,
                    result: KernelOpResult::ActionDispatched { dispatch },
                })
            }
            KernelOp::FlowChangedSince { project, thought } => {
                // The changed-since compose resolves its owner cwd exactly as
                // the InvokeAction arm: Central discloses the scope,
                // renderer-supplied paths never become context.
                let root = self.world_map(false).map_err(|e| e.to_string())?;
                let base = root["root"]
                    .as_str()
                    .ok_or("Central root location unavailable")?;
                let cwd = if let Some(project) = project.as_ref() {
                    let row = root["work"]["projects"]
                        .as_array()
                        .and_then(|rows| rows.iter().find(|r| r["name"].as_str() == Some(project)))
                        .ok_or("Project is outside Central's disclosed ground")?;
                    std::path::Path::new(base)
                        .join(row["path"].as_str().ok_or("Project location unavailable")?)
                } else {
                    std::path::PathBuf::from(base)
                };
                let reading = flow_cognition::changed_since(
                    &self.client,
                    project
                        .as_deref()
                        .unwrap_or_else(|| self.client.configured_project()),
                    &cwd,
                    &thought,
                )
                .map_err(|e| e.to_string())?;
                Ok(KernelOpOutcome {
                    receipts: Vec::new(),
                    result: KernelOpResult::FlowChangedSince { reading },
                })
            }
            KernelOp::InstanceCommission {
                location,
                expected_revision,
                content,
                agent_session_ref,
            } => {
                let outcome = commission::commission(
                    &self.client,
                    &location,
                    &expected_revision,
                    &content,
                    agent_session_ref.as_deref(),
                )
                .map_err(|e| e.to_string())?;
                // The commission landed as a file write: the parent listing
                // it invalidates by name.
                self.reads
                    .invalidate(&format!("dir:{}", files::parent_path(&location.path)));
                self.reads.invalidate_prefix("knowledge:");
                self.reads.invalidate_prefix("graph:");
                Ok(KernelOpOutcome {
                    receipts: Vec::new(),
                    result: KernelOpResult::InstanceCommissioned { outcome },
                })
            }
            KernelOp::WorldRead => self.navigate(None, false, false),
            KernelOp::ProjectRead { project } => self.navigate(Some(&project), false, false),
            KernelOp::WorldBrowse { fresh } => self.navigate(None, true, fresh.unwrap_or(false)),
            KernelOp::ProjectBrowse { project, fresh } => {
                self.navigate(Some(&project), true, fresh.unwrap_or(false))
            }
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
            KernelOp::SourceRestore {
                source_ref,
                content,
                base_revision,
                saved_content,
            } => {
                let current = self
                    .buffers
                    .get(&source_ref)
                    .ok_or("open the owner source before restoring writing")?
                    .clone();
                if current.dirty {
                    return Ok(KernelOpOutcome {
                        receipts: Vec::new(),
                        result: KernelOpResult::SourceOpened { buffer: current },
                    });
                }
                let mut outcome = self.source_edit(&source_ref, content)?;
                let buffer = self.buffers.get_mut(&source_ref).expect("opened source");
                if buffer.dirty {
                    buffer.base_revision = base_revision.clone();
                    buffer.saved_content = saved_content;
                    if current.base_revision != base_revision {
                        buffer.conflict = Some(SourceConflict {
                            expected_revision: base_revision.clone(),
                            current_revision: current.base_revision.clone(),
                            canonical_content: current.content,
                        });
                        outcome.receipts.push(self.log.record(KernelEvent::SourceWriteConflict {
                            source: source_semantic_ref(&source_ref, Some(&base_revision))?, expected_revision: base_revision,
                            current_revision: current.base_revision, summary: "Restored writing has a different base from the current owner revision; both sides retained.".into(),
                        }));
                    }
                }
                outcome.result = KernelOpResult::SourceOpened {
                    buffer: buffer.clone(),
                };
                Ok(outcome)
            }
            KernelOp::SourceHistory { source_ref } => {
                let buffer = self
                    .buffers
                    .get(&source_ref)
                    .ok_or("open the source before reading its history")?;
                let history = history::read(&self.client, &buffer.project, &source_ref)
                    .map_err(|e| e.to_string())?;
                Ok(KernelOpOutcome {
                    receipts: Vec::new(),
                    result: KernelOpResult::SourceHistory { history },
                })
            }
            KernelOp::SourceOpen {
                project,
                source_ref,
            } => self.source_open(project.as_deref(), &source_ref),
            KernelOp::SourceEdit {
                source_ref,
                content,
            } => self.source_edit(&source_ref, content),
            KernelOp::SourceSave {
                project,
                source_ref,
            } => self.source_save(project.as_deref(), &source_ref),
            KernelOp::SourceReread {
                project,
                source_ref,
            } => self.source_reread(project.as_deref(), &source_ref),
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

    fn navigate(
        &mut self,
        project: Option<&str>,
        browse_only: bool,
        fresh: bool,
    ) -> Result<KernelOpOutcome, String> {
        let before = self.navigator.clone();
        let old_focus = self.focus.clone();
        let result = if let Some(query) = project {
            // Resolve only a project the owner's current root map disclosed.
            let known = self
                .navigator
                .root
                .as_ref()
                .and_then(|r| r["work"]["projects"].as_array())
                .is_some_and(|rows| rows.iter().any(|p| p["name"].as_str() == Some(query)));
            if !known {
                return Err(
                    "Project is outside the disclosed World mapping; refresh World first".into(),
                );
            }
            self.navigate_project(query, fresh)
        } else {
            self.navigate_root(fresh)
        };
        self.navigator.error = result.err();
        // Browsing changes the navigation reading, not the semantic subject
        // currently bound to open work. Explicit focus remains a separate act.
        if browse_only {
            self.focus = old_focus.clone();
        }
        let mut receipts = Vec::new();
        if self.navigator != before {
            receipts.push(self.log.record(KernelEvent::WorldChanged {
                summary: "Central navigator reading changed".into(),
            }));
        }
        if self.focus != old_focus {
            receipts.push(self.log.record(KernelEvent::FocusChanged {
                focus: self.focus.clone(),
            }));
        }
        Ok(KernelOpOutcome {
            receipts,
            result: KernelOpResult::WorldRead {
                snapshot: self.snapshot(),
            },
        })
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
            self.inspect_project(query, fresh).and_then(|v| {
                v["manifest"]["project_id"]
                    .as_str()
                    .filter(|id| !id.trim().is_empty())
                    .map(str::to_owned)
            })
        } else {
            None
        };
        self.focus.project = None;
        self.focus.world = None;
        self.focus.clear_subject();
        let semantic = |id: String, kind: &str| SemanticRef {
            ref_id: id,
            kind: kind.into(),
            native_owner: "central".into(),
            provenance: refs::RefProvenance {
                source: "projectcentral.inspect".into(),
                revision: None,
            },
        };
        if let Some(id) = project_ref.as_ref() {
            let reference = semantic(id.clone(), "project");
            self.focus.bind_project(
                focus::ProjectRef::try_from(reference.clone()).expect("owner project ref"),
            );
            self.focus
                .focus_subject(reference)
                .expect("owner project ref");
        }
        if let Some(id) = sources
            .as_ref()
            .and_then(|s| s.world_ref.as_ref())
            .filter(|id| !id.trim().is_empty())
        {
            let mut reference = semantic(id.clone(), "world");
            reference.provenance.source = "projectcentral.change.horizon".into();
            self.focus
                .bind_world(focus::WorldRef::try_from(reference).expect("owner world ref"));
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

    /// The empty conversation Project label is the explicit renderer ROOT
    /// selection, not a native Project id or a fallback to the configured child.
    fn agent_location(&mut self, project: Option<&str>) -> Result<std::path::PathBuf, String> {
        let root = self.world_map(false).map_err(|e| e.to_string())?;
        let base = std::path::Path::new(
            root["root"]
                .as_str()
                .ok_or("Central root location unavailable")?,
        );
        match project {
            None => Ok(base.to_path_buf()),
            Some(project) => {
                let row = root["work"]["projects"]
                    .as_array()
                    .and_then(|rows| rows.iter().find(|r| r["name"].as_str() == Some(project)))
                    .ok_or("Project is outside Central's disclosed ground")?;
                Ok(base.join(row["path"].as_str().ok_or("Project location unavailable")?))
            }
        }
    }
    fn agent_project_ref(
        &mut self,
        project: &str,
        cwd: &std::path::Path,
    ) -> Result<String, String> {
        if !project.is_empty() {
            let inspection = self
                .client
                .run(
                    "projectcentral.inspect",
                    serde_json::json!({"project":project}),
                )
                .map_err(|e| e.to_string())?;
            return inspection["manifest"]["project_id"]
                .as_str()
                .map(str::to_owned)
                .ok_or("Central has not bound a canonical ProjectRef".into());
        }
        let scope = self.agency.direct_agent(cwd, "agent-session-scope", None)?;
        if scope["schema"] != "aikit.direct-agent-scope/v1"
            || scope["execution_authority_granted"] != false
        {
            return Err("AIKit did not disclose the native root Project binding".into());
        }
        scope["project_ref"]
            .as_str()
            .filter(|s| !s.is_empty())
            .map(str::to_owned)
            .ok_or("No native root Project binding".into())
    }

    fn world_map(&mut self, fresh: bool) -> Result<serde_json::Value, String> {
        if fresh {
            self.reads.invalidate("world");
        } else if let Some(value) = self.reads.get("world", read_cache::WORLD_TTL) {
            return Ok(value);
        }
        let reading = world::read_world(&self.client)?;
        self.reads.put("world".into(), reading.clone());
        Ok(reading)
    }

    /// The project-scoped ground every project-named op shares: the project
    /// must be inside Central's disclosed ground, the cwd comes from that
    /// disclosure, and the canonical ProjectRef is Central's own inspect
    /// reading — never a caller-supplied path or ref.
    fn project_ground(&mut self, project: &str) -> Result<(std::path::PathBuf, String), String> {
        let root = self.world_map(false)?;
        let row = root["work"]["projects"]
            .as_array()
            .and_then(|rows| rows.iter().find(|r| r["name"].as_str() == Some(project)))
            .ok_or("Project is outside Central's disclosed ground")?;
        let cwd = std::path::Path::new(
            root["root"]
                .as_str()
                .ok_or("Central root location unavailable")?,
        )
        .join(row["path"].as_str().ok_or("Project location unavailable")?);
        let inspection = self
            .client
            .run(
                "projectcentral.inspect",
                serde_json::json!({"project":project}),
            )
            .map_err(|e| e.to_string())?;
        let project_ref = inspection["manifest"]["project_id"]
            .as_str()
            .ok_or("Central has not bound a canonical ProjectRef")?
            .to_owned();
        Ok((cwd, project_ref))
    }

    fn project_map(&mut self, project: &str, fresh: bool) -> Result<serde_json::Value, String> {
        let key = format!("project:{project}");
        if fresh {
            self.reads.invalidate(&key);
        } else if let Some(value) = self.reads.get(&key, read_cache::PROJECT_TTL) {
            return Ok(value);
        }
        let reading = world::read_project(&self.client, project)?;
        self.reads.put(key, reading.clone());
        Ok(reading)
    }

    fn inspect_project(&mut self, project: &str, fresh: bool) -> Option<serde_json::Value> {
        let key = format!("inspect:{project}");
        if fresh {
            self.reads.invalidate(&key);
        } else if let Some(value) = self.reads.get(&key, read_cache::HORIZON_TTL) {
            return Some(value);
        }
        let value = self
            .client
            .run(
                "projectcentral.inspect",
                serde_json::json!({"project": project}),
            )
            .ok()?;
        self.reads.put(key, value.clone());
        Some(value)
    }

    /// Horizon-served source listings only: a degraded reading is the error
    /// path, and the error path is never cached.
    fn participating_sources_cached(&mut self, project: Option<&str>) -> SourceListing {
        let key = format!("horizon:{}", project.unwrap_or(""));
        if let Some(value) = self.reads.get(&key, read_cache::HORIZON_TTL) {
            if let Ok(listing) = serde_json::from_value(value) {
                return listing;
            }
        }
        let listing = participating_sources(&self.client, project);
        if matches!(listing.availability, world::ListingAvailability::Horizon) {
            if let Ok(value) = serde_json::to_value(&listing) {
                self.reads.put(key, value);
            }
        }
        listing
    }

    fn directory_listing(&mut self, path: &str, fresh: bool) -> Result<files::Directory, String> {
        let key = format!("dir:{path}");
        if fresh {
            self.reads.invalidate(&key);
        } else if let Some(value) = self.reads.get(&key, read_cache::DIR_TTL) {
            if let Ok(directory) = serde_json::from_value(value) {
                return Ok(directory);
            }
        }
        let directory = files::list(&self.client, path)?;
        if let Ok(value) = serde_json::to_value(&directory) {
            self.reads.put(key, value);
        }
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
        let route = held
            .as_ref()
            .map(|b| b.project.clone())
            .unwrap_or_else(|| project.unwrap_or("").to_owned());
        let project = if route.is_empty() {
            None
        } else {
            Some(route.as_str())
        };
        if let Some(buffer) = &held {
            // Reopening preserves unsaved work. A clean root buffer is read
            // from its exact native SourceRef just like a child source.
            if buffer.dirty {
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
        // A root-register reading (the Day) routes as the root itself: the
        // configured project query is a co-reference fallback for child
        // sources only, never for the owner's own register.
        let route = if reading.world_ref == "control:root" {
            String::new()
        } else {
            project
                .unwrap_or(self.client.configured_project())
                .to_owned()
        };
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
    fn sync_buffer_from_reading(
        &mut self,
        reading: &SourceReading,
        reset_content: bool,
        project: &str,
    ) -> SourceBuffer {
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
            project_ref: self
                .client
                .run(
                    "projectcentral.inspect",
                    serde_json::json!({"project":project}),
                )
                .ok()
                .and_then(|v| {
                    v.pointer("/manifest/project_id")
                        .and_then(serde_json::Value::as_str)
                        .map(str::to_owned)
                }),
            content,
            saved_content: reading.content.clone(),
            base_revision: reading.revision.revision.clone(),
            dirty,
            conflict: None,
            path: Some(reading.source.path.clone()),
            root_register: reading.world_ref == "control:root",
        };
        self.buffers.insert(source_ref, buffer.clone());
        buffer
    }

    fn source_edit(
        &mut self,
        source_ref: &str,
        content: String,
    ) -> Result<KernelOpOutcome, String> {
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
            return Err(format!(
                "no open buffer for `{source_ref}`; nothing to save"
            ));
        };
        // A root-register buffer saves through the owner's root route: an
        // empty/None project is the root register, never the configured
        // project (which would redirect the owner's own source).
        let project = if buffer.root_register {
            None
        } else if buffer.project.is_empty() {
            Some(project.unwrap_or(self.client.configured_project()))
        } else {
            Some(buffer.project.as_str())
        };
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
                if changed {
                    self.reads.invalidate_prefix("knowledge:");
                    self.reads.invalidate_prefix("graph:");
                }
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
                    OwnerCallError::OutcomeUnknown {
                        detail,
                        child_pid,
                        cleanup,
                        native,
                    } => {
                        // Receipt loss takes precedence over revision heuristics.
                        // Reading current bytes never establishes our own effect.
                        if let Some(buffer) = self.buffers.get_mut(source_ref) {
                            buffer.dirty = true;
                        }
                        SourceWriteFailure::OutcomeUnknown {
                            source_ref: source_ref.to_owned(),
                            detail: detail.clone(),
                            child_pid: *child_pid,
                            cleanup: cleanup.clone(),
                            native: native.clone(),
                        }
                    }
                    OwnerCallError::TransportFailed { detail, .. }
                    | OwnerCallError::Malformed { detail } => SourceWriteFailure::Failed {
                        source_ref: source_ref.to_owned(),
                        detail: detail.clone(),
                    },
                    OwnerCallError::Unavailable { detail } => SourceWriteFailure::Unavailable {
                        source_ref: source_ref.to_owned(),
                        detail: detail.clone(),
                    },
                    OwnerCallError::Refused { native, .. } => {
                        match self.client.current_reading(project, source_ref) {
                            Ok(current) => {
                                if current.revision.revision == expected {
                                    SourceWriteFailure::OwnerRefused {
                                        source_ref: source_ref.to_owned(),
                                        message: error.to_string(),
                                        native: native.clone(),
                                    }
                                } else {
                                    let failure = SourceWriteFailure::RevisionConflict {
                                        source_ref: source_ref.to_owned(),
                                        expected: expected.clone(),
                                        current: current.revision.revision.clone(),
                                    };
                                    let canonical_content = current.content.clone();
                                    let current_revision = current.revision.revision.clone();
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
                                native: native.clone(),
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
                let buffer = self
                    .buffers
                    .get(source_ref)
                    .cloned()
                    .expect("save path holds it");
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
        if self
            .buffers
            .get(source_ref)
            .map(|b| b.root_register)
            .unwrap_or(false)
        {
            return self.day_reread(source_ref);
        }
        let route = self
            .buffers
            .get(source_ref)
            .map(|b| b.project.as_str())
            .filter(|p| !p.is_empty())
            .or(project)
            .unwrap_or(self.client.configured_project())
            .to_owned();
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
            .and_then(|doc| {
                doc.get("day_ref")
                    .and_then(|v| v.as_str())
                    .map(str::to_owned)
            });
        let mut input = serde_json::Map::new();
        input.insert("project".to_owned(), serde_json::Value::Null);
        if let Some(day_ref) = &day_ref {
            input.insert(
                "day_ref".to_owned(),
                serde_json::Value::String(day_ref.clone()),
            );
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
            .map_err(|error| {
                let mut failure = knowledge::failure_reading("projectcentral.source.read", error);
                failure["owner_input"] =
                    serde_json::json!({ "project": project, "source_ref": source_ref });
                failure.to_string()
            })
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
        if kind == "encounter"
            && !source_ref
                .as_ref()
                .is_some_and(|r| self.encounter_refs.contains_key(r))
        {
            return Err("Encounter surface requires a current AIKit reading".into());
        }
        if kind == "file"
            && !source_ref
                .as_ref()
                .is_some_and(|r| self.file_refs.contains_key(r))
        {
            return Err(
                "File must be read successfully through Central before opening its surface".into(),
            );
        }
        if kind == "knowledge"
            && !source_ref
                .as_ref()
                .is_some_and(|r| self.knowledge_refs.contains_key(r))
        {
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
            if surface.kind == "knowledge" {
                self.knowledge_refs.get(reference).cloned()
            } else if surface.kind == "file" {
                self.file_refs.get(reference).map(|r| r.0.clone())
            } else if surface.kind == "encounter" {
                self.encounter_refs.get(reference).map(|r| r.0.clone())
            } else {
                source_semantic_ref(reference, None).ok()
            }
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
        // A portal is a presentation of this exact Surface. Ordinary tab or
        // native window closure must release it too, not leave a phantom
        // record which prevents the same source from opening again.
        self.world.surface_closed(&surface_id);
        let mut receipts = vec![self.log.record(KernelEvent::SurfaceChanged {
            surface_id: surface.surface_id.clone(),
            surface_ref: surface.source_ref.as_deref().and_then(|reference| {
                if surface.kind == "knowledge" {
                    self.knowledge_refs.get(reference).cloned()
                } else if surface.kind == "file" {
                    self.file_refs.get(reference).map(|r| r.0.clone())
                } else if surface.kind == "encounter" {
                    self.encounter_refs.get(reference).map(|r| r.0.clone())
                } else {
                    source_semantic_ref(reference, None).ok()
                }
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
                self.focus.bind_world(
                    focus::WorldRef::try_from(owner_relation(
                        &buffer.world_ref,
                        "world",
                        "projectcentral.source.read",
                    ))
                    .map_err(|e| e.to_string())?,
                );
            }
            self.focus.project = buffer
                .project_ref
                .as_ref()
                .map(|r| {
                    focus::ProjectRef::try_from(owner_relation(
                        r,
                        "project",
                        "projectcentral.inspect",
                    ))
                })
                .transpose()
                .map_err(|e| e.to_string())?;
        }
        let subject = if surface.kind == "encounter" {
            let (subject, project) = self
                .encounter_refs
                .get(&source_ref)
                .cloned()
                .ok_or("Encounter must be resolved through AIKit")?;
            self.focus.project = Some(project);
            self.focus.world = None;
            subject
        } else if surface.kind == "file" {
            let (subject, project) = self
                .file_refs
                .get(&source_ref)
                .cloned()
                .ok_or("File must be resolved through Central")?;
            self.focus.project = project;
            self.focus.world = None;
            subject
        } else if surface.kind == "knowledge" {
            self.focus.project = self.knowledge_projects.get(&source_ref).cloned().flatten();
            self.focus.world = None;
            self.knowledge_refs
                .get(&source_ref)
                .cloned()
                .ok_or("Knowledge subject must be resolved through AIKit")?
        } else {
            source_semantic_ref(&source_ref, None)?
        };
        self.focus
            .focus_subject(subject)
            .map_err(|error| error.to_string())?;
        if self.focus == old_focus {
            return Ok(KernelOpOutcome {
                receipts: Vec::new(),
                result: KernelOpResult::SurfaceFocused {
                    snapshot: self.snapshot(),
                },
            });
        }
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
    SemanticRef {
        ref_id: reference.into(),
        kind: kind.into(),
        native_owner: "central".into(),
        provenance: refs::RefProvenance {
            source: source.into(),
            revision: None,
        },
    }
}

fn native_owner_reading<T: Serialize>(
    owner: &str,
    result: Result<T, material::Error>,
) -> Result<KernelOpOutcome, String> {
    let (data, failure) = match result {
        Ok(value) => (
            Some(serde_json::to_value(value).map_err(|e| e.to_string())?),
            None,
        ),
        Err(error) => (
            None,
            Some(serde_json::to_value(error).map_err(|e| e.to_string())?),
        ),
    };
    Ok(KernelOpOutcome {
        receipts: Vec::new(),
        result: KernelOpResult::NativeOwnerReading {
            owner: owner.into(),
            data,
            failure,
        },
    })
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

    /// Count invocations while forwarding every request and response to the
    /// actual built Central owner. No substitute owner data or receipt exists.
    #[cfg(unix)]
    struct NativeCacheOwner {
        directory: std::path::PathBuf,
        root: std::path::PathBuf,
        executable: std::path::PathBuf,
        owner: std::path::PathBuf,
        log: std::path::PathBuf,
    }

    #[cfg(unix)]
    impl NativeCacheOwner {
        fn new(test: &str) -> Self {
            use std::os::unix::fs::PermissionsExt;
            let owner = std::path::PathBuf::from(
                std::env::var_os("OI_CENTRAL_CTRL_BIN")
                    .expect("The native cache gate requires its built Central owner"),
            );
            assert!(owner.is_absolute() && owner.is_file());
            let directory = std::env::temp_dir().join(format!(
                "oi-native-cache-{}-{test}-{}",
                std::process::id(),
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_nanos()
            ));
            let root = directory.join("world");
            std::fs::create_dir_all(&root).unwrap();
            let executable = directory.join("owner-count.py");
            let log = directory.join("calls.log");
            let script = format!(
                "#!/usr/bin/env python3\nimport json,os,sys\nowner=json.loads({})\nlog=json.loads({})\nargs=sys.argv[1:]\naction=args[args.index('run')+1]\nwith open(log,'a') as out: out.write(action+chr(10))\nos.execv(owner,[owner]+args)\n",
                serde_json::to_string(&serde_json::to_string(&owner).unwrap()).unwrap(),
                serde_json::to_string(&serde_json::to_string(&log).unwrap()).unwrap(),
            );
            std::fs::write(&executable, script).unwrap();
            std::fs::set_permissions(&executable, std::fs::Permissions::from_mode(0o700)).unwrap();
            crate::test_stub::settle_stub(&executable);
            let fixture = Self {
                directory,
                root,
                executable,
                owner,
                log,
            };
            fixture
                .direct()
                .run("central.init", serde_json::json!({"project":null}))
                .unwrap();
            std::fs::create_dir_all(fixture.root.join("Work/CacheProject")).unwrap();
            fixture
                .direct()
                .run(
                    "projectcentral.init",
                    serde_json::json!({"project":"CacheProject", "project_id":"cache-project"}),
                )
                .unwrap();
            std::fs::write(fixture.root.join("Work/CacheProject/a.md"), "before").unwrap();
            fixture
        }
        fn direct(&self) -> CentralClient {
            CentralClient::with(
                self.owner.clone(),
                Some(self.root.clone()),
                "CacheProject".into(),
            )
        }
        fn kernel(&self) -> Kernel {
            Kernel::new(CentralClient::with(
                self.executable.clone(),
                Some(self.root.clone()),
                "CacheProject".into(),
            ))
        }
        fn file(&self) -> files::Reading {
            let directory = files::list(&self.direct(), "Work/CacheProject").unwrap();
            let location = directory
                .entries
                .iter()
                .find(|entry| entry.name == "a.md")
                .unwrap()
                .location
                .clone();
            files::read(&self.direct(), &location).unwrap()
        }
        fn spawns(&self, action: &str) -> usize {
            std::fs::read_to_string(&self.log)
                .map(|text| text.lines().filter(|line| *line == action).count())
                .unwrap_or(0)
        }
    }

    #[cfg(unix)]
    impl Drop for NativeCacheOwner {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.directory);
        }
    }

    #[cfg(unix)]
    #[test]
    #[ignore = "Requires actual built Central; readable-presentation-native executes this gate"]
    fn a_repeated_directory_read_serves_from_the_cache_and_a_fresh_read_bypasses_it() {
        let owner = NativeCacheOwner::new("directory-cache");
        let mut kernel = owner.kernel();
        for _ in 0..3 {
            kernel
                .apply(KernelOp::FilesList {
                    path: "Work/CacheProject".into(),
                    fresh: None,
                })
                .unwrap();
        }
        assert_eq!(
            owner.spawns("central.files.list"),
            1,
            "repeats inside the TTL are one owner read"
        );
        kernel
            .apply(KernelOp::FilesList {
                path: "Work/CacheProject".into(),
                fresh: Some(true),
            })
            .unwrap();
        assert_eq!(
            owner.spawns("central.files.list"),
            2,
            "the explicit fresh read re-asks the owner"
        );
    }

    #[cfg(unix)]
    #[test]
    #[ignore = "Requires actual built Central; readable-presentation-native executes this gate"]
    fn a_file_write_invalidates_the_parent_listing_by_name() {
        let owner = NativeCacheOwner::new("write-invalidation");
        let native_file = owner.file();
        assert_eq!(native_file.content, "before");
        let mut kernel = owner.kernel();
        kernel
            .apply(KernelOp::FilesList {
                path: "Work/CacheProject".into(),
                fresh: None,
            })
            .unwrap();
        kernel
            .apply(KernelOp::FileOperation {
                location: native_file.location.clone(),
                request: files::Request::Write {
                    expected_revision: native_file.revision.clone(),
                    content: "new".into(),
                },
            })
            .unwrap();
        kernel
            .apply(KernelOp::FilesList {
                path: "Work/CacheProject".into(),
                fresh: None,
            })
            .unwrap();
        assert_eq!(
            owner.spawns("central.files.list"),
            2,
            "the written directory is re-read after its write"
        );
        assert_eq!(owner.file().content, "new");
    }

    #[cfg(unix)]
    #[test]
    #[ignore = "Requires actual built Central; readable-presentation-native executes this gate"]
    fn a_changed_file_write_discloses_one_file_changed_receipt() {
        // One state change, one event: an owner-confirmed write discloses
        // FileChanged naming the changed path (the receipt a retained listing
        // invalidates on); a non-mutating request discloses nothing.
        let owner = NativeCacheOwner::new("file-changed-receipt");
        let native_file = owner.file();
        assert_eq!(native_file.content, "before");
        let mut kernel = owner.kernel();
        let outcome = kernel
            .apply(KernelOp::FileOperation {
                location: native_file.location.clone(),
                request: files::Request::Write {
                    expected_revision: native_file.revision.clone(),
                    content: "new".into(),
                },
            })
            .unwrap();
        assert_eq!(
            std::fs::read_to_string(owner.root.join("Work/CacheProject/a.md")).unwrap(),
            "new"
        );
        let receipt = outcome
            .receipts
            .iter()
            .find(|logged| logged.envelope.event.tag() == "file_changed")
            .expect("a written file discloses one file_changed receipt");
        assert_eq!(
            receipt.envelope.event.subject(),
            None,
            "the changed path rides the payload, not a semantic subject"
        );
        kernel
            .apply(KernelOp::FilesList {
                path: "Work/CacheProject".into(),
                fresh: None,
            })
            .unwrap();
        let listed = kernel.event_log().since(0);
        assert_eq!(
            listed
                .iter()
                .filter(|logged| logged.envelope.event.tag() == "file_changed")
                .count(),
            1,
            "reads change no kernel state and emit nothing"
        );
    }

    #[cfg(unix)]
    #[test]
    #[ignore = "Requires actual built Central; readable-presentation-native executes this gate"]
    fn the_world_mapping_is_cached_until_a_fresh_browse_is_demanded() {
        let owner = NativeCacheOwner::new("world-cache");
        let mut kernel = owner.kernel();
        kernel.apply(KernelOp::WorldBrowse { fresh: None }).unwrap();
        kernel.apply(KernelOp::WorldBrowse { fresh: None }).unwrap();
        assert_eq!(
            owner.spawns("central.world"),
            1,
            "repeat browses inside the TTL are one owner read"
        );
        kernel
            .apply(KernelOp::WorldBrowse { fresh: Some(true) })
            .unwrap();
        assert_eq!(
            owner.spawns("central.world"),
            2,
            "the explicit refresh re-asks the owner"
        );
    }
}

#[cfg(all(test, unix))]
pub(crate) mod test_stub {
    /// Linux ETXTBSY guard for a freshly written test stub. A parallel test's
    /// fork can inherit this process's write handle on the stub for an instant,
    /// and exec then answers "Text file busy". Re-materialise the stub through a
    /// child: `cp` writes a new inode this process never opened, `mv` renames it
    /// over the path, so no inherited handle can pin what the kernel executes.
    pub(crate) fn settle_stub(path: &std::path::Path) {
        let status = std::process::Command::new("/bin/sh")
            .arg("-c")
            .arg(r#"cp "$1" "$1.settle" && mv "$1.settle" "$1""#)
            .arg("settle")
            .arg(path)
            .status()
            .expect("settle a test stub");
        assert!(
            status.success(),
            "could not settle test stub {}",
            path.display()
        );
    }
}
