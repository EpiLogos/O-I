// Arrangement ruler (manual §16.6): the shell's own Arrangement view as an instrument that opens in a pane. Live's nearest: Live's
// Arrangement view with its overview strip, its loop brace and its locators — here the tracks are the mode's, the clips are its
// material, and the ruler is the mode's own (seconds of a run, the years of deep time).
// The picture is the ruler itself, drawn by the ruler's own law (frame/tracks/ArrangementRuler.tsx): time across, tracks down; a clip
// stands at its place on the ruler; a running clip reaches its needle and a waiting one has no length; a needle that stops is a stall,
// drawn in the stall colour with its age; the window, its marks, the snap and the insert marker are the pane's own presentation
// (frame/tracks/rulerWindow.ts, imported here as it is, not copied). Standing marks follow trackMarks.ts; sections follow trackSections.ts.
// The fixtures are the owner's own material: Factory's run viewer (desktop/cradle/docs/world-shell/agent-shell-mockup.html, the
// arrangement block and its LAST/RUNS/LANES tables, on the adapter's palette) and Technē's nine Adam occurrences on the atlas's
// non-linear scale (projections/atlas/src/data/time.ts createTimeScale), as the Technē adapter lays them.
// In Technē the ruler is the timeline (manual §17.1, "Arrangement view: the timeline"): Time axis measures the history you study or
// the time of your sessions, and Read by relates the events — Chronology by date, Cause as chains whose hops light in order with
// their time offsets, Recurrence with each return marked, Concurrency where dates overlap. The relations are the reading's own
// (techne__timeline.tsx `edges`, from the same field.json), drawn in the line of their standing; placement draws none.
// Bound (parity D-26), the ruler draws the set its keys carry instead of the fixtures: `tracks` (JSON [{id, name, short, c, needle?,
// stalled?}]), `clips` (JSON [{id, track, label, at, end?, status?, standing?, takes?}]), `sections` (JSON [{id, name, from, to}]), `end`,
// `now`, `unit`, `word` and the ruler's own words — `labels` (JSON {at: words}, each point the views label) and `spans` (JSON {span: words}),
// as the set's ruler says them (its label and duration), since a ruler's words are its owner's and never made up here.
// The Full IS the Arrangement (parity D-26; Lead, 13 Nov: the catalogue design is the view and the wiring goes into it): the ruler's law
// moved here from frame/tracks/ArrangementRuler.tsx — scrubbing, the wheel and keyboard window, the marker and the time selection, the cuts,
// the take comps, the lanes and their drawing, the rails, the mixer row, the menus and the loop brace's handles — and the Session ·
// Arrangement pane draws this Full on its live set (frame/tracks/tracksDoor.ts TracksMaterial), the gallery on the set its keys carry
// (rulerSetOfKeys). Its window, snap, marker, lanes and cut modes are the device's holds (useRulerView), so every view of the device and the
// pane's ruler move one state.
import {useContext, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode,
  type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type RefObject} from 'react'
import {Band, Dial, Display, Folded, Handle, Panel, Radio, Readout, Rows, Section, Tile, Toggle, ValueBox, type LightState, type Option, type RowItem} from '../../sdk/panel'
import {clampTo, num, on, str, type DesignedDevice, type Values, type ViewProps} from './design'
import {
  bandIn, clampRange, fitRange, isFit, markStep, nextSnap, panBy, percentOf, rangeBounds, snapAt, snapOfPress, wheelZoomFactor, windowMarks,
  windowOfKey, zoomAround, braceEdgeAt, SNAP_MODES, type BraceDrag, type RangeBounds, type SnapMode, type TimeRange,
} from '../../../frame/tracks/rulerWindow'
import type {TrackLaneKind, WorldEventLane, WorldTakeLane, WorldTrackClip, WorldTrackSet} from '../../../timeline/worldTrackAdapter'
import {answerOf, heldLaunchReceipt, pressedIn, MixerLevels, MixerRow, STATUS_WORD, stalledLanes, TrackDeviceButton, trackColour, trackInk, trackTree, type PressedReceipt, type TracksSelection} from '../../../frame/tracks/SessionGrid'
import {chooseTrack, usePartChoice} from '../../../frame/tracks/partChoice'
import {trackHeadDevice, useTrackHeadDevices} from '../../../frame/tracks/trackHeads'
import {automationPoints, compRange, DEFAULT_LANES, drawnLane, LANE_WORD, laneCount, lanesUnder, mainLast, mixerCells, type LanesShown} from '../../../frame/tracks/trackLanes'
import {CutIcon} from '../../../agent/agentIcons'
import {clipAccessibleName, clipStandingAttributes, clipStandingEdge, clipStandingMark, clipStandingTag, clipStandingTitle} from '../../../frame/tracks/trackMarks'
import {narrowestSectionOf, sectionLanes} from '../../../frame/tracks/trackSections'
import {railKindText, railSegments, railStopTitle, walkRails, type WalkRail} from '../../../frame/tracks/trackRails'
import {occasionLight} from '../../../frame/tracks/worldCutTracks'
import {useTracksMenu} from '../../../frame/menu/TracksMenu'
import {missingAct, ownerStepped, undoable} from '../../../frame/menu/objectActions'
import {recordStep, subscribeUndo} from '../../../frame/menu/undo'
import {
  carriesEdgeCuts, carriesMove, cutOf, cutPress, cutTargets, modeOf, MOVE_MODES, nextMode, partOf, placeClips, SNAP_PX, snapCut, TRIM_MODES,
  type ClipDrag, type CutPreview, type MoveMode, type TrimMode,
} from '../../../frame/tracks/clipCuts'
import {publishShownMarker, publishShownSpan, TracksMaterial} from '../../../frame/tracks/tracksDoor'
import {RULER_ID} from '../../../frame/tracks/rulerBinding'
import {hold, useHeld} from '../../../techne/devices/designDevices'
import {
  contentMarks, fitHeadColumn, HEADS, LoopBrace, LoopBraceEnds, loopOf, plainDuration, SIDE_WORD, STILL_LANES,
  type ArrangementRulerViewProps, type LaneDraw, type RulerGesture, type RulerWindowProps, type TakeSelection,
} from '../../../frame/tracks/ArrangementRuler'
import '../../../frame/tracks/tracks.css'
import {createTimeScale, formatYear} from '../../../projections/atlas/src/data/time'
import './dlw__arrangement-ruler.css'

type SetFn = ViewProps['set']
type Standing = 'sourced' | 'authored' | 'derived' | 'disputed' | 'mythic' | 'unavailable'
type Status = 'waiting' | 'running' | 'stopped' | 'stalled'

interface Track {readonly id: string; readonly name: string; readonly short: string; readonly c: string; readonly needle?: number; readonly stalled?: boolean}
interface Clip {
  readonly id: string; readonly track: string; readonly label: string; readonly at: number; readonly end?: number; readonly status?: Status; readonly standing?: Standing; readonly takes?: number
  /** The time in the axis's own count (a year, a minute of the covered days), and the date in the source's words. */
  readonly t?: number; readonly when?: string
  /** The extent the date allows, on the ruler: what Concurrency reads. */
  readonly lo?: number; readonly hi?: number
  /** Known only to a stretch (a day): drawn as a band that wide, never given a made-up instant (§17.1, "A low-precision date draws as a band"). */
  readonly band?: boolean
}
/** A relation the reading discloses between two events, at its standing (techne__timeline.tsx `edges`). */
interface Edge {readonly id: string; readonly from: string; readonly to: string; readonly kind: 'cause' | 'echo'; readonly standing: Standing}
interface Sect {readonly id: string; readonly name: string; readonly from: number; readonly to: number}
/** The lanes under one track: the events inside its tasks, and the recorded moves of one parameter. */
interface Lanes {readonly track: string; readonly events: readonly (readonly [string, number])[]; readonly auto: {readonly name: string; readonly points: readonly (readonly [number, number])[]}}
interface Data {
  readonly mode: 'factory' | 'techne'; readonly word: string; readonly unit: string; readonly scale: string
  readonly end: number; readonly now?: number
  readonly label: (at: number, short?: boolean) => string
  readonly span: (span: number) => string
  readonly tracks: readonly Track[]; readonly clips: readonly Clip[]; readonly sections: readonly Sect[]; readonly lanes?: Lanes
  /** What the sections along the top are: eras in deep time, the covered days of your sessions. */
  readonly sectionWord: string
  readonly edges: readonly Edge[]
  /** The time between two events, in the axis's words. A hop with no date says so. */
  readonly gap: (a: Clip, b: Clip) => string
}

// ---------------------------------------------------------------- Factory: the run viewer

/** The mockup's minutes past 14:00 as seconds on the one shared axis, an hour ending now (factoryTrackAdapter.ts: the axis, `secs`). */
const sec = (t: number) => Math.round((t + 23.8) * 60)
const NOW = 3600, AXIS0 = 13 * 3600 + 36 * 60 + 12
const pad = (x: number) => String(x).padStart(2, '0')
const clockAt = (at: number, short?: boolean) => {
  const s = (((AXIS0 + Math.round(at)) % 86400) + 86400) % 86400
  return short ? `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}` : `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`
}
const mmss = (span: number) => `${Math.floor(span / 60)}m ${pad(Math.floor(span % 60))}s`
/** The adapter's palette, by position: the group "Port bridge-2" takes the first, so the lead takes the second (factoryTrackAdapter.ts FACTORY_TRACK_PALETTE). */
const PAL = ['#79b6ce', '#779dcc', '#9885bc', '#8baf9c', '#b096b2', '#6caaa9'] as const

const FACTORY: Data = {
  mode: 'factory', word: 'Factory', unit: 'seconds', scale: 'even', end: NOW, now: NOW,
  label: clockAt, span: mmss, sectionWord: 'Sections', edges: [], gap: (a, b) => mmss(Math.abs(b.at - a.at)),
  tracks: [
    {id: 'lead', name: 'Fizz · lead', short: 'Fizz', c: PAL[1], needle: NOW},
    {id: 'explore', name: 'explore', short: 'Explore', c: PAL[2], needle: sec(32.7)},
    {id: 'test', name: 'test', short: 'Test', c: PAL[3], needle: NOW},
    {id: 'fixture', name: 'fixture-gen', short: 'Fixture', c: PAL[4], needle: sec(34.62), stalled: true},
    {id: 'honey', name: 'Capture pass', short: 'Capture', c: PAL[5]},
    {id: 'bumble', name: 'Review #482', short: 'Review', c: PAL[0]},
  ],
  // RUNS and QUEUE of the mockup. A running task reaches its track's needle; a queued one stands at the live edge with no length.
  clips: [
    {id: 'replan', track: 'lead', label: 're-plan port', at: sec(28.2), end: sec(30.4), status: 'stopped'},
    {id: 'map', track: 'lead', label: 'map field → plan', at: sec(31.97), end: NOW, status: 'running', takes: 2},
    {id: 'drop', track: 'lead', label: 'drop old captures', at: NOW, status: 'waiting'},
    {id: 'survey', track: 'explore', label: 'survey widget tree', at: sec(32.15), end: sec(32.7), status: 'stopped'},
    {id: 'tests', track: 'test', label: 'widget tests --all', at: sec(33.1), end: NOW, status: 'running'},
    {id: 'gen', track: 'fixture', label: 'generate fixtures', at: sec(33.9), end: sec(34.62), status: 'stalled'},
    {id: 'physics', track: 'honey', label: 'tune physics', at: sec(28.4), end: sec(29.6), status: 'stopped'},
    {id: 'capture', track: 'honey', label: 'capture pass', at: NOW, status: 'waiting'},
    {id: 'review', track: 'bumble', label: 'review #482', at: sec(29.0), end: sec(31.0), status: 'stopped'},
    {id: 'plan', track: 'bumble', label: 'review port plan', at: NOW, status: 'waiting'},
  ],
  sections: [],
  // LANES.lead of the mockup (Messages, Files, Terminal, Web, Graph), as one lane of events. The recorded lane is a fixture reading:
  // the lead's budget fader (the mockup's "Activity · budget" fader) moved twice while the task ran.
  lanes: {
    track: 'lead',
    events: [['Messages', sec(32.6)], ['Messages', sec(32.86)], ['Messages', sec(33.12)], ['Files', sec(32.02)], ['Files', sec(32.87)], ['Terminal', sec(33.03)], ['Web', sec(32.5)], ['Graph', sec(32.07)]],
    auto: {name: 'Budget', points: [[sec(31.97), 0.5], [sec(33.1), 0.8], [sec(35.4), 0.35]]},
  },
}

// ---------------------------------------------------------------- Technē: the Adam occurrences

const UNITS = 10_000
/** The adapter's scale for a reading with deep time only: lowest year -1000, today 2026 (techneTrackAdapter.ts TECHNE_RULER_UNITS). */
const TS = createTimeScale(-1000, 2026)
const yearAt = (year: number) => TS.toU(year) * UNITS
/** The nine occurrences (techne__timeline.tsx, from Archetypal Earth's field.json), each with the extent its date allows and the date
 * in the source's words. A clip stands at the middle of its extent. */
const OCCURRENCES: readonly {id: string; name: string; from: number; to: number; when: string; standing: Standing}[] = [
  {id: 'naassene', name: 'Naassene psalm', from: 222, to: 235, when: '~222-235', standing: 'sourced'},
  {id: 'talmud', name: 'Talmudic legend', from: 401, to: 600, when: '~5th-6th c.', standing: 'mythic'},
  {id: 'cave', name: 'Cave of Treasures', from: 501, to: 700, when: '~6th-7th c. (inferred)', standing: 'derived'},
  {id: 'pirke', name: 'Pirke de-R. Eliezer', from: 701, to: 800, when: '~8th c.', standing: 'sourced'},
  {id: 'islamic', name: 'Islamic legend', from: 801, to: 900, when: '~9th c.? (inferred)', standing: 'derived'},
  {id: 'rosinus', name: 'Rosinus', from: 1201, to: 1300, when: '~13th c.', standing: 'sourced'},
  {id: 'valentinus', name: 'Valentinus', from: 1595, to: 1625, when: '~1600 (publ. 1595-1625)', standing: 'sourced'},
  {id: 'kadmon', name: 'Kabbala denudata', from: 1677, to: 1684, when: '1677-84', standing: 'sourced'},
  {id: 'maiaurli', name: 'Maiaurli', from: 1932, to: 1932, when: 'reported 1932', standing: 'mythic'},
]
/** The reading's relations (techne__timeline.tsx `edges`): echo joins occurrences that share a family or a culture; one cause. */
const RELATIONS: readonly Edge[] = [
  {id: 'e1', from: 'cave', to: 'islamic', kind: 'echo', standing: 'derived'},
  {id: 'e2', from: 'islamic', to: 'kadmon', kind: 'echo', standing: 'derived'},
  {id: 'e3', from: 'pirke', to: 'kadmon', kind: 'echo', standing: 'sourced'},
  {id: 'e4', from: 'talmud', to: 'maiaurli', kind: 'echo', standing: 'mythic'},
  {id: 'e5', from: 'rosinus', to: 'valentinus', kind: 'cause', standing: 'derived'},
]
/** A date the source gives as a stretch: its offsets are said "about". */
const loose = (c: Clip) => c.lo !== undefined && c.hi !== undefined && c.hi > c.lo
/** The six streams, in the adapter's order and with its mode tokens (techneTrackAdapter.ts STREAMS). A stream no owner read fills stands empty. */
const STREAMS: readonly Track[] = [
  {id: 'readings', name: 'Readings', short: 'Readings', c: 'var(--mode-narration, var(--sel))'},
  {id: 'occurrences', name: 'Occurrences', short: 'Occurr.', c: 'var(--mode-artefact, var(--green))'},
  {id: 'journeys', name: 'Journeys', short: 'Journeys', c: 'var(--mode-place, var(--accent))'},
  {id: 'runs', name: 'Runs', short: 'Runs', c: 'var(--mode-flows, var(--dp-value))'},
  {id: 'revisions', name: 'Revisions', short: 'Revisions', c: 'var(--mode-day, var(--stall))'},
  {id: 'sky', name: 'Sky', short: 'Sky', c: 'var(--mode-occasion, var(--text-dim))'},
]

