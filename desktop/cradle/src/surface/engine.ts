/**
 * Surface layout engine (U0.3b) — pure functions over plain serialisable
 * state. Window management is S's own application mechanic (law 12, D16;
 * APP-SPEC §12: "layout, focus, drag/split behaviour … are application
 * mechanics, not new semantic identities"). No kernel events here (U0.4
 * lands the kernel seam); the engine only computes the next layout state.
 */

import {
  AGENCY_DEPTHS,
  type AgencyDepth,
  type Dir,
  type LayoutState,
  type Pane,
  type PaneDir,
  type RestorePoint,
  type SplitPane,
  type SurfaceBinding,
  type SurfaceId,
  type TabGroupPane,
} from "./types";

// ---------------------------------------------------------------------------
// tree helpers

export function groupsOf(pane: Pane | null): TabGroupPane[] {
  if (!pane) return [];
  if (pane.type === "group") return [pane];
  return pane.children.flatMap(groupsOf);
}

export function contains(pane: Pane, id: string): boolean {
  if (pane.type === "group") return pane.id === id;
  return pane.children.some((c) => contains(c, id));
}

/** Visual tab order: pinned bindings first, then the rest. */
export function renderOrder(group: TabGroupPane): SurfaceId[] {
  const pinned = group.pinned.filter((p) => group.tabs.includes(p));
  return [...pinned, ...group.tabs.filter((t) => !pinned.includes(t))];
}

function mapPane(pane: Pane, fn: (g: TabGroupPane) => TabGroupPane): Pane {
  if (pane.type === "group") return fn(pane);
  return { ...pane, children: pane.children.map((c) => mapPane(c, fn)) };
}

/** Drop empty groups; collapse splits that lost children. */
function prune(pane: Pane | null): Pane | null {
  if (!pane) return null;
  if (pane.type === "group") return pane.tabs.length ? pane : null;
  const children = pane.children
    .map((c) => prune(c))
    .filter((c): c is Pane => c !== null);
  if (children.length === 0) return null;
  if (children.length === 1) return children[0];
  return { ...pane, children };
}

/** Finalise a state around a new root: fix focus, clamp depth at rest. */
function withRoot(state: LayoutState, root: Pane | null): LayoutState {
  const pruned = prune(root);
  let focusedGroupId = state.focusedGroupId;
  if (!pruned) focusedGroupId = null;
  else if (!focusedGroupId || !contains(pruned, focusedGroupId))
    focusedGroupId = groupsOf(pruned)[0].id;
  const agencyDepth: AgencyDepth = pruned ? state.agencyDepth : "strip";
  return { ...state, root: pruned, focusedGroupId, agencyDepth };
}

// ---------------------------------------------------------------------------
// ids — derived from state so they survive persistence and restore

function maxNumeric(state: LayoutState, prefix: string): number {
  let max = 0;
  const scan = (s: string | undefined) => {
    if (!s) return;
    const m = s.match(new RegExp(`^${prefix}(\\d+)$`));
    if (m) max = Math.max(max, Number(m[1]));
  };
  Object.keys(state.surfaces).forEach(scan);
  const walk = (p: Pane) => {
    scan(p.id);
    if (p.type === "split") p.children.forEach(walk);
  };
  if (state.root) walk(state.root);
  return max;
}

export function nextId(state: LayoutState, prefix: string): string {
  return `${prefix}${maxNumeric(state, prefix) + 1}`;
}

/**
 * Deterministic id generator seeded from a state (for multi-id operations).
 * Each prefix keeps its own counter; the seed is the pre-operation state.
 */
function idGen(state: LayoutState): (prefix: string) => string {
  const produced = new Map<string, number>();
  return (prefix: string) => {
    const n = (produced.get(prefix) ?? 0) + 1;
    produced.set(prefix, n);
    return `${prefix}${maxNumeric(state, prefix) + n}`;
  };
}

// ---------------------------------------------------------------------------
// queries

export function groupOf(
  state: LayoutState,
  surfaceId: SurfaceId,
): TabGroupPane | undefined {
  return groupsOf(state.root).find((g) => g.tabs.includes(surfaceId));
}

export function focusedGroup(state: LayoutState): TabGroupPane | undefined {
  const groups = groupsOf(state.root);
  return groups.find((g) => g.id === state.focusedGroupId) ?? groups[0];
}

/** The one active binding of the frame (D16: focus follows the binding). */
export function activeBindingId(state: LayoutState): SurfaceId | null {
  return focusedGroup(state)?.active ?? null;
}

export function isPinned(state: LayoutState, surfaceId: SurfaceId): boolean {
  return groupOf(state, surfaceId)?.pinned.includes(surfaceId) ?? false;
}

