/**
 * The Palace's presentation persistence (L5 Technē, lane-5 T21) — the arrangement, the walk position and the bookmarks
 * of one Palace, saved on change and restored on mount, in the discipline of the Journey's presence owner
 * (`../journey/presence.ts`): plain serialisable state, one storage key, keyed by the reading basis
 * (`subject_ref` + NUL + `reading_ref`), validated strictly per entry, a corrupt or foreign payload restoring nothing,
 * and refused storage degrading to an unpersisted session that is told once.
 *
 * Laws carried here:
 *   - what is stored is refs and presentation values only: never a reading, a region, a document or a source. The Expression
 *     substrate stays the only semantic store; the Palace Save is its one durable edit;
 *   - a restored entry is validated against the reading NOW disclosed: a ref the reading no longer carries is dropped, never
 *     repaired or re-minted; a structurally drifted entry is dropped whole;
 *   - standing is disclosed on restore: `current` (silent), `field-advanced` (shown once, and the new basis is recorded),
 *     `stale` (another reading's arrangement, dropped and never handed back as current);
 *   - the session's own in-memory composition (palace-state.ts) is continuity, not a second store: a basis the session already
 *     holds is never overwritten by a restore.
 *
 * Erasable TypeScript: loadable by the renderer, Vite, and `node --test`.
 */
import type {TechneReading} from "../../contract.ts";
import {defaultPresenceStorage, type PresenceStorage} from "../journey/presence.ts";
import {PALACE_LOCI_PER_ROOM, PALACE_ROOMS, type PalaceLocus} from "./composition.ts";
import {
  deriveComposition,
  hasPalaceComposition,
  palaceBasis,
  palaceComposition,
  storeComposition,
  type PalaceBookmark,
  type PalaceComposition,
} from "./palace-state.ts";
import {PALACE_REGION_ORDER, type PalaceRegionKey, type PalaceRegionPlacement} from "./regions.ts";

/** The presence contract tag. */
export const PALACE_PRESENCE_SCHEMA = "ql.techne-palace-presence/v1";
/** The one storage key the Palace's presentation lives under (the Journey's own key is a different one). */
export const PALACE_PRESENCE_KEY = "oi-cradle.techne-palace.presence.v1";

/** One plain sentence each, in the Palace's status-line voice. */
export const PALACE_FIELD_ADVANCED_NOTICE = "The field moved while you were away — the Palace keeps its arrangement where its refs still stand.";
export const PALACE_STALE_NOTICE = "The palace you left belonged to another reading, so its arrangement was not restored.";
export const PALACE_UNPERSISTED_NOTICE = "Browser storage is unavailable, so this Palace arrangement will not survive a reload.";

/** The stored presentation of one reading basis. */
export interface PalacePresenceEntry {
  schema: typeof PALACE_PRESENCE_SCHEMA;
  subject_ref: string;
  reading_ref: string;
  snapshot_revision: string | null;
  bound: boolean;
  walk_index?: number;
  placements: Partial<Record<PalaceRegionKey, {ref: string; locus: PalaceLocus}[]>>;
  expressions: {expression_ref: string; locus: PalaceLocus}[];
  /** lane-5 T24: a bookmark's name and board viewport are optional: rows saved before naming load exactly as they were. Absent
   * altogether in an entry that predates bookmarks, which then restores with none. */
  bookmarks?: {region: PalaceRegionKey; ref: string; locus: PalaceLocus | null; name?: string; viewport?: {x: number; y: number; zoom: number}}[];
  /** lane-5 T15: the board's held points, keyed by studio region name. Absent in entries saved before the board. */
  board?: Record<string, {x: number; y: number}>;
  /** lane-5 T15: the board's pan and zoom. Absent in entries saved before the board. */
  viewport?: {x: number; y: number; zoom: number};
}

/** How a restore stands. `persisted` is false when storage is absent or refused. */
export interface PalaceRestore {
  standing: "none" | "current" | "field-advanced" | "stale";
  composition: PalaceComposition;
  notice?: string;
  persisted: boolean;
}

const NUL = "\u0000";

const isObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const isIndex = (value: unknown, bound: number): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) < bound;
const isRegionKey = (value: unknown): value is PalaceRegionKey =>
  typeof value === "string" && (PALACE_REGION_ORDER as readonly string[]).includes(value);
const isText = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
/** A finite board point. A NaN or infinite coordinate is never a position. */
const isPoint = (value: unknown): value is {x: number; y: number} =>
  isObject(value) && Number.isFinite(value.x) && Number.isFinite(value.y);
/** A finite pan and a finite positive zoom. */
const isViewport = (value: unknown): value is {x: number; y: number; zoom: number} =>
  isObject(value) && Number.isFinite(value.x) && Number.isFinite(value.y) && Number.isFinite(value.zoom) && (value.zoom as number) > 0;

/** The studio region name whose board point is not finite, or null when every board point is a position. Names the refusal. */
export function refusedBoardPoint(entry: unknown): string | null {
  if (!isObject(entry) || entry.board === undefined || !isObject(entry.board)) return null;
  for (const [name, point] of Object.entries(entry.board)) {
    if (!isPoint(point)) return name;
  }
  return null;
}

function isLocus(value: unknown): value is PalaceLocus {
  if (!isObject(value) || !isObject(value.room)) return false;
  return isIndex(value.room.column, PALACE_ROOMS.columns) && isIndex(value.room.row, PALACE_ROOMS.rows)
    && isIndex(value.locus, PALACE_LOCI_PER_ROOM);
}

/** Strict validate-then-accept: any structural drift makes the whole entry absent. Refs are checked against the reading later. */
function validEntry(value: unknown, subject: string, key: string): PalacePresenceEntry | null {
  if (!isObject(value) || value.schema !== PALACE_PRESENCE_SCHEMA || value.subject_ref !== subject) return null;
  if (!isText(value.reading_ref) || `${subject}${NUL}${value.reading_ref}` !== key) return null;
  if (value.snapshot_revision !== null && typeof value.snapshot_revision !== "string") return null;
  if (typeof value.bound !== "boolean") return null;
  if (value.walk_index !== undefined && !(Number.isSafeInteger(value.walk_index) && (value.walk_index as number) >= 0)) return null;
  if (!isObject(value.placements)) return null;
  for (const [regionKey, rows] of Object.entries(value.placements)) {
    if (!isRegionKey(regionKey) || !Array.isArray(rows)) return null;
    for (const row of rows) {
      if (!isObject(row) || !isText(row.ref) || !isLocus(row.locus)) return null;
    }
  }
  if (!Array.isArray(value.expressions)) return null;
  for (const row of value.expressions) {
    if (!isObject(row) || !isText(row.expression_ref) || !isLocus(row.locus)) return null;
  }
  // lane-5 T24: bookmarks may be absent (an entry that predates them); a present row's name and viewport are checked when given.
  if (value.bookmarks !== undefined) {
    if (!Array.isArray(value.bookmarks)) return null;
    for (const row of value.bookmarks) {
      if (!isObject(row) || !isRegionKey(row.region) || !isText(row.ref)) return null;
      if (row.locus !== null && !isLocus(row.locus)) return null;
      if (row.name !== undefined && !isText(row.name)) return null;
      if (row.viewport !== undefined && !isViewport(row.viewport)) return null;
    }
  }
  // lane-5 T15: optional board fields. A non-finite board point refuses the whole entry (refusedBoardPoint names it); an absent field is an older entry, accepted unchanged.
  if (value.board !== undefined) {
    if (!isObject(value.board)) return null;
    for (const point of Object.values(value.board)) {
      if (!isPoint(point)) return null;
    }
  }
  if (value.viewport !== undefined && !isViewport(value.viewport)) return null;
  return value as unknown as PalacePresenceEntry;
}

