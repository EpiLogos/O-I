/**
 * The dual-mode cut store (owner wayfinder 2026-09-19, PR #387 §11/§25) —
 * which of the two operating cuts the dual-mode Technē surface stands in:
 *
 *   "expressions" — the hosted application with its full physics authoring
 *                   HUD (the 3:3 lived cut, exactly as the Expressions
 *                   centre shows it);
 *   "techne"      — the hosted application with its authoring chrome
 *                   suppressed and the compact cradle-side Technē HUD over
 *                   the same living field (the 4:2 deep cut).
 *
 * ONE Expressions system, two full-screen operating modes: the cut is a
 * HUD/operation change around the SAME stage, subject, scene, selection and
 * session — never a navigation that remounts the world. Switching is
 * immediate and reversible.
 *
 * Presentation state only (wayfinder §25): the cut is stored per surface id,
 * persisted per viewer under a versioned localStorage key exactly like the
 * instrument rail (instrumentRail.ts), and never serialized as domain truth
 * — no kernel document, no Expression, no scene ever carries it. Every read
 * is guarded; empty, blocked or corrupt storage renders as the default cut.
 */
import {useSyncExternalStore} from "react";

export const TECHNE_CUTS = ["expressions", "techne"] as const;
export type TechneCut = typeof TECHNE_CUTS[number];
export const isTechneCut = (value: unknown): value is TechneCut => TECHNE_CUTS.includes(value as TechneCut);

const STORAGE_KEY = "oi-cradle.techne.cut.v1";
const DEFAULT_CUT: TechneCut = "techne";

function load(): Record<string, TechneCut> {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const cuts: Record<string, TechneCut> = {};
    for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) if (typeof id === "string" && isTechneCut(value)) cuts[id] = value;
    return cuts;
  } catch { return {}; }
}

let cuts: Record<string, TechneCut> = typeof window === "undefined" ? {} : load();
const listeners = new Set<() => void>();

function commit(next: Record<string, TechneCut>) {
  cuts = next;
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cuts)); } catch { /* per-viewer convenience only */ }
  for (const listener of [...listeners]) listener();
}

export const subscribeCuts = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
export const getCut = (surfaceId: string): TechneCut => cuts[surfaceId] ?? DEFAULT_CUT;

/** Stand one surface in a cut. Presentation state only; setting the cut the
 * surface already stands in is a no-op. */
export function setCut(surfaceId: string, cut: TechneCut) {
  if (getCut(surfaceId) === cut) return;
  commit({...cuts, [surfaceId]: cut});
}

/** Flip one surface between the two cuts — the in-field switch. */
export function toggleCut(surfaceId: string) {
  setCut(surfaceId, getCut(surfaceId) === "techne" ? "expressions" : "techne");
}

const cutsSnapshot = () => cuts;

/** The surface's cut, reactive. */
export function useSurfaceCut(surfaceId: string): TechneCut {
  return useSyncExternalStore(subscribeCuts, () => getCut(surfaceId), () => getCut(surfaceId));
}

/** Reactive access for readers that want the whole map (tests, dev tools). */
export function useCuts(): Record<string, TechneCut> {
  return useSyncExternalStore(subscribeCuts, cutsSnapshot, cutsSnapshot);
}
