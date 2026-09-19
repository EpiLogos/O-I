/**
 * Visitor annotations on an Epi-Logos passage — kept on this device only,
 * plain text, never part of the corpus. A per-viewer localStorage store:
 * every access is wrapped in try/catch and the caller reads an empty/absent
 * result when storage is unavailable, so the reading view still renders.
 */
import type {EpiFamily} from "./places";

const KEY = "oi-cradle.epilogos.annotations.v1";

export interface EpiAnnotation { text: string; updatedAtIso: string }
type Store = Record<string, EpiAnnotation>;

function annotationKey(family: EpiFamily, placeRef: string, passageId: string): string {
  return `${family}:${placeRef}:${passageId}`;
}

function load(): Store {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(KEY) ?? "null");
    return parsed && typeof parsed === "object" ? parsed as Store : {};
  } catch { return {}; }
}
function save(store: Store): boolean {
  try { window.localStorage.setItem(KEY, JSON.stringify(store)); return true; }
  catch { return false; }
}

export function getEpiAnnotation(family: EpiFamily, placeRef: string, passageId: string): EpiAnnotation | undefined {
  return load()[annotationKey(family, placeRef, passageId)];
}

export function setEpiAnnotation(family: EpiFamily, placeRef: string, passageId: string, text: string): boolean {
  const store = load();
  const key = annotationKey(family, placeRef, passageId);
  const trimmed = text.trim();
  if (!trimmed) { delete store[key]; return save(store); }
  store[key] = {text, updatedAtIso: new Date().toISOString()};
  return save(store);
}

export function removeEpiAnnotation(family: EpiFamily, placeRef: string, passageId: string): boolean {
  const store = load();
  delete store[annotationKey(family, placeRef, passageId)];
  return save(store);
}
