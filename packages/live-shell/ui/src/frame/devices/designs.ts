// Which views draw a device (manual §16.12: "The device runtime draws a device's own views when it has them, and the generic
// plate when it does not"). The catalogue is the registry (lead, 16 Oct): a device's own views are the design the catalogue holds
// under `<family>:<face>` (inhabitants/catalogue/panels/index.ts loadDesign), loaded the first time a published device asks for
// it; absent, or still loading, the generic plate draws. A design the shell alone needs can be registered here, over the
// catalogue's. The catalogue loads through a dynamic import, so a page or a test that never asks for a design never loads it.
import {useEffect, useSyncExternalStore} from 'react'
import type {DesignedDevice} from './designed'

/** A design's resolution: the design, `null` when the catalogue holds none, absent while unasked or loading. */
const resolved = new Map<string, DesignedDevice | null>()
const overrides = new Map<string, DesignedDevice>()
const loading = new Set<string>()
const listeners = new Set<() => void>()
let version = 0
const notify = () => { version++; for (const listener of listeners) listener() }
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }

/** The design key of a device: `<family>:<face>`, as the catalogue names it. */
export const designKey = (family: string, faceId: string): string => `${family}:${faceId}`

/** Register a design the shell holds itself (a device with no catalogue entry), keyed by its `<family>:<face>` id. It stands over
 * the catalogue's design of the same id. */
export function registerDesignedDevice(design: DesignedDevice): void {
  overrides.set(design.id, design)
  notify()
}

/** Withdraw a design registered here (the catalogue's, if any, draws again). */
export function unregisterDesignedDevice(id: string): void {
  if (overrides.delete(id)) notify()
}

/** Whether the shell registered a design for `key` itself (it draws at once, on the device's own keys). */
export function isRegisteredDesign(key: string): boolean {
  return overrides.has(key)
}

/** The design that draws `key` now: a registered one, else the catalogue's once loaded; undefined while none stands. */
export function designFor(key: string): DesignedDevice | undefined {
  return overrides.get(key) ?? resolved.get(key) ?? undefined
}

/** Ask the catalogue for `key`'s design (once). A design that fails to load leaves the generic plate, and says why on the
 * console; it never stops another device drawing. */
export function requestDesign(key: string): void {
  if (overrides.has(key) || resolved.has(key) || loading.has(key)) return
  loading.add(key)
  import('./designsLoad').then(({loadDesign}) => loadDesign(key)).then(
    design => { loading.delete(key); resolved.set(key, design ?? null); notify() },
    cause => { loading.delete(key); resolved.set(key, null); console.warn(`The design of ${key} did not load; the generic plate draws it.`, cause); notify() },
  )
}

/** The design that draws a device, asking the catalogue for it when `ask` (a published device whose family has wired the design's
 * value keys to its owner — lead, 16 Oct: "The host resolves loadDesign('<family>:<face>') for every published device"; "a device
 * lane writes the binding"). Re-renders when a design arrives. */
export function useDesign(key: string, ask: boolean): DesignedDevice | undefined {
  useSyncExternalStore(subscribe, () => version, () => version)
  useEffect(() => { if (ask) requestDesign(key) }, [key, ask])
  return ask || overrides.has(key) ? designFor(key) : undefined
}
