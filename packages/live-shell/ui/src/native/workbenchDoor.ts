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

/** The aperture the panes stand in (the mockup's status bar: "aperture shared · 2 panes"): how many panes the presented tree
 * holds, and how many of them are pinned to their own subject rather than following the shared encounter. */
export interface WorkbenchAperture {
  panes: number
  pinned: number
}

let aperture: WorkbenchAperture | null = null
const apertureListeners = new Set<() => void>()

export function publishWorkbenchAperture(next: WorkbenchAperture | null): void {
  if (aperture === next || (aperture && next && aperture.panes === next.panes && aperture.pinned === next.pinned)) return
  aperture = next
  for (const listener of apertureListeners) listener()
}

const subscribeAperture = (listener: () => void) => { apertureListeners.add(listener); return () => { apertureListeners.delete(listener) } }
export function useWorkbenchAperture(): WorkbenchAperture | null {
  return useSyncExternalStore(subscribeAperture, () => aperture, () => aperture)
}

/** The aperture in the status bar's words. */
export function apertureWords({panes, pinned}: WorkbenchAperture): string {
  return `aperture ${pinned ? `${pinned} pinned` : 'shared'} · ${panes} pane${panes === 1 ? '' : 's'}`
}
