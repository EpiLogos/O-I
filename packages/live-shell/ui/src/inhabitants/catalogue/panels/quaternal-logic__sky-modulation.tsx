// Sky modulation (manual §21.5, and §16.2: "The sky can move a parameter in any mode"): a modulator that hands parameters of the
// devices on its chain to the planets overhead. It sits on any track's chain; on a Live part its targets are the torus's and its
// effects'. Live's nearest: the LFO and Shaper modulators, which map any parameter on the chain and draw the depth on it. The
// display: the ecliptic ring, each planet at its longitude, and a line from each assigned planet to the parameter it moves, the
// parameter drawn as its range with its base, the depth of the movement as a bracket round the base, and the place the planet
// puts it now.
//
// The law. Position: the planet's longitude λ moves the target about its base by Amount × (λ/360 − ½) of the target's range (in the
// range's own scale, logarithmic for a frequency), so a full turn of the planet sweeps the bracket of Amount wide. Interval: a
// frequency target is multiplied by the planet's just interval to the power of Amount (the M2-5 map, m2_sky.rs: Sun 1:1, Moon 4:3,
// Mercury 5:4, Venus 9:8, Mars 15:8, Jupiter 5:3, Saturn 3:2, Neptune 9:5, Pluto 9:4; Uranus none, so it moves by position only).
//
// Owners, and the value keys keyed on their paths:
//   bodies, epoch, now, year, day, observer, havePlace   the Sky's (quaternal-logic__sky.tsx; qlSky.ts, `ql.sky-snapshot/v1` through
//                       the kernel's nara_identity transit): the planets' longitudes, the date asked and the date answered.
//   targets             the chain's parameters a planet may move: [{id, device, label, min, max, unit, log?, base?}], base being the
//                       parameter's own value now.
//   routes              the assignments: [{id, planet, target}]; and for each, use:<id> ('position' | 'interval'), amount:<id>
//                       (−100..100 %), scope:<id> ('global' | 'note'), smoothing:<id> (0..10 s).
// No owner runs a modulation plan yet: the compiled plan (inhabitants/ql/qlModulationSources.ts) routes the twelve M2 observables,
// not planets, to quaternal-logic addresses only, and nothing in the shell holds or runs one (live/torusDevice.ts: "no compiled
// modulation plan runs in the shell"). The assignments are the entry's own, and `reason` names the absence in the well.
import {Action, Band, Chooser, Dial, Display, Folded, Handle, Panel, Radio, Readout, Rows, Section, Tile, Toggle, ValueBox, type LightState, type RowItem} from '../../sdk/panel'
import {NONE, boolOf, clampTo, has, json, numOf, st, strOf, type DesignedDevice, type ViewProps} from './design'
import './quaternal-logic__sky-modulation.css'

type V = ViewProps['v']

// ---------------------------------------------------------------- vocabulary: the bodies and the owner's fixed map

const BODIES = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'] as const
type Body = typeof BODIES[number]
const VS = '︎' // text presentation, so the glyph never turns into a picture
const GLYPH: Record<Body, string> = {Sun: '☉', Moon: '☽', Mercury: '☿', Venus: '♀', Mars: '♂', Jupiter: '♃', Saturn: '♄', Uranus: '♅', Neptune: '♆', Pluto: '♇'}
const SIGN = ['Ari', 'Tau', 'Gem', 'Can', 'Leo', 'Vir', 'Lib', 'Sco', 'Sag', 'Cap', 'Aqu', 'Pis']
/** The M2-5 map: each planet's just interval from the root (m2_sky.rs). Uranus has none. */
const INTERVAL: Record<Body, readonly [number, number] | null> = {Sun: [1, 1], Moon: [4, 3], Mercury: [5, 4], Venus: [9, 8], Mars: [15, 8], Jupiter: [5, 3],
  Saturn: [3, 2], Uranus: null, Neptune: [9, 5], Pluto: [9, 4]}
const USES = [{value: 'position', label: 'Position', does: 'The planet\'s place in the sky moves the target through its range.'},
  {value: 'interval', label: 'Interval', does: 'The planet\'s own interval multiplies a frequency target.'}] as const
const SCOPES = [{value: 'global', label: 'Global', does: 'Move the whole sound.'}, {value: 'note', label: 'Per note', does: 'Move each note separately.'}] as const
const OBSERVERS = [{value: 'shared', label: 'Shared', does: 'The sky as seen from the centre of the Earth.'}, {value: 'private', label: 'Private', does: 'The sky as seen from your place.'}] as const
const MAX_ROUTES = 16

// ---------------------------------------------------------------- the readings, every lookup guarded

