// The Journey (§17.6, techne:journey), the Timeline (§17.5, techne:timeline) and the Canvas (§17.4, techne:canvas) on their owner: the
// research frame (expressions-app field-studies-journeys: the Journey document and journeyInstrument.tsx; researchInstruments.tsx's Canvas
// and Timeline). The frame stands inside the hosted Expressions pane; the shell reaches it only through what it announces and the one
// runner it answers (projections/expressionsPaneHost.ts useHostedChrome):
//   - its research reading (researchReading.ts, announced with its state as HostedAppState.research): the walk as its Journey document
//     holds it and where it stands; the board the Canvas presents (cards, lines with their connector records, frames, camera, selection,
//     pointer flags); the ruler the Timeline presents (its dated events, their relations, the years they span, projection, camera, views);
//   - its own acts as stage commands (stageCommands.ts): journey stand · play · stop · enter · return, the walk's pace and seams (journey
//     pace · seam · switch · curve · loop), the Timeline's camera, saved views, relation links and card categories (timeline camera · view ·
//     links · categories), canvas camera and the selected line's connector (canvas connector) — each the frame's own act (app.ts
//     runStageCommand, journeyEdit; researchInstruments.tsx timelineAct, setCanvasConnector);
//   - its chrome (stageCommands.ts FrameChromeReading, presentedChrome.ts): its own controls by home, pressed by the `chrome` command
//     (the Timeline's projection tabs and Refresh, the Canvas's pointer toggles and overview), and its save glyph;
//   - the shared time window, which the session owns and the frame reads (desktop/cradle/src/techne/session.ts time_window), written
//     through the session's compare-and-set writer (projections/atlas/sharedClock.ts writeSharedWindow).
// What the frame does not hold, or no command carries, stays absent or disabled naming the missing operation. Nothing here is the
// design's sample.
import type {FrameChromeControl, FrameChromeReading, HostedAppState} from '@epilogos/expressions-boundary'
import type {StageRun} from '../../components/expressions/studio/StudioStage'
import type {DesignBinding, Standing, Value, ValueChange, Values} from '../../frame/devices/designed'
import {CANVAS_DESIGN, JOURNEY_DESIGN, TIMELINE_DESIGN, disabled, handsFor, missing, put, refusal} from './designDevices'

/** What the shell holds of the frame now. */
export interface FrameReadings {
  /** The frame's announced state, or null before it has reported one. */
  readonly state: HostedAppState | null
  /** The frame's one runner, or null when no frame is mounted. */
  readonly run: StageRun | null
  /** The shared window: its two edges (instants, or null for an open edge), null for all time, undefined when no session stands. */
  readonly window: {readonly from: string | null; readonly to: string | null} | null | undefined
}

/** The frame's controls in one home. */
const at = (chrome: FrameChromeReading | null | undefined, home: string): FrameChromeControl[] => (chrome?.controls ?? []).filter(control => control.home === home)
const control = (chrome: FrameChromeReading | null | undefined, home: string, label: string): FrameChromeControl | undefined => at(chrome, home).find(candidate => candidate.label === label)

/** The device's light: lit while the frame stands in its lens, dark in another, absent before the frame reports one. */
function lightOf(state: HostedAppState | null, lens: string): Value | undefined {
  if (!state?.lens) return undefined
  return state.lens === lens ? 'lit' : 'dark'
}

/** Why nothing of the frame can be pressed. */
const unmounted = (frame: FrameReadings) => (!frame.run ? 'No Expressions application is mounted: open the Expressions pane.' : !frame.state ? 'The Expressions application has not reported its state yet.' : null)

/** Press one of the frame's own controls; its refusal comes back in its words. */
async function press(frame: FrameReadings, target: FrameChromeControl | undefined, what: string): Promise<void> {
  const why = unmounted(frame)
  if (why) throw Error(why)
  if (!target) throw Error(`${what}: the frame does not show this control now (open the instrument on the focused pane).`)
  if (target.disabled) throw Error(`${what}: ${target.title ?? 'the frame holds this control off now.'}`)
  const result = await frame.run!({command: 'chrome', id: target.id})
  if (!result.ok) throw Error(result.error)
}

/** The keys a binding refuses for every index the reading names (and the first, before it names any). */
const indexed = (keys: readonly string[], count: number, why: string): Record<string, string> =>
  Object.fromEntries(keys.flatMap(key => Array.from({length: Math.max(1, count)}, (_, i) => [`${key}:${i}`, why])))

// ---------------------------------------------------------------------------------------------------------------- the Journey

