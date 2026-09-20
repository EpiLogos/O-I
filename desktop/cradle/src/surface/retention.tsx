/**
 * The mode-centre retention tier (owner-approved three-tier retention law,
<<<<<<< HEAD
 * 2026-09-19; stage law revised 2026-09-20; the park retired 2026-09-20,
 * spec §7.1). Switching workspace modes swaps whole per-mode trees, which
 * unmounts every surface in the outgoing tree — the Expressions application
 * reloaded, the Technè canvas rebuilt, on every hop. This module keeps the
 * heavy centre surfaces MOUNTED across those swaps, and every centre is now
 * presented IN PLACE, wherever it lives:
=======
 * 2026-09-19; stage law revised 2026-09-20). Switching workspace modes swaps
 * whole per-mode trees, which unmounts every surface in the outgoing tree —
 * the Expressions application reloaded, the Technè wiki web rebuilt, on
 * every hop. This module keeps the heavy centre surfaces MOUNTED across
 * those swaps:
>>>>>>> origin/main
 *
 * - STAGE-OWNED centres (a mode's own centre kind, standing in that mode's
 *   own tree) are presented by the frame's per-mode stage slots
 *   (CradleFrame): one ALWAYS-PRESENT keyed slot per mode, the centre body
 *   mounted DIRECTLY in place through `ModeCentreBody` and never moved —
 *   the pane tier's own warm-tree law (moving a DOM subtree that contains
 *   an iframe detaches it and the iframe re-navigates, which the measured
 *   receipt in docs/experience/evidence/mode-engine-state.before.json
 *   names). A mode swap flips the slot's visibility; the application's
 *   document, engine and in-memory state ride through.
 * - PANE-TAB-PRESENTED centres (a centre kind opened as an ordinary pane
<<<<<<< HEAD
 *   tab outside its own mode's tree) are presented by the pane tier
 *   itself: `SurfaceBody`'s centre arm mounts `ModeCentreBody` directly
 *   inside the pane's own `.surface-retained` wrapper, mounted-concealed
 *   like every other retained tab. The former park-and-adopt path — a
 *   hidden layer whose containers an outlet ADOPTED (a DOM move, and a
 *   moved iframe re-navigates) — is retired entirely; a centre is mounted
 *   where it presents and never moves.
 * - Concealed means suspended: `display:none` is the same off-screen
 *   observation (`IntersectionObserver`, MaterialSurface's `useSuspend`
 *   law) every viewport-gated surface already honours; a hidden stage slot
 *   or a concealed pane tab is `display:none` by the same law.
=======
 *   tab outside its own mode's tree) keep the park-and-adopt path: the
 *   shell declares each once in a hidden park layer
 *   (`ModeCentreRetention`), and a presenting pane mounts `CentreOutlet`,
 *   which adopts the retained container and releases it back on unmount.
 *   Moves never reload the vending engines these surfaces do not host.
 * - Parked means suspended: the park layer is `display:none`, the same
 *   off-screen observation (`IntersectionObserver`, MaterialSurface's
 *   `useSuspend` law) every viewport-gated surface already honours; a
 *   hidden stage slot is `display:none` by the same law.
>>>>>>> origin/main
 *
 * Per surface KIND (the tier law): engines and hosted applications retain —
 * `expressions` (the vendored application's iframe), `techne`, `epi-logos`,
 * `system`, and `factory`. Factory's Desk/Tasks body composes the frame-built
 * chat node (`CradleFrame.factoryCentre`), so the frame passes that node —
<<<<<<< HEAD
 * with its Desk/Tasks context — down through the shell to the stage slots
 * and the workbench's centre arm alike.
=======
 * with its Desk/Tasks context — down through the shell (DesktopShell →
 * ModeCentreRetention) and to the stage slots alike.
>>>>>>> origin/main
 *
 * Retention keys on the workspace: the warm set is derived only from the
 * ACTIVE workspace's trees, so switching workspaces releases the others'
 * hosts cleanly. The kernel stays the state owner — nothing here caches
 * readings; it keeps mounted presentation alive, nothing more.
 */
