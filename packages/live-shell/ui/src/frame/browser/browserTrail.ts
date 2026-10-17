// The browser's own back and forward (the mockup's ‹ › cells beside the search; Live's browser walks back through the
// places it showed). The trail is the categories the browser has shown, in order: showing a new one keeps the one before
// on the back stack and clears forward; walking moves one step and keeps where it came from on the other stack. Pure
// TypeScript; the browser holds one trail and draws the cells enabled only when a step exists.

export interface BrowserTrail {
  readonly back: readonly string[]
  readonly forward: readonly string[]
  /** The category shown now, as `categoryKey` spells it; null before the first is shown. */
  readonly at: string | null
}

export const EMPTY_TRAIL: BrowserTrail = {back: [], forward: [], at: null}

/** The browser now shows `key`. Showing the same category again changes nothing. */
export function visitCategory(trail: BrowserTrail, key: string | null): BrowserTrail {
  if (key === trail.at) return trail
  if (trail.at === null) return {...trail, at: key}
  return {back: [...trail.back, trail.at], forward: [], at: key}
}

/** One step back or forward: the trail after the step and the category to show, or null when there is no step. */
export function walkTrail(trail: BrowserTrail, direction: 'back' | 'forward'): {trail: BrowserTrail; show: string} | null {
  const from = direction === 'back' ? trail.back : trail.forward
  const show = from[from.length - 1]
  if (show === undefined) return null
  const rest = from.slice(0, -1)
  const kept = trail.at === null ? [] : [trail.at]
  return direction === 'back'
    ? {trail: {back: rest, forward: [...trail.forward, ...kept], at: show}, show}
    : {trail: {back: [...trail.back, ...kept], forward: rest, at: show}, show}
}
