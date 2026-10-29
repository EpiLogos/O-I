import type {KernelTransportStatus} from '../../../../../desktop/cradle/src/kernel/types'
import {buildTracks, trackKey, type AgentSessionTrack} from './agentRunModel'
import {useAgentSessionsOptional} from './AgentSessionsProvider'
import {useWorldAgencyEntries} from './worldScope'

export type {AgentSessionTrack} from './agentRunModel'

/** The legacy track view: the model track plus the `id` key the shell's
 * selection state (`selectedTrackId` / `threadTrackId`) has always held. */
export type AgentSessionTrackView = AgentSessionTrack & {id: string}

const withIds = (tracks: AgentSessionTrack[]): AgentSessionTrackView[] =>
  tracks.map(track => ({...track, id: trackKey(track)}))

/**
 * The agency-reading hook, a view over the ONE agency source. When `AgentSessionsProvider` is mounted above the caller this
 * only maps the provider's context. When no provider stands above it, it reads the window's shared agency answers of the world —
 * the root register's and each project's (agent/worldScope.ts), read on mount and the spine's epoch, and again whenever the
 * provider's drivers (or the person's Retry) read them — and never runs a cadence of its own. `scopes` names the registers read
 * ('' is the root register); each track carries its own (`project`).
 */
export function useAgencySessions(transport: KernelTransportStatus) {
  const sessions = useAgentSessionsOptional()
  const fallback = useWorldAgencyEntries(transport, !sessions)
  if (sessions) {
    return {
      tracks: withIds(sessions.tracks),
      rows: sessions.rows,
      error: sessions.error,
      loading: sessions.loading,
      refresh: sessions.refresh,
      scopes: sessions.scopes,
      selectedSessionRef: sessions.selectedSessionRef,
      selectSession: sessions.selectSession,
    }
  }
  const {agency, entries, epoch} = fallback
  return {
    tracks: withIds(buildTracks(agency.rows, new Map())),
    rows: agency.rows,
    error: transport.kind === 'unavailable' ? transport.reason ?? 'Native transport unavailable' : agency.error,
    loading: transport.kind !== 'unavailable' && agency.loading,
    refresh: () => { for (const [, entry] of entries) void entry.retry(epoch) },
    scopes: agency.scopes,
    selectedSessionRef: null,
    selectSession: (_ref: string) => {},
  }
}
