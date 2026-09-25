/**
 * The Desk's read store (11-FACTORY §2): what the Desk has actually read for
 * the one scope, when it read it, and which run is open. Module state behind
 * `useSyncExternalStore` — the same pattern as deskModel/sidebarModel — so
 * the Desk, the Run page, the Tasks header and the right panel read ONE
 * reading, and leaving the Desk for a Run page and coming back keeps it (and
 * the board's scroll) exactly as it was.
 *
 * Reading is explicit: on first show for a scope and on ⟳. There is no poll,
 * no timer, no watch. A refresh keeps the previous board standing until the
 * new reading is complete, then swaps it in whole — cards never reshuffle
 * under the pointer while a read is in flight.
 */
import {useSyncExternalStore} from "react";
import type {KernelTransportStatus} from "../../../kernel/types";
import type {Scope} from "../../../workspace/scope";
import {readDeskSources} from "./deskModel";
import {discoverSources, inspectWorkflow, readCurrentWork, readFactoryInhabitation, readJourney, readProject, readRun, type Discovery} from "./factoryReads";
import {cardKey, deskCard, type DeskCard, type DeskSourceRef, type JourneyReading, type RunReading, type WorkflowInspection} from "./runModel";
import {joinBySession, namesOf, positionsInCustody, runInhabitationView, runOwners, type FactoryCurrentWork, type FactoryInhabitationReading, type Join, type OwnerRead, type PositionNames, type RunInhabitationView} from "../inhabitation/model";
import {peekPopulation, readPopulation, readPopulationFor} from "../inhabitation/reads";

export interface RunEntry {
  card: DeskCard; run: RunReading; journey?: JourneyReading;
  inspection?: WorkflowInspection; inspectionError?: string;
  /** Set when the whole inspection could not be read (inspectionPages.ts). */
  inspectionPartial?: string;
  /** The run's Positions from Factory's inhabitation reading (absent until read). */
  inhabitation?: RunInhabitationView;
}
export interface DeskReading {
  scopeKey: string;
  status: "reading" | "read" | "error";
  readAt?: number;
  error?: string;
  discovery?: Discovery;
  /** Sources whose project/journey/run reads refused, in the owner's words. */
  refused: {label: string; error: string}[];
  runs: Record<string, RunEntry>;
  /** Factory's inhabitation reading per source (state path), or its absence. */
  inhabitation?: Record<string, OwnerRead<FactoryInhabitationReading>>;
  /** Factory's current-work reading per source, per Position in custody there. */
  currentWork?: Record<string, Record<string, OwnerRead<FactoryCurrentWork>>>;
  /** Central's names for the Positions (from the population readings), by ref. */
  names?: Record<string, PositionNames>;
}

export const scopeKeyOf = (scope: Scope) => scope.kind === "project" ? `project:${scope.project}` : scope.kind;

let reading: DeskReading | undefined;
let generation = 0;
const listeners = new Set<() => void>();
const emit = () => { for (const listener of [...listeners]) listener(); };
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };

export function useDeskReading(): DeskReading | undefined {
  return useSyncExternalStore(subscribe, () => reading, () => reading);
}
export function peekDeskReading(): DeskReading | undefined { return reading; }

/** Every run entry the store holds (any scope read so far this session is
 * replaced by the current one — the store holds one reading). */
export function runEntry(key: string | undefined): RunEntry | undefined {
  return key ? reading?.runs[key] : undefined;
}

/** A run's title as the Desk names it — for the Positions' current-work
 * words ("Working on …"); a run the Desk has not read has no title here. */
export function titleOfRun(runRef: string, runs: Record<string, RunEntry> | undefined = reading?.runs): string | undefined {
  for (const entry of Object.values(runs ?? {})) if (entry.run.runRef === runRef) return entry.card.title;
  return undefined;
}

/** What a run's inhabitation join reads beside Factory's reading: Central's
 * names by ref and Factory's current work per Position, for the source. */
interface JoinBasis { names?: Record<string, PositionNames>; work?: Record<string, OwnerRead<FactoryCurrentWork>>; runs?: Record<string, RunEntry> }

/** Join a run to its source's inhabitation reading: the Positions view and
 * the card's owner line and ambiguity signal. */
function withInhabitation(entry: RunEntry, read: OwnerRead<FactoryInhabitationReading> | undefined, basis: JoinBasis = {}): RunEntry {
  const work = (ref: string) => { const found = basis.work?.[ref]; return found?.state === "read" ? found.data : undefined; };
  const view = runInhabitationView(read, entry.run.runRef, {names: ref => basis.names?.[ref], titleOf: runRef => titleOfRun(runRef, basis.runs), work}) ?? entry.inhabitation;
  const card = deskCard(entry.card.source, entry.run, entry.journey, entry.inspection, {owners: runOwners(view), ambiguities: view?.ambiguities ?? []});
  return {...entry, card, ...(view ? {inhabitation: view} : {})};
}

