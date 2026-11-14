// Each mode's Set as the Session and Arrangement views read it (kernel mode_set.rs; docs/architecture/world-shell.md §9.2 layer 4;
// O-I #1004). The kernel builds a mode's Set from the World Model's slices and keeps it as it keeps them: a view asks for it by the one
// op, `set_subscribe`, and asks again when the kernel's `set_changed` notice names a newer version of it. Nothing here reads an owner or a
// slice, and nothing here assembles a Set: what is held is the kernel's Set, at its version.
//
// Pure TypeScript and one React hook.

import {useCallback, useEffect, useSyncExternalStore} from 'react'
import {kernelReadSend, onKernelWrite} from '../../../../../desktop/cradle/src/kernel/bridge'
import type {KernelOutcome, KernelReceipt, KernelTransportStatus, ModeSetAnswer, ModeSetName} from '../../../../../desktop/cradle/src/kernel/types'

export const SET_CHANGED_EVENT = 'set_changed'

const MODES: ReadonlySet<string> = new Set(['central', 'factory', 'expressions', 'techne', 'live'])

/** A Set as the window holds it: being asked for, the kernel's answer, or why the kernel gave none. */
export type ModeSetReading =
  | {readonly state: 'reading'}
  | {readonly state: 'unavailable'; readonly reason: string}
  | {readonly state: 'held'; readonly answer: ModeSetAnswer}

/** The change a `set_changed` receipt names, or null when it is another receipt or not the contract's (a known mode, a version of at
 * least 1). */
export function setChangedOf(receipt: KernelReceipt): {mode: ModeSetName; version: number} | null {
  if (receipt.event !== SET_CHANGED_EVENT) return null
  const {mode, version} = receipt
  if (typeof mode !== 'string' || !MODES.has(mode)) return null
  if (typeof version !== 'number' || !Number.isSafeInteger(version) || version < 1) return null
  return {mode: mode as ModeSetName, version}
}

/** A Set's answer from the kernel's outcome, or the words for why there is none. */
export function modeSetOf(outcome: KernelOutcome | null | undefined, error: string | undefined, mode: ModeSetName): ModeSetReading {
  if (error) return {state: 'unavailable', reason: error}
  if (!outcome || outcome.result !== 'mode_set') return {state: 'unavailable', reason: `The kernel answered ${outcome?.result ?? 'nothing'}, not ${mode}'s Set.`}
  const answer = outcome.data
  if (!answer || answer.schema !== 'oi.mode-set/v1' || answer.mode !== mode || typeof answer.version !== 'number' || !answer.set) {
    return {state: 'unavailable', reason: `The kernel's answer for ${mode}'s Set is not a Set.`}
  }
  return {state: 'held', answer}
}

interface Entry {
  reading: ModeSetReading
  asking: Promise<ModeSetReading> | null
  /** The newest version a notice named: an answer older than it is asked again. */
  wanted: number
  /** A write this window completed since the last ask began: asked again before it is read. */
  due: boolean
  listeners: Set<() => void>
}

export interface ModeSetStore {
  /** The Set as held now (no ask). */
  held(transport: KernelTransportStatus, mode: ModeSetName): ModeSetReading
  /** The Set, asked of the kernel when nothing current is held. Concurrent askers share one ask. */
  read(transport: KernelTransportStatus, mode: ModeSetName): Promise<ModeSetReading>
  /** Hear each new reading of a Set; the first listener asks for it. Returns the withdrawal. */
  listen(transport: KernelTransportStatus, mode: ModeSetName, listener: () => void): () => void
  /** Take the kernel's receipts: each `set_changed` asks again for that Set where it is held older and listened to. */
  receive(receipts: readonly KernelReceipt[]): void
}

export type ModeSetSend = (transport: KernelTransportStatus, mode: ModeSetName) => Promise<{outcome: KernelOutcome | null; error?: string}>

const sendSubscribe: ModeSetSend = (transport, mode) => kernelReadSend(transport, {op: 'set_subscribe', mode})

/** A store of the Sets a window holds, one per transport and mode. A write this window completed (`onWrite`) leaves nothing held
 * current: the kernel builds a Set its write moved again before it answers. */
