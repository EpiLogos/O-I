/**
 * Display labels for the timeline: the one year formatter (BCE/CE), the
 * precision label of an item, and the two-row axis labels. Formatting only.
 * Every extent is the authority's (instant.ts → expandInstant) and every tick
 * is the authority's (ticks.ts → ticksForDomain); this file reads civil fields
 * off them, in the reading's own frame (epoch ms shifted by the offset the
 * anchor declares, as scale.ts does).
 *
 * The uncertainty string is not part of any label here. It is the source's own
 * verbatim text, carried on the item (TimelineItem.uncertainty) and shown in the
 * hover title by TimelineNode, so the stated precision above stays exactly the
 * precision and never a rewording of the source.
 */
import type { TemporalPrecision } from "./contracts";
import type { TimelineItem } from "./projection";
import { calendarFields, yearsPerUnit } from "./instant";

export type AxisRow = "major" | "minor";

/** The fields a precision label reads. */
export type LabelledItem = Pick<TimelineItem, "startMs" | "endMs" | "offsetMs" | "precision" | "precisionEndMs">;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** From this many years a label is deep time: its digits are grouped and its era is stated. */
const DEEP_LABEL_MIN = 10_000;

/** Digits grouped in threes: 780000 reads "780,000". */
function groupDigits(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * A calendar year as a display year. The calendar is astronomical: year 0 is
 * 1 BCE, so -500 reads "501 BCE". Positive years read plain ("1850"). From ten
 * thousand years the label groups its digits and states its era ("780,001 BCE",
 * "4,500,000,000 CE"), because a bare count that size does not say which era it
 * is in (lane-2 T4).
 */
export function formatYear(year: number): string {
  const whole = Math.trunc(year);
  if (whole <= 0) return `${groupDigits(1 - whole)} BCE`;
  return whole < DEEP_LABEL_MIN ? `${whole}` : `${groupDigits(whole)} CE`;
}

/** An English ordinal: 1st, 2nd, 3rd, 11th, 12th, 21st. */
export function ordinal(n: number): string {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  const tail = n % 10;
  const suffix = teen ? "th" : tail === 1 ? "st" : tail === 2 ? "nd" : tail === 3 ? "rd" : "th";
  return `${n}${suffix}`;
}

interface Civil {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
}

/** The civil fields of a local-frame ms, read by the authority (deep years included). */
function civil(localMs: number): Civil {
  return calendarFields(localMs);
}

function two(value: number): string {
  return String(value).padStart(2, "0");
}

function clock(c: Civil): string {
  return `${two(c.hour)}:${two(c.minute)}`;
}

function yearSpan(fromYear: number, toYear: number): string {
  return `${formatYear(fromYear)} – ${formatYear(toYear)}`;
}

/**
 * The label of the unit that contains one local-frame instant. `unitYears` is
 * the length of one unit of this precision, read from the authority's own
 * extent (`unitYearsOf`), so no ladder of unit lengths lives here.
 */
function unitLabel(localMs: number, unitYears: number, precision: TemporalPrecision): string {
  const c = civil(localMs);
  const date = `${c.day} ${MONTHS[c.month]} ${formatYear(c.year)}`;
  switch (precision) {
    case "millennium":
    case "century":
    case "decade": {
      const start = Math.floor(c.year / unitYears) * unitYears;
      // A unit that begins before year 0 states its years (BCE has no ordinal convention here). The unit that begins at
      // year 0 is the first CE century/millennium (its one BCE year aside), as every later unit is named by its start.
      if (start < 0 || (precision === "decade" && start === 0)) return yearSpan(start, start + unitYears - 1);
      if (precision === "decade") return `${start}s`;
      const index = start / unitYears + 1;
      return precision === "millennium" ? `${ordinal(index)} millennium` : `${ordinal(index)} c.`;
    }
    case "age":
    case "epoch":
    case "era":
    case "eon": {
      const start = Math.floor(c.year / unitYears) * unitYears;
      return yearSpan(start, start + unitYears - 1);
    }
    case "year":
      return formatYear(c.year);
    case "month":
      return `${MONTHS[c.month]} ${formatYear(c.year)}`;
    case "day":
      return date;
    case "hour":
      return `${date} ${two(c.hour)}:00`;
    case "minute":
      return `${date} ${clock(c)}`;
    case "second":
      return `${date} ${clock(c)}:${two(c.second)}`;
    case "subsecond":
      return `${date} ${clock(c)}:${two(c.second)}.${String(c.millisecond).padStart(3, "0")}`;
  }
}

/** Half a day in ms: the step back from a local midnight that stays inside the day before. */
const HALF_DAY_MS = 43_200_000;

/**
 * The last instant a half-open end covers: one millisecond back. Where the ms
 * scale cannot step one millisecond (beyond 2^53 ms the step is absorbed), half a
 * day back still reads the last year, because a year-level end is a local
 * midnight (lane-2 T4). Exact at human scale: the millisecond step is kept.
 */
function lastInstant(endMs: number): number {
  return endMs - 1 === endMs ? endMs - HALF_DAY_MS : endMs - 1;
}

/** Years in one unit of the item's own precision: the authority's ladder for a year-or-coarser unit, else the extent of its start instant. */
function unitYearsOf(item: LabelledItem): number {
  const known = yearsPerUnit(item.precision);
  if (known !== null) return known;
  const first = civil(item.startMs + item.offsetMs).year;
  const last = civil(lastInstant(item.precisionEndMs) + item.offsetMs).year;
  return last - first + 1;
}

/**
 * The precision label of an item, stating its precision verbatim: "1963",
 * "12th c.", "4 Mar 1850". An interval states both ends with an inclusive end
 * ("1850 – 2016"): the end is the last instant of the interval's end unit.
 */
export function precisionLabel(item: LabelledItem): string {
  const unitYears = unitYearsOf(item);
  const start = unitLabel(item.startMs + item.offsetMs, unitYears, item.precision);
  if (item.endMs === null) return start;
  const end = unitLabel(lastInstant(item.endMs) + item.offsetMs, unitYears, item.precision);
  return end === start ? start : `${start} – ${end}`;
}

/**
 * The label of a span of time, by its first and last calendar years, both
 * inclusive ("1601 – 1650"). A span within one year reads that year once. The
 * end is the last millisecond of the span, so an exclusive end is never read as
 * the year after it. Used for a cluster's span (lane-2 T12).
 */
export function spanLabel(fromMs: number, toMs: number, offsetMs: number): string {
  const first = civil(fromMs + offsetMs).year;
  const last = civil(Math.max(fromMs, lastInstant(toMs)) + offsetMs).year;
  return first === last ? formatYear(first) : yearSpan(first, last);
}

/**
 * The label of one axis mark. Year-scale marks read the year. Below a year, the
 * minor row is short ("Mar", "4", "10:00"); the major row carries its context
 * ("Mar 1850", "4 Mar 1850"). A mark's label depends only on the mark and its
 * unit, never on the window, so labels do not move between frames.
 */
export function axisLabel(ms: number, unit: TemporalPrecision, offsetMs: number, row: AxisRow): string {
  const local = ms + offsetMs;
  if (unit === "eon" || unit === "era" || unit === "epoch" || unit === "age"
    || unit === "millennium" || unit === "century" || unit === "decade" || unit === "year") {
    return formatYear(civil(local).year);
  }
  if (row === "major") return unitLabel(local, 1, unit);
  const c = civil(local);
  switch (unit) {
    case "month":
      return MONTHS[c.month];
    case "day":
      return String(c.day);
    case "hour":
      return `${two(c.hour)}:00`;
    case "minute":
      return clock(c);
    case "second":
      return `${clock(c)}:${two(c.second)}`;
    case "subsecond":
      return `${clock(c)}:${two(c.second)}.${String(c.millisecond).padStart(3, "0")}`;
  }
}
