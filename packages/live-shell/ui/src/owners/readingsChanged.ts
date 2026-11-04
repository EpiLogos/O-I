// The kernel's notice that what its owner readings were read from has moved (kernel/src/events.rs `ReadingsChanged`, serialised
// as `{"event":"readings_changed","scopes":["root","project:O-I"],"epoch":42}`): a filesystem change under the Central root or the
// AIKit home, debounced and coalesced by the kernel. It is the one notice that replaces the owner-polling timers: every held
// owner answer its scopes touch (owners/ownerReading.ts `scopesTouch`) is marked unread, and those with live readers are asked again. The kernel answers from its read model unless the
// scope moved, so the re-ask of an unmoved answer is cheap.
//
// The held field's own news is the other notice (kernel/src/events.rs `SharedFieldChanged`, O-I #858): the window's SharedField
// client took a transaction, or the field came back from a lost service. It retires the answers read from the held field (the kernel
// scopes them `shared-field`) and the unscoped ones, never a ground reading, once per cursor: news at a cursor already told is none.
//
// Pure TypeScript: no view.

import type {KernelReceipt, SharedFieldChangedReceipt} from '../../../../../desktop/cradle/src/kernel/types'
import {announceReadingsMoved} from '../../../../../desktop/cradle/src/kernel/bridge'
import {ownerReadings, type OwnerReadings} from './ownerReading'

export const READINGS_CHANGED_EVENT = 'readings_changed'
export const SHARED_FIELD_CHANGED_EVENT = 'shared_field_changed'
/** The scope of every answer read from the window's held field (kernel/src/shared_field.rs `READ_SCOPE`). */
export const SHARED_FIELD_SCOPE = 'shared-field'

/** A scope the kernel names: `root`, `seats`, `aikit`, `work` (any project: named with every project that moved), `clock`, `all`,
 * or `project:<Name>`; and `shared-field`, the held field's, which its own news moves. */
export type ReadingsScope = 'root' | 'seats' | 'aikit' | 'work' | 'clock' | 'all' | 'shared-field' | `project:${string}`

export interface ReadingsChanged {
  scopes: ReadingsScope[]
  epoch: number
}

const SCOPE = /^(?:root|seats|aikit|work|clock|all|project:.+)$/

/** The notice a receipt carries, or null when the receipt is another kind or its fields are not the contract's (a non-empty
 * list of scopes, a non-negative integer epoch). */
export function readingsChangedOf(receipt: KernelReceipt): ReadingsChanged | null {
  if (receipt.event !== READINGS_CHANGED_EVENT) return null
  const {scopes, epoch} = receipt
  if (!Array.isArray(scopes) || scopes.length === 0 || !scopes.every(scope => typeof scope === 'string' && SCOPE.test(scope))) return null
  if (typeof epoch !== 'number' || !Number.isSafeInteger(epoch) || epoch < 0) return null
  return {scopes: scopes as ReadingsScope[], epoch}
}

export type SharedFieldNews = Pick<SharedFieldChangedReceipt, 'cursor' | 'changes' | 'more'>

const NEWS_OPS: ReadonlySet<string> = new Set(['insert', 'update', 'delete'])

/** The field's news a receipt carries, or null when the receipt is another kind or its fields are not the contract's (a non-empty
 * cursor, rows each a table, an insert, update or delete, and a ref, and a non-negative count of the rows only counted). */
export function sharedFieldChangedOf(receipt: KernelReceipt): SharedFieldNews | null {
  if (receipt.event !== SHARED_FIELD_CHANGED_EVENT) return null
  const {cursor, changes, more} = receipt
  if (typeof cursor !== 'string' || cursor === '') return null
  if (typeof more !== 'number' || !Number.isSafeInteger(more) || more < 0) return null
  if (!Array.isArray(changes) || !changes.every(change => change !== null && typeof change === 'object' && typeof change.table === 'string'
    && NEWS_OPS.has(change.op) && typeof change.ref === 'string')) return null
  return {cursor, changes: changes as SharedFieldNews['changes'], more}
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
  /** The scopes of the notices waiting out the debounce. */
  let waiting = new Set<string>()
  /** The field's cursor last told: news at it again (a replay after a resync) retires nothing. */
  let told: string | null = null
  return {
    receive(receipts) {
      let heard = false
      for (const receipt of receipts) {
        const notice = readingsChangedOf(receipt)
        if (notice) { for (const scope of notice.scopes) waiting.add(scope); heard = true; continue }
        const news = sharedFieldChangedOf(receipt)
        if (news && news.cursor !== told) { told = news.cursor; waiting.add(SHARED_FIELD_SCOPE); heard = true }
      }
      if (!heard) return
      if (pending !== null) timers.clear(pending)
      pending = timers.set(() => {
        pending = null
        const scopes = waiting.has('all') ? ['all'] : [...waiting]
        waiting = new Set()
        void registry.moved(scopes)
        announceReadingsMoved(scopes)
      }, delayMs)
    },
    // A write's own retire names no scopes: everything is retired, as the owner's state moved by an act the window cannot place.
    now() {
      if (pending !== null) { timers.clear(pending); pending = null }
      waiting = new Set()
      void registry.moved()
      announceReadingsMoved()
    },
    dispose() { if (pending !== null) { timers.clear(pending); pending = null }; waiting = new Set() },
  }
}

/** The window's driver, over the window's registry. */
export const windowReadingsChanged: ReadingsChangedDriver = createReadingsChangedDriver()
