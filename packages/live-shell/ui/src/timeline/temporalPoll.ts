// The frame's ONE temporal read — the kernel's `temporal_events_read`, read once for every reader in the frame, and read
// again when something says the field may have moved, never on a timer that outruns the kernel's cache.
//
// The read's real cost is the owner's: the projection walks every stream per call — one `central.now.thoughts.read` per NOW
// clearing (136 owner processes against the live ground, 15 Oct), Factory's runs, AIKit's history — 27–107 s a read; the
// kernel's own answer cache (2 s) never serves a reader that comes back later. Two readers share this read: the agent shell's
// run needles (agent/useTemporalEvents.ts) and the World cut (projections/useWorldTemporalReading.ts). It reads over the
// widest window any reader needs — the civil week through tomorrow, bounded at UTC midnights — and each reader narrows the
// shared events to its own scale. Nothing is copied: the reading is held once, by reference, and the kernel stays the store.
//
// When it reads (each a notice, owners/notices.ts):
//   - when its first reader subscribes;
//   - when the kernel pushes a receipt that can move the field (`receiptMovesTemporal`: a working surface driving an agent
//     session — the one kernel event with an instant —, a routine's returned action, a file or source change under the NOW
//     field, the wiki's returns, the civil time policy, or an owner write the kernel carried (now_changed, day_changed,
//     receiving_changed, factory_run_changed));
//   - when the shell's own acts tell it (`tellOwnerChanged({topic: 'temporal'})` — the agency reading moving is one: a
//     session started or ended changes the run streams);
//   - when the spine's epoch moves (a new native access or World: the standing reading belongs to the old one);
//   - when the person comes back to the window and the standing reading is older than a minute (other agents write NOW
//     thoughts and Factory runs this shell is never told about);
//   - and a slow floor, for those same untold writers: TEMPORAL_FLOOR_MS after the last completed read — so a read any notice
//     caused resets it — or at the next UTC midnight, when the window itself moves, whichever is first. The floor never reads
//     while the window is hidden: nobody sees what it would refresh, and coming back is a notice of its own.
// A notice that arrives while a read is in flight asks for one more read after it — the running read may have started before
// the change — never a pile.
//
// One poll per transport: the registry (`temporalPollFor`) hands every reader of one transport the same poll. A poll with no
// reader holds no timer and no listener; the last reader leaving stops it.

import {useContext, useEffect, useMemo, useSyncExternalStore} from 'react'
import {kernelOp, type KernelOpCall} from '../../../../../desktop/cradle/src/kernel/bridge'
import type {KernelReceipt, KernelTransportStatus} from '../../../../../desktop/cradle/src/kernel/types'
import type {TemporalEventRow, TemporalStreamAbsence} from './timeSpine'
import {onAttentionRegained, windowVisible} from '../owners/attention'
import {onOwnerChanged, receiptMovesTemporal} from '../owners/notices'
import {useSpineEpoch} from '../owners/spine'
import {Workspace} from '../shell/workspaceContext'

/** The floor for writes no kernel receipt reaches — another process's NOW return or thought, Day ensure or close, receiving act,
 * Factory run, AIKit history or wiki return (owners/notices.ts); a write the kernel carried reads at once on its receipt. Five
 * minutes after the last completed read, while visible. */
export const TEMPORAL_FLOOR_MS = 300_000

/** Coming back to the window reads again only when the standing reading is older than this. */
export const TEMPORAL_ATTENTION_MIN_AGE_MS = 60_000

/** 'reading' — the first read is in flight; 'ready' — a read stands; 'unavailable' — honest absence, named in `error`. */
export type TemporalPollStatus = 'reading' | 'ready' | 'unavailable'

