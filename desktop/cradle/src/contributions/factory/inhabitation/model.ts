/**
 * World inhabitation, as the Cradle reads it (docs/contracts/
 * WORLD-INHABITATION-V1.md) — pure functions over the owners' readings, no
 * kernel, no React.
 *
 * Readings consumed (each the owner's own document; AIKit's `--json`
 * envelope is unwrapped in the kernel, its warnings carried beside):
 *   aikit.population-reading/v1     `aikit gateway who [--project-world W]`   Agents aperture, names
 *   aikit.inhabitation-reading/v1   `aikit whoami --position P --full`         Position page, Context
 *   aikit.refocus-reading/v1        `aikit refocus --position P`               Context basis chain
 *   factory.inhabitation-reading/v1 `factory development inhabitation <state> [--run R]`
 *                                                                              Desk owner line, Run → Live
 *   factory.current-work/v1         `factory development current-work <state> --position P`
 *                                                                              ambiguity, Position page
 *
 * The shapes below are the installed owners' (aikit 71a9972c, factory
 * f0f4d7c3), read from their actual output. Joins are by ref identity only
 * (a Factory Position is named by the population row with the same ref). A
 * field the owner does not write stays absent — the renderer omits the line
 * or names the absence. Nothing here infers topology, and an unknown is never
 * drawn as present (OpenRig TUI rule, CROSSWALK §15). Where an owner reading
 * is itself wrong (a summary naming `?`, a null run ref) the view shows the
 * owner's value as given: defects are reported to the owner, not patched here.
 */
import {firstSentence, refTail} from "../desk/runModel";

// ---------------------------------------------------------------------------
// Standing
// ---------------------------------------------------------------------------

export type FacetState = "present" | "absent" | "ambiguous" | "unavailable" | "not-attempted";
export const FACET_STATES: readonly FacetState[] = ["present", "absent", "ambiguous", "unavailable", "not-attempted"];
export interface Absence { facet?: string; reason?: string; source?: string }

/** One owner read as the desktop holds it: the document (with the AIKit
 * envelope's warnings, when any), or a named absence (the owner could not be
 * reached, refused, stalled, or answered another schema). Never an empty
 * reading standing in for a failure. */
export type OwnerRead<T> =
  | {state: "read"; data: T; source: string; warnings?: unknown[]}
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

/** An envelope warning in words (`message`, else the value itself). */
export function warningWords(warning: unknown): string {
  if (typeof warning === "string") return warning;
  if (warning && typeof warning === "object" && typeof (warning as {message?: unknown}).message === "string") return (warning as {message: string}).message;
  return JSON.stringify(warning);
}

/** camelCase keys → snake_case, recursively; keys that are refs (anything
 * with `:`, `/`, `-` or a leading capital) are left exactly as written. The
 * installed owners already write snake_case; this only guards the boundary. */
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

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown): string | undefined => typeof value === "string" && value.trim() ? value : undefined;

// ---------------------------------------------------------------------------
// Owner reading shapes (the fields this consumer reads)
// ---------------------------------------------------------------------------

export interface PopulationOccupancy {
  state?: string; generation_ref?: string | null; generation_ordinal?: number | null; kind?: string | null;
  agent_ref?: string | null; agency_ref?: string | null; agent_session_ref?: string | null; workcell_ref?: string | null;
  since_unix_ms?: number | null; presence?: string | null; attention?: string | null;
}
export interface PopulationCurrentWork { outcome?: string; work_ref?: string | null; run_ref?: string | null; custody_ref?: string | null; candidates?: number | null }
export interface PopulationPosition {
  position_ref: string; handle?: string | null; label?: string | null; role_ref?: string | null; inherited?: boolean;
  /** Whether Central defines this Position: present | absent | unavailable. */
  definition?: string;
  occupancy?: PopulationOccupancy; current_work?: PopulationCurrentWork;
  /** `undelivered: null` = the Gateway journal could not be read (see absences). */
  communiques?: {undelivered?: number | null};
}
export interface PopulationReading {
  schema: "aikit.population-reading/v1"; project_world_ref?: string | null; local_world_ref?: string;
  positions?: PopulationPosition[]; absences?: Absence[];
}

