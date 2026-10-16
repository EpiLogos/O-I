// The devices a Studio section holds, fitted to the section's band (manual §16.8 "Nothing scrolls … no box sits inside a box"; §3 "The plate
// does not reflow … the whole plate scales between 80 % and 125 %"). Ported from the runtime's section devices (frame/devices/
// InstrumentPlate.tsx:120-140 at 1e2d6db89 SectionDevices: one device at a time, drawn by DeviceView at its compact size, the others behind their marks)
// with two moves so a held device fits the band instead of being cut at the plate's foot:
//   • the marks stand in the section's head (its note), not in a row above the device — the selector costs the band nothing;
//   • the shown device stands at the scale the band holds, between 80 % and 100 % (CSS zoom, as the chain's plates scale: plateScale.ts);
//     a band too short even at 80 % says so (`onShort`), and the Studio folds that section to its title (studioFit.ts) — fits or folds.
// The device is the runtime's own (the same DeviceInstance on the rack, in the pool and in a pane: useFieldDevices, qlFaceEntry).
import {useEffect, useLayoutEffect, useRef, useState} from 'react'
import {DeviceView} from '../../../frame/devices/DeviceView'
import {lightOf} from '../../../frame/devices/deviceRuntime'
import type {SectionDevice} from '../../../frame/devices/InstrumentPlate'
import {Icon} from '../../../inhabitants/sdk/Icon'

/** The plate's own bounds (manual §16.8). */
export const STUDIO_SCALE_MIN = 0.8, STUDIO_SCALE_MAX = 1

/** The scale a held device stands at in a band of `band` px when it is `natural` px high at 100 %, or null when even the least scale
 * cuts it (the section folds). Pure. */
export function heldScale(band: number | null, natural: number | null): number | null {
  if (!band || !natural || !(band > 0) || !(natural > 0)) return STUDIO_SCALE_MAX
  const fit = band / natural
  if (fit < STUDIO_SCALE_MIN - 0.004) return null
  return Math.round(Math.min(STUDIO_SCALE_MAX, Math.max(STUDIO_SCALE_MIN, fit)) * 100) / 100
}

/** The device a section shows: the person's pick while it stands, else `initial`, else the first. Pure. */
export function shownDevice(devices: readonly SectionDevice[], picked: string | null | undefined, initial: string | null | undefined): SectionDevice | undefined {
  const id = devices.some(entry => entry.device.id === picked) ? picked : devices.some(entry => entry.device.id === initial) ? initial : devices[0]?.device.id
  return devices.find(entry => entry.device.id === id)
}

/** The section's marks, in its head: one per device it holds, the shown one underlined, the owner's light on each. */
export function StudioDeviceMarks({devices, shown, onPick, label}: {devices: readonly SectionDevice[]; shown: string | undefined; onPick: (id: string) => void; label: string}) {
  if (devices.length < 2) return null
  return <span className="studio-marks" role="tablist" aria-label={`${label}: the devices it holds`}>
    {devices.map(entry => {
      const light = lightOf(entry.device)
      return <button key={entry.device.id} type="button" role="tab" className="inst-selector-mark" aria-selected={entry.device.id === shown}
        aria-label={entry.device.face.title} title={`${entry.device.face.title}${light === 'unknown' ? '' : ` · ${light}`}`} data-device-light={light}
        data-i={`${entry.device.face.title}|Show ${entry.device.face.title} in this section.`} onClick={() => onPick(entry.device.id)}>
        <Icon name={entry.mark} size={11} />
      </button>
    })}
  </span>
}

const useIsoLayoutEffect = typeof document === 'undefined' ? useEffect : useLayoutEffect

/** The shown device, drawn by the runtime at its compact size and scaled to the band. `band` is the height the section's body holds;
 * `onShort` hears whether the device is cut even at 80 % (with the height it needs at 100 %). */
export function StudioDevice({entry, band, onShort}: {entry: SectionDevice; band: number | null; onShort?: (short: boolean, natural: number) => void}) {
  const inner = useRef<HTMLDivElement>(null)
  const [natural, setNatural] = useState<number | null>(null)
  const scale = useRef(1)
  const fitted = heldScale(band, natural)
  scale.current = fitted ?? STUDIO_SCALE_MIN
  useIsoLayoutEffect(() => {
    const element = inner.current
    if (!element || typeof ResizeObserver === 'undefined') return
    // The device's own height at 100 %: its drawn height under the scale it stands at now, unscaled.
    const measure = () => {
      const height = element.getBoundingClientRect().height / scale.current
      if (height > 0) setNatural(was => (was !== null && Math.abs(was - height) < 0.5 ? was : Math.round(height)))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [entry.device.id])
  const short = fitted === null
  useEffect(() => {if (natural !== null) onShort?.(short, natural)}, [short, natural, onShort])
  return <div className="studio-device" data-device-shown={entry.device.id} data-studio-scale={scale.current}
    style={scale.current !== 1 ? {zoom: scale.current} : undefined}>
    <div ref={inner} className="inst-device">
      <DeviceView key={entry.key ?? entry.device.id} device={entry.device} size="compact" picture={entry.picture} actions={entry.actions} wrapRow={entry.wrapRow} />
    </div>
  </div>
}