/** What the poll holds: the last execution of the read, exactly as the kernel gave it. */
export interface TemporalReading {
  status: TemporalPollStatus
  /** The transport's or the owner's own words when `status` is 'unavailable'; null otherwise. */
  error: string | null
  events: TemporalEventRow[]
  /** The streams the reading names as contributing nothing, each with its owner's named cause. */
  absences: TemporalStreamAbsence[]
  /** The window the read asked for, `[from, to)` in unix ms. */
  windowFromUnixMs: number | null
  windowToUnixMs: number | null
  /** The instant the read was requested (the wall clock bounds the query window only). */
  requestedAtUnixMs: number | null
  /** The instant the read execution completed — what a firing clip records. */
  readAtUnixMs: number | null
  /** Moves once per completed execution (a refusal counts), never back: a reader processes each execution once. */
  revision: number
  /** What asked for the standing reading: 'first reader', a receipt's event, a told act, 'window regained', 'floor'… */
  cause: string | null
}

export interface TemporalPoll {
  /** The standing reading; the same object until an execution completes. */
  snapshot: () => TemporalReading
  /** The first subscriber starts the poll (one read now, its notices, its floor); the last one stops it. */
  subscribe: (listener: () => void) => () => void
  /** Read now. A read already in flight is awaited, never doubled. */
  refresh: () => Promise<void>
  /** Something may have moved the field: read now, or once more after the read in flight. */
  notice: (cause: string) => void
  /** The spine's receipts as they stand (the last 64) under `epoch`: any new one that can move the field is a notice; a new
   * epoch is a notice of its own. Idempotent — every reader may pass the same receipts. */
  observe: (receipts: readonly KernelReceipt[], epoch: string) => void
}

export interface TemporalPollOptions {
  /** The op executor; the kernel bridge by default. */
  kernelOp?: (transport: KernelTransportStatus, op: Parameters<typeof kernelOp>[1]) => Promise<KernelOpCall>
  now?: () => number
  floorMs?: number
  attentionMinAgeMs?: number
  /** Whether the person can see the window; the floor never reads while it cannot. */
  visible?: () => boolean
  /** The window's return and the shell's told acts; the window's own by default. A harness passes its own. */
  onAttention?: (listener: () => void) => () => void
  onTold?: (listener: (cause: string) => void) => () => void
}

/** The civil week through tomorrow, bounded at UTC midnights (day-bounded keys keep the kernel's answer cache warm
 * within a day; a per-read millisecond bound would defeat it and re-read every stream cold each time). */
export function civilWeekWindow(at: Date): {fromUnixMs: number; toUnixMs: number} {
  return {
    fromUnixMs: Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate() - 7),
    toUnixMs: Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate() + 1),
  }
}

/** The next instant the window moves: the next UTC midnight after `at`. */
export function nextWindowBoundary(at: number): number {
  const day = new Date(at)
  return Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate() + 1)
}

/** The kernel's own `between` rule (temporal_events.rs Window::Between): instants in `[from, to)`; an event with no
 * instant has no civil position and is never answered by a window. */
export function eventsBetween<T extends {instant_unix_ms?: number | null}>(events: readonly T[], fromUnixMs: number, toUnixMs: number): T[] {
  return events.filter(event => typeof event.instant_unix_ms === 'number' && event.instant_unix_ms >= fromUnixMs && event.instant_unix_ms < toUnixMs)
}

/** The kernel's own subject rule (temporal_events.rs TemporalQuery::matches): the event's subject, or any evidence ref it
 * carries, equals the wanted ref. */
export function eventsOfSubject<T extends {subject_ref: string; evidence_refs?: string[]}>(events: readonly T[], subject: string): T[] {
  return events.filter(event => event.subject_ref === subject || (event.evidence_refs ?? []).includes(subject))
}

/** A reading that holds no read: nothing stands, nothing is windowed. */
const noReading = (): Omit<TemporalReading, 'status' | 'revision'> => ({
  error: null, events: [], absences: [], windowFromUnixMs: null, windowToUnixMs: null, requestedAtUnixMs: null, readAtUnixMs: null, cause: null,
})

/** One poll over one transport. Exported for a harness that needs its own (a test, a second frame); the frame's readers
 * go through `temporalPollFor`, which keeps it to one. */
