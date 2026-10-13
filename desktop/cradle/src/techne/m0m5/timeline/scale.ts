/**
 * Timeline time-axis math (L5 Technē T3) — pure functions over the reading's
 * temporal facets. No lifecycle, no refs minted, no state: everything here
 * takes facts in and returns numbers out.
 *
 * Precision honesty is the law of this file: a facet states what it knows
 * (millennium…subsecond) and every range this file derives is the WIDEST
 * HONEST range that precision allows — never a fabricated exact instant. A
 * millennium-precision facet expands to a thousand-year band; a
 * minute-precision instant expands to its minute; a facet with no precision
 * stays a point because the reading claims nothing more.
 *
 * Calendar arithmetic runs in each timestamp's own UTC-offset frame (the
 * instant carries its offset, e.g. `+01:00`), so day boundaries land on local
 * midnight, not UTC midnight. Erasable TypeScript: loadable by the renderer,
 * Vite, and `node --test`.
 *
 * Deep time (lane-2 T4). A year whose magnitude needs more than four digits
 * (|year| >= 10000) is written as a bare signed integer, the xsd:gYear shape
 * ("-780000", "4500000000"). It carries no month, day or clock, so its honest
 * precision is a year or coarser: age (10^6 y), epoch (10^7), era (10^8) and
 * eon (10^9) name the coarser rungs. A deep year sits on the same linear
 * epoch-ms scale as every other instant, extended to any integer year by exact
 * proleptic-Gregorian day counting; wherever JavaScript Date reaches it equals
 * Date. Years are astronomical, so year 0000 is 1 BCE.
 */
import type { TechneTemporalFacet, TechneTemporalPrecision } from "../../contract.ts";

export interface TimeRange {
  fromMs: number;
  toMs: number;
}

/** A facet's honest extent. `null` sides mean an unbounded open interval;
 * `positioned: false` means the facet carries continuity (a ref) but no
 * wall-clock position at all — the timeline renders that honestly and never
 * invents one. */
export interface FacetSpan {
  positioned: boolean;
  fromMs: number | null;
  toMs: number | null;
}

const UNIT_MS = { second: 1_000, minute: 60_000, hour: 3_600_000, day: 86_400_000 };

/** The largest epoch ms a JavaScript Date holds (years −271821 … 275760). */
const DATE_LIMIT_MS = 8.64e15;

/** A bare signed integer: a year-only instant in the xsd:gYear shape. */
const BARE_YEAR = /^[+-]?\d+$/;

/** A year of this magnitude or more needs more than four digits: deep time. */
const DEEP_YEAR_MIN = 10_000;

/** The calendar precisions that name a whole number of years. */
type YearUnit = "eon" | "era" | "epoch" | "age" | "millennium" | "century" | "decade" | "year";

const YEARS_PER_UNIT: Record<YearUnit, number> = {
  eon: 1_000_000_000,
  era: 100_000_000,
  epoch: 10_000_000,
  age: 1_000_000,
  millennium: 1_000,
  century: 100,
  decade: 10,
  year: 1,
};

function isYearUnit(precision: string): precision is YearUnit {
  return Object.prototype.hasOwnProperty.call(YEARS_PER_UNIT, precision);
}

/** The years in one unit of a year-or-coarser precision; null for a finer one.
 * The canvas reads its unit lengths here, never from a table of its own. */
export function yearsPerUnit(precision: string): number | null {
  return isYearUnit(precision) ? YEARS_PER_UNIT[precision] : null;
}

/** Precisions finer than a year: a deep year never claims one of these. */
const FINER_THAN_YEAR: ReadonlySet<string> = new Set(["month", "day", "hour", "minute", "second", "subsecond"]);

/** Days from 1 January 1970 to 1 January of `year` (proleptic Gregorian, any integer year). */
function leapYearsThrough(year: number): number {
  return Math.floor(year / 4) - Math.floor(year / 100) + Math.floor(year / 400);
}

export function yearStartDays(year: number): number {
  return 365 * (year - 1970) + (leapYearsThrough(year - 1) - leapYearsThrough(1969));
}

