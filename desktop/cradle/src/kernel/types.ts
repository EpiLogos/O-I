/**
 * Kernel wire types (U0.4) — the TypeScript mirror of the Rust kernel's
 * seam (`desktop/cradle/kernel`). These are read-model projections pulled
 * through the bridge; events are disclosure triggers, never a second
 * source of truth (02 §5, ported).
 */

/** Central's canonical source ref grammar (U0.2, D12). */
export type SourceRef = string;

/** The one global focus relation (02 §7) — absent relations are absent. */
export interface GlobalFocusState {
  world?: { ref: string };
  project?: { ref: string };
  subject?: { ref: string; kind: string; native_owner: string };
  journey?: { ref: string };
  agency_encounter?: { ref: string };
}

/** The structured conflict record: both revisions + the canonical side. */
export interface SourceConflictState {
  expected_revision: string;
  current_revision: string;
  canonical_content: string;
}

/** The two state layers for one open source (map §5 U0.4):
 * `content` = the cradle-held dirty buffer (presentation state);
 * `saved_content`/`base_revision` = the Central-owned canonical layer. */
export interface SourceBufferState {
  source_ref: SourceRef;
  project: string;
  world_ref: string;
  project_ref?: string | null;
  content: string;
  saved_content: string;
  base_revision: string;
  dirty: boolean;
  conflict?: SourceConflictState;
  path?: string;
  root_register?: boolean;
}

export interface SurfaceKernelState {
  surface_id: string;
  kind: string;
  source_ref?: SourceRef;
  title: string;
}

export interface KernelSnapshotState {
  focus: GlobalFocusState;
  surfaces: Record<string, SurfaceKernelState>;
  buffers: Record<string, SourceBufferState>;
  navigator?: NavigatorReading;
}

/** One participating source as the owner disclosed it. */
export interface ListedSource {
  ref: SourceRef;
  path: string;
  treatment: string;
  agent_retrieval_allowed: boolean;
  revision?: string;
}

export type ListingAvailability =
  | "horizon"
  | { ground_only: { reason: string } }
  | { unavailable: { reason: string } };

export interface SourceListingState {
  schema: string;
  project: string;
  world_ref?: string;
  sources: ListedSource[];
  availability: ListingAvailability;
}

/** One event as observed on the seam: `seq` beside the envelope. */
export interface KernelReceipt {
  seq: number;
  schema: string;
  version: number;
  event: string;
  [payload: string]: unknown;
}

/** The operation payloads (the Rust `KernelOp`, tagged snake_case). */
export interface CentralLocation { schema: "central.path-ref/v1"; ref: string; root: string; path: string }
export interface NativeFileEntry { name: string; location: CentralLocation; kind: "file" | "directory" | "symlink" | "other"; byte_len: number; retrieval_allowed: boolean }
export interface NativeDirectory { schema: "central.directory-reading/v1"; location: CentralLocation; entries: NativeFileEntry[]; automatic_agent_or_model_invocation: false }
export interface NativeFileReading { schema: "central.file-reading/v1"; location: CentralLocation; revision: string; byte_len: number; content_encoding: "utf-8"; content: string; project: {name:string;path:string;project_ref:string|null} | null; source: ListedSource | null; operations?:Record<"write"|"history"|"restore",{available:boolean;reason:string|null}>; automatic_agent_or_model_invocation: false }
/** A binary-safe material reading (FND-04): `central.files.read` with
 * `encoding: "base64"`, distinct from the UTF-8 `NativeFileReading` above. */
export interface NativeFileBytes { location: CentralLocation; revision: string; byte_len: number; mime_hint: string | null; content_base64: string }

/** W1.5 changed-since-thought compose (`flow_cognition.rs`): ONE typed
 * reading with both owner sides explicit — a side that could not be queried
 * is named, never faked empty. */
