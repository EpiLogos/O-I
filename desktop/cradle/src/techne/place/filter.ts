/**
 * The Place temporal validity filter (L5 Technē T4) — pure functions over
 * `TechnePlaceFacet` readings (ql.techne/v1). Given an optional time window
 * (presentation state: the shared session `time_window` or the instrument's
 * local control), only facets whose validity stands at some moment inside
 * the window stay in view.
 *
 * Laws carried here (wayfinder §8, §18 T4):
 *   - filtering NEVER changes identity: a filtered-out place disappears from
 *     view only; the facet objects returned are the caller's own references,
 *     never clones, never mutations;
 *   - identity names resolve per their own validity, independent of the
 *     facet's window;
 *   - uncertainty is data: validity strings are read as given, never padded
 *     to look nicer.
 *
 * Erasable TypeScript: loadable by the renderer, Vite, and `node --test`.
 */
import type { TechnePlaceFacet, TechnePlaceHierarchyEntry, TechnePlaceName } from "../contract.ts";

/** The presentation time window: ISO-8601 bounds, null = open side. */
export interface TimeWindow {
  from: string | null;
  to: string | null;
}

/** No window: every valid facet stands. */
export const OPEN_WINDOW: TimeWindow = { from: null, to: null };

// ---------------------------------------------------------------------------
// Timestamp comparison
// ---------------------------------------------------------------------------

const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function pad(value: number, width: number): string {
  return String(value).padStart(width, "0");
}

/**
 * Widen a partial ISO-8601 timestamp to the instant it denotes on one edge
 * of an interval: a bare year or year-month means the start of its span when
 * read as a lower bound and the end of its span when read as an upper bound
 * ("1675" as a `from` begins 1675-01-01T00:00:00.000Z; as a `to` it ends
 * 1675-12-31T23:59:59.999Z). Full timestamps pass through untouched.
 */
export function expandTimestamp(value: string, edge: "start" | "end"): string {
  const year = /^(-?\d{1,6})$/.exec(value);
  if (year) {
    const y = pad(Number(year[1]), 4);
    return edge === "start" ? `${y}-01-01T00:00:00.000Z` : `${y}-12-31T23:59:59.999Z`;
  }
  const month = /^(-?\d{4,6})-(\d{2})$/.exec(value);
  if (month) {
    const y = pad(Number(month[1]), 4);
    const m = Number(month[2]);
    if (m >= 1 && m <= 12) {
      return edge === "start"
        ? `${y}-${pad(m, 2)}-01T00:00:00.000Z`
        : `${y}-${pad(m, 2)}-${pad(MONTH_DAYS[m - 1], 2)}T23:59:59.999Z`;
    }
  }
  return value;
}

/**
 * Read one timestamp as the millis it denotes on the given interval edge;
 * null when it is not parseable as ISO-8601 (the caller then falls back to
 * plain string order rather than guessing).
 */
function toMillis(value: string, edge: "start" | "end"): number | null {
  const parsed = Date.parse(expandTimestamp(value, edge));
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Order two timestamps that stand on opposite interval edges. ISO-8601 text
 * orders correctly where both parse; when either side is not parseable
 * (native refs may carry any agreed format) the raw strings order
 * lexicographically — a conservative reading, never an invented date.
 */
function beforeOrAt(a: string, aEdge: "start" | "end", b: string, bEdge: "start" | "end"): boolean {
  const aMillis = toMillis(a, aEdge);
  const bMillis = toMillis(b, bEdge);
  if (aMillis !== null && bMillis !== null) return aMillis <= bMillis;
  return a <= b;
}

/** Does one validity bound stand before/at the window's far edge? */
function coversEdge(
  validFrom: string | null | undefined,
  validTo: string | null | undefined,
  window: TimeWindow | null | undefined,
): boolean {
  const noWindow = !window || (window.from === null && window.to === null);
  if (noWindow) return true;
  // The validity interval meets the window when its start is not after the
  // window's end and its end is not before the window's start.
  if (validFrom != null && window!.to != null && !beforeOrAt(validFrom, "start", window!.to, "end")) return false;
  if (validTo != null && window!.from != null && !beforeOrAt(window!.from, "start", validTo, "end")) return false;
  return true;
}

// ---------------------------------------------------------------------------
// The filter
// ---------------------------------------------------------------------------

/**
 * Does this validity stand at some moment inside the window? Null bounds are
 * open sides; no window (undefined, null, or fully open) admits everything.
 */
export function validInWindow(
  validFrom: string | null | undefined,
  validTo: string | null | undefined,
  window?: TimeWindow | null,
): boolean {
  return coversEdge(validFrom, validTo, window);
}

/** Does the facet's own validity stand inside the window? */
export function coversWindow(facet: TechnePlaceFacet, window?: TimeWindow | null): boolean {
  return coversEdge(facet.valid_from ?? null, facet.valid_to ?? null, window);
}

/**
 * The facets visible in the window — the SAME objects, in the SAME order.
 * A filtered-out place disappears from view only; identity is untouched.
 */
export function placesInWindow(facets: readonly TechnePlaceFacet[], window?: TimeWindow | null): TechnePlaceFacet[] {
  return facets.filter((facet) => coversWindow(facet, window));
}

/**
 * The identity name that stands in the window: the latest-valid name whose
 * own validity meets it, else the latest-valid name overall (an identity outlives
 * any one label), else null when the facet discloses no names.
 */
export function nameInWindow(facet: TechnePlaceFacet, window?: TimeWindow | null): TechnePlaceName | null {
  const names = facet.identity?.names ?? [];
  if (names.length === 0) return null;
  const standing = names.filter((entry) => validInWindow(entry.valid_from ?? null, entry.valid_to ?? null, window));
  const pool = standing.length ? standing : names;
  return pool.reduce((latest, entry) => after(entry.valid_from, latest.valid_from) ? entry : latest, pool[0]);
}

function after(a?: string | null, b?: string | null): boolean {
  if (a == null) return false;
  if (b == null) return true;
  return !beforeOrAt(a, "start", b, "start");
}

/** The hierarchy entries of this facet whose own validity stands in the window. */
export function hierarchyInWindow(facet: TechnePlaceFacet, window?: TimeWindow | null): TechnePlaceHierarchyEntry[] {
  return (facet.hierarchy ?? []).filter((entry) => validInWindow(entry.valid_from ?? null, entry.valid_to ?? null, window));
}
