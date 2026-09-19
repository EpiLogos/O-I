/**
 * Workspace checkpoints (workspace continuity WF1; matrix rows C19/C20):
 * the two bounded safety helpers the workspace store builds on. Nothing
 * here owns the book itself — store.ts stays the sole writer of
 * `oi-cradle.workspaces.v1`; this module gives its load path progressive
 * granularity below the whole-workspace quarantine and its save path a
 * last-known-good publication journal.
 *
 * ONE decoder law: what a saved binding or pane may be restored as is
 * decided only by `layout-codec.mjs` (through `decodeLayout`). This module
 * never re-judges validity and never forks the codec — it sanitizes the RAW
 * record with the codec's own predicate, so a single `decodeLayout` over
 * the sanitized record recovers every valid binding and pane without a
 * sibling loss. Invariant: after sanitizing, `decodeLayout` keeps exactly
 * the kept surfaces map and never turns a non-null pruned root to null.
 */

// @ts-ignore -- language-neutral layout codec (same accommodation persist.ts uses).
import { validBinding } from "../surface/layout-codec.mjs";
import { decodeLayout } from "../surface/persist";
import type { LayoutState, SurfaceBinding } from "../surface/types";

const asBinding = (raw: unknown): SurfaceBinding | null => (validBinding as (raw: unknown) => SurfaceBinding | null)(raw);

export interface ProgressiveLayoutDecode {
  /** The best valid layout, decoded once through the real codec path — or
   * null when nothing valid survived (damaged-to-empty): the caller's
   * whole-workspace quarantine path. A genuinely pristine empty workspace
   * (no surfaces, no root) is NOT null — there is nothing lost to name. */
  layout: LayoutState | null;
  /** The sanitized raw record: the input with invalid bindings dropped and
   * the pane tree pruned to valid refs, every other field untouched.
   * store.ts decodes THIS through its own `decodeWorkspaceLayout` (legacy
   * presentation upgrade + width clamp stay the store's decode ownership),
   * then `scopeLegacyIds`. */
  sanitized: Record<string, unknown>;
  /** Human notes in the store's quarantine voice ("could not be restored"). */
  notes: string[];
  /** Machine-readable: the map keys of the dropped bindings, in raw order. */
  droppedBindingIds: string[];
}

/**
 * Progressive layout decode (C19): a damaged VIEW binding need not discard
 * its pane, a damaged pane need not discard its sibling groups, a damaged
 * tree need not discard valid bindings. Caller contract: `raw` is the saved
 * layout of ONE workspace (the same record `decodeLayout` reads); the
 * envelope gate (`raw` is an object carrying a surfaces map) stays with the
 * caller — that gate is whole-record damage and quarantine is its law.
 */
export function decodeLayoutProgressive(raw: unknown, workspaceId: string): ProgressiveLayoutDecode {
  const notes: string[] = [];
  const droppedBindingIds: string[] = [];
  // Copy, never mutate: the original raw bytes may still be quarantined by
  // the caller, and a legacy-upgrade pass in the store edits in place.
  const record: Record<string, unknown> = raw && typeof raw === "object" ? { ...(raw as Record<string, unknown>) } : {};
  // 1. SURFACES — keep exactly the bindings the codec accepts, deduped by
  // binding id (two map keys claiming one id decode to one surface, which
  // the store's strict count check reads as loss; here the later copy is
  // the drop, named like any other).
  const valid = new Set<string>();
  const surfaces: Record<string, unknown> = {};
  const rawSurfaces = record.surfaces && typeof record.surfaces === "object" ? record.surfaces as Record<string, unknown> : {};
  for (const [mapKey, candidate] of Object.entries(rawSurfaces)) {
    const binding = asBinding(candidate);
    if (!binding || valid.has(binding.id)) { droppedBindingIds.push(mapKey); continue; }
    valid.add(binding.id);
    surfaces[mapKey] = candidate;
  }
  for (const id of droppedBindingIds) notes.push(`Surface binding "${id}" could not be restored and was dropped; its saved siblings were kept.`);
  record.surfaces = surfaces;
  // 2. PANE TREE — prune refs the surfaces map can no longer resolve, the
  // way the caller will want them pruned: a group keeps its valid tabs,
  // loses only the dead ones; a group left holding nothing goes (an
  // intentional empty slot survives); a split keeps its live children and
  // normalises a lone survivor, mirroring validPane's own shapes.
  let lostGroups = 0;
  const prunePane = (pane: unknown): Record<string, unknown> | null => {
    if (!pane || typeof pane !== "object") { lostGroups++; return null; }
    const o = pane as Record<string, unknown>;
    if (o.type === "group") {
      const tabs = (Array.isArray(o.tabs) ? o.tabs : []).filter((t): t is string => typeof t === "string" && valid.has(t));
      if (!tabs.length) {
        if (o.emptySlot === true) return { type: "group", id: typeof o.id === "string" ? o.id : `${workspaceId}:empty-slot`, tabs: [], pinned: [], active: null, emptySlot: true };
        lostGroups++;
        return null; // nothing valid was presented here; the dropped-binding notes name the loss
      }
      const pinned = (Array.isArray(o.pinned) ? o.pinned : []).filter((p): p is string => typeof p === "string" && tabs.includes(p));
      const active = typeof o.active === "string" && tabs.includes(o.active) ? o.active : null;
      return { type: "group", id: typeof o.id === "string" ? o.id : `${workspaceId}:group`, tabs, pinned, active };
    }
    if (o.type === "split") {
      // A split without a real children array is one lost pane; children
      // that fail name their own loss, so the all-failed split counts none.
      if (!Array.isArray(o.children)) { lostGroups++; return null; }
      const children = o.children.map(child => child == null ? null : prunePane(child)).filter((child): child is Record<string, unknown> => child !== null);
      if (!children.length) return null;
      if (children.length === 1) return children[0];
      const weights = Array.isArray(o.weights) && o.weights.length === children.length && o.weights.every((v): v is number => typeof v === "number" && Number.isFinite(v) && v > 0) ? o.weights : undefined;
      return { type: "split", id: typeof o.id === "string" ? o.id : `${workspaceId}:split`, dir: o.dir === "v" ? "v" : "h", children, ...(weights ? { weights } : {}) };
    }
    lostGroups++;
    return null;
  };
  const prunedRoot = record.root == null ? null : prunePane(record.root);
  // 3. FALLBACK — an unrepairable tree must not become silent emptiness
  // while valid bindings survive: they reopen together in one recovered
  // group. (Closed-at-save vs open-at-save is unknowable from a broken
  // tree; presenting everything recovered is the honest side of the choice,
  // and the note says what happened.)
  let root = prunedRoot;
  if (!root && valid.size) {
    const kept = [...valid];
    root = { type: "group", id: `${workspaceId}:recovered`, tabs: kept, pinned: [], active: kept[0] };
    notes.push(`The saved pane arrangement could not be restored; the ${kept.length} recovered surface${kept.length === 1 ? " was" : "s were"} reopened together in one group.`);
  }
  if (lostGroups) notes.push(`${lostGroups} saved pane group${lostGroups === 1 ? " held" : "s held"} no restorable surface and ${lostGroups === 1 ? "was" : "were"} dropped.`);
  record.root = root ?? null;
  // Damaged-to-empty: the record named material (bindings or structure)
  // and none of it survived — the caller quarantines. A record that was
  // genuinely empty restores as the empty workspace it was.
  const hadRoot = !!(raw && typeof raw === "object" && (raw as Record<string, unknown>).root != null);
  const layout: LayoutState | null = !valid.size && !root && (droppedBindingIds.length > 0 || hadRoot || lostGroups > 0) ? null : decodeLayout(record);
  return { layout, sanitized: record, notes, droppedBindingIds };
}

