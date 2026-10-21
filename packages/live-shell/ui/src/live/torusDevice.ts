// The M1 torus as a device of the runtime (FOUNDATION F5, the reference device; lock §0.2.3: "the compact rack widget
// (mini torus + ≤4 macros), the expanded instrument in the browser pool, the full torus in the centre pane"). Its four
// macros are the owner's determinants, each an enumerated row whose choices are the owner's own; a change is the owner's
// own instrument edit through the hosted stage channel (torusInstrument.ts), and a refusal comes back in the owner's words.
// The whole view adds the owner's other parameters — sound, level, cadence and scale, as the native field panel groups them
// (ported from live/LiveInstrumentSection.tsx:74-105 through inhabitants/ql/devices/qlDevices.ts qlPresentation, the rows the QL
// field/PCM face carries) — so the pool holds every parameter the owner exposes (DLW §21.2 Whole).
// Its light reads the owner's standing: on while the instrument follows or is held, off otherwise, dark with no reading.
import type {DeviceDeclaration, SdkParamRow} from '../inhabitants/sdk/define'
import type {DeviceInstance, ParamValue} from '../frame/devices/deviceRuntime'
import type {DesignBinding, Standing, Value, ValueChange} from '../frame/devices/designed'
import {qlInstrumentEdit, qlPresentation, QL_PRESENTATION_KEYS, QL_WRITE_PATH} from '../inhabitants/ql/devices/qlDevices'
import {commitLiveInstrumentEdit, liveInstrumentWritable, liveTorusMacroRows, LIVE_TORUS_TOPOLOGY, type LiveTorusState} from './torusInstrument'
import type {FrameStageReading} from '@epilogos/expressions-boundary'
import {hostedChrome} from '../projections/expressionsPaneHost'
import {qlRackState, rackPage, type QlRackState} from '../inhabitants/ql/devices/qlRack'
import {handsFor, heldFor} from '../techne/devices/designDevices'
import type {StageRun} from '../components/expressions/studio/StudioStage'

export const TORUS_DEVICE_ID = 'live:m1-torus'

/** The torus's family and face are the catalogue's (`quaternal-logic:torus`, inhabitants/catalogue/panels/torus.tsx): the M1 torus is
 * Quaternal Logic's instrument, and Live plays it (DLW §21.2). designKey(family, face.id) is the design's id, so the runtime draws
 * the design on the binding this module writes. */
export const TORUS_FAMILY = 'quaternal-logic'

export const TORUS_DEVICE: DeviceDeclaration = {
  id: 'torus', title: 'M1 torus', icon: 'live', liveSemantic: 'device-instrument',
  invariant: {generates: QL_WRITE_PATH}, note: 'The one instrument: the bi-phasal oscillator on the torus, played from the keyboard.',
} as DeviceDeclaration

const WRITE_PATH = QL_WRITE_PATH

/** The torus as the runtime draws it, over the owner's current reading. */
export function torusDevice(state: LiveTorusState | null): DeviceInstance {
  const macros = liveTorusMacroRows(state)
  const rows: SdkParamRow[] = macros.map(row => ({
    family: 'live', deviceInstance: TORUS_DEVICE_ID, key: row.macro.id, type: 'enumerated', title: row.macro.label,
    values: row.options.map(option => option.label), compact: true, group: 'Determinants',
    ...(liveInstrumentWritable(state) ? {writePath: WRITE_PATH} : {disclosure: 'The owner takes edits only while the instrument follows or is held.'}),
  }) as SdkParamRow)
  // The owner's other parameters, after the determinants: never compact (the four determinants are the macros).
  const presentation = qlPresentation('live', TORUS_DEVICE_ID, state, false)
  rows.push(...presentation.rows)
  const values: Record<string, ParamValue> = {...presentation.values}
  for (const row of macros) {
    const option = row.options.find(choice => choice.value === row.selected)
    if (option) values[row.macro.id] = option.label
  }
  if (state?.ok) values.enabled = state.value.standing === 'following' || state.value.standing === 'held'
  return {
    id: TORUS_DEVICE_ID, family: TORUS_FAMILY, face: TORUS_DEVICE, rows, values, enabledKey: state?.ok ? 'enabled' : undefined,
    submit: async changes => {
      for (const change of changes) {
        const edit = QL_PRESENTATION_KEYS.includes(change.key) ? qlInstrumentEdit(change.key, change.value) : (() => {
          const row = macros.find(item => item.macro.id === change.key)
          const option = row?.options.find(choice => choice.label === change.value)
          if (!row || !option) throw Error(`${change.key}: not one of the owner's choices`)
          return row.edit(option.value)
        })()
        const result = await commitLiveInstrumentEdit(edit)
        if (!result.ok) throw Error(result.error)
      }
    },
  }
}

