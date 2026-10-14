// lane-3 E22: deep links address refs, never indices.
// The pure parse and format of the address the app opens at and keeps current in the URL:
// `?expression=<ref>&scene=<scene_ref>&t=<seconds>&marker=<id>`. Parameters the app does not
// own (mode, world, journey, present, still, edit, nara) are carried through untouched.
// Every refusal names what was refused. The only positional form, an old `?scene=<n>`, is converted once to the
// Scene's ref and named as converted (resolveSceneRef via 'index'); no other link maps to an index.
import type {JourneyMarker} from './journeyMarkers';

export const DEEP_LINK_KEYS = ['expression', 'scene', 't', 'marker'] as const;
export const DEEP_LINK_REF_MAX = 256;

export interface DeepLinkAddress {
  expression?: string;
  scene?: string;
  t?: number;
  marker?: string;
}

/** A patch for formatDeepLink: a key present with undefined is removed from the URL; an absent key is kept. */
export type DeepLinkPatch = {[K in keyof DeepLinkAddress]?: DeepLinkAddress[K] | undefined};

export interface ParsedDeepLink {
  address: DeepLinkAddress;
  /** One named sentence per parameter that was present but not usable. Those parameters were ignored. */
  refused: string[];
}

// A ref is a non-empty run of printable characters without whitespace (kernel refs such as `expression:…` and scene ids).
const REF_PATTERN = /^[^\s\u0000-\u001f\u007f]+$/;
// Seconds from the start of the Expression: whole seconds, or up to three decimals. No signs, no exponents.
const SECONDS_PATTERN = /^\d{1,6}(?:\.\d{1,3})?$/;

/** A value for a refusal sentence: long or odd input is cut short, never echoed whole. */
export function shortenRef(value: string, max = 48): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

/** Reads the four address parameters from a query string. Malformed values are refused by name, never coerced. */
export function parseDeepLink(search: string): ParsedDeepLink {
  const params = new URLSearchParams(search);
  const address: DeepLinkAddress = {};
  const refused: string[] = [];
  for (const key of ['expression', 'scene', 'marker'] as const) {
    const value = params.get(key);
    if (value === null) continue;
    if (value.length > DEEP_LINK_REF_MAX || !REF_PATTERN.test(value)) {
      refused.push(`The link's ${key} "${shortenRef(value)}" is not a ref; it was ignored.`);
      continue;
    }
    address[key] = value;
  }
  const t = params.get('t');
  if (t !== null) {
    if (SECONDS_PATTERN.test(t)) address.t = Number(t);
    else refused.push(`The link's t "${shortenRef(t)}" is not a time in seconds; it was ignored.`);
  }
  return {address, refused};
}

function formatSeconds(seconds: number): string {
  return String(Math.round(seconds * 1000) / 1000);
}

/**
 * The query string after a patch: the four address keys are set, replaced or removed; every other
 * parameter keeps its place and value. Returns '' when no parameter remains.
 */
export function formatDeepLink(search: string, patch: DeepLinkPatch): string {
  const params = new URLSearchParams(search);
  for (const key of DEEP_LINK_KEYS) {
    if (!(key in patch)) continue;
    const value = patch[key];
    if (value === undefined) {
      params.delete(key);
      continue;
    }
    if (key === 't') {
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
        params.delete(key);
        continue;
      }
      params.set(key, formatSeconds(value));
      continue;
    }
    params.set(key, String(value));
  }
  const out = params.toString();
  return out ? `?${out}` : '';
}

export interface SceneRefCandidate {
  id: string;
  name: string;
  /** The native scene_ref the Scene is bound to, when the Expression is hosted natively. */
  ref?: string;
}

// The old positional form `?scene=<n>` (0-based, the Scene's place when the link was written). Read once, never kept.
const SCENE_INDEX_PATTERN = /^\d{1,6}$/;

/**
 * A Scene by its ref: the document id, or the native scene_ref. A name still matches, announced,
 * so older `?scene=<name>` links keep opening. An old positional `?scene=<n>` is the one index form
 * accepted: it resolves to the Scene at that place, announced as converted (via 'index'), and the
 * address is written back with that Scene's ref. An index past the end is refused by name.
 */
export function resolveSceneRef(
  scenes: readonly SceneRefCandidate[],
  ref: string,
): {index: number; id: string; via: 'ref' | 'name' | 'index'} | {refused: string} {
  const byRef = scenes.findIndex(scene => scene.id === ref || scene.ref === ref);
  if (byRef >= 0) return {index: byRef, id: scenes[byRef].id, via: 'ref'};
  const lowered = ref.toLowerCase();
  const byName = scenes.findIndex(scene => scene.name.toLowerCase() === lowered);
  if (byName >= 0) return {index: byName, id: scenes[byName].id, via: 'name'};
  if (SCENE_INDEX_PATTERN.test(ref)) {
    const index = Number(ref);
    if (index < scenes.length) return {index, id: scenes[index].id, via: 'index'};
  }
  return {refused: `No Scene "${shortenRef(ref)}" in this Expression; it opened at its first Scene.`};
}

/** A marker by its id. The ruler's locator carries the same id, so a link names the same place. */
export function resolveMarker(
  markers: readonly JourneyMarker[],
  id: string,
): {marker: JourneyMarker} | {refused: string} {
  const marker = markers.find(row => row.id === id);
  if (marker) return {marker};
  return {refused: `No marker "${shortenRef(id)}" in this Expression.`};
}

/** A requested journey time, held inside the Expression: past its end it opens at the end, and says so. */
export function clampJourneyTime(seconds: number, total: number): {time: number; clamped: boolean} {
  const end = Math.max(0, total);
  return {time: Math.min(Math.max(0, seconds), end), clamped: seconds > end};
}

/** The id of a marker the playhead stands on, within the tolerance the ruler snaps to. */
export function markerAtTime(markers: readonly JourneyMarker[], seconds: number, tolerance = 0.005): string | undefined {
  return markers.find(marker => Math.abs(marker.time - seconds) < tolerance)?.id;
}
