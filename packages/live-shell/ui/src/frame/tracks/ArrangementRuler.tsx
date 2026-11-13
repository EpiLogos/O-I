// The Arrangement's shared law and parts (parity D-26): the Arrangement itself is the catalogue design's Full (inhabitants/catalogue/panels/
// dlw__arrangement-ruler.tsx ArrangementRulerView, ArrangementRuler), drawn by the Session · Arrangement pane on its device, its window,
// snap, marker, lanes and cut modes the device's own holds (useRulerView). What stays here is what the ruler's drawing reads and the tests
// call: where each clip lies, the loop, a clip's content marks, the view's props, the loop brace and the head column's fit.
//
// What the Arrangement is and does (moved with it, kept here as the law it draws):
// The one Arrangement view (manual §3, FOUNDATION F3): "lays the same material along one ruler, so you can see the course
// of it". Tracks down, time across. A clip with a place on the ruler stands there; a set with no ruler lays its rows end
// to end, each as wide as its longest clip, while a set with a ruler lays only the clips that have an `at` (no `at`, no
// place on it) and says how many it left to the Session. A track's needle marks where it has got to, and stalls in the
// stall colour with its age. A ruler that fixes its window and says where now stands gets a now line. A running clip has no
// right edge (its needle is the edge) and a waiting one with no length is a dash. Craft floor: world-shell-mockup.html
// `tlBody` / `tlClips`; ported from agent/AgentArrangementView.tsx (the run viewer).
//
// From the World cut presentation it replaced (git 09a573a1d:packages/live-shell/ui/src/projections/worldTimelinePresentation.tsx)
// and the Expressions Arrangement (…/components/nativeArrangementTimeline.tsx), everything read from the set:
// - each clip's standing mark (trackMarks.ts; :316-347 there), and the atmosphere of the narrowest section it stands in;
// - the sections, one lane per layer under the ruler, nested by depth and coloured by their atmosphere (trackSections.ts; :391-431);
// - the occasion stood in, as a line through the lanes and a readout on the ruler with its admission light (:367, :465-474) —
//   lit only when an admission is reported;
// - each walk as a rail under the lane that holds its stops, its stops numbered in walk order; pressing one stands it through
//   the set's `focusStop` (trackRails.ts; :433-447, :258-261);
// - the window: ⌘/Ctrl-wheel or a pinch zooms about the pointer, a sideways or Shift wheel pans, a drag on the ruler pans, and
//   the focused ruler takes ←/→ ↑/↓ + − Home End (a slider: the window's keys leave it its own); a press on the ruler sets the
//   pane's insert marker, snapped to the grid, coarsely, or freely (Shift frees one press, Alt coarsens it), and keyboard zoom
//   holds it still (rulerWindow.ts; nativeArrangementTimeline.tsx:92-111, :142-148, :173-226, :296-315). The window, the snap
//   and the marker are the pane's presentation: nothing here writes time to any owner.
// - the loop brace (catalogue dlw__arrangement-ruler.tsx `.arp-brace`): the loop its owner carries (`loopOf`), over the marks and down
//   each track, cut to the window (rulerWindow.ts bandIn). A set that carries none draws none. Where its owner lets it be set
//   (`actions.setLoop`, XT15 round 890), its ends are handles, Loop in and Loop out: dragged (snapping as a press does) and let go, or
//   moved a mark with the arrow keys, each is one press of the owner's op, as Live's brace is set by dragging its ends. With Loop off
//   (`loop.off`) the brace stands where it is, drawn and said as off.
// R3 (manual §16.6 "Arrangement view", §16.8; lock §0.3 item 3; Live cap 43–45): each track's head carries its mixer switches; the
// Main track's material lies last; under each track lie its lanes by the Lanes setting (Takes On, Automation On, Events Off): take
// lanes, each with its audition, where a stretch selected and Return copies it into the main lane through the owner's comp (the
// main lane shows which take each stretch came from); automation lanes naming device and parameter, what modulates them, and
// Re-enable for a value held by hand; Factory's event lanes, an event clicked opening beside the ruler (trackLanes.ts).
// The cuts (O-I #747; manual §16.6's edit table and Settings): where the set's owner carries them, a drag on a clip's body moves it by the
// Move mode and a drag on its edge does what the Trim mode says, its point snapping to clip edges, the insert marker, the loop's edges and
// the playhead unless Alt is held or the snap is Free (clipCuts.ts); the drag ends in one press of the owner's op. A press that does not
// move still selects the clip.
import type {RefObject} from 'react'
import type {WorldTrackSet} from '../../timeline/worldTrackAdapter'
import type {PressedReceipt, TracksSelection} from './SessionGrid'
import {DEFAULT_LANES, type LanesShown} from './trackLanes'
import type {BraceDrag, SnapMode, TimeRange, WindowBand} from './rulerWindow'
import {loadWhenDrawn} from '../../shell/loadWhenDrawn'
import type {LoopBraceEndsProps} from './loopBraceEnds'
import {placeClips, type ClipDrag, type CutPreview, type MoveMode, type TrimMode} from './clipCuts'
import './tracks.css'

