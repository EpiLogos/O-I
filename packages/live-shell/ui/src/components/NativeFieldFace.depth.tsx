import {useRef, useState} from 'react'
import type {NativeEditorReading} from '../../../../expressions-boundary/src/editor'
import {FIELD_PANEL_SETTINGS} from '../../../../expressions-boundary/src/nativeFieldPanelSettings'
import {NATIVE_BINDINGS, baseValue} from '@epilogos/expressions-boundary/parameters'
import type {FieldFaceDrawContext, FieldFaceSwitchContext, FieldFaceView} from './nativeFieldFaceViews.tsx'
import {NativeFieldHandle} from './NativeFieldHandle.tsx'
import {fraction, handlePosition, type HandleGeometry} from './nativeFieldHandleModel.ts'
import {aerialDepth, depthGeometryOn, depthProfileShape, inkAlpha, sizeMultiplier, tintShare} from './nativeFieldFace.depth.ts'
import {short} from './nativeFieldFaceValues.ts'
import './NativeFieldFace.depth.css'

/** The diagram is a configuration sketch on its own schematic scale. Field of View angles are true; distance and body
 * thickness are placed on each parameter's own soft range, so no length here is a physical measurement. */
const FRAME = {x: 4, y: 2, w: 170, h: 132}
const AXIS_Y = 72
const EYE = {x: 14, y: AXIS_Y}
const FOV_TRACK: HandleGeometry = {origin: {x: 20, y: 16}, dir: {x: 1, y: 0}, length: 140}
const DISTANCE_AXIS: HandleGeometry = {origin: {x: 40, y: AXIS_Y}, dir: {x: 1, y: 0}, length: 120}
const BODY_TRACK: HandleGeometry = {origin: {x: 20, y: 112}, dir: {x: 1, y: 0}, length: 140}
const CURVE_TRACK: HandleGeometry = {origin: {x: 200, y: 60}, dir: {x: 1, y: 0}, length: 138}
const REACH_TRACK: HandleGeometry = {origin: {x: 200, y: 112}, dir: {x: 1, y: 0}, length: 138}
const SIZE_BOX = {x: 190, y: 14, w: 158, h: 30}
const ALPHA_BOX = {x: 190, y: 70, w: 158, h: 26}
const TINT_BAR = {x: 190, y: 126, w: 158, h: 5}
/** One stroke, cut across: vertical axis across the stroke (contour at the ends, centreline at 0). */
const STROKE_W = 44, BODY_HALF = 22, SPRAY_MAX = 12
const X_MIN = 0.25, X_MAX = 2, S_MAX = 2.5, SAMPLES = 40
const PROFILE_OPTIONS = [['slab', 'Slab · constant thickness'], ['bevel', 'Bevel · chamfered from the contour'], ['round', 'Round · pillow, steep shoulders'], ['dome', 'Dome · convex bulge'], ['taper', 'Taper · knife-edge sliver']] as const

type Shape = 'dot' | 'bar' | 'ring'
const binding = (path: string) => NATIVE_BINDINGS.find(row => row.path === path)
const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value))
const shareOf = (path: string, value: number) => {const found = binding(path); return found ? fraction(found, value) : 0}
const readingValue = (reading: NativeEditorReading, path: string) => {const found = binding(path); return found ? baseValue(reading.scene, found.key) : 0}
const xPlot = (x: number, box: {x: number; w: number}) => box.x + (x - X_MIN) / (X_MAX - X_MIN) * box.w
const yPlotSize = (size: number) => SIZE_BOX.y + SIZE_BOX.h - clamp(size, 0, S_MAX) / S_MAX * SIZE_BOX.h
const yPlotAlpha = (alpha: number) => ALPHA_BOX.y + ALPHA_BOX.h - clamp(alpha, 0, 1) * ALPHA_BOX.h
const polyline = (points: readonly {x: number; y: number}[]) => points.map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join('')
const sampleXs = Array.from({length: SAMPLES + 1}, (_, index) => X_MIN + (X_MAX - X_MIN) * index / SAMPLES)