const TECHNE: Data = {
  mode: 'techne', word: 'Technē', unit: 'years', scale: 'stretched', end: UNITS,
  label: at => formatYear(TS.fromU(at / UNITS)),
  span: span => `${Math.round(span / UNITS * 100)} %`,
  tracks: STREAMS,
  clips: OCCURRENCES.map(o => {
    const year = Math.floor((o.from + o.to) / 2)
    return {id: o.id, track: 'occurrences', label: o.name, at: yearAt(year), standing: o.standing, t: year, when: o.when, lo: yearAt(o.from), hi: yearAt(o.to)}
  }),
  sections: TS.eras.map(e => ({id: e.name, name: e.name, from: yearAt(e.from), to: yearAt(e.to)})),
  sectionWord: 'Eras', edges: RELATIONS,
  gap: (a, b) => (a.t === undefined || b.t === undefined ? 'no date' : `${loose(a) || loose(b) ? '~' : ''}${Math.abs(b.t - a.t).toLocaleString('en')} years`),
}

// ---------------------------------------------------------------- Technē: your sessions

/** Your sessions: the run receipts as the run adapter lays them, each covered day an equal stretch, hours in UTC
 * (timeline/techneTrackAdapter.ts, the ruler's civil days; the receipts are the FIXTURE rows of tests/techne-tracks.test.mjs). A run
 * dated by its day and no instant stands as a band the day wide. */
const DAYS = ['10-12', '10-13', '10-14'] as const
const DAY_W = UNITS / DAYS.length
const dayAt = (day: number, minute = 0) => (day + minute / 1440) * DAY_W
const hm = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`
const sessionAt = (at: number, short?: boolean) => {
  const i = clampTo(0, DAYS.length - 1, Math.floor(at / DAY_W)), m = clampTo(0, 1439, Math.round((at - i * DAY_W) / DAY_W * 1440))
  return short ? (m === 0 ? DAYS[i]! : hm(m)) : `${DAYS[i]} ${hm(m)}`
}
const receipt = (id: string, label: string, day: number, minute: number): Clip =>
  ({id, track: 'runs', label, at: dayAt(day, minute), t: day * 1440 + minute, when: `${DAYS[day]} ${hm(minute)}`, lo: dayAt(day, minute), hi: dayAt(day, minute)})

const SESSIONS: Data = {
  mode: 'techne', word: 'Technē', unit: 'hours', scale: 'even', end: UNITS,
  label: sessionAt,
  span: span => { const h = span / DAY_W * 24; return h >= 48 ? `${Math.round(h / 24)} days` : h >= 1 ? `${Math.round(h)} h` : `${Math.round(h * 60)} min` },
  tracks: STREAMS,
  clips: [
    {id: 'run215', track: 'runs', label: 'dated by its day, no instant', at: dayAt(0), end: dayAt(1), band: true, when: `${DAYS[0]}, no instant`, lo: dayAt(0), hi: dayAt(1)},
    receipt('alpha1', 'attempt 1 failed', 1, 9 * 60 + 5),
    receipt('alpha2', 'attempt 2 correlating', 2, 8 * 60 + 30),
    receipt('run214', 'receipt', 2, 13 * 60 + 40),
  ],
  sections: DAYS.map((day, i) => ({id: day, name: day, from: i * DAY_W, to: (i + 1) * DAY_W})),
  sectionWord: 'Days', edges: [],
  gap: (a, b) => (a.t === undefined || b.t === undefined ? 'no time' : `${Math.round(Math.abs(b.t - a.t) / 60)} h`),
}

// ---------------------------------------------------------------- a bound set: the ruler its keys carry

const keyed = <T,>(raw: unknown, empty: T): T => {
  if (typeof raw !== 'string') return empty
  try { const out: unknown = JSON.parse(raw); return out !== null && typeof out === 'object' ? out as T : empty } catch { return empty }
}
/** The words a table gives a point: its own entry, else the nearest the table holds; none, the number itself. */
const wordsAt = (table: Readonly<Record<string, string>>, at: number, unit: string) => {
  const own = table[String(at)]
  if (own !== undefined) return own
  let best: string | undefined, gap = Infinity
  for (const [key, words] of Object.entries(table)) { const d = Math.abs(Number(key) - at); if (d < gap) { gap = d; best = words } }
  return best ?? `${Math.round(at * 10) / 10} ${unit}`
}
const bound = new Map<string, Data>()
function setData(v: Values): Data {
  const memo = ['tracks', 'clips', 'sections', 'end', 'now', 'unit', 'word', 'labels', 'spans', 'mode'].map(key => String(v[key])).join('\u0000')
  const known = bound.get(memo)
  if (known) return known
  const unit = typeof v.unit === 'string' ? v.unit : 'rows', labels = keyed<Record<string, string>>(v.labels, {}), spans = keyed<Record<string, string>>(v.spans, {})
  const end = Number.isFinite(num(v, 'end')) && num(v, 'end') > 0 ? num(v, 'end') : 1
  const tracks = keyed<Track[]>(v.tracks, []), clips = keyed<Clip[]>(v.clips, []), sections = keyed<Sect[]>(v.sections, [])
  const span = (x: number) => wordsAt(spans, x, unit)
  const d: Data = {mode: str(v, 'mode') === 'techne' ? 'techne' : 'factory', word: typeof v.word === 'string' ? v.word : '', unit, scale: 'even', end,
    ...(typeof v.now === 'number' && Number.isFinite(v.now) ? {now: v.now} : {}),
    label: at => wordsAt(labels, at, unit), span, sectionWord: 'Sections', edges: [], gap: (a, b) => span(Math.abs(b.at - a.at)),
    tracks: Array.isArray(tracks) ? tracks : [], clips: Array.isArray(clips) ? clips : [], sections: Array.isArray(sections) ? sections : []}
  if (bound.size > 32) bound.clear()
  bound.set(memo, d)
  return d
}

/** Technē's Time axis chooses the ruler: the history you study, or the time of your sessions (§17.1 Settings). A bound set's keys stand
 * over the fixtures. */
const dataOf = (v: Values): Data => (typeof v.tracks === 'string' ? setData(v) : str(v, 'mode') !== 'techne' ? FACTORY : str(v, 'axis') === 'sessions' ? SESSIONS : TECHNE)

// ---------------------------------------------------------------- standing, as trackMarks.ts draws it

/** The authority's six classes with the edge each is drawn in (trackMarks.ts STANDING_CUT; tracks.css --standing-*). They are not ranked. */
const STANDINGS: readonly {id: Standing; label: string; dash?: string; line: string; css: string}[] = [
  {id: 'sourced', label: 'Sourced', line: 'var(--text)', css: 'solid'},
  {id: 'authored', label: 'Authored', dash: '4 2', line: 'var(--sel)', css: 'dashed'},
  {id: 'derived', label: 'Derived', dash: '1.5 2', line: 'var(--text)', css: 'dotted'},
  {id: 'disputed', label: 'Disputed', dash: '3 2', line: 'var(--rec)', css: 'dashed'},
  {id: 'mythic', label: 'Mythic', dash: '1 3', line: 'var(--accent)', css: 'dotted'},
  {id: 'unavailable', label: 'Unknown', dash: '3 3', line: 'var(--text-dim)', css: 'dashed'},
]
const standingOf = (s: Standing) => STANDINGS.find(x => x.id === s)!

// ---------------------------------------------------------------- the view: the window the pane shows

const shownTrack = (v: Values, t: Track) => v[`show:${t.id}`] !== false
const shownStanding = (v: Values, c: Clip) => !c.standing || v[`st:${c.standing}`] !== false

interface View {readonly d: Data; readonly b: RangeBounds; readonly range: TimeRange; readonly snap: SnapMode; readonly tracks: readonly Track[]; readonly clips: readonly Clip[]}
function viewOf(v: Values): View {
  const d = dataOf(v), b = rangeBounds(d.end)
  const start = num(v, 'start')
  const range = clampRange({start, end: start + num(v, 'span')}, b)
  const tracks = d.tracks.filter(t => shownTrack(v, t))
  const clips = d.clips.filter(c => tracks.some(t => t.id === c.track) && shownStanding(v, c))
  return {d, b, range, snap: str(v, 'snap') as SnapMode, tracks, clips}
}
const isFitView = (view: View) => view.range.start <= 0 && view.range.end >= view.d.end
/** Keyboard and button zoom hold the marker still when it is in view, else the window's middle (ArrangementRuler.tsx anchor). */
const anchorOf = (v: Values, view: View) => {
  const m = num(v, 'marker')
  return m >= view.range.start && m <= view.range.end ? m : (view.range.start + view.range.end) / 2
}
/** The window after a zoom to `span`: the owner's zoomAround, about the anchor. */
const zoomTo = (v: Values, view: View, span: number): TimeRange => {
  const now = view.range.end - view.range.start
  return zoomAround(view.range, anchorOf(v, view), now / Math.max(span, view.b.minSpan), view.b)
}
const putWindow = (set: SetFn, r: TimeRange) => { set('start', r.start); set('span', r.end - r.start) }
const snapIn = (view: View) => (x: number) => snapAt(x, view.snap, markStep(view.range, view.b, 320), view.b)
const stalledOf = (view: View) => view.tracks.filter(t => t.stalled)
/** The recorded lane as steps: each value holds until the next move (an automation lane plays its last move until the next). */
const stepPath = (points: readonly (readonly [number, number])[], x: (at: number) => number, y: (val: number) => number) =>
  points.map(([at, val], i) => (i ? `L${x(at).toFixed(1)} ${y(points[i - 1]![1]).toFixed(1)}L${x(at).toFixed(1)} ${y(val).toFixed(1)}` : `M${x(at).toFixed(1)} ${y(val).toFixed(1)}`)).join('')
const laneLevel = (v: Values) => (on(v, 'laneTakes') ? 1 : 0) + (on(v, 'laneAuto') ? 1 : 0) + (on(v, 'laneEvents') ? 1 : 0)
const light = (v: Values) => str(v, 'light') as LightState

// ---------------------------------------------------------------- Read by: how the events relate (§17.1, "Four ways to read")

type ReadBy = 'chronology' | 'cause' | 'recurrence' | 'concurrency'
const READ_BYS: readonly Option<ReadBy>[] = [
  {value: 'chronology', label: 'Chronology', does: 'The events by date, with every relation the reading discloses.'},
  {value: 'cause', label: 'Cause', does: 'Chains of cause and influence. Select an event and its chain lights, each hop with its time offset.'},
  {value: 'recurrence', label: 'Recurrence', does: 'What keeps returning, with each return marked.'},
  {value: 'concurrency', label: 'Concurrency', does: 'What happened at once: where the dates the sources allow overlap.'},
]
const AXES: readonly Option<string>[] = [
  {value: 'history', label: 'History', does: 'The ruler measures the history you study, from deep time to today.'},
  {value: 'sessions', label: 'Your sessions', does: 'The ruler measures the time of your sessions, the covered days in hours.'},
]
const readByOf = (v: Values): ReadBy => (READ_BYS.some(o => o.value === str(v, 'readBy')) ? str(v, 'readBy') as ReadBy : 'chronology')
/** A relation between two events in view; `n` is its place in the lit chain. */
interface Hop {readonly e: Edge; readonly a: Clip; readonly b: Clip; readonly n?: number}
/** Events whose dates overlap, over the stretch they share. */
interface Once {readonly id: string; readonly a: Clip; readonly b: Clip; readonly lo: number; readonly hi: number}
interface Rel {readonly by: ReadBy; readonly hops: readonly Hop[]; readonly read: readonly Hop[]; readonly drawn: readonly Hop[]; readonly returns: ReadonlyMap<string, number>; readonly once: readonly Once[]}
function relOf(v: Values, view: View): Rel {
  const by = view.d.mode === 'techne' ? readByOf(v) : 'chronology'
  const byId = new Map(view.clips.map(c => [c.id, c]))
  const hops: Hop[] = view.d.edges.flatMap(e => { const a = byId.get(e.from), b = byId.get(e.to); return a && b ? [{e, a, b}] : [] })
  const kind = by === 'cause' ? 'cause' : by === 'recurrence' ? 'echo' : undefined
  let read: readonly Hop[] = by === 'concurrency' ? [] : kind ? hops.filter(h => h.e.kind === kind) : hops
  if (by === 'cause') {
    // The chain the selected event stands in: its hops light in date order.
    const ids = new Set([str(v, 'sel')])
    for (let grew = true; grew;) { grew = false; for (const h of read) if (ids.has(h.a.id) !== ids.has(h.b.id)) { ids.add(h.a.id); ids.add(h.b.id); grew = true } }
    const lit = read.filter(h => ids.has(h.a.id)).sort((x, y) => x.a.at - y.a.at)
    read = read.map(h => (lit.includes(h) ? {...h, n: lit.indexOf(h) + 1} : h))
  }
  const returns = new Map<string, number>()
  if (by === 'recurrence') for (const h of read) returns.set(h.b.id, (returns.get(h.b.id) ?? 0) + 1)
  const once: Once[] = []
  if (by === 'concurrency') {
    const dated = view.clips.filter(c => c.lo !== undefined && c.hi !== undefined)
    dated.forEach((a, i) => dated.slice(i + 1).forEach(b => {
      const lo = Math.max(a.lo!, b.lo!), hi = Math.min(a.hi!, b.hi!)
      if (lo <= hi) once.push({id: `${a.id}+${b.id}`, a, b, lo, hi})
    }))
  }
  return {by, hops, read, drawn: on(v, 'edges') ? read : [], returns, once}
}

// ---------------------------------------------------------------- the picture

interface Geo {readonly w: number; readonly h: number; readonly labelW: number}
const COMPACT: Geo = {w: 140, h: 146, labelW: 36}
const WHOLE: Geo = {w: 194, h: 146, labelW: 40}

/** A press target in the well. Enter and Space press it. */
const hit = (act: (() => void) | undefined, said: string) => ({
  className: act ? 'arp-hit' : undefined, role: act ? 'button' : undefined, tabIndex: act ? 0 : -1, 'data-i': said, onClick: act,
  onKeyDown: act ? (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act() } } : undefined,
})
/** A point of the well in its own pixels. */
const wellX = (e: PointerEvent<SVGElement>) => {
  const svg = e.currentTarget.ownerSVGElement!, box = svg.getBoundingClientRect()
  return (e.clientX - box.left) * svg.viewBox.baseVal.width / box.width
}

/** A drag on the plot pans the window, as a drag on the shell's ruler does. */
function PanSurface({x, y, w, h, onPan}: {x: number; y: number; w: number; h: number; onPan?: (dx: number) => void}) {
  const last = useRef<number | null>(null)
  return <rect className={onPan ? 'arp-pan' : undefined} x={x} y={y} width={w} height={h} fill="transparent"
    data-i={onPan ? 'Ruler|Drag to move the window along the ruler.' : undefined}
    onPointerDown={e => { if (!onPan || e.button !== 0) return; e.currentTarget.setPointerCapture(e.pointerId); last.current = wellX(e) }}
    onPointerMove={e => { if (last.current === null || !onPan) return; const at = wellX(e); onPan(at - last.current); last.current = at }}
    onPointerUp={() => { last.current = null }} onPointerCancel={() => { last.current = null }} />
}

function Pic({v, set, geo, uid, handles}: {v: Values; set?: SetFn; geo: Geo; uid: string; handles: 'window' | 'all'}) {
  const view = viewOf(v), {d, b, range} = view
  const span = range.end - range.start
  const x0 = geo.labelW, pw = geo.w - x0 - 5
  const X = (at: number) => x0 + percentOf(clampTo(0, d.end, at), range) / 100 * pw
  const T = (x: number) => range.start + (x - x0) / pw * span
  const snap = snapIn(view)
  const strip = on(v, 'strip')
  const n = view.tracks.length
  const lead = d.lanes && view.tracks.some(t => t.id === d.lanes!.track) ? d.lanes : undefined
  const autoRow = !!lead && on(v, 'laneAuto'), evRow = !!lead && on(v, 'laneEvents')
  const secY = 19, secH = d.sections.length ? 10 : 0
  const top = 19 + (secH ? secH + 1 : 0), bottom = geo.h - (strip ? 22 : 4)
  const pitch = Math.min(14.5, (bottom - top) / ((n + ((autoRow ? 1 : 0) + (evRow ? 1 : 0)) * 0.6) || 1)), laneH = pitch * 0.6, bar = Math.max(3, pitch - 3.5)
  const rowAt = new Map<string, number>()
  let y = top, autoY = 0, evY = 0
  for (const t of view.tracks) {
    rowAt.set(t.id, y); y += pitch
    if (lead && t.id === lead.track) { if (autoRow) { autoY = y; y += laneH } if (evRow) { evY = y; y += laneH } }
  }
  const rowsEnd = y
  // The well's corner reads at the top right: a mark label never runs under it.
  const marks = windowMarks(range, b, pw).filter(m => X(m.at) < geo.w - 56)
  const marker = num(v, 'marker'), markerIn = marker >= range.start && marker <= range.end
  const loop = on(v, 'loop'), loopIn = num(v, 'loopIn'), loopOut = num(v, 'loopOut')
  const oy = geo.h - 17, oh = 13, ox = (at: number) => x0 + at / d.end * pw, ot = (x: number) => clampTo(0, d.end, (x - x0) / pw * d.end)
  const chosen = str(v, 'sel')
  const fit = isFitView(view)
  const rel = relOf(v, view)

  const clipEl = (c: Clip) => {
    const ry = rowAt.get(c.track)!, y1 = ry + 1.5, track = view.tracks.find(t => t.id === c.track)!
    const point = c.end === undefined || !(c.end > c.at)
    const isSel = c.id === chosen
    const press = set && (() => set('sel', c.id))
    const said = `${c.label}|${c.status ? `${c.status[0]!.toUpperCase()}${c.status.slice(1)}. ` : ''}${c.standing ? `${standingOf(c.standing).label}. ` : ''}Press to select the clip.`
    if (c.status === 'waiting') {
      const flip = percentOf(clampTo(0, d.end, c.at), range) > 85, wd = 18
      const dx = flip ? X(c.at) - wd : X(c.at)
      return <g key={c.id} {...hit(press, said)}>
        <rect x={dx + 0.5} y={y1 + 0.5} width={wd} height={bar - 1} fill="none" stroke={track.c} strokeDasharray="2 1.6" />
        {isSel && <rect x={dx} y={y1} width={wd + 1} height={bar} fill="none" stroke="var(--accent)" strokeWidth={1.2} />}
      </g>
    }
    const xa = X(c.at), wd = point ? (c.standing ? 4 : 3) : Math.max(2.5, X(c.end!) - xa)
    const seen0 = Math.max(xa, x0), seen = Math.min(xa + wd, x0 + pw) - seen0
    const room = Math.floor((seen - 4) / 3.9)
    const label = !point && seen >= 34 ? (c.label.length > room ? `${c.label.slice(0, Math.max(1, room - 1))}…` : c.label) : ''
    return <g key={c.id} {...hit(press, said)}>
      <rect x={xa} y={y1} width={wd} height={bar} fill={track.c} opacity={c.band ? 0.3 : c.status === 'stopped' ? 0.55 : 1} />
      {c.band && <rect x={xa + 0.5} y={y1 + 0.5} width={Math.max(0, wd - 1)} height={bar - 1} fill="none" stroke={track.c} strokeDasharray="2 1.5" />}
      {c.status === 'stalled' && <rect x={xa} y={y1} width={wd} height={bar} fill={`url(#${uid}-stripe)`} />}
      {c.standing && <line x1={xa + 1} x2={xa + 1} y1={y1} y2={y1 + bar} stroke={standingOf(c.standing).line} strokeWidth={2} strokeDasharray={standingOf(c.standing).dash} />}
      {label && <text x={seen0 + 3} y={y1 + bar / 2 + 2.6} style={{fontSize: 7.5, fill: c.band ? 'var(--text)' : 'var(--bg-0)'}}>{label}</text>}
      {isSel && <rect x={xa} y={y1} width={wd} height={bar} fill="none" stroke="var(--accent)" strokeWidth={1.2} />}
      {c.takes && on(v, 'laneTakes') && Array.from({length: c.takes}, (_, j) => <rect key={j} x={xa + wd - 2 - (c.takes! - j) * 3} y={y1 + bar - 3.5} width={2} height={3} fill={j === c.takes! - 1 ? 'var(--accent)' : 'var(--dp-well)'} />)}
    </g>
  }

  // The handles, numbered in the order of what you move most: the window's two edges on the strip, the marker, the loop's two points.
  let k = 0
  const hs: ReactNode[] = []
  if (set && strip) {
    hs.push(<Handle key="we" n={++k} x={ox(range.end)} y={oy + 3.5} shape="square" label="Window end"
      does="Drag along the strip to zoom. The window keeps its start. Double-click to fit all."
      onDrag={x => set('span', clampTo(b.minSpan, d.end - range.start, ot(x) - range.start))} onReset={() => { set('start', 0); set('span', d.end) }} />)
    hs.push(<Handle key="ws" n={++k} x={ox(range.start)} y={oy + oh - 3.5} shape="square" label="Window start"
      does="Drag along the strip to move the window's start. The window keeps its end. Double-click to fit all."
      onDrag={x => { const s = clampTo(0, range.end - b.minSpan, ot(x)); set('start', s); set('span', range.end - s) }} onReset={() => { set('start', 0); set('span', d.end) }} />)
  }
  if (set && handles === 'all') {
    if (markerIn) hs.push(<Handle key="mk" n={++k} x={X(marker)} y={17} shape="ring" label="Marker" does="Drag along the ruler. It snaps by the Snap mode. Double-click to remove it."
      onDrag={x => set('marker', snap(clampTo(range.start, range.end, T(x))))} onReset={() => set('marker', -1)} />)
    if (loop) {
      hs.push(<Handle key="li" n={++k} x={X(loopIn)} y={17} shape="dot" label="Loop in" does="Drag along the ruler to move the in point. It snaps by the Snap mode."
        onDrag={x => set('loopIn', Math.min(snap(clampTo(0, d.end, T(x))), loopOut - b.minSpan))} />)
      hs.push(<Handle key="lo" n={++k} x={X(loopOut)} y={17} shape="dot" label="Loop out" does="Drag along the ruler to move the out point. It snaps by the Snap mode."
        onDrag={x => set('loopOut', Math.max(snap(clampTo(0, d.end, T(x))), loopIn + b.minSpan))} />)
    }
  }

  return <g>
    <defs>
      <pattern id={`${uid}-stripe`} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2" height="4" fill="var(--stall)" opacity=".75" /></pattern>
      <pattern id={`${uid}-once`} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)"><rect width="1.2" height="4" fill="var(--sel)" opacity=".7" /></pattern>
      <clipPath id={`${uid}-plot`}><rect x={x0} y={0} width={pw} height={Math.max(0, rowsEnd + 1)} /></clipPath>
    </defs>
    {n === 0 && <text x={geo.w / 2} y={geo.h / 2} className="dp-ink-dim" textAnchor="middle">No tracks shown</text>}
    {/* the track names, and the rows' hairlines */}
    {view.tracks.map(t => <g key={t.id}>
      <rect x={0} y={rowAt.get(t.id)! + 1.5} width={2} height={bar} fill={t.c} />
      <text x={5} y={rowAt.get(t.id)! + 1.5 + bar / 2 + 2.6} className="dp-axis" style={t.stalled ? {fill: 'var(--stall)'} : undefined}>{t.short.length > 7 ? `${t.short.slice(0, 6)}…` : t.short}</text>
      <line x1={x0} x2={x0 + pw} y1={rowAt.get(t.id)! + pitch} y2={rowAt.get(t.id)! + pitch} className="dp-faint" opacity={0.5} />
    </g>)}
    {secH > 0 && <g pointerEvents="none">
      <text x={5} y={secY + 7.5} className="dp-axis" style={{fontSize: 7}}>{d.sectionWord}</text>
      {d.sections.map(sc => {
        const a = Math.max(X(sc.from), x0), z = Math.min(X(sc.to), x0 + pw)
        if (z - a < 1) return null
        const room = Math.floor((z - a - 5) / 3.6)
        return <g key={sc.id}>
          <rect x={a} y={secY} width={z - a} height={secH} style={{fill: 'color-mix(in srgb, var(--text) 14%, var(--dp-well))'}} />
          <rect x={a} y={secY} width={2} height={secH} fill="var(--text-dim)" />
          {room >= 3 && <text x={a + 5} y={secY + 7.5} style={{fontSize: 7, fill: 'var(--text)'}}>{sc.name.length > room ? `${sc.name.slice(0, room - 1)}…` : sc.name}</text>}
        </g>
      })}
    </g>}
    {autoRow && <text x={5} y={autoY + laneH - 1.5} className="dp-axis" style={{fontSize: 7}}>{lead!.auto.name}</text>}
    {evRow && <text x={5} y={evY + laneH - 1.5} className="dp-axis" style={{fontSize: 7}}>events</text>}
    <g clipPath={`url(#${uid}-plot)`}>
      <PanSurface x={x0} y={top} w={pw} h={Math.max(0, rowsEnd - top)} onPan={set && (dx => putWindow(set, clampRange({start: range.start - dx / pw * span, end: range.end - dx / pw * span}, b)))} />
      {loop && <rect x={X(loopIn)} y={top} width={Math.max(0, X(loopOut) - X(loopIn))} height={Math.max(0, rowsEnd - top)} className="dp-fill-on" pointerEvents="none" />}
      {d.now !== undefined && <line x1={X(d.now)} x2={X(d.now)} y1={top} y2={rowsEnd} className="dp-faint" pointerEvents="none" />}
      {rel.once.map(o => <rect key={o.id} x={X(o.lo)} y={top} width={Math.max(2, X(o.hi) - X(o.lo))} height={Math.max(0, rowsEnd - top)} fill={`url(#${uid}-once)`}
        pointerEvents="none" />)}
      {view.clips.map(clipEl)}
      {/* the relations Read by draws, in the line of their standing; a lit chain's hops carry their order */}
      {rel.drawn.map(h => {
        const ya = rowAt.get(h.a.track)! + 1.5, yb = rowAt.get(h.b.track)! + 1.5, xa = X(h.a.at) + 1, xb = X(h.b.at) + 1
        const lift = clampTo(4, 11, Math.abs(xb - xa) / 3), apex = Math.min(ya, yb) - lift, s = standingOf(h.e.standing), lit = h.n !== undefined
        return <g key={h.e.id} pointerEvents="none" opacity={rel.by === 'cause' && !lit ? 0.45 : 1}>
          <path d={`M${xa.toFixed(1)} ${ya}Q${((xa + xb) / 2).toFixed(1)} ${apex - lift} ${xb.toFixed(1)} ${yb}`} fill="none" stroke={lit ? 'var(--accent)' : s.line} strokeWidth={lit ? 1.6 : 1.1} strokeDasharray={s.dash} />
          {lit && <text x={(xa + xb) / 2} y={apex - 1.5} textAnchor="middle" style={{fontSize: 7, fill: 'var(--accent)'}}>{h.n}</text>}
        </g>
      })}
      {[...rel.returns].map(([id, n]) => {
        const c = view.clips.find(x => x.id === id)!, cy = rowAt.get(c.track)! + 1.5 + bar / 2
        return <g key={`r${id}`} pointerEvents="none">
          <circle cx={X(c.at) + 1} cy={cy} r={3.4} fill="none" stroke="var(--accent)" strokeWidth={1.1} />
          {n > 1 && <text x={X(c.at) + 5.5} y={cy - 2.5} style={{fontSize: 7, fill: 'var(--accent)'}}>{n}</text>}
        </g>
      })}
      {view.tracks.map(t => t.needle !== undefined && <line key={`n${t.id}`} x1={X(t.needle)} x2={X(t.needle)} y1={rowAt.get(t.id)! + 1} y2={rowAt.get(t.id)! + pitch - 1}
        stroke={t.stalled ? 'var(--stall)' : 'var(--accent)'} strokeWidth={2} pointerEvents="none" />)}
      {autoRow && <path d={stepPath(lead!.auto.points, X, val => autoY + laneH - 1 - val * (laneH - 2))} fill="none" stroke="var(--rec)" strokeWidth={1.2} pointerEvents="none" />}
      {evRow && lead!.events.map(([name, at], i) => <rect key={i} x={X(at) - 0.5} y={evY + 1} width={1.5} height={laneH - 2} fill={view.tracks.find(t => t.id === lead!.track)!.c} data-i={`${name}|An event inside the task.`} />)}
      {marker >= 0 && markerIn && <line x1={X(marker)} x2={X(marker)} y1={0} y2={rowsEnd} stroke="var(--text-dim)" pointerEvents="none" />}
    </g>
    {/* the ruler: marks, the loop's braces, the sections */}
    <line x1={x0} x2={x0 + pw} y1={17.5} y2={17.5} className="dp-faint" />
    {marks.map(m => <g key={m.at} pointerEvents="none">
      <line x1={X(m.at)} x2={X(m.at)} y1={13.5} y2={17.5} className="dp-faint" />
      <text x={X(m.at) + (m.end ? -2 : 2)} y={9} className="dp-axis" textAnchor={m.end ? 'end' : 'start'}>{d.label(m.at, true)}</text>
    </g>)}
    <rect x={x0} y={0} width={pw} height={17} fill="transparent" className={set ? 'arp-hit' : undefined} data-i={set ? 'Ruler|Press to set the marker. It snaps by the Snap mode.' : undefined}
      onPointerDown={e => { if (set && e.button === 0) set('marker', snap(clampTo(range.start, range.end, T(wellX(e))))) }} />
    {loop && <g pointerEvents="none">
      <path d={`M${X(loopIn) + 1} 13V17.5M${X(loopIn)} 13h3`} className="dp-curve-on" /><path d={`M${X(loopOut) - 1} 13V17.5M${X(loopOut)} 13h-3`} className="dp-curve-on" />
    </g>}
    {/* the overview strip: the whole ruler with the window marked */}
    {strip && <g>
      <rect x={x0} y={oy} width={pw} height={oh} className="dp-faint" />
      {view.clips.map(c => {
        const ri = Math.max(0, view.tracks.findIndex(t => t.id === c.track)), th = (oh - 2) / Math.max(1, n)
        return <rect key={c.id} x={ox(c.at)} y={oy + 1 + ri * th} width={Math.max(1, ox(c.end ?? c.at) - ox(c.at))} height={Math.max(1, th - 0.5)} fill={view.tracks[ri]!.c} opacity={0.8} pointerEvents="none" />
      })}
      <rect x={ox(range.start)} y={oy - 1} width={Math.max(2, ox(range.end) - ox(range.start))} height={oh + 2} className={fit ? 'dp-faint' : 'dp-fill-on'} style={fit ? undefined : {stroke: 'var(--dp-on)'}}
        pointerEvents="none" />
      {set && <rect x={x0} y={oy} width={pw} height={oh} fill="transparent" className="arp-hit" data-i="Overview|Press to centre the window on that moment."
        onPointerDown={e => { if (e.button === 0) { const at = ot(wellX(e)); putWindow(set, clampRange({start: at - span / 2, end: at + span / 2}, b)) } }} />}
      <text x={x0 - 4} y={oy + oh - 2} className="dp-axis" textAnchor="end" pointerEvents="none">whole</text>
    </g>}
    {hs}
  </g>
}

