import { useSyncExternalStore } from 'react'
import type { SettingsAdapter, SettingsRequest } from './adapter'
import { unavailableSettingsAdapter } from './adapter'

interface SettingsHost { adapter: SettingsAdapter; request: SettingsRequest | null; onReturn?: () => void }
let host: SettingsHost = { adapter: unavailableSettingsAdapter(), request: null }
const listeners = new Set<() => void>()
function publish() { listeners.forEach(listener => listener()) }
/** Native admission supplies the adapter; the frame independently owns Return.
 * Omitting the second argument preserves that callback across native rebinding.
 * Passing an explicit undefined clears it during deliberate frame teardown. */
export function configureSettingsHost(adapter: SettingsAdapter, ...frameReturn: [] | [(() => void) | undefined]): void {
  host = { ...host, adapter, ...(frameReturn.length ? { onReturn: frameReturn[0] } : {}) }
  publish()
}
/** Parent selects world.settings alongside this call; the work remains mounted. */
export function openSettings(request: SettingsRequest | null): void { host = { ...host, request }; publish() }
export function getSettingsHostSnapshot(): SettingsHost { return host }
export function useSettingsHost(): SettingsHost { return useSyncExternalStore(listener => { listeners.add(listener); return () => listeners.delete(listener) }, getSettingsHostSnapshot) }
