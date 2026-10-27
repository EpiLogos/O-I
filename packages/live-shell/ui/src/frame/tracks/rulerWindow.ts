// The Arrangement ruler's window: zoom, pan and snap, as presentation state of the pane (manual §3: the Arrangement "lays the
// same material along one ruler, so you can see the course of it"). Ported from the Expressions Arrangement the Clip editor
// replaced: git 09a573a1d:packages/live-shell/ui/src/components/nativeArrangementModel.ts — the window over the axis
// (TimeRange/RangeBounds :8-9, rangeBounds :33-36, fitRange :38-40, clampRange :42-49, zoomAround :51-61, panBy :63-66,
// revealRange :68-74, percentOf :103-107), the snap modes (SnapMode :11, SNAP_STEP :16, snapSeconds :25-31) and the tick floor
// (MIN_TICK_SPACING_PX :19). The window is the pane's own view of the ruler: nothing here writes time to any owner, and the
// owner's ruler (WorldTrackSet.ruler) is only read.
//
// What the port generalises: that ruler was seconds or morph cycles, so its minimum span, its snap steps and its tick labels were
// numbers in those units. The shared ruler's unit is the set's own (bars, minutes, deep-time years, seconds), and it labels
// itself (`ruler.label`). So the minimum span keeps its 1/256 of the extent with no unit floor; the marks are the ruler's own —
// the eight divisions the shared ruler always drew, halved for each doubling of zoom so they stay fixed to the material as it
// pans, and thinned to the 64px floor; and the snap steps keep the old ratios against the mark step (grid 1/20 of a mark, coarse
// 1/2 — at the old ruler's one-second marks, exactly its 0.05 s and 0.5 s), free keeping three decimals.
//
// Pure TypeScript. No React, no DOM.

export interface TimeRange {readonly start: number; readonly end: number}
export interface RangeBounds {readonly start: number; readonly end: number; readonly minSpan: number}
export type SnapMode = 'grid' | 'coarse' | 'free'

/** The snap modes in the order the ruler's control steps through them. */
export const SNAP_MODES: readonly SnapMode[] = ['grid', 'coarse', 'free']
/** A snap step as a share of the mark step (nativeArrangementModel.ts:16 SNAP_STEP, against its one-second marks). */
const SNAP_SHARE: Record<Exclude<SnapMode, 'free'>, number> = {grid: 1 / 20, coarse: 1 / 2}
/** Marks never closer than this (nativeArrangementModel.ts:19). */
export const MIN_TICK_SPACING_PX = 64
/** The divisions the shared ruler draws over its whole length (the eight it always drew: ArrangementRuler.tsx marks). */
export const RULER_DIVISIONS = 8

/** The bounds of a ruler that runs 0 to `end` (nativeArrangementModel.ts:33-36, with no unit floor). */
export function rangeBounds(end: number): RangeBounds {
  const extent = Number.isFinite(end) && end > 0 ? end : 1
  return {start: 0, end: extent, minSpan: extent / 256}
}

export function fitRange(bounds: RangeBounds): TimeRange {
  return {start: bounds.start, end: bounds.end}
}

/** Keep a window inside the bounds with a span between minSpan and the full extent (:42-49). */
export function clampRange(range: TimeRange, bounds: RangeBounds): TimeRange {
  const extent = bounds.end - bounds.start
  const finite = Number.isFinite(range.start) && Number.isFinite(range.end)
  const span = finite ? Math.min(extent, Math.max(bounds.minSpan, range.end - range.start)) : extent
  const start = Math.min(bounds.end - span, Math.max(bounds.start, finite ? range.start : bounds.start))
  return {start, end: start + span}
}

/** Zoom keeps the anchor at the same fraction of the window it had before (:51-61). */
export function zoomAround(range: TimeRange, anchor: number, factor: number, bounds: RangeBounds): TimeRange {
  const current = clampRange(range, bounds)
  if (!(factor > 0) || !Number.isFinite(factor) || !Number.isFinite(anchor)) return current
  const span = current.end - current.start
  const extent = bounds.end - bounds.start
  const nextSpan = Math.min(extent, Math.max(bounds.minSpan, span / factor))
  const ratio = Math.max(0, Math.min(1, (anchor - current.start) / span))
  const start = anchor - ratio * nextSpan
  return clampRange({start, end: start + nextSpan}, bounds)
}

export function panBy(range: TimeRange, delta: number, bounds: RangeBounds): TimeRange {
  if (!Number.isFinite(delta)) return clampRange(range, bounds)
  return clampRange({start: range.start + delta, end: range.end + delta}, bounds)
}

/** Shift the minimum distance that brings [start, end] into the window (:68-74). */
export function revealRange(range: TimeRange, start: number, end: number, bounds: RangeBounds): TimeRange {
  const current = clampRange(range, bounds), span = current.end - current.start
  if (start >= current.start && end <= current.end) return current
  if (start < current.start) return clampRange({start, end: start + span}, bounds)
  return clampRange({start: end - span, end}, bounds)
}

/** Percent position of a point inside a window (:103-107). */
export function percentOf(at: number, range: TimeRange): number {
  const span = range.end - range.start
  return span > 0 ? (at - range.start) / span * 100 : 0
}

/** A stretch of the ruler as the window shows it (catalogue dlw__arrangement-ruler.tsx `.arp-brace`, the loop brace): where it begins and
 * how wide it is, in percent of the window, and whether an end lies outside the window, where no brace edge is drawn. */
