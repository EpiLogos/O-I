import {useMemo} from 'react'
import {NativeAgencyParticipation} from '../components/NativeAgencyParticipation'
import {useWorkspace} from '../shell/workspaceContext'
import {trackKey, type AgentSessionTrack} from './agentRunModel'
import {useAgentShell} from './AgentShellContext'
import './agentShell.css'

/**
 * The session a thread follows. The agent tab is the thread beside the Session · Arrangement pane (world-shell-mockup.html
 * `modes.factory`: `[sessions] | [thread]`), so it follows THE selection: the session selected there, or the session of the
 * task selected there (WorldContext.selection, through `selectedTrackId`). Only with nothing selected does the session a
 * `openThread` named, or the first session, stand in. A group is not a conversation: its thread is its lead's, the first member
 * with a named agent (else its first member), and a group with no member has none.
 */
export function threadTrackOf(tracks: readonly AgentSessionTrack[], selectedTrackId: string | null, openedTrackId: string | null): AgentSessionTrack | undefined {
  const keyed = (id: string | null) => id === null ? undefined : tracks.find(item => trackKey(item) === id)
  const named = keyed(selectedTrackId) ?? keyed(openedTrackId) ?? tracks.find(item => !item.group)
  if (!named?.group) return named
  const members = tracks.filter(item => !item.group && item.parentRef === named.spaceRef)
  return members.find(member => member.agentName) ?? members[0]
}

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
        mode="base"
      />
    </div>
  )
}
