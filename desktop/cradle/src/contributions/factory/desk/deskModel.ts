/**
 * The Factory centre's Desk/Tasks model (FACTORY-UI-INTEGRATION-HANDOFF
 * §11): the same module-store pattern as the sidebar's sidebarModel —
 * `useSyncExternalStore` over plain module state, no second authority path.
 *
 * 1. `centreView` — which presentation the Factory centre holds: the Desk
 *    (whole-Run overview, then its detail) or Tasks (the working chat).
 *    Owner direction 2026-09-18: Desk is whole-Run-first, Tasks is
 *    chat-first; the left navigator's entries switch the centre. The choice
 *    is a display preference, persisted locally.
 * 2. `deskDetail` — the Run the Desk deliberately opened. Restoring it
 *    restores the detail view; clearing it returns to the board with the
 *    board's own scope, filters and scroll untouched (they live with the
 *    board and its remembered preferences).
 * 3. The board's row cache — what the Desk has actually read. The detail
 *    reuses it rather than re-reading over the board's shoulder, and the
 *    Tasks presentation consults it to bind a conversation to the Run its
 *    session genuinely carried (exact agent-session ref identity — never a
 *    guessed label match).
 *
 * Nothing here reaches native data except through the owner's own reads
 * (`development.ts`); remembered sources and display preferences are just
 * that — preferences, never a canonical Run database.
 */
import {useSyncExternalStore} from "react";
import type {FactoryBuildView} from "../types";

// ---------------------------------------------------------------------------
// 1. The centre's presentation: Desk or Tasks
// ---------------------------------------------------------------------------

export type FactoryCentreView = "desk" | "tasks";
const VIEW_KEY = "oi-factory-centre-view.v1";

function readStoredView(): FactoryCentreView {
  try { return localStorage.getItem(VIEW_KEY) === "tasks" ? "tasks" : "desk"; } catch { return "desk"; }
}
let centreView: FactoryCentreView = readStoredView();
const viewListeners = new Set<() => void>();
export function publishCentreView(next: FactoryCentreView) {
  if (centreView === next) return;
  centreView = next;
  try { localStorage.setItem(VIEW_KEY, next); } catch { /* per-viewer convenience */ }
  for (const listener of [...viewListeners]) listener();
}
export function useCentreView(): FactoryCentreView {
  return useSyncExternalStore(
    listener => { viewListeners.add(listener); return () => viewListeners.delete(listener); },
    () => centreView, () => centreView,
  );
}

// ---------------------------------------------------------------------------
// 2. The Run the Desk deliberately opened
// ---------------------------------------------------------------------------

/** Where a Desk Run lives: the caller-disclosed developmental state path, its
 * Factory project ref, and the run ref itself. `centralProject` records which
 * Central project the source was bound under — a scope label, never identity. */
export interface DeskRunLocator { statePath: string; projectRef: string; runRef: string; projectLabel?: string; centralProject?: string }
const DETAIL_KEY = "oi-factory-desk-detail.v1";

function readStoredDetail(): DeskRunLocator | undefined {
  try {
    const raw = localStorage.getItem(DETAIL_KEY);
    if (!raw) return undefined;
    const held = JSON.parse(raw) as Partial<DeskRunLocator>;
    if (typeof held.statePath !== "string" || typeof held.projectRef !== "string" || typeof held.runRef !== "string") return undefined;
    return {statePath: held.statePath, projectRef: held.projectRef, runRef: held.runRef,
      ...(typeof held.projectLabel === "string" ? {projectLabel: held.projectLabel} : {}),
      ...(typeof held.centralProject === "string" ? {centralProject: held.centralProject} : {})};
  } catch { return undefined; }
}
let deskDetail: DeskRunLocator | undefined = readStoredDetail();
const detailListeners = new Set<() => void>();
export function openDeskDetail(locator: DeskRunLocator) {
  deskDetail = locator;
  try { localStorage.setItem(DETAIL_KEY, JSON.stringify(locator)); } catch { /* per-viewer convenience */ }
  for (const listener of [...detailListeners]) listener();
}
export function closeDeskDetail() {
  if (!deskDetail) return;
  deskDetail = undefined;
  try { localStorage.removeItem(DETAIL_KEY); } catch { /* per-viewer convenience */ }
  for (const listener of [...detailListeners]) listener();
}
export function useDeskDetail(): DeskRunLocator | undefined {
  return useSyncExternalStore(
    listener => { detailListeners.add(listener); return () => detailListeners.delete(listener); },
    () => deskDetail, () => deskDetail,
  );
}

/** The last Run the Desk itself chose (a card, or the opened detail). It is
 * what the Desk re-establishes as the sidebar's Run subject when the person
 * returns from Tasks — a held selection, not an auto-choice: with none held,
 * the sidebar shows its neutral state. */
const LAST_RUN_KEY = "oi-factory-desk-last-run.v1";
function readStoredLastRun(): DeskRunLocator | undefined {
  try {
    const held = JSON.parse(localStorage.getItem(LAST_RUN_KEY) ?? "null") as Partial<DeskRunLocator> | null;
    if (!held || typeof held.statePath !== "string" || typeof held.projectRef !== "string" || typeof held.runRef !== "string") return undefined;
    return {statePath: held.statePath, projectRef: held.projectRef, runRef: held.runRef,
      ...(typeof held.projectLabel === "string" ? {projectLabel: held.projectLabel} : {}),
      ...(typeof held.centralProject === "string" ? {centralProject: held.centralProject} : {})};
  } catch { return undefined; }
}
let lastDeskRun: DeskRunLocator | undefined = readStoredLastRun();
const lastRunListeners = new Set<() => void>();
export function setLastDeskRun(locator: DeskRunLocator) {
  if (lastDeskRun && lastDeskRun.statePath === locator.statePath && lastDeskRun.projectRef === locator.projectRef && lastDeskRun.runRef === locator.runRef) return;
  lastDeskRun = locator;
  try { localStorage.setItem(LAST_RUN_KEY, JSON.stringify(locator)); } catch { /* per-viewer convenience */ }
  for (const listener of [...lastRunListeners]) listener();
}
export function useLastDeskRun(): DeskRunLocator | undefined {
  return useSyncExternalStore(
    listener => { lastRunListeners.add(listener); return () => lastRunListeners.delete(listener); },
    () => lastDeskRun, () => lastDeskRun,
  );
}