/** The widget's strip: the whole ruler, thin, with the window, the loop, the marker and the stalled needles. Press it to open the ruler there. */
function Thin({v, set, w, h, onOpen}: {v: Values; set?: SetFn; w: number; h: number; onOpen?: () => void}) {
  const view = viewOf(v), {d, b, range} = view
  const x0 = 4, pw = w - 8, X = (at: number) => x0 + at / d.end * pw
  const n = Math.max(1, view.tracks.length), top = 14, th = (h - top - 3) / n
  const loop = on(v, 'loop'), marker = num(v, 'marker'), fit = isFitView(view)
  const span = range.end - range.start
  const marks = windowMarks({start: 0, end: d.end}, b, pw)
  return <g>
    <line x1={x0} x2={x0 + pw} y1={12.5} y2={12.5} className="dp-faint" />
    {marks.map(m => <text key={m.at} x={X(m.at) + (m.end ? -1 : 1)} y={9} className="dp-axis" textAnchor={m.end ? 'end' : 'start'} pointerEvents="none">{d.label(m.at, true)}</text>)}
    {loop && <rect x={X(num(v, 'loopIn'))} y={top} width={Math.max(0, X(num(v, 'loopOut')) - X(num(v, 'loopIn')))} height={h - top - 2} className="dp-fill-on" pointerEvents="none" />}
    {view.tracks.map((t, i) => <g key={t.id} pointerEvents="none">
      {view.clips.filter(c => c.track === t.id).map(c => <rect key={c.id} x={X(c.at)} y={top + i * th + 0.5} width={Math.max(2, X(c.end ?? c.at) - X(c.at))} height={Math.max(1.5, th - 1.5)} fill={t.c}
        opacity={c.status === 'stopped' ? 0.55 : 1} />)}
      {t.needle !== undefined && <line x1={X(t.needle)} x2={X(t.needle)} y1={top + i * th} y2={top + (i + 1) * th} stroke={t.stalled ? 'var(--stall)' : 'var(--accent)'} strokeWidth={1.5} />}
    </g>)}
    {marker >= 0 && <line x1={X(marker)} x2={X(marker)} y1={top - 2} y2={h - 2} stroke="var(--text-dim)" pointerEvents="none" />}
    <rect x={X(range.start)} y={top - 1} width={Math.max(2, X(range.end) - X(range.start))} height={h - top} fill="none" stroke={fit ? 'var(--text-faint)' : 'var(--dp-on)'} strokeWidth={1.2} pointerEvents="none" />
    <rect x={x0} y={0} width={pw} height={h} fill="transparent" className="arp-hit" data-i="Ruler|Press to open the ruler at that moment."
      onPointerDown={e => { if (e.button !== 0) return; const at = clampTo(0, d.end, (wellX(e) - x0) / pw * d.end); set?.('start', clampRange({start: at - span / 2, end: at + span / 2}, b).start); onOpen?.() }} />
  </g>
}

