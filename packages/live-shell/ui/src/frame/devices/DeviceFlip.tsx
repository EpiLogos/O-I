// A device's expanded view (manual §16.4; Live's Toggle Expanded View, d18c911a3 and d75e5aa0c): its Whole as a band across the
// detail area, above the chain — the panes above shrink to make room, nothing is covered. The frame stands this host at the top of
// the detail row (styles.css `.device-flip-host`; the row grows by the band while the host holds one); a chain plate whose ▸ is
// pressed draws its device's whole panel into it while that plate stands shown (DeviceView.tsx ChainDevice), its bands side by side
// in the wide frame (the catalogue's panels/popout.tsx flippedOf, `dp-wide dp-flip`). The host holds nothing of its own.
// Esc folds the expanded view (lead, 16 Oct: "Esc folds a flipped-up device"): the band claims Escape while it stands
// (`data-claims-keys`, frame/keys/keyMap.ts escapeClaimed), so the window's Stop leaves that press to it.
// Beside the band the host stands the layer of the devices' own windows (DeviceWindows.tsx: Pop-out, any number open): the frame
// mounts the two together, the layer fixed above the shell and taking no part in the frame's grid.
import {useCallback, useEffect} from 'react'
import {flipDevice, flippedDeviceId, publishFlipHost} from './deviceDoor'
import {DeviceWindowLayer} from './DeviceWindows'
import {suppressed} from '../keys/keyMap'

/** Whether a key press folds the expanded view now: Esc alone, not while typing, with a device expanded. Pure. */
export function foldsExpanded(event: {readonly key: string; readonly shiftKey?: boolean; readonly altKey?: boolean; readonly metaKey?: boolean;
  readonly ctrlKey?: boolean; readonly repeat?: boolean}, target: Parameters<typeof suppressed>[1], expanded: string | null): boolean {
  if (event.key !== 'Escape' || event.shiftKey || event.altKey || event.metaKey || event.ctrlKey || event.repeat) return false
  return expanded !== null && !suppressed({id: 'stop'}, target)
}

export function DeviceFlipHost() {
  const hand = useCallback((element: HTMLDivElement | null) => publishFlipHost(element), [])
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || !foldsExpanded(event, event.target as Element | null, flippedDeviceId())) return
      event.preventDefault()
      flipDevice(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return <>
    <div ref={hand} className="device-flip-host" role="region" aria-label="Expanded device" />
    <DeviceWindowLayer />
  </>
}
