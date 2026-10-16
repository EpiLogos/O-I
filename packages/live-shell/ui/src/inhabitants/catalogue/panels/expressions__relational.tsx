// Relational (manual §20.6): the field's attractor law — centres that pull, orbit, swirl and wander. Live's nearest: Auto Filter and
// Corpus — a well that draws the law with handles on it, and columns of dials ruled off beside it.
//
// The picture is the owner's own diagram (components/NativeFieldFace.relational.tsx), drawn at the well's size from the device's values:
// the centres on the path of the chosen law, the swirl ring round the first centre, the orbit direction, and the pull curve over log
// distance with its knee. The handles are the diagram's four: orbit radius, swirl radius, the pull and the softening knee.
//
// Every value key is the engine's own parameter path (NATIVE_BINDINGS, field-studies-journeys/src/nativeParameters.ts), so a field
// binding passes the owner's readings straight through. The two settings that are not numbers keep their panel-setting keys
// (nativeFieldPanelSettings.ts:55-57).
//   relationalEnabled   boolean            the centres act (engine.relationalEnabled; the light)
//   relationalMode      orbital | nbody | chaos   the law (engine.relationalMode)
//   relational.attractorCount, .attractorGravity, .orbitSpeed, .orbitRadius, .relationalSpin, .chaosFactor, .wanderSpeed,
//   .gravitySoftening, .gravityFalloff, .swirlRadius   numbers, each in its binding's own unit (paramRegistry.ts:56,108-116).
// Softening and swirl radius are in stage units: the owner binds them at WORLD_SCALE 400 engine pixels to the unit.
// A key the owner does not report is absent. The picture then names the missing reading and every control draws "—".
import {Band, Dial, Display, Folded, Handle, Panel, Radio, Readout, Section, Tile, Toggle, ValueBox, fromUnit, toUnit, type LightState, type Option, type Scale} from '../../sdk/panel'
import {boolOf, clampTo, fixed, has, numOf, secs, shown, signed, st, strOf, type DesignedDevice, type ViewProps} from './design'
import './expressions__relational.css'

type V = ViewProps['v']
type Law = 'orbital' | 'nbody' | 'chaos'
type Pt = {readonly x: number; readonly y: number}

const TAU = Math.PI * 2
/** Engine pixels in one stage unit (nativeParameters.ts:7 WORLD_SCALE): the owner binds softening and swirl radius in stage units. */
const WORLD = 400

// ------------------------------------------------------------------------------------------------ the parameters

const K = {
  enabled: 'relationalEnabled', mode: 'relationalMode', count: 'relational.attractorCount', pull: 'relational.attractorGravity',
  speed: 'relational.orbitSpeed', radius: 'relational.orbitRadius', spin: 'relational.relationalSpin', chaos: 'relational.chaosFactor',
  wander: 'relational.wanderSpeed', soft: 'relational.gravitySoftening', fall: 'relational.gravityFalloff', swirl: 'relational.swirlRadius',
} as const

interface Par extends Scale {readonly key: string; readonly label: string; readonly step: number; readonly def: number; readonly discrete?: boolean; readonly fmt: (x: number) => string}
const short4 = (x: number) => String(Number(x.toFixed(4)))
const px = (x: number) => `${Math.round(x)} px`
/** The soft range, grid step and default of each parameter, as NATIVE_BINDINGS gives them: the registry's range and step divided by the
 * binding's factor, the default read from the engine's defaults (fieldDefaults.ts:142-155) divided by the same factor. */
const PAR = {
  count: {key: K.count, label: 'Centres', min: 1, max: 10, step: 1, def: 3, discrete: true, fmt: (x: number) => String(Math.round(x))},
  pull: {key: K.pull, label: 'Pull', min: -50, max: 50, step: .1, def: 1.6, fmt: signed(1)},
  speed: {key: K.speed, label: 'Orbit', min: -20, max: 20, step: .05, def: .8, fmt: signed(2)},
  radius: {key: K.radius, label: 'Radius', min: 0, max: 2000, step: 5, def: 240, fmt: px},
  spin: {key: K.spin, label: 'Spin', min: -30, max: 30, step: .1, def: 1.4, fmt: signed(1)},
  chaos: {key: K.chaos, label: 'Chaos', min: 0, max: 30, step: .1, def: .2, fmt: fixed(1)},
  wander: {key: K.wander, label: 'Wander', min: 0, max: 10, step: .05, def: .5, fmt: fixed(2)},
  soft: {key: K.soft, label: 'Softening', min: 1 / WORLD, max: 500 / WORLD, log: true, step: 1 / WORLD, def: 45 / WORLD, fmt: short4},
  fall: {key: K.fall, label: 'Falloff', min: .5, max: 3, step: .01, def: 1.45, fmt: fixed(2)},
  swirl: {key: K.swirl, label: 'Reach', min: 20 / WORLD, max: 3000 / WORLD, log: true, step: 10 / WORLD, def: 500 / WORLD, fmt: short4},
} satisfies Record<string, Par>