export const JOURNEY_ID = JOURNEY_DESIGN
/** The frame announces no research reading at all: a frame that predates it. */
const NO_RESEARCH = missing('The research reading', 'the research announcement (an older frame announces only its scene index, count and name)', 'the research frame')
const NO_WORDS = missing('A stop\'s words', 'a stage command for a Scene\'s character (the frame\'s scene inspector writes the character of the Scene it stands on)', 'the research frame')
export const JOURNEY_REFUSE = {
  snap: missing('Snap', 'a snap setting the frame holds for the walk\'s drags (journeyPath.ts lands a drag on its own law)', 'the research frame'),
  take: 'The frame keeps no takes of a walk: recording a walk keeps none to choose among.',
} as const
/** The keys of each stop the walk's pace and seam edits write (stageCommands.ts STAGE_JOURNEY_EDITS), and the one no command carries. */
const JOURNEY_EDGES = ['hold', 'tr', 'kind', 'curve', 'sw', 'dir', 'atc'] as const
const JOURNEY_UNCARRIED = ['words'] as const
const JOURNEY_ACTS = ['at', 'local', 'playing', 'entered', 'stopAtEnd'] as const

/** The Journey's values: the walk as the frame's Journey document holds it (researchReading.ts journeyReadingOf: each Scene's name, character,
 * duration and the transition it is entered by, the loop and its exit), and where the walk stands (the stop, the seconds into it, whether
 * the saved scenes play, whether a crossing stands). */
export function journeyValues(frame: FrameReadings): Values {
  const values: Record<string, Value> = {}
  const state = frame.state
  put(values, 'light', lightOf(state, 'journey'))
  const walk = state?.research?.journey
  if (!walk) return values
  values.walk = walk.name
  values.docLoops = walk.loops
  values.stopAtEnd = walk.stopAtEnd
  values.stops = JSON.stringify(walk.stops.map(stop => [stop.name, stop.words]))
  walk.stops.forEach((stop, i) => {
    values[`words:${i}`] = stop.words
    values[`hold:${i}`] = stop.hold
    values[`tr:${i}`] = stop.seconds
    values[`kind:${i}`] = stop.kind
    values[`curve:${i}`] = stop.curve
    values[`sw:${i}`] = stop.switch
    put(values, `dir:${i}`, stop.direction)
    put(values, `atc:${i}`, stop.at)
  })
  if (walk.stops.length) values.at = walk.at
  values.local = walk.local
  values.playing = walk.playing
  values.entered = walk.entered
  return values
}

/** Why a key of a frame instrument has no reading now: the frame not mounted or not reporting, then the instrument's own reason. */
function frameAbsent(frame: FrameReadings, lens: string, reasons: Readonly<Record<string, string>>, key: string, fallback: string): string {
  if (key in reasons) return reasons[key]!
  const why = unmounted(frame)
  if (why) return why
  if (!frame.state?.research) return NO_RESEARCH
  if (frame.state?.lens && frame.state.lens !== lens) return `The frame stands in its ${frame.state.lens} lens: open this instrument on the focused pane to read it.`
  return fallback
}
export const journeyAbsent = (frame: FrameReadings, key: string): string => {
  if (key === 'takes') return JOURNEY_REFUSE.take
  if (/^dir:\d+$/.test(key) && frame.state?.research?.journey) return 'Only a wipe has a direction, and this stop is not entered by one.'
  if (/^atc:\d+$/.test(key) && frame.state?.research?.journey) return 'Only a dip to colour has a colour point, and this stop is not entered by one.'
  if (/^name:\d+$/.test(key) && frame.state?.research?.journey) return 'A stop\'s name is the Scene\'s own, in the list of stops.'
  if (frame.state && !frame.state.research?.journey) return unmounted(frame) ?? NO_RESEARCH
  return frameAbsent(frame, 'journey', JOURNEY_REFUSE, key, 'The frame has not reported this part of its walk.')
}

/** Run one of the frame's own acts; its refusal comes back in its words. */
async function run(frame: FrameReadings, command: Parameters<StageRun>[0]): Promise<void> {
  const why = unmounted(frame)
  if (why) throw Error(why)
  const result = await frame.run!(command)
  if (!result.ok) throw Error(result.error)
}

export async function journeyWrite(frame: FrameReadings, changes: readonly ValueChange[]): Promise<void> {
  const walk = frame.state?.research?.journey
  for (const {key, value} of changes) {
    if (key === 'at' || key === 'local') {
      if (!walk) throw Error(unmounted(frame) ?? NO_RESEARCH)
      const index = key === 'at' ? Number(value) : walk.at
      if (!Number.isSafeInteger(index) || index < 0 || index >= walk.stops.length) throw Error(`The walk has ${walk.stops.length} stops: there is no stop ${index + 1}.`)
      const seconds = key === 'local' ? Number(value) : 0
      if (!Number.isFinite(seconds) || seconds < 0) throw Error('A stop is stood on at a time within it.')
      await run(frame, {command: 'journey', action: 'stand', index, ...(seconds ? {seconds} : {})})
      continue
    }
    if (key === 'playing') { await run(frame, {command: 'journey', action: value === true ? 'play' : 'stop'}); continue }
    if (key === 'entered') { await run(frame, {command: 'journey', action: value === true ? 'enter' : 'return'}); continue }
    if (key === 'stopAtEnd') {
      if (typeof value !== 'boolean') throw Error('The walk stops at its end or loops.')
      await run(frame, {command: 'journey', action: 'loop', on: value}); continue
    }
    const edit = /^(hold|tr|kind|curve|sw|dir|atc):(\d+)$/.exec(key)
    if (edit) { await run(frame, journeyEditCommand(edit[1]!, Number(edit[2]), value, walk)); continue }
    throw Error((JOURNEY_REFUSE as Readonly<Record<string, string>>)[key] ?? (JOURNEY_UNCARRIED.some(edge => key.startsWith(`${edge}:`)) ? NO_WORDS : refusal(JOURNEY_REFUSE, key).message))
  }
}

