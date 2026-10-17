// The Sky (manual §22.1): where the ten bodies stand on the ecliptic, for now or for any day. Live's nearest: Wavetable — one
// large display with a handle, a few global columns round it. The display is the ecliptic ring: the tropical zodiac with its
// decans, the ten bodies each at the longitude the owner reports, the Earth at the centre. Every mark is drawn from the values.
//
// Owners. The sky is calculated by Quaternal Logic (providers/sky/kerykeion_snapshot.py): `ql.sky-request/v1` goes in,
// `ql.sky-snapshot/v1` comes back with ten longitudes, their daily speeds and whether each goes backward. The interface does not
// compute astronomy: the bodies are the owner's readings. The aspect rule below is the owner's (crates/ql-mef/src/m2.rs
// `aspect`), the interval and the chakra are the owner's M2-5 map (m2_sky.rs, `planet_chakra_route`), the Moves are the owner's
// compiled plan (inhabitants/ql/qlModulationSources.ts). A request that the owner has not answered shows in italics.
//
// Values. The material is carried in value keys, as JSON shaped like what the owner returns:
//   bodies      the snapshot's `bodies`: [{body, longitude_degrees, longitude_speed_degrees_per_day, retrograde}]
//   epoch       the snapshot's `epoch_utc`, an ISO time
//   natalBodies `ql.nara-natal/v1` `sky.bodies`: [{body, longitude_degrees, retrograde}]
//   aspectList  [{a, b, angle, orb}], angle one of 0, 60, 90, 120, 180. Optional: absent, the aspects are found from `bodies`
//               by the owner's rule below.
//   moves       the compiled plan evaluated: [{id, source, group: 'o' | 'q', n, target, min, max, base, value, held}]
// A key the owner does not report arrives absent, and the view draws "—" and names the missing reading in the well.
import {Band, Dial, Display, Folded, Handle, Panel, Radio, Readout, Rows, Section, Tile, Toggle, ValueBox, type LightState, type RowItem} from '../../sdk/panel'
import {NONE, boolOf, clock, json, numOf, st, strOf, type DesignedDevice, type ViewProps} from './design'
import './quaternal-logic__sky.css'

type V = ViewProps['v']

// ---------------------------------------------------------------- vocabulary: the bodies, the signs, the owner's fixed maps

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
/** The sources of the owner's plan: eight tones (octet) and four modes (quartet). */
const SLOTS = {o: 8, q: 4} as const

// ---------------------------------------------------------------- the owner's readings, parsed with every lookup guarded

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null
const finite = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)
const isBody = (x: unknown): x is Body => typeof x === 'string' && (BODIES as readonly string[]).includes(x)
/** A number key that is reported and finite, or undefined. */
const fin = (v: V, key: string): number | undefined => { const n = numOf(v, key); return n !== undefined && Number.isFinite(n) ? n : undefined }

interface Placed {readonly lon: number; readonly speed: number | undefined; readonly back: boolean}
type Placing = Partial<Record<Body, Placed>>

/** Bodies as the owner returns them: those with a name that is one of the ten and a finite longitude. None: undefined. */
function placing(raw: unknown): Placing | undefined {
  if (!Array.isArray(raw)) return undefined
  const out: Placing = {}
  for (const e of raw) {
    if (!isRecord(e)) continue
    const body = e.body, lon = e.longitude_degrees, speed = e.longitude_speed_degrees_per_day
    if (isBody(body) && finite(lon)) out[body] = {lon, speed: finite(speed) ? speed : undefined, back: e.retrograde === true}
  }
  return Object.keys(out).length ? out : undefined
}
const bodiesOf = (v: V) => placing(json<unknown>(v, 'bodies', undefined))
const natalOf = (v: V) => placing(json<unknown>(v, 'natalBodies', undefined))

interface Pair {readonly a: Body; readonly b: Body; readonly kind: number; readonly orb: number}
/** The aspects the owner lists, or, when it lists none, those that its rule finds between the bodies it reports. */
function pairsOf(v: V, sky: Placing | undefined): Pair[] {
  const listed = json<unknown>(v, 'aspectList', undefined)
  if (Array.isArray(listed)) {
    return listed.flatMap((e): Pair[] => {
      if (!isRecord(e)) return []
      const a = e.a, b = e.b, orb = e.orb, kind = ASPECTS.findIndex(t => t.angle === e.angle)
      return isBody(a) && isBody(b) && kind >= 0 && finite(orb) ? [{a, b, kind, orb}] : []
    })
  }
  if (!sky) return []
  return BODIES.flatMap((a, i) => BODIES.slice(i + 1).flatMap((b): Pair[] => {
    const x = sky[a], y = sky[b]
    if (!x || !y) return []
    const found = aspectOf(x.lon, y.lon)
    return found.kind >= 0 ? [{a, b, ...found}] : []
  }))
}

