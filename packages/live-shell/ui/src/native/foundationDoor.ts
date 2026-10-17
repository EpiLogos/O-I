// The native foundation's reading of its own first read, published for the status bar (manual §10.1: "Read what any control
// does"). NativeFoundation (native/Foundation.tsx) stands above the App and so above the status bar; while it reads the
// native World it says so here, and the status bar's Info line carries that sentence as its idle text — in the bar, never
// drawn over it. Pure of views except the subscription hook.
import {useSyncExternalStore} from 'react'

let pending = false
const listeners = new Set<() => void>()

/** The foundation's pending state: true while the native World is being read. */
export function publishFoundationPending(next: boolean): void {
  if (pending === next) return
  pending = next
  for (const listener of [...listeners]) listener()
}

export function foundationPending(): boolean {
  return pending
}

const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }

/** Whether the native World is being read, live. */
export function useFoundationPending(): boolean {
  return useSyncExternalStore(subscribe, foundationPending, foundationPending)
}