/** Epoch ms of 00:00 UTC on 1 January of `year`, for any integer year. Equal to
 * Date.UTC wherever Date reaches; the linear scale is extended beyond it. */
export function yearStartMs(year: number): number {
  return yearStartDays(year) * UNIT_MS.day;
}

export interface CalendarFields {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
}

/** The civil fields of one epoch ms, read in the frame it is given. Inside the
 * Date range these are Date's own fields. Beyond it the ms is read to its day,
 * and the civil fields are that year's first instant: a deep ms carries no
 * month, day or clock, so none is invented. */
export function calendarFields(ms: number): CalendarFields {
  const date = new Date(ms);
  if (Number.isFinite(date.getTime())) {
    return {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth(),
      day: date.getUTCDate(),
      hour: date.getUTCHours(),
      minute: date.getUTCMinutes(),
      second: date.getUTCSeconds(),
      millisecond: date.getUTCMilliseconds(),
    };
  }
  const day = Math.round(ms / UNIT_MS.day);
  if (!Number.isSafeInteger(day)) {
    return { year: NaN, month: NaN, day: NaN, hour: NaN, minute: NaN, second: NaN, millisecond: NaN };
  }
  let year = 1970 + Math.floor(day / 365.2425);
  while (yearStartDays(year) > day) year -= 1;
  while (yearStartDays(year + 1) <= day) year += 1;
  return { year, month: 0, day: 1, hour: 0, minute: 0, second: 0, millisecond: 0 };
}

/** Date.UTC remaps years 0–99 to 1900–1999. setUTCFullYear retains
 * the native astronomical year, while preserving calendar carry arithmetic.
 * Beyond the Date range only a year's first instant is honest, so that alone
 * is answered from the linear scale; any other civil moment there is NaN. */
function utcCalendar(year: number, month = 0, day = 1, hour = 0, minute = 0, second = 0, millisecond = 0): number {
  const date = new Date(0);
  date.setUTCFullYear(year, month, day);
  date.setUTCHours(hour, minute, second, millisecond);
  const time = date.getTime();
  if (Number.isFinite(time)) return time;
  const yearStart = month === 0 && day === 1 && hour === 0 && minute === 0 && second === 0 && millisecond === 0;
  return yearStart ? yearStartMs(year) : NaN;
}

function isDeepYear(instant: string): boolean {
  return BARE_YEAR.test(instant) && Math.abs(Number(instant)) >= DEEP_YEAR_MIN;
}

/** Parse disclosed ISO calendar dates/timestamps in their own offset frame.
 * Reduced dates expand only for comparison; source strings and precision stay
 * unchanged. Ambiguous strings and impossible dates remain unresolved. A bare
 * year of more than four digits is a deep year (year-only); a calendar date
 * with a day or a clock is accepted only where the Date range reaches. */
export function parseTimestamp(instant: string): number {
  const match = instant.match(/^([+-]\d{6}|\d{4})(?:-(\d{2})(?:-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?(Z|[+-]\d{2}:?\d{2})?)?)?)?$/i);
  const invalid = () => {throw new Error(`not a timestamp: ${instant}`);};
  if (isDeepYear(instant)) {
    const year = Number(instant);
    return Number.isSafeInteger(year) ? yearStartMs(year) : invalid();
  }
  if (!match || match[1] === '-000000') return invalid();
  const year = Number(match[1]), month = Number(match[2] ?? 1), day = Number(match[3] ?? 1);
  const hour = Number(match[4] ?? 0), minute = Number(match[5] ?? 0), second = Number(match[6] ?? 0);
  const millisecond = Number(((match[7] ?? '') + '000').slice(0, 3));
  const zone = match[8]?.match(/^([+-])(\d{2}):?(\d{2})$/);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59
    || zone && (Number(zone[2]) > 23 || Number(zone[3]) > 59)) return invalid();
  const local = utcCalendar(year, month - 1, day, hour, minute, second, millisecond), date = new Date(local);
  if (!Number.isFinite(local) || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return invalid();
  const epoch = local - instantOffsetMs(instant);
  return Number.isFinite(epoch) && Number.isFinite(new Date(epoch).getTime()) ? epoch : invalid();
}

