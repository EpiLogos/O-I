// The Sky (manual §22.1): where the ten bodies stand on the ecliptic, for now or for any day. Live's nearest: Wavetable — one
// large display with a handle, a few global columns round it. The display is the ecliptic ring: the tropical zodiac with its
// decans, the ten bodies each at the longitude the owner reports, the Earth at the centre. Every mark is drawn from the values.
//
// Owners. The sky is calculated by Quaternal Logic (providers/sky/kerykeion_snapshot.py): `ql.sky-request/v1` goes in,
// `ql.sky-snapshot/v1` comes back with ten longitudes, their daily speeds and whether each goes backward. The interface does not
// compute astronomy: the bodies are the owner's readings. The aspect rule below is the owner's (crates/ql-mef/src/m2.rs
// `aspect`), the interval and the chakra are the owner's M2-5 map (m2_sky.rs, `planet_chakra_route`), the Moves are the owner's
// compiled plan (inhabitants/ql/qlModulationSources.ts). A request that the owner has not answered shows in italics.
import {Band, Dial, Display, Folded, Handle, Panel, Radio, Readout, Rows, Section, Tile, Toggle, ValueBox, type LightState, type RowItem} from '../../sdk/panel'
import {clock, num, on, str, type DesignedDevice, type Value, type ViewProps} from './design'
import './quaternal-logic__sky.css'

type V = ViewProps['v']
type Set = ViewProps['set']

// ---------------------------------------------------------------- the bodies and what the owner states about each

const BODIES = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'] as const
type Body = typeof BODIES[number]
const VS = '︎' // text presentation, so the glyph never turns into a picture
const GLYPH: Record<Body, string> = {Sun: '☉', Moon: '☽', Mercury: '☿', Venus: '♀', Mars: '♂', Jupiter: '♃', Saturn: '♄', Uranus: '♅', Neptune: '♆', Pluto: '♇'}
const SIGN = ['Ari', 'Tau', 'Gem', 'Can', 'Leo', 'Vir', 'Lib', 'Sco', 'Sag', 'Cap', 'Aqu', 'Pis']
const SIGN_GLYPH = ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓']
/** The M2-5 map: the planet's just ratio from the root (m2_sky.rs) and the chakra it is tied to (planet_chakra_route). Uranus has neither. */
const TIE: Record<Body, {ratio: string; chakra: string}> = {
  Sun: {ratio: '1:1', chakra: 'Crown'}, Moon: {ratio: '4:3', chakra: 'Third eye'}, Mercury: {ratio: '5:4', chakra: 'Throat'},
  Venus: {ratio: '9:8', chakra: 'Heart'}, Mars: {ratio: '15:8', chakra: 'Solar plexus'}, Jupiter: {ratio: '5:3', chakra: 'Sacral'},
  Saturn: {ratio: '3:2', chakra: 'Root'}, Uranus: {ratio: 'none', chakra: 'none'}, Neptune: {ratio: '9:5', chakra: 'Third eye'},
  Pluto: {ratio: '9:4', chakra: 'Crown'},
}
/** The owner's aspect rule (m2.rs `aspect`): the angle between two longitudes, and the nearest of five angles within its allowance. */
const ASPECTS = [{angle: 0, orb: 10}, {angle: 60, orb: 6}, {angle: 90, orb: 8}, {angle: 120, orb: 8}, {angle: 180, orb: 10}] as const
const aspectOf = (a: number, b: number) => {
  let d = Math.abs(a - b) % 360
  if (d > 180) d = 360 - d
  let kind = -1, best = 999
  ASPECTS.forEach((t, i) => { const o = Math.abs(d - t.angle); if (o <= t.orb && o < best) { kind = i; best = o } })
  return {kind, orb: best}
}

// ---------------------------------------------------------------- the owner's readings, used as the fixture

