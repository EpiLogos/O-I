// The window's parts and their sizes (manual §10.1: "To hide a part, click its toggle. The other parts grow to fill the space";
// §10.6: "To widen the rail, drag its edge"; §10.8: ⌘⌥B the browser, ⌘⌥L the detail area). The frame (App.tsx) holds which parts
// show and the sizes the person chose; this module is the arithmetic between them, so each part keeps its own size, the parts
// never overrun the window together, and the detail area's expansion returns exactly where it was. Pure.

/** The frame's side padding (styles.css `.frame { padding: 0 6px }`). */
export const FRAME_PAD = 6
/** The least the panes keep across the window while the browser or the rail is dragged wider. */
export const MIN_CENTRE_W = 240
/** The browser's narrowest (App.tsx's resizer bound, as it stood). */
export const MIN_BROWSER_W = 120
/** The rail's bounds (desktop/cradle/src/workspace/store.ts setWidgetRailWidth: "bounded as the docks were (260–900)"). */
export const RAIL_MIN_W = 260
export const RAIL_MAX_W = 900
/** The detail area's lowest, and what the window keeps above it while it is dragged taller (App.tsx's bounds, as they stood). */
export const MIN_DETAIL_H = 120
export const DETAIL_KEEPS_H = 240
/** What an expanded detail area leaves the window: the transport, the status bar and a strip of the panes (App.tsx, as it stood). */
export const EXPANDED_KEEPS_H = 156
/** One press of an arrow on a resizer. */
export const RESIZE_STEP = 10

const clamp = (value: number, low: number, high: number): number => Math.max(low, Math.min(high, value))

/** The widest the browser may stand: the window less its padding, the rail where it shows, and the panes' least width. */
export function browserMax(viewportW: number, railShownW: number): number {
  return Math.max(MIN_BROWSER_W, viewportW - 2 * FRAME_PAD - railShownW - MIN_CENTRE_W)
}
export function clampBrowserWidth(width: number, viewportW: number, railShownW: number): number {
  return Math.round(clamp(width, MIN_BROWSER_W, browserMax(viewportW, railShownW)))
}

/** The widest the rail may stand: its own bound, and what the browser (where it shows) and the panes leave. */
export function railMax(viewportW: number, browserShownW: number): number {
  return Math.max(RAIL_MIN_W, Math.min(RAIL_MAX_W, viewportW - 2 * FRAME_PAD - browserShownW - MIN_CENTRE_W))
}
export function clampRailWidth(width: number, viewportW: number, browserShownW: number): number {
  return Math.round(clamp(width, RAIL_MIN_W, railMax(viewportW, browserShownW)))
}

/** The tallest the detail area may be dragged; expanded, it stands taller (expandedDetailHeight). */
export function detailMax(viewportH: number): number {
  return Math.max(MIN_DETAIL_H, viewportH - DETAIL_KEEPS_H)
}
export function clampDetailHeight(height: number, viewportH: number): number {
  return Math.round(clamp(height, MIN_DETAIL_H, detailMax(viewportH)))
}
/** The detail area expanded: the window's working height, less a strip of the panes. */
export function expandedDetailHeight(viewportH: number): number {
  return Math.max(MIN_DETAIL_H, viewportH - EXPANDED_KEEPS_H)
}

/** A size under the hand: where the drag began (pointer and size), and how the pointer has moved since. The part keeps the
 * offset at which it was taken, so the first move never jumps; `grows` is the pointer direction that makes it larger. */
export interface AreaDrag {readonly at: number; readonly size: number}
export function draggedSize(drag: AreaDrag, pointer: number, grows: 1 | -1): number {
  return drag.size + grows * (pointer - drag.at)
}

/** The sizes the frame draws with: what the person chose, held inside the window as it stands now (a window made smaller after a
 * part was widened never pushes the rail off the window's edge). Null keeps the stylesheet's own default for that part. Each part
 * keeps its chosen size in the book; only what is drawn is bounded. */
export interface AreaSizes {readonly browserW: number | null; readonly railW: number | null; readonly detailH: number | null}
export function drawnSizes(chosen: AreaSizes, shown: {readonly browser: boolean; readonly rail: boolean}, viewport: readonly [number, number],
  railDefaultW: number = RAIL_MIN_W): AreaSizes {
  const [w, h] = viewport
  const railW = chosen.railW === null ? null : clampRailWidth(chosen.railW, w, 0)
  const railShown = shown.rail ? railW ?? railDefaultW : 0
  const browserW = chosen.browserW === null ? null : clampBrowserWidth(chosen.browserW, w, railShown)
  const detailH = chosen.detailH === null ? null : Math.round(clamp(chosen.detailH, MIN_DETAIL_H, expandedDetailHeight(h)))
  return {browserW, railW, detailH}
}

// ------------------------------------------------------------------------------------------------- the detail area's expansion
// The Clip side's deep edit expands the detail area and Return restores it (components/NativeWorldDetail.tsx). Each frame (a
// workspace in a mode) keeps its own return: leave a mode with its detail expanded and come back, and it is still expanded; the
// other modes keep their own heights meanwhile; Return gives back exactly the height the area had before.

export interface DetailExpansion {readonly height: number | null; readonly workspaceId: string; readonly accessEpoch: number}
export type DetailExpansions = Readonly<Record<string, DetailExpansion>>
export interface FrameAt {readonly frame: string; readonly workspaceId: string; readonly accessEpoch: number}

