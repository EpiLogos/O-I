// The M3 clock on its owner (DLW §22; the catalogue's design inhabitants/catalogue/panels/quaternal-logic__m3-clock.tsx,
// `quaternal-logic:m3-clock`). The owner is Quaternal Logic's M3 state (`ql.m3-state/v1`, crates/ql-mef/src/m3_state.rs), the person's
// own and private, reached through the kernel op m3_reception (desktop/cradle/kernel/src/m3_reception.rs, `oi.m3-reception-context/v1`)
// on the same encounter the hosted frame's Nara instrument uses (desktop/cradle/src/expressions/naraChannel.ts, operation 'm3'): the
// chosen Nara identity (nara/identity/current.ts) and the open native Expression (the frame's `nativeScene`), project O-I as the
// frame's channel has it (expressions-boundary cradle.ts createCradleOwners, attached by panels/expressions.tsx).
// Owners write, faces read (lock §0.4):
//   clock.degree720, clock.tick12, clock.backbone, aperture.index, form.address, form.codon   the state's own readings;
//   law.matrix, law.seed, law.poseMap      the generation law (ql.m3-state/v1 `law`, QL-MEF ec79681: law.matrix.family,
//                                          law.seed.in_force.law, law.pose_map.in_force; QL's names, crates/ql-mef/src/m3_state/form_cell.rs);
//   generation.lower, upper, positive, negative, nonDual   the cell of the form's hexagram under that matrix (`generation.cell`:
//                                          lower_pair / upper_pair / positive / negative `.sequence`, `non_dual`);
//   a new degree is the owner's `advance-clock{steps}` forward by the difference on the double cover, a new cut its `set-aperture`, a new
//   matrix its `set-matrix{family}` (QL's SetMatrix, carried by m3_reception: the matrix is chosen without turning the form);
//   rack, rack.part                        the Rack page: M3′'s rack from the map's ledger and the part you choose (qlRack.ts).
// Turn, Open, Readout and Reciprocal are the view's own (DesignBinding.local). The seed and the pose map are readings: QL's state names
// the law in force and offers no operation that sets them. With no identity chosen, no Expression open, or no form
// opened for them (status 'absent': the Nara instrument's M3 page opens it), every value stands absent and the well says which.
// Pure apart from the one kernel call, which takes the call it is given, and the small store the views share.
import {useEffect, useSyncExternalStore} from 'react'
import {detectTransport, kernelOp, type KernelOpCall} from '../../../../../../../desktop/cradle/src/kernel/bridge'
import type {KernelOp} from '../../../../../../../desktop/cradle/src/kernel/types'
import type {NativeDialogueRequest} from '../../../../../../../desktop/cradle/src/nara/dialogueTypes'
import type {M3Gesture, M3Operation, NativeM3Reading} from '../../../../../../../desktop/cradle/src/nara/nativeM3'
import {currentIdentity, type CurrentIdentity} from '../../../../../../../desktop/cradle/src/nara/identity/current'
import {useHostedChrome} from '../../../projections/expressionsPaneHost'
import type {SdkParamRow} from '../../sdk/define'
import type {InhabitantFaceDeclaration} from '../../manifest'
import type {DesignBinding, Standing, Value, ValueChange} from '../../../frame/devices/designed'
import type {DeviceInstance, ParamValue} from '../../../frame/devices/deviceRuntime'
import {techneDeviceId, techneFaceDeclaration} from './faces'
import {qlRackState, rackPage, type QlRackState} from './qlRack'

export const QL_M3_FAMILY = 'quaternal-logic'
export const QL_M3_FACE = 'm3-clock'
/** The device's id on the door and its design's key: designKey('quaternal-logic', 'm3-clock'). */
export const QL_M3_DEVICE_ID = techneDeviceId(QL_M3_FAMILY, QL_M3_FACE)
/** The project the frame's Nara channel asks under (expressions-boundary cradle.ts, panels/expressions.tsx `project: 'O-I'`). */
export const QL_M3_PROJECT = 'O-I'

