/**
 * World inhabitation, as the Cradle reads it (docs/contracts/
 * WORLD-INHABITATION-V1.md) — pure functions over the owners' readings, no
 * kernel, no React.
 *
 * Readings consumed (each the owner's own document, carried verbatim):
 *   aikit.population-reading/v1   `aikit gateway who --json`        the Agents aperture
 *   aikit.inhabitation-reading/v1 `aikit whoami --position P --full` the Position page, Context
 *   aikit.refocus-reading/v1      `aikit refocus --position P`       the Context basis chain
 *   factory.inhabitation-reading/v1 `factory development inhabitation <state> [--run R]`
 *                                                                    Desk owner line, Run → Live
 *   factory.current-work/v1       `factory development current-work <state> --position P`
 *
 * The contract pins the population and current-work shapes; for the joined,
 * Refocus and Factory inhabitation readings it pins the facets and their
 * standing, and the field names consumed below are this consumer's reading of
 * that contract (snake_case, as the contract writes them; a camelCase owner
 * spelling is normalised once at ingestion by `snakeKeys`). A field the owner
 * does not write stays absent — the renderer omits the line or names the
 * absence. Nothing here infers topology: no Position, occupant or work fact
 * exists unless an owner reading states it, and an unknown is never drawn as
 * present (OpenRig TUI rule, CROSSWALK §15).
 */
import {firstSentence, refTail} from "../desk/runModel";

// ---------------------------------------------------------------------------
// Standing
// ---------------------------------------------------------------------------

export type FacetState = "present" | "absent" | "ambiguous" | "unavailable" | "not-attempted";
export const FACET_STATES: readonly FacetState[] = ["present", "absent", "ambiguous", "unavailable", "not-attempted"];
export interface Absence { facet?: string; reason?: string; source?: string }

/** One owner read as the desktop holds it: the document, or a named absence
 * (the owner could not be reached, refused, stalled, or answered another
 * schema). Never an empty reading standing in for a failure. */
export type OwnerRead<T> =
  | {state: "read"; data: T; source: string}
  | {state: "unavailable"; reason: string; source: string; kind?: string};

/** The kernel's error envelope (`{kind, message}`) → a named absence. */
export function ownerReadFailure(error: unknown, source: string): {state: "unavailable"; reason: string; source: string; kind?: string} {
  const text = String(error instanceof Error ? error.message : error ?? "").replace(/^Error:\s*/, "").trim();
  try {
    const parsed = JSON.parse(text) as {kind?: unknown; message?: unknown};
    if (parsed && typeof parsed === "object" && typeof parsed.message === "string") {
      return {state: "unavailable", reason: parsed.message.trim() || "the owner gave no reason", source, ...(typeof parsed.kind === "string" ? {kind: parsed.kind} : {})};
    }
  } catch { /* plain words already */ }
  return {state: "unavailable", reason: text || "the owner gave no reason", source};
}

/** camelCase keys → snake_case, recursively; keys that are refs (anything
 * with `:`, `/`, `-` or a leading capital) are left exactly as written. */