export interface ChangedSinceReading {
  flow_ref: string;
  thought_ref: string;
  horizon:
    | { state: "available"; owner_operation: string; provider: string; cursor: number; adapted: Record<string, unknown> }
    | { state: "owner_refused"; owner_operation: string; message: string }
    | { state: "owner_unavailable"; owner_operation: string; detail: string };
  aikit:
    | { state: "invoked"; owner_operation: string; receipt: Record<string, unknown> }
    | { state: "owner_refused"; owner_operation: string; message: string }
    | { state: "owner_unavailable"; owner_operation: string; detail: string };
}
/** U4.1/U4.2 selection commission outcome (`commission.rs`): an owner
 * revision, a structured CAS conflict (both revisions observed), or the
 * owner's own refusal/unavailability, verbatim. */
export type CommissionOutcome =
  | { state: "commissioned"; path: string; previous_revision: string; revision: string; agent_session_ref: string | null }
  | { state: "conflict"; path: string; expected: string; current: string }
  | { state: "owner_refused"; path: string; message: string }
  | { state: "owner_unavailable"; path: string; detail: string };

// ---------------------------------------------------------------------------
// Configuration-plane wire shapes (#299 C6 live leg). These alias the C0
// contract types — one definition, never a parallel copy.
// ---------------------------------------------------------------------------

export type ConfigurationMountState = import("../configuration/source").ContributionMount;
export type ConfigResolutionWire = import("../configuration/contracts").ConfigResolution;
export type PlanDocumentWire = import("../configuration/contracts").PlanDocument;
export type ConfigErrorWire = import("../configuration/contracts").ConfigErrorDocument;
export type ChangeSetDocumentWire = import("../configuration/contracts").ChangeSetDocument;
export type ReceiptDocumentWire = import("../configuration/contracts").ReceiptDocument;
export type ProfileDocumentWire = import("../configuration/contracts").ProfileDocument;

/** One scope address on the configuration seam (09 §5), carried verbatim
 * to the engine — the kernel judges no scope kinds. */
export interface ConfigScopeWire { scope_kind: string; scope_ref?: string | null }
/** The reference half of a secret-kind request (09 §14): the reference
 * crosses; material never does. */
export interface ConfigSecretReferenceWire { ref: string }
/** One desired request as it crosses to hold/plan/apply. */
export interface ConfigRequestWire {
  setting_ref: string;
  scope: ConfigScopeWire;
  value?: unknown;
  secret_reference?: ConfigSecretReferenceWire | null;
}
/** One (setting, scope) resolution request. */
export interface ConfigPairWire { setting_ref: string; scope: ConfigScopeWire }
/** The inspectable profile-use plan (09 §12): targets beside currents;
 * the renderer enriches entries with contribution settings generically. */
export interface ProfileUsePlanWire {
  profile_ref: string;
  entries: { setting_ref: string; scope: ConfigScopeWire; target: unknown; current: unknown }[];
  native_profiles: { owner_ref: string; native_profile_ref: string }[];
}
/** One explicit profile edit operation as it crosses to the engine's own
 * `oi profile edit` verb (09 §12, additive). The engine judges every
 * operation through its own laws; a secret-kind set carries the reference
 * and never material. */
export type ProfileEditOpWire =
  | { action: "set"; setting_ref: string; scope: ConfigScopeWire; value?: unknown; secret_reference?: ConfigSecretReferenceWire | null }
  | { action: "remove"; setting_ref: string; scope?: ConfigScopeWire | null }
  | { action: "set_title"; title: string | null }
  | { action: "set_description"; description: string | null };

