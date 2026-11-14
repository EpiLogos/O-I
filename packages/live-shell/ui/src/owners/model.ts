// The World Model as device and view code reads it (kernel world_model.rs; docs/architecture/world-shell.md §9.2 layer 2; O-I #1001).
// The kernel holds the owners' present state as slices — worlds and pages, today's Day, the agents that start, sessions, models, Factory,
// workcells and seats, the sky now — loaded at launch and kept by the watch and by the kernel's own writes. A device asks for a slice by
// the one op, `model_subscribe`, and asks again when the kernel's `model_changed` notice names a newer version of it. Nothing here reads
// an owner, and nothing here keeps a second copy of an owner's answer: what is held is the kernel's slice, at its version.
//
// Pure TypeScript and one React hook.

import {useCallback, useEffect, useSyncExternalStore} from 'react'
import {kernelReadSend, onKernelWrite} from '../../../../../desktop/cradle/src/kernel/bridge'
import type {KernelOutcome, KernelReceipt, KernelTransportStatus, ModelSliceAnswer, ModelSliceName} from '../../../../../desktop/cradle/src/kernel/types'

export const MODEL_CHANGED_EVENT = 'model_changed'

const SLICES: ReadonlySet<string> = new Set(['worlds', 'day', 'agents', 'sessions', 'models', 'factory', 'workcells', 'sky'])

/** A slice as the window holds it: being asked for, the kernel's answer (whatever its own state), or why the kernel gave none. */
export type ModelSliceReading =
  | {readonly state: 'reading'}
  | {readonly state: 'unavailable'; readonly reason: string}
  | {readonly state: 'held'; readonly answer: ModelSliceAnswer}

/** The change a `model_changed` receipt names, or null when it is another receipt or not the contract's (a known slice, a version of at
 * least 1). */
export function modelChangedOf(receipt: KernelReceipt): {slice: ModelSliceName; version: number} | null {
  if (receipt.event !== MODEL_CHANGED_EVENT) return null
  const {slice, version} = receipt
  if (typeof slice !== 'string' || !SLICES.has(slice)) return null
  if (typeof version !== 'number' || !Number.isSafeInteger(version) || version < 1) return null
  return {slice: slice as ModelSliceName, version}
}

/** A slice's answer from the kernel's outcome, or the words for why there is none. */
export function sliceOf(outcome: KernelOutcome | null | undefined, error: string | undefined, slice: ModelSliceName): ModelSliceReading {
  if (error) return {state: 'unavailable', reason: error}
  if (!outcome || outcome.result !== 'model_slice') return {state: 'unavailable', reason: `The kernel answered ${outcome?.result ?? 'nothing'}, not the World Model's ${slice}.`}
  const answer = outcome.data
  if (!answer || answer.schema !== 'oi.world-model-slice/v1' || answer.slice !== slice || typeof answer.version !== 'number') {
    return {state: 'unavailable', reason: `The kernel's answer for the World Model's ${slice} is not a slice.`}
  }
  return {state: 'held', answer}
}

/** The value of a held slice, or the words for why there is none: a slice the owner refused before it held a state says the owner's
 * words; one that holds a last state beside a refusal is that state (its words are on the answer, `error`). */
export function sliceValue<T = unknown>(reading: ModelSliceReading): {ok: true; value: T; answer: ModelSliceAnswer} | {ok: false; reason: string} {
  if (reading.state === 'reading') return {ok: false, reason: 'The World Model has not answered yet.'}
  if (reading.state === 'unavailable') return {ok: false, reason: reading.reason}
  const {answer} = reading
  if (answer.value === null || answer.value === undefined) return {ok: false, reason: answer.error ?? `${answer.owner} has not been read yet.`}
  return {ok: true, value: answer.value as T, answer}
}

interface Entry {
  reading: ModelSliceReading
  asking: Promise<ModelSliceReading> | null
  /** The newest version a notice named: an answer older than it is asked again. */
  wanted: number
  /** A write this window completed since the last ask began: asked again before it is read. */
  due: boolean
  listeners: Set<() => void>
}

/** How a read is asked: `fresh` asks the kernel to read the slice from its owner first, past every held reading — the read that
 * precedes a write. A fresh read is always asked, and its answer is held like any other. */
export interface ModelRead {readonly fresh?: boolean}

export interface ModelStore {
  /** The slice as held now (no ask). */
  held(transport: KernelTransportStatus, slice: ModelSliceName): ModelSliceReading
  /** The slice, asked of the kernel when nothing current is held, or `fresh`. Concurrent askers share one ask. */
  read(transport: KernelTransportStatus, slice: ModelSliceName, read?: ModelRead): Promise<ModelSliceReading>
  /** Hear each new reading of a slice; the first listener asks for it. Returns the withdrawal. */
  listen(transport: KernelTransportStatus, slice: ModelSliceName, listener: () => void): () => void
  /** Take the kernel's receipts: each `model_changed` asks again for that slice where it is held older, or listened to. */
  receive(receipts: readonly KernelReceipt[]): void
}

export type ModelSend = (transport: KernelTransportStatus, slice: ModelSliceName, fresh?: boolean) => Promise<{outcome: KernelOutcome | null; error?: string}>

const sendSubscribe: ModelSend = (transport, slice, fresh) => kernelReadSend(transport, fresh ? {op: 'model_subscribe', slice, fresh} : {op: 'model_subscribe', slice})

/** A store of the slices a window holds, one per transport and slice. A write this window completed (`onWrite`) leaves nothing held
 * current: the kernel reads a slice its write moved again before it answers, and answers the others from what it holds. */