/** The UTC offset a timestamp itself declares, in ms (e.g. `+01:00` → 3_600_000). */
export function instantOffsetMs(instant: string): number {
  if (BARE_YEAR.test(instant)) return 0;
  const match = instant.match(/([+-])(\d{2}):?(\d{2})$/);
  if (!match) return 0;
  const sign = match[1] === "-" ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3])) * UNIT_MS.minute;
}

/** Floor one local-frame ms to the precision's unit boundary. */
function truncateToLocal(localMs: number, precision: TechneTemporalPrecision): number {
  const c = calendarFields(localMs);
  switch (precision) {
    case "eon":
    case "era":
    case "epoch":
    case "age":
    case "millennium":
    case "century":
    case "decade":
    case "year": {
      const years = YEARS_PER_UNIT[precision];
      return utcCalendar(Math.floor(c.year / years) * years, 0, 1);
    }
    case "month": return utcCalendar(c.year, c.month, 1);
    case "day": return utcCalendar(c.year, c.month, c.day);
    case "hour": return utcCalendar(c.year, c.month, c.day, c.hour);
    case "minute": return utcCalendar(c.year, c.month, c.day, c.hour, c.minute);
    case "second": return utcCalendar(c.year, c.month, c.day, c.hour, c.minute, c.second);
    case "subsecond": return localMs;
  }
}

/** Advance one local-frame unit boundary by one unit of the precision. */
function addOneUnit(localMs: number, precision: TechneTemporalPrecision): number {
  if (isYearUnit(precision)) {
    const c = calendarFields(localMs);
    return utcCalendar(c.year + YEARS_PER_UNIT[precision], c.month, c.day, c.hour, c.minute, c.second, c.millisecond);
  }
  if (precision === "month") {
    const c = calendarFields(localMs);
    return utcCalendar(c.year, c.month + 1, 1);
  }
  if (precision === "day") return localMs + UNIT_MS.day;
  if (precision === "hour") return localMs + UNIT_MS.hour;
  if (precision === "minute") return localMs + UNIT_MS.minute;
  if (precision === "second") return localMs + UNIT_MS.second;
  return localMs + 1; // subsecond
}

/**
 * The honest range of one precision-qualified instant: from the unit boundary
 * the instant falls in to its end. No precision claim → a point (the reading
 * asserts nothing wider, and we invent nothing). A deep year takes only a
 * year-or-coarser precision; a finer one would claim a day it does not state.
 */
export function expandInstant(instant: string, precision?: TechneTemporalPrecision): TimeRange {
  const offset = instantOffsetMs(instant);
  const epoch = parseTimestamp(instant);
  if (!precision) return { fromMs: epoch, toMs: epoch };
  if (isDeepYear(instant) && FINER_THAN_YEAR.has(precision)) {
    throw new Error(`a deep year carries no ${precision} precision: ${instant}`);
  }
  const local = epoch + offset;
  const fromLocal = truncateToLocal(local, precision);
  const toLocal = addOneUnit(fromLocal, precision);
  return { fromMs: fromLocal - offset, toMs: toLocal - offset };
}

/**
 * One facet's honest extent. Intervals widen each bound outward by its own
 * precision (a `from` day starts at that day's midnight; a `to` day ends at
 * the next); instants expand per `expandInstant`; ref-only facets
 * (continuity without wall-clock time) are unpositioned.
 */
export function facetRange(facet: TechneTemporalFacet): FacetSpan {
  if (facet.interval) {
    const from = facet.interval.from != null
      ? (facet.interval.from_precision ? expandInstant(facet.interval.from, facet.interval.from_precision).fromMs : parseTimestamp(facet.interval.from))
      : null;
    const to = facet.interval.to != null
      ? (facet.interval.to_precision ? expandInstant(facet.interval.to, facet.interval.to_precision).toMs : parseTimestamp(facet.interval.to))
      : null;
    return { positioned: from !== null || to !== null, fromMs: from, toMs: to };
  }
  if (facet.instant) {
    const range = expandInstant(facet.instant, facet.precision);
    return { positioned: true, fromMs: range.fromMs, toMs: range.toMs };
  }
  return { positioned: false, fromMs: null, toMs: null };
}

