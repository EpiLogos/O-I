/** Pure presentation selection. Every active tree is visible; only hidden
 * document trees consume the retention budget. No source or native owner data
 * is cloned or reacquired here. Drafts retain their live editor session too. */
import {groupsOf} from "./engine";
import {RETAINED_VIEW_BUDGET} from "./runtime";
import type {LayoutState, SurfaceId} from "./types";
import {TREE_MODES, type WorkspaceMode} from "../workspace/mode";
import type {Workspace} from "../workspace/store";

export const RETAINED_PANE_KINDS = new Set(["draft", "file", "source", "knowledge", "encounter", "terminal", "browser", "presentation", "explore"]);
export const isRetainedPaneKind = (kind: string) => RETAINED_PANE_KINDS.has(kind);

export interface WarmTreeRef { key: string; workspaceId: string; layout: LayoutState; presented: boolean }

/** How many recently-left workspaces keep their trees warm. */
export const WARM_WORKSPACES = 2;

function treeBindingIds(layout: LayoutState): SurfaceId[] {
  return groupsOf(layout.root).flatMap((group) => group.tabs);
}

/** The warm trees of the shell. Keys name the tree's own mode, so a key is
 * stable across the swap that presents or shelves its tree — the React
 * subtree (and every document and editor session inside it) survives. */
export function warmWorkspaceTrees(workspaces: Workspace[], activeWorkspaceId: string, activeMode: WorkspaceMode): WarmTreeRef[] {
  const active = workspaces.find((workspace) => workspace.id === activeWorkspaceId);
  if (!active) return [];
  const warm = workspaces
    .filter((workspace) => workspace.id !== activeWorkspaceId && (workspace.lastVisitedAt ?? 0) > 0)
    .sort((a, b) => (b.lastVisitedAt ?? 0) - (a.lastVisitedAt ?? 0))
    .slice(0, WARM_WORKSPACES);
  const trees: WarmTreeRef[] = [];
  const seen = new Set<string>();
  let budget = RETAINED_VIEW_BUDGET;
  const addTree = (workspace: Workspace, layout: LayoutState) => {
    const treeMode = layout.mode ?? "base";
    const key = `${workspace.id}:${treeMode}`;
    if (seen.has(key)) return;
    const retained = treeBindingIds(layout).filter((id) => {
      const binding = layout.surfaces[id];
      return !!binding && isRetainedPaneKind(binding.kind) && !binding.pending;
    });
    // Retention is a budget for HIDDEN trees, never admission to the visible
    // workspace. New tabs, drafts and empty split destinations must render
    // even without a retained kind; a large active tree must not disappear.
    const presented = workspace.id === activeWorkspaceId && treeMode === activeMode;
    if (!layout.root || (!presented && (!retained.length || retained.length > budget))) return;
    if (!presented) budget -= retained.length;
    seen.add(key);
    trees.push({ key, workspaceId: workspace.id, layout, presented });
  };
  addTree(active, active.layout);
  for (const mode of TREE_MODES) {
    const layout = active.modeLayouts?.[mode];
    if (layout) addTree(active, layout);
  }
  for (const workspace of warm) {
    addTree(workspace, workspace.layout);
    for (const mode of TREE_MODES) {
      const layout = workspace.modeLayouts?.[mode];
      if (layout) addTree(workspace, layout);
    }
  }
  // Stable render order: the hosts' array positions never change, so React
  // never moves a host node (moving one detaches its documents).
  return trees.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}
