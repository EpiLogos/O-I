import {useSyncExternalStore} from 'react'
import {DETACHED_KINDS, faceStandsAlone, type DetachedKind, type InhabitantManifest} from '../inhabitants/manifest'
import type {DeviceWindowHost} from '../inhabitants/inhabitantRack'
import type {CentralLocation} from '../../../../../desktop/cradle/src/kernel/types'
import type {LayoutState, SurfaceBinding} from '../../../../../desktop/cradle/src/surface/types'

/** The kinds the native host has a receiving body for. This is the one shell-side table: the native set is derived from it
 * and the door's declared kinds (`DETACHED_KINDS`), so a kind a family declares and the host admits cannot drift apart.
 * The Rust side mirrors it in `src-tauri/src/windows.rs::window_detach`; `tests/native-detached-kinds-conformance.test.mjs`
 * parses that list and fails on any difference. The device kind (seam 8) is admitted by the same door through its identity
 * alone (`admit_device_binding`). Compiled hosted identities alone do not grant a detached receiving body. */
const NATIVE_RECEIVING_BODY_TABLE: readonly DetachedKind[] = ['source', 'knowledge', 'file', 'encounter', 'browser', 'terminal', 'flow', 'device']

/** The door's declared detached kinds that the native host can receive (derived, never a second list). */
export const NATIVE_DETACHED_KINDS: readonly DetachedKind[] = DETACHED_KINDS.filter(kind => NATIVE_RECEIVING_BODY_TABLE.includes(kind))

const nativeDetachedKindSet: ReadonlySet<string> = new Set<string>(NATIVE_DETACHED_KINDS)
export function nativeDetachedBodySupported(kind: string): boolean {
  return nativeDetachedKindSet.has(kind)
}

/** A device's aperture (seam 8): the selection the face reads, as identity — never the owner's reading. Each face reads
 * its own part; the instrument is the focused holder id, and its reading is read by the face from its owner. */
export interface DeviceAperture {
  readonly day: {readonly project: string | null; readonly sourceRef: string; readonly documentId: string} | null
  readonly flow: {readonly location: CentralLocation} | null
  readonly conversation: {readonly project: string | null; readonly expressionRef: string | null; readonly conversation?: string | null} | null
  readonly instrument: string | null
}

/** A popped-out device's identity: the manifest that declares the face, the face, and its aperture. One device, one
 * binding: the binding id is the face's (`deviceBindingId`), so a second pop-out of the same face finds the first. */
export interface DeviceDetachIdentity {
  readonly family: string
  readonly face: string
  readonly aperture: DeviceAperture
}

export function deviceBindingId(identity: Pick<DeviceDetachIdentity, 'family' | 'face'>): string {
  return `device:${identity.family}/${identity.face}`
}

/** The aperture part a standalone face's window reads: a Day for the die. Without it the window would be empty. The ql-instrument face
 * shows its own honest state without one, so it names no part. (The Flow document and the Nara conversation were retired as faces of their
 * own in the 22 Oct manual rewrite.) */
const APERTURE_PART: ReadonlyMap<string, 'day' | 'flow'> = new Map([['day-die', 'day']])

/** The named fault when a face's window would stand without the aperture it reads, or null. */
export function popOutApertureFault(face: {readonly id: string}, aperture: DeviceAperture): string | null {
  const part = APERTURE_PART.get(face.id)
  if (!part || aperture[part]) return null
  return `${face.id} needs its ${part === 'day' ? 'Day' : 'flow'} in the aperture, or its window would be empty`
}

/** The manifest's own check of a device identity. The family must admit the face, the face must declare pop-out, the family
 * must declare the device detached kind, and the face must draw its body in a window of its own (a parameter face, or an
 * atlas or knowledge-graph face that drives the main window's handle, is refused by name). Null when the identity stands
 * in the manifests; otherwise the fault. */
export function deviceIdentityFault(identity: DeviceDetachIdentity, manifests: readonly InhabitantManifest[]): string | null {
  const manifest = manifests.find(entry => entry.id === identity.family)
  if (!manifest) return `no admitted family "${identity.family}" declares this device`
  const face = manifest.faces.find(entry => entry.id === identity.face)
  if (!face) return `${identity.family} declares no face "${identity.face}"`
  if (!(face.dock ?? ['dock']).includes('pop-out')) return `${identity.family}/${identity.face} does not declare pop-out`
  if (!(manifest.detachedKinds ?? []).includes('device')) return `${identity.family} does not declare the device detached kind`
  if (!faceStandsAlone(face)) return `${identity.family}/${identity.face} does not stand alone: its body draws only in the main window, so a window for it would be empty`
  return popOutApertureFault(face, identity.aperture)
}

/** A device window's binding: the workbench surface binding carrying the identity the native owner admits. The identity is
 * the binding's own `device` field; it is never a kernel surface. */
