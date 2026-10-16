// The Timeline (manual §17.5): Technē's research instrument, time laid out. Live's nearest: Wavetable's oscillator beside its
// envelope, a ruler with a bracket that you move. The owner is the research frame (field-studies-journeys: researchInstruments.tsx
// m2Projection and the vendored TimelineLens toolbar, sharedTimeWindow.tsx, relationFieldView.tsx) and Technē's timeline model
// (src/techne/m0m5/timeline: scale, timeAxis, relations, standing, lanes). The sample is the Archetypal Earth reading of Adam:
// nine occurrences with the dates in the source's own words, and the relations that join them.
// Everything the picture shows is a value. `events` and `edges` are JSON lists (an occurrence: id, name, family, cat, from, to and
// the date in the source's words as label; a relation: id, from, to, kind and st, its standing); `views` is a JSON list of the saved
// views (id, label and what each keeps: centre, zoom, lens, links and the card filters); `domFrom` and `domTo` are the reading's
// time domain. The sample sits in `defaults`. A key the owner does not report is absent: the well then says which reading is missing
// in words, and every control and reading draws "—". The words kept here (the lenses, the standing classes, the card categories, the
// relation projections and their reasons) are the product's own vocabulary, not the owner's data.
import {Action, Band, Chooser, Dial, Display, Folded, Handle, Panel, Radio, Readout, Rows, Section, Tile, Toggle, ValueBox, type LightState, type RowItem, type Standing as Stand} from '../../sdk/panel'
import {NONE, boolOf, clampTo, has, json, numOf, st, strOf, type DesignedDevice, type Value, type ViewProps} from './design'
import './techne__timeline.css'

type V = ViewProps['v']

// ---------------------------------------------------------------- the product's words

type Cat = 'source' | 'myth' | 'claim'
const CATS: readonly {id: Cat; label: string; tone: string}[] = [
  {id: 'source', label: 'Source', tone: 'var(--dp-value)'}, {id: 'myth', label: 'Myth', tone: 'var(--sel)'}, {id: 'claim', label: 'Claim', tone: 'var(--stall)'},
]
const toneOf = (cat: string) => CATS.find(c => c.id === cat)?.tone ?? 'var(--text-faint)'

/** The standing classes (techne/m0m5/timeline/standing.ts) with the stroke the relation field draws each in. */
const STANDINGS = [
  {id: 'sourced', label: 'Sourced', dash: undefined, tone: 'var(--green)'},
  {id: 'derived', label: 'Derived', dash: '5 3', tone: 'var(--sel)'},
  {id: 'authored', label: 'Authored', dash: undefined, tone: 'var(--dp-value)'},
  {id: 'disputed', label: 'Disputed', dash: '2 3', tone: 'var(--rec)'},
  {id: 'mythic', label: 'Mythic', dash: '1 4', tone: 'var(--dp-on)'},
  {id: 'unavailable', label: 'Unknown', dash: '3 5', tone: 'var(--text-faint)'},
] as const
type Standing = (typeof STANDINGS)[number]['id']
const standingOf = (id: string) => STANDINGS.find(s => s.id === id) ?? STANDINGS[STANDINGS.length - 1]

const MODE_KINDS: Readonly<Record<string, readonly string[]>> = {relations: ['cause', 'echo'], cause: ['cause'], echo: ['echo'], opposition: [], phase: [], activity: []}
const MODES = [
  {value: 'relations', label: 'All relations', does: 'Every relation the reading discloses.'}, {value: 'cause', label: 'Cause', does: 'Causal and dependency relations.'},
  {value: 'echo', label: 'Recurrence', does: 'Echoes and recurrences between occurrences.'}, {value: 'opposition', label: 'Opposition', does: 'Opposition and transformation.'},
  {value: 'phase', label: 'Phase', does: 'Validity spans and cycles.'}, {value: 'activity', label: 'Activity', does: 'Days, NOWs, sessions and runs.'},
] as const
/** The owner's reason when a projection has nothing to draw (availabilityVoice.ts PROJECTION_REASONS), on two short lines. */
const REASON: Readonly<Record<string, readonly [string, string]>> = {
  relations: ['No relations are', 'disclosed.'], cause: ['No cause relations', 'are disclosed.'], echo: ['No echo relations', 'are disclosed.'],
  opposition: ['No opposition relations', 'are disclosed.'], phase: ['No validity spans or', 'cycles are disclosed.'], activity: ['No DAY, NOW, session', 'or run facets disclosed.'],
}
const REL_MARKS = [{step: '0', name: 'DAY'}, {step: '+1', name: 'NOW'}, {step: '+2', name: 'Session'}, {step: '+3', name: 'Run'}] as const
const WORK_KEYS = ['workDay', 'workNow', 'workSession', 'workRun'] as const
/** What a saved view may set (researchMaterial.ts TimelineViewRecord): a camera, a projection, the links and the card filters. */
const VIEW_KEYS: readonly string[] = ['centre', 'zoom', 'lens', 'links', ...CATS.map(c => `cat_${c.id}`)]

const ZOOM = {min: 1e-9, max: 3.155e13, log: true}   // scale.ts MIN_PIXELS_PER_YEAR, MAX_PIXELS_PER_YEAR
const NO_LENS = 'No reading of the lens.'

/** A record's own key (never one inherited from Object). */
function own<T>(rec: Readonly<Record<string, T>>, key: string | undefined): T | undefined {
  return key !== undefined && Object.prototype.hasOwnProperty.call(rec, key) ? rec[key] : undefined
}
const kindsOf = (mode: string | undefined): readonly string[] => own(MODE_KINDS, mode) ?? []

// ---------------------------------------------------------------- the reading: what the owner reports, read without trust

const isRec = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)
const finite = (x: unknown): number | undefined => (typeof x === 'number' && Number.isFinite(x) ? x : undefined)
const text = (x: unknown): string => (typeof x === 'string' ? x : '')
/** A number the owner reports, or undefined when it is absent or not a number. */
const finiteOf = (v: V, key: string): number | undefined => finite(numOf(v, key))
/** A number above zero (a zoom, a width), or undefined. */
const posOf = (v: V, key: string): number | undefined => { const x = finiteOf(v, key); return x !== undefined && x > 0 ? x : undefined }
/** A JSON list the owner reports, or undefined when the key is absent or does not read as a list. */
const listOf = (v: V, key: string): unknown[] | undefined => { const x = json<unknown>(v, key, undefined); return Array.isArray(x) ? x : undefined }

/** An occurrence with the extent its date allows (none when the reading holds no date for it) and the date in the source's words. */
interface Ev {readonly id: string; readonly name: string; readonly family: string; readonly cat: string; readonly label: string; readonly from?: number; readonly to?: number}
type Placed = Ev & {readonly from: number; readonly to: number}
const isPlaced = (e: Ev): e is Placed => e.from !== undefined && e.to !== undefined
const mid = (e: Placed) => (e.from + e.to) / 2
/** Echo joins occurrences that share a family or a culture; a relation of unreadable standing is Unknown. */
interface Edge {readonly id: string; readonly from: string; readonly to: string; readonly kind: string; readonly st: Standing}
interface Model {
  readonly events: readonly Ev[]
  readonly haveEvents: boolean
  readonly edges: readonly Edge[]
  readonly haveEdges: boolean
  readonly at: (id: string) => Ev | undefined
}