/** Read every entry. Storage may refuse, and a corrupt payload is no presence: neither is ever an error. */
function readEntries(storage: PresenceStorage | null): {entries: Record<string, PalacePresenceEntry>; available: boolean} {
  if (!storage) return {entries: {}, available: false};
  let raw: string | null;
  try {
    raw = storage.getItem(PALACE_PRESENCE_KEY);
  } catch {
    return {entries: {}, available: false};
  }
  const entries: Record<string, PalacePresenceEntry> = {};
  if (!raw) return {entries, available: true};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {entries, available: true};
  }
  if (!isObject(parsed)) return {entries, available: true};
  for (const [key, value] of Object.entries(parsed)) {
    const separator = key.indexOf(NUL);
    if (separator <= 0) continue;
    const entry = validEntry(value, key.slice(0, separator), key);
    if (entry) entries[key] = entry;
  }
  return {entries, available: true};
}

/** Load every valid entry. A corrupt, foreign or unavailable payload is `{}`, never a guess. */
export function loadPalacePresence(storage: PresenceStorage | null): Record<string, PalacePresenceEntry> {
  return readEntries(storage).entries;
}

/** The renderer's storage, or null where none can be reached (a refused origin included). */
export function palacePresenceStorage(): PresenceStorage | null {
  try {
    return defaultPresenceStorage();
  } catch {
    return null;
  }
}

/** Serialise one composition's presentation: refs and presentation values only. */
function encode(composition: PalaceComposition, reading: TechneReading): PalacePresenceEntry {
  const placements: PalacePresenceEntry["placements"] = {};
  for (const [key, rows] of Object.entries(composition.placements) as [PalaceRegionKey, PalaceRegionPlacement[] | undefined][]) {
    if (rows) placements[key] = rows.map((row) => ({ref: row.ref, locus: structuredClone(row.locus)}));
  }
  return {
    schema: PALACE_PRESENCE_SCHEMA,
    subject_ref: reading.subject.subject_ref,
    reading_ref: reading.reading_ref,
    snapshot_revision: reading.snapshot?.revision ?? null,
    bound: composition.bound,
    ...(composition.walk_index !== undefined ? {walk_index: composition.walk_index} : {}),
    placements,
    expressions: composition.expressions.placements.map((row) => ({expression_ref: row.expression_ref, locus: structuredClone(row.locus)})),
    bookmarks: composition.bookmarks.map((bookmark) => ({
      region: bookmark.region,
      ref: bookmark.ref,
      locus: structuredClone(bookmark.locus),
      ...(bookmark.name !== undefined ? {name: bookmark.name} : {}),
      ...(bookmark.viewport ? {viewport: {x: bookmark.viewport.x, y: bookmark.viewport.y, zoom: bookmark.viewport.zoom}} : {}),
    })),
    ...(composition.board ? {board: copyBoard(composition.board)} : {}),
    ...(composition.viewport ? {viewport: {x: composition.viewport.x, y: composition.viewport.y, zoom: composition.viewport.zoom}} : {}),
  };
}

/** Saved loci grouped by their ref, in saved order. A ref the arrangement names more than once takes its own saved locus each
 * time, in order, so a repeated ref never collapses onto its last locus. */
function lociQueue<T extends {locus: PalaceLocus}>(rows: readonly T[], refOf: (row: T) => string): Map<string, PalaceLocus[]> {
  const queues = new Map<string, PalaceLocus[]>();
  for (const row of rows) {
    const queue = queues.get(refOf(row));
    if (queue) queue.push(row.locus);
    else queues.set(refOf(row), [row.locus]);
  }
  return queues;
}

/** A plain copy of the board's held points: names and finite coordinates, nothing shared with the composition. */
function copyBoard(board: Record<string, {x: number; y: number}>): Record<string, {x: number; y: number}> {
  const out: Record<string, {x: number; y: number}> = {};
  for (const [name, point] of Object.entries(board)) out[name] = {x: point.x, y: point.y};
  return out;
}

