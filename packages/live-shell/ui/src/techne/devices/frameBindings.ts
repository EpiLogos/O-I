// The Journey (§17.6, techne:journey), the Timeline (§17.5, techne:timeline) and the Canvas (§17.4, techne:canvas) on their owner: the
// research frame (expressions-app field-studies-journeys: journeyInstrument.tsx, journeyPath.ts; researchInstruments.tsx m2Projection and
// the shared time window; the canvas state). The frame stands inside the hosted Expressions pane; the shell reaches it only through what
// it announces and the one runner it answers (projections/expressionsPaneHost.ts useHostedChrome):
//   - its state (desktop/cradle/src/expressions/hostedApp.ts HostedAppState: lens, document, sceneIndex, sceneCount, sceneName,
//     journeyPlaying, selection), which the instruments' wells already read (inhabitants/ql/devices/techneWells.tsx);
//   - its chrome (stageCommands.ts FrameChromeReading, presentedChrome.ts): its own controls by home, each with the frame's own words
//     and pressed state, and the `chrome` command that presses one (frameChrome.tsx useFrameChromeOver) — the frame's own act;
//   - the shared time window, which the session owns and the frame reads (desktop/cradle/src/techne/session.ts time_window), written
//     through the session's compare-and-set writer (projections/atlas/sharedClock.ts writeSharedWindow).
// The walk's stops, holds and seams, the ruler's events and relations, and the board's items, lines and frames stay inside the frame:
// it publishes none of them, so each stays absent and every control that would change them stands disabled naming the missing
// operation (PROPOSE: the frame's state announcement carries them). Nothing here is the design's sample.
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
const NO_WALK = missing('The walk\'s stops, holds and seams', 'a journey reading in the frame\'s state announcement (HostedAppState carries the stop it stands on, the count, that stop\'s name and whether it walks; journeyPath.ts walkJourney · edgeRows and model.ts Scene.duration · transition stay inside the frame)', 'the research frame')
export const JOURNEY_REFUSE = {
  at: missing('Stop', 'a stage command that stands the walk on a stop (stageCommands.ts STAGE_COMMANDS carries none)', 'the research frame'),
  playing: missing('Play', 'a stage command that walks or stops the stops (stageCommands.ts carries none; the frame\'s own Play stands in the Journey plate\'s Pace group)', 'the research frame'),
  entered: missing('Enter', 'a stage command that enters a stop\'s scene and returns (stageCommands.ts carries none)', 'the research frame'),
  local: NO_WALK, snap: NO_WALK, stopAtEnd: NO_WALK, take: NO_WALK,
} as const
const JOURNEY_EDGES = ['hold', 'tr', 'kind', 'curve', 'sw', 'dir', 'atc', 'words'] as const

/** The Journey's values: the stop the frame stands on, the count of its stops, that stop's name, whether it walks, and the walk's name
 * (the Expression's own). The count stands as the list of stops, each unnamed but the one it stands on. */
export function journeyValues(frame: FrameReadings): Values {
  const values: Record<string, Value> = {}
  const state = frame.state
  put(values, 'light', lightOf(state, 'journey'))
  if (!state) return values
  put(values, 'walk', state.document?.name)
  const count = state.sceneCount
  if (typeof count === 'number' && Number.isInteger(count) && count >= 0) {
    values.stops = JSON.stringify(Array.from({length: count}, () => null))
    if (typeof state.sceneIndex === 'number' && state.sceneIndex >= 0 && state.sceneIndex < count) {
      values.at = state.sceneIndex
      put(values, `name:${state.sceneIndex}`, state.sceneName?.trim() || undefined)
    }
  }
  if (typeof state.journeyPlaying === 'boolean') values.playing = state.journeyPlaying
  return values
}

