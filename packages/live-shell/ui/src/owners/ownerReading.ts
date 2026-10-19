// One owner's answer, held once for every reader in the window — so five views that need the same session's task record,
// or six that need the agent roster, ask the owner once between them. This is not a cache of authority: the owner stays the
// one store. It holds the last answer exactly as the owner gave it, with the instant it was read and the spine epoch it was
// read under, for exactly as long as something could not have told its readers it moved:
//
//   - keyed as the owner's answer is keyed (the op and its arguments, and the transport that reached it);
//   - one read in flight per key: every reader that asks while it runs is served by it;
//   - readers subscribe; the first one in asks, the rest read what stands;
//   - an answer is read again only when a notice says it may have changed (`refresh`: an act's receipt, the window
//     regained, an explicit ask) or its epoch moved — then it is retired, never shown as the new epoch's;
//   - an answer is let go when its last reader leaves: a later reader asks the owner again rather than read an answer
//     nobody was told about;
//   - a refusal is remembered for its epoch: the same read is not asked again until the epoch moves or the person asks
//     (`retry`), and the refusal stays visible in the owner's own words meanwhile.
//
// Ported, not new: the held reading with one read in flight and its listeners is the cradle roster's
// (desktop/cradle/src/agency/roster.ts:80-104 `useAgentRoster`: `held` per scope, `inflight`, `listeners`), and the
// subscribe/snapshot store with its replay-safe release is the frame's temporal read's (timeline/temporalPoll.ts
// `subscribe`, the queueMicrotask release). What is added is the epoch an answer belongs to and the refusal it remembers.
//
// Pure TypeScript apart from `useOwnerReading`, a subscription.

import {useCallback, useEffect, useMemo, useSyncExternalStore} from 'react'

/** 'reading' — no answer stands for this epoch yet; 'answered' — the owner's answer; 'refused' — the owner's refusal. */
export type OwnerReadStatus = 'reading' | 'answered' | 'refused'

export interface OwnerReading<T> {
  readonly status: OwnerReadStatus
  /** The owner's answer, verbatim, when `status` is 'answered'; null otherwise. */
  readonly value: T | null
  /** The owner's refusal in its own words when `status` is 'refused'; null otherwise. */
  readonly error: string | null
  /** When the standing answer or refusal was read (the read's completion), never the time it is looked at. */
  readonly readAtUnixMs: number | null
  /** The spine epoch the standing answer was read under. */
  readonly epoch: string | null
  /** A read is in flight (the first, or a re-read behind a standing answer). */
  readonly refreshing: boolean
}

/** One owner read. An answer is `{value}`; a refusal is `{error}` in the owner's words. A thrown error counts as a refusal. */
export type OwnerRead<T> = () => Promise<{value: T} | {error: string}>

const READING: OwnerReading<never> = Object.freeze({status: 'reading', value: null, error: null, readAtUnixMs: null, epoch: null, refreshing: false})

export class OwnerReadingEntry<T> {
  private state: OwnerReading<T> = READING
  private readonly listeners = new Set<() => void>()
  private inFlight: {epoch: string; promise: Promise<void>} | null = null
  /** The one read promised to follow the read in flight, for those who asked while it ran. */
  private following: {epoch: string; promise: Promise<void>} | null = null
  private ticket = 0
  /** How many times the owner was actually asked — the census a reader-count test reads. */
  asks = 0

  constructor(readonly key: string, private read: OwnerRead<T>, private readonly now: () => number, private readonly release: (entry: OwnerReadingEntry<T>) => void) {}

  snapshot = (): OwnerReading<T> => this.state

