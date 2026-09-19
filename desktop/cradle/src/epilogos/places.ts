/**
 * The Epi-Logos world's four families, and the shared "which place is open"
 * state. A tiny external store (useSyncExternalStore) — not a prop, not
 * context — because the navigator (left region) and the surface (centre
 * pane) are mounted in different regions of the shell and must follow the
 * same open place without a shared parent to own it.
 *
 * Reading position is kept separately, per place, so leaving a place and
 * returning to it restores the passage the visitor was at. It is a
 * per-viewer convenience (localStorage): it renders fine when storage is
 * unavailable, and it is never sent anywhere.
 */
import {useSyncExternalStore} from "react";

export type EpiFamily = "bimba" | "essay" | "epii" | "products";

export interface EpiPlaceRef {
  family: EpiFamily;
  ref: string;
  title: string;
}

const READING_KEY = "oi-cradle.epilogos.reading.v1";

let current: EpiPlaceRef | null = null;
const listeners = new Set<() => void>();
function announce() { for (const listener of listeners) listener(); }

export function selectEpiPlace(place: EpiPlaceRef | null): void {
  current = place;
  announce();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
function snapshot(): EpiPlaceRef | null { return current; }

export function useEpiPlace(): EpiPlaceRef | null {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

function placeKey(place: {family: EpiFamily; ref: string}): string { return `${place.family}:${place.ref}`; }

function loadReadingMap(): Record<string, string> {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(READING_KEY) ?? "null");
    return parsed && typeof parsed === "object" ? parsed as Record<string, string> : {};
  } catch { return {}; }
}

/** Remember the passage the visitor was reading at `ref` (a place). */
export function setEpiReading(ref: {family: EpiFamily; ref: string}, position: string): void {
  try {
    const map = loadReadingMap();
    map[placeKey(ref)] = position;
    window.localStorage.setItem(READING_KEY, JSON.stringify(map));
  } catch { /* per-viewer convenience only — never blocks reading */ }
}

/** The last remembered passage at `ref` (a place), if any. */
export function epiReading(ref: {family: EpiFamily; ref: string}): string | undefined {
  try { return loadReadingMap()[placeKey(ref)]; } catch { return undefined; }
}