import {lazy, Suspense, useEffect, type ReactNode} from "react";
import {groupsOf} from "./engine";
import {markPresented, markReleased, markRetained, exposeRuntimeProbe, RETAINED_VIEW_BUDGET} from "./runtime";
import type {LayoutState, SurfaceBinding, SurfaceId} from "./types";
import {MODE_CURATION, TREE_MODES, type WorkspaceMode} from "../workspace/mode";
import type {Workspace} from "../workspace/store";
import type {HostedAppState} from "../expressions/hostedApp";

// The retained centre bodies are the same lazy chunks the workbench mounts;
// a retained centre loads on first presentation, never at startup.
const PointCloudHost = lazy(() => import("../expressions/PointCloudHost").then((module) => ({default: module.PointCloudHost})));

const EpiLogosSurface = lazy(() => import("../epilogos/EpiLogosSurface").then((module) => ({default: module.EpiLogosSurface})));
const SystemPanel = lazy(() => import("../workspace/SystemPanel").then((module) => ({default: module.SystemPanel})));
const FactoryCentre = lazy(() => import("../contributions/factory/FactoryCentre").then((module) => ({default: module.FactoryCentre})));

/** The centre kinds this tier retains (see the module law above). */
export const RETAINED_CENTRE_KINDS = new Set(["expressions", "techne", "epi-logos", "system", "factory"]);
export const isRetainedCentreKind = (kind: string) => RETAINED_CENTRE_KINDS.has(kind);

/** Factory's Desk/Tasks context (CradleFrame.factoryCentreProps): the
 * browsed project, the bound conversation, the one task-open path and the
 * message sink — the same shape Workbench carries. */
export interface FactoryCentreContext {
  project?: string;
  accompanying?: {ref: string; project: string; space: string};
  onOpenTask?: (row: import("../encounter/EncounterList").EncounterRow) => void | Promise<void>;
  onMessage?: (message: string) => void;
}

// ---------------------------------------------------------------------------

interface WorkbenchSubject { ref?: string; kind?: string; title: string; project?: string }

function presentedBindingOfKind(layout: LayoutState, kind: string): SurfaceBinding | undefined {
  for (const group of groupsOf(layout.root)) {
    for (const id of group.tabs) {
      const binding = layout.surfaces[id];
      if (binding?.kind === kind) return binding;
    }
  }
  return undefined;
}

<<<<<<< HEAD
=======
export interface RetainedCentreRef { binding: SurfaceBinding; mode: WorkspaceMode }

>>>>>>> origin/main
/** The centre-kind binding living in ONE MODE'S OWN TREE: the active
 * workspace layout when that mode is the one standing, else its waiting tree
 * in `modeLayouts` — present in its pane groups. This is the ownership test
 * of the whole tier: a centre in its own mode's tree is STAGE-OWNED (the
 * frame's per-mode slot presents it in place); a centre found anywhere else
<<<<<<< HEAD
 * is pane-tab-presented (its pane's own wrapper presents it in place). */
=======
 * is pane-tab-presented (the park keeps it; a pane outlet adopts it). */
>>>>>>> origin/main
export function centreBindingOf(workspace: Workspace, activeMode: WorkspaceMode, mode: WorkspaceMode): SurfaceBinding | undefined {
  const kind = MODE_CURATION[mode].centreKind;
  if (!kind) return undefined;
  const layout = mode === activeMode ? workspace.layout : workspace.modeLayouts?.[mode];
  if (!layout) return undefined;
  return presentedBindingOfKind(layout, kind);
<<<<<<< HEAD
=======
}

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
      if (!binding) continue;
      // Stage-owned centres are not the park's to declare: a binding of the
      // tree's own mode's centre kind is presented by that mode's stage slot
      // DIRECTLY (mounted in place, never moved). Declaring it here too
      // would mount it twice. The park keeps pane-tab-presented centres.
      if (MODE_CURATION[tree.mode].centreKind === kind) continue;
      found.set(kind, {binding, mode: tree.mode});
    }
  }
  return [...found.values()];
>>>>>>> origin/main
}

/** The centre body itself, mounted DIRECTLY wherever it is presented — the
 * stage slot for a stage-owned centre, the pane's own `.surface-retained`
 * wrapper for a pane-tab-presented one. One body, one mount, no adoption,
 * no DOM move: the component instance lives as long as its presenting
 * container does, and a host that stops presenting flips visibility instead
 * of moving or unmounting anything. Factory's arm composes the frame-built
 * chat node the frame holds. `deepLink` is the restart checkpoint's
 * expression ref (§7.2) — read by the hosted arm once, at its mount. */