export type DeviceBinding = SurfaceBinding

/** The identity a device window's binding carries, or null where the binding carries none. */
export function deviceIdentityOf(binding: SurfaceBinding): DeviceDetachIdentity | null {
  const device = (binding as DeviceBinding).device
  if (!device || typeof device.family !== 'string' || typeof device.face !== 'string' || !device.aperture || typeof device.aperture !== 'object') return null
  return device
}

/** The named refusal for a relayed device window (deviceRelay.ts): its binding must carry an identity and its id must name it. What
 * the device is and how it draws come from the main window, which relays only a device it publishes. Null when it is well formed. */
export function deviceRelayAdmissionFault(binding: SurfaceBinding): string | null {
  const identity = deviceIdentityOf(binding)
  if (!identity) return 'The device window carries no device identity.'
  return binding.id === deviceBindingId(identity) ? null : 'The device binding id does not name its family and face.'
}

/** The layout's own record of a popped-out device: its binding is held in the detached set (never as a centre tab), so the
 * rack reads the same store the pane engine's detach door writes. A device names no pane group: its entry's group is
 * empty, so the focused group it was popped from is never kept alive as a reserved slot (engine.ts reads a detached
 * entry's group as one). */
export function placeDeviceDetached(layout: LayoutState, binding: SurfaceBinding): LayoutState {
  return {
    ...layout,
    surfaces: {...layout.surfaces, [binding.id]: binding},
    detached: [...(layout.detached ?? []).filter(entry => entry.surfaceId !== binding.id), {surfaceId: binding.id, groupId: '', index: 0, pinned: false}],
  }
}

/** The window door's own answers that a device's window is gone (windows.rs `window_redock_surface`). The entry is stale
 * then, and the rack shows the device docked again; any other failure is a fault and still reaches the report. */
const DEVICE_WINDOW_GONE: readonly string[] = ['no matching detached Surface', 'The detached Surface window is no longer available']
export function deviceWindowGone(cause: unknown): boolean {
  const text = String(cause)
  return DEVICE_WINDOW_GONE.some(message => text.includes(message))
}

/** The doors a device pop-out may use. `focusExisting` resolves true when a native window stands for the device's binding,
 * whichever workspace opened it, and false when none does. `recordFocused` gives this workspace its entry for that window
 * (when it lacks one); `dropStale` drops the entry from every workspace (no window stands, so each is stale). */
export interface DevicePopOutDoor {
  readonly focusExisting: () => Promise<boolean>
  readonly recordFocused: () => void
  readonly dropStale: () => void
  readonly detach: () => Promise<void>
}

/** A device pop-out is decided by the native window, never by one workspace's entry: a window that stands for the device is
 * focused and recorded in this workspace, so a device popped out in one workspace and again in another still has one window.
 * No window stands: every entry is stale, and the device pops out afresh. Returns what happened. */
export async function popOutDeviceWindow(door: DevicePopOutDoor): Promise<'focused' | 'popped-out'> {
  if (await door.focusExisting()) {
    door.recordFocused()
    return 'focused'
  }
  door.dropStale()
  await door.detach()
  return 'popped-out'
}

/** Whether any of a workspace's layouts (the current layout or a saved mode layout) holds this device's detached entry. */
export function workspaceHoldsDetached(workspace: {readonly layout: LayoutState; readonly modeLayouts?: object}, surfaceId: string): boolean {
  const layouts = [workspace.layout, ...Object.values(workspace.modeLayouts ?? {})] as readonly (LayoutState | undefined)[]
  return layouts.some(layout => !!layout?.detached?.some(entry => entry.surfaceId === surfaceId))
}

/** A device returning to its rack: its detached entry and binding leave the layout. A device never returns as a centre tab. */
export function dropDeviceDetached(layout: LayoutState, id: string): LayoutState {
  const surfaces = {...layout.surfaces}
  delete surfaces[id]
  return {...layout, surfaces, detached: layout.detached?.filter(entry => entry.surfaceId !== id)}
}

// The receiving Workbench publishes its host door; the racks read it. Null where no Workbench stands (no pop-out door).
let deviceWindowHost: DeviceWindowHost | null = null
const deviceWindowListeners = new Set<() => void>()
export function publishDeviceWindowHost(host: DeviceWindowHost | null): void {
  deviceWindowHost = host
  for (const listener of deviceWindowListeners) listener()
}
function subscribeDeviceWindowHost(listener: () => void): () => void {
  deviceWindowListeners.add(listener)
  return () => {deviceWindowListeners.delete(listener)}
}
export function useDeviceWindowHost(): DeviceWindowHost | null {
  return useSyncExternalStore(subscribeDeviceWindowHost, () => deviceWindowHost, () => null)
}
