// The Arrangement ruler as its catalogue design (parity D-26; catalogue dlw__arrangement-ruler.tsx; manual §16.6): the design draws the
// mode's tracks the Session · Arrangement pane already reads (ModeTracksView.tsx over modeTracks.ts), laid on one ruler as the pane's
// ruler lays them (clipCuts.ts placeClips), fed through this binding. Its keys and their owners:
//   light                    lit while the set holds a track
//   mode, word               the mode the tracks are, and its name
//   tracks                   the set's tracks in its order, each with its needle and whether it stalled (WorldTrack)
//   clips                    each clip with a place on the ruler (placeClips), with its state, its standing and its takes
//   sections                 the set's sections (WorldTrackSection), as spans on the ruler
//   end, now, unit           the ruler's extent (placeClips: its fixed window, else what its clips and needles hold), its now and its unit
//   labels, spans            the ruler's own words (WorldTrackSet.ruler label and duration) at every point and span the views say: the
//                            window's marks at each view's width (rulerWindow.ts windowMarks, as the design asks them), its start, the
//                            marker, the loop's ends and each clip's place; the window's span and each stalled needle's age
//   loop, loopIn, loopOut    the loop its owner carries (WorldTrackSet.loop), its ends written through the owner's setLoop
//   sel                      THE selection, where it names a placed clip; a press selects through the pane's own selection
//   start, span, marker, snap, strip, laneTakes, laneAuto, laneEvents, readBy, edges, show:*, st:*   the view's own presentation, as the
//                            pane's ruler keeps its own (ArrangementRuler.tsx: "nothing here writes time to any owner"); unheld, what
//                            the pane starts with (the whole ruler, no marker, snap Grid, Takes and Automation on, Events off)
//   move, trim, axis         the pane's ruler's own cut modes, and the Technē set's own axis: refused here with where they are set
// The pane keeps the shell's own ruler as the device's Full (deviceDoor.ts OwnFull: the material itself), so scrubbing, the wheel and
// keyboard window, the cuts, the take comps, the lanes and the loop brace's handles stay as they work.
import type {DesignBinding, Standing, Value, ValueChange, Values} from '../devices/designed'
import type {WorldTrackSet} from '../../timeline/worldTrackAdapter'
import type {TracksSelection} from './SessionGrid'
import {trackColour} from './SessionGrid'
import {placeClips} from './clipCuts'
import {DEFAULT_LANES} from './trackLanes'
import {clampRange, rangeBounds, windowMarks} from './rulerWindow'
import {designDevice, handsFor, missing} from '../../techne/devices/designDevices'

export const RULER_ID = 'dlw:arrangement-ruler'
export const rulerDevice = designDevice(RULER_ID, {title: 'Arrangement ruler', icon: 'arrangement', heldBy: ['tracks'],
  note: 'The mode\'s tracks laid on one ruler: tracks down, time across.'})

/** The widths, in the design's own pixels, at which its views ask the window's marks: Compact's and Whole's plots, Full's ruler, and the
 * widget's whole ruler (dlw__arrangement-ruler.tsx COMPACT/WHOLE less the label column, FullRuler, Thin). */
const MARK_WIDTHS = [99, 149, 900] as const, WHOLE_WIDTH = 258
const STATES = new Set(['waiting', 'running', 'stopped', 'stalled'])
const STANDINGS: ReadonlySet<string> = new Set(['sourced', 'authored', 'derived', 'disputed', 'mythic', 'unavailable'])
/** What the pane's ruler starts with (ArrangementRuler.tsx: its snap, its lanes, no marker; Technē's reading defaults, §17.1). */
const PANE_STARTS: Readonly<Record<string, Value>> = {snap: 'grid', marker: -1, strip: true, laneTakes: DEFAULT_LANES.takes, laneAuto: DEFAULT_LANES.automation,
  laneEvents: DEFAULT_LANES.events, readBy: 'chronology', edges: true}
const LOCAL = ['start', 'span', 'marker', 'snap', 'strip', 'laneTakes', 'laneAuto', 'laneEvents', 'readBy', 'edges'] as const

export const CUTS_ARE_THE_PANES = 'The Move and Trim modes are the Arrangement pane\'s ruler\'s own: set them on its ruler, where a drag on a clip cuts.'
export const AXIS_IS_THE_SETS = 'The Time axis is the set\'s own: the ruler measures what the mode lays on it.'
export const NO_LOOP_SWITCH = missing('Loop on or off', 'an owner op that switches the loop on or off (the set\'s setLoop moves its ends only)', 'the mode\'s owner')
const NO_LOOP = 'This mode\'s set carries no loop.'

/** The keys the view holds, for this set. */
export function rulerLocal(set: WorldTrackSet): readonly string[] {
  const standings = new Set<string>(set.clips.flatMap(clip => (clip.standing ? [clip.standing.visual] : [])))
  return [...LOCAL, ...set.tracks.map(track => `show:${track.id}`), ...[...STANDINGS].filter(id => standings.has(id)).map(id => `st:${id}`)]
}