/** The encounter the M3 owner is bound to: the chosen identity and the open native Expression. */
export interface M3Basis {
  readonly identity: CurrentIdentity
  readonly expression: {readonly expression_ref: string; readonly revision: number}
}

export const NO_IDENTITY = 'No Nara identity is chosen: the M3 form is the person\'s own. Choose one in the Nara instrument.'
export const NO_EXPRESSION = 'No native Expression is open: the M3 form belongs to one.'
export const NO_FORM = 'No M3 form is open for this person and Expression: open it from the Nara instrument\'s M3 page.'

/** The encounter request, as the frame's Nara channel builds it for operation 'm3' (naraChannel.ts). */
export function m3Binding(basis: M3Basis): NativeDialogueRequest {
  const {identity, expression} = basis
  return {operation: 'context', source_ref: identity.source.source_ref, expected_revision: identity.source.revision,
    person_ref: identity.reading.person_ref, nara_ref: identity.reading.nara_ref, expression_ref: expression.expression_ref, role: 'nara'}
}

export type M3Answer = {readonly ok: true; readonly reading: NativeM3Reading} | {readonly ok: false; readonly reason: string}

/** The owner's answer, admitted only when it is the M3 context of this encounter. */
export function readM3Answer(answer: KernelOpCall, basis: M3Basis): M3Answer {
  if (answer.outcome == null) return {ok: false, reason: answer.error ?? 'The native M3 owner did not answer.'}
  const outcome = answer.outcome as {result?: string; data?: NativeM3Reading}
  if (outcome.result !== 'm3_reception' || !outcome.data) return {ok: false, reason: `The kernel answered \`${outcome.result ?? 'unknown'}\`, not \`m3_reception\`.`}
  const value = outcome.data
  if (value.schema !== 'oi.m3-reception-context/v1' || value.expression_ref !== basis.expression.expression_ref || value.expression_revision !== basis.expression.revision
    || value.person_ref !== basis.identity.reading.person_ref || value.identity_revision !== basis.identity.source.revision)
    return {ok: false, reason: 'The native M3 answer belongs to another person, Expression or revision.'}
  return {ok: true, reading: value}
}

export type KernelCall = (op: KernelOp) => Promise<KernelOpCall>

/** One gesture to the owner on this encounter. */
export async function m3Through(call: KernelCall, basis: M3Basis, request: M3Gesture): Promise<M3Answer> {
  try {
    return readM3Answer(await call({op: 'm3_reception', project: QL_M3_PROJECT, request: {...request, binding: m3Binding(basis)}} as KernelOp), basis)
  } catch (error) {
    return {ok: false, reason: `The kernel could not be asked for the M3 form: ${error instanceof Error ? error.message : String(error)}`}
  }
}

// ── the store the views share ───────────────────────────────────────────────

export interface M3View {readonly turn?: Value; readonly open?: Value; readonly readout?: Value; readonly reciprocal?: Value; readonly skin?: Value}
export interface QlM3State {
  /** The encounter's key; null with the reason when there is none. */
  readonly key: string | null
  readonly basis: M3Basis | null
  readonly reading: NativeM3Reading | null
  readonly reason: string | null
  readonly busy: boolean
  readonly view: M3View
}
const INITIAL: QlM3State = {key: null, basis: null, reading: null, reason: NO_IDENTITY, busy: false, view: {}}
let state: QlM3State = INITIAL
let sequence = 0
let call: KernelCall = op => kernelOp(detectTransport(), op)
const listeners = new Set<() => void>()
const setState = (next: QlM3State) => { if (next !== state) { state = next; for (const listener of [...listeners]) listener() } }

export function qlM3State(): QlM3State { return state }

const keyOf = (basis: M3Basis) => `${basis.identity.selection_ref}|${basis.identity.source.revision}|${basis.expression.expression_ref}|${basis.expression.revision}`

