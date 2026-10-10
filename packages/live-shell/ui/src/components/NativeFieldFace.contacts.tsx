import type {ReactNode} from 'react'
import {NATIVE_BINDINGS, baseValue} from '@epilogos/expressions-boundary/parameters'
import type {NativeEditorReading} from '../../../../expressions-boundary/src/editor'
import type {FieldFaceDrawContext, FieldFaceSwitchContext, FieldFaceView} from './nativeFieldFaceViews.tsx'
import {NativeFieldHandle} from './NativeFieldHandle.tsx'
import {fraction, type HandleGeometry} from './nativeFieldHandleModel.ts'
import {short} from './nativeFieldFaceValues.ts'
import './NativeFieldFace.contacts.css'

type Point = {x: number; y: number}

// Handle tracks: each line spans its parameter's soft range (value at origin = soft minimum). Drawn as faint axes below.
const BAND_TRACK: HandleGeometry = {origin: {x: 20, y: 122}, dir: {x: 1, y: 0}, length: 150}
const GLYPH_BOUNCE_TRACK: HandleGeometry = {origin: {x: 12, y: 110}, dir: {x: 0, y: -1}, length: 80}
const RADIUS_TRACK: HandleGeometry = {origin: {x: 190, y: 122}, dir: {x: 1, y: 0}, length: 140}
const PAIR_BOUNCE_TRACK: HandleGeometry = {origin: {x: 350, y: 100}, dir: {x: 0, y: -1}, length: 70}

// Glyph boundary: a closed letterform stand-in, centre and radii in the left half of the 360x160 viewBox.
const GLYPH = {cx: 92, cy: 68, rx: 40, ry: 26}
// Particle pair: the right half. A is the reference particle, B the one it contacts.
const PAIR_A: Point = {x: 236, y: 68}, PAIR_B: Point = {x: 302, y: 68}

const row = (path: string) => NATIVE_BINDINGS.find(entry => entry.path === path)
/** Share of a native value across its soft range, 0..1. The same mapping the in-diagram handles use. */
const share = (path: string, value: number): number => {const found = row(path); return found ? fraction(found, value) : 0}
/** Native value from the reading, for a derived note outside the draw context. */
const readingValue = (reading: NativeEditorReading, path: string): number | undefined => {const found = row(path); return found ? baseValue(reading.scene, found.key) : undefined}

/** Point on an ellipse rim at a parametric angle. */
const onRim = (rx: number, ry: number, angle: number): Point => ({x: GLYPH.cx + rx * Math.cos(angle), y: GLYPH.cy + ry * Math.sin(angle)})
/** Outward unit normal of an axis-aligned ellipse at a parametric angle. */
const normal = (rx: number, ry: number, angle: number): Point => {const x = Math.cos(angle) / rx, y = Math.sin(angle) / ry, length = Math.hypot(x, y); return {x: x / length, y: y / length}}
/** Closed ellipse as two arcs, for the even-odd annulus of the contact band. */
const ellipsePath = (cx: number, cy: number, rx: number, ry: number) => `M${cx - rx} ${cy}A${rx} ${ry} 0 1 0 ${cx + rx} ${cy}A${rx} ${ry} 0 1 0 ${cx - rx} ${cy}Z`
/** A response arrow: shaft from `from` to `to`, open head. */
const arrow = (from: Point, to: Point) => {
  const dx = to.x - from.x, dy = to.y - from.y, length = Math.hypot(dx, dy) || 1, ux = dx / length, uy = dy / length, head = 3
  const bx = to.x - ux * head, by = to.y - uy * head
  return `M${from.x} ${from.y}L${to.x} ${to.y}M${bx - uy * head * 0.6} ${by + ux * head * 0.6}L${to.x} ${to.y}L${bx + uy * head * 0.6} ${by - ux * head * 0.6}`
}

/** Contacts: source-bound contact diagram. Left: glyph wall, obstacle or vessel, with its contact band, bounce arrows and
 * boundary solidity. Right: particle pair with its contact radius, spring density and response arrows. Each half is dimmed
 * while its own enable is off; the handles stay live because they edit parameters, not the solver state.
 * Sources: glyph wall, engine.collisionEnabled/collisionMode (inspector.ts:136; GPGPUSimulator.ts:1046-1047 uCollisionEnabled);
 * pairwise, engine.pairwiseEnabled (inspector.ts:137; GPGPUSimulator.ts:915-916 pwEnabled, capped by pairwiseSchedule.ts:19-20).
 * The bounce arrow length is the restitution ratio; the boundary gaps show the configured Integrity Weakening response
 * (paramRegistry.ts:160: energetic particles weaken the wall, which heals as they calm). They are not a measured wall state. */
