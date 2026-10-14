import type {InhabitantManifest} from '../inhabitants/manifest'
import type {CentralLocation} from '../../../../../desktop/cradle/src/kernel/types'

/** Original Windows owner admission (src-tauri/src/windows.rs::window_detach).
 * Compiled hosted identities alone do not grant a detached receiving body. */
const nativeDetachedKinds = new Set(['source', 'knowledge', 'file', 'encounter', 'browser', 'terminal', 'flow'])
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