/** Half-thickness of the body at stroke offset u: BODY_HALF x depth share x profile(t), t = 1 at the centreline, 0 at the contour (glyphVolume.ts:205-219). Ink density is drawn at mid (x1). */
function halfAt(u: number, profile: string, depthShare: number): number {
  const t = 1 - 2 * Math.abs(u) / STROKE_W
  return BODY_HALF * depthShare * depthProfileShape(profile, t)
}
/** Closed outline of the section for stroke offsets u0..u1, from x = cx - half(u) to cx + half(u). */
function sectionPath(cx: number, half: (u: number) => number, u0: number, u1: number): string {
  const steps = 24, right: string[] = [], left: string[] = []
  for (let i = 0; i <= steps; i++) {
    const u = u0 + (u1 - u0) * i / steps, y = (AXIS_Y + u).toFixed(2)
    right.push(`${(cx + half(u)).toFixed(2)},${y}`)
    left.push(`${(cx - half(u)).toFixed(2)},${y}`)
  }
  return `M${right.join('L')}L${left.reverse().join('L')}Z`
}
function handleFor(ctx: FieldFaceDrawContext, path: string, geometry: HandleGeometry, shape: Shape) {
  return <NativeFieldHandle key={path} reading={ctx.reading} path={path} family={ctx.family} geometry={geometry} disabled={ctx.disabled} apply={ctx.apply} captureCurrent={ctx.captureCurrent} onDraft={ctx.setDraft} shape={shape} />
}

/** The two engine depth shares (EngineSettings.vortex3d, dispersion3d; model.ts:44). Labels and range are the inspector's own
 * range() calls (inspector.ts:123). Coupling, found in the engine (GPGPUSimulator.ts:925-951): glyphVolume.enabled with
 * glyphVolume.depth above 0 sets depthGeometry = 1. That one flag gates the 3D pairwise contacts (uPairwise3D, :933), the
 * depth geometry of the velocity pass (uDepthGeometry, :945), and the swirl and bridge defaults
 * (uVortex3d = vortex3d ?? depthGeometry, :950; uDispersion3d = dispersion3d ?? depthGeometry, :951). An explicit share
 * overrides the default, but the shader still gates it on depthGeometry, so with the body off the sliders have no visible
 * effect. The Scene leaves an absent share absent (nativeBridge.ts:101-104), so the control shows the derived value. */
type DepthShareKey = 'vortex3d' | 'dispersion3d'
const DEPTH_SHARES: readonly {key: DepthShareKey; label: string}[] = [{key: 'vortex3d', label: 'Depth in the swirl'}, {key: 'dispersion3d', label: 'Depth in the bridge'}]
const RELEASE_KEYS = ['Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown']

/** One exact panel-setting write for a depth share. Resolves to the refusal text, or null when the boundary accepted it. */
export async function commitDepthShare(apply: FieldFaceSwitchContext['apply'], key: DepthShareKey, value: number): Promise<string | null> {
  const reply: unknown = await apply([{kind: 'panel-setting', key, value}])
  if (reply && typeof reply === 'object' && (reply as {ok?: unknown}).ok === true) return null
  const error = reply && typeof reply === 'object' ? (reply as {error?: unknown}).error : undefined
  return typeof error === 'string' && error ? error : 'The Field did not accept this depth share.'
}

function DepthShareControl({settingKey, label, value, engaged, disabled, apply}: {settingKey: DepthShareKey; label: string; value: number | undefined; engaged: boolean; disabled: boolean; apply: FieldFaceSwitchContext['apply']}) {
  const spec = FIELD_PANEL_SETTINGS[settingKey]
  const authored = typeof value === 'number' && Number.isFinite(value)
  const derived = engaged ? 1 : 0
  const [draft, setDraftState] = useState<number | null>(null)
  const [error, setError] = useState('')
  // The ref carries the live drag value into release handlers; state only drives the thumb.
  const draftRef = useRef<number | null>(null), pendingRef = useRef(false)
  const setDraft = (next: number | null) => { draftRef.current = next; setDraftState(next) }
  const release = () => {
    const next = draftRef.current
    if (next === null || pendingRef.current || disabled) return
    pendingRef.current = true
    setError('')
    void commitDepthShare(apply, settingKey, next).then(message => { pendingRef.current = false; setDraft(null); setError(message ?? '') })
  }
  const shown = draft ?? (authored ? value : derived)
  return <div className="native-depth-share">
    <span className="native-depth-share-label">{label}</span>
    <input type="range" aria-label={label} min={spec.min} max={spec.max} step={spec.step} value={shown} disabled={disabled}
      onChange={event => setDraft(Number(event.currentTarget.value))}
      onPointerUp={release}
      onKeyUp={event => { if (RELEASE_KEYS.includes(event.key)) release() }}
      onKeyDown={event => { if (event.key === 'Escape') setDraft(null) }} />
    <output aria-label={`${label} value`}>{short(shown)}</output>
    <p className="native-depth-readout">{authored ? `${settingKey} authored at ${short(value)}` : `${settingKey} derived from body law (${engaged ? 'engaged' : 'planar'})`} · engine field EngineSettings.{settingKey} (model.ts:44)</p>
    {error && <p className="native-error" role="alert">{error}</p>}
  </div>
}

