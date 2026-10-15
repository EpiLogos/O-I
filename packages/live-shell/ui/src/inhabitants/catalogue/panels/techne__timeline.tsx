// The Timeline (manual §17.4): Technē's research instrument, time laid out. Live's nearest: Wavetable's oscillator beside its
// envelope, a ruler with a bracket that you move. The owner is the research frame (field-studies-journeys: researchInstruments.tsx
// m2Projection and the vendored TimelineLens toolbar, sharedTimeWindow.tsx, relationFieldView.tsx) and Technē's timeline model
// (src/techne/m0m5/timeline: scale, timeAxis, relations, standing, lanes). The fixture is the Archetypal Earth reading of Adam:
// nine occurrences with the dates in the source's own words, and the relations that join them.
import {Action, Band, Chooser, Dial, Display, Folded, Handle, Panel, Radio, Readout, Rows, Section, Tile, Toggle, ValueBox, type LightState, type RowItem} from '../../sdk/panel'
import {clampTo, num, on, str, type DesignedDevice, type ViewProps} from './design'
import './techne__timeline.css'

type V = ViewProps['v']
type SetFn = ViewProps['set']

// ---------------------------------------------------------------- the reading (Archetypal Earth, public/data/field.json)

type Cat = 'source' | 'myth' | 'claim'
interface Ev {readonly id: string; readonly name: string; readonly family: string; readonly cat: Cat; readonly from: number; readonly to: number; readonly label: string}
/** Each occurrence with the extent its date allows and the date in the source's words (yearDisplay). */
const EVENTS: readonly Ev[] = [
  {id: 'naassene', name: 'Naassene psalm', family: 'point', cat: 'source', from: 222, to: 235, label: '~222-235'},
  {id: 'talmud', name: 'Talmudic legend', family: 'ram', cat: 'myth', from: 401, to: 600, label: '~5th-6th c.'},
  {id: 'cave', name: 'Cave of Treasures', family: 'anthropos', cat: 'claim', from: 501, to: 700, label: '~6th-7th c. (inferred)'},
  {id: 'pirke', name: 'Pirke de-R. Eliezer', family: 'adam', cat: 'source', from: 701, to: 800, label: '~8th c.'},
  {id: 'islamic', name: 'Islamic legend', family: 'anthropos', cat: 'claim', from: 801, to: 900, label: '~9th c.? (inferred)'},
  {id: 'rosinus', name: 'Rosinus', family: 'hermaphrodite', cat: 'source', from: 1201, to: 1300, label: '~13th c.'},
  {id: 'valentinus', name: 'Valentinus', family: 'prima-materia', cat: 'source', from: 1595, to: 1625, label: '~1600 (publ. 1595-1625)'},
  {id: 'kadmon', name: 'Kabbala denudata', family: 'anthropos', cat: 'source', from: 1677, to: 1684, label: '1677-84'},
  {id: 'maiaurli', name: 'Maiaurli', family: 'spark', cat: 'myth', from: 1932, to: 1932, label: 'reported 1932'},
]
const mid = (e: Ev) => (e.from + e.to) / 2
const byId = (id: string) => EVENTS.find(e => e.id === id)!
const CATS: readonly {id: Cat; label: string; tone: string}[] = [
  {id: 'source', label: 'Source', tone: 'var(--dp-value)'}, {id: 'myth', label: 'Myth', tone: 'var(--sel)'}, {id: 'claim', label: 'Claim', tone: 'var(--stall)'},
]
const toneOf = (cat: Cat) => CATS.find(c => c.id === cat)!.tone

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
const standingOf = (id: Standing) => STANDINGS.find(s => s.id === id)!

interface Edge {readonly id: string; readonly from: string; readonly to: string; readonly kind: 'cause' | 'echo'; readonly st: Standing}
/** Echo joins occurrences that share a family or a culture; the two joined by "(inferred)" dates are derived. */
const EDGES: readonly Edge[] = [
  {id: 'e1', from: 'cave', to: 'islamic', kind: 'echo', st: 'derived'},
  {id: 'e2', from: 'islamic', to: 'kadmon', kind: 'echo', st: 'derived'},
  {id: 'e3', from: 'pirke', to: 'kadmon', kind: 'echo', st: 'sourced'},
  {id: 'e4', from: 'talmud', to: 'maiaurli', kind: 'echo', st: 'mythic'},
  {id: 'e5', from: 'rosinus', to: 'valentinus', kind: 'cause', st: 'derived'},
]
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
/** A saved view is a camera, a projection, the links and the card filters (researchMaterial.ts TimelineViewRecord). */
const VIEWS: Readonly<Record<string, Readonly<Record<string, number | string | boolean>>>> = {
  late: {centre: 500, zoom: 4, lens: 'chronology', links: true, cat_source: true, cat_myth: true, cat_claim: true},
  alchemy: {centre: 1450, zoom: 3, lens: 'relations', links: true, cat_source: true, cat_myth: false, cat_claim: true},
}
const REL_MARKS = [{step: '0', name: 'DAY'}, {step: '+1', name: 'NOW'}, {step: '+2', name: 'Session'}, {step: '+3', name: 'Run'}] as const

// ---------------------------------------------------------------- the laws the picture draws by