const rec = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null
const finite = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)
const isBody = (x: unknown): x is Body => typeof x === 'string' && (BODIES as readonly string[]).includes(x)
const mod360 = (x: number) => ((x % 360) + 360) % 360

/** The Sky owner's bodies: longitude and whether each goes backward. None: undefined. */
function bodiesOf(v: V): Partial<Record<Body, {lon: number; back: boolean}>> | undefined {
  const raw = json<unknown>(v, 'bodies', undefined)
  if (!Array.isArray(raw)) return undefined
  const out: Partial<Record<Body, {lon: number; back: boolean}>> = {}
  for (const e of raw) if (rec(e) && isBody(e.body) && finite(e.longitude_degrees)) out[e.body] = {lon: mod360(e.longitude_degrees), back: e.retrograde === true}
  return Object.keys(out).length ? out : undefined
}
interface Target {readonly id: string; readonly device: string; readonly label: string; readonly min: number; readonly max: number; readonly unit: string; readonly log: boolean; readonly base?: number}
function targetsOf(v: V): Target[] | undefined {
  const raw = json<unknown>(v, 'targets', undefined)
  if (!Array.isArray(raw)) return undefined
  return raw.flatMap((e): Target[] => rec(e) && typeof e.id === 'string' && typeof e.label === 'string' && finite(e.min) && finite(e.max) && e.max > e.min && (e.log !== true || e.min > 0)
    ? [{id: e.id, device: String(e.device ?? ''), label: e.label, min: e.min, max: e.max, unit: String(e.unit ?? ''), log: e.log === true, base: finite(e.base) ? e.base : undefined}] : [])
}
interface Route {readonly id: string; readonly planet: Body; readonly target: string}
function routesOf(v: V): Route[] | undefined {
  const raw = json<unknown>(v, 'routes', undefined)
  if (!Array.isArray(raw)) return undefined
  return raw.flatMap((e): Route[] => rec(e) && typeof e.id === 'string' && isBody(e.planet) && typeof e.target === 'string' ? [{id: e.id, planet: e.planet, target: e.target}] : [])
}

const toU = (t: Target, x: number) => clampTo(0, 1, t.log ? Math.log(x / t.min) / Math.log(t.max / t.min) : (x - t.min) / (t.max - t.min))
const fromU = (t: Target, u: number) => (t.log ? t.min * (t.max / t.min) ** clampTo(0, 1, u) : t.min + clampTo(0, 1, u) * (t.max - t.min))
/** What a route does to its target, in the target's range (0..1): the bracket the planet sweeps, and where it puts the target now. */
function moveOf(v: V, route: Route, t: Target | undefined, lon: number | undefined) {
  const amount = numOf(v, `amount:${route.id}`), use = strOf(v, `use:${route.id}`) ?? 'position'
  if (!t || t.base === undefined || amount === undefined) return undefined
  const u0 = toU(t, t.base), a = amount / 100, ratio = INTERVAL[route.planet]
  if (use === 'interval' && t.log && ratio) {
    const now = clampTo(0, 1, u0 + a * Math.log(ratio[0] / ratio[1]) / Math.log(t.max / t.min))
    return {u0, a, lo: Math.min(u0, now), hi: Math.max(u0, now), now: lon === undefined ? undefined : now}
  }
  return {u0, a, lo: clampTo(0, 1, u0 - Math.abs(a) / 2), hi: clampTo(0, 1, u0 + Math.abs(a) / 2), now: lon === undefined ? undefined : clampTo(0, 1, u0 + a * (lon / 360 - .5))}
}
const fmt = (t: Target, x: number) => t.unit === 'Hz' ? (x >= 1000 ? `${(x / 1000).toFixed(x >= 10000 ? 1 : 2)} kHz` : `${Math.round(x)} Hz`)
  : t.unit === 'dB' ? `${x.toFixed(1)} dB` : t.unit === '%' ? `${Math.round(x)} %` : `${Math.round(x * 10) / 10}${t.unit ? ` ${t.unit}` : ''}`
const pctSigned = (x: number) => `${x > 0 ? '+' : x < 0 ? '−' : ''}${Math.abs(Math.round(x))} %`

// ---------------------------------------------------------------- the picture

/** Words in lines of at most `n` letters, for a missing reading named in a narrow well. */
const wrap = (text: string, n: number) => text.split(' ').reduce<string[]>((acc, w) => { const last = acc[acc.length - 1]; if (last !== undefined && (last + ' ' + w).length <= n) acc[acc.length - 1] = `${last} ${w}`; else acc.push(w); return acc }, [])
const at = (cx: number, cy: number, r: number, lon: number): [number, number] => [cx + r * Math.cos(lon * Math.PI / 180), cy - r * Math.sin(lon * Math.PI / 180)]
const f1 = (x: number) => x.toFixed(1)