export function snakeKeys<T = unknown>(value: unknown): T {
  if (Array.isArray(value)) return value.map(item => snakeKeys(item)) as T;
  if (!value || typeof value !== "object") return value as T;
  const out: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
    const name = /^[a-z][a-zA-Z0-9]*$/.test(key) ? key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`) : key;
    out[name] = snakeKeys(inner);
  }
  return out as T;
}

// ---------------------------------------------------------------------------
// Owner reading shapes (only the fields this consumer reads)
// ---------------------------------------------------------------------------

export interface PopulationOccupancy {
  state?: string; generation_ref?: string; generation_ordinal?: number; kind?: string;
  agent_ref?: string; agency_ref?: string; agent_session_ref?: string; workcell_ref?: string;
  since_unix_ms?: number; presence?: string; attention?: string; reason?: string;
}
export interface PopulationCurrentWork { outcome?: string; work_ref?: string; run_ref?: string; candidates?: number; reason?: string }
export interface PopulationPosition {
  position_ref: string; handle?: string; label?: string; role_ref?: string; inherited?: boolean;
  occupancy?: PopulationOccupancy; current_work?: PopulationCurrentWork; communiques?: {undelivered?: number};
}
export interface PopulationReading {
  schema: "aikit.population-reading/v1"; project_world_ref?: string | null; local_world_ref?: string;
  positions?: PopulationPosition[]; absences?: Absence[];
}

export interface Facet { state?: string; reason?: string; source?: string; ref?: string | null; revision?: string | null; label?: string; handle?: string; [field: string]: unknown }
export interface InhabitationReading { schema: "aikit.inhabitation-reading/v1"; facets?: Record<string, Facet>; [facet: string]: unknown }

export interface RefocusLink { level?: string; ref?: string | null; label?: string | null; state?: string; reason?: string; source?: string; revision?: string | null }
export interface RefocusReading {
  schema: "aikit.refocus-reading/v1"; position_ref?: string | null;
  chain?: RefocusLink[]; now?: {root_now_ref?: string | null; child_now_ref?: string | null} | null;
  return_target?: string | {ref?: string | null} | null; changed_sources?: {ref?: string; revision?: string}[];
  nearby_work?: unknown[]; absences?: Absence[];
}

export interface FactoryCustody { custody_ref?: string; position_ref?: string; work_ref?: string; run_ref?: string; workflow_unit_ref?: string; state?: string; reason?: string }
export interface FactoryOccupantRelation {
  relation?: string; state?: string; reason?: string;
  attempt_ref?: string; execution_ref?: string; agent_ref?: string; agency_ref?: string;
  agent_session_ref?: string; session_space_ref?: string; workcell_ref?: string; harness_ref?: string; model_ref?: string;
  generation_ref?: string; placement_now_ref?: string; return_address?: string;
}
export interface FactoryRunPosition {
  position_ref: string; handle?: string; label?: string; state?: string; reason?: string;
  custody?: FactoryCustody[]; current_work?: {outcome?: string; candidates?: number | unknown[]; basis?: string};
  occupants?: FactoryOccupantRelation[];
}
export interface FactoryRunInhabitation {
  run_ref: string; positions?: FactoryRunPosition[];
  now?: {root_now_ref?: string | null; child_now_ref?: string | null} | null;
  root_now_ref?: string | null; child_now_ref?: string | null; return_address?: string | null; absences?: Absence[];
}
export interface FactoryInhabitationReading { schema?: string; contract?: string; project_ref?: string; runs?: FactoryRunInhabitation[]; absences?: Absence[] }
export interface FactoryCurrentWork { schema?: string; position_ref?: string; outcome?: string; current?: Record<string, unknown> | null; candidates?: unknown[]; considered?: number; basis?: string }

// ---------------------------------------------------------------------------
// Words
// ---------------------------------------------------------------------------

/** A Position's readable name: its label, else its handle, else the slug. */
export function positionName(row: {label?: string | null; handle?: string | null; position_ref?: string}): string {
  if (row.label?.trim()) return row.label.trim();
  if (row.handle?.trim()) return row.handle.trim();
  const slug = refTail(row.position_ref) ?? "Position";
  return slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, " ");
}

export type OccupancyMark = "●" | "◐" | "○" | "?";
export interface OccupancyView {
  state: "occupied" | "vacant" | "unavailable" | "unknown";
  mark: OccupancyMark; words: string;
  agent?: string; session?: string; workcell?: string; attention?: string;
}
/** Occupancy in words. Only an owner-stated `active` presence draws `●`;
 * an occupied Position with no reported presence is never drawn as present,
 * and a missing or unreadable occupancy is `?` with its reason. */
export function occupancyView(occupancy: PopulationOccupancy | undefined, missingReason?: string): OccupancyView {
  if (!occupancy?.state) return {state: "unknown", mark: "?", words: missingReason ? `Occupancy unknown — ${missingReason}` : "Occupancy not reported"};
  const agent = refTail(occupancy.agent_ref), workcell = refTail(occupancy.workcell_ref);
  const extra = {...(agent ? {agent} : {}), ...(occupancy.agent_session_ref ? {session: occupancy.agent_session_ref} : {}), ...(workcell ? {workcell} : {}), ...(occupancy.attention ? {attention: occupancy.attention} : {})};
  switch (occupancy.state) {
    case "occupied": {
      const presence = occupancy.presence;
      const mark: OccupancyMark = presence === "active" ? "●" : presence === "idle" ? "◐" : "○";
      return {state: "occupied", mark, words: presence ? `Occupied · ${presence}` : "Occupied · presence not reported", ...extra};
    }
    case "vacant": return {state: "vacant", mark: "○", words: "Vacant"};
    case "unavailable": return {state: "unavailable", mark: "?", words: occupancy.reason ? `Occupancy unavailable — ${occupancy.reason}` : "Occupancy unavailable"};
    default: return {state: "unknown", mark: "?", words: `Occupancy “${occupancy.state}” is not a state this view knows`};
  }
}

export interface WorkView { outcome: "none" | "one" | "ambiguous" | "unavailable"; words: string; runRef?: string; attention: boolean }
/** Current work in words. `titleOf` names a run the Desk has read; a run it
 * has not read is named by its reference tail, never guessed. */
export function workView(work: PopulationCurrentWork | FactoryRunPosition["current_work"] | undefined, titleOf?: (runRef: string) => string | undefined): WorkView {
  const outcome = work?.outcome;
  const candidates = Array.isArray(work?.candidates) ? work.candidates.length : typeof work?.candidates === "number" ? work.candidates : undefined;
  if (outcome === "one") {
    const runRef = (work as PopulationCurrentWork).run_ref ?? undefined;
    const workRef = (work as PopulationCurrentWork).work_ref ?? undefined;
    const title = runRef ? titleOf?.(runRef) : undefined;
    return {outcome: "one", words: `Working on ${title ?? refTail(workRef ?? runRef) ?? "one work item"}`, ...(runRef ? {runRef} : {}), attention: false};
  }
  if (outcome === "none") return {outcome: "none", words: "No current work", attention: false};
  if (outcome === "ambiguous") return {outcome: "ambiguous", words: `Current work is ambiguous${candidates !== undefined ? ` — ${candidates} candidates` : ""}`, attention: true};
  const reason = (work as {reason?: string} | undefined)?.reason;
  return {outcome: "unavailable", words: reason ? `Current work unavailable — ${reason}` : "Current work not reported", attention: false};
}

/** A facet in one line: a present facet's own words, else its standing and
 * reason. An unrecognised or missing standing is said as such. */
export function facetWords(facet: Facet | undefined): string {
  if (!facet) return "not reported";
  const state = facet.state ?? "";
  if (state === "present") {
    const words = facet.label ?? facet.handle ?? (typeof facet.value === "string" ? facet.value : undefined) ?? refTail(facet.ref ?? undefined);
    return [words ?? "present", facet.revision ? `revision ${facet.revision}` : undefined].filter(Boolean).join(" · ");
  }
  if ((FACET_STATES as readonly string[]).includes(state)) return facet.reason ? `${state} — ${facet.reason}` : state;
  return state ? `“${state}” (not a standing this view knows)` : "not reported";
}

/** A facet of the joined reading, whether the owner writes the facets at the
 * top level or under `facets`. */
export function facetOf(reading: InhabitationReading | undefined, name: string): Facet | undefined {
  if (!reading) return undefined;
  const value = reading.facets?.[name] ?? reading[name];
  return value && typeof value === "object" && !Array.isArray(value) ? value as Facet : undefined;
}

/** Factory's current-work reading in one line: the outcome, and every
 * candidate when it is ambiguous (named by run title when the Desk has read
 * the run, else by reference tail) with the owner's basis. */
export function currentWorkWords(reading: FactoryCurrentWork, titleOf?: (runRef: string) => string | undefined): string {
  const name = (candidate: unknown) => {
    const row = (candidate && typeof candidate === "object" ? candidate : {}) as {run_ref?: string; work_ref?: string; workflow_unit_ref?: string};
    return (row.run_ref ? titleOf?.(row.run_ref) : undefined) ?? refTail(row.work_ref ?? row.workflow_unit_ref ?? row.run_ref) ?? "a candidate";
  };
  const basis = reading.basis ? ` (${reading.basis})` : "";
  switch (reading.outcome) {
    case "one": return `one — ${name(reading.current)}${basis}`;
    case "none": return `none${typeof reading.considered === "number" ? ` of ${reading.considered} considered` : ""}${basis}`;
    case "ambiguous": return `ambiguous — ${(reading.candidates ?? []).map(name).join("; ") || "candidates not listed"}${basis}`;
    default: return reading.outcome ? `“${reading.outcome}” (not an outcome this view knows)` : "not reported";
  }
}

// ---------------------------------------------------------------------------
// The Agents aperture: who is here
// ---------------------------------------------------------------------------

export interface PositionRow {
  positionRef: string; name: string; handle?: string; role?: string; inherited: boolean;
  occupancy: OccupancyView; work: WorkView; undelivered: number;
  /** Set when the row stands on Factory's reading alone (population unread). */
  basis: "population" | "factory";
}
export interface PopulationAperture {
  state: "read" | "unavailable";
  reason?: string; source: string;
  /** Positions Factory names on the selected run, in Factory's order. */
  onRun: PositionRow[];
  /** Why the run's Positions are not shown (no run selected is not a reason). */
  runAbsence?: string;
  world: PositionRow[];
  inherited: PositionRow[];
  absences: Absence[];
}

function rowOf(position: PopulationPosition, titleOf?: (runRef: string) => string | undefined): PositionRow {
  return {
    positionRef: position.position_ref, name: positionName(position),
    ...(position.handle ? {handle: position.handle} : {}), ...(position.role_ref ? {role: refTail(position.role_ref)} : {}),
    inherited: position.inherited === true,
    occupancy: occupancyView(position.occupancy),
    work: workView(position.current_work, titleOf),
    undelivered: Math.max(0, Number(position.communiques?.undelivered ?? 0) || 0),
    basis: "population",
  };
}

/** The population aperture: every Position the owner reports, never a
 * profile list. `runPositions` is the selected run's Factory reading (when a
 * run is selected); its Positions lead, matched to the population by ref. */
export function populationAperture(read: OwnerRead<PopulationReading> | undefined, run?: RunInhabitationView, titleOf?: (runRef: string) => string | undefined): PopulationAperture {
  const source = read?.source ?? "aikit gateway who";
  const population = read?.state === "read" ? read.data : undefined;
  const rows = (population?.positions ?? []).filter(position => typeof position?.position_ref === "string").map(position => rowOf(position, titleOf));
  const byRef = new Map(rows.map(row => [row.positionRef, row]));
  const onRun: PositionRow[] = [];
  let runAbsence: string | undefined;
  if (run) {
    if (run.state === "unavailable") runAbsence = `Positions on this run couldn't be read — ${run.reason}`;
    else if (!run.positions.length) runAbsence = "Factory names no Position on this run.";
    for (const position of run.positions) {
      const known = byRef.get(position.positionRef);
      onRun.push(known ?? {
        positionRef: position.positionRef, name: position.name, ...(position.handle ? {handle: position.handle} : {}), inherited: false,
        occupancy: occupancyView(undefined, read?.state === "unavailable" ? "who is here couldn't be read" : "not in the population reading"),
        work: position.work ?? workView(undefined), undelivered: 0, basis: "factory",
      });
    }
  }
  const held = new Set(onRun.map(row => row.positionRef));
  return {
    state: read?.state === "unavailable" ? "unavailable" : "read",
    ...(read?.state === "unavailable" ? {reason: read.reason} : {}),
    source, onRun, ...(runAbsence ? {runAbsence} : {}),
    world: rows.filter(row => !row.inherited && !held.has(row.positionRef)),
    inherited: rows.filter(row => row.inherited && !held.has(row.positionRef)),
    absences: (population?.absences ?? []).filter(absence => absence && (absence.reason || absence.facet)),
  };
}

