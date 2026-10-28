// The M′ matrices on their owners (manual §22.6, with its Kernel page; the catalogue's design
// inhabitants/catalogue/panels/quaternal-logic__m-prime-matrices.tsx, `quaternal-logic:m-prime-matrices`). The matrices show values the
// instrument already uses and add no second oscillator (§22.6 Rules). Owners write, faces read (lock §0.4):
//   m2.tonics         the 84 lens modes of the basis shown: the tonic of each lens's seven modes, from QL's mode catalogue
//                     (ql.music-modes/v1 lens_cf, through the kernel's music_modes_read: native/liveModeCatalogue.ts readQlMusicModes);
//   m1.lens12, m1.context_frame   the lens and the mode in force: the Live transport's key and scale (native/liveModeCatalogue.ts
//                     setModeInForce; §22.6 Transport "Key, root and scale | Sets the lens and the mode. The Reading matrix follows
//                     them"); a new cell is that mode set on the transport (setLiveModeHold), the same hand Scale mapping uses
//                     (live/designBindings/scaleMappingBinding.ts);
//   form.address      the person's M3 form through the kernel's m3_reception (qlM3Clock.ts); a new address is its select-form;
//   form.matrix       the matrix the form stands under now ('complementary' | 'moving-resting' | 'same-quality'): the M3 state's
//                     form.matrix_axis (0..2, QL's MatrixFamily::ALL order, crates/ql-core/src/pole/codon.rs); Apply (`form.apply`, the
//                     family by name) is m3_reception's own `apply-matrix {family}`, which moves the form to its partner under that matrix
//                     and stands it under it (QL fold.rs apply_matrix), so a second press returns;
//   m1.cells          the family's 144 cells, each QL's own `ql kernel m1` answer through the kernel's ql_read (qlM1.ts);
//   matrix, valueForm, m1.basis, kernel.position, kernel.face   the view's own choices (DesignBinding.local): which matrix and value form
//                     show, which order of the twelve notes the served catalogue is read in (until held, the mode in force's), and the
//                     address of the kernel's sixfold form the operators read ("No owner names a kernel address for a matrix cell, so
//                     the address is yours", the design's own words);
//   m1.family, m1.row12, m1.col12   the M1 engine's config, which is its consumer's (crates/ql-mef/src/m1_engine.rs M1Engine: "Storage,
//                     authorization and realtime interpolation belong to its consumers"): the family whose matrix is read and the cell
//                     inspected, held by the view. The shell's engine opens where QL's own example request does (family 5, row 3,
//                     position 4: fixtures/kernel/m1-engine-v1.request.json); the Quintessence has no scalar (m1.rs `cell`:
//                     scalar_valid is family < 5), so its matrix is read only once you choose a family;
// and named absent, each with the route it waits on: the M1 clock's tick (m1.tick12) — no M1 clock runs in the shell; the 64 codons in address order (m3.codons) and the matrix partners (form.partners, and with them Partner and Scale) need
// `ql kernel m3` and ql_m3_apply_matrix as kernel ops; the Situation matrix has no owner (the M′ packets, QL-MEF #281); Follow has no
// owner operation and the design does not offer it. The Kernel page reads the kernel's operators on the address you hold (qlKernelApply.ts:
// `ql kernel apply` through ql_read kernel-apply: conjugate, complement, class, version, and the form and depth it read). Pure apart from
// the owners' hands the caller may replace.
import type {InhabitantFaceDeclaration} from '../../manifest'
import type {DesignBinding, Standing, Value, ValueChange} from '../../../frame/devices/designed'
import type {DeviceInstance} from '../../../frame/devices/deviceRuntime'
import type {M3Operation} from '../../../../../../../desktop/cradle/src/nara/nativeM3'
import {setLiveModeHold, setModeInForce, type LiveModeCatalogueState, type LiveModeHold} from '../../../native/liveModeCatalogue'
import type {KernelLensMode, QlMusicModes} from '../../../live/modes'
import {disabled, handsFor, missing} from '../../../techne/devices/designDevices'
import {techneDeviceId, techneFaceDeclaration} from './faces'
import {NO_FORM, applyQlM3, type QlM3State} from './qlM3Clock'
import type {QlM1State} from './qlM1'
import {KERNEL_READINGS, NO_ADDRESS, kernelAddressOf, kernelApplyState, kernelValues, kernelWhy, type KernelApplyState} from './qlKernelApply'

