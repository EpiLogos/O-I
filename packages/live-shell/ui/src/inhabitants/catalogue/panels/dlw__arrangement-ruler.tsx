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
import {useRef, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode} from 'react'
import {Band, Dial, Display, Folded, Handle, Panel, Radio, Readout, Rows, Section, Tile, Toggle, ValueBox, type LightState, type Option, type RowItem} from '../../sdk/panel'
import {clampTo, num, on, str, type DesignedDevice, type Values, type ViewProps} from './design'
import {clampRange, markStep, percentOf, rangeBounds, snapAt, windowMarks, zoomAround, type RangeBounds, type SnapMode, type TimeRange} from '../../../frame/tracks/rulerWindow'
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

/** Technē's Time axis chooses the ruler: the history you study, or the time of your sessions (§17.1 Settings). */
const dataOf = (v: Values): Data => (str(v, 'mode') !== 'techne' ? FACTORY : str(v, 'axis') === 'sessions' ? SESSIONS : TECHNE)

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
const isFit = (view: View) => view.range.start <= 0 && view.range.end >= view.d.end
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
  const fit = isFit(view)
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
  const loop = on(v, 'loop'), marker = num(v, 'marker'), fit = isFit(view)
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

// ---------------------------------------------------------------- the pane

function FullRuler({v}: {v: Values}) {
  const view = viewOf(v), {d, b, range} = view
  const span = range.end - range.start
  const pc = (at: number) => `${percentOf(clampTo(0, d.end, at), range)}%`
  const marks = windowMarks(range, b, 900)
  const marker = num(v, 'marker'), loop = on(v, 'loop'), chosen = str(v, 'sel')
  const lead = d.lanes && view.tracks.some(t => t.id === d.lanes!.track) ? d.lanes : undefined
  const stalled = stalledOf(view)
  const picked = view.clips.find(c => c.id === chosen)
  const inView = (a: number, e: number) => e >= range.start && a <= range.end
  const fit = isFit(view)
  const overview = (at: number) => `${at / d.end * 100}%`
  const needleText = (t: Track) => t.stalled ? `${t.name} · stalled ${d.span(Math.max(0, (d.now ?? d.end) - t.needle!))}` : undefined
  const rel = relOf(v, view), x10 = (at: number) => percentOf(clampTo(0, d.end, at), range) * 10
  const litHops = rel.read.filter(h => h.n !== undefined)
  const relSays = (c: Clip) => {
    if (rel.by === 'cause') return litHops.filter(h => h.a.id === c.id || h.b.id === c.id).map(h => ` · ${h.n}: ${h.a.label} → ${h.b.label}, ${d.gap(h.a, h.b)}`).join('')
    if (rel.by === 'recurrence') return rel.read.filter(h => h.b.id === c.id).map(h => ` · returns ${h.a.label}, ${d.gap(h.a, h.b)} on`).join('')
    if (rel.by === 'concurrency') return rel.once.filter(o => o.a.id === c.id || o.b.id === c.id).map(o => ` · at once with ${(o.a.id === c.id ? o.b : o.a).label}, ${d.label(o.lo, true)} to ${d.label(o.hi, true)}`).join('')
    return ''
  }
  return <div className="arp-pane" aria-label="Arrangement">
    <div className="arp-ruler" aria-label={`Ruler in ${d.unit}`}>
      <span className="arp-head arp-corner">{d.unit} · {d.scale}</span>
      <div className="arp-marks">
        {loop && <i className="arp-brace" style={{left: pc(num(v, 'loopIn')), width: `${(clampTo(0, d.end, num(v, 'loopOut')) - clampTo(0, d.end, num(v, 'loopIn'))) / span * 100}%`}} />}
        {marks.map(m => <span key={m.at} data-end={m.end || undefined} style={{left: `${percentOf(m.at, range)}%`}}>{d.label(m.at)}</span>)}
        {marker >= 0 && marker >= range.start && marker <= range.end && <span className="arp-marker-tag" style={{left: pc(marker)}}>{d.label(marker)}</span>}
      </div>
    </div>
    {d.sections.length > 0 && <div className="arp-lane" data-sections="true">
      <span className="arp-head"><span>{d.sectionWord}</span><small>sections</small></span>
      <div className="arp-body">
        {d.sections.filter(s => inView(s.from, s.to)).map(s => {
          const from = Math.max(s.from, range.start), to = Math.min(s.to, range.end)
          return <i key={s.id} className="arp-sect" style={{left: pc(from), width: `${(to - from) / span * 100}%`}} title={s.name}>{s.name}</i>
        })}
      </div>
    </div>}
    {view.tracks.map(t => {
      const clips = view.clips.filter(c => c.track === t.id)
      return [<div key={t.id} className="arp-lane" style={{'--tc': t.c} as CSSProperties}>
        <span className="arp-head" data-stalled={t.stalled || undefined}>{t.name}</span>
        <div className="arp-body">
          {loop && <i className="arp-brace" style={{left: pc(num(v, 'loopIn')), width: `${(clampTo(0, d.end, num(v, 'loopOut')) - clampTo(0, d.end, num(v, 'loopIn'))) / span * 100}%`, opacity: 0.6}} />}
          {d.now !== undefined && <i className="arp-now" style={{left: pc(d.now)}} />}
          {marker >= 0 && marker >= range.start && marker <= range.end && <i className="arp-marker" style={{left: pc(marker)}} />}
          {rel.once.filter(o => inView(o.lo, o.hi)).map(o => <i key={o.id} className="arp-once" style={{left: pc(Math.max(o.lo, range.start)), width: `max(2px, ${(Math.min(o.hi, range.end) - Math.max(o.lo, range.start)) / span * 100}%)`}} />)}
          {clips.map(c => {
            const point = c.end === undefined || !(c.end > c.at), flip = percentOf(clampTo(0, d.end, c.at), range) > 85
            const std = c.standing ? standingOf(c.standing) : undefined
            const place: CSSProperties = c.status === 'waiting'
              ? (flip ? {right: `calc(100% - ${pc(c.at)})`, width: 120} : {left: pc(c.at), width: 120})
              : {left: pc(Math.max(c.at, range.start)), width: `max(6px, ${point ? 0 : (Math.min(clampTo(0, d.end, c.end!), range.end) - Math.max(clampTo(0, d.end, c.at), range.start)) / span * 100}%)`}
            return <span key={c.id} className="arp-clip" data-status={c.status} data-sel={c.id === chosen || undefined} data-point={point && c.status !== 'waiting' || undefined}
              data-band={c.band || undefined} data-returns={rel.returns.get(c.id)}
              style={{...place, ...(std ? {borderLeft: `2px ${std.css} ${std.line}`} : {})}}>{c.status === 'waiting' ? `▸ ${c.label}` : point ? '' : c.label}</span>
          })}
          {t.needle !== undefined && <>
            <i className="arp-needle" data-stalled={t.stalled || undefined} style={{left: pc(t.needle)}} />
            {t.stalled && <span className="arp-readout" style={percentOf(t.needle, range) > 60 ? undefined : {right: 'auto', left: `calc(${pc(t.needle)} + 6px)`, borderRight: 0, borderLeft: '2px solid var(--arp-stall)'}}>{needleText(t)}</span>}
          </>}
        </div>
      </div>,
      // The relations lane: what Read by draws between this track's events, in the line of each relation's standing.
      (rel.drawn.some(h => h.a.track === t.id) || clips.some(c => rel.returns.has(c.id))) && <div key={`${t.id}-rel`} className="arp-lane" data-sub="true" data-rel="true" style={{'--tc': t.c} as CSSProperties}>
        <span className="arp-head"><span>{READ_BYS.find(o => o.value === rel.by)!.label}</span><small>{rel.drawn.filter(h => h.a.track === t.id).length}</small></span>
        <div className="arp-body">
          <svg viewBox="0 0 1000 26" preserveAspectRatio="none" aria-hidden="true">
            {rel.drawn.filter(h => h.a.track === t.id).map(h => {
              const xa = x10(h.a.at), xb = x10(h.b.at), s = standingOf(h.e.standing), lit = h.n !== undefined
              return <path key={h.e.id} vectorEffect="non-scaling-stroke" fill="none" d={`M${xa.toFixed(1)} 25Q${((xa + xb) / 2).toFixed(1)} -9 ${xb.toFixed(1)} 25`}
                stroke={lit ? 'var(--accent)' : s.line} strokeWidth={lit ? 1.6 : 1.1} strokeDasharray={s.dash} opacity={rel.by === 'cause' && !lit ? 0.45 : 1} />
            })}
          </svg>
          {litHops.filter(h => h.a.track === t.id).map(h => <span key={h.e.id} className="arp-hop" style={{left: `${(x10(h.a.at) + x10(h.b.at)) / 20}%`}}>{h.n} · {d.gap(h.a, h.b)}</span>)}
          {clips.filter(c => rel.returns.has(c.id)).map(c => <i key={c.id} className="arp-ret" style={{left: pc(c.at)}}>{rel.returns.get(c.id)! > 1 ? rel.returns.get(c.id) : ''}</i>)}
        </div>
      </div>,
      lead && lead.track === t.id && on(v, 'laneTakes') && clips.some(c => c.takes) && <div key={`${t.id}-takes`} className="arp-lane" data-sub="true" style={{'--tc': t.c} as CSSProperties}>
        <span className="arp-head"><span>takes</span></span>
        <div className="arp-body">{clips.filter(c => c.takes).map(c => Array.from({length: c.takes!}, (_, j) =>
          <i key={`${c.id}${j}`} className="arp-take" data-standing={j === c.takes! - 1 || undefined} style={{left: pc(c.at), width: `${(clampTo(0, d.end, c.end ?? c.at) - clampTo(0, d.end, c.at)) / span * 100}%`, top: 3 + j * 5}} />))}</div>
      </div>,
      lead && lead.track === t.id && on(v, 'laneAuto') && <div key={`${t.id}-auto`} className="arp-lane" data-sub="true" style={{'--tc': t.c} as CSSProperties}>
        <span className="arp-head"><span>{lead.auto.name}</span><small>recorded</small></span>
        <div className="arp-body"><svg viewBox="0 0 1000 18" preserveAspectRatio="none" aria-hidden="true">
          <path vectorEffect="non-scaling-stroke" fill="none" stroke="var(--rec)" strokeWidth={1.2}
            d={stepPath(lead.auto.points, at => percentOf(at, range) * 10, val => 16 - val * 14)} />
        </svg></div>
      </div>,
      lead && lead.track === t.id && on(v, 'laneEvents') && <div key={`${t.id}-events`} className="arp-lane" data-sub="true" style={{'--tc': t.c} as CSSProperties}>
        <span className="arp-head"><span>events</span><small>{lead.events.length}</small></span>
        <div className="arp-body">{lead.events.map(([name, at], i) => <i key={i} className="arp-ev" style={{left: pc(at)}} title={name} />)}</div>
      </div>]
    })}
    {view.tracks.length === 0 && <div className="arp-empty">No tracks shown.</div>}
    {on(v, 'strip') && <div className="arp-over" style={{marginTop: 'auto'}}>
      <span className="arp-head arp-corner">whole ruler</span>
      <div className="arp-over-body">
        {view.clips.map(c => <i key={c.id} style={{left: overview(c.at), width: `max(2px, ${((c.end ?? c.at) - c.at) / d.end * 100}%)`, top: 2 + Math.max(0, view.tracks.findIndex(t => t.id === c.track)) * 2.6, '--tc': view.tracks.find(t => t.id === c.track)!.c} as CSSProperties} />)}
        <i className="arp-over-win" style={{left: overview(range.start), width: `${span / d.end * 100}%`, opacity: fit ? 0.5 : 1}} />
      </div>
    </div>}
    <footer className="arp-bar">
      {d.mode === 'factory'
        ? (['running', 'waiting', 'stopped', 'stalled'] as const).map(s => <span key={s} className="arp-key"><i data-status={s} />{s[0]!.toUpperCase() + s.slice(1)}</span>)
        : STANDINGS.map(s => <span key={s.id} className="arp-key"><svg width="16" height="8" aria-hidden="true"><line x1="1" x2="15" y1="4" y2="4" stroke={s.line} strokeWidth="2" strokeDasharray={s.dash} /></svg>{s.label}</span>)}
      <span className="arp-says">{stalled.length ? `${stalled.map(t => needleText(t)).join(' · ')}` : picked ? `${picked.label} · ${picked.when ?? d.label(picked.at)}${picked.standing ? ` · ${standingOf(picked.standing).label.toLowerCase()}` : ''}${relSays(picked)}` : `${view.clips.length} clips on ${view.tracks.length} tracks`}</span>
    </footer>
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
  const items = list.items.length ? list.items : [{id: 'none', name: 'None disclosed', light: 'unknown' as const, does: `The reading discloses no ${list.label.toLowerCase()} among the events shown.`}]
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
          onSelect={id => { if (id !== 'none') p.set('sel', list.pick(id)) }} size={5} />
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
    const fit = isFit(view)
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

  full: p => <FullRuler v={p.v} />,

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