export type KernelOp =
  | {op: "native_expression"; request: {operation: "open"; path: string; expected_revision: string} | {operation: "exchange"; lease: string; request: unknown} | {operation: "close"; lease: string}}
  | {op: "setup"; request: import("../configuration/adoptionController").AdoptionRequest}
  | {op:"being_encounter";request:Record<string,unknown>}
  | {op:"expression";request:import("../expression/types").ExpressionRequest}
  | {op:"graph";project?:string;query:string;options?:import("../knowledge/graph").GraphReadOptions}
  /** One request to the O:I-owned SharedField client (kernel
   * `shared_field.rs`): `status` | `snapshot` | `read {ref}` | `publish
   * {args}` | …, carried verbatim; the hosting target and token are the
   * client's own environment, never the renderer's. */
  | {op:"shared_field";request:Record<string,unknown>}
  | { op: "invoke_action"; project?: string; invocation: ActionInvocation }
  | { op: "flow_changed_since"; project?: string; thought: Record<string, unknown> }
  | {
      op: "instance_commission";
      location: CentralLocation;
      expected_revision: string;
      content: string;
      agent_session_ref?: string;
    }
  | {op:"ground";request:import("../workspace/GroundChooser").GroundRequest}
  | {op:"composition_read";owners?:boolean}
  | {op:"system_composition_read"}
  // The configuration-plane binding (#299 C6 live leg): every operation
  // routes through the installed `oi` executable — the same engine
  // `oi config` / `oi profile` drive — so the Desktop keeps no parallel
  // product semantics. Documents cross verbatim; refused states come back
  // as named data.
  | { op: "config_registry_read" }
  | { op: "config_resolutions_read"; pairs: ConfigPairWire[] }
  | { op: "config_desired_hold"; request: ConfigRequestWire }
  | { op: "config_desired_discard"; setting_ref: string; scope: ConfigScopeWire }
  | { op: "config_plan"; requests: ConfigRequestWire[] }
  | { op: "config_apply"; requests: ConfigRequestWire[] }
  | { op: "profile_list" }
  | { op: "profile_read"; profile_ref: string }
  | { op: "profile_use_plan"; profile_ref: string }
  | { op: "profile_use_apply"; profile_ref: string }
  | { op: "profile_create"; profile_ref: string; title?: string }
  | { op: "profile_edit"; profile_ref: string; operations: ProfileEditOpWire[] }
  | { op: "config_receipts" }
  | { op: "files_list"; path: string; /** Explicit refresh: bypass the kernel's short-horizon read cache for this one read. */ fresh?: boolean }
  | { op: "file_read"; location: CentralLocation }
  | { op: "file_bytes"; location: CentralLocation }
  | { op: "agency_read"; project: string }
  | { op: "agent_definition"; project: string | null; request: import("../agency/nativeAgent").AgentRequest }
  | {op:"file_operation";location:CentralLocation;request:import("../files/client").FileRequest}
  | {op:"encounter";project:string;request:import("../encounter/client").EncounterRequest}
  /** Provision one fresh chat conversation (new-chat first Send): the kernel
   * replays the owner's own SessionSpace CLI sequence and opens the result. */
  | {op:"encounter_provision";project:string}
  | { op: "encounter_join"; session: string; request_ref: string; reply?: { answer: "grant" } | { answer: "refuse"; reason: string } | null }
  | { op: "material_read"; target: { receipt: string; state_root: string; endpoint?: string | null; expected_world_ref?: string | null } }
  | { op: "a2a_exchange"; request: Record<string, unknown> }
  | {op:"encounter_task_read";project:string;agent_session:string}
  | {op:"receiving";project:string|null;request:import("../receiving/client").ReceivingWireRequest}
  | {op:"now";project:string|null;request:import("../receiving/now").NowRequest}
  | {op:"factory_development_read";project?:string;state_path:string;read:string;subject?:string}
  | {op:"factory_project_sources"}
  | {op:"factory_build_snapshot";project?:string;state_path:string;project_ref:string;run_ref:string}
  | {op:"factory_attempt_read";state_path:string;run_ref:string}
  | {op:"factory_attempt_task_list_read";state_path:string;run_ref:string}
  | {op:"factory_attempt_task_read";state_path:string;run_ref:string;task_ref:string;limit?:number;cursor?:unknown}
  | {op:"workcell_status_read"}
  | {op:"wiki_projection_read";root:string;path:string}
  | {op:"wiki_projection_sources"}
  /** The installed harnesses' real status (`aikit --json client status`,
   * kernel `agency.rs`): detected/installed/config-dir per harness. Pull
   * read, machine-level. */
  | {op:"harness_status"}
  /** The resolved model catalogue (`aikit model-catalogue show --json`):
   * the owner's entries verbatim. Pull read, machine-level. */
  | {op:"model_catalogue"}
  /** The desktop-held default provider for NEW chats (kernel
   * `chat_defaults.rs`, `oi:cradle:chat.default-provider`): a desired-entry
   * shaped document when held, null when the owner's rows decide. */
  | {op:"chat_default_read"}
  | {op:"chat_default_hold";provider:string}
  | {op:"chat_default_discard"}
  | {op:"day_read";day_ref?:string}
  | {op:"day_source_open";day_ref?:string}
  | { op: "knowledge"; project?: string; request: KnowledgeRequest; fresh?: boolean }
  | { op: "state" }
  | { op: "world_read" }
  | { op: "world_browse"; fresh?: boolean }
  | { op: "project_browse"; project: string; fresh?: boolean }
  | { op: "project_read"; project: string }
  | { op: "sources_list"; project?: string }
  | { op: "source_open"; source_ref: SourceRef; project?: string }
  | { op: "source_restore"; source_ref: SourceRef; content: string; base_revision: string; saved_content: string }
  | { op: "source_history"; source_ref: SourceRef }
  | { op: "source_edit"; source_ref: SourceRef; content: string }
  | { op: "source_save"; source_ref: SourceRef; project?: string }
  | { op: "source_reread"; source_ref: SourceRef; project?: string }
  | {
      op: "surface_open";
      surface_id: string;
      kind: string;
      source_ref?: SourceRef;
      title: string;
    }
  | { op: "surface_close"; surface_id: string }
  | { op: "surface_focus"; surface_id: string }
  // ES1/ES4 expression-world operations (kernel `expression_world.rs`):
  // shared selection/deictic context, Surface portals, ExpressiveActs and
  // bounded local-whole bindings over exact native refs.
  | { op: "expression_world"; request: import("../expression/world").WorldRequest };

