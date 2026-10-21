// The kernel's notice that what its owner readings were read from has moved (kernel/src/events.rs `ReadingsChanged`, serialised
// as `{"event":"readings_changed","scopes":["root","project:O-I"],"epoch":42}`): a filesystem change under the Central root or the
// AIKit home, debounced and coalesced by the kernel. It is the one notice that replaces the owner-polling timers: every held
// owner answer is marked unread, and those with live readers are asked again. The kernel answers from its read model unless the
// scope moved, so the re-ask of an unmoved answer is cheap.
//
// Pure TypeScript: no view.

import type {KernelReceipt} from '../../../../../desktop/cradle/src/kernel/types'
import {ownerReadings, type OwnerReadings} from './ownerReading'

export const READINGS_CHANGED_EVENT = 'readings_changed'

/** A scope the kernel names: `root`, `seats`, `aikit`, `clock`, `all`, or `project:<Name>`. */
export type ReadingsScope = 'root' | 'seats' | 'aikit' | 'clock' | 'all' | `project:${string}`

export interface ReadingsChanged {
  scopes: ReadingsScope[]
  epoch: number
}

const SCOPE = /^(?:root|seats|aikit|clock|all|project:.+)$/

/** The notice a receipt carries, or null when the receipt is another kind or its fields are not the contract's (a non-empty
 * list of scopes, a non-negative integer epoch). */
export function readingsChangedOf(receipt: KernelReceipt): ReadingsChanged | null {
  if (receipt.event !== READINGS_CHANGED_EVENT) return null
  const {scopes, epoch} = receipt
  if (!Array.isArray(scopes) || scopes.length === 0 || !scopes.every(scope => typeof scope === 'string' && SCOPE.test(scope))) return null
  if (typeof epoch !== 'number' || !Number.isSafeInteger(epoch) || epoch < 0) return null
  return {scopes: scopes as ReadingsScope[], epoch}
}

export interface ReadingsChangedDriver {
  /** Take receipts as they arrive; any notice among them schedules the re-read. */
  receive(receipts: readonly KernelReceipt[]): void
  /** Something this window did moved an owner's ground (a write completed): every held answer is retired at once, without waiting
   * for the kernel's notice, so the read that follows a write is the owner's. */
  now(): void
  /** Drop a scheduled re-read (the window is closing). */
  dispose(): void
}

/** Debounce the notices: a burst is one `moved()` on the registry, `delayMs` after the last notice. */
export function createReadingsChangedDriver(registry: OwnerReadings = ownerReadings, delayMs = 250,
  timers: {set: (run: () => void, ms: number) => unknown; clear: (handle: unknown) => void} = {set: (run, ms) => setTimeout(run, ms), clear: handle => clearTimeout(handle as ReturnType<typeof setTimeout>)}): ReadingsChangedDriver {
  let pending: unknown = null
  return {
    receive(receipts) {
      if (!receipts.some(receipt => readingsChangedOf(receipt))) return
      if (pending !== null) timers.clear(pending)
      pending = timers.set(() => { pending = null; void registry.moved() }, delayMs)
    },
    now() {
      if (pending !== null) { timers.clear(pending); pending = null }
      void registry.moved()
    },
    dispose() { if (pending !== null) { timers.clear(pending); pending = null } },
  }
}

/** The window's driver, over the window's registry. */
export const windowReadingsChanged: ReadingsChangedDriver = createReadingsChangedDriver()
