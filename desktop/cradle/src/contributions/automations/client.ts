import {kernelOp} from "../../kernel/bridge";
import type {KernelTransportStatus} from "../../kernel/types";

export type RoutineRequest = {action: "list" | "methods" | "history"} | {action: "show" | "disable" | "run_now"; routine_ref: string} | {action: "create"; name: string; description?: string; method: string; proof_json: string; trigger_json: string; authority_json: string} | {action: "enable"; routine_ref: string; authority_json: string} | {action: "reprove"; routine_ref: string; proof_json: string};
export interface RoutineSummary {
  routine: string; name: string; method: string; method_revision: string;
  state: "draft" | "enabled" | "disabled" | "stale-proof";
  trigger: {kind: "manual" | "schedule" | "event" | "external"};
  scheduler?: {provider: string; observed_state: string};
}
export interface RoutineDetail extends RoutineSummary {
  method_body?: string;
  authority?: {authority_ref: string; granted: boolean; unattended: boolean};
  proof?: {proof_ref: string; verification_refs: string[]; evidence_refs: string[]};
  occurrence_error?: string;
  next_occurrences?: unknown;
}
export interface ForeignProvider {provider: string; jobs: {job_id: string; name?: string; active: boolean; reconciled: boolean; reason?: string}[]}
export interface RoutineList {routines: RoutineSummary[]; foreign_reconciliation: {providers: ForeignProvider[]}}
export interface MethodRow {id: string; name: string; payload: string; active: boolean}
export interface Invocation {invocation_ref: string; routine_ref: string; method_ref: string; trigger_observed_at: string; provider_deliveries?: {provider: string; delivery_ref: string}[]; outcome?: {status: "completed" | "failed" | "unreturned"; detail: string} | null}
export function object(value: unknown): Record<string, unknown> {return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};}
export function routineList(value: unknown): RoutineList {
  const row = object(value);
  if (!Array.isArray(row.routines) || row.routines.some(item => typeof item?.routine !== "string" || typeof item?.name !== "string" || typeof item?.state !== "string" || typeof item?.method !== "string")) throw new Error("AIKit returned an unreadable Routine list.");
  const providers = object(row.foreign_reconciliation).providers;
  if (!Array.isArray(providers) || providers.some(item => typeof item?.provider !== "string" || !Array.isArray(item?.jobs))) throw new Error("AIKit did not disclose harness timer reconciliation.");
  return {routines: row.routines as RoutineSummary[], foreign_reconciliation: {providers: providers as ForeignProvider[]}};
}
export function actionMessage(value: unknown): string {
  const row = object(value);
  if (row.state === "disabled" && typeof row.method_revision === "string") {
    const note = typeof row.note === "string" ? ` ${row.note}` : "";
    return `Reproven at ${row.method_revision}.${note}`;
  }
  if (row.state === "disabled") return "Routine disabled.";
  if (row.state === "enabled") {
    const note = typeof row.note === "string" ? ` ${row.note}` : "";
    return `Routine enabled.${note}`;
  }
  const outcome = object(row.outcome);
  const status = outcome.status === "completed" ? "Run completed" : outcome.status === "failed" ? "Run failed" : outcome.status === "unreturned" ? "Run dispatched; no completed return" : "Invocation admitted; no execution outcome returned";
  let detail = typeof outcome.detail === "string" ? outcome.detail : "";
  if (detail.trim().startsWith("{")) {
    try {
      const native = object(JSON.parse(detail));
      const error = object(native.error);
      detail = typeof error.message === "string" ? error.message : typeof native.message === "string" ? native.message : "";
    } catch { detail = "The owner returned unreadable execution details."; }
  }
  return `${status}.${detail ? ` ${detail}` : ""}`;
}
export function nextOccurrenceTimes(value: unknown): string[] {
  const rows = object(value).occurrences;
  return Array.isArray(rows) ? rows.flatMap(row => {
    const time = object(row).due_unix_ms;
    if (typeof time !== "number" || !Number.isFinite(time)) return [];
    const date = new Date(time);
    return Number.isFinite(date.getTime()) ? [date.toISOString().replace("T", " ").replace(".000Z", " UTC")] : [];
  }) : [];
}
export async function routine(transport: KernelTransportStatus, project: string | undefined, request: RoutineRequest): Promise<unknown> {
  const result = await kernelOp(transport, {op: "routine", project, request});
  if (result.error || result.outcome?.result !== "routine") throw new Error(result.error ?? "AIKit did not return this Routine operation.");
  return result.outcome.data;
}