export function ModeCentreBody({binding, subject, factoryCentre, factoryTasks, onHostedState}: {binding: SurfaceBinding; subject?: WorkbenchSubject; factoryCentre?: ReactNode; factoryTasks?: FactoryCentreContext; onHostedState?: (state: HostedAppState) => void}): ReactNode {
  return <Suspense fallback={null}>{retainedBody(binding, subject, factoryCentre, factoryTasks, onHostedState)}</Suspense>;
}

<<<<<<< HEAD
function retainedBody(binding: SurfaceBinding, _subject?: WorkbenchSubject, factoryCentre?: ReactNode, factoryTasks?: FactoryCentreContext, onHostedState?: (state: HostedAppState) => void): ReactNode {
  // The centre arms of the workbench's own SurfaceBody, mirrored here with
  // the props the shell itself holds. Factory's arm composes the frame-built
  // chat node the shell received — one body with it, never a second copy.
  if (binding.kind === "expressions") return <PointCloudHost mode="expressions" deepLink={binding.engine?.expressionRef} onHostedState={onHostedState}/>;
  if (binding.kind === "techne") return <PointCloudHost mode="techne" deepLink={binding.engine?.expressionRef} onHostedState={onHostedState}/>;
=======
interface WorkbenchSubject { ref?: string; kind?: string; title: string; project?: string }

function retainedBody(binding: SurfaceBinding, _subject?: WorkbenchSubject, factoryCentre?: ReactNode, factoryTasks?: FactoryCentreContext): ReactNode {
  // The centre arms of the workbench's own SurfaceBody, mirrored here with
  // the props the shell itself holds (the frame passes nothing richer into
  // the stage than these). Factory's arm composes the frame-built chat node
  // the shell received — the declarer mounts the one body with it.
  if (binding.kind === "expressions") return <PointCloudHost mode="expressions"/>;
  if (binding.kind === "techne") return <PointCloudHost mode="techne"/>;
>>>>>>> origin/main
  if (binding.kind === "epi-logos") return <EpiLogosSurface binding={binding}/>;
  if (binding.kind === "system") return <SystemPanel binding={binding}/>;
  if (binding.kind === "factory") return <FactoryCentre chat={factoryCentre} project={factoryTasks?.project} accompanying={factoryTasks?.accompanying} onOpenTask={factoryTasks?.onOpenTask} onMessage={factoryTasks?.onMessage}/>;
  return null;
}

/** The stage-presented centre's residency record — the honest
 * presented/retained facts, without any adoption. (A pane-tab-presented
 * centre is residency-marked by no one, exactly like every other pane
 * surface: the pane tier keeps it mounted-concealed and the registry stays
 * a stage-and-probe concern.) */
export function StageCentreMark({binding, presented}: {binding: SurfaceBinding; presented: boolean}) {
  useEffect(() => {
    if (presented) markPresented(binding.id, binding.kind);
    else markRetained(binding.id, binding.kind);
    exposeRuntimeProbe();
<<<<<<< HEAD
  }, [binding.id, binding.kind, presented]);
  useEffect(() => () => markReleased(binding.id, binding.kind), [binding.id, binding.kind]);
  return null;
=======
    return () => {
      const record = retained.get(binding.id);
      if (record?.container === container) retained.delete(binding.id);
      markReleased(binding.id, binding.kind);
      container.remove();
    };
  }, [binding.id, container]);
  return createPortal(<Suspense fallback={null}>{retainedBody(binding, subject, factoryCentre, factoryTasks)}</Suspense>, container);
}

/** The centre body itself, mounted DIRECTLY where the stage presents it —
 * the same arms the park declarer mounts, under one Suspense, with the
 * factory context the frame holds. The stage path never adopts and never
 * moves a DOM node: the body mounts in its own mode's slot for its whole
 * retained life. */
export function ModeCentreBody({binding, subject, factoryCentre, factoryTasks}: {binding: SurfaceBinding; subject?: WorkbenchSubject; factoryCentre?: ReactNode; factoryTasks?: FactoryCentreContext}) {
  return <Suspense fallback={null}>{retainedBody(binding, subject, factoryCentre, factoryTasks)}</Suspense>;
}