type Snap = {epoch: string; at: Record<Body, readonly [number, number, boolean]>}
/** fixtures/kernel/sky-snapshot-world-2026-09-28-v2.json — longitude, longitude speed (°/day), retrograde; Moshier, shared geocentric. */
const S0928: Snap = {epoch: '2026-09-28T12:00:00Z', at: {
  Sun: [185.3841, .9811, false], Moon: [28.4415, 14.0119, false], Mercury: [207.3048, 1.3743, false], Venus: [218.0566, .1781, false],
  Mars: [120.2251, .5877, false], Jupiter: [139.1394, .1825, false], Saturn: [11.7737, -.0778, true], Uranus: [65.5651, -.0147, true],
  Neptune: [2.9311, -.0277, true], Pluto: [303.1411, -.0081, true]}}
/** fixtures/kernel/sky-snapshot-known-e6d-2026-09-15-v1.json. */
const S0915: Snap = {epoch: '2026-09-15T13:46:21Z', at: {
  Sun: [172.7452, .9747, false], Moon: [226.2586, 12.3891, false], Mercury: [188.055, 1.6019, false], Venus: [213.1681, .5503, false],
  Mars: [112.4748, .6111, false], Jupiter: [136.6779, .1977, false], Saturn: [12.7437, -.0712, true], Uranus: [65.6872, -.0041, true],
  Neptune: [3.2876, -.0272, true], Pluto: [303.2804, -.0133, true]}}
const sky = (s: Snap): Record<string, Value> => ({readEpoch: s.epoch, ...Object.fromEntries(BODIES.flatMap(b => [[`lon:${b}`, s.at[b][0]], [`sp:${b}`, s.at[b][1]], [`rx:${b}`, s.at[b][2]]]))})
/** A birth sky, as `ql.nara-natal/v1` carries it (sky.bodies). The fixture person was born under the 15 September snapshot. */
const birth = (s: Snap): Record<string, Value> => Object.fromEntries(BODIES.flatMap(b => [[`nlon:${b}`, s.at[b][0]], [`nrx:${b}`, s.at[b][2]]]))

/** What the sky moves now: the owner's compiled plan (qlModulationSources.ts `compileQlModulationPlan`), evaluated on the Vimarśā
 * reading for the Venus ratio 9:8. Eight tones (octet) and four modes (quartet) are its declared sources. */
const MOVES = [
  {id: 'o0', source: 'octet 0', group: 'o', n: 0, target: 'Drive', min: 0, max: 6, base: 1, value: 1.661, held: false},
  {id: 'o4', source: 'octet 4', group: 'o', n: 4, target: 'Pulse mix', min: 0, max: 100, base: 50, value: 73.573, held: false},
  {id: 'q1', source: 'quartet 1', group: 'q', n: 1, target: 'Damping', min: .1, max: 40, base: 4.5, value: 10.155, held: false},
  {id: 'o7', source: 'octet 7', group: 'o', n: 7, target: 'Agitation', min: 0, max: 5, base: .3, value: 5, held: true},
] as const

// ---------------------------------------------------------------- time

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MS_DAY = 864e5, FIRST = Date.UTC(1800, 0, 1), END = Date.UTC(2400, 0, 1)
const toMs = (year: number, day: number, minutes: number) => Date.UTC(year, 0, 1) + (day - 1) * MS_DAY + minutes * 6e4
const clampMs = (ms: number) => Math.min(END - 6e4, Math.max(FIRST, ms))
const parts = (ms: number) => {
  const d = new Date(ms), year = d.getUTCFullYear()
  return {year, day: Math.floor((ms - Date.UTC(year, 0, 1)) / MS_DAY) + 1, time: d.getUTCHours() * 60 + d.getUTCMinutes()}
}
const dayLabel = (year: number, day: number) => { const d = new Date(Date.UTC(year, 0, 1) + (day - 1) * MS_DAY); return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}` }
const dateLabel = (ms: number) => { const d = new Date(ms); return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}` }
const minute = (ms: number) => Math.floor(ms / 6e4)
const rate = (s: number) => {
  const t = (x: number, d: number) => `${parseFloat(x.toFixed(d))}`
  return s < 59.5 ? `${Math.round(s)} s/s` : s < 3570 ? `${t(s / 60, s < 600 ? 1 : 0)} min/s` : s < 86000 ? `${t(s / 3600, s < 36000 ? 1 : 0)} h/s` : '1 day/s'
}