/** Expand in `at.frame`: the height to return to is the one it had before the first expansion. */
export function expandDetail(held: DetailExpansions, at: FrameAt, height: number | null): DetailExpansions {
  if (held[at.frame]) return held
  return {...held, [at.frame]: {height, workspaceId: at.workspaceId, accessEpoch: at.accessEpoch}}
}

/** Restore `at.frame`: the height to restore (absent when this frame holds no expansion, or one made under another workspace or
 * owner lease), and the expansions left. */
export function collapseDetail(held: DetailExpansions, at: FrameAt): {held: DetailExpansions; restore?: {height: number | null}} {
  const mine = held[at.frame]
  if (!mine) return {held}
  const {[at.frame]: _gone, ...rest} = held
  return mine.workspaceId === at.workspaceId && mine.accessEpoch === at.accessEpoch ? {held: rest, restore: {height: mine.height}} : {held: rest}
}

/** The height a frame keeps in the book: while expanded, the height it returns to (an expansion is a presentation, never a size). */
export function keptDetailHeight(held: DetailExpansions, frame: string, height: number | null): number | null {
  return held[frame] ? held[frame]!.height : height
}

/** The height a frame stands at when it is entered: expanded again if it was left expanded, else the height it kept. */
export function enteredDetailHeight(held: DetailExpansions, frame: string, kept: number | null, viewportH: number): number | null {
  return held[frame] ? expandedDetailHeight(viewportH) : kept
}

// ------------------------------------------------------------------------------------------------------------------- the keys

/** What a ⌥⌘ key shows or hides (manual §10.1, §10.8, Live 12's View menu): ⌥⌘B or ⌥⌘5 the browser, ⌥⌘6 the pool, ⌥⌘8 the widget
 * rail, ⌥⌘3 Clip view, ⌥⌘4 Device view, ⌥⌘L both, ⌥⌘9 Pane view, ⌥⌘M the mixer, ⌥⌘I its In/Out section, ⌥⌘S the sends, ⌥⌘R the
 * return tracks (Live's: the rail's key is ⌥⌘8 so that ⌥⌘R stays Live's). Read by the physical key as well as the character:
 * with ⌥ held, macOS gives the character the key makes under Option (⌥B is "∫", ⌥L is "¬", ⌥5 is "∞"), so the letter alone would
 * miss on the Mac. Pure. */
export type FrameToggle = 'browser' | 'pool' | 'rail' | 'clip' | 'device' | 'detail' | 'pane' | 'mixer' | 'io' | 'sends' | 'returns'
const FRAME_TOGGLES: ReadonlyArray<readonly [FrameToggle, readonly string[], readonly string[]]> = [
  ['browser', ['KeyB', 'Digit5'], ['b', '∫', '5', '∞']],
  ['pool', ['Digit6'], ['6', '§']],
  ['rail', ['Digit8'], ['8', '•']],
  ['clip', ['Digit3'], ['3', '£']],
  ['device', ['Digit4'], ['4', '¢']],
  ['detail', ['KeyL'], ['l', '¬']],
  ['pane', ['Digit9'], ['9', 'ª']],
  ['mixer', ['KeyM'], ['m', 'µ']],
  ['io', ['KeyI'], ['i', 'ˆ']],
  ['sends', ['KeyS'], ['s', 'ß']],
  ['returns', ['KeyR'], ['r', '®']],
]
export function frameToggleOf(event: {readonly key: string; readonly code?: string; readonly metaKey: boolean; readonly altKey: boolean;
  readonly ctrlKey?: boolean; readonly shiftKey?: boolean}): FrameToggle | null {
  if (!event.metaKey || !event.altKey || event.shiftKey || event.ctrlKey) return null
  const key = event.key.toLowerCase()
  const byCode = event.code ? FRAME_TOGGLES.find(([, codes]) => codes.includes(event.code!)) : undefined
  return (byCode ?? FRAME_TOGGLES.find(([, , keys]) => keys.includes(key)))?.[0] ?? null
}

/** Where ⌥ and a digit moves the focus (Live 12's Move Focus keys, manual §10.2): ⌥0 the transport, ⌥1 Session view, ⌥2
 * Arrangement view, ⌥3 Clip view, ⌥4 Device view, ⌥5 the browser, ⌥6 the pool, ⌥9 Pane view. Option alone with the digit's key;
 * macOS gives ⌥1 as "¡", so the physical key is read. Pure. */
export type FocusTarget = 'transport' | 'session' | 'arrangement' | 'clip' | 'device' | 'browser' | 'pool' | 'pane'
const FOCUS_KEYS: Readonly<Record<string, FocusTarget>> = {
  Digit0: 'transport', Digit1: 'session', Digit2: 'arrangement', Digit3: 'clip', Digit4: 'device', Digit5: 'browser', Digit6: 'pool', Digit9: 'pane',
}
export function focusKeyOf(event: {readonly code?: string; readonly metaKey: boolean; readonly altKey: boolean; readonly ctrlKey?: boolean;
  readonly shiftKey?: boolean}): FocusTarget | null {
  if (!event.altKey || event.metaKey || event.ctrlKey || event.shiftKey || !event.code) return null
  return FOCUS_KEYS[event.code] ?? null
}

/** ⇧Tab switches the detail area between Clip view and Device view (Live's Shift-Tab; the documentation lane, 16 Oct). Pure. */
export function switchesDetailSide(event: {readonly key: string; readonly shiftKey: boolean; readonly metaKey: boolean; readonly altKey: boolean;
  readonly ctrlKey: boolean}): boolean {
  return event.key === 'Tab' && event.shiftKey && !event.metaKey && !event.altKey && !event.ctrlKey
}
