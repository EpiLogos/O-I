// The device door (FOUNDATION F5): the places that hold live devices — a track's chain, an instrument's rack — publish
// each one here by id, with its live picture, and the other places read it by id: the pool under the browser shows the
// selected device whole, a pane shows a device full, the rail keeps a device's widget, its own window shows it popped out. One device,
// one set of live settings, six views (manual §16.3). A device can carry its own Full — its material, or the act that opens it —
// over its design's.
import {useSyncExternalStore, type ReactNode} from 'react'
import type {DesignBinding} from './designed'
import type {DeviceInstance} from './deviceRuntime'

/** The pane kind that holds one device full (devicePane.tsx registers it). */
export const DEVICE_PANE_KIND = 'projection.device'

export interface PublishedDevice {
  device: DeviceInstance
  /** The device's own live picture, drawn at the size it is shown. */
  picture?: (size: 'compact' | 'whole' | 'full') => ReactNode
  /** The wiring of the device's designed views to its owner (the design's value keys to owner readings), where its family has
   * written one; absent, the device's rows are its value keys (designed.ts bindingOf). */
  binding?: DesignBinding
  /** The marks its place gives the device's head, before ⤢ (a pop-out, a redock): the pool's head carries them as the chain's does. */
  marks?: ReactNode
  /** The device's own Full, over its design's (manual §16.3 Full: "The material itself"). `draw`: the material, drawn as the Full
   * view in the device's pane (the Day's page as its owner stands it). `open`: the act that opens the material where it lives (the
   * Agent's thread), which every ⤢ — the chain's, the pool's, the rail's — does in place of opening the device's pane. */
  full?: OwnFull
  /** A publisher's own pop-out, over the door's (manual §16.3 Pop-out): the act the head's ↗ does in place of opening the device's
   * window here (openDeviceWindow). Absent — every device the door holds today — ↗ opens the device's own window. */
  popout?: () => void
  /** The head's context-menu acts its chain's owner carries (manual §16.4: "Right-click the head for Fold, Rename, Group, Save as
   * preset, Hot-swap, Show automation and Map"). Fold is the host's own; an act absent here stands in the menu disabled, with the
   * owner operation it waits for (DeviceMenu.tsx headMenu). */
  acts?: Partial<Readonly<Record<HeadAct, () => void>>>
}

/** The head's context-menu acts beyond Fold, in Live's order (manual §16.4). */
export type HeadAct = 'rename' | 'group' | 'save-preset' | 'hot-swap' | 'show-automation' | 'map'

export type OwnFull = {readonly draw: () => ReactNode} | {readonly open: () => void}

const devices = new Map<string, PublishedDevice>()
let selected: string | null = null
const listeners = new Set<() => void>()
let version = 0
const notify = () => { version++; for (const listener of listeners) listener() }

/** Publish (or withdraw, with null) one live device by its id. A device withdrawn while its window stands closes that window once
 * it stays withdrawn past WINDOW_GRACE_MS (a chain that republishes in the same breath keeps it). */
export function publishDevice(id: string, entry: PublishedDevice | null): void {
  if (entry) devices.set(id, entry); else devices.delete(id)
  notify()
  if (!entry && windows.some(open => open.id === id)) setTimeout(sweepDeviceWindows, WINDOW_GRACE_MS)
}

export function publishedDevice(id: string): PublishedDevice | undefined {
  return devices.get(id)
}

/** Every device published now, in the order they were first published. */
export function publishedDevices(): readonly PublishedDevice[] {
  return [...devices.values()]
}

/** The device the pool shows whole: the one last chosen on a chain, or in the browser. */
export function selectDevice(id: string | null): void {
  if (selected === id) return
  selected = id
  notify()
}

/** A device chosen in the browser (manual §16.3: "The pool shows the device you select in the browser, and changes there apply
 * without adding it to a chain"): the row hands the device on its own owner's binding, and the pool shows it whole. Held here it
 * stands on no chain — no chain draws from the door. Null lets it go, and the pool shows nothing of it. */
export function holdInPool(id: string, entry: PublishedDevice | null): void {
  publishDevice(id, entry)
  if (entry) selectDevice(id); else if (selected === id) selectDevice(null)
}

