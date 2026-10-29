// Central's detail bodies (shell/modeDetails.tsx registers them; they load when Central's detail first draws, O-I #740): the open
// document's clip on Central's clip binding (central/clipBinding.ts) and the ground's devices (shell/ModeDetail.tsx BaseDevicesDetail).
import type {ClipPlace} from '../../frame/detail/ClipHost'
import {useDetailReading} from '../../frame/detail/detailReading'
import {useCentralClip} from '../../central/clipBinding'
import {BaseDevicesDetail} from '../ModeDetail'
import {MODE_DETAILS} from '../modeDetails'
import {Hosted} from './hosted'

export function CentralClip({place}: {place: ClipPlace}) { return <Hosted binding={useCentralClip()} place={place} waits={MODE_DETAILS.base.clipWaits} /> }
export function CentralChain() { const {transport, centralSubject, world} = useDetailReading(); return <BaseDevicesDetail transport={transport} world={world} subject={centralSubject} /> }
