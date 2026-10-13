// The graph's own settings, remembered: the four forces, the occurrences and the relations.
// Depth is not kept: it belongs to the subject being looked at. Every read and write is guarded, because a private
// window or blocked site data must leave the graph working, with its defaults, and nothing else broken.
// [§8.4 host adaptation, DEVICE-SEMANTICS-LOCK] the found module remembers on this browser (localStorage). In the
// shell, settings live in the workspace's sets, never in browser storage: the host binds the store
// (`setGraphSettingsStore`); unbound, nothing is remembered. [C2-b5] the relation bases are the provider's
// declaration (was the literal 'jung' · 'inferred' · 'site' triple).
import { DEFAULT_TIE_BASES, type TieBasis } from '../types/field';
import { DEFAULT_FORCES, FORCE_ROWS, type Forces } from './forces';

/**
 * The tiers the graph draws. Occurrences answer to `dust` (the toggle that was always there); the three node tiers
 * of the field answer here — a tier switched off is absent from the drawing with its ties, never left stranded.
 */
export interface KindFlags {
  archetype: boolean;
  theoretic: boolean;
  family: boolean;
}

export const DEFAULT_KINDS: KindFlags = { archetype: true, theoretic: true, family: true };

export interface GraphSettings {
  forces: Forces;
  /** occurrences (the dust) shown */
  dust: boolean;
  /** which relations are followed */
  ties: TieBasis[];
  /** which tiers are drawn (occurrences answer to `dust`) */
  kinds: KindFlags;
}

const FOUNDING_BASES: readonly TieBasis[] = DEFAULT_TIE_BASES.map((b) => b.id);
export const DEFAULT_SETTINGS: GraphSettings = { forces: { ...DEFAULT_FORCES }, dust: true, ties: [...FOUNDING_BASES], kinds: { ...DEFAULT_KINDS } };
export const SETTINGS_KEY = 'archetypal-earth.graph';

/** The four forces from whatever was stored: a missing or non-numeric key is the default, and every number is held to its slider's range. */
export function clampForces(raw: unknown): Forces {
  const out: Forces = { ...DEFAULT_FORCES };
  if (!raw || typeof raw !== 'object') return out;
  const o = raw as Record<string, unknown>;
  for (const r of FORCE_ROWS) {
    const v = o[r.key];
    if (typeof v === 'number' && Number.isFinite(v)) out[r.key] = Math.min(r.max, Math.max(r.min, v));
  }
  return out;
}

/**
 * The settings from stored text. Null, empty, corrupt or non-object text gives the defaults; so does a key that is
 * missing or of the wrong type. An empty list of relations is a choice the person made (all off) and is kept.
 */
export function parseSettings(text: string | null | undefined, BASES: readonly TieBasis[] = FOUNDING_BASES): GraphSettings {
  const fresh = (): GraphSettings => ({ ...DEFAULT_SETTINGS, forces: { ...DEFAULT_FORCES }, ties: [...BASES], kinds: { ...DEFAULT_KINDS } });
  if (typeof text !== 'string' || !text) return fresh();
  let o: unknown;
  try {
    o = JSON.parse(text);
  } catch {
    return fresh();
  }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return fresh();
  const rec = o as Record<string, unknown>;
  let ties: TieBasis[] = [...BASES];
  if (Array.isArray(rec.ties)) {
    if (rec.ties.length === 0) ties = [];
    else {
      const valid = [...new Set(rec.ties.filter((b): b is TieBasis => typeof b === 'string' && (BASES as readonly string[]).includes(b)))];
      if (valid.length) ties = BASES.filter((b) => valid.includes(b));
    }
  }
  return {
    forces: clampForces(rec.forces),
    dust: typeof rec.dust === 'boolean' ? rec.dust : DEFAULT_SETTINGS.dust,
    ties,
    kinds: clampKinds(rec.kinds),
  };
}

/** The tier flags from whatever was stored: a missing or non-boolean key is the default (drawn). */
export function clampKinds(raw: unknown): KindFlags {
  const out: KindFlags = { ...DEFAULT_KINDS };
  if (!raw || typeof raw !== 'object') return out;
  const o = raw as Record<string, unknown>;
  for (const k of ['archetype', 'theoretic', 'family'] as const) if (typeof o[k] === 'boolean') out[k] = o[k] as boolean;
  return out;
}

/** The minimal store this needs: the host's (the workspace's sets), or nothing. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** [§8.4] the host-bound store; null until the host binds the workspace's sets. */
let hostStore: KeyValueStore | null = null;

/** The host binds where the graph's settings live (the workspace). Never browser storage. */
export function setGraphSettingsStore(store: KeyValueStore | null): void {
  hostStore = store;
}

/** The bound store, or null (the found module returned this browser's localStorage). */
export function browserStore(): KeyValueStore | null {
  return hostStore;
}

export function loadSettings(bases: readonly TieBasis[] = FOUNDING_BASES, store: KeyValueStore | null = browserStore()): GraphSettings {
  try {
    return parseSettings(store ? store.getItem(SETTINGS_KEY) : null, bases);
  } catch {
    return parseSettings(null, bases);
  }
}

/** Write the settings. A failed write (quota, private window) is dropped: the layout still follows the person. */
export function saveSettings(s: GraphSettings, store: KeyValueStore | null = browserStore()): void {
  try {
    store?.setItem(SETTINGS_KEY, JSON.stringify({ v: 1, forces: s.forces, dust: s.dust, ties: s.ties, kinds: s.kinds }));
  } catch {
    // no storage: nothing to keep
  }
}
