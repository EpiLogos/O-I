/** Pure model for Arrangement for Expressions. No React, DOM, or native owner.
 * Ranges are a local window over the authored source axis. Candidate timing
 * and order values are validated again by the existing native glyph requests
 * (hostEditor.ts: step-timing 0..3600, step-order full permutation, step-remove
 * keeps one state, step-duplicate capped at 32). */

export type ArrangementClock = 'seconds' | 'morph';
export interface TimeRange {readonly start: number; readonly end: number}
export interface RangeBounds {readonly start: number; readonly end: number; readonly minSpan: number}
export type TimingHandle = 'hold' | 'transition';
export type SnapMode = 'grid' | 'coarse' | 'free';

/** Native finite bounds for step hold and transition (hostEditor.ts step-timing). */
export const TIMING_MIN = 0;
export const TIMING_MAX = 3600;
const SNAP_STEP: Record<SnapMode, number> = {grid: .05, coarse: .5, free: .001};
const SECONDS_STEPS = [.05, .1, .25, .5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600];
const CYCLE_STEPS = [.05, .1, .25, .5, 1, 2, 5, 10, 25, 50, 100];
const MIN_TICK_SPACING_PX = 64;

export function clampTiming(value: number): number {
  return Math.max(TIMING_MIN, Math.min(TIMING_MAX, Number.isFinite(value) ? value : TIMING_MIN));
}

/** Snap an absolute timing value. Free mode keeps three decimals, as the
 * Alt-arrow edits already do. */
export function snapSeconds(value: number, mode: SnapMode): number {
  const step = SNAP_STEP[mode];
  const snapped = mode === 'free' ? value : Math.round(value / step) * step;
  return clampTiming(Number(snapped.toFixed(3)));
}

export function rangeBounds(duration: number, clock: ArrangementClock): RangeBounds {
  const end = Number.isFinite(duration) && duration > 1 ? duration : 1;
  return {start: 0, end, minSpan: Math.max(end / 256, clock === 'seconds' ? .05 : .01)};
}

export function fitRange(bounds: RangeBounds): TimeRange {
  return {start: bounds.start, end: bounds.end};
}

/** Keep a window inside the bounds with a span between minSpan and the full extent. */
export function clampRange(range: TimeRange, bounds: RangeBounds): TimeRange {
  const extent = bounds.end - bounds.start;
  const finite = Number.isFinite(range.start) && Number.isFinite(range.end);
  const span = finite ? Math.min(extent, Math.max(bounds.minSpan, range.end - range.start)) : extent;
  const start = Math.min(bounds.end - span, Math.max(bounds.start, finite ? range.start : bounds.start));
  return {start, end: start + span};
}

/** Zoom keeps the anchor at the same fraction of the window it had before. */
export function zoomAround(range: TimeRange, anchorTime: number, factor: number, bounds: RangeBounds): TimeRange {
  const current = clampRange(range, bounds);
  if (!(factor > 0) || !Number.isFinite(factor) || !Number.isFinite(anchorTime)) return current;
  const span = current.end - current.start;
  const extent = bounds.end - bounds.start;
  const nextSpan = Math.min(extent, Math.max(bounds.minSpan, span / factor));
  const ratio = Math.max(0, Math.min(1, (anchorTime - current.start) / span));
  const start = anchorTime - ratio * nextSpan;
  return clampRange({start, end: start + nextSpan}, bounds);
}

export function panBy(range: TimeRange, delta: number, bounds: RangeBounds): TimeRange {
  if (!Number.isFinite(delta)) return clampRange(range, bounds);
  return clampRange({start: range.start + delta, end: range.end + delta}, bounds);
}

/** Shift the minimum distance that brings [start, end] into the window. */
export function revealRange(range: TimeRange, start: number, end: number, bounds: RangeBounds): TimeRange {
  const current = clampRange(range, bounds), span = current.end - current.start;
  if (start >= current.start && end <= current.end) return current;
  if (start < current.start) return clampRange({start, end: start + span}, bounds);
  return clampRange({start: end - span, end}, bounds);
}

export interface RulerTick {readonly time: number; readonly label: string}

function tickDecimals(step: number): number {
  if (step >= 1) return 0;
  return Math.round(step * 100) % 10 === 0 ? 1 : 2;
}

/** Adaptive ticks: the smallest listed step whose spacing is at least 64px.
 * Labels are plain numbers in the ruler's own unit (seconds or morph cycles). */