/** The search haystack for one row — words a person reads. */
export function rowMatches(row: PositionRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [row.name, row.handle, row.role, row.occupancy.words, row.occupancy.agent, row.work.words].filter(Boolean).join(" ").toLowerCase().includes(q);
}

// ---------------------------------------------------------------------------
// A run's inhabitation (Factory): Desk owner line, Run → Live, Context
// ---------------------------------------------------------------------------

export interface OccupantView { relation: string; agent?: string; session?: string; space?: string; workcell?: string; harnessModel?: string; attemptRef?: string; state?: string; reason?: string }
export interface RunPositionView {
  positionRef: string; name: string; handle?: string;
  custody: {state: string; unitRef?: string}[]; custodyWords?: string;
  occupants: OccupantView[]; work?: WorkView; ambiguity?: string;
}
export interface RunInhabitationView {
  state: "read" | "unavailable";
  reason?: string; source: string;
  positions: RunPositionView[];
  rootNow?: string; childNow?: string; returnAddress?: string;
  /** Owner-stated ambiguities, in words (an attention signal). */
  ambiguities: string[];
  absences: Absence[];
}

const RELATION_WORD: Record<string, string> = {"attempt-participant": "attempt participant", "execution-body": "execution body", "placement": "placement", "return": "return"};
const CUSTODY_ORDER = ["in-progress", "blocked", "handed-off", "released", "completed"];

