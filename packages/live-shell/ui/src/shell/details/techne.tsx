// Technē's detail bodies (shell/modeDetails.tsx registers them; they load when Technē's detail first draws, O-I #740). Technē's clips
// are a World subject in hand, a walk's stop, or the World cut's event; a scene clip of the open Expression selected in Technē is an
// Expressions clip (the selected clip's mode).
import type {ClipPlace} from '../../frame/detail/ClipHost'
import {useDetailReading} from '../../frame/detail/detailReading'
import {useSelectedClip} from '../../frame/detail/ClipBox'
import {useTechneClip} from '../../techne/clipBinding'
import {useExpressionsClip} from '../../components/expressions/clip/clipBinding'
import {sceneOfClipRef} from '../../components/expressions/clip/sceneClip'
import {useWorkspace} from '../workspaceContext'
import {TechneInstrumentsDetail} from '../ModeDetail'
import {MODE_DETAILS} from '../modeDetails'
import {Hosted} from './hosted'

export function TechneClip({place}: {place: ClipPlace}) {
  const techne = useTechneClip()
  const expressions = useExpressionsClip()
  const selected = useSelectedClip()
  const reading = useWorkspace().editorReading
  const scene = !techne && expressions && reading && sceneOfClipRef({basis: reading.basis, scenes: reading.scenes ?? null}, selected.ref) ? expressions : null
  return <Hosted binding={techne ?? scene} place={place} waits={MODE_DETAILS.techne.clipWaits} />
}
export function TechneChain() { const {transport} = useDetailReading(); return <TechneInstrumentsDetail transport={transport} /> }
