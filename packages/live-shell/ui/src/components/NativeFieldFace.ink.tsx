import {useState, type ReactElement} from 'react'
import {NATIVE_BINDINGS} from '@epilogos/expressions-boundary/parameters'
import type {FieldMaterialChange, NativeEditorReading, NativeGlyphChange} from '../../../../expressions-boundary/src/editor'
import {FIELD_MATERIAL_CARDS} from '../../../../expressions-boundary/src/nativeFieldStyle'
import type {FieldFaceSwitchContext, FieldFaceView} from './nativeFieldFaceViews.tsx'
import {NativeFieldHandle} from './NativeFieldHandle.tsx'
import {handlePosition, type HandleGeometry} from './nativeFieldHandleModel.ts'
import {short} from './nativeFieldFaceValues.ts'
import {FIELD_FONT_WEIGHTS, fontChange, weightChange} from './nativeFieldFace.ink.ts'
import {CUSTOM_SENTINEL, FONT_OPTIONS, resolveFontOption} from '../../../../../desktop/cradle/expressions-app/field-studies-journeys/src/fontCatalog'
import './NativeFieldFace.ink.css'

/** Mark profile: the engine's per-mark law drawn on a fixed sample of marks, with the range bar and the rails as handles.
 * Engine relations: uniforms PointCloudField.ts:498-500 (defaults), :491 (uMinParticleSize), :1513-1519 (sync from config.material);
 * vertex law particleShaders.ts:157-180 (contrast, sizeBias, size), :339-342 (density band, edge emphasis);
 * fragment law particleShaders.ts:405-436 (orientation, stretch, irregular edge, roundness, softness, opacity, halo).
 * Not drawn as a substitute: positions (the engine places marks by simulation), the Stage's real density and speed. */

export const INK_HANDLE_PATHS = ['material.sizeBias', 'material.roundness', 'material.elongation', 'material.halo', 'particleSize.min', 'particleSize.max'] as const
const MARK_PATHS = ['particleSize.max', 'material.opacity', 'particleCount', 'particleSize.min', 'material.sizeBias', 'material.roundness', 'material.softness',
  'material.irregularity', 'material.elongation', 'material.orientation', 'material.contrast', 'material.densityScale', 'material.densityPhase',
  'material.edgeWeight', 'material.halo'] as const
const GRAIN_PATHS = ['material.sizeBias', 'material.roundness', 'material.elongation', 'material.halo'] as const

const SWATCH = {x: 8, y: 6, w: 172, h: 78, cols: 6, rows: 3}, SWATCH_MAX_SIDE = 24, CONTOUR_STEPS = 40
const BAR: HandleGeometry = {origin: {x: 12, y: 118}, dir: {x: 1, y: 0}, length: 168}
const RAILS = [{path: 'material.sizeBias', y: 22}, {path: 'material.roundness', y: 48}, {path: 'material.elongation', y: 74}, {path: 'material.halo', y: 100}] as const
const rail = (y: number): HandleGeometry => ({origin: {x: 204, y}, dir: {x: 1, y: 0}, length: 142})
const binding = (path: string) => NATIVE_BINDINGS.find(row => row.path === path)

export interface InkSample {
  grain: boolean; square: boolean; min: number; max: number; sizeBias: number; opacity: number; roundness: number; softness: number
  irregularity: number; elongation: number; orientation: number; contrast: number; densityScale: number; densityPhase: number; edgeWeight: number; halo: number
}
export interface InkLaw {size: number; angle: number; stretch: number; alpha: number; round: number; irregular: number; feather: number; hash: number}

const TAU = Math.PI * 2
const fract = (x: number) => x - Math.floor(x)
const mix = (a: number, b: number, t: number) => a + (b - a) * t
const smooth = (e0: number, e1: number, x: number) => {const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t)}
const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

/** One mark's law, evaluated the way the engine does. The shader's hash(uv) and posData.w (stroke density) are not
 * available to a configuration diagram, so each mark takes a fixed stand-in: hash and density are fixed sequences, so the
 * diagram shows the law and never a frame of the simulation. The density band uses swatch coordinates as stand-in positions. */