/** The scale a dial turns on. Only the centre count is stepped for the hand; the others turn smoothly and snap to the owner's grid when written. */
const scaleOf = (b: Par): Scale => ({min: b.min, max: b.max, ...(b.log ? {log: true} : {}), ...(b.discrete ? {step: b.step} : {})})
/** A value the owner can take: on its grid and inside its soft range. */
const settle = (b: Par, x: number) => clampTo(b.min, b.max, Number((Math.round(x / b.step) * b.step).toPrecision(12)))
const nv = (v: V, key: string) => numOf(v, key) ?? NaN
/** The value a fraction of the soft range stands for, unsnapped (the curve is sampled along it). */
const along = (b: Par, u: number) => (b.log ? b.min * Math.pow(b.max / b.min, u) : b.min + u * (b.max - b.min))

const LAWS: readonly Option<string>[] = [
  {value: 'orbital', label: 'Orbital', does: 'The centres circle on an ellipse round the middle.'},
  {value: 'nbody', label: 'N-body', does: 'The centres move on a figure-eight round the middle.'},
  {value: 'chaos', label: 'Chaotic', does: 'The centres wander with no fixed path.'},
]
const LAW_NAME: Record<Law, string> = {orbital: 'Orbital', nbody: 'N-body', chaos: 'Chaotic'}
const lawOf = (v: V): Law | undefined => { const m = strOf(v, K.mode); return m === 'orbital' || m === 'nbody' || m === 'chaos' ? m : undefined }
const countOf = (v: V) => { const n = numOf(v, K.count); return n === undefined ? undefined : clampTo(1, 10, Math.round(n)) }
const lightOf = (p: ViewProps): LightState => { const o = p.owner ?? p.v; return !has(o, K.enabled) ? 'unknown' : o[K.enabled] === true ? 'lit' : 'dark' }
/** The activator is the On setting: it reads the owner and asks it to switch. */
const head = (p: ViewProps) => { const light = lightOf(p); return {light, onLight: () => p.set(K.enabled, light !== 'lit'), lightWhy: st(p, K.enabled).disabled} }

// ------------------------------------------------------------------------------------------------ the law

/** Where a centre stands at time zero, for centre i of the law (PointCloudField.ts:1792-1816), in engine units, y up, from the middle.
 * Orbital: an ellipse, rx = r, ry = 0.75 r, at phase i/count. N-body: a figure-eight of amplitude 1.4 r. Chaotic: a Lissajous wander. */
const orbitalPt = (r: number, t: number): Pt => ({x: r * Math.cos(t), y: .75 * r * Math.sin(t)})
const lobePt = (r: number, t: number): Pt => { const d = 1 + Math.cos(t) * Math.cos(t); return {x: 1.4 * r * Math.sin(t) / d, y: 1.4 * r * Math.sin(t) * Math.cos(t) / d} }
const wanderPt = (r: number, i: number, s: number): Pt => ({x: .7 * r * Math.sin(1.4 * s + 2.1 * i), y: .5 * r * Math.cos(1.1 * s + 1.7 * i)})

interface Layout {readonly path: readonly Pt[]; readonly centres: readonly Pt[]; readonly pairs: readonly (readonly [Pt, Pt])[]}
/** The path and the centres of a law. In the Chaotic law the owner's diagram perturbs the path by the chaos factor as a drawing of its
 * scale only (the engine's turbulence is a force on the particles); the path is empty while the chaos factor is absent. */
