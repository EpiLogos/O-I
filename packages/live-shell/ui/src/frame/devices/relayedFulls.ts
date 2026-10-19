// A device's own Full in its Pop-out (manual §16.3: Full is "the material itself"; Pop-out is Full over Whole in a window of its
// own). The main window draws the material itself (deviceDoor.ts OwnFull `draw`: the Day's page as its owner stands it); a second
// window is its own page and holds none of that drawing, so the publisher also names the material as data (`relay`: a kind and its
// aperture), the relay carries it (deviceRelay.ts), and the window draws it here by the drawer its family registered — the same face
// the main window draws, on this window's own carrier. A kind no family registered draws nothing of its own, and the design's Full
// stands (r23: the Day popped out drew a blank Full, its design's template, with no template root on the native host).
import type {ReactNode} from 'react'
import type {KernelTransportStatus} from '../../../../../../desktop/cradle/src/kernel/types'

/** The material a device's own Full draws, as data that crosses windows: its kind and its aperture. */
export interface RelayedFull {
  readonly kind: string
  readonly data: unknown
}

export type RelayedFullDrawer = (data: unknown, transport: KernelTransportStatus) => ReactNode

const drawers = new Map<string, RelayedFullDrawer>()

/** A family names how its material is drawn in a Pop-out (the Central family: the Day's page). */
export function registerRelayedFull(kind: string, drawer: RelayedFullDrawer): void {
  drawers.set(kind, drawer)
}

/** The draw for a relayed Full in this window, or undefined where none is relayed or no family registered its kind. */
export function relayedFullDraw(full: RelayedFull | null | undefined, transport: KernelTransportStatus): (() => ReactNode) | undefined {
  const drawer = full ? drawers.get(full.kind) : undefined
  return full && drawer ? () => drawer(full.data, transport) : undefined
}
