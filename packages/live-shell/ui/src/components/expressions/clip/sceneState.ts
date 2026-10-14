// What the Scene's controls share between the Clip side and the parts of Expressions that stand while it is not shown (the
// ⌘S chord and the selection's focus, mounted with Expressions' bindings: shell/transports/useExpressionsTransport.tsx):
// the owner's last answer in words, whether a Scene request is in flight, and the selection the Scene last acted on. None of
// it is document state: each value is a reading of the owner's reply, or the shell's own presentation.
import {useSyncExternalStore} from 'react'

/** The owner's answer to the last Scene request, in its words: a refusal or fault, or the save's notice. */
export interface SceneLine {kind: 'notice' | 'fault'; text: string}

let line: SceneLine | null = null
let inFlight = 0
let seen: string | null = null
const listeners = new Set<() => void>()
const emit = () => { for (const listener of listeners) listener() }
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }

export const sceneLine = (): SceneLine | null => line
export function sayScene(next: SceneLine | null): void {
  if (line === next || (line && next && line.kind === next.kind && line.text === next.text)) return
  line = next
  emit()
}
export const useSceneLine = (): SceneLine | null => useSyncExternalStore(subscribe, sceneLine, sceneLine)

/** One Scene request at a time, whichever door it came through: the Clip side's controls, the ⌘S chord, the selection. */
export const sceneBusy = (): boolean => inFlight > 0
export const useSceneBusy = (): boolean => useSyncExternalStore(subscribe, sceneBusy, sceneBusy)
export async function whileBusy<T>(work: () => Promise<T>): Promise<T> {
  inFlight++; emit()
  try { return await work() } finally { inFlight--; emit() }
}

/** The selection the Scene last acted on (selectionFollow in sceneClip.ts). */
export const seenSelection = (): string | null => seen
export const markSeen = (ref: string | null): void => { seen = ref }