/** Follow the encounter: a new one is read once; none says why. Only the newest answer stands. */
export async function syncQlM3(basis: M3Basis | null, why: string | null = null): Promise<void> {
  if (!basis) { if (state.key !== null || state.reason !== why) setState({...state, key: null, basis: null, reading: null, reason: why ?? NO_IDENTITY, busy: false}); return }
  const key = keyOf(basis)
  if (key === state.key) return
  const ticket = ++sequence
  setState({...state, key, basis, reading: null, reason: null, busy: true})
  const answer = await m3Through(call, basis, {operation: 'read'})
  if (ticket !== sequence) return
  setState({...state, busy: false, reading: answer.ok ? answer.reading : null, reason: answer.ok ? (answer.reading.status === 'available' ? null : NO_FORM) : answer.reason})
}

/** Apply the owner's operations to the form in force; the answer is the form after them. A refusal comes back in the owner's words. */
export async function applyQlM3(operations: readonly M3Operation[]): Promise<void> {
  const at = state, form = at.reading?.state
  if (!at.basis || !form || at.reading?.status !== 'available') throw new Error(at.reason ?? NO_FORM)
  const ticket = ++sequence
  setState({...at, busy: true})
  const answer = await m3Through(call, at.basis, {operation: 'apply', expected_generation: form.identity.profile_generation, operations: [...operations]})
  if (ticket !== sequence) return
  if (!answer.ok) { setState({...state, busy: false}); throw new Error(answer.reason) }
  setState({...state, busy: false, reading: answer.reading})
}

export function setQlM3View(view: M3View): void { setState({...state, view: {...state.view, ...view}}) }

/** Tests: start again, with another call. */
export function resetQlM3(next: {call?: KernelCall} = {}): void {
  sequence++; state = INITIAL; call = next.call ?? (op => kernelOp(detectTransport(), op))
  for (const listener of [...listeners]) listener()
}

const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }

/** The M3 form for the chosen identity and the open Expression, as the views share it. The identity is read at render, as the shell's
 * other faces read it (inhabitants/ConversationNaraFace.tsx, central/devices/useCentralReadings.ts): the cradle's own hook would bind a
 * second React. */
export function useQlM3(): QlM3State {
  const identity = currentIdentity()
  const scene = useHostedChrome()?.state?.nativeScene ?? null
  const ref = scene?.expression_ref ?? null, revision = scene?.revision ?? null
  useEffect(() => {
    if (!identity) void syncQlM3(null, NO_IDENTITY)
    else if (ref === null || revision === null) void syncQlM3(null, NO_EXPRESSION)
    else void syncQlM3({identity, expression: {expression_ref: ref, revision}})
  }, [identity, ref, revision])
  return useSyncExternalStore(subscribe, qlM3State, qlM3State)
}

// ── the design's values and its binding ─────────────────────────────────────

/** Why each design key the binding does not take has no owner write (manual §16.12: "say which one"). */
export const QL_M3_READINGS: Readonly<Record<string, string>> = {
  'clock.tick12': 'A reading: the tick follows the clock; advance the degree to move it.',
  'clock.backbone': 'A reading: the governor follows the clock.',
  'form.address': 'A reading here: the form is chosen in the Nara instrument\'s M3 page (select-form).',
  'form.codon': 'A reading: the codon is the form\'s transcription.',
  'law.seed': 'A reading: the seed in force is the state\'s; QL offers no operation that sets it (ql.m3-state/v1 law.seed).',
  'law.poseMap': 'A reading: the pose map in force is the state\'s; QL offers no operation that sets it (ql.m3-state/v1 law.pose_map).',
  'generation.lower': 'A reading: the cell of the form\'s hexagram under the matrix (ql.m3-state/v1 generation.cell).',
  'generation.upper': 'A reading: the cell of the form\'s hexagram under the matrix (ql.m3-state/v1 generation.cell).',
  'generation.positive': 'A reading: the cell of the form\'s hexagram under the matrix (ql.m3-state/v1 generation.cell).',
  'generation.negative': 'A reading: the cell of the form\'s hexagram under the matrix (ql.m3-state/v1 generation.cell).',
  'generation.nonDual': 'A reading: the cell of the form\'s hexagram under the matrix (ql.m3-state/v1 generation.cell).',
}
/** Why a key has no reading here (manual §16.12: "say which one"): none now — the Rack page reads M3′'s rack (qlRack.ts). */
export const QL_M3_ABSENT: Readonly<Record<string, string>> = {}
/** The matrices in QL's own order: the family index set-matrix takes (crates/ql-mef/src/m3_state/form_cell.rs; ql.m3-state/v1 law.matrix.index). */
export const QL_M3_MATRICES = ['complementary', 'moving-resting', 'same-quality'] as const
/** The keys the view holds: how the clock is drawn, not what it is. */
/** The view's own choices. Skin (manual §22.3 "The Binding skin": Wheel or Binding, Wheel by default) chooses what the clock draws; the
 * Binding skin's own keys are Binding's, carried under `binding.` (TechneDevices.tsx qlFaceEntry, qlBinding.ts). */