// ── the Torus design's binding ───────────────────────────────────────────────
// The catalogue's Torus (inhabitants/catalogue/panels/torus.tsx, `quaternal-logic:torus`) drawn on the owner's readings and writes
// (frame/devices/designed.ts DesignBinding; the pattern of central/devices/dayBinding.ts). Owners write, faces read: a design key is
// given a value only where the owner reports one, and a change only where the owner takes one (manual §16.12, §8.1). The owner is the
// native field in the hosted Expressions frame; what it announces is its standing, its four determinants and its presentation
// parameters (packages/expressions-boundary/src/protocol.ts readHostedDeterminants, readHostedParameters), and what it takes is the
// stage channel's instrument edits (desktop/cradle/expressions-app/field-studies-journeys/src/stageCommands.ts InstrumentEdit).

/** The design's id. */
export const TORUS_DESIGN_ID = 'quaternal-logic:torus'

/** The owner's determinants by the value key the binding gives them — the macro row's own key (torusInstrument.ts LIVE_TORUS_MACROS),
 * so the generic plate that stands in for a view reads them too. The design draws them as its compact four and its Determinants
 * (catalogue/panels/torus.tsx `determinants`), by the labels of the owner's choices; a design key that is a row key is wrapped as that
 * row is on the chain (MIDI map, DeviceView.tsx useHosting). */
export const TORUS_DETERMINANT_KEYS: Readonly<Record<string, string>> = {'lens': 'lens', 'context-frame': 'context-frame', 'harmonic-basis': 'harmonic-basis', 'm3-transcription': 'm3-transcription'}

const NO_FIELD_PARAMETER = 'the native field announces only its lens, context frame, harmonic basis, M3 transcription, sound, level, cadence and scale, and takes only those through the stage channel (stageCommands.ts InstrumentEdit)'

/** The Stage page (manual §21.2): the hosted frame's native field holds the procedural stage and announces the disclosure it last read
 * (stageReading.ts, HostedAppState.instrumentStage): each owned slot's owner and revision, each procedure bound to the flow, the
 * procedures the frame holds (its Studio's example, stageReading.ts STUDIO_PROCEDURE: no owner lists the person's own) and the last
 * act's standing. The four acts are the stage's own operations, sent through the frame's stage channel (stageCommands.ts
 * 'procedural-stage') to the native field's own stage operations and on through the kernel's native_expression exchange (native_expression.rs
 * EXCHANGE_OPERATIONS admits all five): Evaluate, Bind (with the budget you hold), Unbind and Retire, each with the procedure's ref, and
 * the stage read back after. The procedure you choose and the budget are the view's own. */
const NO_STAGE_READ = 'The native field has disclosed no stage yet: it reads its stage when asked (the Studio\'s Procedural stage · Read stage state), and announces what it last read'
const NO_STAGE_FRAME = 'No Expressions application is mounted, so no stage act reaches the native field: open the Expressions pane.'
const NO_LAST = 'No stage act has run since the stage was read: the last receipt is the next act\'s.'
/** The stage keys and why each has no reading or write here, before the field discloses its stage. */
const STAGE_ABSENT: Readonly<Record<string, string>> = {
  'stage.slots': `${NO_STAGE_READ}.`, 'stage.bindings': `${NO_STAGE_READ}.`, 'stage.procedures': `${NO_STAGE_READ}.`,
  'stage.last': `${NO_STAGE_READ}.`, 'stage.why': `${NO_STAGE_READ}.`,
  'stage.evaluate': `Evaluate: ${NO_STAGE_READ}.`, 'stage.bind': `Bind: ${NO_STAGE_READ}.`, 'stage.unbind': `Unbind: ${NO_STAGE_READ}.`, 'stage.retire': `Retire: ${NO_STAGE_READ}.`,
}
/** The stage's four acts, each the stage's own operation (stageCommands.ts STAGE_PROCEDURAL_ACTIONS). */
export const TORUS_STAGE_ACTS: Readonly<Record<string, 'evaluate' | 'bind' | 'unbind' | 'retire'>> = {'stage.evaluate': 'evaluate', 'stage.bind': 'bind', 'stage.unbind': 'unbind', 'stage.retire': 'retire'}
/** The view's own: the procedure you choose and a binding's budget (DesignBinding.local, held in the shell). */
export const TORUS_STAGE_LOCAL = ['stage.procedure', 'stage.budget'] as const
/** The stage the frame announced, as the Torus design reads it (torus.tsx `stage.slots`, `stage.bindings`, `stage.procedures`,
 * `stage.last`, `stage.why`), with the procedure and budget the view holds. */