  get readers(): number { return this.listeners.size }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
      if (this.listeners.size > 0) return
      // React replays an effect (unsubscribe, then subscribe) in one task: let go only if no reader came back.
      queueMicrotask(() => { if (this.listeners.size === 0) this.release(this) })
    }
  }

  /** The read a later caller hands in is the same owner read by its key; it replaces the held closure only so the newest
   * transport object is the one used. */
  rebind(read: OwnerRead<T>) { this.read = read }

  /** Make an answer stand for `epoch`: ask the owner if none stands for it (a remembered refusal stands). */
  ensure(epoch: string): Promise<void> {
    if (this.state.epoch === epoch && this.state.status !== 'reading') return Promise.resolve()
    return this.ask(epoch)
  }

  /** A notice said the answer may have changed: ask again, behind the standing answer. A refusal remembered for this epoch is
   * not asked again — only `retry` (the person) or a new epoch asks it. */
  refresh(epoch: string): Promise<void> {
    if (this.state.epoch === epoch && this.state.status === 'refused') return Promise.resolve()
    return this.askAfter(epoch)
  }

  /** The person asked: read again whatever stands, a refusal included. */
  retry(epoch: string): Promise<void> {
    return this.askAfter(epoch)
  }

  /** A read that begins after this call. One in flight may have begun before what moved (r22: a Day write landed while the ground
   * was being read, and the refresh after it was answered by that older read), so one more read follows it — one, however many
   * ask while it runs. With none in flight it simply reads. */
  private askAfter(epoch: string): Promise<void> {
    const running = this.inFlight
    if (!running || running.epoch !== epoch) return this.ask(epoch)
    if (this.following?.epoch === epoch) return this.following.promise
    const promise = running.promise.then(() => { this.following = null; return this.ask(epoch) })
    this.following = {epoch, promise}
    return promise
  }

  /** An answer the owner gave this key in a wider read (one list read for many keys): it stands for `epoch` as if read here.
   * A read of this key in flight for the same epoch answers after it and wins. */
  accept(value: T, epoch: string): void {
    if (this.inFlight?.epoch === epoch) return
    this.publish({status: 'answered', value, error: null, readAtUnixMs: this.now(), epoch, refreshing: false})
  }

  /** The age of the standing answer at `at`, or null when none stands. */
  ageAt(at: number): number | null {
    return this.state.readAtUnixMs == null ? null : at - this.state.readAtUnixMs
  }

  private publish(next: OwnerReading<T>) {
    this.state = next
    for (const listener of [...this.listeners]) listener()
  }

  private ask(epoch: string): Promise<void> {
    if (this.inFlight?.epoch === epoch) return this.inFlight.promise
    const ticket = ++this.ticket
    // An answer from another epoch is retired, never carried into this one.
    if (this.state.epoch !== epoch) this.publish({...READING, epoch, refreshing: true})
    else this.publish({...this.state, refreshing: true})
    this.asks++
    const promise = (async () => {
      let outcome: {value: T} | {error: string}
      try {
        outcome = await this.read()
      } catch (cause) {
        outcome = {error: cause instanceof Error ? cause.message : String(cause)}
      }
      if (ticket !== this.ticket) return
      this.inFlight = null
      const readAtUnixMs = this.now()
      this.publish('error' in outcome
        ? {status: 'refused', value: null, error: outcome.error, readAtUnixMs, epoch, refreshing: false}
        : {status: 'answered', value: outcome.value, error: null, readAtUnixMs, epoch, refreshing: false})
    })()
    this.inFlight = {epoch, promise}
    return promise
  }
}

export interface OwnerReadings {
  /** The entry for `key`, made on first use; every caller with the same key gets the same entry. */
  entry<T>(key: string, read: OwnerRead<T>): OwnerReadingEntry<T>
  /** Every held entry (a test's census; a notice that refreshes all of one family). */
  entries(): OwnerReadingEntry<unknown>[]
}

/** A registry of entries. The window has one (`ownerReadings`); a test makes its own. */
export function createOwnerReadings(now: () => number = Date.now): OwnerReadings {
  const held = new Map<string, OwnerReadingEntry<unknown>>()
  const release = (entry: OwnerReadingEntry<unknown>) => {
    // A refusal is remembered for its epoch even with nobody reading; an answer is let go.
    if (held.get(entry.key) === entry && entry.snapshot().status !== 'refused') held.delete(entry.key)
  }
  return {
    entry<T>(key: string, read: OwnerRead<T>): OwnerReadingEntry<T> {
      let entry = held.get(key) as OwnerReadingEntry<T> | undefined
      if (!entry) {
        entry = new OwnerReadingEntry<T>(key, read, now, release as (entry: OwnerReadingEntry<T>) => void)
        held.set(key, entry as OwnerReadingEntry<unknown>)
      } else entry.rebind(read)
      return entry
    },
    entries: () => [...held.values()],
  }
}

/** The window's one registry. */
export const ownerReadings: OwnerReadings = createOwnerReadings()

/** Subscribe to one owner answer under the spine `epoch`. `key` null reads nothing (no subject yet). The answer is asked for
 * on the first subscription and whenever the epoch moves; `refresh` and `retry` are the notices' and the person's asks. */
export function useOwnerReading<T>(key: string | null, read: OwnerRead<T>, epoch: string, registry: OwnerReadings = ownerReadings): {
  reading: OwnerReading<T>
  refresh: () => void
  retry: () => void
} {
  // The read closure is the caller's; the key names it. A new closure for the same key is the same read.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const entry = useMemo(() => key ? registry.entry(key, read) : null, [key, registry])
  if (entry) entry.rebind(read)
  const subscribe = useCallback((listener: () => void) => entry ? entry.subscribe(listener) : () => {}, [entry])
  const snapshot = useCallback(() => entry ? entry.snapshot() : READING as OwnerReading<T>, [entry])
  const reading = useSyncExternalStore(subscribe, snapshot, snapshot)
  useEffect(() => { if (entry) void entry.ensure(epoch) }, [entry, epoch])
  const refresh = useCallback(() => { if (entry) void entry.refresh(epoch) }, [entry, epoch])
  const retry = useCallback(() => { if (entry) void entry.retry(epoch) }, [entry, epoch])
  return {reading, refresh, retry}
}
