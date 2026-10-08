import { useSyncExternalStore } from 'react'
import type { SettingsAdapter, SettingsRequest } from './adapter'
import { unavailableSettingsAdapter } from './adapter'

interface SettingsHost { adapter: SettingsAdapter; request: SettingsRequest | null; onReturn?: () => void }
let host: SettingsHost = { adapter: unavailableSettingsAdapter(), request: null }
const listeners = new Set<() => void>()
function publish() { listeners.forEach(listener => listener()) }
/** Parent owns frame selection and supplies the native adapter. No source store is created. */
export function configureSettingsHost(adapter: SettingsAdapter, onReturn?: () => void): void { host = { ...host, adapter, onReturn }; publish() }
/** Parent selects world.settings alongside this call; the work remains mounted. */
export function openSettings(request: SettingsRequest | null): void { host = { ...host, request }; publish() }
export function useSettingsHost(): SettingsHost { return useSyncExternalStore(listener => { listeners.add(listener); return () => listeners.delete(listener) }, () => host) }