/** The ring and the lines: `side` puts the ring at the left and the targets at the right; `stack` the ring above, the targets under it. */
function SkyLines({p, w, h, layout, handles, rows: maxRows}: {p: ViewProps; w: number; h: number; layout: 'side' | 'stack'; handles: boolean; rows: number}) {
  const v = p.v, sky = bodiesOf(v), targets = targetsOf(v), routes = routesOf(v) ?? [], selected = selectedOf(v)
  const stack = layout === 'stack', ringOnly = maxRows === 0
  const r = ringOnly ? Math.min(w, h) / 2 - 8 : stack ? Math.min(w / 2 - 30, h * .21) : Math.min(h / 2 - 12, w * .19)
  const cx = stack ? w / 2 : r + 10, cy = ringOnly ? h / 2 : stack ? r + 10 : h / 2
  const top = stack ? cy + r + 8 : 22, rowsShown = Math.max(1, Math.min(maxRows, routes.length))
  const pitch = stack ? Math.min(16, (h - top - 4) / rowsShown) : Math.min(26, (h - top - 6) / rowsShown)
  const x0 = stack ? 46 : cx + r + 22, x1 = w - 8
  const shown = routes.slice(0, maxRows)
  const assigned = new Set(routes.map(rt => rt.planet))
  const reason = strOf(v, 'reason')
  return <g>
    <circle cx={cx} cy={cy} r={r} className="dp-faint" />
    {Array.from({length: 12}, (_, i) => <path key={i} d={`M${f1(at(cx, cy, r - 3, i * 30)[0])} ${f1(at(cx, cy, r - 3, i * 30)[1])}L${f1(at(cx, cy, r + 3, i * 30)[0])} ${f1(at(cx, cy, r + 3, i * 30)[1])}`} className="dp-faint" />)}
    <circle cx={cx} cy={cy} r={2} className="dp-faint" />
    {sky && BODIES.map(b => { const s = sky[b]; if (!s) return null; const [x, y] = at(cx, cy, r, s.lon), on = assigned.has(b)
      return <circle key={b} cx={x} cy={y} r={on ? 3.2 : 2} fill={s.back ? 'var(--dp-well)' : on ? 'var(--dp-value)' : 'var(--dp-value-dim)'} stroke="var(--dp-value)" strokeWidth={on ? 1.2 : .8} opacity={on ? 1 : .6} /> })}
    {!sky && <text x={cx} y={cy + 3} textAnchor="middle" className="dp-ink-dim">{w > 120 ? 'No sky' : NONE}</text>}
    {shown.map((rt, i) => {
      const t = targets?.find(x => x.id === rt.target), y = top + i * pitch + (stack ? 6 : pitch * .62), lon = sky?.[rt.planet]?.lon
      const m = moveOf(v, rt, t, lon), X = (u: number) => x0 + u * (x1 - x0), amtSt = st(p, `amount:${rt.id}`)
      const neg = (numOf(v, `amount:${rt.id}`) ?? 0) < 0, focus = rt.id === selected
      const from = lon === undefined ? undefined : at(cx, cy, r + 3, lon)
      return <g key={rt.id} opacity={focus || !handles ? 1 : .8}>
        {from && <path d={stack ? `M${f1(from[0])} ${f1(from[1])}L${f1(x0 - 3)} ${f1(y)}` : `M${f1(from[0])} ${f1(from[1])}C${f1(x0 - 14)} ${f1(from[1])} ${f1(x0 - 22)} ${f1(y)} ${f1(x0 - 3)} ${f1(y)}`}
          fill="none" stroke="var(--dp-value)" strokeWidth={m ? .8 + 1.6 * Math.abs(m.a) : .8} strokeDasharray={neg ? '3 2' : undefined} opacity={.75} />}
        <text x={stack ? 4 : x0} y={stack ? y + 3 : y - 6} className={stack ? 'dp-axis' : 'dp-ink-dim'} style={{fontSize: stack ? 7.5 : 8.5}}>
          <tspan className="skm-glyph">{GLYPH[rt.planet] + VS}</tspan> {t ? (stack ? t.label : `${t.device} · ${t.label}`) : NONE}</text>
        <path d={`M${f1(x0)} ${f1(y)}H${f1(x1)}`} className="dp-faint" />
        {m && <>
          <rect x={X(m.lo)} y={y - 2.5} width={Math.max(1, X(m.hi) - X(m.lo))} height={5} className="dp-fill" stroke="var(--dp-value)" strokeWidth={.8} />
          <path d={`M${f1(X(m.u0))} ${f1(y - 4)}V${f1(y + 4)}`} stroke="var(--text)" strokeWidth={1} />
          {m.now !== undefined && <circle cx={X(m.now)} cy={y} r={2.4} fill="var(--dp-value)" />}
          {handles && !amtSt.disabled && <Handle n={i + 1} x={X(clampTo(0, 1, m.u0 + m.a / 2))} y={y} label={`Amount ${i + 1}`} shape="square"
            does={`Drag left or right: how far ${rt.planet} moves ${t?.label ?? 'its target'}. Left of the base it reverses.`}
            onDrag={x => p.set(`amount:${rt.id}`, Math.round(clampTo(-100, 100, ((x - x0) / (x1 - x0) - m.u0) * 200)))} onReset={() => p.set(`amount:${rt.id}`, 50)} />}
        </>}
        {!m && <text x={x1} y={y + 3} textAnchor="end" className="dp-axis">{t?.base === undefined ? 'no base' : 'no amount'}</text>}
      </g>
    })}
    {!ringOnly && routes.length > maxRows && <text x={x1} y={h - 4} textAnchor="end" className="dp-axis">+{routes.length - maxRows}</text>}
    {!ringOnly && !routes.length && wrap(reason ?? (has(v, 'routes') ? 'No assignment' : 'No reading of the routes'), Math.floor((x1 - (stack ? 4 : x0)) / 5)).map((line, i) =>
      <text key={i} x={stack ? 4 : x0} y={(stack ? top + 12 : h / 2) + i * 11} className="dp-ink-dim">{line}</text>)}
  </g>
}