export const QL_MATRICES_FAMILY = 'quaternal-logic'
export const QL_MATRICES_FACE = 'm-prime-matrices'
/** The device's id on the door and its design's key: designKey('quaternal-logic', 'm-prime-matrices'). */
export const QL_MATRICES_DEVICE_ID = techneDeviceId(QL_MATRICES_FAMILY, QL_MATRICES_FACE)

/** The view's own keys: what shows, and the kernel address the operators read. */
export const QL_MATRICES_LOCAL = ['matrix', 'valueForm', 'm1.basis', 'kernel.position', 'kernel.face', 'm1.family', 'm1.row12', 'm1.col12'] as const
/** The keys an owner takes a change of: the mode in force's lens and frame, the form's address, Apply (the form's apply-matrix). */
export const QL_MATRICES_WRITES = ['m1.lens12', 'm1.context_frame', 'form.address', 'form.apply'] as const
/** QL's three M3 matrix families in their own order (MatrixFamily::ALL: Complementary, MovingResting, SameQuality), by the design's names. */
export const MATRIX_FAMILIES = ['complementary', 'moving-resting', 'same-quality'] as const

const NO_TICK = missing('The M1 clock\'s tick', 'a running M1 clock announced to the shell (QL\'s M1 engine answers the tick its request carries; '
  + 'nothing in the shell keeps an M1 clock)', 'Quaternal Logic')
/** Why the Oscillator's cells are not drawn: no family chosen, the cells being read, or QL's refusal. */
export const NO_FAMILY = 'The engine opens on the Quintessence (family 5), which has no scalar values: choose a family to read its 144 cells from QL\'s M1 engine (`ql kernel m1`).'
/** Where QL's own example request opens the engine (fixtures/kernel/m1-engine-v1.request.json config). */
export const M1_EXAMPLE_CELL = {family: 5, row12: 3, col12: 4} as const
const NO_CODONS = missing('The 64 codons in address order', 'the kernel op for `ql kernel m3` (the transcription of every form address); m3_reception '
  + 'reads only the form in force', 'Quaternal Logic, through the kernel')
const NO_PARTNERS = missing('The matrix partners', 'the kernel ops ql_m3_apply_matrix and ql_m3_apply_matrix_hexagram (each address\'s partner under '
  + 'the matrix, base by base or trigram by trigram)', 'Quaternal Logic, through the kernel')
/** The Situation matrix's words, which the design draws where its grid stands. */
export const QL_SITUATION_ABSENT = 'The Situation matrix has no owner yet: the M′ packets (QL-MEF #281) are commissioned, not landed.'

/** Why each key the matrices draw and no owner reports here is absent, or why its control is off (manual §16.12: "say which one"). */
export const QL_MATRICES_ABSENT: Readonly<Record<string, string>> = {
  'm1.tick12': NO_TICK,
  'm3.codons': NO_CODONS, 'form.partners': NO_PARTNERS, 'form.partner': NO_PARTNERS, 'form.scale': NO_PARTNERS,
}

/** The lens names in the design's row order: L0, L0′, L1 … L5′ (the catalogue writes the prime as an apostrophe). */
export const LENS_NAMES: readonly string[] = Array.from({length: 12}, (_, i) => `L${i >> 1}${i & 1 ? '\'' : ''}`)
const frameOf = (contextFrame: string | undefined) => { const m = /^CF([1-7])$/.exec(contextFrame ?? ''); return m ? Number(m[1]) : undefined }

/** The owners' hands, so a test can stand in for them. */
export interface QlMatricesWriters {
  readonly setHold: (patch: Partial<LiveModeHold>) => void
  readonly applyM3: (operations: readonly M3Operation[]) => Promise<void>
}
const OWNERS: QlMatricesWriters = {setHold: setLiveModeHold, applyM3: applyQlM3}

