// The Workbench's openers, published for the one browser (manual §10.3: "instruments to open in a pane"). The surfaces the
// Workbench can open — a new tab, the sources, each hosted surface the suite registers, a terminal, a web browser — are listed
// in the browser's Instruments kind, never as a toolbar inside the panes. The Workbench publishes what it can open while it is
// mounted; the browser reads it.
import {useSyncExternalStore} from 'react'

export interface WorkbenchOpener {
  id: string
  title: string
  hint: string
  open(): void
}

let openers: readonly WorkbenchOpener[] = []
const listeners = new Set<() => void>()

export function publishWorkbenchOpeners(next: readonly WorkbenchOpener[]): () => void {
  openers = next
  for (const listener of listeners) listener()
  return () => { if (openers === next) { openers = []; for (const listener of listeners) listener() } }
}

const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }
export function useWorkbenchOpeners(): readonly WorkbenchOpener[] {
  return useSyncExternalStore(subscribe, () => openers, () => openers)
}