const ZOOM = {min: 1e-9, max: 3.155e13, log: true}   // scale.ts MIN_PIXELS_PER_YEAR, MAX_PIXELS_PER_YEAR
const lens = (v: V) => str(v, 'lens')
const isDated = (v: V) => v.dated !== false
const dom = (v: V): [number, number] => [num(v, 'domFrom'), num(v, 'domTo')]
const spanYears = (v: V) => num(v, 'paneW') / num(v, 'zoom')
const camera = (v: V): [number, number] => { const c = num(v, 'centre'), h = spanYears(v) / 2; return [c - h, c + h] }
const readWin = (v: V): [number, number] | null => (on(v, 'readOn') ? [num(v, 'readFrom'), num(v, 'readTo')] : null)
const shownEvents = (v: V) => EVENTS.filter(e => on(v, `cat_${e.cat}`))
const inScope = (e: Ev, w: [number, number] | null) => !w || (e.to >= w[0] && e.from <= w[1])
const shownEdges = (v: V) => {
  const ids = new Set(shownEvents(v).map(e => e.id)), rel = lens(v) === 'relations'
  return EDGES.filter(e => ids.has(e.from) && ids.has(e.to) && (!rel || (!!MODE_KINDS[str(v, 'mode')]?.includes(e.kind) && on(v, `st_${e.st}`))))
}
const yearText = (y: number) => (y < 0 ? `${Math.abs(Math.round(y))} BCE` : `${Math.round(y)}`)
const spanText = (y: number) => (y >= 1e6 ? `${(y / 1e6).toFixed(1)} Myr` : y >= 1000 ? `${(y / 1000).toFixed(1)}k yr` : `${Math.round(y)} yr`)
const zoomText = (z: number) => `${z >= 100 ? Math.round(z) : z >= 1 ? z.toFixed(1) : z >= 0.01 ? z.toFixed(2) : z.toExponential(0)} px/yr`
const windowText = (v: V) => { const w = readWin(v); return w ? `${yearText(w[0])}–${yearText(w[1])}` : 'All time' }
const lensLabel = (v: V) => (lens(v) === 'relations' ? 'Relations' : lens(v) === 'relative' ? 'Relative' : 'Chronology')

/** A few short lines of text in the well. */
function Note({x, y, lines, anchor = 'middle'}: {x: number; y: number; lines: readonly string[]; anchor?: 'start' | 'middle'}) {
  return <>{lines.map((t, i) => <text key={i} x={x} y={y + i * 11} className="dp-axis" textAnchor={anchor}>{t}</text>)}</>
}

/** A relation as an arc between two marks on one line, its stroke the relation's standing. */
function Arc({x1, x2, y, st, dim, chain}: {x1: number; x2: number; y: number; st: Standing; dim?: boolean; chain?: number}) {
  const s = standingOf(st), lift = Math.min(54, Math.max(10, Math.abs(x2 - x1) * 0.32))
  return <g opacity={dim ? 0.35 : 1}>
    <path d={`M${x1} ${y}Q${(x1 + x2) / 2} ${y - 2 * lift} ${x2} ${y}`} fill="none" stroke={s.tone} strokeWidth={1.3} strokeDasharray={s.dash} />
    {chain !== undefined && <text x={(x1 + x2) / 2} y={y - lift - 3} className="dp-axis" textAnchor="middle">{chain}</text>}
  </g>
}

// ---------------------------------------------------------------- the display: the ruler in miniature

