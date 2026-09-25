import {kernelOp} from "../../kernel/bridge";
import type {KernelTransportStatus} from "../../kernel/types";

export type RoutineRequest = {action: "list" | "methods" | "history"} | {action: "show" | "disable" | "run_now"; routine_ref: string};
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
  if (row.state === "disabled") return "Routine disabled.";
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
