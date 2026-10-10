import type {ReactElement} from 'react'
import {NATIVE_BINDINGS} from '@epilogos/expressions-boundary/parameters'
import {NativeFieldHandle} from './NativeFieldHandle.tsx'
import {fraction, type HandleGeometry} from './nativeFieldHandleModel.ts'
import type {FieldFaceDrawContext, FieldFaceView} from './nativeFieldFaceViews.tsx'
import {short} from './nativeFieldFaceValues.ts'
import './NativeFieldFace.pointer.css'

/** The four parameters that have an in-diagram handle. The bottom slider (controlPath) must not be one of them. */
export const POINTER_HANDLE_PATHS = ['interaction.radius', 'interaction.strength', 'interaction.clickRadius', 'interaction.falloffPower'] as const

// Diagram geometry in the 360x160 viewBox. The disc and the click ring are drawn on a 52 px scale of each value's soft-range
// fraction, so the drawing is a configuration diagram and not a stage measure; the Stage shows the physical result.
const CENTRE = {x: 80, y: 80}
const SCALE = 52
const RADIUS_AXIS: HandleGeometry = {origin: CENTRE, dir: {x: 1, y: 0}, length: SCALE}
const CLICK_AXIS: HandleGeometry = {origin: CENTRE, dir: {x: 0, y: -1}, length: SCALE}
const FALLOFF_RAIL: HandleGeometry = {origin: {x: 170, y: 120}, dir: {x: 1, y: 0}, length: 90}
const STRENGTH_AXIS: HandleGeometry = {origin: {x: 300, y: 124}, dir: {x: 0, y: -1}, length: 88}
const CURVE = {x: 170, width: 90, base: 104, height: 68}

const row = (path: string) => NATIVE_BINDINGS.find(item => item.path === path)
const fractionAt = (path: string, value: number) => {const item = row(path); return item ? fraction(item, value) : 0}
const readAt = (ctx: FieldFaceDrawContext, path: string) => ctx.value(path) ?? row(path)?.defaultValue ?? 0

/** A head-tipped arrow centred on (x, y) along the unit direction (dx, dy). */
function arrowPath(x: number, y: number, dx: number, dy: number, length: number): string {
  const sx = x - dx * length / 2, sy = y - dy * length / 2, tx = x + dx * length / 2, ty = y + dy * length / 2
  const bx = tx - dx * Math.min(3, length * 0.45), by = ty - dy * Math.min(3, length * 0.45), wing = 2
  return `M${sx.toFixed(2)} ${sy.toFixed(2)}L${tx.toFixed(2)} ${ty.toFixed(2)}M${(bx - dy * wing).toFixed(2)} ${(by + dx * wing).toFixed(2)}L${tx.toFixed(2)} ${ty.toFixed(2)}L${(bx + dy * wing).toFixed(2)} ${(by - dx * wing).toFixed(2)}`
}

/** Force arrows across the disc. Engine: attract adds -radial and repel adds +radial scaled by strength x falloff, and vortex adds the
 * tangent (simulationShaders.ts:718-732, pointer force block). Falloff is pow(1 - d, falloffPower) at normalised distance d
 * (simulationShaders.ts:716). A negative strength reverses each direction. Arrow length is the amplitude times that falloff. */
function forceArrows(mode: string, strength: number, radiusPx: number, exponent: number, strengthMax: number): ReactElement[] {
  const sign = Math.sign(strength), amplitude = Math.min(1, Math.abs(strength) / strengthMax), arrows: ReactElement[] = []
  if (sign === 0 || amplitude <= 0 || radiusPx < 4) return arrows
  for (const d of [0.35, 0.7]) for (let k = 0; k < 8; k++) {
    const angle = k * Math.PI / 4, ux = Math.cos(angle), uy = Math.sin(angle)
    const length = 14 * amplitude * (1 - d) ** exponent
    if (length < 0.6) continue
    const [dx, dy] = mode === 'vortex' ? [-uy * sign, ux * sign] : mode === 'attract' ? [-ux * sign, -uy * sign] : [ux * sign, uy * sign]
    arrows.push(<path key={`${d}-${k}`} d={arrowPath(CENTRE.x + radiusPx * d * ux, CENTRE.y + radiusPx * d * uy, dx, dy, length)}
      className={`native-pointer-arrow ${sign > 0 ? 'is-positive' : 'is-negative'}`} />)
  }
  return arrows
}

/** Pointer: one influence disc with force arrows, a dashed click ring, a falloff curve and a signed strength axis.
 * Every drawn value is read from ctx.value (live drafts while a handle moves). Four handles, one distinct parameter each. */