/** Save one composition for its reading, replacing that subject's earlier basis. Returns false when storage refuses (never throws). */
export function savePalaceComposition(storage: PresenceStorage | null, composition: PalaceComposition, reading: TechneReading): boolean {
  if (!storage) return false;
  try {
    const subject = reading.subject.subject_ref;
    const {entries} = readEntries(storage);
    const next: Record<string, PalacePresenceEntry> = {};
    for (const [key, entry] of Object.entries(entries)) if (!key.startsWith(`${subject}${NUL}`)) next[key] = entry;
    // Saved by the same predicate it is loaded by: an entry the next load would refuse (a non-finite board point, a bad viewport or
    // bookmark) is never written, so one bad reading cannot void the saved walk, bookmarks and placements. The last good entry stands.
    const key = palaceBasis(reading), entry = encode(composition, reading);
    if (validEntry(JSON.parse(JSON.stringify(entry)), subject, key) === null) return false;
    next[key] = entry;
    storage.setItem(PALACE_PRESENCE_KEY, JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}

/** Apply one stored entry to the reading's derived composition. Refs the reading no longer carries are dropped, never repaired. */
function applyEntry(base: PalaceComposition, entry: PalacePresenceEntry): PalaceComposition {
  const placements: PalaceComposition["placements"] = {};
  for (const key of PALACE_REGION_ORDER) {
    const current = base.placements[key];
    if (!current) continue;
    const saved = lociQueue(entry.placements[key] ?? [], (row) => row.ref);
    placements[key] = current.map((placement) => {
      const locus = saved.get(placement.ref)?.shift();
      return locus ? {ref: placement.ref, locus: structuredClone(locus)} : placement;
    });
  }
  const present = new Set(base.regions.flatMap((region) => region.entries.map((candidate) => candidate.ref)));
  const savedExpressions = lociQueue(entry.expressions, (row) => row.expression_ref);
  const expressions = {
    ...base.expressions,
    placements: base.expressions.placements.map((placement) => {
      const locus = savedExpressions.get(placement.expression_ref)?.shift();
      return locus ? {expression_ref: placement.expression_ref, locus: structuredClone(locus)} : placement;
    }),
  };
  const bookmarks: PalaceBookmark[] = (entry.bookmarks ?? [])
    .filter((row) => present.has(row.ref) && base.regions.some((region) => region.key === row.region && region.entries.some((candidate) => candidate.ref === row.ref)))
    .map((row) => ({
      region: row.region,
      ref: row.ref,
      locus: row.locus === null ? null : structuredClone(row.locus),
      ...(row.name !== undefined ? {name: row.name} : {}),
      ...(row.viewport ? {viewport: {x: row.viewport.x, y: row.viewport.y, zoom: row.viewport.zoom}} : {}),
    }));
  return {
    ...base,
    bound: entry.bound,
    placements,
    expressions,
    bookmarks,
    ...(entry.walk_index !== undefined ? {walk_index: entry.walk_index} : {}),
    ...(entry.board ? {board: copyBoard(entry.board)} : {}),
    ...(entry.viewport ? {viewport: {x: entry.viewport.x, y: entry.viewport.y, zoom: entry.viewport.zoom}} : {}),
  };
}

/** Restore one reading's Palace presentation on mount. The session's own composition wins when it already holds the basis. */
export function restorePalaceComposition(reading: TechneReading, storage: PresenceStorage | null): PalaceRestore {
  const {entries, available} = readEntries(storage);
  if (hasPalaceComposition(reading)) return {standing: "none", composition: palaceComposition(reading), persisted: available};
  const base = deriveComposition(reading);
  if (!available) return {standing: "none", composition: base, persisted: false, notice: PALACE_UNPERSISTED_NOTICE};
  const exact = entries[palaceBasis(reading)];
  if (exact) {
    const standing = (exact.snapshot_revision ?? null) === (reading.snapshot?.revision ?? null) ? "current" : "field-advanced";
    const composition = storeComposition(applyEntry(base, exact));
    if (standing === "current") return {standing, composition, persisted: true};
    // The field moved: the new basis is recorded now, so the notice is shown once.
    savePalaceComposition(storage, composition, reading);
    return {standing, composition, persisted: true, notice: PALACE_FIELD_ADVANCED_NOTICE};
  }
  const subject = reading.subject.subject_ref;
  if (Object.keys(entries).some((key) => key.startsWith(`${subject}${NUL}`))) {
    return {standing: "stale", composition: base, persisted: true, notice: PALACE_STALE_NOTICE};
  }
  return {standing: "none", composition: base, persisted: true};
}
