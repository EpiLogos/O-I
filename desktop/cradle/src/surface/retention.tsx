/**
 * The mode-centre retention tier (owner-approved three-tier retention law,
 * 2026-09-19). Switching workspace modes swaps whole per-mode trees, which
 * unmounts every surface in the outgoing tree — the Expressions application
 * reloaded, the Technè wiki web rebuilt, on every hop. This module keeps the
 * heavy centre surfaces MOUNTED across those swaps:
 *
 * - The SHELL declares each retained centre once, in a hidden park layer the
 *   pane system never unmounts (workspace/DesktopShell renders it beside the
 *   centre region's presenting tree). React owns the subtree for its whole
 *   retained life; only the container DOM node moves.
 * - A presenting surface (the mode stage, or the centre's tab in a pane —
 *   both render `SurfaceBody`) mounts a `CentreOutlet` instead of a second
 *   copy. A mounted outlet ADOPTS the retained container into itself; an
 *   unmounting outlet releases it back to the park (the presenting sites
 *   are exclusive by construction, so adoption needs no arbitration). DOM
 *   moves never reload iframes or restart engines, and a concealed pane tab
 *   keeps holding its centre mounted-concealed — the pane tier's own law.
 * - Parked means suspended: the park layer is `display:none`, the same
 *   off-screen observation (`IntersectionObserver`, MaterialSurface's
 *   `useSuspend` law) every viewport-gated surface already honours.
 *
 * Per surface KIND (the tier law): engines and hosted applications retain —
 * `expressions` (the vendored application's iframe), `techne`, `epi-logos`,
 * `system`, and `factory`. Factory's Desk/Tasks body composes the frame-built
 * chat node (`CradleFrame.factoryCentre`), so the frame passes that node —
 * with its Desk/Tasks context — down through the shell (DesktopShell →
 * ModeCentreRetention) and the declarer mounts the ONE FactoryCentre body
 * with it: the park holds the same node the stage's and panes' outlets
 * adopt, exactly like the other centres.
 *
 * Retention keys on the workspace: the retained set is derived only from the
 * ACTIVE workspace's trees, so switching workspaces unmounts every declarer
 * and releases cleanly. The kernel stays the state owner — nothing here
 * caches readings; it keeps mounted presentation alive, nothing more.
 */
import {lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode} from "react";
import {createPortal} from "react-dom";
import {groupsOf} from "./engine";
import {markPresented, markReleased, markRetained, exposeRuntimeProbe, RETAINED_VIEW_BUDGET} from "./runtime";
import type {LayoutState, SurfaceBinding, SurfaceId} from "./types";
import {TREE_MODES, type WorkspaceMode} from "../workspace/mode";
import type {Workspace} from "../workspace/store";

// The retained centre bodies are the same lazy chunks the workbench mounts;
// a retained centre loads on first presentation, never at startup.
const PointCloudHost = lazy(() => import("../expressions/PointCloudHost").then((module) => ({default: module.PointCloudHost})));
const TechneSurface = lazy(() => import("../techne/TechneSurface").then((module) => ({default: module.TechneSurface})));
const EpiLogosSurface = lazy(() => import("../epilogos/EpiLogosSurface").then((module) => ({default: module.EpiLogosSurface})));
const SystemPanel = lazy(() => import("../workspace/SystemPanel").then((module) => ({default: module.SystemPanel})));
const FactoryCentre = lazy(() => import("../contributions/factory/FactoryCentre").then((module) => ({default: module.FactoryCentre})));

/** The centre kinds this tier retains (see the module law above). */
export const RETAINED_CENTRE_KINDS = new Set(["expressions", "techne", "epi-logos", "system", "factory"]);
export const isRetainedCentreKind = (kind: string) => RETAINED_CENTRE_KINDS.has(kind);

/** Factory's Desk/Tasks context (CradleFrame.factoryCentreProps): the
 * browsed project, the bound conversation, the one task-open path and the
 * message sink — the same shape Workbench carries; declared here so the
 * shell can pass it to the declarer without importing the workbench. */
export interface FactoryCentreContext {
  project?: string;
  accompanying?: {ref: string; project: string; space: string};
  onOpenTask?: (row: import("../encounter/EncounterList").EncounterRow) => void | Promise<void>;
  onMessage?: (message: string) => void;
}