function modelOf(v: V): Model {
  const rawEvents = listOf(v, 'events'), rawEdges = listOf(v, 'edges'), byId = new Map<string, Ev>()
  for (const x of rawEvents ?? []) {
    if (!isRec(x) || typeof x.id !== 'string' || typeof x.name !== 'string' || byId.has(x.id)) continue
    const a = finite(x.from), b = finite(x.to), from = a ?? b, to = b ?? a
    const base = {id: x.id, name: x.name, family: text(x.family), cat: text(x.cat), label: text(x.label)}
    byId.set(x.id, from !== undefined && to !== undefined ? {...base, from, to} : base)
  }
  const edges: Edge[] = []
  for (const x of rawEdges ?? []) {
    if (!isRec(x) || typeof x.from !== 'string' || typeof x.to !== 'string' || !byId.has(x.from) || !byId.has(x.to)) continue
    edges.push({id: typeof x.id === 'string' ? x.id : `${x.from}>${x.to}`, from: x.from, to: x.to, kind: text(x.kind), st: STANDINGS.find(s => s.id === x.st)?.id ?? 'unavailable'})
  }
  return {events: [...byId.values()], haveEvents: rawEvents !== undefined, edges, haveEdges: rawEdges !== undefined, at: id => byId.get(id)}
}

/** A saved view: a name and what it sets (researchMaterial.ts TimelineViewRecord). A list of views, or a record of them by id. */
interface SavedView {readonly id: string; readonly label: string; readonly sets: Readonly<Record<string, Value>>}
function viewsOf(v: V): SavedView[] {
  const raw = json<unknown>(v, 'views', undefined)
  const rows: [string, unknown][] = Array.isArray(raw) ? raw.map(x => [isRec(x) ? text(x.id) : '', x]) : isRec(raw) ? Object.entries(raw) : []
  const out: SavedView[] = []
  for (const [id, x] of rows) {
    if (!id || !isRec(x) || out.some(s => s.id === id)) continue
    const sets: Record<string, Value> = {}
    for (const [k, val] of Object.entries(x)) {
      if (VIEW_KEYS.includes(k) && (typeof val === 'string' || typeof val === 'boolean' || (typeof val === 'number' && Number.isFinite(val)))) sets[k] = val
    }
    out.push({id, label: text(x.label) || id, sets})
  }
  return out
}

type Lens = 'chronology' | 'relations' | 'relative'
const lensOf = (v: V): Lens | undefined => { const s = strOf(v, 'lens'); return s === 'chronology' || s === 'relations' || s === 'relative' ? s : undefined }
/** Whether the reading is dated: as the owner says, else as its events say (some occurrence holds a date). Unknown with neither. */
const datedOf = (v: V, m: Model): boolean | undefined => boolOf(v, 'dated') ?? (m.haveEvents ? m.events.some(isPlaced) : undefined)
const zeroOf = (v: V): string | undefined => strOf(v, 'relZero') || undefined
/** The reading's time domain, or undefined when the owner has not given both ends. */
const domOf = (v: V): readonly [number, number] | undefined => { const a = finiteOf(v, 'domFrom'), b = finiteOf(v, 'domTo'); return a !== undefined && b !== undefined && b > a ? [a, b] : undefined }
const spanYears = (v: V): number | undefined => { const w = posOf(v, 'paneW'), z = posOf(v, 'zoom'); return w !== undefined && z !== undefined ? w / z : undefined }
const camera = (v: V): readonly [number, number] | undefined => { const c = finiteOf(v, 'centre'), s = spanYears(v); return c !== undefined && s !== undefined ? [c - s / 2, c + s / 2] : undefined }
/** The window read over: its ends when on, null when off, undefined when the owner does not say. */
const readWin = (v: V): readonly [number, number] | null | undefined => {
  const on = boolOf(v, 'readOn')
  if (on === undefined) return undefined
  if (!on) return null
  const a = finiteOf(v, 'readFrom'), b = finiteOf(v, 'readTo')
  return a !== undefined && b !== undefined ? [a, b] : undefined
}
const inScope = (e: Ev, w: readonly [number, number] | null | undefined) => !w || e.from === undefined || e.to === undefined || (e.to >= w[0] && e.from <= w[1])

const catKnown = (v: V) => CATS.every(c => has(v, `cat_${c.id}`))
const stKnown = (v: V) => STANDINGS.every(s => has(v, `st_${s.id}`))
/** An occurrence a card filter holds back is not drawn; one outside every category has no filter. */
const cardOn = (v: V, e: Ev) => (CATS.some(c => c.id === e.cat) ? boolOf(v, `cat_${e.cat}`) === true : true)
const shownEvents = (v: V, m: Model): Ev[] => m.events.filter(e => cardOn(v, e))
/** The relations the lens draws; undefined when a reading it needs is missing. */
function edgesRead(v: V, m: Model): readonly Edge[] | undefined {
  if (!m.haveEvents || !catKnown(v)) return undefined
  const rel = lensOf(v) === 'relations', mode = strOf(v, 'mode'), kinds = kindsOf(mode)
  if (rel && mode === undefined) return undefined
  if (rel && kinds.length === 0) return []
  if (!m.haveEdges || (rel && !stKnown(v))) return undefined
  const ids = new Set(shownEvents(v, m).map(e => e.id))
  return m.edges.filter(e => ids.has(e.from) && ids.has(e.to) && (!rel || (kinds.includes(e.kind) && boolOf(v, `st_${e.st}`) === true)))
}
/** The readings the picture needs and the owner has not given, in words. */
function lacks(v: V, m: Model): string[] {
  const ln = lensOf(v)
  if (ln === undefined) return ['the lens']
  if (ln === 'relative') return []
  const dated = datedOf(v, m)
  if (dated === undefined) return ['the events']
  if (ln === 'chronology' && dated === false) return []
  const out: string[] = []
  if (!m.haveEvents) out.push('the events')
  else if (!catKnown(v)) out.push('the card filters')
  if (dated && !domOf(v)) out.push('the time domain')
  if (ln === 'chronology') {
    if (dated && !camera(v)) out.push('the view')
    if (boolOf(v, 'links') === true && m.haveEvents && !m.haveEdges) out.push('the relations')
  } else {
    const mode = strOf(v, 'mode')
    if (mode === undefined) out.push('the relations mode')
    else if (kindsOf(mode).length > 0) {
      if (!stKnown(v)) out.push('the standing filters')
      if (m.haveEvents && !m.haveEdges) out.push('the relations')
    }
  }
  return out
}

const shownIn = (v: V, m: Model): number | undefined => (m.haveEvents && catKnown(v) ? shownEvents(v, m).length : undefined)
const outside = (v: V, m: Model): number | undefined => {
  const w = readWin(v), n = shownIn(v, m)
  return w === undefined || n === undefined ? undefined : w ? shownEvents(v, m).filter(e => !inScope(e, w)).length : 0
}

const yearText = (y: number) => (y < 0 ? `${Math.abs(Math.round(y))} BCE` : `${Math.round(y)}`)
const spanText = (y: number) => (y >= 1e6 ? `${(y / 1e6).toFixed(1)} Myr` : y >= 1000 ? `${(y / 1000).toFixed(1)}k yr` : `${Math.round(y)} yr`)
const zoomText = (z: number) => `${z >= 100 ? Math.round(z) : z >= 1 ? z.toFixed(1) : z >= 0.01 ? z.toFixed(2) : z.toExponential(0)} px/yr`
const windowText = (v: V) => { const w = readWin(v); return w === undefined ? NONE : w ? `${yearText(w[0])}–${yearText(w[1])}` : 'All time' }
const lensLabel = (v: V) => { const ln = lensOf(v); return ln === 'relations' ? 'Relations' : ln === 'relative' ? 'Relative' : ln === 'chronology' ? 'Chronology' : NONE }

