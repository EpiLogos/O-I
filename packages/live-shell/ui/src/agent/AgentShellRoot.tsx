import {useEffect} from 'react'
import {useAgentShell} from './AgentShellContext'
import {AgentSessionsProvider, useAgentSessions} from './AgentSessionsProvider'
import {AgentThreadView} from './AgentThreadView'
import {RefusalCard} from './RefusalCard'
import {trackKey} from './agentRunModel'

/** The agent tab's body: the thread of the selected session, and nothing of the Session or the Arrangement — those are the
 * shared tracks pane's (frame/tracks/TracksPane.tsx), the pane the Factory tree opens beside this tab (agent/factoryCentre.ts).
 * It mounts the ONE sessions poll source (pass-through if already mounted higher, as main.tsx does above the App), then reads
 * it for the tracks the thread follows and for the refusals the reading can carry. */
export function AgentShellCentre() {
  return (
    <AgentSessionsProvider>
      <AgentShellCentreBody />
    </AgentSessionsProvider>
  )
}

function AgentShellCentreBody() {
  const shell = useAgentShell()
  const sessions = useAgentSessions()

  // Selecting a track selects its session for the metrics + dock.
  useEffect(() => {
    if (!shell.selectedTrackId) return
    const track = sessions.tracks.find(item => trackKey(item) === shell.selectedTrackId)
    if (track && !track.group) sessions.selectSession(track.sessionRef)
  }, [shell.selectedTrackId, sessions])

  const tracks = sessions.tracks

  if (sessions.source === 'unavailable') {
    return (
      <div className="agent-shell-centre" data-region="centre">
        <div className="view-empty" role="status">
          Native transport unavailable — the run model reads no sessions without it.
          {sessions.reason ? ` Reason: ${sessions.reason}` : ''}
        </div>
      </div>
    )
  }

  if (sessions.loading && !tracks.length) {
    const refusal = sessions.error ?? (sessions.rosterError
      ? `Agent roster read failed. Central owner Action refused: ${sessions.rosterError}`
      : sessions.temporalError)
    return (
      <div className="agent-shell-centre" data-region="centre" style={{overflow: 'auto'}}>
        {refusal && (<div data-region="agent-disclosures">
          <RefusalCard
            title={sessions.error ? 'Read failed' : 'Roster refused'}
            line={refusal}
            receipt={sessions.rosterError ?? sessions.error ?? sessions.temporalError ?? null}
          />
        </div>)}
        <div className="agent-empty-note" role="status" style={{flex: 'none'}}>
          <b>Reading agency sessions…</b> The run model polls <code>agency_read</code>; the thread opens on the selected session once the reading answers. Nothing is drawn that no owner has said.
        </div>
        <div className="view-empty" role="status">Reading agency sessions…</div>
      </div>
    )
  }

  return (
    <div className="agent-shell-centre" data-region="centre" data-agent-body="thread">
      {sessions.error && (
        <RefusalCard title="Read failed" line={sessions.error} receipt={sessions.error} />
      )}
      {sessions.temporalError && (
        <RefusalCard title="Temporal read refused" line={sessions.temporalError} receipt={sessions.temporalError} />
      )}
      {sessions.rosterError && (
        <div data-region="agent-disclosures">
          <RefusalCard title="Roster refused" line={`Agent roster read failed. Central owner Action refused: ${sessions.rosterError}`} receipt={sessions.rosterError} />
        </div>
      )}
      <AgentThreadView tracks={tracks} />
    </div>
  )
}
