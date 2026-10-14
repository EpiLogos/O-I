// The frame's ONE temporal read — the kernel's `temporal_events_read`, polled once for every reader in the frame.
//
// The read's real cost is the owner's (K1: the temporal projection walks every stream per call — ~70 s against the live
// ground; the kernel's 2 s answer cache makes a repeat of the same query identical). Two pollers on it doubled that cost:
// the agent shell's run needles (agent/useTemporalEvents.ts) and the World cut (projections/useWorldTemporalReading.ts)
// each read it every 90 s. They now both consume THIS poll. It reads once when the first reader subscribes, then every
// 90 s, behind one in-flight guard, over the widest window any reader needs — the civil week through tomorrow, bounded at
// UTC midnights so the kernel's answer cache stays warm within a day. Each reader narrows the shared events to its own
// scale and keeps its own shape: the World cut takes the whole week with its absences; the agent's run needle takes the
// last 24 hours (`eventsBetween`, the kernel's own window rule). Nothing is copied: the reading is held once, by
// reference, and the kernel remains the one store.
//
// One poll per transport: the registry (`temporalPollFor`) hands every reader of one transport the same poll, so the
// frame — not each view — owns the cadence. A poll with no reader holds no timer; the last reader leaving stops it.
//
// Pure TypeScript apart from the one hook (`useTemporalReading`), which is a subscription to the poll's snapshot.

import {useMemo, useSyncExternalStore} from 'react'
import {kernelOp, type KernelOpCall} from '../../../../../desktop/cradle/src/kernel/bridge'
import type {KernelTransportStatus} from '../../../../../desktop/cradle/src/kernel/types'
import type {TemporalEventRow, TemporalStreamAbsence} from './timeSpine'

/** The needle cadence serves the read's real cost: once at the first subscriber, then every 90 s. */
export const TEMPORAL_POLL_MS = 90_000

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
}

export interface TemporalPoll {
  /** The standing reading; the same object until an execution completes. */
  snapshot: () => TemporalReading
  /** The first subscriber starts the poll (one read now, then every 90 s); the last one stops it. */
  subscribe: (listener: () => void) => () => void
  /** Read now. A read already in flight is awaited, never doubled. */
  refresh: () => Promise<void>
}

export interface TemporalPollOptions {
  /** The op executor; the kernel bridge by default. */
  kernelOp?: (transport: KernelTransportStatus, op: Parameters<typeof kernelOp>[1]) => Promise<KernelOpCall>
  now?: () => number
  periodMs?: number
}

/** The civil week through tomorrow, bounded at UTC midnights (day-bounded keys keep the kernel's answer cache warm
 * within a day; a per-poll millisecond bound would defeat it and re-read every stream cold each time). */
export function civilWeekWindow(at: Date): {fromUnixMs: number; toUnixMs: number} {
  return {
    fromUnixMs: Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate() - 7),
    toUnixMs: Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate() + 1),
  }
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
  error: null, events: [], absences: [], windowFromUnixMs: null, windowToUnixMs: null, requestedAtUnixMs: null, readAtUnixMs: null,
})

/** One poll over one transport. Exported for a harness that needs its own (a test, a second frame); the frame's readers
 * go through `temporalPollFor`, which keeps it to one. */
export function createTemporalPoll(transport: KernelTransportStatus, options: TemporalPollOptions = {}): TemporalPoll {
  const read = options.kernelOp ?? kernelOp
  const now = options.now ?? Date.now
  const periodMs = options.periodMs ?? TEMPORAL_POLL_MS
  const listeners = new Set<() => void>()
  let revision = 0
  let reading: TemporalReading = {...noReading(), status: 'reading', revision}
  let running = false
  let timer: ReturnType<typeof setInterval> | null = null
  // Bumped when the poll stops, so a read that was in flight then lands nowhere.
  let generation = 0
  let inFlight: Promise<void> | null = null
  let stopping = false

  const publish = (next: Omit<TemporalReading, 'revision'>) => {
    reading = {...next, revision: ++revision}
    for (const listener of [...listeners]) listener()
  }

  const execute = async (): Promise<void> => {
    if (transport.kind === 'unavailable') {
      publish({...noReading(), status: 'unavailable', error: transport.reason ?? 'Transport unavailable'})
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
      publish({...noReading(), status: 'unavailable', error: result.error ?? 'Temporal events reading unavailable'})
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
    })
  }

  // The projection re-reads every stream per call; overlapping ticks only pile bridge work behind a read that is still
  // running, so a read in flight is awaited, never doubled.
  const refresh = (): Promise<void> => {
    if (inFlight) return inFlight
    const mine: Promise<void> = execute().finally(() => { if (inFlight === mine) inFlight = null })
    inFlight = mine
    return mine
  }

  const start = () => {
    running = true
    void refresh()
    if (transport.kind !== 'unavailable') timer = setInterval(() => void refresh(), periodMs)
  }

  const stop = () => {
    running = false
    generation++
    inFlight = null
    if (timer !== null) clearInterval(timer)
    timer = null
    // Nothing stands for the next reader to mistake for a fresh read.
    reading = {...noReading(), status: 'reading', revision: ++revision}
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
    refresh,
  }
}

const polls = new Map<string, TemporalPoll>()

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
 * subscription, not a poller: the poll itself is the frame's, and runs while any reader holds it. */
export function useTemporalReading(transport: KernelTransportStatus): {reading: TemporalReading; refresh: () => Promise<void>} {
  const key = JSON.stringify(transport)
  // The key is the transport's identity: a new transport object with the same shape is the same poll.
  const poll = useMemo(() => temporalPollFor(transport), [key])
  const reading = useSyncExternalStore(poll.subscribe, poll.snapshot, poll.snapshot)
  return {reading, refresh: poll.refresh}
}