/** The matrices' whole state: the person's M3 form, the mode catalogue and the transport's mode, and the view's holds. */
export interface QlMatricesState {
  readonly m3: QlM3State
  readonly modes: {readonly reading: LiveModeCatalogueState; readonly hold: LiveModeHold}
  /** The view's own choices as held (heldFor(QL_MATRICES_DEVICE_ID)). */
  readonly held: Readonly<Record<string, Value>>
  /** The M1 engine's cells for the family held (qlM1.ts); absent where no reader stands. */
  readonly m1?: QlM1State
  /** The kernel's operators' answers for the address held (qlKernelApply.ts); absent where no reader stands. */
  readonly kernel?: KernelApplyState
}

/** The M1 engine's config as the view holds it, else as QL's example request opens it (M1_EXAMPLE_CELL). */
export function m1Config(held: Readonly<Record<string, Value>>): {family: number; row12: number; col12: number} {
  const at = (key: string, fallback: number, top: number) => { const x = held[key]; return Number.isInteger(x) && (x as number) >= 0 && (x as number) <= top ? x as number : fallback }
  return {family: at('m1.family', M1_EXAMPLE_CELL.family, 5), row12: at('m1.row12', M1_EXAMPLE_CELL.row12, 11), col12: at('m1.col12', M1_EXAMPLE_CELL.col12, 11)}
}
/** The family's cells, when the M1 reading answers for the family the view chose. */
const m1CellsOf = (state: QlMatricesState) => (state.m1?.cells && state.held['m1.family'] !== undefined && state.m1.family === m1Config(state.held).family ? state.m1.cells : null)
/** Why the Oscillator's cells are not drawn now. */
function m1Why(state: QlMatricesState): string {
  const family = state.held['m1.family']
  if (typeof family !== 'number') return NO_FAMILY
  if (state.m1?.family === family && state.m1.reason) return `QL's M1 engine refused: ${state.m1.reason}`
  return 'Reading the family\'s 144 cells from QL\'s M1 engine (`ql kernel m1`).'
}

const catalogueOf = (state: QlMatricesState): QlMusicModes | null => (state.modes.reading.state === 'ready' ? state.modes.reading.catalogue : null)
const catalogueWhy = (reading: LiveModeCatalogueState): string =>
  reading.state === 'refused' ? `The mode catalogue is refused: ${reading.reason}` : 'The mode catalogue is still being read from the owner.'
const lensRows = (catalogue: QlMusicModes): KernelLensMode[] => catalogue.scales.filter((scale): scale is KernelLensMode => scale.kind === 'lens-cf')

/** The lens mode in force on the transport, when the mode in force is one of the catalogue's lens modes. */
export function lensModeInForce(state: QlMatricesState): KernelLensMode | null {
  const mode = setModeInForce(state.modes.reading, state.modes.hold).mode
  return mode.state === 'in-force' && mode.selection.scale.kind === 'lens-cf' ? mode.selection.scale as KernelLensMode : null
}

/** The order of the twelve notes the matrices show: the view's hold, else the lens mode in force's basis; only a basis the owner serves. */
export function shownBasis(state: QlMatricesState): string | undefined {
  const catalogue = catalogueOf(state)
  if (!catalogue) return undefined
  const held = state.held['m1.basis']
  const basis = typeof held === 'string' ? held : lensModeInForce(state)?.anchorBasis
  return basis && catalogue.bases.some(item => item.basis === basis) ? basis : undefined
}

/** The tonic of each lens's seven modes in a basis, in the design's order (12 lenses × 7 frames); undefined when a row is missing. */
export function tonicsOf(catalogue: QlMusicModes, basis: string): number[][] | undefined {
  const rows = lensRows(catalogue).filter(row => row.anchorBasis === basis)
  const grid = LENS_NAMES.map(lens => Array.from({length: 7}, (_, j) => rows.find(row => row.lens === lens && frameOf(row.contextFrame) === j + 1)?.pitches[0]))
  return grid.every(row => row.every(tonic => tonic !== undefined)) ? grid as number[][] : undefined
}