// ---------------------------------------------------------------- the pane: the Arrangement itself

/** The ruler the keys carry, as the ruler's law reads a set: the gallery's and any place's that draws the design with no live set (a set
 * with no actions, so the ruler stands read-only and says so). What the view shows (show:*, st:*) and the loop it holds stand. Pure. */
export function rulerSetOfKeys(v: Values): WorldTrackSet {
  const view = viewOf(v), d = view.d
  const loop = v.loopIn !== undefined && typeof v.loopIn === 'number' ? {start: num(v, 'loopIn'), ...(typeof v.loopOut === 'number' ? {end: num(v, 'loopOut')} : {}), ...(on(v, 'loop') ? {} : {off: true})} : undefined
  return {columns: [],
    ruler: {unit: d.unit, end: d.end, ...(d.now !== undefined ? {now: d.now} : {}), label: at => d.label(at), duration: d.span},
    tracks: view.tracks.map(t => ({id: t.id, name: t.name, kind: 'track', color: t.c, ...(t.needle !== undefined ? {needle: t.needle} : {}), ...(t.stalled ? {stalled: true} : {})})),
    clips: view.clips.map(c => ({id: c.id, trackId: c.track, columnId: '', label: c.label, at: {start: c.at, ...(c.end !== undefined ? {end: c.end} : {})},
      ...(c.status ? {status: c.status} : {}), ...(c.standing ? {standing: {visual: c.standing, verbatim: null, rule: 'the design\'s keys'}} : {}),
      ...(c.takes ? {takes: Array.from({length: c.takes}, (_, j) => ({id: `${c.id}:take:${j + 1}`, name: `Take ${j + 1}`}))} : {})})),
    sections: d.sections.map(x => ({id: x.id, name: x.name, span: {start: x.from, end: x.to}})),
    ...(loop ? {loop} : {})}
}

/** The Arrangement the pane draws: the live set the pane hands its device (frame/tracks/tracksDoor.ts TracksMaterial), else the set the
 * keys carry. Its window, snap, marker, lanes and cut modes are the device's holds either way (useRulerView). */
function RulerFull({p}: {p: ViewProps}) {
  const material = useContext(TracksMaterial)
  const set = material?.set ?? rulerSetOfKeys(p.v)
  const selection: TracksSelection = material?.selection ?? {ref: str(p.v, 'sel') || undefined, select: target => { if (target.kind === 'clip') p.set('sel', target.ref) }}
  return <ArrangementRuler set={set} selection={selection} empty={material?.empty} />
}

// ---------------------------------------------------------------- the ruler's law, moved from frame/tracks/ArrangementRuler.tsx (parity D-26)

/** The ruler's tools: zoom out, zoom in, fit, and the snap (nativeArrangementTimeline.tsx:309-312; the loop toggle there was an
 * owner write and is not here). */
function rulerTools(view: RulerWindowProps, range: TimeRange, bounds: ReturnType<typeof rangeBounds>, anchor: number, set?: WorldTrackSet) {
  const span = range.end - range.start
  const cuts = view.cuts, move = modeOf(MOVE_MODES, cuts?.move ?? 'insert'), trim = modeOf(TRIM_MODES, cuts?.trim ?? 'trim')
  return <span className="tl-head tl-tools">
    <button type="button" aria-label="Zoom out" title="Zoom out (↓ or − on the ruler, ⌘/Ctrl-wheel)" disabled={span >= bounds.end - bounds.start} onClick={() => view.onWindow(zoomAround(range, anchor, .5, bounds))}>−</button>
    <button type="button" aria-label="Zoom in" title="Zoom in (↑ or + on the ruler, ⌘/Ctrl-wheel or pinch)" disabled={span <= bounds.minSpan} onClick={() => view.onWindow(zoomAround(range, anchor, 2, bounds))}>+</button>
    <button type="button" aria-label="Fit the whole ruler" title="Fit the whole ruler" disabled={isFit(range, bounds)} onClick={() => view.onWindow(null)}>Fit</button>
    <button type="button" className="tl-snap" data-snap={view.snap} aria-label={`Snap: ${view.snap}`}
      title={`Snap · ${view.snap} — the insert marker snaps to a twentieth of a mark (grid), half a mark (coarse), or not at all (free). Shift frees one press, Alt coarsens it. Click for the next.`}
      onClick={() => view.onSnap(nextSnap(view.snap))}>⌗ {view.snap}</button>
    {cuts && set && carriesMove(set) && <button type="button" className="tl-cutmode" data-move={move.value} aria-label={`Move mode: ${move.label}`}
      title={`Move mode · ${move.label} — a drag on a clip ${move.value === 'insert' ? 'moves it and shifts the clips after it' : 'moves it and replaces what was there'}. Click for the next.`}
      onClick={() => cuts.onMove(nextMode(MOVE_MODES, move.value))}>{move.label}</button>}
    {cuts && set && carriesEdgeCuts(set) && <button type="button" className="tl-cutmode" data-trim={trim.value} aria-label={`Trim mode: ${trim.label}`}
      title={`Trim mode · ${trim.label} — what an edge drag does: ${trim.does} Click for the next.`}
      onClick={() => cuts.onTrim(nextMode(TRIM_MODES, trim.value))}>{trim.label}</button>}
  </span>
}