// ---------------------------------------------------------------- the laws the picture draws by

/** Ticks every `step` years between two years; a span the step would crowd draws none. */
const ticksAt = (from: number, to: number, step: number): number[] => {
  const t: number[] = []
  for (let y = Math.ceil(from / step) * step; y <= to && t.length < 400; y += step) t.push(y)
  return t
}
/** The major step: 500 years, or a power of ten above it when `most` ticks would be crowded. */
const stepFor = (span: number, most: number) => { let s = 500; while (span / s > most) s *= 10; return s }
/** The width of one bin of the density strip: 100 years, or a power of ten above it. */
const binWidth = (d0: number, d1: number) => { let b = 100; while ((d1 - d0) / b > 200) b *= 10; return b }
const binsOf = (events: readonly Placed[], d0: number, d1: number, bw: number): number[] => {
  const n: number[] = []
  for (let b = Math.floor(d0 / bw); b * bw < d1 && n.length < 400; b++) n.push(events.filter(e => Math.floor(mid(e) / bw) === b).length)
  return n
}
const words = (list: readonly string[]) => (list.length < 2 ? list.join('') : `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`)
const wrap = (line: string, max: number): string[] => {
  const lines: string[] = []
  for (const word of line.split(' ')) {
    const last = lines[lines.length - 1]
    if (last !== undefined && last.length + 1 + word.length <= max) lines[lines.length - 1] = `${last} ${word}`
    else lines.push(word)
  }
  return lines
}

/** A few short lines of text in the well. */
function Note({x, y, lines, anchor = 'middle'}: {x: number; y: number; lines: readonly string[]; anchor?: 'start' | 'middle'}) {
  return <>{lines.map((t, i) => <text key={i} x={x} y={y + i * 11} className="dp-axis" textAnchor={anchor}>{t}</text>)}</>
}

/** A relation as an arc between two marks on one line, its stroke the relation's standing. */
function Arc({x1, x2, y, st: kind, dim, chain}: {x1: number; x2: number; y: number; st: string; dim?: boolean; chain?: number}) {
  const s = standingOf(kind), lift = Math.min(54, Math.max(10, Math.abs(x2 - x1) * 0.32))
  return <g opacity={dim ? 0.35 : 1}>
    <path d={`M${x1} ${y}Q${(x1 + x2) / 2} ${y - 2 * lift} ${x2} ${y}`} fill="none" stroke={s.tone} strokeWidth={1.3} strokeDasharray={s.dash} />
    {chain !== undefined && <text x={(x1 + x2) / 2} y={y - lift - 3} className="dp-axis" textAnchor="middle">{chain}</text>}
  </g>
}

// ---------------------------------------------------------------- the display: the ruler in miniature

