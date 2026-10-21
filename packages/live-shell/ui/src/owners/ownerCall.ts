// A kernel read held in the shared store (owners/ownerReading.ts), for the reads that have no reader module of their own: the
// key is the op, its arguments and the transport that reached it, so every view that asks the same read between one notice and
// the next is served by one answer and one ask. The answer is the kernel's outcome as it came, narrowed by its `result` tag.
//
// The engine's read helpers (listFiles, readFile, the Central readings, hostedApp's relay) call `kernelRead`
// (desktop/cradle/src/kernel/bridge.ts); this module installs the holder that answers them from the store, so a read made from
// an effect, a model builder or the hosted frame is the same held answer a view subscribed to.
//
// Two ways in:
//   - `useOwnerOp` — a view subscribes; the answer is read when it first reads, and again on the kernel's notice
//     (owners/readingsChanged.ts), the person's retry or a new spine epoch;
//   - `heldOp` / the installed holder — a read made from code with no view: the standing answer is returned while the kernel has
//     not said its sources moved; `fresh` reads again regardless. Where no notice can arrive (the kernel's watch did not start, a
//     hosted source) an answer older than `HELD_OP_MAX_AGE_MS` is read again.
//
// Reads only: a write never goes through here.

import {useRef} from 'react'
import {installKernelReadHolder, installReadingsNoticeSource, kernelReadSend, onKernelWrite, type KernelOpCall} from '../../../../../desktop/cradle/src/kernel/bridge'
import type {KernelOp, KernelOutcome, KernelTransportStatus} from '../../../../../desktop/cradle/src/kernel/types'
import {ownerReadings, useOwnerReading, type OwnerRead, type OwnerReading, type OwnerReadings} from './ownerReading'
import {currentSpineEpoch, useSpineEpoch} from './spine'
import {windowReadingsChanged} from './readingsChanged'

/** The outcome of an op, narrowed to the `result` tag the caller expects. */
export type OpOutcome<R extends KernelOutcome['result']> = Extract<KernelOutcome, {result: R}>

/** How long a standing answer is served to code with no view when the kernel's change notice could not have reached it. */
export const HELD_OP_MAX_AGE_MS = 5 * 60_000

export const opKey = (transport: KernelTransportStatus, op: KernelOp): string => JSON.stringify(['op', transport, op])

/** The read of one op as the kernel answered it: the call is the answer, a refusal is the kernel's words. */
function readCall(transport: KernelTransportStatus, op: KernelOp): OwnerRead<KernelOpCall> {
  return async () => {
    const call = await kernelReadSend(transport, op)
    return call.error ? {error: call.error} : {value: call}
  }
}

/** The held answer to one op for code with no view. A refusal comes back as the call's `error`, as `kernelOp` returns it. */
export async function heldCall(transport: KernelTransportStatus, op: KernelOp, options: {fresh?: boolean; registry?: OwnerReadings; now?: () => number} = {}): Promise<KernelOpCall> {
  if (transport.kind === 'unavailable') return {outcome: null, error: transport.reason}
  const registry = options.registry ?? ownerReadings
  const epoch = currentSpineEpoch()
  const entry = registry.entry(opKey(transport, op), readCall(transport, op), true)
  try {
    const aged = (entry.ageAt((options.now ?? Date.now)()) ?? 0) > HELD_OP_MAX_AGE_MS
    // A refusal is not held for code with no view: its next ask reads again (the caller's own retries depend on it).
    if (options.fresh || aged || entry.snapshot().status === 'refused') await entry.retry(epoch)
    else await entry.ensure(epoch)
    const standing = entry.snapshot()
    return standing.status === 'answered' ? (standing.value as KernelOpCall) : {outcome: null, error: standing.error ?? 'the kernel did not answer'}
  } finally {
    registry.park(entry as never)
  }
}

installKernelReadHolder((transport, op, fresh) => heldCall(transport, op, {fresh}))
// A write this window's kernel op completed retires every held answer at once (the notice from the kernel's watch follows it).
onKernelWrite(() => windowReadingsChanged.now())
// Engine views that polled an owner on a period re-read on the driver's notice instead.
installReadingsNoticeSource()

/** The read of one op for a view: an answer is the outcome when it carries the expected `result`; anything else is the kernel's
 * refusal in its own words. */
export function readOp<R extends KernelOutcome['result']>(transport: KernelTransportStatus, op: KernelOp, expected: R, unavailable?: string): OwnerRead<OpOutcome<R>> {
  return async () => {
    if (transport.kind === 'unavailable') return {error: transport.reason ?? 'Transport unavailable'}
    const result = await kernelReadSend(transport, op)
    if (result.error || result.outcome?.result !== expected) return {error: result.error ?? unavailable ?? `${expected} unavailable`}
    return {value: result.outcome as OpOutcome<R>}
  }
}

/** Subscribe to one op's held answer. `op` null reads nothing. */
export function useOwnerOp<R extends KernelOutcome['result']>(transport: KernelTransportStatus | undefined, op: KernelOp | null, expected: R, unavailable?: string): {
  reading: OwnerReading<OpOutcome<R>>
  refresh: () => void
  retry: () => void
} {
  const epoch = useSpineEpoch()
  const key = transport && transport.kind !== 'unavailable' && op ? `${opKey(transport, op)}|${expected}` : null
  return useOwnerReading<OpOutcome<R>>(key, transport && op ? readOp(transport, op, expected, unavailable) : async () => ({error: 'No kernel carrier stands.'}), epoch)
}

/** A held answer for a read that is not one op (a composite, a read through a module's own helper): `read` resolves to the value or
 * throws the owner's refusal. The key names it; a new closure for the same key is the same read. */
export function useHeldRead<T>(key: readonly unknown[] | null, read: () => Promise<T>): OwnerReading<T> {
  const epoch = useSpineEpoch()
  const wrapped = async (): Promise<{value: T} | {error: string}> => {
    try { return {value: await read()} } catch (cause) { return {error: cause instanceof Error ? cause.message : String(cause)} }
  }
  return useOwnerReading<T>(key ? JSON.stringify(['held', ...key]) : null, wrapped, epoch).reading
}

/** The same map while every value in it is the one the last render drew: a reader of many rows builds its map each render, and
 * what is built from it must change only when an answer did. */
export function useStableMap<K, V>(next: ReadonlyMap<K, V>): ReadonlyMap<K, V> {
  const held = useRef(next)
  const last = held.current
  if (last !== next) {
    let same = last.size === next.size
    if (same) for (const [key, value] of next) if (last.get(key) !== value) { same = false; break }
    if (!same) held.current = next
  }
  return held.current
}