export function createModeSetStore(send: ModeSetSend = sendSubscribe, onWrite: (listener: () => void) => () => void = onKernelWrite): ModeSetStore {
  const byTransport = new Map<KernelTransportStatus, Map<ModeSetName, Entry>>()
  const entry = (transport: KernelTransportStatus, mode: ModeSetName): Entry => {
    let modes = byTransport.get(transport)
    if (!modes) { modes = new Map(); byTransport.set(transport, modes) }
    let found = modes.get(mode)
    // No carrier: nothing can be asked, so the Set is unread from the first look, saying why.
    if (!found) {
      found = {reading: transport.kind === 'unavailable' ? {state: 'unavailable', reason: transport.reason} : {state: 'reading'}, asking: null, wanted: 0, due: false, listeners: new Set()}
      modes.set(mode, found)
    }
    return found
  }
  const current = (held: Entry) => held.reading.state === 'held' && held.reading.answer.version >= held.wanted && !held.due
  const tell = (held: Entry) => { for (const listener of [...held.listeners]) listener() }
  const ask = (transport: KernelTransportStatus, mode: ModeSetName, held: Entry): Promise<ModeSetReading> => {
    if (held.asking) return held.asking
    if (transport.kind === 'unavailable') return Promise.resolve(held.reading)
    held.due = false
    const asking = send(transport, mode).then(answered => modeSetOf(answered.outcome, answered.error, mode),
      cause => ({state: 'unavailable', reason: cause instanceof Error ? cause.message : String(cause)}) as ModeSetReading).then(reading => {
      held.asking = null
      // Never over a newer one already held (two asks crossing).
      if (!(reading.state === 'held' && held.reading.state === 'held' && reading.answer.version < held.reading.answer.version)) held.reading = reading
      tell(held)
      // A notice or a write that came while this ask was in flight: ask once more. A refusal waits for the next notice or write.
      if (held.listeners.size && held.reading.state === 'held' && !current(held)) void ask(transport, mode, held)
      return held.reading
    })
    held.asking = asking
    return asking
  }
  onWrite(() => {
    for (const [transport, modes] of byTransport) {
      for (const [mode, held] of modes) {
        held.due = true
        if (held.listeners.size) void ask(transport, mode, held)
      }
    }
  })
  return {
    held: (transport, mode) => entry(transport, mode).reading,
    read(transport, mode) {
      const held = entry(transport, mode)
      return current(held) ? Promise.resolve(held.reading) : ask(transport, mode, held)
    },
    listen(transport, mode, listener) {
      const held = entry(transport, mode)
      held.listeners.add(listener)
      if (!current(held)) void ask(transport, mode, held)
      return () => { held.listeners.delete(listener) }
    },
    receive(receipts) {
      for (const receipt of receipts) {
        const change = setChangedOf(receipt)
        if (!change) continue
        for (const [transport, modes] of byTransport) {
          const held = modes.get(change.mode)
          if (!held) continue
          held.wanted = Math.max(held.wanted, change.version)
          if (!current(held) && held.listeners.size) void ask(transport, change.mode, held)
        }
      }
    },
  }
}

/** The window's store. */
export const windowSets: ModeSetStore = createModeSetStore()

/** One mode's Set as a view holds it: asked when first used, asked again on each newer `set_changed`. */
export function useModeSet(transport: KernelTransportStatus | null | undefined, mode: ModeSetName, store: ModeSetStore = windowSets): ModeSetReading {
  const usable = transport ?? null
  // One subscription per carrier and mode: subscribing again on each render would ask a refused Set again on each render.
  const subscribe = useCallback((listener: () => void) => (usable ? store.listen(usable, mode, listener) : () => {}), [usable, mode, store])
  const held = useCallback(() => (usable ? store.held(usable, mode) : NO_TRANSPORT), [usable, mode, store])
  const reading = useSyncExternalStore(subscribe, held, held)
  useEffect(() => { if (usable) void store.read(usable, mode) }, [usable, mode, store])
  return reading
}

const NO_TRANSPORT: ModeSetReading = {state: 'unavailable', reason: 'The shell has published no kernel carrier for this reading.'}
