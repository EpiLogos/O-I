// One owner's answer, held once for every reader in the window — so five views that need the same session's task record,
// or six that need the agent roster, ask the owner once between them. This is not a cache of authority: the owner stays the
// one store. It holds the last answer exactly as the owner gave it, with the instant it was read and the spine epoch it was
// read under, for exactly as long as something could not have told its readers it moved:
//
//   - keyed as the owner's answer is keyed (the op and its arguments, and the transport that reached it);
//   - one read in flight per key: every reader that asks while it runs is served by it;
//   - readers subscribe; the first one in asks, the rest read what stands;
//   - an answer is read again only when a notice says it may have changed (`refresh`: an act's receipt, the window
//     regained, an explicit ask) or its epoch moved — in the same world the last answer stays drawn, carried, while the new
//     one is read (MAP, the build lane's loading item: "a pane draws its last reading at once and refreshes behind it");
//     another world's answer is retired, never drawn, not even for a render;
//   - when its last reader leaves, the answer stays as the last reading (the window keeps KEPT_UNREAD of them, letting the
//     longest unread go first): a later reader draws it at once, carried, and the owner is asked again, since nobody was
//     told of what moved meanwhile; across a relaunch the same, from the window's kept answers (owners/keptReadings.ts);
//   - a refusal is remembered for its epoch: the same read is not asked again until the epoch moves or the person asks
//     (`retry`), and the refusal stays visible in the owner's own words meanwhile.
//
// Ported, not new: the held reading with one read in flight and its listeners is the cradle roster's
// (desktop/cradle/src/agency/roster.ts:80-104 `useAgentRoster`: `held` per scope, `inflight`, `listeners`), and the
// subscribe/snapshot store with its replay-safe release is the frame's temporal read's (timeline/temporalPoll.ts
// `subscribe`, the queueMicrotask release). What is added is the epoch an answer belongs to and the refusal it remembers.
//
// Pure TypeScript apart from `useOwnerReading`, a subscription.

import {useCallback, useEffect, useMemo, useReducer, useSyncExternalStore} from 'react'
import {windowKeptReadings, type KeptAnswer, type KeptReadings} from './keptReadings'

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
  /** The answer stands from before — an earlier access in this world, or before its readers came back — while the owner is
   * asked again; `readAtUnixMs` says when it was read. */
  readonly carried: boolean
}

/** One owner read. An answer is `{value}` with the kernel's `read_scopes` when it gave them (the scopes of every reading the
 * answer was made from; absent = unscoped); a refusal is `{error}` in the owner's words. A thrown error counts as a refusal. */
export type OwnerRead<T> = () => Promise<{value: T; read_scopes?: readonly string[]} | {error: string}>

/** The scopes of a read made of several: their union, or undefined (unscoped) when any of them was unscoped. `all` absorbs the rest. */
export function unionScopes(...parts: (readonly string[] | undefined)[]): string[] | undefined {
  const joined = new Set<string>()
  for (const part of parts) {
    if (part === undefined) return undefined
    for (const scope of part) joined.add(scope)
  }
  return joined.has('all') ? ['all'] : [...joined]
}

/** Whether an answer made from `held` is touched by a notice of `notice`: `all` on either side touches everything, an empty list
 * (memory only) nothing, an unscoped answer (undefined) any notice. */
export function scopesTouch(held: readonly string[] | undefined, notice: readonly string[] | undefined): boolean {
  if (held === undefined || notice === undefined) return true
  if (held.length === 0 || notice.length === 0) return false
  if (held.includes('all') || notice.includes('all')) return true
  return held.some(scope => notice.includes(scope))
}

/** A value with the scopes of the readings it was made from, for a read of several ops (`useHeldRead`'s `read` may return one). */
export class ScopedValue<T> {
  constructor(readonly value: T, readonly read_scopes: readonly string[] | undefined) {}
}
export const scoped = <T>(value: T, read_scopes: readonly string[] | undefined): ScopedValue<T> => new ScopedValue(value, read_scopes)

const READING: OwnerReading<never> = Object.freeze({status: 'reading', value: null, error: null, readAtUnixMs: null, epoch: null, refreshing: false, carried: false})

/** How many answers nobody reads the window keeps as last readings. */
export const KEPT_UNREAD = 64

