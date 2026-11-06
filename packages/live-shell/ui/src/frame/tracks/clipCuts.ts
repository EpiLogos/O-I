// Where clips lie on the Arrangement's ruler, and the cuts a drag on one makes (O-I #747; manual §16.6, Arrangement view: the edit table
// and its Settings — Snap On·Off, Move mode Insert·Overwrite, Trim mode Trim·Roll·Slip·Slide, "What an edge drag does"). A drag on a
// clip's body moves it by the Move mode; a drag on one of its edges does what the Trim mode says. The point a drag moves (the clip's start
// for a move or a slide, the edge for a trim or a roll) snaps to the other clips' edges, the insert marker, the loop's edges and the
// playhead, unless Alt is held while dragging or the pane's snap is Free. Each drag ends in one press of the set's owner op, in the ruler's
// units, as Split hands it the insert marker (timeline/worldTrackAdapter.ts WorldTrackActions moveClip … slideClip): one step in the
// owner's undo list. Pure: the ruler (ArrangementRuler.tsx) reads the pointer and draws; nothing here touches the DOM.
import type {WorldTrackClip, WorldTrackSet} from '../../timeline/worldTrackAdapter'
import {rowOffsets} from '../../timeline/worldTrackAdapter'

export interface Placed {clip: WorldTrackClip; start: number; end: number}

/** Every clip's place on one ruler: its own `at`; else, on a set with no ruler, its row's offset plus its span (rows end to
 * end). On a set with a ruler a clip with no `at` has no place. `end` is the ruler's fixed window when the set gives one
 * (`ruler.end`, the run viewer's window: agent/AgentArrangementView.tsx:39), else what the clips and needles hold. */
export function placeClips(set: WorldTrackSet): {placed: Placed[]; end: number} {
  const ruled = set.ruler !== undefined
  const {offsets, end: cursor} = ruled ? {offsets: new Map<string, number>(), end: 0} : rowOffsets(set.columns, set.clips)
  const placed: Placed[] = []
  for (const clip of set.clips) {
    if (clip.at) placed.push({clip, start: clip.at.start, end: clip.at.end ?? clip.at.start})
    else if (offsets.has(clip.columnId)) {
      const base = offsets.get(clip.columnId)!
      placed.push({clip, start: base + (clip.span?.start ?? 0), end: base + (clip.span?.end ?? 1)})
    }
  }
  const fixed = set.ruler?.end
  if (typeof fixed === 'number' && Number.isFinite(fixed) && fixed > 0) return {placed, end: fixed}
  const end = Math.max(cursor, 1, ...placed.map(p => p.end), ...set.tracks.map(track => track.needle ?? 0))
  return {placed, end}
}

export type MoveMode = 'insert' | 'overwrite'
export type TrimMode = 'trim' | 'roll' | 'slip' | 'slide'
export type ClipPart = 'start' | 'end' | 'body'
export interface CutModeOption<T extends string> {value: T; label: string; does: string}
/** The Move mode (§16.6 Settings, default Insert), each in the edit table's words. */
export const MOVE_MODES: readonly CutModeOption<MoveMode>[] = [
  {value: 'insert', label: 'Insert', does: 'Moves the clip and shifts the clips after it.'},
  {value: 'overwrite', label: 'Overwrite', does: 'Moves the clip and replaces what was there.'},
]
/** The Trim mode (§16.6 Settings, default Trim): what an edge drag does, each in the edit table's words. */
export const TRIM_MODES: readonly CutModeOption<TrimMode>[] = [
  {value: 'trim', label: 'Trim', does: 'Drags an edge to change the length.'},
  {value: 'roll', label: 'Roll', does: 'Moves the seam between two clips. One grows by what the other loses.'},
  {value: 'slip', label: 'Slip', does: 'Changes where the clip starts inside its own content.'},
  {value: 'slide', label: 'Slide', does: 'Moves a clip between fixed neighbours.'},
]
/** The mode after `value`, as the ruler's control steps through them. */
export const nextMode = <T extends string>(options: readonly CutModeOption<T>[], value: T): T =>
  options[(options.findIndex(option => option.value === value) + 1) % options.length]!.value
export const modeOf = <T extends string>(options: readonly CutModeOption<T>[], value: T): CutModeOption<T> =>
  options.find(option => option.value === value) ?? options[0]!

/** An edge is this many px of the clip at either end; a clip narrower than two edges and a body between them is moved whole. */
export const EDGE_PX = 6
/** A dragged point is pulled to a snap point this many px away or nearer. */
export const SNAP_PX = 8

