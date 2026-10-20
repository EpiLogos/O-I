// The Chakra on its owners (DLW §22.5, §24.9 M4.1; the catalogue's design inhabitants/catalogue/panels/quaternal-logic__chakra.tsx,
// `quaternal-logic:chakra`). Its personal layer is Quaternal Logic's elemental map of your saved identity (`nara.elemental-map`,
// `ql.nara-elemental-reading/v1`), reached through the kernel's nara_elemental (desktop/cradle/kernel/src/nara_elemental.rs;
// desktop/cradle/src/nara/elemental.ts) for the identity you chose (nara/identity/current.ts):
//   natal.counts    the seven centres' natal counts, Root to Crown — how your birth sky spreads over them (the natal composition's
//                   centre evidence): the design's Natal distribution. Private: it is yours and nothing shares it;
//   elements        your four elements as QL maps them — each a contribution strength with no confidence claimed, and the quaternion
//                   (w Earth, x Fire, y Water, z Air) — with their source (a key the design does not draw yet);
//   epoch           the date of the sky the routes follow: the Sky's (qlSky.ts), read, never set here.
// `centres` — today's centres with their routes — is the scene's (`ql.scene/v1` `centres[7]`, `ql scene compose|world`), which no owner
// carries to the shell yet: it stands absent with that reason, and the display says so. View, Routes, Colour source, Natal distribution
// and Detail are the view's own (DesignBinding.local). Nothing here writes: the identity is never changed by a reading of it.
// Pure apart from the one kernel call, which takes the call it is given, and the small store the views share.
import {useEffect, useSyncExternalStore} from 'react'
import {detectTransport, kernelOp, type KernelOpCall} from '../../../../../../../desktop/cradle/src/kernel/bridge'
import type {KernelOp} from '../../../../../../../desktop/cradle/src/kernel/types'
import type {NaraElementalResult} from '../../../../../../../desktop/cradle/src/nara/elemental'
import {currentIdentity} from '../../../../../../../desktop/cradle/src/nara/identity/current'
import type {SdkParamRow} from '../../sdk/define'
import type {InhabitantFaceDeclaration} from '../../manifest'
import type {DesignBinding, Standing, Value} from '../../../frame/devices/designed'
import type {DeviceInstance, ParamValue} from '../../../frame/devices/deviceRuntime'
import {techneDeviceId, techneFaceDeclaration} from './faces'
import {qlSkyState, type QlSkyState} from './qlSky'

export const QL_CHAKRA_FAMILY = 'quaternal-logic'
export const QL_CHAKRA_FACE = 'chakra'
/** The device's id on the door and its design's key: designKey('quaternal-logic', 'chakra'). */
export const QL_CHAKRA_DEVICE_ID = techneDeviceId(QL_CHAKRA_FAMILY, QL_CHAKRA_FACE)

export const NO_IDENTITY = 'No Nara identity is chosen: your centres\' elements are your own. Choose one in the Nara instrument.'
export const NO_CENTRES = 'Today\'s centres and their routes are the scene\'s (ql.scene/v1 centres, ql scene compose): no owner carries them to the shell yet.'

/** The identity the map is read for: the chosen saved identity, at its revision. */
export interface ChakraBasis {readonly source_ref: string; readonly revision: string}

export type ChakraCall = (op: KernelOp) => Promise<KernelOpCall>
export type ChakraAnswer = {readonly ok: true; readonly result: NaraElementalResult} | {readonly ok: false; readonly reason: string}

/** The owner's answer, admitted only when it maps this identity at this revision. */
export function readChakraAnswer(answer: KernelOpCall, basis: ChakraBasis): ChakraAnswer {
  if (answer.outcome == null) return {ok: false, reason: answer.error ?? 'The elemental map did not answer.'}
  const outcome = answer.outcome as {result?: string; data?: NaraElementalResult}
  if (outcome.result !== 'nara_elemental' || !outcome.data) return {ok: false, reason: `The kernel answered \`${outcome.result ?? 'unknown'}\`, not \`nara_elemental\`.`}
  const data = outcome.data
  if (data.schema !== 'oi.nara-elemental/v1' || data.source?.source_ref !== basis.source_ref || data.source?.revision !== basis.revision
    || data.elemental?.schema !== 'ql.nara-elemental-reading/v1') return {ok: false, reason: 'The elemental map belongs to another identity or revision.'}
  return {ok: true, result: data}
}

// ── the store the views share ───────────────────────────────────────────────

export const QL_CHAKRA_LOCAL = ['view', 'colour', 'natal', 'route.own', 'route.decan', 'route.sun', 'route.earth', 'detail.element', 'detail.mantra', 'detail.yantra'] as const
export type ChakraView = Partial<Record<typeof QL_CHAKRA_LOCAL[number], Value>>

export interface QlChakraState {
  readonly key: string | null
  readonly basis: ChakraBasis | null
  readonly result: NaraElementalResult | null
  readonly reason: string | null
  readonly busy: boolean
  readonly view: ChakraView
}
const INITIAL: QlChakraState = {key: null, basis: null, result: null, reason: NO_IDENTITY, busy: false, view: {}}
let state: QlChakraState = INITIAL
let sequence = 0
let call: ChakraCall = op => kernelOp(detectTransport(), op)
const listeners = new Set<() => void>()
const setState = (next: QlChakraState) => { if (next !== state) { state = next; for (const listener of [...listeners]) listener() } }

export function qlChakraState(): QlChakraState { return state }