export function torusStageValues(stage: FrameStageReading | null | undefined, held: Readonly<Record<string, Value>> = {}): Record<string, Value> {
  const values: Record<string, Value> = {}
  for (const key of TORUS_STAGE_LOCAL) if (held[key] !== undefined) values[key] = held[key]!
  if (!stage) return values
  values['stage.slots'] = JSON.stringify(stage.slots.map(slot => ({slot: slot.slot, ...(slot.owner ? {owner: slot.owner} : {}), ...(slot.revision !== undefined ? {revision: slot.revision} : {})})))
  values['stage.bindings'] = JSON.stringify(stage.bindings.map(binding => ({procedure: binding.procedure, trigger: binding.trigger, evaluations: binding.evaluations, max: binding.max, standing: binding.standing})))
  if (stage.procedures) values['stage.procedures'] = JSON.stringify(stage.procedures.map(procedure => ({ref: procedure.ref, revision: procedure.revision, trigger: procedure.trigger, selector: procedure.selector})))
  if (stage.last) {
    values['stage.last'] = stage.last.standing
    if (stage.last.why) values['stage.why'] = stage.last.why
  }
  return values
}

/** The stage command a Torus act sends: the act's own operation on the procedure it names, a bind with the budget you hold. */
export function torusStageCommand(change: ValueChange, held: Readonly<Record<string, Value>> = {}) {
  const action = TORUS_STAGE_ACTS[change.key]
  if (!action) throw new Error(`${change.key}: no act of the stage.`)
  if (typeof change.value !== 'string' || !change.value) throw new Error('A stage act names the procedure it acts on.')
  const budget = held['stage.budget']
  return action === 'bind'
    ? {command: 'procedural-stage' as const, action, procedure_ref: change.value, ...(typeof budget === 'number' ? {max_evaluations: Math.round(budget)} : {})}
    : {command: 'procedural-stage' as const, action, procedure_ref: change.value}
}
// The Rack page (manual §16.16, §22.9) reads M1′'s rack from the map's ledger, and holds the part you choose (qlRack.ts).

/** Why each design key the binding leaves absent has no reading (manual §16.12: "When a reading is missing, say which one"). */
export const TORUS_ABSENT: Readonly<Record<string, string>> = {
  pulseMix: `No pulse mix: no QL owner holds a balance of the two pulses (none in its scene field, M1 engine or spanda field); ${NO_FIELD_PARAMETER}.`,
  helixBalance: 'No helix balance: in QL a helix is one half of the ring in the 72-space address (spanda_field.rs resonance_index: lens·12 + helix·6 + position), never a balance between the two.',
  strike: 'No strike: the scene\'s strike is its declared material policy, a depth in metres (stage state material.strike_metres; QL\'s MATERIAL_STANDING: no source table fixes it), not the share of velocity the design draws.',
  damping: 'No damping: the scene holds a decay rate per second (stage state material.damping_per_second, a declared policy), not the Q factor the design draws.',
  drive: `No drive: ${NO_FIELD_PARAMETER}. No sky route moves it either: a planet takes only what the owner reports (designBindings/skyModulation.ts).`,
  modes: `No mode count: the scene's modes are its planet voices (scene_field.rs VOICES), and no owner takes a count of them; ${NO_FIELD_PARAMETER}.`,
  agitation: `No agitation: ${NO_FIELD_PARAMETER}.`,
  attack: `No attack: ${NO_FIELD_PARAMETER}.`,
  release: `No release: ${NO_FIELD_PARAMETER}.`,
  voices: 'No voice count: the scene sounds all its planet voices together (scene_field.rs VOICES); no owner holds a polyphony that makes the oldest note give way.',
  pan: `No pan: ${NO_FIELD_PARAMETER}.`,
  view: 'Surface, wire or both is a way of drawing the pane: no owner keeps it.',
  receiver: 'No owner takes the camera as the place where the torus is heard.',
  notes: 'The owner counts no sounding notes: a struck chord is one act through the stage channel, answered yes or no, never counted back.',
  meter: 'The owner reports no level meter: its audio receipt carries the presentation gain and its block counts, not a level.',
  sounding: 'The owner reports no sounding keys: a struck key is one act through the stage channel, answered yes or no, never reported back as sounding.',
  driveMod: 'Nothing moves the drive: the owner announces no drive, so no planet can take it and no range is drawn round it.',
  'body.source': 'No body source: QL\'s scene material is a declared policy (scene_field.rs MATERIAL_STANDING), never taken from the tattva; no owner holds body constants by tattva.',
  'tattva.name': 'The tattva of the M2 condition is QL\'s (the live event\'s condition source_path: tattva_coordinate), but neither the field\'s influence reading nor the instrument the frame announces carries it — missing: its announcement to the shell.',
  'tattva.fibre': 'The element fibre is QL\'s (the condition source_path: material_fibre), but nothing announces it to the shell — missing: its announcement.',
  'tattva.standing': 'No table of body constants by tattva stands: QL\'s scene material is a declared policy (scene_field.rs MATERIAL_STANDING).',
  ...STAGE_ABSENT,
}

