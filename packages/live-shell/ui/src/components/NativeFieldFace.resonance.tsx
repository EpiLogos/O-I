import {NATIVE_BINDINGS, baseValue} from '@epilogos/expressions-boundary/parameters'
import type {NativeEditorReading} from '../../../../expressions-boundary/src/editor'
import type {FieldFaceDrawContext, FieldFaceSwitchContext, FieldFaceView} from './nativeFieldFaceViews.tsx'
import {NativeFieldHandle} from './NativeFieldHandle.tsx'
import {fraction} from './nativeFieldHandleModel.ts'
import {short} from './nativeFieldFaceValues.ts'
import {PLATE_CELLS, latticeModes, nearestMode, plateSketch, resonanceGate, sweepSchedule, type LatticeMode, type ResonatorDimension} from './nativeFieldFace.resonance.ts'
import './NativeFieldFace.resonance.css'

/** Continuous resonance: the modal body, the drive ladder and the sweep schedule, drawn from the reading's own values.
 * The diagram is a configuration view (the Stage shows the physical result). Every drawn quantity is a value in the
 * reading or ctx.value, or a relation cited at its engine line. Standby parts are drawn dim with the reason in the notes. */

// Track geometry in the 360x160 viewBox. Labels sit in the 132..192 column; soft-range tracks start at AXIS.x.
const AXIS = {x: 196, length: 152}
const ROW = {hz: 34, q: 60, f0: 84, glide: 108, dwell: 130}
const PLATE = {x: 14, y: 20, side: 92}
const PLATE_BAR = {x: 14, y: 124, length: 92}
const SCHEDULE = {x: 14, y: 142, width: 334, height: 8}
const DIRECTION = {ascent: 'ascending', descent: 'descending', pingpong: 'there and back'} as const

const binding = (path: string) => NATIVE_BINDINGS.find(row => row.path === path)
const numberAt = (ctx: FieldFaceDrawContext, path: string) => ctx.value(path) ?? binding(path)?.defaultValue ?? 0
const standby = (live: boolean) => live ? undefined : 'native-resonance-standby'
const modeLabel = (mode: LatticeMode) => `(${mode.m},${mode.n}${mode.p === undefined ? '' : ',' + mode.p}) ${short(mode.hz)} Hz`
const track = (y: number, x = AXIS.x, length = AXIS.length) => <path d={`M${x} ${y}H${x + length}`} className="native-resonance-track" />

function gateOf(reading: NativeEditorReading) {
  const {engine, composition} = reading.scene
  return resonanceGate({resonanceEnabled: engine.resonanceEnabled === true, resonatorMode: engine.resonatorMode,
    frequencyDriver: composition.frequencyDriver ?? 'manual', autoSweep: engine.autoSweep === true})
}

/** A parameter handle on a horizontal track. Handles stay editable in standby; only the drawing is dimmed. */
function handleAt(ctx: FieldFaceDrawContext, path: string, y: number, x: number, length: number) {
  return <NativeFieldHandle key={path} reading={ctx.reading} path={path} family={ctx.family} geometry={{origin: {x, y}, dir: {x: 1, y: 0}, length}}
    disabled={ctx.disabled} apply={ctx.apply} captureCurrent={ctx.captureCurrent} onDraft={ctx.setDraft} />
}

