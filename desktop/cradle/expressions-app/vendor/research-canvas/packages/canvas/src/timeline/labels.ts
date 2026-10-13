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

export type AxisRow = "major" | "minor";

/** The fields a precision label reads. */
export type LabelledItem = Pick<TimelineItem, "startMs" | "endMs" | "offsetMs" | "precision" | "precisionEndMs">;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * A calendar year as a display year. The calendar is astronomical: year 0 is
 * 1 BCE, so -500 reads "501 BCE". Positive years read plain ("1850").
 */
export function formatYear(year: number): string {
  const whole = Math.trunc(year);
  return whole <= 0 ? `${1 - whole} BCE` : `${whole}`;
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

function civil(localMs: number): Civil {
  const d = new Date(localMs);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth(),
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    second: d.getUTCSeconds(),
    millisecond: d.getUTCMilliseconds(),
  };
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
      if (start < 1) return yearSpan(start, start + unitYears - 1);
      if (precision === "decade") return `${start}s`;
      const index = start / unitYears + 1;
      return precision === "millennium" ? `${ordinal(index)} millennium` : `${ordinal(index)} c.`;
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

/** Years in one unit of the item's own precision, from the authority's extent of its start instant. */
function unitYearsOf(item: LabelledItem): number {
  const first = civil(item.startMs + item.offsetMs).year;
  const last = civil(item.precisionEndMs - 1 + item.offsetMs).year;
  return last - first + 1;
}

/**
 * The precision label of an item, stating its precision verbatim: "1963",
 * "12th c.", "4 Mar 1850". An interval states both ends with an inclusive end
 * ("1850 – 2016"): the end is the last millisecond of the interval's end unit.
 */
export function precisionLabel(item: LabelledItem): string {
  const unitYears = unitYearsOf(item);
  const start = unitLabel(item.startMs + item.offsetMs, unitYears, item.precision);
  if (item.endMs === null) return start;
  const end = unitLabel(item.endMs - 1 + item.offsetMs, unitYears, item.precision);
  return end === start ? start : `${start} – ${end}`;
}

/**
 * The label of one axis mark. Year-scale marks read the year. Below a year, the
 * minor row is short ("Mar", "4", "10:00"); the major row carries its context
 * ("Mar 1850", "4 Mar 1850"). A mark's label depends only on the mark and its
 * unit, never on the window, so labels do not move between frames.
 */
export function axisLabel(ms: number, unit: TemporalPrecision, offsetMs: number, row: AxisRow): string {
  const local = ms + offsetMs;
  if (unit === "millennium" || unit === "century" || unit === "decade" || unit === "year") {
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