export function ArrangementRulerView({set, selection, empty, view, lanes: lanesView = STILL_LANES, receipt, onPress, onDismiss, chosen = []}: ArrangementRulerViewProps) {
  const {placed, end} = placeClips(set)
  const bounds = rangeBounds(end)
  const range = clampRange(view.window ?? fitRange(bounds), bounds)
  const held = (at: number) => Math.min(Math.max(at, 0), end)
  const pct = (at: number) => `${percentOf(held(at), range)}%`
  const span = range.end - range.start
  const marks = windowMarks(range, bounds, view.width)
  const label = set.ruler?.label ?? ((at: number) => String(Math.round(at * 10) / 10))
  const now = set.ruler?.now
  const tree = trackTree(set.tracks)
  const {own: stalled} = stalledLanes(set, tree)
  const left = set.clips.length - new Set(placed.map(p => p.clip.id)).size
  const inWindow = (at: number) => at >= range.start && at <= range.end
  // Keyboard and button zoom hold the insert marker still when it is in view (Live zooms about it), else the window's middle.
  const anchor = view.marker !== null && inWindow(view.marker) ? view.marker : (range.start + range.end) / 2
  const markRow = <div className="tl-marks">{marks.map(mark => <span key={mark.at} className={mark.end ? 'end' : undefined} style={{left: `${percentOf(mark.at, range)}%`}}>{label(mark.at)}</span>)}</div>
  // An empty work draws the ruler and the lane area with the reason in it, as the Session does — never a blank box.
  if (!set.tracks.length) return <div ref={view.rootRef as RefObject<HTMLDivElement>} className="tl" aria-label="Arrangement" data-tracks-view="arrangement" data-empty="true">
    <div className="tl-ruler" aria-label="Ruler"><span className="tl-head" />{markRow}</div>
    <div className="sg-drop" role="status">{empty ?? 'No tracks in this work yet.'}</div>
  </div>

  // Sections: one lane per layer under the ruler; a clip takes the atmosphere of the narrowest section it stands in.
  const lanesOfSections = sectionLanes(set)
  const trackOf = new Map(set.tracks.map(track => [track.id, track]))
  // Rails: under the lane of each walk's first placed stop; a rail with no placed stop stands after the tracks.
  const rails = walkRails(set, placed)
  const railsUnder = new Map<string, WalkRail[]>()
  for (const rail of rails) if (rail.trackId !== undefined) railsUnder.set(rail.trackId, [...(railsUnder.get(rail.trackId) ?? []), rail])
  const focusStop = set.actions?.focusStop
  // The occasion stood in: a line through the lanes where its clip stands (:367), and its readout with the admission light.
  const occasion = set.occasion
  const occasionAt = occasion?.at !== undefined && inWindow(occasion.at) ? occasion.at : undefined
  const light = occasion ? occasionLight(occasion) : undefined
  const marker = view.marker !== null && inWindow(view.marker) ? view.marker : undefined
  // The playhead where something plays, as its owner reports it (WorldTrackSet.playhead, O-I #747 round 883): a line through the lanes and
  // a mark on the ruler. Nothing plays: none, and the insert marker stands as before.
  const playhead = set.playhead !== undefined && inWindow(set.playhead) ? set.playhead : undefined
  // The time selection, cut to the window: a band over the marks and through the lanes.
  const spanBand = view.span ? bandIn(view.span, range, bounds) : null
  const spanWords = view.span ? `Selected · ${label(view.span.start)} – ${label(view.span.end)} · the pane's own; Consolidate joins what plays here` : ''
  // The loop its owner carries, held to the ruler and cut to the window (rulerWindow.ts bandIn); with none, no brace stands.
  const loop = loopOf(set, bounds.end)
  // XT15 (round 890): an end under the hand draws the brace where the hand has it; let go, the owner's reading draws it again.
  const setLoop = set.actions?.setLoop
  const braceDrag = setLoop && loop ? view.brace?.drag ?? null : null
  const shownLoop = loop && braceDrag ? braceEdgeAt(loop, braceDrag.edge, braceDrag.at, bounds) : loop
  const loopBand = shownLoop ? bandIn(shownLoop, range, bounds) : null
  const loopOff = set.loop?.off === true
  const loopWords = !shownLoop ? '' : loopOff ? `Loop off · ${label(shownLoop.start)} – ${label(shownLoop.end)} · kept where it stands; Loop on repeats it`
    : `Loop · ${label(shownLoop.start)} – ${label(shownLoop.end)} · its owner's; ${setLoop ? 'drag its ends to set its in and out' : 'set it where its owner sets it'}`

  // The ruler's gestures (nativeArrangementTimeline.tsx:142-148, :173-198): a drag pans the window, a press sets the marker.
  const gesture = view.gesture ?? {current: null}
  const pointAt = (clientX: number): number | null => {
    const box = view.marksRef?.current?.getBoundingClientRect()
    return box && box.width > 0 ? range.start + (clientX - box.left) / box.width * span : null
  }
  // XT15 (round 890): the brace's ends, where its owner lets it be set (loopBraceEnds.tsx).
  const braceEnds = setLoop && loop && shownLoop ? <LoopBraceEnds loop={loop} shown={shownLoop} bounds={bounds} range={range} snap={view.snap} width={view.width}
    drag={braceDrag} onDrag={next => view.brace?.onDrag(next)} setLoop={setLoop} receipt={receipt} onPress={onPress} pointAt={pointAt} label={label} /> : null
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    const box = event.currentTarget.getBoundingClientRect()
    if (box.width <= 0) return
    gesture.current = {pointer: event.pointerId, startX: event.clientX, start: range, scale: box.width / span, moved: false}
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const active = gesture.current
    if (!active || event.pointerId !== active.pointer) return
    const dx = event.clientX - active.startX
    if (!active.moved && Math.abs(dx) <= 3) return
    active.moved = true
    view.onWindow(panBy(active.start, -dx / active.scale, bounds))
  }
  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const active = gesture.current
    if (!active || event.pointerId !== active.pointer) return
    gesture.current = null
    if (active.moved) return
    const at = pointAt(event.clientX)
    if (at === null) return
    const point = snapAt(at, snapOfPress(view.snap, event), markStep(range, bounds, view.width), bounds)
    // Shift-press with the insert marker standing selects the stretch between them (Live's Shift-click extends a selection; the press's
    // own point is freed from the snap, as Shift frees a press); a plain press sets the marker and lets the selection go.
    if (event.shiftKey && view.marker !== null && view.onSpan && point !== view.marker) {
      view.onSpan({start: Math.min(view.marker, point), end: Math.max(view.marker, point)})
      return
    }
    view.onSpan?.(null)
    view.onMarker(point)
  }
  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' && (view.marker !== null || view.span)) { event.preventDefault(); view.onMarker(null); view.onSpan?.(null); return }
    const next = windowOfKey(event.key, range, bounds, anchor)
    if (!next) return
    event.preventDefault()
    view.onWindow(next)
  }
  const marksProps = {
    ref: view.marksRef as RefObject<HTMLDivElement>,
    role: 'slider', tabIndex: 0,
    'aria-label': `Visible window of the ruler${set.ruler ? `, in ${set.ruler.unit}` : ''}`,
    'aria-valuemin': bounds.start, 'aria-valuemax': Math.max(bounds.start, bounds.end - span), 'aria-valuenow': range.start,
    'aria-valuetext': `${label(range.start)} to ${label(range.end)}`,
    title: 'Drag to pan · press to set the insert marker, Shift-press to select from it · ⌘/Ctrl-wheel or pinch to zoom · ←→ pan · ↑↓ zoom · Home or End to the ends',
  }
  // A line at the window's very end is held just inside it, and a readout past the middle reads back from its point, as a dash does.
  const lineAt = (at: number) => { const p = percentOf(held(at), range); return p >= 99.5 ? 'calc(100% - 2px)' : `${p}%` }
  const readoutAt = (at: number): CSSProperties => { const p = percentOf(at, range); return p > 70 ? {right: `calc(100% - ${p}%)`} : {left: `${p}%`} }
  const occasionReadout = occasion && light && <span className={`tl-occ-mark${occasionAt === undefined ? ' off' : percentOf(occasionAt, range) > 70 ? ' back' : ''}`} data-occasion={occasion.ref}
    style={occasionAt !== undefined ? readoutAt(occasionAt) : undefined}
    title={`Occasion · ${occasion.label}${occasion.year !== undefined ? ` · ${occasion.year}` : ''}${occasion.at === undefined ? ' · no clip of this work stands it on the ruler' : occasionAt === undefined ? ' · outside the window' : ''} · ${light.title}`}>
    occasion · {occasion.label.length > 28 ? `${occasion.label.slice(0, 28)}…` : occasion.label}
    <i className="tl-light" data-admission={light.state} aria-label={light.title} />
  </span>
  // The overview strip (catalogue dlw__arrangement-ruler.tsx FullRuler's `arp-over`): the whole ruler, thin, each placed clip a tick in its
  // track's colour at its track's height, and the window marked on it; a press centres the window on that moment. Its head carries the
  // ruler's scale: the set's unit, or, where the set has no ruler, that the rows are laid one after another (placeClips).
  const extent = Math.max(bounds.end - bounds.start, Number.EPSILON)
  const overAt = (at: number) => `${(held(at) - bounds.start) / extent * 100}%`
  const trackRow = new Map(set.tracks.map((track, index) => [track.id, index]))
  const scaleWord = set.ruler ? set.ruler.unit : 'rows in order'
  const overviewStrip = <div className="tl-lane tl-over" role="group" aria-label={`The whole ruler, in ${scaleWord}`}>
    <span className="tl-head tl-over-head" title={set.ruler ? `The ruler's scale: ${set.ruler.unit}` : 'No ruler: the Arrangement lays the rows one after another'}>
      <span className="tl-scale">{scaleWord}</span><small>whole ruler</small>
    </span>
    <div className="tl-over-body" title="The whole ruler · press to centre the window on that moment"
      onClick={event => {
        const box = event.currentTarget.getBoundingClientRect()
        if (box.width <= 0) return
        const at = bounds.start + (event.clientX - box.left) / box.width * extent
        view.onWindow(clampRange({start: at - span / 2, end: at + span / 2}, bounds))
      }}>
      {placed.map(({clip, start, end: to}) => {
        const track = trackOf.get(clip.trackId)
        return <i key={clip.id} data-over-clip={clip.id} style={{left: overAt(start), width: `max(2px, ${(held(to) - held(start)) / extent * 100}%)`,
          top: 2 + (trackRow.get(clip.trackId) ?? 0) * 2.6, ...(track ? {'--tc': trackColour(track)} : {})} as CSSProperties} />
      })}
      <i className="tl-over-win" data-fit={isFit(range, bounds) || undefined} style={{left: overAt(range.start), width: `${span / extent * 100}%`}} />
    </div>
  </div>
  // A drag on a clip (clipCuts.ts): its part and the modes say the cut, its moving point snaps unless Alt is held or the snap is Free, and
  // its end is one press of the owner's op — or, where the owner carries none, the op it waits for, in words. A press that does not move
  // is the clip's own click, and selects it; the click a drag ends in selects nothing.
  const cuts = view.cuts && (carriesMove(set) || carriesEdgeCuts(set)) ? view.cuts : undefined
  const pressOf = (event: {clientX: number; altKey?: boolean}, drag: ClipDrag, clip: WorldTrackClip) => {
    const targets = cutTargets(set, drag.clipId, {marker: view.marker, ...(loop ? {loop} : {}), ...(now !== undefined ? {now} : {}),
      ...(set.playhead !== undefined ? {playhead: set.playhead} : {})})
    const off = event.altKey === true || view.snap === 'free'
    return cutPress(set, clip, cutOf(drag.part, cuts!.move, cuts!.trim), drag, (event.clientX - drag.startX) / drag.scale,
      at => snapCut(at, targets, SNAP_PX / drag.scale, off))
  }
  const clipDrag = (clip: WorldTrackClip, start: number, stop: number) => cuts && !trackOf.get(clip.trackId)?.readOnly ? {
    onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return
      const box = event.currentTarget.getBoundingClientRect(), body = event.currentTarget.parentElement?.getBoundingClientRect()
      if (!body || !(body.width > 0) || !(box.width > 0)) return
      cuts.drag.current = {pointer: event.pointerId, clipId: clip.id, part: partOf(event.clientX - box.left, box.width), startX: event.clientX,
        scale: body.width / span, start, end: stop, moved: false}
      event.currentTarget.setPointerCapture?.(event.pointerId)
    },
    onPointerMove: (event: ReactPointerEvent<HTMLButtonElement>) => {
      const drag = cuts.drag.current
      if (!drag || drag.ended || drag.clipId !== clip.id || event.pointerId !== drag.pointer) return
      if (!drag.moved && Math.abs(event.clientX - drag.startX) <= 3) return
      drag.moved = true
      const press = pressOf(event, drag, clip)
      cuts.onPreview({clipId: clip.id, point: press.point, words: press.what})
    },
    onPointerUp: (event: ReactPointerEvent<HTMLButtonElement>) => {
      const drag = cuts.drag.current
      if (!drag || drag.ended || drag.clipId !== clip.id || event.pointerId !== drag.pointer) return
      if (!drag.moved) { cuts.drag.current = null; return }
      const press = pressOf(event, drag, clip)
      cuts.drag.current = {...drag, ended: true}
      cuts.onPreview(null)
      onPress(press.key, press.what, press.run ?? (() => ({ok: false, error: missingAct(press.op, set.actions)})))
    },
    onPointerCancel: () => { cuts.drag.current = null; cuts.onPreview(null) },
  } : {}
  /** The click a drag ended in is the drag's: it selects nothing. */
  const dragClick = (clipId: string) => {
    const drag = cuts?.drag.current
    if (!drag?.ended || drag.clipId !== clipId) return false
    cuts!.drag.current = null
    return true
  }
  const preview = cuts?.preview ?? null
  const playheadMark = playhead !== undefined && <span className="tl-playhead-mark" style={{left: lineAt(playhead)}} aria-hidden="true"
    title={`Playhead at ${label(playhead)}: where what plays stands, as its owner reports it`} />
  const markerMark = marker !== undefined && <span className="tl-marker-mark" style={{left: lineAt(marker)}} title={`Insert marker at ${label(marker)} · the pane's own, snapped ${view.snap}; it writes no time to any owner`}>{label(marker)}</span>

  // A rail stands under its track in that track's colour; one with no placed stop stands after the tracks, uncoloured.
  const railLane = (rail: WalkRail, colour?: string) => {
    const total = rail.walk.stops.length
    const off = total - rail.placed
    return <div key={`rail:${rail.walk.id}`} className="tl-lane tl-rail" data-walk-row={rail.walk.id} data-walk-kind={rail.walk.kind} data-walk-derived={rail.walk.derived ? 'derived' : 'curated'}
      style={colour ? {'--tc': colour} as CSSProperties : undefined}>
      <span className="tl-head tl-rail-head" title={`${rail.walk.name} · ${railKindText(rail.walk)}${off ? ` · ${off} of ${total} ${total === 1 ? 'stop has' : 'stops have'} no place on this ruler` : ''}`}>
        <span className="tl-lane-name">{rail.walk.name}</span><small>{off ? `${rail.placed}/${total} placed` : `${total} ${total === 1 ? 'stop' : 'stops'}`}</small>
      </span>
      <div className="tl-body">
        {railSegments(rail).map((segment, i) => <i key={i} className="tl-rail-seg" style={{left: pct(segment.from), width: `${(held(segment.to) - held(segment.from)) / span * 100}%`}} aria-hidden="true" />)}
        {rail.stops.map(({stop, index, at}) => {
          if (at === undefined) return null
          const key = `stop:${rail.walk.id}:${index}`
          const words = `${index + 1}/${total} · ${railStopTitle(stop)}`
          return focusStop
            ? <button type="button" key={key} className="tl-stop" data-walk-stop={index + 1} data-stop-ref={stop.id} data-receipt={receipt?.key === key ? (receipt.ok ? 'ok' : 'refused') : undefined}
              style={{left: pct(at)}} title={`${words} · press to stand it (${focusStop.op})`} aria-label={`Stand stop ${index + 1} of ${total}: ${stop.label}`}
              onClick={() => onPress(key, `Stand ${stop.label}`, () => focusStop.run(rail.walk.id, index))}>{index + 1}</button>
            : <span key={key} className="tl-stop" data-walk-stop={index + 1} data-stop-ref={stop.id} style={{left: pct(at)}} title={`${words} · no stop focus: the owner gives none`}>{index + 1}</span>
        })}
      </div>
    </div>
  }

  const colourOf = (track: {color?: string}) => ({'--tc': track.color ?? 'var(--track-default, var(--bg-3))'}) as CSSProperties
  const receiptOn = (key: string) => receipt?.key === key ? (receipt.ok ? 'ok' : 'refused') : undefined
  // A point on a lane's body from the pointer: the body spans the same window as the ruler's marks.
  const bodyAt = (element: HTMLElement, clientX: number): number | null => {
    const box = element.getBoundingClientRect()
    return box.width > 0 ? range.start + (clientX - box.left) / box.width * span : null
  }

  // A take lane (Live cap 44–45): its name, its Activator and Solo where its owner keeps them (O-I #855 round 25), and its audition, lit
  // where the lane sounds in place of the main lane; a stretch dragged across it is the pane's choice, and Return copies it into the main
  // lane through the owner's comp. The stretch chosen and the take that stands are marked; nothing is copied here.
  const comp = set.actions?.comp, audition = set.actions?.audition, laneWrite = set.actions?.takeLane
  const takeLane = (take: WorldTakeLane, colour: CSSProperties, index: number) => {
    const chosen = lanesView.take?.takeId === take.id && lanesView.take.trackId === take.trackId ? lanesView.take : null
    const stretch = chosen ? compRange(take, chosen.from, chosen.to) : null
    const auditionKey = `audition:${take.trackId}:${take.id}`, compKey = `comp:${take.trackId}:${take.id}`
    // Each comp is one labelled step in the undo list where its owner gives the way back (§16.6 Rules; XT08, round 888); none, and it is no step.
    const press = () => {
      if (!comp || !stretch) return
      const what = `Comp ${take.name} ${label(stretch.start)} – ${label(stretch.end)}`, run = () => comp.run(take.trackId, take.id, stretch)
      onPress(compKey, what, comp.back ? undoable({record: recordStep}, what, run, () => comp.back!(take.trackId, take.id, stretch)) : run)
    }
    // The lane's Activator and Solo (Live's take lanes carry both): each pressed writes the pair with itself turned, through the owner.
    const laneSwitch = (control: 'activator' | 'solo') => {
      if (take.enabled === undefined || take.solo === undefined) return null
      const on = control === 'activator' ? take.enabled : take.solo
      const word = control === 'activator' ? 'Activator' : 'Solo'
      const key = `take-${control}:${take.trackId}:${take.id}`
      const next = control === 'activator' ? {enabled: !take.enabled, solo: take.solo} : {enabled: take.enabled, solo: !take.solo}
      const meaning = control === 'activator' ? 'the lane sounds while it is on' : 'while any lane on is soloed, only the soloed lanes sound'
      return <button type="button" className={`mx mx-${control}`} data-mix={control} data-state={on ? 'on' : 'off'} aria-label={`${word} of ${take.name}`} aria-pressed={on}
        disabled={!laneWrite} data-receipt={receiptOn(key)}
        title={`${word} · ${meaning} · ${on ? 'on' : 'off'}${laneWrite ? ` · press to turn it ${on ? 'off' : 'on'} (${laneWrite.op})` : ' · the owner gives no op that writes a take lane'}`}
        onClick={() => { if (laneWrite) onPress(key, `${word} of ${take.name} ${on ? 'off' : 'on'}`, () => laneWrite.run(take.trackId, take.id, next)) }}>
        {control === 'activator' ? String(index + 1) : 'S'}</button>
    }
    const heard = take.auditioned === true
    return <div key={`take:${take.id}`} className="tl-lane tl-take" data-take={take.id} data-standing={take.standing ? 'true' : undefined} style={colour}>
      <span className="tl-head tl-take-head" title={`${take.name} · a take${take.standing ? ' · it stands' : ''} · select a stretch and press Return to copy it into the main lane`}>
        <span className="tl-lane-name">{take.name}</span>
        {laneSwitch('activator')}{laneSwitch('solo')}
        <button type="button" className={`tl-audition${heard ? ' lit' : ''}`} aria-label={`Audition ${take.name}`} aria-pressed={take.auditioned} disabled={!audition} data-receipt={receiptOn(auditionKey)}
          title={audition ? heard ? `${take.name} sounds in place of the main lane · press to hear the main lane again (${audition.op})` : `Audition ${take.name} (${audition.op})`
            : 'Audition: the owner gives no op that plays a take alone'}
          onClick={() => { if (audition) onPress(auditionKey, `Audition ${take.name}`, () => audition.run(take.trackId, take.id)) }}><CutIcon name="play" size={10} /></button>
      </span>
      <div className="tl-body tl-take-body" tabIndex={0} role="group" aria-label={`Take ${take.name}`} data-receipt={receiptOn(compKey)}
        title={comp ? `Drag across the take to choose a stretch; Return copies it into the main lane (${comp.op})` : 'Comp: the owner gives no op that copies a stretch of a take into the main lane'}
        onPointerDown={event => { if (event.button !== 0) return; const at = bodyAt(event.currentTarget, event.clientX); if (at === null) return
          event.currentTarget.setPointerCapture?.(event.pointerId); lanesView.onTake({trackId: take.trackId, takeId: take.id, from: at, to: at}) }}
        onPointerMove={event => { if (!chosen || !(event.buttons & 1)) return; const at = bodyAt(event.currentTarget, event.clientX); if (at !== null) lanesView.onTake({...chosen, to: at}) }}
        onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); press() } else if (event.key === 'Escape' && chosen) { event.preventDefault(); lanesView.onTake(null) } }}>
        {take.spans.map((piece, i) => <span key={i} className="tl-take-span" style={{left: pct(piece.start), width: `max(4px, ${Math.max(0, held(piece.end) - held(piece.start)) / span * 100}%)`}}
          title={`${piece.label} · ${label(piece.start)} – ${label(piece.end)}`}>{piece.label}</span>)}
        {stretch && <span className="tl-take-sel" style={{left: pct(stretch.start), width: `${Math.max(0, held(stretch.end) - held(stretch.start)) / span * 100}%`}}
          title={`Chosen: ${label(stretch.start)} – ${label(stretch.end)} · press Return to copy it into the main lane`} aria-hidden="true" />}
      </div>
    </div>
  }

  // An event lane (Factory): a session's events of one kind, each a tick; clicked, it opens beside the ruler.
  const eventLane = (lane: WorldEventLane, colour: CSSProperties) => <div key={`events:${lane.id}`} className="tl-lane tl-events" data-event-lane={lane.id} data-event-kind={lane.kind} style={colour}>
    <span className="tl-head tl-events-head" title={`${lane.name} · ${lane.events.length} ${lane.events.length === 1 ? 'event' : 'events'}`}>
      <span className="tl-lane-name">{lane.name}</span><small>{lane.events.length}</small>
    </span>
    <div className="tl-body">
      {lane.events.map(event => <button type="button" key={event.id} className={`tl-event${lanesView.opened?.eventId === event.id && lanesView.opened.laneId === lane.id ? ' sel' : ''}`}
        data-event={event.id} style={{left: pct(event.at)}} title={`${event.label} · ${label(event.at)}`} aria-label={`${lane.name}: ${event.label}`}
        onClick={() => lanesView.onOpened({laneId: lane.id, eventId: event.id})} />)}
    </div>
  </div>
  const openedLane = lanesView.opened ? set.lanes?.events?.find(lane => lane.id === lanesView.opened!.laneId) : undefined
  const openedEvent = openedLane?.events.find(event => event.id === lanesView.opened!.eventId)

  // The Lanes setting (manual §16.6 settings table): Takes, Automation, Events, each On or Off; why a kind has nothing, beside it;
  // and Re-enable, lit while the owner counts parameters held off their automation by hand.
  const heldCount = set.lanes?.held
  const reenableAll = set.actions?.reenable
  const lanesBar = <div className="tl-lane tl-setbar" role="group" aria-label="Lanes">
    <span className="tl-head tl-setbar-head">Lanes</span>
    <div className="tl-body tl-setbar-body">
      {(['takes', 'automation', 'events'] as TrackLaneKind[]).map(kind => {
        const count = laneCount(set, kind), why = set.lanes?.absent?.[kind]
        return <button type="button" key={kind} className="tl-lanes-kind" data-lanes={kind} aria-pressed={lanesView.shown[kind]} data-count={count}
          title={`${LANE_WORD[kind]} · ${lanesView.shown[kind] ? 'On' : 'Off'} · ${count} ${count === 1 ? 'lane' : 'lanes'}${why ? ` · ${why}` : ''}`}
          onClick={() => lanesView.onShown({...lanesView.shown, [kind]: !lanesView.shown[kind]})}>{LANE_WORD[kind]}<small>{count}</small></button>
      })}
      {(heldCount !== undefined || reenableAll) && <button type="button" className={`tl-reenable${heldCount ? ' lit' : ''}`} disabled={!reenableAll || !heldCount} data-receipt={receiptOn('reenable')}
        title={heldCount === undefined ? 'Re-enable: the owner reports no count of values held by hand' : heldCount ? `Re-enable: ${heldCount} ${heldCount === 1 ? 'parameter is' : 'parameters are'} held off ${heldCount === 1 ? 'its' : 'their'} automation${reenableAll ? ` (${reenableAll.op})` : ''}` : 'Re-enable: nothing is held off its automation'}
        onClick={() => { if (reenableAll && heldCount) onPress('reenable', 'Re-enable', () => reenableAll.run()) }}>Re-enable</button>}
    </div>
  </div>

  return <div ref={view.rootRef as RefObject<HTMLDivElement>} className="tl" aria-label="Arrangement" data-tracks-view="arrangement" data-window={isFit(range, bounds) ? undefined : 'zoomed'}>
    <div className="tl-ruler" aria-label={`Ruler${set.ruler ? ` in ${set.ruler.unit}` : ''}`}>
      {rulerTools(view, range, bounds, anchor, set)}
      <div {...marksProps} className="tl-marks tl-window" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
        onPointerCancel={() => { gesture.current = null }} onKeyDown={onKeyDown}>
        {loopBand && <LoopBrace band={loopBand} words={loopWords} off={loopOff} />}
        {braceEnds}
        {marks.map(mark => <span key={mark.at} className={mark.end ? 'end' : undefined} style={{left: `${percentOf(mark.at, range)}%`}}>{label(mark.at)}</span>)}
        {occasionReadout}
        {spanBand && <i className="tl-span" role="img" aria-label={spanWords} title={spanWords} style={{left: `${spanBand.left}%`, width: `${spanBand.width}%`}} />}
        {markerMark}
        {playheadMark}
      </div>
    </div>
    {(set.lanes || set.mixer) && lanesBar}
    {lanesOfSections.map(lane => <div key={`sections:${lane.layerId ?? ''}`} className="tl-lane tl-sections" data-section-layer={lane.layerId}
      style={{'--levels': lane.levels} as CSSProperties}>
      <span className="tl-head tl-sections-head" title={`${lane.name} · sections · nested`}><span className="tl-lane-name">{lane.name}</span><small>sections</small></span>
      <div className="tl-body">
        {lane.items.map(({section, depth}) => {
          const from = held(section.span.start), to = held(section.span.end)
          if (to < range.start || from > range.end) return null
          // A section that began before the window is drawn from the window's edge, so its name stays in view; it has no edge there.
          const shownFrom = Math.max(from, range.start), shownTo = Math.min(to, range.end)
          return <button type="button" key={section.id} className="tl-sect" data-section={section.id} data-depth={depth} data-before={from < range.start || undefined}
            style={{left: pct(shownFrom), width: `${Math.max(0, shownTo - shownFrom) / span * 100}%`, '--depth': depth, ...(section.atmosphere ? {'--atm': section.atmosphere} : {})} as CSSProperties}
            title={`${section.name} · ${label(section.span.start)} – ${label(section.span.end)} · press to fit the window to it`}
            onClick={() => view.onWindow(clampRange({start: from, end: to}, bounds))}>{section.name}</button>
        })}
      </div>
    </div>)}
    {mainLast(set.tracks).flatMap((track, position, drawn) => {
      const ink = trackInk(track.color)
      const style = {'--tc': trackColour(track), ...(ink ? {'--tc-ink': ink} : {})} as CSSProperties
      const clips = placed.filter(p => p.clip.trackId === track.id)
      // A rail per level, in each ancestor's colour, as the Session draws them (manual §6).
      const rails = tree.ancestorsOf(track).map(trackColour)
      const stoppedNeedle = track.needle !== undefined && stalled.has(track.id)
      const age = stoppedNeedle && now !== undefined ? (set.ruler?.duration ?? plainDuration(set.ruler?.unit ?? ''))(Math.max(0, now - track.needle!)) : undefined
      const readout = stoppedNeedle ? `${track.name} · stalled${age ? ` ${age}` : ''}` : undefined
      // The head carries the track's mixer switches and, on a line under them, its Volume and Pan, as Live's Arrangement header does
      // (cap 43); a head with none is the name alone.
      const cells = mixerCells(set, track, position).filter(cell => cell.id !== 'input' && cell.id !== 'output')
      const headName = <>
        {rails.length > 0 && <span className="rails" aria-hidden="true">{rails.map((colour, i) => <i key={i} style={{background: colour}} />)}</span>}
        {track.name}{track.lane ? <small>{SIDE_WORD[track.lane]}</small> : null}{track.main ? <small>Main</small> : null}</>
      // a Shift- or ⌘-click chooses it with the parts chosen before (O9, partChoice.ts), so ⌘G groups them all
      // over the parts its heads draw, in their order, less the returns (0D item 9)
      const selectTrack = (event?: ReactMouseEvent<HTMLElement>) => chooseTrack(selection, set, track, drawn.filter(part => !part.main && !part.returns).map(part => part.id), event)
      const chosenTrack = selection.ref === track.id || chosen.includes(track.id)
      // The track's own device, opened from its head (trackHeads.ts; §18.1: the world's Workspace).
      const device = trackHeadDevice(track.id)
      const under = lanesUnder(set, track.id, lanesView.shown)
      const comps = (set.lanes?.comp ?? []).filter(stretch => stretch.trackId === track.id)
      const takeName = (takeId: string) => set.lanes?.takes?.find(take => take.id === takeId)?.name ?? takeId
      return [<div key={track.id} className={`tl-lane${track.lane ? ` lane-${track.lane}` : ''}`} style={{...style, ...(rails.length ? {'--rails': rails.length} : {})} as CSSProperties} data-track={track.id} data-off={track.mix?.activator === false ? 'true' : undefined} data-main={track.main ? 'true' : undefined} data-return={track.returns ? 'true' : undefined}>
        {cells.length || device
          ? <div className={`tl-head tl-track-head${chosenTrack ? ' sel' : ''}`}>
            <button type="button" className="tl-name" title={`${track.name} · ${track.kind}${track.info ? ` — ${track.info}` : ''}`} onClick={selectTrack}>{headName}</button>
            <TrackDeviceButton device={device} track={track} selection={selection} />
            {cells.length > 0 && <MixerRow cells={cells} shown routes={false} trackId={track.id} receipt={receipt} onPress={onPress} />}
            <MixerLevels cells={cells} trackId={track.id} receipt={receipt} onPress={onPress} />
          </div>
          : <button type="button" className={`tl-head${chosenTrack ? ' sel' : ''}`} title={`${track.name} · ${track.kind}${track.info ? ` — ${track.info}` : ''}`} onClick={selectTrack}>{headName}</button>}
        <div className="tl-body">
          {loopBand && <LoopBrace band={loopBand} words={loopWords} lane off={loopOff} />}
          {now !== undefined && <span className="tl-now" style={{left: pct(now)}} aria-hidden="true" />}
          {occasionAt !== undefined && <span className="tl-occ" style={{left: lineAt(occasionAt)}} aria-hidden="true" />}
          {marker !== undefined && <span className="tl-marker" style={{left: lineAt(marker)}} aria-hidden="true" />}
          {playhead !== undefined && <span className="tl-playhead" style={{left: lineAt(playhead)}} aria-hidden="true" />}
          {spanBand && <i className="tl-span" aria-hidden="true" style={{left: `${spanBand.left}%`, width: `${spanBand.width}%`}} />}
          {clips.map(({clip, start, end: stop}) => {
            const lengthless = !(stop > start)
            // A waiting clip with no length is a dash: nobody knows how long it will take. A point near the window's end (a dash,
            // or any clip with no length) reaches back from it instead of past the edge.
            const dash = clip.status === 'waiting' && lengthless
            const flip = lengthless && percentOf(held(start), range) > 85
            const word = clip.status ? STATUS_WORD[clip.status] : undefined
            const when = `${label(start)}${stop > start ? ` – ${label(stop)}` : ''}`
            const edge = clip.status === 'running' ? ' · no end is drawn: its needle is the edge' : dash ? ' · no length is drawn' : ''
            const mark = clipStandingMark(clip)
            const section = narrowestSectionOf(set, clip, trackOf.get(clip.trackId))
            const atmosphere = section?.atmosphere
            const width = `max(6px, ${((held(Math.max(stop, start)) - held(start)) / span) * 100}%)`
            const placeStyle: CSSProperties = dash ? (flip ? {right: `calc(100% - ${pct(start)})`} : {left: pct(start)}) : flip ? {right: `calc(100% - ${pct(start)})`, width} : {left: pct(start), width}
            // Its content (round 893): the content's seconds it plays, from where it starts in them, over the stretch the clip is drawn.
            const content = clip.content && !lengthless ? clip.content : undefined
            const drawnFrom = content ? content.from + held(start) - start : 0
            const contentMarksOf = content ? contentMarks(drawnFrom, held(stop) - held(start)) : []
            const fromWords = content && content.from > 0 ? set.ruler?.duration?.(content.from) ?? `${Math.round(content.from * 100) / 100}${content.unit ? ` ${content.unit}` : ''}` : ''
            return <button type="button" key={clip.id} data-clip={clip.id} data-clip-status={clip.status ?? 'undisclosed'}
              className={`tl-clip${clip.status ? ` ${clip.status}` : ''}${dash ? ' dash' : ''}${selection.ref === clip.id ? ' sel' : ''}`}
              style={{...placeStyle, ...(mark ? {borderLeft: clipStandingEdge(mark)} : {}), ...(atmosphere ? {'--atm': atmosphere} : {})} as CSSProperties}
              title={`${clip.label} · ${when}${word ? ` · ${word}` : ''}${edge}${clip.note ? ` · ${clip.note}` : ''}${clipStandingTitle(mark)}${section ? ` · in ${section.name}` : ''}${clip.source ? ` · ${clip.source.mark}: ${clip.source.said}` : ''}${fromWords ? ` · starts ${fromWords} into its own content` : ''}`}
              {...clipStandingAttributes(mark)} data-section={section?.id} data-source={clip.source?.standing} aria-label={mark ? clipAccessibleName(clip.label, mark) : undefined}
              data-cut-edge={cuts && carriesEdgeCuts(set) && !trackOf.get(clip.trackId)?.readOnly ? cuts.trim : undefined} {...clipDrag(clip, start, stop)}
              onClick={() => { if (!dragClick(clip.id)) selection.select({kind: 'clip', ref: clip.id, title: clip.label, track: clip.trackId}) }}>{dash ? `▸ ${clip.label}` : clip.label}{clipStandingTag(mark)}{clip.source ? ` · ${clip.source.mark}` : ''}{fromWords && <small className="tl-from"> · from {fromWords}</small>}
              {contentMarksOf.map(m => <i key={m.at} className={`tl-cm${m.major ? ' major' : ''}`} data-content-at={m.at} style={{left: `${m.left}%`}} aria-hidden="true" />)}</button>
          })}
          {preview && preview.point !== null && clips.some(p => p.clip.id === preview.clipId) && <span className="tl-cut" style={{left: lineAt(preview.point)}}
            role="img" aria-label={`${preview.words} to ${label(preview.point)}`} title={`${preview.words} to ${label(preview.point)}`} />}
          {comps.map((stretch, i) => <span key={`comp:${i}`} className="tl-comp" data-comp-take={stretch.takeId}
            style={{left: pct(stretch.start), width: `${Math.max(0, held(stretch.end) - held(stretch.start)) / span * 100}%`}}
            title={`${label(stretch.start)} – ${label(stretch.end)} came from ${takeName(stretch.takeId)}`}>{takeName(stretch.takeId)}</span>)}
          {track.needle !== undefined && <span className="tl-needle" style={{left: pct(track.needle)}} data-stalled={stoppedNeedle ? 'true' : undefined} data-edge={percentOf(held(track.needle), range) > 60 ? 'end' : undefined}
            title={readout ?? `${track.name} has got to ${label(track.needle)}`}>{readout && <span className="tl-readout">{readout}</span>}</span>}
        </div>
      </div>,
      ...under.takes.map((take, i) => takeLane(take, colourOf(track), i)),
      ...under.automation.map(lane => {
        const points = automationPoints(lane, clipId => placed.find(p => p.clip.id === clipId)?.start, range.end, clipId => placed.find(p => p.clip.id === clipId)?.end)
        const line = points.map(point => `${percentOf(point.at, range).toFixed(3)},${(100 - Math.min(1, Math.max(0, point.value)) * 100).toFixed(3)}`).join(' ')
        const reenable = set.actions?.reenable, unfreeze = set.actions?.unfreeze
        const key = `reenable:${lane.id}`, frozenKey = `frozen:${lane.id}`, unfreezeKey = `unfreeze:${lane.id}`
        const frozen = lane.frozen
        const receiptOf = (at: string) => receipt?.key === at ? (receipt.ok ? 'ok' : 'refused') : undefined
        // XT10 (round 889; §16.6 automation lanes): a drawable lane is drawn by dragging across it; on release the moves drawn, in the
        // lane's own time, go to the owner, which lays them over the stretch they cover. A looping clip's lane is not drawn here.
        const drawLane = set.actions?.drawLane, drawKey = `draw:${lane.id}`
        const drawBase = lane.clipId === undefined ? 0 : (() => { const lies = placed.find(p => p.clip.id === lane.clipId)?.start; return lies !== undefined ? lies - (lane.start ?? 0) : lane.clipAt })()
        const drawable = !!drawLane && lane.drawable === true && !frozen && !lane.loop && drawBase !== undefined
        const drawing = drawable && lanesView.draw?.laneId === lane.id ? lanesView.draw : null
        const sampleAt = (element: HTMLElement, clientX: number, clientY: number) => {
          const box = element.getBoundingClientRect()
          return box.width > 0 && box.height > 0 ? {at: range.start + (clientX - box.left) / box.width * span, value: 1 - (clientY - box.top) / box.height} : null
        }
        const drawProps = drawable ? {'data-draw': 'on', 'data-receipt': receiptOf(drawKey),
          title: `Drag across the lane to draw ${lane.device} / ${lane.parameter}'s moves: they lie over the stretch you draw (${drawLane!.op})`,
          onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => { if (event.button !== 0) return; const at = sampleAt(event.currentTarget, event.clientX, event.clientY); if (!at) return
            event.currentTarget.setPointerCapture?.(event.pointerId); lanesView.onDraw?.({laneId: lane.id, samples: [at]}) },
          onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => { if (!drawing || !(event.buttons & 1)) return; const at = sampleAt(event.currentTarget, event.clientX, event.clientY)
            if (at) lanesView.onDraw?.(current => current?.laneId === lane.id ? {laneId: lane.id, samples: [...current.samples, at]} : current) },
          onPointerUp: () => { if (!drawing) return; lanesView.onDraw?.(null); const points = drawnLane(drawing.samples, drawBase)
            if (points) onPress(drawKey, `Draw ${lane.parameter}`, () => drawLane!.run(lane.id, points)) },
          onPointerCancel: () => lanesView.onDraw?.(null)} : {}
        const draft = drawing ? drawing.samples.map(sample => `${percentOf(sample.at, range).toFixed(3)},${(100 - Math.min(1, Math.max(0, sample.value)) * 100).toFixed(3)}`).join(' ') : null
        return <div key={`auto:${lane.id}`} className="tl-lane tl-auto" data-automation={lane.id} data-overridden={lane.overridden ? 'true' : undefined} data-frozen={frozen ? 'true' : undefined} style={colourOf(track)}>
          <span className="tl-head tl-auto-head" title={`${lane.device} / ${lane.parameter}${lane.range ? ` · ${lane.range.min} – ${lane.range.max}` : ''}${lane.modulatedBy ? ` · moved by ${lane.modulatedBy}` : ''}${points.length ? ` · ${points.length} points` : ' · no points on this ruler'}${frozen ? ` · ${frozen}` : ''}`}>
            {/* A frozen take's lane (O-I #849 round 22): touched, it says the take is frozen, in words, and Unfreeze stands beside it. */}
            {frozen
              ? <button type="button" className="tl-lane-name tl-frozen" data-receipt={receiptOf(frozenKey)} title={frozen}
                onClick={() => onPress(frozenKey, `${lane.device} / ${lane.parameter}`, () => ({ok: true, note: frozen}))}>{lane.device} / {lane.parameter}</button>
              : <span className="tl-lane-name">{lane.device} / {lane.parameter}</span>}
            {lane.modulatedBy && <small className="tl-mod">{lane.modulatedBy}</small>}
            {lane.overridden && <button type="button" className="tl-reenable lit" disabled={!reenable} data-receipt={receiptOf(key)}
              title={reenable ? `Re-enable: give ${lane.parameter} back to its lane (${reenable.op})` : 'Re-enable: the owner gives no op that gives the value back'}
              onClick={() => { if (reenable) onPress(key, `Re-enable ${lane.parameter}`, () => reenable.run(lane.id)) }}>Re-enable</button>}
            {frozen && <button type="button" className="tl-reenable lit" disabled={!unfreeze} data-receipt={receiptOf(unfreezeKey)}
              title={unfreeze ? `Unfreeze: ${lane.device}'s part plays its live Torus again (${unfreeze.op})` : 'Unfreeze: the owner gives no op that lets the frozen take go'}
              onClick={() => { if (unfreeze) onPress(unfreezeKey, `Unfreeze ${lane.device}`, () => unfreeze.run(lane.id)) }}>Unfreeze</button>}
          </span>
          <div className="tl-body" {...drawProps}>
            {lane.modulatedBy && !points.length && <span className="tl-mod-band" aria-hidden="true" />}
            {points.length > 0 && <svg className="tl-auto-line" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={`${lane.device} / ${lane.parameter}: ${points.length} points`}>
              <polyline points={line} vectorEffect="non-scaling-stroke" />
            </svg>}
            {draft && <svg className="tl-auto-line tl-auto-draft" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <polyline points={draft} vectorEffect="non-scaling-stroke" />
            </svg>}
          </div>
        </div>
      }),
      ...under.events.map(lane => eventLane(lane, colourOf(track))),
      ...(railsUnder.get(track.id) ?? []).map(rail => railLane(rail, trackColour(track)))]
    })}
    {rails.filter(rail => rail.trackId === undefined).map(rail => railLane(rail))}
    {openedLane && openedEvent && <aside className="tl-event-open" role="dialog" aria-label={`${openedLane.name}: ${openedEvent.label}`} data-event={openedEvent.id}>
      <header><b>{openedLane.name}</b><span>{label(openedEvent.at)}</span>
        <button type="button" aria-label="Close" onClick={() => lanesView.onOpened(null)}>×</button></header>
      <p>{openedEvent.label}</p>
      {openedEvent.detail && <p className="tl-event-detail">{openedEvent.detail}</p>}
      {openedEvent.ref && <code>{openedEvent.ref}</code>}
    </aside>}
    {(receipt || left > 0) && <div className="tl-foot">
      {receipt && <p className="sg-receipt tl-receipt" role="status" data-ok={receipt.ok}>
        <b>{receipt.what}</b>
        <span title={receipt.text}>{receipt.text}</span>
        <button type="button" aria-label="Dismiss" onClick={onDismiss}>×</button>
      </p>}
      {left > 0 && <p className="tl-note" role="status">{left} {left === 1 ? 'clip has' : 'clips have'} no place on this ruler: its owner gives none. The Session grid holds {left === 1 ? 'it' : 'them'}.</p>}
    </div>}
    {overviewStrip}
    <RulerLegend set={set} stalled={stalled} now={now} />
  </div>
}

