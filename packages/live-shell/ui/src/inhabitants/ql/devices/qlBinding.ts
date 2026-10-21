// Binding on its owners (manual §22.8; the catalogue's design inhabitants/catalogue/panels/quaternal-logic__binding.tsx,
// `quaternal-logic:binding`). Binding is M3′'s view of form as charge, and it runs its own physics over the kernel's symbols: it takes
// from the kernel only the codons, their charges, their pairing and their counts (§22.8 Rules). Owners write, faces read (lock §0.4):
//   cell.hexagram     the form's hexagram: the person's M3 form through the kernel's m3_reception (qlM3Clock.ts; ql.m3-state/v1
//                     form.hexagram is the form's address read as a hexagram, crates/ql-mef/src/m3_state.rs `form`);
//   binding.on, pairing.matrix, charge.register, nonets.show, string.tension, coupling.scale   the device's own settings, held by the
//                     view (DesignBinding.local): its own physics and its own choice of the matrix whose cell it draws (§22.8 "It
//                     belongs to Binding's own physics");
// and named absent, each with the operation that would carry it:
//   the generation cell (cell.lower, upper, positive, negative, nonDual) — the kernel's ql_m3_generate has no kernel op: m3_reception
//   reads the form's hexagram, not the cell a matrix gives at it; the cell's codons' coin values and charges follow the cell (ql_m3_codon);
//   the nonet (m2.index, nonet) — the 9:8 compression (ql_m3_epogdoon) has no kernel op; the event behind the last motion (event.kind,
//   event.what) — the kernel publishes no inscription, matrix or line event to the shell; Binding's engine readings (coupling.alpha,
//   string.stretch, string.energy) — the device's string engine over the cell is not built; Skin — neither the Torus nor the M3 clock
//   takes another device's layer; Stretch → Q — no route carries the stretch to the Resonance's Q through M2.
// Pure apart from the view's holds, which the caller hands in (techne/devices/designDevices.ts heldFor/hold).
import type {InhabitantFaceDeclaration} from '../../manifest'
import type {DesignBinding, Standing, Value} from '../../../frame/devices/designed'
import type {DeviceInstance} from '../../../frame/devices/deviceRuntime'
import {disabled, handsFor, missing} from '../../../techne/devices/designDevices'
import {techneDeviceId, techneFaceDeclaration} from './faces'
import {NO_FORM, type QlM3State} from './qlM3Clock'

export const QL_BINDING_FAMILY = 'quaternal-logic'
export const QL_BINDING_FACE = 'binding'
/** The device's id on the door and its design's key: designKey('quaternal-logic', 'binding'). */
export const QL_BINDING_DEVICE_ID = techneDeviceId(QL_BINDING_FAMILY, QL_BINDING_FACE)

/** The device's own settings: Binding's physics and its choices, held by the view, never sent to an owner. */
export const QL_BINDING_LOCAL = ['binding.on', 'pairing.matrix', 'charge.register', 'nonets.show', 'string.tension', 'coupling.scale'] as const

const NO_CELL = missing('The generation cell', 'the kernel op ql_m3_generate (the matrix\'s generation cell at the form\'s hexagram) — m3_reception reads the '
  + 'form\'s hexagram, not the cell a matrix gives at it', 'Quaternal Logic, through the kernel')
const NO_CODONS = missing('The cell\'s coin values and charges', 'the cell\'s two codons read through ql_m3_codon — they follow the cell, which ql_m3_generate gives',
  'Quaternal Logic, through the kernel')
const NO_NONET = missing('The nonet', 'the kernel op ql_m3_epogdoon (nine M2 positions resolving into eight M3 positions)', 'Quaternal Logic, through the kernel')
const NO_EVENT = missing('The event behind the last motion', 'the kernel\'s events — an inscription, a matrix change, a line change — published to the shell',
  'the kernel')
const NO_ENGINE = missing('Binding\'s engine readings', 'Binding\'s string engine over the cell: the coupling at its scale, the stretch and the energy by '
  + 'V(r) = −(4/3)·α_s·ħc/r + σr (manual §22.8)', 'the shell')
const NO_SKIN = missing('Drawn on the Torus or the M3 clock', 'a layer the Torus and the M3 clock take from another device', 'the shell')
const NO_STRETCH_Q = missing('Stretch → Q', 'a route from Binding\'s stretch to the Resonance\'s Q factor through M2 (cymatics.dampingQFactor)', 'the Expressions engine')

/** Why each key Binding draws and no owner reports here is absent, or why its control is off (manual §16.12: "say which one"). */
export const QL_BINDING_ABSENT: Readonly<Record<string, string>> = {
  'cell.lower': NO_CELL, 'cell.upper': NO_CELL, 'cell.positive': NO_CELL, 'cell.negative': NO_CELL, 'cell.nonDual': NO_CELL,
  'values.positive': NO_CODONS, 'values.negative': NO_CODONS, 'charges.positive': NO_CODONS, 'charges.negative': NO_CODONS,
  'm2.index': NO_NONET, nonet: NO_NONET, 'event.kind': NO_EVENT, 'event.what': NO_EVENT,
  'coupling.alpha': NO_ENGINE, 'string.stretch': NO_ENGINE, 'string.energy': NO_ENGINE,
  skin: NO_SKIN, 'sound.stretchQ': NO_STRETCH_Q,
}

/** What the view holds and what the M3 reception reads: Binding's whole state. */
export interface QlBindingState {
  readonly m3: QlM3State
  /** The device's own settings as the view holds them (heldFor(QL_BINDING_DEVICE_ID)). */
  readonly held: Readonly<Record<string, Value>>
}

const int = (x: unknown): x is number => Number.isSafeInteger(x)

/** The design's values: the form's hexagram from the reception, the device's own settings as held. Only what the owners report. */
export function qlBindingValues(state: QlBindingState): Record<string, Value> {
  const values: Record<string, Value> = {}
  for (const key of QL_BINDING_LOCAL) if (state.held[key] !== undefined) values[key] = state.held[key]!
  const form = state.m3.reading?.status === 'available' ? state.m3.reading.state : null
  if (form && int(form.form?.address)) values['cell.hexagram'] = form.form.address
  return values
}

/** The binding the runtime hosts Binding's design on: the reception's reading, the view's own hands for the device's settings, and every
 * key no owner carries named with the operation it waits on. Nothing writes to an owner: Binding takes only the kernel's symbols. */
export function qlBindingBinding(state: QlBindingState): DesignBinding {
  const standing: Record<string, Standing> = {...disabled(QL_BINDING_ABSENT)}
  const live = state.m3.reading?.status === 'available' && !!state.m3.reading.state
  standing['cell.hexagram'] = {disabled: live ? 'A reading: the form\'s hexagram, chosen in the Nara instrument\'s M3 page (select-form).' : state.m3.reason ?? NO_FORM}
  return {
    id: QL_BINDING_DEVICE_ID,
    values: qlBindingValues(state),
    standing,
    local: handsFor(QL_BINDING_DEVICE_ID, QL_BINDING_LOCAL),
    enabledKey: 'binding.on',
    // The first read of the form is in flight: the hexagram waits, and is not drawn as none.
    ...(state.m3.busy && !live ? {waiting: ['cell.hexagram']} : {}),
  }
}

/** Binding as a device of the runtime: its design draws its values (no rows of its own). */
export function qlBindingDevice(face: InhabitantFaceDeclaration): DeviceInstance {
  return {id: QL_BINDING_DEVICE_ID, family: QL_BINDING_FAMILY, face: techneFaceDeclaration(face), rows: [], values: {}}
}
