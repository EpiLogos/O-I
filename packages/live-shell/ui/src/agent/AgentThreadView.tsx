import {useMemo} from 'react'
import {NativeAgencyParticipation} from '../components/NativeAgencyParticipation'
import {useWorkspace} from '../shell/workspaceContext'
import {trackKey, type AgentSessionTrack} from './agentRunModel'
import {useAgentShell} from './AgentShellContext'
import './agentShell.css'

export function AgentThreadView({tracks}: {tracks: AgentSessionTrack[]}) {
  const shell = useAgentShell()
  const workspace = useWorkspace()
  const track = tracks.find(item => trackKey(item) === shell.threadTrackId) ?? tracks.find(item => trackKey(item) === shell.selectedTrackId) ?? tracks.find(item => !item.group)
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
    return <div className="agent-shell-centre" data-region="centre"><div className="view-empty">Double-click a task clip or pick a session to open its thread.</div></div>
  }

  const current = () => workspace.nativeAccessCurrent(workspace.accessEpoch)

  return (
    <div className="agent-thread">
      <NativeAgencyParticipation
        scope={scope}
        current={current}
        subject={{title: track.purpose ?? track.sessionRef, ref: track.agentRef ?? undefined}}
        onAccompanying={() => {}}
        onError={message => console.warn(message)}
        conversation
        full
        mode="base"
      />
    </div>
  )
}