export function selectedDeviceId(): string | null {
  return selected
}

const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }
/** The door's own notice, outside React: a device published, withdrawn, selected or flipped (frame/devices/deviceRelay.ts). */
export const subscribeDeviceDoor = subscribe

/** Re-render when any published device or the selection changes. */
export function useDeviceDoor(): {device: (id: string) => PublishedDevice | undefined; selected: string | null} {
  useSyncExternalStore(subscribe, () => version, () => version)
  return {device: publishedDevice, selected}
}

/** Re-render only when the selection changes (a plate on the chain wears the outline of the one the pool shows), never on
 * a publish: a chain of plates does not redraw each time one of its devices reads anew. */
export function useSelectedDeviceId(): string | null {
  return useSyncExternalStore(subscribe, selectedDeviceId, selectedDeviceId)
}

// ------------------------------------------------------------------------------------------------------------- the expanded view
// The ▸ in a chain plate's head shows the device's expanded view (manual §16.4; Live's Toggle Expanded View): its Whole as a band
// across the detail area above the chain, one device at a time, drawn by its chain plate into the host the frame stands there
// (DeviceFlip.tsx). ▾, or Esc, folds it back.

let flipped: string | null = null

/** Show a device's expanded view (or fold it back, with null). */
export function flipDevice(id: string | null): void {
  if (flipped === id) return
  flipped = id
  notify()
}

export function flippedDeviceId(): string | null {
  return flipped
}

/** Re-render only when the expanded device changes. */
export function useFlippedDeviceId(): string | null {
  return useSyncExternalStore(subscribe, flippedDeviceId, flippedDeviceId)
}

let flipHost: HTMLElement | null = null

/** The frame's expanded-view host hands its element (or withdraws it, with null). */
export function publishFlipHost(element: HTMLElement | null): void {
  if (flipHost === element) return
  flipHost = element
  notify()
}

/** The element an expanded view is drawn into, while the frame stands one. */
export function useFlipHost(): HTMLElement | null {
  return useSyncExternalStore(subscribe, () => flipHost, () => flipHost)
}

/** Re-render only when this device comes onto the door or leaves it. */
export function useIsPublished(id: string): boolean {
  return useSyncExternalStore(subscribe, () => devices.has(id), () => devices.has(id))
}

// ---------------------------------------------------------------------------------------------------------------- the rail's hand
// A device's widget stands on the one rail (frame/widgets/WidgetRail.tsx) under the widget id `device:<id>`, in the rail's own
// open set (the workspace book's, so it stays when you change mode). The rail hands its open set and its toggle here when it draws;
// a device's head asks through them.

export const DEVICE_WIDGET_PREFIX = 'device:'
export const deviceWidgetId = (deviceId: string): string => `${DEVICE_WIDGET_PREFIX}${deviceId}`

let rail: {open: readonly string[]; toggle: (id: string) => void} | null = null
const railListeners = new Set<() => void>()

/** The rail hands its open set and its toggle (or withdraws them, with null). */
export function publishRail(next: {open: readonly string[]; toggle: (id: string) => void} | null): void {
  const was = rail
  rail = next
  if (was?.open.join('\n') !== next?.open.join('\n') || !was !== !next) for (const listener of railListeners) listener()
}

/** Whether the device stands on the rail now. */
export function onRail(deviceId: string): boolean {
  return !!rail?.open.includes(deviceWidgetId(deviceId))
}

/** Put the device on the rail; a device already there stays. Refuses in words when no rail is drawn. */
export function putOnRail(deviceId: string): string | null {
  if (!rail) return 'The widget rail is not open. Open it from the transport, then press the mark again.'
  if (!onRail(deviceId)) rail.toggle(deviceWidgetId(deviceId))
  return null
}

/** Take the device off the rail. */
export function takeOffRail(deviceId: string): void {
  if (rail && onRail(deviceId)) rail.toggle(deviceWidgetId(deviceId))
}

const subscribeRail = (listener: () => void) => { railListeners.add(listener); return () => { railListeners.delete(listener) } }

/** Re-render when the rail's open set changes. */
export function useOnRail(deviceId: string): boolean {
  return useSyncExternalStore(subscribeRail, () => onRail(deviceId), () => onRail(deviceId))
}

