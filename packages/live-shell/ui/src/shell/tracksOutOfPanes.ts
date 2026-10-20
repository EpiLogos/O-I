// No pane holds Session view or Arrangement view (manual §10.2, §16.1): they are the mode's own two views of its set, drawn in
// the main area (shell/mainView.ts). A tree that still places the old tracks pane (`projection.timeline`) — a seed laid before
// the ruling, a book saved with one — has it closed. Its binding stays in `surfaces`, so a seed that adds the tracks pane only to
// a tree that never held one (agent/factoryCentre.ts) never lays it again; it leaves the reopen stack, so Reopen closed does not
// bring it back. Pure layout over the cradle engine; a tree with no tracks pane is returned as it was.
import {closeSurface, groupsOf, isPinned, togglePin} from '../../../../../desktop/cradle/src/surface/engine'
import type {LayoutState} from '../../../../../desktop/cradle/src/surface/types'

/** The old tracks pane's kind: the set's views, which now stand in the main area, never in a pane. */
export const TRACKS_PANE_KIND = 'projection.timeline'

/** The layout with every placed tracks pane closed; the same layout when none is placed. */
export function tracksOutOfPanes(layout: LayoutState): LayoutState {
  const placed = groupsOf(layout.root).flatMap(group => group.tabs).filter(id => layout.surfaces[id]?.kind === TRACKS_PANE_KIND)
  if (!placed.length) return layout
  let next = layout
  for (const id of placed) next = closeSurface(isPinned(next, id) ? togglePin(next, id) : next, id)
  return {...next, closedStack: next.closedStack.filter(id => next.surfaces[id]?.kind !== TRACKS_PANE_KIND)}
}

/** A mode's seed with the tracks pane kept out, before and after it runs: the seed never sees one, and never leaves one. */
export function seedWithoutTracksPane(seed: (layout: LayoutState) => LayoutState): (layout: LayoutState) => LayoutState {
  return layout => tracksOutOfPanes(seed(tracksOutOfPanes(layout)))
}
