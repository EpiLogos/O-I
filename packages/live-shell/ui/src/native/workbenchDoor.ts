// The Workbench's openers, published for the one browser (manual §10.3: "instruments to open in a pane"). The surfaces the
// Workbench can open — a new tab, the sources, each hosted surface the suite registers, a terminal, a web browser — are listed
// in the browser's Instruments kind, never as a toolbar inside the panes. The Workbench publishes what it can open while it is
// mounted; the browser reads it. It also publishes the aperture its panes stand in, and the focused pane the browser's aperture
// slot reads.
import {useSyncExternalStore} from 'react'

export interface WorkbenchOpener {
  id: string
  title: string
  hint: string
  /** Open it. An opener that makes something (the New… grid's forms, your practice's pages) answers with what it made, in words, or
   * refuses in the owner's words; one that only opens a surface answers nothing. */
  open(): void | Promise<string>
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

/** The focused pane, as the browser's aperture slot reads it (world-shell-mockup.html `renderSlot`: "the aperture slot — the
 * focused pane's own context" — its mark, its tab's name, "pane i/N" and its pin). The Workbench publishes it from the presented
 * tree; null while no tree is presented or no pane holds a tab. Refs and titles only, never content. */
export interface FocusedPane {
  /** The focused tab's binding id. */
  id: string
  /** The binding's kind (`projection.timeline`, `projection.central-document`, `encounter`, `agent-shell`, `file` …). */
  kind: string
  /** The tab's own title. */
  title: string
  /** Which pane it is (1-based) among the panes the tree holds, and how many there are. */
  index: number
  count: number
  /** The subject the pane is pinned to (`projection.subject_ref`); absent while it follows the selection. */
  pinned?: string
  /** Whether the pane's kind follows the selection, and so can be pinned and let follow again (projectionModules
   * `followsSelection`). A pane that holds its own subject without following keeps it. */
  follows: boolean
  /** The owner's ref the binding holds (a file, a session, a source), when it holds one. */
  ref?: string
  project?: string
  /** The world and field the pane's hosted presentation stands in, when it stands in one (`binding.presentation`). */
  worldRef?: string
  fieldRef?: string
  /** Pin the pane to a subject, or let it follow again (undefined): the pane's own Follow/Pin action (`surface.pin-subject`). */
  pin(ref: string | undefined): void
}

let focusedPane: FocusedPane | null = null
const focusedListeners = new Set<() => void>()
const paneKey = (pane: FocusedPane | null) => pane && JSON.stringify([pane.id, pane.kind, pane.title, pane.index, pane.count, pane.pinned, pane.follows, pane.ref, pane.project, pane.worldRef, pane.fieldRef])

export function publishFocusedPane(next: FocusedPane | null): void {
  // A republish of the same reading is no change: the pin action is the Workbench's own door, the same whichever render made it.
  if (paneKey(focusedPane) === paneKey(next)) return
  focusedPane = next
  for (const listener of focusedListeners) listener()
}

export function focusedPaneReading(): FocusedPane | null { return focusedPane }

const subscribeFocused = (listener: () => void) => { focusedListeners.add(listener); return () => { focusedListeners.delete(listener) } }
export function useFocusedPane(): FocusedPane | null {
  return useSyncExternalStore(subscribeFocused, focusedPaneReading, focusedPaneReading)
}
