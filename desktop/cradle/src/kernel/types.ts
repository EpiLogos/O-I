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

/** The kernel's notice that what its owner readings were read from moved (`KernelEvent::ReadingsChanged`): `scopes` is non-empty,
 * each `root` | `seats` | `aikit` | `clock` | `all` | `project:<Name>`; `epoch` is the watch's change counter after the change. */
export interface ReadingsChangedReceipt extends KernelReceipt {
  event: "readings_changed";
  scopes: string[];
  epoch: number;
}

/** Ephemeral disclosure only. A gap or changed process generation requires
 * current owner readings; it cannot be accepted as an empty event history. */
export interface KernelEventReplay {
  schema: "oi.kernel-event-replay/v1";
  generation: string;
  oldest_seq: number | null;
  latest_seq: number;
  next_seq: number;
  resync_required: boolean;
  has_more: boolean;
  receipts: KernelReceipt[];
}

/** The operation payloads (the Rust `KernelOp`, tagged snake_case). */
export type {CentralLocation} from "./location";
import type {CentralLocation} from "./location";
/** QL composes the K² binding; the consumer names only texture, scale, sky and an optional event. */
export type NativeComposeRequest = { texture: [number, number]; units_per_metre: number }
  & ({sky: "none" | "now" | {epoch: string}; sky_snapshot?: never; snapshot_purpose?:'requested'}
    | {sky?: never; sky_snapshot: {schema: "ql.sky-snapshot/v1"; snapshot_ref: string; [key: string]: unknown}; snapshot_purpose?:import('../nara/identity/types').SnapshotPurpose})
  & ({event?: Record<string, unknown>; world?: never; snapshot_purpose?:'requested'}
    | {event?: never; world: {instance_ref: string; subject_ref: string; start?: Readonly<Record<string, unknown>>}});
export type NativeExpressionRequest = {operation: "open"; path: string; expected_revision: string} | {operation: "compose"; request: NativeComposeRequest} | {operation: "prepare_world"; request: NativeComposeRequest} | {operation: "exchange"; lease: string; request: unknown} | {operation: "observe"; lease: string; instance_ref: string; event_ref: string; subject_ref: string; expected_generation: string; expected_samples_elapsed: string; expected_request_id?: string} | {operation: "close"; lease: string};
/** Provenance of a composed open (`source` in `oi.native-expression-open/v1`). */
export interface NativeComposedSource { schema: "oi.native-expression-composed-source/v1"; ql_executable: string; ql_selection: "installed" | "operator-override"; ql_revision: string | null; ql_executable_sha256: string; sky: {mode: "current" | "historical"; epoch: string; snapshot_ref: string; receipt_unix_ms: number} | null; request_sha256: string; composed_at_unix_ms: number }
/** The page owner's fields (kernel/src/page.rs `apply_field`): a Being's or Thing's ties, a Flow's World, View and Container, and
 * a note or a highlight added or taken away. */
export type PageField = "title" | "colour" | "world" | "subject" | "kind" | "office" | "sources" | "place" | "anchor" | "expression"
  | "layout" | "tone" | "view" | "container" | "launch" | "note.add" | "note.remove" | "highlight.add" | "highlight.remove"
  /** A Flow's journey, as QL returned it (nara_journey.rs saves it; page.rs keeps it whole). */
  | "journey";
export type PageRequest =
  | { operation: "read"; location: CentralLocation }
  | { operation: "list"; path: string; limit?: number }
  | { operation: "mutate_field"; location: CentralLocation; expected_revision: string; field: PageField; value: unknown }
  /** The page plays: its NOW clearing allocated, or rejoined and made active. */
  | { operation: "launch"; location: CentralLocation }
  /** The playing page stops: its NOW clearing closed on the revision read. */
  | { operation: "stop"; now_ref: string; project?: string | null };
export interface NativeFileEntry { name: string; location: CentralLocation; kind: "file" | "directory" | "symlink" | "other"; byte_len: number; retrieval_allowed: boolean }
export interface NativeDirectory { schema: "central.directory-reading/v1"; location: CentralLocation; entries: NativeFileEntry[]; automatic_agent_or_model_invocation: false }
export interface NativeFileReading { schema: "central.file-reading/v1"; location: CentralLocation; revision: string; byte_len: number; content_encoding: "utf-8"; content: string; project: {name:string;path:string;project_ref:string|null} | null; source: ListedSource | null; operations?:Record<"write"|"history"|"restore",{available:boolean;reason:string|null}>; automatic_agent_or_model_invocation: false }
/** A binary-safe material reading (FND-04): `central.files.read` with
 * `encoding: "base64"`, distinct from the UTF-8 `NativeFileReading` above. */
export interface NativeFileBytes { location: CentralLocation; revision: string; byte_len: number; mime_hint: string | null; content_base64: string; source: ListedSource | null }

