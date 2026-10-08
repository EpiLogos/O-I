import {NATIVE_BINDINGS, type NativeBinding} from '@epilogos/expressions-boundary/parameters'
import {NativeFieldHandle} from './NativeFieldHandle'
import {fraction, fromFraction, type HandleGeometry} from './nativeFieldHandleModel'
import {short} from './nativeFieldFaceValues.ts'
import type {FieldFaceDrawContext, FieldFaceView} from './nativeFieldFaceViews.tsx'
import './NativeFieldFace.relational.css'

type Point = {x: number; y: number}
type Mode = 'orbital' | 'nbody' | 'chaos'
const TAU = Math.PI * 2
const LAW: Record<Mode, string> = {orbital: 'Orbital', nbody: 'N-body', chaos: 'Chaotic'}
const binding = (path: string): NativeBinding => {
  const row = NATIVE_BINDINGS.find(item => item.path === path)
  if (!row) throw Error(`Relational device has no native binding for ${path}`)
  return row
}

// Handle lines in the 360x160 viewBox. Each line is the drawn scale of its own parameter: the soft range maps onto the length.
const CENTRE: Point = {x: 90, y: 74}
const ORBIT: HandleGeometry = {origin: CENTRE, dir: {x: -1, y: 0}, length: 60}          // orbit radius, drawn radius = handle distance
const SWIRL: HandleGeometry = {origin: {x: 14, y: 122}, dir: {x: 0, y: -1}, length: 46}   // swirl gaussian radius, drawn as a ring
const KNEE: HandleGeometry = {origin: {x: 196, y: 116}, dir: {x: 1, y: 0}, length: 140}  // softening knee on the falloff axis (log distance)
const PULL: HandleGeometry = {origin: {x: 344, y: 116}, dir: {x: 0, y: -1}, length: 88}  // signed pull: bottom is the soft minimum, top the maximum
const BASE_Y = 72          // zero pull, the falloff baseline; equals the PULL handle at attractorGravity 0
const PULL_HALF = 44       // pull at the soft maximum draws this far from the baseline (the PULL handle's travel from zero)

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))
const pathOf = (points: readonly Point[]) => points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join('')

/** Orbital law (PointCloudField.ts 1703-1706): centres on an ellipse, rx = r cos, ry = 0.75 r sin, at phase i/count. */
const orbitalPoint = (r: number, t: number): Point => ({x: CENTRE.x + r * Math.cos(t), y: CENTRE.y + 0.75 * r * Math.sin(t)})
/** N-body law (PointCloudField.ts 1709-1712): figure-eight lobe of amplitude 1.4 r, centres at phase i·2π/count. */
const lobePoint = (r: number, t: number): Point => {
  const d = 1 + Math.cos(t) * Math.cos(t)
  return {x: CENTRE.x + 1.4 * r * Math.sin(t) / d, y: CENTRE.y + 1.4 * r * Math.sin(t) * Math.cos(t) / d}
}
/** Chaotic law (PointCloudField.ts 1694-1699) at elapsed time 0 for centre i: wx = 0.7 r sin(1.4 s + 2.1 i), wy = 0.5 r cos(1.1 s + 1.7 i). */
const wanderPoint = (r: number, i: number, s: number): Point => ({x: CENTRE.x + 0.7 * r * Math.sin(1.4 * s + 2.1 * i), y: CENTRE.y + 0.5 * r * Math.cos(1.1 * s + 1.7 * i)})

/** The falloff kernel the shader evaluates (simulationShaders.ts 679-683), d and softening in world px. */
const kernel = (d: number, eps: number, p: number) => d / (d * d + eps * eps) ** p

