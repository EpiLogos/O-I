// Factory's detail bodies (shell/modeDetails.tsx registers them; they load when Factory's detail first draws, O-I #740).
import type {ClipPlace} from '../../frame/detail/ClipHost'
import {useDetailReading} from '../../frame/detail/detailReading'
import {useFactoryClip} from '../../agent/clipBinding'
import {AgentShellDeviceDetail} from '../../agent/AgentShellDeviceDetail'
import {MODE_DETAILS} from '../modeDetails'
import {Hosted} from './hosted'

/** The selected task (THE selection names it, `<session track>#task/<n>`, or a session track whose first task it opens): its Clip
 * view after Live — Clip and Launch beside the log, the Agent's effort and autonomy for this task as its envelopes (§19.1). */
export function FactoryClip({place}: {place: ClipPlace}) { return <Hosted binding={useFactoryClip()} place={place} waits={MODE_DETAILS.factory.clipWaits} /> }
export function FactoryChain() { const {factory} = useDetailReading(); return <AgentShellDeviceDetail tracks={factory.tracks} /> }
