/**
 * Where a scene's portal opens (O-I #747 round 895, OPEN 4; DLW build ruling 2026-11-08: honoured, or said in words). The manual's
 * Launch panel (DLW.md §20.1): "| Portal placement | Preview · Overlay · Beside · Full · Detached · Re-dock | Beside | Where a portal
 * opens. |". The trigger's placement is re-read from the native authored Scene (desktop/cradle scenePortal.ts resolveScenePortal).
 *
 *   Beside   — its own pane on the right edge of the pane the work stands in (the pane engine's dropOnEdge).
 *   Full     — its pane fills the main area (the pane engine's maximize mask, as the pane's own Maximize).
 *   Detached — its own window, through the Workbench's own detach door (Workbench.tsx detach).
 *   Re-dock  — a source held in its own window returns through the window door.
 *   Preview, Overlay — the shell draws nothing over the Scene: they open beside the work, and say so.
 */
import {dropOnEdge, groupOf} from '../../../../../desktop/cradle/src/surface/engine'
import type {LayoutState} from '../../../../../desktop/cradle/src/surface/types'

export type PortalPlace = 'beside' | 'full' | 'detached' | 're_dock'
export interface PortalPlacing {place: PortalPlace; note?: string}

/** The words a placement the shell cannot honour as asked is said in; each reads after the trigger's own words ("Dawn enters → a
 * portal beside: …", the frame's Info line). */
export const PORTAL_WORDS = {
  preview: 'the shell draws no preview over the Scene, so it opened beside the work.',
  overlay: 'the shell draws no overlay over the Scene, so it opened beside the work.',
  noWorkPane: 'the work stands in no pane here, so it opened as a tab.',
  asTab: 'it opened as a tab',
  noWindow: 'no window of its own holds this source, so it opened as a tab.',
  ownWindow: 'it stands in its own window already.',
  knowledge: 'a knowledge page opens as a tab of the Workbench, whatever the portal\'s placement.',
} as const

/** The place a trigger's placement opens in. A placement the trigger does not name is the manual's default, Beside. */
export function portalPlacing(placement: unknown): PortalPlacing {
  if (placement === 'full' || placement === 'detached' || placement === 're_dock') return {place: placement}
  if (placement === 'preview') return {place: 'beside', note: PORTAL_WORDS.preview}
  if (placement === 'overlay') return {place: 'beside', note: PORTAL_WORDS.overlay}
  return {place: 'beside'}
}

/** Beside and Full, over the pane tree: the opened source `id` stands in its own pane on the right edge of the work's pane
 * (`workPane`, the pane the one Expressions frame is drawn over), or its pane fills the main area. The work in no pane of this
 * layout: the source stays the tab it opened as, and the words say so. Detached and Re-dock are the window door's; they leave the
 * tree as it is here. */
export function placePortalPane(layout: LayoutState, id: string, place: PortalPlace, workPane: string | null): {layout: LayoutState; note?: string} {
  if (place === 'full') {
    const group = groupOf(layout, id)
    return group ? {layout: {...layout, focusedGroupId: group.id, maximizedGroupId: group.id}} : {layout}
  }
  if (place !== 'beside') return {layout}
  const pane = workPane ? groupOf(layout, workPane) : undefined
  if (!pane) return {layout, note: PORTAL_WORDS.noWorkPane}
  const placed = dropOnEdge(layout, id, pane.id, 'right')
  const left = groupOf(placed, workPane!)
  // The source left the work's pane: the work is that pane's shown tab again.
  return {layout: left && left.active !== workPane ? {...placed, root: mapActive(placed.root, left.id, workPane!)} : placed}
}

function mapActive(pane: LayoutState['root'], groupId: string, active: string): LayoutState['root'] {
  if (!pane) return pane
  if (pane.type === 'group') return pane.id === groupId ? {...pane, active} : pane
  return {...pane, children: pane.children.map(child => mapActive(child, groupId, active)!)}
}
