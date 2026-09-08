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

export type KernelOp =
  | {op:"flow";request:import("../flow/client").FlowRequest}
  | {op:"ground";request:import("../workspace/GroundChooser").GroundRequest}
  | {op:"composition_read";owners?:boolean}
  | { op: "files_list"; path: string }
  | { op: "file_read"; location: CentralLocation }
  | { op: "file_bytes"; location: CentralLocation }
  | { op: "agency_read"; project: string }
  | {op:"file_operation";location:CentralLocation;request:import("../files/client").FileRequest}
  | { op:"encounter";project:string;request:import("../encounter/client").EncounterRequest }
  | { op: "knowledge"; project?: string; request: KnowledgeRequest }
  | { op: "state" }
  | { op: "world_read" }
  | { op: "world_browse" }
  | { op: "project_browse"; project: string }
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
  | { op: "surface_focus"; surface_id: string };

/** The outcome payloads (the Rust `KernelOpResult`, tagged snake_case).
 * The Rust seam serialises `{ receipts, #[serde(flatten)] result }`, so on
 * the wire the tag and the payload sit flat beside `receipts`. */
export type KernelOpResult =
  | {result:"flow";response:{kind:"flow_created"|"flow_read"|"flow_written";reading:{flow:import("../flow/client").FlowRecord;content?:string}}|{kind:"failure";error:{kind:string;message?:string;detail?:string}}}
  | {result:"ground_reading";reading:Record<string,unknown>}
  | {result:"composition_reading";reading:import("../workspace/SystemPanel").CompositionReading}
  | {result:"file_operation";data:unknown}
  | { result:"encounter_reading";data:unknown }
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
  | { result: "surface_focused"; snapshot: KernelSnapshotState };

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

export interface KnowledgeAddress { kind: "wiki" | "source" | "project-map"; value: string }
export type KnowledgeRequest = { action: "search"; query: string } | { action: "history" } | { action: "read" | "relations" | "explain" | "use"; address: KnowledgeAddress };
export interface KnowledgeReading { resource: string; provider: string; revision?: string; authority: string; content?: string; evidence: string[]; why_selected: string }
export interface KnowledgeHit { address: KnowledgeAddress; resource: string; label: string; kind: string; snippet: string; provider: string; authority: string }
export interface KnowledgeRelations { nodes: {resource: string; label: string; kind: string}[]; edges: {from: string; to: string; relation: string}[]; truncated: boolean; warnings: string[] }