/** The honest domain over spans: widest honest bounds, unpositioned facets
 * contributing nothing (never fabricated). Null when nothing is positioned. */
export function domainOfSpans(spans: readonly FacetSpan[]): TimeRange | null {
  let from: number | null = null;
  let to: number | null = null;
  for (const span of spans) {
    if (!span.positioned) continue;
    if (span.fromMs !== null && (from === null || span.fromMs < from)) from = span.fromMs;
    if (span.toMs !== null && (to === null || span.toMs > to)) to = span.toMs;
  }
  if (from === null && to === null) return null;
  // One-sided domains close on the bounded side — honest bounds over what exists.
  return { fromMs: from ?? (to as number), toMs: to ?? (from as number) };
}

/** The honest domain over a reading's temporal facets. */
export function domainFromFacets(facets: readonly TechneTemporalFacet[] | null | undefined): TimeRange | null {
  if (!facets?.length) return null;
  return domainOfSpans(facets.map(facetRange));
}

// ---------------------------------------------------------------------------
// Ticks
// ---------------------------------------------------------------------------

export interface Tick {
  ms: number;
  label: string;
  unit: TechneTemporalPrecision;
}

const LADDER: readonly { unit: TechneTemporalPrecision; ms: number }[] = [
  { unit: "eon", ms: UNIT_MS.day * 365.2425 * 1_000_000_000 },
  { unit: "era", ms: UNIT_MS.day * 365.2425 * 100_000_000 },
  { unit: "epoch", ms: UNIT_MS.day * 365.2425 * 10_000_000 },
  { unit: "age", ms: UNIT_MS.day * 365.2425 * 1_000_000 },
  { unit: "millennium", ms: UNIT_MS.day * 365.2425 * 1000 },
  { unit: "century", ms: UNIT_MS.day * 365.2425 * 100 },
  { unit: "decade", ms: UNIT_MS.day * 365.2425 * 10 },
  { unit: "year", ms: UNIT_MS.day * 365.2425 },
  { unit: "month", ms: UNIT_MS.day * 30.436875 },
  { unit: "day", ms: UNIT_MS.day },
  { unit: "hour", ms: UNIT_MS.hour },
  { unit: "minute", ms: UNIT_MS.minute },
  { unit: "second", ms: UNIT_MS.second },
];

function two(value: number): string {
  return String(value).padStart(2, "0");
}

function labelForLocal(localMs: number, unit: TechneTemporalPrecision): string {
  const c = calendarFields(localMs);
  if (isYearUnit(unit)) return String(c.year);
  if (unit === "month") return `${c.year}-${two(c.month + 1)}`;
  if (unit === "day") return `${c.year}-${two(c.month + 1)}-${two(c.day)}`;
  const hmi = `${two(c.hour)}:${two(c.minute)}`;
  if (unit === "hour" || unit === "minute") return hmi;
  if (unit === "second") return `${hmi}:${two(c.second)}`;
  return `${hmi}:${two(c.second)}.${String(c.millisecond).padStart(3, "0")}`;
}

/** Snap a raw step multiple to the honest 1/2/5 ladder. */
function niceMultiple(raw: number): number {
  const candidates = [1, 2, 5, 10, 15, 20, 25, 30, 50, 100, 200, 250, 500];
  const snapped = candidates.find((candidate) => candidate >= raw);
  return snapped ?? Math.ceil(raw / 500) * 500;
}

/**
 * Tick marks for one view domain, in the civil frame the facets themselves
 * declare (`offsetMs` — the instrument derives it from the reading's own
 * instants; it is never guessed from a timezone database). The unit is the
 * coarsest ladder rung that still yields at least two marks; its step is the
 * smallest honest 1/2/5 multiple that keeps the count near the target.
 * Calendar boundaries align in the civil frame, so day ticks land on local
 * midnight. A domain beyond the Date range is read at year precision and no
 * finer: its ms cannot honestly place a month, a day or a clock. Deterministic
 * and pure.
 */
