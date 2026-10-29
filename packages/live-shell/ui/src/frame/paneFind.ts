// ⌘F in a pane (DLW §18.4 "The line anywhere": "⌘F finds where you are, as it does in both: in the browser it narrows the list, as Live's
// ⌘F does, and in a pane it finds in the instrument in front, as VS Code's ⌘F finds in the file in front"). An instrument that can find
// in what it shows registers its finder under its pane binding's id while it stands (central/documents/DocumentFind.tsx for the Day, a
// Flow, a Being and a Thing); the window's ⌘F (keys/planKey.ts 'search') asks for the finder of the pane in front and opens it, and leaves the
// key to the browser's search where the focus stands in the browser or the pane in front finds nothing. One map, no React.

export interface PaneFinder {
  /** Open the pane's find line, seeded as its instrument seeds it. */
  open(): void
}

const finders = new Map<string, PaneFinder>()

/** A pane's instrument can find: register it under the pane binding's id. The returned function withdraws it. */
export function registerPaneFinder(bindingId: string, finder: PaneFinder): () => void {
  finders.set(bindingId, finder)
  return () => { if (finders.get(bindingId) === finder) finders.delete(bindingId) }
}

export function paneFinder(bindingId: string | null | undefined): PaneFinder | null {
  return (bindingId && finders.get(bindingId)) || null
}

/** The part of an element this reads (a real Element satisfies it). */
interface FocusLike {
  closest?(selector: string): {querySelector?(selector: string): {getAttribute(name: string): string | null} | null} | null
}

/** Where the browser stands (frame/browser/Browser.tsx): ⌘F there narrows its list. */
const BROWSER = '.one-browser, .world-browser'

/** The finder ⌘F opens: where you are — the pane the focus stands in (the binding its body presents), or the place last pressed when
 * that press came after the focus last moved (WebKit, the native candidate's engine, leaves a pressed button unfocused, so the focus
 * can stay in a page while the hand has moved to the browser); else the pane that has focus in the layout. Null where that place is
 * the browser, or where the pane in front registered no finder. */
export function paneFinderInFront(active: FocusLike | null | undefined, focusedPaneId: string | null | undefined, pressed?: FocusLike | null, pressedSince = false): PaneFinder | null {
  for (const at of pressedSince ? [pressed, active] : [active, pressed]) {
    if (at?.closest?.(BROWSER)) return null
    const pane = at?.closest?.('.pane.group')
    if (pane) return paneFinder(pane.querySelector?.(':scope > .surface-body')?.getAttribute('data-binding-id'))
  }
  return paneFinder(focusedPaneId)
}

// Where the hand last pressed in the window, and whether it pressed after the focus last moved (FrameKeys listens, capturing). A press
// inside a hosted page is the page's and never reaches here; its frame takes the focus instead, which the window hears as its blur.
let pressedLast: FocusLike | null = null
let pressedAt = 0, focusedAt = 0, ticks = 0
export function notePress(target: unknown): void {
  pressedLast = target && typeof (target as FocusLike).closest === 'function' ? target as FocusLike : null
  pressedAt = ++ticks
}
export function noteFocusMoved(): void { focusedAt = ++ticks }
export function lastPress(): {readonly target: FocusLike | null; readonly since: boolean} { return {target: pressedLast, since: pressedAt > focusedAt} }