const PAD = 9
/** `p` is the view's props where the ruler is live (the marks and handles act); the widget draws it without. */
function Ruler({v, p, w, h, whole, tile}: {v: V; p?: ViewProps; w: number; h: number; whole?: boolean; tile?: boolean}) {
  const set = p?.set, m = modelOf(v), ln = lensOf(v), dated = datedOf(v, m), dm = domOf(v), cam = camera(v), win = readWin(v)
  const lack = lacks(v, m), shownEv = shownEvents(v, m), edges = edgesRead(v, m), zero = zeroOf(v), mode = strOf(v, 'mode')
  const can = (key: string) => !!p && !st(p, key).disabled
  const rel = ln === 'relations', axisY = tile ? h - 22 : h - 42, winY = axisY + 32, laneY = rel ? 58 : axisY
  const work = WORK_KEYS.map(k => finiteOf(v, k))
  const activity = rel && mode === 'activity' && work.some(x => x !== undefined)
  const reasonKey = rel && !activity && edges && edges.length === 0 && mode !== undefined ? (m.edges.some(e => kindsOf(mode).includes(e.kind)) ? 'filtered' : mode) : ''
  const said = lack.length ? <Note x={w / 2} y={rel ? laneY - 10 : h / 2 - 10} lines={wrap(`No reading of ${words(lack)}.`, Math.floor((w - 16) / 4.6))} /> : null
  const corner = ln === 'chronology' ? (dated === false ? 'undated' : dated === true && cam ? `${yearText(cam[0])}–${yearText(cam[1])}` : NONE)
    : ln === 'relations' ? (edges ? `${edges.length} links` : NONE) : ln === 'relative' ? 'steps' : NONE

  /** What a relations lens says besides its arcs: its lane, the owner's reason for an empty projection, and the work counts. */
  const relNotes = <>
    {rel && !tile && <text x={4} y={laneY - 8} className="dp-axis">{dated ? 'Dated' : 'Undated'}</text>}
    {reasonKey && (reasonKey === 'filtered' ? <Note x={w / 2} y={laneY - 10} lines={['No relations in this', 'projection after the filter.']} /> : <Note x={w / 2} y={laneY - 10} lines={own(REASON, reasonKey) ?? []} />)}
    {activity && <g>{WORK_KEYS.map((k, i) => {
      const n = work[i], mx = Math.max(1, ...work.map(q => q ?? 0))
      return <g key={k}><text x={PAD} y={laneY + i * 14 - 8} className="dp-axis">{REL_MARKS[i]!.name}</text>
        {n !== undefined ? <><rect x={52} y={laneY + i * 14 - 14} width={Math.max(1, n / mx * (w - 82))} height={8} className="dp-fill-on" /><text x={w - PAD} y={laneY + i * 14 - 7} className="dp-ink-dim" textAnchor="end">{n}</text></>
          : <text x={52} y={laneY + i * 14 - 8} className="dp-axis">{NONE}</text>}</g> })}</g>}
  </>

  const relative = <g>
    <path d={`M16 ${h / 2 - 8}H${w - 16}`} className="dp-faint" />
    {REL_MARKS.map((mk, i) => { const x = 22 + i * (w - 44) / (REL_MARKS.length - 1); return <g key={mk.step}>
      <path d={`M${x} ${h / 2 - 14}v${i ? 12 : 20}`} className={i ? 'dp-faint' : 'dp-curve-on'} />
      <text x={x} y={h / 2 - 20} className="dp-ink" textAnchor="middle">{mk.step}</text><text x={x} y={h / 2 + 18} className="dp-axis" textAnchor="middle">{mk.name}</text></g> })}
    {!tile && <Note x={w / 2} y={h - 24} lines={[`Steps from ${zero ?? NONE}.`, 'No calendar year.']} />}
  </g>

  // No dates: nothing is placed on a ruler; the relations lens lays the occurrences out in order.
  const undated = () => {
    const x = (k: number) => 22 + k * (w - 44) / Math.max(1, shownEv.length - 1)
    return <>
      {ln === 'chronology' && <Note x={w / 2} y={h / 2 - 4} lines={['No dates disclosed.', 'Nothing is placed on the ruler.']} />}
      {rel && relNotes}{rel && said}
      {rel && shownEv.map((e, i) => <circle key={e.id} cx={x(i)} cy={laneY} r={3.4} fill="var(--dp-well)" stroke={toneOf(e.cat)} strokeWidth={1.4} />)}
      {rel && (edges ?? []).map(e => {
        const i = shownEv.findIndex(s => s.id === e.from), j = shownEv.findIndex(s => s.id === e.to)
        return i < 0 || j < 0 ? null : <Arc key={e.id} x1={x(i)} x2={x(j)} y={laneY} st={e.st} />
      })}
    </>
  }

  const datedBody = ([d0, d1]: readonly [number, number]) => {
    const X = (y: number) => PAD + (y - d0) / (d1 - d0) * (w - 2 * PAD)
    const Yr = (x: number) => d0 + (x - PAD) / (w - 2 * PAD) * (d1 - d0)
    const placed = shownEv.filter(isPlaced), majors = ticksAt(d0, d1, stepFor(d1 - d0, 8)), bw = binWidth(d0, d1), bins = binsOf(placed, d0, d1, bw)
    const wf = finiteOf(v, 'winFrom'), wt = finiteOf(v, 'winTo'), centre = finiteOf(v, 'centre'), paneW = posOf(v, 'paneW')
    const br = cam ? (() => { const a = clampTo(PAD, w - PAD, X(cam[0])), b = clampTo(PAD, w - PAD, X(cam[1])); return {x0: a, x1: b, cx: (a + b) / 2} })() : undefined

    const setWin = (key: 'winFrom' | 'winTo') => set && can(key) && wf !== undefined && wt !== undefined ? ((x: number) => {
      const y = Math.round(clampTo(d0, d1, Yr(x)))
      set(key, key === 'winFrom' ? Math.min(y, wt) : Math.max(y, wf))
    }) : undefined
    const winHandles = (n1: number, n2: number) => set && wf !== undefined && wt !== undefined && <>
      <Handle n={n1} shape="square" tone="value" x={X(wf)} y={winY} label="Window start" does="Drag along the ruler: the start of the window you read over." onDrag={setWin('winFrom')} onReset={() => set('winFrom', 800)} />
      <Handle n={n2} shape="square" tone="value" x={X(wt)} y={winY} label="Window end" does="Drag along the ruler: the end of the window you read over." onDrag={setWin('winTo')} onReset={() => set('winTo', 1700)} />
    </>

    const pick = p && !st(p, 'selected').disabled ? p.set : undefined
    const marks = placed.map(e => {
      const dim = !inScope(e, win), x = X(mid(e)), band = X(e.to) - X(e.from) > 4, tone = toneOf(e.cat), picked = strOf(v, 'selected') === e.id
      return <g key={e.id} opacity={dim ? 0.35 : 1} style={{cursor: pick ? 'pointer' : 'default'}} data-i={`${e.name}|${e.label ? `${e.label}. ` : ''}Press to select it.`} onClick={() => pick?.('selected', e.id)}>
        {rel ? <circle cx={x} cy={laneY} r={3.4} fill="var(--dp-well)" stroke={tone} strokeWidth={1.4} />
          : band ? <rect x={X(e.from)} y={axisY - 3} width={X(e.to) - X(e.from)} height={6} fill={tone} fillOpacity={0.4} stroke={tone} />
          : <circle cx={x} cy={axisY} r={2.7} fill={tone} />}
        {picked && <circle cx={x} cy={rel ? laneY : axisY} r={6} fill="none" stroke="var(--dp-on)" strokeWidth={1.2} />}
      </g>
    })
    const arcs = (rel || boolOf(v, 'links') === true) && (edges ?? []).map(e => {
      const a = m.at(e.from), b = m.at(e.to)
      if (!a || !b || !isPlaced(a) || !isPlaced(b)) return null
      return <Arc key={e.id} x1={X(mid(a))} x2={X(mid(b))} y={laneY - (rel ? 0 : 5)} st={e.st} dim={!inScope(a, win) && !inScope(b, win)} chain={rel && mode === 'cause' ? 1 : undefined} />
    })
    const walk = ln === 'chronology' && boolOf(v, 'walk') === true && !tile && (() => {
      const order = [...placed].sort((a, b) => mid(a) - mid(b))
      return <path d={order.map((e, i) => `${i ? 'L' : 'M'}${X(mid(e))} ${axisY + 6}`).join('')} className="dp-faint" strokeDasharray="2 2" />
    })()

    return <>
      {relNotes}{said}
      <g>
        <path d={`M${PAD} ${axisY}H${w - PAD}`} className="dp-faint" />
        {majors.map(y => <g key={y}><path d={`M${X(y)} ${axisY - 3}v6`} className="dp-faint" />{!tile && <text x={X(y)} y={axisY + 13} className="dp-axis" textAnchor="middle">{yearText(y)}</text>}</g>)}
        {!tile && bins.map((n, i) => n > 0 && <rect key={i} x={X((Math.floor(d0 / bw) + i) * bw) + 0.5} y={axisY + 29 - n * 6} width={Math.max(1, X(bw) - X(0) - 1)} height={n * 6} className="dp-fill" />)}
        {!tile && wf !== undefined && wt !== undefined && <path d={`M${X(wf)} ${winY}H${X(wt)}`} className="dp-faint" strokeDasharray="3 3" />}
        {win && <path d={`M${X(win[0])} ${winY + 3}H${X(win[1])}`} className="dp-curve" strokeWidth={3} />}
        {win && tile && <path d={`M${X(win[0])} ${axisY + 5}H${X(win[1])}`} className="dp-curve" strokeWidth={3} />}
      </g>
      {ln === 'chronology' && br && !tile && <g>
        <rect x={br.x0} y={22} width={Math.max(2, br.x1 - br.x0)} height={winY - 20} className="dp-fill-on" style={{stroke: 'var(--dp-on)', strokeWidth: 1, strokeOpacity: 0.6}} />
      </g>}
      {ln === 'chronology' && br && tile && <rect x={br.x0} y={8} width={Math.max(2, br.x1 - br.x0)} height={axisY - 2} className="dp-fill-on" style={{stroke: 'var(--dp-on)', strokeWidth: 1}} />}
      {arcs}{walk}{marks}
      {!tile && set && ln === 'chronology' && br && <>
        <Handle n={1} shape="ring" x={br.cx} y={32} label="View" does="Drag along the ruler: the year at the centre of the view."
          onDrag={can('centre') ? (x => set('centre', Math.round(clampTo(d0, d1, Yr(x))))) : undefined} onReset={() => set('centre', 1700)} />
        {whole && centre !== undefined && paneW !== undefined && <Handle n={2} shape="square" x={br.x1} y={axisY - 22} label="View width" does="Drag the right edge: how many years the view spans. Out zooms out."
          onDrag={can('zoom') ? (x => set('zoom', Number(clampTo(ZOOM.min, ZOOM.max, paneW / (2 * Math.max(1, Math.abs(Yr(x) - centre)))).toPrecision(3)))) : undefined} onReset={() => set('zoom', 2)} />}
        {whole && winHandles(3, 4)}
      </>}
      {!tile && rel && winHandles(1, 2)}
    </>
  }

  const body = ln === undefined ? <Note x={w / 2} y={h / 2 - 10} lines={wrap(NO_LENS, Math.floor((w - 16) / 4.6))} />
    : ln === 'relative' ? relative
    : dated === undefined ? said
    : dated === false ? undated()
    : dm ? datedBody(dm) : <Note x={w / 2} y={h / 2 - 10} lines={wrap(`No reading of ${words(lack)}.`, Math.floor((w - 16) / 4.6))} />

  return <Display w={w} h={h} label="The ruler" does="The reading on one ruler: events at their dates, the view bracketed, the window you read over. Drag handle 1 to move the view." corner={tile ? undefined : corner}>
    {body}
  </Display>
}