/** The seat instrument's reading (`seat status --json`, kernel `seat_status_read`, owner_read.rs `seat_status`), verbatim. */
export interface SeatStatusReading { schema: "central.workcell-status/v1"; recorded_at_unix_seconds: number; workcells: SeatWorkcellRow[] }
export interface SeatWorkcellRow { name: string; path: string; disk_free_gb: number; min_free_gb: number | null; hard_free_gb: number | null; last_tend: {at_unix_seconds: number; freed_mb: number; removed: unknown[]} | null; seats: SeatRow[]; drift: string[] }
export interface SeatRow { product: string; state: string; registered_branch: string | null; registered_head: string | null; claimed_by: string | null; now_ref: string | null; zones: {actor: string; regions: string[]; since_unix_seconds: number}[]; admission: {free_gb: number; soft_floor_gb: number; hard_floor_gb: number; tended_freed_mb: number; standing: string} | null; live_branch?: string | null; live_head?: string; tracked_changes?: number; untracked?: number; behind_main?: number | null; ahead_main?: number | null }
/** Central's returned-work proposals for one project (`projectcentral.source.returns`, kernel `source_returns_read`, flow.rs `SourceReturns`). */
export interface SourceReturnsReading { schema: "central.source-returns/v1"; entries: SourceReturnEntry[]; more: boolean; next_before: string | null; authored_source_mutated: boolean }
/** One return: `status` is Central's own word — pending, applying, accepted or rejected. */
export interface SourceReturnEntry { return_ref: string; source_ref: string; basis_revision: string; status: string; agent_session_ref: string; current_revision: string }
/** AIKit's declared gateway endpoints of other Workcells (`aikit gateway remote list --json`, kernel `gateway_remotes_read`): the envelope's data, verbatim. */
export interface GatewayRemotesReading { schema: "aikit.gateway-remotes/v1"; remotes: GatewayRemote[] }
/** One declared remote: its token's location, never the token. */
export interface GatewayRemote { workcell_ref: string; websocket_bind: string; websocket_path: string; token_location: string }

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

/** Kernel-owned appearance; observations are advisory renderer disclosures only. */
export interface PresentationTheme { appearance: "light" | "dark" | "system"; id: string | null }
export interface PresentationCustomTheme { id: string; name: string; appearance: "light" | "dark"; preview: {ground:string;ink:string;accent:string;strip:string[]}; variables:Record<string,string> }
export interface PresentationDocument { schema:"oi.presentation/v1";revision:number;theme:PresentationTheme;custom_themes:PresentationCustomTheme[];observations:Record<string,{standing:"advisory-renderer-observation";visuals:unknown;arrangement:unknown}> }

/** Bounded native decision episodes; references are not authority by themselves. */
export type DecisionQuestion =
 | {type:"noul";instructions?:unknown;criteria?:Record<"true"|"false",unknown>|null}
 | {type:"choice";instructions?:unknown;criteria:Record<string,unknown>}
 | {type:"score";instructions?:unknown;criteria:unknown[]};
export interface DecisionTariff {model_version:string;source:string;max_input_tokens_per_attempt:number;max_output_tokens_per_attempt:number;input_microusd_per_million_tokens:number;output_microusd_per_million_tokens:number}
export interface DecisionLimits {timeout_ms:number;max_attempts:number;max_total_reserved_microusd:number;tariff:DecisionTariff}
export interface DecisionProposal {project?:string|null;observer_id?:string|null;sites:string[];agent_questions?:Record<string,DecisionQuestion>;credential_ref:string;limits:DecisionLimits;episode_budget_microusd:number;episode_seconds:number}
export interface DecisionPreflight {schema:"oi.decision-preflight/v1";preflight_ref:string;basis_digest:string;proposal:DecisionProposal;basis:{scope_ref:string;source_refs:string[];inputs:Record<string,unknown>};questions:Record<string,DecisionQuestion>;expires_at_unix_seconds:number}
export interface DecisionEpisode {episode_ref:string;authority_ref:string;scope_ref:string;source_refs:string[];sites:string[];credential_ref:string;limits:DecisionLimits;budget_microusd:number;spent_microusd:number;reserved_microusd:number;expires_at_unix_seconds:number;revoked:boolean}
export interface DecisionReceipt {schema:"oi.decision-receipt/v1";decision_ref:string;authority_ref:string;episode_ref:string;scope_ref:string;sites:string[];basis_digest:string;questions:Record<string,DecisionQuestion>;outcome:string;model_version:string|null;answers:Record<string,unknown>|null;usage:unknown;cost_microusd:number;unknown_reserved_microusd:number;provider_receipts:unknown[];reason:string|null;cached_from:string|null}
export interface DecisionReading {schema:"oi.decision-reading/v1";sites:{name:string;label:string;plane:string;input:string;questions:Record<string,DecisionQuestion>;max_reserved_microusd:number;gate_behavior:string}[];episodes:DecisionEpisode[];receipts:DecisionReceipt[];standing:string}