// ---------------------------------------------------------------------------
// 3. The board's row cache — what the Desk has actually read
// ---------------------------------------------------------------------------

export interface DeskSource { statePath: string; projectRef: string; centralProject?: string }
export interface DeskRow {
  key: string;
  locator: DeskRunLocator;
  state: "reading" | "read" | "refused";
  view?: FactoryBuildView;
  error?: string;
}
export const deskRowKey = (source: DeskSource, runRef: string) => `${source.statePath}\u0000${source.projectRef}\u0000${runRef}`;

const rowCache = new Map<string, DeskRow>();
export function cacheDeskRow(row: DeskRow) { rowCache.set(row.key, row); }
export function peekDeskRow(key: string): DeskRow | undefined { return rowCache.get(key); }
/** The run's own agent sessions, from what the board has actually read — the
 * exact refs a task conversation can genuinely be bound by. */
export function runSessionRefs(view: FactoryBuildView): string[] {
  const refs = new Set<string>();
  for (const trace of view.trajectories) {
    if (typeof trace.agentSessionRef === "string" && trace.agentSessionRef) refs.add(trace.agentSessionRef);
    for (const span of trace.spans) for (const event of span.events) {
      if (typeof event.agentSessionRef === "string" && event.agentSessionRef) refs.add(event.agentSessionRef);
    }
  }
  return [...refs];
}
/** The Run row whose work a given agent session genuinely carried, if the
 * board has read one — exact ref identity, never a label match. */
export function deskRowForSession(sessionRef: string): DeskRow | undefined {
  for (const row of rowCache.values()) {
    if (row.state === "read" && row.view && runSessionRefs(row.view).includes(sessionRef)) return row;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// 4. Display grouping — presentation over the native status, never a lifecycle
// ---------------------------------------------------------------------------

export type DeskGroupKey = "attention" | "active" | "queued" | "recent";
export const DESK_GROUPS: {key: DeskGroupKey; label: string}[] = [
  {key: "attention", label: "Needs attention"},
  {key: "active", label: "Active"},
  {key: "queued", label: "Queued"},
  {key: "recent", label: "Recent"},
];
/** Placement derives from the run's actual native state: a blocked or failed
 * run needs someone; a run carrying an open human request needs its author
 * even when the machinery itself finished. The original status stays on the
 * card — this is where a card sits, not what it is. */
export function deskGroupOf(view: FactoryBuildView): DeskGroupKey {
  const status = view.run.status;
  if (view.humanRequests.length > 0 || status === "blocked" || status === "fail") return "attention";
  if (status === "running") return "active";
  if (status === "queued") return "queued";
  return "recent";
}

// ---------------------------------------------------------------------------
// 5. Remembered sources — display preferences, not a run database
// ---------------------------------------------------------------------------

const SOURCES_KEY = "oi-factory-desk-sources.v1";
export function readDeskSources(): DeskSource[] {
  try {
    const raw = localStorage.getItem(SOURCES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is DeskSource =>
      !!entry && typeof entry === "object" &&
      typeof (entry as DeskSource).statePath === "string" && (entry as DeskSource).statePath !== "" &&
      typeof (entry as DeskSource).projectRef === "string" && (entry as DeskSource).projectRef !== "").map(entry => ({
        statePath: entry.statePath, projectRef: entry.projectRef,
        ...(typeof entry.centralProject === "string" ? {centralProject: entry.centralProject} : {}),
      }));
  } catch { return []; }
}
export function writeDeskSources(sources: DeskSource[]) {
  try { localStorage.setItem(SOURCES_KEY, JSON.stringify(sources)); } catch { /* per-viewer convenience */ }
}

// ---------------------------------------------------------------------------
// 6. The Desk dev scenario — labelled fixture rows behind import.meta.env.DEV
// ---------------------------------------------------------------------------

/** Fixture rows for the "Desk — cross-project board" scenario: several Runs
 * across two Projects, parallel work inside one Run, different participants,
 * one Run needing permission, one returning material, similar Run names
 * across Projects, and (in the receiving section) incoming material with no
 * Run. Selection/draft behaviour of Tasks is the chat's own honest state and
 * is not faked here. */
export interface DeskFixtureRun {
  locator: DeskRunLocator;
  view: FactoryBuildView;
}
let deskFixture: DeskFixtureRun[] | undefined;
const fixtureListeners = new Set<() => void>();
export function seedDeskFixture(rows: DeskFixtureRun[]) { deskFixture = rows; for (const listener of [...fixtureListeners]) listener(); }
export function clearDeskFixture() { if (!deskFixture) return; deskFixture = undefined; for (const listener of [...fixtureListeners]) listener(); }
export function useDeskFixture(): DeskFixtureRun[] | undefined {
  return useSyncExternalStore(
    listener => { fixtureListeners.add(listener); return () => fixtureListeners.delete(listener); },
    () => deskFixture, () => deskFixture,
  );
}
export function peekDeskFixture(): DeskFixtureRun[] | undefined { return deskFixture; }