// ---------------------------------------------------------------- the pane: the ruler at pane size

function Pane({v}: {v: V}) {
  const W = 960, H = 440, L = 70, R = W - 30, relY = 210, undY = 330, ovY = H - 50, ovH = 22
  const m = modelOf(v), ln = lensOf(v), dated = datedOf(v, m), dm = domOf(v), cam = camera(v), win = readWin(v)
  const lack = lacks(v, m), shownEv = shownEvents(v, m), edges = edgesRead(v, m), zero = zeroOf(v), mode = strOf(v, 'mode')
  const rel = ln === 'relations', links = rel || boolOf(v, 'links') === true, arch = boolOf(v, 'archetypes') === true
  const placed = shownEv.filter(isPlaced), count = shownIn(v, m)
  const reason = rel && edges && edges.length === 0 && mode !== undefined
    ? (m.edges.some(e => kindsOf(mode).includes(e.kind)) ? 'No relations in this projection after the current standing filter.' : (own(REASON, mode)?.join(' ') ?? '')) : ''
  const Xd = (y: number) => (dm ? L + (y - dm[0]) / (dm[1] - dm[0]) * (R - L) : L)
  const laneAt = (cat: string) => 112 + Math.max(0, CATS.findIndex(c => c.id === cat)) * 76
  const span = cam ? cam[1] - cam[0] : 0
  const inView = cam ? (edges ?? []).filter(e => {
    const a = m.at(e.from), b = m.at(e.to)
    if (!a || !b || !isPlaced(a) || !isPlaced(b)) return false
    return mid(a) >= cam[0] && mid(a) <= cam[1] && mid(b) >= cam[0] && mid(b) <= cam[1]
  }) : []
  const range = cam ? `${yearText(cam[0])}–${yearText(cam[1])}` : NONE
  const headSpan = ln === 'relative' ? `from ${zero ?? NONE}` : ln === 'relations' ? (edges ? `${edges.length} links` : NONE) : ln === 'chronology' ? (dated === false ? 'undated' : dated === true ? range : NONE) : NONE

  const chronology = () => {
    if (!cam) return null
    const [c0, c1] = cam
    const major = span >= 2000 ? stepFor(span, 40) : span >= 400 ? 100 : span >= 100 ? 50 : 10, minor = major / (major === 100 ? 10 : 5)
    const tier = minor >= 1000 ? 'age' : minor >= 100 ? 'century' : minor >= 10 ? 'decade' : 'year'
    const Xm = (y: number) => L + (y - c0) / span * (R - L)
    return <g>
      <text x={8} y={16} className="tl-faint">{tier.toUpperCase()}</text>
      {ticksAt(c0, c1, major).map(y => <g key={`M${y}`}><path d={`M${Xm(y)} 22V${laneAt('claim') + 40}`} className="tl-rule-soft" /><text x={Xm(y)} y={34} className="tl-ink" textAnchor="middle">{yearText(y)}</text></g>)}
      <path d={`M${L} 42H${R}`} className="tl-rule" />
      {ticksAt(c0, c1, minor).map(y => <g key={`m${y}`}><path d={`M${Xm(y)} 42v${y % major === 0 ? 8 : 5}`} className="tl-rule" />{(R - L) / (span / minor) >= 26 && y % major !== 0 && <text x={Xm(y)} y={62} className="tl-faint" textAnchor="middle">{yearText(y)}</text>}</g>)}
      {win && <rect x={Xm(win[0])} y={22} width={Math.max(0, Xm(win[1]) - Xm(win[0]))} height={4} fill="var(--dp-value)" />}
      {CATS.map(c => boolOf(v, `cat_${c.id}`) === true && <text key={c.id} x={8} y={laneAt(c.id) + 12} className="tl-faint">{c.label.toUpperCase()}</text>)}
      {links && inView.map(e => {
        const a = m.at(e.from), b = m.at(e.to)
        if (!a || !b || !isPlaced(a) || !isPlaced(b)) return null
        const s = standingOf(e.st), xa = Xm(mid(a)), xb = Xm(mid(b)), ya = laneAt(a.cat) + 8, yb = laneAt(b.cat) + 8
        return <path key={e.id} d={`M${xa} ${ya}Q${(xa + xb) / 2} ${Math.min(ya, yb) - 46} ${xb} ${yb}`} fill="none" stroke={s.tone} strokeWidth={1.4} strokeDasharray={s.dash} opacity={!inScope(a, win) && !inScope(b, win) ? 0.35 : 1} />
      })}
      {placed.filter(e => e.to >= c0 && e.from <= c1).map(e => {
        const x1 = Xm(Math.max(e.from, c0)), x2 = Xm(Math.min(e.to, c1)), tone = toneOf(e.cat), y = laneAt(e.cat), circa = e.label.includes('~'), dim = !inScope(e, win), w = Math.max(7, x2 - x1)
        const end = x1 > R - 150, ax = end ? x2 : x1, an = end ? 'end' as const : 'start' as const
        return <g key={e.id} opacity={dim ? 0.35 : 1} color={tone}>
          <rect x={x1} y={y} width={w} height={16} fill={tone} fillOpacity={0.3} stroke={tone} />{circa && <rect x={x1} y={y} width={w} height={16} fill="url(#tl-hatch)" />}
          {strOf(v, 'selected') === e.id && <rect x={x1 - 3} y={y - 3} width={w + 6} height={22} fill="none" stroke="var(--dp-on)" />}
          <text x={ax} y={y + 30} className="tl-ink" textAnchor={an}>{e.name}</text>{e.label && <text x={ax} y={y + 42} className="tl-dim" textAnchor={an}>{e.label}</text>}
          {arch && e.family && <text x={ax} y={y + 54} className="tl-faint" textAnchor={an}>{e.family}</text>}</g>
      })}
    </g>
  }

  const relations = () => {
    if (!dm) return null
    return <g>
      <path d={`M${L} ${relY}H${R}`} className="tl-rule" /><text x={8} y={relY - 6} className="tl-faint">DATED</text>
      {reason && <text x={W / 2} y={relY - 60} className="tl-dim" textAnchor="middle">{reason}</text>}
      {(edges ?? []).map(e => {
        const a = m.at(e.from), b = m.at(e.to)
        if (!a || !b || !isPlaced(a) || !isPlaced(b)) return null
        const s = standingOf(e.st), xa = Xd(mid(a)), xb = Xd(mid(b)), lift = Math.min(120, Math.max(24, Math.abs(xb - xa) * 0.28))
        return <g key={e.id} opacity={!inScope(a, win) && !inScope(b, win) ? 0.35 : 1}><path d={`M${xa} ${relY}Q${(xa + xb) / 2} ${relY - 2 * lift} ${xb} ${relY}`} fill="none" stroke={s.tone} strokeWidth={1.6} strokeDasharray={s.dash} />
          {mode === 'cause' && <text x={(xa + xb) / 2} y={relY - lift - 5} className="tl-dim" textAnchor="middle">1</text>}</g>
      })}
      {placed.map((e, i) => <g key={e.id} opacity={!inScope(e, win) ? 0.35 : 1}><circle cx={Xd(mid(e))} cy={relY} r={5} fill="var(--dp-well)" stroke={toneOf(e.cat)} strokeWidth={1.6} />
        <text x={Xd(mid(e))} y={relY + 20 + (i % 2) * 12} className="tl-dim" textAnchor="middle">{e.name}</text></g>)}
      <path d={`M${L} ${undY}H${R}`} className="tl-rule-soft" /><text x={8} y={undY - 6} className="tl-faint">UNDATED</text>
    </g>
  }

  const undatedRelations = () => {
    const at = (k: number) => L + 30 + k * (R - L - 60) / Math.max(1, shownEv.length - 1)
    return <g>
      <path d={`M${L} ${relY}H${R}`} className="tl-rule" /><text x={8} y={relY - 6} className="tl-faint">UNDATED</text>
      {reason && <text x={W / 2} y={relY - 60} className="tl-dim" textAnchor="middle">{reason}</text>}
      {(edges ?? []).map(e => {
        const i = shownEv.findIndex(s => s.id === e.from), j = shownEv.findIndex(s => s.id === e.to), s = standingOf(e.st), xa = at(i), xb = at(j)
        return i < 0 || j < 0 ? null : <path key={e.id} d={`M${xa} ${relY}Q${(xa + xb) / 2} ${relY - Math.abs(xb - xa) * 0.56} ${xb} ${relY}`} fill="none" stroke={s.tone} strokeWidth={1.6} strokeDasharray={s.dash} />
      })}
      {shownEv.map((e, i) => <g key={e.id}><circle cx={at(i)} cy={relY} r={5} fill="var(--dp-well)" stroke={toneOf(e.cat)} strokeWidth={1.6} /><text x={at(i)} y={relY + 20 + (i % 2) * 12} className="tl-dim" textAnchor="middle">{e.name}</text></g>)}
    </g>
  }

  const overview = () => {
    if (!dm) return null
    const [d0, d1] = dm, bw = binWidth(d0, d1), bins = binsOf(placed, d0, d1, bw)
    return <g>
      <text x={8} y={ovY - 6} className="tl-faint">OVERVIEW</text>
      <rect x={L} y={ovY} width={R - L} height={ovH} fill="none" className="tl-rule" />
      {bins.map((n, i) => n > 0 && <rect key={i} x={Xd((Math.floor(d0 / bw) + i) * bw) + 1} y={ovY + ovH - n * 7} width={Math.max(1, Xd(bw) - Xd(0) - 2)} height={n * 7} fill="var(--dp-value)" fillOpacity={0.4} />)}
      {win && <path d={`M${Xd(win[0])} ${ovY + ovH + 5}H${Xd(win[1])}`} stroke="var(--dp-value)" strokeWidth={3} />}
      {ln === 'chronology' && cam && <rect x={clampTo(L, R, Xd(cam[0]))} y={ovY - 2} width={Math.max(2, clampTo(L, R, Xd(cam[1])) - clampTo(L, R, Xd(cam[0])))} height={ovH + 4} fill="var(--dp-on)" fillOpacity={0.16} stroke="var(--dp-on)" />}
      <text x={L} y={ovY + ovH + 15} className="tl-faint">{yearText(d0)}</text><text x={R} y={ovY + ovH + 15} className="tl-faint" textAnchor="end">{yearText(d1)}</text>
    </g>
  }

  const drawn = dated === true && ln !== undefined && ln !== 'relative'
  return <div className="tl-pane">
    <div className="tl-pane-head"><b>Timeline</b><span>{lensLabel(v)}</span><span>{headSpan}</span><span>{windowText(v)}</span><span>{count ?? NONE} events</span></div>
    <svg className="tl-pane-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" aria-label="The Timeline">
      <defs><pattern id="tl-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0V5" stroke="var(--text, #d4d7da)" strokeWidth="1" opacity=".5" /></pattern></defs>
      {lack.length > 0 && <text x={W / 2} y={rel ? 150 : H / 2 - 20} className="tl-big" textAnchor="middle">{`No reading of ${words(lack)}.`}</text>}
      {ln === 'chronology' && dated === false && <text x={W / 2} y={H / 2 - 20} className="tl-big" textAnchor="middle">No dates disclosed. Nothing is placed on the ruler.</text>}
      {ln === 'relative' && <g>
        <path d={`M${L} 190H${R}`} className="tl-rule" />
        {REL_MARKS.map((mk, i) => { const x = L + 40 + i * (R - L - 80) / (REL_MARKS.length - 1); return <g key={mk.step}>
          <path d={`M${x} ${i ? 180 : 168}V200`} className="tl-rule" stroke={i ? undefined : 'var(--dp-on)'} /><text x={x} y={158} className="tl-ink" textAnchor="middle">{mk.step}</text>
          <text x={x} y={220} className="tl-dim" textAnchor="middle">{mk.name}</text></g> })}
        <text x={L} y={270} className="tl-dim">Steps from {zero ?? NONE}. No calendar year shows.</text>
      </g>}
      {drawn && ln === 'chronology' && chronology()}
      {drawn && rel && relations()}
      {dated === false && rel && undatedRelations()}
      {drawn && overview()}
      {drawn && dm && (rel ? (edges?.length ?? 0) > 0 : links && inView.length > 0) && <g>{STANDINGS.map((s, i) => <g key={s.id}>
        <path d={`M${W - 590 + i * 96} ${H - 8}h20`} stroke={s.tone} strokeWidth={1.6} strokeDasharray={s.dash} /><text x={W - 566 + i * 96} y={H - 5} className="tl-faint">{s.label.toLowerCase()}</text></g>)}</g>}
    </svg>
  </div>
}

