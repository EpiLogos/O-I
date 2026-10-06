/** Personal-history intake over the kernel's typed Action-dispatch seam.
 *
 * Every function is one Central Action invoked verbatim
 * (`central.personal.*`); this module invents no command translation and
 * assumes no coverage: the native owner's answer envelope passes through,
 * whatever it names. The human-acceptance gate is the owner's own law on
 * the native side (`acceptance:"human-accepted"`); the surface only ever
 * sends it from an explicit owner act on a reviewed plan.
 */
import {kernelOp} from "../kernel/bridge";
import type {KernelTransportStatus} from "../kernel/types";

/** The ActionResult envelope Central returns for every action. */
export interface ActionResult<T=Record<string, unknown>> {
  ok: boolean;
  status: string;
  action: string;
  data?: T;
  error?: {code: string; message: string};
}

export interface PersonalAnchor {
  schema: string;
  person?: {
    subject_ref?: string | null; form?: string | null;
    manifest_present?: boolean; manifest_revision?: string | null;
    identity_source_path?: string | null;
    sourced_files?: {path: string; present: boolean; content_revision?: string | null}[];
    error?: string | null;
  };
  world?: {subject_ref_declared?: string | null; subject_ref_consistent?: boolean | null};
  installation?: {workcell_ref?: unknown; machine_ref?: unknown} | null;
  collections?: {
    collection_id: string; title?: string; world_ref?: string; project?: string | null;
    person_ref?: string; author_ref?: string; mode?: string;
    origin?: string | null; entries?: number; imports?: number;
  }[];
}

export interface CollectionMember {
  entry_id: string; role: string; entry_type: string; disposition: string;
  bytes: number; content_revision: string;
  event_date?: string | null; date_basis?: string | null; date_approximate?: boolean;
  readable?: boolean | null; reason?: string | null;
  entry_meta?: Record<string, string>;
}

export interface CollectionInspection {
  schema: string; origin: string; world_ref: string; adapter: string;
  members: CollectionMember[];
  counts: {retained: number; unreadable: number; "excluded-by-selection": number; total: number};
}

export interface PlanEntry {
  action: string; entry_id: string; role: string; entry_type: string;
  disposition: string; bytes: number; content_revision: string;
  origin?: string | null; destination?: string | null; source_ref: string;
  prior_revision?: string | null;
  event_date?: string | null; date_basis?: string | null; date_approximate?: boolean;
  readable?: boolean | null; reason?: string | null;
  entry_meta?: Record<string, string>;
}

export interface CollectionPlan {
  schema: string; collection_id: string; title: string; world_ref: string;
  project?: string | null; person_ref: string; author_ref: string; adapter: string;
  placement: {mode: string; home: string; origin?: string | null; accepted_plan_revision?: string | null};
  entries: PlanEntry[];
  origin_absent: string[];
  conflicts: string[];
  divergences?: string[];
  counts: Record<string, number>;
  plan_revision: string;
  undo_summary: string;
}

export interface ImportReceipt {
  sequence: number; applied_at_unix_seconds: number; adapter: string;
  entries_added: number; entries_changed: number; entries_unchanged: number;
  entries_unchanged_at_origin_absent: number; accepted_plan_revision: string;
}

export interface ApplyOutcome {
  schema: string; collection_id: string; receipt: ImportReceipt;
  record_ref: string; entries: number; refused: string[];
}

export interface RollbackReport {
  collection_id: string; import_sequence: number;
  removed_entries: string[]; restored_entries: string[]; preserved_entries: string[];
  removed_registrations: string[]; record_removed: boolean; notes: string[];
}

async function invoke<T>(transport: KernelTransportStatus, action: string, input: Record<string, unknown>, project?: string): Promise<ActionResult<T>> {
  const response = await kernelOp(transport, {
    op: "invoke_action", project,
    invocation: {action, target_ref: `central:action:${action}`, input},
  });
  if (response.outcome?.result !== "action_dispatched") {
    throw new Error(response.error ?? "the kernel returned no dispatch outcome");
  }
  return response.outcome.dispatch as unknown as ActionResult<T>;
}