/**
 * Versioned publication + last-known-good (C20) — a two-slot journal beside
 * the book key, synchronous like the rest of the shell's storage.
 *
 * PUBLICATION ORDER (what the integrator wires behind store.ts's save
 * effect):
 *
 *   stageCheckpoint(key, raw)   the candidate bytes are safe in the stage
 *   localStorage.setItem(key, raw)   the live book write
 *   commitCheckpoint(key)       candidate is promoted to previous; stage clears
 *
 * An interrupted publication (staged, never committed) leaves `previous`
 * holding the last successfully published book. When the live key is ever
 * found unreadable — truncated whole-book JSON, an interrupted legacy
 * write — `lastKnownGood(key)` is the recovery source, and the damaged
 * live bytes still go to preservePresentation beside it. Two slots per
 * protected key (candidate + previous), never more; the journal is keyed
 * by storage key, and this shell protects exactly one.
 */
const STAGE_KEY = "oi-cradle.book.stage.v1";
interface StageSlot { previous?: string; candidate?: string; at?: number }
interface StageJournal { version: 1; slots: Record<string, StageSlot> }

const readJournal = (): StageJournal => {
  try {
    const journal = JSON.parse(localStorage.getItem(STAGE_KEY) ?? "null");
    return journal && typeof journal === "object" && journal.version === 1 && journal.slots && typeof journal.slots === "object" ? journal as StageJournal : { version: 1, slots: {} };
  } catch { return { version: 1, slots: {} }; }
};
const writeJournal = (journal: StageJournal): void => { localStorage.setItem(STAGE_KEY, JSON.stringify(journal)); };

/** Put the candidate bytes in the stage slot. Storage errors propagate:
 * a save that cannot be staged surfaces through the caller's save-error
 * path — it must never be swallowed into a silent partial publication. */
export function stageCheckpoint(key: string, raw: string): void {
  if (typeof raw !== "string") throw new Error("A checkpoint candidate is the raw serialized string");
  const journal = readJournal();
  journal.slots[key] = { ...journal.slots[key], candidate: raw, at: Date.now() };
  writeJournal(journal);
}

/** Promote the staged candidate to `previous` (the last-known-good slot)
 * and clear the stage. Committing with nothing staged is an honest no-op. */
export function commitCheckpoint(key: string): void {
  const journal = readJournal();
  const slot = journal.slots[key];
  if (!slot?.candidate) return;
  journal.slots[key] = { previous: slot.candidate, at: Date.now() };
  writeJournal(journal);
}

/** The last successfully published bytes for `key`, or null when no
 * publication has ever committed. Reads the journal only — never the live
 * key — so a damaged live book cannot poison the good copy. */
export function lastKnownGood(key: string): string | null {
  return readJournal().slots[key]?.previous ?? null;
}