const int = (x: unknown): x is number => Number.isSafeInteger(x)

/** The design's values: each key from the owner that reports it, the view's own as held. Only what the owners report. */
export function qlMatricesValues(state: QlMatricesState): Record<string, Value> {
  const values: Record<string, Value> = {}
  for (const key of QL_MATRICES_LOCAL) if (state.held[key] !== undefined) values[key] = state.held[key]!
  values.reason = QL_SITUATION_ABSENT
  const catalogue = catalogueOf(state), basis = shownBasis(state)
  if (catalogue && basis) {
    values['m1.basis'] = basis
    const tonics = tonicsOf(catalogue, basis)
    if (tonics) values['m2.tonics'] = JSON.stringify(tonics)
  }
  const inForce = catalogue ? lensModeInForce(state) : null
  const lens = inForce ? LENS_NAMES.indexOf(inForce.lens) : -1, frame = frameOf(inForce?.contextFrame)
  if (lens >= 0) values['m1.lens12'] = lens
  if (frame !== undefined) values['m1.context_frame'] = frame
  const form = state.m3.reading?.status === 'available' ? state.m3.reading.state : null
  if (form && int(form.form?.address)) values['form.address'] = form.form.address
  const axis = form?.form?.matrix_axis
  if (int(axis) && axis >= 0 && axis < MATRIX_FAMILIES.length) values['form.matrix'] = MATRIX_FAMILIES[axis]!
  const config = m1Config(state.held)
  values['m1.family'] = config.family; values['m1.row12'] = config.row12; values['m1.col12'] = config.col12
  const cells = m1CellsOf(state)
  if (cells) values['m1.cells'] = JSON.stringify(cells)
  // The Kernel page: the kernel's answers for the address you hold (qlKernelApply.ts).
  if (state.kernel && kernelAddressOf(state.held) === state.kernel.address) Object.assign(values, kernelValues(state.kernel))
  return values
}

/** Why the owners do not take a change of this key now, or null when they do. */
export function qlMatricesStanding(state: QlMatricesState, key: string): string | null {
  if (QL_MATRICES_ABSENT[key]) return QL_MATRICES_ABSENT[key]!
  if (key === 'm1.lens12' || key === 'm1.context_frame') {
    if (!catalogueOf(state)) return catalogueWhy(state.modes.reading)
    return shownBasis(state) ? null : 'Choose a basis first: the Reading reads the owner\'s modes in one of its two orders.'
  }
  if (key === 'form.address' || key === 'form.apply') return state.m3.reading?.status === 'available' && state.m3.reading.state ? null : state.m3.reason ?? NO_FORM
  if (key === 'form.matrix') return 'A reading: the matrix the form stands under (its M3 state); Apply moves the form under it.'
  if (key === 'm2.tonics') return catalogueOf(state) ? (shownBasis(state) ? 'A reading: the owner\'s mode catalogue.' : 'Choose a basis: the owner serves its modes in two orders.') : catalogueWhy(state.modes.reading)
  return `${key}: no setting of the matrices.`
}

/** Apply the design's changes through the owners: the cell of the Reading as the transport's mode, the form's address as its select-form.
 * Throws in words for one the owners do not take, before any is applied. */
