// The constellation the browser selects, kept across modes (manual §10.3: "Show in Browser, beside the constellation in a clip's Clip
// panel and in the clip's menu, selects the constellation here, as Live's Show in Browser selects a clip's sample. Change mode and it
// stays selected, and its preview shows what the new mode makes of it"; §16.7's Show in Browser row).
//
// One selection for the one browser, held outside any mode's browser (the browser is drawn again for each mode), and the door the frame
// publishes to bring the browser forward on its Constellations category (App.tsx, as it publishes Clip view's door, frame/menu/
// objectDoor.ts). The selection is the shell's own, never an owner's: selecting a constellation changes nothing.
import {useSyncExternalStore} from 'react'
import {publishConstellationFocusDoor, setConstellationInFocus} from '../../../../../../desktop/cradle/src/knowledge/constellationInFocus'

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
// The reader reads the same selection (its Add to constellation gathers into it: desktop/cradle/src/knowledge/constellationInFocus.ts).
const emit = () => { setConstellationInFocus(focus.ref); for (const listener of [...listeners]) listener() }

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
export function publishBrowserDoor(next: BrowserDoor | null): void {
  door = next
  // The reader's graph opens a constellation's node here (desktop/cradle/src/knowledge/KnowledgeSurface.tsx open), and so does the Canvas
  // frame's Edit constellation (desktop/cradle/src/expressions/PointCloudHost.tsx `oi:open-scene-constellation`).
  publishConstellationFocusDoor(next ? whole => showConstellationInBrowser(whole) : null)
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return
  window.removeEventListener(OPEN_SCENE_CONSTELLATION, openSceneConstellation)
  if (next) window.addEventListener(OPEN_SCENE_CONSTELLATION, openSceneConstellation)
}

/** The Canvas frame's Edit constellation (O-I #742: the detached authoring panel it opened is retired): the constellation the Scene presents
 * comes forward in the browser, where what it holds stands and its menu holds its acts; a place the map drafted for it opens the reader's
 * time-and-place editor on the constellation, offered that draft (WikiFactsEditor.tsx offerConstellationRoute), as the legacy frame did. */
const OPEN_SCENE_CONSTELLATION = 'oi:open-scene-constellation'
function openSceneConstellation(event: Event): void {
  const detail = (event as CustomEvent<{target?: {frame_ref?: unknown; title?: unknown; project?: unknown}; placeDraft?: unknown; complete?: (error?: string) => void}>).detail
  const target = detail?.target
  if (!target || typeof target.frame_ref !== 'string') { detail?.complete?.('No verified constellation was supplied'); return }
  const frame_ref = target.frame_ref, project = typeof target.project === 'string' ? target.project : undefined
  const title = typeof target.title === 'string' ? target.title : frame_ref
  void (async () => {
    const [{readRegister}, {wholeOfFrame}, {detectTransport}] = await Promise.all([import('../../../../../../desktop/cradle/src/knowledge/construction'),
      import('../../../../../../desktop/cradle/src/knowledge/constellationActs'), import('../../../../../../desktop/cradle/src/kernel/bridge')])
    const register = await readRegister(detectTransport(), project)
    showConstellationInBrowser(wholeOfFrame(register, frame_ref) ?? frame_ref)
    if (detail.placeDraft === undefined) return
    const {offerConstellationRoute} = await import('../../../../../../desktop/cradle/src/knowledge/WikiFactsEditor')
    offerConstellationRoute(frame_ref, detail.placeDraft as Parameters<typeof offerConstellationRoute>[1])
    window.dispatchEvent(new CustomEvent('oi:epi-open-knowledge', {detail: {title, ...(project ? {project} : {}), address: {kind: 'wiki', value: frame_ref}, plane: 'graph', facts: frame_ref}}))
  })().then(() => detail.complete?.(), error => detail.complete?.(error instanceof Error ? error.message : String(error)))
}

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
export function resetConstellationFocus(): void { focus = {ref: null, shown: 0}; door = null; publishConstellationFocusDoor(null); emit() }