interface Move {readonly id: string; readonly source: string; readonly group: 'o' | 'q'; readonly n: number; readonly target: string
  readonly min: number; readonly max: number; readonly base: number; readonly value: number; readonly held: boolean}
/** The owner's compiled plan, as evaluated: the moves with a source in range and a range that has width. None reported: undefined. */
function movesOf(v: V): Move[] | undefined {
  const raw = json<unknown>(v, 'moves', undefined)
  if (!Array.isArray(raw)) return undefined
  return raw.flatMap((e): Move[] => {
    if (!isRecord(e)) return []
    const {id, source, group, n, target, min, max, base, value, held} = e
    if (typeof id !== 'string' || typeof source !== 'string' || typeof target !== 'string' || (group !== 'o' && group !== 'q')) return []
    if (!finite(n) || !Number.isInteger(n) || n < 0 || n >= SLOTS[group] || !finite(min) || !finite(max) || max === min || !finite(base) || !finite(value)) return []
    return [{id, source, group, n, target, min, max, base, value, held: held === true}]
  })
}

// ---------------------------------------------------------------- time

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MS_DAY = 864e5, FIRST = Date.UTC(1800, 0, 1), END = Date.UTC(2400, 0, 1)
const toMs = (year: number, day: number, minutes: number) => Date.UTC(year, 0, 1) + (day - 1) * MS_DAY + minutes * 6e4
const clampMs = (ms: number) => Math.min(END - 6e4, Math.max(FIRST, ms))
const parts = (ms: number) => {
  const d = new Date(ms), year = d.getUTCFullYear()
  return {year, day: Math.floor((ms - Date.UTC(year, 0, 1)) / MS_DAY) + 1, time: d.getUTCHours() * 60 + d.getUTCMinutes()}
}
const dayLabel = (year: number, day: number) => { const d = new Date(Date.UTC(year, 0, 1) + (day - 1) * MS_DAY); return Number.isNaN(d.getTime()) ? NONE : `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}` }
const dateLabel = (ms: number) => { const d = new Date(ms); return Number.isNaN(d.getTime()) ? NONE : `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}` }
const minute = (ms: number) => Math.floor(ms / 6e4)
const rate = (s: number) => {
  const t = (x: number, d: number) => `${parseFloat(x.toFixed(d))}`
  return s < 59.5 ? `${Math.round(s)} s/s` : s < 3570 ? `${t(s / 60, s < 600 ? 1 : 0)} min/s` : s < 86000 ? `${t(s / 3600, s < 36000 ? 1 : 0)} h/s` : '1 day/s'
}

/** The time of the snapshot: the owner's `epoch`, or undefined when it is absent or unreadable. */
const epochMs = (v: V): number | undefined => { const s = strOf(v, 'epoch'), t = s === undefined ? NaN : Date.parse(s); return Number.isFinite(t) ? t : undefined }
/** The date that was asked: year, day and time together, or undefined when one is absent. */
const askedMs = (v: V): number | undefined => {
  const year = fin(v, 'year'), day = fin(v, 'day'), time = fin(v, 'time')
  return year === undefined || day === undefined || time === undefined ? undefined : toMs(year, day, time)
}
/** A request that the owner has not answered yet: the date asked is not the date the picture shows. */
const waiting = (v: V) => {
  const read = epochMs(v), asked = askedMs(v)
  return boolOf(v, 'now') !== true && read !== undefined && asked !== undefined && minute(asked) !== minute(read)
}
/** The date the boxes show: the snapshot's own when Now is on, the date asked otherwise. A part that is not reported is undefined. */
const shownParts = (v: V): {year: number | undefined; day: number | undefined; time: number | undefined} => {
  if (boolOf(v, 'now') === true) { const read = epochMs(v); return read === undefined ? {year: undefined, day: undefined, time: undefined} : parts(read) }
  return {year: fin(v, 'year'), day: fin(v, 'day'), time: fin(v, 'time')}
}

// ---------------------------------------------------------------- the ring

const mod360 = (x: number) => ((x % 360) + 360) % 360
const wrap180 = (x: number) => mod360(x + 180) - 180
const at = (cx: number, cy: number, r: number, lon: number): [number, number] => [cx + r * Math.cos(lon * Math.PI / 180), cy - r * Math.sin(lon * Math.PI / 180)]
const f1 = (x: number) => x.toFixed(1)
const seg = (a: readonly [number, number], b: readonly [number, number]) => `M${f1(a[0])} ${f1(a[1])}L${f1(b[0])} ${f1(b[1])}`
const place = (lon: number, back: boolean) => `${Math.floor(lon % 30)}° ${SIGN[Math.floor(mod360(lon) / 30)]}${back ? ' R' : ''}`

