/**
 * Instrument 0's material scenes — an external store of REFERENCES.
 *
 * A scene belongs to one Technè surface (keyed by its binding id) and holds
 * material items: a Central file location, or a knowledge address. Never a
 * content copy — every reading is fetched live through the item's owner. What
 * is kept per viewer (localStorage, versioned key, every access guarded) is
 * refs + arrangement only: the items, their order, which one is selected, and
 * the owner revision recorded when each was added (so "changed since added"
 * can be said honestly). The store renders correctly with storage empty,
 * blocked or corrupt.
 */
import {useSyncExternalStore} from "react";
import type {CentralLocation, KnowledgeAddress, NativeFileEntry} from "../kernel/types";

export type MaterialRef =
  | {kind: "file"; location: CentralLocation}
  | {kind: "knowledge"; address: KnowledgeAddress; project?: string};

export interface MaterialItem {
  id: string;
  ref: MaterialRef;
  name: string;
  addedAt: number;
  /** The owner revision observed when the item was added (or first read). */
  addedRevision?: string;
}
export interface MaterialScene { items: MaterialItem[]; selectedId?: string }

const STORAGE_KEY = "oi-cradle.techne.material.v1";
const EMPTY: MaterialScene = Object.freeze({items: []}) as MaterialScene;

interface State { scenes: Record<string, MaterialScene>; active: string | null }

const isLocation = (value: unknown): value is CentralLocation => !!value && typeof value === "object"
  && (value as CentralLocation).schema === "central.path-ref/v1"
  && typeof (value as CentralLocation).ref === "string" && typeof (value as CentralLocation).root === "string" && typeof (value as CentralLocation).path === "string";
const isAddress = (value: unknown): value is KnowledgeAddress => !!value && typeof value === "object"
  && ["wiki", "source", "project-map"].includes((value as KnowledgeAddress).kind) && typeof (value as KnowledgeAddress).value === "string";

/** Validate a location that crossed a drag/drop or storage boundary. */
export function parseCentralLocation(value: unknown): CentralLocation | null {
  if (!isLocation(value)) return null;
  return {schema: "central.path-ref/v1", ref: value.ref, root: value.root, path: value.path};
}

function parseItem(value: unknown): MaterialItem | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<MaterialItem>;
  if (typeof item.id !== "string" || typeof item.name !== "string" || !item.ref || typeof item.ref !== "object") return null;
  const ref = item.ref as MaterialRef;
  const parsed: MaterialRef | null = ref.kind === "file" && isLocation(ref.location) ? {kind: "file", location: parseCentralLocation(ref.location)!}
    : ref.kind === "knowledge" && isAddress(ref.address) ? {kind: "knowledge", address: {kind: ref.address.kind, value: ref.address.value}, project: typeof ref.project === "string" ? ref.project : undefined}
    : null;
  if (!parsed) return null;
  return {id: item.id, ref: parsed, name: item.name, addedAt: typeof item.addedAt === "number" ? item.addedAt : 0, addedRevision: typeof item.addedRevision === "string" ? item.addedRevision : undefined};
}

function load(): Record<string, MaterialScene> {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null");
    if (!parsed || typeof parsed !== "object") return {};
    const scenes: Record<string, MaterialScene> = {};
    for (const [key, value] of Object.entries((parsed as {scenes?: Record<string, unknown>}).scenes ?? {})) {
      if (!value || typeof value !== "object") continue;
      const items = Array.isArray((value as MaterialScene).items) ? (value as MaterialScene).items.map(parseItem).filter((item): item is MaterialItem => !!item) : [];
      const selectedId = (value as MaterialScene).selectedId;
      scenes[key] = {items, selectedId: typeof selectedId === "string" && items.some(item => item.id === selectedId) ? selectedId : undefined};
    }
    return scenes;
  } catch { return {}; }
}

let state: State = {scenes: typeof window === "undefined" ? {} : load(), active: null};
const listeners = new Set<() => void>();
function commit(next: State, persist = true) {
  state = next;
  if (persist) try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify({scenes: state.scenes})); } catch { /* per-viewer convenience only */ }
  for (const listener of [...listeners]) listener();
}
const update = (sceneId: string, change: (scene: MaterialScene) => MaterialScene) => {
  const current = state.scenes[sceneId] ?? EMPTY, next = change(current);
  if (next !== current) commit({...state, scenes: {...state.scenes, [sceneId]: next}});
};

export const materialRefKey = (ref: MaterialRef) => ref.kind === "file" ? `file:${ref.location.ref}` : `knowledge:${ref.address.kind}:${ref.address.value}`;
export const materialRefText = (ref: MaterialRef) => ref.kind === "file" ? ref.location.path || ref.location.ref : `${ref.address.kind}:${ref.address.value}`;

export function subscribeMaterial(listener: () => void): () => void { listeners.add(listener); return () => { listeners.delete(listener); }; }
export const getMaterialScene = (sceneId: string): MaterialScene => state.scenes[sceneId] ?? EMPTY;
export const getActiveMaterialSceneId = (): string | null => state.active;