export function rulerTicks(rangeStart: number, rangeEnd: number, widthPx: number, clock: ArrangementClock): RulerTick[] {
  const span = rangeEnd - rangeStart;
  if (!(span > 0) || !(widthPx > 0) || !Number.isFinite(span)) return [];
  const steps = clock === 'seconds' ? SECONDS_STEPS : CYCLE_STEPS;
  const wanted = span / (widthPx / MIN_TICK_SPACING_PX);
  const largest = steps[steps.length - 1];
  const step = steps.find(value => value >= wanted) ?? Math.ceil(wanted / largest) * largest;
  const decimals = tickDecimals(step);
  const first = Math.ceil(rangeStart / step - 1e-9);
  const last = Math.floor(rangeEnd / step + 1e-9);
  const ticks: RulerTick[] = [];
  for (let index = first; index <= last && ticks.length < 400; index++) {
    const time = Number((index * step).toFixed(6));
    ticks.push({time, label: time.toFixed(decimals)});
  }
  return ticks;
}

/** Percent position of a time inside a window. */
export function percentOf(time: number, range: TimeRange): number {
  const span = range.end - range.start;
  return span > 0 ? (time - range.start) / span * 100 : 0;
}

export interface ArrangementSpan {
  readonly stepId: string;
  readonly index: number;
  readonly hold: number;
  readonly transition: number;
  readonly axisStart: number;
  readonly axisHold: number;
  readonly axisTransition: number;
  readonly axisEnd: number;
}
export interface StateTimingLike {
  readonly step_id: string;
  readonly hold_seconds: number;
  readonly transition_seconds: number;
  readonly axis_start: number;
  readonly axis_hold: number;
  readonly axis_transition: number;
  readonly axis_end: number;
}

/** Authored states in lane order. Axis fields come from the native timing reading. */
export function arrangementSpans(states: readonly StateTimingLike[]): ArrangementSpan[] {
  return states.map((state, index) => ({stepId: state.step_id, index, hold: state.hold_seconds, transition: state.transition_seconds,
    axisStart: state.axis_start, axisHold: state.axis_hold, axisTransition: state.axis_transition, axisEnd: state.axis_end}));
}

/** Preview of one state's new hold or transition, with later states following
 * the same cumulative axis the owner computes. Seconds clock only. */
export function retimeLane(spans: readonly ArrangementSpan[], stepId: string, timing: {hold?: number; transition?: number}): ArrangementSpan[] {
  let cursor = 0;
  return spans.map((span, index) => {
    const hold = span.stepId === stepId && timing.hold !== undefined ? timing.hold : span.hold;
    const transition = span.stepId === stepId && timing.transition !== undefined ? timing.transition : span.transition;
    const axisEnd = cursor + hold + transition;
    const next: ArrangementSpan = {stepId: span.stepId, index, hold, transition, axisStart: cursor, axisHold: hold, axisTransition: transition, axisEnd};
    cursor = axisEnd;
    return next;
  });
}

export interface TimingEdge {
  readonly key: TimingHandle;
  readonly value: number;
  readonly base: number;
  readonly changed: boolean;
  readonly timing: {readonly hold: number; readonly transition: number};
  readonly width: number;
}

/** Horizontal drag of a state's hold/transition handle. The dragged value is
 * snapped as an absolute number; zero movement keeps the authored value. */
export function edgeDragToTiming(span: {hold: number; transition: number}, deltaPx: number, pxPerSecond: number, snap: SnapMode, handle: TimingHandle = 'hold'): TimingEdge {
  const base = clampTiming(handle === 'hold' ? span.hold : span.transition);
  const moved = Number.isFinite(deltaPx) && deltaPx !== 0 && pxPerSecond > 0;
  const value = moved ? snapSeconds(base + deltaPx / pxPerSecond, snap) : base;
  const hold = handle === 'hold' ? value : clampTiming(span.hold);
  const transition = handle === 'transition' ? value : clampTiming(span.transition);
  return {key: handle, value, base, changed: Math.abs(value - base) > 1e-9, timing: {hold, transition}, width: hold + transition};
}

export function formatSeconds(value: number): string {
  return Number((Number.isFinite(value) ? value : 0).toFixed(3)).toString();
}

/** The read-only inspector sentence for one state. */
export function describeSpan(span: ArrangementSpan, unit: string): string {
  return `hold ${formatSeconds(span.hold)} · transition ${formatSeconds(span.transition)} · ${formatSeconds(span.axisStart)}–${formatSeconds(span.axisEnd)} ${unit}`;
}