export interface WindowBand {readonly left: number; readonly width: number; readonly cutStart: boolean; readonly cutEnd: boolean}

/** Where a stretch stands in the window: held to the ruler first, then cut to the window. Null for a stretch with no length, one
 * that runs backwards or holds no finite point (nothing is guessed for it), and one wholly outside the window. */
export function bandIn(stretch: TimeRange, range: TimeRange, bounds: Pick<RangeBounds, 'start' | 'end'>): WindowBand | null {
  if (!Number.isFinite(stretch.start) || !Number.isFinite(stretch.end) || !(stretch.end > stretch.start)) return null
  const start = Math.max(bounds.start, stretch.start), end = Math.min(bounds.end, stretch.end)
  if (!(end > start) || end <= range.start || start >= range.end) return null
  const from = Math.max(start, range.start), to = Math.min(end, range.end)
  return {left: percentOf(from, range), width: percentOf(to, range) - percentOf(from, range), cutStart: start < range.start, cutEnd: end > range.end}
}

/** Whether the window is the whole ruler. */
export const isFit = (range: TimeRange, bounds: RangeBounds): boolean =>
  Math.abs(range.start - bounds.start) < 1e-9 && Math.abs(range.end - bounds.end) < 1e-9

/** The step between marks for a window: the ruler's eighths, halved for each doubling of zoom (so a mark keeps its place on the
 * material while the window pans), then doubled until marks are at least 64px apart when the drawn width is known. */
export function markStep(range: TimeRange, bounds: RangeBounds, widthPx = 0): number {
  const span = range.end - range.start
  const extent = bounds.end - bounds.start
  if (!(span > 0) || !(extent > 0)) return 0
  const zoom = Math.max(0, Math.floor(Math.log2(extent / span) + 1e-9))
  let step = extent / RULER_DIVISIONS / 2 ** zoom
  if (widthPx > 0) while (step / span * widthPx < MIN_TICK_SPACING_PX && step < extent) step *= 2
  return step
}

export interface RulerMark {
  readonly at: number
  /** Reaches back from its point instead of past the edge (the last mark at the window's end; nativeArrangementTimeline.tsx:305). */
  readonly end: boolean
}

/** The marks inside a window, at multiples of the mark step. At the whole ruler with no measured width these are the nine
 * marks the shared ruler always drew (0, an eighth, … the end). */
export function windowMarks(range: TimeRange, bounds: RangeBounds, widthPx = 0): RulerMark[] {
  const step = markStep(range, bounds, widthPx)
  if (!(step > 0)) return []
  const first = Math.ceil((range.start - bounds.start) / step - 1e-9)
  const last = Math.floor((range.end - bounds.start) / step + 1e-9)
  const marks: RulerMark[] = []
  for (let index = first; index <= last && marks.length < 400; index++) {
    const at = bounds.start + index * step
    marks.push({at, end: percentOf(at, range) > 92})
  }
  return marks
}

/** Snap a point on the ruler (snapSeconds :25-31): grid and coarse round to their share of the mark step, free keeps three
 * decimals; the result stays inside the bounds. */
export function snapAt(value: number, mode: SnapMode, step: number, bounds: Pick<RangeBounds, 'start' | 'end'>): number {
  const size = mode === 'free' || !(step > 0) ? 0 : step * SNAP_SHARE[mode]
  const snapped = size > 0 ? Math.round(value / size) * size : value
  const held = Math.max(bounds.start, Math.min(bounds.end, Number.isFinite(snapped) ? snapped : bounds.start))
  return Number(held.toFixed(3))
}

/** The snap a press takes: Shift frees it, Alt coarsens it, else the pane's mode (nativeArrangementTimeline.tsx:181). */
export const snapOfPress = (mode: SnapMode, press: {shiftKey?: boolean; altKey?: boolean}): SnapMode =>
  press.shiftKey ? 'free' : press.altKey ? 'coarse' : mode

/** The next snap mode on the ruler's control. */
export const nextSnap = (mode: SnapMode): SnapMode => SNAP_MODES[(SNAP_MODES.indexOf(mode) + 1) % SNAP_MODES.length]

/** The window a key moves to on the focused ruler (nativeArrangementTimeline.tsx:217-226): ←/→ pan a tenth, ↑ + = zoom in,
 * ↓ − zoom out (around the anchor), Home and End go to the ends. Null for a key the ruler leaves alone. */
export function windowOfKey(key: string, range: TimeRange, bounds: RangeBounds, anchor = (range.start + range.end) / 2): TimeRange | null {
  const span = range.end - range.start
  switch (key) {
    case 'ArrowLeft': return panBy(range, -span / 10, bounds)
    case 'ArrowRight': return panBy(range, span / 10, bounds)
    case 'ArrowUp': case '+': case '=': return zoomAround(range, anchor, 2, bounds)
    case 'ArrowDown': case '-': return zoomAround(range, anchor, .5, bounds)
    case 'Home': return panBy(range, bounds.start - range.start, bounds)
    case 'End': return panBy(range, bounds.end - range.end, bounds)
    default: return null
  }
}

/** The zoom factor a wheel turn asks for (nativeArrangementTimeline.tsx:103: 2^(−deltaY/240)). */
export const wheelZoomFactor = (deltaY: number): number => Math.pow(2, -deltaY / 240)