export function createTemporalPoll(transport: KernelTransportStatus, options: TemporalPollOptions = {}): TemporalPoll {
  const read = options.kernelOp ?? kernelOp
  const now = options.now ?? Date.now
  const floorMs = options.floorMs ?? TEMPORAL_FLOOR_MS
  const attentionMinAgeMs = options.attentionMinAgeMs ?? TEMPORAL_ATTENTION_MIN_AGE_MS
  const visible = options.visible ?? windowVisible
  const onAttention = options.onAttention ?? onAttentionRegained
  const onTold = options.onTold ?? (listener => onOwnerChanged('temporal', change => listener(change.cause)))
  const listeners = new Set<() => void>()
  let revision = 0
  let reading: TemporalReading = {...noReading(), status: 'reading', revision}
  let running = false
  let floor: ReturnType<typeof setTimeout> | null = null
  let detach: (() => void)[] = []
  // Bumped when the poll stops, so a read that was in flight then lands nowhere.
  let generation = 0
  let inFlight: Promise<void> | null = null
  /** A notice arrived while a read ran: one more read follows it, for this cause. */
  let again: string | null = null
  let stopping = false
  let epoch: string | null = null
  let lastSeq: number | null = null

  const publish = (next: Omit<TemporalReading, 'revision'>) => {
    reading = {...next, revision: ++revision}
    for (const listener of [...listeners]) listener()
  }

  const execute = async (cause: string): Promise<void> => {
    if (transport.kind === 'unavailable') {
      publish({...noReading(), status: 'unavailable', error: transport.reason ?? 'Transport unavailable', cause})
      return
    }
    const ticket = generation
    const requestedAtUnixMs = now()
    const {fromUnixMs, toUnixMs} = civilWeekWindow(new Date(requestedAtUnixMs))
    let result: KernelOpCall
    try {
      result = await read(transport, {
        op: 'temporal_events_read',
        query: {window: {window: 'between', from_unix_ms: fromUnixMs, to_unix_ms: toUnixMs}},
      })
    } catch (cause) {
      result = {outcome: null, error: String(cause)}
    }
    if (ticket !== generation) return
    if (result.error || result.outcome?.result !== 'temporal_events_reading') {
      publish({...noReading(), status: 'unavailable', error: result.error ?? 'Temporal events reading unavailable', cause})
      return
    }
    const document = result.outcome.document as {events?: TemporalEventRow[]; absences?: TemporalStreamAbsence[]} | undefined
    publish({
      status: 'ready',
      error: null,
      events: Array.isArray(document?.events) ? document.events : [],
      absences: Array.isArray(document?.absences) ? document.absences : [],
      windowFromUnixMs: fromUnixMs,
      windowToUnixMs: toUnixMs,
      requestedAtUnixMs,
      readAtUnixMs: now(),
      cause,
    })
  }

  /** The floor: TEMPORAL_FLOOR_MS after the last completed read, or the next UTC midnight, whichever is first. */
  const armFloor = () => {
    if (floor !== null) clearTimeout(floor)
    floor = null
    if (!running || transport.kind === 'unavailable') return
    const from = reading.readAtUnixMs ?? now()
    const at = Math.min(from + floorMs, nextWindowBoundary(from))
    floor = setTimeout(() => {
      floor = null
      // Hidden: nothing is shown, so nothing is read; the window's return is the notice that reads.
      if (!visible()) return
      void run(reading.readAtUnixMs !== null && nextWindowBoundary(reading.readAtUnixMs) <= now() ? 'the window moved (UTC midnight)' : 'floor')
    }, Math.max(0, at - now()))
  }

  // The projection re-reads every stream per call; a read in flight is awaited, never doubled.
  const run = (cause: string): Promise<void> => {
    if (inFlight) return inFlight
    const ticket = generation
    const mine: Promise<void> = execute(cause).finally(() => {
      if (inFlight === mine) inFlight = null
      if (ticket !== generation) return
      armFloor()
      if (again !== null) { const next = again; again = null; void run(next) }
    })
    inFlight = mine
    return mine
  }

  const notice = (cause: string) => {
    if (!running) return
    if (inFlight) { again = cause; return }
    void run(cause)
  }

  const start = () => {
    running = true
    void run('first reader')
    detach = [
      onAttention(() => {
        const age = reading.readAtUnixMs === null ? null : now() - reading.readAtUnixMs
        if (age === null || age >= attentionMinAgeMs) notice('window regained')
        else armFloor()
      }),
      onTold(cause => notice(cause)),
    ]
  }

  const stop = () => {
    running = false
    generation++
    inFlight = null
    again = null
    epoch = null
    lastSeq = null
    if (floor !== null) clearTimeout(floor)
    floor = null
    for (const off of detach) off()
    detach = []
    // Nothing stands for the next reader to mistake for a fresh read.
    reading = {...noReading(), status: 'reading', revision: ++revision}
  }

  const observe = (receipts: readonly KernelReceipt[], at: string) => {
    if (!running) return
    const highest = receipts.reduce((max, receipt) => Math.max(max, receipt.seq), 0)
    if (epoch !== at) {
      // The first observation takes the receipts as already read; a moved epoch retires the standing reading. While the first
      // read is still in flight (the boot, when the access settles in a step or two) the epoch's move asks for nothing more:
      // that read answers for the field, which no access generation of the shell's owns.
      const moved = epoch !== null && reading.readAtUnixMs !== null
      epoch = at
      lastSeq = highest
      if (moved) notice('the spine epoch moved')
      return
    }
    // A kernel that restarted numbers its receipts from 1 again under a new generation.
    if (lastSeq !== null && highest < lastSeq) lastSeq = 0
    const fresh = receipts.filter(receipt => receipt.seq > (lastSeq ?? 0))
    lastSeq = Math.max(lastSeq ?? 0, highest)
    const moving = fresh.find(receiptMovesTemporal)
    if (moving) notice(`kernel receipt ${moving.event}`)
  }

  return {
    snapshot: () => reading,
    subscribe(listener) {
      listeners.add(listener)
      if (!running) start()
      return () => {
        listeners.delete(listener)
        if (listeners.size > 0 || stopping) return
        // React replays an effect (unsubscribe, then subscribe) in the same task: stop only if no reader came back.
        stopping = true
        queueMicrotask(() => {
          stopping = false
          if (listeners.size === 0 && running) stop()
        })
      }
    },
    refresh: () => run('asked'),
    notice,
    observe,
  }
}