const reading = (v: V) => v.reading === true
const readMs = (v: V) => Date.parse(str(v, 'readEpoch'))
const askedMs = (v: V) => toMs(num(v, 'year'), num(v, 'day'), num(v, 'time'))
/** A request that the owner has not answered yet: the date asked is not the date the picture shows. */
const waiting = (v: V) => reading(v) && !on(v, 'now') && minute(askedMs(v)) !== minute(readMs(v))
const shownParts = (v: V) => (on(v, 'now') && reading(v) ? parts(readMs(v)) : {year: num(v, 'year'), day: num(v, 'day'), time: num(v, 'time')})

// ---------------------------------------------------------------- the ring

const mod360 = (x: number) => ((x % 360) + 360) % 360
const wrap180 = (x: number) => mod360(x + 180) - 180
const at = (cx: number, cy: number, r: number, lon: number): [number, number] => [cx + r * Math.cos(lon * Math.PI / 180), cy - r * Math.sin(lon * Math.PI / 180)]
const f1 = (x: number) => x.toFixed(1)
const seg = (a: readonly [number, number], b: readonly [number, number]) => `M${f1(a[0])} ${f1(a[1])}L${f1(b[0])} ${f1(b[1])}`
const place = (lon: number, back: boolean) => `${Math.floor(lon % 30)}° ${SIGN[Math.floor(mod360(lon) / 30)]}${back ? ' R' : ''}`
const lonOf = (v: V, b: Body) => num(v, `lon:${b}`)

/** The radii of the ring, as fractions of its radius: the natal track, the zodiac band, the bodies, two tiers of labels. */
const radii = (R: number) => ({natal: R * .97, out: R * .9, inn: R * .72, body: R * .59, label: R * .45, label2: R * .3})

/** The date the Sun handle stands for: the owner's Sun, moved by the owner's own daily speed to the date asked. */
const sunAsked = (v: V) => mod360(lonOf(v, 'Sun') + num(v, 'sp:Sun') * ((on(v, 'now') ? readMs(v) : askedMs(v)) - readMs(v)) / MS_DAY)

type Size = 'tiny' | 'small' | 'big'