/** The outcome payloads (the Rust `KernelOpResult`, tagged snake_case).
 * The Rust seam serialises `{ receipts, #[serde(flatten)] result }`, so on
 * the wire the tag and the payload sit flat beside `receipts`. */
export type KernelOpResult =
  | {result: "native_expression"; data: unknown}
  | {result: "setup_reading"; data: unknown}
  | {result:"being_encounter";data:unknown}
  | {result:"expression";data:import("../expression/types").ExpressionResult}
  | {result:"graph_reading";reading:import("../knowledge/graph").GraphReading}
  | {result:"shared_field_reading";data:unknown}
  | {result:"action_dispatched";dispatch:ActionDispatch}
  | { result: "flow_changed_since"; reading: ChangedSinceReading }
  | { result: "instance_commissioned"; outcome: CommissionOutcome }
  | {result:"ground_reading";reading:Record<string,unknown>}
  | {result:"composition_reading";reading:import("../workspace/SystemPanel").CompositionReading}
  | {result:"system_composition_reading";reading:import("../workspace/settings/types").SystemCompositionReading}
  // Configuration-plane results: contract documents verbatim, degraded
  // states as named data (see `configuration.rs` in the kernel crate).
  | { result: "config_registry_reading"; reading: { schema: string; observed_at_unix_ms: number; mounts: ConfigurationMountState[]; composition?: import("../configuration/composition").RegistryComposition | null } }
  | { result: "config_resolutions"; resolutions: ConfigResolutionWire[] }
  | { result: "config_desired_held"; entry: unknown }
  | { result: "config_desired_discarded"; document: unknown }
  | { result: "config_planned"; plans: PlanDocumentWire[]; errors: ConfigErrorWire[] }
  | { result: "config_applied"; changeset: ChangeSetDocumentWire; owner_receipts: ReceiptDocumentWire[] }
  | { result: "profile_listing"; active_profile_ref: string | null; profiles: ProfileDocumentWire[]; degraded?: { profile_ref: string; reason: string }[] }
  | { result: "profile_reading"; profile: unknown }
  | { result: "profile_use_planning"; plan: ProfileUsePlanWire }
  | { result: "profile_used"; activation: unknown }
  | { result: "profile_created"; profile: ProfileDocumentWire }
  | { result: "profile_edited"; document: unknown }
  | { result: "config_receipts"; document: unknown }
  | {result:"file_operation";data:unknown}
  | { result:"encounter_reading";data:unknown }
  | { result:"encounter_provisioned";data:unknown }
  | { result: "agent_definition_reading"; data: unknown }
  | { result:"receiving_reading";data:unknown }
  | { result:"now_reading";data:unknown }
  | { result:"encounter_task_reading";data:unknown }
  | { result:"encounter_joined";reading:unknown }
  | { result:"native_owner_reading";owner:string;data:unknown;failure:unknown }
  | { result:"a2a_exchange";data:unknown }
  | { result:"factory_development_reading";data:unknown }
  | { result:"factory_project_sources_reading";data:unknown }
  | { result:"factory_attempt_reading";data:unknown }
  | { result:"factory_attempt_task_list_reading";data:unknown }
  | { result:"factory_attempt_task_reading";data:unknown }
  | { result:"workcell_status_reading";data:unknown }
  | { result:"wiki_projection_reading";data:unknown }
  | { result:"wiki_projection_sources_reading";data:unknown }
  | { result:"harness_status_reading";data:unknown }
  | { result:"model_catalogue_reading";data:unknown }
  | { result:"chat_default_reading";document:unknown }
  | { result:"chat_default_held";document:unknown }
  | { result:"chat_default_discarded";document:unknown }
  | { result:"day_reading";data:unknown }
  | { result: "agency_reading"; project_ref: string; spaces: unknown[]; observed_at_unix_ms: number }
  | { result: "knowledge"; data: unknown }
  | { result: "state"; snapshot: KernelSnapshotState }
  | { result: "world_read"; snapshot: KernelSnapshotState }
  | { result: "directory_read"; directory: NativeDirectory }
  | { result: "file_read"; reading: NativeFileReading }
  | { result: "file_bytes"; location: CentralLocation; revision: string; byte_len: number; mime_hint: string | null; content_base64: string }
  | { result: "sources_listed"; listing: SourceListingState }
  | { result: "source_opened"; buffer: SourceBufferState }
  | { result: "source_history"; history: SourceHistoryReading }
  | { result: "buffer_edited"; buffer: SourceBufferState }
  | {
      result: "source_saved";
      buffer: SourceBufferState;
      previous_revision: string;
      revision: string;
      changed: boolean;
    }
  | {
      result: "source_save_failed";
      buffer: SourceBufferState;
      failure:
        | {
            kind: "revision-conflict";
            source_ref: SourceRef;
            expected: string;
            current: string;
          }
        | { kind: "owner-refused"; source_ref: SourceRef; message: string }
        | { kind: "unavailable"; source_ref: SourceRef; detail: string };
    }
  | { result: "source_reread"; buffer: SourceBufferState }
  | { result: "surface_opened"; snapshot: KernelSnapshotState }
  | { result: "surface_closed"; snapshot: KernelSnapshotState }
  | { result: "surface_focused"; snapshot: KernelSnapshotState }
  | { result: "expression_world"; data: unknown };

