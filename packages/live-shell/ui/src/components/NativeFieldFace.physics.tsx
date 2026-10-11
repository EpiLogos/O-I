import type {ReactNode} from 'react'
import {NATIVE_BINDINGS} from '@epilogos/expressions-boundary/parameters'
import {NativeFieldHandle} from './NativeFieldHandle.tsx'
import {fraction, handlePosition, type HandleGeometry} from './nativeFieldHandleModel.ts'
import type {FieldFaceDrawContext, FieldFaceSwitchContext, FieldFaceView} from './nativeFieldFaceViews.tsx'
import {short} from './nativeFieldFaceValues.ts'
import {NativeEngineActions} from './NativeEngineActions.tsx'
import './NativeFieldFace.physics.css'

/** The four in-diagram handles. None is the controlPath (fluid.vortexStrength), which the bottom slider owns. */
export const PHYSICS_HANDLE_PATHS = ['fluid.vortexRadius', 'fluid.gravityX', 'fluid.gravityY', 'fluid.timeScale'] as const
/** Every reading the drawing uses; a missing one is named in the diagram instead of drawn as zero. */
const DRAWN_PATHS = ['fluid.vortexStrength', 'fluid.curlScale', 'fluid.vortexRadius', 'fluid.gravityX', 'fluid.gravityY', 'fluid.gravityZ',
  'fluid.viscosity', 'fluid.quadraticDrag', 'fluid.maxSpeed'] as const

const binding = (path: string) => {
  const row = NATIVE_BINDINGS.find(item => item.path === path)
  if (!row) throw Error(`missing native binding ${path}`)
  return row
}
const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value))

// Diagram frame: 360 x 160. Content stays above y 134 because the editor draws the bottom slider axis at y 140.
const VORTEX = {x: 62, y: 66, reach: 44}                       // swirl centre; largest ring radius in diagram px
const GRAVITY = {x: 168, y: 66, half: 40}                      // box centre and half-size; a soft-range end sits on the box edge
const DECAY = {x0: 262, x1: 344, y0: 22, y1: 106, steps: 60}   // speed plot over 60 simulation steps (1/60 s each)
// Handle geometry: each handle's position along its line is the same fraction the drawing uses (handlePosition in nativeFieldHandleModel.ts).
const RING: HandleGeometry = {origin: {x: VORTEX.x, y: VORTEX.y}, dir: {x: 1, y: 0}, length: VORTEX.reach}
const GRAVITY_X: HandleGeometry = {origin: {x: GRAVITY.x - GRAVITY.half, y: 120}, dir: {x: 1, y: 0}, length: 2 * GRAVITY.half}
const GRAVITY_Y: HandleGeometry = {origin: {x: GRAVITY.x + GRAVITY.half + 10, y: GRAVITY.y + GRAVITY.half}, dir: {x: 0, y: -1}, length: 2 * GRAVITY.half}
const TIME: HandleGeometry = {origin: {x: DECAY.x0, y: 118}, dir: {x: 1, y: 0}, length: DECAY.x1 - DECAY.x0}

/** A short line with an arrowhead at (x2, y2). */
function arrow(x1: number, y1: number, x2: number, y2: number): string {
  const length = Math.hypot(x2 - x1, y2 - y1) || 1, bx = -(x2 - x1) / length, by = -(y2 - y1) / length, head = 3.2
  const arm = (angle: number) => {const c = Math.cos(angle), s = Math.sin(angle); return `${x2 + (bx * c - by * s) * head} ${y2 + (bx * s + by * c) * head}`}
  return `M${x1} ${y1}L${x2} ${y2}M${arm(.52)}L${x2} ${y2}L${arm(-.52)}`
}

