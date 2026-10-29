import {useMemo} from 'react'
import {NativeAgencyParticipation} from '../components/NativeAgencyParticipation'
import {useWorkspace} from '../shell/workspaceContext'
import type {AgentSessionTrack} from './agentRunModel'
import {threadTrackOf} from './threadTrack'
import {useAgentShell} from './AgentShellContext'
import {ROOT_REGISTER} from './worldScope'
import './agentShell.css'

export {threadTrackOf}

/** The agent tab's body: the selected session's conversation with its steer composer (the mockup's `thread`). It stands alone —
 * the Session and the Arrangement are the shared tracks pane's, never this tab's. */
export function AgentThreadView({tracks}: {tracks: AgentSessionTrack[]}) {
  const shell = useAgentShell()
  const workspace = useWorkspace()
  const track = threadTrackOf(tracks, shell.selectedTrackId, shell.threadTrackId)
  // The thread is read in the session's own register (agent/worldScope.ts): the one its world-wide agency read listed it in.
  const scope = useMemo(() => {
    if (!track) return null
    const project = track.project ?? ROOT_REGISTER
    return {
      workspaceId: workspace.workspaceId,
      accessEpoch: workspace.accessEpoch,
      project,
      accompanying: {ref: track.sessionRef, project, space: track.spaceRef},
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