/** Why a key of a frame instrument has no reading now: the frame not mounted or not reporting, then the instrument's own reason. */
function frameAbsent(frame: FrameReadings, lens: string, reasons: Readonly<Record<string, string>>, key: string, fallback: string): string {
  if (key in reasons) return reasons[key]!
  const why = unmounted(frame)
  if (why) return why
  if (frame.state?.lens && frame.state.lens !== lens) return `The frame stands in its ${frame.state.lens} lens: open this instrument on the focused pane to read it.`
  return fallback
}
export const journeyAbsent = (frame: FrameReadings, key: string): string =>
  frameAbsent(frame, 'journey', JOURNEY_REFUSE, key, ['light', 'walk', 'stops', 'at', 'playing'].includes(key) || key.startsWith('name:') ? 'The frame has not reported this part of its walk.' : NO_WALK)
const JOURNEY_READINGS = ['light', 'walk', 'stops', 'docLoops', 'takes'] as const

export function journeyBinding(frame: FrameReadings): DesignBinding {
  const count = frame.state?.sceneCount ?? 0
  const refuse: Record<string, string> = {...JOURNEY_REFUSE, ...indexed(JOURNEY_EDGES, count, NO_WALK)}
  const values = journeyValues(frame)
  const standing = disabled(refuse)
  for (const key of [...JOURNEY_READINGS, ...Array.from({length: Math.max(1, count)}, (_, i) => `name:${i}`)]) if (!(key in values) && !(key in standing)) standing[key] = {disabled: journeyAbsent(frame, key)}
  return {
    id: JOURNEY_ID,
    values,
    standing,
    ...(frame.run && !frame.state ? {waiting: true} : {}),
    writes: key => key in refuse || JOURNEY_EDGES.some(edge => key.startsWith(`${edge}:`)),
    write: async (changes: readonly ValueChange[]) => { for (const {key} of changes) throw Error(refuse[key] ?? (JOURNEY_EDGES.some(edge => key.startsWith(`${edge}:`)) ? NO_WALK : refusal(refuse, key).message)) },
  }
}

// ---------------------------------------------------------------------------------------------------------------- the Timeline

export const TIMELINE_ID = TIMELINE_DESIGN
/** The frame's three projections on its Timeline (researchInstruments.tsx :1355-1357 `m2Projection`: chronology, field, relative), as
 * its own tab words and the design's lens values. */
const LENS_TABS: readonly {lens: string; label: string}[] = [{lens: 'chronology', label: 'Chronology'}, {lens: 'relations', label: 'Relations'}, {lens: 'relative', label: 'Relative'}]
const NO_RULER = missing('The ruler\'s events, relations, epochs and saved views', 'a timeline reading in the frame\'s state announcement (researchInstruments.tsx m2Projection and its TimelineLens stay inside the frame)', 'the research frame')
export const TIMELINE_REFUSE = {
  mode: NO_RULER, links: NO_RULER, archetypes: NO_RULER, walk: NO_RULER, centre: NO_RULER, zoom: NO_RULER, view: NO_RULER, saveView: NO_RULER,
  showAll: NO_RULER, subTimeline: NO_RULER, earth: NO_RULER, selected: NO_RULER,
  st_sourced: NO_RULER, st_derived: NO_RULER, st_authored: NO_RULER, st_disputed: NO_RULER, st_mythic: NO_RULER, st_unavailable: NO_RULER,
  cat_source: NO_RULER, cat_myth: NO_RULER, cat_claim: NO_RULER,
} as const
const NO_SESSION = 'No shared session stands (no work is open in Technē), so there is no window to read over.'
export const TIMELINE_LOCAL = ['winFrom', 'winTo'] as const
const TIMELINE_ACTS = ['lens', 'refresh', 'readOn', 'readOver', 'clearWindow'] as const

/** The year an instant of the window stands at, and the instant of a whole year — the shared clock's own law (sharedClock.ts). */
export interface WindowLaw {
  readonly yearOf: (instant: string | null | undefined) => number | null
  readonly instantOf: (year: number) => string
  /** The session's compare-and-set write: the refusal in its words, or null once written. */
  readonly write: (window: {from: string | null; to: string | null} | null) => string | null
}