/** The frame's own edit for one stop's pace or seam key (stageCommands.ts journey pace · seam · switch · curve). */
function journeyEditCommand(edge: string, index: number, value: Value, walk: NonNullable<HostedAppState['research']>['journey']): Parameters<StageRun>[0] {
  if (walk && index >= walk.stops.length) throw Error(`The walk has ${walk.stops.length} stops: there is no stop ${index + 1}.`)
  const number = (what: string) => { if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw Error(`${what} takes a number of seconds.`); return value }
  const word = (what: string) => { if (typeof value !== 'string' || !value) throw Error(`${what} takes one of its words.`); return value }
  switch (edge) {
    case 'hold': return {command: 'journey', action: 'pace', index, seconds: number('A stop\'s hold')}
    case 'tr': return {command: 'journey', action: 'seam', index, seconds: number('A transition')}
    case 'kind': return {command: 'journey', action: 'seam', index, transition: word('A transition\'s kind') as never}
    case 'dir': {
      if (walk && walk.stops[index]?.kind !== 'wipe') throw Error('Only a wipe has a direction, and this stop is not entered by one.')
      return {command: 'journey', action: 'seam', index, direction: word('A wipe\'s direction') as never}
    }
    case 'atc': {
      if (walk && walk.stops[index]?.kind !== 'dip-to-colour') throw Error('Only a dip to colour has a colour point, and this stop is not entered by one.')
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) throw Error('A dip\'s colour point is a share of the transition, 0 to 1.')
      return {command: 'journey', action: 'seam', index, at: value}
    }
    case 'curve': return {command: 'journey', action: 'curve', index, type: word('A curve') as never}
    default: return {command: 'journey', action: 'switch', index, mode: word('A switch') as never}
  }
}

const JOURNEY_READINGS = ['light', 'walk', 'stops', 'docLoops', 'takes'] as const

export function journeyBinding(frame: FrameReadings): DesignBinding {
  const count = Math.max(frame.state?.research?.journey?.stops.length ?? 0, frame.state?.sceneCount ?? 0)
  const refuse: Record<string, string> = {...JOURNEY_REFUSE, ...indexed(JOURNEY_UNCARRIED, count, NO_WORDS)}
  const values = journeyValues(frame)
  const standing = disabled(refuse)
  const why = unmounted(frame) ?? (frame.state?.research?.journey ? null : NO_RESEARCH)
  if (why) for (const key of [...JOURNEY_ACTS, ...Object.keys(indexed(JOURNEY_EDGES, count, why))]) standing[key] = {disabled: why}
  for (const key of [...JOURNEY_READINGS, ...Array.from({length: Math.max(1, count)}, (_, i) => `name:${i}`)]) if (!(key in values) && !(key in standing)) standing[key] = {disabled: journeyAbsent(frame, key)}
  return {
    id: JOURNEY_ID,
    values,
    standing,
    ...(frame.run && !frame.state ? {waiting: true} : {}),
    writes: key => !(key in refuse) && ((JOURNEY_ACTS as readonly string[]).includes(key) || JOURNEY_EDGES.some(edge => key.startsWith(`${edge}:`))),
    write: changes => journeyWrite(frame, changes),
  }
}

// ---------------------------------------------------------------------------------------------------------------- the Timeline

export const TIMELINE_ID = TIMELINE_DESIGN
/** The frame's three projections on its Timeline (researchInstruments.tsx :1359-1361 `m2Projection`: chronology, field, relative), as
 * its own tab words and the design's lens values. */
const LENS_TABS: readonly {lens: string; projection: string; label: string}[] = [{lens: 'chronology', projection: 'chronology', label: 'Chronology'},
  {lens: 'relations', projection: 'field', label: 'Relations'}, {lens: 'relative', projection: 'relative', label: 'Relative'}]
