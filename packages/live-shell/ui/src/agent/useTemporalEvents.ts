import {useCallback, useEffect, useRef, useState} from 'react'
import {kernelOp} from '../../../../../desktop/cradle/src/kernel/bridge'
import type {KernelTransportStatus} from '../../../../../desktop/cradle/src/kernel/types'
import type {TemporalEventLike} from './agentRunModel'

/** One temporal event as the kernel projects it (temporal_events.rs:136). */
export type TemporalEventRow = TemporalEventLike

// The temporal projection re-reads every stream per call — ~70 s against
// the live ground even for a day window — so the needle cadence serves the
// read's real cost: once at mount, then every 90 s. (Turn streaming, when
// it lands, replaces this cadence entirely; gateway backlog item 1.)
const POLL_MS = 90000

/**
 * The ONE temporal-events poll (4 s). Called only by AgentSessionsProvider —
 * every view reads events through the provider's context, so needles across
 * the Arrangement come from one reading, never one poller per view.
 */
export function useTemporalEvents(transport: KernelTransportStatus, subject?: string) {
  const [events, setEvents] = useState<TemporalEventRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const refresh = useCallback(async () => {
    if (transport.kind === 'unavailable') {
      if (mounted.current) {
        setError(transport.reason ?? 'Transport unavailable')
        setEvents([])
      }
      return
    }
    // The run viewer is today-scale; the projection walks every stream per
    // call, so the window is bounded to the last civil day rather than all
    // history (the unbounded read took ~129 s against the live ground).
    const toUnixMs = Date.now()
    const result = await kernelOp(transport, {
      op: 'temporal_events_read',
      query: {
        window: {window: 'between', from_unix_ms: toUnixMs - 24 * 60 * 60 * 1000, to_unix_ms: toUnixMs},
        ...(subject ? {subject} : {}),
      },
    })
    if (!mounted.current) return
    if (result.error || result.outcome?.result !== 'temporal_events_reading') {
      setError(result.error ?? 'Temporal events reading unavailable')
      setEvents([])
      return
    }
    const document = result.outcome.document as {events?: TemporalEventRow[]}
    setError(null)
    setEvents(Array.isArray(document?.events) ? document.events : [])
  }, [transport, subject])

  // The temporal projection re-reads every stream per call; overlapping
  // ticks only pile bridge work behind a read that is still running.
  const inFlight = useRef(false)
  useEffect(() => {
    const ticked = async () => {
      if (inFlight.current) return
      inFlight.current = true
      try { await refresh() } finally { inFlight.current = false }
    }
    void ticked()
    const id = setInterval(() => void ticked(), POLL_MS)
    return () => clearInterval(id)
  }, [refresh])

  return {events, error, refresh}
}