const polls = new Map<string, TemporalPoll>()
const NO_RECEIPTS: readonly KernelReceipt[] = []

/** The frame's poll for this transport: every reader of one transport gets the same one. */
export function temporalPollFor(transport: KernelTransportStatus): TemporalPoll {
  const key = JSON.stringify(transport)
  let poll = polls.get(key)
  if (!poll) {
    poll = createTemporalPoll(transport)
    polls.set(key, poll)
  }
  return poll
}

/** The standing reading of the frame's temporal read, re-rendering on each completed execution. Mounting it is a
 * subscription, not a poller: the poll is the frame's, and runs while any reader holds it. Each reader hands the poll the
 * spine's receipts and epoch it stands on; the poll takes each receipt once, however many readers pass it. */
export function useTemporalReading(transport: KernelTransportStatus): {reading: TemporalReading; refresh: () => Promise<void>} {
  const key = JSON.stringify(transport)
  // The key is the transport's identity: a new transport object with the same shape is the same poll.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const poll = useMemo(() => temporalPollFor(transport), [key])
  const reading = useSyncExternalStore(poll.subscribe, poll.snapshot, poll.snapshot)
  // Outside the shell's providers (a fixture, a server render) no receipt arrives and the epoch stands still.
  const receipts = useContext(Workspace)?.receipts ?? NO_RECEIPTS
  const epoch = useSpineEpoch()
  useEffect(() => { poll.observe(receipts, epoch) }, [poll, receipts, epoch])
  return {reading, refresh: poll.refresh}
}