export function inkMarkLaw(s: InkSample, index: number, x: number, y: number): InkLaw {
  const hash = fract(0.5 + (index + 1) * 0.6180339887)
  const density = fract(0.25 + (index + 1) * 0.3819660113)
  // Vertex: rnd = pow(hash, max(0.1, sizeBias)) and density = pow(density, mix(0.35, 3, contrast)) when the grain profile is on (particleShaders.ts:157-166).
  const rnd = s.grain ? Math.pow(hash, Math.max(0.1, s.sizeBias)) : hash
  const dens = s.grain ? Math.pow(density, mix(0.35, 3, clamp01(s.contrast))) : density
  // Stipple size (particleShaders.ts:179), speed term omitted at rest (speed 0).
  let size = mix(s.min, s.max, rnd * 0.8 + dens * 0.2) * mix(0.7, 1.35, rnd) * mix(0.5, 1.15, dens)
  if (s.grain) {
    // Density band over position and edge emphasis on sparse marks (particleShaders.ts:339-342).
    const band = 0.7 + 0.3 * Math.sin(x * 0.01 * s.densityScale + Math.sin(y * 0.013 * s.densityScale) + s.densityPhase)
    size *= mix(1, band, clamp01(s.contrast) * 0.35)
    size *= 1 + s.edgeWeight * (1 - dens)
  }
  // Fragment: rotation by orientation plus irregular jitter, stretch on the rotated y axis (particleShaders.ts:405-409).
  const angle = s.grain ? (s.orientation * Math.PI) / 180 + (hash - 0.5) * s.irregularity : 0
  // Opacity multiplies the mark; halo fades only sparse marks, below density 0.25 (particleShaders.ts:434-436).
  const alpha = s.grain ? clamp01(s.opacity) * mix(clamp01(s.halo * 2), 1, smooth(0, 0.25, dens)) : 1
  return {
    size, angle, stretch: s.grain ? s.elongation : 0, alpha, hash,
    round: s.grain ? clamp01(s.roundness) : s.square ? 0 : 1,
    irregular: s.grain ? s.irregularity : 0,
    feather: s.grain ? clamp01(s.softness) * 0.15 : 0,
  }
}

/** The mark outline in its own unit box (±0.5). The shader's outline is mix(max(|x|,|y|), length, roundness) plus an irregular
 * wobble, with the mark edge at 0.5 (particleShaders.ts:427-430). Solved along each ray, then mapped back through the rotation and
 * stretch. Points are unit-box coordinates; the box clip is applied by the caller. */
export function inkContour(law: InkLaw, level: number, steps = CONTOUR_STEPS): [number, number][] {
  const cos = Math.cos(law.angle), sin = Math.sin(law.angle), out: [number, number][] = []
  for (let k = 0; k < steps; k++) {
    const phi = (TAU * k) / steps, c = Math.cos(phi), s = Math.sin(phi)
    const base = mix(Math.max(Math.abs(c), Math.abs(s)), 1, law.round)
    const wobble = Math.sin(phi * 7 + law.hash * 25) * law.irregular * 0.045
    const radius = (level - wobble) / base
    const qx = radius * c, qy = (radius * s) / (1 + law.stretch)
    out.push([qx * cos + qy * sin, -qx * sin + qy * cos])
  }
  return out
}

export interface InkMark {id: number; cx: number; cy: number; side: number; outer: string; outerAlpha: number; inner: string | null; innerAlpha: number}
/** Six-by-three swatch of marks. Sizes are relative: the largest mark fills the cell. Each mark is clipped to its point box, as the sprite is. */
export function inkSwatch(s: InkSample): InkMark[] {
  const cells = Array.from({length: SWATCH.cols * SWATCH.rows}, (_, id) => {
    const cx = SWATCH.x + ((id % SWATCH.cols) + 0.5) * SWATCH.w / SWATCH.cols
    const cy = SWATCH.y + (Math.floor(id / SWATCH.cols) + 0.5) * SWATCH.h / SWATCH.rows
    return {id, cx, cy, law: inkMarkLaw(s, id, cx, cy)}
  })
  const largest = Math.max(...cells.map(cell => cell.law.size)) || 1
  const scale = SWATCH_MAX_SIDE / largest
  return cells.map(({id, cx, cy, law}) => {
    const side = law.size * scale
    const path = (level: number) => 'M' + inkContour(law, level).map(([x, y]) => `${(cx + side * x).toFixed(2)} ${(cy + side * y).toFixed(2)}`).join('L') + 'Z'
    const feathered = law.feather > 0
    return {
      id, cx, cy, side,
      outer: path(0.5), outerAlpha: feathered ? law.alpha * 0.5 : law.alpha,
      inner: feathered ? path(0.49 - law.feather) : null, innerAlpha: law.alpha,
    }
  })
}

function readSample(read: Record<string, number>, grain: boolean, square: boolean): InkSample {
  return {
    grain, square, min: read['particleSize.min'], max: read['particleSize.max'], sizeBias: read['material.sizeBias'], opacity: read['material.opacity'],
    roundness: read['material.roundness'], softness: read['material.softness'], irregularity: read['material.irregularity'],
    elongation: read['material.elongation'], orientation: read['material.orientation'], contrast: read['material.contrast'],
    densityScale: read['material.densityScale'], densityPhase: read['material.densityPhase'], edgeWeight: read['material.edgeWeight'], halo: read['material.halo'],
  }
}