/** The world half of a spine key (owners/spine.ts spineEpochKey: `access|world`); a key of another shape is its own world. */
const worldOf = (epoch: string): string => epoch.slice(epoch.indexOf('|') + 1)
/** Whether an answer read under `read` may be drawn under `epoch`: the same world, whatever the access. */
export const sameWorld = (read: string | null, epoch: string): boolean => read !== null && worldOf(read) === worldOf(epoch)

let through = 0
/** Whether a held reading is being asked again behind the answer it stands on (a reader come back, a notice, a retry). The kernel
 * reads it makes while it starts go to the kernel, not to the window's other held answers: those stood on the same moment, so a
 * reader coming back has the owner asked behind what it draws, as it always did. The kernel answers from its read model unless the
 * sources moved, so asking through costs no owner process. */
export const askingThrough = (): boolean => through > 0
function readThrough<R>(read: () => R): R {
  through++
  try { return read() } finally { through-- }
}

export class OwnerReadingEntry<T> {
  private state: OwnerReading<T> = READING
  private readonly listeners = new Set<() => void>()
  private inFlight: {epoch: string; promise: Promise<void>} | null = null
  /** The one read promised to follow the read in flight, for those who asked while it ran. */
  private following: {epoch: string; promise: Promise<void>} | null = null
  private ticket = 0
  /** The scopes the standing answer was read from; undefined = unscoped (also an answer kept from an earlier window). */
  private scopes: readonly string[] | undefined = undefined
  /** Its readers all left: whoever reads it next draws it at once and has the owner asked again. */
  private unread = false
  /** How many times the owner was actually asked — the census a reader-count test reads. */
  asks = 0

  constructor(readonly key: string, private read: OwnerRead<T>, private readonly now: () => number, private readonly release: (entry: OwnerReadingEntry<T>) => void,
    kept: KeptAnswer | null = null, private readonly keep: (answer: KeptAnswer | null) => void = () => {}) {
    // An answer kept from an earlier window is this window's last reading: drawn at once, carried, the owner asked again when read.
    if (kept) {
      this.state = {status: 'answered', value: kept.value as T, error: null, readAtUnixMs: kept.readAtUnixMs, epoch: kept.epoch, refreshing: false, carried: true}
      this.unread = true
    }
  }

  snapshot = (): OwnerReading<T> => this.state

  get readers(): number { return this.listeners.size }

  get readScopes(): readonly string[] | undefined { return this.scopes }

  /** Whether a notice of `scopes` (undefined = every scope) may have moved the standing answer. */
  touchedBy(scopes: readonly string[] | undefined): boolean { return scopesTouch(this.scopes, scopes) }

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

  /** Make an answer stand for `epoch`: ask the owner if none stands for it (a remembered refusal stands), or if its readers
   * all left since it was read. */
  ensure(epoch: string): Promise<void> {
    if (this.state.epoch === epoch && this.state.status !== 'reading' && !this.unread) return Promise.resolve()
    return this.ask(epoch)
  }

  /** Its last reader left (the registry's release): the answer stays as the last reading, to be asked again when read. */
  leave(): void { this.unread = true }

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
  accept(value: T, epoch: string, readScopes?: readonly string[]): void {
    if (this.inFlight?.epoch === epoch) return
    this.scopes = readScopes
    const readAtUnixMs = this.now()
    this.publish({status: 'answered', value, error: null, readAtUnixMs, epoch, refreshing: false, carried: false})
    this.keep({value, readAtUnixMs, epoch})
  }

  /** The kernel said the owner's sources moved: the answer may no longer be the owner's. With readers it is asked again behind the
   * standing answer (one read in flight, one following, however many notices arrive); with none it is marked unread, so the next
   * reader draws it carried and has the owner asked. A key never read has nothing to retire. `scopes` are the notice's: an answer
   * they do not touch stands as it is; without them every answer is touched. */
  moved(scopes?: readonly string[]): Promise<void> {
    const epoch = this.state.epoch
    if (epoch === null || this.state.status === 'reading') return Promise.resolve()
    if (!this.touchedBy(scopes)) return Promise.resolve()
    this.unread = true
    if (this.listeners.size === 0) return Promise.resolve()
    // A driver reads this answer on the notice itself (owners/agency.ts), with a hook after it: not asked twice.
    if (this.driven) return Promise.resolve()
    return this.askAfter(epoch)
  }