export interface DictationStipulation {revision:number;stt_url:string}
export type NativeDictationOutcome={kind:"transcript";text:string}|{kind:"service-down";detail:string;endpoint:string}|{kind:"failed";detail:string}|{kind:"empty"};
export interface RetainedFileRecovery {retained:{standing:"last-native-reading";observed_at_unix_ms:number;reading:NativeFileReading}|null;migration_allowed:boolean;reason:string}
/** A register's world body as the Wiki owner reads it (kernel construction.rs read_body; AIKit `aikit.world-body/v1`). `body` is null while the root space carries none. */
export interface WorldBodyReading {schema:"oi.world-body-reading/v1";register:string|null;space:{ref:string;revision:number;title?:string|null};disclosed_revision:number;body:unknown;wiki_source:{path:string;ref:string;revision:string};owner_operation:string}
export type KernelOp =
  | {op:"file_last_reading";location:CentralLocation}
  | {op:"dictation_read"}
  | {op:"dictation_configure";stt_url:string;expected_revision:number}
  | {op:"dictation_probe"}
  | {op:"dictation_transcribe";capture_ref:string;wav_base64:string}
  | {op:"decision_read"}
  | {op:"decision_preflight";proposal:DecisionProposal}
  | {op:"decide";preflight_ref:string;authority_ref:string}
  | {op:"decision_episode_revoke";authority_ref:string}
  | {op:"git_repository_read";project:string}
  | {op:"git_diff_read";request:{repo_root:string;from:string;to:string;ignore_whitespace?:boolean;max_bytes?:number;max_files?:number}}
  | {op:"world_body_read";project?:string|null}
  | {op:"presentation_read"}
  | {op:"presentation_observe";window_id:string;visuals:unknown;arrangement:unknown}
  | {op:"theme_import";theme:PresentationCustomTheme}
  | {op:"theme_apply";appearance:"light"|"dark"|"system";id?:string|null}
  | {op:"theme_revert"}
  | {op:"theme_remove";id:string}
  | {op:"nara_decision_record";decision:import("../nara/session").SpeechToolDecision}
  | {op:"nara_epii";project:string;request:import("../nara/epiiTypes").NativeEpiiRequest}
  | {op:"nara_expressive_act";project:string;request:import("../nara/nativeExpressiveAct").NativeExpressiveActRequest}
  | {op:"nara_current";project:string;request:import("../nara/nativeCurrent").NativeCurrentRequest}
  | {op:"m3_reception";project:string;request:import("../nara/nativeM3").NativeM3Request}
  | {op:"nara_presence";project:string;request:import("../nara/nativePresence").NativePresenceRequest}
  | {op:"nara_coordinate";request:import("../nara/coordinateExpression").CoordinateRequest}
  | {op:"nara_identity";request:import("../nara/identity/types").NaraIdentityRequest}
  | {op:"nara_voice";project:string;request:import("../nara/nativeVoice").NativeVoiceRequest}
  | {op:"nara_dialogue";project:string;request:import("../nara/nativeDialogue").NativeDialogueRequest}
  /** A journey on its Flow page (kernel/src/nara_journey.rs): opened once, an act, or read. */
  | {op:"nara_journey";request:import("../nara/journey").NaraJourneyRequest}
  /** Nara's lived context from your pages and Day (kernel/src/nara_lived_context.rs). */
  | {op:"nara_lived_context";request:import("../nara/livedContext").LivedContextRequest}
  /** Your elemental map from your saved identity (kernel/src/nara_elemental.rs). */
  | {op:"nara_elemental";request:import("../nara/elemental").NaraElementalRequest}
  | {op: "native_expression"; request: NativeExpressionRequest}
  | {op: "world_resolve"; world_id?: string; verify?: boolean}
  | {op: "setup"; request: import("../configuration/adoptionController").AdoptionRequest}
  | {op:"being_encounter";request:Record<string,unknown>}
  | {op:"hosted_native";source_world_ref:string;request:KernelOp}
  | {op:"expression";request:import("../expression/types").ExpressionRequest}
  | {op:"expression_recovery";request:import("../expressions/recoveryTypes").ExpressionRecoveryRequest}
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
  // The installed quaternal-logic's mode catalogue (ql.music-modes/v1), verbatim.
  | {op:"music_modes_read"}
  // The installed quaternal-logic's Jankó surface window (ql.janko-surface/v1), verbatim; each argument left out is the owner's default.
  | {op:"janko_window_read";lens?:number;first_column?:number;columns?:number}
  // The Live set reading ({summary, document, revision}) for one absolute .als path: the owner read the 8787 seam served at /api/set.
  | {op:"live_set_read";path:string}
  // Every live-dynamics device parameter table, keyed by document element name.
  | {op:"live_device_descriptors"}
  // One device's stored parameter values on one track.
  | {op:"live_device_params_read";path:string;track:string;device:string}
  // Validate one stored parameter against its table's extent and write the set back in place; refusals name the law.
  | {op:"live_device_param_write";path:string;track:string;device_name:string;param_id:string;value:unknown}
  // One clip read whole (markers, launch, follow actions, scale, notes, envelopes) with the set's revision; track by its place in the document.
  | {op:"live_clip_read";path:string;track:number;clip:LiveClipAt}
  // Change a clip's settings (the design's words) and/or a MIDI clip's notes against the set's revision; refusals name Live's values.
  | {op:"live_clip_write";path:string;expected_revision:string;track:number;clip:LiveClipAt;set?:Record<string,unknown>;notes?:LiveNote[];envelopes?:{device:string;parameter:string;points:[number,number][]}[]}
  // Change one control of a track's mixer row (activator, solo, arm, monitor, or a send by its index, 0 = Send A) against the set's revision.
  | {op:"live_track_mixer_write";path:string;expected_revision:string;track:number;control:"activator"|"solo"|"arm"|"monitor"|"send";value:boolean|"in"|"auto"|"off"|number;index?:number}
  // Comp: copy a stretch (beats) of a track's take lane into its main lane against the set's revision; the copy carries its take's TakeId.
  | {op:"live_take_comp";path:string;expected_revision:string;track:number;take:number;range:{start:number;end:number}}
  // The set's Groove Pool (each groove's Base, Quantize, Timing, Random, Velocity; the set's Global Amount) with its revision.
  | {op:"live_groove_pool_read";path:string}
  // One groove's setting, or with no groove the set's Global Amount ("amount"), against the set's revision.
  | {op:"live_groove_pool_write";path:string;expected_revision:string;groove?:number;field:LiveGrooveField|"amount";value:number|string}
  // The configuration-plane binding (#299 C6 live leg): every operation
  // routes through the installed `oi` executable — the same engine
  // `oi config` / `oi profile` drive — so the Desktop keeps no parallel
  // product semantics. Documents cross verbatim; refused states come back
  // as named data.
  | { op: "config_registry_read" }
  | { op: "config_capabilities_read" }
  | { op: "config_reset"; setting_ref: string; scope: ConfigScopeWire }
  | { op: "config_resolutions_read"; pairs: ConfigPairWire[] }
  | { op: "config_desired_hold"; request: ConfigRequestWire }
  | { op: "config_desired_discard"; setting_ref: string; scope: ConfigScopeWire }
  | { op: "config_plan"; requests: ConfigRequestWire[] }
  | { op: "config_plan_reviewed"; requests: ConfigRequestWire[] }
  | { op: "config_apply"; requests: ConfigRequestWire[] }
  | { op: "config_apply_reviewed"; changeset: ChangeSetDocumentWire; plans: unknown[] }
  | { op: "profile_list" }
  | { op: "profile_read"; profile_ref: string }
  | { op: "profile_use_plan"; profile_ref: string }
  | { op: "profile_use_apply"; profile_ref: string }
  | { op: "profile_create"; profile_ref: string; title?: string }
  | { op: "profile_edit"; profile_ref: string; operations: ProfileEditOpWire[] }
  | { op: "config_receipts" }
  | { op: "file_resolve"; reference: string }
  | { op: "files_list"; path: string; /** Explicit refresh: bypass the kernel's short-horizon read cache for this one read. */ fresh?: boolean }
  | { op: "file_read"; location: CentralLocation }
  /** A page (a Being, a Thing, a Flow): read, a world's pages listed, or one field written on the revision read (kernel/src/page.rs). */
  | { op: "page"; request: PageRequest }
  | { op: "file_bytes"; location: CentralLocation }
  | {op:"working_surface_read";project:string;agent_session:string;binding?:string}
  | {op:"working_surface_attachment";project:string;agent_session:string;binding:string}
  | {op:"recording_capability_read"}
  /** Which contracts the kernel speaks and enforces (oi.kernel-protocol/v1). */
  | {op:"protocol_read"}
  /** The AIKit gateway's canonical session surface for one harness binding; the gateway's answer or named refusal passes through verbatim. */
  | {op:"harness_agent_read";binding:string}
  /** Drive a conversation lifecycle control on the binding's gateway (the kernel owns no session state). */
  | {op:"harness_agent_control";binding:string;control:"new"|"stop"|"restart"|"pause"|"resume"}
  | { op: "agency_read"; project: string }
  | { op: "model_roster"; project?: string }
  | { op: "agent_definition"; project: string | null; request: import("../agency/nativeAgent").AgentRequest }
  /** The human Agent card, derived by the installed `oi agent card` (read only). */
  | { op: "agent_card"; agent_ref: string; world_ref: string | null }
  | {op:"file_operation";location:CentralLocation;request:import("../files/client").FileRequest}
  | {op:"encounter";project:string;request:import("../encounter/client").EncounterRequest}
  /** Provision one fresh chat conversation (new-chat first Send): the kernel
   * replays the owner's own SessionSpace CLI sequence and opens the result. */
  | {op:"encounter_provision";project:string;preferred_body_ref?:string}
  /** Bring a named roster Agent into a shared Flow: a fresh Agency session for exactly that Agent, its resident opened, and this one sender and Flow source admitted. */
  | {op:"flow_participant_provision";project:string;agent_ref:string;flow_ref:string;sender:string;preferred_body_ref?:string}
  | { op: "encounter_join"; session: string; request_ref: string; reply?: { answer: "grant" } | { answer: "refuse"; reason: string } | null }
  | { op: "material_read"; target: { receipt: string; state_root: string; endpoint?: string | null; expected_world_ref?: string | null } }
  | { op: "a2a_exchange"; request: Record<string, unknown> }
  | {op:"encounter_task_read";project:string;agent_session:string}
  /** One session's own settings and its bound task's (AIKit `encounter-session-settings`, aikit.encounter-session-settings/v1):
   * the track's Telemetry and Solo; the task's name, colour, activator, output style, Launch, Then, Hand off to, Quantize and
   * envelopes. Without `request` it reads; with it, a change made against `expected_revision` (absent while the session has none).
   * The owner's reading or refusal passes through verbatim. */
  | {op:"encounter_session_settings";project:string;agent_session:string;request?:EncounterSessionSettingsRequest;expected_revision?:string}
  /** Several sessions' settings read at once (aikit.encounter-session-settings-list/v1), so a view of many tracks asks once. */
  | {op:"encounter_session_settings_list";project:string;agent_sessions:string[]}
  /** Several sessions' served attempts read at once (aikit.encounter-task-attempts-list/v1): for each session, the Factory attempts
   * its bound task serves, as the Software Factory that dispatched them recorded them. The attempts themselves are Factory's. */
  | {op:"encounter_task_attempts_list";project:string;agent_sessions:string[]}
  | {op:"receiving";project:string|null;request:import("../receiving/client").ReceivingWireRequest}
  | {op:"now";project:string|null;request:import("../receiving/now").NowRequest}
  | {op:"factory_development_read";project?:string;state_path:string;read:string;subject?:string}
  | {op:"factory_build_snapshot";project?:string;state_path:string;project_ref:string;run_ref:string}
  | {op:"factory_attempt_read";state_path:string;run_ref:string}
  | {op:"factory_attempt_task_list_read";state_path:string;run_ref:string}
  | {op:"factory_attempt_task_read";state_path:string;run_ref:string;task_ref:string;limit?:number;cursor?:unknown}
  | {op:"factory_owner";request:{kind:string;[field:string]:unknown}}
  | {op:"workcell_status_read"}
  /** The seat instrument's own reading, read only (`seat status --json`): never a join, release, tend or curation. */
  | {op:"seat_status_read"}
  /** Central's source returns for one project; absent, the kernel's configured project. `limit` (1–100, owner default 20) and
   * `before` (a return file name, the listing's `next_before`) are the owner's own pagination. */
  | {op:"source_returns_read";project?:string|null;limit?:number;before?:string}
  /** AIKit's declared gateway remotes (`aikit gateway remote list --json`). */
  | {op:"gateway_remotes_read"}
  | {op:"temporal_events_read";query?:{window?:{window:"all"}|{window:"day";day_ref:string}|{window:"between";from_unix_ms:number;to_unix_ms:number};kind?:string;subject?:string;stream?:string}}
  /** World inhabitation (WORLD-INHABITATION-V1 §4): AIKit's population,
   * joined whoami and Refocus readings, schema-checked and bounded by a
   * timeout in the kernel; a failure is an error the renderer names. */
  | {op:"inhabitation_read";request:import("../contributions/factory/inhabitation/reads").InhabitationWireRequest}
  | {op:"wiki_projection_read";root:string;path:string}
  | {op:"wiki_projection_sources"}
  /** The installed harnesses' real status (`aikit --json client status`,
   * kernel `agency.rs`): detected/installed/config-dir per harness. Pull
   * read, machine-level. */
  | {op:"harness_status"}
  /** The resolved model catalogue (`aikit model-catalogue show --json`):
   * the owner's entries verbatim. Pull read, machine-level. */
  | {op:"model_catalogue"}
  /** The Decision helper's provider (`aikit --json decide status`, kernel
   * `agency.rs`): AIKit's `aikit.decision-status/v1` verbatim. Pull read,
   * machine-level; asks no model. */
  | {op:"decision_status"}
  /** The team space (`oi ql context-frame team-space --json`, kernel
   * `team_space.rs`): QL-MEF's `ql.vak-team-space/v1` verbatim — the
   * instruments the Decision helper may be asked. Pull read, machine-level. */
  | {op:"team_space"}
  /** The desktop-held default provider for NEW chats (kernel
   * `chat_defaults.rs`, `oi:cradle:chat.default-provider`): a desired-entry
   * shaped document when held, null when the owner's rows decide. */
  | {op:"chat_default_read"}
  | {op:"chat_default_hold";provider:string}
  | {op:"chat_default_discard"}
  /** Settings · Credentials (12-SETTINGS §3.4): the owner's `aikit credential`
   * verbs. `material` is a pasted key: it crosses to the kernel once and is
   * handed to AIKit on STDIN; nothing ever returns it. */
  | {op:"credential_list"}
  | {op:"credential_discover"}
  | {op:"credential_setup";credential:string;reference?:string;material?:string}
  | {op:"credential_rotate";credential:string;reference?:string;material?:string}
  | {op:"credential_verify";credential:string}
  | {op:"credential_revoke";credential:string}
  /** Settings · auth login (HARNESS-SETTINGS-RESEARCH §2a): the harness's
   * declared auth options (`aikit harness auth <slug> --json`): env-var
   * names and own-login entries, nothing executed. The login itself is a
   * terminal act — the declared argv runs in a real terminal surface. */
  | {op:"harness_auth_describe";harness:string}
  /** Settings · Harnesses (12-SETTINGS §3.2): `aikit client install <client>`. */
  | {op:"client_install";client:string}
  /** Settings · product pages (12-SETTINGS §3.9): run one owner-disclosed action. */
  | {op:"product_action_run";product_id:string;action_ref:string}
  /** Settings · read-only rows (12-SETTINGS §2, S11): reveal the owner's own file. */
  | {op:"settings_reveal";path:string}
  /** Settings · staged changes (12-SETTINGS §2): `oi config diff --json` in one call. */
  | {op:"config_diff"}
  | {op:"central";project:string|null;request:import("../central/client").CentralRequest}
  | {op:"day_read";day_ref?:string}
  | {op:"day_source_open";day_ref?:string}
  | { op: "knowledge"; project?: string; request: KnowledgeRequest; fresh?: boolean }
  | { op: "routine"; project?: string; request: import("../contributions/automations/client").RoutineRequest }
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
  | { result: "temporal_events_reading"; document: { events?: unknown[] } }
  | {result:"hosted_native";source_world_ref:string;owner_generation:string;outcome:KernelOutcome}
  | {result:"file_last_reading";recovery:RetainedFileRecovery}
  | {result:"dictation_reading";stipulation:DictationStipulation}
  | {result:"dictation_prepared";capture_ref:string;stipulation:DictationStipulation}
  | {result:"dictation_transcribed";outcome:NativeDictationOutcome}
  | {result:"decision_reading";reading:DecisionReading}
  | {result:"decision_preflight_reading";preflight:DecisionPreflight}
  | {result:"decision_episode_authorised";episode:DecisionEpisode}
  | {result:"decision_episode_revoked";episode:DecisionEpisode}
  | {result:"decision_made";receipt:DecisionReceipt}
  | {result:"git_repository_reading";document:unknown}
  | {result:"git_diff_reading";document:unknown}
  | {result:"world_body_reading";document:WorldBodyReading}
  | {result:"presentation_reading";document:PresentationDocument}
  | {result:"nara_decision_recorded";decision:unknown}
  | {result: "native_expression"; data: unknown}
  | {result: "world_resolve"; resolution: unknown}
  | {result:"nara_epii";data:import("../nara/epiiTypes").NativeEpiiResult}
  | {result:"nara_expressive_act";data:import("../nara/nativeExpressiveAct").NativeActReview|import("../nara/nativeExpressiveAct").NativeActEffect|import("../nara/nativeExpressiveAct").NativeActStatus}
  | {result:"nara_current";data:import("../nara/nativeCurrent").NativeCurrentReading}
  | {result:"m3_reception";data:import("../nara/nativeM3").NativeM3Reading}
  | {result:"nara_presence";data:import("../nara/nativePresence").NativePresenceReading}
  | {result:"nara_coordinate";data:import("../nara/coordinateExpression").CoordinateExpressionResult}
  | {result: "nara_identity"; data: import("../nara/identity/types").NaraIdentityResult}
  | {result:"nara_voice";data:import("../nara/nativeVoice").NativeVoiceResult}
  | {result:"nara_dialogue";data:import("../nara/nativeDialogue").NativeDialogueResult|import("../nara/nativeDialogue").NativeCoordinateContextResult}
  | {result:"nara_journey";data:import("../nara/journey").NaraJourneyResult}
  | {result:"nara_lived_context";data:import("../nara/livedContext").LivedContextResult}
  | {result:"nara_elemental";data:import("../nara/elemental").NaraElementalResult}
  | {result: "setup_reading"; data: unknown}
  | {result:"being_encounter";data:unknown}
  | {result:"expression";data:import("../expression/types").ExpressionResult}
  | {result:"expression_recovery";data:import("../expressions/recoveryTypes").ExpressionRecoveryResult}
  | {result:"graph_reading";reading:import("../knowledge/graph").GraphReading}
  | {result:"shared_field_reading";data:unknown}
  | {result:"action_dispatched";dispatch:ActionDispatch}
  | { result: "flow_changed_since"; reading: ChangedSinceReading }
  | { result: "instance_commissioned"; outcome: CommissionOutcome }
  | {result:"ground_reading";reading:Record<string,unknown>}
  | {result:"composition_reading";reading:import("../workspace/SystemPanel").CompositionReading}
  | {result:"system_composition_reading";reading:import("../workspace/settings/types").SystemCompositionReading}
  | {result:"music_modes_reading";document:unknown}
  | {result:"janko_window_reading";document:unknown}
  // Live document owner results: the 8787 seam's contract documents, verbatim.
  | {result:"live_set_reading";reading:{summary:unknown;document:unknown;revision:string}}
  | {result:"live_clip_reading";reading:{clip:LiveClipReading;revision:string}}
  | {result:"live_track_mixer_reading";reading:{mixer:LiveTrackMixer;revision:string}}
  | {result:"live_take_comp_reading";reading:LiveCompReading & {revision:string}}
  | {result:"live_groove_pool_reading";reading:LiveGroovePool & {revision:string}}
  | {result:"live_device_descriptors_reading";descriptors:Record<string,unknown[]>}
  | {result:"live_device_params_reading";reading:{params:unknown[]}}
  | {result:"live_device_param_written";reading:{param:unknown}}
  // Configuration-plane results: contract documents verbatim, degraded
  // states as named data (see `configuration.rs` in the kernel crate).
  | { result: "config_registry_reading"; reading: { schema: string; observed_at_unix_ms: number; mounts: ConfigurationMountState[]; composition?: import("../configuration/composition").RegistryComposition | null } }
  | { result: "config_resolutions"; resolutions: ConfigResolutionWire[] }
  | { result: "config_capabilities_reading"; document: { schema: "oi.config-capabilities/v1"; reviewed_apply: boolean; owner_plan_passthrough: boolean; native_reset: boolean; reset_basis: string } }
  | { result: "config_desired_held"; entry: unknown }
  | { result: "config_desired_discarded"; document: unknown }
  | { result: "config_planned"; plans: PlanDocumentWire[]; errors: ConfigErrorWire[] }
  | { result: "config_reviewed_planned"; changeset: ChangeSetDocumentWire; plans: PlanDocumentWire[] }
  | { result: "config_applied"; changeset: ChangeSetDocumentWire; owner_receipts: ReceiptDocumentWire[] }
  | { result: "profile_listing"; active_profile_ref: string | null; profiles: ProfileDocumentWire[]; degraded?: { profile_ref: string; reason: string }[] }
  | { result: "profile_reading"; profile: unknown }
  | { result: "profile_use_planning"; plan: ProfileUsePlanWire }
  | { result: "profile_used"; activation: unknown }
  | { result: "profile_created"; profile: ProfileDocumentWire }
  | { result: "profile_edited"; document: unknown }
  | { result: "config_receipts"; document: unknown }
  | {result:"file_operation";data:unknown}
  /** `oi.page-reading/v1`, `oi.page-list/v1` or `oi.page-mutation/v1` (kernel/src/page.rs). */
  | { result: "page_reading"; data: unknown }
  | { result:"encounter_reading";data:unknown }
  | { result:"encounter_provisioned";data:unknown }
  | { result: "agent_definition_reading"; data: unknown }
  | { result: "agent_card_reading"; data: unknown }
  | { result:"receiving_reading";data:unknown }
  | { result:"now_reading";data:unknown }
  | { result:"encounter_task_reading";data:unknown }
  | { result:"encounter_session_settings_reading";data:EncounterSessionSettingsReading }
  | { result:"encounter_session_settings_list_reading";data:EncounterSessionSettingsList }
  | { result:"encounter_task_attempts_list_reading";data:EncounterTaskAttemptsList }
  | { result:"encounter_joined";reading:unknown }
  | { result:"native_owner_reading";owner:string;data:unknown;failure:unknown }
  | { result:"a2a_exchange_difference";data:unknown }
  | { result:"factory_development_reading";data:unknown }
  | { result:"factory_attempt_reading";data:unknown }
  | { result:"factory_attempt_task_list_reading";data:unknown }
  | { result:"factory_attempt_task_reading";data:unknown }
  | { result:"workcell_status_reading";data:unknown }
  | { result:"seat_status_reading";data:SeatStatusReading }
  | { result:"source_returns_reading";data:SourceReturnsReading }
  | { result:"gateway_remotes_reading";data:GatewayRemotesReading;warnings?:unknown[] }
  | { result:"temporal_events_reading";document:unknown }
  | { result:"inhabitation_reading";data:unknown;warnings?:unknown[] }
  | { result:"wiki_projection_reading";data:unknown }
  | { result:"wiki_projection_sources_reading";data:unknown }
  | { result:"harness_status_reading";data:unknown }
  | { result:"model_catalogue_reading";data:unknown }
  | { result:"decision_status_reading";data:unknown }
  | { result:"team_space_reading";data:unknown }
  | { result:"chat_default_reading";document:unknown }
  | { result:"chat_default_held";document:unknown }
  | { result:"chat_default_discarded";document:unknown }
  | { result:"credential_reading";data:unknown }
  | { result:"credential_changed";data:unknown }
  | { result:"credential_verified";data:unknown }
  | { result:"harness_auth_reading";data:unknown }
  | { result:"client_installed";data:unknown }
  | { result:"product_action_ran";data:unknown }
  | { result:"settings_revealed";data:unknown }
  | { result:"config_diff_reading";resolutions:unknown[] }
  | { result:"day_reading";data:unknown }
  | { result:"central_reading";data:unknown }
  | {result:"working_surface_reading";document:unknown}
  | {result:"recording_capability";document:unknown}
  | {result:"protocol";document:unknown}
  | {result:"harness_agent_reading";binding:string;document:unknown}
  | {result:"harness_agent_outcome";binding:string;control:"new"|"stop"|"restart"|"pause"|"resume";document:unknown}
  | { result: "agency_reading"; project_ref: string; spaces: unknown[]; harness_disclosure?: unknown; observed_at_unix_ms: number }
  | { result: "model_roster_reading"; reading: unknown }
  | { result: "knowledge"; data: unknown }
  | { result: "routine"; data: unknown }
  | { result: "state"; snapshot: KernelSnapshotState }
  | { result: "world_read"; snapshot: KernelSnapshotState }
  | { result: "directory_read"; directory: NativeDirectory }
  | { result: "file_read"; reading: NativeFileReading }
  | { result: "file_resolved"; location: CentralLocation }
  | { result: "file_bytes"; location: CentralLocation; revision: string; byte_len: number; mime_hint: string | null; content_base64: string; source: ListedSource | null }
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
  /** The scopes of every reading this answer was made from (same strings as `readings_changed`); absent = unscoped, `[]` = kernel memory only. */
  read_scopes?: string[];
  native_owner?: {world_ref:string;owner_generation:string;receipts:KernelReceipt[]};
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
export type KnowledgeRequest = {action:"resolve";query:string} | { action: "search"; query: string } | { action: "history" | "status" } | { action: "read" | "relations" | "explain" | "use"; address: KnowledgeAddress };
export interface KnowledgeReading { document?: unknown; resource: string; provider: string; revision?: string; authority: string; content?: string; evidence: string[]; why_selected: string }
export interface KnowledgeHit { address: KnowledgeAddress; resource: string; label: string; kind: string; snippet: string; provider: string; authority: string }
export interface KnowledgeRelations { nodes: {resource: string; label: string; kind: string; address?: KnowledgeAddress}[]; edges: {from: string; to: string; relation: string;reference?:string;authored_relation?:import('../knowledge/wikiDocument').WikiEvidence;origin?:string|{provider?:string;revision?:string;authority?:string}}[]; truncated: boolean; warnings: string[] }