const NOT_WRITABLE = 'The owner takes edits only while the instrument follows or is held.'

/** The owner's presentation gain (0–4, an amplitude) as the design's level in dB; silence is the design's floor. */
export const gainToDb = (gain: number): number => (gain <= 0.001 ? -60 : Math.round(20 * Math.log10(gain) * 10) / 10)
/** The design's level in dB as the owner's presentation gain, within the owner's 0–4. */
export const dbToGain = (db: number): number => (db <= -60 ? 0 : Math.min(4, Math.max(0, Math.round(10 ** (db / 20) * 1000) / 1000)))

/** The design's values from the owner's reading. Only what the owner reports. */
export function torusDesignValues(state: LiveTorusState | null): Record<string, Value> {
  const values: Record<string, Value> = {}
  if (state === null || !state.ok) return values
  const standing = state.value.standing
  values.light = standing === 'following' || standing === 'held' ? 'lit' : 'dark'
  values.standing = standing
  if (typeof state.parameters?.level === 'number') values.level = gainToDb(state.parameters.level)
  const presentation = qlPresentation(TORUS_FAMILY, TORUS_DEVICE_ID, state, false).values
  for (const key of ['sound', 'cadence', 'scale']) if (presentation[key] !== undefined) values[key] = presentation[key]!
  for (const row of liveTorusMacroRows(state)) {
    const key = Object.keys(TORUS_DETERMINANT_KEYS).find(name => TORUS_DETERMINANT_KEYS[name] === row.macro.id)
    const option = row.options.find(choice => choice.value === row.selected)
    if (key && option) values[key] = option.label
  }
  return values
}

/** Whether the owner takes a change of this design key now, and why not when it does not. */
function writeStanding(state: LiveTorusState | null, key: string): string | null {
  if (TORUS_ABSENT[key]) return TORUS_ABSENT[key]!
  if (key === 'light') return 'The owner has no on or off: the light reads whether the instrument follows or is held.'
  if (key === 'standing') return 'A reading: the owner reports its standing.'
  if (!(key === 'level' || QL_PRESENTATION_KEYS.includes(key) || key in TORUS_DETERMINANT_KEYS)) return `${key}: no parameter of the owner's instrument.`
  if (!liveInstrumentWritable(state)) return state === null ? 'No owner reading stands in this host.' : NOT_WRITABLE
  if (state !== null && state.ok && key === 'cadence' && (state.parameters?.cadence ?? null) === null) return 'No scene is open, so there is no cadence to set.'
  if (state !== null && state.ok && key === 'scale' && (state.parameters?.scale?.unitsPerMetre ?? null) === null) return 'The owner states no scale.'
  return null
}

/** The device's row changes for the design's changes, in the owner's own forms (labels for choices, the gain for the level). Throws
 * in words for a key the owner does not take. */