  /** The answer is no longer the owner's: whoever reads it next draws it carried and has the owner asked. The registry marks every
   * entry before any is asked, so a read that is made of other held reads finds those retired too. */
  retire(): void {
    if (this.state.epoch !== null && this.state.status !== 'reading') this.unread = true
  }

  private driven = false
  /** A driver takes over reading this answer on the kernel's notice (`moved` then leaves it to the driver). */
  drive(on: boolean): void { this.driven = on }

  /** The age of the standing answer at `at`, or null when none stands. */
  ageAt(at: number): number | null {
    return this.state.readAtUnixMs == null ? null : at - this.state.readAtUnixMs
  }

  private publish(next: OwnerReading<T>) {
    this.state = next
    for (const listener of [...this.listeners]) listener()
  }

  private ask(epoch: string): Promise<void> {
    const unread = this.unread
    this.unread = false
    if (this.inFlight?.epoch === epoch) return this.inFlight.promise
    const ticket = ++this.ticket
    const standing = this.state
    const again = standing.status === 'answered'
    // The last answer is carried while the owner is asked again — across a renewed access in its world, or to a reader come
    // back — and retired across worlds; a refusal is never carried into another epoch.
    if (standing.status === 'answered' && sameWorld(standing.epoch, epoch) && (standing.epoch !== epoch || unread)) this.publish({...standing, epoch, refreshing: true, carried: true})
    else if (standing.epoch !== epoch) this.publish({...READING, epoch, refreshing: true})
    else this.publish({...standing, refreshing: true})
    this.asks++
    const promise = (async () => {
      let outcome: {value: T; read_scopes?: readonly string[]} | {error: string}
      try {
        outcome = await (again ? readThrough(() => this.read()) : this.read())
      } catch (cause) {
        outcome = {error: cause instanceof Error ? cause.message : String(cause)}
      }
      if (ticket !== this.ticket) return
      this.inFlight = null
      this.scopes = 'error' in outcome ? undefined : outcome.read_scopes
      const readAtUnixMs = this.now()
      this.publish('error' in outcome
        ? {status: 'refused', value: null, error: outcome.error, readAtUnixMs, epoch, refreshing: false, carried: false}
        : {status: 'answered', value: outcome.value, error: null, readAtUnixMs, epoch, refreshing: false, carried: false})
      // The window keeps its last answer across a relaunch; a refusal forgets it.
      this.keep('error' in outcome ? null : {value: outcome.value, readAtUnixMs, epoch})
    })()
    this.inFlight = {epoch, promise}
    return promise
  }
}

export interface OwnerReadings {
  /** The entry for `key`, made on first use; every caller with the same key gets the same entry. A `volatile` entry's answer is
   * never kept across a relaunch (file contents, which the window's storage should not carry). */
  entry<T>(key: string, read: OwnerRead<T>, volatile?: boolean): OwnerReadingEntry<T>
  /** A read made with no subscriber is done: let the entry go like one whose last reader left (bounded as the unread are). */
  park(entry: OwnerReadingEntry<unknown>): void
  /** Every held entry (a test's census; a notice that refreshes all of one family). */
  entries(): OwnerReadingEntry<unknown>[]
  /** The kernel's notice that owner sources moved: every held answer the notice's `scopes` touch (all, without scopes) is marked
   * unread, and those with live readers are asked again. */
  moved(scopes?: readonly string[]): Promise<void>
}

/** A registry of entries. The window has one (`ownerReadings`); a test makes its own. `kept` holds the last answers across a
 * relaunch (the window's own storage, owners/keptReadings.ts); without it nothing outlives the registry. */
