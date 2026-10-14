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
