// A device's own window, as boxes (manual §16.3 Pop-out: "Its own window, which can fill the screen"). Where a window opens, how a
// drag by its bar moves it and a drag by its corner sizes it, and how it stays inside the shell's window as that changes. Ported
// from the native host's own window rules (desktop/cradle/src-tauri/src/windows.rs window_detach: a window's least size is
// 400 × 300; a window restored onto a monitor keeps its title area on a screen) and the gallery's window (inhabitants/catalogue/
// main.tsx DesignedViews `popout`: 1180 wide, a 26 px bar over a 620 px room). Pure.
import type {DeviceWindowBox} from './deviceDoor'

/** The least a window may be sized to (windows.rs `min_inner_size(400.0, 300.0)`). */
export const WINDOW_MIN_W = 400
export const WINDOW_MIN_H = 300
/** The window's bar (catalogue.css `.cat-window-bar`). */
export const WINDOW_BAR_H = 26
/** The window as the gallery draws it: 1180 wide, the bar over a 620 px room. */
export const WINDOW_W = 1180
export const WINDOW_H = WINDOW_BAR_H + 620
/** What of the bar stays inside the shell's window, however the window is dragged: enough to take it again. */
export const WINDOW_GRIP = 80
/** Each window opened while others stand steps down and right by this much, so none hides another's bar. */
export const WINDOW_CASCADE = 24
/** The margin a new window keeps from the shell's edges. */
const MARGIN = 24

const clamp = (value: number, low: number, high: number): number => Math.max(low, Math.min(high, value))

/** Where the `index`th window opens in a shell `viewport` wide and high: the gallery's size where it fits, centred across and near
 * the top, each later one a step further down and right. */
export function openedWindowBox(index: number, viewport: readonly [number, number]): DeviceWindowBox {
  const [vw, vh] = viewport
  const w = Math.max(WINDOW_MIN_W, Math.min(WINDOW_W, vw - 2 * MARGIN))
  const h = Math.max(WINDOW_MIN_H, Math.min(WINDOW_H, vh - 3 * MARGIN))
  const step = (index % 8) * WINDOW_CASCADE
  return heldInView({x: Math.round((vw - w) / 2) + step, y: MARGIN + step, w, h}, viewport)
}

/** A box kept where its bar can be taken: never above the shell's top, its grip inside the left and right edges, its bar above the
 * bottom. The size is the one chosen. */
export function heldInView(box: DeviceWindowBox, viewport: readonly [number, number]): DeviceWindowBox {
  const [vw, vh] = viewport
  const x = clamp(box.x, WINDOW_GRIP - box.w, Math.max(0, vw - WINDOW_GRIP))
  const y = clamp(box.y, 0, Math.max(0, vh - WINDOW_BAR_H))
  return x === box.x && y === box.y ? box : {...box, x, y}
}

/** A window under the hand: the box and the pointer where the drag began. */
export interface WindowDrag {readonly box: DeviceWindowBox; readonly at: readonly [number, number]}

/** Dragged by its bar: the window moves with the pointer from where it was taken, its bar kept where it can be taken again. */
export function movedWindowBox(drag: WindowDrag, pointer: readonly [number, number], viewport: readonly [number, number]): DeviceWindowBox {
  return heldInView({...drag.box, x: drag.box.x + pointer[0] - drag.at[0], y: drag.box.y + pointer[1] - drag.at[1]}, viewport)
}

/** Dragged by its corner: the window sizes with the pointer from where it was taken, never below its least size nor past the
 * shell's right and bottom edges. */
export function sizedWindowBox(drag: WindowDrag, pointer: readonly [number, number], viewport: readonly [number, number]): DeviceWindowBox {
  const [vw, vh] = viewport
  const w = clamp(drag.box.w + pointer[0] - drag.at[0], WINDOW_MIN_W, Math.max(WINDOW_MIN_W, vw - drag.box.x))
  const h = clamp(drag.box.h + pointer[1] - drag.at[1], WINDOW_MIN_H, Math.max(WINDOW_MIN_H, vh - drag.box.y))
  return {...drag.box, w: Math.round(w), h: Math.round(h)}
}

/** The room a window gives its device: the window less its bar, at 100 % (design.ts ViewProps.room). */
export function windowRoom(box: {readonly w: number; readonly h: number}): {w: number; h: number} {
  return {w: Math.max(0, Math.round(box.w)), h: Math.max(0, Math.round(box.h - WINDOW_BAR_H))}
}
