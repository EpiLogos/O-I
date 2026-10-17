import {useMemo} from 'react'
import {NativeAgencyParticipation} from '../components/NativeAgencyParticipation'
import {useWorkspace} from '../shell/workspaceContext'
import type {AgentSessionTrack} from './agentRunModel'
import {threadTrackOf} from './threadTrack'
import {useAgentShell} from './AgentShellContext'
import './agentShell.css'

export {threadTrackOf}

/** The agent tab's body: the selected session's conversation with its steer composer (the mockup's `thread`). It stands alone —
 * the Session and the Arrangement are the shared tracks pane's, never this tab's. */
export function AgentThreadView({tracks}: {tracks: AgentSessionTrack[]}) {
  const shell = useAgentShell()
  const workspace = useWorkspace()
  const track = threadTrackOf(tracks, shell.selectedTrackId, shell.threadTrackId)
  const scope = useMemo(() => {
    if (!track) return null
    return {
      workspaceId: workspace.workspaceId,
      accessEpoch: workspace.accessEpoch,
      project: 'O-I',
      accompanying: {ref: track.sessionRef, project: 'O-I', space: track.spaceRef},
    }
  }, [track, workspace.workspaceId, workspace.accessEpoch])

  if (!track || !scope) {
    return <div className="agent-thread" data-region="thread"><div className="view-empty" role="status">Select a session or a task in the Session pane to open its thread.</div></div>
  }

  const current = () => workspace.nativeAccessCurrent(workspace.accessEpoch)

  return (
    <div className="agent-thread" data-region="thread">
      <NativeAgencyParticipation
        scope={scope}
        current={current}
        subject={{title: track.purpose ?? track.sessionRef, ref: track.agentRef ?? undefined}}
        onAccompanying={() => {}}
        onError={message => console.warn(message)}
        conversation
        full
        plane="Chat"
        onPlane={() => {}}
        mode="base"
      />
    </div>
  )
}
