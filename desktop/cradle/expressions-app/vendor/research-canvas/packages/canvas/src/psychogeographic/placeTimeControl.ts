/**
 * Lane-4 T14–T16 — the docked time control on the Places map, as pure logic.
 *
 * No DOM, no maplibre, no kernel. The map reads these functions to draw the
 * track, drag the window, step and animate it, and name why it is unavailable.
 *
 * Laws held here:
 *  - nothing temporal is redefined: the extent is the lane-2 scale authority's
 *    domain over the reading's own temporal facets (scale.ts domainFromFacets),
 *    the labels are the timeline's own (labels.ts spanLabel), and a frame's
 *    validity filter is the place filter's own (filter.ts placesInWindow);
 *  - the window is presentation state: the host writes it to the shared session,
 *    and this module never writes a bound;
 *  - the control filters data and never turns imagery back in time (T16).
 *
 * Erasable TypeScript: loadable by Vite, the surface and `node --test`.
 */
import type { TechnePlaceFacet, TechneTemporalFacet } from "../../../../../../../src/techne/contract";
import { domainFromFacets } from "../../../../../../../src/techne/m0m5/timeline/scale";
import { expandTimestamp, placesInWindow, type TimeWindow } from "../../../../../../../src/techne/m0m5/place/filter";
import { spanLabel } from "../timeline/labels";

/** The dated extent of a reading, in epoch milliseconds (lane-2 domain). */
export interface TimeExtent {
  fromMs: number;
  toMs: number;
}

/** A window drawn on the track: always inside the extent once clamped. */
export interface TimeSpan {
  fromMs: number;
  toMs: number;
}

export const PLAYBACK_SPEEDS = [1, 2, 4] as const;
export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number];

/** At ×1 the window travels one window-width per this many seconds; ×2 and ×4 are faster. */
export const SECONDS_PER_WINDOW_AT_1X = 6;
/** An open window, stepped or played, starts one eighth of the extent wide. */
export const DEFAULT_WINDOW_FRACTION = 8;
/** Keyboard nudges move a handle by one hundredth of the extent. */
export const NUDGE_FRACTION = 100;

export const IMAGERY_TIME_NOTE = "data window · imagery not time-aware";
export const NO_DATED_REASON = "No dated material in this reading, so there is no window to move.";
export const NO_SPAN_REASON = "The dated material has no span to move across: one instant, or open-ended.";
export const REDUCED_MOTION_NOTE = "Reduced motion is on: the window steps but does not animate.";

export type WindowHandle = "from" | "to" | "body";

/** What the host offers the map: the extent, why there is none, the shared window, and the write. */
export interface PlaceTimeHost {
  extent: TimeExtent | null;
  /** Why there is no extent, in short words; the default names the absence of dated material. */
  extentReason?: string | null;
  /** Why the shared window cannot be changed here (for example, shared time is not acknowledged). */
  unavailableReason?: string | null;
  /** The acknowledged shared window; null is an open window. */
  window: TimeWindow | null;
  /** Writes a window to the shared session. Resolves when the owner acknowledges it, rejects with its words when it refuses. */
  onWindowCommit(next: TimeWindow): void | Promise<void>;
}

export interface TimeControlStatus {
  enabled: boolean;
  /** Null when enabled; otherwise the short reason the control is disabled. */
  reason: string | null;
  /** Playback needs an enabled control and motion the person has not turned off. */
  playable: boolean;
  /** Null when playable; otherwise why playback is not offered (the reduced-motion note also reads here). */
  playReason: string | null;
}

// ---------------------------------------------------------------------------
// Extent and availability
// ---------------------------------------------------------------------------

