import { useSyncExternalStore } from 'react'
import type { SettingsAdapter, SettingsRequest } from './adapter'
import { unavailableSettingsAdapter } from './adapter'
import { modeGrammar, surfModeOf } from '../shell/modeGrammar'

/** `returnLabel`: the work the frame stands in, which Settings' way back names (setSettingsReturnLabel). */
interface SettingsHost { adapter: SettingsAdapter; request: SettingsRequest | null; onReturn?: () => void; returnLabel?: string }
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
/** The frame names the work Settings returns to (manual §10.10: "Press Esc to go back to the work you came from"): the way back says it,
 * unless a contextual entry names its own return (SettingsRequest.returnLabel). */
export function setSettingsReturnLabel(returnLabel: string | undefined): void {
  if (host.returnLabel === returnLabel) return
  host = { ...host, returnLabel }
  publish()
}
/** The way back from Settings, named for the mode the frame stands in: Back to Live, Central, Factory, Expressions or Technē. */
export function returnToMode(mode: string): string {
  const grammar = modeGrammar(surfModeOf(mode) ?? '')
  return grammar ? `Back to ${grammar.title}` : 'Back to work'
}
/** Parent selects world.settings alongside this call; the work remains mounted. */
export function openSettings(request: SettingsRequest | null): void { host = { ...host, request }; publish() }
/** Settings opened on Setup (manual §10.11): the first time the DLW opens on a world with no ground, and wherever Setup is asked for;
 * with a folder, on its Projects step for that folder (the browser's Work place: "Add folder… opens this step for that folder"). With no
 * returnLabel of its own, the way back names the work the frame stands in. */
export function setupRequest(returnLabel?: string, folder?: string): SettingsRequest {
  return { requestId: crypto.randomUUID(), page: 'setup', scope: { scope_kind: 'machine', scope_ref: null }, ...(returnLabel ? { returnLabel } : {}), ...(folder ? { folder } : {}) }
}
export function getSettingsHostSnapshot(): SettingsHost { return host }
export function useSettingsHost(): SettingsHost { return useSyncExternalStore(listener => { listeners.add(listener); return () => listeners.delete(listener) }, getSettingsHostSnapshot) }