const PAD = 9
function Ruler({v, set, w, h, whole, tile}: {v: V; set?: SetFn; w: number; h: number; whole?: boolean; tile?: boolean}) {
  const ln = lens(v), dated = isDated(v), [d0, d1] = dom(v), [c0, c1] = camera(v), win = readWin(v), shown = shownEvents(v), edges = shownEdges(v)
  const X = (y: number) => PAD + (y - d0) / (d1 - d0) * (w - 2 * PAD)
  const Yr = (x: number) => d0 + (x - PAD) / (w - 2 * PAD) * (d1 - d0)
  const axisY = tile ? h - 22 : h - 42, winY = axisY + 32
  const rel = ln === 'relations', laneY = rel ? 58 : axisY
  const majors: number[] = []
  for (let y = Math.ceil(d0 / 500) * 500; y <= d1; y += 500) majors.push(y)
  const bins: number[] = []
  for (let b = Math.floor(d0 / 100); b * 100 < d1; b++) bins.push(shown.filter(e => Math.floor(mid(e) / 100) === b).length)
  const x0 = clampTo(PAD, w - PAD, X(c0)), x1 = clampTo(PAD, w - PAD, X(c1)), cx = (x0 + x1) / 2
  const workKeys = ['workDay', 'workNow', 'workSession', 'workRun'] as const
  const activity = rel && str(v, 'mode') === 'activity' && workKeys.some(k => Number.isFinite(num(v, k)))
  const reasonKey = rel && !activity && edges.length === 0 ? (EDGES.some(e => MODE_KINDS[str(v, 'mode')]?.includes(e.kind)) ? 'filtered' : str(v, 'mode')) : ''
  const corner = ln === 'chronology' ? (dated ? `${yearText(c0)}–${yearText(c1)}` : 'undated') : ln === 'relations' ? `${edges.length} links` : 'steps'

  const setWin = (key: 'winFrom' | 'winTo') => set && ((x: number) => {
    const y = Math.round(clampTo(d0, d1, Yr(x)))
    set(key, key === 'winFrom' ? Math.min(y, num(v, 'winTo')) : Math.max(y, num(v, 'winFrom')))
  })
  const winHandles = (n1: number, n2: number) => dated && set && <>
    <Handle n={n1} shape="square" tone="value" x={X(num(v, 'winFrom'))} y={winY} label="Window start" does="Drag along the ruler: the start of the window you read over." onDrag={setWin('winFrom')} onReset={() => set('winFrom', 800)} />
    <Handle n={n2} shape="square" tone="value" x={X(num(v, 'winTo'))} y={winY} label="Window end" does="Drag along the ruler: the end of the window you read over." onDrag={setWin('winTo')} onReset={() => set('winTo', 1700)} />
  </>

  const ruler = dated && ln !== 'relative' && <g>
    <path d={`M${PAD} ${axisY}H${w - PAD}`} className="dp-faint" />
    {majors.map(y => <g key={y}><path d={`M${X(y)} ${axisY - 3}v6`} className="dp-faint" />{!tile && <text x={X(y)} y={axisY + 13} className="dp-axis" textAnchor="middle">{y}</text>}</g>)}
    {!tile && bins.map((n, i) => n > 0 && <rect key={i} x={X((Math.floor(d0 / 100) + i) * 100) + 0.5} y={axisY + 29 - n * 6} width={Math.max(1, X(100) - X(0) - 1)} height={n * 6} className="dp-fill" />)}
    {!tile && <path d={`M${X(num(v, 'winFrom'))} ${winY}H${X(num(v, 'winTo'))}`} className="dp-faint" strokeDasharray="3 3" />}
    {win && <path d={`M${X(win[0])} ${winY + 3}H${X(win[1])}`} className="dp-curve" strokeWidth={3} />}
    {win && tile && <path d={`M${X(win[0])} ${axisY + 5}H${X(win[1])}`} className="dp-curve" strokeWidth={3} />}
  </g>

  const marks = dated && ln !== 'relative' && shown.map(e => {
    const dim = !inScope(e, win), x = X(mid(e)), band = X(e.to) - X(e.from) > 4, tone = toneOf(e.cat), picked = str(v, 'selected') === e.id
    return <g key={e.id} opacity={dim ? 0.35 : 1} style={{cursor: set ? 'pointer' : 'default'}} data-i={`${e.name}|${e.label}. Press to select it.`} onClick={() => set?.('selected', e.id)}>
      {rel ? <circle cx={x} cy={laneY} r={3.4} fill="var(--dp-well)" stroke={tone} strokeWidth={1.4} />
        : band ? <rect x={X(e.from)} y={axisY - 3} width={X(e.to) - X(e.from)} height={6} fill={tone} fillOpacity={0.4} stroke={tone} />
        : <circle cx={x} cy={axisY} r={2.7} fill={tone} />}
      {picked && <circle cx={x} cy={rel ? laneY : axisY} r={6} fill="none" stroke="var(--dp-on)" strokeWidth={1.2} />}
    </g>
  })

  const arcs = dated && ln !== 'relative' && (rel || on(v, 'links')) && edges.map(e => {
    const a = byId(e.from), b = byId(e.to), chain = rel && str(v, 'mode') === 'cause' ? 1 : undefined
    return <Arc key={e.id} x1={X(mid(a))} x2={X(mid(b))} y={laneY - (rel ? 0 : 5)} st={e.st} dim={!inScope(a, win) && !inScope(b, win)} chain={chain} />
  })

  const walk = dated && ln === 'chronology' && on(v, 'walk') && !tile && (() => {
    const order = [...shown].sort((a, b) => mid(a) - mid(b))
    return <path d={order.map((e, i) => `${i ? 'L' : 'M'}${X(mid(e))} ${axisY + 6}`).join('')} className="dp-faint" strokeDasharray="2 2" />
  })()

  const undatedNodes = !dated && rel && shown.map((e, i, all) => {
    const x = 22 + i * (w - 44) / Math.max(1, all.length - 1)
    return <circle key={e.id} cx={x} cy={laneY} r={3.4} fill="var(--dp-well)" stroke={toneOf(e.cat)} strokeWidth={1.4} />
  })
  const undatedArcs = !dated && rel && edges.map(e => {
    const i = shown.findIndex(s => s.id === e.from), j = shown.findIndex(s => s.id === e.to)
    const x = (k: number) => 22 + k * (w - 44) / Math.max(1, shown.length - 1)
    return i < 0 || j < 0 ? null : <Arc key={e.id} x1={x(i)} x2={x(j)} y={laneY} st={e.st} />
  })

  return <Display w={w} h={h} label="The ruler" does="The reading on one ruler: events at their dates, the view bracketed, the window you read over. Drag handle 1 to move the view." corner={tile ? undefined : corner}>
    {ln === 'relative' ? <g>
      <path d={`M16 ${h / 2 - 8}H${w - 16}`} className="dp-faint" />
      {REL_MARKS.map((m, i) => { const x = 22 + i * (w - 44) / (REL_MARKS.length - 1); return <g key={m.step}>
        <path d={`M${x} ${h / 2 - 14}v${i ? 12 : 20}`} className={i ? 'dp-faint' : 'dp-curve-on'} />
        <text x={x} y={h / 2 - 20} className="dp-ink" textAnchor="middle">{m.step}</text><text x={x} y={h / 2 + 18} className="dp-axis" textAnchor="middle">{m.name}</text></g> })}
      {!tile && <Note x={w / 2} y={h - 24} lines={[`Steps from ${str(v, 'relZero')}.`, 'No calendar year.']} />}
    </g> : <>
      {!dated && ln === 'chronology' && <Note x={w / 2} y={h / 2 - 4} lines={['No dates disclosed.', 'Nothing is placed on the ruler.']} />}
      {rel && !tile && <text x={4} y={laneY - 8} className="dp-axis">{dated ? 'Dated' : 'Undated'}</text>}
      {rel && reasonKey && (reasonKey === 'filtered' ? <Note x={w / 2} y={laneY - 10} lines={['No relations in this', 'projection after the filter.']} /> : <Note x={w / 2} y={laneY - 10} lines={REASON[reasonKey] ?? []} />)}
      {activity && <g>{workKeys.map((k, i) => {
        const n = num(v, k), label = ['DAY', 'NOW', 'Session', 'Run'][i]!, mx = Math.max(1, ...workKeys.map(q => (Number.isFinite(num(v, q)) ? num(v, q) : 0)))
        return <g key={k}><text x={PAD} y={laneY + i * 14 - 8} className="dp-axis">{label}</text>
          {Number.isFinite(n) ? <><rect x={52} y={laneY + i * 14 - 14} width={Math.max(1, n / mx * (w - 82))} height={8} className="dp-fill-on" /><text x={w - PAD} y={laneY + i * 14 - 7} className="dp-ink-dim" textAnchor="end">{n}</text></>
            : <text x={52} y={laneY + i * 14 - 8} className="dp-axis">—</text>}</g> })}</g>}
      {ruler}
      {dated && ln === 'chronology' && !tile && <g>
        <rect x={x0} y={22} width={Math.max(2, x1 - x0)} height={winY - 20} className="dp-fill-on" style={{stroke: 'var(--dp-on)', strokeWidth: 1, strokeOpacity: 0.6}} />
      </g>}
      {dated && ln === 'chronology' && tile && <rect x={x0} y={8} width={Math.max(2, x1 - x0)} height={axisY - 2} className="dp-fill-on" style={{stroke: 'var(--dp-on)', strokeWidth: 1}} />}
      {arcs}{walk}{marks}{undatedNodes}{undatedArcs}
      {!tile && set && dated && ln === 'chronology' && <>
        <Handle n={1} shape="ring" x={cx} y={32} label="View" does="Drag along the ruler: the year at the centre of the view."
          onDrag={x => set('centre', Math.round(clampTo(d0, d1, Yr(x))))} onReset={() => set('centre', 1700)} />
        {whole && <Handle n={2} shape="square" x={x1} y={axisY - 22} label="View width" does="Drag the right edge: how many years the view spans. Out zooms out."
          onDrag={x => set('zoom', Number(clampTo(ZOOM.min, ZOOM.max, num(v, 'paneW') / (2 * Math.max(1, Math.abs(Yr(x) - num(v, 'centre'))))).toPrecision(3)))} onReset={() => set('zoom', 2)} />}
        {whole && winHandles(3, 4)}
      </>}
      {!tile && rel && winHandles(1, 2)}
    </>}
  </Display>
}

