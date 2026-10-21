// Pane view in Expressions holds the field and the Studio side by side (manual §20.1): the field pane draws only the field, and the
// Studio's Full beside it holds every device of the field, your controls at its head. A tree that holds the field and has never held
// the Studio's pane — a fresh tree, Expressions' old one-pane seed, a book saved before the ruling — has the Studio opened beside the
// field, once. Its binding then stays in `surfaces` (a closed tab keeps its binding), so a Studio pane you close stays closed, and one
// you moved stays where you put it. Pure layout over the cradle engine.
import {groupsOf} from '../../../../../desktop/cradle/src/surface/engine'
import type {LayoutState} from '../../../../../desktop/cradle/src/surface/types'
import {openInstrumentAt} from '../frame/openInstrument'

/** The field's pane kind: the hosted frame (panels/expressions.tsx). */
export const FIELD_PANE_KIND = 'projection.expressions'
/** The pane that holds one device full (frame/devices/devicePane.tsx), and the Studio's id on the door (studioBinding.ts). */
const DEVICE_PANE_KIND = 'projection.device'
const STUDIO = {ref: 'expressions:studio', title: 'Studio'}

/** The layout with the Studio's pane opened beside the field, where the tree holds the field and has never held the Studio's pane;
 * the same layout otherwise. */
export function studioBesideField(layout: LayoutState): LayoutState {
  const held = Object.values(layout.surfaces).some(binding => binding.kind === DEVICE_PANE_KIND && binding.projection?.subject_ref === STUDIO.ref)
  if (held) return layout
  const field = groupsOf(layout.root).find(group => group.tabs.some(id => layout.surfaces[id]?.kind === FIELD_PANE_KIND))
  if (!field) return layout
  return openInstrumentAt(layout, DEVICE_PANE_KIND, {groupId: field.id, edge: 'right'}, STUDIO)
}
