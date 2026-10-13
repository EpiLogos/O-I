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
  expandInstant,
  instantOffsetMs,
  parseTimestamp,
  ticksForDomain,
  type Tick,
  type TimeRange,
} from "../../../../../../../src/techne/m0m5/timeline/scale";
import type { TemporalPrecision } from "./contracts";

export { expandInstant, parseTimestamp, ticksForDomain, type Tick, type TimeRange };

/** An anchor's honest extent in epoch ms. `toMs` is null for an open-ended or
 * point-only anchor; a bounded `toMs` is the authority's inclusive end. */
export interface AnchorExtent {
  fromMs: number;
  /** An interval's end: the expanded end of `validTo`, an exclusive ms bound for the inclusive calendar end; null for a point-only anchor. */
  toMs: number | null;
  /** The end of the start instant's own precision unit: the authority's expansion of `validFrom`. */
  instantToMs: number;
}

const LEGACY_YEAR = /^([+-]?)(\d{1,6})((?:-\d{2}.*)?)$/u;

/** Pad a legacy year to the authority's grammar (four digits, or a sign and six).
 * Anything that is not a year-led string is returned unchanged for the authority to judge. */
export function canonicalInstant(raw: string): string {
  const trimmed = raw.trim();
  const match = LEGACY_YEAR.exec(trimmed);
  if (!match) return trimmed;
  const [, sign, digits, rest] = match;
  const year = sign === "" && digits.length <= 4
    ? digits.padStart(4, "0")
    : `${sign === "-" ? "-" : "+"}${digits.padStart(6, "0")}`;
  return `${year}${rest}`;
}

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

/** The Gregorian calendar year containing an epoch ms, as an integer. */
export function calendarYear(ms: number): number {
  return new Date(ms).getUTCFullYear();
}

/** Epoch ms of 1 January of a calendar year, from the authority's own parser. */
function yearStartMs(year: number): number {
  const text = year >= 0 && year <= 9999
    ? String(year).padStart(4, "0")
    : `${year < 0 ? "-" : "+"}${String(Math.abs(year)).padStart(6, "0")}`;
  return parseTimestamp(text);
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
