/**
 * The mode-centre retention tier (owner-approved three-tier retention law,
 * 2026-09-19; stage law revised 2026-09-20; the park retired 2026-09-20,
 * spec §7.1). Switching workspace modes swaps whole per-mode trees, which
 * unmounts every surface in the outgoing tree — the Expressions application
 * reloaded, the Technè canvas rebuilt, on every hop. This module keeps the
 * heavy centre surfaces MOUNTED across those swaps, and every centre is now
 * presented IN PLACE, wherever it lives:
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
 *
 * Per surface KIND (the tier law): engines and hosted applications retain —
 * `expressions` (the vendored application's iframe), `techne`, `epi-logos`,
 * `system`, and `factory`. Factory's Desk/Tasks body composes the frame-built
 * chat node (`CradleFrame.factoryCentre`), so the frame passes that node —
 * with its Desk/Tasks context — down through the shell to the stage slots
 * and the workbench's centre arm alike.
 *
 * Retention keys on the workspace: the warm set is derived only from the
 * ACTIVE workspace's trees, so switching workspaces releases the others'
 * hosts cleanly. The kernel stays the state owner — nothing here caches
 * readings; it keeps mounted presentation alive, nothing more.
 */
import {lazy, Suspense, useEffect, type ReactNode} from "react";
import {groupsOf} from "./engine";
import {markPresented, markReleased, markRetained, exposeRuntimeProbe} from "./runtime";
import type {LayoutState, SurfaceBinding} from "./types";
import {MODE_CURATION, type WorkspaceMode} from "../workspace/mode";
import type {Workspace} from "../workspace/store";
import type {HostedAppState} from "../expressions/hostedApp";

// The retained centre bodies are the same lazy chunks the workbench mounts;
// a retained centre loads on first presentation, never at startup.
const PointCloudHost = lazy(() => import("../expressions/PointCloudHost").then((module) => ({default: module.PointCloudHost})));

const EpiLogosSurface = lazy(() => import("../epilogos/EpiLogosSurface").then((module) => ({default: module.EpiLogosSurface})));
const SystemPanel = lazy(() => import("../workspace/SystemPanel").then((module) => ({default: module.SystemPanel})));
const FactoryCentre = lazy(() => import("../contributions/factory/FactoryCentre").then((module) => ({default: module.FactoryCentre})));

// The centre kinds this tier retains (see the module law above) are defined
// beside the warm-tree selection law in ./warmTrees — pure presentation
// selection, importable without JSX — and re-exported below so every
// consumer keeps its import path.

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

/** The centre-kind binding living in ONE MODE'S OWN TREE: the active
 * workspace layout when that mode is the one standing, else its waiting tree
 * in `modeLayouts` — present in its pane groups. This is the ownership test
 * of the whole tier: a centre in its own mode's tree is STAGE-OWNED (the
 * frame's per-mode slot presents it in place); a centre found anywhere else
 * is pane-tab-presented (its pane's own wrapper presents it in place). */
export function centreBindingOf(workspace: Workspace, activeMode: WorkspaceMode, mode: WorkspaceMode): SurfaceBinding | undefined {
  const kind = MODE_CURATION[mode].centreKind;
  if (!kind) return undefined;
  const layout = mode === activeMode ? workspace.layout : workspace.modeLayouts?.[mode];
  if (!layout) return undefined;
  return presentedBindingOfKind(layout, kind);
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

function retainedBody(binding: SurfaceBinding, _subject?: WorkbenchSubject, factoryCentre?: ReactNode, factoryTasks?: FactoryCentreContext, onHostedState?: (state: HostedAppState) => void): ReactNode {
  // The centre arms of the workbench's own SurfaceBody, mirrored here with
  // the props the shell itself holds. Factory's arm composes the frame-built
  // chat node the shell received — one body with it, never a second copy.
  if (binding.kind === "expressions") return <PointCloudHost mode="expressions" deepLink={binding.engine?.expressionRef} onHostedState={onHostedState}/>;
  if (binding.kind === "techne") return <PointCloudHost mode="techne" deepLink={binding.engine?.expressionRef} onHostedState={onHostedState}/>;
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
  }, [binding.id, binding.kind, presented]);
  useEffect(() => () => markReleased(binding.id, binding.kind), [binding.id, binding.kind]);
  return null;
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
// The warm-tree selection moved to ./warmTrees (workspace-continuity WF4 +
// spec §7.1 shelving): pane kinds, centre kinds, the shelf criterion and the
// warm-set derivation — pure logic, no JSX. The tier re-exports so every
// consumer keeps importing from this module, and this file keeps the
// mounting law: bodies present in place, stages and trees never move. */
export {RETAINED_CENTRE_KINDS, isRetainedCentreKind, RETAINED_PANE_KINDS, isRetainedPaneKind, WARM_WORKSPACES, warmWorkspaceTrees} from "./warmTrees";
export type {WarmTreeRef} from "./warmTrees";
