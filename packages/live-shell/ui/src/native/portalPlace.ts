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
import type {LayoutState, SurfaceBinding} from '../../../../../desktop/cradle/src/surface/types'

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
  // Every portal is answered (round 896, 0R-surface.8): where the Workbench opens nothing, the frame is told why.
  noWindowOwner: 'Re-dock returns a source from its own window, and the development browser has no window owner.',
  notPresented: 'The Workbench was not shown when the source reached it, so it did not open. Fire the trigger again.',
  noFile: 'The portal named no Central file the Workbench can open.',
  replaced: 'Another source was opened before the Workbench took this one, so this one did not open.',
} as const

/** The place a trigger's placement opens in. A placement the trigger does not name is the manual's default, Beside. */
export function portalPlacing(placement: unknown): PortalPlacing {
  if (placement === 'full' || placement === 'detached' || placement === 're_dock') return {place: placement}
  if (placement === 'preview') return {place: 'beside', note: PORTAL_WORDS.preview}
  if (placement === 'overlay') return {place: 'beside', note: PORTAL_WORDS.overlay}
  return {place: 'beside'}
}

/** The Workbench's side of a portal's place (native/Workbench.tsx): its pane tree, the work's pane, and its window doors. */
export interface PortalPlacer {
  layout(): LayoutState
  setLayout(change: (layout: LayoutState) => LayoutState): void
  /** The pane the one Expressions frame is drawn over, or null. */
  workPane(): string | null
  /** The detach door: the source in its own window. */
  detach(binding: SurfaceBinding): Promise<unknown>
  /** The window door: a source held in its own window returns; null where no window owner answers (the development browser). */
  redock: ((binding: SurfaceBinding) => Promise<unknown>) | null
}
/** A source a portal has just opened, placed where its placement says (round 895, OPEN 4; moved here from the Workbench in round 896,
 * 0R-surface.5, so it runs by behaviour): Beside and Full over the pane tree, Detached through the detach door, Re-dock through the window
 * door. Answers the words of what it could not honour as asked; throws the words of a Re-dock no window owner can make. */
export async function placeOpenedPortal(binding: SurfaceBinding, place: PortalPlace, away: boolean, ports: PortalPlacer): Promise<string | undefined> {
  if (place === 'detached') return ports.detach(binding).then(() => undefined, cause => `${PORTAL_WORDS.asTab}: ${cause instanceof Error ? cause.message : String(cause)}`)
  if (place === 're_dock') {
    if (!away) return PORTAL_WORDS.noWindow
    if (!ports.redock) throw Error(PORTAL_WORDS.noWindowOwner)
    await ports.redock(binding)
    return undefined
  }
  const placed = placePortalPane(ports.layout(), binding.id, place, ports.workPane())
  ports.setLayout(layout => placePortalPane(layout, binding.id, place, ports.workPane()).layout)
  return placed.note
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