// ---------------------------------------------------------------- the pane: the ruler at pane size

function Pane({v}: {v: V}) {
  const W = 960, H = 440, L = 70, R = W - 30, ln = lens(v), dated = isDated(v), [d0, d1] = dom(v), [c0, c1] = camera(v), win = readWin(v)
  const shown = shownEvents(v), edges = shownEdges(v), links = ln === 'relations' || on(v, 'links'), rel = ln === 'relations'
  const Xm = (y: number) => L + (y - c0) / (c1 - c0) * (R - L)
  const Xd = (y: number) => L + (y - d0) / (d1 - d0) * (R - L)
  const span = c1 - c0, major = span >= 2000 ? 500 : span >= 400 ? 100 : span >= 100 ? 50 : 10, minor = major / (major === 500 ? 5 : major === 100 ? 10 : 5)
  const tier = minor >= 100 ? 'century' : minor >= 10 ? 'decade' : 'year'
  const ticks = (step: number) => { const t: number[] = []; for (let y = Math.ceil(c0 / step) * step; y <= c1; y += step) t.push(y); return t }
  const laneAt = (cat: Cat) => 112 + CATS.findIndex(c => c.id === cat) * 76
  const arch = on(v, 'archetypes')
  const ovY = H - 50, ovH = 22, bins: number[] = []
  for (let b = Math.floor(d0 / 100); b * 100 < d1; b++) bins.push(shown.filter(e => Math.floor(mid(e) / 100) === b).length)
  const reason = rel && edges.length === 0 ? (EDGES.some(e => MODE_KINDS[str(v, 'mode')]?.includes(e.kind)) ? ['No relations in this projection after the current standing filter.'] : [REASON[str(v, 'mode')]?.join(' ') ?? '']) : null
  const relY = 210, undY = 330
  const inView = edges.filter(e => { const a = mid(byId(e.from)), b = mid(byId(e.to)); return a >= c0 && a <= c1 && b >= c0 && b <= c1 })

  return <div className="tl-pane">
    <div className="tl-pane-head"><b>Timeline</b><span>{lensLabel(v)}</span><span>{ln === 'relative' ? `from ${str(v, 'relZero')}` : ln === 'relations' ? `${edges.length} links` : dated ? `${yearText(c0)}–${yearText(c1)}` : 'undated'}</span><span>{windowText(v)}</span><span>{shown.length} events</span></div>
    <svg className="tl-pane-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" aria-label="The Timeline">
      <defs><pattern id="tl-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0V5" stroke="var(--text, #d4d7da)" strokeWidth="1" opacity=".5" /></pattern></defs>
      {!dated && ln !== 'relations' && ln !== 'relative' && <text x={W / 2} y={H / 2 - 20} className="tl-big" textAnchor="middle">No dates disclosed. Nothing is placed on the ruler.</text>}
      {ln === 'relative' && <g>
        <path d={`M${L} 190H${R}`} className="tl-rule" />
        {REL_MARKS.map((m, i) => { const x = L + 40 + i * (R - L - 80) / (REL_MARKS.length - 1); return <g key={m.step}>
          <path d={`M${x} ${i ? 180 : 168}V200`} className="tl-rule" stroke={i ? undefined : 'var(--dp-on)'} /><text x={x} y={158} className="tl-ink" textAnchor="middle">{m.step}</text>
          <text x={x} y={220} className="tl-dim" textAnchor="middle">{m.name}</text></g> })}
        <text x={L} y={270} className="tl-dim">Steps from {str(v, 'relZero')}. No calendar year shows.</text>
      </g>}
      {dated && ln === 'chronology' && <g>
        <text x={8} y={16} className="tl-faint">{tier.toUpperCase()}</text>
        {ticks(major).map(y => <g key={`M${y}`}><path d={`M${Xm(y)} 22V${laneAt('claim') + 40}`} className="tl-rule-soft" /><text x={Xm(y)} y={34} className="tl-ink" textAnchor="middle">{yearText(y)}</text></g>)}
        <path d={`M${L} 42H${R}`} className="tl-rule" />
        {ticks(minor).map(y => <g key={`m${y}`}><path d={`M${Xm(y)} 42v${y % major === 0 ? 8 : 5}`} className="tl-rule" />{(R - L) / (span / minor) >= 26 && y % major !== 0 && <text x={Xm(y)} y={62} className="tl-faint" textAnchor="middle">{yearText(y)}</text>}</g>)}
        {win && <rect x={Xm(win[0])} y={22} width={Math.max(0, Xm(win[1]) - Xm(win[0]))} height={4} fill="var(--dp-value)" />}
        {CATS.map(c => on(v, `cat_${c.id}`) && <text key={c.id} x={8} y={laneAt(c.id) + 12} className="tl-faint">{c.label.toUpperCase()}</text>)}
        {links && inView.map(e => { const a = byId(e.from), b = byId(e.to), s = standingOf(e.st), xa = Xm(mid(a)), xb = Xm(mid(b)), ya = laneAt(a.cat) + 8, yb = laneAt(b.cat) + 8
          return <path key={e.id} d={`M${xa} ${ya}Q${(xa + xb) / 2} ${Math.min(ya, yb) - 46} ${xb} ${yb}`} fill="none" stroke={s.tone} strokeWidth={1.4} strokeDasharray={s.dash} opacity={!inScope(a, win) && !inScope(b, win) ? 0.35 : 1} /> })}
        {shown.filter(e => e.to >= c0 && e.from <= c1).map(e => { const x1 = Xm(Math.max(e.from, c0)), x2 = Xm(Math.min(e.to, c1)), tone = toneOf(e.cat), y = laneAt(e.cat), circa = e.label.includes('~'), dim = !inScope(e, win), w = Math.max(7, x2 - x1)
          return <g key={e.id} opacity={dim ? 0.35 : 1} color={tone}>
            <rect x={x1} y={y} width={w} height={16} fill={tone} fillOpacity={0.3} stroke={tone} />{circa && <rect x={x1} y={y} width={w} height={16} fill="url(#tl-hatch)" />}
            {str(v, 'selected') === e.id && <rect x={x1 - 3} y={y - 3} width={w + 6} height={22} fill="none" stroke="var(--dp-on)" />}
            {(() => { const end = x1 > R - 150, ax = end ? x2 : x1, an = end ? 'end' as const : 'start' as const; return <>
              <text x={ax} y={y + 30} className="tl-ink" textAnchor={an}>{e.name}</text><text x={ax} y={y + 42} className="tl-dim" textAnchor={an}>{e.label}</text>
              {arch && <text x={ax} y={y + 54} className="tl-faint" textAnchor={an}>{e.family}</text>}</> })()}</g> })}
      </g>}
      {dated && rel && <g>
        <path d={`M${L} ${relY}H${R}`} className="tl-rule" /><text x={8} y={relY - 6} className="tl-faint">DATED</text>
        {reason && <text x={W / 2} y={relY - 60} className="tl-dim" textAnchor="middle">{reason[0]}</text>}
        {edges.map(e => { const a = byId(e.from), b = byId(e.to), s = standingOf(e.st), xa = Xd(mid(a)), xb = Xd(mid(b)), lift = Math.min(120, Math.max(24, Math.abs(xb - xa) * 0.28))
          return <g key={e.id} opacity={!inScope(a, win) && !inScope(b, win) ? 0.35 : 1}><path d={`M${xa} ${relY}Q${(xa + xb) / 2} ${relY - 2 * lift} ${xb} ${relY}`} fill="none" stroke={s.tone} strokeWidth={1.6} strokeDasharray={s.dash} />
            {str(v, 'mode') === 'cause' && <text x={(xa + xb) / 2} y={relY - lift - 5} className="tl-dim" textAnchor="middle">1</text>}</g> })}
        {shown.map((e, i) => <g key={e.id} opacity={!inScope(e, win) ? 0.35 : 1}><circle cx={Xd(mid(e))} cy={relY} r={5} fill="var(--dp-well)" stroke={toneOf(e.cat)} strokeWidth={1.6} />
          <text x={Xd(mid(e))} y={relY + 20 + (i % 2) * 12} className="tl-dim" textAnchor="middle">{e.name}</text></g>)}
        <path d={`M${L} ${undY}H${R}`} className="tl-rule-soft" /><text x={8} y={undY - 6} className="tl-faint">UNDATED</text>
      </g>}
      {!dated && rel && <g>
        <path d={`M${L} ${relY}H${R}`} className="tl-rule" /><text x={8} y={relY - 6} className="tl-faint">UNDATED</text>
        {edges.map(e => { const i = shown.findIndex(s => s.id === e.from), j = shown.findIndex(s => s.id === e.to), s = standingOf(e.st), xa = L + 30 + i * (R - L - 60) / Math.max(1, shown.length - 1), xb = L + 30 + j * (R - L - 60) / Math.max(1, shown.length - 1)
          return i < 0 || j < 0 ? null : <path key={e.id} d={`M${xa} ${relY}Q${(xa + xb) / 2} ${relY - Math.abs(xb - xa) * 0.56} ${xb} ${relY}`} fill="none" stroke={s.tone} strokeWidth={1.6} strokeDasharray={s.dash} /> })}
        {shown.map((e, i) => { const x = L + 30 + i * (R - L - 60) / Math.max(1, shown.length - 1); return <g key={e.id}><circle cx={x} cy={relY} r={5} fill="var(--dp-well)" stroke={toneOf(e.cat)} strokeWidth={1.6} /><text x={x} y={relY + 20 + (i % 2) * 12} className="tl-dim" textAnchor="middle">{e.name}</text></g> })}
      </g>}
      {dated && ln !== 'relative' && <g>
        <text x={8} y={ovY - 6} className="tl-faint">OVERVIEW</text>
        <rect x={L} y={ovY} width={R - L} height={ovH} fill="none" className="tl-rule" />
        {bins.map((n, i) => n > 0 && <rect key={i} x={Xd((Math.floor(d0 / 100) + i) * 100) + 1} y={ovY + ovH - n * 7} width={Math.max(1, Xd(100) - Xd(0) - 2)} height={n * 7} fill="var(--dp-value)" fillOpacity={0.4} />)}
        {win && <path d={`M${Xd(win[0])} ${ovY + ovH + 5}H${Xd(win[1])}`} stroke="var(--dp-value)" strokeWidth={3} />}
        {ln === 'chronology' && <rect x={clampTo(L, R, Xd(c0))} y={ovY - 2} width={Math.max(2, clampTo(L, R, Xd(c1)) - clampTo(L, R, Xd(c0)))} height={ovH + 4} fill="var(--dp-on)" fillOpacity={0.16} stroke="var(--dp-on)" />}
        <text x={L} y={ovY + ovH + 15} className="tl-faint">{yearText(d0)}</text><text x={R} y={ovY + ovH + 15} className="tl-faint" textAnchor="end">{yearText(d1)}</text>
      </g>}
      {dated && ln !== 'relative' && (rel ? edges.length > 0 : links && inView.length > 0) && <g>{STANDINGS.map((s, i) => <g key={s.id}>
        <path d={`M${W - 590 + i * 96} ${H - 8}h20`} stroke={s.tone} strokeWidth={1.6} strokeDasharray={s.dash} /><text x={W - 566 + i * 96} y={H - 5} className="tl-faint">{s.label.toLowerCase()}</text></g>)}</g>}
    </svg>
  </div>
}

