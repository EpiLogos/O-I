// A track's own device, opened from its head (manual §18.1 "The track": "The settings stand on the Track page of the track's Workspace
// device"). The views stay mode-blind: a mode's track hook names, by track id, the device its tracks' heads open and how to open it, and
// the Session grid and the Arrangement ruler draw one head button for it — the press selects the track first, so the device reads the
// track it was opened from, then opens it full in a pane. A track no mode names draws no button.
import {useSyncExternalStore} from 'react'

export interface TrackHeadDevice {
  /** The device's name on the button ("Workspace"). */
  readonly title: string
  /** What the press does, in the manual's words. */
  readonly does: string
  /** Open the device full in a pane. */
  open(): void
}

const owners = new Map<string, ReadonlyMap<string, TrackHeadDevice>>()
const listeners = new Set<() => void>()
let version = 0

/** Name the devices one owner's tracks open (`owner` keeps one mode's names apart from another's); null takes them all back. */
export function nameTrackHeadDevices(owner: string, devices: ReadonlyMap<string, TrackHeadDevice> | null): void {
  if (devices && devices.size) owners.set(owner, devices)
  else if (!owners.delete(owner)) return
  version++
  for (const listener of [...listeners]) listener()
}

/** The device a track's head opens, if a mode names one. */
export function trackHeadDevice(trackId: string): TrackHeadDevice | undefined {
  for (const devices of owners.values()) { const found = devices.get(trackId); if (found) return found }
  return undefined
}

const subscribe = (listener: () => void): (() => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }
const snapshot = (): number => version

/** Re-draw when a mode names its tracks' devices again. */
export function useTrackHeadDevices(): number {
  return useSyncExternalStore(subscribe, snapshot, snapshot)
}
