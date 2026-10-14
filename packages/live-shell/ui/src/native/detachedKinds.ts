import {useSyncExternalStore} from 'react'
import type {InhabitantManifest} from '../inhabitants/manifest'
import type {DeviceWindowHost} from '../inhabitants/inhabitantRack'
import type {CentralLocation} from '../../../../../desktop/cradle/src/kernel/types'
import type {LayoutState, SurfaceBinding} from '../../../../../desktop/cradle/src/surface/types'

/** Original Windows owner admission (src-tauri/src/windows.rs::window_detach). The device kind (seam 8) is admitted by the
 * same door through its identity alone (`admit_device_binding`). Compiled hosted identities alone do not grant a detached
 * receiving body. */
const nativeDetachedKinds = new Set(['source', 'knowledge', 'file', 'encounter', 'browser', 'terminal', 'flow', 'device'])
export function nativeDetachedBodySupported(kind: string): boolean {
  return nativeDetachedKinds.has(kind)
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

/** The manifest's own check of a device identity. The family must admit the face, the face must declare pop-out, and the
 * family must declare the device detached kind. Null when the identity stands in the manifests; otherwise the fault. */
export function deviceIdentityFault(identity: DeviceDetachIdentity, manifests: readonly InhabitantManifest[]): string | null {
  const manifest = manifests.find(entry => entry.id === identity.family)
  if (!manifest) return `no admitted family "${identity.family}" declares this device`
  const face = manifest.faces.find(entry => entry.id === identity.face)
  if (!face) return `${identity.family} declares no face "${identity.face}"`
  if (!(face.dock ?? ['dock']).includes('pop-out')) return `${identity.family}/${identity.face} does not declare pop-out`
  if (!(manifest.detachedKinds ?? []).includes('device')) return `${identity.family} does not declare the device detached kind`
  return null
}

/** A device window's binding: the workbench surface binding carrying the identity the native owner admits. The identity is
 * the binding's own `device` field; it is never a kernel surface. */
export type DeviceBinding = SurfaceBinding & {readonly device?: DeviceDetachIdentity}

/** The identity a device window's binding carries, or null where the binding carries none. */
export function deviceIdentityOf(binding: SurfaceBinding): DeviceDetachIdentity | null {
  const device = (binding as DeviceBinding).device
  if (!device || typeof device.family !== 'string' || typeof device.face !== 'string' || !device.aperture || typeof device.aperture !== 'object') return null
  return device
}

/** The layout's own record of a popped-out device: its binding is held in the detached set (never as a centre tab), so the
 * rack reads the same store the pane engine's detach door writes. */
export function placeDeviceDetached(layout: LayoutState, binding: SurfaceBinding, groupId: string): LayoutState {
  return {
    ...layout,
    surfaces: {...layout.surfaces, [binding.id]: binding},
    detached: [...(layout.detached ?? []).filter(entry => entry.surfaceId !== binding.id), {surfaceId: binding.id, groupId, index: 0, pinned: false}],
  }
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
