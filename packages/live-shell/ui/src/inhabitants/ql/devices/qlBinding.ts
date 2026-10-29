// Binding on its owners (manual §22.3 "The Binding skin", which took in §22.8's Binding device in the 22 Oct manual rewrite: Binding is no
// device of its own, its design quaternal-logic__binding.tsx retired; the M3 clock carries this binding as its Binding skin under `binding.`,
// TechneDevices.tsx qlFaceEntry). Binding is M3′'s view of form as charge, and it runs its own physics over the kernel's symbols: it takes
// from the kernel only the codons, their charges, their pairing and their counts (§22.8 Rules). Owners write, faces read (lock §0.4):
//   cell.hexagram     the form's hexagram: the person's M3 form through the kernel's m3_reception (qlM3Clock.ts; ql.m3-state/v1
//                     `generation.hexagram_id`, else the form's address read as a hexagram, crates/ql-mef/src/m3_state.rs `form`);
//   cell.lower, cell.upper, cell.positive, cell.negative, cell.nonDual, charges.positive, charges.negative   the generation cell of that
//                     hexagram under the pairing's matrix: one of the three cells the state carries (`generation.cells`, QL-MEF ec79681:
//                     lower_pair / upper_pair / positive / negative `.sequence`, `non_dual`, each codon's `charges_pp_mm_mp_pm`);
//   binding.on, pairing.matrix, charge.register, nonets.show, string.tension, coupling.scale   the device's own settings, held by the
//                     view (DesignBinding.local): its own physics and its own choice of the matrix whose cell it draws (§22.8 "It
//                     belongs to Binding's own physics"); until the pairing is held it is the matrix the form's law is read under
//                     (`law.matrix.family`), and choosing another reads that matrix's cell — Binding writes nothing to the form;
//   values.positive, values.negative, coupling.alpha, string.stretch, string.energy, event.kind, event.what   Binding's engine over the
//                     same cell (qlBindingEngine.ts: `ql kernel m3-binding`, QL-MEF crates/ql-mef/src/m3_binding.rs, LightBox's QCD law): each
//                     codon's sites' coin values, the coupling at its scale, the string's stretch (the charge between its two ends, one
//                     unit to the meson's rest length) and its Cornell energy, and the kernel event behind the last motion, read from the
//                     form's last applied receipt (an inscription, a matrix change, a line change). The engine reads with Binding's own
//                     Charge, Tension and Coupling, held, else the manual's starting values, which then stand as the settings' values;
// and named absent, each with the operation that would carry it:
//   the nonet (m2.index, nonet) — the 9:8 compression (ql_m3_epogdoon) has no kernel op, and the M3 state carries no M2 position to
//   compress (m3_reception opens it with no M2 basis); Skin — the M3 clock's own Skin chooses it there (qlM3Clock.ts QL_M3_LOCAL), and the
//   Torus takes no other device's layer; Stretch → Q — no route carries the stretch to the Resonance's Q through M2.
// Pure apart from the view's holds and the engine's reading, which the caller hands in (techne/devices/designDevices.ts heldFor/hold,
// qlBindingEngine.ts useBindingEngine).
import type {InhabitantFaceDeclaration} from '../../manifest'
import type {DesignBinding, Standing, Value} from '../../../frame/devices/designed'
import type {DeviceInstance} from '../../../frame/devices/deviceRuntime'
import {disabled, handsFor, missing} from '../../../techne/devices/designDevices'
import {techneDeviceId, techneFaceDeclaration} from './faces'
import {NO_FORM, type QlM3State} from './qlM3Clock'
import {BINDING_STARTS, bindingKey, bindingRequestOf, type BindingEngineState} from './qlBindingEngine'

export const QL_BINDING_FAMILY = 'quaternal-logic'
export const QL_BINDING_FACE = 'binding'
/** The device's id on the door and its design's key: designKey('quaternal-logic', 'binding'). */
export const QL_BINDING_DEVICE_ID = techneDeviceId(QL_BINDING_FAMILY, QL_BINDING_FACE)

/** The device's own settings: Binding's physics and its choices, held by the view, never sent to an owner. */
export const QL_BINDING_LOCAL = ['binding.on', 'pairing.matrix', 'charge.register', 'nonets.show', 'string.tension', 'coupling.scale'] as const

const NO_NONET = missing('The nonet', 'the kernel op ql_m3_epogdoon (nine M2 positions resolving into eight M3 positions), and an M2 position for the form '
  + '(m3_reception opens the M3 state with no M2 basis)', 'Quaternal Logic, through the kernel')