/** The dated extent of the reading's temporal facets, or the honest reason there is none. */
export function extentOf(facets: readonly TechneTemporalFacet[] | null | undefined): {
  extent: TimeExtent | null;
  reason: string | null;
} {
  let range: { fromMs: number; toMs: number } | null;
  try {
    range = domainFromFacets(facets);
  } catch (error) {
    return {
      extent: null,
      reason: `The dated material cannot be read: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
  if (range === null) return { extent: null, reason: NO_DATED_REASON };
  return { extent: { fromMs: range.fromMs, toMs: range.toMs }, reason: null };
}

/** Whether the control is enabled and what it says when it is not. A single instant or open-ended extent has no span to move across. */
export function timeControlStatus(input: {
  extent: TimeExtent | null;
  extentReason?: string | null;
  unavailableReason?: string | null;
  reducedMotion: boolean;
}): TimeControlStatus {
  const { extent } = input;
  const reason = !extent
    ? (input.extentReason ?? NO_DATED_REASON)
    : extent.toMs <= extent.fromMs
      ? NO_SPAN_REASON
      : (input.unavailableReason ?? null);
  const enabled = reason === null;
  return {
    enabled,
    reason,
    playable: enabled && !input.reducedMotion,
    playReason: !enabled ? reason : input.reducedMotion ? REDUCED_MOTION_NOTE : null,
  };
}

/** Whether the platform asks for reduced motion. False where the query is not available. */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// ---------------------------------------------------------------------------
// Window and span
// ---------------------------------------------------------------------------

function isOpen(window: TimeWindow | null | undefined): boolean {
  return !window || (window.from == null && window.to == null);
}

/** Whether the shared window is open on both sides (the whole reading stands). */
export function isOpenWindow(window: TimeWindow | null | undefined): boolean {
  return isOpen(window);
}

function boundMs(value: string | null | undefined, edge: "start" | "end", fallback: number): number {
  if (value == null) return fallback;
  const parsed = Date.parse(expandTimestamp(value, edge));
  return Number.isNaN(parsed) ? fallback : parsed;
}

/** The span clamped inside the extent, ordered from its earlier bound. */
export function clampSpan(extent: TimeExtent, span: TimeSpan): TimeSpan {
  const a = Math.min(Math.max(span.fromMs, extent.fromMs), extent.toMs);
  const b = Math.min(Math.max(span.toMs, extent.fromMs), extent.toMs);
  return a <= b ? { fromMs: a, toMs: b } : { fromMs: b, toMs: a };
}

/** The span a shared window stands for on the track. An open window is the whole extent. */
export function spanOfWindow(extent: TimeExtent, window: TimeWindow | null | undefined): TimeSpan {
  if (isOpen(window)) return { fromMs: extent.fromMs, toMs: extent.toMs };
  return clampSpan(extent, {
    fromMs: boundMs(window!.from, "start", extent.fromMs),
    toMs: boundMs(window!.to, "end", extent.toMs),
  });
}

/** Where stepping or playback starts: the drawn window, or for an open window its first eighth. */
export function startSpanFor(extent: TimeExtent, window: TimeWindow | null | undefined): TimeSpan {
  if (isOpen(window)) {
    const width = (extent.toMs - extent.fromMs) / DEFAULT_WINDOW_FRACTION;
    return { fromMs: extent.fromMs, toMs: extent.fromMs + width };
  }
  return spanOfWindow(extent, window);
}

/** The window a span is written as: explicit ISO bounds, so the shared session holds exactly what is drawn. */
export function windowOfSpan(span: TimeSpan): TimeWindow {
  return { from: new Date(span.fromMs).toISOString(), to: new Date(span.toMs).toISOString() };
}

/** Where the window sits on the track, as percentages of its width. */
export function trackPercent(extent: TimeExtent, span: TimeSpan): { left: number; width: number } {
  const length = extent.toMs - extent.fromMs;
  if (length <= 0) return { left: 0, width: 100 };
  return {
    left: ((span.fromMs - extent.fromMs) / length) * 100,
    width: ((span.toMs - span.fromMs) / length) * 100,
  };
}

/** The label of a span, from the timeline's own span label (inclusive years). */
export function spanText(span: TimeSpan): string {
  return spanLabel(span.fromMs, span.toMs, 0);
}

/** The label of the window, from the timeline's own span label (inclusive years). */
export function windowLabel(extent: TimeExtent, window: TimeWindow | null | undefined): string {
  return spanText(spanOfWindow(extent, window));
}

/** The two track-end labels, from the timeline's own span label. */
export function extentEndLabels(extent: TimeExtent): { start: string; end: string } {
  return {
    start: spanLabel(extent.fromMs, extent.fromMs, 0),
    end: spanLabel(extent.toMs, extent.toMs, 0),
  };
}

// ---------------------------------------------------------------------------
// Dragging
// ---------------------------------------------------------------------------

/** The span after dragging one handle (or the body) by a number of milliseconds, kept inside the extent and never crossed. */
export function dragSpan(extent: TimeExtent, span: TimeSpan, handle: WindowHandle, deltaMs: number): TimeSpan {
  if (!Number.isFinite(deltaMs)) return clampSpan(extent, span);
  if (handle === "body") {
    const width = span.toMs - span.fromMs;
    const from = Math.min(Math.max(span.fromMs + deltaMs, extent.fromMs), extent.toMs - width);
    return { fromMs: from, toMs: from + width };
  }
  if (handle === "from") {
    return { fromMs: Math.min(Math.max(span.fromMs + deltaMs, extent.fromMs), span.toMs), toMs: span.toMs };
  }
  return { fromMs: span.fromMs, toMs: Math.max(Math.min(span.toMs + deltaMs, extent.toMs), span.fromMs) };
}

/** The span centred on a point of the track (a click on the track, outside the window). */
export function centreSpanOn(extent: TimeExtent, span: TimeSpan, atMs: number): TimeSpan {
  const width = span.toMs - span.fromMs;
  const from = Math.min(Math.max(atMs - width / 2, extent.fromMs), extent.toMs - width);
  return { fromMs: from, toMs: from + width };
}

/** The milliseconds one keyboard nudge moves a handle by. */
export function nudgeMs(extent: TimeExtent): number {
  return (extent.toMs - extent.fromMs) / NUDGE_FRACTION;
}

// ---------------------------------------------------------------------------
// Stepping and playback
// ---------------------------------------------------------------------------

/** One window-width in the direction given, kept inside the extent. `moved` is false at either end. */
export function stepSpan(extent: TimeExtent, span: TimeSpan, direction: 1 | -1): { span: TimeSpan; moved: boolean } {
  const width = span.toMs - span.fromMs;
  const stride = width > 0 ? width : (extent.toMs - extent.fromMs) / DEFAULT_WINDOW_FRACTION;
  const from = Math.min(Math.max(span.fromMs + direction * stride, extent.fromMs), extent.toMs - width);
  const next = { fromMs: from, toMs: from + width };
  return { span: next, moved: next.fromMs !== span.fromMs };
}

/** Where playback starts: the span itself, or from the start when it already rests at the end. */
export function playStartSpan(extent: TimeExtent, span: TimeSpan): TimeSpan {
  const width = span.toMs - span.fromMs;
  if (width <= 0 || span.toMs < extent.toMs) return span;
  return { fromMs: extent.fromMs, toMs: extent.fromMs + width };
}

export interface PlaybackFrame {
  span: TimeSpan;
  /** True when the window has reached the end and stopped (never true while looping). */
  ended: boolean;
}

/**
 * The window after `elapsedMs` of playback at a speed. One window-width takes
 * SECONDS_PER_WINDOW_AT_1X / speed seconds. Looping wraps the window to the start;
 * otherwise it stops at the end and reports it.
 */
export function advanceSpan(
  extent: TimeExtent,
  span: TimeSpan,
  elapsedMs: number,
  speed: PlaybackSpeed,
  loop: boolean,
): PlaybackFrame {
  const length = extent.toMs - extent.fromMs;
  const width = span.toMs - span.fromMs > 0 ? span.toMs - span.fromMs : length / DEFAULT_WINDOW_FRACTION;
  if (width >= length) return { span: clampSpan(extent, span), ended: true };
  const elapsed = Number.isFinite(elapsedMs) && elapsedMs > 0 ? elapsedMs : 0;
  const travel = (width * elapsed) / ((SECONDS_PER_WINDOW_AT_1X * 1000) / speed);
  const last = extent.toMs - width;
  const from = span.fromMs + travel;
  if (from < last) return { span: { fromMs: from, toMs: from + width }, ended: false };
  if (loop) {
    const run = last - extent.fromMs;
    const wrapped = extent.fromMs + ((from - last) % run);
    return { span: { fromMs: wrapped, toMs: wrapped + width }, ended: false };
  }
  return { span: { fromMs: last, toMs: extent.toMs }, ended: true };
}

// ---------------------------------------------------------------------------
// The filter law at a frame, and the imagery note
// ---------------------------------------------------------------------------

/** The facets that stand in the span at this frame: the place filter's own validity law, unchanged. */
export function placesAtSpan(facets: readonly TechnePlaceFacet[], span: TimeSpan): TechnePlaceFacet[] {
  return placesInWindow(facets, windowOfSpan(span));
}

/**
 * T16: the imagery note. Imagery is shown as it is provided; no source in the
 * basemap registry carries a time dimension today, so the note always stands
 * and no imagery era is ever claimed. Null only when a visible source is time-aware.
 */
export function imageryTimeNote(sources: readonly { id: string; timeDimension?: boolean }[]): string | null {
  return sources.some((source) => source.timeDimension === true) ? null : IMAGERY_TIME_NOTE;
}
