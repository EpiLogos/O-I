// Live's detail bodies (shell/modeDetails.tsx registers them; they load when Live's detail first draws, O-I #740): the open set's
// clip on its clip binding (live/clipBinding.ts) and the selected track's chain (components/DeviceChainPanel.tsx).
import type {ClipPlace} from '../../frame/detail/ClipHost'
import {useDetailReading} from '../../frame/detail/detailReading'
import {DeviceChainPanel, LIVE_CLIP_WAITS} from '../../components/DeviceChainPanel'
import {useLiveClip} from '../../live/clipBinding'
import {Hosted} from './hosted'

export function LiveClip({place}: {place: ClipPlace}) { return <Hosted binding={useLiveClip()} place={place} waits={LIVE_CLIP_WAITS} /> }
export function LiveChain() { const {live} = useDetailReading(); return <DeviceChainPanel ctx={live.ctx} document={live.document} selection={live.selection} mode="device" /> }
