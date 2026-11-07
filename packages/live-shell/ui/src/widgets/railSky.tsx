// The Sky on the rail (the Sky device: "The Sky widget is on the rail in every mode. Tap the widget to return the date to now"; §20
// "Expressions opens in Pane view … and the agent composing in it, the sky and the Trail stand on the rail"; O-I #747 XS01, round 890).
// The rail's Sky tile is the QL Sky device's widget (widgets/railDeviceIds.ts claims it; quaternal-logic__sky.tsx `widget`: the ring you
// tap to return to now, each body with its degree), drawn on the dated sky the kernel reads (inhabitants/ql/devices/qlSky.ts). Technē's
// chain publishes the same device with its rack and presences (TechneDevices.tsx); the rail publishes its own only while no chain holds
// the Sky, and withdraws only its own. Mounted by the rail's publisher only while the Sky tile is open (widgets/railDevices.tsx).
import {useEffect, useMemo, useRef, useSyncExternalStore} from 'react'
import {publishDevice, publishedDevice, subscribeDeviceDoor, type PublishedDevice} from '../frame/devices/deviceDoor'
import type {DeviceInstance} from '../frame/devices/deviceRuntime'
import {qlSkyBinding, qlSkyDevice, useQlSky, QL_SKY_DEVICE_ID, QL_SKY_FACE} from '../inhabitants/ql/devices/qlSky'
import {quaternalLogicFamilyManifest} from '../inhabitants/quaternalLogicFamilyManifest'

/** Publish the rail's Sky unless another chain holds the device. `mine` is the device the rail published last; the answer is the one it
 * holds now, or null while another chain's Sky stands. */
export function publishRailSky(entry: PublishedDevice, mine: DeviceInstance | null): DeviceInstance | null {
  const now = publishedDevice(QL_SKY_DEVICE_ID)
  if (now && now.device !== mine) return null
  publishDevice(QL_SKY_DEVICE_ID, entry)
  return entry.device
}

/** Withdraw the rail's Sky, never another chain's. */
export function withdrawRailSky(mine: DeviceInstance | null): void {
  if (mine && publishedDevice(QL_SKY_DEVICE_ID)?.device === mine) publishDevice(QL_SKY_DEVICE_ID, null)
}

export function RailSky() {
  const sky = useQlSky()
  const face = useMemo(() => quaternalLogicFamilyManifest().faces.find(row => row.id === QL_SKY_FACE), [])
  const device = useMemo(() => face ? qlSkyDevice(face, sky) : null, [face, sky])
  const binding = useMemo(() => qlSkyBinding(sky), [sky])
  const held = useSyncExternalStore(subscribeDeviceDoor, () => publishedDevice(QL_SKY_DEVICE_ID)?.device ?? null, () => null)
  const mine = useRef<DeviceInstance | null>(null)
  useEffect(() => {
    if (!device || held !== null && held === device) return
    mine.current = publishRailSky({device, binding, picture: () => null}, mine.current)
  }, [device, binding, held])
  useEffect(() => () => withdrawRailSky(mine.current), [])
  return null
}