/** The states a clip lies in on the ruler, in the order the legend names them (dlw:arrangement-ruler's foot). */
const RULER_LEGEND = ['running', 'waiting', 'stopped', 'stalled'] as const
/** The ruler's legend (catalogue dlw__arrangement-ruler.tsx's foot): how each state lies on the ruler, and the lanes that have stalled, each
 * with how long since its needle stopped. */
function RulerLegend({set, stalled, now}: {set: WorldTrackSet; stalled: ReadonlySet<string>; now: number | undefined}) {
  const duration = set.ruler?.duration ?? plainDuration(set.ruler?.unit ?? '')
  const says = set.tracks.filter(track => track.needle !== undefined && stalled.has(track.id))
    .map(track => `${track.name} · stalled${now !== undefined ? ` ${duration(Math.max(0, now - track.needle!))}` : ''}`).join(' · ')
  return <footer className="sg-legend tl-legend" aria-label="Legend">
    {RULER_LEGEND.map(state => <span key={state} className="sg-key"><i data-status={state} />{STATUS_WORD[state]}</span>)}
    <span className="sg-says">{says || 'No lane has stalled'}</span>
  </footer>
}

// ---------------------------------------------------------------- the head column (round 892, XT01)
// Walk 891 found the column cutting what its heads hold: a track's name beside its Activator, Solo and Arm ("Dawn field: vis"), and the
// ruler's own tools and cut modes ("gri", "Inse"), in a column of 132 px whatever it held. The column is as wide as its widest head lays
// out — measured as the browser lays it out, so the face the shell is drawn in is the measure — and never under its own 132 px. Every head
// stands in the one column (tracks.css --tl-head-w), so the lanes keep in line. tests/arrangement-head-column-892.test.mjs guards it.