// ---------------------------------------------------------------- the controls

const light = (v: V) => str(v, 'light') as LightState
const yearScale = (v: V) => ({min: num(v, 'domFrom'), max: num(v, 'domTo')})
const lensOptions = (v: V) => [
  {value: 'chronology', label: 'Chronology', does: 'Events on the ruler, by date.'}, {value: 'relations', label: 'Relations', does: 'The relations between events, as arcs.'},
  ...(str(v, 'relZero') ? [{value: 'relative', label: 'Relative', does: 'Steps from the zero that the session names. No calendar year.'}] : []),
]

const LENS = (p: ViewProps) => <Radio key="lens" label="Lens" does="How the events relate. Relative shows only when the session names a zero." value={lens(p.v)} options={lensOptions(p.v)} stack onChange={x => p.set('lens', x)} />
const LINKS = (p: ViewProps) => <Toggle key="links" label="Links" does="Draws the relation links over the chronology." on={on(p.v, 'links')} onChange={x => p.set('links', x)}
  disabled={lens(p.v) === 'chronology' ? undefined : lens(p.v) === 'relations' ? 'The Relations lens always draws its links.' : 'The relative axis draws no links.'} />
const ARCH = (p: ViewProps) => <Toggle key="arch" label="Archetypes" does="Adds the archetypal family under each event." on={on(p.v, 'archetypes')} onChange={x => p.set('archetypes', x)} />
const LENSBOX = (p: ViewProps) => <div key="lens" style={{gridColumn: 'span 2', width: '100%'}}><Chooser label="Lens" does="How the events relate. Relative shows only when the session names a zero." value={lens(p.v)}
  options={lensOptions(p.v)} onChange={x => p.set('lens', x)} /></div>
