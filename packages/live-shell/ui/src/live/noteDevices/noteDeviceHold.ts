// The note-device chain's hold (T-LIVE-MODE-SCALES item 3). Held for the session in this module, like the mode hold in
// native/liveModeCatalogue.ts: never in browser storage. The set document has no owner write for a device chain yet, so nothing
// here is persisted with the set. Owners write, faces read: the chain is the Live surface's own choice, and the pitch sets it
// folds onto are the owner's, read from the mode in force.
import {useSyncExternalStore} from 'react'
import {newNoteDevice, type NoteDevice, type NoteDeviceKind, type TieRule} from './noteDevices'

let chain: readonly NoteDevice[] = []
let counter = 0
const listeners = new Set<() => void>()

function commit(next: readonly NoteDevice[]): void {
  chain = next
  for (const listener of [...listeners]) listener()
}

/** The chain, in order, as it stands. */
export function noteDeviceChain(): readonly NoteDevice[] {
  return chain
}

export function subscribeNoteDeviceChain(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** The chain as a hook: every reader re-renders on the same change. */
export function useNoteDeviceChain(): readonly NoteDevice[] {
  return useSyncExternalStore(subscribeNoteDeviceChain, noteDeviceChain, noteDeviceChain)
}

/** Append a device of a kind at the end of the chain (its default parameters, powered on). */
export function addNoteDevice(kind: NoteDeviceKind): NoteDevice {
  counter += 1
  const device = newNoteDevice(kind, `note-device-${counter}`)
  commit([...chain, device])
  return device
}

/** Remove a device. An unknown id changes nothing. */
export function removeNoteDevice(id: string): void {
  if (!chain.some(device => device.id === id)) return
  commit(chain.filter(device => device.id !== id))
}

/** Power a device on or off. A bypassed device passes the act through unchanged. */
export function setNoteDevicePower(id: string, enabled: boolean): void {
  if (!chain.some(device => device.id === id)) return
  commit(chain.map(device => (device.id === id ? {...device, enabled} : device)))
}

/** Move a device one place earlier (-1) or later (+1) in the chain. At either end, nothing moves. */
export function moveNoteDevice(id: string, delta: -1 | 1): void {
  const index = chain.findIndex(device => device.id === id)
  const target = index + delta
  if (index < 0 || target < 0 || target >= chain.length) return
  const next = [...chain]
  const [moved] = next.splice(index, 1)
  next.splice(target, 0, moved)
  commit(next)
}

/** The Scale device's tie rule. Any other device is unchanged. */
export function setScaleTie(id: string, tie: TieRule): void {
  commit(chain.map(device => (device.id === id && device.kind === 'scale' ? {...device, params: {...device.params, tie}} : device)))
}

/** Clear the chain. Used by tests; a session starts with no devices. */
export function resetNoteDeviceChain(): void {
  commit([])
}