/** Fits the column again whenever what its heads hold changes (their words, and a lane's rails or colour); not while the Arrangement is not
 * laid out (a hidden pane measures nothing). */
function useHeadColumn(rootRef: RefObject<HTMLDivElement | null>) {
  const fitted = useRef<{node: HTMLElement; key: string} | null>(null)
  useLayoutEffect(() => {
    const node = rootRef.current
    if (!node || node.clientWidth === 0) return
    const key = [...node.querySelectorAll<HTMLElement>(HEADS)].map(head => `${head.textContent ?? ''}\u0001${head.parentElement?.getAttribute('style') ?? ''}`).join('\u0000')
    if (fitted.current?.node === node && fitted.current.key === key) return
    fitted.current = {node, key}
    fitHeadColumn(node)
  })
}

const numberHeld = (value: unknown): number | undefined => (typeof value === 'number' && Number.isFinite(value) ? value : undefined)
const oneOf = <T extends string>(value: unknown, modes: readonly {value: T}[] | readonly T[], otherwise: T): T =>
  (modes as readonly (T | {value: T})[]).some(mode => (typeof mode === 'string' ? mode : mode.value) === value) ? value as T : otherwise

/** The ruler's view state is its device's (rulerBinding.ts RULER_ID, parity D-26): the window, the snap, the insert marker, the lanes shown
 * and the cut modes (manual §16.6: Move default Insert, Trim default Trim) are the device's own holds, so the pane's ruler and every place
 * of the device read and write one of each. Unheld, what the pane starts with: the whole ruler, snap Grid, no marker, the default lanes. */
export function useRulerView() {
  const start = numberHeld(useHeld(RULER_ID, 'start')), span = numberHeld(useHeld(RULER_ID, 'span'))
  const at = numberHeld(useHeld(RULER_ID, 'marker'))
  const snap = oneOf<SnapMode>(useHeld(RULER_ID, 'snap'), SNAP_MODES, 'grid')
  const takes = useHeld(RULER_ID, 'laneTakes'), automation = useHeld(RULER_ID, 'laneAuto'), events = useHeld(RULER_ID, 'laneEvents')
  const moveMode = oneOf<MoveMode>(useHeld(RULER_ID, 'move'), MOVE_MODES, 'insert')
  const trimMode = oneOf<TrimMode>(useHeld(RULER_ID, 'trim'), TRIM_MODES, 'trim')
  return {
    shown: start !== undefined && span !== undefined ? {start, end: start + span} : null,
    setShown: (next: TimeRange | null) => { hold(RULER_ID, 'start', next ? next.start : undefined); hold(RULER_ID, 'span', next ? next.end - next.start : undefined) },
    snap, setSnap: (next: SnapMode) => hold(RULER_ID, 'snap', next),
    marker: at !== undefined && at >= 0 ? at : null, setMarker: (next: number | null) => hold(RULER_ID, 'marker', next === null ? undefined : next),
    shownLanes: {takes: typeof takes === 'boolean' ? takes : DEFAULT_LANES.takes, automation: typeof automation === 'boolean' ? automation : DEFAULT_LANES.automation,
      events: typeof events === 'boolean' ? events : DEFAULT_LANES.events} as LanesShown,
    setShownLanes: (next: LanesShown) => { hold(RULER_ID, 'laneTakes', next.takes); hold(RULER_ID, 'laneAuto', next.automation); hold(RULER_ID, 'laneEvents', next.events) },
    moveMode, setMoveMode: (next: MoveMode) => hold(RULER_ID, 'move', next),
    trimMode, setTrimMode: (next: TrimMode) => hold(RULER_ID, 'trim', next),
  }
}

/** The Arrangement: the view, with the state a ruler keeps — the window, the snap and the insert marker (the pane's
 * presentation, never the book's and never an owner's), and the owner's last answer to a rail's stop. */
export function ArrangementRuler({set, selection, empty}: {set: WorldTrackSet; selection: TracksSelection; empty?: string}) {
  // A mode naming its tracks' own devices again draws their head buttons (trackHeads.ts).
  useTrackHeadDevices()
  const {shown, setShown, snap, setSnap, marker, setMarker, shownLanes, setShownLanes, moveMode, setMoveMode, trimMode, setTrimMode} = useRulerView()
  const [span, setSpan] = useState<TimeRange | null>(null)
  const [width, setWidth] = useState(0)
  const [receipt, setReceipt] = useState<PressedReceipt | null>(null)
  const [take, setTake] = useState<TakeSelection | null>(null)
  const [laneDraw, setLaneDraw] = useState<LaneDraw | null>(null)
  const [braceDrag, setBraceDrag] = useState<BraceDrag | null>(null)
  const [opened, setOpened] = useState<{laneId: string; eventId: string} | null>(null)
  // The clip drag under way and what it draws.
  const [cutPreview, setCutPreview] = useState<CutPreview | null>(null)
  const clipDragRef = useRef<ClipDrag | null>(null)
  const latest = useRef(0)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const marksRef = useRef<HTMLDivElement | null>(null)
  const gesture = useRef<RulerGesture | null>(null)
  useHeadColumn(rootRef)
  const {end} = placeClips(set)
  const bounds = rangeBounds(end)
  const range = clampRange(shown ?? fitRange(bounds), bounds)
  // What the wheel and the pinch read, current at the event (they are bound once).
  const live = useRef({range, bounds})
  live.current = {range, bounds}

  // The stretch is shared with the set it was drawn on (tracksDoor.ts), for the commands that act on the range you select.
  useEffect(() => { publishShownSpan(span ? {set, range: span} : null) }, [span, set])
  useEffect(() => () => publishShownSpan(null), [])
  // The insert marker likewise, for the acts that place at it (a sample made a clip from the browser, DLW build ruling 2026-11-08, 0.9).
  useEffect(() => { publishShownMarker({set, at: marker}) }, [marker, set])
  useEffect(() => () => publishShownMarker(null), [])

  // The marks' width, for the 64px floor and the wheel's pan scale (nativeArrangementTimeline.tsx:82-90).
  useEffect(() => {
    const node = marksRef.current
    if (!node || typeof ResizeObserver === 'undefined') return
    const measure = () => setWidth(node.clientWidth)
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    measure()
    return () => observer.disconnect()
  }, [set.tracks.length > 0])

  // The wheel (nativeArrangementTimeline.tsx:92-111): ⌘/Ctrl zooms about the pointer, sideways or Shift pans, a plain wheel
  // scrolls the lanes. WebKit's pinch arrives as gesture events, so it zooms through the same rule.
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const apply = (next: TimeRange) => setShown(next)
    const anchorAt = (clientX: number): number | null => {
      const box = marksRef.current?.getBoundingClientRect()
      const {range: current} = live.current
      return box && box.width > 0 ? current.start + (clientX - box.left) / box.width * (current.end - current.start) : null
    }
    const onWheel = (event: WheelEvent) => {
      const {range: current, bounds: limits} = live.current
      if (event.ctrlKey || event.metaKey) {
        const anchor = anchorAt(event.clientX)
        if (anchor === null) return
        event.preventDefault()
        apply(zoomAround(current, anchor, wheelZoomFactor(event.deltaY), limits))
      } else if (event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
        const box = marksRef.current?.getBoundingClientRect()
        if (!box || box.width <= 0) return
        event.preventDefault()
        apply(panBy(current, (event.deltaX || event.deltaY) / (box.width / (current.end - current.start)), limits))
      }
    }
    let pinch = 1
    const onGestureStart = (event: Event) => { pinch = 1; event.preventDefault() }
    const onGestureChange = (event: Event) => {
      const gesture = event as Event & {scale?: number; clientX?: number}
      if (typeof gesture.scale !== 'number' || !(gesture.scale > 0)) return
      event.preventDefault()
      const anchor = anchorAt(gesture.clientX ?? 0) ?? (live.current.range.start + live.current.range.end) / 2
      apply(zoomAround(live.current.range, anchor, gesture.scale / pinch, live.current.bounds))
      pinch = gesture.scale
    }
    root.addEventListener('wheel', onWheel, {passive: false})
    root.addEventListener('gesturestart', onGestureStart)
    root.addEventListener('gesturechange', onGestureChange)
    return () => {
      root.removeEventListener('wheel', onWheel)
      root.removeEventListener('gesturestart', onGestureStart)
      root.removeEventListener('gesturechange', onGestureChange)
    }
  }, [set.tracks.length > 0])

  // An act whose owner answers with its own way back (a scene cut: the frame's labelled step, O-I #747 round 892) is listed for Undo under
  // the press's words — a drag's, the menu's and ⌘E's alike.
  const press = (key: string, what: string, run: () => unknown) => {
    const turn = ++latest.current
    setReceipt(null)
    void answerOf(ownerStepped({record: recordStep}, what, run)).then(answer => { if (answer && turn === latest.current) setReceipt(pressedIn(set, key, what, answer)) })
  }
  // A held launch's line follows its clip until it lands (round 886), as the Session's does.
  useEffect(() => { setReceipt(current => heldLaunchReceipt(current, set)) }, [set])
  // The receipt says the last act: Undo, Redo or another act listed changes the undo list, and clears it (O-I #747 round 893). A press's own
  // step is listed before its answer is shown (objectActions.ts ownerStepped), so its receipt comes after the clearing.
  useEffect(() => subscribeUndo(() => setReceipt(null)), [])
  // Every object's acts, after Live's: its menu, Live's keys on the selection, rename in place (frame/menu/TracksMenu.tsx). The host
  // takes no room of its own: it holds the ruler's events, and the ruler keeps its own root.
  const menu = useTracksMenu({set, selection, view: 'arrangement', press, marker, span})
  // The parts chosen with THE selection (O9): the view draws each as chosen on its head.
  const chosen = usePartChoice(selection.ref, set).parts
  return <div className="tracks-menu-host" ref={menu.rootRef} onContextMenu={menu.onContextMenu} onKeyDown={menu.onKeyDown}>
    <ArrangementRulerView set={set} selection={selection} empty={empty} receipt={receipt} onPress={press} chosen={chosen}
      lanes={{shown: shownLanes, onShown: setShownLanes, take, onTake: setTake, draw: laneDraw, onDraw: setLaneDraw, opened, onOpened: setOpened}}
      onDismiss={() => { latest.current += 1; setReceipt(null) }}
      view={{window: shown, onWindow: setShown, snap, onSnap: setSnap, marker, onMarker: setMarker, span, onSpan: setSpan, width, marksRef, rootRef, gesture,
        cuts: {move: moveMode, onMove: setMoveMode, trim: trimMode, onTrim: setTrimMode, drag: clipDragRef, preview: cutPreview, onPreview: setCutPreview},
        brace: {drag: braceDrag, onDrag: setBraceDrag}}} />
    {menu.layer}
  </div>
}

// ---------------------------------------------------------------- controls shared by the views

const SNAPS: readonly Option<SnapMode>[] = [
  {value: 'grid', label: 'Grid', does: 'The marker and the points snap to a twentieth of a mark. Hold Shift to free one press.'},
  {value: 'coarse', label: 'Coarse', does: 'The marker and the points snap to half a mark. Hold Alt to coarsen one press.'},
  {value: 'free', label: 'Free', does: 'The marker and the points do not snap.'},
]
const MOVES: readonly Option<string>[] = [
  {value: 'insert', label: 'Insert', does: 'A moved clip shifts the clips after it.'},
  {value: 'overwrite', label: 'Overwrite', does: 'A moved clip replaces what was there.'},
]
/** The compact plate has 50 px a column: Overwrite is written Over there. */
const MOVES_SHORT: readonly Option<string>[] = MOVES.map(o => ({...o, label: o.value === 'overwrite' ? 'Over' : o.label}))
const TRIMS: readonly Option<string>[] = [
  {value: 'trim', label: 'Trim', does: 'An edge drag changes the length of the clip.'},
  {value: 'roll', label: 'Roll', does: 'An edge drag moves the seam between two clips. One grows by what the other loses.'},
  {value: 'slip', label: 'Slip', does: 'A drag changes where the clip starts inside its own content.'},
  {value: 'slide', label: 'Slide', does: 'A drag moves the clip between its fixed neighbours.'},
]