const WALK = (p: ViewProps) => <Toggle key="walk" label="Walk" does="Joins the events in date order, as a walk." on={on(p.v, 'walk')} onChange={x => p.set('walk', x)} />
const ZOOMDIAL = (p: ViewProps) => <Dial key="zoom" label="Zoom" does="Pixels for each year. Turn up to read a century; down to read the ages." value={num(p.v, 'zoom')} def={2} scale={ZOOM} format={zoomText} onChange={x => p.set('zoom', x)} />
const CENTRE = (p: ViewProps) => <ValueBox key="centre" label="Centre" does="The year at the centre of the view." value={num(p.v, 'centre')} def={1700} scale={yearScale(p.v)} format={x => yearText(x)} onChange={x => p.set('centre', Math.round(x))} />

const windowOn = (p: ViewProps, x: boolean) => {
  if (x) { p.set('readOn', true); p.set('readFrom', num(p.v, 'winFrom')); p.set('readTo', num(p.v, 'winTo')) } else p.set('readOn', false)
}
const WINDOW = (p: ViewProps) => <Toggle key="window" label="Window" does="Reads over the window set by From and To. Off reads over all time. The other panes take the same window."
  on={on(p.v, 'readOn')} onChange={x => windowOn(p, x)} />

const applyView = (p: ViewProps, id: string) => { p.set('view', id); for (const [k, x] of Object.entries(VIEWS[id] ?? {})) p.set(k, x) }
const VIEW = (p: ViewProps) => <div key="view" style={{gridColumn: 'span 2', width: '100%'}}><Chooser label="View" does="Goes to a saved view: its camera, lens, links and card filters." value={str(p.v, 'view')}
  options={[{value: 'none', label: 'None'}, {value: 'late', label: 'Late antiquity'}, {value: 'alchemy', label: 'Alchemy'}]} onChange={x => (x === 'none' ? p.set('view', 'none') : applyView(p, x))} /></div>

