// The tracks the Session · Arrangement pane draws, published for the parts that show the same material (the clip box): the
// mode's tracks hook runs once, in the pane, never a second reader of the same owner (R2 objection 1). Pure TypeScript.
import {useSyncExternalStore} from 'react'
import type {WorldTrackSet} from '../../timeline/worldTrackAdapter'

let shown: WorldTrackSet | null = null
const listeners = new Set<() => void>()

/** The tracks pane publishes the set it draws (null when it has none or leaves). */
export function publishShownTracks(next: WorldTrackSet | null): void {
  if (shown === next) return
  shown = next
  for (const listener of listeners) listener()
}

const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }
export function useShownTracks(): WorldTrackSet | null {
  return useSyncExternalStore(subscribe, () => shown, () => shown)
}

/** The stretch the Arrangement's ruler selects (shift-click from the insert marker), with the set it was drawn on: its ruler's units
 * are that set's. The ruler keeps the stretch as its own presentation and publishes it here, so a command that acts on "the range you
 * select" (manual §10.9) reads it at its press — File › Export Song… renders the units that ran in it (agent/songClips.ts unitsInSpan). */
export interface ShownSpan {readonly set: WorldTrackSet; readonly range: {readonly start: number; readonly end: number}}
let span: ShownSpan | null = null
/** The ruler publishes its stretch (null when none is selected, or the ruler leaves). */
export function publishShownSpan(next: ShownSpan | null): void { span = next }
/** The stretch selected now, read at a command's press. */
export function shownSpanNow(): ShownSpan | null { return span }