const NO_SKIN = missing('Drawn on the Torus', 'a layer the Torus takes from another device (the M3 clock draws the skin by its own Skin)', 'the shell')
const NO_STRETCH_Q = missing('Stretch → Q', 'a route from Binding\'s stretch to the Resonance\'s Q factor through M2 (cymatics.dampingQFactor)', 'the Expressions engine')

/** Why each key Binding draws and no owner reports here is absent, or why its control is off (manual §16.12: "say which one"). */
export const QL_BINDING_ABSENT: Readonly<Record<string, string>> = {
  'm2.index': NO_NONET, nonet: NO_NONET, skin: NO_SKIN, 'sound.stretchQ': NO_STRETCH_Q,
}
/** The engine's readings (qlBindingEngine.ts): drawn when it has answered for the cell and the settings drawn, else waiting or named. */
export const QL_BINDING_ENGINE_KEYS = ['values.positive', 'values.negative', 'coupling.alpha', 'string.stretch', 'string.energy', 'event.kind', 'event.what'] as const
const ENGINE_ASKING = 'Asking Binding\'s engine (`ql kernel m3-binding`) of this cell…'
const SINGLET = 'A singlet: the cell is one codon, so no charge lies between two ends, no string is drawn, and it has no energy.'
const NO_MOTION = 'No M3 event has moved the cell yet: the form\'s receipts name no inscription, matrix change or line change.'
const READ = 'A reading of Binding\'s engine (`ql kernel m3-binding`) over the cell, with Binding\'s own Charge, Tension and Coupling.'

/** What the view holds and what the M3 reception reads: Binding's whole state. */
export interface QlBindingState {
  readonly m3: QlM3State
  /** The device's own settings as the view holds them (heldFor(QL_BINDING_DEVICE_ID)). */
  readonly held: Readonly<Record<string, Value>>
  /** Binding's engine's reading (qlBindingEngine.ts), or none while it is not asked. */
  readonly engine?: BindingEngineState
}

const int = (x: unknown): x is number => Number.isSafeInteger(x)
const record = (x: unknown): Record<string, any> | undefined => (x && typeof x === 'object' && !Array.isArray(x) ? x as Record<string, any> : undefined)
const charges = (x: unknown) => (Array.isArray(x) && x.length === 4 && x.every(n => Number.isSafeInteger(n)) ? JSON.stringify(x) : undefined)

/** The generation cell Binding draws: the state's cell of the form's hexagram under the pairing's matrix, else under the law's. */
export function bindingCell(state: QlBindingState): {matrix: string | undefined; cell: Record<string, any> | undefined; hexagram: number | undefined} {
  const form = state.m3.reading?.status === 'available' ? record(state.m3.reading.state) : undefined
  const generation = record(form?.generation), law = record(form?.law)
  const inForce = typeof law?.matrix?.family === 'string' ? law.matrix.family as string : undefined
  const held = state.held['pairing.matrix'], matrix = typeof held === 'string' ? held : inForce
  const cells = Array.isArray(generation?.cells) ? generation!.cells.map(record).filter(Boolean) as Record<string, any>[] : []
  const cell = cells.find(item => item.matrix?.family === matrix) ?? (matrix === inForce ? record(generation?.cell) : undefined)
  const hexagram = int(generation?.hexagram_id) ? generation!.hexagram_id as number : int(form?.form?.address) ? form!.form.address as number : undefined
  return {matrix, cell, hexagram}
}

/** The design's values: the form's hexagram and its generation cell from the reception, the device's own settings as held. */
export function qlBindingValues(state: QlBindingState): Record<string, Value> {
  const values: Record<string, Value> = {}
  for (const key of QL_BINDING_LOCAL) if (state.held[key] !== undefined) values[key] = state.held[key]!
  const {matrix, cell, hexagram} = bindingCell(state)
  if (hexagram !== undefined) values['cell.hexagram'] = hexagram
  if (matrix !== undefined && values['pairing.matrix'] === undefined) values['pairing.matrix'] = matrix
  if (typeof cell?.lower_pair?.sequence === 'string') values['cell.lower'] = cell.lower_pair.sequence
  if (typeof cell?.upper_pair?.sequence === 'string') values['cell.upper'] = cell.upper_pair.sequence
  if (typeof cell?.positive?.sequence === 'string') values['cell.positive'] = cell.positive.sequence
  if (typeof cell?.negative?.sequence === 'string') values['cell.negative'] = cell.negative.sequence
  if (typeof cell?.non_dual === 'boolean') values['cell.nonDual'] = cell.non_dual
  const plus = charges(cell?.positive?.charges_pp_mm_mp_pm), minus = charges(cell?.negative?.charges_pp_mm_mp_pm)
  if (plus) values['charges.positive'] = plus
  if (minus) values['charges.negative'] = minus
  // The physics the engine reads with: Binding's own, held, else the manual's starting values.
  for (const [key, start] of Object.entries(BINDING_STARTS)) if (values[key] === undefined) values[key] = start
  const answer = engineAnswer(state)
  if (answer) {
    const coins = (x: unknown) => (Array.isArray(x) && x.length === 3 && x.every(n => Number.isSafeInteger(n)) ? JSON.stringify(x) : undefined)
    const put = (key: string, value: Value | undefined) => { if (value !== undefined) values[key] = value }
    put('values.positive', coins(answer.cell?.positive?.coin_values))
    put('values.negative', coins(answer.cell?.negative?.coin_values))
    put('coupling.alpha', Number.isFinite(answer.coupling?.alpha_s) ? answer.coupling.alpha_s : undefined)
    put('string.stretch', Number.isFinite(answer.string?.stretch_fm) ? answer.string.stretch_fm : undefined)
    put('string.energy', Number.isFinite(answer.string?.energy_gev) ? answer.string.energy_gev : undefined)
    put('event.kind', typeof answer.event?.kind === 'string' ? answer.event.kind : undefined)
    put('event.what', typeof answer.event?.what === 'string' ? answer.event.what : undefined)
  }
  return values
}

