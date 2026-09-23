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
import {discoverSources, inspectWorkflow, readJourney, readProject, readRun, type Discovery} from "./factoryReads";
import {cardKey, deskCard, type DeskCard, type DeskSourceRef, type JourneyReading, type RunReading, type WorkflowInspection} from "./runModel";

export interface RunEntry { card: DeskCard; run: RunReading; journey?: JourneyReading; inspection?: WorkflowInspection; inspectionError?: string }
export interface DeskReading {
  scopeKey: string;
  status: "reading" | "read" | "error";
  readAt?: number;
  error?: string;
  discovery?: Discovery;
  /** Sources whose project/journey/run reads refused, in the owner's words. */
  refused: {label: string; error: string}[];
  runs: Record<string, RunEntry>;
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

/** Read one source: project → journeys → runs. Refusals are collected, never
 * thrown past the source. */
async function readSource(transport: KernelTransportStatus, source: DeskSourceRef, runs: Record<string, RunEntry>, refused: DeskReading["refused"]) {
  const label = source.project ?? "Central";
  let project;
  try { project = await readProject(transport, source); }
  catch (error) { refused.push({label, error: errorWords(error)}); return; }
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
  await Promise.all(discovery.sources.map(source => readSource(transport, source, runs, refused)));
  if (gen !== generation) return;
  // Inspections already held for a run survive the refresh until reread.
  for (const [key, entry] of Object.entries(runs)) {
    const held = previous?.runs[key];
    if (held?.inspection) { entry.inspection = held.inspection; entry.card = deskCard(entry.card.source, entry.run, entry.journey, held.inspection); }
  }
  reading = {scopeKey, status: "read", readAt: Date.now(), discovery, refused, runs};
  emit();
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
  try { inspection = await inspectWorkflow(transport, source.statePath, entry.run.runRef); }
  catch (error) { inspectionError = errorWords(error); }
  const next: RunEntry = {card: deskCard(source, run, journey, inspection), run, journey, inspection, inspectionError};
  if (reading?.runs[key]) {
    reading = {...reading, runs: {...reading.runs, [key]: next}};
    emit();
  }
  return next;
}

// ---------------------------------------------------------------------------
// The open run and the Desk's remembered scroll
// ---------------------------------------------------------------------------

let openKey: string | undefined;
let selectedKey: string | undefined;
let deskScroll = 0;
const openListeners = new Set<() => void>();
const emitOpen = () => { for (const listener of [...openListeners]) listener(); };
const subscribeOpen = (listener: () => void) => { openListeners.add(listener); return () => { openListeners.delete(listener); }; };

export function openRunPage(key: string) { openKey = key; selectedKey = key; emitOpen(); }
export function closeRunPage() { if (openKey === undefined) return; openKey = undefined; emitOpen(); }
export function useOpenRun(): string | undefined { return useSyncExternalStore(subscribeOpen, () => openKey, () => openKey); }
/** The run the right panel answers about: the open run, else the last one
 * opened from the Desk (a held selection — never an auto-choice). */
export function useSelectedRun(): string | undefined { return useSyncExternalStore(subscribeOpen, () => selectedKey, () => selectedKey); }
export function selectRun(key: string | undefined) { if (selectedKey === key) return; selectedKey = key; emitOpen(); }
let deskQuery = "";
/** The board's search survives leaving for a Run page or Tasks and back. */
export function rememberDeskQuery(query: string) { deskQuery = query; }
export function heldDeskQuery(): string { return deskQuery; }
export function rememberDeskScroll(top: number) { deskScroll = top; }
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

/** The run a conversation belongs to, if the Desk has read one that carried
 * its session. */
export function runForSession(sessionRef: string | undefined): RunEntry | undefined {
  if (!sessionRef || !reading) return undefined;
  for (const entry of Object.values(reading.runs)) if (runSessions(entry).has(sessionRef)) return entry;
  return undefined;
}

// ---------------------------------------------------------------------------
// test seam
// ---------------------------------------------------------------------------

/** Tests only: install a reading directly. */
export function __setDeskReadingForTest(next: DeskReading | undefined) { reading = next; emit(); }
