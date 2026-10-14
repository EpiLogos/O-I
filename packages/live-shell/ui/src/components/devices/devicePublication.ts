// Publishing a device to the door (frame/devices/deviceDoor.ts) from more than one place. A Field device is one instance whether
// it stands on the rack, is opened whole in the browser's pool, or is open full in a pane; each of those that is mounted claims
// the device's id, and the door holds the entry of the most recent claimant until the last one lets go. Withdrawing the entry
// when only one of two claimants unmounts would take the pane's device away while the pool still shows it.
import {publishDevice, type PublishedDevice} from '../../frame/devices/deviceDoor'

const claims = new Map<string, Map<symbol, PublishedDevice>>()

export interface DeviceClaim {
  /** Offer (or replace) this claimant's entry; the most recent offer is the one the door holds. */
  publish(entry: PublishedDevice): void
  /** Let go. The door keeps the entry of any other claimant, else withdraws the device. */
  release(): void
}

export function claimDevice(id: string): DeviceClaim {
  const token = Symbol(id)
  const settle = (): void => {
    const held = claims.get(id)
    publishDevice(id, held && held.size ? [...held.values()].at(-1) ?? null : null)
  }
  return {
    publish(entry) {
      const held = claims.get(id) ?? new Map<symbol, PublishedDevice>()
      claims.set(id, held)
      held.delete(token)
      held.set(token, entry)
      settle()
    },
    release() {
      const held = claims.get(id)
      if (!held) return
      held.delete(token)
      if (!held.size) claims.delete(id)
      settle()
    },
  }
}

/** The ids with a claimant now (for the tests and for anything that must know what the door holds on this module's behalf). */
export function claimedDeviceIds(): string[] {
  return [...claims.keys()]
}