/** The run's Positions from Factory's inhabitation reading (read for the
 * source, or for the run alone). A read that failed is `unavailable` with its
 * reason; a read that names no Position for the run is read-and-empty. */
export function runInhabitationView(read: OwnerRead<FactoryInhabitationReading> | undefined, runRef: string, titleOf?: (runRef: string) => string | undefined): RunInhabitationView | undefined {
  if (!read) return undefined;
  if (read.state === "unavailable") return {state: "unavailable", reason: read.reason, source: read.source, positions: [], ambiguities: [], absences: []};
  const run = (read.data.runs ?? []).find(entry => entry?.run_ref === runRef);
  const positions: RunPositionView[] = (run?.positions ?? []).filter(position => typeof position?.position_ref === "string").map(position => {
    const custody = (position.custody ?? []).map(entry => ({state: entry.state ?? "unknown", ...(entry.workflow_unit_ref ? {unitRef: entry.workflow_unit_ref} : {})}))
      .sort((a, b) => indexOr(CUSTODY_ORDER, a.state) - indexOr(CUSTODY_ORDER, b.state));
    const counts = new Map<string, number>();
    for (const entry of custody) counts.set(entry.state, (counts.get(entry.state) ?? 0) + 1);
    const custodyWords = custody.length ? [...counts].map(([state, n]) => `${n > 1 ? `${n} ` : ""}${state.replace(/-/g, " ")}`).join(", ") : undefined;
    const occupants: OccupantView[] = (position.occupants ?? []).map(occupant => {
      const harnessModel = [refTail(occupant.harness_ref), refTail(occupant.model_ref)].filter(Boolean).join(" · ");
      const agent = refTail(occupant.agent_ref), workcell = refTail(occupant.workcell_ref);
      return {
        relation: RELATION_WORD[occupant.relation ?? ""] ?? (occupant.relation ?? "relation").replace(/[-_]/g, " "),
        ...(agent ? {agent} : {}), ...(occupant.agent_session_ref ? {session: occupant.agent_session_ref} : {}),
        ...(occupant.session_space_ref ? {space: occupant.session_space_ref} : {}), ...(workcell ? {workcell} : {}),
        ...(harnessModel ? {harnessModel} : {}), ...(occupant.attempt_ref ? {attemptRef: occupant.attempt_ref} : {}),
        ...(occupant.state && occupant.state !== "present" ? {state: occupant.state} : {}), ...(occupant.reason ? {reason: occupant.reason} : {}),
      };
    });
    const work = position.current_work ? workView(position.current_work, titleOf) : undefined;
    const handle = position.handle ?? undefined;
    const who = handle ?? positionName(position);
    const ambiguity = position.state === "ambiguous"
      ? `${who}: ${position.reason ?? "the owner reports this Position as ambiguous"}`
      : work?.outcome === "ambiguous" ? `${who} carries more than one current work${work.words.includes("—") ? ` (${work.words.split("— ")[1]})` : ""}`
      : (position.occupants ?? []).some(occupant => occupant.state === "ambiguous") ? `${who}: ${(position.occupants ?? []).find(occupant => occupant.state === "ambiguous")?.reason ?? "an occupant relation is ambiguous"}`
      : undefined;
    return {positionRef: position.position_ref, name: positionName(position), ...(handle ? {handle} : {}), custody, ...(custodyWords ? {custodyWords} : {}), occupants, ...(work ? {work} : {}), ...(ambiguity ? {ambiguity} : {})};
  });
  const rootNow = run?.now?.root_now_ref ?? run?.root_now_ref ?? undefined;
  const childNow = run?.now?.child_now_ref ?? run?.child_now_ref ?? undefined;
  return {
    state: "read", source: read.source, positions,
    ...(rootNow ? {rootNow} : {}), ...(childNow ? {childNow} : {}), ...(run?.return_address ? {returnAddress: run.return_address} : {}),
    ambiguities: positions.map(position => position.ambiguity).filter((words): words is string => !!words),
    absences: [...(run?.absences ?? []), ...(read.data.absences ?? [])].filter(absence => absence && (absence.reason || absence.facet)),
  };
}
function indexOr(order: string[], value: string): number { const at = order.indexOf(value); return at < 0 ? order.length : at; }