/** The relation field's standing classes the design draws (techne/m0m5/timeline/standing.ts), as the frame names a relation's standing. */
const STANDINGS: ReadonlySet<string> = new Set(['sourced', 'derived', 'authored', 'disputed', 'mythic', 'unavailable'])
const NO_RULER_EDIT = missing('The ruler\'s relation filters', 'stage commands for the Timeline\'s relation mode, standing classes, archetypes, walk, sub-timeline, globe and selection (the vendored chronology keeps them in its own toolbar; only a saved view\'s restore reaches them)', 'the research frame')
const NO_VIEW_NAME = missing('Save view', 'a name for the view: the frame\'s "Save view…" asks for one, and the design gives none (the frame\'s save-view command takes a name)', 'the design')
const NOT_PRESENTED = 'The frame presents no Timeline now: open the Timeline on the focused pane to read its ruler.'
export const TIMELINE_REFUSE = {
  mode: NO_RULER_EDIT, archetypes: NO_RULER_EDIT, walk: NO_RULER_EDIT, saveView: NO_VIEW_NAME,
  showAll: NO_RULER_EDIT, subTimeline: NO_RULER_EDIT, earth: NO_RULER_EDIT, selected: NO_RULER_EDIT,
  st_sourced: NO_RULER_EDIT, st_derived: NO_RULER_EDIT, st_authored: NO_RULER_EDIT, st_disputed: NO_RULER_EDIT, st_mythic: NO_RULER_EDIT, st_unavailable: NO_RULER_EDIT,
} as const
/** The card categories the design toggles, by the chronology's own category ids (timelineCategoryIds.ts: source, myth, claim). */
const CARD_CATEGORIES = ['source', 'myth', 'claim'] as const
const NO_SESSION = 'No shared session stands (no work is open in Technē), so there is no window to read over.'
export const TIMELINE_LOCAL = ['winFrom', 'winTo'] as const
const TIMELINE_ACTS = ['lens', 'refresh', 'readOn', 'readOver', 'clearWindow', 'centre', 'zoom', 'view', 'links', ...CARD_CATEGORIES.map(id => `cat_${id}`)] as const

/** The year an instant of the window stands at, and the instant of a whole year — the shared clock's own law (sharedClock.ts). */
export interface WindowLaw {
  readonly yearOf: (instant: string | null | undefined) => number | null
  readonly instantOf: (year: number) => string
  /** The session's compare-and-set write: the refusal in its words, or null once written. */
  readonly write: (window: {from: string | null; to: string | null} | null) => string | null
}

/** The Timeline's values: the ruler the frame presents (researchReading.ts timelineReadingOf: its dated events, the relations between them,
 * the years they span, its projection, its camera and its named views), the shared window (on, and its two edges) and the hand's window
 * before Read over, starting where the shared window stands. */
export function timelineValues(frame: FrameReadings, law: Pick<WindowLaw, 'yearOf'>, held: Readonly<Record<string, Value>> = {}): Values {
  const values: Record<string, Value> = {}
  put(values, 'light', lightOf(frame.state, 'timeline'))
  const ruler = frame.state?.research?.timeline
  if (ruler) {
    put(values, 'lens', LENS_TABS.find(tab => tab.projection === ruler.projection)?.lens)
    values.events = JSON.stringify(ruler.events.map(event => ({id: event.id, name: event.name, from: event.from, to: event.to, ...(event.family ? {family: event.family} : {})})))
    values.edges = JSON.stringify(ruler.edges.map(edge => ({id: edge.id, from: edge.from, to: edge.to, kind: edge.kind, ...(edge.standing && STANDINGS.has(edge.standing) ? {st: edge.standing} : {})})))
    values.dated = ruler.events.length > 0
    put(values, 'domFrom', ruler.domain?.from)
    put(values, 'domTo', ruler.domain?.to)
    put(values, 'centre', ruler.centre)
    put(values, 'zoom', ruler.zoom)
    values.views = JSON.stringify(ruler.views.map(view => ({id: view.id, label: view.label})))
    put(values, 'links', ruler.links)
    if (ruler.hiddenCategories) for (const id of CARD_CATEGORIES) values[`cat_${id}`] = !ruler.hiddenCategories.includes(id)
  }
  if (frame.window !== undefined) {
    values.readOn = frame.window !== null
    put(values, 'readFrom', frame.window ? law.yearOf(frame.window.from) : undefined)
    put(values, 'readTo', frame.window ? law.yearOf(frame.window.to) : undefined)
  }
  put(values, 'winFrom', held.winFrom ?? values.readFrom)
  put(values, 'winTo', held.winTo ?? values.readTo)
  return values
}

