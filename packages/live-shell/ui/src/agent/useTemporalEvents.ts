import {useMemo} from 'react'
import type {KernelTransportStatus} from '../../../../../desktop/cradle/src/kernel/types'
import {eventsBetween, eventsOfSubject, useTemporalReading, type TemporalReading} from '../timeline/temporalPoll'
import type {TemporalEventLike} from './agentRunModel'

/** One temporal event as the kernel projects it (temporal_events.rs:136). */
export type TemporalEventRow = TemporalEventLike

// The run viewer is today-scale: its window is the last civil day of the frame's one temporal read, not all history.
// (The unbounded read took ~129 s against the live ground, and the projection walks every stream per call whatever the
// window — so the frame reads once, widest, and each reader narrows: timeline/temporalPoll.ts.)
export const AGENT_WINDOW_MS = 24 * 60 * 60 * 1000

/** The agent shell's view of the frame's temporal reading: the events in the 24 hours before the read was requested (the
 * kernel's own `between` rule), and — when a subject is wanted — those the kernel's subject rule answers. Empty until a
 * read stands. */
export function agentTemporalEvents(reading: TemporalReading, subject?: string): TemporalEventRow[] {
  if (reading.status !== 'ready' || reading.requestedAtUnixMs == null) return []
  const windowed = eventsBetween(reading.events, reading.requestedAtUnixMs - AGENT_WINDOW_MS, reading.requestedAtUnixMs)
  return subject ? eventsOfSubject(windowed, subject) : windowed
}

/**
 * The agent shell's reader of the frame's ONE temporal-events poll (timeline/temporalPoll.ts, once at mount then every
 * 90 s — turn streaming, when it lands, replaces this cadence entirely; gateway backlog item 1). Called only by
 * AgentSessionsProvider — every view reads events through the provider's context, so needles across the Arrangement
 * come from one reading, never one poller per view. This hook polls nothing: the World cut reads the same poll.
 */
export function useTemporalEvents(transport: KernelTransportStatus, subject?: string) {
  const {reading, refresh} = useTemporalReading(transport)
  const events = useMemo(() => agentTemporalEvents(reading, subject), [reading, subject])
  const error = reading.status === 'unavailable' ? reading.error : null
  return {events, error, refresh}
}