// ---------------------------------------------------------------------------
// The park — one hidden layer per shell. `ModeCentreRetention` sets it on
// mount; declarers park their containers there, and outlets release back to
// it when they unmount. A document-level stand-in covers the window between
// shell mounts (and any outlet the shell never hosted).

const shellPark: {current: HTMLElement | null} = {current: null};

function parkLayer(): HTMLElement | null {
  if (shellPark.current) return shellPark.current;
  if (typeof document === "undefined") return null;
  if (!documentPark) {
    documentPark = document.createElement("div");
    documentPark.className = "mode-centre-retention";
    documentPark.setAttribute("aria-hidden", "true");
    document.body.appendChild(documentPark);
  }
  return documentPark;
}

let documentPark: HTMLDivElement | null = null;

interface RetainedRecord {
  container: HTMLDivElement;
  /** The outlet currently presenting the container, if any. */
  adopter: HTMLElement | null;
}
const retained = new Map<SurfaceId, RetainedRecord>();

function adopt(surfaceId: SurfaceId, outlet: HTMLElement) {
  const record = retained.get(surfaceId);
  if (!record) return;
  record.adopter = outlet;
  if (record.container.parentElement !== outlet) outlet.appendChild(record.container);
}

function release(surfaceId: SurfaceId, outlet: HTMLElement) {
  const record = retained.get(surfaceId);
  if (!record || record.adopter !== outlet) return;
  record.adopter = null;
  const park = parkLayer();
  if (park && record.container.parentElement !== park) park.appendChild(record.container);
}

// ---------------------------------------------------------------------------
// Which centres the shell retains: every binding of a retained kind that any
// of the workspace's trees presents — the active tree first (its centres are
// presentable through the outlets), then each waiting mode tree (its centre
// parks, suspended, until the mode returns). Side tabs of waiting trees are
// not retained; they stay unmounted exactly as before.

function presentedBindingOfKind(layout: LayoutState, kind: string): SurfaceBinding | undefined {
  for (const group of groupsOf(layout.root)) {
    for (const id of group.tabs) {
      const binding = layout.surfaces[id];
      if (binding?.kind === kind) return binding;
    }
  }
  return undefined;
}

export interface RetainedCentreRef { binding: SurfaceBinding; mode: WorkspaceMode }

function retainedCentres(workspace: Workspace, activeMode: WorkspaceMode): RetainedCentreRef[] {
  const trees: {mode: WorkspaceMode; layout: LayoutState}[] = [{mode: activeMode, layout: workspace.layout}];
  for (const mode of TREE_MODES) {
    if (mode !== activeMode && workspace.modeLayouts?.[mode]) trees.push({mode, layout: workspace.modeLayouts[mode]!});
  }
  const found = new Map<string, RetainedCentreRef>();
  for (const tree of trees) {
    for (const kind of RETAINED_CENTRE_KINDS) {
      if (found.has(kind)) continue;
      const binding = presentedBindingOfKind(tree.layout, kind);
      if (binding) found.set(kind, {binding, mode: tree.mode});
    }
  }
  return [...found.values()];
}

// ---------------------------------------------------------------------------
// The declarer — mounts the centre's body once, inside a container the shell
// parks hidden until an outlet adopts it.

interface WorkbenchSubject { ref?: string; kind?: string; title: string; project?: string }

function retainedBody(binding: SurfaceBinding, subject?: WorkbenchSubject, factoryCentre?: ReactNode, factoryTasks?: FactoryCentreContext): ReactNode {
  // The centre arms of the workbench's own SurfaceBody, mirrored here with
  // the props the shell itself holds (the frame passes nothing richer into
  // the stage than these). Factory's arm composes the frame-built chat node
  // the shell received — the declarer mounts the one body with it.
  if (binding.kind === "expressions") return <PointCloudHost/>;
  if (binding.kind === "techne") return <TechneSurface binding={binding} subject={subject}/>;
  if (binding.kind === "epi-logos") return <EpiLogosSurface binding={binding}/>;
  if (binding.kind === "system") return <SystemPanel binding={binding}/>;
  if (binding.kind === "factory") return <FactoryCentre chat={factoryCentre} project={factoryTasks?.project} accompanying={factoryTasks?.accompanying} onOpenTask={factoryTasks?.onOpenTask} onMessage={factoryTasks?.onMessage}/>;
  return null;
}

