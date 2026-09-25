/**
 * The Factory centre's Desk/Tasks presentation model (FACTORY-UI-INTEGRATION-
 * HANDOFF §11): the same module-store pattern as the shell's other stores —
 * `useSyncExternalStore` over plain module state, no second authority path.
 *
 * 1. `centreView` — which presentation the Factory centre holds: the Desk
 *    (whole-Run overview, then its detail) or Tasks (the working chat).
 *    Owner direction 2026-09-18: Desk is whole-Run-first, Tasks is
 *    chat-first; the left navigator's entries switch the centre. The choice
 *    is a display preference, persisted locally.
 * 2. The ⟳ menu's remembered sources — display preferences, never a
 *    canonical Run database.
 *
 * The board's readings, its held Run selection and the working subject live
 * in `deskStore.ts` (the one selection path — the sidebar's Run/Agents/
 * Context planes read it; there is no second selection store).
 *
 * Nothing here reaches native data except through the owner's own reads
 * (`development.ts`); remembered sources and display preferences are just
 * that — preferences, never a canonical Run database.
 */
import {useSyncExternalStore} from "react";

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
// 2. Remembered sources — display preferences, not a run database
// ---------------------------------------------------------------------------

export interface DeskSource { statePath: string; projectRef: string; centralProject?: string }
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