/** Several sessions' readings in the order asked; a session no retained SessionSpace holds answers its refusal. */
export interface EncounterSessionSettingsList {
  schema: 'aikit.encounter-session-settings-list/v1'
  readings: (EncounterSessionSettingsReading | {agent_session: string; refused: string})[]
}
/** One Factory attempt a session's bound task serves, as the dispatcher recorded it (aikit.encounter-task-attempts/v1). */
export interface ServedAttempt {
  task_ref: string
  attempt_ref: string
  run_ref: string
  /** Factory's native state holding the Run, an absolute path on this machine. */
  state_path: string
  workflow_unit: unknown
  execution_ref: string | null
  delivery_ref: string | null
  recorded_by: string
  recorded_at_unix_ms: number
}
/** One session's served attempts: those of its bound task, and those of the tasks it was bound to before. */
export interface EncounterTaskAttemptsReading {
  schema: 'aikit.encounter-task-attempts/v1'
  agent_session: string
  revision: string | null
  task_ref: string | null
  attempts: ServedAttempt[]
  earlier: ServedAttempt[]
}
/** Several sessions' readings in the order asked; a session no retained SessionSpace holds answers its refusal. */
export interface EncounterTaskAttemptsList {
  schema: 'aikit.encounter-task-attempts-list/v1'
  readings: (EncounterTaskAttemptsReading | {agent_session: string; refused: string})[]
}
/** A change to one session's settings: `null` returns a field to its default. Task fields bind to the session's bound task. */
export interface EncounterSessionSettingsRequest {
  track?: {telemetry?: boolean | null; solo?: boolean | null}
  task?: {task_ref: string; set: Partial<Record<EncounterTaskSettingKey, unknown>>}
}
export type EncounterTaskSettingKey = 'name' | 'colour' | 'active' | 'register' | 'form' | 'launch' | 'then' | 'handoff_to' | 'quantize'
  | 'envelope_mode' | 'envelope_linked' | 'effort' | 'autonomy'