// ---------------------------------------------------------------- the controls

const light = (p: ViewProps) => (strOf(p.owner ?? p.v, 'light') ?? 'unknown') as LightState
/** The host's standing for a key, with this view's own reason added when the host gives none. */
const stand = (p: ViewProps, key: string, why?: string): Stand => { const s = st(p, key); return s.disabled || !why ? s : {...s, disabled: why} }
/** `why` unless the Relations lens is the one in force. */
const unlessRel = (v: V, why: string) => { const ln = lensOf(v); return ln === 'relations' ? undefined : ln === undefined ? NO_LENS : why }
const tog = (p: ViewProps, key: string, label: string, does: string, opts?: {why?: string; tone?: 'value'}) => {
  const now = boolOf(p.v, key)
  return <Toggle {...stand(p, key, opts?.why)} key={key} label={label} does={does} tone={opts?.tone} on={now === true} unknown={now === undefined} onChange={x => p.set(key, x)} />
}
const yearScale = (v: V) => { const d = domOf(v); return d ? {min: d[0], max: d[1]} : {min: 0, max: 1} }
/** A year on the domain: "—" when the domain is not reported, since the control has no range to stand in. */
const yearOf = (v: V, key: string) => (domOf(v) ? finiteOf(v, key) ?? NaN : NaN)
const lensOptions = (v: V) => [
  {value: 'chronology', label: 'Chronology', does: 'Events on the ruler, by date.'}, {value: 'relations', label: 'Relations', does: 'The relations between events, as arcs.'},
  ...(zeroOf(v) || lensOf(v) === 'relative' ? [{value: 'relative', label: 'Relative', does: 'Steps from the zero that the session names. No calendar year.'}] : []),
]