/** The design's values over the set, the selection and the view's holds. Pure. */
export function rulerValues(set: WorldTrackSet, selection: Pick<TracksSelection, 'ref'>, mode: string, held: Readonly<Record<string, Value>> = {}): Values {
  const {placed, end} = placeClips(set), bounds = rangeBounds(end)
  const values: Record<string, Value> = {light: set.tracks.length ? 'lit' : 'dark', mode, word: mode, end, unit: set.ruler?.unit ?? 'rows', ...PANE_STARTS,
    start: 0, span: end}
  for (const key of rulerLocal(set)) if (held[key] !== undefined) values[key] = held[key]!
  if (typeof set.ruler?.now === 'number') values.now = set.ruler.now
  values.tracks = JSON.stringify(set.tracks.map(track => ({id: track.id, name: track.name, short: track.name, c: trackColour(track),
    ...(typeof track.needle === 'number' ? {needle: track.needle} : {}), ...(track.stalled ? {stalled: true} : {})})))
  values.clips = JSON.stringify(placed.map(({clip, start, end: to}) => ({id: clip.id, track: clip.trackId, label: clip.label, at: start, ...(to > start ? {end: to} : {}),
    ...(clip.status && STATES.has(clip.status) ? {status: clip.status} : {}), ...(clip.standing && STANDINGS.has(clip.standing.visual) ? {standing: clip.standing.visual} : {}),
    ...(clip.takes?.length ? {takes: clip.takes.length} : {})})))
  values.sections = JSON.stringify((set.sections ?? []).map(section => ({id: section.id, name: section.name, from: section.span.start, to: section.span.end})))
  // The loop its owner carries.
  if (set.loop) {
    values.loop = !set.loop.off
    values.loopIn = set.loop.start
    values.loopOut = set.loop.end ?? end
  }
  if (selection.ref && placed.some(({clip}) => clip.id === selection.ref)) values.sel = selection.ref
  // The ruler's own words at every point and span the views say.
  const label = set.ruler?.label ?? ((at: number) => String(Math.round(at * 10) / 10))
  const range = clampRange({start: Number(values.start), end: Number(values.start) + Number(values.span)}, bounds)
  const points = new Set<number>([range.start, ...MARK_WIDTHS.flatMap(width => windowMarks(range, bounds, width).map(mark => mark.at)),
    ...windowMarks({start: 0, end}, bounds, WHOLE_WIDTH).map(mark => mark.at), ...placed.map(({start}) => start)])
  for (const key of ['marker', 'loopIn', 'loopOut'] as const) if (typeof values[key] === 'number' && (values[key] as number) >= 0) points.add(values[key] as number)
  values.labels = JSON.stringify(Object.fromEntries([...points].map(at => [String(at), label(at)])))
  const duration = set.ruler?.duration ?? ((span: number) => `${Math.round(span * 10) / 10} ${set.ruler?.unit ?? 'rows'}`)
  const spans = new Set<number>([range.end - range.start, ...set.tracks.flatMap(track => (track.stalled && typeof track.needle === 'number' ? [Math.max(0, (set.ruler?.now ?? end) - track.needle)] : []))])
  values.spans = JSON.stringify(Object.fromEntries([...spans].map(span => [String(span), duration(span)])))
  return values
}

function rulerStanding(set: WorldTrackSet): Record<string, Standing> {
  const standing: Record<string, Standing> = {move: {disabled: CUTS_ARE_THE_PANES}, trim: {disabled: CUTS_ARE_THE_PANES}, axis: {disabled: AXIS_IS_THE_SETS}}
  if (!set.loop) for (const key of ['loop', 'loopIn', 'loopOut']) standing[key] = {disabled: NO_LOOP}
  else {
    standing.loop = {disabled: NO_LOOP_SWITCH}
    if (!set.actions?.setLoop) for (const key of ['loopIn', 'loopOut']) standing[key] = {disabled: set.actions?.waiting?.setLoop ?? 'This mode\'s owner takes no loop edit from here.'}
  }
  return standing
}

export async function rulerWrite(set: WorldTrackSet, selection: TracksSelection, changes: readonly ValueChange[]): Promise<void> {
  const {placed} = placeClips(set)
  for (const {key, value} of changes) {
    if (key === 'sel') {
      const clip = placed.find(({clip}) => clip.id === value)?.clip
      if (!clip) throw Error('No clip of this set lies there on the ruler.')
      selection.select({kind: 'clip', ref: clip.id, title: clip.label, track: clip.trackId})
      continue
    }
    if (key === 'loopIn' || key === 'loopOut') {
      if (!set.loop) throw Error(NO_LOOP)
      const setLoop = set.actions?.setLoop
      if (!setLoop) throw Error(set.actions?.waiting?.setLoop ?? 'This mode\'s owner takes no loop edit from here.')
      if (typeof value !== 'number' || !Number.isFinite(value)) throw Error('A loop point is a place on the ruler.')
      await setLoop.run(key === 'loopIn' ? 'start' : 'end', value)
      continue
    }
    if (key === 'loop') throw Error(set.loop ? NO_LOOP_SWITCH : NO_LOOP)
    if (key === 'move' || key === 'trim') throw Error(CUTS_ARE_THE_PANES)
    if (key === 'axis') throw Error(AXIS_IS_THE_SETS)
    throw Error(`${key} is a reading of the set: its owner reports it; nothing here changes it.`)
  }
}

/** The Arrangement ruler's binding over the set the pane shows. */
export function rulerBinding(set: WorldTrackSet, selection: TracksSelection, mode: string, held: Readonly<Record<string, Value>> = {}): DesignBinding {
  return {
    id: RULER_ID,
    values: rulerValues(set, selection, mode, held),
    standing: rulerStanding(set),
    local: handsFor(RULER_ID, rulerLocal(set)),
    writes: key => ['sel', 'loop', 'loopIn', 'loopOut', 'move', 'trim', 'axis'].includes(key),
    write: changes => rulerWrite(set, selection, changes),
  }
}
