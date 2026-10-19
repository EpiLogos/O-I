// What a detached window admits, and what it settles before it lets a binding go (native/Detached.tsx). A file, flow or encounter
// reads native resources in this window, so its admission and its release stand on this window's current World/access epoch. A
// device does not: it draws on the binding the main window relays (frame/devices/deviceRelay.ts) and reads no native file here, so
// its window is admitted on its identity alone and lets go without asking for that access (r23: the Day's first Pop-out was refused
// while this window's access was still arriving — a device window may never receive one — and its Re-dock did nothing).
import type {SurfaceBinding} from '../../../../../desktop/cradle/src/surface/types'
import type {NativeContributionReading} from './application'
import {deviceRelayAdmissionFault, nativeDetachedBodySupported} from './detachedKinds'

export const DETACHED_ACCESS_RETIRED = 'The detached native World/access epoch is unavailable or has retired.'
export const NO_DETACHED_BODY = 'This surface has no native detached receiving body. Its binding has been retained.'

/** This window's native access as it stands now: whether it is ready, its epoch, and whether an epoch is still the current one. */
export interface DetachedAccess {
  readonly ready: boolean
  readonly epoch: number
  current(epoch: number): boolean
}

export interface DetachedAdmissionDoors {
  access(): DetachedAccess
  loadFamilies(): void
  readConfig(): Promise<{product_ids?: readonly string[]; contributions?: readonly NativeContributionReading[]}>
  admitContribution(binding: SurfaceBinding, productIds?: readonly string[], contributions?: readonly NativeContributionReading[]): void
  checkpoint(ids: string[]): Promise<void>
}

export function detachedAdmission(doors: DetachedAdmissionDoors): {
  admitBinding(binding: SurfaceBinding): Promise<void>
  beforeRelease(binding: SurfaceBinding): Promise<void>
} {
  const current = (epoch: number) => {
    const access = doors.access()
    if (!access.ready || !access.current(epoch)) throw Error(DETACHED_ACCESS_RETIRED)
  }
  return {
    async admitBinding(binding) {
      if (binding.kind === 'device') {
        // Its identity is what is admitted; a face drawn alone, where no relay answers, is held to the manifests' rule in the body
        // (Detached.tsx DeviceWindowBody). The named fault is the refusal.
        doors.loadFamilies()
        const fault = deviceRelayAdmissionFault(binding)
        if (fault) throw Error(fault)
        return
      }
      const epoch = doors.access().epoch
      current(epoch)
      if (!nativeDetachedBodySupported(binding.kind)) throw Error(NO_DETACHED_BODY)
      const config = await doors.readConfig()
      current(epoch)
      doors.admitContribution(binding, config.product_ids, config.contributions)
    },
    async beforeRelease(binding) {
      if (binding.kind === 'device') return
      const epoch = doors.access().epoch
      current(epoch)
      await doors.checkpoint([binding.id])
      current(epoch)
    },
  }
}
