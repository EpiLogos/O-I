// Live's Device side, as its registration hands it to the one detail host (shell/modeDetails.tsx MODE_DETAILS.live): the
// instrument's chain of plates (live/LiveDeviceChain.tsx). The host draws the one head and the drop zone; nothing here draws a head,
// a card or a hint of its own. Live's Clip side is the one clip host's (frame/detail/ClipHost.tsx on live/clipBinding.ts).
import type { PanelContext } from '../shell/panels'
import type { SetDocument } from '../shell/document'
import type { SetSelection } from '../shell/liveSelection'
import { LiveDeviceChain } from '../live/LiveDeviceChain'
export type DetailMode = 'clip' | 'device'

/** The Clip side's one line while no clip of the open set is selected (the host's waiting idiom). */
export const LIVE_CLIP_WAITS = 'Select a clip in the Session or the Arrangement to see it here.'

/** Live's chain. `mode` names the side it stands for; the Clip side is the clip host's, so only the Device side draws here. */
export function DeviceChainPanel({ ctx, document, selection, mode }: { ctx: PanelContext; document: SetDocument | null; selection: SetSelection; mode: DetailMode }) {
  return mode === 'device' ? <LiveDeviceChain ctx={ctx} document={document} selection={selection} /> : null
}