export const pointerFaceView: FieldFaceView = {
  draw: ctx => {
    const {reading, family, disabled, apply, captureCurrent, setDraft} = ctx
    const radius = readAt(ctx, 'interaction.radius'), strength = readAt(ctx, 'interaction.strength')
    const clickRadius = readAt(ctx, 'interaction.clickRadius'), clickStrength = readAt(ctx, 'interaction.clickStrength')
    const exponent = readAt(ctx, 'interaction.falloffPower')
    const mode = reading.scene.engine.pointerMode, clickMode = reading.scene.engine.pointerClick ?? 'pulse'
    const radiusPx = SCALE * fractionAt('interaction.radius', radius), clickPx = SCALE * fractionAt('interaction.clickRadius', clickRadius)
    const strengthFraction = fractionAt('interaction.strength', strength), strengthMax = row('interaction.strength')?.max ?? 1
    // Falloff curve: relative weight at normalised distance d, the engine's pow(1 - d, falloffPower).
    const curve = Array.from({length: 21}, (_, index) => {const d = index / 20; return `${index ? 'L' : 'M'}${(CURVE.x + CURVE.width * d).toFixed(2)} ${(CURVE.base - CURVE.height * (1 - d) ** exponent).toFixed(2)}`}).join('')
    const labelPoint = (clickPx + 3) * Math.SQRT1_2
    return <>
      <path d="M28 80H132M80 28V132" className="native-axis" />
      <circle cx={CENTRE.x} cy={CENTRE.y} r={radiusPx} className="native-medium-boundary" />
      {forceArrows(mode, strength, radiusPx, exponent, strengthMax)}
      <circle cx={CENTRE.x} cy={CENTRE.y} r={clickPx} className={`native-pointer-click-ring${clickMode === 'off' ? ' is-off' : ''}`} strokeWidth={0.8 + 2.2 * fractionAt('interaction.clickStrength', clickStrength)} />
      <text x={CENTRE.x + labelPoint} y={CENTRE.y - labelPoint} className="native-graph-label">click · {clickMode}</text>
      <text x="10" y="12" className="native-graph-label">{mode} · click {clickMode}</text>
      <path d={`M${CURVE.x} ${CURVE.base}H${CURVE.x + CURVE.width}M${CURVE.x} ${CURVE.base - CURVE.height}V${CURVE.base}`} className="native-axis" />
      <path d={curve} className="native-response-line" />
      <path d="M170 120H260" className="native-axis" />
      <text x={CURVE.x} y="28" className="native-graph-label">Falloff p {short(exponent)}</text>
      <path d="M280 80H320M300 36V124" className="native-axis" />
      <path d={`M300 80V${(124 - 88 * strengthFraction).toFixed(2)}`} className="native-response-line" />
      <text x="272" y="28" className="native-graph-label">Force {short(strength)}</text>
      <text x="10" y="154" className="native-graph-label">Disc r {short(radius)} · click r {short(clickRadius)} · {row('interaction.radius')?.unit ?? ''}</text>
      <NativeFieldHandle reading={reading} path="interaction.radius" family={family} geometry={RADIUS_AXIS} disabled={disabled} apply={apply} captureCurrent={captureCurrent} onDraft={setDraft} />
      <NativeFieldHandle reading={reading} path="interaction.clickRadius" family={family} geometry={CLICK_AXIS} disabled={disabled} apply={apply} captureCurrent={captureCurrent} onDraft={setDraft} shape="ring" />
      <NativeFieldHandle reading={reading} path="interaction.falloffPower" family={family} geometry={FALLOFF_RAIL} disabled={disabled} apply={apply} captureCurrent={captureCurrent} onDraft={setDraft} />
      <NativeFieldHandle reading={reading} path="interaction.strength" family={family} geometry={STRENGTH_AXIS} disabled={disabled} apply={apply} captureCurrent={captureCurrent} onDraft={setDraft} shape="bar" />
    </>
  },
  // Pointer has no enable operation, so there is no activator switch. The three non-numeric controls of the app panel are here,
  // written through admitted panel-setting changes with the exact option lists of nativeFieldPanelSettings.ts.
  switches: ({reading, disabled, apply}) => <div className="native-pointer-switches">
    <div className="native-medium-switches">
      <select aria-label="Pointer scope" value={reading.scene.pointerScope === 'local' ? 'local' : 'global'} disabled={disabled} onChange={event => apply([{kind: 'panel-setting', key: 'pointerScope', value: event.target.value as 'global' | 'local'}])}>
        <option value="global">Expression override · global</option><option value="local">Local to this scene</option>
      </select>
      <select aria-label="Temporary pointer force" value={reading.scene.engine.pointerMode} disabled={disabled} onChange={event => apply([{kind: 'panel-setting', key: 'pointerMode', value: event.target.value as 'attract' | 'repel' | 'vortex'}])}>
        <option value="attract">Attract</option><option value="repel">Repel</option><option value="vortex">Vortex</option>
      </select>
      <select aria-label="Click effect" value={reading.scene.engine.pointerClick ?? 'pulse'} disabled={disabled} onChange={event => apply([{kind: 'panel-setting', key: 'pointerClick', value: event.target.value as 'pulse' | 'implode' | 'vortex' | 'shove' | 'off'}])}>
        <option value="pulse">Pulse · shockwave outward</option><option value="implode">Implode · gather inward</option><option value="vortex">Vortex · whirl around the click</option><option value="shove">Shove · random burst</option><option value="off">Off · clicks stay quiet</option>
      </select>
    </div>
    <p className="native-pointer-note">{reading.scene.pointerScope === 'local' ? 'Local: this scene keeps its own pointer values.' : 'Global: pointer values are shared across this Expression’s scenes.'}</p>
  </div>,
}