const LENS = (p: ViewProps) => <Radio {...st(p, 'lens')} key="lens" label="Lens" does="How the events relate. Relative shows only when the session names a zero." value={strOf(p.v, 'lens') ?? ''} options={lensOptions(p.v)} stack onChange={x => p.set('lens', x)} />
const LINKS = (p: ViewProps) => {
  const ln = lensOf(p.v)
  return tog(p, 'links', 'Links', 'Draws the relation links over the chronology.',
    {why: ln === 'chronology' ? undefined : ln === 'relations' ? 'The Relations lens always draws its links.' : ln === 'relative' ? 'The relative axis draws no links.' : NO_LENS})
}
const ARCH = (p: ViewProps) => tog(p, 'archetypes', 'Archetypes', 'Adds the archetypal family under each event.')
const LENSBOX = (p: ViewProps) => <div key="lens" style={{gridColumn: 'span 2', width: '100%'}}><Chooser {...st(p, 'lens')} label="Lens" does="How the events relate. Relative shows only when the session names a zero." value={strOf(p.v, 'lens') ?? ''}
  options={lensOptions(p.v)} onChange={x => p.set('lens', x)} /></div>
const WALK = (p: ViewProps) => tog(p, 'walk', 'Walk', 'Joins the events in date order, as a walk.')
const ZOOMDIAL = (p: ViewProps) => <Dial {...st(p, 'zoom')} key="zoom" label="Zoom" does="Pixels for each year. Turn up to read a century; down to read the ages." value={posOf(p.v, 'zoom') ?? NaN} def={2} scale={ZOOM} format={zoomText} onChange={x => p.set('zoom', x)} />
const CENTRE = (p: ViewProps) => <ValueBox {...st(p, 'centre')} key="centre" label="Centre" does="The year at the centre of the view." value={yearOf(p.v, 'centre')} def={1700} scale={yearScale(p.v)} format={x => yearText(x)} onChange={x => p.set('centre', Math.round(x))} />
const WINDOW = (p: ViewProps) => tog(p, 'readOn', 'Window', 'Reads over the window set by From and To. Off reads over all time. The other panes take the same window.')

/** Goes to a saved view: the view's own key, then each setting that view keeps. */
const applyView = (p: ViewProps, id: string) => { p.set('view', id); for (const [k, x] of Object.entries(viewsOf(p.v).find(s => s.id === id)?.sets ?? {})) p.set(k, x) }
const VIEW = (p: ViewProps) => <div key="view" style={{gridColumn: 'span 2', width: '100%'}}><Chooser {...st(p, 'view')} label="View" does="Goes to a saved view: its camera, lens, links and card filters." value={strOf(p.v, 'view') ?? ''}
  options={[{value: 'none', label: 'None'}, ...viewsOf(p.v).map(s => ({value: s.id, label: s.label}))]} onChange={x => (x === 'none' ? p.set('view', 'none') : applyView(p, x))} /></div>

const catItems = (p: ViewProps, m: Model): RowItem[] => CATS.map(c => {
  const key = `cat_${c.id}`, now = boolOf(p.v, key), s = st(p, key)
  return {id: c.id, name: c.label, light: now === undefined ? 'unknown' : now ? 'lit' : 'dark', tone: 'value', request: s.disabled ? undefined : now, why: s.disabled ?? s.refused,
    note: m.haveEvents ? String(m.events.filter(e => e.cat === c.id).length) : NONE, does: `Shows or hides the ${c.label.toLowerCase()} cards.`}
})