/** An envelope point: [seconds from the task's start, a level word under Automation or a step −2…+2 under Modulation]. */
export type EncounterEnvelopePoint = [number, string | number]
/** The owner's reading: every value as it stands (defaults stated), `set` naming what the person set. */
export interface EncounterSessionSettingsReading {
  schema: 'aikit.encounter-session-settings/v1'
  agent_session: string
  revision: string | null
  track: {telemetry: boolean; solo: boolean; set: string[]}
  task: null | {
    task_ref: string; name: string; colour: string | null; active: boolean; register: 'plain' | 'warm' | 'terse'
    form: 'technical' | 'narrative' | 'list'; launch: 'once' | 'hold' | 'loop'; then: 'next' | 'handoff' | 'stop'; handoff_to: string | null
    quantize: 'global' | 'now' | 'next-tool' | 'next-turn'; envelope_mode: 'automation' | 'modulation'; envelope_linked: boolean
    effort: EncounterEnvelopePoint[]; autonomy: EncounterEnvelopePoint[]; set: string[]
  }
  previous_task: null | {task_ref: string; set: Record<string, unknown>}
  standing: string
}

/** Where a clip stands on its track: its arrangement index or its session slot's scene. */
export type LiveClipAt = {arrangement: number} | {slot: number}
/** One note of a MIDI clip: MIDI pitch, place and length in beats, velocity 1–127, chance 0–1. */
export interface LiveNote {id?: number; p: number; at: number; len: number; vel?: number; chance?: number; on?: boolean}
/** A clip whole, in the design's words (packages/live-set/src/edit.rs clip_reading). A value the document lacks is null. */
export interface LiveClipReading {
  kind: 'midi' | 'audio'; name: string; colourIndex: number | null; active: boolean | null
  loop?: boolean; start?: number; end?: number; position?: number; length?: number
  sig: {num: number | null; den: number | null} | null; groove: string | null
  scale: boolean | null; root: number | null; mode: string | null; scaleName: string | null
  follow: boolean | null; followA: string | null; followB: string | null; chance: number | null; linked: boolean | null; multiplier: number | null
  launch: string | null; legato: boolean | null; quantize: string | null; launchVelocity: number | null
  envelopes: LiveEnvelope[]; notes?: (LiveNote & {id: number; vel: number; chance: number; on: boolean})[]
}
/** An envelope: what it moves (the device and parameter its target sits under) and its points [[beat, value]…]. */
export interface LiveEnvelope {target: string; device: string; parameter: string; points: [number, number][]}
/** A track's mixer row; a control the track has no element for is absent. */
export interface LiveTrackMixer {activator?: boolean; solo?: boolean; arm?: boolean; monitor?: 'in' | 'auto' | 'off'; input?: string; output?: string; sends?: LiveSend[]}
/** One send of a track (Mixer/Sends/TrackSendHolder): the return track it feeds and Live's name for it ("Send A"), its level as the
 * document keeps it (linear gain) and the range beside it, and whether it is on for this track (a return's own sends are off). */
export interface LiveSend {name: string; send: string; value: number | null; min: number | null; max: number | null; on: boolean}
/** A track's take lane: its takes on the ruler, each with its TakeId and the main-lane stretches that came from it. */
export interface LiveTakeLane {name: string; clips: {name: string; start: number; end: number; takeId?: number | null; gave?: {start: number; end: number}[]}[]}
/** A track's main lane and take lanes as a comp leaves them; each main-lane clip names the take it came from. */
export interface LiveCompReading {clips: {name: string; start: number; end: number; takeId: number | null}[]; takeLanes: LiveTakeLane[]}
/** A groove's settings, as the Groove Pool shows them. */
export type LiveGrooveField = 'base' | 'quantize' | 'timing' | 'random' | 'velocity'
/** One groove of the set's pool: Base is Live's Grid ("1/4" … "1/32", triplets "1/8t", "1/16t"); the amounts are 0–100. */
export interface LiveGroove {id: number | null; name: string; base: string | null; quantize: number | null; timing: number | null; random: number | null; velocity: number | null}
/** The set's Groove Pool and its Global Amount (with the range Live keeps beside it). */
export interface LiveGroovePool {grooves: LiveGroove[]; amount: number | null; amountRange: {min: number; max: number} | null}