/** Which part of a clip a press lands on, `offsetX` px into a clip `width` px wide. */
export function partOf(offsetX: number, width: number): ClipPart {
  if (!(width >= EDGE_PX * 3)) return 'body'
  if (offsetX <= EDGE_PX) return 'start'
  if (offsetX >= width - EDGE_PX) return 'end'
  return 'body'
}

export type ClipCut = {act: 'move'; mode: MoveMode} | {act: 'trim' | 'roll'; edge: 'start' | 'end'} | {act: 'slip' | 'slide'}
/** What a drag does: on the body, a move by the Move mode; on an edge, what the Trim mode says. */
export function cutOf(part: ClipPart, move: MoveMode, trim: TrimMode): ClipCut {
  if (part === 'body') return {act: 'move', mode: move}
  if (trim === 'trim' || trim === 'roll') return {act: trim, edge: part}
  return {act: trim}
}

/** The points a dragged point snaps to: the other clips' edges, the insert marker, the loop's edges and the playhead. */
export function cutTargets(set: WorldTrackSet, clipId: string, at: {marker?: number | null; loop?: {start: number; end: number}; now?: number}): number[] {
  const points = new Set<number>()
  for (const place of placeClips(set).placed) if (place.clip.id !== clipId) { points.add(place.start); points.add(place.end) }
  if (typeof at.marker === 'number') points.add(at.marker)
  if (at.loop) { points.add(at.loop.start); points.add(at.loop.end) }
  if (typeof at.now === 'number') points.add(at.now)
  return [...points].filter(Number.isFinite)
}

/** The point `at` pulled to the nearest snap point within `tolerance` (ruler units), or left where it is when snap is off. */
export function snapCut(at: number, targets: readonly number[], tolerance: number, off: boolean): number {
  if (off || !(tolerance > 0)) return at
  let best = at, gap = tolerance
  for (const target of targets) { const distance = Math.abs(target - at); if (distance <= gap) { best = target; gap = distance } }
  return best
}

/** A drag on a clip in progress (the pane's own, held across renders): the press, the part pressed, px per ruler unit, the clip's place,
 * whether it has moved into a cut, and — once it has ended in one — that the click it ends in is the drag's, not a selection. */
export interface ClipDrag {pointer: number; clipId: string; part: ClipPart; startX: number; scale: number; start: number; end: number; moved: boolean; ended?: boolean}
/** What the ruler draws while a drag is under way: the point it moves to, and the cut in words. */
export interface CutPreview {clipId: string; point: number | null; words: string}
/** The press a drag makes: its key and words, the missing op it names where the set's owner carries none, the point it moves to, and the
 * owner call (absent: no owner op carries this cut). */
export interface CutPress {key: string; what: string; op: string; point: number | null; run?: () => unknown}

/** The press a drag of `delta` ruler units makes on `clip` lying at `place`, its moving point put through `snap`. */
export function cutPress(set: WorldTrackSet, clip: Pick<WorldTrackClip, 'id' | 'label'>, cut: ClipCut, place: {start: number; end: number},
  delta: number, snap: (at: number) => number): CutPress {
  const a = set.actions, id = clip.id, named = clip.label
  switch (cut.act) {
    case 'move': {
      const at = snap(place.start + delta), move = a?.moveClip
      return {key: `move:${id}`, what: `Move ${named} (${modeOf(MOVE_MODES, cut.mode).label})`, op: 'clip.move', point: at, run: move && (() => move.run(id, at, cut.mode))}
    }
    case 'trim': case 'roll': {
      const at = snap((cut.edge === 'start' ? place.start : place.end) + delta), carried = cut.act === 'trim' ? a?.trimClip : a?.rollClip
      return {key: `${cut.act}:${id}`, what: cut.act === 'trim' ? `Trim ${named}` : `Roll ${named}'s seam`, op: `clip.${cut.act}`, point: at,
        run: carried && (() => carried.run(id, cut.edge, at))}
    }
    case 'slip': {
      const slip = a?.slipClip
      return {key: `slip:${id}`, what: `Slip ${named}`, op: 'clip.slip', point: null, run: slip && (() => slip.run(id, delta))}
    }
    case 'slide': {
      const at = snap(place.start + delta), slide = a?.slideClip
      return {key: `slide:${id}`, what: `Slide ${named}`, op: 'clip.slide', point: at, run: slide && (() => slide.run(id, at - place.start))}
    }
  }
}

/** Whether a set's owner carries a move, and any edge cut: the ruler shows the Move mode and the Trim mode only where it does. */
export const carriesMove = (set: WorldTrackSet): boolean => !!set.actions?.moveClip
export const carriesEdgeCuts = (set: WorldTrackSet): boolean => !!(set.actions?.trimClip || set.actions?.rollClip || set.actions?.slipClip || set.actions?.slideClip)