// ---------------------------------------------------------------- the parts the views share

const selectedOf = (v: V) => { const routes = routesOf(v) ?? [], s = strOf(v, 'selected'); return routes.some(rt => rt.id === s) ? s : routes[0]?.id }
const lightOf = (p: ViewProps): LightState => { const l = strOf(p.owner ?? p.v, 'light'); return l === 'lit' || l === 'dark' ? l : 'unknown' }
const head = (p: ViewProps) => ({light: lightOf(p), lightWhy: st(p, 'light').disabled ?? (has(p.v, 'light') ? undefined : 'No reading of on or off: no modulation plan runs.'),
  onFold: p.nav.fold, onFull: p.nav.full, onLight: () => p.set('light', lightOf(p) === 'lit' ? 'dark' : 'lit')})
const wide = (p: ViewProps) => (p.frame === 'flip' || p.frame === 'window') && p.room !== undefined
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const dateWord = (v: V) => { const t = Date.parse(strOf(v, 'epoch') ?? ''); if (!Number.isFinite(t)) return undefined; const d = new Date(t); return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}` }
const DISPLAY_DOES = 'Each planet at its place on the ecliptic, with a line to the parameter it moves. The bracket is how far it moves it; the dot, where the planet puts it now. A dashed line reverses.'

/** Write the routes back, as the list the key carries. */
const writeRoutes = (p: ViewProps, routes: readonly Route[]) => p.set('routes', JSON.stringify(routes))

function assignmentControls(p: ViewProps) {
  const v = p.v, routes = routesOf(v) ?? [], targets = targetsOf(v) ?? [], id = selectedOf(v), rt = routes.find(x => x.id === id)
  const t = targets.find(x => x.id === rt?.target), routeSt = st(p, 'routes')
  const none = rt ? undefined : 'No assignment is chosen.'
  const intervalWhy = rt && !INTERVAL[rt.planet] ? `${rt.planet} has no interval: it moves by position only.` : t && !t.log ? 'Interval moves a frequency: choose a frequency target.' : undefined
  return {rt, t,
    planet: <Chooser {...routeSt} label="Planet" does="The planet of this assignment." value={rt?.planet ?? ''} options={BODIES.map(b => ({value: b, label: b}))}
      onChange={x => { if (rt && isBody(x)) writeRoutes(p, routes.map(r => r.id === rt.id ? {...r, planet: x} : r)) }} disabled={routeSt.disabled ?? none} />,
    target: <Chooser {...routeSt} label="Target" does="The parameter on the chain that the planet moves." value={rt?.target ?? ''} options={targets.map(x => ({value: x.id, label: `${x.device} · ${x.label}`}))}
      onChange={x => { if (rt) writeRoutes(p, routes.map(r => r.id === rt.id ? {...r, target: x} : r)) }} disabled={routeSt.disabled ?? none ?? (targets.length ? undefined : 'No parameter on the chain is reported.')} />,
    use: <Radio {...(rt ? st(p, `use:${rt.id}`) : {})} label="Use" does="How the planet moves the target." value={rt ? strOf(v, `use:${rt.id}`) ?? '' : ''} stack
      options={USES} onChange={x => { if (rt) p.set(`use:${rt.id}`, x) }} disabled={none ?? (rt && strOf(v, `use:${rt.id}`) !== 'interval' ? intervalWhy : undefined)} />,
    amount: <Dial {...(rt ? st(p, `amount:${rt.id}`) : {})} label="Amount" does="How far the planet moves the target. Below zero it reverses." value={rt ? numOf(v, `amount:${rt.id}`) ?? NaN : NaN} def={50}
      scale={{min: -100, max: 100}} bipolar format={pctSigned} onChange={x => { if (rt) p.set(`amount:${rt.id}`, Math.round(x)) }} disabled={none} />,
    scope: <Radio {...(rt ? st(p, `scope:${rt.id}`) : {})} label="Scope" does="Whether the planet moves the whole sound or each note." value={rt ? strOf(v, `scope:${rt.id}`) ?? '' : ''} stack
      options={SCOPES} onChange={x => { if (rt) p.set(`scope:${rt.id}`, x) }} disabled={none} />,
    smoothing: <Dial {...(rt ? st(p, `smoothing:${rt.id}`) : {})} label="Smoothing" does="How slowly the target follows the planet." value={rt ? numOf(v, `smoothing:${rt.id}`) ?? NaN : NaN} def={1}
      scale={{min: 0, max: 10}} format={x => `${x.toFixed(1)} s`} onChange={x => { if (rt) p.set(`smoothing:${rt.id}`, Math.round(x * 10) / 10) }} disabled={none} />,
  }
}

function routeRows(v: V): RowItem[] {
  const targets = targetsOf(v) ?? [], sky = bodiesOf(v)
  return (routesOf(v) ?? []).map(rt => { const t = targets.find(x => x.id === rt.target), a = numOf(v, `amount:${rt.id}`)
    return {id: rt.id, name: t?.label ?? NONE, light: sky?.[rt.planet] ? 'lit' : 'unknown', tone: 'value', note: a === undefined ? NONE : pctSigned(a).replace(' %', ''),
      mark: <span className="skm-glyph">{GLYPH[rt.planet] + VS}</span>, does: `${rt.planet} moves ${t ? `${t.device} · ${t.label}` : 'a parameter that is not reported'}. Press to show its settings.`} })
}

function add(p: ViewProps) {
  const v = p.v, routes = routesOf(v) ?? [], targets = targetsOf(v) ?? []
  const planet = BODIES.find(b => !routes.some(r => r.planet === b)) ?? 'Sun', n = routes.reduce((m, r) => Math.max(m, Number(r.id.replace(/\D/g, '')) || 0), 0) + 1, id = `r${n}`
  if (!targets[0] || routes.length >= MAX_ROUTES) return
  writeRoutes(p, [...routes, {id, planet, target: targets[0].id}])
  p.set(`use:${id}`, 'position'); p.set(`amount:${id}`, 50); p.set(`scope:${id}`, 'global'); p.set(`smoothing:${id}`, 1); p.set('selected', id)
}
function clear(p: ViewProps) {
  const routes = routesOf(p.v) ?? [], id = selectedOf(p.v)
  if (!id) return
  writeRoutes(p, routes.filter(r => r.id !== id))
  for (const k of ['use', 'amount', 'scope', 'smoothing']) p.set(`${k}:${id}`, undefined)
  p.set('selected', routes.find(r => r.id !== id)?.id)
}

// ---------------------------------------------------------------- sample readings (the gallery's fixtures; the owner's values replace them)

/** A sky snapshot's bodies as the Sky owner returns them: longitude and retrograde. */
const bodiesJson = (row: Record<Body, readonly [number, boolean]>) => JSON.stringify(BODIES.map(b => ({body: b, longitude_degrees: row[b][0], retrograde: row[b][1]})))
const routeKeys = (id: string, use: string, amount: number, scope: string, smoothing: number) => ({[`use:${id}`]: use, [`amount:${id}`]: amount, [`scope:${id}`]: scope, [`smoothing:${id}`]: smoothing})

export const design: DesignedDevice = {
  id: 'quaternal-logic:sky-modulation',
  title: 'Sky modulation',
  kind: 'effect',
  firstPage: 'assign',
  defaults: {
    light: 'lit', now: true, year: 2026, day: 271, observer: 'shared', havePlace: false, epoch: '2026-09-28T12:00:00Z',
    // fixtures/kernel/sky-snapshot-world-2026-09-28-v2.json (Moshier, shared geocentric), as the Sky device carries it.
    bodies: bodiesJson({Sun: [185.3841, false], Moon: [28.4415, false], Mercury: [207.3048, false], Venus: [218.0566, false], Mars: [120.2251, false],
      Jupiter: [139.1394, false], Saturn: [11.7737, true], Uranus: [65.5651, true], Neptune: [2.9311, true], Pluto: [303.1411, true]}),
    // A Live part's chain: the torus's announced level and scale, and the four effects after it (manual §21.6).
    targets: JSON.stringify([
      {id: 'quaternal-logic:torus/level', device: 'Torus', label: 'Level', min: -60, max: 12, unit: 'dB', base: -6},
      {id: 'quaternal-logic:torus/scale', device: 'Torus', label: 'Scale', min: 40, max: 400, unit: 'u/m', base: 100},
      {id: 'live:filter/cutoff', device: 'Filter', label: 'Cutoff', min: 20, max: 20000, unit: 'Hz', log: true, base: 2400},
      {id: 'live:delay/feedback', device: 'Delay', label: 'Feedback', min: 0, max: 95, unit: '%', base: 35},
      {id: 'live:reverb/mix', device: 'Reverb', label: 'Dry/wet', min: 0, max: 100, unit: '%', base: 22}]),
    routes: JSON.stringify([{id: 'r1', planet: 'Venus', target: 'live:filter/cutoff'}, {id: 'r2', planet: 'Moon', target: 'quaternal-logic:torus/level'},
      {id: 'r3', planet: 'Saturn', target: 'live:reverb/mix'}, {id: 'r4', planet: 'Mars', target: 'live:delay/feedback'}]),
    ...routeKeys('r1', 'position', 40, 'global', 1), ...routeKeys('r2', 'position', -25, 'note', 8), ...routeKeys('r3', 'position', 30, 'global', 2),
    ...routeKeys('r4', 'position', 60, 'global', 1), selected: 'r1',
  },
  fixtures: {
    'Venus moves the cutoff': {},
    'Venus\'s interval on the cutoff': {'use:r1': 'interval', 'amount:r1': 100},
    'The sky of 15 Sep 2026': {now: false, day: 258, epoch: '2026-09-15T13:46:21Z',
      bodies: bodiesJson({Sun: [172.7452, false], Moon: [226.2586, false], Mercury: [188.055, false], Venus: [213.1681, false], Mars: [112.4748, false],
        Jupiter: [136.6779, false], Saturn: [12.7437, true], Uranus: [65.6872, true], Neptune: [3.2876, true], Pluto: [303.2804, true]})},
    'As the owners have it': {light: undefined, routes: undefined, selected: undefined, reason: 'No modulation plan runs',
      targets: JSON.stringify([{id: 'quaternal-logic:torus/level', device: 'Torus', label: 'Level', min: -60, max: 12, unit: 'dB', base: -6},
        {id: 'quaternal-logic:torus/scale', device: 'Torus', label: 'Scale', min: 40, max: 400, unit: 'u/m', base: 100}])},
    'No readings': Object.fromEntries(['light', 'now', 'year', 'day', 'observer', 'havePlace', 'epoch', 'bodies', 'targets', 'routes', 'selected'].map(k => [k, undefined])),
  },

  folded: p => { const n = routesOf(p.v)?.length
    return <Folded title="Sky modulation" light={lightOf(p)} readings={[dateWord(p.v)?.replace(/ \d{4}$/, '') ?? NONE, n === undefined ? NONE : `${n} move${n === 1 ? '' : 's'}`]} onUnfold={p.nav.unfold} /> },

  compact: p => {
    const v = p.v, routes = routesOf(v) ?? [], targets = targetsOf(v) ?? []
    // The four macros are the first four assignments' amounts (manual §21.5 Compact).
    const amount = (i: number) => { const rt = routes[i], t = targets.find(x => x.id === rt?.target)
      return <Dial key={i} {...(rt ? st(p, `amount:${rt.id}`) : {})} label={rt ? rt.planet : `Amount ${i + 1}`} does={rt ? `How far ${rt.planet} moves ${t?.label ?? 'its target'}. Below zero it reverses.` : 'No assignment here: add one in the pool.'}
        value={rt ? numOf(v, `amount:${rt.id}`) ?? NaN : NaN} def={50} scale={{min: -100, max: 100}} bipolar format={pctSigned} onChange={rt ? x => p.set(`amount:${rt.id}`, Math.round(x)) : undefined} /> }
    return <Panel title="Sky modulation" view="compact" {...head(p)} onSelect={p.nav.select}>
      <Section width={152}>
        <Display w={140} h={146} label="What the sky moves" does={`${DISPLAY_DOES} Drag a square for its amount.`} corner={dateWord(v)?.replace(/ \d{4}$/, '') ?? NONE}>
          <SkyLines p={p} w={140} h={146} layout="stack" handles rows={4} />
        </Display>
      </Section>
      <Section label="Amounts" cols={2}>{[0, 1, 2, 3].map(amount)}</Section>
    </Panel>
  },

  whole: p => {
    const v = p.v, c = assignmentControls(p), routes = routesOf(v), big = wide(p), observer = st(p, 'observer')
    const w = big ? Math.round(clampTo(186, p.room!.w - 720, 420)) : 186
    return <Panel title="Sky modulation" view="whole" {...head(p)}>
      <Band>
        <Section width={w + 12}>
          <Display w={w} h={146} label="What the sky moves" does={`${DISPLAY_DOES} Drag a square for its amount.`} corner={dateWord(v) ?? NONE}>
            <SkyLines p={p} w={w} h={146} layout="side" handles rows={5} />
          </Display>
        </Section>
        <Section label="Sky" width={76}>
          <Toggle {...st(p, 'now')} label="Now" does="Play the sky of this moment. Off: the sky of the date below." on={boolOf(v, 'now') === true} unknown={boolOf(v, 'now') === undefined} onChange={x => p.set('now', x)} />
          <ValueBox {...st(p, 'year')} label="Year" does="The year of the sky that moves the sound." value={numOf(v, 'year') ?? NaN} scale={{min: 1800, max: 2399, step: 1}} format={x => `${x}`}
            onChange={x => { p.set('now', false); p.set('year', x) }} />
          <ValueBox {...st(p, 'day')} label="Day" does="The day of that year." value={numOf(v, 'day') ?? NaN} def={1} scale={{min: 1, max: 366, step: 1}} format={x => `day ${x}`}
            onChange={x => { p.set('now', false); p.set('day', x) }} />
        </Section>
        <Section label="Assignments" grow>
          <Rows does="The planets and the parameters they move. Press one to show its settings." items={routeRows(v)} size={4} onSelect={id => p.set('selected', id)} selected={selectedOf(v)} />
          <div className="ref-pair">
            <Action {...st(p, 'routes')} label="Add" does="Give a planet a parameter to move." onPress={() => add(p)}
              disabled={st(p, 'routes').disabled ?? (!targetsOf(v)?.length ? 'No parameter on the chain is reported.' : (routes?.length ?? 0) >= MAX_ROUTES ? 'Sixteen is the most.' : undefined)} />
            <Action {...st(p, 'routes')} label="Clear" does="Clear the chosen assignment. The parameter returns to its base." onPress={() => clear(p)} disabled={st(p, 'routes').disabled ?? (c.rt ? undefined : 'No assignment is chosen.')} />
          </div>
        </Section>
      </Band>
      <Band>
        <Section label="Assignment" width={124}>{c.planet}{c.target}
          <Readout label="interval" does="The planet's own just interval." value={c.rt ? (INTERVAL[c.rt.planet] ? INTERVAL[c.rt.planet]!.join(':') : 'none') : undefined} tone="value" />
        </Section>
        <Section label="Move" cols={2} width={124}>{c.use}{c.amount}{c.scope}{c.smoothing}</Section>
        <Section label="Observer" grow>
          <Radio {...observer} does="Whose view of the sky moves the sound." value={strOf(v, 'observer') ?? ''} options={OBSERVERS} stack onChange={x => p.set('observer', x)}
            disabled={observer.disabled ?? (boolOf(v, 'havePlace') === true ? undefined : 'No place is saved, so only the shared sky can be asked.')} />
          <Readout label="now" does="Where the planet puts the target now." value={c.rt && c.t ? (() => { const m = moveOf(v, c.rt, c.t, bodiesOf(v)?.[c.rt.planet]?.lon); return m?.now === undefined ? undefined : fmt(c.t, fromU(c.t, m.now)) })() : undefined} tone="value" />
        </Section>
      </Band>
    </Panel>
  },

  full: p => {
    const v = p.v, sky = bodiesOf(v), targets = targetsOf(v) ?? [], routes = routesOf(v) ?? [], cx = 210, cy = 210, R = 165, x0 = 470, x1 = 730
    const pitch = Math.min(34, 330 / Math.max(1, routes.length))
    return <div className="ref-pane-body ref-pane-body--dark">
      <svg viewBox="0 0 760 420" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" className="ref-pane-svg" aria-label="The sky and what it moves">
        <g className="dp-display" style={{background: 'none', border: 'none'}}>
          <circle cx={cx} cy={cy} r={R} className="dp-faint" />
          <circle cx={cx} cy={cy} r={R * .82} className="dp-faint" />
          {SIGN.map((s, i) => { const [a, b] = at(cx, cy, R * .82, i * 30), [c2, d] = at(cx, cy, R, i * 30), [tx, ty] = at(cx, cy, R * .91, i * 30 + 15)
            return <g key={s}><path d={`M${f1(a)} ${f1(b)}L${f1(c2)} ${f1(d)}`} className="dp-faint" /><text x={tx} y={ty + 3} textAnchor="middle" className="dp-axis">{s}</text></g> })}
          <circle cx={cx} cy={cy} r={4} className="dp-faint" />
          <text x={cx} y={cy + 18} textAnchor="middle" className="dp-axis">Earth</text>
          {sky && BODIES.map(b => { const s = sky[b]; if (!s) return null; const [x, y] = at(cx, cy, R * .66, s.lon), [gx, gy] = at(cx, cy, R * .5, s.lon), on = routes.some(r => r.planet === b)
            return <g key={b} opacity={on ? 1 : .5}>
              <circle cx={x} cy={y} r={on ? 5 : 3.5} fill={s.back ? 'var(--dp-well)' : 'var(--dp-value)'} stroke="var(--dp-value)" strokeWidth={1.3} />
              <text x={gx} y={gy} textAnchor="middle" dominantBaseline="central" className="dp-ink skm-glyph" style={{fontSize: 15}}>{GLYPH[b] + VS}</text>
            </g> })}
          {!sky && <text x={cx} y={cy - 30} textAnchor="middle" className="dp-ink-dim">No reading of the sky</text>}
          {routes.map((rt, i) => {
            const t = targets.find(x => x.id === rt.target), y = 60 + i * pitch, s = sky?.[rt.planet], m = moveOf(v, rt, t, s?.lon), X = (u: number) => x0 + u * (x1 - x0)
            const [px, py] = s ? at(cx, cy, R * .66, s.lon) : [0, 0], neg = (numOf(v, `amount:${rt.id}`) ?? 0) < 0
            return <g key={rt.id}>
              {s && <path d={`M${f1(px)} ${f1(py)}C${f1(x0 - 90)} ${f1(py)} ${f1(x0 - 60)} ${f1(y)} ${f1(x0 - 6)} ${f1(y)}`} fill="none" stroke="var(--dp-value)"
                strokeWidth={m ? .8 + 2 * Math.abs(m.a) : .8} strokeDasharray={neg ? '4 3' : undefined} opacity={.7} />}
              <text x={x0} y={y - 8} className="dp-ink"><tspan className="skm-glyph">{GLYPH[rt.planet] + VS}</tspan> {rt.planet} → {t ? `${t.device} · ${t.label}` : NONE}</text>
              <text x={x1} y={y - 8} textAnchor="end" className="dp-ink-dim">{m?.now !== undefined && t ? fmt(t, fromU(t, m.now)) : NONE}</text>
              <path d={`M${x0} ${y}H${x1}`} className="dp-faint" />
              {m && <>
                <rect x={X(m.lo)} y={y - 3.5} width={Math.max(1, X(m.hi) - X(m.lo))} height={7} className="dp-fill" stroke="var(--dp-value)" strokeWidth={1} />
                <path d={`M${f1(X(m.u0))} ${y - 6}V${y + 6}`} stroke="var(--text)" strokeWidth={1.2} />
                {m.now !== undefined && <circle cx={X(m.now)} cy={y} r={3.6} fill="var(--dp-value)" />}
              </>}
            </g>
          })}
          {!routes.length && <text x={x0} y={70} className="dp-ink-dim">{strOf(v, 'reason') ?? 'No assignment'}</text>}
          <text x={18} y={404} className="dp-axis">{dateWord(v) ?? NONE}{boolOf(v, 'now') === true ? ' · now' : ''} · a calculated sky, tropical zodiac</text>
        </g>
      </svg>
    </div>
  },

  widget: p => {
    const v = p.v, sky = bodiesOf(v), routes = routesOf(v) ?? []
    const items: RowItem[] = BODIES.map(b => { const s = sky?.[b], rt = routes.find(r => r.planet === b)
      return {id: b, name: GLYPH[b] + VS, light: !s ? 'unknown' : rt ? 'lit' : 'dark', tone: 'value', note: s ? `${Math.floor(s.lon % 30)}° ${SIGN[Math.floor(s.lon / 30)]}${s.back ? ' R' : ''}` : NONE,
        does: rt ? `${b} moves a parameter. Press to show its assignment.` : `${b} moves nothing.`} })
    return <Tile title="Sky modulation" light={lightOf(p)} span={2} onFull={p.nav.full}>
      <Display w={100} h={100} label="What the sky moves" does={DISPLAY_DOES}>
        <SkyLines p={p} w={100} h={100} layout="stack" handles={false} rows={0} />
      </Display>
      <Rows does="Each planet with its degree. A lit planet moves a parameter: press it to show its assignment." items={items} columns={2} size={10}
        onSelect={id => { const rt = routes.find(r => r.planet === id); if (rt) { p.set('selected', rt.id); p.nav.select?.() } }} />
    </Tile>
  },
}