/** One facet of the joined reading: `{state, reason?, source, summary?,
 * next?, value?}`. */
export interface Facet { state?: string; reason?: string; source?: string; summary?: string; next?: string; value?: unknown }
export interface InhabitationReading {
  schema: "aikit.inhabitation-reading/v1"; position_ref?: string | null; resolved_by?: string; depth?: string;
  facets?: Record<string, Facet>; identity?: Record<string, unknown>;
}

/** One hop of the Refocus trace: a ref (with revision and detail) or a gap. */
export interface RefocusHop { hop?: string; ref?: string | null; revision?: string | null; detail?: string | null; gap?: string | null; source?: string }
export interface RefocusReading {
  schema: "aikit.refocus-reading/v1"; chain?: RefocusHop[]; position?: string | null; root_now?: string | null;
  return_target?: string | null; nearby?: unknown[]; trigger?: string; why?: string; text?: string;
}

/** Factory's facet: `{state, value?, reason?, source}` (value is a string). */
export interface FactoryFacet { state?: string; value?: string | null; reason?: string; source?: string }
export interface FactoryCustodySummary { custody_ref?: string; state?: string; work_ref?: string; workflow_unit_ref?: string | null }
export interface FactoryPositionInRun { position_ref: string; in_custody?: boolean; custody?: FactoryCustodySummary[]; attempt_refs?: string[]; current_attempt_refs?: string[] }
export interface FactoryOccupant {
  attempt_ref: string; task_ref?: string; workflow_unit_ref?: string; execution_ref?: string;
  current_attempt?: boolean; leg_status?: string | null;
  participant?: Record<string, FactoryFacet | undefined>;
  body?: Record<string, FactoryFacet | undefined>;
  placement?: {now_ref?: FactoryFacet};
  return_address?: FactoryFacet;
}
export interface FactoryRunInhabitation {
  run_ref: string; lifecycle?: string; journey_refs?: string[];
  positions?: FactoryPositionInRun[]; custody?: Record<string, unknown>[]; occupants?: FactoryOccupant[];
}
export interface FactoryInhabitationReading {
  schema?: string; project_ref?: string; central_project_ref?: FactoryFacet;
  filter?: {run_ref?: string | null; position_ref?: string | null};
  runs?: FactoryRunInhabitation[]; custody_outside_runs?: Record<string, unknown>[];
}
export interface FactoryWorkCandidate { source?: string; source_ref?: string; resolution?: string; node_ref?: string; work_ref?: string | null; run_ref?: string | null; journey_ref?: string | null; status?: string }
export interface FactoryCurrentWork {
  schema?: string; position_ref?: string; project_ref?: string; outcome?: string;
  current?: {node_ref?: string; kind?: string; work_refs?: string[]; journey_refs?: string[]; custody_refs?: string[]; attempt_refs?: string[]} | null;
  candidates?: FactoryWorkCandidate[]; considered?: number; basis?: string;
}

/** A Position's names as Central defines them (from the population). */
export interface PositionNames { handle?: string; label?: string }
export type NameLookup = (positionRef: string) => PositionNames | undefined;
export type TitleLookup = (runRef: string) => string | undefined;

/** Every Position's names in a population reading, by ref. */
export function namesOf(population: PopulationReading | undefined): Record<string, PositionNames> {
  const out: Record<string, PositionNames> = {};
  for (const row of population?.positions ?? []) {
    if (typeof row?.position_ref !== "string") continue;
    out[row.position_ref] = {...(text(row.handle) ? {handle: row.handle!} : {}), ...(text(row.label) ? {label: row.label!} : {})};
  }
  return out;
}

// ---------------------------------------------------------------------------
// Words
// ---------------------------------------------------------------------------

/** A Position's readable name: its label, else its handle, else the ref's
 * last segment (said as the ref's own words — never turned into a handle). */
