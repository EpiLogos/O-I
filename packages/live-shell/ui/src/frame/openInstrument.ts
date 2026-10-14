// Where an instrument opens (FOUNDATION F2, manual §10.2): "To open an instrument, drag it from the browser into a pane.
// You can also click it, and it opens in the pane that has focus. … To make a new split, drag a tab onto the edge of a
// pane." Pure layout over the cradle engine: an instrument is a projection binding, one per kind and subject, so opening
// one that is already placed moves it where it was asked for rather than making a second.
import {dropOnEdge, focusGroup, groupOf, makeProjectionBinding, moveTab, openBinding} from '../../../../../desktop/cradle/src/surface/engine'
import {isProjectionPaneKind, type LayoutState, type PaneEdge} from '../../../../../desktop/cradle/src/surface/types'

export function openInstrumentAt(layout: LayoutState, kind: string, at?: {groupId: string; edge: PaneEdge | null}, subject?: {ref: string; title: string}): LayoutState {
  if (!isProjectionPaneKind(kind)) return layout
  const binding = makeProjectionBinding(layout, kind, subject ? {subject_ref: subject.ref, subject_title: subject.title} : {})
  if (at?.edge) return dropOnEdge({...layout, surfaces: {...layout.surfaces, [binding.id]: layout.surfaces[binding.id] ?? binding}}, binding.id, at.groupId, at.edge)
  const placed = groupOf(layout, binding.id)
  if (at && placed && placed.id !== at.groupId) return moveTab(layout, binding.id, at.groupId)
  return openBinding(at ? focusGroup(layout, at.groupId) : layout, binding)
}

/** A seed for a mode's first tree: the first instrument fills the tree, each next one opens beside it. Does nothing to a
 * tree that already holds a tab, so a mode's own arrangement is never replaced. */
export function seedInstruments(kinds: readonly string[]): (layout: LayoutState) => LayoutState {
  return layout => {
    if (Object.keys(layout.surfaces).some(id => groupOf(layout, id))) return layout
    let next = layout
    for (const [index, kind] of kinds.entries()) {
      const first = next.focusedGroupId
      next = index === 0 || !first ? openInstrumentAt(next, kind) : openInstrumentAt(next, kind, {groupId: first, edge: 'right'})
    }
    return next
  }
}