/** The radii of the ring, as fractions of its radius: the natal track, the zodiac band, the bodies, two tiers of labels. */
const radii = (R: number) => ({natal: R * .97, out: R * .9, inn: R * .72, body: R * .59, label: R * .45, label2: R * .3})

/** The Sun handle: where the date asked puts the owner's Sun (moved by the owner's own daily speed from the snapshot), and the
 * time that it starts from. Undefined when the Sun, its speed, the snapshot's time or the date asked is not reported. */
function sunHandle(v: V, sky: Placing | undefined): {lon: number; speed: number; from: number} | undefined {
  const sun = sky?.Sun, read = epochMs(v)
  if (!sun || sun.speed === undefined || read === undefined) return undefined
  const from = boolOf(v, 'now') === true ? read : askedMs(v)
  return from === undefined ? undefined : {lon: mod360(sun.lon + sun.speed * (from - read) / MS_DAY), speed: sun.speed, from}
}

type Size = 'tiny' | 'small' | 'big'

function Ring({v, cx, cy, R, size}: {v: V; cx: number; cy: number; R: number; size: Size}) {
  const sky = bodiesOf(v), r = radii(R), big = size === 'big', tiny = size === 'tiny'
  const fs = big ? 15 : Math.max(7.5, R * .14), gs = (r.out - r.inn) * .8
  const lon = (b: Body) => sky?.[b]?.lon ?? 0
  const shown = BODIES.filter(b => sky?.[b] !== undefined && boolOf(v, `b:${b}`) !== false)
  const order = [...shown].sort((a, b) => lon(a) - lon(b))
  const gap = (fs * 1.25 / r.label) * 180 / Math.PI
  const tier = new Map<Body, number>()
  order.forEach((b, i) => { const prev = order[i - 1]; tier.set(b, prev && lon(b) - lon(prev) < gap && tier.get(prev) === 0 ? 1 : 0) })
  const pairs = boolOf(v, 'aspects') === true ? pairsOf(v, sky).filter(x => x.kind > 0 && shown.includes(x.a) && shown.includes(x.b)) : []
  const natal = boolOf(v, 'natal') === true ? natalOf(v) : undefined
  const lines = (strOf(v, 'reason') ?? 'No reading of the sky.').split(' ').reduce<string[]>((acc, w) => { const last = acc[acc.length - 1]; if (last !== undefined && (last + ' ' + w).length <= 12) acc[acc.length - 1] = `${last} ${w}`; else acc.push(w); return acc }, [])
  return <g>
    <circle cx={cx} cy={cy} r={r.out} className="dp-faint" />
    <circle cx={cx} cy={cy} r={r.inn} className="dp-faint" />
    {Array.from({length: 36}, (_, i) => {
      const l = i * 10, edge = i % 3 === 0
      return <path key={i} d={seg(at(cx, cy, edge ? r.inn : r.out - (r.out - r.inn) * .38, l), at(cx, cy, r.out, l))} className="dp-faint" opacity={edge ? 1 : .75} />
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
      const hard = kind === 2 || kind === 4, lim = ASPECTS[kind]?.orb ?? 10
      return <path key={`${a}-${b}`} d={seg(at(cx, cy, r.body - 3, lon(a)), at(cx, cy, r.body - 3, lon(b)))} fill="none"
        stroke={hard ? 'var(--dp-on)' : 'var(--dp-value)'} strokeWidth={big ? 1.4 : .9} opacity={Math.max(.2, .9 - .7 * orb / lim)} />
    })}
    {natal && BODIES.map(b => { const n = natal[b]; if (!n) return null; const [x, y] = at(cx, cy, r.natal, n.lon)
      return <circle key={b} cx={x} cy={y} r={big ? 3.2 : 1.9} fill="none" stroke="var(--dp-value)" strokeWidth={1} opacity={.85} /> })}
    {shown.map(b => {
      const l = lon(b), [x, y] = at(cx, cy, r.body, l), [tx, ty] = at(cx, cy, tier.get(b) ? r.label2 : r.label, l)
      return <g key={b}>
        {big && <path d={seg(at(cx, cy, r.body - 7, l), at(cx, cy, (tier.get(b) ? r.label2 : r.label) + 11, l))} className="dp-faint" opacity={.6} />}
        <circle cx={x} cy={y} r={big ? 4.6 : tiny ? 2 : 2.7} fill={sky?.[b]?.back ? 'var(--dp-well)' : 'var(--dp-value)'} stroke="var(--dp-value)" strokeWidth={1.3} />
        {!tiny && <text x={tx} y={ty} textAnchor="middle" dominantBaseline="central" className="dp-ink sky-glyph" style={{fontSize: fs}}>{GLYPH[b] + VS}</text>}
      </g>
    })}
    {!sky && <g>
      {lines.map((line, i) => <text key={line} x={cx} y={cy - r.body * .88 + i * 11} textAnchor="middle" className="dp-ink-dim">{line}</text>)}
    </g>}
  </g>
}

