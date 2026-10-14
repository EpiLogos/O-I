// Presenting the one live Expressions frame over a pane's placeholder (T-EXPRESSIONS-PANE-LEASE, placement leg).
//
// The frame's container (`.expressions-application`, panels/expressions.tsx) is never re-parented and never remounted: its
// element identity, its iframe and the iframe's `src` stay as they are. Presenting it in a pane only sets the container's own
// position: `position: fixed` over the pane's slot rectangle, clipped by every scrolling ancestor of that slot, kept in step by
// an animation-frame follower plus ResizeObserver, resize and scroll. Releasing it removes exactly the properties it set, so the
// container returns to its own place and its own hidden or visible state.
//
// The functions take element-shaped values (a `style` record and rectangles), so the placement rules are testable without a
// DOM; `followFrame` is the one browser-bound function and it only reads geometry and writes the container's style.

export interface FrameRect {left: number; top: number; width: number; height: number}

/** The style properties the placement sets. Only these are ever written or cleared on the container. */
export const PLACED_STYLE_KEYS = ['position', 'left', 'top', 'width', 'height', 'zIndex', 'pointerEvents', 'display'] as const

/** The style the placement writes: the element's style declaration, or a record of the same keys (tests). */
export type PlacedStyle = Record<(typeof PLACED_STYLE_KEYS)[number], string>

/** The overlay's stacking: above the Factory tree's panes, below its popovers (which sit higher). */
export const PLACED_Z_INDEX = '20'

/** The intersection of two rectangles, or null when they do not overlap (or either has no area). */
export function intersectRect(a: FrameRect, b: FrameRect): FrameRect | null {
  const left = Math.max(a.left, b.left)
  const top = Math.max(a.top, b.top)
  const right = Math.min(a.left + a.width, b.left + b.width)
  const bottom = Math.min(a.top + a.height, b.top + b.height)
  if (right - left <= 0 || bottom - top <= 0) return null
  return {left, top, width: right - left, height: bottom - top}
}

/** Two rectangles name the same place. */
export function sameRect(a: FrameRect | null, b: FrameRect | null): boolean {
  if (!a || !b) return a === b
  return a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height
}

/** The container's placement for a slot rectangle, or hidden when the slot is clipped away entirely (display none keeps the
 * iframe alive: the same concealment every hidden resident uses). */
export function placeFrame(frame: {style: PlacedStyle}, rect: FrameRect | null): void {
  if (!rect) {
    frame.style.position = 'fixed'
    frame.style.display = 'none'
    return
  }
  frame.style.position = 'fixed'
  frame.style.left = `${rect.left}px`
  frame.style.top = `${rect.top}px`
  frame.style.width = `${rect.width}px`
  frame.style.height = `${rect.height}px`
  frame.style.zIndex = PLACED_Z_INDEX
  frame.style.pointerEvents = 'auto'
  frame.style.display = 'block'
}

/** Clear exactly the properties the placement set: the container has no inline style of its own, so this restores it. */
export function releaseFrame(frame: {style: PlacedStyle}): void {
  for (const key of PLACED_STYLE_KEYS) frame.style[key] = ''
}

/** The slot's rectangle in the viewport, clipped by every ancestor that clips its overflow and by the viewport itself. Null when
 * nothing of the slot is visible. */
export function visibleSlotRect(slot: HTMLElement, view: Window = window): FrameRect | null {
  const box = slot.getBoundingClientRect()
  let rect: FrameRect | null = {left: box.left, top: box.top, width: box.width, height: box.height}
  for (let el = slot.parentElement; el && rect; el = el.parentElement) {
    const style = view.getComputedStyle(el)
    if (style.overflowX === 'visible' && style.overflowY === 'visible') continue
    const clip = el.getBoundingClientRect()
    rect = intersectRect(rect, {left: clip.left, top: clip.top, width: clip.width, height: clip.height})
  }
  return rect && intersectRect(rect, {left: 0, top: 0, width: view.innerWidth, height: view.innerHeight})
}

/** Present `frame` over `slot` until the returned stop is called; the stop releases exactly what the placement set. */
export function followFrame(frame: HTMLElement, slot: HTMLElement): () => void {
  let live = true
  let last: FrameRect | null | undefined = undefined
  let frameRequest = 0
  const apply = () => {
    const rect = visibleSlotRect(slot)
    if (last === undefined || !sameRect(last, rect)) {
      last = rect
      placeFrame(frame, rect)
    }
  }
  const tick = () => {
    if (!live) return
    apply()
    frameRequest = requestAnimationFrame(tick)
  }
  // A geometry change the animation frame would also catch: resize, any scroll, the slot's own size. The re-read is immediate.
  const moved = () => {last = undefined; if (live) apply()}
  const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(moved)
  observer?.observe(slot)
  window.addEventListener('resize', moved)
  document.addEventListener('scroll', moved, true)
  apply()
  frameRequest = requestAnimationFrame(tick)
  return () => {
    live = false
    cancelAnimationFrame(frameRequest)
    observer?.disconnect()
    window.removeEventListener('resize', moved)
    document.removeEventListener('scroll', moved, true)
    releaseFrame(frame)
  }
}
