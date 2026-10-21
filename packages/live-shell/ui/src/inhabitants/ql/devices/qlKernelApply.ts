// The M′ matrices' Kernel page on its owner (DLW §22.6): the kernel's three deterministic operators on an address of its sixfold form,
// `ql kernel apply <operator> <address> --json` (crates/ql-core/src/apply.rs, kernel 0.1.0-q1), reached through the kernel's ql_read
// {kind: 'kernel-apply'} (desktop/cradle/kernel/src/owner_routes.rs QlRead::KernelApply, admitted when the answer echoes its operation).
// The address is the view's own (kernel.position, kernel.face: no owner names a kernel address for a matrix cell), asked in the one form
// the operators serve, sixfold@1 (the kernel refuses its other forms: "unsupported QL address frame"), at depth 0, the ground depth of
// QL's own example (ql-registry-reads-2026-10-21.json: qladdr:sixfold@1/direct/P5/d0). The answers are readings: kernel.conjugate and
// kernel.complement (the operators' output addresses), kernel.class (classify-four-plus-two: 'implicate' | 'explicate'), kernel.version
// (kernelVersion), and kernel.form and kernel.depth as the kernel echoes the address it read. Each address is asked once.
// Pure apart from the kernel calls, which take the call they are given, and the small store the views share.
import {useEffect, useSyncExternalStore} from 'react'
import {detectTransport, kernelOp, type KernelOpCall} from '../../../../../../../desktop/cradle/src/kernel/bridge'
import type {KernelOp} from '../../../../../../../desktop/cradle/src/kernel/types'
import type {Value} from '../../../frame/devices/designed'

export const KERNEL_FORM = 'sixfold@1'
export const KERNEL_DEPTH = 0
export const KERNEL_OPERATORS = ['conjugate-address', 'complement-address', 'classify-four-plus-two'] as const
export const KERNEL_READINGS = ['kernel.conjugate', 'kernel.complement', 'kernel.class', 'kernel.version', 'kernel.form', 'kernel.depth'] as const
export const NO_ADDRESS = 'Choose a position and a face: the kernel\'s operators read the address you hold (no owner names one for a matrix cell).'
const ADDRESS = /^qladdr:([^/]+)\/(direct|conjugate)\/P([0-5])\/d(\d+)$/

/** The address the held position and face make, or null while either is missing. */
export function kernelAddressOf(held: Readonly<Record<string, Value>>): string | null {
  const position = held['kernel.position'], face = held['kernel.face']
  if (!Number.isInteger(position) || (position as number) < 0 || (position as number) > 5 || (face !== 'direct' && face !== 'conjugate')) return null
  return `qladdr:${KERNEL_FORM}/${face}/P${position}/d${KERNEL_DEPTH}`
}

export interface KernelAnswers {readonly conjugate: string; readonly complement: string; readonly class: string; readonly version: string; readonly form: string; readonly depth: number}
export type KernelReading = {readonly ok: true; readonly answers: KernelAnswers} | {readonly ok: false; readonly reason: string}

/** One operator's answer, admitted only for the operation and address asked; else the reason in words. */
export function readKernelApply(answer: KernelOpCall, operator: string, address: string): {ok: true; output: string; version: string} | {ok: false; reason: string} {
  if (answer.outcome == null) return {ok: false, reason: answer.error ?? 'Quaternal Logic did not answer `ql kernel apply`.'}
  const outcome = answer.outcome as {result?: string; data?: Record<string, unknown>}
  const data = outcome.data
  if (outcome.result !== 'owner_route_reading' || data?.contract !== 'ql.cli/v1' || data.operation !== operator) return {ok: false, reason: `The kernel answered \`${outcome.result ?? 'unknown'}\`, not \`ql kernel apply ${operator}\`.`}
  if (data.input !== address || typeof data.output !== 'string' || typeof data.kernelVersion !== 'string') return {ok: false, reason: 'The kernel answered another address, or no output.'}
  return {ok: true, output: data.output, version: data.kernelVersion}
}

export interface KernelApplyState {readonly address: string | null; readonly reading: KernelReading; readonly busy: boolean}
export type KernelCall = (op: KernelOp) => Promise<KernelOpCall>
const INITIAL: KernelApplyState = {address: null, reading: {ok: false, reason: NO_ADDRESS}, busy: false}
let state: KernelApplyState = INITIAL
let sequence = 0
let call: KernelCall = op => kernelOp(detectTransport(), op)
const listeners = new Set<() => void>()
const setState = (next: KernelApplyState) => { state = next; for (const listener of [...listeners]) listener() }

export function kernelApplyState(): KernelApplyState { return state }

async function ask(operator: string, address: string) {
  try {
    return readKernelApply(await call({op: 'ql_read', request: {kind: 'kernel-apply', operator, address}}), operator, address)
  } catch (error) {
    return {ok: false as const, reason: `The kernel could not be asked: ${error instanceof Error ? error.message : String(error)}`}
  }
}

/** Ask the kernel's three operators of the held address, once per address; only the newest stands. */
export async function syncKernelApply(held: Readonly<Record<string, Value>>): Promise<void> {
  const address = kernelAddressOf(held)
  if (!address) { if (state.address !== null || state.reading.ok) setState(INITIAL); return }
  if (address === state.address) return
  const ticket = ++sequence
  setState({address, reading: state.reading, busy: true})
  const [conjugate, complement, classed] = await Promise.all(KERNEL_OPERATORS.map(operator => ask(operator, address)))
  if (ticket !== sequence) return
  const refused = [conjugate, complement, classed].find(answer => !answer.ok) as {ok: false; reason: string} | undefined
  const echoed = ADDRESS.exec(address)!
  setState({address, busy: false, reading: refused ? {ok: false, reason: refused.reason}
    : {ok: true, answers: {conjugate: (conjugate as {output: string}).output, complement: (complement as {output: string}).output, class: (classed as {output: string}).output,
      version: (classed as {version: string}).version, form: echoed[1]!, depth: Number(echoed[4])}}})
}

/** Tests: start again, with another call. */
export function resetKernelApply(next: {call?: KernelCall} = {}): void {
  sequence++; state = INITIAL; call = next.call ?? (op => kernelOp(detectTransport(), op))
  for (const listener of [...listeners]) listener()
}

const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }

/** The kernel's answers for the address the matrices hold. */
export function useKernelApply(held: Readonly<Record<string, Value>> | undefined): KernelApplyState {
  const address = kernelAddressOf(held ?? {})
  useEffect(() => { void syncKernelApply(held ?? {}) }, [address])
  return useSyncExternalStore(subscribe, kernelApplyState, kernelApplyState)
}

/** The answers as the design's keys carry them. */
export function kernelValues(kernel: KernelApplyState): Record<string, Value> {
  if (!kernel.reading.ok) return {}
  const a = kernel.reading.answers
  return {'kernel.conjugate': a.conjugate, 'kernel.complement': a.complement, 'kernel.class': a.class, 'kernel.version': a.version, 'kernel.form': a.form, 'kernel.depth': a.depth}
}

/** Why the answers are not drawn, or that they are the kernel's. */
export function kernelWhy(kernel: KernelApplyState): string {
  return kernel.reading.ok ? 'A reading: the kernel\'s answer for the address you hold.' : kernel.busy ? 'Asking the kernel\'s operators…' : kernel.reading.reason
}