const SUN_DOES = 'Drag the Sun round the ring: the date moves through the year.'

/** The ecliptic ring in a well, with the one handle: the Sun, which carries the date. Drag it round the ring and the date moves
 * through the year, a day for each degree the owner's Sun travels. */
function SkyDisplay({p, w, h, R, size}: {p: ViewProps; w: number; h: number; R: number; size: Size}) {
  const v = p.v, cx = w / 2, cy = h / 2 + 2, r = radii(R), sky = bodiesOf(v), hold = waiting(v), handle = sunHandle(v, sky)
  const [hx, hy] = handle ? at(cx, cy, r.body, handle.lon) : [0, 0]
  // The handle moves four keys together; it stands disabled when the owner has no operation for one of them.
  const held = ['now', 'year', 'day', 'time'].map(k => st(p, k).disabled).find(Boolean)
  const nowHeld = st(p, 'now').disabled
  const drag = (x: number, y: number) => {
    if (!handle || held) return
    const days = Math.round(wrap180(mod360(Math.atan2(cy - y, x - cx) * 180 / Math.PI) - handle.lon) / Math.max(.5, handle.speed))
    if (days === 0) return
    const q = parts(clampMs(handle.from + days * MS_DAY))
    p.set('now', false); p.set('year', q.year); p.set('day', q.day); p.set('time', q.time)
  }
  const read = epochMs(v), asked = askedMs(v)
  const when = hold ? 'waiting' : read === undefined ? NONE : dateLabel(read) + (boolOf(v, 'now') === true ? ' · now' : '')
  return <Display w={w} h={h} label="The sky" does="The ecliptic ring of the date. Each body stands at its degree. A hollow body moves backward. Drag handle 1 to change the date."
    corner={when}>
    <Ring v={v} cx={cx} cy={cy} R={R} size={size} />
    {hold && asked !== undefined && <text x={5} y={12} className="dp-ink-dim" style={{fontStyle: 'italic'}}>asked {dateLabel(asked)}</text>}
    <text x={5} y={h - 5} className="dp-axis">ecliptic</text>
    <text x={w - 5} y={h - 5} textAnchor="end" className="dp-axis">{observerWord(v)}</text>
    {handle && <Handle n={1} shape="ring" x={hx} y={hy} label="Date" does={held ? `${SUN_DOES} ${held}` : SUN_DOES} onDrag={held ? undefined : drag}
      onReset={nowHeld ? undefined : () => p.set('now', true)} />}
  </Display>
}

/** The widget's ring: press it and the date returns to now. */
function TapRing({p, size}: {p: ViewProps; size: number}) {
  const held = st(p, 'now').disabled
  const back = () => { if (!held) p.set('now', true) }
  return <Display w={size} h={size} label="The sky" does={held ? `Press the ring to return the date to now. ${held}` : 'Press the ring to return the date to now.'}>
    <rect x={0} y={0} width={size} height={size} fill="transparent" style={{cursor: held ? 'default' : 'pointer'}} role="button" tabIndex={held ? -1 : 0}
      aria-label="Return the date to now" aria-disabled={held ? true : undefined} onClick={back} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') back() }} />
    <Ring v={p.v} cx={size / 2} cy={size / 2} R={size / 2 - 5} size="tiny" />
  </Display>
}