/** The engine's answer when it is the answer for the cell and the settings drawn now; else undefined. */
function engineAnswer(state: QlBindingState): Record<string, any> | undefined {
  const engine = state.engine, key = bindingKey(bindingRequestOf(state.m3, state.held))
  return engine && key !== null && engine.key === key && engine.reading?.ok ? engine.reading.answer : undefined
}
/** Why the cell's keys are not drawn when the state carries no cell for the pairing. */
const NO_GENERATION = 'The form\'s state carries no generation cell for this matrix (ql.m3-state/v1 generation): a reading, when it does.'
const CELL_KEYS = ['cell.lower', 'cell.upper', 'cell.positive', 'cell.negative', 'cell.nonDual', 'charges.positive', 'charges.negative'] as const

/** The binding the runtime hosts Binding's design on: the reception's reading, the view's own hands for the device's settings, and every
 * key no owner carries named with the operation it waits on. Nothing writes to an owner: Binding takes only the kernel's symbols. */
export function qlBindingBinding(state: QlBindingState): DesignBinding {
  const standing: Record<string, Standing> = {...disabled(QL_BINDING_ABSENT)}
  const live = state.m3.reading?.status === 'available' && !!state.m3.reading.state
  standing['cell.hexagram'] = {disabled: live ? 'A reading: the form\'s hexagram, chosen in the Nara instrument\'s M3 page (select-form).' : state.m3.reason ?? NO_FORM}
  const values = qlBindingValues(state)
  for (const key of CELL_KEYS) {
    standing[key] = {disabled: key in values ? 'A reading: the generation cell of the form\'s hexagram under the pairing\'s matrix.' : live ? NO_GENERATION : state.m3.reason ?? NO_FORM}
  }
  // The engine's readings: read, waiting for its answer to the cell drawn now, or named in its words.
  const engine = state.engine, key = bindingKey(bindingRequestOf(state.m3, state.held)), answer = engineAnswer(state)
  const stale = !answer && live && key !== null && (!engine || engine.key !== key || engine.busy)
  const refused = engine && engine.key === key && engine.reading && !engine.reading.ok ? engine.reading.reason : undefined
  for (const k of QL_BINDING_ENGINE_KEYS) {
    if (k in values) { standing[k] = {disabled: READ}; continue }
    standing[k] = {disabled: !live ? state.m3.reason ?? NO_FORM : refused ?? (answer ? (k === 'string.energy' ? SINGLET : k.startsWith('event.') ? NO_MOTION : READ) : ENGINE_ASKING)}
  }
  const waits = stale ? [...QL_BINDING_ENGINE_KEYS] : []
  return {
    id: QL_BINDING_DEVICE_ID,
    values,
    standing,
    local: handsFor(QL_BINDING_DEVICE_ID, QL_BINDING_LOCAL),
    enabledKey: 'binding.on',
    // The first read of the form is in flight: the hexagram waits, and is not drawn as none; the engine's readings wait for its answer.
    ...(state.m3.busy && !live ? {waiting: ['cell.hexagram', ...CELL_KEYS, ...QL_BINDING_ENGINE_KEYS]} : waits.length ? {waiting: waits} : {}),
  }
}

/** Binding as a device of the runtime: its design draws its values (no rows of its own). */
export function qlBindingDevice(face: InhabitantFaceDeclaration): DeviceInstance {
  return {id: QL_BINDING_DEVICE_ID, family: QL_BINDING_FAMILY, face: techneFaceDeclaration(face), rows: [], values: {}}
}