/** 3D body & depth. Left: a perspective frustum with the body section at the target plane. Right: size and ink-alpha curves and the tint bar. */
export const depthFaceView: FieldFaceView = {
  draw: ctx => {
    const v = (path: string) => ctx.value(path) ?? 0
    const engine = ctx.reading.scene.engine
    const persp = engine.depthPerspective === true
    const volumeOn = engine.volumeEnabled === true
    const profile = engine.volumeProfile ?? 'round'
    const distance = Math.max(1, v('depth.distance'))
    const fov = clamp(v('depth.fov'), 4, 120)
    const tanHalf = Math.tan(fov * Math.PI / 360)
    const bodyDepth = v('glyphVolume.depth'), depthShare = shareOf('glyphVolume.depth', bodyDepth)
    const reach = Math.max(0.1, v('depth.aerialRange')), fade = clamp(v('depth.aerialFade'), 0, 1)
    const bias = clamp(v('depth.sizeDepthBias'), -1, 1), tint = clamp(v('depth.depthTintWeight'), 0, 1)
    const curve = Math.max(0.01, v('depth.sizeAttenuationCurve')), attenuation = Math.max(0, v('depth.sizeAttenuation'))
    // The shader applies the 1/w exponent only in perspective (particleShaders.ts:357). Orthographic keeps exponent 0.
    const exponent = persp ? attenuation * curve : 0
    const wallShare = clamp(v('glyphVolume.wallShare'), 0, 1), faceBias = clamp(v('glyphVolume.faceBias'), 0, 1), interiorFill = clamp(v('glyphVolume.interiorFill'), 0, 1)
    const sheet = BODY_HALF * shareOf('glyphVolume.surfaceThickness', v('glyphVolume.surfaceThickness'))
    const band = Math.max(1.5, shareOf('glyphVolume.wallBand', v('glyphVolume.wallBand')) * STROKE_W / 2)
    const spray = SPRAY_MAX * clamp(v('glyphVolume.outsideTaper'), 0, 3) / 3

    const distanceBinding = binding('depth.distance')
    const targetX = distanceBinding ? handlePosition(distanceBinding, DISTANCE_AXIS, distance).x : DISTANCE_AXIS.origin.x
    const farX = FRAME.x + FRAME.w
    const upperY = AXIS_Y - tanHalf * (farX - EYE.x), lowerY = AXIS_Y + tanHalf * (farX - EYE.x)
    const bodyOn = volumeOn && bodyDepth > 0
    const half = (u: number) => halfAt(u, profile, depthShare)
    const inner = (u: number) => Math.max(0, half(u) - sheet)
    const innerHalf = (u: number) => half(u) * interiorFill
    const top = -STROKE_W / 2, bottom = STROKE_W / 2
    const sizePoints = sampleXs.map(x => ({x: xPlot(x, SIZE_BOX), y: yPlotSize(sizeMultiplier(x, exponent, bias, reach))}))
    const alphaPoints = sampleXs.map(x => ({x: xPlot(x, ALPHA_BOX), y: yPlotAlpha(inkAlpha(aerialDepth(x, reach), fade))}))

    return <>
      <defs>
        <clipPath id="native-depth-frame-clip"><rect x={FRAME.x} y={FRAME.y} width={FRAME.w} height={FRAME.h} /></clipPath>
        <clipPath id="native-depth-size-clip"><rect x={SIZE_BOX.x} y={SIZE_BOX.y} width={SIZE_BOX.w} height={SIZE_BOX.h} /></clipPath>
        <clipPath id="native-depth-alpha-clip"><rect x={ALPHA_BOX.x} y={ALPHA_BOX.y} width={ALPHA_BOX.w} height={ALPHA_BOX.h} /></clipPath>
      </defs>
      <rect x={FRAME.x} y={FRAME.y} width={FRAME.w} height={FRAME.h} className="native-depth-frame" />
      <g clipPath="url(#native-depth-frame-clip)">
        {/* Edges at the true Field of View angle from the eye; dashed when the perspective camera is not the one in use. */}
        <path d={`M${EYE.x} ${EYE.y}L${farX} ${upperY.toFixed(2)}M${EYE.x} ${EYE.y}L${farX} ${lowerY.toFixed(2)}`} className={persp ? 'native-depth-frustum' : 'native-depth-frustum native-depth-dashed'} />
        <path d={`M${EYE.x} ${AXIS_Y}H${farX}`} className="native-axis native-depth-dashed" />
        <path d={`M${targetX.toFixed(2)} 6V128`} className="native-axis native-depth-dashed" />
        <g className={bodyOn ? undefined : 'native-depth-gated'}>
          {/* Faces: the outer band of thickness surfaceThickness, filled at faceBias. Flanks: the contour band, filled at wallShare. */}
          <path d={`${sectionPath(targetX, half, top, bottom)}${sectionPath(targetX, inner, top, bottom)}`} className="native-depth-sheet" fillRule="evenodd" fillOpacity={faceBias} />
          <path d={sectionPath(targetX, innerHalf, top, bottom)} className="native-depth-interior" />
          <path d={`${sectionPath(targetX, half, top, top + band)}${sectionPath(targetX, half, bottom - band, bottom)}`} className="native-depth-flank" fillOpacity={wallShare} />
          <path d={sectionPath(targetX, half, top, bottom)} className="native-depth-body" />
          <path d={`M${targetX - BODY_HALF} ${top - spray}H${targetX + BODY_HALF}M${targetX - BODY_HALF} ${bottom + spray}H${targetX + BODY_HALF}`} className="native-depth-spray" style={{opacity: spray > 0 ? 0.7 : 0}} />
        </g>
      </g>
      <text x={8} y={9} className="native-graph-label">Field of view {short(fov)}°</text>
      <text x={8} y={40} className="native-graph-label">Distance {Math.round(distance)} px</text>
      <text x={8} y={104} className="native-graph-label">Body depth {short(bodyDepth)} px</text>
      <text x={8} y={126} className="native-graph-label">{!volumeOn ? '3D body off · flat card' : bodyDepth > 0 ? `${profile} profile` : 'Depth 0 · flat card'}</text>
      {!persp && <text x={168} y={126} textAnchor="end" className="native-graph-label">Ortho · FOV off</text>}
      {handleFor(ctx, 'depth.fov', FOV_TRACK, 'bar')}
      {handleFor(ctx, 'depth.distance', DISTANCE_AXIS, 'ring')}
      {handleFor(ctx, 'glyphVolume.depth', BODY_TRACK, 'bar')}

      <rect x={SIZE_BOX.x} y={SIZE_BOX.y} width={SIZE_BOX.w} height={SIZE_BOX.h} className="native-depth-frame" />
      <text x={SIZE_BOX.x} y={10} className="native-graph-label">Size × by view depth ÷ orbit</text>
      <g clipPath="url(#native-depth-size-clip)" className={persp ? undefined : 'native-depth-gated'}>
        <path d={`M${xPlot(1, SIZE_BOX).toFixed(2)} ${SIZE_BOX.y}V${SIZE_BOX.y + SIZE_BOX.h}`} className="native-axis native-depth-dashed" />
        <path d={polyline(sizePoints)} className="native-depth-curve" />
      </g>
      {!persp && <text x={SIZE_BOX.x + SIZE_BOX.w - 2} y={SIZE_BOX.y + 10} textAnchor="end" className="native-graph-label">Perspective off · not applied</text>}
      <text x={SIZE_BOX.x} y={54} className="native-graph-label">Curve {short(curve)} · exponent {short(exponent)}</text>
      {handleFor(ctx, 'depth.sizeAttenuationCurve', CURVE_TRACK, 'bar')}

      <rect x={ALPHA_BOX.x} y={ALPHA_BOX.y} width={ALPHA_BOX.w} height={ALPHA_BOX.h} className="native-depth-frame" />
      <g clipPath="url(#native-depth-alpha-clip)">
        <path d={`M${xPlot(1, ALPHA_BOX).toFixed(2)} ${ALPHA_BOX.y}V${ALPHA_BOX.y + ALPHA_BOX.h}`} className="native-axis native-depth-dashed" />
        <path d={polyline(alphaPoints)} className="native-depth-curve" />
      </g>
      <text x={ALPHA_BOX.x + 3} y={ALPHA_BOX.y + 12} className="native-graph-label">Ink α · fade {short(fade)}</text>
      <text x={REACH_TRACK.origin.x} y={106} className="native-graph-label">Aerial reach {short(reach)} × orbit</text>
      {handleFor(ctx, 'depth.aerialRange', REACH_TRACK, 'bar')}

      <text x={TINT_BAR.x} y={123} className="native-graph-label">Depth tint {short(tint)} · far marks</text>
      <rect x={TINT_BAR.x} y={TINT_BAR.y} width={TINT_BAR.w} height={TINT_BAR.h} className="native-depth-track" />
      <rect x={TINT_BAR.x} y={TINT_BAR.y} width={TINT_BAR.w * tintShare(1, tint)} height={TINT_BAR.h} className="native-depth-tint" />
    </>
  },
  switches: ({reading, disabled, apply}) => {
    const engine = reading.scene.engine
    const volumeOn = engine.volumeEnabled === true
    const perspective = engine.depthPerspective === true
    const occlusion = engine.depthOcclusion === true || (engine.depthOcclusion as unknown) === 'on'
    const profile = engine.volumeProfile ?? 'round'
    const bodyDepth = readingValue(reading, 'glyphVolume.depth')
    const density = clamp(readingValue(reading, 'glyphVolume.densityDepth'), -1, 1)
    const jitter = readingValue(reading, 'glyphVolume.jitter')
    const geometry = depthGeometryOn(volumeOn, bodyDepth)
    return <div className="native-depth-switches">
      <div className="native-medium-switches">
        <label><input type="checkbox" checked={volumeOn} disabled={disabled} onChange={event => apply([{kind: 'panel-setting', key: 'volumeEnabled', value: event.target.checked}])} />True 3D body</label>
        <select aria-label="Depth profile" value={profile} disabled={disabled} onChange={event => apply([{kind: 'panel-setting', key: 'volumeProfile', value: event.target.value as (typeof PROFILE_OPTIONS)[number][0]}])}>
          {PROFILE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>
      <div className="native-medium-switches">
        <label><input type="checkbox" checked={perspective} disabled={disabled} onChange={event => apply([{kind: 'panel-setting', key: 'depthPerspective', value: event.target.checked}])} />Perspective projection</label>
        <label><input type="checkbox" checked={occlusion} disabled={disabled} onChange={event => apply([{kind: 'panel-setting', key: 'depthOcclusion', value: event.target.checked}])} />Surfaces occlude</label>
      </div>
      <p className="native-depth-readout">Depth geometry (derived): {geometry ? 'on' : 'off'} · body on and depth above 0. It sets the swirl and bridge depth defaults and 3D pairwise contacts (GPGPUSimulator.ts:925-951).</p>
      <p className="native-depth-readout">Ink density scales body thickness ×{short(1 - density)} sparse to ×{short(1 + density)} dense · jitter ±{short(jitter)} px (glyphVolume.ts:262-265 and drawVolumeZ).</p>
      {/* Coupling: see the DepthShareKey comment above (GPGPUSimulator.ts:925-951). */}
      {DEPTH_SHARES.map(({key, label}) => <DepthShareControl key={key} settingKey={key} label={label} value={engine[key]} engaged={geometry} disabled={disabled} apply={apply} />)}
    </div>
  },
}