function Ring({v, cx, cy, R, size}: {v: V; cx: number; cy: number; R: number; size: Size}) {
  const ok = reading(v), r = radii(R), big = size === 'big', tiny = size === 'tiny'
  const fs = big ? 15 : Math.max(7.5, R * .14), gs = (r.out - r.inn) * .8
  const shown = BODIES.filter(b => ok && v[`b:${b}`] !== false)
  const order = [...shown].sort((a, b) => lonOf(v, a) - lonOf(v, b))
  const gap = (fs * 1.25 / r.label) * 180 / Math.PI
  const tier = new Map<Body, number>()
  order.forEach((b, i) => { const prev = order[i - 1]; tier.set(b, prev && lonOf(v, b) - lonOf(v, prev) < gap && tier.get(prev) === 0 ? 1 : 0) })
  const pairs = on(v, 'aspects') ? shown.flatMap((a, i) => shown.slice(i + 1).map(b => ({a, b, ...aspectOf(lonOf(v, a), lonOf(v, b))}))).filter(x => x.kind > 0) : []
  const natal = on(v, 'natal') && on(v, 'haveBirth')
  const lines = (str(v, 'reason') || 'No sky.').split(' ').reduce<string[]>((acc, w) => { const last = acc[acc.length - 1]; if (last !== undefined && (last + ' ' + w).length <= 12) acc[acc.length - 1] = `${last} ${w}`; else acc.push(w); return acc }, [])
  return <g>
    <circle cx={cx} cy={cy} r={r.out} className="dp-faint" />
    <circle cx={cx} cy={cy} r={r.inn} className="dp-faint" />
    {Array.from({length: 36}, (_, i) => {
      const lon = i * 10, edge = i % 3 === 0
      return <path key={i} d={seg(at(cx, cy, edge ? r.inn : r.out - (r.out - r.inn) * .38, lon), at(cx, cy, r.out, lon))} className="dp-faint" opacity={edge ? 1 : .75} />
    })}
    {big && Array.from({length: 72}, (_, i) => i % 2 === 0 ? null : <path key={i} d={seg(at(cx, cy, r.out - 4, i * 5), at(cx, cy, r.out, i * 5))} className="dp-faint" opacity={.5} />)}
    {!tiny && SIGN_GLYPH.map((g, i) => { const [x, y] = at(cx, cy, (r.out + r.inn) / 2, i * 30 + 15)
      return <text key={g} x={x} y={y + gs * .36} textAnchor="middle" className="dp-axis sky-glyph" style={{fontSize: gs}}>{g + VS}</text> })}
    <circle cx={cx} cy={cy} r={r.body} className="dp-faint" opacity={.35} />
    {/* the Earth: the centre, the anchor — not a body of the ring */}
    <circle cx={cx} cy={cy} r={big ? 5 : 3} className="dp-faint" />
    <path d={`M${cx - (big ? 8 : 5)} ${cy}H${cx + (big ? 8 : 5)}M${cx} ${cy - (big ? 8 : 5)}V${cy + (big ? 8 : 5)}`} className="dp-faint" />
    {big && <text x={cx} y={cy + 20} textAnchor="middle" className="dp-axis">Earth</text>}
    {pairs.map(({a, b, kind, orb}) => {
      const hard = kind === 2 || kind === 4, lim = ASPECTS[kind].orb
      return <path key={`${a}-${b}`} d={seg(at(cx, cy, r.body - 3, lonOf(v, a)), at(cx, cy, r.body - 3, lonOf(v, b)))} fill="none"
        stroke={hard ? 'var(--dp-on)' : 'var(--dp-value)'} strokeWidth={big ? 1.4 : .9} opacity={.9 - .7 * orb / lim} />
    })}
    {natal && BODIES.map(b => { const [x, y] = at(cx, cy, r.natal, num(v, `nlon:${b}`))
      return <circle key={b} cx={x} cy={y} r={big ? 3.2 : 1.9} fill="none" stroke="var(--dp-value)" strokeWidth={1} opacity={.85} /> })}
    {shown.map(b => {
      const l = lonOf(v, b), [x, y] = at(cx, cy, r.body, l), [tx, ty] = at(cx, cy, tier.get(b) ? r.label2 : r.label, l)
      return <g key={b}>
        {big && <path d={seg(at(cx, cy, r.body - 7, l), at(cx, cy, (tier.get(b) ? r.label2 : r.label) + 11, l))} className="dp-faint" opacity={.6} />}
        <circle cx={x} cy={y} r={big ? 4.6 : tiny ? 2 : 2.7} fill={v[`rx:${b}`] === true ? 'var(--dp-well)' : 'var(--dp-value)'} stroke="var(--dp-value)" strokeWidth={1.3} />
        {!tiny && <text x={tx} y={ty} textAnchor="middle" dominantBaseline="central" className="dp-ink sky-glyph" style={{fontSize: fs}}>{GLYPH[b] + VS}</text>}
      </g>
    })}
    {!ok && <g>
      {lines.map((line, i) => <text key={line} x={cx} y={cy - r.body * .88 + i * 11} textAnchor="middle" className="dp-ink-dim">{line}</text>)}
    </g>}
  </g>
}

/** The ecliptic ring in a well, with the one handle: the Sun, which carries the date. Drag it round the ring and the date moves
 * through the year, a day for each degree the owner's Sun travels. */