export function positionName(row: {label?: string | null; handle?: string | null; position_ref?: string}): string {
  if (row.label?.trim()) return row.label.trim();
  if (row.handle?.trim()) return row.handle.trim();
  return refTail(row.position_ref) ?? "Position";
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
  const agent = refTail(occupancy.agent_ref ?? undefined), workcell = refTail(occupancy.workcell_ref ?? undefined);
  const extra = {...(agent ? {agent} : {}), ...(occupancy.agent_session_ref ? {session: occupancy.agent_session_ref} : {}), ...(workcell ? {workcell} : {}), ...(occupancy.attention ? {attention: occupancy.attention} : {})};
  switch (occupancy.state) {
    case "occupied": {
      const presence = occupancy.presence ?? undefined;
      const mark: OccupancyMark = presence === "active" ? "●" : presence === "idle" ? "◐" : "○";
      return {state: "occupied", mark, words: presence ? `Occupied · ${presence}` : "Occupied · presence not reported", ...extra};
    }
    case "vacant": return {state: "vacant", mark: "○", words: "Vacant"};
    case "unavailable": return {state: "unavailable", mark: "?", words: "Occupancy unavailable"};
    default: return {state: "unknown", mark: "?", words: `Occupancy “${occupancy.state}” is not a state this view knows`};
  }
}

export interface WorkView { outcome: "none" | "one" | "ambiguous" | "unavailable"; words: string; runRef?: string; attention: boolean }
/** The population's current-work summary in words. The work is named by the
 * run's title when the owner gives a run the Desk has read, else by the work
 * ref's own last segment — as given, never guessed. */
export function workView(work: PopulationCurrentWork | undefined, titleOf?: TitleLookup, absenceReason?: string): WorkView {
  const outcome = work?.outcome;
  if (outcome === "one") {
    const runRef = work?.run_ref ?? undefined;
    const title = runRef ? titleOf?.(runRef) : undefined;
    return {outcome: "one", words: `Working on ${title ?? refTail(work?.work_ref ?? runRef ?? undefined) ?? "one work item"}`, ...(runRef ? {runRef} : {}), attention: false};
  }
  if (outcome === "none") return {outcome: "none", words: "No current work", attention: false};
  if (outcome === "ambiguous") {
    const n = typeof work?.candidates === "number" ? work.candidates : undefined;
    return {outcome: "ambiguous", words: `Current work is ambiguous${n !== undefined ? ` — ${n} candidates` : ""}`, attention: true};
  }
  return {outcome: "unavailable", words: absenceReason ? `Current work unavailable — ${absenceReason}` : outcome ? `Current work ${outcome}` : "Current work not reported", attention: false};
}

/** Factory's own current-work reading as a WorkView (the authority for
 * custody; used on the Desk and in Live). */
export function factoryWorkView(reading: FactoryCurrentWork | undefined, titleOf?: TitleLookup): WorkView | undefined {
  if (!reading?.outcome) return undefined;
  if (reading.outcome === "none") return {outcome: "none", words: "No current work", attention: false};
  if (reading.outcome === "one") {
    const runRef = (reading.candidates ?? []).map(candidate => candidate.run_ref).find((ref): ref is string => !!ref);
    const title = runRef ? titleOf?.(runRef) : undefined;
    return {outcome: "one", words: `Working on ${title ?? refTail(reading.current?.node_ref) ?? "one work item"}`, ...(runRef ? {runRef} : {}), attention: false};
  }
  if (reading.outcome === "ambiguous") return {outcome: "ambiguous", words: `Current work is ambiguous — ${(reading.candidates ?? []).length} candidates`, attention: true};
  return {outcome: "unavailable", words: `Current work “${reading.outcome}” (not an outcome this view knows)`, attention: false};
}

/** Factory's current-work reading in one line: the outcome, the node and the
 * runs its candidates name (by title when the Desk has read them), and every
 * candidate of an ambiguity with the owner's basis — never collapsed to one. */