/** Physics: the app's own panel as one configuration diagram. Every drawn element is computed from the reading (ctx.value) with the shader relation cited beside it. */
export const physicsFaceView: FieldFaceView = {
  draw: (ctx: FieldFaceDrawContext): ReactNode => {
    const {reading, family, disabled, apply, captureCurrent, setDraft, value} = ctx
    const read = (path: string) => value(path) ?? NaN
    const missing = DRAWN_PATHS.filter(path => !Number.isFinite(read(path)))
    if (missing.length) return <text x="8" y="80" className="native-graph-label">No reading for {missing.join(', ')}; diagram not drawn.</text>

    const strength = read('fluid.vortexStrength'), curl = read('fluid.curlScale'), ring = handlePosition(binding('fluid.vortexRadius'), RING, read('fluid.vortexRadius')).x - VORTEX.x
    const gx = read('fluid.gravityX'), gy = read('fluid.gravityY'), gz = read('fluid.gravityZ')
    const mu = Math.max(0, read('fluid.viscosity')), drag = Math.max(0, read('fluid.quadraticDrag'))
    const speedBinding = binding('fluid.maxSpeed')
    const limit = Math.max(10, read('fluid.maxSpeed') * speedBinding.factor)   // native units; the shader clamps at max(10, uMaxSpeed) (simulationShaders.ts:1219-1220)

    // Vortex field. Tangential swirl with the shader's gaussian falloff (simulationShaders.ts:588-593): strength x 160 x exp(-r^2 / 2R^2), R = ring radius.
    // Strength is normalised by its soft maximum. Sample density rises with the curl scale (schematic sampling, not the noise itself).
    const sides = 3 + Math.round(3 * fraction(binding('fluid.curlScale'), curl))
    const cell = 96 / sides, reach = Math.max(ring, 1.5), signed = clamp(strength / binding('fluid.vortexStrength').max, -1, 1)
    const fieldArrows: string[] = []
    for (let i = 0; i < sides; i++) for (let j = 0; j < sides; j++) {
      const x = VORTEX.x - 48 + (i + .5) * cell, y = VORTEX.y - 48 + (j + .5) * cell
      const dx = x - VORTEX.x, dy = y - VORTEX.y, r = Math.hypot(dx, dy)
      const length = signed * cell * .42 * Math.exp(-(r * r) / (2 * reach * reach))
      if (r === 0 || Math.abs(length) < .3) continue
      // Screen tangent of the shader's (-y, x) swirl with +Y up: (dy, -dx) / r.
      const tx = dy / r, ty = -dx / r
      fieldArrows.push(arrow(x - tx * length / 2, y - ty * length / 2, x + tx * length / 2, y + ty * length / 2))
    }
    // Gravity: accel += gravity x 120 per step (simulationShaders.ts:1194). The arrow tip is the handle projections, so arrow and handles agree.
    const tipX = handlePosition(binding('fluid.gravityX'), GRAVITY_X, gx).x, tipY = handlePosition(binding('fluid.gravityY'), GRAVITY_Y, gy).y
    const gravityMoves = Math.hypot(tipX - GRAVITY.x, tipY - GRAVITY.y) > .5
    // Speed decay per simulation step: vel = (vel + accel dt) * viscosity (simulationShaders.ts:1208); quadratic drag at dt x 60 = 1 (1212-1213);
    // clamp at the speed limit (1219-1222). Starts at the limit, the largest speed the clamp admits.
    const decay: string[] = []
    let speed = limit, halfAt: number | null = null
    for (let n = 0; n <= DECAY.steps; n++) {
      if (n > 0) {
        speed *= mu
        if (drag > 0 && speed > .001) speed *= Math.max(0, 1 - drag * .00005 * speed)
        speed = Math.min(Math.max(0, speed), limit)
      }
      const fractionOfLimit = speed / limit
      if (halfAt === null && fractionOfLimit <= .5) halfAt = n
      decay.push(`${(DECAY.x0 + n / DECAY.steps * (DECAY.x1 - DECAY.x0)).toFixed(2)},${(DECAY.y1 - fractionOfLimit * (DECAY.y1 - DECAY.y0)).toFixed(2)}`)
    }
    const curlCell = curl > 0 ? short(1 / (.0035 * curl)) : '—'   // curlNoise(pos.xy x curlScale x 0.0035) (simulationShaders.ts:572): one noise cell in px

    return <>
      <text x="8" y="12" className="native-graph-label">Vortex field</text>
      <circle cx={VORTEX.x} cy={VORTEX.y} r={ring} className="native-force-ring ring-1" />
      {fieldArrows.map((d, index) => <path key={index} d={d} className="native-force-vector" />)}
      <circle cx={VORTEX.x} cy={VORTEX.y} r={1.5} className="native-other-centre" />
      <text x="8" y="134" className="native-graph-label">curl cell {curlCell} px</text>

      <text x="128" y="12" className="native-graph-label">Gravity</text>
      <rect x={GRAVITY.x - GRAVITY.half} y={GRAVITY.y - GRAVITY.half} width={2 * GRAVITY.half} height={2 * GRAVITY.half} className="native-medium-boundary" />
      <path d={`M${GRAVITY.x - GRAVITY.half} ${GRAVITY.y}H${GRAVITY.x + GRAVITY.half}M${GRAVITY.x} ${GRAVITY.y - GRAVITY.half}V${GRAVITY.y + GRAVITY.half}`} className="native-axis" />
      {gravityMoves
        ? <path d={arrow(GRAVITY.x, GRAVITY.y, tipX, tipY)} className="native-response-line" />
        : <circle cx={GRAVITY.x} cy={GRAVITY.y} r={2} className="native-other-centre" />}
      <text x="128" y="134" className="native-graph-label">Z {short(gz)} · not drawn</text>

      <text x="262" y="12" className="native-graph-label">Speed decay</text>
      <rect x={DECAY.x0} y={DECAY.y0} width={DECAY.x1 - DECAY.x0} height={DECAY.y1 - DECAY.y0} className="native-medium-boundary" />
      <path d={`M${DECAY.x0} ${DECAY.y0}H${DECAY.x1}`} className="native-radius-line" />
      <text x={DECAY.x1} y="19" textAnchor="end" className="native-graph-label">limit</text>
      <polyline points={decay.join(' ')} className="native-response-line" />
      <text x="262" y="134" className="native-graph-label">{halfAt === null ? `half speed beyond ${DECAY.steps} steps` : `half speed at ${halfAt} steps`}</text>

      <NativeFieldHandle reading={reading} path="fluid.vortexRadius" family={family} geometry={RING} disabled={disabled} apply={apply} captureCurrent={captureCurrent} onDraft={setDraft} shape="ring" />
      <NativeFieldHandle reading={reading} path="fluid.gravityX" family={family} geometry={GRAVITY_X} disabled={disabled} apply={apply} captureCurrent={captureCurrent} onDraft={setDraft} shape="bar" />
      <NativeFieldHandle reading={reading} path="fluid.gravityY" family={family} geometry={GRAVITY_Y} disabled={disabled} apply={apply} captureCurrent={captureCurrent} onDraft={setDraft} shape="bar" />
      <NativeFieldHandle reading={reading} path="fluid.timeScale" family={family} geometry={TIME} disabled={disabled} apply={apply} captureCurrent={captureCurrent} onDraft={setDraft} shape="bar" />
    </>
  },
  // Shared Medium's plane select writes the same field-setting; this device owns the panel's copy. Disperse, reset phases, recover and reset are buttons over the engine command; pause has no control yet, so it stays text.
  switches: ({reading, disabled, apply}: FieldFaceSwitchContext): ReactNode => {
    const paused = reading.observation?.fieldPaused
    return <div className="native-physics-switches">
      <label><span>Physical medium plane</span><select aria-label="Physical medium plane" value={reading.scene.engine.mediumPlane} disabled={disabled}
        onChange={event => apply([{kind: 'field-setting', key: 'mediumPlane', value: event.target.value as 'vertical' | 'horizontal'}])}>
        <option value="vertical">XY · vertical</option><option value="horizontal">XZ · horizontal</option></select></label>
      <p className="native-physics-note">Orients the medium force and the resonator. Independent of the camera and the working plane.</p>
      <ul className="native-physics-unavailable" aria-label="Runtime actions">
        <li>Pause physics{paused === undefined ? '' : paused ? ' · held now' : ' · running now'}: runtime action, not an authored setting</li>
      </ul>
      <NativeEngineActions disabled={disabled} />
    </div>
  },
}