/** The time-shapes `aikit.time-schedule/v1` declares — exactly the shapes
 * Central's civil-time policy resolves (aikit-core `ScheduleShape`). */
export type ScheduleShape =
  | {kind: "daily"; time: string}
  | {kind: "cron"; expression: string}
  | {kind: "every"; interval_ms: number}
  | {kind: "once"; rfc3339?: string; due_unix_ms?: number};
export interface RoutineAuthority {authority_ref: string; revision?: string; action_refs: string[]; granted: boolean; unattended: boolean}

function slug(name: string): string {
  const slugged = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slugged || "unnamed";
}

/** Build and validate one `aikit.time-schedule/v1` record. AIKit stays the
 * authority — these checks refuse early, in its own words, what its
 * `ScheduleRecord::validate` would refuse on arrival. */
export function scheduleRecord(name: string, shape: ScheduleShape): {schema: string; schedule_ref: string; schedule: ScheduleShape} {
  if (shape.kind === "daily") {
    const [hour, minute] = shape.time.split(":").map(part => Number.parseInt(part, 10));
    if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59 || !/^\d{1,2}:\d{2}$/.test(shape.time.trim())) throw new Error(`Daily time \`${shape.time}\` must be a valid hh:mm 24-hour wall time.`);
  } else if (shape.kind === "cron") {
    if (shape.expression.trim().split(/\s+/).length !== 5) throw new Error("A cron expression must have exactly 5 fields (minute hour day-of-month month day-of-week).");
  } else if (shape.kind === "every") {
    if (!Number.isInteger(shape.interval_ms) || shape.interval_ms <= 0) throw new Error("An every interval must be a positive whole number of milliseconds.");
  } else if (shape.kind === "once") {
    const given = [shape.rfc3339 !== undefined, shape.due_unix_ms !== undefined].filter(Boolean).length;
    if (given !== 1) throw new Error("A once schedule needs exactly one of a time or an instant.");
  }
  return {schema: "aikit.time-schedule/v1", schedule_ref: `schedule/${slug(name)}`, schedule: shape};
}

/** Build the RoutineAuthority owner document from structured fields — no raw
 * JSON in the surface. AIKit validates that the actions belong to the proven
 * Method; the client refuses the empty cases in its own words. */
export function authorityRecord(input: {authority_ref: string; revision?: string; action_refs: string; granted: boolean; unattended: boolean}): RoutineAuthority {
  const authority_ref = input.authority_ref.trim();
  const action_refs = input.action_refs.split(",").map(ref => ref.trim()).filter(Boolean);
  if (!authority_ref) throw new Error("An authority reference is required.");
  if (!action_refs.length) throw new Error("Routine authority must name at least one canonical Method Action.");
  const record: RoutineAuthority = {authority_ref, action_refs, granted: input.granted, unattended: input.unattended};
  if (input.revision?.trim()) record.revision = input.revision.trim();
  return record;
}

/** The client-side half of the proof gate: what is honestly missing before
 * `aikit routine create` may be asked at all. AIKit owns the proof itself. */
export function createRefusal(input: {name: string; method: string; proof: string}): string | undefined {
  if (!input.name.trim()) return "A Routine needs a name.";
  if (!input.method.trim()) return "A Routine needs a Method to run.";
  if (!input.proof.trim()) return "No proven basis attached. A Routine cannot be created without proof: run the Method, verify the run, and attach the basis `aikit method prove` produced.";
  if (!input.proof.trim().startsWith("@")) {
    try {JSON.parse(input.proof);} catch {return "The proven basis is not readable JSON and not an @file path.";}
  }
  return undefined;
}

/** Owner words for a create receipt — never a bare JSON dump. */
export function createReceiptMessage(value: unknown): string {
  const row = object(value);
  if (row.state === "draft" && typeof row.routine === "string") {
    const note = typeof row.note === "string" ? ` ${row.note}` : "";
    return `Created ${row.routine} in Draft.${note}`;
  }
  throw new Error("AIKit did not return a Routine creation receipt.");
}