/** A grouped track's two sides, as the ruler names them (lock §9.3: sight and sound of one state). */
export const SIDE_WORD = {visual: 'sight', audio: 'sound'} as const

/** Every clip's place on one ruler (clipCuts.ts, where the cuts and the object menu's Split read it too). */
export {placeClips}

/** The loop its owner carries (`set.loop`), in the Arrangement's units: a loop with no end runs to the end of what the Arrangement
 * lays (`end`, the bounds' end). A set without one draws no brace, as the design draws no loop. */
export const loopOf = (set: WorldTrackSet, end: number): TimeRange | undefined =>
  set.loop ? {start: set.loop.start, end: set.loop.end ?? end} : undefined

/** XT15 (round 890): the brace's ends, loaded when a brace its owner lets set first draws (frame/tracks/loopBraceEnds.tsx), so the
 * window's first load carries none of their gestures; until they arrive the brace stands read. */
export const LoopBraceEnds = loadWhenDrawn<LoopBraceEndsProps>('The loop brace\'s ends', () => import('./loopBraceEnds').then(module => module.LoopBraceEnds), () => null)

/** The loop brace where the window shows it (catalogue dlw__arrangement-ruler.tsx `.arp-brace`): over the marks with its words, quieter in
 * a lane. An end outside the window draws no edge. */
export function LoopBrace({band, words, lane, off}: {band: WindowBand; words: string; lane?: boolean; off?: boolean}) {
  return <i className="tl-brace" data-loop={lane ? 'lane' : 'ruler'} data-off={off || undefined} data-cut-start={band.cutStart || undefined} data-cut-end={band.cutEnd || undefined}
    style={{left: `${band.left}%`, width: `${band.width}%`}} {...(lane ? {'aria-hidden': true} : {role: 'img', 'aria-label': words})} />
}

/** The marks of a clip's own content (O-I #747 round 893: what a Slip moves, manual §16.6): the content's seconds the clip plays, from
 * `from` for `length`, at a step that gives at most eight, each where it plays in the clip (% of its length), every fourth stronger, as
 * Live draws a clip's content moved by a slip. */
const CONTENT_STEPS = [0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1800, 3600]
export function contentMarks(from: number, length: number): {at: number; left: number; major: boolean}[] {
  if (!(length > 0) || !Number.isFinite(from)) return []
  const step = CONTENT_STEPS.find(step => length / step <= 8) ?? CONTENT_STEPS.at(-1)!
  const marks: {at: number; left: number; major: boolean}[] = []
  for (let k = Math.floor(from / step) + 1; k * step < from + length; k++) {
    const at = Math.round(k * step * 1000) / 1000
    if (at > from) marks.push({at, left: (at - from) / length * 100, major: k % 4 === 0})
  }
  return marks
}

/** A length on the ruler when the set gives no way to say it: the number and the ruler's unit. */
export const plainDuration = (unit: string) => (span: number): string => `${Math.round(span)} ${unit}`

/** The pane's own view of the ruler: the window, the snap, the insert marker — and what the gestures and keys do to them. */
export interface RulerWindowProps {
  /** The window shown; null is the whole ruler. */
  window: TimeRange | null
  onWindow(next: TimeRange | null): void
  snap: SnapMode
  onSnap(next: SnapMode): void
  marker: number | null
  onMarker(next: number | null): void
  /** The time selection (Live's: Shift-press extends one from the insert marker), the pane's own; Consolidate joins what plays in it.
   * Absent: the pane holds none. */
  span?: TimeRange | null
  onSpan?(next: TimeRange | null): void
  /** The measured width of the ruler's marks, in px (0 before it is measured). */
  width: number
  /** The marks row, for the gestures' geometry; the Arrangement's root, for the wheel and the pinch. */
  marksRef?: RefObject<HTMLDivElement | null>
  rootRef?: RefObject<HTMLDivElement | null>
  /** The drag in progress on the ruler, held across renders by the pane (a pan re-renders the view mid-drag). */
  gesture?: {current: RulerGesture | null}
  /** The cuts' settings and the clip drag in progress, the pane's own (clipCuts.ts). Absent: a clip is pressed, never dragged. */
  cuts?: RulerCutsProps
  /** The loop brace's end under the hand (XT15, round 890), the pane's own until it is let go. Absent: the ends are not dragged here. */
  brace?: {drag: BraceDrag | null; onDrag(next: BraceDrag | null): void}
}