/** Follow the chosen identity: a new one is read once; none says why. Only the newest answer stands. */
export async function syncQlChakra(basis: ChakraBasis | null, why: string | null = null): Promise<void> {
  if (!basis) { if (state.key !== null || state.reason !== why) setState({...state, key: null, basis: null, result: null, reason: why ?? NO_IDENTITY, busy: false}); return }
  const key = `${basis.source_ref}@${basis.revision}`
  if (key === state.key) return
  const ticket = ++sequence
  setState({...state, key, basis, result: null, reason: null, busy: true})
  let answer: ChakraAnswer
  try {
    answer = readChakraAnswer(await call({op: 'nara_elemental', request: {operation: 'map', source_ref: basis.source_ref, expected_revision: basis.revision}}), basis)
  } catch (error) {
    answer = {ok: false, reason: `The kernel could not be asked for your elements: ${error instanceof Error ? error.message : String(error)}`}
  }
  if (ticket !== sequence) return
  setState({...state, busy: false, result: answer.ok ? answer.result : null, reason: answer.ok ? null : answer.reason})
}

export function setQlChakraView(view: ChakraView): void { setState({...state, view: {...state.view, ...view}}) }

/** Tests: start again, with another call. */
export function resetQlChakra(next: {call?: ChakraCall} = {}): void {
  sequence++; state = INITIAL; call = next.call ?? (op => kernelOp(detectTransport(), op))
  for (const listener of [...listeners]) listener()
}

const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }

/** Your elements for the chosen identity, as the views share them. The identity is read at render, as the shell's other faces read it
 * (qlM3Clock.ts useQlM3): the cradle's own hook would bind a second React. */
export function useQlChakra(): QlChakraState {
  const identity = currentIdentity()
  const ref = identity?.source.source_ref ?? null, revision = identity?.source.revision ?? null
  useEffect(() => {
    void syncQlChakra(ref !== null && revision !== null ? {source_ref: ref, revision} : null, NO_IDENTITY)
  }, [ref, revision])
  return useSyncExternalStore(subscribe, qlChakraState, qlChakraState)
}

// ── the design's values and its binding ─────────────────────────────────────

/** The design's values: your natal distribution and your elements from the owner, the Sky's date, the view's choices. Only what the
 * owners report. */
export function qlChakraValues(chakra: QlChakraState, sky: QlSkyState = qlSkyState()): Record<string, Value> {
  const values: Record<string, Value> = {}
  for (const key of QL_CHAKRA_LOCAL) if (chakra.view[key] !== undefined) values[key] = chakra.view[key]!
  if (sky.reading?.ok) values.epoch = sky.reading.sky.epochUtc
  values.reason = NO_CENTRES
  const result = chakra.result
  if (!result) { if (chakra.busy || chakra.reason) values.reason = chakra.busy ? 'Reading your elements…' : chakra.reason!; return values }
  if (Array.isArray(result.natal_counts) && result.natal_counts.length === 7) values['natal.counts'] = JSON.stringify(result.natal_counts)
  const map = result.elemental
  values.elements = JSON.stringify({contributions: map.contributions, unknown: map.unknown_elements, quaternion: map.normalized_quaternion,
    source: map.source, standing: map.standing})
  return values
}

const READINGS: Readonly<Record<string, string>> = {
  centres: NO_CENTRES,
  epoch: 'The date follows the Sky: set it on the Sky.',
  'natal.counts': 'A reading of your saved identity: correct the identity, never the reading.',
  elements: 'A reading of your saved identity: correct the identity, never the reading.',
}

/** The binding the runtime hosts the Chakra design on: your elements and natal distribution, the view's own keys in its own hand, and
 * no write — a reading of your identity changes nothing. */
export function qlChakraBinding(chakra: QlChakraState, sky?: QlSkyState): DesignBinding {
  const standing: Record<string, Standing> = {}
  for (const [key, why] of Object.entries(READINGS)) standing[key] = {disabled: why}
  if (!chakra.result?.natal_counts) standing.natal = {disabled: chakra.result ? 'Your identity carries no natal distribution (its natal composition is absent).' : chakra.reason ?? NO_IDENTITY}
  const local: Record<string, (value: Value | undefined) => void> = {}
  for (const key of QL_CHAKRA_LOCAL) local[key] = value => setQlChakraView({[key]: value})
  return {id: QL_CHAKRA_DEVICE_ID, values: qlChakraValues(chakra, sky), writes: () => false, standing, local, waiting: chakra.busy && !chakra.result}
}

// ── the device, for the generic plate that stands in for a view ─────────────

const ELEMENTS = ['earth', 'fire', 'water', 'air'] as const

/** The Chakra as a device of the runtime: your four elements and the natal distribution, all readings. */
export function qlChakraDevice(face: InhabitantFaceDeclaration, chakra: QlChakraState): DeviceInstance {
  const row = (key: string, title: string, type: string, rest: Partial<SdkParamRow> = {}): SdkParamRow =>
    ({family: QL_CHAKRA_FAMILY, deviceInstance: face.id, key, title, type, ...rest}) as SdkParamRow
  const rows: SdkParamRow[] = [
    ...ELEMENTS.map((element, i) => row(element, element[0]!.toUpperCase() + element.slice(1), 'number', {group: 'Elements', ...(i < 2 ? {compact: true} : {})})),
    row('natal', 'Natal distribution', 'string', {group: 'Personal'}),
  ]
  const values: Record<string, ParamValue> = {}
  const result = chakra.result
  if (result) {
    for (const element of ELEMENTS) {
      const reading = result.elemental.contributions[element]
      if (reading) values[element] = reading.contribution_strength
    }
    if (result.natal_counts) values.natal = result.natal_counts.join(' · ')
  }
  return {id: QL_CHAKRA_DEVICE_ID, family: QL_CHAKRA_FAMILY, face: techneFaceDeclaration(face), rows, values}
}
