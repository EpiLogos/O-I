// The one application body's book binding (kind `expressions`): the checkpoint the hosted engine keeps its work on
// (panels/expressions.tsx engineCheckpoint) and the key native input is retained under (components/NativeInputRetention.tsx).
//
// In the candidate the binding is HELD — in a layout's surfaces, on no tab — because the frame stands over a
// `projection.expressions` pane (projections/expressionsPaneHost.ts). Placed, it was a second, empty "Expressions" pane: the
// panel opened it into whichever tree stood in front once the owner answered (seen 15 Oct, headless: a tab joined Technē's
// Earth 20–140 s after entering Technē; native: an Expressions pane in Technē and in Live), and moved it into the tree in front
// on every mode switch. A binding an older book placed is still found, and taken off its tab when its tree stands in front.
import {closeSurface, groupsOf} from '../../../../../desktop/cradle/src/surface/engine'
import type {LayoutState, SurfaceBinding} from '../../../../../desktop/cradle/src/surface/types'
import type {Workspace} from '../../../../../desktop/cradle/src/workspace/store'

export const EXPRESSIONS_BINDING_KIND = 'expressions'

const placedIds = (layout: LayoutState): string[] =>
  [...groupsOf(layout.root).flatMap(group => group.tabs), ...(layout.sidePane?.tabs ?? []), ...(layout.detached ?? []).map(row => row.surfaceId)]

/** Where the binding stands: on a tab (an older book) or held on none. Closed bindings remain recoverable, but never stand in for
 * an open host. Placed bindings are found first, so a book that holds both keeps the one its native input was retained under. */
export function expressionsBindingOf(owner: Workspace): {binding: SurfaceBinding; placed: boolean; layout: LayoutState} | undefined {
  const layouts = [owner.layout, ...Object.values(owner.modeLayouts ?? {})]
  for (const layout of layouts) for (const id of placedIds(layout)) {
    const binding = layout.surfaces[id]
    if (binding?.kind === EXPRESSIONS_BINDING_KIND) return {binding, placed: true, layout}
  }
  for (const layout of layouts) for (const binding of Object.values(layout.surfaces)) {
    if (binding.kind === EXPRESSIONS_BINDING_KIND && !layout.closedStack.includes(binding.id)) return {binding, placed: false, layout}
  }
}

/** Hold a new binding: it joins the layout's surfaces and no tab. */
export function holdExpressionsBinding(layout: LayoutState, binding: SurfaceBinding): LayoutState {
  return {...layout, surfaces: {...layout.surfaces, [binding.id]: binding}}
}

/** Take a placed binding off its tab and keep it held: the engine's own close, without the re-open stack (a held binding is not a
 * closed one). A pinned tab stays where its owner pinned it. */
export function unplaceExpressionsBinding(layout: LayoutState, id: string): LayoutState {
  const closed = closeSurface(layout, id)
  if (closed === layout) return layout
  return {...closed, closedStack: closed.closedStack.filter(held => held !== id), surfaces: {...closed.surfaces, [id]: layout.surfaces[id]}}
}