export const design: DesignedDevice = {
  id: 'techne:timeline',
  title: 'Timeline',
  kind: 'instrument',
  firstPage: 'lens',
  defaults: {
    light: 'lit', lens: 'chronology', mode: 'relations', links: true, archetypes: true, walk: false,
    centre: 1700, zoom: 2, winFrom: 800, winTo: 1700, readOn: false, readFrom: 800, readTo: 1700,
    st_sourced: true, st_derived: true, st_authored: true, st_disputed: true, st_mythic: true, st_unavailable: true,
    cat_source: true, cat_myth: true, cat_claim: true, view: 'none', frame: 'Earth', selected: '',
    // Readings: what the owner reports, never set from here. The sample is the Archetypal Earth reading of Adam (public/data/field.json):
    // each occurrence with the extent its date allows and the date in the source's words (yearDisplay); echo joins occurrences that
    // share a family or a culture, and the two joined by "(inferred)" dates are derived. A saved view is a camera, a projection, the
    // links and the card filters.
    domFrom: 200, domTo: 1960, paneW: 960, dated: true, relZero: '',
    events: JSON.stringify([
      {id: 'naassene', name: 'Naassene psalm', family: 'point', cat: 'source', from: 222, to: 235, label: '~222-235'},
      {id: 'talmud', name: 'Talmudic legend', family: 'ram', cat: 'myth', from: 401, to: 600, label: '~5th-6th c.'},
      {id: 'cave', name: 'Cave of Treasures', family: 'anthropos', cat: 'claim', from: 501, to: 700, label: '~6th-7th c. (inferred)'},
      {id: 'pirke', name: 'Pirke de-R. Eliezer', family: 'adam', cat: 'source', from: 701, to: 800, label: '~8th c.'},
      {id: 'islamic', name: 'Islamic legend', family: 'anthropos', cat: 'claim', from: 801, to: 900, label: '~9th c.? (inferred)'},
      {id: 'rosinus', name: 'Rosinus', family: 'hermaphrodite', cat: 'source', from: 1201, to: 1300, label: '~13th c.'},
      {id: 'valentinus', name: 'Valentinus', family: 'prima-materia', cat: 'source', from: 1595, to: 1625, label: '~1600 (publ. 1595-1625)'},
      {id: 'kadmon', name: 'Kabbala denudata', family: 'anthropos', cat: 'source', from: 1677, to: 1684, label: '1677-84'},
      {id: 'maiaurli', name: 'Maiaurli', family: 'spark', cat: 'myth', from: 1932, to: 1932, label: 'reported 1932'},
    ]),
    edges: JSON.stringify([
      {id: 'e1', from: 'cave', to: 'islamic', kind: 'echo', st: 'derived'},
      {id: 'e2', from: 'islamic', to: 'kadmon', kind: 'echo', st: 'derived'},
      {id: 'e3', from: 'pirke', to: 'kadmon', kind: 'echo', st: 'sourced'},
      {id: 'e4', from: 'talmud', to: 'maiaurli', kind: 'echo', st: 'mythic'},
      {id: 'e5', from: 'rosinus', to: 'valentinus', kind: 'cause', st: 'derived'},
    ]),
    views: JSON.stringify([
      {id: 'late', label: 'Late antiquity', centre: 500, zoom: 4, lens: 'chronology', links: true, cat_source: true, cat_myth: true, cat_claim: true},
      {id: 'alchemy', label: 'Alchemy', centre: 1450, zoom: 3, lens: 'relations', links: true, cat_source: true, cat_myth: false, cat_claim: true},
    ]),
  },
  fixtures: {
    'Adam': {},
    'No dates': {dated: false, lens: 'relations'},
    'Your work': {relZero: 'DAY 2026-10-15', lens: 'relative', mode: 'activity', workDay: 55, workNow: 43},
    'No readings': Object.fromEntries(['light', 'lens', 'mode', 'links', 'archetypes', 'walk', 'centre', 'zoom', 'winFrom', 'winTo', 'readOn', 'readFrom', 'readTo',
      'st_sourced', 'st_derived', 'st_authored', 'st_disputed', 'st_mythic', 'st_unavailable', 'cat_source', 'cat_myth', 'cat_claim', 'view', 'frame', 'selected',
      'domFrom', 'domTo', 'paneW', 'dated', 'relZero', 'events', 'edges', 'views', 'workDay', 'workNow', 'workSession', 'workRun'].map(k => [k, undefined])),
  },

  folded: p => <Folded title="Timeline" light={light(p)} readings={[lensLabel(p.v), windowText(p.v)]} onUnfold={p.nav.unfold} />,

  compact: p => <Panel title="Timeline" view="compact" light={light(p)} onFold={p.nav.fold} onFull={p.nav.full} onSelect={p.nav.select}>
    <Section width={152}><Ruler v={p.v} p={p} w={140} h={146} /></Section>
    <Section label="Macros" cols={2}>
      {LENSBOX(p)}{ZOOMDIAL(p)}<div style={{display: 'grid', gap: 6, justifyItems: 'center', alignContent: 'start', paddingTop: 12}}>{LINKS(p)}{WINDOW(p)}</div>
    </Section>
  </Panel>,

  whole: p => {
    const m = modelOf(p.v), wf = finiteOf(p.v, 'winFrom'), wt = finiteOf(p.v, 'winTo'), readOn = boolOf(p.v, 'readOn'), chosen = m.at(strOf(p.v, 'selected') ?? '')
    const notRel = unlessRel(p.v, 'Choose the Relations lens first.'), notRelStanding = unlessRel(p.v, 'The chronology filters no event by standing. The Relations lens does.')
    const standing = (id: Standing) => tog(p, `st_${id}`, standingOf(id).label, `Shows ${standingOf(id).label.toLowerCase()} relations. The chronology filters no event by standing.`, {tone: 'value', why: notRelStanding})
    return <Panel title="Timeline" view="whole" light={light(p)} onFold={p.nav.fold} onFull={p.nav.full}
      pages={[{id: 'lens', label: 'Lens'}, {id: 'filters', label: 'Filters'}]} page={p.page} onPage={p.setPage}>
      {p.page !== 'filters' ? <>
        <Band>
          <Section width={206}><Ruler v={p.v} p={p} w={194} h={146} whole /></Section>
          <Section label="Lens" cols={2} grow>
            {LENS(p)}
            <div style={{display: 'grid', gap: 4, justifyItems: 'center'}}>{LINKS(p)}{ARCH(p)}{WALK(p)}</div>
            <div style={{gridColumn: 'span 2', width: '100%'}}>
              <Chooser {...stand(p, 'mode', notRel)} label="Relations" does="Which relations the Relations lens draws." value={strOf(p.v, 'mode') ?? ''} options={MODES} onChange={x => p.set('mode', x)} />
            </div>
          </Section>
        </Band>
        <Band>
          <Section label="Camera" cols={2}>{ZOOMDIAL(p)}{CENTRE(p)}</Section>
          <Section label="Window" cols={2}>
            <ValueBox {...st(p, 'winFrom')} label="From" does="The start of the window. Press Read over to apply it." value={yearOf(p.v, 'winFrom')} def={800} scale={yearScale(p.v)} format={x => yearText(x)}
              onChange={x => p.set('winFrom', wt === undefined ? Math.round(x) : Math.min(Math.round(x), wt))} />
            <ValueBox {...st(p, 'winTo')} label="To" does="The end of the window. Press Read over to apply it." value={yearOf(p.v, 'winTo')} def={1700} scale={yearScale(p.v)} format={x => yearText(x)}
              onChange={x => p.set('winTo', wf === undefined ? Math.round(x) : Math.max(Math.round(x), wf))} />
            <Action {...stand(p, 'readOver', wf !== undefined && wt !== undefined ? undefined : 'No reading of the window to apply.')} label="Read over" does="Asserts the window you set. The World and the other panes take it." onPress={() => p.set('readOver', true)} />
            <Action {...stand(p, 'clearWindow', readOn === undefined ? 'No reading of the window.' : readOn ? undefined : 'No window is set.')} label="Clear" does="Gives the window back: reads over all time." onPress={() => p.set('clearWindow', true)} />
          </Section>
          <Section label="Views" cols={2} grow>
            {VIEW(p)}
            <Action {...st(p, 'saveView')} label="Save view" does="Names the present camera, lens, links and filters, and keeps them." onPress={() => p.set('saveView', true)} />
            <Action {...st(p, 'refresh')} label="Refresh" does="Reads the timeline again from its owner." onPress={() => p.set('refresh', true)} />
          </Section>
        </Band>
      </> : <>
        <Band>
          <Section width={206}><Ruler v={p.v} p={p} w={194} h={146} whole /></Section>
          <Section label="Standing" cols={2}>
            {STANDINGS.map(s => standing(s.id))}
            <div style={{gridColumn: 'span 2'}}><Action {...stand(p, 'showAll', notRelStanding)} label="Show all" does="Shows every standing again." onPress={() => p.set('showAll', true)} /></div>
          </Section>
          <Section label="Reading" grow>
            <Readout label="events" does="Events the cards show." value={shownIn(p.v, m)} tone="value" />
            <Readout label="outside" does="Events outside the window you read over." value={outside(p.v, m)} tone="accent" />
            <Readout label="links" does="Relations the lens draws." value={edgesRead(p.v, m)?.length} />
          </Section>
        </Band>
        <Band>
          <Section label="Cards" width={150}>
            <Rows does="The categories of cards on the ruler. Press a square to hide or show one." items={catItems(p, m)} onRequest={(id, x) => p.set(`cat_${id}`, x)} size={3} />
          </Section>
          <Section label="Frame" width={96}>
            <Readout label="frame" does="The timeline that the ruler shows." value={strOf(p.v, 'frame')} />
            <Action {...stand(p, 'subTimeline', chosen ? undefined : 'Select an event first.')} label="Sub-timeline" does="Opens the selected event as its own timeline." onPress={() => p.set('subTimeline', true)} />
            <Action {...stand(p, 'earth', strOf(p.v, 'frame') === 'Earth' ? 'The ruler already shows Earth.' : undefined)} label="Earth" does="Returns to the Earth timeline." onPress={() => p.set('earth', true)} />
          </Section>
          <Section label="Your work" cols={2} grow>
            <Readout label="DAY" does="Day facets in the reading." value={finiteOf(p.v, 'workDay')} />
            <Readout label="NOW" does="NOW clearings in the reading." value={finiteOf(p.v, 'workNow')} />
            <Readout label="Session" does="Session facets in the reading." value={finiteOf(p.v, 'workSession')} />
            <Readout label="Run" does="Run facets in the reading." value={finiteOf(p.v, 'workRun')} />
          </Section>
        </Band>
      </>}
    </Panel>
  },

  full: p => <Pane v={p.v} />,

  widget: p => {
    const m = modelOf(p.v), win = readWin(p.v), span = spanYears(p.v)
    return <Tile title="Timeline" light={light(p)} span={2} onFull={p.nav.full}>
      <Ruler v={p.v} w={150} h={104} tile />
      <div className="tl-tile-read">
        <Readout big label="events" does="Events the cards show." value={shownIn(p.v, m)} tone="value" />
        <Readout label="span" does="Years the view spans." value={span === undefined ? undefined : spanText(span)} />
        <Readout label="window" does="The window you read over." value={win === undefined ? undefined : win ? 'set' : 'all time'} tone={win ? 'accent' : undefined} />
      </div>
    </Tile>
  },
}