export async function timelineWrite(frame: FrameReadings, changes: readonly ValueChange[], law: WindowLaw, held: Readonly<Record<string, Value>>): Promise<void> {
  const chrome = frame.state?.lens === 'timeline' ? frame.state.chrome : undefined
  const span = (): {from: string; to: string} => {
    const values = timelineValues(frame, law, held)
    const from = Number(values.winFrom), to = Number(values.winTo)
    if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to)) throw Error('Set From and To first: the window has no edges to read over.')
    return {from: law.instantOf(Math.min(from, to)), to: law.instantOf(Math.max(from, to))}
  }
  const written = (window: {from: string | null; to: string | null} | null) => {
    if (frame.window === undefined) throw Error(NO_SESSION)
    const why = law.write(window)
    if (why) throw Error(why)
  }
  const ruler = frame.state?.research?.timeline
  let camera: {centre: number; zoom: number} | undefined, hidden: string[] | undefined
  for (const {key, value} of changes) {
    if (key === 'centre' || key === 'zoom') {
      const base = camera ?? (ruler?.centre !== undefined && ruler.zoom !== undefined ? {centre: ruler.centre, zoom: ruler.zoom} : undefined)
      if (!base) throw Error(ruler ? 'The chronology has not reported its camera yet.' : unmounted(frame) ?? NOT_PRESENTED)
      if (typeof value !== 'number' || !Number.isFinite(value) || (key === 'zoom' && value <= 0)) throw Error('The camera moves by numbers.')
      camera = {...base, [key]: value}
      continue
    }
    const category = /^cat_(source|myth|claim)$/.exec(key)
    if (category) {
      const now = hidden ?? ruler?.hiddenCategories
      if (!now) throw Error(ruler ? 'Open the chronology: its card categories are read only while it is drawn.' : unmounted(frame) ?? NOT_PRESENTED)
      hidden = value === true ? now.filter(id => id !== category[1]) : [...new Set([...now, category[1]!])]
      continue
    }
    switch (key) {
      case 'view':
        if (value === 'none' || value === undefined) break
        if (typeof value !== 'string' || !ruler?.views.some(view => view.id === value)) throw Error(`The Timeline keeps no view named "${String(value)}".`)
        await run(frame, {command: 'timeline', action: 'view', name: value})
        break
      case 'links':
        if (typeof value !== 'boolean') throw Error('The relation links are shown or hidden.')
        if (ruler?.links === value) break
        await run(frame, {command: 'timeline', action: 'links', on: value})
        break
      case 'lens': {
        const tab = LENS_TABS.find(candidate => candidate.lens === value)
        if (!tab) throw Error(`The Timeline's lenses are Chronology, Relations and Relative, never ${String(value)}.`)
        if (frame.state?.research?.timeline?.projection === tab.projection) break
        // The frame's own projection tab, pressed (researchInstruments.tsx :1359-1361).
        await press(frame, control(chrome, 'timeline:lens', tab.label), `Lens ${tab.label}`)
        break
      }
      case 'refresh': await press(frame, control(chrome, 'timeline:lens', 'Refresh timeline'), 'Refresh'); break
      case 'readOn': written(value === true ? span() : null); break
      case 'readOver': written(span()); break
      case 'clearWindow': written(null); break
      default: throw refusal(TIMELINE_REFUSE, key)
    }
  }
  if (camera) await run(frame, {command: 'timeline', action: 'camera', centre: camera.centre, zoom: camera.zoom})
  if (hidden) await run(frame, {command: 'timeline', action: 'categories', hidden})
}

/** The ruler's readings the frame does not hold (the relative zero's words, your own work's strata, the pane's own width). */
const UNHELD_READINGS = {relZero: missing('The relative zero', 'the session\'s disclosed zero in the frame\'s research announcement', 'the research frame'),
  frame: 'The ruler names no frame of its own: it reads the work open in the pane.',
  paneW: 'The pane\'s width is the shell\'s own room, not a reading of the ruler.',
  workDay: missing('Your work', 'a read of your days, runs and receipts on the ruler (the relation field draws them together)', 'the research frame'),
  workNow: missing('Your work', 'a read of your days, runs and receipts on the ruler', 'the research frame'),
  workSession: missing('Your work', 'a read of your days, runs and receipts on the ruler', 'the research frame'),
  workRun: missing('Your work', 'a read of your days, runs and receipts on the ruler', 'the research frame')} as const
const RULER_READINGS = ['events', 'edges', 'views', 'domFrom', 'domTo', 'dated', 'centre', 'zoom'] as const
/** The chronology's presentation keys, read only while it is drawn (its lens's capture). */
const PRESENTATION_READINGS = ['links', ...CARD_CATEGORIES.map(id => `cat_${id}`)] as const
export function timelineAbsent(frame: FrameReadings, key: string): string {
  if (key in UNHELD_READINGS) return UNHELD_READINGS[key as keyof typeof UNHELD_READINGS]
  if (['readOn', 'readFrom', 'readTo'].includes(key)) return frame.window === undefined ? NO_SESSION : 'The shared window is open at that edge.'
  if ((RULER_READINGS as readonly string[]).includes(key) && frame.state?.research && !frame.state.research.timeline) return unmounted(frame) ?? NOT_PRESENTED
  if (key === 'domFrom' || key === 'domTo') return 'No event of the ruler is dated, so it spans no years.'
  if ((PRESENTATION_READINGS as readonly string[]).includes(key) && frame.state?.research?.timeline) return 'The chronology is not drawn now (another projection stands): its relation links and card categories are read while it is.'
  return frameAbsent(frame, 'timeline', TIMELINE_REFUSE, key, ['light', 'lens'].includes(key) ? 'The frame has not reported its Timeline\'s lens.' : NOT_PRESENTED)
}

