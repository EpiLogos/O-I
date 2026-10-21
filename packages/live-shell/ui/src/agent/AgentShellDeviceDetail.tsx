import {FactoryDeviceChain} from './devices/FactoryDeviceChain'
import {useAgentShell} from './AgentShellContext'
import type {AgentSessionTrack} from './useAgencySessions'
import {trackKey} from './agentRunModel'
import {MAIN_TRACK_REF} from '../frame/tracks/SessionGrid'
import {workcellOfTrack} from '../frame/tracks/returnTracks'

// Factory's Device side (manual §6, §10.4): the selected session's chain as devices of the runtime — compact here, whole in the
// pool, full in a pane (agent/devices/). The chain's cards (AgentDeviceChain, NativeAgentDeviceRack) no longer draw it.
export function AgentShellDeviceDetail({tracks}: {tracks: AgentSessionTrack[]}) {
  const shell = useAgentShell()
  // A workcell's return track (frame/tracks/returnTracks.ts, `workcell:<name>`; DLW §19.23) is no session: its chain is the workcell's —
  // its rack, the Gateway, the Remote carrier, Git / landing with its Seat.
  const workcell = workcellOfTrack(shell.selectedTrackId)
  // The Main track (the session grid's Main head, frame/tracks/SessionGrid.tsx MAIN_TRACK_REF) is no session: its chain is Factory's
  // Main track (FactoryDeviceChain with no session), as it is while nothing is selected.
  const track = workcell || shell.selectedTrackId === MAIN_TRACK_REF ? undefined : tracks.find(item => trackKey(item) === shell.selectedTrackId)
  return <FactoryDeviceChain sessionRef={track?.sessionRef ?? null} workcell={workcell} />
}
