// The loop brace's ends on the Arrangement's ruler (O-I #747 XT15, round 890; DLW.md §16.6 "A loop region has an in point and an out
// point"): where the brace's owner lets it be set (`actions.setLoop`), each end is a slider, Loop in and Loop out, dragged and let go or
// moved a mark with the arrow keys, as one press of the owner's op — as Live's brace is set by dragging its ends. The hand's own point
// snaps as a press on the ruler does (Shift frees it, Alt coarsens it); a drag holds its pointer, so the ruler's pan never starts under
// it. Loaded when such a brace first draws (ArrangementRuler.tsx, shell/loadWhenDrawn.ts): the window's first load carries none of it.
import {braceEdgeAt, markStep, percentOf, snapAt, snapOfPress, type BraceDrag, type RangeBounds, type SnapMode, type TimeRange} from './rulerWindow'
import type {PressedReceipt} from './SessionGrid'

/** An arrow key on an end of the brace: a mark's step back (← ↓) or on (→ ↑); any other key moves nothing. */
export function braceEdgeKey(loop: TimeRange, edge: 'start' | 'end', key: string, step: number, bounds: Pick<RangeBounds, 'start' | 'end'>): TimeRange | null {
  const by = key === 'ArrowLeft' || key === 'ArrowDown' ? -step : key === 'ArrowRight' || key === 'ArrowUp' ? step : null
  return by === null ? null : braceEdgeAt(loop, edge, (edge === 'start' ? loop.start : loop.end) + by, bounds)
}

export interface LoopBraceEndsProps {
  /** The brace as its owner keeps it, and as it is drawn now (where the hand has an end). */
  loop: TimeRange
  shown: TimeRange
  bounds: RangeBounds
  range: TimeRange
  snap: SnapMode
  width: number
  drag: BraceDrag | null
  onDrag(next: BraceDrag | null): void
  setLoop: {op: string; run(edge: 'start' | 'end', at: number): unknown}
  receipt: PressedReceipt | null
  onPress(key: string, what: string, run: () => unknown): void
  pointAt(clientX: number): number | null
  label(at: number): string
}

export function LoopBraceEnds({loop, shown, bounds, range, snap, width, drag, onDrag, setLoop, receipt, onPress, pointAt, label}: LoopBraceEndsProps) {
  return <>{(['start', 'end'] as const).map(edge => {
    const at = edge === 'start' ? shown.start : shown.end
    if (at < range.start || at > range.end) return null
    const key = `loop:${edge}`, what = edge === 'start' ? 'Set loop in' : 'Set loop out'
    const send = (value: number) => { if (Math.abs(value - (edge === 'start' ? loop.start : loop.end)) > 1e-9) onPress(key, what, () => setLoop.run(edge, value)) }
    return <span key={edge} className="tl-brace-end" data-edge={edge} role="slider" tabIndex={0} aria-label={edge === 'start' ? 'Loop in' : 'Loop out'}
      aria-valuemin={edge === 'start' ? bounds.start : shown.start} aria-valuemax={edge === 'start' ? shown.end : bounds.end} aria-valuenow={at}
      aria-valuetext={label(at)} data-receipt={receipt?.key === key ? (receipt.ok ? 'ok' : 'refused') : undefined}
      title={`Drag to set the loop's ${edge === 'start' ? 'in' : 'out'} point; ← → move it a mark (${setLoop.op})`} style={{left: `${percentOf(at, range)}%`}}
      onPointerDown={event => { if (event.button !== 0) return; event.stopPropagation(); event.currentTarget.setPointerCapture?.(event.pointerId); onDrag({edge, at}) }}
      onPointerMove={event => {
        if (drag?.edge !== edge) return
        event.stopPropagation()
        const point = pointAt(event.clientX)
        if (point !== null) onDrag({edge, at: snapAt(point, snapOfPress(snap, event), markStep(range, bounds, width), bounds)})
      }}
      onPointerUp={event => {
        if (drag?.edge !== edge) return
        event.stopPropagation()
        onDrag(null)
        const next = braceEdgeAt(loop, edge, drag.at, bounds)
        send(edge === 'start' ? next.start : next.end)
      }}
      onPointerCancel={() => onDrag(null)}
      onKeyDown={event => {
        const next = braceEdgeKey(loop, edge, event.key, markStep(range, bounds, width), bounds)
        if (!next) return
        event.preventDefault(); event.stopPropagation()
        send(edge === 'start' ? next.start : next.end)
      }} />
  })}</>
}