export function createModelStore(send: ModelSend = sendSubscribe, onWrite: (listener: () => void) => () => void = onKernelWrite): ModelStore {
  // A window has a handful of transports (its own, a pane's relay), each held for its life.
  const byTransport = new Map<KernelTransportStatus, Map<ModelSliceName, Entry>>()
  const entry = (transport: KernelTransportStatus, slice: ModelSliceName): Entry => {
    let slices = byTransport.get(transport)
    if (!slices) { slices = new Map(); byTransport.set(transport, slices) }
    let found = slices.get(slice)
    if (!found) { found = {reading: {state: 'reading'}, asking: null, wanted: 0, due: false, listeners: new Set()}; slices.set(slice, found) }
    return found
  }
  const current = (held: Entry) => held.reading.state === 'held' && held.reading.answer.version >= held.wanted && !held.due
  const asked = (slice: ModelSliceName, call: Promise<{outcome: KernelOutcome | null; error?: string}>) =>
    call.then(answered => sliceOf(answered.outcome, answered.error, slice), cause => ({state: 'unavailable', reason: cause instanceof Error ? cause.message : String(cause)}) as ModelSliceReading)
  /** Take an answer into what is held: never over a newer one already held (two asks crossing). */
  const takeInto = (held: Entry, reading: ModelSliceReading) => {
    if (!(reading.state === 'held' && held.reading.state === 'held' && reading.answer.version < held.reading.answer.version)) held.reading = reading
    for (const listener of [...held.listeners]) listener()
  }
  const unavailable = (transport: Extract<KernelTransportStatus, {kind: 'unavailable'}>, held: Entry) => {
    held.reading = {state: 'unavailable', reason: transport.reason}
    for (const listener of [...held.listeners]) listener()
    return Promise.resolve(held.reading)
  }
  const ask = (transport: KernelTransportStatus, slice: ModelSliceName, held: Entry): Promise<ModelSliceReading> => {
    if (held.asking) return held.asking
    if (transport.kind === 'unavailable') return unavailable(transport, held)
    held.due = false
    const asking = asked(slice, send(transport, slice)).then(reading => {
      held.asking = null
      takeInto(held, reading)
      // A notice or a write that came while this ask was in flight: ask once more. A refusal waits for the next notice or write.
      if (held.listeners.size && held.reading.state === 'held' && !current(held)) void ask(transport, slice, held)
      return held.reading
    })
    held.asking = asking
    return asking
  }
  /** A fresh read: always asked, beside any ask in flight; its answer is held like any other, and is what it answers. */
  const askFresh = (transport: KernelTransportStatus, slice: ModelSliceName, held: Entry): Promise<ModelSliceReading> => {
    if (transport.kind === 'unavailable') return unavailable(transport, held)
    held.due = false
    return asked(slice, send(transport, slice, true)).then(reading => {
      takeInto(held, reading)
      return reading
    })
  }
  onWrite(() => {
    for (const [transport, slices] of byTransport) {
      for (const [slice, held] of slices) {
        held.due = true
        if (held.listeners.size) void ask(transport, slice, held)
      }
    }
  })
  return {
    held: (transport, slice) => entry(transport, slice).reading,
    read(transport, slice, read = {}) {
      const held = entry(transport, slice)
      if (read.fresh) return askFresh(transport, slice, held)
      return current(held) ? Promise.resolve(held.reading) : ask(transport, slice, held)
    },
    listen(transport, slice, listener) {
      const held = entry(transport, slice)
      held.listeners.add(listener)
      if (!current(held)) void ask(transport, slice, held)
      return () => { held.listeners.delete(listener) }
    },
    receive(receipts) {
      for (const receipt of receipts) {
        const change = modelChangedOf(receipt)
        if (!change) continue
        for (const [transport, slices] of byTransport) {
          const held = slices.get(change.slice)
          if (!held) continue
          held.wanted = Math.max(held.wanted, change.version)
          if (!current(held) && held.listeners.size) void ask(transport, change.slice, held)
        }
      }
    },
  }
}

/** The window's store. */
export const windowModel: ModelStore = createModelStore()

/** One slice, asked of the window's store: for code that reads once — `fresh` for the read before a write. */
export function modelSlice(transport: KernelTransportStatus, slice: ModelSliceName, read: ModelRead = {}, store: ModelStore = windowModel): Promise<ModelSliceReading> {
  return store.read(transport, slice, read)
}

/** One slice as a view holds it: asked when first used, asked again on each newer `model_changed`. */
export function useModelSlice(transport: KernelTransportStatus | null | undefined, slice: ModelSliceName, store: ModelStore = windowModel): ModelSliceReading {
  const usable = transport ?? null
  // One subscription per carrier and slice: a subscribe made anew each render would listen (and so ask) again on every render, and
  // a refusal, never current, would ask without end.
  const subscribe = useCallback((listener: () => void) => (usable ? store.listen(usable, slice, listener) : () => {}), [usable, slice, store])
  const snapshot = useCallback(() => (usable ? store.held(usable, slice) : NO_TRANSPORT), [usable, slice, store])
  // A static render (the node suites) reads what is held, as the window does.
  const reading = useSyncExternalStore(subscribe, snapshot, snapshot)
  useEffect(() => { if (usable) void store.read(usable, slice) }, [usable, slice, store])
  return reading
}

const NO_TRANSPORT: ModelSliceReading = {state: 'unavailable', reason: 'The shell has published no kernel carrier for this reading.'}
