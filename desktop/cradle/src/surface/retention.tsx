/**
 * The mode-centre retention tier (owner-approved three-tier retention law,
 * 2026-09-19; stage law revised 2026-09-20). Switching workspace modes swaps
 * whole per-mode trees, which unmounts every surface in the outgoing tree —
 * the Expressions application reloaded, the Technè wiki web rebuilt, on
 * every hop. This module keeps the heavy centre surfaces MOUNTED across
 * those swaps:
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
 *   tab outside its own mode's tree) keep the park-and-adopt path: the
 *   shell declares each once in a hidden park layer
 *   (`ModeCentreRetention`), and a presenting pane mounts `CentreOutlet`,
 *   which adopts the retained container and releases it back on unmount.
 *   Moves never reload the vending engines these surfaces do not host.
 * - Parked means suspended: the park layer is `display:none`, the same
 *   off-screen observation (`IntersectionObserver`, MaterialSurface's
 *   `useSuspend` law) every viewport-gated surface already honours; a
 *   hidden stage slot is `display:none` by the same law.
 *
 * Per surface KIND (the tier law): engines and hosted applications retain —
 * `expressions` (the vendored application's iframe), `techne`, `epi-logos`,
 * `system`, and `factory`. Factory's Desk/Tasks body composes the frame-built
 * chat node (`CradleFrame.factoryCentre`), so the frame passes that node —
 * with its Desk/Tasks context — down through the shell (DesktopShell →
 * ModeCentreRetention) and to the stage slots alike.
 *
 * Retention keys on the workspace: the retained set is derived only from the
 * ACTIVE workspace's trees, so switching workspaces unmounts every declarer
 * and releases cleanly. The kernel stays the state owner — nothing here
 * caches readings; it keeps mounted presentation alive, nothing more.
 */
import {lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode} from "react";
import {createPortal} from "react-dom";
import {groupsOf} from "./engine";
import {markPresented, markReleased, markRetained, exposeRuntimeProbe} from "./runtime";
import type {LayoutState, SurfaceBinding, SurfaceId} from "./types";
import {MODE_CURATION, TREE_MODES, type WorkspaceMode} from "../workspace/mode";
import type {Workspace} from "../workspace/store";

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

/** The centre-kind binding living in ONE MODE'S OWN TREE: the active
 * workspace layout when that mode is the one standing, else its waiting tree
 * in `modeLayouts` — present in its pane groups. This is the ownership test
 * of the whole tier: a centre in its own mode's tree is STAGE-OWNED (the
 * frame's per-mode slot presents it in place); a centre found anywhere else
 * is pane-tab-presented (the park keeps it; a pane outlet adopts it). */
export function centreBindingOf(workspace: Workspace, activeMode: WorkspaceMode, mode: WorkspaceMode): SurfaceBinding | undefined {
  const kind = MODE_CURATION[mode].centreKind;
  if (!kind) return undefined;
  const layout = mode === activeMode ? workspace.layout : workspace.modeLayouts?.[mode];
  if (!layout) return undefined;
  return presentedBindingOfKind(layout, kind);
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
}

// ---------------------------------------------------------------------------
// The declarer — mounts the centre's body once, inside a container the shell
// parks hidden until an outlet adopts it.

interface WorkbenchSubject { ref?: string; kind?: string; title: string; project?: string }

function retainedBody(binding: SurfaceBinding, _subject?: WorkbenchSubject, factoryCentre?: ReactNode, factoryTasks?: FactoryCentreContext): ReactNode {
  // The centre arms of the workbench's own SurfaceBody, mirrored here with
  // the props the shell itself holds (the frame passes nothing richer into
  // the stage than these). Factory's arm composes the frame-built chat node
  // the shell received — the declarer mounts the one body with it.
  if (binding.kind === "expressions") return <PointCloudHost mode="expressions"/>;
  if (binding.kind === "techne") return <PointCloudHost mode="techne"/>;
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
export {RETAINED_PANE_KINDS, isRetainedPaneKind, WARM_WORKSPACES, warmWorkspaceTrees} from "./warmTrees";
export type {WarmTreeRef} from "./warmTrees";