/** The Positions that hold a run, as the Desk card names them: those with
 * live custody first (in progress, blocked), else every Position Factory
 * names on the run. Handles when the owner gives one. */
export function runOwners(view: RunInhabitationView | undefined): string[] {
  if (!view || view.state !== "read") return [];
  const live = view.positions.filter(position => position.custody.some(entry => entry.state === "in-progress" || entry.state === "blocked"));
  return (live.length ? live : view.positions).map(position => position.handle ?? position.name);
}

// ---------------------------------------------------------------------------
// Joins that must never pick silently
// ---------------------------------------------------------------------------

export interface Join<E> { outcome: "none" | "one" | "ambiguous"; entries: E[] }
/** Every entry whose sessions contain the session — exact ref identity. One
 * is a join; more than one is an ambiguity the person must see, never the
 * first match. */
export function joinBySession<E>(entries: E[], sessionsOf: (entry: E) => Set<string>, sessionRef: string | undefined): Join<E> {
  if (!sessionRef) return {outcome: "none", entries: []};
  const hits = entries.filter(entry => sessionsOf(entry).has(sessionRef));
  return {outcome: hits.length === 0 ? "none" : hits.length === 1 ? "one" : "ambiguous", entries: hits};
}

export interface LiveSession { ref: string; space?: string; attemptRef: string }
/** The sessions carrying a run NOW: the current, active attempts' bodies.
 * No fallback to a past attempt or an execution — the absence is explicit. */