/** Read one source: project → journeys → runs, and Factory's inhabitation
 * reading for the source beside them. Refusals are collected, never thrown
 * past the source. */
async function readSource(transport: KernelTransportStatus, source: DeskSourceRef, runs: Record<string, RunEntry>, refused: DeskReading["refused"], inhabitation: Record<string, OwnerRead<FactoryInhabitationReading>>, currentWork: Record<string, Record<string, OwnerRead<FactoryCurrentWork>>>) {
  const label = source.project ?? "Central";
  // Factory's inhabitation reading for the source, then Factory's own
  // current-work derivation for every Position whose custody is open there
  // (the ambiguity signal is Factory's answer, never a UI count).
  const positions = readFactoryInhabitation(transport, source.statePath).then(async read => {
    inhabitation[source.statePath] = read;
    const held = read.state === "read" ? positionsInCustody(read.data) : [];
    const answers = await Promise.all(held.map(ref => readCurrentWork(transport, source.statePath, ref).then(answer => [ref, answer] as const)));
    currentWork[source.statePath] = Object.fromEntries(answers);
  });
  let project;
  try { project = await readProject(transport, source); }
  catch (error) { refused.push({label, error: errorWords(error)}); await positions; return; }
  for (const summary of project.journeys ?? []) {
    let journey: JourneyReading | undefined;
    try { journey = await readJourney(transport, source.statePath, summary.journeyRef); }
    catch (error) { refused.push({label, error: errorWords(error)}); }
    for (const runRef of summary.runRefs ?? journey?.runRefs ?? []) {
      try {
        const run = await readRun(transport, source.statePath, runRef);
        runs[cardKey(source, runRef)] = {card: deskCard(source, run, journey), run, journey};
      } catch (error) { refused.push({label, error: errorWords(error)}); }
    }
  }
  await positions;
}

export function errorWords(error: unknown): string {
  return String(error instanceof Error ? error.message : error).replace(/^Error:\s*/, "").trim();
}

/** Read the Desk for a scope. Resolves when the whole reading has landed. */
export async function readDesk(transport: KernelTransportStatus, scope: Scope): Promise<void> {
  const gen = ++generation;
  const scopeKey = scopeKeyOf(scope);
  const previous = reading?.scopeKey === scopeKey ? reading : undefined;
  reading = {scopeKey, status: "reading", readAt: previous?.readAt, discovery: previous?.discovery, refused: previous?.refused ?? [], runs: previous?.runs ?? {}};
  emit();
  let discovery: Discovery;
  try { discovery = await discoverSources(transport, scope); }
  catch (error) {
    if (gen !== generation) return;
    reading = {scopeKey, status: "error", error: errorWords(error), refused: [], runs: previous?.runs ?? {}};
    emit();
    return;
  }
  // The ⟳ menu's hand-named fallback sources join discovery for the scope
  // they were named under (never duplicated when discovery finds them too).
  for (const named of readDeskSources()) {
    const inScope = scope.kind === "all" || (scope.kind === "project" ? named.centralProject === scope.project : !named.centralProject);
    if (!inScope || discovery.sources.some(source => source.statePath === named.statePath && source.projectRef === named.projectRef)) continue;
    discovery = {...discovery, sources: [...discovery.sources, {statePath: named.statePath, projectRef: named.projectRef, ...(named.centralProject ? {project: named.centralProject} : {})}]};
  }
  const runs: Record<string, RunEntry> = {};
  const refused: DeskReading["refused"] = [];
  const inhabitation: Record<string, OwnerRead<FactoryInhabitationReading>> = {};
  const currentWork: Record<string, Record<string, OwnerRead<FactoryCurrentWork>>> = {};
  const [, names] = await Promise.all([
    Promise.all(discovery.sources.map(source => readSource(transport, source, runs, refused, inhabitation, currentWork))),
    readNames(transport, scope, discovery),
  ]);
  if (gen !== generation) return;
  for (const [key, entry] of Object.entries(runs)) {
    // Inspections already held for a run survive the refresh until reread.
    const held = previous?.runs[key];
    if (held?.inspection) { entry.inspection = held.inspection; entry.inspectionPartial = held.inspectionPartial; }
    runs[key] = withInhabitation(entry, inhabitation[entry.card.source.statePath], {names, work: currentWork[entry.card.source.statePath], runs});
  }
  reading = {scopeKey, status: "read", readAt: Date.now(), discovery, refused, runs, inhabitation, currentWork, names};
  // Re-entry: with nothing chosen yet this session, the persisted held
  // selection returns from the canonical refs the reading now answers for.
  reestablishHeldSelection(readHeldSelection(), runs);
  emit();
}