export function openSurfaceCount(state: LayoutState): number {
  return groupsOf(state.root).reduce((n, g) => n + g.tabs.length, 0);
}

// ---------------------------------------------------------------------------
// test bindings — the single synthetic allowance (clearly named, kind 'test*')

export function makeTestBinding(
  state: LayoutState,
  kind: "test" | "test:silent",
): SurfaceBinding {
  let max = 0;
  for (const b of Object.values(state.surfaces)) {
    if (!b.ref?.startsWith("test:")) continue;
    const m = b.ref.match(/(\d+)$/);
    if (m) max = Math.max(max, Number(m[1]));
  }
  const n = max + 1;
  const id = nextId(state, "s");
  return kind === "test"
    ? { id, kind, ref: `test:${n}`, title: `Test surface ${n}` }
    : { id, kind, ref: `test:silent:${n}`, title: `Test surface (silent) ${n}` };
}

// ---------------------------------------------------------------------------
// real bindings — kinds the kernel seam owns (U0.4)

/** The sources index (⌘O): the project's participating sources as the
 * owner disclosed them. One index at a time — a second ⌘O focuses it. */
export function openSourcesIndex(state: LayoutState): LayoutState {
  const existing = Object.values(state.surfaces).find((b) => b.kind === "sources");
  if (existing) return activateSurface(state, existing.id);
  return openBinding(state, { id: nextId(state, "s"), kind: "sources", title: "Sources" });
}

/** A real source surface (kind 'source'): the binding carries the owner's
 * canonical ref verbatim — never a path-derived identity. */
export function makeSourceBinding(
  state: LayoutState,
  sourceRef: string,
  path: string,
): SurfaceBinding {
  const existing = Object.values(state.surfaces).find(
    (b) => b.kind === "source" && b.ref === sourceRef,
  );
  if (existing) return existing;
  const title = path.split("/").pop() || path;
  return { id: nextId(state, "s"), kind: "source", ref: sourceRef, title };
}

// ---------------------------------------------------------------------------
// operations

export function openBinding(
  state: LayoutState,
  binding: SurfaceBinding,
): LayoutState {
  const surfaces = { ...state.surfaces, [binding.id]: binding };
  const base: LayoutState = { ...state, surfaces };
  if (!state.root) {
    const g: TabGroupPane = {
      type: "group",
      id: nextId(state, "g"),
      tabs: [binding.id],
      pinned: [],
      active: binding.id,
    };
    return { ...base, root: g, focusedGroupId: g.id };
  }
  const target = focusedGroup(base);
  if (!target) return base;
  const root = mapPane(base.root!, (g) =>
    g.id === target.id ? { ...g, tabs: [...g.tabs, binding.id], active: binding.id } : g,
  );
  return { ...base, root, focusedGroupId: target.id };
}

function removeTab(g: TabGroupPane, id: SurfaceId): TabGroupPane {
  const idx = g.tabs.indexOf(id);
  if (idx === -1) return g;
  const tabs = g.tabs.filter((t) => t !== id);
  const active =
    g.active === id
      ? (tabs[idx] ?? tabs[Math.max(0, idx - 1)] ?? null)
      : g.active;
  return { ...g, tabs, pinned: g.pinned.filter((p) => p !== id), active };
}

function insertTab(
  g: TabGroupPane,
  id: SurfaceId,
  beforeId: SurfaceId | null | undefined,
  carryPinned: boolean,
): TabGroupPane {
  const at = beforeId ? g.tabs.indexOf(beforeId) : -1;
  const tabs =
    at >= 0
      ? [...g.tabs.slice(0, at), id, ...g.tabs.slice(at)]
      : [...g.tabs, id];
  const pinned = carryPinned && !g.pinned.includes(id) ? [...g.pinned, id] : g.pinned;
  return { ...g, tabs, pinned, active: id };
}

function reorderTab(
  g: TabGroupPane,
  id: SurfaceId,
  beforeId: SurfaceId | null | undefined,
): TabGroupPane {
  const tabs = g.tabs.filter((t) => t !== id);
  const at = beforeId ? tabs.indexOf(beforeId) : -1;
  const next =
    at >= 0 ? [...tabs.slice(0, at), id, ...tabs.slice(at)] : [...tabs, id];
  return { ...g, tabs: next, active: id };
}

/** Close a surface into the closed-surfaces stack. Pinned surfaces refuse. */
export function closeSurface(state: LayoutState, id: SurfaceId): LayoutState {
  const g = groupOf(state, id);
  if (!g || g.pinned.includes(id)) return state;
  const root = mapPane(state.root!, (x) => (x.id === g.id ? removeTab(x, id) : x));
  const closedStack = [...state.closedStack, id];
  return withRoot({ ...state, closedStack }, root);
}