const catItems = (v: V): RowItem[] => CATS.map(c => ({id: c.id, name: c.label, light: on(v, `cat_${c.id}`) ? 'lit' : 'dark', tone: 'value', request: on(v, `cat_${c.id}`),
  note: String(EVENTS.filter(e => e.cat === c.id).length), does: `Shows or hides the ${c.label.toLowerCase()} cards.`}))

const shownIn = (v: V) => shownEvents(v).length
const outside = (v: V) => { const w = readWin(v); return w ? shownEvents(v).filter(e => !inScope(e, w)).length : 0 }

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
    // Readings: what the owner reports, never set from here.
    domFrom: 200, domTo: 1960, paneW: 960, dated: true, relZero: '',
  },
  fixtures: {
    'Adam': {},
    'No dates': {dated: false, lens: 'relations'},
    'Your work': {relZero: 'DAY 2026-10-15', lens: 'relative', mode: 'activity', workDay: 55, workNow: 43},
  },

  folded: p => <Folded title="Timeline" light={light(p.v)} readings={[lensLabel(p.v), windowText(p.v)]} onUnfold={p.nav.unfold} />,

  compact: p => <Panel title="Timeline" view="compact" light={light(p.v)} onFold={p.nav.fold} onFull={p.nav.full} onSelect={p.nav.select}>
    <Section width={152}><Ruler v={p.v} set={p.set} w={140} h={146} /></Section>
    <Section label="Macros" cols={2}>
      {LENSBOX(p)}{ZOOMDIAL(p)}<div style={{display: 'grid', gap: 6, justifyItems: 'center', alignContent: 'start', paddingTop: 12}}>{LINKS(p)}{WINDOW(p)}</div>
    </Section>
  </Panel>,

  whole: p => {
    const rel = lens(p.v) === 'relations', st = (id: Standing) => <Toggle key={id} label={standingOf(id).label} does={`Shows ${standingOf(id).label.toLowerCase()} relations. The chronology filters no event by standing.`}
      tone="value" on={on(p.v, `st_${id}`)} onChange={x => p.set(`st_${id}`, x)} disabled={rel ? undefined : 'The chronology filters no event by standing. The Relations lens does.'} />
    return <Panel title="Timeline" view="whole" light={light(p.v)} onFold={p.nav.fold} onFull={p.nav.full}
      pages={[{id: 'lens', label: 'Lens'}, {id: 'filters', label: 'Filters'}]} page={p.page} onPage={p.setPage}>
      {p.page !== 'filters' ? <>
        <Band>
          <Section width={206}><Ruler v={p.v} set={p.set} w={194} h={146} whole /></Section>
          <Section label="Lens" cols={2} grow>
            {LENS(p)}
            <div style={{display: 'grid', gap: 4, justifyItems: 'center'}}>{LINKS(p)}{ARCH(p)}{WALK(p)}</div>
            <div style={{gridColumn: 'span 2', width: '100%'}}>
              <Chooser label="Relations" does="Which relations the Relations lens draws." value={str(p.v, 'mode')} options={MODES} onChange={x => p.set('mode', x)}
                disabled={rel ? undefined : 'Choose the Relations lens first.'} />
            </div>
          </Section>
        </Band>
        <Band>
          <Section label="Camera" cols={2}>{ZOOMDIAL(p)}{CENTRE(p)}</Section>
          <Section label="Window" cols={2}>
            <ValueBox label="From" does="The start of the window. Press Read over to apply it." value={num(p.v, 'winFrom')} def={800} scale={yearScale(p.v)} format={x => yearText(x)} onChange={x => p.set('winFrom', Math.min(Math.round(x), num(p.v, 'winTo')))} />
            <ValueBox label="To" does="The end of the window. Press Read over to apply it." value={num(p.v, 'winTo')} def={1700} scale={yearScale(p.v)} format={x => yearText(x)} onChange={x => p.set('winTo', Math.max(Math.round(x), num(p.v, 'winFrom')))} />
            <Action label="Read over" does="Asserts the window you set. The World and the other panes take it." onPress={() => windowOn(p, true)} />
            <Action label="Clear" does="Gives the window back: reads over all time." onPress={() => windowOn(p, false)} disabled={on(p.v, 'readOn') ? undefined : 'No window is set.'} />
          </Section>
          <Section label="Views" cols={2} grow>
            {VIEW(p)}
            <Action label="Save view" does="Names the present camera, lens, links and filters, and keeps them." onPress={() => {}} />
            <Action label="Refresh" does="Reads the timeline again from its owner." onPress={() => {}} />
          </Section>
        </Band>
      </> : <>
        <Band>
          <Section width={206}><Ruler v={p.v} set={p.set} w={194} h={146} whole /></Section>
          <Section label="Standing" cols={2}>
            {STANDINGS.map(s => st(s.id))}
            <div style={{gridColumn: 'span 2'}}><Action label="Show all" does="Shows every standing again." onPress={() => STANDINGS.forEach(s => p.set(`st_${s.id}`, true))} disabled={rel ? undefined : 'The chronology filters no event by standing.'} /></div>
          </Section>
          <Section label="Reading" grow>
            <Readout label="events" does="Events the cards show." value={shownIn(p.v)} tone="value" />
            <Readout label="outside" does="Events outside the window you read over." value={outside(p.v)} tone="accent" />
            <Readout label="links" does="Relations the lens draws." value={shownEdges(p.v).length} />
          </Section>
        </Band>
        <Band>
          <Section label="Cards" width={150}>
            <Rows does="The categories of cards on the ruler. Press a square to hide or show one." items={catItems(p.v)} onRequest={(id, x) => p.set(`cat_${id}`, x)} size={3} />
          </Section>
          <Section label="Frame" width={96}>
            <Readout label="frame" does="The timeline that the ruler shows." value={str(p.v, 'frame')} />
            <Action label="Sub-timeline" does="Opens the selected event as its own timeline." onPress={() => p.set('frame', EVENTS.find(e => e.id === str(p.v, 'selected'))?.name ?? 'Earth')} disabled={str(p.v, 'selected') ? undefined : 'Select an event first.'} />
            <Action label="Earth" does="Returns to the Earth timeline." onPress={() => p.set('frame', 'Earth')} disabled={str(p.v, 'frame') === 'Earth' ? 'The ruler already shows Earth.' : undefined} />
          </Section>
          <Section label="Your work" cols={2} grow>
            <Readout label="DAY" does="Day facets in the reading." value={num(p.v, 'workDay')} />
            <Readout label="NOW" does="NOW clearings in the reading." value={num(p.v, 'workNow')} />
            <Readout label="Session" does="Session facets in the reading." value={num(p.v, 'workSession')} />
            <Readout label="Run" does="Run facets in the reading." value={num(p.v, 'workRun')} />
          </Section>
        </Band>
      </>}
    </Panel>
  },

  full: p => <Pane v={p.v} />,

  widget: p => <Tile title="Timeline" light={light(p.v)} span={2} onFull={p.nav.full}>
    <Ruler v={p.v} w={150} h={104} tile />
    <div className="tl-tile-read">
      <Readout big label="events" does="Events the cards show." value={shownIn(p.v)} tone="value" />
      <Readout label="span" does="Years the view spans." value={spanText(spanYears(p.v))} />
      <Readout label="window" does="The window you read over." value={on(p.v, 'readOn') ? 'set' : 'all time'} tone={on(p.v, 'readOn') ? 'accent' : undefined} />
    </div>
  </Tile>,
}