export function currentWorkWords(reading: FactoryCurrentWork, titleOf?: TitleLookup): string {
  const run = (ref: string | null | undefined) => ref ? titleOf?.(ref) ?? refTail(ref) : undefined;
  const candidate = (row: FactoryWorkCandidate) => {
    const node = refTail(row.node_ref ?? row.work_ref ?? undefined) ?? "a candidate";
    const runWords = run(row.run_ref);
    return `${node}${runWords ? ` (run: ${runWords})` : ""}${row.status ? ` [${row.status}]` : ""}`;
  };
  const basis = reading.basis ? ` — ${reading.basis}` : "";
  switch (reading.outcome) {
    case "one": {
      const runs = [...new Set((reading.candidates ?? []).map(row => run(row.run_ref)).filter(Boolean))];
      return `one: ${refTail(reading.current?.node_ref) ?? "one work node"}${runs.length ? ` (run: ${runs.join("; ")})` : ""}${basis}`;
    }
    case "none": return `none${typeof reading.considered === "number" ? ` (${reading.considered} considered)` : ""}${basis}`;
    case "ambiguous": return `ambiguous: ${(reading.candidates ?? []).map(candidate).join("; ") || "candidates not listed"}${basis}`;
    default: return reading.outcome ? `“${reading.outcome}” (not an outcome this view knows)` : "not reported";
  }
}

/** A facet of the joined reading, whether the owner writes the facets under
 * `facets` (the installed owner) or at the top level. */
export function facetOf(reading: InhabitationReading | undefined, name: string): Facet | undefined {
  if (!reading) return undefined;
  const value = reading.facets?.[name] ?? (reading as unknown as Record<string, unknown>)[name];
  return isRecord(value) ? value as Facet : undefined;
}

/** A facet's NOW ref, when its value names one (`value.now_ref`). */
export function facetNowRef(facet: Facet | undefined): string | undefined {
  return facet?.state === "present" && isRecord(facet.value) ? text(facet.value.now_ref) : undefined;
}

/** A facet in one line. A facet that is not present says its standing and
 * reason. A present facet is read from its value object where this view
 * knows the value's shape (current work, Position, occupancy, NOW); else the
 * owner's summary as written. An unrecognised standing is said as such. */
export function facetWords(name: string, facet: Facet | undefined, titleOf?: TitleLookup): string {
  if (!facet) return "not reported";
  const state = facet.state ?? "";
  const value = isRecord(facet.value) ? facet.value : undefined;
  if (name === "current_work" && value && typeof value.outcome === "string") {
    const words = currentWorkWords(value as FactoryCurrentWork, titleOf);
    return state === "present" ? words : `${state} — ${words}`;
  }
  if (state !== "present") {
    if (!(FACET_STATES as readonly string[]).includes(state)) return state ? `“${state}” (not a standing this view knows)` : "not reported";
    return facet.reason ? `${state} — ${facet.reason}` : state;
  }
  if (name === "position" && isRecord(value?.record)) {
    const record = value.record;
    return [text(record.label), text(record.handle), text(record.revision) ? `r${String(record.revision).replace(/^r/, "")}` : undefined].filter(Boolean).join(" · ") || facet.summary || "present";
  }
  if (name === "occupancy" && value) {
    const current = isRecord(value.current) ? value.current : undefined;
    const presence = isRecord(value.presence) ? text(value.presence.presence) : undefined;
    return [text(value.state) ?? "present", current?.generation_ordinal != null ? `generation ${current.generation_ordinal}` : undefined, text(current?.kind), refTail(text(current?.agent_ref)), presence].filter(Boolean).join(" · ");
  }
  if ((name === "root_now" || name === "child_now" || name === "return_destination") && value && text(value.now_ref)) {
    return [text(value.horizon) ? `${value.horizon} NOW` : "NOW record", text(value.lifecycle)].filter(Boolean).join(" · ");
  }
  return facet.summary ?? "present";
}

// ---------------------------------------------------------------------------
// The Agents aperture: who is here
// ---------------------------------------------------------------------------

export interface PositionRow {
  positionRef: string; name: string; handle?: string; role?: string; inherited: boolean;
  /** Central's definition standing: "present", or why the row has no definition. */
  definition: string;
  occupancy: OccupancyView; work: WorkView;
  /** null = the Gateway journal was not read (the absence is named). */
  undelivered: number | null;
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
  warnings: string[];
}

