// Expressions' detail bodies (shell/modeDetails.tsx registers them; they load when Expressions' detail first draws, O-I #740). An
// Expressions clip is a scene (lock §9.1): the open Expression's presented scene.
import type {ClipPlace} from '../../frame/detail/ClipHost'
import {useDetailReading} from '../../frame/detail/detailReading'
import {useExpressionsClip} from '../../components/expressions/clip/clipBinding'
import {NativeWorldDetail} from '../../components/NativeWorldDetail'
import {MODE_DETAILS} from '../modeDetails'
import {Hosted} from './hosted'

export function ExpressionsClip({place}: {place: ClipPlace}) { return <Hosted binding={useExpressionsClip()} place={place} waits={MODE_DETAILS.expressions.clipWaits} /> }
export function ExpressionsChain() { const {native} = useDetailReading(); return <NativeWorldDetail mode="device" {...native} /> }