function draw(ctx: FieldFaceDrawContext) {
  const {reading} = ctx
  const engine = reading.scene.engine
  const hz = numberAt(ctx, 'cymatics.frequencyHz'), q = numberAt(ctx, 'cymatics.dampingQFactor'), f0 = numberAt(ctx, 'cymatics.baseFrequency')
  const plate = numberAt(ctx, 'cymatics.plateSize'), glide = numberAt(ctx, 'cymatics.sweep.glideS'), dwell = numberAt(ctx, 'cymatics.sweep.dwellS')
  const dimension: ResonatorDimension = engine.templateDimension ?? '2D'
  const gate = gateOf(reading)
  // Lattice of the engine: f_mn = f0*(m^2+n^2) on the 2D plate, f0*sqrt(m^2+n^2+p^2) in the 3D cavity (cymaticResonator.ts:251,258).
  const modes = latticeModes(dimension, f0), nearest = nearestMode(modes, hz)
  const sketch = dimension === '2D' && nearest && nearest.p === undefined ? plateSketch(nearest.m, nearest.n, PLATE_CELLS) : null
  const freq = binding('cymatics.frequencyHz')
  const xOf = (value: number) => freq ? AXIS.x + fraction(freq, value) * AXIS.length : AXIS.x
  const inAxis = (value: number) => !!freq && value >= freq.min && value <= freq.max
  // Half-power band of the drive: zeta = 1/(2Q) (cymaticResonator.ts:375), so the full width is f/Q.
  const zeta = 1 / (2 * Math.max(0.05, q))
  const bandStart = xOf(hz * (1 - zeta)), bandEnd = xOf(hz * (1 + zeta))
  const schedule = engine.autoSweep === true ? sweepSchedule(engine.sweepDirection ?? 'ascent', glide, dwell) : null
  const cell = PLATE.side / PLATE_CELLS
  const segment = schedule ? SCHEDULE.width / schedule.waypoints : 0

  return <>
    <text x={132} y={10} className="native-graph-label">{dimension === '2D' ? 'Plate' : 'Cavity'} · nearest {nearest ? modeLabel(nearest) : '—'}</text>
    <g className={standby(gate.modal)}>
      <rect x={PLATE.x} y={PLATE.y} width={PLATE.side} height={PLATE.side} rx="2" className="native-medium-boundary" />
      {sketch?.flatMap((line, row) => line.map((value, col) => <rect key={`${row}-${col}`} x={PLATE.x + col * cell} y={PLATE.y + row * cell}
        width={cell} height={cell} opacity={Math.abs(value)} className={value >= 0 ? 'native-resonance-cell is-positive' : 'native-resonance-cell is-negative'} />))}
      {dimension === '3D' && <>
        <text x={PLATE.x + 6} y={PLATE.y + PLATE.side / 2 - 3} className="native-graph-label">3D cavity</text>
        <text x={PLATE.x + 6} y={PLATE.y + PLATE.side / 2 + 8} className="native-graph-label">no plate sketch</text>
      </>}
      {track(PLATE_BAR.y, PLATE_BAR.x, PLATE_BAR.length)}
      {handleAt(ctx, 'cymatics.plateSize', PLATE_BAR.y, PLATE_BAR.x, PLATE_BAR.length)}
      <text x={PLATE.x} y={137} className="native-graph-label">plate L {short(plate)} px</text>
    </g>
    <g>
      {track(ROW.hz)}
      {modes.map((mode, index) => inAxis(mode.hz) ? <path key={index} d={`M${xOf(mode.hz)} ${ROW.hz - 6}V${ROW.hz + 6}`} className="native-resonance-tick" /> : null)}
      <text x={132} y={ROW.hz + 4} className="native-graph-label">{short(hz)} Hz</text>
    </g>
    <g className={standby(gate.drive === 'frequency')}>
      <rect x={Math.min(bandStart, bandEnd)} y={ROW.hz - 9} width={Math.abs(bandEnd - bandStart)} height={18} className="native-resonance-band" />
      {nearest && inAxis(nearest.hz) && <path d={`M${xOf(nearest.hz)} ${ROW.hz - 8}V${ROW.hz + 8}`} className="native-resonance-tick is-nearest" />}
      {handleAt(ctx, 'cymatics.frequencyHz', ROW.hz, AXIS.x, AXIS.length)}
    </g>
    <g className={standby(gate.modal)}>
      {track(ROW.q)}
      <text x={132} y={ROW.q + 4} className="native-graph-label">Q {short(q)}</text>
      {handleAt(ctx, 'cymatics.dampingQFactor', ROW.q, AXIS.x, AXIS.length)}
      {track(ROW.f0)}
      <text x={132} y={ROW.f0 + 4} className="native-graph-label">f0 {short(f0)} Hz</text>
      {handleAt(ctx, 'cymatics.baseFrequency', ROW.f0, AXIS.x, AXIS.length)}
    </g>
    <g className={standby(gate.drive === 'sweep')}>
      {track(ROW.glide)}
      <text x={132} y={ROW.glide + 4} className="native-graph-label">glide {short(glide)} s</text>
      {handleAt(ctx, 'cymatics.sweep.glideS', ROW.glide, AXIS.x, AXIS.length)}
      {track(ROW.dwell)}
      <text x={132} y={ROW.dwell + 4} className="native-graph-label">dwell {short(dwell)} s</text>
      {handleAt(ctx, 'cymatics.sweep.dwellS', ROW.dwell, AXIS.x, AXIS.length)}
    </g>
    {schedule && <g className={gate.drive === 'sweep' ? 'native-resonance-schedule' : 'native-resonance-schedule native-resonance-standby'}>
      {Array.from({length: schedule.waypoints}, (_, index) => {
        const x = SCHEDULE.x + index * segment, dwellWidth = segment * schedule.dwellFraction
        return <g key={index}>
          <rect x={x} y={SCHEDULE.y} width={dwellWidth} height={SCHEDULE.height} className="native-resonance-dwell" />
          <rect x={x + dwellWidth} y={SCHEDULE.y} width={segment - dwellWidth} height={SCHEDULE.height} className="native-resonance-glide" />
        </g>
      })}
      <text x={SCHEDULE.x} y={158} className="native-graph-label">{DIRECTION[engine.sweepDirection ?? 'ascent']} · {schedule.waypoints} waypoints · cycle {short(schedule.cycleS)} s</text>
    </g>}
  </>
}