/** The Timeline's values: the lens the frame's tabs stand pressed on, the shared window (on, and its two edges) and the hand's window
 * before Read over, starting where the shared window stands. */
export function timelineValues(frame: FrameReadings, law: Pick<WindowLaw, 'yearOf'>, held: Readonly<Record<string, Value>> = {}): Values {
  const values: Record<string, Value> = {}
  put(values, 'light', lightOf(frame.state, 'timeline'))
  const chrome = frame.state?.lens === 'timeline' ? frame.state.chrome : undefined
  const tab = LENS_TABS.find(candidate => control(chrome, 'timeline:lens', candidate.label)?.pressed === true)
  put(values, 'lens', tab?.lens)
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
  for (const {key, value} of changes) {
    switch (key) {
      case 'lens': {
        const tab = LENS_TABS.find(candidate => candidate.lens === value)
        if (!tab) throw Error(`The Timeline's lenses are Chronology, Relations and Relative, never ${String(value)}.`)
        const target = control(chrome, 'timeline:lens', tab.label)
        if (target?.pressed) break
        await press(frame, target, `Lens ${tab.label}`)
        break
      }
      case 'refresh': await press(frame, control(chrome, 'timeline:lens', 'Refresh timeline'), 'Refresh'); break
      case 'readOn': written(value === true ? span() : null); break
      case 'readOver': written(span()); break
      case 'clearWindow': written(null); break
      default: throw refusal(TIMELINE_REFUSE, key)
    }
  }
}

/** The ruler's readings the frame does not publish. */
const RULER_READINGS = ['events', 'edges', 'views', 'domFrom', 'domTo', 'paneW', 'dated', 'relZero', 'frame', 'workDay', 'workNow', 'workSession', 'workRun'] as const
export function timelineAbsent(frame: FrameReadings, key: string): string {
  if (['readOn', 'readFrom', 'readTo'].includes(key)) return frame.window === undefined ? NO_SESSION : 'The shared window is open at that edge.'
  return frameAbsent(frame, 'timeline', TIMELINE_REFUSE, key, ['light', 'lens'].includes(key) ? 'The frame has not reported its Timeline\'s lens.' : NO_RULER)
}

export function timelineBinding(frame: FrameReadings, law: WindowLaw, held: Readonly<Record<string, Value>> = {}): DesignBinding {
  const standing: Record<string, Standing> = disabled(TIMELINE_REFUSE)
  for (const key of RULER_READINGS) standing[key] = {disabled: NO_RULER}
  const why = unmounted(frame) ?? (frame.state?.lens !== 'timeline' ? `The frame stands in its ${frame.state?.lens ?? 'own'} lens: open the Timeline on the focused pane to choose its lens.` : null)
  if (why) for (const key of ['lens', 'refresh'] as const) standing[key] = {disabled: why}
  if (frame.window === undefined) for (const key of ['readOn', 'readOver', 'clearWindow'] as const) standing[key] = {disabled: NO_SESSION}
  const values = timelineValues(frame, law, held)
  for (const key of ['light', 'readFrom', 'readTo'] as const) if (!(key in values) && !(key in standing)) standing[key] = {disabled: timelineAbsent(frame, key)}
  return {
    id: TIMELINE_ID,
    values,
    standing,
    ...(frame.run && !frame.state ? {waiting: ['light', 'lens']} : {}),
    local: handsFor(TIMELINE_ID, TIMELINE_LOCAL),
    writes: key => key in TIMELINE_REFUSE || (TIMELINE_ACTS as readonly string[]).includes(key),
    write: changes => timelineWrite(frame, changes, law, held),
  }
}

// ---------------------------------------------------------------------------------------------------------------- the Canvas

