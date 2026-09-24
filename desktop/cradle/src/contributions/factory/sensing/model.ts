/** Owner-native sensing read model. Missing fields stay missing; only the
 * Factory CLI's exact schema is accepted as current evidence. */
export interface Interval { since_unix_ms: number; until_unix_ms: number }
export interface Coverage {
  source_ref: string; provider_ref: string; scope: string;
  state: "complete" | "empty" | "unavailable" | "truncated";
  window: Interval; records: number; pages: number;
  cursor?: string | null; reason?: string | null;
}
export interface SignalSummary {
  signal_ref: string; summary: string; source_refs: string[]; source_revision: string;
  classification: string; disposition: string;
  work_ref?: string | null; custody_ref?: string | null;
  run_ref?: string | null;
  position_ref?: string | null; now_ref?: string | null;
  return_ref?: string | null; updated_at_unix_ms: number;
  decision_needed?: string | null;
}
export interface Field {
  schema: "factory.telemetry-field/v1";
  project_world_ref: string; source_revision: string;
  observed_at_unix_ms: number; signals: SignalSummary[];
  coverage: Coverage[]; owner_basis?: unknown; absences?: unknown[];
  cursor?: string | null; counts?: Record<string, number>;
  truncated: boolean;
}
export interface SignalDetail {
  schema?: string; signal_ref?: string;
  summary?: SignalSummary;
  signal?: {signal_ref: string; observation?: {source_ref: string; provider_ref: string; source_revision: string; occurred_at_unix_ms?: number | null; observed_at_unix_ms: number; summary: string; dimension?: string; standing?: string; relation_refs?: string[]};
    decisions?: {reason?: string; evidence_refs?: string[]; decision_needed?: string | null}[];
    work?: {work_ref?: string; custody_ref?: string; run_ref?: string | null; position_ref?: string; now_ref?: string | null} | null;
    returns?: {return_ref?: string; outcome?: string; evidence_refs?: string[]; live_evidence_ref?: string | null}[]};
}
export interface Pattern {
  boundary_ref: string; signal_refs: string[]; source_refs: string[];
  records: number; affected_users: number | null; affected_sessions: number | null;
  identity_basis: string; recurrence_after_live_fix: boolean;
  prior_fix_refs: string[]; grouping_basis: string;
}
export interface TemporalReading {
  schema: "factory.telemetry-digest/v1" | "factory.telemetry-lookback/v1" | "factory.telemetry-day/v1";
  project_world_ref: string; revision: number; read_only: true;
  window: Interval; civil_basis: unknown;
  signals: SignalSummary[]; patterns: Pattern[]; coverage: Coverage[];
  counts: {records: number; affected_users: number | null; affected_sessions: number | null};
  carried_signal_refs: string[]; truncated: boolean; source_coverage_complete: boolean;
  human_day_prose_changed: false;
}
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === "string" && value.length > 0;
const integer = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value);

export function fieldOf(value: unknown): Field {
  if (!record(value) || value.schema !== "factory.telemetry-field/v1" || !text(value.project_world_ref) || !text(value.source_revision) || !integer(value.observed_at_unix_ms) || !Array.isArray(value.signals) || !Array.isArray(value.coverage) || typeof value.truncated !== "boolean") throw new Error("Factory returned an incomplete telemetry field");
  for (const signal of value.signals) {
    if (!record(signal) || !text(signal.signal_ref) || !text(signal.summary) || !text(signal.source_revision) || !Array.isArray(signal.source_refs) || !signal.source_refs.every(text) || !text(signal.classification) || !text(signal.disposition) || !integer(signal.updated_at_unix_ms)) throw new Error("Factory returned an incomplete signal summary");
  }
  for (const row of value.coverage) {
    if (!record(row) || !text(row.source_ref) || !text(row.provider_ref) || !text(row.scope) || !["complete", "empty", "unavailable", "truncated"].includes(String(row.state)) || !record(row.window) || !integer(row.window.since_unix_ms) || !integer(row.window.until_unix_ms) || !integer(row.records) || !integer(row.pages)) throw new Error("Factory returned incomplete source coverage");
  }
  return value as unknown as Field;
}

export function temporalOf(value: unknown, schema: TemporalReading["schema"]): TemporalReading {
  if (!record(value) || value.schema !== schema || value.read_only !== true || value.human_day_prose_changed !== false || !text(value.project_world_ref) || !record(value.window) || !integer(value.window.since_unix_ms) || !integer(value.window.until_unix_ms) || !Array.isArray(value.signals) || !Array.isArray(value.patterns) || !Array.isArray(value.coverage) || !record(value.counts) || !integer(value.counts.records) || typeof value.truncated !== "boolean" || typeof value.source_coverage_complete !== "boolean") throw new Error("Factory returned an incomplete read-only telemetry history");
  for (const signal of value.signals) {
    if (!record(signal) || !text(signal.signal_ref) || !text(signal.summary) || !text(signal.source_revision) || !Array.isArray(signal.source_refs) || !signal.source_refs.every(text) || !text(signal.classification) || !text(signal.disposition)) throw new Error("Factory returned an incomplete history signal");
  }
  for (const pattern of value.patterns) {
    if (!record(pattern) || !text(pattern.boundary_ref) || !Array.isArray(pattern.signal_refs) || !Array.isArray(pattern.source_refs) || !integer(pattern.records) || typeof pattern.recurrence_after_live_fix !== "boolean") throw new Error("Factory returned an incomplete history pattern");
  }
  return value as unknown as TemporalReading;
}

export const label = (value: string) => value.replace(/[-_]/g, " ");
export const when = (value: number | undefined) => integer(value) ? new Date(value).toLocaleString(undefined, {dateStyle: "medium", timeStyle: "short"}) : "time not reported";

/** Resolve only evidence-backed Run joins. One signal may name a Run directly,
 * or its work/custody may appear in Factory's inhabitation reading. */
export function runKeysForSignal(signal: SignalSummary, runs: Record<string, {run: {runRef: string}; card: {source: {statePath: string}}}>, statePath: string, inhabitation?: {runs?: {run_ref: string; positions?: {custody?: {custody_ref?: string; work_ref?: string}[]}[]}[]}): string[] {
  return Object.entries(runs).filter(([, entry]) => {
    if (entry.card.source.statePath !== statePath) return false;
    if (signal.run_ref === entry.run.runRef || signal.work_ref === entry.run.runRef) return true;
    return inhabitation?.runs?.some(run => run.run_ref === entry.run.runRef && run.positions?.some(position => position.custody?.some(custody =>
      (!!signal.custody_ref && custody.custody_ref === signal.custody_ref) || (!!signal.work_ref && custody.work_ref === signal.work_ref)))) ?? false;
  }).map(([key]) => key);
}