/** Relational forces: configuration diagram of the three laws, the swirl ring, the falloff with its knee, and the four handles. */
export const relationalFaceView: FieldFaceView = {
  draw: (ctx: FieldFaceDrawContext) => {
    const {reading, value, family, disabled, apply, captureCurrent, setDraft} = ctx
    const engine = reading.scene.engine
    const on = engine.relationalEnabled === true
    const mode: Mode = engine.relationalMode === 'nbody' || engine.relationalMode === 'chaos' ? engine.relationalMode : 'orbital'
    const num = (path: string) => value(path) ?? binding(path).defaultValue
    const count = clamp(Math.round(num('relational.attractorCount')), 1, 10)
    const speed = num('relational.orbitSpeed'), chaos = num('relational.chaosFactor')
    const orbitBinding = binding('relational.orbitRadius'), swirlBinding = binding('relational.swirlRadius')
    const softBinding = binding('relational.gravitySoftening'), pullBinding = binding('relational.attractorGravity')

    const r = fraction(orbitBinding, num('relational.orbitRadius')) * ORBIT.length
    const swirlR = fraction(swirlBinding, num('relational.swirlRadius')) * SWIRL.length

    // Centres, the drawn path and the pairwise lines of the selected law (all at elapsed time 0: a configuration, not a frame).
    let path: Point[] = [], centres: Point[] = [], pairs: [Point, Point][] = []
    if (mode === 'orbital') {
      path = Array.from({length: 73}, (_, k) => orbitalPoint(r, TAU * k / 72))
      centres = Array.from({length: count}, (_, i) => orbitalPoint(r, TAU * i / count))
    } else if (mode === 'nbody') {
      path = Array.from({length: 73}, (_, k) => lobePoint(r, TAU * k / 72))
      centres = Array.from({length: count}, (_, i) => lobePoint(r, TAU * i / count))
      for (let i = 0; i < centres.length; i++) for (let j = i + 1; j < centres.length; j++) pairs.push([centres[i], centres[j]])
    } else {
      // Deterministic perturbed path for centre 0: the wander Lissajous over a closed window (14:11 cycles), with chaosFactor
      // scaling a fixed perturbation. The engine's turbulence is a velocity field term; this curve is a diagram of its scale only.
      const pe = clamp(chaos / 30, 0, 1) * 0.25 * r
      path = Array.from({length: 301}, (_, k) => {
        const s = 20 * Math.PI * k / 300, base = wanderPoint(r, 0, s)
        return {x: base.x + pe * Math.sin(3.7 * s), y: base.y + pe * Math.cos(2.9 * s)}
      })
      centres = Array.from({length: count}, (_, i) => wanderPoint(r, i, 0))
    }
    // Orbit direction arrow from the sign of orbitSpeed; length from |orbitSpeed| on its soft range (±20).
    let arrow: string | null = null
    if (mode === 'orbital' && speed !== 0 && r > 0) {
      const sweep = Math.sign(speed) * (0.25 + 0.6 * Math.min(1, Math.abs(speed) / 20))
      const a = 1.2, p1 = orbitalPoint(r, a), p2 = orbitalPoint(r, a + sweep)
      const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x)
      const head = (sign: number): Point => ({x: p2.x - 5 * Math.cos(angle + sign * 0.5), y: p2.y - 5 * Math.sin(angle + sign * 0.5)})
      arrow = `${pathOf([p1, p2])}${pathOf([head(1), p2, head(-1)])}`
    }

    // Swirl ring around centre 0 at the swirl gaussian radius (one centre shown; the swirl applies to each).
    const ring = centres[0] ?? CENTRE

    // Falloff curve: shape from the kernel over log distance 1..500 px (the softening handle's soft range), height from the
    // signed pull over its soft range (±50), each normalised to the kernel's own peak.
    const eps = Math.max(1, num('relational.gravitySoftening') * softBinding.factor)
    const p = num('relational.gravityFalloff'), g = clamp(num('relational.attractorGravity') / pullBinding.max, -1, 1)
    const samples = Array.from({length: 61}, (_, j) => {
      const f = j / 60, d = fromFraction(softBinding, f) * softBinding.factor
      return {f, k: kernel(d, eps, p)}
    })
    const kmax = Math.max(...samples.map(s => s.k))
    const curve = samples.map(s => ({x: KNEE.origin.x + KNEE.length * s.f, y: BASE_Y - g * PULL_HALF * (kmax > 0 && Number.isFinite(kmax) ? s.k / kmax : 0)}))
    const kneeX = KNEE.origin.x + KNEE.length * fraction(softBinding, num('relational.gravitySoftening'))

    return <>
      <g className={on ? undefined : 'native-relational-gated'}>
        <rect x="4" y="10" width="172" height="118" rx="2" className="native-medium-boundary" />
        <rect x="186" y="10" width="168" height="118" rx="2" className="native-medium-boundary" />
        <path d={pathOf(path)} className={`native-relational-path${mode === 'chaos' ? ' is-chaos' : ''}`} />
        {pairs.map(([a, b], i) => <path key={`pair-${i}`} d={pathOf([a, b])} className="native-relational-pair" />)}
        <circle cx={ring.x} cy={ring.y} r={Math.max(0, swirlR)} className="native-relational-swirl" />
        {centres.map((c, i) => <circle key={`centre-${i}`} cx={c.x} cy={c.y} r="3" className="native-relational-centre"><title>{`Centre ${i + 1}`}</title></circle>)}
        {arrow && <path d={arrow} className="native-relational-arrow" />}
        <text x="10" y="20" className="native-graph-label">{LAW[mode]} · {count} centres</text>
        <text x="10" y="31" className="native-graph-label">radius {short(num('relational.orbitRadius'))} {orbitBinding.unit ?? ''} · speed {short(speed)}</text>
        <text x="30" y="132" className="native-graph-label">swirl ring {short(num('relational.swirlRadius'))} {swirlBinding.unit ?? ''}</text>
        <path d={`M${KNEE.origin.x} ${BASE_Y}H${KNEE.origin.x + KNEE.length}`} className="native-axis" />
        <path d={pathOf(curve)} className="native-relational-curve" />
        <path d={`M${kneeX.toFixed(2)} ${BASE_Y - PULL_HALF}V${KNEE.origin.y}`} className="native-relational-knee" />
        <text x="190" y="20" className="native-graph-label">pull, falloff p {short(p)}</text>
        <text x="190" y="131" className="native-graph-label">knee ε {short(num('relational.gravitySoftening') * softBinding.factor)} {softBinding.unit ?? ''}</text>
      </g>
      {!on && <text x="190" y="31" className="native-relational-off">Off · values stored, not applied</text>}
      <NativeFieldHandle reading={reading} path="relational.orbitRadius" family={family} geometry={ORBIT} disabled={disabled} apply={apply} captureCurrent={captureCurrent} onDraft={setDraft} />
      <NativeFieldHandle reading={reading} path="relational.swirlRadius" family={family} geometry={SWIRL} disabled={disabled} apply={apply} captureCurrent={captureCurrent} onDraft={setDraft} shape="ring" />
      <NativeFieldHandle reading={reading} path="relational.gravitySoftening" family={family} geometry={KNEE} disabled={disabled} apply={apply} captureCurrent={captureCurrent} onDraft={setDraft} />
      <NativeFieldHandle reading={reading} path="relational.attractorGravity" family={family} geometry={PULL} disabled={disabled} apply={apply} captureCurrent={captureCurrent} onDraft={setDraft} shape="bar" />
    </>
  },
  switches: ({reading, disabled, apply}) => <div className="native-medium-switches native-relational-switches">
    <label><input type="checkbox" checked={reading.scene.engine.relationalEnabled === true} disabled={disabled} onChange={event => apply([{kind: 'panel-setting', key: 'relationalEnabled', value: event.target.checked}])} />Dynamic relational centres</label>
    <select aria-label="Relational law" value={reading.scene.engine.relationalMode ?? 'orbital'} disabled={disabled} onChange={event => apply([{kind: 'panel-setting', key: 'relationalMode', value: event.target.value as Mode}])}><option value="orbital">Orbital</option><option value="nbody">N-body</option><option value="chaos">Chaotic</option></select>
  </div>,
}