export const inkFaceView: FieldFaceView = {
  draw: ({reading, value, disabled, family, apply, captureCurrent, setDraft}) => {
    const read: Record<string, number> = {}
    for (const path of MARK_PATHS) {
      const v = value(path)
      if (v === undefined || !Number.isFinite(v)) return <text x="12" y="30" className="native-graph-label">Reading lacks {path} · marks not drawn</text>
      read[path] = v
    }
    const grain = reading.scene.engine.grainProfile !== false, square = reading.scene.engine.dotShape === 'square'
    const marks = inkSwatch(readSample(read, grain, square))
    const handle = (path: string, geometry: HandleGeometry, shape?: 'bar', gated = false) => <NativeFieldHandle key={path} reading={reading} path={path} family={family}
      geometry={geometry} disabled={disabled || gated} apply={apply} captureCurrent={captureCurrent} onDraft={setDraft} shape={shape} />
    const minBinding = binding('particleSize.min'), maxBinding = binding('particleSize.max')
    const barActive = minBinding && maxBinding ? {x1: handlePosition(minBinding, BAR, read['particleSize.min']).x, x2: handlePosition(maxBinding, BAR, read['particleSize.max']).x} : null
    return <>
      <defs>{marks.map(m => <clipPath key={m.id} id={`ink-mark-clip-${m.id}`}><rect x={m.cx - m.side / 2} y={m.cy - m.side / 2} width={m.side} height={m.side} /></clipPath>)}</defs>
      <rect x={SWATCH.x} y={SWATCH.y} width={SWATCH.w} height={SWATCH.h} rx="2" className="ink-swatch" />
      {marks.map(m => <g key={m.id} clipPath={`url(#ink-mark-clip-${m.id})`}>
        <path d={m.outer} className="ink-mark" style={{fillOpacity: m.outerAlpha}} />
        {m.inner && <path d={m.inner} className="ink-mark" style={{fillOpacity: m.innerAlpha}} />}
      </g>)}
      <text x={SWATCH.x + 4} y="96" className="native-graph-label">{grain ? 'Marks · engine law · fixed sample' : 'Classic profile · dot shape, no grain'}</text>
      <path d="M12 118H180" className="ink-track" />
      {barActive && <path d={`M${barActive.x1} 118H${barActive.x2}`} className="ink-active" />}
      <text x="8" y="106" className="native-graph-label">Size range {short(read['particleSize.min'])}–{short(read['particleSize.max'])} px · log</text>
      <text x="180" y="106" textAnchor="end" className="native-graph-label">n {short(read.particleCount)}</text>
      {RAILS.map(({path, y}) => {
        const b = binding(path), gated = !grain && (GRAIN_PATHS as readonly string[]).includes(path)
        return <g key={path}>
          <path d={`M204 ${y}H346`} className="ink-track" />
          <text x="204" y={y - 9} className="native-graph-label">{b?.label ?? path} {short(read[path])}{gated ? ' · off' : ''}</text>
          {handle(path, rail(y), undefined, gated)}
        </g>
      })}
      {minBinding && handle('particleSize.min', BAR, 'bar')}
      {maxBinding && handle('particleSize.max', BAR, 'bar')}
    </>
  },
  switches: ({reading, disabled, apply}) => {
    const engine = reading.scene.engine, grain = engine.grainProfile !== false
    return <div className="ink-switches">
      <label><input type="checkbox" checked={grain} disabled={disabled} onChange={event => apply([{kind: 'panel-setting', key: 'grainProfile', value: event.target.checked}])} />Extended grain profile<small>Uses the native mark shader, not another simulation</small></label>
      <label>Native dot shape<select aria-label="Native dot shape" value={engine.dotShape ?? 'circle'} disabled={disabled}
        onChange={event => apply([{kind: 'panel-setting', key: 'dotShape', value: event.target.value as 'circle' | 'square'}])}><option value="circle">Circle</option><option value="square">Square</option></select></label>
      {!grain && <p className="ink-note">Classic profile: the material rows are not read, and the dot shape draws each mark.</p>}
      <InkMaterial reading={reading} disabled={disabled} apply={apply} />
      <InkGlyphSampling reading={reading} disabled={disabled} apply={apply} />
    </div>
  },
}

/** A refused apply carries reply.error (NativeEditorReply with ok:false). The switch context types the reply as unknown, so narrow it here. */
export function refusalOf(reply: unknown): string | null {
  if (reply && typeof reply === 'object' && 'ok' in reply && reply.ok === false && 'error' in reply && typeof reply.error === 'string') return reply.error
  return null
}

