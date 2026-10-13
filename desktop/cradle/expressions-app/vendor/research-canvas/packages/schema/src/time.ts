import { z } from "zod";

import { calendarFields, instantOffsetMs, parseTimestamp, type CalendarFields } from "../../../../../../src/techne/m0m5/timeline/scale";

/**
 * ISO-8601 temporal bound: `YYYY`, `YYYY-MM`, `YYYY-MM-DD`, or a full datetime
 * (with optional fractional seconds and timezone). Year-only bounds are legal
 * so a place, identity, or window can be bounded at exactly the precision the
 * source gives — never more.
 *
 * Years belong to the authority (desktop/cradle/src/techne/m0m5/timeline/scale.ts,
 * lane-2 T4b). A bare signed year of any length is the deep-time shape
 * ("-780000", "4500000000"); a dated year is four digits or a signed six. The
 * shape gate below is grammar only: which years are real is decided by
 * `temporalEpochMs`, never by a digit limit of this file's own.
 */
const ISO_BOUND_PATTERN =
  /^(?:(?:[+-]\d{6}|\d{4})(?:-\d{2}(?:-\d{2})?)?(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:?\d{2})?)?|[+-]?\d+)$/;

/**
 * The authority's epoch ms for one instant as written. The bound grammar admits
 * a space as the date/time separator, which the authority reads as `T`. Null
 * when the authority does not admit the instant (a malformed date, a deep year
 * with a month or day, or a legacy shorthand year it cannot place as written).
 */
export function temporalEpochMs(raw: string): number | null {
  try {
    return parseTimestamp(raw.replace(" ", "T"));
  } catch {
    return null;
  }
}

/**
 * Legacy shorthand years ("800", "-500") padded into the authority's grammar,
 * as the canvas's `canonicalInstant` pads them. Anything else comes back trimmed
 * for the authority to judge. Readers of stored legacy strings call this before
 * `temporalEpochMs`; the bound schema does not, so its rejections stay as they were.
 */
export function canonicalTemporalInstant(raw: string): string {
  const trimmed = raw.trim();
  const lead = /^([+-]?)(\d+)(?=-|$)/.exec(trimmed);
  if (!lead) return trimmed;
  const [whole, sign, digits] = lead;
  const year = sign === "-"
    ? `-${digits.padStart(6, "0")}`
    : sign === "+" || digits.length > 4
      ? `+${digits.padStart(6, "0")}`
      : digits.padStart(4, "0");
  return year + trimmed.slice(whole.length);
}

/** The civil year an instant states, read in the frame it declares (`+01:00` reads its own wall clock). Null when the authority does not admit it. */
export function temporalYear(raw: string): number | null {
  const epoch = temporalEpochMs(raw);
  return epoch === null ? null : calendarFields(epoch + instantOffsetMs(raw.replace(" ", "T"))).year;
}

/** The UTC civil fields of an admitted instant (what the static transport reports for a datetime). A deep year reads its first instant. Null when the authority does not admit it. */
export function temporalFields(raw: string): CalendarFields | null {
  const epoch = temporalEpochMs(raw);
  return epoch === null ? null : calendarFields(epoch);
}

export const isoTemporalBoundSchema = z
  .string()
  .regex(ISO_BOUND_PATTERN, "ISO-8601 date or datetime required")
  .superRefine((value, ctx) => {
    if (temporalEpochMs(value) === null) {
      ctx.addIssue({
        code: "custom",
        message: "not a calendar date, time or year the time model admits",
        path: [],
      });
    }
  });

export type IsoTemporalBound = z.infer<typeof isoTemporalBoundSchema>;

/**
 * Compares two temporal bounds when both are instants the authority admits, and
 * returns `null` when either side is not one. Ordering runs on the authority's
 * epoch ms, so a deep year orders like any other instant.
 */
export function compareTemporalBounds(a: string, b: string): number | null {
  const aMs = temporalEpochMs(a);
  const bMs = temporalEpochMs(b);
  if (aMs === null || bMs === null) {
    return null;
  }
  if (aMs === bMs) {
    return 0;
  }
  return aMs < bMs ? -1 : 1;
}

/**
 * Adds a custom issue when `start` precedes `end` and both bounds are
 * comparable. Used by every time-bounded schema so the rule lives in one place.
 */
export function checkBoundOrder(
  start: string | null | undefined,
  end: string | null | undefined,
  ctx: z.RefinementCtx,
  path: (string | number)[],
): void {
  if (start == null || end == null) {
    return;
  }
  const cmp = compareTemporalBounds(start, end);
  if (cmp !== null && cmp > 0) {
    ctx.addIssue({
      code: "custom",
      message: "end must not precede start",
      path,
    });
  }
}
