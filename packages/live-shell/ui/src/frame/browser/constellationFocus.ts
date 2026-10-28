// The constellation the browser selects, kept across modes (manual §10.3: "Show in Browser, beside the constellation in a clip's Clip
// panel and in the clip's menu, selects the constellation here, as Live's Show in Browser selects a clip's sample. Change mode and it
// stays selected, and its preview shows what the new mode makes of it"; §16.7's Show in Browser row).
//
// One selection for the one browser, held outside any mode's browser (the browser is drawn again for each mode), and the door the frame
// publishes to bring the browser forward on its Constellations category (App.tsx, as it publishes Clip view's door, frame/menu/
// objectDoor.ts). The selection is the shell's own, never an owner's: selecting a constellation changes nothing.
import {useSyncExternalStore} from 'react'

/** The drag a constellation row carries (manual §10.3: "Drag a constellation onto a track and the mode makes its own clip of it"):
 * its ref, as the payload. */
export const CONSTELLATION_DRAG = 'application/x-oi-constellation'

/** The Constellations category, the same in every mode (shell/modeBrowsers.tsx SHARED): its key as the book holds a category. */
export const CONSTELLATIONS = {source: 'constellations', category: 'constellations'} as const
/** As the one browser keys a category (frame/browser/Browser.tsx categoryKey: its source, then its own id). */
export const CONSTELLATIONS_CATEGORY = `${CONSTELLATIONS.source}:${CONSTELLATIONS.category}`

interface Focus {
  readonly ref: string | null
  /** Moves each time Show in Browser asks for it, so the row is brought into view even when it was already selected. */
  readonly shown: number
}
let focus: Focus = {ref: null, shown: 0}
const listeners = new Set<() => void>()
const emit = () => { for (const listener of [...listeners]) listener() }

/** Select a constellation in the browser (a press on its row), or none. */
export function selectConstellation(ref: string | null): void {
  if (focus.ref === ref) return
  focus = {...focus, ref}
  emit()
}

export const constellationFocus = (): Focus => focus
export function useConstellationFocus(): Focus {
  return useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener) } }, constellationFocus, constellationFocus)
}

/** The frame's door to the browser: show it, on the category the key names. */
export type BrowserDoor = (categoryKey: string) => void
let door: BrowserDoor | null = null
export function publishBrowserDoor(next: BrowserDoor | null): void { door = next }

/** Show in Browser (manual §16.7): the browser comes forward on its Constellations category with the constellation selected, and keeps
 * it selected when you change mode. Throws when no browser is mounted to show it in. */
export function showConstellationInBrowser(ref: string): void {
  if (!ref) throw new Error('The clip was made of no constellation, so there is nothing to show in the browser.')
  if (!door) throw new Error('No browser is mounted in this window to show the constellation in.')
  focus = {ref, shown: focus.shown + 1}
  emit()
  door(CONSTELLATIONS_CATEGORY)
}

/** For tests: forget the selection and the door. */
export function resetConstellationFocus(): void { focus = {ref: null, shown: 0}; door = null; emit() }