/** Central's names for the Positions in scope, from AIKit's population
 * reading: the scope's own (shared with the Agents aperture) for a project,
 * else one per project the discovered sources belong to. A population that
 * cannot be read leaves its Positions named by their refs (the Agents
 * aperture names that absence). */
async function readNames(transport: KernelTransportStatus, scope: Scope, discovery: Discovery): Promise<Record<string, PositionNames>> {
  if (scope.kind === "project") {
    await readPopulationFor(transport, scope.project);
    const held = peekPopulation(scope.project)?.read;
    return held?.state === "read" ? namesOf(held.data) : {};
  }
  const projects = [...new Set(discovery.sources.map(source => source.project).filter((name): name is string => !!name))];
  const reads = await Promise.all([undefined, ...projects].map(project => readPopulation(transport, project)));
  return Object.assign({}, ...reads.map(read => read.state === "read" ? namesOf(read.data) : {}));
}

/** Re-read one run (its run, journey and workflow inspection) — the Run
 * page's own read on open and after an act. */
export async function readRunEntry(transport: KernelTransportStatus, key: string): Promise<RunEntry | undefined> {
  const entry = reading?.runs[key];
  if (!entry) return undefined;
  const source = entry.card.source;
  const [run, journey] = await Promise.all([
    readRun(transport, source.statePath, entry.run.runRef),
    entry.card.journeyRef ? readJourney(transport, source.statePath, entry.card.journeyRef).catch(() => entry.journey) : Promise.resolve(entry.journey),
  ]);
  let inspection: WorkflowInspection | undefined;
  let inspectionError: string | undefined;
  let inspectionPartial: string | undefined;
  const positions = readFactoryInhabitation(transport, source.statePath, entry.run.runRef);
  try { const whole = await inspectWorkflow(transport, source.statePath, entry.run.runRef); inspection = whole.inspection; inspectionPartial = whole.partial; }
  catch (error) { inspectionError = errorWords(error); }
  const base: RunEntry = {card: deskCard(source, run, journey, inspection), run, journey, inspection, inspectionError, ...(inspectionPartial ? {inspectionPartial} : {})};
  const positionsRead = await positions;
  // Factory's current work for the Positions holding this run, re-read with it.
  const held = positionsRead.state === "read" ? positionsInCustody(positionsRead.data) : [];
  const work = {...(reading?.currentWork?.[source.statePath] ?? {}), ...Object.fromEntries(await Promise.all(held.map(ref => readCurrentWork(transport, source.statePath, ref).then(answer => [ref, answer] as const))))};
  const next = withInhabitation(base, positionsRead, {names: reading?.names, work, runs: reading?.runs});
  if (reading?.runs[key]) {
    reading = {...reading, runs: {...reading.runs, [key]: next}};
    emit();
  }
  return next;
}

// ---------------------------------------------------------------------------
// The open run, the held selection, and the board's remembered presentation
// ---------------------------------------------------------------------------

let openKey: string | undefined;
let selectedKey: string | undefined;
const openListeners = new Set<() => void>();
const emitOpen = () => { for (const listener of [...openListeners]) listener(); };
const subscribeOpen = (listener: () => void) => { openListeners.add(listener); return () => { openListeners.delete(listener); }; };

export function openRunPage(key: string) { openKey = key; selectedKey = key; persistSelection(key); emitOpen(); }
export function closeRunPage() { if (openKey === undefined) return; openKey = undefined; emitOpen(); }
export function useOpenRun(): string | undefined { return useSyncExternalStore(subscribeOpen, () => openKey, () => openKey); }
/** The run the right panel answers about: the open run, else the last one
 * opened from the Desk (a held selection — never an auto-choice). */
export function useSelectedRun(): string | undefined { return useSyncExternalStore(subscribeOpen, () => selectedKey, () => selectedKey); }
export function peekSelectedRun(): string | undefined { return selectedKey; }
export function selectRun(key: string | undefined) { if (selectedKey === key) return; selectedKey = key; persistSelection(key); emitOpen(); }