type SwitchApply = FieldFaceSwitchContext['apply']
/** One glyph choice is one apply of one admitted change. Refusals and thrown errors are reported, never dropped. */
export async function chooseGlyph(apply: SwitchApply, change: NativeGlyphChange, report: (error: string | null) => void): Promise<void> {
  try {report(refusalOf(await apply([change])))}
  catch (cause) {report(cause instanceof Error ? cause.message : String(cause))}
}

export interface GlyphControlsInput {reading: NativeEditorReading; disabled: boolean; error: string | null; choose: (change: NativeGlyphChange) => void}
const WEIGHT_NAMES: Record<number, string> = {400: ' · Regular', 700: ' · Bold', 900: ' · Heavy'}
/** The Field typeface and weight (engine.fontFamily / engine.fontWeight, the fields the field-font reducer writes). Pure markup: the state lives in InkGlyphSampling. */
export function glyphControls({reading, disabled, error, choose}: GlyphControlsInput): ReactElement {
  const engine = reading.scene.engine
  const hasFamily = typeof engine.fontFamily === 'string' && engine.fontFamily.trim() !== ''
  const font = resolveFontOption(engine.fontFamily)
  const weight = engine.fontWeight === undefined || engine.fontWeight === null || engine.fontWeight === '' ? undefined : Number(engine.fontWeight)
  const hasWeight = weight !== undefined && Number.isFinite(weight)
  const onGrid = hasWeight && (FIELD_FONT_WEIGHTS as readonly number[]).includes(weight)
  return <fieldset className="ink-glyph"><legend>Glyph sampling</legend>
    <div className="ink-glyph-row">
      <label>Typeface<select aria-label="Typeface" value={hasFamily ? font.optionId : ''} disabled={disabled}
        onChange={event => {const option = FONT_OPTIONS.find(item => item.id === event.target.value); if (option) choose(fontChange(option.stack))}}>
        {!hasFamily && <option value="" disabled>Not in the reading</option>}
        {hasFamily && font.optionId === CUSTOM_SENTINEL && <option value={CUSTOM_SENTINEL} disabled>Custom stack in the reading</option>}
        {FONT_OPTIONS.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
      </select></label>
      <label>Weight<select aria-label="Weight" value={hasWeight ? String(weight) : ''} disabled={disabled}
        onChange={event => {const next = Number(event.target.value); if ((FIELD_FONT_WEIGHTS as readonly number[]).includes(next)) choose(weightChange(next))}}>
        {!hasWeight && <option value="" disabled>Not in the reading</option>}
        {hasWeight && !onGrid && <option value={String(weight)} disabled>{weight} · retained</option>}
        {FIELD_FONT_WEIGHTS.map(value => <option key={value} value={String(value)}>{value}{WEIGHT_NAMES[value] ?? ''}</option>)}
      </select></label>
    </div>
    {!hasFamily && <p className="ink-note">current font not in the reading</p>}
    {!hasWeight && <p className="ink-note">current weight not in the reading</p>}
    <p className="ink-note">Field font: the same typeface and weight the Glyph sequence panel writes.</p>
    {error && <p role="alert" className="ink-note">{error}</p>}
  </fieldset>
}

/** Holds the last refusal for the glyph controls; each choice is one apply through the switch context. */
/** The one admitted change of a Material card (inspector.ts: Ink, Print, Rounded). */
export function materialChange(value: FieldMaterialChange['value']): FieldMaterialChange {
  return {kind: 'field-material', value}
}
/** Field material (Scene.field.material): one field-material change per card. The active card sends nothing; a refusal stays on the row. */
export function InkMaterial({reading, disabled, apply}: {reading: Pick<NativeEditorReading, 'scene'>; disabled: boolean; apply: SwitchApply}) {
  const [error, setError] = useState<string | null>(null)
  const current = reading.scene.field.material
  const choose = async (value: FieldMaterialChange['value']) => {
    if (value === current) return
    try {setError(refusalOf(await apply([materialChange(value)])))}
    catch (cause) {setError(cause instanceof Error ? cause.message : String(cause))}
  }
  return <div className="ink-material" role="group" aria-label="Field material">
    <span>Material</span>
    {FIELD_MATERIAL_CARDS.map(card => <button key={card.value} type="button" aria-pressed={current === card.value} disabled={disabled}
      onClick={() => void choose(card.value)}>{card.label}</button>)}
    {error && <p role="alert" className="ink-note">{error}</p>}
  </div>
}
function InkGlyphSampling({reading, disabled, apply}: {reading: NativeEditorReading; disabled: boolean; apply: SwitchApply}) {
  const [error, setError] = useState<string | null>(null)
  return glyphControls({reading, disabled, error, choose: change => void chooseGlyph(apply, change, setError)})
}