const readValue = (scene: NativeEditorReading['scene'], path: string) => {const row = binding(path); return row ? baseValue(scene, row.key) : undefined}

function switches({reading, disabled, apply}: FieldFaceSwitchContext) {
  const {engine, composition} = reading.scene
  const gate = gateOf(reading)
  const driver = composition.frequencyDriver ?? 'manual'
  const sweepOn = engine.autoSweep === true
  const freq = binding('cymatics.frequencyHz')
  const modes = latticeModes(engine.templateDimension ?? '2D', readValue(reading.scene, 'cymatics.baseFrequency') ?? 40)
  const aboveAxis = freq ? modes.filter(mode => mode.hz > freq.max).length : 0
  // Reasons the modal body or the sweep is standby, from the same flags the engine reads (see resonanceGate).
  const reasons: string[] = []
  if (!gate.modal) reasons.push(engine.resonanceEnabled === true
    ? 'Compatibility is the legacy template mode, so the modal numerics are inactive (inspector.ts:133; PointCloudField.ts:1811).'
    : 'The resonant medium is off, so the modal numerics do not act (PointCloudField.ts:1811).')
  if (gate.drive === 'focus') reasons.push('Travelling focus drives the medium: frequencyHz is standby and the drive follows the focus station (PointCloudField.ts:1838-1872).')
  if (gate.drive === 'sweep') reasons.push('The station sweep drives the medium: frequencyHz is standby, and glide and dwell are live (cymaticResonator.ts:492-528).')
  if (gate.modal && sweepOn && driver !== 'automation') reasons.push('Sweep linked stations is on, but it runs only while Automation owns the frequency, so the sweep schedule is standby (nativeBridge.ts:88).')
  if (!sweepOn) reasons.push('The sweep schedule is off. Glide and dwell act only while Sweep linked stations runs under Automation.')
  return <>
    <div className="native-resonance-controls">
      <label><input type="checkbox" checked={engine.resonanceEnabled === true} disabled={disabled} onChange={event => void apply([{kind: 'field-setting', key: 'resonanceEnabled', value: event.target.checked}])} />Continuous resonance enabled</label>
      <label><span>Frequency driver</span><select aria-label="Shared frequency is driven by" value={driver} disabled={disabled} onChange={event => void apply([{kind: 'panel-setting', key: 'frequencyDriver', value: event.target.value as 'manual' | 'focus' | 'automation'}])}>
        <option value="manual">Manual tuning</option><option value="focus">Travelling focus</option><option value="automation">Automation / station sweep</option></select></label>
      <label><input type="checkbox" checked={sweepOn} disabled={disabled} onChange={event => void apply([{kind: 'panel-setting', key: 'autoSweep', value: event.target.checked}])} />Sweep linked stations</label>
      <label><span>Sweep direction</span><select aria-label="Sweep direction" value={engine.sweepDirection ?? 'ascent'} disabled={disabled} onChange={event => void apply([{kind: 'panel-setting', key: 'sweepDirection', value: event.target.value as 'ascent' | 'descent' | 'pingpong'}])}>
        <option value="ascent">Ascending</option><option value="descent">Descending</option><option value="pingpong">There and back</option></select></label>
      <label><span>Dimension</span><select aria-label="Resonator dimension" value={engine.templateDimension ?? '2D'} disabled={disabled} onChange={event => void apply([{kind: 'panel-setting', key: 'templateDimension', value: event.target.value as '2D' | '3D'}])}>
        <option value="2D">2D · planar plate</option><option value="3D">3D · volumetric field</option></select></label>
      <label><span>Compatibility</span><select aria-label="Medium implementation" value={engine.resonatorMode ?? 'resonator'} disabled={disabled} onChange={event => void apply([{kind: 'panel-setting', key: 'resonatorMode', value: event.target.value as 'resonator' | 'template'}])}>
        <option value="resonator">Continuous modal resonator</option><option value="template">Legacy templates · no live medium</option></select></label>
      {reasons.length > 0 && <ul className="native-resonance-notes">{reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>}
      {/* Engine relations and what the shell cannot write yet stay one click away, so they never displace the diagram. */}
      <details className="native-resonance-more"><summary>Engine notes and what is not writable here</summary>
      <ul className="native-resonance-notes">
        <li>Ladder: f = f0·(m²+n²) for the 2D plate and f0·√(m²+n²+p²) for the 3D cavity (cymaticResonator.ts:251, 258). {aboveAxis > 0 ? `${aboveAxis} of ${modes.length} modes lie above the ${freq?.max ?? 4000} Hz axis end and are not drawn. ` : ''}Each mode's own width is f_mn/Q; the band drawn around the drive is ±f/2Q (cymaticResonator.ts:375).</li>
        <li>modeCount ranks the 64 modes by drive coupling. The reading does not carry the drive point, so the ladder shows every lattice mode and does not mark which are active. The seven station modes stay on (cymaticResonator.ts:263-276).</li>
        <li>Plate size and boundary strength reach the simulator, not the mode frequencies (PointCloudField.ts:1877-1886).</li>
        <li>Plate sketch: the nearest lattice mode's normalised shape, sampled on a 14 by 14 grid. Station Hz are solved by the engine and are not drawn; the sweep bar shows dwell (solid) then glide (light) per waypoint.</li>
        <li>Runs only while Automation owns the frequency (inspector.ts:130). Sweep Period is legacy: PointCloudField.ts:1852 reads it only when Sweep Glide is absent, and the shell bridge always sets Sweep Glide (nativeBridge.ts:87).</li>
      </ul>
      <ul className="native-resonance-unavailable">
        <li>Station ticks (inspector.ts:128; app.ts:724): not writable from the shell yet. One tap writes field.params.frequency to a solved station Hz, sets Scene.composition.frequencyDriver to manual and clears EngineSettings.autoSweep.</li>
        <li>Automation per control (automate button, Take manual control; inspector.ts paramControl; app.ts:723): not writable from the shell yet on this control. Lanes are written from the Automation device; Take manual control (app.ts:726) is a direct base write outside native history and is not admitted.</li>
        <li>Share across expression (globe button; app.ts:721): on a pinned Field control the S/L mark writes one shared-setting. The Parameters browser offers the same change as Share across Expression or Use local value.</li>
        <li>Toolbelt star (inspector.ts paramControl; app.ts:725): Map mode puts a pin on this control. Pinning writes the Expression's chosen controls, the same list Add to toolbelt writes.</li>
        <li>Live drive readout (inspector.ts:126, data-resonance-live): not writable from the shell yet. It is engine telemetry, not part of the reading; read it on the Stage.</li>
      </ul>
      </details>
    </div>
  </>
}

export const resonanceFaceView: FieldFaceView = {draw, switches}