export function timelineBinding(frame: FrameReadings, law: WindowLaw, held: Readonly<Record<string, Value>> = {}): DesignBinding {
  const standing: Record<string, Standing> = disabled(TIMELINE_REFUSE)
  for (const [key, why] of Object.entries(UNHELD_READINGS)) standing[key] = {disabled: why}
  const why = unmounted(frame) ?? (frame.state?.lens !== 'timeline' ? `The frame stands in its ${frame.state?.lens ?? 'own'} lens: open the Timeline on the focused pane to choose its lens.` : null)
  if (why) for (const key of ['lens', 'refresh'] as const) standing[key] = {disabled: why}
  if (frame.window === undefined) for (const key of ['readOn', 'readOver', 'clearWindow'] as const) standing[key] = {disabled: NO_SESSION}
  const values = timelineValues(frame, law, held)
  for (const key of ['light', 'readFrom', 'readTo', ...RULER_READINGS, ...PRESENTATION_READINGS] as const) if (!(key in values) && !(key in standing)) standing[key] = {disabled: timelineAbsent(frame, key)}
  return {
    id: TIMELINE_ID,
    values,
    standing,
    ...(frame.run && !frame.state ? {waiting: ['light', 'lens']} : {}),
    local: handsFor(TIMELINE_ID, TIMELINE_LOCAL),
    writes: key => !(key in TIMELINE_REFUSE) && (TIMELINE_ACTS as readonly string[]).includes(key),
    write: changes => timelineWrite(frame, changes, law, held),
  }
}

// ---------------------------------------------------------------------------------------------------------------- the Canvas

export const CANVAS_ID = CANVAS_DESIGN
/** The frame's pointer flags (researchInstruments.tsx :885-892 Draw, Erase, Lasso), each the design's mode of the same name. */
const MODE_TOGGLES: readonly {mode: string; label: string}[] = [{mode: 'draw', label: 'Draw'}, {mode: 'erase', label: 'Erase'}, {mode: 'lasso', label: 'Lasso'}]
/** The frame's save glyph (researchInstruments.tsx `.research-save-glyph`, read through presentedChrome.ts as its words). */
const SAVE_STATE = /^(saved|saving|held)\b/i
const NO_BOARD_EDIT = missing('The board\'s edits', 'stage commands for adding, selecting and framing the board\'s cards, its own view, Find and Present (the frame\'s own tools stand in the Canvas plate)', 'the research frame')
const NO_DIRECTION = missing('A line\'s direction', 'the relation\'s direction is set when the line is promoted (the constellation relate act), which no stage command carries', 'the research frame')
const NO_STANDING = missing('A line\'s standing', 'the relation\'s standing in the frame\'s research announcement, and a command that sets it', 'the research frame')
const NO_FORM = missing('The form', 'kernel ops for aikit wiki-shape validate · declare · compress', 'AIKit')
const NOT_PRESENTED_BOARD = 'The frame presents no Canvas now: open the Canvas on the focused pane to read its board.'
export const CANVAS_REFUSE = {
  mine: NO_BOARD_EDIT, mineX: NO_BOARD_EDIT, mineY: NO_BOARD_EDIT, mineZ: NO_BOARD_EDIT, sel: NO_BOARD_EDIT,
  add: NO_BOARD_EDIT, addX: NO_BOARD_EDIT, addY: NO_BOARD_EDIT, added: NO_BOARD_EDIT, colourAdded: NO_BOARD_EDIT, shapeFill: NO_BOARD_EDIT, frame2: NO_BOARD_EDIT,
  direction: NO_DIRECTION, standing: NO_STANDING, find: NO_BOARD_EDIT, present: NO_BOARD_EDIT,
  promote: missing('Promote', 'a stage command for the frame\'s constellation relate act (researchInstruments.tsx RelateKnowledgeAction :162)', 'the research frame'),
  form: NO_FORM, whole: NO_FORM, roles: NO_FORM, layout: NO_FORM, role: NO_FORM, checkAsk: NO_FORM, declare: NO_FORM, fold: NO_FORM,
  suggest: missing('Suggest', 'the Decision helper\'s Suggest for a card\'s open role (ai-kit:decision-helper has no kernel route here)', 'AIKit'),
  suggested: missing('Suggest', 'the Decision helper\'s Suggest for a card\'s open role (ai-kit:decision-helper has no kernel route here)', 'AIKit'),
} as const
const CANVAS_ACTS = ['mode', 'grid', 'minimap', 'cx', 'cy', 'zoom', 'lineKind', 'fromSide', 'toSide'] as const
/** The view's own keys: which fit the View chooser stands on (Everything, the first frame): its camera moves through cx, cy and zoom. */
export const CANVAS_LOCAL = ['view'] as const
const LINE_KINDS: readonly string[] = ['straight', 'curved', 'elbow'], LINE_SIDES: readonly string[] = ['auto', 'top', 'right', 'bottom', 'left']
/** The frame's own overview toggle (canvasNavigationOverview.tsx :21 `.research-minimap-toggle`, its words "Hide overview" while shown and
 * "Show overview" while hidden; presentedChrome.ts :93 publishes it in canvas:look). */
