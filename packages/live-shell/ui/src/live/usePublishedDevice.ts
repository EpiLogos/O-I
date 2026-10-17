// A plate on Live's chain is published to the device door by its id (FOUNDATION F5, frame/devices/deviceDoor.ts), as the torus
// is (live/TorusOnChain.tsx): the pool shows it whole when it is chosen, a pane shows it full, and it is withdrawn when its
// chain no longer holds it.
import {useEffect, type ReactNode} from 'react'
import {publishDevice} from '../frame/devices/deviceDoor'
import type {DeviceInstance} from '../frame/devices/deviceRuntime'

export function usePublishedDevice(id: string, device: DeviceInstance, picture?: (size: 'compact' | 'whole' | 'full') => ReactNode): void {
  useEffect(() => { publishDevice(id, {device, ...(picture ? {picture} : {})}) }, [id, device, picture])
  useEffect(() => () => publishDevice(id, null), [id])
}