export function ticksForDomain(domain: TimeRange, options?: { offsetMs?: number; targetTicks?: number }): Tick[] {
  const offsetMs = options?.offsetMs ?? 0;
  const targetTicks = options?.targetTicks ?? 6;
  const span = domain.toMs - domain.fromMs;
  const deep = Math.abs(domain.fromMs) > DATE_LIMIT_MS || Math.abs(domain.toMs) > DATE_LIMIT_MS;
  const finest: TechneTemporalPrecision = deep ? "year" : "subsecond";
  if (span <= 0) return [{ ms: domain.fromMs, label: labelForLocal(domain.fromMs + offsetMs, finest), unit: finest }];

  const localFrom = domain.fromMs + offsetMs;
  const localTo = domain.toMs + offsetMs;
  const ticks: Tick[] = [];
  const push = (localMs: number, unit: TechneTemporalPrecision) => {
    const ms = localMs - offsetMs;
    if (!ticks.some((tick) => tick.ms === ms)) ticks.push({ ms, label: labelForLocal(localMs, unit), unit });
  };

  // Below two seconds, numeric subsecond steps honestly labelled with ms.
  if (!deep && span < 2 * UNIT_MS.second) {
    const pow = Math.pow(10, Math.floor(Math.log10(span / targetTicks)));
    const mantissa = span / targetTicks / pow;
    const stepMs = (mantissa <= 1 ? 1 : mantissa <= 2 ? 2 : mantissa <= 5 ? 5 : 10) * pow;
    let boundary = Math.ceil((localFrom - offsetMs) / stepMs) * stepMs + offsetMs;
    for (let guard = 0; guard <= 400 && boundary <= localTo; guard += 1) {
      push(boundary, "subsecond");
      boundary += stepMs;
    }
    return ticks;
  }

  // The coarsest rung that still yields at least two marks. A deep domain
  // uses the year and coarser rungs only.
  const rungs = deep ? LADDER.filter((candidate) => isYearUnit(candidate.unit)) : LADDER;
  const rung = rungs.find((candidate) => span / candidate.ms >= 2) ?? rungs[rungs.length - 1];
  const unit = rung.unit;
  const step = niceMultiple(Math.ceil(span / rung.ms / targetTicks));

  if (unit === "month" || isYearUnit(unit)) {
    let boundary = truncateToLocal(localFrom, unit);
    if (unit === "month") {
      const start = calendarFields(boundary);
      const monthIndex = start.year * 12 + start.month;
      const alignedIndex = Math.floor(monthIndex / step) * step;
      boundary = utcCalendar(Math.floor(alignedIndex / 12), alignedIndex % 12, 1);
    } else {
      const yearMultiple = YEARS_PER_UNIT[unit] * step;
      const startYear = calendarFields(boundary).year;
      boundary = utcCalendar(startYear - (((startYear % yearMultiple) + yearMultiple) % yearMultiple), 0, 1);
    }
    for (let guard = 0; guard <= 400 && boundary <= localTo; guard += 1) {
      if (boundary >= localFrom) push(boundary, unit);
      boundary = advanceCalendar(boundary, unit, step);
    }
    return ticks;
  }

  const timeUnit = unit as "day" | "hour" | "minute" | "second";
  const stepMs = step * UNIT_MS[timeUnit];
  // In the civil frame the wall clock reads as UTC, so flooring to the day
  // gives local midnight; the tick grid anchors there.
  const base = Math.floor(localFrom / UNIT_MS.day) * UNIT_MS.day;
  let boundary = base + Math.ceil((localFrom - base) / stepMs) * stepMs;
  for (let guard = 0; guard <= 400 && boundary <= localTo; guard += 1) {
    push(boundary, unit);
    boundary += stepMs;
  }
  return ticks;
}

/** Advance an aligned calendar boundary by N units of the precision. */
function advanceCalendar(localMs: number, unit: "month" | YearUnit, multiple: number): number {
  const c = calendarFields(localMs);
  if (unit === "month") return utcCalendar(c.year, c.month + multiple, 1);
  return utcCalendar(c.year + YEARS_PER_UNIT[unit] * multiple, c.month, 1);
}

/** Linear time→pixel projection over one view. Pure. */
export function project(ms: number, view: TimeRange, width: number): number {
  const span = view.toMs - view.fromMs;
  if (span <= 0) return 0;
  return ((ms - view.fromMs) / span) * width;
}