export function torusRowChanges(changes: readonly ValueChange[]): {key: string; value: ParamValue}[] {
  return changes.map(change => {
    if (change.key === 'level') {
      if (typeof change.value !== 'number' || !Number.isFinite(change.value)) throw new Error('Level takes a number of dB.')
      return {key: 'level', value: dbToGain(change.value)}
    }
    const macro = TORUS_DETERMINANT_KEYS[change.key]
    if (macro) return {key: macro, value: change.value}
    if (QL_PRESENTATION_KEYS.includes(change.key)) return {key: change.key, value: change.value}
    throw new Error(TORUS_ABSENT[change.key] ?? `${change.key}: no parameter of the owner's instrument.`)
  })
}

/** Every key the binding speaks for: the design's keys and the owner's own. */
const TORUS_KEYS = ['light', 'standing', 'level', ...QL_PRESENTATION_KEYS.filter(key => key !== 'level'), ...Object.keys(TORUS_DETERMINANT_KEYS), ...Object.keys(TORUS_ABSENT)]

/** The binding the runtime hosts the Torus design on: the owner's readings, the device's one submit (the stage channel), and every
 * key the owner does not take disabled with the reason. */
export function torusDesignBinding(state: LiveTorusState | null, device: DeviceInstance = torusDevice(state), skyHeld: Readonly<Record<string, string>> = {},
  stage: FrameStageReading | null | undefined = hostedChrome()?.state?.instrumentStage ?? null, rack: QlRackState = qlRackState(1),
  run: StageRun | null = hostedChrome()?.run ?? null, held: Readonly<Record<string, Value>> = heldFor(TORUS_DESIGN_ID)): DesignBinding {
  const standing: Record<string, Standing> = {}
  for (const key of TORUS_KEYS) {
    const why = writeStanding(state, key)
    if (why) standing[key] = {disabled: why}
  }
  // The Rack page: M1′'s rack from the map's ledger, and the part you choose in your own hand (qlRack.ts).
  const page = rackPage(1, rack)
  Object.assign(standing, page.standing)
  // The Stage page: what the field disclosed, and its four acts through the frame's stage channel once there is a stage and a frame.
  const acting = !!stage && !!run
  if (stage) {
    for (const key of ['stage.slots', 'stage.bindings', 'stage.procedures']) standing[key] = {disabled: 'A reading of the stage the native field disclosed: its acts change it.'}
    standing['stage.last'] = {disabled: stage.last ? 'The last stage act\'s standing, as the owner returned it.' : NO_LAST}
    standing['stage.why'] = {disabled: stage.last?.why ? 'The owner\'s refusal of the last stage act, in its words.' : stage.last ? 'The last stage act was not refused.' : NO_LAST}
    for (const key of Object.keys(TORUS_STAGE_ACTS)) if (acting) delete standing[key]; else standing[key] = {disabled: NO_STAGE_FRAME}
  }
  const local: Record<string, (value: Value | undefined) => void> = {...page.local, ...handsFor(TORUS_DESIGN_ID, TORUS_STAGE_LOCAL)}
  const submit = device.submit
  const stageAct = async (change: ValueChange) => {
    if (!run) throw new Error(NO_STAGE_FRAME)
    const result = await run(torusStageCommand(change, held))
    if (!result.ok) throw new Error(result.error)
  }
  return {
    id: device.id,
    values: {...torusDesignValues(state), ...torusStageValues(stage, held), ...page.values},
    writes: key => (key in TORUS_STAGE_ACTS ? acting : key !== 'rack' && writeStanding(state, key) === null),
    standing,
    local,
    ...(page.waiting ? {waiting: ['rack']} : {}),
    ...(submit || acting ? {write: async (changes: readonly ValueChange[]) => {
      for (const change of changes.filter(c => c.key in TORUS_STAGE_ACTS)) await stageAct(change)
      const rows = changes.filter(c => !(c.key in TORUS_STAGE_ACTS))
      if (rows.length) { if (!submit) throw new Error(NOT_WRITABLE); await submit(torusRowChanges(rows)) }
    }} : {}),
    // The level or scale a planet moves (designBindings/skyModulation.ts): the status bar names the planet.
    ...(Object.keys(skyHeld).length ? {modulatedBy: skyHeld} : {}),
  }
}