/** Add a reference. An item already in the scene is selected, not duplicated. */
export function addMaterial(sceneId: string, ref: MaterialRef, name: string, revision?: string): {id: string; added: boolean} {
  const key = materialRefKey(ref), existing = getMaterialScene(sceneId).items.find(item => materialRefKey(item.ref) === key);
  if (existing) { update(sceneId, scene => scene.selectedId === existing.id ? scene : {...scene, selectedId: existing.id}); return {id: existing.id, added: false}; }
  const id = crypto.randomUUID();
  update(sceneId, scene => ({items: [...scene.items, {id, ref, name, addedAt: Date.now(), addedRevision: revision}], selectedId: id}));
  return {id, added: true};
}
/** Removing an item removes a reference and nothing else. */
export function removeMaterial(sceneId: string, id: string) {
  update(sceneId, scene => {
    const index = scene.items.findIndex(item => item.id === id);
    if (index < 0) return scene;
    const items = scene.items.filter(item => item.id !== id);
    return {items, selectedId: scene.selectedId === id ? (items[Math.min(index, items.length - 1)]?.id) : scene.selectedId};
  });
}
export function selectMaterial(sceneId: string, id: string | undefined) { update(sceneId, scene => scene.selectedId === id ? scene : {...scene, selectedId: id}); }
export function moveMaterial(sceneId: string, id: string, delta: number) {
  update(sceneId, scene => {
    const from = scene.items.findIndex(item => item.id === id), to = Math.min(scene.items.length - 1, Math.max(0, from + delta));
    if (from < 0 || from === to) return scene;
    const items = [...scene.items]; const [moved] = items.splice(from, 1); items.splice(to, 0, moved);
    return {...scene, items};
  });
}
/** Record the owner revision an item stands on: at first reading, and again
 * when the person accepts the current revision of a changed item. */
export function recordMaterialRevision(sceneId: string, id: string, revision: string, accept = false) {
  update(sceneId, scene => {
    const item = scene.items.find(candidate => candidate.id === id);
    if (!item || (!accept && item.addedRevision !== undefined) || item.addedRevision === revision) return scene;
    return {...scene, items: scene.items.map(candidate => candidate.id === id ? {...candidate, addedRevision: revision} : candidate)};
  });
}

/** The Technè surface that receives "Add to instrument" from the navigator. */
export function setActiveMaterialScene(sceneId: string | null) { if (state.active !== sceneId) commit({...state, active: sceneId}, false); }
export function releaseActiveMaterialScene(sceneId: string) { if (state.active === sceneId) commit({...state, active: null}, false); }
/** Material-first is never a blocker: gathering works whether or not a
 * Technè surface has mounted a depth yet. The scene persists (per-viewer
 * localStorage) and renders the moment a depth mounts with its id. */
export function ensureActiveMaterialScene(): string {
  if (state.active) return state.active;
  const sceneId = `scene-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  commit({...state, scenes: {...state.scenes, [sceneId]: {...EMPTY}}, active: sceneId});
  return sceneId;
}
export function addToActiveMaterialScene(ref: MaterialRef, name: string): {sceneId: string; id: string; added: boolean} | null {
  const sceneId = ensureActiveMaterialScene();
  if (!sceneId) return null;
  return {sceneId, ...addMaterial(sceneId, ref, name)};
}

// Directory listings the material navigator has actually read, by file name —
// the only thing an OS file drop (which carries names, never Central
// locations) can honestly be resolved against.
const listed = new Map<string, Map<string, CentralLocation>>();
export function noteDirectoryListing(path: string, entries: NativeFileEntry[]) {
  listed.set(path, new Map(entries.filter(entry => entry.kind === "file" && entry.retrieval_allowed).map(entry => [entry.name, entry.location])));
}
export function forgetDirectoryListing(path: string) { listed.delete(path); }
/** Locations of listed files with this exact name. One = unambiguous. */
export function listedFilesNamed(name: string): CentralLocation[] {
  const found = new Map<string, CentralLocation>();
  for (const names of listed.values()) { const location = names.get(name); if (location) found.set(location.ref, location); }
  return [...found.values()];
}

const snapshot = () => state;
export function useMaterialState(): Readonly<State> { return useSyncExternalStore(subscribeMaterial, snapshot, snapshot); }
export function useMaterialScene(sceneId: string): MaterialScene { return useMaterialState().scenes[sceneId] ?? EMPTY; }

/** The drag type a material row carries: JSON of its `CentralLocation`. */
export const LOCATION_DRAG_TYPE = "application/x-oi-location";
/** ⌘/Ctrl+Enter in the scene: the composition root opens the file in a centre tab. */
export const TECHNE_OPEN_FILE_EVENT = "oi:techne-open-file";
export function requestOpenFileInCentre(location: CentralLocation) {
  window.dispatchEvent(new CustomEvent(TECHNE_OPEN_FILE_EVENT, {detail: {location}}));
}
