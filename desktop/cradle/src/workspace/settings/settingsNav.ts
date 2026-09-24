/**
 * Where the person is inside Settings (docs/cradle/12-SETTINGS.md §1): the
 * chosen task section or product page, and the row a search landed on. The
 * left navigator writes it; the centre page reads it. Presentation state
 * only — remembered for the session so Back to work and return land where
 * the person left off.
 */
import {useSyncExternalStore} from "react";

export type SectionId = "status" | "harnesses" | "credentials" | "skills" | "profiles" | "permissions" | "appearance";

export const SECTIONS: readonly {id: SectionId; label: string; glyph: string}[] = [
  {id: "status", label: "Status", glyph: "status"},
  {id: "harnesses", label: "Harnesses", glyph: "terminal"},
  {id: "credentials", label: "Credentials", glyph: "key"},
  {id: "skills", label: "Skills", glyph: "skills"},
  {id: "profiles", label: "Profiles", glyph: "list"},
  {id: "permissions", label: "Permissions", glyph: "lock"},
  {id: "appearance", label: "Appearance", glyph: "appearance"},
];

/** The product pages, in the suite's canonical order (§3.9). */
export const PRODUCTS: readonly {id: string; label: string}[] = [
  {id: "central", label: "Central"},
  {id: "ai-kit", label: "AIKit"},
  {id: "actuation", label: "Actuation"},
  {id: "software-factory", label: "Factory"},
  {id: "workcell", label: "Workcell"},
  {id: "quaternal-logic", label: "Quaternal Logic"},
  {id: "oi", label: "O:I"},
];

export type SettingsPlace = {kind: "section"; id: SectionId} | {kind: "product"; id: string};
type PreviousPlace = {kind: "section"; id: "models"};

/** Old saved links reach the same working harness/model controls. */
function canonicalPlace(place: SettingsPlace | PreviousPlace): SettingsPlace {
  return place.kind === "section" && place.id === "models" ? {kind: "section", id: "harnesses"} : place;
}

export function restoreSettingsPlace(value: unknown): SettingsPlace {
  if (value && typeof value === "object" && "kind" in value && "id" in value) {
    if (value.kind === "section" && value.id === "models") return {kind: "section", id: "harnesses"};
    if (value.kind === "section" && SECTIONS.some(section => section.id === value.id)) return value as SettingsPlace;
    if (value.kind === "product" && PRODUCTS.some(product => product.id === value.id)) return value as SettingsPlace;
  }
  return {kind: "section", id: "status"};
}

export interface SettingsNavState {
  place: SettingsPlace;
  /** A row to scroll to and mark (a search result), consumed by the page. */
  focusRow: string | null;
  focusSeq: number;
}

const KEY = "oi-settings.place.v1";

function restore(): SettingsPlace {
  try {
    return restoreSettingsPlace(JSON.parse(window.sessionStorage.getItem(KEY) ?? "null"));
  } catch { /* presentation state only */ }
  return {kind: "section", id: "status"};
}

let state: SettingsNavState = {place: restore(), focusRow: null, focusSeq: 0};
const listeners = new Set<() => void>();

function publish(next: SettingsNavState) {
  state = next;
  try { window.sessionStorage.setItem(KEY, JSON.stringify(next.place)); } catch { /* presentation only */ }
  for (const listener of [...listeners]) listener();
}

export function subscribeSettingsNav(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function settingsNav(): SettingsNavState {
  return state;
}
export function useSettingsNav(): SettingsNavState {
  return useSyncExternalStore(subscribeSettingsNav, settingsNav, settingsNav);
}

export function goTo(place: SettingsPlace | PreviousPlace, focusRow: string | null = null): void {
  publish({place: canonicalPlace(place), focusRow, focusSeq: state.focusSeq + 1});
}

export function samePlace(a: SettingsPlace, b: SettingsPlace): boolean {
  return a.kind === b.kind && a.id === b.id;
}

export function placeLabel(place: SettingsPlace): string {
  return place.kind === "section"
    ? SECTIONS.find((section) => section.id === place.id)?.label ?? "Settings"
    : PRODUCTS.find((product) => product.id === place.id)?.label ?? place.id.split("/").pop()!.replace(/[-_]+/g, " ").replace(/^./, (first) => first.toUpperCase());
}