/** The Move mode and the Trim mode (manual §16.6 Settings), the drag on a clip under way, and what it draws while it moves. */
export interface RulerCutsProps {
  move: MoveMode
  onMove(next: MoveMode): void
  trim: TrimMode
  onTrim(next: TrimMode): void
  drag: {current: ClipDrag | null}
  preview?: CutPreview | null
  onPreview(next: CutPreview | null): void
}

/** A press on the ruler: where it began, the window then, px per ruler unit, and whether it has moved into a pan. */
export interface RulerGesture {pointer: number; startX: number; start: TimeRange; scale: number; moved: boolean}

/** A stretch of a take being chosen (the pane's own, until Return hands it to the owner's comp). */
export interface TakeSelection {trackId: string; takeId: string; from: number; to: number}

/** A lane's moves being drawn (XT10, round 889): the pointer's samples so far, in ruler seconds and the lane's 0–1 height (the pane's own,
 * until the release hands the drawn moves to the owner). */
export interface LaneDraw {laneId: string; samples: {at: number; value: number}[]}

/** The pane's lanes state: the Lanes setting, the stretch of a take being chosen, the lane being drawn, and the event opened beside the ruler. */
export interface LanesViewProps {
  shown: LanesShown
  onShown(next: LanesShown): void
  take: TakeSelection | null
  onTake(next: TakeSelection | null): void
  draw?: LaneDraw | null
  /** The next drawing, or how it follows from the one before (each pointer move adds its sample to the latest, never to a stale copy). */
  onDraw?(next: LaneDraw | null | ((current: LaneDraw | null) => LaneDraw | null)): void
  opened: {laneId: string; eventId: string} | null
  onOpened(next: {laneId: string; eventId: string} | null): void
}
export const STILL_LANES: LanesViewProps = {shown: DEFAULT_LANES, onShown: () => {}, take: null, onTake: () => {}, draw: null, onDraw: () => {}, opened: null, onOpened: () => {}}

export interface ArrangementRulerViewProps {
  set: WorldTrackSet
  selection: TracksSelection
  empty?: string
  view: RulerWindowProps
  /** The lanes under the tracks; absent, the Lanes setting's defaults with nothing chosen. */
  lanes?: LanesViewProps
  receipt: PressedReceipt | null
  /** A rail's stop pressed: `key` names the control, `what` the press, `run` calls the owner. */
  onPress(key: string, what: string, run: () => unknown): void
  onDismiss(): void
  /** The parts chosen with THE selection (O9, partChoice.ts), each drawn as chosen on its head; absent, THE selection alone. */
  chosen?: readonly string[]
}

/** The head column's own width, the least it is (px). */
export const HEAD_COLUMN = 132
export const HEADS = '.tl-ruler > .tl-head, .tl-lane > .tl-head'
/** What a head lacks to hold its contents whole: what each part of it (the head included) is laid out narrower than it draws, together. */
function shortOf(head: HTMLElement): number {
  let short = 0
  for (const part of [head, ...head.querySelectorAll('*')]) if (part instanceof HTMLElement && part.clientWidth > 0) short += Math.max(0, part.scrollWidth - part.clientWidth)
  return short
}
/** Lays the column out at its own width, then widens it by what its heads lack until none lacks anything; the width it settles at (px). */
export function fitHeadColumn(root: HTMLElement): number {
  let width = HEAD_COLUMN
  root.style.setProperty('--tl-head-w', `${width}px`)
  for (let pass = 0; pass < 6; pass++) {
    const short = Math.max(0, ...[...root.querySelectorAll<HTMLElement>(HEADS)].map(shortOf))
    if (short <= .5) break
    width += Math.ceil(short)
    root.style.setProperty('--tl-head-w', `${width}px`)
  }
  return width
}
