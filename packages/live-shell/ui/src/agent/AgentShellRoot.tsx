import {useCallback, useEffect, useState} from 'react'
import {useAgentShell} from './AgentShellContext'
import {AgentArrangementView} from './AgentArrangementView'
import {AgentSessionGrid} from './AgentSessionGrid'
import {AgentSessionsProvider, useAgentSessions} from './AgentSessionsProvider'
import {AgentThreadView} from './AgentThreadView'
import {RefusalCard} from './RefusalCard'
import {trackKey} from './agentRunModel'
import {harnessAgentControl} from './harnessAgentControl'
import {useHarnessBinding} from './useHarnessBinding'
import {useWorkspace} from '../shell/workspaceContext'

/** The centre mounts the ONE sessions poll source (pass-through if already
 * mounted higher, e.g. by the integrator above the dock), then reads it. */
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
  const {transport} = useWorkspace()
  const {binding} = useHarnessBinding(transport)
  const [controlNote, setControlNote] = useState<string | null>(null)
  const runHarness = useCallback(async (control: 'stop' | 'restart') => {
    const outcome = await harnessAgentControl(transport, binding, control)
    setControlNote(outcome.ok ? outcome.note : outcome.error)
  }, [transport, binding])

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
      <div className="agent-shell-centre" data-region="centre" style={{flexDirection: 'column', alignItems: 'stretch', overflow: 'auto'}}>
        {refusal && (
          <RefusalCard
            title={sessions.error ? 'Read failed' : 'Roster refused'}
            line={refusal}
            receipt={sessions.rosterError ?? sessions.error ?? sessions.temporalError ?? null}
          />
        )}
        <div className="agent-empty-note" role="status" style={{flex: 'none'}}>
          <b>Reading agency sessions…</b> The run model polls <code>agency_read</code>; tracks land here as the reading answers. Nothing is drawn that no owner has said.
        </div>
        <div className="view-empty" role="status">Reading agency sessions…</div>
      </div>
    )
  }

  if (shell.centreView === 'thread') return <AgentThreadView tracks={tracks} />
  if (shell.centreView === 'arrangement') {
    return (
      <AgentArrangementView
        tracks={tracks}
        error={sessions.error}
        temporalError={sessions.temporalError}
        nowUnixMs={sessions.nowUnixMs}
        onHardStop={() => { void runHarness('stop') }}
        onRetry={() => { void runHarness('restart') }}
      />
    )
  }
  return (
    <>
      {controlNote && (
        <p className="agent-transport-note" role="status">{controlNote}</p>
      )}
      {sessions.error && (
        <RefusalCard title="Read failed" line={sessions.error} receipt={sessions.error} />
      )}
      {/* The roster refusal renders at the source (the provider, above this
        tree) — not duplicated here. */}
      <AgentSessionGrid
        tracks={tracks}
        onHardStop={() => void runHarness('stop')}
        onRetry={() => void runHarness('restart')}
      />
    </>
  )
}
