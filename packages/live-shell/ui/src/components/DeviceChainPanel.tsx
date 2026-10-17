// Live's two detail sides, as its registration hands them to the one detail host (shell/modeDetails.tsx MODE_DETAILS.live):
// Device is the instrument's chain of plates (live/LiveDeviceChain.tsx), Clip is the clip in the shared Clip view anatomy
// (live/LiveClip.tsx). The host draws the one head and the drop zone; nothing here draws a head, a card or a hint of its own.
import type { PanelContext } from '../shell/panels'
import type { SetDocument } from '../shell/document'
import type { SetSelection } from '../shell/liveSelection'
import { LiveDeviceChain } from '../live/LiveDeviceChain'
import { LiveClip } from '../live/LiveClip'
export type DetailMode = 'clip' | 'device'

/** The Clip side's one line while no clip of the open set is selected (the host's waiting idiom). */
export const LIVE_CLIP_WAITS = 'Select a clip in the Session or the Arrangement to see it here.'

export function DeviceChainPanel({ ctx, document, selection, mode }: { ctx: PanelContext; document: SetDocument | null; selection: SetSelection; mode: DetailMode }) {
  return mode === 'clip'
    ? <LiveClip set={ctx.set} document={document} selection={selection} waits={LIVE_CLIP_WAITS} />
    : <LiveDeviceChain ctx={ctx} document={document} selection={selection} />
}