// ── the device's picture ─────────────────────────────────────────────────────
// The torus the device wears at all three sizes (lock §0.2.3; FOUNDATION F5: no text-only cards). It is the M1 embedding's
// own outline — the surface x=(R+cos θ1)cos θ2, y=(R+cos θ1)sin θ2, z=sin θ1 with R and r from LIVE_TORUS_TOPOLOGY (the QL
// kernel's constants, cited there) — drawn as meridians and parallels seen from a fixed tilt, with the far side of the
// surface fainter than the near. It is geometry, not state: the oscillation (the cymatic, playable torus, sound and picture
// from one state) is the simulation's render on the stage and is never redrawn here (lock §0.2.2). Nothing in the outline
// claims a phase; the owner's standing tints it (torusTone) and that is all the owner's reading adds.

/** How densely each size draws the outline: more lines where there is more room. */
export const TORUS_FIGURE_DETAIL = {
  compact: {meridians: 12, parallels: 5},
  whole: {meridians: 18, parallels: 7},
  full: {meridians: 28, parallels: 11},
} as const

export type TorusFigureSize = keyof typeof TORUS_FIGURE_DETAIL

export interface TorusFigure {
  /** The outline's near side and far side, as SVG path data. */
  front: string
  back: string
  /** The viewBox that holds the whole outline, in the embedding's own units. */
  view: {x: number; y: number; width: number; height: number}
}

const TILT = 62 * Math.PI / 180
const STEPS = 72
const TAU = Math.PI * 2
const round = (value: number) => Math.round(value * 1000) / 1000

/** The torus outline for a size. Pure: the same size always draws the same figure. */
export function torusFigure(size: TorusFigureSize, topology: Pick<typeof LIVE_TORUS_TOPOLOGY, 'major_radius' | 'minor_radius'> = LIVE_TORUS_TOPOLOGY): TorusFigure {
  const {meridians, parallels} = TORUS_FIGURE_DETAIL[size]
  const R = topology.major_radius, r = topology.minor_radius
  const sin = Math.sin(TILT), cos = Math.cos(TILT)
  let front = '', back = ''
  // one point on the surface, seen from the tilt: its screen position and whether its outward normal faces the viewer
  const point = (theta1: number, theta2: number) => {
    const ring = R + r * Math.cos(theta1)
    const x = ring * Math.cos(theta2), y = ring * Math.sin(theta2), z = r * Math.sin(theta1)
    const ny = Math.cos(theta1) * Math.sin(theta2), nz = Math.sin(theta1)
    return {x, y: y * cos - z * sin, near: ny * sin + nz * cos > 0}
  }
  // a curve is drawn as runs: a run keeps going while the curve stays on one side of the surface, and starts afresh where it turns
  const curve = (at: (t: number) => {x: number; y: number; near: boolean}) => {
    let previous = at(0)
    let side: boolean | null = null
    for (let step = 1; step <= STEPS; step++) {
      const next = at(step / STEPS)
      const near = previous.near && next.near
      const move = side === near ? `L${round(next.x)} ${round(next.y)}` : `M${round(previous.x)} ${round(previous.y)}L${round(next.x)} ${round(next.y)}`
      if (near) front += move; else back += move
      side = near
      previous = next
    }
  }
  for (let index = 0; index < meridians; index++) { const theta2 = TAU * index / meridians; curve(t => point(TAU * t, theta2)) }
  for (let index = 0; index < parallels; index++) { const theta1 = TAU * index / parallels; curve(t => point(theta1, TAU * t)) }
  // the outline's extent: the ring's reach across, and its reach down once tilted (at θ2 = 90°, y' = R cos α + r cos(θ1 + α))
  const across = R + r, down = R * cos + r
  const pad = 0.15
  return {front, back, view: {x: round(-across - pad), y: round(-down - pad), width: round(2 * (across + pad)), height: round(2 * (down + pad))}}
}

/** How strongly the owner's standing lights the outline: following and held are the instrument at work, opening is on its way,
 * and manual, unavailable or no reading leave it unlit. A tint is a reading of the standing and nothing more. */
export function torusTone(state: LiveTorusState | null): 'lit' | 'rising' | 'unlit' {
  if (state === null || !state.ok) return 'unlit'
  const standing = state.value.standing
  return standing === 'following' || standing === 'held' ? 'lit' : standing === 'opening' ? 'rising' : 'unlit'
}
