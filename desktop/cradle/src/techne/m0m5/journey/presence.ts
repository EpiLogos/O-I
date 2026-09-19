/**
 * The Journey's presence (L5 Technē T5 — issue #216) — the surface's ONE
 * persisted PRESENTATION-state owner, in the discipline of the Cradle's
 * layout persistence (src/surface/persist.ts): plain serialisable app state,
 * saved on every change, restored on mount, corrupt or foreign payloads
 * degrade honestly to no presence — never a guess (map §2 law 7).
 *
 * What presence is: the exact Journey position (reading basis + expression +
 * scene ref) and the local composition draft (order, pace, C′ binding) —
 * presentation composition state, so that "reload and re-enter" returns the
 * author to the same place in the same traversal (the fan-out's proving
 * adaptation). What presence is NOT: semantic state. It stores only refs and
 * presentation values — never a reading, never a scene object, never a
 * source — and the Expression substrate (oi.expression/v1) stays the ONLY
 * semantic store; a routed proposal, not this module, is how composition
 * reaches it. The lane's surface test pins that discipline.
 *
 * Validation is strict validate-then-accept per entry: a drifted entry is
 * dropped, not repaired. A restored draft is still a draft — nothing routed.
 *
 * Erasable TypeScript: loadable by the renderer, Vite, and `node --test`.
 */

/** The presence contract tag. */
export const JOURNEY_PRESENCE_SCHEMA = "ql.techne-journey-presence/v1";

/** One subject's Journey presentation state. */
export interface JourneyPresence {
  schema: typeof JOURNEY_PRESENCE_SCHEMA;
  subject_ref: string;
  reading_ref: string;
  snapshot_revision: string | null;
  expression_ref: string;
  /** The exact position: the scene the Journey was on. */
  scene_ref: string;
  /** The local composition draft carried across reload — still a draft. */
  draft?: {
    scene_order: string[];
    pace: { scene_ref: string; dwell_seconds: number }[];
  };
}

/** The minimal storage face (localStorage satisfies it; tests pass a map). */
export interface PresenceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const JOURNEY_PRESENCE_KEY = "oi-cradle.techne-journey.presence.v1";

/** The renderer's storage, or null where none exists (SSR, tests without one) —
 * presence then simply does not survive, honestly. */
export function defaultPresenceStorage(): PresenceStorage | null {
  const scope = globalThis as { localStorage?: PresenceStorage };
  return scope.localStorage ?? null;
}

function isPresence(value: unknown): value is JourneyPresence {
  if (!value || typeof value !== "object") return false;
  const entry = value as Record<string, unknown>;
  if (entry.schema !== JOURNEY_PRESENCE_SCHEMA) return false;
  for (const key of ["subject_ref", "reading_ref", "expression_ref", "scene_ref"]) {
    if (typeof entry[key] !== "string" || (entry[key] as string).trim().length === 0) return false;
  }
  if (entry.snapshot_revision !== null && typeof entry.snapshot_revision !== "string") return false;
  if (entry.draft !== undefined) {
    if (!entry.draft || typeof entry.draft !== "object") return false;
    const draft = entry.draft as Record<string, unknown>;
    if (!Array.isArray(draft.scene_order) || draft.scene_order.length === 0
      || !draft.scene_order.every((ref) => typeof ref === "string" && ref.trim().length > 0)) return false;
    if (new Set(draft.scene_order).size !== draft.scene_order.length) return false;
    if (draft.pace !== undefined) {
      if (!Array.isArray(draft.pace)) return false;
      for (const pace of draft.pace) {
        const item = pace as Record<string, unknown>;
        if (!item || typeof item.scene_ref !== "string"
          || typeof item.dwell_seconds !== "number"
          || !Number.isFinite(item.dwell_seconds) || item.dwell_seconds <= 0) return false;
      }
    }
  }
  return true;
}

/** Load every presence entry. A drifted entry is dropped; a wholly corrupt
 * payload degrades to no presence — never a guess. */
export function loadPresence(storage: PresenceStorage | null): Record<string, JourneyPresence> {
  if (!storage) return {};
  let raw: string | null = null;
  try {
    raw = storage.getItem(JOURNEY_PRESENCE_KEY);
  } catch {
    return {};
  }
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  const entries: Record<string, JourneyPresence> = {};
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    for (const [subject, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (isPresence(value) && value.subject_ref === subject) entries[subject] = value;
    }
  }
  return entries;
}

/** Save every presence entry. Storage may refuse (private mode &c.) — the
 * journey still works, it simply will not restore. Honest degradation. */
export function savePresence(storage: PresenceStorage | null, entries: Record<string, JourneyPresence>): void {
  if (!storage) return;
  try {
    storage.setItem(JOURNEY_PRESENCE_KEY, JSON.stringify(entries));
  } catch {
    // Storage unavailable — the frame still works. Never an error.
  }
}

/** Build the presence entry for one position. Refs ride verbatim from the
 * reading/selection; nothing is invented here (the tests prove every stored
 * ref exists in its sources). */
export function presenceFor(input: {
  subject_ref: string;
  reading_ref: string;
  snapshot_revision: string | null;
  expression_ref: string;
  scene_ref: string;
  draft?: { scene_order: string[]; pace: { scene_ref: string; dwell_seconds: number }[] } | null;
}): JourneyPresence {
  return {
    schema: JOURNEY_PRESENCE_SCHEMA,
    subject_ref: input.subject_ref,
    reading_ref: input.reading_ref,
    snapshot_revision: input.snapshot_revision,
    expression_ref: input.expression_ref,
    scene_ref: input.scene_ref,
    ...(input.draft && input.draft.scene_order.length ? { draft: input.draft } : {}),
  };
}

/** How a restored presence stands against the current reading: `current`
 * (same basis revision), `field-advanced` (same reading, different revision —
 * the field moved while the author was away; shown, never hidden), `stale`
 * (different reading basis — the presence no longer applies and is dropped
 * by the caller). */
export function basisStanding(presence: JourneyPresence, reading: { reading_ref: string; snapshot?: { revision: string | null } }): "current" | "field-advanced" | "stale" {
  if (presence.reading_ref !== reading.reading_ref) return "stale";
  return (presence.snapshot_revision ?? null) === (reading.snapshot?.revision ?? null) ? "current" : "field-advanced";
}