function SkyDisplay({v, set, w, h, R, size}: {v: V; set?: Set; w: number; h: number; R: number; size: Size}) {
  const cx = w / 2, cy = h / 2 + 2, ok = reading(v), r = radii(R), hold = waiting(v)
  const sun = sunAsked(v), [hx, hy] = at(cx, cy, r.body, sun)
  const drag = (x: number, y: number) => {
    if (!set) return
    const days = Math.round(wrap180(mod360(Math.atan2(cy - y, x - cx) * 180 / Math.PI) - sun) / Math.max(.5, num(v, 'sp:Sun')))
    if (days === 0) return
    const p = parts(clampMs((on(v, 'now') ? readMs(v) : askedMs(v)) + days * MS_DAY))
    set('now', false); set('year', p.year); set('day', p.day); set('time', p.time)
  }
  const when = ok ? dateLabel(readMs(v)) + (on(v, 'now') ? ' · now' : '') : 'no sky'
  return <Display w={w} h={h} label="The sky" does="The ecliptic ring of the date. Each body stands at its degree. A hollow body moves backward. Drag handle 1 to change the date."
    corner={hold ? 'waiting' : when}>
    <Ring v={v} cx={cx} cy={cy} R={R} size={size} />
    {hold && <text x={5} y={12} className="dp-ink-dim" style={{fontStyle: 'italic'}}>asked {dateLabel(askedMs(v))}</text>}
    <text x={5} y={h - 5} className="dp-axis">ecliptic</text>
    <text x={w - 5} y={h - 5} textAnchor="end" className="dp-axis">{str(v, 'observer') === 'private' ? 'private' : 'shared'}</text>
    {ok && set && <Handle n={1} shape="ring" x={hx} y={hy} label="Date" does="Drag the Sun round the ring: the date moves through the year." onDrag={drag}
      onReset={() => set('now', true)} />}
  </Display>
}

