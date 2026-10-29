// A mode's clip, hosted (shell/modeDetails.tsx): its binding's designed clip at the place the detail host measured, or the mode's one
// line while the binding names no clip. Shared by the modes' detail bodies (shell/details/*.tsx), each loaded with its mode (O-I #740).
import {ClipWaiting} from '../../frame/detail/ClipView'
import {HostedClip, type ClipPlace} from '../../frame/detail/ClipHost'
import type {ClipBinding} from '../../frame/detail/clipBinding'

export function Hosted({binding, place, waits}: {binding: ClipBinding | null; place: ClipPlace; waits: string}) {
  return binding ? <HostedClip binding={binding} place={place} /> : <ClipWaiting line={waits} />
}