// Re-entry (FACTORY-AGENCY §1: "re-entry restores from canonical work refs
// plus presentation state"): the held selection is persisted as the run's
// canonical refs and re-established from them once a reading actually
// contains that run — never from a label, and a locator the owner no longer
// answers re-establishes nothing (the honest neutral state, not a guess).
const SELECTION_KEY = "oi-factory-desk-selection.v1";
interface HeldSelection { statePath: string; projectRef: string; runRef: string }
function readHeldSelection(): HeldSelection | undefined {
  try {
    const held = JSON.parse(localStorage.getItem(SELECTION_KEY) ?? "null") as Partial<HeldSelection> | null;
    if (!held || typeof held.statePath !== "string" || typeof held.projectRef !== "string" || typeof held.runRef !== "string") return undefined;
    return {statePath: held.statePath, projectRef: held.projectRef, runRef: held.runRef};
  } catch { return undefined; }
}
function persistSelection(key: string | undefined) {
  const entry = key ? reading?.runs[key] : undefined;
  try {
    if (!entry) localStorage.removeItem(SELECTION_KEY);
    else localStorage.setItem(SELECTION_KEY, JSON.stringify({statePath: entry.card.source.statePath, projectRef: entry.card.source.projectRef, runRef: entry.run.runRef}));
  } catch { /* per-viewer convenience */ }
}
/** The desk key whose run is exactly the held locator — canonical ref
 * identity, never a label match. */
export function deskKeyOfLocator(runs: Record<string, RunEntry>, held: HeldSelection): string | undefined {
  for (const [key, entry] of Object.entries(runs)) {
    if (entry.card.source.statePath === held.statePath && entry.card.source.projectRef === held.projectRef && entry.run.runRef === held.runRef) return key;
  }
  return undefined;
}
/** Re-establish the held selection from canonical refs. With a selection
 * already chosen this session it does nothing; returns whether a run now
 * answers as the subject. */
export function reestablishHeldSelection(held: HeldSelection | undefined, runs: Record<string, RunEntry> = reading?.runs ?? {}): boolean {
  if (selectedKey !== undefined || !held) return false;
  const key = deskKeyOfLocator(runs, held);
  if (!key) return false;
  selectedKey = key;
  emitOpen();
  return true;
}

// The board's search and scroll survive leaving for a Run page or Tasks and
// back — and, coalesced through localStorage, an application restart too.
const BOARD_KEY = "oi-factory-desk-board.v1";
function readStoredBoard(): {query: string; scroll: number} {
  try {
    const parsed = JSON.parse(localStorage.getItem(BOARD_KEY) ?? "null") as {query?: unknown; scroll?: unknown} | null;
    return {
      query: typeof parsed?.query === "string" ? parsed.query : "",
      scroll: typeof parsed?.scroll === "number" && Number.isFinite(parsed.scroll) && parsed.scroll >= 0 ? parsed.scroll : 0,
    };
  } catch { return {query: "", scroll: 0}; }
}
const storedBoard = readStoredBoard();
let deskScroll = storedBoard.scroll;
let deskQuery = storedBoard.query;
let scrollWrite: number | undefined;
function persistBoard() {
  try { localStorage.setItem(BOARD_KEY, JSON.stringify({query: deskQuery, scroll: deskScroll})); } catch { /* per-viewer convenience */ }
}
export function rememberDeskQuery(query: string) { deskQuery = query; persistBoard(); }
export function heldDeskQuery(): string { return deskQuery; }
export function rememberDeskScroll(top: number) {
  deskScroll = top;
  if (scrollWrite !== undefined) window.clearTimeout(scrollWrite);
  scrollWrite = window.setTimeout(() => { scrollWrite = undefined; persistBoard(); }, 250);
}
export function deskScrollTop(): number { return deskScroll; }

// ---------------------------------------------------------------------------
// The Tasks join (§4, F14/F15)
// ---------------------------------------------------------------------------

/** The agent sessions a run genuinely carried: its executions', its attempts'
 * bodies and its journey's sessions — exact ref identity, never a label. */
export function runSessions(entry: RunEntry): Set<string> {
  const refs = new Set<string>();
  for (const ref of entry.journey?.agentSessionRefs ?? []) if (ref) refs.add(ref);
  for (const execution of entry.run.executions ?? []) if (execution.agentSessionRef) refs.add(execution.agentSessionRef);
  for (const attempt of entry.inspection?.attempts ?? []) if (attempt.body?.agentSessionRef) refs.add(attempt.body.agentSessionRef);
  return refs;
}

/** The runs a conversation belongs to: every run the Desk has read whose
 * sessions carry it. One is a join; more than one is an ambiguity shown to
 * the person — never the first match. */
export function runsForSession(sessionRef: string | undefined): Join<RunEntry> {
  return joinBySession(Object.values(reading?.runs ?? {}), runSessions, sessionRef);
}

// ---------------------------------------------------------------------------
// test seam
// ---------------------------------------------------------------------------

/** Tests only: install a reading directly. */
export function __setDeskReadingForTest(next: DeskReading | undefined) { reading = next; emit(); }
