import {useCallback, useRef} from 'react'
import {DetachedFrame} from '../../../../../desktop/cradle/src/workspace/DetachedFrame'
import {checkpointDocuments} from '../../../../../desktop/cradle/src/document/frame'
import type {KernelTransportStatus} from '../../../../../desktop/cradle/src/kernel/types'
import type {InhabitantManifest} from '../inhabitants/manifest'
import type {SurfaceBinding} from '../../../../../desktop/cradle/src/surface/types'
import {CANDIDATE_WORKSPACE_KEY} from '../continuity/workspace'
import {useWorkspace} from '../shell/workspace'
import {readShellConfig} from './application'
import {admitContribution} from './contributions'
import {deviceBindingId, deviceIdentityFault, deviceIdentityOf, deviceRelayIdentityFault, nativeDetachedBodySupported} from './detachedKinds'
import {allInhabitantManifests} from '../inhabitants/manifest'
import {loadWorldShellFamilies} from '../inhabitants/worldShellFamilies'
import {DeviceFace} from '../inhabitants/inhabitantRack'
import {useQlInstrumentFeed} from '../live/torusInstrument'
import {RelayedDevice} from '../frame/devices/RelayedDevice'

// The receiving window loads the families the main window loads (ModeDetail calls the same loader at module load): one
// loader, one door. A device body reads the registry at render, so the registry stands before the first admission.
loadWorldShellFamilies()

/** Receives the original Windows owner's existing binding; no surface/session
 * is opened again and the original frame owns redock and navigation contracts. */
export function NativeDetached() {
  const workspace = useWorkspace()
  const latest = useRef(workspace)
  latest.current = workspace
  const current = (epoch: number) => {
    if (!latest.current.accessReady || !latest.current.nativeAccessCurrent(epoch)) throw Error('The detached native World/access epoch is unavailable or has retired.')
  }
  const admitBinding = useCallback(async (binding: SurfaceBinding) => {
    const epoch = latest.current.accessEpoch
    current(epoch)
    if (!nativeDetachedBodySupported(binding.kind)) throw Error('This surface has no native detached receiving body. Its binding has been retained.')
    if (binding.kind === 'device') {
      // A device is admitted by the manifests that declare it, never as a hosted contribution. The named fault is the refusal. Its
      // body draws on the binding the main window relays, so its identity is what is admitted here; a face drawn alone, where no
      // relay answers, is held to the standalone face's own rule in the body (DeviceWindowBody).
      loadWorldShellFamilies()
      const fault = deviceRelayAdmissionFault(binding, allInhabitantManifests())
      current(epoch)
      if (fault) throw Error(fault)
      return
    }
    const config = await readShellConfig()
    current(epoch)
    admitContribution(binding, config.product_ids, config.contributions)
  }, [])
  const beforeRelease = useCallback(async (binding: SurfaceBinding) => {
    const epoch = latest.current.accessEpoch
    current(epoch)
    if (binding.kind !== 'device') await checkpointDocuments([binding.id])
    current(epoch)
  }, [])
  const transport = workspace.transport
  return <DetachedFrame workspaceStorageKey={CANDIDATE_WORKSPACE_KEY} admitBinding={admitBinding}
    beforeRelease={beforeRelease} renderDevice={binding => <DeviceWindowBody binding={binding} transport={transport}/>}
    ownerEpoch={`${workspace.accessEpoch}:${workspace.accessReady}`} />
}

/** The named refusal for a device window's binding, or null where the admitted manifests stand for it (seam 8). The
 * device's own identity is checked against the manifests, never against a hosted contribution. */
/** The named refusal for a relayed device window (deviceRelay.ts): its identity must name a declared family and face. */
export function deviceRelayAdmissionFault(binding: SurfaceBinding, manifests: readonly InhabitantManifest[]): string | null {
  const identity = deviceIdentityOf(binding)
  if (!identity) return 'The device window carries no device identity.'
  if (binding.id !== deviceBindingId(identity)) return 'The device binding id does not name its family and face.'
  const fault = deviceRelayIdentityFault(identity, manifests)
  return fault ? `This device cannot be shown: ${fault}.` : null
}

export function deviceAdmissionFault(binding: SurfaceBinding, manifests: readonly InhabitantManifest[]): string | null {
  const identity = deviceIdentityOf(binding)
  if (!identity) return 'The device window carries no device identity.'
  if (binding.id !== deviceBindingId(identity)) return 'The device binding id does not name its family and face.'
  const fault = deviceIdentityFault(identity, manifests)
  return fault ? `This device cannot be shown: ${fault}.` : null
}

/** The receiving body of a popped-out device (seam 8): the face its identity names, drawn from the manifests and the
 * identity's aperture. A fault is refused by name, never drawn. The QL instrument's reading is read in this window by the
 * same reader the shell reads (live/torusInstrument.ts): a separate JS context, so it stands only where this window's own
 * owner publishes; nothing is carried in the binding. */
export function DeviceWindowBody({binding, transport, manifests = allInhabitantManifests()}: {
  binding: SurfaceBinding
  transport: KernelTransportStatus
  /** The admitted manifests; the live receiving window reads the registry (the default). */
  manifests?: readonly InhabitantManifest[]
}) {
  const instrumentReading = useQlInstrumentFeed()
  const identity = deviceIdentityOf(binding)
  const relayFault = deviceRelayAdmissionFault(binding, manifests)
  if (relayFault || !identity) return <p role="alert" data-device-fault>{relayFault ?? 'The device window carries no device identity.'}</p>
  // The device's own Pop-out on the binding the main window relays (frame/devices/deviceRelay.ts); where none answers, the face
  // drawn alone, held to the standalone face's own rule (it must stand alone, declare pop-out and carry its aperture).
  const alone = deviceAdmissionFault(binding, manifests)
  return <RelayedDevice bindingId={binding.id} onClose={closeThisWindow}
    fallback={() => alone ? <p role="alert" data-device-fault>{alone}</p>
      : <DeviceFace identity={identity} manifests={manifests} transport={transport} instrumentReading={instrumentReading}/>} />
}

/** Close this window: the host's own re-dock (windows.rs window_redock), the one release this window's capability holds. */
function closeThisWindow() {
  void import('@tauri-apps/api/core').then(({invoke}) => invoke('window_redock'))
}