export function createOwnerReadings(now: () => number = Date.now, kept?: KeptReadings): OwnerReadings {
  const held = new Map<string, OwnerReadingEntry<unknown>>()
  /** The answers nobody reads, longest unread first. */
  const unread = new Map<string, OwnerReadingEntry<unknown>>()
  /** `readerLeft`: its last reader went, so the next one draws it carried and has the owner asked. Parked, an entry that was only
   * read once from code keeps its answer as it stands; either way it joins the bounded set of answers nobody reads. */
  const retain = (entry: OwnerReadingEntry<unknown>, readerLeft: boolean) => {
    if (held.get(entry.key) !== entry) return
    const status = entry.snapshot().status
    // A refusal is remembered for its epoch even with nobody reading; a read that never answered has nothing to draw.
    if (status === 'refused') { if (!readerLeft && entry.readers === 0) held.delete(entry.key); return }
    if (status === 'reading' && !readerLeft) return
    if (status !== 'answered') { held.delete(entry.key); return }
    if (readerLeft) entry.leave()
    unread.delete(entry.key)
    unread.set(entry.key, entry)
    for (const [key, kept] of unread) {
      if (unread.size <= KEPT_UNREAD) break
      unread.delete(key)
      if (held.get(key) === kept && kept.readers === 0) held.delete(key)
    }
  }
  const release = (entry: OwnerReadingEntry<unknown>) => retain(entry, true)
  return {
    park: entry => { if (entry.readers === 0) retain(entry, false) },
    entry<T>(key: string, read: OwnerRead<T>, volatile = false): OwnerReadingEntry<T> {
      let entry = held.get(key) as OwnerReadingEntry<T> | undefined
      unread.delete(key)
      if (!entry) {
        entry = new OwnerReadingEntry<T>(key, read, now, release as (entry: OwnerReadingEntry<T>) => void, volatile ? null : kept?.get(key) ?? null, answer => { if (!volatile) kept?.put(key, answer) })
        held.set(key, entry as OwnerReadingEntry<unknown>)
      } else entry.rebind(read)
      return entry
    },
    entries: () => [...held.values()],
    moved: async (scopes?: readonly string[]) => {
      const touched = [...held.values()].filter(entry => entry.touchedBy(scopes))
      for (const entry of touched) entry.retire()
      await Promise.all(touched.map(entry => entry.moved(scopes)))
    },
  }
}

/** The window's one registry. */
export const ownerReadings: OwnerReadings = createOwnerReadings(Date.now, windowKeptReadings())

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
  const held = useSyncExternalStore(subscribe, snapshot, snapshot)
  // An answer kept from another world is never drawn, not even for the render before this reader's first read.
  const reading = held.epoch !== null && !sameWorld(held.epoch, epoch) ? READING as OwnerReading<T> : held
  useEffect(() => { if (entry) void entry.ensure(epoch) }, [entry, epoch])
  const refresh = useCallback(() => { if (entry) void entry.refresh(epoch) }, [entry, epoch])
  const retry = useCallback(() => { if (entry) void entry.retry(epoch) }, [entry, epoch])
  return {reading, refresh, retry}
}

/** Many rows' standing answers under `epoch`, by row: what a reader of many rows draws at once — the last answer included, and
 * never another world's. */
export function answersOf<T>(rows: readonly (readonly [string, OwnerReadingEntry<T>])[], epoch: string): ReadonlyMap<string, T> {
  const answers = new Map<string, T>()
  for (const [row, entry] of rows) {
    const standing = entry.snapshot()
    if (standing.status === 'answered' && sameWorld(standing.epoch, epoch)) answers.set(row, standing.value as T)
  }
  return answers
}

/** Make each entry's answer stand for `epoch`, one after another, so the carrier never sees a pile; stops when `live()` turns
 * false (its reader left). */
export async function ensureInOrder(entries: readonly OwnerReadingEntry<unknown>[], epoch: string, live: () => boolean = () => true): Promise<void> {
  for (const entry of entries) {
    if (!live()) return
    await entry.ensure(epoch)
  }
}

/** One reader of many rows (a browser list's per-row readings): each row an entry under `keyOf(row)`, read by `read(row)`, asked
 * one after another; each row's last answer drawn at once. */
export function useOwnerReadingsOf<T>(rows: readonly string[], keyOf: (row: string) => string, read: (row: string) => OwnerRead<T>, epoch: string,
  registry: OwnerReadings = ownerReadings): ReadonlyMap<string, T> {
  const basis = JSON.stringify(rows.map(keyOf))
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the basis names the rows' keys
  const entries = useMemo(() => rows.map(row => [row, registry.entry(keyOf(row), read(row))] as const), [basis, registry])
  const [, arrived] = useReducer((count: number) => count + 1, 0)
  useEffect(() => {
    const offs = entries.map(([, entry]) => entry.subscribe(arrived))
    let live = true
    void ensureInOrder(entries.map(([, entry]) => entry as OwnerReadingEntry<unknown>), epoch, () => live)
    return () => { live = false; for (const off of offs) off() }
  }, [entries, epoch])
  return answersOf(entries, epoch)
}
