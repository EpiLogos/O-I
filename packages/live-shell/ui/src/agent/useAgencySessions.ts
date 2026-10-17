import type {KernelTransportStatus} from '../../../../../desktop/cradle/src/kernel/types'
import {buildTracks, trackKey, type AgentSessionTrack} from './agentRunModel'
import {useAgentSessionsOptional} from './AgentSessionsProvider'
import {useAgencyAnswer} from '../owners/agency'

export type {AgentSessionTrack} from './agentRunModel'

/** The legacy track view: the model track plus the `id` key the shell's
 * selection state (`selectedTrackId` / `threadTrackId`) has always held. */
export type AgentSessionTrackView = AgentSessionTrack & {id: string}

const PROJECT = 'O-I'

const withIds = (tracks: AgentSessionTrack[]): AgentSessionTrackView[] =>
  tracks.map(track => ({...track, id: trackKey(track)}))

/**
 * The agency-reading hook, a view over the ONE agency source. When `AgentSessionsProvider` is mounted above the caller this
 * only maps the provider's context. When no provider stands above it, it reads the window's shared agency answer
 * (owners/agency.ts) — read on mount and the spine's epoch, and again whenever the provider's driver (or the person's Retry)
 * reads it — and never runs a cadence of its own: the 3 s fallback poll is gone, and a second poller cannot be mounted.
 */
export function useAgencySessions(transport: KernelTransportStatus) {
  const sessions = useAgentSessionsOptional()
  const fallback = useAgencyAnswer(transport, PROJECT)
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
  const reading = fallback.reading
  const rows = reading.status === 'answered' && reading.value ? reading.value.rows : []
  return {
    tracks: withIds(buildTracks(rows, new Map())),
    rows,
    error: transport.kind === 'unavailable' ? transport.reason ?? 'Native transport unavailable' : reading.status === 'refused' ? reading.error : null,
    loading: transport.kind !== 'unavailable' && reading.status === 'reading',
    refresh: fallback.retry,
    project: PROJECT,
    selectedSessionRef: null,
    selectSession: (_ref: string) => {},
  }
}