const overviewOf = (chrome: FrameChromeReading | null | undefined) => at(chrome, 'canvas:look').find(candidate => candidate.label === 'Hide overview' || candidate.label === 'Show overview')

/** The Canvas's values: the board the frame presents (researchReading.ts canvasReadingOf: its cards, its lines with their connector records —
 * the selected line first, as the design reads it — its frames, its camera, its selection and its pointer flags), and its overview toggle
 * and save state (its own chrome). */
export function canvasValues(frame: FrameReadings): Values {
  const values: Record<string, Value> = {}
  const state = frame.state
  put(values, 'light', lightOf(state, 'canvas'))
  if (!state) return values
  const board = state.research?.canvas
  if (board) {
    values.items = JSON.stringify(board.items.map(item => ({id: item.id, kind: item.kind, x: item.x, y: item.y, w: item.w, h: item.h, name: item.name})))
    const chosen = board.lines.find(line => line.id === board.selectedLine)
    const ordered = chosen ? [chosen, ...board.lines.filter(line => line !== chosen)] : board.lines
    values.lines = JSON.stringify(ordered.map(line => [line.from, line.to]))
    values.frames = JSON.stringify(board.frames)
    if (board.camera) { values.cx = board.camera.cx; values.cy = board.camera.cy; values.zoom = board.camera.zoom }
    values.sel = board.selected.join(',')
    values.mode = board.drawing ? 'draw' : board.erasing ? 'erase' : board.lasso ? 'lasso' : 'select'
    values.grid = board.snap
    // The line the selection holds, as the frame draws it: its connector record, absent = the frame's own curved, auto-sided routing.
    const line = chosen ?? ordered[0]
    if (line) {
      values.lineKind = line.kind ?? 'curved'
      values.fromSide = line.fromSide ?? 'auto'
      values.toSide = line.toSide ?? 'auto'
      put(values, 'label', line.label)
      put(values, 'direction', line.direction)
    }
  }
  const chrome = state.lens === 'canvas' ? state.chrome : undefined
  const overview = overviewOf(chrome)
  if (overview) values.minimap = overview.pressed ?? overview.label === 'Hide overview'
  const save = (chrome?.controls ?? []).find(candidate => candidate.home.startsWith('canvas:') && candidate.kind === 'reading' && SAVE_STATE.test((candidate.value || candidate.label).trim()))
  put(values, 'save', save ? SAVE_STATE.exec((save.value || save.label).trim())![1]!.toLowerCase() : undefined)
  return values
}

export async function canvasWrite(frame: FrameReadings, changes: readonly ValueChange[]): Promise<void> {
  const chrome = frame.state?.lens === 'canvas' ? frame.state.chrome : undefined
  const board = frame.state?.research?.canvas
  let camera: {cx: number; cy: number; zoom: number} | undefined
  let connector: {lineKind?: string; fromSide?: string; toSide?: string} | undefined
  for (const {key, value} of changes) {
    if (key === 'lineKind' || key === 'fromSide' || key === 'toSide') {
      if (typeof value !== 'string' || !(key === 'lineKind' ? LINE_KINDS : LINE_SIDES).includes(value)) throw Error(key === 'lineKind' ? 'A line is straight, curved or elbow.' : 'A line binds to auto, top, right, bottom or left.')
      connector = {...connector, [key]: value}
      continue
    }
    if (key === 'cx' || key === 'cy' || key === 'zoom') {
      const base = camera ?? board?.camera
      if (!base) throw Error(board ? 'The Canvas has not reported its camera yet.' : unmounted(frame) ?? NOT_PRESENTED_BOARD)
      if (typeof value !== 'number' || !Number.isFinite(value)) throw Error('The camera moves by numbers.')
      camera = {...base, [key]: value}
      continue
    }
    if (key === 'grid') {
      if (board?.snap === (value === true)) continue
      await press(frame, control(chrome, 'canvas:tools', 'Snap'), 'Grid')
      continue
    }
    if (key === 'minimap') {
      const overview = overviewOf(chrome)
      if (overview && (overview.pressed ?? overview.label === 'Hide overview') === (value === true)) continue
      await press(frame, overview, 'Minimap')
      continue
    }
    if (key === 'mode') {
      if (value !== 'select' && !MODE_TOGGLES.some(flag => flag.mode === value)) throw Error(`The Canvas's modes are select, lasso, draw and erase, never ${String(value)}.`)
      // The frame's own law (researchInstruments.tsx :885-892): Draw and Erase each clear the other when pressed on; Lasso stands apart.
      // So the asked flag is pressed on, and every other flag still on is pressed off, Erase only where Draw is not being pressed on.
      const flag = (label: string) => control(chrome, 'canvas:tools', label)
      const draw = flag('Draw'), erase = flag('Erase'), lasso = flag('Lasso')
      const on = {draw: board?.drawing ?? draw?.pressed === true, erase: board?.erasing ?? erase?.pressed === true, lasso: board?.lasso ?? lasso?.pressed === true}
      if (value === 'draw' && !on.draw) await press(frame, draw, 'Mode Draw')
      if (value === 'erase' && !on.erase) await press(frame, erase, 'Mode Erase')
      if (value === 'lasso' && !on.lasso) await press(frame, lasso, 'Mode Lasso')
      if (value !== 'draw' && value !== 'erase' && on.draw) await press(frame, draw, 'Mode Draw')
      if (value !== 'draw' && value !== 'erase' && on.erase) await press(frame, erase, 'Mode Erase')
      if (value !== 'lasso' && on.lasso) await press(frame, lasso, 'Mode Lasso')
      continue
    }
    throw refusal(CANVAS_REFUSE, key)
  }
  if (camera) {
    if (camera.zoom < 5 || camera.zoom > 200) throw Error('The Canvas zooms from 5 % to 200 %.')
    await run(frame, {command: 'canvas', action: 'camera', cx: camera.cx, cy: camera.cy, zoom: camera.zoom})
  }
  if (connector) {
    // The line the design draws is the selected one, else the first (canvasValues): its connector record is the one written.
    const line = board?.lines.find(candidate => candidate.id === board.selectedLine) ?? board?.lines[0]
    if (!line) throw Error(board ? 'The board holds no line.' : unmounted(frame) ?? NOT_PRESENTED_BOARD)
    await run(frame, {command: 'canvas', action: 'connector', line: line.id, ...connector} as Parameters<StageRun>[0])
  }
}

