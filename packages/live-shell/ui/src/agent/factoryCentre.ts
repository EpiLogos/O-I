/**
 * The Factory centre as a pane tree (owner ruling, DEVICE-SEMANTICS-LOCK §0.1 and §3: panes are a split tree with default
 * sets per mode). Factory opens on the mockup's tree (world-shell-mockup.html `modes.factory`: `tree:{d:'row',c:[0,1]}`, panes
 * `[sessions] | [thread]`): the one Session · Arrangement pane over the agent sessions on the left, the agent's thread on the
 * right. The Session and Arrangement are the shared tracks pane's (frame/tracks/TracksPane.tsx, one instrument in every mode,
 * FOUNDATION F3); the agent tab is the thread and only the thread. Other instrument panes split and tab beside them through the
 * same engine the other modes use (surface/engine.ts).
 *
 * Layout only: no React, no I/O. The agent tab is pinned, and the engine's `closeSurface` refuses a pinned surface, so the
 * agent surface cannot be closed. Its body is mounted by the Workbench's `agent-shell` arm, from the tree's conversation node
 * (native/Workbench.tsx passes AgentShellCentre).
 */
import {activeBindingId, closeSurface, groupOf, groupsOf, openBinding, openProjectionPane} from '../../../../../desktop/cradle/src/surface/engine'
import type {LayoutState, Pane, SurfaceBinding, TabGroupPane} from '../../../../../desktop/cradle/src/surface/types'
import {openInstrumentAt} from '../frame/openInstrument'

/** The agent surface's binding kind. The engine's SurfaceBody renders it from the tree's conversation node. */
export const AGENT_SHELL_KIND = 'agent-shell'
/** The one agent tab id: a stable identity, so the seed is idempotent and the tab restores with the book. */
export const AGENT_SHELL_ID = 'factory-agent-shell'
/** The agent tab's title: the mockup's `thread` aperture (its conversation and tool log), which is all the tab holds. */
export const AGENT_TAB_TITLE = 'Thread'
/** The shared Session · Arrangement pane's kind: the one tracks pane, in every mode. */
export const FACTORY_TRACKS_KIND = 'projection.timeline'
/** The seeded tracks pane's tab, in Factory's words: the mockup's `sessions` aperture ("Tracks are sessions, clips are tasks"). */
export const FACTORY_TRACKS_TITLE = 'Sessions'

const isPlaced = (layout: LayoutState, id: string): boolean => groupsOf(layout.root).some(group => group.tabs.includes(id))

/** The agent surface's binding (a fixed id; its body is the tree's conversation node). */
export function factoryAgentBinding(): SurfaceBinding {
  return {id: AGENT_SHELL_ID, kind: AGENT_SHELL_KIND, title: AGENT_TAB_TITLE}
}

/** Map every tab group of a pane tree, keeping the split structure. */
function mapGroups(pane: Pane | null, change: (group: TabGroupPane) => TabGroupPane): Pane | null {
  if (!pane) return null
  if (pane.type === 'group') return change(pane)
  return {...pane, children: pane.children.map(child => mapGroups(child, change) as Pane)}
}

/** Pin one placed surface in its group. Pinned surfaces refuse close until unpinned (engine closeSurface). */
export function pinSurface(state: LayoutState, id: string): LayoutState {
  return {...state, root: mapGroups(state.root, group => group.tabs.includes(id) && !group.pinned.includes(id) ? {...group, pinned: [...group.pinned, id]} : group)}
}

/** Whether a tracks pane (any subject) stands in the tree: a placed tab of the tracks kind. */
export function hasFactoryTracks(layout: LayoutState): boolean {
  return groupsOf(layout.root).some(group => group.tabs.some(id => layout.surfaces[id]?.kind === FACTORY_TRACKS_KIND))
}

/** Whether this tree has ever held a tracks pane: `surfaces` keeps every binding the tree opened, closed ones included. */
const heldTracks = (layout: LayoutState): boolean => Object.values(layout.surfaces).some(binding => binding.kind === FACTORY_TRACKS_KIND)