export const QL_M3_LOCAL = ['turn', 'open', 'readout', 'reciprocal', 'skin'] as const

const int = (x: unknown): x is number => Number.isSafeInteger(x)

/** The design's values: the form's own readings, and the view's choices. Only what the owner reports. */
export function qlM3Values(m3: QlM3State): Record<string, Value> {
  const values: Record<string, Value> = {}
  for (const key of QL_M3_LOCAL) if (m3.view[key] !== undefined) values[key] = m3.view[key]!
  const form = m3.reading?.status === 'available' ? m3.reading.state : null
  if (!form) { values.reason = m3.busy ? 'Reading the M3 form…' : m3.reason ?? NO_FORM; return values }
  const clock = form.clock as Record<string, unknown>
  if (int(clock.degree720)) values['clock.degree720'] = clock.degree720
  if (int(clock.tick12)) values['clock.tick12'] = clock.tick12
  if (typeof form.clock.backbone?.ref === 'string') values['clock.backbone'] = form.clock.backbone.ref
  if (int(form.aperture?.index)) values['aperture.index'] = form.aperture.index
  if (int(form.form?.address)) values['form.address'] = form.form.address
  if (typeof form.transcription?.sequence === 'string') values['form.codon'] = form.transcription.sequence
  const law = (form as Record<string, any>).law, cell = (form as Record<string, any>).generation?.cell
  if (typeof law?.matrix?.family === 'string') values['law.matrix'] = law.matrix.family
  if (typeof law?.seed?.in_force?.law === 'string') values['law.seed'] = law.seed.in_force.law
  if (typeof law?.pose_map?.in_force === 'string') values['law.poseMap'] = law.pose_map.in_force
  if (typeof cell?.lower_pair?.sequence === 'string') values['generation.lower'] = cell.lower_pair.sequence
  if (typeof cell?.upper_pair?.sequence === 'string') values['generation.upper'] = cell.upper_pair.sequence
  if (typeof cell?.positive?.sequence === 'string') values['generation.positive'] = cell.positive.sequence
  if (typeof cell?.negative?.sequence === 'string') values['generation.negative'] = cell.negative.sequence
  if (typeof cell?.non_dual === 'boolean') values['generation.nonDual'] = cell.non_dual
  return values
}

/** The owner's operations for the design's changes: forward on the double cover to a new degree, a new cut. Throws in words. */
export function qlM3Operations(m3: QlM3State, changes: readonly ValueChange[]): M3Operation[] {
  const form = m3.reading?.status === 'available' ? m3.reading.state : null
  if (!form) throw new Error(m3.reason ?? NO_FORM)
  const operations: M3Operation[] = []
  for (const {key, value} of changes) {
    if (key === 'clock.degree720') {
      if (!int(value) || value < 0 || value > 719) throw new Error('The clock\'s degree is 0 to 719 on the double cover.')
      const steps = ((value - form.clock.degree720) % 720 + 720) % 720
      if (steps > 0) operations.push({operation: 'advance-clock', steps})
    } else if (key === 'aperture.index') {
      const total = form.aperture.total_lenses
      if (!int(value) || value < 0 || (int(total) && value >= total)) throw new Error(`The cut is one of the owner's ${int(total) ? total : 16} apertures.`)
      if (value !== form.aperture.index) operations.push({operation: 'set-aperture', aperture: value})
    } else if (key === 'law.matrix') {
      const family = QL_M3_MATRICES.indexOf(value as typeof QL_M3_MATRICES[number])
      if (family < 0) throw new Error(`${String(value)}: the matrix is complementary, moving and resting, or same quality.`)
      operations.push({operation: 'set-matrix', family})
    } else throw new Error(QL_M3_READINGS[key] ?? `${key}: no operation of the M3 form.`)
  }
  return operations
}