/** What the sky moves: the sources on the left, each parameter on the right as a range with the value the plan gives. */
function MovesDisplay({v, w, h}: {v: V; w: number; h: number}) {
  const moves = movesOf(v)
  const x0 = 46, x1 = 128, x2 = w - 10, top = 18, step = (h - 28) / 11
  const ys = (group: 'o' | 'q', n: number) => top + (group === 'o' ? n : 8 + n) * step
  const lane = (i: number) => 40 + i * 30
  const used = (group: 'o' | 'q', n: number) => (moves ?? []).some(m => m.group === group && m.n === n)
  const laid = (moves ?? []).slice(0, Math.floor((h - 40) / 30) + 1)
  return <Display w={w} h={h} label="What the sky moves" does="Each source that moves a parameter now, and the value it gives. Amber: held at the end of the range."
    corner={moves ? `${moves.length} move${moves.length === 1 ? '' : 's'}` : NONE}>
    {!moves ? <text x={w / 2} y={h / 2} textAnchor="middle" className="dp-ink-dim">No reading of the moves.</text> : <>
      <text x={5} y={top - 6} className="dp-axis">octet</text>
      <text x={5} y={ys('q', 0) - 6} className="dp-axis">quartet</text>
      {Array.from({length: SLOTS.o}, (_, n) => <circle key={`o${n}`} cx={x0} cy={ys('o', n)} r={2.2} fill={used('o', n) ? 'var(--dp-value)' : 'none'} className={used('o', n) ? undefined : 'dp-faint'} />)}
      {Array.from({length: SLOTS.q}, (_, n) => <circle key={`q${n}`} cx={x0} cy={ys('q', n)} r={2.2} fill={used('q', n) ? 'var(--dp-value)' : 'none'} className={used('q', n) ? undefined : 'dp-faint'} />)}
      {laid.map((m, i) => {
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
    </>}
  </Display>
}

// ---------------------------------------------------------------- the parts shared by the views

// The light reads the owner alone (manual §16.9): lit or dark when it reports, hollow when it has not.
const light = (p: ViewProps) => (strOf(p.owner ?? p.v, 'light') ?? 'unknown') as LightState
const OBSERVERS = [{value: 'shared', label: 'Shared', does: 'The sky as seen from the centre of the Earth.'}, {value: 'private', label: 'Private', does: 'The sky as seen from your place. Only you see it.'}] as const
const SPEED = {min: 1, max: 86400, log: true}
/** Whose view the owner calculated: "—" when it is not reported. */
const observerWord = (v: V) => { const o = strOf(v, 'observer'); return o === undefined ? NONE : o === 'private' ? 'private' : 'shared' }
const sunReading = (v: V) => { const sun = bodiesOf(v)?.Sun; return sun ? `Sun ${place(sun.lon, false)}` : NONE }
const EPHEMERIS: Record<string, string> = {moshier: 'Moshier', 'swiss-files': 'Swiss'}
const ephemeris = (v: V) => { const b = strOf(v, 'backend'); return b === undefined ? undefined : EPHEMERIS[b] ?? b }

const bodyRows = (p: ViewProps): RowItem[] => {
  const sky = bodiesOf(p.v)
  return BODIES.map(b => {
    const pos = sky?.[b], want = boolOf(p.v, `b:${b}`) !== false, s = st(p, `b:${b}`)
    // A body with no reading has nothing to show or hide: its row carries no request.
    return {id: b, name: b, request: pos ? want : undefined, light: !pos ? 'unknown' : want ? 'lit' : 'dark', tone: 'value', why: s.disabled ?? s.refused,
      mark: <span className="sky-glyph">{GLYPH[b] + VS}</span>, note: pos ? place(pos.lon, pos.back) : NONE}
  })
}
/** A request to show or hide a body: held back where the owner has no operation for it. */
const askBody = (p: ViewProps) => (id: string, x: boolean) => { if (isBody(id) && !st(p, `b:${id}`).disabled) p.set(`b:${id}`, x) }
const moveRows = (v: V): RowItem[] => (movesOf(v) ?? []).map(m => ({id: m.id, name: `${m.source} → ${m.target}`, light: 'lit', tone: m.held ? 'accent' : 'value', note: `${parseFloat(m.value.toFixed(2))}`,
  why: m.held ? 'Held at the end of the range.' : undefined}))

/** A toggle on a boolean key: hollow when the owner has not said. */
const flag = (p: ViewProps, key: string, label: string, does: string, disabled?: string) => {
  const now = boolOf(p.v, key), s = st(p, key)
  return <Toggle label={label} does={does} {...s} on={now === true} unknown={now === undefined} onChange={x => p.set(key, x)} disabled={s.disabled ?? disabled} />
}
const nowToggle = (p: ViewProps) => flag(p, 'now', 'Now', 'Show the sky of this moment. Turn it off to keep the date that you chose.')
const runToggle = (p: ViewProps) => flag(p, 'run', 'Run', 'Move the date forward with time. Turn it off to keep the date.')
const speedDial = (p: ViewProps) => <Dial label="Speed" does="How fast the date moves when Run is on. The range is 1 second to 1 day for each second." value={numOf(p.v, 'speed') ?? NaN} def={3600} scale={SPEED} format={rate}
  onChange={x => p.set('speed', x)} {...st(p, 'speed')} />
const natalToggle = (p: ViewProps, label: string) => flag(p, 'natal', label, 'Draw the sky of your birth as a ring round the sky of the date. Only you see it.', natalOf(p.v) ? undefined : 'No birth data is saved.')

// ---------------------------------------------------------------- the pane: the sky itself

function FullSky({v}: {v: V}) {
  const sky = bodiesOf(v), cx = 214, cy = 210, R = 190, read = epochMs(v)
  const rows = BODIES.map((b, i) => {
    const y = 76 + i * 29, pos = sky?.[b], shown = pos !== undefined && boolOf(v, `b:${b}`) !== false, l = pos?.lon
    const minutes = l === undefined ? 0 : Math.floor((l % 1) * 60)
    return <g key={b} opacity={shown ? 1 : .4}>
      <path d={`M446 ${y + 10}H748`} className="dp-grid" />
      <text x={458} y={y} textAnchor="middle" className="dp-ink sky-glyph" style={{fontSize: 15}}>{GLYPH[b] + VS}</text>
      <text x={474} y={y} className="dp-ink">{b}</text>
      <text x={534} y={y} className="dp-ink">{l === undefined ? NONE : `${Math.floor(l % 30)}°${String(minutes).padStart(2, '0')}′ ${SIGN[Math.floor(mod360(l) / 30)]}`}</text>
      <text x={606} y={y} className="dp-ink-dim">{pos?.back ? 'R' : ''}</text>
      <text x={626} y={y} className="dp-ink-dim">{pos ? TIE[b].ratio : NONE}</text>
      <text x={668} y={y} className="dp-ink-dim">{pos ? TIE[b].chakra : NONE}</text>
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
        <text x={446} y={366} className="dp-ink-dim">{read !== undefined ? `${dateLabel(read)} ${clock(parts(read).time)} UTC · ${observerWord(v) === NONE ? NONE : `${observerWord(v)} view`}` : strOf(v, 'reason') ?? 'No reading of the dated sky.'}</text>
        <text x={446} y={381} className="dp-axis">A calculated ephemeris, not an observed sky.</text>
        <text x={446} y={393} className="dp-axis">Tropical zodiac, ecliptic of date. Aries starts at the right;</text>
        <text x={446} y={405} className="dp-axis">the degrees grow against the clock.{boolOf(v, 'natal') === true && natalOf(v) ? ' Outer ring: your birth sky.' : ''}</text>
      </g>
    </svg>
  </div>
}

// ---------------------------------------------------------------- sample readings (the gallery's fixtures; the owner's values replace them)

/** The owner's snapshot rows as the JSON the `bodies` key carries: longitude, longitude speed (°/day), retrograde, per body. */
const bodiesJson = (row: Record<Body, readonly [number, number, boolean]>) => JSON.stringify(BODIES.map(b => ({body: b,
  longitude_degrees: row[b][0], longitude_speed_degrees_per_day: row[b][1], retrograde: row[b][2]})))
/** A birth sky as `ql.nara-natal/v1` carries it (sky.bodies): longitude and retrograde per body. */
const natalJson = (row: Record<Body, readonly [number, boolean]>) => JSON.stringify(BODIES.map(b => ({body: b, longitude_degrees: row[b][0], retrograde: row[b][1]})))

// ---------------------------------------------------------------- the design

export const design: DesignedDevice = {
  id: 'quaternal-logic:sky',
  title: 'Sky',
  kind: 'instrument',
  firstPage: 'sky',
  defaults: {
    light: 'lit', reason: 'The dated sky is unavailable.',
    // fixtures/kernel/sky-snapshot-world-2026-09-28-v2.json (Moshier, shared geocentric).
    epoch: '2026-09-28T12:00:00Z',
    bodies: bodiesJson({
      Sun: [185.3841, .9811, false], Moon: [28.4415, 14.0119, false], Mercury: [207.3048, 1.3743, false], Venus: [218.0566, .1781, false],
      Mars: [120.2251, .5877, false], Jupiter: [139.1394, .1825, false], Saturn: [11.7737, -.0778, true], Uranus: [65.5651, -.0147, true],
      Neptune: [2.9311, -.0277, true], Pluto: [303.1411, -.0081, true]}),
    // The owner's aspect rule (m2.rs `aspect`) on those longitudes.
    aspectList: JSON.stringify([
      {a: 'Sun', b: 'Mars', angle: 60, orb: 5.16}, {a: 'Sun', b: 'Saturn', angle: 180, orb: 6.39}, {a: 'Sun', b: 'Uranus', angle: 120, orb: 0.18},
      {a: 'Sun', b: 'Neptune', angle: 180, orb: 2.45}, {a: 'Sun', b: 'Pluto', angle: 120, orb: 2.24}, {a: 'Moon', b: 'Mercury', angle: 180, orb: 1.14},
      {a: 'Moon', b: 'Venus', angle: 180, orb: 9.62}, {a: 'Moon', b: 'Mars', angle: 90, orb: 1.78}, {a: 'Moon', b: 'Pluto', angle: 90, orb: 4.7},
      {a: 'Mercury', b: 'Mars', angle: 90, orb: 2.92}, {a: 'Mercury', b: 'Pluto', angle: 90, orb: 5.84}, {a: 'Venus', b: 'Mars', angle: 90, orb: 7.83},
      {a: 'Venus', b: 'Pluto', angle: 90, orb: 4.92}, {a: 'Mars', b: 'Uranus', angle: 60, orb: 5.34}, {a: 'Mars', b: 'Neptune', angle: 120, orb: 2.71},
      {a: 'Mars', b: 'Pluto', angle: 180, orb: 2.92}, {a: 'Jupiter', b: 'Saturn', angle: 120, orb: 7.37}, {a: 'Saturn', b: 'Neptune', angle: 0, orb: 8.84},
      {a: 'Uranus', b: 'Neptune', angle: 60, orb: 2.63}, {a: 'Uranus', b: 'Pluto', angle: 120, orb: 2.42}, {a: 'Neptune', b: 'Pluto', angle: 60, orb: 0.21}]),
    // fixtures/kernel/sky-snapshot-known-e6d-2026-09-15-v1.json: the fixture person was born under that sky.
    natalBodies: natalJson({
      Sun: [172.7452, false], Moon: [226.2586, false], Mercury: [188.055, false], Venus: [213.1681, false], Mars: [112.4748, false],
      Jupiter: [136.6779, false], Saturn: [12.7437, true], Uranus: [65.6872, true], Neptune: [3.2876, true], Pluto: [303.2804, true]}),
    // The owner's compiled plan (qlModulationSources.ts `compileQlModulationPlan`), evaluated on the Vimarśā reading for the Venus ratio 9:8.
    moves: JSON.stringify([
      {id: 'o0', source: 'octet 0', group: 'o', n: 0, target: 'Drive', min: 0, max: 6, base: 1, value: 1.661, held: false},
      {id: 'o4', source: 'octet 4', group: 'o', n: 4, target: 'Pulse mix', min: 0, max: 100, base: 50, value: 73.573, held: false},
      {id: 'q1', source: 'quartet 1', group: 'q', n: 1, target: 'Damping', min: .1, max: 40, base: 4.5, value: 10.155, held: false},
      {id: 'o7', source: 'octet 7', group: 'o', n: 7, target: 'Agitation', min: 0, max: 5, base: .3, value: 5, held: true}]),
    now: false, year: 2026, day: 271, time: 720, run: false, speed: 3600,
    observer: 'shared', aspects: false, natal: false, havePlace: true, backend: 'moshier',
    ...Object.fromEntries(BODIES.map(b => [`b:${b}`, true])),
  },
  fixtures: {
    'Sky of 28 Sep 2026': {},
    'Sky of 15 Sep 2026': {
      year: 2026, day: 258, time: 826, epoch: '2026-09-15T13:46:21Z',
      bodies: bodiesJson({
        Sun: [172.7452, .9747, false], Moon: [226.2586, 12.3891, false], Mercury: [188.055, 1.6019, false], Venus: [213.1681, .5503, false],
        Mars: [112.4748, .6111, false], Jupiter: [136.6779, .1977, false], Saturn: [12.7437, -.0712, true], Uranus: [65.6872, -.0041, true],
        Neptune: [3.2876, -.0272, true], Pluto: [303.2804, -.0133, true]}),
      aspectList: JSON.stringify([
        {a: 'Sun', b: 'Mars', angle: 60, orb: 0.27}, {a: 'Moon', b: 'Mars', angle: 120, orb: 6.22}, {a: 'Moon', b: 'Jupiter', angle: 90, orb: 0.42},
        {a: 'Mercury', b: 'Saturn', angle: 180, orb: 4.69}, {a: 'Mercury', b: 'Uranus', angle: 120, orb: 2.37}, {a: 'Mercury', b: 'Neptune', angle: 180, orb: 4.77},
        {a: 'Mercury', b: 'Pluto', angle: 120, orb: 4.77}, {a: 'Venus', b: 'Pluto', angle: 90, orb: 0.11}, {a: 'Jupiter', b: 'Saturn', angle: 120, orb: 3.93},
        {a: 'Saturn', b: 'Neptune', angle: 0, orb: 9.46}, {a: 'Uranus', b: 'Neptune', angle: 60, orb: 2.4}, {a: 'Uranus', b: 'Pluto', angle: 120, orb: 2.41},
        {a: 'Neptune', b: 'Pluto', angle: 60, orb: 0.01}])},
    'Aspects and natal': {aspects: true, natal: true},
    'No answer': {bodies: undefined, epoch: undefined, aspectList: undefined},
    'No birth data': {natalBodies: undefined, havePlace: false},
    'No readings': Object.fromEntries(['light', 'reason', 'epoch', 'bodies', 'aspectList', 'natalBodies', 'moves', 'now', 'year', 'day', 'time', 'run', 'speed', 'observer',
      'aspects', 'natal', 'havePlace', 'backend', ...BODIES.map(b => `b:${b}`)].map(k => [k, undefined])),
  },

  folded: p => { const read = epochMs(p.v)
    return <Folded title="Sky" light={light(p)} readings={[read === undefined ? NONE : dateLabel(read), sunReading(p.v)]} onUnfold={p.nav.unfold} /> },

  compact: p => <Panel title="Sky" view="compact" light={light(p)} onFold={p.nav.fold} onFull={p.nav.full} onSelect={p.nav.select}>
    <Section width={152}><SkyDisplay p={p} w={140} h={146} R={60} size="small" /></Section>
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
    const t = shownParts(p.v), wait = waiting(p.v), moves = movesOf(p.v), observer = st(p, 'observer')
    return <Panel title="Sky" view="whole" light={light(p)} onFold={p.nav.fold} onFull={p.nav.full}
      pages={[{id: 'sky', label: 'Positions'}, {id: 'moves', label: 'Moves'}]} page={wherePage} onPage={p.setPage}>
      {wherePage === 'sky' ? <>
        <Band>
          <Section width={198}><SkyDisplay p={p} w={186} h={146} R={62} size="small" /></Section>
          <Section label="Date" width={72}>
            <ValueBox label="Year" does="The year of the sky to show, from 1800 to 2399." value={t.year ?? NaN} def={new Date().getUTCFullYear()} scale={{min: 1800, max: 2399, step: 1}} format={x => `${x}`}
              onChange={x => { p.set('now', false); p.set('year', x) }} {...st(p, 'year')} pending={wait || st(p, 'year').pending} />
            <ValueBox label="Day" does="The day of that year." value={t.day ?? NaN} def={1} scale={{min: 1, max: 366, step: 1}} format={x => t.year === undefined ? `day ${x}` : dayLabel(t.year, x)}
              onChange={x => { p.set('now', false); p.set('day', x) }} {...st(p, 'day')} pending={wait || st(p, 'day').pending} />
            <ValueBox label="Time" does="The time of day, in UTC." value={t.time ?? NaN} def={0} scale={{min: 0, max: 1439, step: 1}} format={clock}
              onChange={x => { p.set('now', false); p.set('time', x) }} {...st(p, 'time')} pending={wait || st(p, 'time').pending} />
          </Section>
          <Section label="Clock" grow>
            {nowToggle(p)}
            {runToggle(p)}
            {speedDial(p)}
          </Section>
        </Band>
        <Band>
          <Section label="Bodies" width={252}>
            <Rows does="Press a square to show or hide a body. A hollow body moves backward." items={bodyRows(p)} columns={2} size={10} onRequest={askBody(p)} />
            <div className="sky-pair">
              <Readout label="standing" value={bodiesOf(p.v) ? 'calculated' : undefined} tone="value" does="The positions come from a calculated ephemeris. They are not an observed sky." />
              <Readout label="ephemeris" value={ephemeris(p.v)} does="The ephemeris that the owner used for this sky." />
              <Readout label="zodiac" value={bodiesOf(p.v) ? 'Tropical' : undefined} does="The zodiac of the owner's reading. Aries starts at the equinox." />
            </div>
          </Section>
          <Section label="Overlay" grow>
            {flag(p, 'aspects', 'Aspects', 'Draw a line between two bodies that stand 60, 90, 120 or 180 degrees apart, within a small allowance.')}
            {natalToggle(p, 'Natal ring')}
            <Radio label="Observer" does="Whose view the sky shows." value={strOf(p.v, 'observer') ?? ''} options={OBSERVERS} onChange={x => p.set('observer', x)}
              {...observer} disabled={observer.disabled ?? (boolOf(p.v, 'havePlace') === true ? undefined : 'No place is saved.')} />
          </Section>
        </Band>
      </> : <Band>
        <Section width={210}><MovesDisplay v={p.v} w={198} h={146} /></Section>
        <Section label="Moves" grow>
          <Rows does="The sources that move a parameter now, and the value that each gives." items={moveRows(p.v)} size={5} />
          <div className="sky-pair">
            <Readout label="moves" value={moves?.length} tone="value" does="Sources that move a parameter now." />
            <Readout label="held" value={moves?.filter(m => m.held).length} tone="accent" does="Moves held at the end of the range of the parameter." />
          </div>
        </Section>
      </Band>}
    </Panel>
  },

  full: p => <FullSky v={p.v} />,

  widget: p => {
    const sky = bodiesOf(p.v)
    return <Tile title="Sky" light={light(p)} span={2} onFull={p.nav.full}>
      <TapRing p={p} size={100} />
      <Rows does="Each body with its degree. A hollow lamp means no reading." columns={2} size={10}
        items={BODIES.map(b => { const pos = sky?.[b]
          return {id: b, name: GLYPH[b] + VS, light: !pos ? 'unknown' : boolOf(p.v, `b:${b}`) === false ? 'dark' : 'lit', tone: 'value', note: pos ? place(pos.lon, pos.back) : NONE} })} />
    </Tile>
  },
}