/** The agent tab's title is the shell's, not the book's: a book saved when the tab read "Agents" is renamed to what it holds. */
function titled(layout: LayoutState): LayoutState {
  const held = layout.surfaces[AGENT_SHELL_ID]
  return held && held.title !== AGENT_TAB_TITLE ? {...layout, surfaces: {...layout.surfaces, [AGENT_SHELL_ID]: {...held, title: AGENT_TAB_TITLE}}} : layout
}

/** What a book already standing keeps when a pane is added beside its agent tab: where focus was and what was maximised. */
const keepingFocus = (from: LayoutState, to: LayoutState): LayoutState => ({
  ...to,
  focusedGroupId: from.focusedGroupId,
  ...(from.focusedTabId !== undefined ? {focusedTabId: from.focusedTabId} : {}),
  ...(from.maximizedGroupId !== undefined ? {maximizedGroupId: from.maximizedGroupId} : {}),
})

/**
 * Seed the Factory tree with the mockup's default set, in two independent steps. Idempotent: each step reads the tree and
 * does nothing when its pane is already there.
 *
 * 1. The agent tab, pinned, if none is placed (a tree with other tabs gains it beside the focused tab; an empty one is filled).
 * 2. The shared Session · Arrangement pane, at the left edge of the agent tab's pane, if this tree has never held one. The rule
 *    reads `surfaces`, the record of every binding the tree ever opened: a tree whose bindings hold no tracks pane has never
 *    had one, so the pane is added once; a tree that placed one keeps it where it was put; and a tree whose user closed it
 *    (the binding stays in `surfaces`, on the closed stack) is not given it back — closing a pane is an act the seed respects,
 *    and Reopen closed (or the browser's Instruments) brings it back. A book saved before the pane existed — the agent tab
 *    alone — gains it on its first open, and keeps its own arrangement, focus and maximised pane.
 *
 * A fresh tree opens with the Session pane focused (the mockup's `focus:0`), so Tab and the Session · Arrangement switch act on
 * it at once.
 */
export function seedFactoryCentre(layout: LayoutState): LayoutState {
  const fresh = !isPlaced(layout, AGENT_SHELL_ID)
  const stood = fresh ? pinSurface(openBinding(layout, factoryAgentBinding()), AGENT_SHELL_ID) : titled(layout)
  if (heldTracks(stood)) return stood
  const home = groupOf(stood, AGENT_SHELL_ID)
  if (!home) return stood
  const opened = openInstrumentAt(stood, FACTORY_TRACKS_KIND, {groupId: home.id, edge: 'left'})
  const added = Object.values(opened.surfaces).find(binding => binding.kind === FACTORY_TRACKS_KIND)
  const beside = added ? {...opened, surfaces: {...opened.surfaces, [added.id]: {...added, title: FACTORY_TRACKS_TITLE}}} : opened
  return fresh ? beside : keepingFocus(stood, beside)
}

/** Whether the agent tab is placed in this layout. */
export function hasFactoryCentre(layout: LayoutState): boolean {
  return isPlaced(layout, AGENT_SHELL_ID)
}

/** Open (or reactivate) an instrument pane beside the agent tab, through the engine's projection door. */
export function openFactoryInstrumentPane(layout: LayoutState, kind: 'projection.earth' | 'projection.constellation' | 'projection.timeline' | 'projection.expressions'): LayoutState {
  return openProjectionPane(layout, kind)
}

/** The focused tab's binding kind in a layout, or undefined when no tab is focused. */
export function focusedSurfaceKind(layout: LayoutState): string | undefined {
  const id = layout.focusedTabId ?? activeBindingId(layout)
  return id ? layout.surfaces[id]?.kind : undefined
}

/** The close guard as a pure reading: whether the engine would close the surface. */
export function agentTabClosable(layout: LayoutState): boolean {
  return closeSurface(layout, AGENT_SHELL_ID) !== layout
}

/** Whether a frame mode is Factory, read through a call: the aliased `agentShell` condition then narrows nothing in the frame. */
export function isFactoryMode(mode: string): boolean {
  return mode === 'factory'
}