/** The stage-presented centre's residency record — the same honest
 * presented/retained facts the outlet path keeps, without any adoption. */
export function StageCentreMark({binding, presented}: {binding: SurfaceBinding; presented: boolean}) {
  useEffect(() => {
    if (presented) markPresented(binding.id, binding.kind);
    else markRetained(binding.id, binding.kind);
    exposeRuntimeProbe();
  }, [binding.id, binding.kind, presented]);
  useEffect(() => () => markReleased(binding.id, binding.kind), [binding.id, binding.kind]);
  return null;
}

/** The shell's retention layer — DesktopShell renders this once beside the
 * centre region's presenting tree. It owns the hidden park and declares the
 * ACTIVE workspace's PANE-TAB-PRESENTED centres (stage-owned centres mount
 * in their own mode's slot and never enter the park). Factory's declarer
 * receives the frame-built chat node and its context through the shell. */
export function ModeCentreRetention({workspace, mode, factoryCentre, factoryTasks}: {workspace: Workspace; mode: WorkspaceMode; factoryCentre?: ReactNode; factoryTasks?: FactoryCentreContext}) {
  const centres = useMemo(() => retainedCentres(workspace, mode), [workspace, mode]);
  const subject = workspace.context?.subject;
  return <div className="mode-centre-retention" ref={node => { shellPark.current = node; }} aria-hidden="true">
    {centres.map(({binding}) => <RetainedCentre key={`${workspace.id}:${binding.id}`} binding={binding} subject={subject} factoryCentre={factoryCentre} factoryTasks={factoryTasks}/>)}
  </div>;
}

// ---------------------------------------------------------------------------
// The outlet — what a PANE presenting a centre mounts in place of a second
// body copy. The presenting pane ADOPTS the retained container into itself
// and releases it back to the park on unmount. Stage-owned centres never
// come through here (their mode's slot mounts the body directly, nothing
// adopts), so the presenting sites for one park-declared binding remain
// exclusive by construction: a concealed pane tab KEEPS its centre
// mounted-concealed (the pane tier), and the park holds the body suspended
// whenever no pane presents it. Both wrappers are layout-transparent
// (`display:contents`), so the centre's own root keeps the exact sizing and
// flow it had as the tabpanel's direct child.
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
>>>>>>> origin/main
}

// ---------------------------------------------------------------------------
// The warm trees (workspace-continuity WF4): whole pane TREES kept mounted
// across mode and workspace swaps, hidden instead of unmounted — the DOM
// never moves (moving an iframe re-navigates its document), only visibility
// flips. The active workspace's own trees plus the recently visited
// workspaces' trees, each carrying at least one binding that NEEDS the
// shelf, capped by the warm budget. Pending opens (no owner identity yet)
// and detached surfaces (their own native windows) are not retained here.

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

/** The shelving criterion (spec §7.1): a tree is shelved when it carries at
 * least one binding that needs the shelf —
 * - a retained PANE kind (the pane tier's own law, unchanged), or
 * - a retained CENTRE kind that is NOT stage-owned in this tree: a centre
 *   binding living in a foreign tree (its kind is not the tree mode's own
 *   centre kind — for base, which has no centre kind, every centre is
 *   foreign) keeps its body only through its shelved tree.
 * A STAGE-owned centre (kind K in the tree whose mode's centreKind is K)
 * counts for nothing here: its per-mode stage slot covers it, mounted and
 * never moved, whether the tree shelves or not. So a tree carrying ONLY its
 * stage-owned centre is not shelved at all — the slot is its host — while
 * the same tree with any pane binding (or a foreign centre) shelves for
 * those, the stage-owned centre still slot-covered. This keeps exactly one
 * hosting reason per binding: the slot or the shelf, never a redundant
 * shelf host beside a slot, never a double mount. */
function treeShelfReasons(layout: LayoutState): SurfaceId[] {
  const stageKind = MODE_CURATION[layout.mode ?? "base"].centreKind;
  return treeBindingIds(layout).filter((id) => {
    const binding = layout.surfaces[id];
    if (!binding || binding.pending) return false;
    if (isRetainedPaneKind(binding.kind)) return true;
    return isRetainedCentreKind(binding.kind) && binding.kind !== stageKind;
  });
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
    const retained = treeShelfReasons(layout);
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