/** One operation's outcome: the flattened result beside its receipts
 * (receipts are omitted on the wire when empty — an operation that
 * changed nothing). */
export type KernelOutcome = KernelOpResult & {
  receipts?: KernelReceipt[];
};

/** How the renderer reaches the kernel. */
export type KernelTransportStatus =
  | { kind: "tauri" }
  | { kind: "bridge"; url: string }
  | { kind: "unavailable"; reason: string };

// Central's central.world-map/v1 read models. Paths are owner locators,
// not refs manufactured by the renderer.
export interface WikiReading {
  path: string; present: boolean; space_ref?: string; revision?: number;
  child_space_refs: string[]; dangling_child_space_refs: string[]; error?: string;
}
export interface GroundArea { path: string; exists: boolean; sources: number }
export interface RelationsReading { path: string; present: boolean; declared_overrides: number; error?: string }
export interface GroundReading {
  path: string; user: GroundArea; agent_governance: GroundArea;
  agent_wiki: GroundArea & { wiki: WikiReading }; relations: RelationsReading;
}
export interface WorldProject {
  name: string; path: string; source_files: number;
  projectcentral: GroundReading & { state: string; reason?: string; error?: string; missing?: string[] };
}
export interface RootWorld {
  schema: string; root: string; ground_state: string; control: GroundReading;
  work: { path: string; exists: boolean; projects: WorldProject[] };
}
export interface ProjectWorld {
  schema: string; root: string; projection: "project"; project: WorldProject;
  position: { work_root: string; exists: boolean; index?: number; project_count: number };
}
export interface NavigatorReading {
  root: RootWorld | null; project: ProjectWorld | null;
  sources: SourceListingState | null; project_ref: string | null; error: string | null;
}