const zoomDial = (p: ViewProps) => {
  const view = viewOf(p.v), span = view.range.end - view.range.start
  return <Dial label="Zoom" does="The span in view. Turn right to zoom in about the marker, or about the middle. Double-click to fit all." value={span} def={view.d.end}
    scale={{min: view.b.minSpan, max: view.d.end, log: true}} format={view.d.span} onChange={x => putWindow(p.set, zoomTo(p.v, view, x))} />
}
const lanesDial = (p: ViewProps) => <Dial label="Lanes" does="How many lanes show under the tracks. 1: Takes. 2: Takes and Automation. 3: Events too." value={laneLevel(p.v)} def={2}
  scale={{min: 0, max: 3, step: 1}} format={x => (x === 0 ? 'None' : x === 3 ? 'All' : `${x} of 3`)}
  onChange={x => { p.set('laneTakes', x >= 1); p.set('laneAuto', x >= 2); p.set('laneEvents', x >= 3) }} />
const snapRadio = (p: ViewProps) => <Radio label="Snap" does="How the marker and the loop points align." value={str(p.v, 'snap') as SnapMode} options={SNAPS} stack onChange={x => p.set('snap', x)} />
const moveRadio = (p: ViewProps, short?: boolean) => <Radio label="Move" does="What a moved clip does to its neighbours." value={str(p.v, 'move')} options={short ? MOVES_SHORT : MOVES} stack onChange={x => p.set('move', x)} />
const markerWord = (d: Data) => (x: number) => (x < 0 ? 'Off' : d.label(x))

const standingMark = (s: Standing) => <svg className="arp-line" viewBox="0 0 16 8" aria-hidden="true"><line x1="1" x2="15" y1="4" y2="4" stroke={standingOf(s).line} strokeWidth="2" strokeDasharray={standingOf(s).dash} /></svg>
/** The list Read by reads: the events by date, the hops of cause, the returns, or what stood at once. Pressing a row selects its event. */
function readRows(view: View, rel: Rel, sel: string): {label: string; items: RowItem[]; pick: (id: string) => string} {
  const d = view.d
  if (rel.by === 'cause' || rel.by === 'recurrence') {
    const items = rel.read.map((h): RowItem => ({
      id: h.e.id, name: rel.by === 'cause' ? `${h.a.label} → ${h.b.label}` : h.b.label, mark: standingMark(h.e.standing), tone: 'value', note: d.gap(h.a, h.b),
      light: rel.by === 'cause' ? (h.n !== undefined ? 'lit' : 'dark') : 'lit',
      does: rel.by === 'cause' ? `${h.n !== undefined ? `Hop ${h.n} of the chain` : 'A hop of another chain'}. ${standingOf(h.e.standing).label}.` : `Returns ${h.a.label}, ${d.gap(h.a, h.b)} on. ${standingOf(h.e.standing).label}.`,
    }))
    return {label: rel.by === 'cause' ? 'Hops' : 'Returns', items, pick: id => (rel.by === 'cause' ? rel.read.find(h => h.e.id === id)?.a.id : rel.read.find(h => h.e.id === id)?.b.id) ?? sel}
  }
  if (rel.by === 'concurrency') {
    const items = rel.once.map((o): RowItem => ({id: o.id, name: `${o.a.label} · ${o.b.label}`, light: 'lit', tone: 'value', note: `${d.label(o.lo, true)}–${d.label(o.hi, true)}`,
      does: `At once: the dates the sources allow overlap from ${d.label(o.lo, true)} to ${d.label(o.hi, true)}.`}))
    return {label: 'At once', items, pick: id => rel.once.find(o => o.id === id)?.a.id ?? sel}
  }
  const items = [...view.clips].sort((a, b) => a.at - b.at).map((c): RowItem => ({id: c.id, name: c.label, light: 'lit', tone: 'value', note: c.when ?? d.label(c.at, true),
    mark: c.standing ? standingMark(c.standing) : undefined, does: `${c.label}: ${c.when ?? d.label(c.at)}.${c.standing ? ` ${standingOf(c.standing).label}.` : ''}`}))
  return {label: 'Events', items, pick: id => id}
}

/** The Read page: Technē's timeline settings (§17.1). Factory's ruler measures one run, so they stand dimmed there. */
function ReadPage({p, picture}: {p: ViewProps; picture: ReactNode}) {
  const view = viewOf(p.v), rel = relOf(p.v, view), sel = str(p.v, 'sel'), list = readRows(view, rel, sel)
  const notTechne = view.d.mode === 'techne' ? undefined : 'Factory\'s ruler measures one run; it reads its tasks by time only.'
  const items = list.items
  return <>
    <Band>
      {picture}
      <Section label="Read" cols={2} grow>
        <Radio label="Time axis" does="Whether the ruler measures the history you study or the time of your sessions." value={str(p.v, 'axis')} options={AXES} stack disabled={notTechne}
          onChange={x => p.set('axis', x)} />
        <Radio label="Read by" does="How the events relate on the ruler." value={rel.by} options={READ_BYS} stack disabled={notTechne} onChange={x => p.set('readBy', x)} />
        <Toggle label="Edges" does="Show the relations between events, in the line of their standing. Placing two events side by side draws none." on={on(p.v, 'edges')} disabled={notTechne}
          onChange={x => p.set('edges', x)} />
      </Section>
    </Band>
    <Band>
      <Section label={list.label} grow>
        <Rows does="Press a row to select its event." items={items} selected={items.find(r => list.pick(r.id) === sel)?.id}
          empty={`The reading discloses no ${list.label.toLowerCase()} among the events shown.`} onSelect={id => p.set('sel', list.pick(id))} size={5} />
      </Section>
      <Section label="Readings" width={92}>
        <Readout big label="relations" does="Relations drawn, of all the reading discloses among the events shown." value={`${rel.drawn.length}/${rel.hops.length}`} tone="value" />
        <Readout label="axis" does={`The ruler measures ${view.d.unit}.`} value={view.d.unit} />
      </Section>
    </Band>
  </>
}

// ---------------------------------------------------------------- the device

export const design: DesignedDevice = {
  id: 'dlw:arrangement-ruler',
  title: 'Arrangement ruler',
  kind: 'instrument',
  firstPage: 'ruler',
  defaults: {
    light: 'lit', mode: 'factory',
    // The window: the last nine minutes of the run (a fixture state; the owner's default is the whole ruler).
    start: sec(27.4), span: NOW - sec(27.4), strip: true,
    laneTakes: true, laneAuto: true, laneEvents: false,
    snap: 'grid', move: 'insert', trim: 'trim',
    marker: -1, loop: true, loopIn: sec(33.0), loopOut: sec(35.5), sel: 'map',
    // Technē's timeline settings (§17.1): the owner's defaults.
    axis: 'history', readBy: 'chronology', edges: true,
  },
  fixtures: {
    'Factory run': {},
    'Zoomed on the stall': {start: sec(34.0), span: 240, marker: sec(34.62), snap: 'free', loop: false, laneEvents: true, sel: 'gen'},
    'Technē, stretched': {mode: 'techne', start: 0, span: UNITS, marker: -1, loop: false, laneTakes: false, laneAuto: false, sel: 'cave'},
    'Technē, by cause': {mode: 'techne', start: 0, span: UNITS, marker: -1, loop: false, laneTakes: false, laneAuto: false, readBy: 'cause', sel: 'rosinus'},
    'Technē, what returns': {mode: 'techne', start: 0, span: UNITS, marker: -1, loop: false, laneTakes: false, laneAuto: false, readBy: 'recurrence', sel: 'kadmon'},
    'Technē, at once': {mode: 'techne', start: 0, span: UNITS, marker: -1, loop: false, laneTakes: false, laneAuto: false, readBy: 'concurrency', sel: 'talmud'},
    'Your sessions': {mode: 'techne', axis: 'sessions', start: 0, span: UNITS, marker: -1, loop: false, laneTakes: false, laneAuto: false, sel: 'run214'},
  },

  folded: p => {
    const view = viewOf(p.v)
    return <Folded title="Arrangement" light={light(p.v)} readings={[view.d.word, view.d.span(view.range.end - view.range.start)]} onUnfold={p.nav.unfold} />
  },

  compact: p => {
    const view = viewOf(p.v), stalled = stalledOf(view)
    return <Panel title="Arrangement ruler" view="compact" light={light(p.v)} onFold={p.nav.fold} onFull={p.nav.full} onSelect={p.nav.select}>
      <Section width={152}>
        <Display w={140} h={146} label="Ruler" corner={stalled.length ? `${stalled.length} stalled` : view.d.span(view.range.end - view.range.start)}
          does="Tracks down, time across. Drag the ruler to move the window. Press a clip to select it. Drag handle 1 on the strip to zoom.">
          <Pic v={p.v} set={p.set} geo={COMPACT} uid="c" handles="window" />
        </Display>
      </Section>
      <Section label="Macros" cols={2}>
        {zoomDial(p)}
        {lanesDial(p)}
        {snapRadio(p)}
        {moveRadio(p, true)}
      </Section>
    </Panel>
  },

  whole: p => {
    const view = viewOf(p.v), d = view.d, span = view.range.end - view.range.start, stalled = stalledOf(view)
    const fit = isFitView(view)
    const shown = view.tracks.length
    const picture = <Section width={206}>
      <Display w={194} h={146} label="Ruler" corner={stalled.length ? `${stalled.length} stalled` : d.span(span)}
        does="Tracks down, time across. Drag the ruler to move the window, press it to set the marker, press a clip to select it. Handles move the window, the marker and the loop.">
        <Pic v={p.v} set={p.set} geo={WHOLE} uid="w" handles="all" />
      </Display>
    </Section>
    return <Panel title="Arrangement ruler" view="whole" light={light(p.v)} onFold={p.nav.fold} onFull={p.nav.full}
      pages={[{id: 'ruler', label: 'Ruler'}, {id: 'tracks', label: 'Tracks'}, {id: 'read', label: 'Read'}]} page={p.page} onPage={p.setPage}>
      {p.page === 'read' ? <ReadPage p={p} picture={picture} /> : p.page === 'tracks' ? <>
        <Band>
          {picture}
          <Section label="Tracks" grow>
            <Rows label="Shown" does="The tracks of the mode. The square is your request to show one; the light says the ruler draws it."
              items={d.tracks.map((t): RowItem => ({id: t.id, name: t.name, request: shownTrack(p.v, t), light: shownTrack(p.v, t) ? 'lit' : 'dark', tone: 'value',
                note: String(d.clips.filter(c => c.track === t.id).length), does: `${t.name}: drawn on the ruler.`, meter: <i className="arp-sw" style={{background: t.c}} />}))}
              onRequest={(id, x) => p.set(`show:${id}`, x)} size={7} />
          </Section>
        </Band>
        <Band>
          <Section label="Standing" width={210}>
            <Rows does="The classes of standing the mode discloses. They are not ranked. The square is your request to show the clips of a class."
              items={STANDINGS.map((s): RowItem => {
                const count = d.clips.filter(c => c.standing === s.id).length, disclosed = d.clips.some(c => c.standing)
                const shownNow = p.v[`st:${s.id}`] !== false
                return {id: s.id, name: s.label, request: shownNow, light: !disclosed ? 'unknown' : shownNow && count ? 'lit' : 'dark', tone: 'value', note: disclosed ? String(count) : undefined,
                  does: disclosed ? `${s.label}: ${count} clips.` : `${s.label}: this mode discloses no standing.`,
                  mark: <svg className="arp-line" viewBox="0 0 16 8" aria-hidden="true"><line x1="1" x2="15" y1="4" y2="4" stroke={s.line} strokeWidth="2" strokeDasharray={s.dash} /></svg>}
              })}
              onRequest={(id, x) => p.set(`st:${id}`, x)} size={6} />
          </Section>
          <Section label="Readings" cols={2} grow>
            <Readout big label="tracks" does="Tracks the ruler draws, of all the mode holds." value={`${shown}/${d.tracks.length}`} tone="value" />
            <Readout big label="clips" does="Clips on the ruler." value={view.clips.length} tone="value" />
            <Readout label="stalled" does="Threads whose needle has stopped." value={stalled.length} tone={stalled.length ? 'stall' : undefined} />
            <Readout label="ruler" does={`The ruler measures ${d.unit}. Its scale is ${d.scale}.`} value={d.unit} />
          </Section>
        </Band>
      </> : <>
        <Band>
          {picture}
          <Section label="View" cols={3} grow>
            {zoomDial(p)}
            <ValueBox label="Start" does="Where the window starts on the ruler." value={view.range.start} def={0} scale={{min: 0, max: Math.max(1, d.end - span)}} format={x => d.label(x, true)}
              disabled={fit ? 'The window shows the whole ruler.' : undefined} onChange={x => putWindow(p.set, clampRange({start: x, end: x + span}, view.b))} />
            <Toggle label="Overview" does="Show the whole ruler under the tracks, with the window marked." on={on(p.v, 'strip')} onChange={x => p.set('strip', x)} />
            <Readout label="ruler" does={`The ruler measures ${d.unit}.`} value={d.unit} />
            <Readout label="scale" does={d.mode === 'techne' ? 'Deep time keeps most of the ruler. Today takes the rest.' : 'Even: equal spans take equal width.'} value={d.scale} />
            <Readout label="stalled" does="Threads whose needle has stopped." value={stalled.length} tone={stalled.length ? 'stall' : undefined} />
          </Section>
        </Band>
        <Band>
          <Section label="Lanes" width={76}>
            <Toggle label="Takes" does="Show the takes under each clip." on={on(p.v, 'laneTakes')} onChange={x => p.set('laneTakes', x)} />
            <Toggle label="Automation" does="Show the recorded moves of a parameter under its track." on={on(p.v, 'laneAuto')} onChange={x => p.set('laneAuto', x)} tone="value" />
            <Toggle label="Events" does="Show the events inside the tasks under a thread." on={on(p.v, 'laneEvents')} onChange={x => p.set('laneEvents', x)} tone="value" />
          </Section>
          <Section label="Edit" cols={3} width={200}>
            {snapRadio(p)}
            {moveRadio(p)}
            <Radio label="Trim" does="What an edge drag does." value={str(p.v, 'trim')} options={TRIMS} stack onChange={x => p.set('trim', x)} />
          </Section>
          <Section label="Loop" cols={2} grow>
            <ValueBox label="Marker" does="The insert marker. Off removes it. It snaps by the Snap mode." value={num(p.v, 'marker')} def={-1} scale={{min: -1, max: d.end}} format={markerWord(d)}
              onChange={x => p.set('marker', x < 0 ? -1 : snapIn(view)(x))} />
            <Toggle label="Loop" does="Play and repeat only between the in and out points. In Factory, agents may write only inside them." on={on(p.v, 'loop')} onChange={x => p.set('loop', x)} />
            <ValueBox label="In" does="The loop's in point." value={num(p.v, 'loopIn')} def={0} scale={{min: 0, max: d.end}} format={x => d.label(x, true)}
              disabled={on(p.v, 'loop') ? undefined : 'Turn Loop on to set the points.'} onChange={x => p.set('loopIn', Math.min(snapIn(view)(x), num(p.v, 'loopOut') - view.b.minSpan))} />
            <ValueBox label="Out" does="The loop's out point." value={num(p.v, 'loopOut')} def={d.end} scale={{min: 0, max: d.end}} format={x => d.label(x, true)}
              disabled={on(p.v, 'loop') ? undefined : 'Turn Loop on to set the points.'} onChange={x => p.set('loopOut', Math.max(snapIn(view)(x), num(p.v, 'loopIn') + view.b.minSpan))} />
          </Section>
        </Band>
      </>}
    </Panel>
  },

  full: p => <RulerFull p={p} />,

  widget: p => {
    const view = viewOf(p.v), stalled = stalledOf(view)
    return <Tile title="Arrangement" light={light(p.v)} span={2} onFull={p.nav.full}>
      <div className="arp-tile">
        <Display w={266} h={56} label="Ruler" does="The whole ruler, thin. The frame marks the window. Press it to open the ruler at that moment.">
          <Thin v={p.v} set={p.set} w={266} h={56} onOpen={p.nav.full} />
        </Display>
        <div className="arp-tile-counts">
          <Readout big label="window" does="The span in view." value={view.d.span(view.range.end - view.range.start)} tone="value" />
          <Readout big label="stalled" does="Threads whose needle has stopped." value={stalled.length} tone={stalled.length ? 'stall' : undefined} />
          <Readout big label="clips" does="Clips on the ruler." value={view.clips.length} />
        </div>
      </div>
    </Tile>
  },
}
