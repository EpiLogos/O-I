// The device door (FOUNDATION F5): the places that hold live devices — a track's chain, an instrument's rack — publish
// each one here by id, with its live picture, and the other two sizes read it by id: the pool under the browser shows the
// selected device whole, and a pane shows a device full. One device, one set of live settings, three places to see it.
import {useSyncExternalStore, type ReactNode} from 'react'
import type {DeviceInstance} from './deviceRuntime'

export interface PublishedDevice {
  device: DeviceInstance
  /** The device's own live picture, drawn at the size it is shown. */
  picture?: (size: 'compact' | 'whole' | 'full') => ReactNode
}

const devices = new Map<string, PublishedDevice>()
let selected: string | null = null
const listeners = new Set<() => void>()
let version = 0
const notify = () => { version++; for (const listener of listeners) listener() }

/** Publish (or withdraw, with null) one live device by its id. */
export function publishDevice(id: string, entry: PublishedDevice | null): void {
  if (entry) devices.set(id, entry); else devices.delete(id)
  notify()
}

export function publishedDevice(id: string): PublishedDevice | undefined {
  return devices.get(id)
}

/** The device the pool shows whole: the one last chosen on a chain. */
export function selectDevice(id: string | null): void {
  if (selected === id) return
  selected = id
  notify()
}

export function selectedDeviceId(): string | null {
  return selected
}

/** Re-render when any published device or the selection changes. */
export function useDeviceDoor(): {device: (id: string) => PublishedDevice | undefined; selected: string | null} {
  useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener) } }, () => version, () => version)
  return {device: publishedDevice, selected}
}