function RetainedCentre({binding, subject, factoryCentre, factoryTasks}: {binding: SurfaceBinding; subject?: WorkbenchSubject; factoryCentre?: ReactNode; factoryTasks?: FactoryCentreContext}) {
  const [container] = useState(() => {
    const element = document.createElement("div");
    element.className = "retained-centre-host";
    element.dataset.surfaceKind = binding.kind;
    return element;
  });
  useEffect(() => {
    retained.set(binding.id, {container, adopter: null});
    const park = parkLayer();
    if (park && container.parentElement !== park) park.appendChild(container);
    markRetained(binding.id, binding.kind);
    exposeRuntimeProbe();
    return () => {
      const record = retained.get(binding.id);
      if (record?.container === container) retained.delete(binding.id);
      markReleased(binding.id, binding.kind);
      container.remove();
    };
  }, [binding.id, container]);
  return createPortal(<Suspense fallback={null}>{retainedBody(binding, subject, factoryCentre, factoryTasks)}</Suspense>, container);
}

/** The shell's retention layer — DesktopShell renders this once beside the
 * centre region's presenting tree. It owns the hidden park and declares every
 * retained centre of the ACTIVE workspace. Factory's declarer receives the
 * frame-built chat node and its context through the shell. */
export function ModeCentreRetention({workspace, mode, factoryCentre, factoryTasks}: {workspace: Workspace; mode: WorkspaceMode; factoryCentre?: ReactNode; factoryTasks?: FactoryCentreContext}) {
  const centres = useMemo(() => retainedCentres(workspace, mode), [workspace, mode]);
  const subject = workspace.context?.subject;
  return <div className="mode-centre-retention" ref={node => { shellPark.current = node; }} aria-hidden="true">
    {centres.map(({binding}) => <RetainedCentre key={`${workspace.id}:${binding.id}`} binding={binding} subject={subject} factoryCentre={factoryCentre} factoryTasks={factoryTasks}/>)}
  </div>;
}

// ---------------------------------------------------------------------------
// The outlet — what a presenting surface mounts in place of a second body
// copy. A presenting surface ADOPTS the retained container into itself and
// releases it back to the park on unmount. The presenting sites for one
// binding are exclusive by construction (the frame renders either the solo
// mode stage or the pane tree, and a binding lives in one group of one
// tree), so mount/unmount adoption is the whole law: a concealed pane tab
// KEEPS its centre mounted-concealed (the pane tier), and a mode switch
// releases the stage's outlet so the centre parks suspended rather than
// unmounting. Both wrappers are layout-transparent (`display:contents`), so
// the centre's own root keeps the exact sizing and flow it had as the
// stage's/tabpanel's direct child.
export function CentreOutlet({binding}: {binding: SurfaceBinding}) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const outlet = host.current;
    if (!outlet) return;
    adopt(binding.id, outlet);
    markPresented(binding.id, binding.kind);
    return () => {
      release(binding.id, outlet);
      markRetained(binding.id, binding.kind);
    };
  }, [binding.id]);
  return <div className="retained-centre-outlet" ref={host} data-surface-kind={binding.kind}/>;
}

// ---------------------------------------------------------------------------
// The warm trees (workspace-continuity WF4): whole pane TREES kept mounted
// across mode and workspace swaps, hidden instead of unmounted — the DOM
// never moves (moving an iframe re-navigates its document), only visibility
// flips. The active workspace's own trees plus the recently visited
// workspaces' trees, each carrying at least one retained pane surface,
// capped by the warm budget. Pending opens (no owner identity yet) and
// detached surfaces (their own native windows) are not retained here.

/** The pane kinds the warm trees keep mounted: bodies that hold live
 * documents, owner sessions or engine state a remount would destroy — an
 * HTML document (the frame and its revision), an editor with a held draft
 * and scroll, a knowledge/expression view, an AgentSession view, a terminal
 * lease, a browser page, a pinned presentation, Explore's remembered
 * travel. Cheap list kinds (sources, blank) release as before; explicit
 * close releases every kind (the binding leaves the tree). */
export const RETAINED_PANE_KINDS = new Set(["file", "source", "knowledge", "encounter", "terminal", "browser", "presentation", "explore"]);
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
    if (!retained.length || retained.length > budget) return;
    budget -= retained.length;
    seen.add(key);
    trees.push({ key, workspaceId: workspace.id, layout, presented: workspace.id === activeWorkspaceId && treeMode === activeMode });
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