export function currentSessions(attempts: {attemptRef: string; currentAttempt?: boolean; status?: string | null; body?: {agentSessionRef?: string; sessionSpaceRef?: string}}[] | undefined): Join<LiveSession> {
  const seen = new Map<string, LiveSession>();
  for (const attempt of attempts ?? []) {
    const ref = attempt.body?.agentSessionRef;
    if (!attempt.currentAttempt || attempt.status !== "active" || !ref || seen.has(ref)) continue;
    seen.set(ref, {ref, ...(attempt.body?.sessionSpaceRef ? {space: attempt.body.sessionSpaceRef} : {}), attemptRef: attempt.attemptRef});
  }
  const entries = [...seen.values()];
  return {outcome: entries.length === 0 ? "none" : entries.length === 1 ? "one" : "ambiguous", entries};
}

/** A unit's current attempt: only the attempt the owner marks current. None
 * is none (never "the last one"); more than one is reported, not chosen. */
export function currentAttemptOf<A extends {currentAttempt?: boolean}>(attempts: A[]): Join<A> {
  const current = attempts.filter(attempt => attempt.currentAttempt);
  return {outcome: current.length === 0 ? "none" : current.length === 1 ? "one" : "ambiguous", entries: current};
}

// ---------------------------------------------------------------------------
// The prepared-context basis (Context)
// ---------------------------------------------------------------------------