/** The widget's ring: press it and the date returns to now. */
function TapRing({v, set, size}: {v: V; set?: Set; size: number}) {
  return <Display w={size} h={size} label="The sky" does="Press the ring to return the date to now.">
    <rect x={0} y={0} width={size} height={size} fill="transparent" style={{cursor: set ? 'pointer' : 'default'}} role="button" tabIndex={set ? 0 : -1}
      aria-label="Return the date to now" onClick={() => set?.('now', true)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') set?.('now', true) }} />
    <Ring v={v} cx={size / 2} cy={size / 2} R={size / 2 - 5} size="tiny" />
  </Display>
}

/** What the sky moves: the sources on the left, each parameter on the right as a range with the value the plan gives. */
function MovesDisplay({w, h}: {w: number; h: number}) {
  const x0 = 46, x1 = 128, x2 = w - 10, top = 18, step = (h - 28) / 11
  const ys = (group: string, n: number) => top + (group === 'o' ? n : 8 + n) * step
  const lane = (i: number) => 40 + i * 30
  return <Display w={w} h={h} label="What the sky moves" does="Each source that moves a parameter now, and the value it gives. Amber: held at the end of the range." corner={`${MOVES.length} moves`}>
    <text x={5} y={top - 6} className="dp-axis">octet</text>
    <text x={5} y={ys('q', 0) - 6} className="dp-axis">quartet</text>
    {[...Array(8)].map((_, n) => <circle key={`o${n}`} cx={x0} cy={ys('o', n)} r={2.2} fill={MOVES.some(m => m.group === 'o' && m.n === n) ? 'var(--dp-value)' : 'none'} className={MOVES.some(m => m.group === 'o' && m.n === n) ? undefined : 'dp-faint'} />)}
    {[...Array(4)].map((_, n) => <circle key={`q${n}`} cx={x0} cy={ys('q', n)} r={2.2} fill={MOVES.some(m => m.group === 'q' && m.n === n) ? 'var(--dp-value)' : 'none'} className={MOVES.some(m => m.group === 'q' && m.n === n) ? undefined : 'dp-faint'} />)}
    {MOVES.map((m, i) => {
      const y = ys(m.group, m.n), t = lane(i), u = (m.value - m.min) / (m.max - m.min), b = (m.base - m.min) / (m.max - m.min)
      return <g key={m.id}>
        <path d={`M${x0 + 3} ${f1(y)}C${f1(x0 + 44)} ${f1(y)} ${f1(x1 - 44)} ${t} ${x1} ${t}`} fill="none" stroke={m.held ? 'var(--dp-on)' : 'var(--dp-value)'} strokeWidth={1.2} opacity={.8} />
        <path d={`M${x1} ${t}H${x2}`} className="dp-faint" />
        <path d={`M${f1(x1 + b * (x2 - x1))} ${t - 3}V${t + 3}`} className="dp-faint" />
        <circle cx={f1(x1 + u * (x2 - x1))} cy={t} r={3.2} fill={m.held ? 'var(--dp-on)' : 'var(--dp-value)'} />
        <text x={x1} y={t - 6} className="dp-axis">{m.target}</text>
        <text x={x2} y={t + 12} textAnchor="end" className="dp-ink-dim">{parseFloat(m.value.toFixed(2))}</text>
      </g>
    })}
  </Display>
}

// ---------------------------------------------------------------- the parts shared by the views

const light = (v: V) => str(v, 'light') as LightState
const OBSERVERS = [{value: 'shared', label: 'Shared', does: 'The sky as seen from the centre of the Earth.'}, {value: 'private', label: 'Private', does: 'The sky as seen from your place. Only you see it.'}] as const
const SPEED = {min: 1, max: 86400, log: true}
const sunReading = (v: V) => (reading(v) ? `Sun ${place(lonOf(v, 'Sun'), false)}` : 'no sky')

const bodyRows = (v: V): RowItem[] => BODIES.map(b => {
  const ok = reading(v), shown = v[`b:${b}`] !== false
  return {id: b, name: b, request: shown, light: !ok ? 'unknown' : shown ? 'lit' : 'dark', tone: 'value',
    mark: <span className="sky-glyph">{GLYPH[b] + VS}</span>, note: ok ? place(lonOf(v, b), v[`rx:${b}`] === true) : '—'}
})
const moveRows = (): RowItem[] => MOVES.map(m => ({id: m.id, name: `${m.source} → ${m.target}`, light: 'lit', tone: m.held ? 'accent' : 'value', note: `${parseFloat(m.value.toFixed(2))}`,
  why: m.held ? 'Held at the end of the range.' : undefined}))

const nowToggle = (p: ViewProps) => <Toggle label="Now" does="Show the sky of this moment. Turn it off to keep the date that you chose." on={on(p.v, 'now')} onChange={x => p.set('now', x)} />
const runToggle = (p: ViewProps) => <Toggle label="Run" does="Move the date forward with time. Turn it off to keep the date." on={on(p.v, 'run')} onChange={x => p.set('run', x)} />
const speedDial = (p: ViewProps) => <Dial label="Speed" does="How fast the date moves when Run is on. The range is 1 second to 1 day for each second." value={num(p.v, 'speed')} def={3600} scale={SPEED} format={rate} onChange={x => p.set('speed', x)} />
const natalToggle = (p: ViewProps, label: string) => <Toggle label={label} does="Draw the sky of your birth as a ring round the sky of the date. Only you see it." on={on(p.v, 'natal')} onChange={x => p.set('natal', x)}
  disabled={on(p.v, 'haveBirth') ? undefined : 'No birth data is saved.'} />

// ---------------------------------------------------------------- the pane: the sky itself

function FullSky({v}: {v: V}) {
  const ok = reading(v), cx = 214, cy = 210, R = 190
  const rows = BODIES.map((b, i) => {
    const y = 76 + i * 29, shown = ok && v[`b:${b}`] !== false, l = ok ? lonOf(v, b) : NaN
    const minutes = Math.floor((l % 1) * 60)
    return <g key={b} opacity={shown ? 1 : .4}>
      <path d={`M446 ${y + 10}H748`} className="dp-grid" />
      <text x={458} y={y} textAnchor="middle" className="dp-ink sky-glyph" style={{fontSize: 15}}>{GLYPH[b] + VS}</text>
      <text x={474} y={y} className="dp-ink">{b}</text>
      <text x={534} y={y} className="dp-ink">{ok ? `${Math.floor(l % 30)}°${String(minutes).padStart(2, '0')}′ ${SIGN[Math.floor(mod360(l) / 30)]}` : '—'}</text>
      <text x={606} y={y} className="dp-ink-dim">{ok && v[`rx:${b}`] === true ? 'R' : ''}</text>
      <text x={626} y={y} className="dp-ink-dim">{TIE[b].ratio}</text>
      <text x={668} y={y} className="dp-ink-dim">{TIE[b].chakra}</text>
    </g>
  })
  return <div className="ref-pane-body ref-pane-body--dark">
    <svg viewBox="0 0 760 420" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" className="ref-pane-svg" aria-label="The sky over your world">
      <g className="dp-display" style={{background: 'none', border: 'none'}}>
        <Ring v={v} cx={cx} cy={cy} R={R} size="big" />
        <text x={474} y={44} className="dp-axis">body</text>
        <text x={534} y={44} className="dp-axis">position</text>
        <text x={626} y={44} className="dp-axis">interval</text>
        <text x={668} y={44} className="dp-axis">chakra</text>
        <path d="M446 54H748" className="dp-faint" />
        {rows}
        <text x={446} y={366} className="dp-ink-dim">{ok ? `${dateLabel(readMs(v))} ${clock(parts(readMs(v)).time)} UTC · ${str(v, 'observer') === 'private' ? 'private' : 'shared'} view` : 'The dated sky is unavailable.'}</text>
        <text x={446} y={381} className="dp-axis">A calculated ephemeris, not an observed sky.</text>
        <text x={446} y={393} className="dp-axis">Tropical zodiac, ecliptic of date. Aries starts at the right;</text>
        <text x={446} y={405} className="dp-axis">the degrees grow against the clock.{on(v, 'natal') && on(v, 'haveBirth') ? ' Outer ring: your birth sky.' : ''}</text>
      </g>
    </svg>
  </div>
}

// ---------------------------------------------------------------- the design

export const design: DesignedDevice = {
  id: 'quaternal-logic:sky',
  title: 'Sky',
  kind: 'instrument',
  firstPage: 'sky',
  defaults: {
    light: 'lit', reading: true, reason: 'The dated sky is unavailable.',
    ...sky(S0928), ...birth(S0915),
    now: false, year: 2026, day: 271, time: 720, run: false, speed: 3600,
    observer: 'shared', aspects: false, natal: false, haveBirth: true, havePlace: true,
    backend: 'moshier', scope: 'shared-geocentric',
    ...Object.fromEntries(BODIES.map(b => [`b:${b}`, true])),
  },
  fixtures: {
    'Sky of 28 Sep 2026': {},
    'Sky of 15 Sep 2026': {...sky(S0915), year: 2026, day: 258, time: 826},
    'Aspects and natal': {aspects: true, natal: true},
    'No answer': {reading: false},
    'No birth data': {haveBirth: false, havePlace: false},
  },

  folded: p => <Folded title="Sky" light={light(p.v)} readings={reading(p.v) ? [dateLabel(readMs(p.v)), sunReading(p.v)] : ['no sky']} onUnfold={p.nav.unfold} />,

  compact: p => <Panel title="Sky" view="compact" light={light(p.v)} onFold={p.nav.fold} onFull={p.nav.full} onSelect={p.nav.select}>
    <Section width={152}><SkyDisplay v={p.v} set={p.set} w={140} h={146} R={60} size="small" /></Section>
    <Section label="Macros" width={140}>
      <div className="sky-macros">
      {nowToggle(p)}
      {natalToggle(p, 'Natal ring')}
      <div className="sky-mid">{runToggle(p)}</div>
      {speedDial(p)}
      </div>
    </Section>
  </Panel>,

  whole: p => {
    const wherePage = p.page === 'moves' ? 'moves' : 'sky'
    const t = shownParts(p.v), wait = waiting(p.v)
    return <Panel title="Sky" view="whole" light={light(p.v)} onFold={p.nav.fold} onFull={p.nav.full}
      pages={[{id: 'sky', label: 'Positions'}, {id: 'moves', label: 'Moves'}]} page={wherePage} onPage={p.setPage}>
      {wherePage === 'sky' ? <>
        <Band>
          <Section width={198}><SkyDisplay v={p.v} set={p.set} w={186} h={146} R={62} size="small" /></Section>
          <Section label="Date" width={72}>
            <ValueBox label="Year" does="The year of the sky to show, from 1800 to 2399." value={t.year} def={new Date().getUTCFullYear()} scale={{min: 1800, max: 2399, step: 1}} format={x => `${x}`}
              pending={wait} onChange={x => { p.set('now', false); p.set('year', x) }} />
            <ValueBox label="Day" does="The day of that year." value={t.day} def={1} scale={{min: 1, max: 366, step: 1}} format={x => dayLabel(t.year, x)}
              pending={wait} onChange={x => { p.set('now', false); p.set('day', x) }} />
            <ValueBox label="Time" does="The time of day, in UTC." value={t.time} def={0} scale={{min: 0, max: 1439, step: 1}} format={clock}
              pending={wait} onChange={x => { p.set('now', false); p.set('time', x) }} />
          </Section>
          <Section label="Clock" grow>
            {nowToggle(p)}
            {runToggle(p)}
            {speedDial(p)}
          </Section>
        </Band>
        <Band>
          <Section label="Bodies" width={252}>
            <Rows does="Press a square to show or hide a body. A hollow body moves backward." items={bodyRows(p.v)} columns={2} size={10}
              onRequest={(id, x) => p.set(`b:${id}`, x)} />
            <div className="sky-pair">
              <Readout label="standing" value="calculated" tone="value" does="The positions come from a calculated ephemeris. They are not an observed sky." />
              <Readout label="ephemeris" value={str(p.v, 'backend') === 'swiss-files' ? 'Swiss' : 'Moshier'} does="The ephemeris that the owner used for this sky." />
              <Readout label="zodiac" value="Tropical" does="The zodiac of the owner's reading. Aries starts at the equinox." />
            </div>
          </Section>
          <Section label="Overlay" grow>
            <Toggle label="Aspects" does="Draw a line between two bodies that stand 60, 90, 120 or 180 degrees apart, within a small allowance." on={on(p.v, 'aspects')} onChange={x => p.set('aspects', x)} />
            {natalToggle(p, 'Natal ring')}
            <Radio label="Observer" does="Whose view the sky shows." value={str(p.v, 'observer')} options={OBSERVERS} onChange={x => p.set('observer', x)}
              disabled={on(p.v, 'havePlace') ? undefined : 'No place is saved.'} />
          </Section>
        </Band>
      </> : <Band>
        <Section width={210}><MovesDisplay w={198} h={146} /></Section>
        <Section label="Moves" grow>
          <Rows does="The sources that move a parameter now, and the value that each gives." items={moveRows()} size={5} />
          <div className="sky-pair">
            <Readout label="moves" value={MOVES.length} tone="value" does="Sources that move a parameter now." />
            <Readout label="held" value={MOVES.filter(m => m.held).length} tone="accent" does="Moves held at the end of the range of the parameter." />
          </div>
        </Section>
      </Band>}
    </Panel>
  },

  full: p => <FullSky v={p.v} />,

  widget: p => <Tile title="Sky" light={light(p.v)} span={2} onFull={p.nav.full}>
    <TapRing v={p.v} set={p.set} size={100} />
    <Rows does="Each body with its degree. A hollow lamp means no reading." columns={2} size={10}
      items={BODIES.map(b => ({id: b, name: GLYPH[b] + VS, light: !reading(p.v) ? 'unknown' : p.v[`b:${b}`] === false ? 'dark' : 'lit', tone: 'value',
        note: reading(p.v) ? place(lonOf(p.v, b), p.v[`rx:${b}`] === true) : '—'}))} />
  </Tile>,
}