export interface SourceChangeReading {
  change_ref: string; source_ref: string; cursor: number;
  before_revision: string | null; after_revision: string | null;
  kind: string; observed_at_unix_seconds: number;
  actor: string | null; actor_kind: string | null; agent_session_ref: string | null;
}
export interface SourceHistoryReading {
  source_ref: string; world_ref: string; provider: string; cursor: number;
  changes: SourceChangeReading[];
}

/** One invocation of an owner-disclosed Action on one row/node ref — the
 * owner spellings carried verbatim (kernel `action.rs`,
 * `oi.cradle.action-dispatch/v1`). */
export interface ActionInvocation {
  /** The owner-disclosed Action spelling, verbatim (e.g. `knowledge/open`,
   * `projectcentral.wiki.read`). */
  action: string;
  /** The row/node ref the Action applies to, in the owner's own spelling. */
  target_ref: string;
  /** Optional owner-shaped input for Central Actions, merged verbatim. */
  input?: Record<string, unknown>;
}
/** The typed outcome of one Action dispatch. `invoked` carries the owner
 * payload unchanged; every other state is explicit, and owner answers are
 * carried in the owner's own words. */
export type ActionDispatch =
  | { state: "invoked"; owner_operation: string; data: unknown }
  | { state: "unsupported_action"; owner: string; detail: string }
  | { state: "malformed_ref"; detail: string }
  | { state: "unknown_owner"; action: string }
  | { state: "owner_refused"; owner_operation: string; message: string }
  | { state: "owner_unavailable"; owner_operation: string; detail: string };

export interface KnowledgeAddress { kind: "wiki" | "source" | "project-map"; value: string }
export type KnowledgeRequest = {action:"resolve";query:string} | { action: "search"; query: string } | { action: "history" } | { action: "read" | "relations" | "explain" | "use"; address: KnowledgeAddress };
export interface KnowledgeReading { document?: unknown; resource: string; provider: string; revision?: string; authority: string; content?: string; evidence: string[]; why_selected: string }
export interface KnowledgeHit { address: KnowledgeAddress; resource: string; label: string; kind: string; snippet: string; provider: string; authority: string }
export interface KnowledgeRelations { nodes: {resource: string; label: string; kind: string; address?: KnowledgeAddress}[]; edges: {from: string; to: string; relation: string;reference?:string;authored_relation?:import('../knowledge/wikiDocument').WikiEvidence;origin?:string|{provider?:string;revision?:string;authority?:string}}[]; truncated: boolean; warnings: string[] }