function layoutOf(law: Law, r: number, count: number | undefined, chaos: number | undefined): Layout {
  const n = count ?? 0
  if (law === 'orbital') return {path: Array.from({length: 73}, (_, k) => orbitalPt(r, TAU * k / 72)), centres: Array.from({length: n}, (_, i) => orbitalPt(r, TAU * i / n)), pairs: []}
  if (law === 'nbody') {
    const centres = Array.from({length: n}, (_, i) => lobePt(r, TAU * i / n))
    const pairs: (readonly [Pt, Pt])[] = []
    for (let i = 0; i < centres.length; i++) for (let j = i + 1; j < centres.length; j++) pairs.push([centres[i]!, centres[j]!])
    return {path: Array.from({length: 73}, (_, k) => lobePt(r, TAU * k / 72)), centres, pairs}
  }
  const pe = chaos === undefined ? 0 : clampTo(0, 1, chaos / PAR.chaos.max) * .25 * r
  const path = chaos === undefined ? [] : Array.from({length: 301}, (_, k) => {
    const s = 20 * Math.PI * k / 300, base = wanderPt(r, 0, s)
    return {x: base.x + pe * Math.sin(3.7 * s), y: base.y + pe * Math.cos(2.9 * s)}
  })
  return {path, centres: Array.from({length: n}, (_, i) => wanderPt(r, i, 0)), pairs: []}
}
const pathD = (points: readonly (readonly [number, number])[]) => points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`).join('')

/** The pull the shader gives a particle at distance d from one centre is pull × 140000 × d ÷ (d² + ε²)^p (simulationShaders.ts:680-682). */
const kernel = (d: number, eps: number, p: number) => d / (d * d + eps * eps) ** p
/** The distance at which that pull is greatest: d = ε ÷ √(2p − 1). None for p at or below one half. */
const peakAt = (eps: number, p: number) => (2 * p - 1 > 0 ? eps / Math.sqrt(2 * p - 1) : undefined)

/** The whole flow the engine adds at a point (simulationShaders.ts:670-705, time zero): each centre's pull and planar whirl, and the chaos field. */
function flow(x: number, y: number, centres: readonly Pt[], g: number, eps: number, p: number, spin: number, sr: number, chaos: number): [number, number] {
  let fx = 0, fy = 0
  centres.forEach((c, i) => {
    const tx = c.x - x, ty = c.y - y, d2 = tx * tx + ty * ty, d = Math.sqrt(d2)
    const pull = g * 140000 / (d2 + eps * eps) ** p
    fx += tx * pull; fy += ty * pull
    const whirl = spin * (i % 2 === 0 ? 1 : -1) * (1 + i * .2) * 350 * Math.exp(-d2 / (2 * sr * sr)) / (d + 22)
    fx += -ty * whirl; fy += tx * whirl
  })
  if (chaos > .001) {
    const sx = Math.sin(y * .007), cy = Math.cos(x * .007)
    fx += (sx * cy - .08 * x * .003) * chaos * 160
    fy += (sx - .08 * y * .003) * chaos * 160
  }
  return [fx, fy]
}

// ------------------------------------------------------------------------------------------------ the displays

const missing = (names: readonly string[]) => names.slice(0, 3).map((n, i) => `No reading of ${n}`.concat(i === 2 && names.length > 3 ? ` +${names.length - 3}` : ''))

/** The centres on the path of the law, the swirl ring, the orbit direction. Handle 1 is the orbit radius, along the line from the middle;
 * handle 2 is the swirl radius, along the rail at the left (NativeFieldFace.relational.tsx: ORBIT and SWIRL). `small`: the tile's picture. */
function CentresDisplay({p, w, h, small}: {p: ViewProps; w: number; h: number; small?: boolean}) {
  const v = p.v, set = small ? undefined : p.set
  const law = lawOf(v), R = numOf(v, K.radius), speed = numOf(v, K.speed), swirl = numOf(v, K.swirl), chaos = numOf(v, K.chaos), count = countOf(v), on = boolOf(v, K.enabled)
  const Lr = Math.min((w / 2 - 6) / 1.4, (h / 2 - (small ? 20 : 34)) / .75), Ls = Lr * .767
  const cx = w / 2, cy = h / 2 + (small ? 2 : 6), railX = 11, railY = h - 12
  // The orbit radius is drawn on a square-root scale along the line (the owner draws it linear over 0 to 2000, where the default 240 is a dot).
  const r = R === undefined ? undefined : Math.sqrt(toUnit(PAR.radius, R)) * Lr
  const map = (q: Pt): [number, number] => [cx + q.x, cy - q.y]
  const laid = law !== undefined && r !== undefined ? layoutOf(law, r, count, chaos) : undefined
  const centre0 = laid && law ? (law === 'orbital' ? orbitalPt(r!, 0) : law === 'nbody' ? lobePt(r!, 0) : wanderPt(r!, 0, 0)) : undefined
  const ring = swirl !== undefined && centre0 ? toUnit(PAR.swirl, swirl) * Ls : undefined
  let arrow: string | undefined
  if (law === 'orbital' && speed !== undefined && speed !== 0 && r !== undefined && r > 0) {
    const sweep = Math.sign(speed) * (.25 + .6 * Math.min(1, Math.abs(speed) / PAR.speed.max)), q1 = map(orbitalPt(r, 1.2)), q2 = map(orbitalPt(r, 1.2 + sweep))
    const ang = Math.atan2(q2[1] - q1[1], q2[0] - q1[0]), tip = (s: number): [number, number] => [q2[0] - 5 * Math.cos(ang + s * .5), q2[1] - 5 * Math.sin(ang + s * .5)]
    arrow = `${pathD([q1, q2])}${pathD([tip(1), q2, tip(-1)])}`
  }
  const lack = [
    ...(law === undefined ? ['the law'] : []), ...(R === undefined ? ['the orbit radius'] : []), ...(law && count === undefined ? ['the centre count'] : []),
    ...(law === 'chaos' && chaos === undefined ? ['the chaos factor'] : []), ...(swirl === undefined ? ['the swirl radius'] : []),
    ...(law === 'orbital' && speed === undefined ? ['the orbit speed'] : []), ...(on === undefined ? ['on or off'] : []),
  ]
  const can = (key: string) => (set && !st(p, key).disabled ? set : undefined)
  const setRadius = can(K.radius), setSwirl = can(K.swirl)
  return <Display w={w} h={h} label="The centres" does="The centres on the path of the law, the swirl ring round the first centre and the orbit direction, drawn from the device's values. Drag the handles."
    corner={small ? undefined : law ? LAW_NAME[law] : '—'}>
    <g className={on === false ? 'rl-gated' : undefined}>
      {laid && <path d={pathD(laid.path.map(map))} className="rl-path" data-law={law} />}
      {laid?.pairs.map(([a, b], i) => <path key={i} d={pathD([map(a), map(b)])} className="rl-pair" />)}
      {ring !== undefined && centre0 && <circle cx={map(centre0)[0]} cy={map(centre0)[1]} r={Math.max(0, ring)} className="rl-swirl" />}
      {laid?.centres.map((c, i) => <circle key={i} cx={map(c)[0]} cy={map(c)[1]} r={3} className="rl-centre"><title>{`Centre ${i + 1}`}</title></circle>)}
      {arrow && <path d={arrow} className="rl-arrow" />}
    </g>
    {small && lack.length > 0 && <text x={6} y={12} className="rl-note" data-none="true">{missing(lack.slice(0, 1))[0]}</text>}
    {!small && <>
      <path d={`M${cx} ${cy}H${cx - Lr}`} className="dp-faint" opacity={.6} />
      <path d={`M${railX} ${railY}V${railY - Ls}`} className="dp-faint" opacity={.6} />
      <text x={6} y={12} className="rl-note" data-none={count === undefined || undefined}>{count === undefined ? '—' : `${count} ${count === 1 ? 'centre' : 'centres'}`}</text>
      <text x={6} y={23} className="rl-note" data-none={R === undefined || undefined}>{`r ${R === undefined ? '—' : px(R)} · ${speed === undefined ? '—' : signed(2)(speed)}`}</text>
      {on === false && <text x={6} y={34} className="rl-note">Off · not applied</text>}
      {missing(lack).map((line, i) => <text key={line} x={6} y={(on === false ? 45 : 34) + i * 11} className="rl-note" data-none="true">{line}</text>)}
      {swirl !== undefined && <text x={22} y={h - 5} className="dp-axis">{`ring ${short4(swirl)}`}</text>}
    </>}
    {r !== undefined && <Handle n={1} x={cx - r} y={cy} label="Orbit radius" does="Drag along the line from the middle: how far the centres lie from the middle."
      onDrag={setRadius && (x => setRadius(K.radius, settle(PAR.radius, fromUnit(PAR.radius, clampTo(0, 1, Math.max(0, cx - x) / Lr) ** 2))))} onReset={setRadius && (() => setRadius(K.radius, PAR.radius.def))} />}
    {!small && swirl !== undefined && <Handle n={2} shape="ring" x={railX} y={railY - toUnit(PAR.swirl, swirl) * Ls} label="Swirl radius" does="Drag up the rail: the reach of the whirl round each centre. The ring shows it."
      onDrag={setSwirl && ((_, y) => setSwirl(K.swirl, settle(PAR.swirl, fromUnit(PAR.swirl, (railY - y) / Ls))))} onReset={setSwirl && (() => setSwirl(K.swirl, PAR.swirl.def))} />}
  </Display>
}

/** The pull of one centre over distance, on a log axis: the curve, the softening knee, the signed pull. Handle 1 is the pull, on the rail at
 * the right (zero in the middle); handle 2 is the softening, on the distance line below (NativeFieldFace.relational.tsx: PULL and KNEE). */
function PullDisplay({p, w, h}: {p: ViewProps; w: number; h: number}) {
  const v = p.v, set = p.set
  const soft = numOf(v, K.soft), fall = numOf(v, K.fall), pull = numOf(v, K.pull), on = boolOf(v, K.enabled)
  const x0 = 12, len = w - 46, railX = w - 14, bottom = h - 22, plen = h - 58, base = bottom - plen / 2
  let curve: string | undefined, shape: string | undefined
  if (soft !== undefined && fall !== undefined && pull !== undefined) {
    const eps = Math.max(1, soft * WORLD), g = clampTo(-1, 1, pull / PAR.pull.max)
    const samples = Array.from({length: 61}, (_, j) => ({f: j / 60, k: kernel(along(PAR.soft, j / 60) * WORLD, eps, fall)}))
    const kmax = Math.max(...samples.map(s => s.k))
    const unit = (k: number) => (kmax > 0 && Number.isFinite(kmax) ? k / kmax : 0)
    curve = pathD(samples.map(s => [x0 + len * s.f, base - g * (plen / 2) * unit(s.k)] as const))
    // The shape of the law alone, at the full height of the rail, in the direction of the pull: where it peaks and how it fades.
    shape = pathD(samples.map(s => [x0 + len * s.f, base - (pull < 0 ? -1 : 1) * (plen / 2) * unit(s.k)] as const))
  }
  const knee = soft === undefined ? undefined : x0 + len * toUnit(PAR.soft, soft)
  const lack = [...(soft === undefined ? ['the softening'] : []), ...(fall === undefined ? ['the falloff'] : []), ...(pull === undefined ? ['the pull'] : []), ...(on === undefined ? ['on or off'] : [])]
  const can = (key: string) => (!st(p, key).disabled ? set : undefined)
  const setPull = can(K.pull), setSoft = can(K.soft)
  return <Display w={w} h={h} label="The pull" does="The pull of one centre over distance, on a log axis, with the softening knee. Drag handle 1 for the pull and handle 2 for the softening."
    corner={`pull ${shown(v, K.pull, x => signed(1)(Number(x)))}`}>
    <g className={on === false ? 'rl-gated' : undefined}>
      <path d={`M${x0} ${base}H${x0 + len}`} className="dp-grid" />
      {shape && <path d={shape} className="dp-faint" strokeDasharray="2 3" />}
      {curve && <path d={curve} className="rl-curve" />}
      {knee !== undefined && <path d={`M${knee.toFixed(2)} ${base - plen / 2}V${bottom}`} className="rl-knee" />}
    </g>
    <path d={`M${x0} ${bottom}H${x0 + len}`} className="dp-faint" opacity={.6} />
    <path d={`M${railX} ${bottom}V${bottom - plen}`} className="dp-faint" opacity={.6} />
    <text x={6} y={12} className="rl-note" data-none={fall === undefined || undefined}>{`falloff p ${fall === undefined ? '—' : fixed(2)(fall)}`}</text>
    <text x={x0} y={bottom + 13} className="dp-axis">{short4(PAR.soft.min)}</text>
    <text x={x0 + len} y={bottom + 13} className="dp-axis" textAnchor="end">{short4(PAR.soft.max)}</text>
    {on === false && <text x={6} y={23} className="rl-note">Off · not applied</text>}
    {missing(lack).map((line, i) => <text key={line} x={6} y={(on === false ? 34 : 23) + i * 11} className="rl-note" data-none="true">{line}</text>)}
    {knee !== undefined && <text x={knee > x0 + len * .6 ? knee - 4 : knee + 4} y={base - plen / 2 + 8} className="dp-axis" textAnchor={knee > x0 + len * .6 ? 'end' : 'start'}>{`ε ${short4(soft!)}`}</text>}
    {pull !== undefined && <Handle n={1} shape="square" x={railX} y={bottom - toUnit(PAR.pull, pull) * plen} label="Gravity pull" does="Drag up or down the rail: the strength of each centre. Below the middle it pushes."
      onDrag={setPull && ((_, y) => setPull(K.pull, settle(PAR.pull, fromUnit(PAR.pull, (bottom - y) / plen))))} onReset={setPull && (() => setPull(K.pull, PAR.pull.def))} />}
    {knee !== undefined && <Handle n={2} x={knee} y={bottom} label="Softening" does="Drag along the distance line: where the pull stops growing near a centre."
      onDrag={setSoft && (x => setSoft(K.soft, settle(PAR.soft, fromUnit(PAR.soft, (x - x0) / len))))} onReset={setSoft && (() => setSoft(K.soft, PAR.soft.def))} />}
  </Display>
}

// ------------------------------------------------------------------------------------------------ controls

const DIAL = (p: ViewProps, par: Par, does: string, bipolar = false, label = par.label) =>
  <Dial key={par.key} {...st(p, par.key)} label={label} does={does} value={nv(p.v, par.key)} def={par.def} scale={scaleOf(par)} format={par.fmt} bipolar={bipolar} onChange={x => p.set(par.key, settle(par, x))} />
const BOX = (p: ViewProps, par: Par, does: string, bipolar = false) =>
  <ValueBox key={par.key} {...st(p, par.key)} label={par.label} does={does} value={nv(p.v, par.key)} def={par.def} scale={scaleOf(par)} format={par.fmt} bipolar={bipolar} onChange={x => p.set(par.key, settle(par, x))} />

const DOES = {
  pull: 'Sets the strength of each centre. A negative value pushes particles away.',
  speed: 'Sets how fast the centres circle. It does nothing in the Chaotic law.',
  spin: 'Sets the strength of the whirl round each centre. Neighbouring centres turn opposite ways.',
  chaos: 'Sets how much turbulence the centres add.',
  count: 'Sets the number of centres, from 1 to 10.',
  radius: 'Sets how far the centres lie from the middle, in pixels.',
  wander: 'Sets how fast the centres drift. It does nothing in the N-body law.',
  swirl: 'Sets the reach of the whirl round each centre, in stage units.',
  soft: 'Stops the pull from growing without limit near a centre. In stage units.',
  fall: 'Sets how fast the pull fades with distance.',
} as const

const onToggle = (p: ViewProps) => <Toggle {...st(p, K.enabled)} label="On" does="Lets the centres act. While it is off, the values stay and nothing moves." on={boolOf(p.v, K.enabled) === true} unknown={!has(p.v, K.enabled)} onChange={x => p.set(K.enabled, x)} />
const lawRadio = (p: ViewProps) => <Radio {...st(p, K.mode)} label="Law" does="Sets how the centres move. It changes only where the centres stand." value={strOf(p.v, K.mode) ?? ''} options={LAWS} stack onChange={x => p.set(K.mode, x)} />

/** The placement controls the law uses (PointCloudField.ts:1797-1816): Orbital uses speed, radius and a small wander drift; N-body speed and
 * radius; Chaotic radius and wander. */
const USES: Record<Law, string> = {orbital: 'speed · radius · wander', nbody: 'speed · radius', chaos: 'radius · wander'}
const periodOf = (v: V) => {
  const law = lawOf(v), speed = numOf(v, K.speed)
  if (law === undefined || law === 'chaos' || speed === undefined) return undefined
  return speed === 0 ? 'still' : secs(TAU / Math.abs(speed))
}
const peakOf = (v: V) => {
  const soft = numOf(v, K.soft), fall = numOf(v, K.fall)
  if (soft === undefined || fall === undefined) return undefined
  const d = peakAt(Math.max(1, soft * WORLD), fall)
  return d === undefined ? 'none' : short4(d / WORLD)
}

// ------------------------------------------------------------------------------------------------ the pane: the field

/** The field's flow lines under the pull and the whirl of the centres, with each centre on its path. A line starts at a dot and runs the way
 * a particle is pushed (the engine's force, summed over the centres at time zero). It is drawn only while every reading it needs is present. */
function Pane({p}: {p: ViewProps}) {
  const v = p.v, W = 760, H = 420, cx = W / 2 + 40, cy = H / 2
  const law = lawOf(v), R = numOf(v, K.radius), count = countOf(v), chaos = numOf(v, K.chaos), on = boolOf(v, K.enabled)
  const pull = numOf(v, K.pull), soft = numOf(v, K.soft), fall = numOf(v, K.fall), spin = numOf(v, K.spin), swirl = numOf(v, K.swirl)
  const k = R !== undefined && R > 0 ? clampTo(.1, 1, Math.min((W / 2 - 110) / (1.4 * R), (H / 2 - 60) / (.9 * R))) : 1
  const laid = law !== undefined && R !== undefined ? layoutOf(law, R, count, chaos) : undefined
  const map = (q: Pt): [number, number] => [cx + k * q.x, cy - k * q.y]
  const lines: string[] = [], seeds: [number, number][] = []
  const canFlow = laid !== undefined && count !== undefined && pull !== undefined && soft !== undefined && fall !== undefined && spin !== undefined && swirl !== undefined && chaos !== undefined
  if (canFlow) {
    const eps = Math.max(1, soft * WORLD), sr = Math.max(5, swirl * WORLD), cols = 26, rows = 14
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      let sx = (i + .5) * W / cols, sy = (j + .5) * H / rows
      seeds.push([sx, sy])
      const pts: [number, number][] = [[sx, sy]]
      for (let s = 0; s < 22; s++) {
        const [fx, fy] = flow((sx - cx) / k, (cy - sy) / k, laid.centres, pull, eps, fall, spin, sr, chaos), m = Math.hypot(fx, fy)
        if (!(m > 1e-9)) break
        sx += fx / m * 6; sy -= fy / m * 6
        pts.push([sx, sy])
      }
      lines.push(pathD(pts))
    }
  }
  const lack = [
    ...(law === undefined ? ['the law'] : []), ...(R === undefined ? ['the orbit radius'] : []), ...(law && count === undefined ? ['the centre count'] : []),
    ...(pull === undefined ? ['the pull'] : []), ...(soft === undefined ? ['the softening'] : []), ...(fall === undefined ? ['the falloff'] : []),
    ...(spin === undefined ? ['the spin'] : []), ...(swirl === undefined ? ['the swirl radius'] : []), ...(chaos === undefined ? ['the chaos factor'] : []),
  ]
  const centre0 = laid && law && R !== undefined ? (law === 'orbital' ? orbitalPt(R, 0) : law === 'nbody' ? lobePt(R, 0) : wanderPt(R, 0, 0)) : undefined
  const say = (key: string, f: (x: number) => string) => shown(v, key, x => f(Number(x)))
  return <div className="rl-pane">
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="xMidYMid slice" aria-label="The field">
      <g className="dp-display" style={{background: 'none'}}>
        <g className={on === false ? 'rl-gated' : undefined}>
          {lines.map((d, i) => <path key={i} d={d} className="rl-flow" />)}
          {seeds.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={1.1} className="rl-seed" />)}
        </g>
        {laid && <path d={pathD(laid.path.map(map))} className="rl-path" data-law={law} />}
        {laid?.pairs.map(([a, b], i) => <path key={i} d={pathD([map(a), map(b)])} className="rl-pair" />)}
        {swirl !== undefined && centre0 && <circle cx={map(centre0)[0]} cy={map(centre0)[1]} r={swirl * WORLD * k} className="rl-swirl" />}
        {laid?.centres.map((c, i) => <g key={i}>
          <circle cx={map(c)[0]} cy={map(c)[1]} r={5} className="rl-centre" />
          <text x={map(c)[0] + 9} y={map(c)[1] - 8} className="rl-centre-n">{i + 1}</text>
        </g>)}
        <text x={24} y={30} className="rl-line" data-head="true">{`${law ? LAW_NAME[law] : '—'} · ${count === undefined ? '—' : `${count} ${count === 1 ? 'centre' : 'centres'}`}`}</text>
        <text x={24} y={50} className="rl-line">{`orbit radius ${say(K.radius, px)} · speed ${say(K.speed, signed(2))} · wander ${say(K.wander, fixed(2))}`}</text>
        <text x={24} y={68} className="rl-line">{`pull ${say(K.pull, signed(1))} · falloff p ${say(K.fall, fixed(2))} · softening ${say(K.soft, short4)} stage units`}</text>
        <text x={24} y={86} className="rl-line">{`spin ${say(K.spin, signed(1))} · swirl ring ${say(K.swirl, short4)} stage units · chaos ${say(K.chaos, fixed(1))}`}</text>
        {on === false && <text x={24} y={106} className="rl-line">Off · the values stay and nothing is applied</text>}
        {lack.length > 0 && <text x={24} y={on === false ? 124 : 106} className="rl-line" data-none="true">{missing(lack).join(' · ')}</text>}
        {!canFlow && lack.length === 0 && <text x={24} y={106} className="rl-line" data-none="true">No flow to draw</text>}
      </g>
    </svg>
  </div>
}

// ------------------------------------------------------------------------------------------------ the device

export const design: DesignedDevice = {
  id: 'expressions:relational',
  title: 'Relational',
  kind: 'effect',
  firstPage: 'centres',
  // The owner's defaults: the centres off (fieldDefaults.ts:143, model.ts DEFAULT_ENGINE_SETTINGS), the Orbital law, three centres,
  // and the engine's numbers (fieldDefaults.ts:145-154). Softening 45 px and swirl 500 px are in stage units: 45/400 and 500/400.
  defaults: {
    relationalEnabled: false, relationalMode: 'orbital', 'relational.attractorCount': 3, 'relational.attractorGravity': 1.6, 'relational.orbitSpeed': .8,
    'relational.orbitRadius': 240, 'relational.relationalSpin': 1.4, 'relational.chaosFactor': .2, 'relational.wanderSpeed': .5,
    'relational.gravitySoftening': 45 / WORLD, 'relational.gravityFalloff': 1.45, 'relational.swirlRadius': 500 / WORLD,
  },
  fixtures: {
    'On · Orbital': {relationalEnabled: true},
    'On · N-body, five centres': {relationalEnabled: true, relationalMode: 'nbody', 'relational.attractorCount': 5},
    'No readings': {
      relationalEnabled: undefined, relationalMode: undefined, 'relational.attractorCount': undefined, 'relational.attractorGravity': undefined, 'relational.orbitSpeed': undefined,
      'relational.orbitRadius': undefined, 'relational.relationalSpin': undefined, 'relational.chaosFactor': undefined, 'relational.wanderSpeed': undefined,
      'relational.gravitySoftening': undefined, 'relational.gravityFalloff': undefined, 'relational.swirlRadius': undefined,
    },
  },

  folded: p => <Folded title="Relational" light={lightOf(p)} readings={[`${shown(p.v, K.mode, x => LAW_NAME[x as Law] ?? '—')} · ${shown(p.v, K.count)}`, `pull ${shown(p.v, K.pull, x => signed(1)(Number(x)))}`]} onUnfold={p.nav.unfold} />,

  compact: p => <Panel title="Relational" view="compact" {...head(p)} onFold={p.nav.fold} onFull={p.nav.full} onSelect={p.nav.select}>
    <Section width={152}><CentresDisplay p={p} w={140} h={146} /></Section>
    <Section label="Macros" cols={2}>
      {DIAL(p, PAR.pull, DOES.pull, true)}
      {DIAL(p, PAR.speed, DOES.speed, true)}
      {DIAL(p, PAR.spin, DOES.spin, true)}
      {DIAL(p, PAR.chaos, DOES.chaos)}
    </Section>
  </Panel>,

  whole: p => <Panel title="Relational" view="whole" {...head(p)} onFold={p.nav.fold} onFull={p.nav.full}
    pages={[{id: 'centres', label: 'Centres'}, {id: 'pull', label: 'Pull'}]} page={p.page} onPage={p.setPage}>
    {p.page !== 'pull' ? <>
      <Band>
        <Section width={198}><CentresDisplay p={p} w={186} h={146} /></Section>
        <Section label="Law" width={78}>
          {onToggle(p)}
          {lawRadio(p)}
        </Section>
        <Section label="Placement" cols={2} grow>
          {DIAL(p, PAR.count, DOES.count)}
          {DIAL(p, PAR.speed, DOES.speed, true)}
          {DIAL(p, PAR.radius, DOES.radius)}
          {DIAL(p, PAR.wander, DOES.wander)}
        </Section>
      </Band>
      <Band>
        <Section label="Swirl and turbulence" cols={3}>
          {DIAL(p, PAR.spin, DOES.spin, true)}
          {DIAL(p, PAR.swirl, DOES.swirl)}
          {DIAL(p, PAR.chaos, DOES.chaos)}
        </Section>
        <Section label="Reading" grow>
          <Readout big label="period" does="The time one lap takes at Tempo 1. The Chaotic law has no lap." value={periodOf(p.v)} tone="value" />
          <Readout label="law uses" does="The placement settings that this law uses." value={lawOf(p.v) ? USES[lawOf(p.v)!] : undefined} />
        </Section>
      </Band>
    </> : <>
      <Band>
        <Section width={198}><PullDisplay p={p} w={186} h={146} /></Section>
        <Section label="Pull" cols={2} grow>
          {DIAL(p, PAR.pull, DOES.pull, true)}
          {DIAL(p, PAR.fall, DOES.fall)}
          {DIAL(p, PAR.soft, DOES.soft)}
          <Readout big label="peak at" does="The distance at which one centre pulls hardest, in stage units." value={peakOf(p.v)} tone="value" />
        </Section>
      </Band>
    </>}
  </Panel>,

  full: p => <Pane p={p} />,

  widget: p => <Tile title="Relational" light={lightOf(p)} span={2} onFull={p.nav.full}>
    <CentresDisplay p={p} w={112} h={104} small />
    <div className="rl-tile-grid">
      {BOX(p, PAR.pull, DOES.pull, true)}
      {BOX(p, PAR.speed, DOES.speed, true)}
      {BOX(p, PAR.spin, DOES.spin, true)}
      {BOX(p, PAR.chaos, DOES.chaos)}
      <div className="rl-span2">{onToggle(p)}</div>
    </div>
  </Tile>,
}