export function anchorInspect(transport: KernelTransportStatus, project?: string): Promise<ActionResult<PersonalAnchor>> {
  return invoke<PersonalAnchor>(transport, "central.personal.anchor.inspect", {}, project);
}

/** The native owner surface the controller consumes — one method per
 * Central Action, the envelope passed through verbatim. Tests inject a
 * faithful stand-in; the app binds the kernel transport once. */
export interface PersonalHistoryNative {
  anchorInspect(): Promise<ActionResult<PersonalAnchor>>;
  collectionInspect(path: string): Promise<ActionResult<CollectionInspection>>;
  collectionPlan(request: Record<string, unknown>): Promise<ActionResult<CollectionPlan>>;
  collectionApply(plan: CollectionPlan): Promise<ActionResult<ApplyOutcome>>;
  collectionVerify(collectionId: string): Promise<ActionResult<Record<string, unknown>>>;
  collectionStatus(collectionId: string): Promise<ActionResult<Record<string, unknown>>>;
  collectionRollback(request: {collection_id: string; import_sequence: number; expected_record_revision: string}): Promise<ActionResult<RollbackReport>>;
  collectionList(): Promise<ActionResult<{schema: string; collections: PersonalAnchor["collections"]}>>;
}

export function createPersonalHistoryNative(transport: KernelTransportStatus, project?: string): PersonalHistoryNative {
  return {
    anchorInspect: () => anchorInspect(transport, project),
    collectionInspect: path => collectionInspect(transport, path, project),
    collectionPlan: request => collectionPlan(transport, request, project),
    collectionApply: plan => collectionApply(transport, plan, project),
    collectionVerify: collectionId => collectionVerify(transport, collectionId, project),
    collectionStatus: collectionId => collectionStatus(transport, collectionId, project),
    collectionRollback: request => collectionRollback(transport, request, project),
    collectionList: () => collectionList(transport, project),
  };
}

export function collectionInspect(transport: KernelTransportStatus, path: string, project?: string): Promise<ActionResult<CollectionInspection>> {
  return invoke<CollectionInspection>(transport, "central.personal.collection.inspect", {path}, project);
}

export function collectionPlan(transport: KernelTransportStatus, request: Record<string, unknown>, project?: string): Promise<ActionResult<CollectionPlan>> {
  return invoke<CollectionPlan>(transport, "central.personal.collection.plan", request, project);
}

/** The human act. The plan travels exactly as the native owner issued it —
 * its content identity is re-verified natively before anything is written. */
export function collectionApply(transport: KernelTransportStatus, plan: CollectionPlan, project?: string): Promise<ActionResult<ApplyOutcome>> {
  return invoke<ApplyOutcome>(transport, "central.personal.collection.apply", {plan, acceptance: "human-accepted"}, project);
}

export function collectionVerify(transport: KernelTransportStatus, collectionId: string, project?: string): Promise<ActionResult<Record<string, unknown>>> {
  return invoke(transport, "central.personal.collection.verify", {collection_id: collectionId}, project);
}

export function collectionStatus(transport: KernelTransportStatus, collectionId: string, project?: string): Promise<ActionResult<Record<string, unknown>>> {
  return invoke(transport, "central.personal.collection.status", {collection_id: collectionId}, project);
}

export function collectionRollback(transport: KernelTransportStatus, request: {collection_id: string; import_sequence: number; expected_record_revision: string}, project?: string): Promise<ActionResult<RollbackReport>> {
  return invoke<RollbackReport>(transport, "central.personal.collection.rollback", request, project);
}

export function collectionList(transport: KernelTransportStatus, project?: string): Promise<ActionResult<{schema: string; collections: PersonalAnchor["collections"]}>> {
  return invoke(transport, "central.personal.collection.list", {}, project);
}