function rowOf(position: PopulationPosition, absences: Absence[], titleOf?: TitleLookup): PositionRow {
  const workAbsence = absences.find(absence => absence.facet === `current_work:${position.position_ref}`)?.reason;
  const undelivered = position.communiques?.undelivered;
  return {
    positionRef: position.position_ref, name: positionName(position),
    ...(text(position.handle) ? {handle: position.handle!} : {}), ...(text(position.role_ref) ? {role: refTail(position.role_ref!)} : {}),
    inherited: position.inherited === true,
    definition: position.definition ?? "not reported",
    occupancy: occupancyView(position.occupancy),
    work: workView(position.current_work, titleOf, workAbsence),
    undelivered: typeof undelivered === "number" ? undelivered : null,
    basis: "population",
  };
}

/** The population aperture: every Position the owner reports, never a
 * profile list. `run` is the selected run's Factory reading (when a run is
 * selected); its Positions lead, matched to the population by ref. */
export function populationAperture(read: OwnerRead<PopulationReading> | undefined, run?: RunInhabitationView, titleOf?: TitleLookup): PopulationAperture {
  const source = read?.source ?? "aikit gateway who";
  const population = read?.state === "read" ? read.data : undefined;
  const absences = (population?.absences ?? []).filter(absence => absence && (absence.reason || absence.facet));
  const rows = (population?.positions ?? []).filter(position => typeof position?.position_ref === "string").map(position => rowOf(position, absences, titleOf));
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
        definition: read?.state === "read" ? "not in the population reading" : "not read",
        occupancy: occupancyView(undefined, read?.state === "unavailable" ? "who is here couldn't be read" : "not in the population reading"),
        work: position.work ?? workView(undefined), undelivered: null, basis: "factory",
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
    absences,
    warnings: read?.state === "read" ? (read.warnings ?? []).map(warningWords) : [],
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

export interface OccupantView {
  attemptRef: string; current: boolean; legStatus?: string;
  agent?: string; session?: string; space?: string; workcell?: string; harnessModel?: string;
  placementNow?: string; returnAddress?: string;
  /** The facets Factory reports as not present, in its words. */
  notes: string[];
}
export interface RunPositionView {
  positionRef: string; name: string; handle?: string;
  inCustody: boolean;
  custody: {state: string; work?: string; unitRef?: string}[]; custodyWords?: string;
  occupants: OccupantView[]; work?: WorkView; ambiguity?: string;
}
export interface RunInhabitationView {
  state: "read" | "unavailable";
  reason?: string; source: string;
  lifecycle?: string;
  positions: RunPositionView[];
  /** Attempts whose participant names no Position this run's reading lists. */
  unplaced: OccupantView[];
  /** Owner-stated ambiguities, in words (an attention signal). */
  ambiguities: string[];
}

const CUSTODY_ORDER = ["in-progress", "blocked", "handed-off", "released", "completed"];
function indexOr(order: string[], value: string): number { const at = order.indexOf(value); return at < 0 ? order.length : at; }
const facetValue = (facet: FactoryFacet | undefined) => facet?.state === "present" ? text(facet.value) : undefined;

function occupantView(occupant: FactoryOccupant): OccupantView {
  const body = occupant.body ?? {}, participant = occupant.participant ?? {};
  const harnessModel = [refTail(facetValue(body.harness_ref)), refTail(facetValue(body.model_ref))].filter(Boolean).join(" · ");
  const notes: string[] = [];
  for (const [label, facet] of [["placement NOW", occupant.placement?.now_ref], ["workcell", body.workcell_ref], ["Position", participant.position_ref]] as [string, FactoryFacet | undefined][]) {
    if (facet && facet.state !== "present") notes.push(`${label}: ${facet.state}${facet.reason ? ` — ${facet.reason}` : ""}`);
  }
  const agent = refTail(facetValue(participant.agent_ref)), workcell = refTail(facetValue(body.workcell_ref));
  return {
    attemptRef: occupant.attempt_ref, current: occupant.current_attempt === true,
    ...(occupant.leg_status ? {legStatus: occupant.leg_status} : {}),
    ...(agent ? {agent} : {}), ...(facetValue(body.agent_session_ref) ? {session: facetValue(body.agent_session_ref)} : {}),
    ...(facetValue(body.session_space_ref) ? {space: facetValue(body.session_space_ref)} : {}), ...(workcell ? {workcell} : {}),
    ...(harnessModel ? {harnessModel} : {}),
    ...(facetValue(occupant.placement?.now_ref) ? {placementNow: facetValue(occupant.placement?.now_ref)} : {}),
    ...(facetValue(occupant.return_address) ? {returnAddress: facetValue(occupant.return_address)} : {}),
    notes,
  };
}

function ambiguousFacets(occupant: FactoryOccupant): string[] {
  const groups: Record<string, FactoryFacet | undefined>[] = [occupant.participant ?? {}, occupant.body ?? {}, {now_ref: occupant.placement?.now_ref, return_address: occupant.return_address}];
  return groups.flatMap(group => Object.entries(group).filter(([, facet]) => facet?.state === "ambiguous").map(([name, facet]) => `${name.replace(/_/g, " ")}: ${facet?.reason ?? "ambiguous"}`));
}

/** The run's Positions from Factory's inhabitation reading (read for the
 * source, or for the run alone). A read that failed is `unavailable` with its
 * reason; a read that names no Position for the run is read-and-empty.
 * `names` joins Central's names by ref; `work` is Factory's current-work
 * reading per Position (when read). */
export function runInhabitationView(read: OwnerRead<FactoryInhabitationReading> | undefined, runRef: string, options: {names?: NameLookup; titleOf?: TitleLookup; work?: (positionRef: string) => FactoryCurrentWork | undefined} = {}): RunInhabitationView | undefined {
  if (!read) return undefined;
  if (read.state === "unavailable") return {state: "unavailable", reason: read.reason, source: read.source, positions: [], unplaced: [], ambiguities: []};
  const run = (read.data.runs ?? []).find(entry => entry?.run_ref === runRef);
  const occupants = (run?.occupants ?? []).filter(occupant => typeof occupant?.attempt_ref === "string");
  const placed = new Set<string>();
  const positions: RunPositionView[] = (run?.positions ?? []).filter(position => typeof position?.position_ref === "string").map(position => {
    const names = options.names?.(position.position_ref);
    const custody = (position.custody ?? []).map(entry => ({state: entry.state ?? "unknown", ...(entry.work_ref ? {work: refTail(entry.work_ref)} : {}), ...(entry.workflow_unit_ref ? {unitRef: entry.workflow_unit_ref} : {})}))
      .sort((a, b) => indexOr(CUSTODY_ORDER, a.state) - indexOr(CUSTODY_ORDER, b.state));
    const custodyWords = custody.length ? custody.map(entry => `${entry.state.replace(/-/g, " ")}${entry.work ? ` · ${entry.work}` : ""}`).join("; ") : undefined;
    const mine = occupants.filter(occupant => facetValue(occupant.participant?.position_ref) === position.position_ref || (position.attempt_refs ?? []).includes(occupant.attempt_ref));
    for (const occupant of mine) placed.add(occupant.attempt_ref);
    const handle = names?.handle;
    const name = names?.label ?? handle ?? positionName(position);
    const work = factoryWorkView(options.work?.(position.position_ref), options.titleOf);
    const facetAmbiguity = mine.flatMap(ambiguousFacets);
    const who = handle ?? name;
    const ambiguity = work?.outcome === "ambiguous" ? `${who} carries more than one current work (${work.words.split("— ")[1] ?? "candidates"})`
      : facetAmbiguity.length ? `${who}: ${facetAmbiguity.join("; ")}` : undefined;
    return {positionRef: position.position_ref, name, ...(handle ? {handle} : {}), inCustody: position.in_custody === true,
      custody, ...(custodyWords ? {custodyWords} : {}), occupants: mine.map(occupantView), ...(work ? {work} : {}), ...(ambiguity ? {ambiguity} : {})};
  });
  const unplaced = occupants.filter(occupant => !placed.has(occupant.attempt_ref));
  const unplacedAmbiguity = unplaced.flatMap(ambiguousFacets);
  return {
    state: "read", source: read.source, ...(run?.lifecycle ? {lifecycle: run.lifecycle} : {}), positions,
    unplaced: unplaced.map(occupantView),
    ambiguities: [...positions.map(position => position.ambiguity).filter((words): words is string => !!words), ...unplacedAmbiguity],
  };
}

/** The Positions that hold a run, as the Desk card names them: those with
 * open custody first (in progress, blocked), else every Position Factory
 * names on the run. Handles when Central gives them. */
export function runOwners(view: RunInhabitationView | undefined): string[] {
  if (!view || view.state !== "read") return [];
  const live = view.positions.filter(position => position.inCustody);
  return (live.length ? live : view.positions).map(position => position.handle ?? position.name);
}

/** The Positions whose custody is open anywhere in a Factory reading — the
 * ones whose current work Factory is asked to derive. */
export function positionsInCustody(reading: FactoryInhabitationReading | undefined): string[] {
  const refs = new Set<string>();
  for (const run of reading?.runs ?? []) for (const position of run.positions ?? []) if (position.in_custody && position.position_ref) refs.add(position.position_ref);
  return [...refs];
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

const HOP_WORD: Record<string, string> = {
  operation: "Current operation", "workflow-unit": "Workflow unit", attempt: "Attempt", run: "Run", journey: "Journey",
  commission: "Commission", intent: "Project intent", ground: "ProjectCentral ground",
};
export interface ChainRow { level: string; words: string; state: "present" | "gap"; ref?: string; revision?: string; depth: number }
/** The Refocus trace, nested from the current operation outward to the
 * ProjectCentral ground, in the owner's order: each hop is a ref (with its
 * detail) or a gap in the owner's words. */
export function refocusChain(reading: RefocusReading | undefined): ChainRow[] {
  return (reading?.chain ?? []).filter((hop): hop is RefocusHop => isRecord(hop)).map((hop, depth) => {
    const level = HOP_WORD[hop.hop ?? ""] ?? (hop.hop ? hop.hop.replace(/[-_]/g, " ").replace(/^./, c => c.toUpperCase()) : "Hop");
    const ref = text(hop.ref);
    if (!ref && text(hop.gap)) return {level, words: hop.gap!, state: "gap", depth};
    const words = text(hop.detail) ?? refTail(ref) ?? (text(hop.gap) ?? "no answer");
    return {level, words: firstSentence(words), state: ref || text(hop.detail) ? "present" : "gap", ...(ref ? {ref} : {}), ...(text(hop.revision) ? {revision: hop.revision!} : {}), depth};
  });
}

export interface PreparedBasis { preparedContext: string; rootNow?: string; childNow?: string; returnNow?: string; rootNowWords: string; childNowWords: string; returnWords: string }
/** whoami's prepared-context basis: the prepared-context facet and the root
 * and child NOW refs (`value.now_ref`) the Position stands in. */
export function preparedBasis(reading: InhabitationReading | undefined): PreparedBasis {
  const root = facetOf(reading, "root_now"), child = facetOf(reading, "child_now"), ret = facetOf(reading, "return_destination");
  const rootNow = facetNowRef(root), childNow = facetNowRef(child), returnNow = facetNowRef(ret);
  return {
    preparedContext: facetWords("prepared_context", facetOf(reading, "prepared_context")),
    ...(rootNow ? {rootNow} : {}), ...(childNow ? {childNow} : {}), ...(returnNow ? {returnNow} : {}),
    rootNowWords: facetWords("root_now", root), childNowWords: facetWords("child_now", child), returnWords: facetWords("return_destination", ret),
  };
}

/** The joined reading's facets, in the contract's order, labelled. */
export const WHOAMI_FACETS: [string, string][] = [
  ["local_world", "Local World"], ["project_world", "Project World"], ["position", "Position"], ["occupancy", "Occupancy"],
  ["agent", "Agent"], ["agency", "Agency"], ["agent_session", "Session"], ["session_space", "Session space"], ["body", "Body"],
  ["workcell", "Workcell"], ["root_now", "Root NOW"], ["child_now", "Child NOW"], ["current_work", "Current work"], ["peers", "Peers"],
  ["prepared_context", "Prepared context"], ["authority", "Authority"], ["working_surface", "Working surface"], ["return_destination", "Return destination"],
];
