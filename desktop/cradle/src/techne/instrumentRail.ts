/**
 * The Technè arrangement's instrument rail state — which of the six
 * instrument tabs stands in front, and the rail's tab presentation.
 *
 * Switching tabs is presentation state on the arrangement (#375 §6): it never
 * closes surfaces, never starts or stops a session, and never touches work
 * outside the Technè surface — the material scene (./material) and the lens
 * host keep their own stores, so a tab's state survives leaving and returning.
 * The rail's choice is kept per viewer (localStorage, versioned key, every
 * access guarded) exactly like the material scenes: refs and presentation
 * only, never content. It renders correctly with storage empty, blocked or
 * corrupt — the ground instrument M0′ is the default first view.
 */
import {useSyncExternalStore} from "react";
import {clampTabListWidth, TAB_PRESENTATIONS, type TabPresentation} from "../workspace/mode";
import {DEEP_INSTRUMENTS, GROUND_INSTRUMENT} from "./instruments";
import type {TechneInstrumentId} from "./techneReading";

const DEEP_INSTRUMENT_IDS: readonly TechneInstrumentId[] = DEEP_INSTRUMENTS.map(entry => entry.instrument);

export interface InstrumentRailState {
  /** The instrument whose tab stands in front. */
  active: TechneInstrumentId;
  /** The rail's tab presentation — the shared grammar (workspace/mode.ts). */
  presentation: TabPresentation;
  /** The geometry an unpinned rail reveals in. */
  orientation: "horizontal" | "vertical";
  /** The pinned-vertical list's width (px), clamped by the shared bounds. */
  listWidth?: number;
}

const STORAGE_KEY = "oi-cradle.techne.instrument-rail.v1";
const DEFAULT_STATE: InstrumentRailState = Object.freeze({active: GROUND_INSTRUMENT.instrument, presentation: "pinned-horizontal", orientation: "horizontal"}) as InstrumentRailState;

function load(): InstrumentRailState {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null");
    if (!parsed || typeof parsed !== "object") return {...DEFAULT_STATE};
    const record = parsed as Partial<InstrumentRailState>;
    return {
      active: typeof record.active === "string" && DEEP_INSTRUMENT_IDS.includes(record.active) ? record.active : GROUND_INSTRUMENT.instrument,
      presentation: TAB_PRESENTATIONS.includes(record.presentation as TabPresentation) ? record.presentation as TabPresentation : "pinned-horizontal",
      orientation: record.orientation === "vertical" ? "vertical" : "horizontal",
      listWidth: clampTabListWidth(record.listWidth),
    };
  } catch { return {...DEFAULT_STATE}; }
}

// The rail validates instrument ids against the constellation's own list —
// stable vocabulary (instruments.ts).

let state: InstrumentRailState = typeof window === "undefined" ? {...DEFAULT_STATE} : load();
const listeners = new Set<() => void>();
function commit(next: InstrumentRailState) {
  state = next;
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* per-viewer convenience only */ }
  for (const listener of [...listeners]) listener();
}

export const subscribeInstrumentRail = (listener: () => void): () => void => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const getInstrumentRail = (): InstrumentRailState => state;

/** Stand one instrument's tab in front. Presentation state only. */
export function selectInstrument(instrument: TechneInstrumentId) {
  if (state.active !== instrument && DEEP_INSTRUMENT_IDS.includes(instrument)) commit({...state, active: instrument});
}

/** Unpin or pin — the pane tool's own semantics (surface/registry.ts
 * `frame.tabs-pin`): pinning records the geometry the rail was last pinned
 * in and unpinned reveals in; unpinning keeps that geometry. */
export function toggleRailPin() {
  const unpinned = state.presentation === "unpinned";
  commit(unpinned
    ? {...state, presentation: state.orientation === "vertical" ? "pinned-vertical" : "pinned-horizontal"}
    : {...state, presentation: "unpinned"});
}

/** Flip the rail's orientation — the pane tool's own semantics
 * (`frame.tabs-orient`): an unpinned rail only records the geometry it will
 * reveal in; a pinned rail flips between the two pinned geometries. */
export function toggleRailOrientation() {
  const next = state.orientation === "horizontal" ? "vertical" : "horizontal";
  commit(state.presentation === "unpinned"
    ? {...state, orientation: next}
    : {...state, presentation: next === "vertical" ? "pinned-vertical" : "pinned-horizontal", orientation: next});
}

/** The pinned-vertical list's width — the shared clamped bounds. */
export function setRailListWidth(width: number) {
  const clamped = clampTabListWidth(width);
  if (clamped !== undefined && clamped !== state.listWidth) commit({...state, listWidth: clamped});
}

const snapshot = () => state;
export function useInstrumentRail(): InstrumentRailState { return useSyncExternalStore(subscribeInstrumentRail, snapshot, snapshot); }
