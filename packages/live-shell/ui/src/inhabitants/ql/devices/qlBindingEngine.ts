// Binding's engine on its owner (manual §22.3 "The Binding skin"; O-I ticket 684). Binding runs its own physics over the kernel's symbols, and the
// physics is Quaternal Logic's: `ql kernel m3-binding -` (QL-MEF crates/ql-mef/src/m3_binding.rs, `ql.m3-binding/v1`, LightBox's QCD law)
// reached through the kernel's ql_read {kind: 'm3-binding'} (desktop/cradle/kernel/src/owner_routes.rs QlRead::M3Binding). It is asked of
// the cell the skin draws: the form's hexagram (ql.m3-state/v1 `generation.hexagram_id`) under the pairing's matrix (held, else the law's),
// with Binding's own Charge, Tension and Coupling (held, else the manual's starting values: pp, 0.9 GeV/fm, 1 GeV), and the form's last
// applied receipt (m3_reception's `receipts`), so the engine names the kernel event behind the last motion. It answers the cell's two
// codons with their coin values and charges, the coupling at its scale, the string's stretch and its energy. The shell computes none of it.
// Each request is asked once; only the newest answer stands. Pure apart from the kernel call, which takes the call it is given, and the
// small store the views share.
import {useEffect, useSyncExternalStore} from 'react'
import {detectTransport, kernelOp, type KernelOpCall} from '../../../../../../../desktop/cradle/src/kernel/bridge'
import type {KernelOp} from '../../../../../../../desktop/cradle/src/kernel/types'
import type {Value} from '../../../frame/devices/designed'
import type {QlM3State} from './qlM3Clock'

export const BINDING_CONTRACT = 'ql.m3-binding/v1'
/** The manual's starting values for Binding's own physics (§22.3 Parameters): Charge pp, Tension 0.9 GeV/fm, Coupling 1 GeV. */
export const BINDING_STARTS = {'charge.register': 'pp', 'string.tension': 0.9, 'coupling.scale': 1} as const
const REGISTERS = ['pp', 'mm', 'mp', 'pm']
const MATRICES = ['complementary', 'moving-resting', 'same-quality']

export interface BindingRequest {
  readonly hexagram: number
  readonly matrix: string
  readonly register: string
  readonly tension_gev_per_fm: number
  readonly coupling_scale_gev: number
  readonly receipt?: unknown
}

const record = (x: unknown): Record<string, any> | undefined => (x && typeof x === 'object' && !Array.isArray(x) ? x as Record<string, any> : undefined)
const finite = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)

/** The engine's request for the cell the skin draws, or null when no form is open or the held settings are none of the engine's. */
export function bindingRequestOf(m3: QlM3State, held: Readonly<Record<string, Value>>): BindingRequest | null {
  const form = m3.reading?.status === 'available' ? record(m3.reading.state) : undefined
  const hexagram = form?.generation?.hexagram_id
  if (!Number.isSafeInteger(hexagram)) return null
  const pairing = held['pairing.matrix'], law = form?.law?.matrix?.family
  const matrix = typeof pairing === 'string' ? pairing : typeof law === 'string' ? law : undefined
  const register = held['charge.register'] ?? BINDING_STARTS['charge.register']
  const tension = held['string.tension'] ?? BINDING_STARTS['string.tension'], scale = held['coupling.scale'] ?? BINDING_STARTS['coupling.scale']
  if (matrix === undefined || !MATRICES.includes(matrix) || typeof register !== 'string' || !REGISTERS.includes(register) || !finite(tension) || !finite(scale)) return null
  const receipts = m3.reading?.receipts
  const receipt = Array.isArray(receipts) && receipts.length ? receipts[receipts.length - 1] : undefined
  return {hexagram: hexagram as number, matrix, register, tension_gev_per_fm: tension, coupling_scale_gev: scale, ...(receipt === undefined ? {} : {receipt})}
}

export type BindingReading = {readonly ok: true; readonly answer: Record<string, any>} | {readonly ok: false; readonly reason: string}
export interface BindingEngineState {
  /** The request the reading answers (receipt by its generation), or null when none was asked. */
  readonly key: string | null
  readonly reading: BindingReading | null
  readonly busy: boolean
}

/** A request's key: the receipt by its schema and generation, never its whole snapshot. */
export function bindingKey(request: BindingRequest | null): string | null {
  if (!request) return null
  const {receipt, ...rest} = request, r = record(receipt)
  return JSON.stringify([rest, r ? [r.schema, r.after_generation] : null])
}

/** The kernel's answer, admitted only when it is Binding's reading of the hexagram and matrix asked; else the reason in words. */
export function readBindingAnswer(answer: KernelOpCall, request: BindingRequest): BindingReading {
  if (answer.outcome == null) return {ok: false, reason: answer.error ?? 'Quaternal Logic did not answer `ql kernel m3-binding`.'}
  const outcome = answer.outcome as {result?: string; data?: Record<string, any>}
  const data = outcome.data
  if (outcome.result !== 'owner_route_reading' || data?.schema !== BINDING_CONTRACT) return {ok: false, reason: `The kernel answered \`${outcome.result ?? 'unknown'}\`, not \`ql kernel m3-binding\`.`}
  if (data.hexagram_id !== request.hexagram || data.matrix?.family !== request.matrix || data.register !== request.register) return {ok: false, reason: 'Quaternal Logic answered Binding for another cell.'}
  return {ok: true, answer: data}
}

export type KernelCall = (op: KernelOp) => Promise<KernelOpCall>
const INITIAL: BindingEngineState = {key: null, reading: null, busy: false}
let state: BindingEngineState = INITIAL
let sequence = 0
let call: KernelCall = op => kernelOp(detectTransport(), op)
const listeners = new Set<() => void>()
const setState = (next: BindingEngineState) => { state = next; for (const listener of [...listeners]) listener() }

export function bindingEngineState(): BindingEngineState { return state }

/** Ask the engine of the cell the skin draws, once per request; only the newest answer stands. */
export async function syncBindingEngine(m3: QlM3State, held: Readonly<Record<string, Value>>): Promise<void> {
  const request = bindingRequestOf(m3, held), key = bindingKey(request)
  if (!request || !key) { if (state.key !== null) setState(INITIAL); return }
  if (key === state.key) return
  const ticket = ++sequence
  setState({key, reading: null, busy: true})
  let reading: BindingReading
  try {
    reading = readBindingAnswer(await call({op: 'ql_read', request: {kind: 'm3-binding', request}} as KernelOp), request)
  } catch (error) {
    reading = {ok: false, reason: `The kernel could not be asked for Binding's engine: ${error instanceof Error ? error.message : String(error)}`}
  }
  if (ticket !== sequence) return
  setState({key, reading, busy: false})
}

/** Tests: start again, with another call. */
export function resetBindingEngine(next: {call?: KernelCall} = {}): void {
  sequence++; state = INITIAL; call = next.call ?? (op => kernelOp(detectTransport(), op))
  for (const listener of [...listeners]) listener()
}

const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }

/** The engine's reading for the cell the skin draws, asked again when the cell, the settings or the form's last receipt change. */
export function useBindingEngine(m3: QlM3State | undefined, held: Readonly<Record<string, Value>> | undefined): BindingEngineState {
  const key = m3 ? bindingKey(bindingRequestOf(m3, held ?? {})) : null
  useEffect(() => { if (m3) void syncBindingEngine(m3, held ?? {}) }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  return useSyncExternalStore(subscribe, bindingEngineState, bindingEngineState)
}