export const contactsFaceView: FieldFaceView = {
  draw: (ctx: FieldFaceDrawContext): ReactNode => {
    const {reading, value} = ctx, engine = reading.scene.engine
    const glyphOn = engine.collisionEnabled === true, pairOn = engine.pairwiseEnabled === true
    const vessel = engine.collisionMode === 'vessel'
    const band = value('collision.band') ?? 0, glyphRestitution = value('collision.restitution') ?? 0, integrity = value('collision.integrity') ?? 0
    const radius = value('pairwise.radius') ?? 0, stiffness = value('pairwise.stiffness') ?? 0, pairRestitution = value('pairwise.restitution') ?? 0
    const viscosity = value('pairwise.viscosity') ?? 0, extent = value('pairwise.extent') ?? 0

    // Glyph wall. The contact band is the annulus between the rim and an offset rim: outside for obstacle, inside for vessel.
    const bandWidth = 1 + 13 * share('collision.band', band)
    const bandPath = vessel
      ? ellipsePath(GLYPH.cx, GLYPH.cy, GLYPH.rx, GLYPH.ry) + ellipsePath(GLYPH.cx, GLYPH.cy, GLYPH.rx - bandWidth, GLYPH.ry - bandWidth)
      : ellipsePath(GLYPH.cx, GLYPH.cy, GLYPH.rx + bandWidth, GLYPH.ry + bandWidth) + ellipsePath(GLYPH.cx, GLYPH.cy, GLYPH.rx, GLYPH.ry)
    // Integrity: the dash gaps grow with the weakening share (pathLength 100 keeps the dash units in percent of the rim).
    const weakening = 30 * share('collision.integrity', integrity)
    const bounceLength = 6 + 22 * Math.min(1, Math.max(0, glyphRestitution))
    // Three contact points on the rim. Obstacle: particles outside, bouncing outward. Vessel: particles inside, bouncing inward.
    const sign = vessel ? -1 : 1
    const contacts = [-2.2, -0.9, 0.5].map(angle => {
      const rim = onRim(GLYPH.rx, GLYPH.ry, angle), n = normal(GLYPH.rx, GLYPH.ry, angle)
      const tip = {x: rim.x + sign * n.x * bounceLength, y: rim.y + sign * n.y * bounceLength}
      return {rim, tip, angle}
    })

    // Particle pair. Contact radius is a dashed circle around A; spring density is the coil count; response arrows are restitution (along the
    // normal, from B) and viscosity (tangential, from B). The coil count is a configuration reading, not a simulated spring.
    const contactRadius = 6 + 34 * share('pairwise.radius', radius)
    const coils = 3 + Math.round(9 * share('pairwise.stiffness', stiffness))
    const springStart = PAIR_A.x + 4, springEnd = PAIR_B.x - 4, segments = coils * 2
    let spring = `M${springStart} ${PAIR_A.y}`
    for (let i = 1; i <= segments; i += 1) {
      const x = springStart + (springEnd - springStart) * i / segments
      const y = i === segments ? PAIR_A.y : PAIR_A.y + (i % 2 ? -5 : 5)
      spring += `L${x} ${y}`
    }
    const normalArrow = arrow({x: PAIR_B.x + 5, y: PAIR_B.y}, {x: PAIR_B.x + 5 + 6 + 20 * Math.min(1, Math.max(0, pairRestitution)), y: PAIR_B.y})
    const tangentArrow = arrow({x: PAIR_B.x, y: PAIR_B.y + 6}, {x: PAIR_B.x, y: PAIR_B.y + 6 + 4 + 14 * Math.min(1, Math.max(0, viscosity))})

    return <>
      {/* Handle tracks: the soft range of each handle, drawn as faint axes. */}
      <path d="M20 122H170M12 110V30M190 122H330M350 100V30" className="native-axis" />
      <path d="M180 14V118" className="native-axis" />

      <text x="8" y="12" className="native-graph-label">{glyphOn ? `Glyph walls · ${vessel ? 'vessel' : 'obstacle'} · ellipse, not a glyph` : 'Glyph walls off · boundary not solved'}</text>
      <g opacity={glyphOn ? 1 : 0.32}>
        <path d={bandPath} fillRule="evenodd" fill="var(--accent,#bdc060)" fillOpacity={0.16} />
        <ellipse className="native-medium-boundary" cx={GLYPH.cx} cy={GLYPH.cy} rx={GLYPH.rx} ry={GLYPH.ry} pathLength={100}
          strokeDasharray={weakening > 0.5 ? `${100 - weakening} ${weakening}` : undefined} />
        {contacts.map(({rim, tip, angle}) => <g key={angle}>
          <path d={arrow(rim, tip)} className="native-response-line" />
          <circle cx={tip.x} cy={tip.y} r={2.2} fill="var(--text,#e5e5e5)" />
        </g>)}
      </g>

      <text x="188" y="12" className="native-graph-label">{pairOn ? 'Particle pairs · contact radius' : 'Particle pairs off · not solved'}</text>
      <g opacity={pairOn ? 1 : 0.32}>
        <circle cx={PAIR_A.x} cy={PAIR_A.y} r={contactRadius} className="native-medium-boundary" strokeDasharray="2 3" />
        <path d={spring} className="native-response-line" />
        <path d={normalArrow} className="native-response-line" />
        <path d={tangentArrow} className="native-response-line" />
        <circle cx={PAIR_A.x} cy={PAIR_A.y} r={4} fill="var(--text,#e5e5e5)" />
        <circle cx={PAIR_B.x} cy={PAIR_B.y} r={4} fill="var(--text,#e5e5e5)" />
      </g>

      <text x="8" y="156" className="native-graph-label">band {short(band)} px · bounce {short(glyphRestitution)}</text>
      <text x="188" y="156" className="native-graph-label">radius {short(radius)} px · grid ±{short(extent)} px</text>

      {/* In-diagram handles: four distinct real parameters, none of them pairwise.stiffness (the bottom slider's path). */}
      <NativeFieldHandle reading={reading} path="collision.band" family={ctx.family} geometry={BAND_TRACK} disabled={ctx.disabled}
        apply={ctx.apply} captureCurrent={ctx.captureCurrent} onDraft={ctx.setDraft} shape="bar" />
      <NativeFieldHandle reading={reading} path="collision.restitution" family={ctx.family} geometry={GLYPH_BOUNCE_TRACK} disabled={ctx.disabled}
        apply={ctx.apply} captureCurrent={ctx.captureCurrent} onDraft={ctx.setDraft} label="Glyph restitution" />
      <NativeFieldHandle reading={reading} path="pairwise.radius" family={ctx.family} geometry={RADIUS_TRACK} disabled={ctx.disabled}
        apply={ctx.apply} captureCurrent={ctx.captureCurrent} onDraft={ctx.setDraft} shape="ring" />
      <NativeFieldHandle reading={reading} path="pairwise.restitution" family={ctx.family} geometry={PAIR_BOUNCE_TRACK} disabled={ctx.disabled}
        apply={ctx.apply} captureCurrent={ctx.captureCurrent} onDraft={ctx.setDraft} label="Particle restitution" />
    </>
  },
  switches: ({reading, disabled, apply}: FieldFaceSwitchContext): ReactNode => {
    const engine = reading.scene.engine
    // Pairwise contacts run in 3D when Depth enables the volume body (engine.volumeEnabled, nativeBridge.ts:99, read as
    // glyphVolume.enabled) with a body depth above zero (GPGPUSimulator.ts:925, depthGeometry). The note only shows when both hold.
    const pairs3d = engine.pairwiseEnabled === true && engine.volumeEnabled === true && (readingValue(reading, 'glyphVolume.depth') ?? 0) > 0
    return <>
      <div className="native-medium-switches">
        <label><input type="checkbox" checked={engine.collisionEnabled === true} disabled={disabled}
          onChange={event => apply([{kind: 'field-setting', key: 'collisionEnabled', value: event.target.checked}])} />Glyph walls</label>
        <select aria-label="Wall law" value={engine.collisionMode ?? 'obstacle'} disabled={disabled}
          onChange={event => apply([{kind: 'field-setting', key: 'collisionMode', value: event.target.value as 'obstacle' | 'vessel'}])}>
          <option value="obstacle">Obstacle</option><option value="vessel">Vessel</option></select>
        <label><input type="checkbox" checked={engine.pairwiseEnabled === true} disabled={disabled}
          onChange={event => apply([{kind: 'field-setting', key: 'pairwiseEnabled', value: event.target.checked}])} />Particle contacts</label>
      </div>
      {pairs3d && <p className="native-contacts-derived">Pairwise contacts run in 3D because Depth enables the volume body.</p>}
    </>
  },
}