export const CANVAS_ID = CANVAS_DESIGN
/** The frame's pointer flags (researchInstruments.tsx :882-889 Draw, Erase, Lasso), each the design's mode of the same name. */
const MODE_TOGGLES: readonly {mode: string; label: string}[] = [{mode: 'draw', label: 'Draw'}, {mode: 'erase', label: 'Erase'}, {mode: 'lasso', label: 'Lasso'}]
/** The frame's save glyph (researchInstruments.tsx `.research-save-glyph`, read through presentedChrome.ts as its words). */
const SAVE_STATE = /^(saved|saving|held)\b/i
const NO_BOARD = missing('The board\'s items, lines and frames', 'a canvas reading in the frame\'s state announcement (researchInstruments.tsx keeps the board inside the frame; HostedAppState carries its selection only)', 'the research frame')
const NO_FORM = missing('The form', 'kernel ops for aikit wiki-shape validate · declare · compress', 'AIKit')
export const CANVAS_REFUSE = {
  zoom: missing('Zoom', 'a stage command that sets the board\'s zoom (the frame\'s own Zoom in, Zoom out and Fit keys step it)', 'the research frame'),
  cx: NO_BOARD, cy: NO_BOARD, view: NO_BOARD, mine: NO_BOARD, mineX: NO_BOARD, mineY: NO_BOARD, mineZ: NO_BOARD, sel: NO_BOARD,
  add: NO_BOARD, addX: NO_BOARD, addY: NO_BOARD, added: NO_BOARD, colourAdded: NO_BOARD, shapeFill: NO_BOARD, frame2: NO_BOARD,
  lineKind: NO_BOARD, fromSide: NO_BOARD, toSide: NO_BOARD, direction: NO_BOARD, standing: NO_BOARD, find: NO_BOARD, present: NO_BOARD,
  promote: missing('Promote', 'a stage command for the frame\'s constellation relate act (researchInstruments.tsx RelateKnowledgeAction :161)', 'the research frame'),
  form: NO_FORM, whole: NO_FORM, roles: NO_FORM, layout: NO_FORM, role: NO_FORM, checkAsk: NO_FORM, declare: NO_FORM, fold: NO_FORM,
  suggest: missing('Suggest', 'the Decision helper\'s Suggest for a card\'s open role (ai-kit:decision-helper has no kernel route here)', 'AIKit'),
  suggested: missing('Suggest', 'the Decision helper\'s Suggest for a card\'s open role (ai-kit:decision-helper has no kernel route here)', 'AIKit'),
} as const
const CANVAS_ACTS = ['mode', 'grid', 'minimap'] as const

/** The Canvas's values: the frame's pointer mode and grid snap (its own toggles), its zoom and save state (its own readings), and its
 * selection's ids (HostedAppState.selection). The board is not published. */
export function canvasValues(frame: FrameReadings): Values {
  const values: Record<string, Value> = {}
  const state = frame.state
  put(values, 'light', lightOf(state, 'canvas'))
  if (!state) return values
  const chrome = state.lens === 'canvas' ? state.chrome : undefined
  const flags = MODE_TOGGLES.map(flag => ({...flag, control: control(chrome, 'canvas:tools', flag.label)}))
  if (flags.every(flag => flag.control)) values.mode = flags.find(flag => flag.control!.pressed)?.mode ?? 'select'
  const snap = control(chrome, 'canvas:tools', 'Snap')
  if (snap?.pressed !== undefined) values.grid = snap.pressed
  const overview = overviewOf(chrome)
  if (overview) values.minimap = overview.pressed ?? overview.label === 'Hide overview'
  const zoom = at(chrome, 'canvas:look').find(candidate => candidate.kind === 'reading' && /%$/.test(candidate.label.trim()))
  const percent = zoom ? Number.parseFloat(zoom.label) : NaN
  put(values, 'zoom', Number.isFinite(percent) && percent > 0 ? percent : undefined)
  const save = (chrome?.controls ?? []).find(candidate => candidate.home.startsWith('canvas:') && candidate.kind === 'reading' && SAVE_STATE.test((candidate.value || candidate.label).trim()))
  put(values, 'save', save ? SAVE_STATE.exec((save.value || save.label).trim())![1]!.toLowerCase() : undefined)
  return values
}

