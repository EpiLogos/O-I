import {STAGE_ENGINE_ACTIONS, type StageEngineAction} from '@epilogos/expressions-boundary'

/** A physics device's runtime action: {action, confirmed?}. The Expressions panel
 * turns it into one engine stage command through the mounted host. */
export const NATIVE_ENGINE_COMMAND = 'oi:native-engine-command'

export interface NativeEngineRequest {action: StageEngineAction; confirmed?: boolean}

/** Typed parse of an engine request. confirmed is accepted only as true: reset is the one action that carries it. */
export function parseNativeEngineCommand(detail: unknown): NativeEngineRequest | null {
  if (!detail || typeof detail !== 'object' || Array.isArray(detail)) return null
  const raw = detail as {action?: unknown; confirmed?: unknown}
  if (!(STAGE_ENGINE_ACTIONS as readonly unknown[]).includes(raw.action)) return null
  const action = raw.action as StageEngineAction
  if (raw.confirmed === undefined) return {action}
  return raw.confirmed === true && action === 'reset' ? {action, confirmed: true} : null
}

/** Device side: ask the Expressions panel to run one runtime action. */
export function dispatchNativeEngineCommand(request: NativeEngineRequest): void {
  window.dispatchEvent(new CustomEvent(NATIVE_ENGINE_COMMAND, {detail: request}))
}

// The Expressions panel reports whether a native Expression is mounted, so a device can name why its runtime actions are off.
let mounted = false
const listeners = new Set<() => void>()
export function setNativeEngineMounted(next: boolean): void {
  if (next === mounted) return
  mounted = next
  for (const listener of listeners) listener()
}
export const readNativeEngineMounted = (): boolean => mounted
export function subscribeNativeEngineMounted(listener: () => void): () => void {
  listeners.add(listener)
  return () => {listeners.delete(listener)}
}

/** Why the runtime actions are off, or null. busy is the device's own save or acknowledgement wait. */
export function engineCommandReason(input: {mounted: boolean; busy: boolean}): string | null {
  if (!input.mounted) return 'No native Expression is mounted.'
  if (input.busy) return 'Wait for the native work to finish saving.'
  return null
}