/** Reopen the most recently closed surface into the focused group. */
export function reopenClosed(state: LayoutState): LayoutState {
  const id = state.closedStack[state.closedStack.length - 1];
  const binding = id ? state.surfaces[id] : undefined;
  if (!binding) return state;
  return openBinding({ ...state, closedStack: state.closedStack.slice(0, -1) }, binding);
}

/** Insert `node` as a sibling of `targetGroupId` in direction `dir`. */
function insertSibling(
  pane: Pane,
  targetGroupId: string,
  dir: PaneDir,
  node: Pane,
  after: boolean,
  gen: (prefix: string) => string,
): Pane {
  if (pane.type === "group") {
    if (pane.id !== targetGroupId) return pane;
    const split: SplitPane = {
      type: "split",
      id: gen("sp"),
      dir,
      children: after ? [pane, node] : [node, pane],
    };
    return split;
  }
  const idx = pane.children.findIndex((c) => contains(c, targetGroupId));
  if (idx === -1) return pane;
  if (pane.dir === dir) {
    const children = [...pane.children];
    children.splice(after ? idx + 1 : idx, 0, node);
    return { ...pane, children };
  }
  const children = [...pane.children];
  children[idx] = insertSibling(children[idx], targetGroupId, dir, node, after, gen);
  return { ...pane, children };
}

/**
 * Split: move a surface out of its group into a new sibling group in `dir`.
 * A lone surface simply relocates (wrap + prune collapse).
 */
export function splitOff(
  state: LayoutState,
  id: SurfaceId,
  dir: PaneDir,
  after = true,
): LayoutState {
  const g = groupOf(state, id);
  if (!g) return state;
  const gen = idGen(state);
  const pinnedCarry = g.pinned.includes(id);
  const ng: TabGroupPane = {
    type: "group",
    id: gen("g"),
    tabs: [id],
    pinned: pinnedCarry ? [id] : [],
    active: id,
  };
  let root: Pane | null = insertSibling(state.root!, g.id, dir, ng, after, gen);
  root = mapPane(root, (x) => (x.id === g.id ? removeTab(x, id) : x));
  const next = withRoot(state, root);
  return { ...next, focusedGroupId: ng.id };
}

/** Tile: every open surface in its own group, balanced alternating splits. */
export function tileSurfaces(state: LayoutState): LayoutState {
  const ids = groupsOf(state.root).flatMap((g) => g.tabs);
  if (ids.length === 0) return state;
  const gen = idGen(state);
  const pinnedOf = (id: SurfaceId) => (isPinned(state, id) ? [id] : []);
  const build = (list: SurfaceId[], depth: number): Pane => {
    if (list.length === 1)
      return {
        type: "group",
        id: gen("g"),
        tabs: [list[0]],
        pinned: pinnedOf(list[0]),
        active: list[0],
      };
    const mid = Math.ceil(list.length / 2);
    return {
      type: "split",
      id: gen("sp"),
      dir: depth % 2 === 0 ? "h" : "v",
      children: [build(list.slice(0, mid), depth + 1), build(list.slice(mid), depth + 1)],
    };
  };
  const root = build(ids, 0);
  return { ...state, root, focusedGroupId: groupsOf(root)[0].id };
}

/** Move a surface between groups (drag between splits); same strip = reorder. */
export function moveTab(
  state: LayoutState,
  id: SurfaceId,
  toGroupId: string,
  beforeId?: SurfaceId | null,
): LayoutState {
  const from = groupOf(state, id);
  const to = groupsOf(state.root).find((g) => g.id === toGroupId);
  if (!from || !to) return state;
  if (from.id === to.id) {
    const root = mapPane(state.root!, (g) =>
      g.id === to.id ? reorderTab(g, id, beforeId) : g,
    );
    return { ...state, root, focusedGroupId: to.id };
  }
  const carryPinned = from.pinned.includes(id);
  let root: Pane = mapPane(state.root!, (g) =>
    g.id === from.id ? removeTab(g, id) : g,
  );
  root = mapPane(root, (g) =>
    g.id === to.id ? insertTab(g, id, beforeId, carryPinned) : g,
  );
  const next = withRoot(state, root);
  return { ...next, focusedGroupId: to.id };
}

// ---------------------------------------------------------------------------
// focus between splits (i3-style directional walk up the split tree)

const AXIS: Record<Dir, PaneDir> = { left: "h", right: "h", up: "v", down: "v" };
const SIGN: Record<Dir, number> = { left: -1, right: 1, up: -1, down: 1 };

interface TrailStep {
  split: SplitPane;
  index: number;
}