export async function canvasWrite(frame: FrameReadings, changes: readonly ValueChange[]): Promise<void> {
  const chrome = frame.state?.lens === 'canvas' ? frame.state.chrome : undefined
  for (const {key, value} of changes) {
    if (key === 'grid') {
      const snap = control(chrome, 'canvas:tools', 'Snap')
      if (snap?.pressed !== (value === true)) await press(frame, snap, 'Grid')
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
      // The frame's own law (researchInstruments.tsx :882-889): Draw and Erase each clear the other when pressed on; Lasso stands apart.
      // So the asked flag is pressed on, and every other flag still on is pressed off, Erase only where Draw is not being pressed on.
      const flag = (label: string) => control(chrome, 'canvas:tools', label)
      const draw = flag('Draw'), erase = flag('Erase'), lasso = flag('Lasso')
      if (value === 'draw' && !draw?.pressed) await press(frame, draw, 'Mode Draw')
      if (value === 'erase' && !erase?.pressed) await press(frame, erase, 'Mode Erase')
      if (value === 'lasso' && !lasso?.pressed) await press(frame, lasso, 'Mode Lasso')
      if (value !== 'draw' && value !== 'erase' && draw?.pressed) await press(frame, draw, 'Mode Draw')
      if (value !== 'draw' && value !== 'erase' && erase?.pressed) await press(frame, erase, 'Mode Erase')
      if (value !== 'lasso' && lasso?.pressed) await press(frame, lasso, 'Mode Lasso')
      continue
    }
    throw refusal(CANVAS_REFUSE, key)
  }
}

/** The board's readings the frame does not publish, and the form's readings no route reads. */
const BOARD_READINGS = ['items', 'lines', 'frames', 'colour', 'label', 'waiting', 'refusal'] as const
/** The frame's own overview toggle (canvasNavigationOverview.tsx :21 `.research-minimap-toggle`, its words "Hide overview" while shown and
 * "Show overview" while hidden; presentedChrome.ts :93 publishes it in canvas:look). */
const overviewOf = (chrome: FrameChromeReading | null | undefined) => at(chrome, 'canvas:look').find(candidate => candidate.label === 'Hide overview' || candidate.label === 'Show overview')
const FORM_READINGS = ['check', 'checkWhy', 'declared'] as const
export function canvasAbsent(frame: FrameReadings, key: string): string {
  if ((BOARD_READINGS as readonly string[]).includes(key)) return NO_BOARD
  if ((FORM_READINGS as readonly string[]).includes(key)) return NO_FORM
  return frameAbsent(frame, 'canvas', CANVAS_REFUSE, key, 'The frame has not reported this reading of its board.')
}

export function canvasBinding(frame: FrameReadings): DesignBinding {
  const standing: Record<string, Standing> = disabled(CANVAS_REFUSE)
  for (const key of BOARD_READINGS) standing[key] = {disabled: NO_BOARD}
  for (const key of FORM_READINGS) standing[key] = {disabled: NO_FORM}
  const why = unmounted(frame) ?? (frame.state?.lens !== 'canvas' ? `The frame stands in its ${frame.state?.lens ?? 'own'} lens: open the Canvas on the focused pane to play it.` : null)
  if (why) for (const key of CANVAS_ACTS) standing[key] = {disabled: why}
  const values = canvasValues(frame)
  for (const key of ['light', 'save'] as const) if (!(key in values) && !(key in standing)) standing[key] = {disabled: canvasAbsent(frame, key)}
  return {
    id: CANVAS_ID,
    values,
    standing,
    ...(frame.run && !frame.state ? {waiting: ['light']} : {}),
    writes: key => key in CANVAS_REFUSE || (CANVAS_ACTS as readonly string[]).includes(key),
    write: changes => canvasWrite(frame, changes),
  }
}