const LEVEL_WORD: Record<string, string> = {
  operation: "Current operation", "current-operation": "Current operation", "workflow-unit": "Workflow unit", unit: "Workflow unit",
  attempt: "Attempt", run: "Run", journey: "Journey", commission: "Commission", "project-intent": "Project intent",
  "projectcentral-ground": "ProjectCentral ground", ground: "ProjectCentral ground",
};
export interface ChainRow { level: string; words: string; state: string; ref?: string; depth: number }
/** The Refocus chain, nested from the current operation outward to the
 * ProjectCentral ground, in the owner's order. */
export function refocusChain(reading: RefocusReading | undefined): ChainRow[] {
  return (reading?.chain ?? []).filter(link => link && typeof link === "object").map((link, depth) => {
    const level = LEVEL_WORD[link.level ?? ""] ?? (link.level ? link.level.replace(/[-_]/g, " ").replace(/^./, c => c.toUpperCase()) : "Link");
    const state = link.state ?? (link.ref || link.label ? "present" : "not reported");
    const words = state === "present" || !(FACET_STATES as readonly string[]).includes(state)
      ? (link.label ? firstSentence(link.label) : refTail(link.ref ?? undefined) ?? "present")
      : link.reason ? `${state} — ${link.reason}` : state;
    return {level, words, state, ...(link.ref ? {ref: link.ref} : {}), depth};
  });
}

export interface PreparedBasis { preparedContext: string; rootNow?: string; childNow?: string; rootNowWords: string; childNowWords: string; returnDestination: string }
/** whoami's prepared-context basis: the prepared-context facet and the root
 * and child NOW refs the occupant stands in. */
export function preparedBasis(reading: InhabitationReading | undefined): PreparedBasis {
  const root = facetOf(reading, "root_now"), child = facetOf(reading, "child_now");
  const rootNow = root?.state === "present" && typeof root.ref === "string" ? root.ref : undefined;
  const childNow = child?.state === "present" && typeof child.ref === "string" ? child.ref : undefined;
  return {
    preparedContext: facetWords(facetOf(reading, "prepared_context")),
    ...(rootNow ? {rootNow} : {}), ...(childNow ? {childNow} : {}),
    rootNowWords: facetWords(root), childNowWords: facetWords(child),
    returnDestination: facetWords(facetOf(reading, "return_destination")),
  };
}

/** The joined reading's facets, in the contract's order, labelled. */
export const WHOAMI_FACETS: [string, string][] = [
  ["local_world", "Local World"], ["project_world", "Project World"], ["position", "Position"], ["occupancy", "Occupancy"],
  ["agent", "Agent"], ["agency", "Agency"], ["agent_session", "Session"], ["session_space", "Session space"], ["body", "Body"],
  ["workcell", "Workcell"], ["root_now", "Root NOW"], ["child_now", "Child NOW"], ["current_work", "Current work"], ["peers", "Peers"],
  ["prepared_context", "Prepared context"], ["authority", "Authority"], ["working_surface", "Working surface"], ["return_destination", "Return destination"],
];