export async function applyQlMatricesChanges(state: QlMatricesState, changes: readonly ValueChange[], writers: QlMatricesWriters = OWNERS): Promise<void> {
  let lens: number | undefined, frame: number | undefined, address: number | undefined, family: number | undefined
  for (const {key, value} of changes) {
    const why = qlMatricesStanding(state, key)
    if (why) throw new Error(why)
    if (key === 'm1.lens12') { if (!int(value) || value < 0 || value > 11) throw new Error('The lens is one of twelve, 0 to 11.'); lens = value }
    else if (key === 'm1.context_frame') { if (!int(value) || value < 1 || value > 7) throw new Error('The context frame is 1 to 7.'); frame = value }
    else if (key === 'form.address') { if (!int(value) || value < 0 || value > 63) throw new Error('The form is one of 64 addresses, 0 to 63.'); address = value }
    else if (key === 'form.apply') {
      const at = MATRIX_FAMILIES.indexOf(value as typeof MATRIX_FAMILIES[number])
      if (at < 0) throw new Error('Apply takes one of QL\'s three matrices: complementary, moving-resting or same-quality.')
      family = at
    }
  }
  const acts: (() => void | Promise<void>)[] = []
  if (lens !== undefined || frame !== undefined) {
    const inForce = lensModeInForce(state)
    const atLens = lens ?? (inForce ? LENS_NAMES.indexOf(inForce.lens) : -1), atFrame = frame ?? frameOf(inForce?.contextFrame)
    if (atLens < 0 || atFrame === undefined) throw new Error('No lens mode is in force: choose the lens and the context frame together, as the cell does.')
    const basis = shownBasis(state)!
    const row = lensRows(catalogueOf(state)!).find(item => item.anchorBasis === basis && item.lens === LENS_NAMES[atLens] && frameOf(item.contextFrame) === atFrame)
    if (!row) throw new Error(`The catalogue serves no mode on ${LENS_NAMES[atLens]} at CF${atFrame} in the ${basis} basis.`)
    acts.push(() => writers.setHold({root: row.pitches[0]!, key: row.key}))
  }
  if (address !== undefined) acts.push(() => writers.applyM3([{operation: 'select-form', address: address!}]))
  if (family !== undefined) acts.push(() => writers.applyM3([{operation: 'apply-matrix', family: family!}]))
  for (const act of acts) await act()
}

/** The binding the runtime hosts the matrices' design on: the owners' readings and hands, the view's own keys in its own hand, and every
 * key no owner carries named with the route it waits on. */
export function qlMatricesBinding(state: QlMatricesState, writers: QlMatricesWriters = OWNERS): DesignBinding {
  const standing: Record<string, Standing> = {...disabled(QL_MATRICES_ABSENT)}
  for (const key of [...QL_MATRICES_WRITES, 'm2.tonics', 'form.matrix']) {
    const why = qlMatricesStanding(state, key)
    if (why) standing[key] = {disabled: why}
  }
  standing['m1.cells'] = {disabled: m1CellsOf(state) ? 'A reading: each cell is QL\'s M1 engine\'s answer for it.' : m1Why(state)}
  const kernel = state.kernel ?? kernelApplyState()
  const kernelHere = kernelAddressOf(state.held) === kernel.address ? kernel : {address: null, reading: {ok: false as const, reason: NO_ADDRESS}, busy: false}
  for (const key of KERNEL_READINGS) standing[key] = {disabled: kernelAddressOf(state.held) ? kernelWhy(kernelHere) : NO_ADDRESS}
  const live = state.m3.reading?.status === 'available' && !!state.m3.reading.state
  const m1Busy = !!state.m1?.busy && state.held['m1.family'] !== undefined && state.m1.family === m1Config(state.held).family
  return {
    id: QL_MATRICES_DEVICE_ID,
    values: qlMatricesValues(state),
    standing,
    local: handsFor(QL_MATRICES_DEVICE_ID, QL_MATRICES_LOCAL),
    writes: key => qlMatricesStanding(state, key) === null,
    write: changes => applyQlMatricesChanges(state, changes, writers),
    // A first read in flight: the catalogue's tonics, or the form, wait rather than drawing as none.
    ...(state.modes.reading.state === 'loading' || (state.m3.busy && !live) || m1Busy
      ? {waiting: [...(state.modes.reading.state === 'loading' ? ['m2.tonics', 'm1.basis', 'm1.lens12', 'm1.context_frame'] : []), ...(state.m3.busy && !live ? ['form.address'] : []),
        ...(m1Busy ? ['m1.cells'] : [])]} : {}),
  }
}

/** The matrices as a device of the runtime: its design draws its values (no rows of its own). */
export function qlMatricesDevice(face: InhabitantFaceDeclaration): DeviceInstance {
  return {id: QL_MATRICES_DEVICE_ID, family: QL_MATRICES_FAMILY, face: techneFaceDeclaration(face), rows: [], values: {}}
}
