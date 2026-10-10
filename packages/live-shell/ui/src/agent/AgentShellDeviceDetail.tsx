import {AgentDeviceChain} from './AgentDeviceChain'
import {useAgentShell} from './AgentShellContext'
import type {AgentSessionTrack} from './useAgencySessions'
import {trackKey} from './agentRunModel'

export function AgentShellDeviceDetail({tracks}: {tracks: AgentSessionTrack[]}) {
  const shell = useAgentShell()
  const track = tracks.find(item => trackKey(item) === shell.selectedTrackId)
  return <AgentDeviceChain sessionRef={track?.sessionRef ?? null} />
}
