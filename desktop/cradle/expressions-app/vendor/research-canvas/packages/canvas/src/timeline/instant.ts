/**
 * The canvas's one door to the time model. Every anchor's honest extent is the
 * authority's `expandInstant(instant, precision)`, read from
 * desktop/cradle/src/techne/m0m5/timeline/scale.ts. Nothing here parses dates
 * or ladders them itself.
 *
 * Two adapters live here, and only here:
 *  - legacy shorthand years ("800", "-500") are padded into the authority's
 *    grammar before it parses them;
 *  - the camera's year boundary (yearToMs / msToYear) is calendar-exact, so a
 *    year-start anchor lands on the same epoch ms as the camera's year.
 */
import {
  calendarFields,
  expandInstant,
  instantOffsetMs,
  parseTimestamp,
  ticksForDomain,
  yearStartMs,
  yearsPerUnit,
  type Tick,
  type TimeRange,
} from "../../../../../../../src/techne/m0m5/timeline/scale";
import type { TemporalPrecision } from "./contracts";
// The schema's year door (lane-2 T4c): legacy shorthand years are padded there,
// the one place that owns the grammar. Relative, so the node test runner resolves it.
import { canonicalTemporalInstant } from "../../../schema/src/time";

export { calendarFields, expandInstant, parseTimestamp, ticksForDomain, yearStartMs, yearsPerUnit, type Tick, type TimeRange };

/** An anchor's honest extent in epoch ms. `toMs` is null for an open-ended or
 * point-only anchor; a bounded `toMs` is the authority's inclusive end. */
export interface AnchorExtent {
  fromMs: number;
  /** An interval's end: the expanded end of `validTo`, an exclusive ms bound for the inclusive calendar end; null for a point-only anchor. */
  toMs: number | null;
  /** The end of the start instant's own precision unit: the authority's expansion of `validFrom`. */
  instantToMs: number;
}

/** Pad a legacy year to the authority's grammar: the schema's canonicalTemporalInstant. */
export const canonicalInstant = canonicalTemporalInstant;

/** The honest extent of one anchor: its start expanded at its own precision,
 * its end expanded at the same precision. Null when the start is unparseable. */
export function anchorExtent(
  validFrom: string,
  validTo: string | null,
  precision: TemporalPrecision,
): AnchorExtent | null {
  let fromRange: { fromMs: number; toMs: number };
  try {
    fromRange = expandInstant(canonicalInstant(validFrom), precision);
  } catch {
    return null;
  }
  let toMs: number | null = null;
  if (validTo !== null && validTo.trim() !== "") {
    try {
      toMs = expandInstant(canonicalInstant(validTo), precision).toMs;
    } catch {
      toMs = null;
    }
  }
  return { fromMs: fromRange.fromMs, toMs, instantToMs: fromRange.toMs };
}

/** The UTC offset the anchor's own start declares, in ms (0 when none). */
export function anchorOffsetMs(validFrom: string): number {
  return instantOffsetMs(canonicalInstant(validFrom));
}

/** The Gregorian calendar year containing an epoch ms, as an integer (the authority's civil fields, deep years included). */
export function calendarYear(ms: number): number {
  return calendarFields(ms).year;
}

/** Camera boundary: a fractional calendar year to epoch ms, linear inside that
 * calendar year. Year starts map exactly onto the authority's own year starts. */
export function yearToMs(year: number): number {
  const y0 = Math.floor(year);
  const start = yearStartMs(y0);
  return start + (year - y0) * (yearStartMs(y0 + 1) - start);
}

/** Camera boundary: epoch ms back to a fractional calendar year. */
export function msToYear(ms: number): number {
  const y0 = calendarYear(ms);
  const start = yearStartMs(y0);
  return y0 + (ms - start) / (yearStartMs(y0 + 1) - start);
}
