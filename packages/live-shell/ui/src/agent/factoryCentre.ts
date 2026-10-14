/**
 * The Factory centre as a pane tree (owner ruling, DEVICE-SEMANTICS-LOCK §0.1
 * and §3: panes are a split tree with default sets per mode). The agent
 * surface is the Factory tree's default tab; instrument panes split and tab
 * beside it through the same engine the other modes use (surface/engine.ts).
 *
 * Layout only: no React, no I/O. The agent tab is pinned, and the engine's
 * `closeSurface` refuses a pinned surface, so the agent surface cannot be
 * closed. Its body is mounted by the Workbench's `agent-shell` arm, from the
 * tree's conversation node (native/Workbench.tsx passes AgentShellCentre).
 */
import {activeBindingId, closeSurface, groupsOf, openBinding, openProjectionPane} from '../../../../../desktop/cradle/src/surface/engine'
import type {LayoutState, Pane, SurfaceBinding, TabGroupPane} from '../../../../../desktop/cradle/src/surface/types'

/** The agent surface's binding kind. The engine's SurfaceBody renders it from the tree's conversation node. */
export const AGENT_SHELL_KIND = 'agent-shell'
/** The one agent tab id: a stable identity, so the seed is idempotent and the tab restores with the book. */
export const AGENT_SHELL_ID = 'factory-agent-shell'

const isPlaced = (layout: LayoutState, id: string): boolean => groupsOf(layout.root).some(group => group.tabs.includes(id))

/** The agent surface's binding (a fixed id; its body is the tree's conversation node). */
export function factoryAgentBinding(): SurfaceBinding {
  return {id: AGENT_SHELL_ID, kind: AGENT_SHELL_KIND, title: 'Agents'}
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

/** Seed the Factory tree with its default agent tab, pinned, if no agent tab is placed yet. Idempotent. */
export function seedFactoryCentre(layout: LayoutState): LayoutState {
  if (isPlaced(layout, AGENT_SHELL_ID)) return layout
  const opened = openBinding(layout, factoryAgentBinding())
  return pinSurface(opened, AGENT_SHELL_ID)
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
