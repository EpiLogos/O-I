import {FactoryDeviceChain} from './devices/FactoryDeviceChain'
import {useAgentShell} from './AgentShellContext'
import type {AgentSessionTrack} from './useAgencySessions'
import {trackKey} from './agentRunModel'

// Factory's Device side (manual §6, §10.4): the selected session's chain as devices of the runtime — compact here, whole in the
// pool, full in a pane (agent/devices/). The chain's cards (AgentDeviceChain, NativeAgentDeviceRack) no longer draw it.
export function AgentShellDeviceDetail({tracks}: {tracks: AgentSessionTrack[]}) {
  const shell = useAgentShell()
  const track = tracks.find(item => trackKey(item) === shell.selectedTrackId)
  return <FactoryDeviceChain sessionRef={track?.sessionRef ?? null} />
}