// ---------------------------------------------------------------------------------------------------------------- the device's window
// Pop-out (manual §16.3: "Its own window, which can fill the screen — The material with every control docked under it"; §16.4:
// "Any number of windows can stay open. A window follows its device: when the device leaves the chain, its window closes"). The
// head's ↗ opens the device's window, or brings it to the front where it stands; ↗ in the window, or the window's own close, closes
// it. The windows are drawn by the frame's window layer (DeviceWindows.tsx), in the order they stand, the last on top. Their boxes
// live here, with listeners of their own, so moving a window never redraws what reads the door.

export interface DeviceWindowBox {readonly x: number; readonly y: number; readonly w: number; readonly h: number}

export interface DeviceWindowState {
  readonly id: string
  /** Where the window stands; null until the layer first places it (deviceWindow.ts openedWindowBox). */
  readonly box: DeviceWindowBox | null
  /** The window fills the shell's window (the native window itself can then fill the screen). */
  readonly filled: boolean
  /** The window is rolled up to its bar. */
  readonly shaded: boolean
}

/** How long a withdrawn device keeps its window before it closes: a chain republishing its devices keeps them. */
export const WINDOW_GRACE_MS = 300

let windows: readonly DeviceWindowState[] = []
const windowListeners = new Set<() => void>()
const setWindows = (next: readonly DeviceWindowState[]) => {
  if (next === windows) return
  windows = next
  for (const listener of windowListeners) listener()
}

/** Where a Pop-out opens instead of this window, when one is set: the native host's own window (DeviceWindows.tsx registers it on
 * the host; frame/devices/deviceRelay.ts popOutNative). It answers whether it took the device. */
let popOutRoute: ((id: string) => boolean) | null = null
export function setPopOutRoute(route: ((id: string) => boolean) | null): void {
  popOutRoute = route
}

/** Open a device's own window — the host's own window where the route takes it, else here — or bring it to the front. */
export function openDeviceWindow(id: string): void {
  if (popOutRoute?.(id)) return
  openDeviceWindowHere(id)
}

/** Open a device's window in this window, as a layer over the shell, or bring it to the front where it already stands. */
export function openDeviceWindowHere(id: string): void {
  const at = windows.findIndex(open => open.id === id)
  if (at === windows.length - 1 && at >= 0) return
  setWindows(at >= 0 ? [...windows.filter(open => open.id !== id), windows[at]!] : [...windows, {id, box: null, filled: false, shaded: false}])
}

/** Close a device's window (↗ in the window, or its close). */
export function closeDeviceWindow(id: string): void {
  if (windows.some(open => open.id === id)) setWindows(windows.filter(open => open.id !== id))
}

/** Bring a window to the front (a press anywhere on it). */
export function raiseDeviceWindow(id: string): void {
  const at = windows.findIndex(open => open.id === id)
  if (at >= 0 && at < windows.length - 1) setWindows([...windows.filter(open => open.id !== id), windows[at]!])
}

/** Move, size, fill or roll up a window. */
export function setDeviceWindow(id: string, change: Partial<Omit<DeviceWindowState, 'id'>>): void {
  if (!windows.some(open => open.id === id)) return
  setWindows(windows.map(open => (open.id === id ? {...open, ...change} : open)))
}

/** The windows standing now, the front one last. */
export function deviceWindows(): readonly DeviceWindowState[] {
  return windows
}

/** Close every window whose device is no longer on the door (its chain unmounted for good, the device removed). */
export function sweepDeviceWindows(): void {
  const kept = windows.filter(open => devices.has(open.id))
  if (kept.length !== windows.length) setWindows(kept)
}

const subscribeWindows = (listener: () => void) => { windowListeners.add(listener); return () => { windowListeners.delete(listener) } }

/** Re-render when a window opens, closes, moves or comes to the front. */
export function useDeviceWindows(): readonly DeviceWindowState[] {
  return useSyncExternalStore(subscribeWindows, deviceWindows, deviceWindows)
}

/** Whether the device's window stands now. */
export function useDeviceWindowOpen(id: string): boolean {
  const open = () => windows.some(entry => entry.id === id)
  return useSyncExternalStore(subscribeWindows, open, open)
}