export interface SpanSelection {
  readonly lane: string | null;
  readonly ids: readonly string[];
  readonly primary: string | null;
  readonly anchor: string | null;
}
export const NO_SELECTION: SpanSelection = {lane: null, ids: [], primary: null, anchor: null};
export type SelectMode = 'replace' | 'extend' | 'toggle';

/** Plain click replaces; Shift extends from the anchor within one lane; Ctrl/Cmd toggles. */
export function selectSpan(current: SpanSelection, lane: string, spans: readonly ArrangementSpan[], stepId: string, mode: SelectMode): SpanSelection {
  const index = spans.findIndex(span => span.stepId === stepId);
  if (index < 0) return current;
  const sameLane = current.lane === lane;
  if (mode === 'extend' && sameLane && current.anchor !== null) {
    const anchor = spans.findIndex(span => span.stepId === current.anchor);
    if (anchor >= 0) {
      const [low, high] = anchor < index ? [anchor, index] : [index, anchor];
      return {lane, ids: spans.slice(low, high + 1).map(span => span.stepId), primary: stepId, anchor: current.anchor};
    }
  }
  if (mode === 'toggle' && sameLane && current.ids.length) {
    if (current.ids.includes(stepId)) {
      const ids = current.ids.filter(id => id !== stepId);
      if (!ids.length) return NO_SELECTION;
      return {lane, ids, primary: ids[ids.length - 1], anchor: ids.includes(current.anchor ?? '') ? current.anchor : ids[0]};
    }
    return {lane, ids: [...current.ids, stepId], primary: stepId, anchor: current.anchor};
  }
  return {lane, ids: [stepId], primary: stepId, anchor: stepId};
}

/** Drop selected states that are no longer in the lane, keeping lane order. */
export function pruneSelection(selection: SpanSelection, lane: string, spans: readonly ArrangementSpan[]): SpanSelection {
  if (selection.lane !== lane) return NO_SELECTION;
  const present = new Set(spans.map(span => span.stepId));
  const ids = spans.map(span => span.stepId).filter(id => selection.ids.includes(id));
  if (!ids.length) return NO_SELECTION;
  return {lane, ids, primary: selection.primary && present.has(selection.primary) ? selection.primary : ids[ids.length - 1],
    anchor: selection.anchor && present.has(selection.anchor) ? selection.anchor : ids[0]};
}

export function selectedIdsIn(selection: SpanSelection, lane: string): string[] {
  return selection.lane === lane ? [...selection.ids] : [];
}

export type DuplicateTarget = {ok: true; stepId: string} | {ok: false; reason: string};
/** step-duplicate copies one state, so a multi-span selection is refused locally. */
export function duplicateTarget(selection: SpanSelection, lane: string): DuplicateTarget {
  const ids = selectedIdsIn(selection, lane);
  if (ids.length === 1) return {ok: true, stepId: ids[0]};
  if (!ids.length) return {ok: false, reason: 'Select one state to duplicate'};
  return {ok: false, reason: 'Duplicate copies one state; select a single span'};
}

/** The full permutation step-order requires, with stepId moved so it sits
 * before the insertAt-th other state. Null when nothing would change. */
export function moveStepOrder(ids: readonly string[], stepId: string, insertAt: number): string[] | null {
  if (!ids.includes(stepId)) return null;
  const others = ids.filter(id => id !== stepId);
  const slot = Math.max(0, Math.min(others.length, Math.trunc(insertAt)));
  const next = [...others.slice(0, slot), stepId, ...others.slice(slot)];
  return next.every((id, index) => id === ids[index]) ? null : next;
}

/** Keyboard reorder: one slot left or right. */
export function shiftStepOrder(ids: readonly string[], stepId: string, delta: -1 | 1): string[] | null {
  const index = ids.indexOf(stepId);
  if (index < 0 || index + delta < 0 || index + delta >= ids.length) return null;
  return moveStepOrder(ids, stepId, index + delta);
}

/** Insertion index among the other states, from the pointer time over their centres. */
export function dropSlot(spans: readonly ArrangementSpan[], stepId: string, pointerTime: number): number {
  const others = spans.filter(span => span.stepId !== stepId);
  return others.filter(span => (span.axisStart + span.axisEnd) / 2 < pointerTime).length;
}

/** Time of the insertion line, on the same axis as the spans. */
export function insertionTime(spans: readonly ArrangementSpan[], stepId: string, insertAt: number): number {
  const others = spans.filter(span => span.stepId !== stepId);
  if (!others.length) return 0;
  if (insertAt < others.length) return others[Math.max(0, insertAt)].axisStart;
  return others[others.length - 1].axisEnd;
}