/** The binding the runtime hosts the M3 clock design on: the form's readings, the owner's two operations, the view's own keys in its
 * own hand, and every key the owner does not take disabled with the reason. */
export function qlM3Binding(m3: QlM3State, rack: QlRackState = qlRackState(3)): DesignBinding {
  const live = m3.reading?.status === 'available' && !!m3.reading.state
  const standing: Record<string, Standing> = {}
  for (const [key, why] of Object.entries({...QL_M3_READINGS, ...QL_M3_ABSENT})) standing[key] = {disabled: why}
  if (!live) for (const key of ['clock.degree720', 'aperture.index', 'law.matrix']) standing[key] = {disabled: m3.reason ?? NO_FORM}
  const local: Record<string, (value: Value | undefined) => void> = {}
  for (const key of QL_M3_LOCAL) local[key] = value => setQlM3View({[key]: value})
  // The Rack page: M3′'s rack from the map's ledger, and the part you choose (qlRack.ts).
  const page = rackPage(3, rack)
  Object.assign(standing, page.standing); Object.assign(local, page.local)
  return {
    id: QL_M3_DEVICE_ID,
    values: {...qlM3Values(m3), ...page.values},
    writes: key => live && (key === 'clock.degree720' || key === 'aperture.index' || key === 'law.matrix'),
    standing,
    local,
    // The first read of the form is in flight: every value waits, and none is drawn as zero.
    waiting: m3.busy && !live ? true : page.waiting ? ['rack'] : false,
    ...(live ? {write: async (changes: readonly ValueChange[]) => { const ops = qlM3Operations(m3, changes); if (ops.length) await applyQlM3(ops) }} : {}),
  }
}

// ── the device, for the generic plate that stands in for a view ─────────────

/** The M3 clock as a device of the runtime: the degree and the cut the owner takes, and its other readings. */
export function qlM3Device(face: InhabitantFaceDeclaration, m3: QlM3State): DeviceInstance {
  const live = m3.reading?.status === 'available' && !!m3.reading.state
  const row = (key: string, title: string, type: string, rest: Partial<SdkParamRow> = {}): SdkParamRow =>
    ({family: QL_M3_FAMILY, deviceInstance: face.id, key, title, type, ...rest}) as SdkParamRow
  const write = live ? {writePath: 'shell.m3Reception'} : {disclosure: m3.reason ?? NO_FORM}
  const rows: SdkParamRow[] = [
    row('clock.degree720', 'Degree', 'number', {group: 'Clock', compact: true, range: {min: 0, max: 719, unit: '°'}, ...write}),
    row('aperture.index', 'Cut', 'number', {group: 'Aperture', compact: true, range: {min: 0, max: 15}, ...write}),
    row('clock.tick12', 'Tick', 'number', {group: 'Clock'}),
    row('clock.backbone', 'Governor', 'string', {group: 'Clock'}),
    row('form.address', 'Form', 'number', {group: 'Form'}),
    row('form.codon', 'Codon', 'string', {group: 'Form', compact: true}),
  ]
  const values: Record<string, ParamValue> = {}
  for (const [key, value] of Object.entries(qlM3Values(m3))) if (rows.some(r => r.key === key)) values[key] = value as ParamValue
  return {
    id: QL_M3_DEVICE_ID, family: QL_M3_FAMILY, face: techneFaceDeclaration(face), rows, values,
    ...(live ? {submit: async (changes: readonly {key: string; value: ParamValue}[]) => {
      const ops = qlM3Operations(m3, changes.map(change => ({key: change.key, value: change.value as Value})))
      if (ops.length) await applyQlM3(ops)
    }} : {}),
  }
}
