import {useCallback, useEffect, useRef, useState} from 'react'
import {readAgency} from '../../../../../desktop/cradle/src/agency/agencySources'
import type {AgencySessionRow} from '../../../../../desktop/cradle/src/agency/agencyTypes'
import type {KernelTransportStatus} from '../../../../../desktop/cradle/src/kernel/types'
import {buildTracks, trackKey, type AgentSessionTrack} from './agentRunModel'
import {useAgentSessionsOptional} from './AgentSessionsProvider'

export type {AgentSessionTrack} from './agentRunModel'

/** The legacy track view: the model track plus the `id` key the shell's
 * selection state (`selectedTrackId` / `threadTrackId`) has always held. */
export type AgentSessionTrackView = AgentSessionTrack & {id: string}

const POLL_MS = 3000
const PROJECT = 'O-I'

const withIds = (tracks: AgentSessionTrack[]): AgentSessionTrackView[] =>
  tracks.map(track => ({...track, id: trackKey(track)}))

/**
 * The agency-reading hook, now a view over the ONE poll source. When
 * `AgentSessionsProvider` is mounted above the caller this only maps the
 * provider's context — no second poller. When no provider exists yet (the
 * pre-integration App / AgentContextDock call sites), it keeps a single local
 * agency cadence so those surfaces keep working; the integrator mounts the
 * provider once and every caller collapses onto the shared reading.
 */
export function useAgencySessions(transport: KernelTransportStatus) {
  const sessions = useAgentSessionsOptional()
  const [fallbackRows, setFallbackRows] = useState<AgencySessionRow[]>([])
  const [fallbackError, setFallbackError] = useState<string | null>(null)
  const [fallbackLoading, setFallbackLoading] = useState(true)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const fallbackRefresh = useCallback(async () => {
    if (transport.kind === 'unavailable') {
      if (mounted.current) {
        setFallbackError(transport.reason ?? 'Native transport unavailable')
        setFallbackRows([])
        setFallbackLoading(false)
      }
      return
    }
    const outcome = await readAgency(transport, PROJECT)
    if (!mounted.current) return
    if ('error' in outcome) {
      setFallbackError(outcome.error)
      setFallbackRows([])
      setFallbackLoading(false)
      return
    }
    setFallbackError(null)
    setFallbackRows(outcome.reading.rows)
    setFallbackLoading(false)
  }, [transport])

  useEffect(() => {
    if (sessions) return
    void fallbackRefresh()
    const id = setInterval(() => void fallbackRefresh(), POLL_MS)
    return () => clearInterval(id)
  }, [sessions, fallbackRefresh])

  if (sessions) {
    return {
      tracks: withIds(sessions.tracks),
      rows: sessions.rows,
      error: sessions.error,
      loading: sessions.loading,
      refresh: sessions.refresh,
      project: PROJECT,
      selectedSessionRef: sessions.selectedSessionRef,
      selectSession: sessions.selectSession,
    }
  }
  return {
    tracks: withIds(buildTracks(fallbackRows, new Map())),
    rows: fallbackRows,
    error: fallbackError,
    loading: fallbackLoading,
    refresh: fallbackRefresh,
    project: PROJECT,
    selectedSessionRef: null,
    selectSession: (_ref: string) => {},
  }
}
