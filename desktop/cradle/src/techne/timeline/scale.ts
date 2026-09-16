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
 */
import type { TechneTemporalFacet, TechneTemporalPrecision } from "../contract.ts";

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

const OFFSET_PATTERN = /(?:[Zz]|[+-]\d{2}:?\d{2})$/;

/** Parse one contract timestamp to epoch ms. A timestamp without an offset
 * suffix is read as UTC (deterministic; Date.parse alone would read the
 * host's local zone). */
export function parseTimestamp(instant: string): number {
  const value = OFFSET_PATTERN.test(instant) ? instant : `${instant}Z`;
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) throw new Error(`not a timestamp: ${instant}`);
  return ms;
}

/** The UTC offset a timestamp itself declares, in ms (e.g. `+01:00` → 3_600_000). */
export function instantOffsetMs(instant: string): number {
  const match = instant.match(/([+-])(\d{2}):?(\d{2})$/);
  if (!match) return 0;
  const sign = match[1] === "-" ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3])) * UNIT_MS.minute;
}

/** Floor one local-frame ms to the precision's unit boundary. */
function truncateToLocal(localMs: number, precision: TechneTemporalPrecision): number {
  const d = new Date(localMs);
  const y = d.getUTCFullYear();
  const mo = d.getUTCMonth();
  const da = d.getUTCDate();
  switch (precision) {
    case "millennium": return Date.UTC(Math.floor(y / 1000) * 1000, 0, 1);
    case "century": return Date.UTC(Math.floor(y / 100) * 100, 0, 1);
    case "decade": return Date.UTC(Math.floor(y / 10) * 10, 0, 1);
    case "year": return Date.UTC(y, 0, 1);
    case "month": return Date.UTC(y, mo, 1);
    case "day": return Date.UTC(y, mo, da);
    case "hour": return Date.UTC(y, mo, da, d.getUTCHours());
    case "minute": return Date.UTC(y, mo, da, d.getUTCHours(), d.getUTCMinutes());
    case "second": return Date.UTC(y, mo, da, d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds());
    case "subsecond": return localMs;
  }
}

/** Advance one local-frame unit boundary by one unit of the precision. */
function addOneUnit(localMs: number, precision: TechneTemporalPrecision): number {
  if (precision === "millennium" || precision === "century" || precision === "decade" || precision === "year") {
    const d = new Date(localMs);
    const years = precision === "millennium" ? 1000 : precision === "century" ? 100 : precision === "decade" ? 10 : 1;
    return Date.UTC(d.getUTCFullYear() + years, d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(), d.getUTCMilliseconds());
  }
  if (precision === "month") {
    const d = new Date(localMs);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
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
 * asserts nothing wider, and we invent nothing).
 */
export function expandInstant(instant: string, precision?: TechneTemporalPrecision): TimeRange {
  const offset = instantOffsetMs(instant);
  const epoch = parseTimestamp(instant);
  if (!precision) return { fromMs: epoch, toMs: epoch };
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
  const d = new Date(localMs);
  const y = d.getUTCFullYear();
  if (unit === "millennium" || unit === "century" || unit === "decade" || unit === "year") return String(y);
  if (unit === "month") return `${y}-${two(d.getUTCMonth() + 1)}`;
  if (unit === "day") return `${y}-${two(d.getUTCMonth() + 1)}-${two(d.getUTCDate())}`;
  const hmi = `${two(d.getUTCHours())}:${two(d.getUTCMinutes())}`;
  if (unit === "hour" || unit === "minute") return hmi;
  if (unit === "second") return `${hmi}:${two(d.getUTCSeconds())}`;
  return `${hmi}:${two(d.getUTCSeconds())}.${String(d.getUTCMilliseconds()).padStart(3, "0")}`;
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
 * midnight. Deterministic and pure.
 */
export function ticksForDomain(domain: TimeRange, options?: { offsetMs?: number; targetTicks?: number }): Tick[] {
  const offsetMs = options?.offsetMs ?? 0;
  const targetTicks = options?.targetTicks ?? 6;
  const span = domain.toMs - domain.fromMs;
  if (span <= 0) return [{ ms: domain.fromMs, label: labelForLocal(domain.fromMs + offsetMs, "subsecond"), unit: "subsecond" }];

  const localFrom = domain.fromMs + offsetMs;
  const localTo = domain.toMs + offsetMs;
  const ticks: Tick[] = [];
  const push = (localMs: number, unit: TechneTemporalPrecision) => {
    const ms = localMs - offsetMs;
    if (!ticks.some((tick) => tick.ms === ms)) ticks.push({ ms, label: labelForLocal(localMs, unit), unit });
  };

  // Below two seconds, numeric subsecond steps honestly labelled with ms.
  if (span < 2 * UNIT_MS.second) {
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

  // The coarsest rung that still yields at least two marks.
  const rung = LADDER.find((candidate) => span / candidate.ms >= 2) ?? LADDER[LADDER.length - 1];
  const unit = rung.unit;
  const step = niceMultiple(Math.ceil(span / rung.ms / targetTicks));

  const calendar = ["millennium", "century", "decade", "year", "month"].includes(unit);
  if (calendar) {
    let boundary = truncateToLocal(localFrom, unit);
    if (unit === "month") {
      const start = new Date(boundary);
      const monthIndex = start.getUTCFullYear() * 12 + start.getUTCMonth();
      const alignedIndex = Math.floor(monthIndex / step) * step;
      boundary = Date.UTC(Math.floor(alignedIndex / 12), alignedIndex % 12, 1);
    } else {
      const yearMultiple = unit === "millennium" ? 1000 * step : unit === "century" ? 100 * step : unit === "decade" ? 10 * step : step;
      const startYear = new Date(boundary).getUTCFullYear();
      boundary = Date.UTC(startYear - (((startYear % yearMultiple) + yearMultiple) % yearMultiple), 0, 1);
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
function advanceCalendar(localMs: number, unit: TechneTemporalPrecision, multiple: number): number {
  const d = new Date(localMs);
  if (unit === "month") return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + multiple, 1);
  const years = (unit === "millennium" ? 1000 : unit === "century" ? 100 : unit === "decade" ? 10 : 1) * multiple;
  return Date.UTC(d.getUTCFullYear() + years, d.getUTCMonth(), 1);
}

/** Linear time→pixel projection over one view. Pure. */
export function project(ms: number, view: TimeRange, width: number): number {
  const span = view.toMs - view.fromMs;
  if (span <= 0) return 0;
  return ((ms - view.fromMs) / span) * width;
}