function pathTo(
  pane: Pane,
  targetId: string,
  trail: TrailStep[] = [],
): TrailStep[] | null {
  if (pane.type === "group")
    return pane.id === targetId ? trail : null;
  for (let i = 0; i < pane.children.length; i++) {
    const t = pathTo(pane.children[i], targetId, [...trail, { split: pane, index: i }]);
    if (t) return t;
  }
  return null;
}

function firstGroup(pane: Pane, fromEnd: boolean): TabGroupPane {
  if (pane.type === "group") return pane;
  const child = fromEnd ? pane.children[pane.children.length - 1] : pane.children[0];
  return firstGroup(child, fromEnd);
}

/** Neighbour group id in a direction, or null. */
export function neighbourGroup(state: LayoutState, dir: Dir): string | null {
  if (!state.root || !state.focusedGroupId) return null;
  const trail = pathTo(state.root, state.focusedGroupId);
  if (!trail) return null;
  for (let i = trail.length - 1; i >= 0; i--) {
    const { split, index } = trail[i];
    if (split.dir !== AXIS[dir]) continue;
    const next = index + SIGN[dir];
    if (next < 0 || next >= split.children.length) continue;
    return firstGroup(split.children[next], SIGN[dir] < 0).id;
  }
  return null;
}

/** Move the active surface toward a direction: into the neighbour group, or
 * split in that direction when no neighbour exists. */
export function moveDirectional(state: LayoutState, dir: Dir): LayoutState {
  const id = activeBindingId(state);
  if (!id) return state;
  const nb = neighbourGroup(state, dir);
  if (nb && nb !== focusedGroup(state)?.id) return moveTab(state, id, nb);
  return splitOff(state, id, AXIS[dir], SIGN[dir] > 0);
}

export function activateSurface(state: LayoutState, id: SurfaceId): LayoutState {
  const g = groupOf(state, id);
  if (!g) return state;
  const root = mapPane(state.root!, (x) => (x.id === g.id ? { ...x, active: id } : x));
  return { ...state, root, focusedGroupId: g.id };
}

export function focusGroup(state: LayoutState, groupId: string): LayoutState {
  if (!state.root || !contains(state.root, groupId)) return state;
  return { ...state, focusedGroupId: groupId };
}

/** Cycle the active tab within the focused group (visual order). */
export function cycleTab(state: LayoutState, delta: 1 | -1): LayoutState {
  const g = focusedGroup(state);
  if (!g?.active) return state;
  const order = renderOrder(g);
  const i = order.indexOf(g.active);
  const next = order[(i + delta + order.length) % order.length];
  const root = mapPane(state.root!, (x) => (x.id === g.id ? { ...x, active: next } : x));
  return { ...state, root };
}

/** Jump to the nth tab (1-based, visual order) of the focused group. */
export function jumpToTab(state: LayoutState, n: number): LayoutState {
  const g = focusedGroup(state);
  if (!g) return state;
  const order = renderOrder(g);
  const id = order[n - 1];
  if (!id) return state;
  const root = mapPane(state.root!, (x) => (x.id === g.id ? { ...x, active: id } : x));
  return { ...state, root };
}

export function togglePin(state: LayoutState, id: SurfaceId): LayoutState {
  const g = groupOf(state, id);
  if (!g) return state;
  const pinned = g.pinned.includes(id)
    ? g.pinned.filter((p) => p !== id)
    : [...g.pinned, id];
  const root = mapPane(state.root!, (x) => (x.id === g.id ? { ...x, pinned } : x));
  return { ...state, root };
}

// ---------------------------------------------------------------------------
// restore + depth

export function layoutSignature(
  s: Pick<LayoutState, "root" | "surfaces" | "closedStack">,
): string {
  return JSON.stringify({ root: s.root, surfaces: s.surfaces, closedStack: s.closedStack });
}

/** Restore the presentation layout to the restore point (state at load). */
export function restoreLayout(state: LayoutState, point: RestorePoint): LayoutState {
  if (layoutSignature(state) === layoutSignature(point)) return state;
  return withRoot(
    {
      ...state,
      root: point.root,
      surfaces: point.surfaces,
      closedStack: point.closedStack,
      focusedGroupId: point.focusedGroupId,
    },
    point.root,
  );
}

/** Depth states belong to the working frame; austere rest stays 'strip'. */
export function shiftDepth(state: LayoutState, delta: number): LayoutState {
  if (!state.root) return state;
  const i = AGENCY_DEPTHS.indexOf(state.agencyDepth);
  const j = Math.min(AGENCY_DEPTHS.length - 1, Math.max(0, i + delta));
  return { ...state, agencyDepth: AGENCY_DEPTHS[j] };
}

/** Escape from the full overlay steps back to panel (one depth out). */
export function stepDepthDown(state: LayoutState): LayoutState {
  return state.agencyDepth === "full" ? { ...state, agencyDepth: "panel" } : state;
}