/** The board's readings the frame does not hold, and the form's readings no route reads. */
const UNHELD_BOARD = {colour: missing('Sticky colour', 'the next sticky\'s colour in the frame\'s research announcement (the frame\'s own picker holds it)', 'the research frame'),
  waiting: missing('Waiting', 'a count of the lines that wait for their owner in the frame\'s research announcement', 'the research frame'),
  refusal: 'No line has been promoted and refused here.'} as const
const FORM_READINGS = ['check', 'checkWhy', 'declared'] as const
const BOARD_READINGS = ['items', 'lines', 'frames', 'cx', 'cy', 'zoom', 'sel', 'mode', 'grid', 'lineKind', 'fromSide', 'toSide', 'label', 'direction'] as const
export function canvasAbsent(frame: FrameReadings, key: string): string {
  if (key in UNHELD_BOARD) return UNHELD_BOARD[key as keyof typeof UNHELD_BOARD]
  if ((FORM_READINGS as readonly string[]).includes(key)) return NO_FORM
  const board = frame.state?.research?.canvas
  if (board && ['lineKind', 'fromSide', 'toSide', 'label', 'direction'].includes(key)) return board.lines.length ? 'The selected line names none.' : 'The board holds no line.'
  if (board && ['cx', 'cy', 'zoom'].includes(key)) return 'The Canvas has not reported its camera yet.'
  if ((BOARD_READINGS as readonly string[]).includes(key) && frame.state?.research && !board) return unmounted(frame) ?? NOT_PRESENTED_BOARD
  return frameAbsent(frame, 'canvas', CANVAS_REFUSE, key, 'The frame has not reported this reading of its board.')
}

export function canvasBinding(frame: FrameReadings, held: Readonly<Record<string, Value>> = {}): DesignBinding {
  const standing: Record<string, Standing> = disabled(CANVAS_REFUSE)
  for (const [key, why] of Object.entries(UNHELD_BOARD)) standing[key] = {disabled: why}
  for (const key of FORM_READINGS) standing[key] = {disabled: NO_FORM}
  const why = unmounted(frame) ?? (frame.state?.lens !== 'canvas' ? `The frame stands in its ${frame.state?.lens ?? 'own'} lens: open the Canvas on the focused pane to play it.` : null)
    ?? (frame.state?.research?.canvas ? null : NOT_PRESENTED_BOARD)
  if (why) for (const key of CANVAS_ACTS) standing[key] = {disabled: why}
  const values: Record<string, Value> = {...canvasValues(frame)}
  for (const key of CANVAS_LOCAL) if (held[key] !== undefined) values[key] = held[key]!
  for (const key of ['light', 'save', 'items', 'lines', 'frames', 'label', 'direction'] as const) if (!(key in values) && !(key in standing)) standing[key] = {disabled: canvasAbsent(frame, key)}
  return {
    id: CANVAS_ID,
    values,
    standing,
    local: handsFor(CANVAS_ID, CANVAS_LOCAL),
    ...(frame.run && !frame.state ? {waiting: ['light']} : {}),
    writes: key => key in CANVAS_REFUSE || (CANVAS_ACTS as readonly string[]).includes(key),
    write: changes => canvasWrite(frame, changes),
  }
}
